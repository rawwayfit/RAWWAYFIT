import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase server configuration.");
      return json({ error: "Server configuration error." }, 500);
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Please sign in as an approved trainer." }, 401);
    }

    const token = authorization.slice("Bearer ".length).trim();
    if (!token) {
      return json({ error: "Please sign in as an approved trainer." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Verify the Supabase access token.
    const { data: userData, error: userError } =
      await admin.auth.getUser(token);

    if (userError || !userData.user) {
      return json({ error: "Your login is invalid or has expired." }, 401);
    }

    // Require approved trainer membership.
    const { data: trainer, error: trainerError } = await admin
      .from("trainer_users")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (trainerError) {
      console.error("Trainer authorization check failed:", trainerError);
      return json({ error: "Could not verify trainer permissions." }, 500);
    }

    if (!trainer) {
      return json(
        { error: "Only an approved RAWWAYFIT trainer can authorize reassessment." },
        403,
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "A valid JSON request body is required." }, 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      !("email" in body) ||
      typeof body.email !== "string"
    ) {
      return json({ error: "A valid client email address is required." }, 400);
    }

    const email = body.email.trim().toLowerCase();

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Enter a valid client email address." }, 400);
    }

    // Confirm that this email belongs to an existing assessment.
    // Escape PostgREST pattern characters so email underscores are literal.
    const escapedEmail = email.replace(/[\\%_]/g, "\\$&");

    const { data: existingAssessment, error: assessmentError } = await admin
      .from("client_assessments")
      .select("id")
      .ilike("client_email", escapedEmail)
      .limit(1)
      .maybeSingle();

    if (assessmentError) {
      console.error("Existing assessment check failed:", assessmentError);
      return json({ error: "Could not verify the client's existing assessment." }, 500);
    }

    if (!existingAssessment) {
      return json(
        { error: "No existing assessment was found for this email. No changes were made." },
        404,
      );
    }

    // Remove the existing lock to authorize reassessment.
    // If no lock exists, the email is already unlocked.
    // Preserve every historical assessment.
    const { error: unlockError } = await admin
      .from("assessment_submission_locks")
      .delete()
      .eq("email_normalized", email);

    if (unlockError) {
      console.error("Reassessment authorization failed:", unlockError);
      return json({ error: "Could not authorize reassessment." }, 500);
    }

    return json({
      success: true,
      message:
        "Reassessment authorized. Existing assessment history has been preserved.",
    });
  } catch (error) {
    console.error("Unexpected reassessment authorization error:", error);
    return json({ error: "An unexpected server error occurred." }, 500);
  }
});
