
(function () {
  "use strict";

  const form = document.getElementById("assessmentForm");
  const message = document.getElementById("formMessage");
  const resultCard = document.getElementById("submissionResult");
  const resultHeading = document.getElementById("resultHeading");
  const clientNumberResult = document.getElementById("clientNumberResult");
  const clientNumberValue = document.getElementById("clientNumberValue");
  const emailStatusResult = document.getElementById("emailStatusResult");
  const submitButton = document.getElementById("submitButton");
  const cfg = window.RAW_WAY_FIT_CONFIG || {};

  const DUPLICATE_EMAIL_MESSAGE =
    "This email address has already been used to submit a fitness assessment. Please contact Coach Rakesh at rawwayfit@gmail.com if you need assistance.";

  function setMessage(text, kind, details) {
    message.textContent = text;
    message.className = "rw-message" + (kind ? " " + kind : "");

    resultCard.classList.toggle("rw-hidden", !text);
    resultCard.classList.toggle("error", kind === "error");
    resultCard.classList.toggle("success", kind === "success");

    resultHeading.textContent =
      kind === "success" ? "Assessment submitted" : "Submission status";

    clientNumberResult.classList.toggle(
      "rw-hidden",
      !details || !details.clientCode
    );
    clientNumberValue.textContent =
      details && details.clientCode ? details.clientCode : "";

    emailStatusResult.classList.toggle(
      "rw-hidden",
      !details || !details.emailStatus
    );
    emailStatusResult.textContent =
      details && details.emailStatus ? details.emailStatus : "";
  }

  function getSupabase() {
    if (
      !window.supabase ||
      !cfg.supabaseUrl ||
      !cfg.supabasePublishableKey ||
      cfg.supabaseUrl.includes("PASTE_") ||
      cfg.supabasePublishableKey.includes("PASTE_")
    ) {
      throw new Error(
        "The form is not connected yet. Please contact RAW WAY FIT."
      );
    }

    return window.supabase.createClient(
      cfg.supabaseUrl,
      cfg.supabasePublishableKey
    );
  }

  async function getFunctionErrorMessage(error) {
    // Supabase FunctionsHttpError may contain the actual HTTP response
    // in error.context, including the JSON returned by the Edge Function.
    if (error && error.context) {
      try {
        const context = error.context;

        if (typeof context.json === "function") {
          const body = await context.json();

          if (body && typeof body.error === "string") {
            return body.error;
          }

          if (body && typeof body.message === "string") {
            return body.message;
          }
        }

        if (typeof context.text === "function") {
          const text = await context.text();

          if (text) {
            try {
              const body = JSON.parse(text);

              if (typeof body.error === "string") {
                return body.error;
              }

              if (typeof body.message === "string") {
                return body.message;
              }
            } catch (_) {
              // The response wasn't JSON; use its text only if useful.
              if (text.includes("ASSESSMENT_ALREADY_SUBMITTED")) {
                return DUPLICATE_EMAIL_MESSAGE;
              }
            }
          }
        }
      } catch (readError) {
        console.warn("Could not read the function error response:", readError);
      }
    }

    const originalMessage =
      error && typeof error.message === "string" ? error.message : "";

    if (
      originalMessage.includes("ASSESSMENT_ALREADY_SUBMITTED") ||
      originalMessage.toLowerCase().includes("already submitted") ||
      originalMessage.toLowerCase().includes("already been used")
    ) {
      return DUPLICATE_EMAIL_MESSAGE;
    }

    return (
      "We couldn't submit your assessment. Please check your internet connection and try again, or contact rawwayfit@gmail.com."
    );
  }

  function formValues() {
    const fd = new FormData(form);
    const data = {};

    for (const [key, value] of fd.entries()) {
      if (
        key === "client_name" ||
        key === "client_email" ||
        key === "phone" ||
        key === "client_confirmation" ||
        key === "declaration"
      ) {
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (!Array.isArray(data[key])) {
          data[key] = [data[key]];
        }
        data[key].push(value);
      } else {
        data[key] = value;
      }
    }

    ["photos_available", "coaching_support", "main_goal"].forEach(
      function (key) {
        if (!data[key]) data[key] = [];
      }
    );

    return data;
  }

  // Show detail fields only when their matching health question is answered Yes.
  const conditionalFields = Array.from(
    form.querySelectorAll("[data-show-when]")
  );

  function updateConditionalFields() {
    conditionalFields.forEach(function (field) {
      const trigger = document.getElementById(field.dataset.showWhen);
      const shouldShow =
        !!trigger && trigger.value === field.dataset.showValue;

      field.classList.toggle("rw-hidden", !shouldShow);

      if (!shouldShow) {
        const detail = field.querySelector("textarea, input, select");
        if (detail) detail.value = "";
      }
    });
  }

  form.querySelectorAll("select").forEach(function (select) {
    if (
      conditionalFields.some(function (field) {
        return field.dataset.showWhen === select.id;
      })
    ) {
      select.addEventListener("change", updateConditionalFields);
    }
  });

  form.addEventListener("reset", function () {
    window.setTimeout(updateConditionalFields, 0);
  });

  updateConditionalFields();

  const today = new Date();
  const localDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);

  const dateInput = document.getElementById("confirmation_date");

  if (dateInput && !dateInput.value) {
    dateInput.value = localDate;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    setMessage("", "");

    if (!form.reportValidity()) return;

    const submitToday = new Date();
    const submitLocalDate = new Date(
      submitToday.getTime() - submitToday.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 10);

    if (dateInput) dateInput.value = submitLocalDate;

    const fullName = document.getElementById("client_name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("client_email").value.trim();

    if (fullName.length < 2 || phone.length < 5) {
      setMessage("Please check your name and phone number.", "error");
      return;
    }

    if (!email) {
      setMessage(
        "Please enter your email address so we can send your client number and confirmation.",
        "error"
      );
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";

    try {
      const client = getSupabase();

      const row = {
        client_name: fullName,
        client_email: email,
        phone: phone,
        declaration: document.getElementById("declaration").checked,
        assessment_data: formValues()
      };

      const { data: result, error } = await client.functions.invoke(
        "submit-assessment",
        { body: row }
      );

      if (error) {
        const actualMessage = await getFunctionErrorMessage(error);

        if (
          actualMessage === DUPLICATE_EMAIL_MESSAGE ||
          actualMessage.includes("already been used to submit a fitness assessment")
        ) {
          setMessage(DUPLICATE_EMAIL_MESSAGE, "error");
        } else {
          setMessage(actualMessage, "error");
        }

        resultCard.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

        return;
      }

      if (result && result.error) {
        const responseMessage =
          result.error.includes("ASSESSMENT_ALREADY_SUBMITTED") ||
          result.error.toLowerCase().includes("already submitted")
            ? DUPLICATE_EMAIL_MESSAGE
            : result.error;

        setMessage(responseMessage, "error");
        resultCard.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
        return;
      }

      if (!result || !result.client_number) {
        throw new Error(
          "Submission response was incomplete. Please contact rawwayfit@gmail.com before submitting again."
        );
      }

      const clientCode =
        "RWF-" + String(result.client_number).padStart(6, "0");

      const clientEmailSent = result.client_email_sent === true;
      const trainerEmailSent = result.trainer_email_sent === true;

      const emailStatus =
        "Client confirmation email: " +
        (clientEmailSent ? "sent." : "not sent.") +
        " Trainer notification: " +
        (trainerEmailSent ? "sent." : "not sent.") +
        (clientEmailSent
          ? ""
          : " Please save your client number and contact rawwayfit@gmail.com if you need the confirmation resent.");

      // Reset only after a confirmed successful submission.
      form.reset();

      if (dateInput) dateInput.value = submitLocalDate;

      setMessage(
        "Thank you. Your assessment was submitted successfully.",
        "success",
        {
          clientCode: clientCode,
          emailStatus: emailStatus
        }
      );

      resultCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      console.error("Assessment submission failed:", error);

      const actualMessage = await getFunctionErrorMessage(error);
      setMessage(actualMessage, "error");

      resultCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit assessment securely";
    }
  });
})();
