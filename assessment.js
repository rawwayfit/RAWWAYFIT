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

  function setMessage(text, kind, details) {
    message.textContent = text;
    message.className = "rw-message" + (kind ? " " + kind : "");
    resultCard.classList.toggle("rw-hidden", !text);
    resultCard.classList.toggle("error", kind === "error");
    resultCard.classList.toggle("success", kind === "success");
    resultHeading.textContent = kind === "success" ? "Assessment submitted" : "Submission status";
    clientNumberResult.classList.toggle("rw-hidden", !details || !details.clientCode);
    clientNumberValue.textContent = details && details.clientCode ? details.clientCode : "";
    emailStatusResult.classList.toggle("rw-hidden", !details || !details.emailStatus);
    emailStatusResult.textContent = details && details.emailStatus ? details.emailStatus : "";
  }

  function getSupabase() {
    if (!window.supabase || !cfg.supabaseUrl || !cfg.supabasePublishableKey ||
        cfg.supabaseUrl.includes("PASTE_") || cfg.supabasePublishableKey.includes("PASTE_")) {
      throw new Error("The form is not connected yet. Please contact RAW WAY FIT.");
    }
    return window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  }

  function formValues() {
    const fd = new FormData(form);
    const data = {};
    for (const [key, value] of fd.entries()) {
      if (key === "client_name" || key === "client_email" || key === "phone" ||
          key === "client_confirmation" || key === "declaration") continue;
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (!Array.isArray(data[key])) data[key] = [data[key]];
        data[key].push(value);
      } else {
        data[key] = value;
      }
    }
    // Preserve unchecked checkbox groups as empty arrays for consistent records.
    ["photos_available", "coaching_support", "main_goal"].forEach(function (key) {
      if (!data[key]) data[key] = [];
    });
    return data;
  }

  // Show each details field only when its matching health question is answered Yes.
  const conditionalFields = Array.from(form.querySelectorAll("[data-show-when]"));
  function updateConditionalFields() {
    conditionalFields.forEach(function (field) {
      const trigger = document.getElementById(field.dataset.showWhen);
      const shouldShow = !!trigger && trigger.value === field.dataset.showValue;
      field.classList.toggle("rw-hidden", !shouldShow);
      if (!shouldShow) {
        const detail = field.querySelector("textarea, input, select");
        if (detail) detail.value = "";
      }
    });
  }
  form.querySelectorAll("select").forEach(function (select) {
    if (conditionalFields.some(function (field) { return field.dataset.showWhen === select.id; })) {
      select.addEventListener("change", updateConditionalFields);
    }
  });
  form.addEventListener("reset", function () { window.setTimeout(updateConditionalFields, 0); });
  updateConditionalFields();

  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const dateInput = document.getElementById("confirmation_date");
  if (dateInput && !dateInput.value) dateInput.value = localDate;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    setMessage("", "");
    if (!form.reportValidity()) return;

    const submitToday = new Date();
    const submitLocalDate = new Date(submitToday.getTime() - submitToday.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (dateInput) dateInput.value = submitLocalDate;
    const fullName = document.getElementById("client_name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("client_email").value.trim();
    if (fullName.length < 2 || phone.length < 5) {
      setMessage("Please check your name and phone number.", "error");
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
    try {
      const client = getSupabase();
      if (!email) throw new Error("Please enter your email address so we can send your client number and confirmation.");
      const row = {
        client_name: fullName,
        client_email: email,
        phone: phone,
        declaration: document.getElementById("declaration").checked,
        assessment_data: formValues()
      };
      const { data: result, error } = await client.functions.invoke("submit-assessment", { body: row });
      if (error) throw error;
      if (!result || !result.client_number) throw new Error("Submission response was incomplete. Please contact RAW WAY FIT before submitting again.");
      form.reset();
      if (dateInput) dateInput.value = submitLocalDate;
      const clientCode = "RWF-" + String(result.client_number).padStart(6, "0");
      const clientEmailSent = result.client_email_sent === true;
      const trainerEmailSent = result.trainer_email_sent === true;
      const emailStatus = "Client confirmation email: " + (clientEmailSent ? "sent." : "not sent.") +
        " Trainer notification: " + (trainerEmailSent ? "sent." : "not sent.") +
        (clientEmailSent ? "" : " Please save your client number and contact rawwayfit@gmail.com if you need the confirmation resent.");
      setMessage(
        "Thank you. Your assessment was submitted successfully.",
        "success",
        { clientCode: clientCode, emailStatus: emailStatus }
      );
      resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error("Assessment submission failed:", error);
      setMessage(error && error.message ? error.message + " If this continues, contact rawwayfit@gmail.com." : "We couldn't submit your assessment. Please check your internet connection and try again, or contact rawwayfit@gmail.com.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit assessment securely";
    }
  });
})();
