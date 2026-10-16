# RAW WAY FIT — Online Client Assessment + Trainer Dashboard

This starter adds two pages to your existing GitHub Pages site:
- `assessment.html` — public client assessment form
- `trainer.html` — private trainer dashboard (Supabase email/password sign-in)

Database: Supabase Postgres. Your existing website can remain as it is.

## Before using with real clients

1. Open your existing Supabase project.
2. In **SQL Editor**, run `supabase-schema.sql`.
3. In Supabase **Authentication → Users**, create your trainer account using your email and a strong password.
4. Copy the trainer user's UUID from Authentication → Users.
5. In SQL Editor, run the final `INSERT INTO public.trainer_users ...` statement shown at the bottom of `supabase-schema.sql`, replacing `YOUR_AUTH_USER_UUID`.
6. Ensure email/password sign-in is enabled in **Authentication → Sign In / Providers**.
7. Upload these files to the root of the same GitHub Pages repository as your existing `index.html`:
   - `assessment.html`
   - `trainer.html`
   - `rawwayfit-app.css`
   - `rawwayfit-config.js`
   - `assessment.js`
   - `trainer.js`
8. Edit `rawwayfit-config.js` and paste the Supabase project URL and **publishable/anon key** already used by your website. Never put a `service_role` or secret key in website code.
9. Commit and push. Then test:
   - `https://rawwayfit.in/assessment.html`
   - `https://rawwayfit.in/trainer.html`

## Security model

- Public visitors can submit an assessment but cannot read assessment records.
- Only user IDs explicitly listed in `trainer_users` can view/update assessments.
- The dashboard requires Supabase authentication.
- The SQL adds row-level security (RLS) policies and a trigger to clear trainer-only fields on public submissions.
- Never disable RLS. Never put a Supabase service-role key in GitHub Pages code.
- Because this form includes medical and other sensitive information, review privacy/consent wording and your legal obligations before collecting real data.
- This starter does not upload actual progress-photo files. It records whether front/side/back photos are available. Private photo uploads can be added separately with storage access policies.

## Existing website compatibility

The files are standalone and do not replace `index.html`, `style.css`, or `script.js`. Your current site and its feedback feature should continue to work.

## Troubleshooting

- `Invalid API key`: check the URL and publishable/anon key in `rawwayfit-config.js`.
- `new row violates row-level security`: confirm the SQL ran successfully and declaration is checked.
- Dashboard says access denied: create the user in Supabase Auth and add that exact user UUID to `trainer_users`.
- GitHub Pages 404: confirm files are in the same published directory as `index.html`, and wait for deployment to finish.


## Updated form design and behaviour
- Bright, colourful light theme with blue/purple accents and warm highlights.
- Main goal is a checkbox group, so clients can select more than one goal.
- Medical, medication, injury/surgery, exercise pain, warning symptoms and doctor-restriction details appear only when the related answer is Yes.
- Required fields show a red asterisk.

## New features: client numbers, member counts, and email notifications

### What this adds
- Every saved assessment gets a unique database-generated number, displayed as `RWF-000001`, `RWF-000002`, etc. The number is generated in the database, so simultaneous submissions do not get the same number.
- Trainer search supports the client number, name, email, or phone.
- The dashboard shows total client records and counts members marked **Active**.
- The trainer can mark each record **Lead / not started**, **Active training member**, **On hold**, or **Completed**. The active-member count updates when the trainer saves a status.
- Approved trainers can permanently delete a selected client assessment from its details panel. The action requires confirmation and is protected by a trainer-only database policy.
- After submission, an email is sent to the trainer and a confirmation email containing the client number is sent to the client. Client email is now required.

### One-time setup needed before email works
Email must be sent from a server-side function, not directly from public browser code. This package includes the Supabase Edge Function at `supabase/functions/submit-assessment/index.ts`.

1. **Run the updated SQL.** In Supabase → SQL Editor, review `supabase-schema.sql` and run it. It adds the client number and training status fields and configures trainer-only read/update/delete policies. If you already have data, take a backup first.
2. **Create/verify your trainer login.** Follow the earlier steps in this README to add your Supabase Auth user UUID to `public.trainer_users`.
3. **Set up email with Resend.** Create an account at https://resend.com and verify a domain you control. For reliable sending, use a sender address on that verified domain (not a made-up address). Resend may have account-specific sending restrictions.
4. **Deploy the Edge Function.** Install the Supabase CLI and log in, then from this folder run:
   - `supabase login`
   - `supabase link --project-ref wwsiwomvwfqrjufgyfgp`
   - `supabase functions deploy submit-assessment`
5. **Set Edge Function secrets** in Supabase → Edge Functions → Secrets (or with the CLI):
   - `RESEND_API_KEY` = your Resend API key
   - `TRAINER_NOTIFICATION_EMAIL` = `rawwayfit@gmail.com` (or the email where you want new-client notifications)
   - `FROM_EMAIL` = a sender address on the domain verified with Resend, for example `RAW WAY FIT <notifications@your-verified-domain.in>`
   Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. If your project environment does not provide them automatically, set them as Edge Function secrets from your Supabase project settings. **Never add the service-role key to any HTML, JavaScript, GitHub repository, or public config file.**
6. Upload updated `assessment.html`, `assessment.js`, `trainer.html`, `trainer.js`, and `rawwayfit-app.css` to the published root of your GitHub Pages repository. Keep `rawwayfit-config.js` with the existing publishable key.
7. Test using your own email first. Submit a test assessment, note the `RWF-######` client number, verify both emails, log in to the trainer dashboard, search by that number, then change the training status to Active and confirm the active-member count increases.

### Email and privacy notes
- Email delivery requires a working Resend account, a verified sending domain, correct Edge Function secrets, and the latest deployed Edge Function. The top-of-form submission result shows the unique client number and separate delivery status for the client and trainer emails. If delivery fails, inspect the `submit-assessment` Edge Function logs for the Resend/network error and confirm the sender domain, API key, trainer email, and deployment.
- The trainer email includes the client's contact details and client number, but not the full medical assessment. The client email includes the client number and submission confirmation, not their health details.
- Do not expose the Supabase service-role key. Keep RLS enabled and only approve trusted trainer UUIDs.
- This starter includes basic server-side validation, but a public form can still attract spam. Before promoting it widely, consider adding CAPTCHA/Turnstile and rate limiting.
