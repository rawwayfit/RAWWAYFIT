// trainer.js
(function () {
  "use strict";

  // --------------------------------------------------
  // RAWWAYFIT TRAINER DASHBOARD
  // Requires Supabase JS v2 and rawwayfit-config.js
  // --------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const cfg = window.RAW_WAY_FIT_CONFIG || {};

  let supabaseClient = null;
  let allAssessments = [];
  let selected = null;
  let clientPage = 0;
  let clientStatusFilter = "all";
  let passwordRecoveryActive = false;
  let lastClientTrigger = null;
  let authorizationCheckInProgress = false;

  const clientPageSize = 3;
  const statuses = ["Lead", "Active", "On hold", "Completed"];

  const loginPanel = $("loginPanel");
  const dashboardPanel = $("dashboardPanel");
  const passwordRecoveryPanel = $("passwordRecoveryPanel");
  const loginForm = $("loginForm");
  const passwordRecoveryForm = $("passwordRecoveryForm");
  const clientRows = $("clientRows");
  const detailPanel = $("detailPanel");
  const assessmentDetails = $("assessmentDetails");
  const searchInput = $("searchClients");
  const clientPagination = $("clientPagination");
  const mobileLayout = window.matchMedia("(max-width: 700px)");

  // --------------------------------------------------
  // MESSAGES AND BUTTONS
  // --------------------------------------------------

  function msg(element, text, kind) {
    if (!element) return;

    element.textContent = text || "";
    element.classList.remove("success", "error");

    if (kind) element.classList.add(kind);
  }

  function setButtonBusy(button, busy, busyText, normalText) {
    if (!button) return;

    button.disabled = busy;
    button.textContent = busy ? busyText : normalText;
  }

  // --------------------------------------------------
  // SUPABASE CLIENT
  // --------------------------------------------------

  function getClient() {
    if (supabaseClient) return supabaseClient;

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error(
        "The Supabase library did not load. Refresh the page."
      );
    }

    if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) {
      throw new Error(
        "Supabase configuration is missing. Check rawwayfit-config.js."
      );
    }

    supabaseClient = window.supabase.createClient(
      cfg.supabaseUrl,
      cfg.supabasePublishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    return supabaseClient;
  }

  // --------------------------------------------------
  // TRAINER AUTHORIZATION
  // --------------------------------------------------

  async function isAuthorizedTrainer() {
    const client = getClient();

    const {
      data: { user },
      error: userError
    } = await client.auth.getUser();

    if (userError) {
      console.error("Could not retrieve authenticated user:", userError);
      throw new Error(
        "Unable to verify your account. Please try again."
      );
    }

    if (!user) return false;

    const { data, error } = await client
      .from("trainer_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Trainer authorization check failed:", error);
      throw new Error(
        "Unable to verify trainer access. Check your connection and Supabase permissions."
      );
    }

    return Boolean(data && data.user_id === user.id);
  }

  // --------------------------------------------------
  // PANEL VISIBILITY
  // --------------------------------------------------

  function showDashboard(isLoggedIn) {
    if (loginPanel) {
      loginPanel.classList.toggle("rw-hidden", isLoggedIn);
    }

    if (dashboardPanel) {
      dashboardPanel.classList.toggle("rw-hidden", !isLoggedIn);
    }

    const sessionActions = $("trainerSessionActions");
    const refreshButton = $("refreshAssessmentsButton");
    const signOutButton = $("signOutButton");

    if (sessionActions) {
      sessionActions.classList.toggle("rw-hidden", !isLoggedIn);
    }

    if (refreshButton) {
      refreshButton.classList.toggle("rw-hidden", !isLoggedIn);
    }

    if (signOutButton) {
      signOutButton.classList.toggle("rw-hidden", !isLoggedIn);
    }
  }

  function showPasswordRecovery(active) {
    passwordRecoveryActive = active;

    if (passwordRecoveryPanel) {
      passwordRecoveryPanel.classList.toggle("rw-hidden", !active);
    }

    if (loginPanel) {
      loginPanel.classList.toggle("rw-hidden", active);
    }

    if (dashboardPanel) {
      dashboardPanel.classList.add("rw-hidden");
    }

    [
      "trainerSessionActions",
      "refreshAssessmentsButton",
      "signOutButton"
    ].forEach((id) => {
      const element = $(id);
      if (element) element.classList.add("rw-hidden");
    });
  }

  function clearDashboardData() {
    allAssessments = [];
    selected = null;
    clientPage = 0;

    if (clientRows) clientRows.innerHTML = "";

    if ($("totalClientCount")) {
      $("totalClientCount").textContent = "0";
    }

    if ($("activeClientCount")) {
      $("activeClientCount").textContent = "0";
    }

    if ($("onHoldClientCount")) {
      $("onHoldClientCount").textContent = "0";
    }

    if ($("completedClientCount")) {
      $("completedClientCount").textContent = "0";
    }

    if ($("clientCount")) {
      $("clientCount").textContent = "0 records";
    }

    if ($("clientPagination")) {
      $("clientPagination").classList.add("rw-hidden");
    }

    closeAssessment();
  }

  function showAccessDenied(show, message = "") {
    const deniedPanel = $("accessDenied");

    if (deniedPanel) {
      deniedPanel.classList.toggle("rw-hidden", !show);
    }

    if (show) {
      clearDashboardData();

      if (loginPanel) loginPanel.classList.add("rw-hidden");
      if (dashboardPanel) dashboardPanel.classList.add("rw-hidden");

      if (passwordRecoveryPanel) {
        passwordRecoveryPanel.classList.add("rw-hidden");
      }

      [
        "trainerSessionActions",
        "refreshAssessmentsButton",
        "signOutButton"
      ].forEach((id) => {
        const element = $(id);
        if (element) element.classList.add("rw-hidden");
      });

      msg($("accessDeniedMessage"), message, message ? "error" : "");
    } else {
      msg($("accessDeniedMessage"), "", "");
    }
  }

  // --------------------------------------------------
  // UTILITIES
  // --------------------------------------------------

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function formatDate(value) {
    if (!value) return "—";

    const raw = String(value);
    let date;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      date = new Date(raw + "T00:00:00");
    } else {
      date = new Date(raw);
    }

    if (Number.isNaN(date.getTime())) return raw;

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function clientCode(record) {
    return "RWF-" + String(record.client_number || 0).padStart(6, "0");
  }

  function displayValue(value) {
    if (value === null || value === undefined || value === "") return "—";

    if (Array.isArray(value)) {
      return value.map(displayValue).join(", ");
    }

    if (typeof value === "object") {
      return Object.entries(value)
        .map(([key, item]) => `${key}: ${displayValue(item)}`)
        .join("; ");
    }

    if (typeof value === "boolean") return value ? "Yes" : "No";

    return String(value);
  }

  // --------------------------------------------------
  // DASHBOARD STYLES
  // --------------------------------------------------

  function addStyles() {
    if ($("rwDashboardMobileStyles")) return;

    const style = document.createElement("style");
    style.id = "rwDashboardMobileStyles";

    style.textContent = `
      .rw-status-badge {
        display:inline-flex; align-items:center; border-radius:999px;
        padding:4px 9px; font-size:12px; font-weight:700;
        background:#eef2f7; color:#374151;
      }
      .rw-status-badge.active { background:#dcfce7; color:#166534; }
      .rw-status-badge.on-hold { background:#fef3c7; color:#92400e; }
      .rw-status-badge.completed { background:#dbeafe; color:#1e40af; }
      .rw-status-badge.lead { background:#f3f4f6; color:#374151; }

      .rw-client-button {
        display:block; width:100%; text-align:left; cursor:pointer;
        border:1px solid #dce4f2; border-radius:12px; padding:14px;
        background:#fff; color:#202938;
      }

      .rw-client-button:hover, .rw-client-button:focus-visible {
        border-color:#be192d; outline:2px solid #be192d;
        outline-offset:2px;
      }

      .rw-client-name {
        font-weight:750; font-size:16px; margin-bottom:6px;
      }

      .rw-client-meta {
        font-size:13px; line-height:1.6; color:#526071;
      }

      .rw-client-grid {
        display:grid; grid-template-columns:1fr; gap:10px;
      }

      .rw-assessment-section {
        border:1px solid #dce4f2; border-radius:10px;
        margin:12px 0; overflow:hidden;
      }

      .rw-assessment-section summary {
        cursor:pointer; padding:13px; font-weight:700;
        background:#f5f7fb; color:#202938;
      }

      .rw-detail-content { padding:12px; }

      .rw-detail-row {
        display:grid; grid-template-columns:minmax(120px, 35%) 1fr;
        gap:12px; padding:9px 0; border-bottom:1px solid #edf0f5;
        overflow-wrap:anywhere;
      }

      .rw-detail-row:last-child { border-bottom:0; }
      .rw-detail-label { font-weight:650; color:#465267; }
      .rw-detail-value { white-space:pre-wrap; color:#202938; }

      .rw-client-pagination {
        display:flex; align-items:center; justify-content:center;
        gap:12px; flex-wrap:wrap; margin-top:16px;
      }

      .rw-hidden { display:none !important; }

      @media(max-width:700px) {
        .rw-detail-row {
          grid-template-columns:1fr; gap:4px;
        }

        .rw-detail-header-actions {
          display:flex; flex-wrap:wrap; gap:8px;
        }

        #detailPanel { min-width:0; }

        body.rw-detail-open { overflow:hidden; }

        body.rw-detail-open #detailPanel {
          position:fixed; inset:8px; z-index:9999; overflow:auto;
          background:#fff; margin:0; max-height:calc(100dvh - 16px);
        }
      }
    `;

    document.head.appendChild(style);
  }

  // --------------------------------------------------
  // SEARCH, FILTER AND PAGINATION
  // --------------------------------------------------

  function setStatusFilter(status) {
    clientStatusFilter = status;
    clientPage = 0;

    document.querySelectorAll("[data-status-filter]").forEach((button) => {
      const active = button.dataset.statusFilter === status;
      button.setAttribute("aria-pressed", String(active));
    });

    renderRows();
  }

  function getFilteredAssessments() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    return allAssessments.filter((record) => {
      const status = record.training_status || "Lead";

      if (clientStatusFilter !== "all" && status !== clientStatusFilter) {
        return false;
      }

      const searchable = [
        clientCode(record),
        record.client_name,
        record.client_email,
        record.phone,
        record.client_number
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    });
  }

  function renderRows() {
    addStyles();

    if (!clientRows) return;

    const filtered = getFilteredAssessments();

    const countByStatus = (status) =>
      allAssessments.filter(
        (record) => (record.training_status || "Lead") === status
      ).length;

    if ($("totalClientCount")) {
      $("totalClientCount").textContent = String(allAssessments.length);
    }

    if ($("activeClientCount")) {
      $("activeClientCount").textContent = String(countByStatus("Active"));
    }

    if ($("onHoldClientCount")) {
      $("onHoldClientCount").textContent = String(countByStatus("On hold"));
    }

    if ($("completedClientCount")) {
      $("completedClientCount").textContent = String(countByStatus("Completed"));
    }

    const pageCount = Math.ceil(filtered.length / clientPageSize);

    clientPage = Math.min(clientPage, Math.max(0, pageCount - 1));

    const first = clientPage * clientPageSize;
    const visible = filtered.slice(first, first + clientPageSize);

    const clientCount = $("clientCount");

    if (clientCount) {
      const firstVisible = filtered.length ? first + 1 : 0;
      const lastVisible = Math.min(first + clientPageSize, filtered.length);

      const label = clientStatusFilter === "all"
        ? "all statuses"
        : clientStatusFilter;

      clientCount.textContent =
        `${filtered.length} ${label} record(s) · Showing ` +
        `${firstVisible}–${lastVisible}`;
    }

    if (clientPagination) {
      clientPagination.classList.toggle("rw-hidden", pageCount <= 1);
    }

    if ($("previousClients")) {
      $("previousClients").disabled = clientPage === 0;
    }

    if ($("nextClients")) {
      $("nextClients").disabled =
        pageCount === 0 || clientPage >= pageCount - 1;
    }

    if ($("clientPageStatus")) {
      $("clientPageStatus").textContent =
        pageCount ? `Page ${clientPage + 1} of ${pageCount}` : "No pages";
    }

    if (!filtered.length) {
      const emptyText = allAssessments.length
        ? "No client records match your search and filter."
        : "No client assessments were found.";

      clientRows.innerHTML =
        `<p class="rw-small">${escapeHtml(emptyText)}</p>`;

      return;
    }

    clientRows.innerHTML = visible.map((record) => {
      const status = record.training_status || "Lead";
      const statusClass = status.toLowerCase().replace(/\s+/g, "-");

      return `
        <button type="button" class="rw-client-button"
                data-id="${escapeHtml(record.id)}">
          <div class="rw-client-name">
            ${escapeHtml(record.client_name || "Unnamed client")}
          </div>
          <div class="rw-client-meta">
            <strong>${escapeHtml(clientCode(record))}</strong><br>
            ${escapeHtml(record.client_email || "No email provided")}<br>
            ${escapeHtml(record.phone || "No phone provided")}<br>
            Submitted: ${escapeHtml(formatDate(record.created_at))}<br>
            <span class="rw-status-badge ${escapeHtml(statusClass)}">
              ${escapeHtml(status)}
            </span>
          </div>
        </button>
      `;
    }).join("");
  }

  // --------------------------------------------------
  // LOAD CLIENT ASSESSMENTS
  // --------------------------------------------------

  async function loadAssessments() {
    const clientCount = $("clientCount");

    msg($("listMessage"), "", "");

    if (clientCount) {
      clientCount.textContent = "Loading client records…";
    }

    if (clientRows) {
      clientRows.innerHTML = '<p class="rw-small">Loading clients…</p>';
    }

    try {
      // Recheck authorization before retrieving client records.
      const authorized = await isAuthorizedTrainer();

      if (!authorized) {
        showAccessDenied(true);
        return;
      }

      const client = getClient();

      const { data, error } = await client
        .from("client_assessments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      allAssessments = Array.isArray(data) ? data : [];
      clientPage = 0;
      renderRows();

      msg(
        $("listMessage"),
        `Loaded ${allAssessments.length} client assessment(s).`,
        "success"
      );
    } catch (error) {
      console.error("Load assessments failed:", error);

      allAssessments = [];
      renderRows();

      if (clientCount) {
        clientCount.textContent = "Could not load client records.";
      }

      msg(
        $("listMessage"),
        `Could not load assessments. ${
          error.message || "Check Supabase access policies."
        }`,
        "error"
      );
    }
  }

  // --------------------------------------------------
  // ASSESSMENT DETAIL RENDERING
  // --------------------------------------------------

  function detailItem(label, value) {
    return `
      <div class="rw-detail-row">
        <div class="rw-detail-label">${escapeHtml(label)}</div>
        <div class="rw-detail-value">${escapeHtml(displayValue(value))}</div>
      </div>
    `;
  }

  function assessmentSection(title, content) {
    return `
      <details class="rw-assessment-section" open>
        <summary>${escapeHtml(title)}</summary>
        <div class="rw-detail-content">${content}</div>
      </details>
    `;
  }

  function renderAssessmentData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return assessmentSection(
        "Assessment answers",
        detailItem("Answers", data || "No answers provided.")
      );
    }

    const sections = [];

    const sectionAliases = {
      personal_details: "PERSONAL DETAILS",
      body_measurements: "BODY MEASUREMENTS",
      fitness_goals: "FITNESS GOALS",
      medical_history: "MEDICAL & HEALTH HISTORY",
      health_history: "MEDICAL & HEALTH HISTORY",
      lifestyle: "LIFESTYLE & DAILY ACTIVITY",
      nutrition: "NUTRITION ASSESSMENT",
      training_readiness: "TRAINING READINESS & PREFERENCES"
    };

    Object.entries(data).forEach(([key, value]) => {
      const title = sectionAliases[key.toLowerCase()] ||
        key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      let content = "";

      if (value && typeof value === "object" && !Array.isArray(value)) {
        content = Object.entries(value)
          .map(([label, answer]) => detailItem(
            label.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            answer
          ))
          .join("");
      } else {
        content = detailItem("Answer", value);
      }

      sections.push(assessmentSection(title, content));
    });

    return sections.join("") ||
      assessmentSection("Assessment answers", "<p>No answers provided.</p>");
  }

  async function openAssessment(id) {
    // Prevent opening records if authorization has not been verified.
    if (authorizationCheckInProgress) return;

    try {
      const authorized = await isAuthorizedTrainer();

      if (!authorized) {
        showAccessDenied(true);
        return;
      }
    } catch (error) {
      console.error("Assessment access check failed:", error);
      msg(
        $("listMessage"),
        "Unable to verify trainer access. Please try again.",
        "error"
      );
      return;
    }

    const record = allAssessments.find(
      (item) => String(item.id) === String(id)
    );

    if (!record) {
      msg(
        $("listMessage"),
        "That assessment could not be found. Refresh the list.",
        "error"
      );
      return;
    }

    selected = record;

    $("detailTitle").textContent =
      `${record.client_name || "Client details"} · ${clientCode(record)}`;

    let html = assessmentSection("CLIENT DETAILS", [
      detailItem("Client number", clientCode(record)),
      detailItem("Full name", record.client_name),
      detailItem("Phone / WhatsApp", record.phone),
      detailItem("Email", record.client_email),
      detailItem("Assessment submitted", formatDate(record.created_at))
    ].join(""));

    html += renderAssessmentData(record.assessment_data);

    assessmentDetails.innerHTML = html;

    $("selectedAssessmentId").value = record.id;

    $("trainingStatus").value = statuses.includes(record.training_status)
      ? record.training_status
      : "Lead";

    $("trainerSummary").value = record.trainer_summary || "";
    $("initialPlan").value = record.initial_plan || "";
    $("nextReviewDate").value = record.next_review_date || "";

    msg($("notesMessage"), "", "");

    detailPanel.classList.remove("rw-hidden");

    const isMobile = mobileLayout.matches;

    detailPanel.setAttribute("aria-modal", String(isMobile));
    document.body.classList.toggle("rw-detail-open", isMobile);

    $("detailScrollArea").scrollTop = 0;

    if (isMobile) {
      $("closeDetail").focus();
    } else {
      detailPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  function closeAssessment() {
    if (!detailPanel) return;

    detailPanel.classList.add("rw-hidden");
    detailPanel.setAttribute("aria-modal", "false");
    document.body.classList.remove("rw-detail-open");

    if (lastClientTrigger && lastClientTrigger.isConnected) {
      lastClientTrigger.focus();
    }
  }

  // --------------------------------------------------
  // LOGIN
  // --------------------------------------------------

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const button = $("loginButton");
    const email = $("email").value.trim();
    const password = $("password").value;

    msg($("loginMessage"), "", "");
    showAccessDenied(false);

    setButtonBusy(button, true, "Signing in…", "Sign in");

    try {
      const client = getClient();

      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (!data.session || !data.user) {
        throw new Error(
          "Sign-in did not create a session. Please try again."
        );
      }

      $("password").value = "";
      showPasswordRecovery(false);

      const authorized = await isAuthorizedTrainer();

      if (!authorized) {
        showAccessDenied(true);
        return;
      }

      showDashboard(true);
      await loadAssessments();
    } catch (error) {
      console.error("Trainer sign-in or authorization failed:", error);

      showDashboard(false);

      msg(
        $("loginMessage"),
        error.message || "Sign-in failed. Please try again.",
        "error"
      );
    } finally {
      setButtonBusy(button, false, "Signing in…", "Sign in");
    }
  });

  // --------------------------------------------------
  // FORGOT PASSWORD
  // --------------------------------------------------

  $("forgotPasswordButton").addEventListener("click", async function () {
    const email = $("email").value.trim();

    if (!email) {
      msg(
        $("loginMessage"),
        "Enter your trainer email address first.",
        "error"
      );
      $("email").focus();
      return;
    }

    const button = $("forgotPasswordButton");

    setButtonBusy(button, true, "Sending…", "Forgot password?");

    try {
      const client = getClient();

      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: "https://rawwayfit.in/trainer.html"
      });

      if (error) throw error;

      msg(
        $("loginMessage"),
        "If that account is registered, a password reset email will be sent. Check your inbox and spam folder.",
        "success"
      );
    } catch (error) {
      console.error("Password reset request failed:", error);

      msg(
        $("loginMessage"),
        error.message || "Unable to start password reset. Please try again.",
        "error"
      );
    } finally {
      setButtonBusy(button, false, "Sending…", "Forgot password?");
    }
  });

  // --------------------------------------------------
  // SET NEW PASSWORD
  // --------------------------------------------------

  passwordRecoveryForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const password = $("newPassword").value;
    const confirmPassword = $("confirmNewPassword").value;
    const button = $("saveNewPasswordButton");

    if (password.length < 8) {
      msg($("passwordRecoveryMessage"), "Use at least 8 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      msg(
        $("passwordRecoveryMessage"),
        "The passwords do not match.",
        "error"
      );
      return;
    }

    setButtonBusy(button, true, "Updating…", "Update password");

    try {
      const client = getClient();
      const { error } = await client.auth.updateUser({ password });

      if (error) throw error;

      passwordRecoveryForm.reset();
      showPasswordRecovery(false);
      showDashboard(false);

      msg(
        $("loginMessage"),
        "Password updated. Sign in with your new password.",
        "success"
      );
    } catch (error) {
      console.error("Password update failed:", error);

      msg(
        $("passwordRecoveryMessage"),
        error.message ||
          "Could not update your password. Request a new reset email.",
        "error"
      );
    } finally {
      setButtonBusy(button, false, "Updating…", "Update password");
    }
  });

  // --------------------------------------------------
  // SAVE TRAINER NOTES
  // --------------------------------------------------

  $("trainerNotesForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!selected) {
      msg($("notesMessage"), "Select a client assessment first.", "error");
      return;
    }

    const button = $("saveNotesButton");

    setButtonBusy(button, true, "Saving…", "Save trainer notes");
    msg($("notesMessage"), "", "");

    const updates = {
      training_status: $("trainingStatus").value,
      trainer_summary: $("trainerSummary").value.trim(),
      initial_plan: $("initialPlan").value.trim(),
      next_review_date: $("nextReviewDate").value || null
    };

    try {
      const authorized = await isAuthorizedTrainer();

      if (!authorized) {
        showAccessDenied(true);
        return;
      }

      const client = getClient();

      const { data, error } = await client
        .from("client_assessments")
        .update(updates)
        .eq("id", selected.id)
        .select("*")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "No record was updated. Check your Supabase update policy and trainer permissions."
        );
      }

      selected = data;

      allAssessments = allAssessments.map((item) =>
        String(item.id) === String(data.id) ? data : item
      );

      renderRows();

      msg(
        $("notesMessage"),
        "Trainer notes saved successfully.",
        "success"
      );
    } catch (error) {
      console.error("Saving trainer notes failed:", error);

      msg(
        $("notesMessage"),
        `Could not save trainer notes. ${error.message || ""}`,
        "error"
      );
    } finally {
      setButtonBusy(button, false, "Saving…", "Save trainer notes");
    }
  });

  // --------------------------------------------------
  // DELETE ASSESSMENT
  // --------------------------------------------------

  $("deleteAssessmentButton").addEventListener("click", async function () {
    if (!selected) return;

    const code = clientCode(selected);
    const name = selected.client_name || "this client";

    if (!window.confirm(
      `Permanently delete the assessment for ${name} (${code})? This cannot be undone.`
    )) {
      return;
    }

    const button = $("deleteAssessmentButton");

    setButtonBusy(button, true, "Deleting…", "Delete assessment");

    try {
      const authorized = await isAuthorizedTrainer();

      if (!authorized) {
        showAccessDenied(true);
        return;
      }

      const client = getClient();

      const { data, error } = await client
        .from("client_assessments")
        .delete()
        .eq("id", selected.id)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "No row was deleted. Check the Supabase DELETE policy for trainer accounts."
        );
      }

      allAssessments = allAssessments.filter(
        (item) => String(item.id) !== String(selected.id)
      );

      selected = null;

      closeAssessment();
      renderRows();

      msg($("listMessage"), `${code} was permanently deleted.`, "success");

      $("listMessage").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      console.error("Delete assessment failed:", error);

      msg(
        $("notesMessage"),
        `Could not delete this assessment. ${error.message || ""}`,
        "error"
      );
    } finally {
      setButtonBusy(button, false, "Deleting…", "Delete assessment");
    }
  });

  // --------------------------------------------------
  // SEARCH, FILTER, PAGINATION AND DASHBOARD BUTTONS
  // --------------------------------------------------

  searchInput.addEventListener("input", function () {
    clientPage = 0;
    renderRows();
  });

  document.querySelectorAll("[data-status-filter]").forEach((button) => {
    button.addEventListener("click", function () {
      setStatusFilter(button.dataset.statusFilter || "all");
    });
  });

  $("previousClients").addEventListener("click", function () {
    if (clientPage <= 0) return;

    clientPage--;
    renderRows();
  });

  $("nextClients").addEventListener("click", function () {
    if ((clientPage + 1) * clientPageSize >= getFilteredAssessments().length) {
      return;
    }

    clientPage++;
    renderRows();
  });

  clientRows.addEventListener("click", function (event) {
    const button = event.target.closest("[data-id]");

    if (!button) return;

    lastClientTrigger = button;
    openAssessment(button.dataset.id);
  });

  $("closeDetail").addEventListener("click", closeAssessment);

  $("refreshAssessmentsButton").addEventListener("click", async function () {
    try {
      const authorized = await isAuthorizedTrainer();

      if (!authorized) {
        showAccessDenied(true);
        return;
      }

      await loadAssessments();
    } catch (error) {
      console.error("Refresh authorization failed:", error);

      msg(
        $("listMessage"),
        error.message || "Unable to verify trainer access.",
        "error"
      );
    }
  });

  $("signOutButton").addEventListener("click", async function () {
    try {
      const client = getClient();
      const { error } = await client.auth.signOut();

      if (error) throw error;

      clearDashboardData();
      showAccessDenied(false);
      showPasswordRecovery(false);
      showDashboard(false);

      msg($("loginMessage"), "You have signed out.", "success");
    } catch (error) {
      console.error("Sign out failed:", error);

      msg(
        $("loginMessage"),
        error.message || "Could not sign out.",
        "error"
      );
    }
  });

  const accessDeniedSignOut = $("accessDeniedSignOut");

  if (accessDeniedSignOut) {
    accessDeniedSignOut.addEventListener("click", async function () {
      accessDeniedSignOut.disabled = true;

      try {
        const client = getClient();
        const { error } = await client.auth.signOut();

        if (error) throw error;

        clearDashboardData();
        showAccessDenied(false);
        showPasswordRecovery(false);
        showDashboard(false);

        msg($("loginMessage"), "You have signed out.", "success");
      } catch (error) {
        console.error("Access-denied sign-out failed:", error);

        msg(
          $("accessDeniedMessage"),
          error.message || "Could not sign out. Please try again.",
          "error"
        );
      } finally {
        accessDeniedSignOut.disabled = false;
      }
    });
  }

  mobileLayout.addEventListener("change", function (event) {
    const isOpen = !detailPanel.classList.contains("rw-hidden");

    detailPanel.setAttribute("aria-modal", String(event.matches && isOpen));

    document.body.classList.toggle(
      "rw-detail-open",
      event.matches && isOpen
    );

    if (event.matches && isOpen) $("closeDetail").focus();
  });

  detailPanel.addEventListener("keydown", function (event) {
    if (
      event.key === "Escape" &&
      detailPanel.getAttribute("aria-modal") === "true"
    ) {
      closeAssessment();
      return;
    }

    if (
      event.key !== "Tab" ||
      detailPanel.getAttribute("aria-modal") !== "true"
    ) {
      return;
    }

    const focusable = Array.from(detailPanel.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.getClientRects().length);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // --------------------------------------------------
  // PDF EXPORT
  // --------------------------------------------------

  function downloadAssessmentPDF() {
    if (!selected) {
      alert("Please select a client assessment first.");
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("The PDF library did not load. Refresh the page and try again.");
      return;
    }

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    let y = 20;

    function checkPage(height = 8) {
      if (y + height > pageHeight - 15) {
        doc.addPage();
        y = 20;
      }
    }

    function writeText(text, options = {}) {
      const size = options.size || 9.5;
      const bold = Boolean(options.bold);
      const gap = options.gap === undefined ? 3 : options.gap;
      const indent = options.indent || 0;

      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);

      const lines = doc.splitTextToSize(
        String(text == null || text === "" ? "—" : text),
        contentWidth - indent
      );

      const lineHeight = size * 0.45 + 1.5;

      checkPage(lines.length * lineHeight + gap);

      doc.text(lines, margin + indent, y);

      y += lines.length * lineHeight + gap;
    }

    function writeSection(title) {
      checkPage(15);
      y += 3;

      doc.setFillColor(35, 35, 35);
      doc.rect(margin, y - 4, contentWidth, 9, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);

      doc.text(title, margin + 3, y + 1.5);

      doc.setTextColor(30, 30, 30);
      y += 10;
    }

    function safeFilename(value) {
      return String(value || "Client")
        .replace(/[^a-z0-9_-]/gi, "_")
        .replace(/_+/g, "_")
        .slice(0, 80);
    }

    function writeObject(object, prefix = "") {
      if (object && typeof object === "object" && !Array.isArray(object)) {
        Object.entries(object).forEach(([key, value]) => {
          const label = key.replace(/[_-]+/g, " ");

          if (value && typeof value === "object") {
            writeText(`${prefix}${label}:`);
            writeObject(value, `${prefix}${label} / `);
          } else {
            writeText(`${prefix}${label}: ${displayValue(value)}`, {
              indent: prefix ? 2 : 0
            });
          }
        });
      } else {
        writeText(`${prefix}${displayValue(object)}`);
      }
    }

    const code = clientCode(selected);

    doc.setFillColor(190, 25, 45);
    doc.rect(0, 0, pageWidth, 34, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("RAWWAYFIT", margin, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("CLIENT FITNESS ASSESSMENT", margin, 23);

    doc.setTextColor(30, 30, 30);
    y = 43;

    writeSection("CLIENT DETAILS");
    writeText(`Client number: ${code}`);
    writeText(`Full name: ${selected.client_name || "—"}`);
    writeText(`Phone / WhatsApp: ${selected.phone || "—"}`);
    writeText(`Email: ${selected.client_email || "—"}`);
    writeText(`Assessment submitted: ${formatDate(selected.created_at)}`);
    writeText(`PDF generated: ${new Date().toLocaleDateString("en-IN")}`);

    writeSection("ASSESSMENT ANSWERS");

    writeObject(
      selected.assessment_data || { note: "No answers provided." }
    );

    writeSection("TRAINER REVIEW");
    writeText(`Training status: ${$("trainingStatus").value || "Lead"}`);
    writeText(`Assessment summary: ${$("trainerSummary").value.trim() || "—"}`);
    writeText(`Initial plan / recommendations: ${$("initialPlan").value.trim() || "—"}`);
    writeText(`Next review date: ${formatDate($("nextReviewDate").value)}`);

    const pageCount = doc.internal.getNumberOfPages();

    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);

      doc.text(
        "RAWWAYFIT | Confidential Client Assessment",
        margin,
        pageHeight - 7
      );

      doc.text(
        `Page ${page} of ${pageCount}`,
        pageWidth - margin,
        pageHeight - 7,
        { align: "right" }
      );
    }

    doc.save(
      `RAWWAYFIT_${safeFilename(code)}_${safeFilename(selected.client_name)}_Assessment.pdf`
    );
  }

  $("downloadAssessmentButton").addEventListener(
    "click",
    downloadAssessmentPDF
  );

  // --------------------------------------------------
  // AUTH SESSION INITIALIZATION
  // --------------------------------------------------

  async function initialize() {
    try {
      const client = getClient();

      // Hide protected content before checking the current session.
      showAccessDenied(false);
      showDashboard(false);
      showPasswordRecovery(false);

      const { data, error } = await client.auth.getSession();

      if (error) throw error;

      const session = data && data.session;

      if (session) {
        authorizationCheckInProgress = true;

        try {
          const authorized = await isAuthorizedTrainer();

          if (authorized) {
            showAccessDenied(false);
            showPasswordRecovery(false);
            showDashboard(true);
            await loadAssessments();
          } else {
            showAccessDenied(true);
          }
        } finally {
          authorizationCheckInProgress = false;
        }
      } else {
        showDashboard(false);
      }

      client.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          showAccessDenied(false);
          showPasswordRecovery(true);
          return;
        }

        if (event === "SIGNED_OUT") {
          clearDashboardData();
          showAccessDenied(false);
          showPasswordRecovery(false);
          showDashboard(false);
        }

        // SIGNED_IN and TOKEN_REFRESHED deliberately do not expose
        // the dashboard. Login and initialization verify membership.
      });
    } catch (error) {
      console.error("Trainer dashboard initialization failed:", error);

      clearDashboardData();
      showAccessDenied(false);
      showDashboard(false);

      msg(
        $("loginMessage"),
        error.message || "Could not initialize the trainer dashboard.",
        "error"
      );
    }
  }

  // --------------------------------------------------
  // START
  // --------------------------------------------------

  addStyles();
  showAccessDenied(false);
  showDashboard(false);
  initialize();
})();