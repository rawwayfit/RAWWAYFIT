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
    // Save the assessment and reserve its email atomically.
    const { data: saved, error: submitError } = await admin.rpc(
      "submit_client_assessment",
      {
        p_client_name: name,
        p_client_email: email,
        p_phone: phone,
        p_assessment_data: assessmentData,
      }
    );

    if (submitError || !saved) {
      if (
        submitError?.message?.includes("ASSESSMENT_ALREADY_SUBMITTED")
      ) {
        return json({
          error: "An assessment has already been submitted with this email address. Please contact Coach Rakesh if you need to submit a reassessment."
        }, 409);
      }

      console.error("Atomic assessment submission failed:", submitError);
      return json({
        error: "We could not save your assessment. Please try again or contact RAW WAY FIT."
      }, 500);
    }

    const clientCode = `RWF-${String(saved.client_number).padStart(6, "0")}`;
    const subjectName = name.replace(/\s+/g, " ");
    const submitted = new Date(saved.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
    const trainerHtml = `<div style="margin:0;padding:24px 10px;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#222"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden"><tr><td style="background:#111111;padding:28px 20px;text-align:center;border-bottom:4px solid #e32636"><img src="https://wwsiwomvwfqrjufgyfgp.supabase.co/storage/v1/object/public/images/logo-img/main_logo.png" alt="RAWWAYFIT Logo" width="160" style="display:block;width:160px;max-width:100%;height:auto;margin:0 auto 14px"><h1 style="margin:0;color:#ffffff;font-size:25px;letter-spacing:2px">RAWWAYFIT</h1><p style="margin:8px 0 0;color:#f0f0f0;font-size:12px;letter-spacing:1px">PERSONAL TRAINING &amp; ONLINE COACHING</p></td></tr><tr><td style="padding:28px 24px"><p style="margin:0 0 8px;color:#e32636;font-size:12px;font-weight:bold;letter-spacing:1px">NEW SUBMISSION</p><h2 style="margin:0 0 18px;font-size:23px;color:#171717">New Client Assessment</h2><p style="margin:0 0 20px;line-height:1.7;color:#555">A new client has submitted the RAWWAYFIT fitness assessment. Review the details below and open your trainer dashboard to view the full assessment.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-size:14px"><tr><td style="padding:12px;background:#f7f7f7;border-bottom:1px solid #e5e5e5;color:#666;width:35%">Client number</td><td style="padding:12px;background:#f7f7f7;border-bottom:1px solid #e5e5e5;color:#e32636;font-weight:bold">${clientCode}</td></tr><tr><td style="padding:12px;border-bottom:1px solid #e5e5e5;color:#666">Name</td><td style="padding:12px;border-bottom:1px solid #e5e5e5;color:#222">${escapeHtml(name)}</td></tr><tr><td style="padding:12px;background:#f7f7f7;border-bottom:1px solid #e5e5e5;color:#666">Email</td><td style="padding:12px;background:#f7f7f7;border-bottom:1px solid #e5e5e5;color:#222;overflow-wrap:anywhere">${escapeHtml(email)}</td></tr><tr><td style="padding:12px;border-bottom:1px solid #e5e5e5;color:#666">Phone</td><td style="padding:12px;border-bottom:1px solid #e5e5e5;color:#222">${escapeHtml(phone)}</td></tr><tr><td style="padding:12px;background:#f7f7f7;color:#666">Submitted</td><td style="padding:12px;background:#f7f7f7;color:#222">${escapeHtml(submitted)} (India time)</td></tr></table><div style="text-align:center;margin:28px 0 10px"><a href="https://rawwayfit.in/trainer.html" style="display:inline-block;background:#e32636;color:#ffffff;text-decoration:none;font-weight:bold;padding:15px 24px;border-radius:5px">Open Trainer Dashboard</a></div><p style="margin:22px 0 0;color:#777;font-size:12px;line-height:1.6">Please sign in to your private trainer dashboard to review the complete assessment and update the client's training status.</p></td></tr><tr><td style="background:#111111;padding:20px;text-align:center;border-top:3px solid #e32636"><p style="margin:0 0 6px;color:#ffffff;font-weight:bold;letter-spacing:1px">RAWWAYFIT</p><p style="margin:0;color:#bbbbbb;font-size:12px">Transform Your Body. Elevate Your Life.</p><p style="margin:10px 0 0;font-size:12px"><a href="https://rawwayfit.in" style="color:#ff6874;text-decoration:none">rawwayfit.in</a></p></td></tr></table></div>`
    const clientHtml = `<div style="margin:0;padding:24px 10px;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif;color:#222"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden"><tr><td style="background:#111111;padding:28px 20px;text-align:center;border-bottom:4px solid #e32636"><img src="https://wwsiwomvwfqrjufgyfgp.supabase.co/storage/v1/object/public/images/logo-img/main_logo.png" alt="RAWWAYFIT Logo" width="160" style="display:block;width:160px;max-width:100%;height:auto;margin:0 auto 14px"><h1 style="margin:0;color:#ffffff;font-size:25px;letter-spacing:2px">RAWWAYFIT</h1><p style="margin:8px 0 0;color:#f0f0f0;font-size:12px;letter-spacing:1px">PERSONAL TRAINING &amp; ONLINE COACHING</p></td></tr><tr><td style="padding:30px 24px"><p style="margin:0 0 8px;color:#e32636;font-size:12px;font-weight:bold;letter-spacing:1px">ASSESSMENT CONFIRMATION</p><h2 style="margin:0 0 18px;font-size:24px;color:#171717">Thank You, ${escapeHtml(name)}!</h2><p style="margin:0 0 16px;line-height:1.8;color:#555">Your fitness assessment has been submitted successfully. Thank you for taking the first step toward your fitness goals. Keep this email for your records.</p><div style="margin:24px 0;padding:22px 16px;text-align:center;background:#fff5f5;border:1px solid #ffd8dc;border-radius:8px"><p style="margin:0 0 8px;color:#666;font-size:12px;font-weight:bold;letter-spacing:1px">YOUR RAWWAYFIT CLIENT NUMBER</p><p style="margin:0;color:#e32636;font-size:28px;font-weight:bold;letter-spacing:1px;overflow-wrap:anywhere">${clientCode}</p><p style="margin:12px 0 0;color:#666;font-size:13px;line-height:1.6">Please save this number. Your trainer can use it to find your assessment record.</p></div><p style="margin:18px 0 8px;color:#444;font-size:14px"><strong>Submission date:</strong> ${escapeHtml(submitted)} (India time)</p><p style="margin:20px 0;line-height:1.8;color:#555">Your fitness journey is personal, and your assessment helps your trainer understand your goals and needs.</p><div style="text-align:center;margin:26px 0"><a href="https://rawwayfit.in" style="display:inline-block;background:#e32636;color:#ffffff;text-decoration:none;font-weight:bold;padding:15px 28px;border-radius:5px">Visit RAWWAYFIT</a></div><p style="margin:24px 0 0;color:#555;line-height:1.8">Regards,<br><strong style="color:#171717">Coach Rakesh H V</strong><br>RAWWAYFIT Personal Training &amp; Online Coaching</p></td></tr><tr><td style="background:#111111;padding:20px;text-align:center;border-top:3px solid #e32636"><p style="margin:0 0 6px;color:#ffffff;font-weight:bold;letter-spacing:1px">RAWWAYFIT</p><p style="margin:0;color:#bbbbbb;font-size:12px">Transform Your Body. Elevate Your Life.</p><p style="margin:10px 0 0;font-size:12px"><a href="https://rawwayfit.in" style="color:#ff6874;text-decoration:none">rawwayfit.in</a></p></td></tr></table></div>`

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
