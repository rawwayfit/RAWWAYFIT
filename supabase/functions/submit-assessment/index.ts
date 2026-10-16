import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_REQUEST_BYTES = 40000;
const MAX_ASSESSMENT_FIELDS = 100;
const MAX_ASSESSMENT_ARRAY_ITEMS = 40;

class RequestValidationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c] as string));

async function readJsonRequest(req: Request): Promise<unknown> {
  const contentType = req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new RequestValidationError("Content-Type must be application/json.", 415);
  }

  const declaredLength = req.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) {
      throw new RequestValidationError("Invalid Content-Length header.", 400);
    }
    if (Number(declaredLength) > MAX_REQUEST_BYTES) {
      throw new RequestValidationError("Submission is too large.", 413);
    }
  }

  const reader = req.body?.getReader();
  if (!reader) {
    throw new RequestValidationError("A JSON request body is required.", 400);
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the size-limit response if cancelling the stream fails.
        }
        throw new RequestValidationError("Submission is too large.", 413);
      }

      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RequestValidationError) throw error;
    throw new RequestValidationError("The request body could not be read.", 400);
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new RequestValidationError("The request body must contain valid JSON.", 400);
  }
}

function isAssessmentData(value: unknown): value is Record<string, string | string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const fields = Object.entries(value);
  return fields.length <= MAX_ASSESSMENT_FIELDS && fields.every(([key, field]) =>
    /^[a-z][a-z0-9_]{0,63}$/i.test(key) &&
    (
      (typeof field === "string" && field.length <= 3000) ||
      (
        Array.isArray(field) &&
        field.length <= MAX_ASSESSMENT_ARRAY_ITEMS &&
        field.every((item) => typeof item === "string" && item.length <= 3000)
      )
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function sendEmail(apiKey: string, from: string, to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("Email provider error:", response.status, detail);
    return false;
  }
  return true;
}

async function attemptEmail(apiKey: string, from: string, to: string, subject: string, html: string) {
  try {
    return await sendEmail(apiKey, from, to, subject, html);
  } catch (error) {
    console.error("Email delivery request failed:", error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const payload = await readJsonRequest(req);
    if (!isRecord(payload)) {
      throw new RequestValidationError("The request body must be a JSON object.", 400);
    }
    // Honeypot for basic automated spam. This field is not shown to real clients.
    if ("website" in payload && payload.website) {
      throw new RequestValidationError("Invalid submission.", 400);
    }
    const name = typeof payload.client_name === "string" ? payload.client_name.trim() : "";
    const email = typeof payload.client_email === "string" ? payload.client_email.trim().toLowerCase() : "";
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const declaration = payload.declaration === true;
    const assessmentData = payload.assessment_data;
    if (name.length < 2 || name.length > 120 || phone.length < 5 || phone.length > 40 ||
        /[\u0000-\u001f\u007f]/.test(name) || /[\u0000-\u001f\u007f]/.test(phone) ||
        email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !declaration || !isAssessmentData(assessmentData)) {
      throw new RequestValidationError("Please check the required fields, email address, and declaration.", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const trainerEmail = Deno.env.get("TRAINER_NOTIFICATION_EMAIL");
    const fromEmail = Deno.env.get("FROM_EMAIL");
    if (!supabaseUrl || !serviceRoleKey || !resendKey || !trainerEmail || !fromEmail) {
      console.error("Missing Edge Function secrets. Required: RESEND_API_KEY, TRAINER_NOTIFICATION_EMAIL, FROM_EMAIL; Supabase service env vars also required.");
      return json({ error: "The notification service is not configured yet. Please contact RAW WAY FIT." }, 503);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: saved, error: insertError } = await admin.from("client_assessments").insert({
      client_name: name,
      client_email: email,
      phone,
      declaration: true,
      assessment_data: assessmentData,
      training_status: "Lead",
    }).select("id, client_number, created_at").single();
    if (insertError || !saved) {
      console.error("Assessment database insert failed:", insertError);
      return json({ error: "We could not save your assessment. Please try again or contact RAW WAY FIT." }, 500);
    }

    const clientCode = `RWF-${String(saved.client_number).padStart(6, "0")}`;
    const subjectName = name.replace(/\s+/g, " ");
    const submitted = new Date(saved.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
    const trainerHtml = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033"><h2>New RAW WAY FIT client assessment</h2><p><b>Client number:</b> ${clientCode}</p><p><b>Name:</b> ${escapeHtml(name)}</p><p><b>Email:</b> ${escapeHtml(email)}</p><p><b>Phone:</b> ${escapeHtml(phone)}</p><p><b>Submitted:</b> ${escapeHtml(submitted)} (India time)</p><p>Log in to your private trainer dashboard to review the full assessment and update training status:</p><p><a href="https://rawwayfit.in/trainer.html">Open Trainer Dashboard</a></p></div>`;
    const clientHtml = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033"><h2>Thank you for completing your RAW WAY FIT assessment</h2><p>Hi ${escapeHtml(name)},</p><p>Your assessment has been submitted successfully.</p><p style="font-size:20px"><b>Your client number: ${clientCode}</b></p><p>Please save this number. Your trainer can use it to find your record.</p><p><b>Submission date:</b> ${escapeHtml(submitted)} (India time)</p><p>Regards,<br>RAW WAY FIT<br><a href="https://rawwayfit.in">rawwayfit.in</a></p></div>`;

    const [trainerEmailSent, clientEmailSent] = await Promise.all([
      attemptEmail(resendKey, fromEmail, trainerEmail, `New client assessment: ${clientCode} — ${subjectName}`, trainerHtml),
      attemptEmail(resendKey, fromEmail, email, `Your RAW WAY FIT client number: ${clientCode}`, clientHtml),
    ]);
    return json({ client_number: saved.client_number, client_code: clientCode, trainer_email_sent: trainerEmailSent, client_email_sent: clientEmailSent });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return json({ error: error.message }, error.status);
    }
    console.error("submit-assessment error:", error);
    return json({ error: "Unexpected error. Please try again or contact RAW WAY FIT." }, 500);
  }
});
