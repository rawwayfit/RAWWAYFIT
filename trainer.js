
(function () {
  "use strict";

  const cfg = window.RAW_WAY_FIT_CONFIG || {};
  const $ = id => document.getElementById(id);

  const loginPanel = $("loginPanel");
  const dashboardPanel = $("dashboardPanel");
  const loginForm = $("loginForm");
  const loginMessage = $("loginMessage");
  const listMessage = $("listMessage");
  const clientRows = $("clientRows");
  const clientPagination = $("clientPagination");
  const searchInput = $("searchClients");
  const detailPanel = $("detailPanel");
  const assessmentDetails = $("assessmentDetails");
  const notesMessage = $("notesMessage");
  const mobileLayout = window.matchMedia("(max-width: 700px)");
  const passwordRecoveryPanel = $("passwordRecoveryPanel");
  const passwordRecoveryForm = $("passwordRecoveryForm");

  let supabaseClient = null;
  let allAssessments = [];
  let selected = null;
  let lastClientTrigger = null;
  let clientPage = 0;
  let clientStatusFilter = "all";
  let passwordRecoveryActive = false;
  const clientPageSize = 3;

  function msg(el, text, kind) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "rw-message" + (kind ? " " + kind : "");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c]));
  }

  function getClient() {
    if (
      !window.supabase ||
      !cfg.supabaseUrl ||
      !cfg.supabasePublishableKey ||
      cfg.supabaseUrl.includes("PASTE_") ||
      cfg.supabasePublishableKey.includes("PASTE_")
    ) {
      throw new Error(
        "Supabase configuration is missing. Check rawwayfit-config.js."
      );
    }

    return window.supabase.createClient(
      cfg.supabaseUrl,
      cfg.supabasePublishableKey
    );
  }

  function showDashboard(isLoggedIn) {
    loginPanel.classList.toggle("rw-hidden", isLoggedIn);
    dashboardPanel.classList.toggle("rw-hidden", !isLoggedIn);
    $("signOutButton").classList.toggle("rw-hidden", !isLoggedIn);
  }

  function showPasswordRecovery(isActive) {
    passwordRecoveryActive = isActive;
    passwordRecoveryPanel.classList.toggle("rw-hidden", !isActive);
    loginPanel.classList.toggle("rw-hidden", isActive);
    dashboardPanel.classList.add("rw-hidden");
    $("signOutButton").classList.add("rw-hidden");
  }

  function formatDate(value) {
    if (!value) return "—";

    // Parse date-only strings locally to avoid timezone shifts.
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? new Date(value + "T00:00:00")
      : new Date(value);

    return Number.isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric"
        });
  }

  function getReviewInfo(value) {
    if (!value) {
      return {
        text: "Not scheduled",
        className: "not-scheduled"
      };
    }

    const dateText = String(value).slice(0, 10);
    const reviewDate = new Date(dateText + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(reviewDate.getTime())) {
      return {
        text: String(value),
        className: ""
      };
    }

    if (reviewDate < today) {
      return {
        text: formatDate(value) + " · Overdue",
        className: "overdue"
      };
    }

    if (reviewDate.getTime() === today.getTime()) {
      return {
        text: formatDate(value) + " · Today",
        className: "today"
      };
    }

    return {
      text: formatDate(value),
      className: "upcoming"
    };
  }

  function addStyles() {
    if ($("rwDashboardMobileStyles")) return;

    const style = document.createElement("style");
    style.id = "rwDashboardMobileStyles";

    style.textContent = `
      /* Training status colors */
      .rw-status-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 6px 11px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
      }

      .rw-status-lead {
        background: #fff1b8;
        color: #704f00;
      }

      .rw-status-active {
        background: #d1fae5;
        color: #065f46;
      }

      .rw-status-on-hold {
        background: #ffedd5;
        color: #9a3412;
      }

      .rw-status-completed {
        background: #dbeafe;
        color: #1e40af;
      }

      .rw-status-default {
        background: #e5e7eb;
        color: #374151;
      }

      /* Client name */
      .rw-client-button {
        display: inline-block;
        width: 100%;
        min-width: 0;
        padding: 5px 0;
        border: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        text-decoration: underline;
        text-underline-offset: 3px;
        font: inherit;
        font-weight: 800;
        line-height: 1.5;
        cursor: pointer;
        white-space: normal;
        overflow-wrap: normal;
        word-break: normal;
      }

      .rw-client-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        gap: 12px;
        margin-top: 16px;
        min-width: 0;
      }

      .rw-client-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
        padding: 14px;
        border: 1px solid #dce4f2;
        border-radius: 13px;
        background: #fff;
        box-shadow: 0 3px 12px rgba(20, 33, 61, .06);
      }

      .rw-client-card-top,
      .rw-client-meta,
      .rw-client-meta-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        min-width: 0;
      }

      .rw-client-code {
        color: #475569;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .03em;
      }

      .rw-next-review {
        display: inline-block;
        font-weight: 750;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }

      .rw-next-review.overdue {
        color: #dc2626;
      }

      .rw-next-review.today {
        color: #b45309;
      }

      .rw-next-review.upcoming {
        color: #0f766e;
      }

      .rw-next-review.not-scheduled {
        color: #6b7280;
        font-weight: 500;
      }

      /* Expandable assessment sections */
      .rw-assessment-section {
        border: 1px solid #dce4f2;
        border-radius: 12px;
        margin: 12px 0;
        overflow: hidden;
        background: #fff;
      }

      .rw-assessment-section > summary {
        cursor: pointer;
        list-style: none;
        padding: 16px 18px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .rw-assessment-section > summary::-webkit-details-marker {
        display: none;
      }

      .rw-assessment-section > summary::after {
        content: '+';
        font-size: 1.25rem;
        color: #e23b3b;
        flex-shrink: 0;
      }

      .rw-assessment-section[open] > summary::after {
        content: '−';
      }

      .rw-assessment-section[open] > summary {
        border-bottom: 1px solid #dce4f2;
      }

      .rw-assessment-section-body {
        padding: 8px 16px 16px;
      }

      .rw-assessment-section-body .rw-detail-row {
        padding: 10px 2px;
      }

      .rw-detail-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
      }

      .rw-detail-scroll {
        min-height: 0;
      }

      /* Mobile dashboard */
      @media (max-width: 700px) {
        #dashboardPanel {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 0;
          width: 100%;
          min-width: 0;
        }

        #dashboardPanel > .rw-card {
          width: 100%;
          min-width: 0;
        }

        .rw-client-grid {
          grid-template-columns: minmax(0, 1fr);
          gap: 8px;
        }

        .rw-client-card {
          gap: 5px;
          padding: 11px 12px;
          border-radius: 11px;
        }

        .rw-client-meta {
          gap: 12px;
        }

        .rw-client-meta-item {
          flex: 1 1 0;
          flex-direction: column;
          gap: 3px;
        }

        .rw-client-meta-label {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
        }

        .rw-detail-panel:not(.rw-hidden) {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100vh;
          height: 100dvh;
          max-height: 100dvh;
          margin: 0 !important;
          padding: 12px 16px calc(12px + env(safe-area-inset-bottom)) !important;
          overflow: hidden;
          border: 0;
          border-radius: 0;
          background: #fff;
        }

        .rw-detail-header {
          flex: 0 0 auto;
          flex-direction: column;
          gap: 8px;
          padding-bottom: 10px;
          border-bottom: 1px solid #dce4f2;
        }

        .rw-detail-header h2 {
          margin-bottom: 0;
        }

        .rw-detail-header-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          width: 100%;
          gap: 8px;
        }

        .rw-detail-header-actions > .rw-btn {
          flex: 1 1 0;
          width: auto;
          min-height: 44px;
          padding: 8px;
          font-size: 14px;
        }

        .rw-detail-scroll {
          flex: 1 1 auto;
          width: 100%;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 20px;
        }

        .rw-detail-panel hr {
          margin: 14px 0 !important;
        }

        .rw-detail-panel > .rw-detail-scroll > h2 {
          margin-bottom: 12px;
        }

        body.rw-detail-open {
          overflow: hidden;
        }

        .rw-status-badge {
          justify-self: start;
        }

        .rw-next-review {
          overflow-wrap: anywhere;
        }

        .rw-actions > .rw-btn,
        .rw-actions > button {
          flex: 1 1 100%;
          width: 100%;
          min-height: 48px;
        }

        .rw-actions .rw-btn {
          max-width: 100%;
        }

        #detailTitle {
          overflow-wrap: anywhere;
          font-size: 1.25rem;
        }

        .rw-assessment-section > summary {
          padding: 14px;
          font-size: 14px;
        }

        .rw-assessment-section-body {
          padding: 8px 12px 12px;
        }

        .rw-detail-row {
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 4px !important;
        }

        .rw-shell {
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        .rw-card {
          padding: 16px !important;
        }

        input,
        select,
        textarea,
        button {
          font-size: 16px;
          max-width: 100%;
          min-height: 48px;
        }

        input[type="checkbox"],
        input[type="radio"] {
          min-height: 20px;
        }

        textarea {
          min-height: 100px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getFilteredAssessments() {
    const q = searchInput.value.trim().toLowerCase();
    return allAssessments.filter(a => {
      if (clientStatusFilter !== "all" &&
          (a.training_status || "Lead") !== clientStatusFilter) return false;

      const code =
        "RWF-" + String(a.client_number || 0).padStart(6, "0");

      return [
        code,
        a.client_number,
        a.client_name,
        a.client_email,
        a.phone
      ].some(v => String(v || "").toLowerCase().includes(q));
    });
  }

  function renderRows() {
    const filtered = getFilteredAssessments();
    const countByStatus = status => allAssessments.filter(
      a => (a.training_status || "Lead") === status
    ).length;
    $("totalClientCount").textContent = String(allAssessments.length);
    $("activeClientCount").textContent = String(countByStatus("Active"));
    $("onHoldClientCount").textContent = String(countByStatus("On hold"));
    $("completedClientCount").textContent = String(countByStatus("Completed"));

    document.querySelectorAll("[data-status-filter]").forEach(button => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.statusFilter === clientStatusFilter)
      );
    });

    const pageCount = Math.ceil(filtered.length / clientPageSize);
    clientPage = Math.min(clientPage, Math.max(0, pageCount - 1));
    const visible = filtered.slice(
      clientPage * clientPageSize,
      (clientPage + 1) * clientPageSize
    );

    const clientCount = $("clientCount");
    if (clientCount) {
      const firstVisible = filtered.length ? clientPage * clientPageSize + 1 : 0;
      const lastVisible = Math.min((clientPage + 1) * clientPageSize, filtered.length);
      const filterLabel = clientStatusFilter === "all"
        ? "all statuses"
        : clientStatusFilter;
      clientCount.textContent =
        `${filtered.length} ${filterLabel} client record(s) · Showing ${firstVisible}–${lastVisible}`;
    }
    clientPagination.classList.toggle("rw-hidden", pageCount <= 1);
    $("previousClients").disabled = clientPage === 0;
    $("nextClients").disabled = clientPage >= pageCount - 1;
    $("clientPageStatus").textContent =
      pageCount ? `Page ${clientPage + 1} of ${pageCount}` : "No pages";

    addStyles();
    if (!filtered.length) {
      const message = allAssessments.length && clientStatusFilter !== "all"
        ? `No ${escapeHtml(clientStatusFilter.toLowerCase())} clients match your search.`
        : "No matching clients found.";
      clientRows.innerHTML = `<p class="rw-small">${message}</p>`;
      return;
    }

    clientRows.innerHTML = visible.map(a => {
      const d = a.assessment_data || {};
      const goal = d.main_goal || "—";
      const code =
        "RWF-" + String(a.client_number || 0).padStart(6, "0");

      const status = a.training_status || "Lead";

      const statusClass = {
        "Lead": "rw-status-lead",
        "Active": "rw-status-active",
        "On hold": "rw-status-on-hold",
        "Completed": "rw-status-completed"
      }[status] || "rw-status-default";

      const review = getReviewInfo(a.next_review_date);

      return `
        <article class="rw-client-card">
          <div class="rw-client-card-top">
            <span class="rw-client-code">${escapeHtml(code)}</span>
            <span class="rw-small">${escapeHtml(formatDate(a.created_at))}</span>
          </div>
          <button class="rw-client-button"
            type="button"
            data-id="${escapeHtml(a.id)}"
            aria-label="Open assessment for ${escapeHtml(a.client_name || "client")}">
            ${escapeHtml(a.client_name || "Unnamed client")}
          </button>
          <div class="rw-small">${escapeHtml(a.phone || "—")} · ${escapeHtml(a.client_email || "No email")}</div>
          <div class="rw-small">Goal: ${escapeHtml(goal)}</div>
          <div class="rw-client-meta">
            <div class="rw-client-meta-item">
              <span class="rw-client-meta-label">Training status</span>
              <span class="rw-status-badge ${statusClass}">${escapeHtml(status)}</span>
            </div>
            <div class="rw-client-meta-item">
              <span class="rw-client-meta-label">Next review</span>
              <span class="rw-next-review ${review.className}">${escapeHtml(review.text)}</span>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  async function loadAssessments() {
    msg(listMessage, "Loading assessments…", "");

    const { data, error } = await supabaseClient
      .from("client_assessments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error(error);
      allAssessments = [];

      clientRows.innerHTML =
        '<p class="rw-small">Unable to load clients. Check your trainer account and permissions.</p>';

      msg(
        listMessage,
        "Access failed. Confirm your trainer account is approved in trainer_users and the Supabase policies are applied.",
        "error"
      );

      const count = $("clientCount");
      if (count) count.textContent = "Could not load";
      [
        "totalClientCount",
        "activeClientCount",
        "onHoldClientCount",
        "completedClientCount"
      ].forEach(id => { $(id).textContent = "—"; });
      clientPagination.classList.add("rw-hidden");

      return;
    }

    allAssessments = data || [];
    msg(listMessage, "", "");
    renderRows();
  }

  function detailItem(label, value) {
    if (Array.isArray(value)) value = value.join(", ");
    if (value === null || value === undefined || value === "") {
      value = "—";
    }

    return `
      <div class="rw-detail-row">
        <span class="rw-detail-label">${escapeHtml(label)}</span>
        <div class="rw-detail-value">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function addAssessmentStyles() {
    if ($("rwAssessmentSectionStyles")) return;

    const style = document.createElement("style");
    style.id = "rwAssessmentSectionStyles";

    style.textContent = `
      .rw-assessment-section {
        border: 1px solid #dce4f2;
        border-radius: 12px;
        margin: 12px 0;
        overflow: hidden;
        background: #fff;
      }

      .rw-assessment-section > summary {
        cursor: pointer;
        list-style: none;
        padding: 16px 18px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .rw-assessment-section > summary::-webkit-details-marker {
        display: none;
      }

      .rw-assessment-section > summary::after {
        content: '+';
        font-size: 1.25rem;
        color: #e23b3b;
      }

      .rw-assessment-section[open] > summary::after {
        content: '−';
      }

      .rw-assessment-section[open] > summary {
        border-bottom: 1px solid #dce4f2;
      }

      .rw-assessment-section-body {
        padding: 8px 16px 16px;
      }

      .rw-assessment-section-body .rw-detail-row {
        padding: 10px 2px;
      }
    `;

    document.head.appendChild(style);
  }

  function openAssessment(id) {
    selected = allAssessments.find(a => a.id === id);
    if (!selected) return;

    const d = selected.assessment_data || {};
    const clientCode =
      "RWF-" + String(selected.client_number || 0).padStart(6, "0");

    $("detailTitle").textContent =
      clientCode + " · " + (selected.client_name || "Client assessment");

    $("selectedAssessmentId").value = selected.id;
    $("trainingStatus").value = selected.training_status || "Lead";
    $("trainerSummary").value = selected.trainer_summary || "";
    $("initialPlan").value = selected.initial_plan || "";
    $("nextReviewDate").value = selected.next_review_date || "";

    const sections = [
      {
        title: "01 · Personal Details",
        fields: [
          ["Client number", clientCode],
          ["Submitted", formatDate(selected.created_at)],
          ["Full name", selected.client_name],
          ["Age / date of birth", d.age_dob],
          ["Gender", d.gender],
          ["Phone / WhatsApp", selected.phone],
          ["Email", selected.client_email],
          ["City / country", d.city_country],
          ["Occupation", d.occupation]
        ]
      },
      {
        title: "02 · Body Measurements",
        fields: [
          ["Height (cm)", d.height_cm],
          ["Current weight (kg)", d.current_weight_kg],
          ["Target weight (kg)", d.target_weight_kg],
          ["Waist (cm)", d.waist_cm],
          ["Hip (cm)", d.hip_cm],
          ["Body fat %", d.body_fat_percent],
          ["Progress photos available", d.photos_available]
        ]
      },
      {
        title: "03 · Fitness Goals",
        fields: [
          ["Main goal", d.main_goal],
          ["Why this goal matters", d.goal_why],
          ["Target date", d.target_date],
          ["Fitness experience", d.fitness_experience],
          ["Training location", d.training_location],
          ["Available days", d.training_days],
          ["Preferred time", d.preferred_training_time]
        ]
      },
      {
        title: "04 · Medical & Health History",
        fields: [
          ["Medical condition", d.medical_condition],
          ["Medical details", d.medical_details],
          ["Current medication", d.medication],
          ["Medication details", d.medication_details],
          ["Previous surgery / injury", d.injury_surgery],
          ["Injury details", d.injury_details],
          ["Exercise pain", d.exercise_pain],
          ["Pain details", d.exercise_pain_details],
          ["Chest pain / dizziness / breathlessness", d.warning_symptoms],
          ["Symptom details", d.warning_symptoms_details],
          ["Doctor's restrictions", d.doctor_restrictions],
          ["Restriction details", d.doctor_restrictions_details],
          ["Emergency contact", d.emergency_contact]
        ]
      },
      {
        title: "05 · Lifestyle & Daily Activity",
        fields: [
          ["Daily steps", d.daily_steps],
          ["Work type", d.work_type],
          ["Sleep hours", d.sleep_hours],
          ["Sleep quality", d.sleep_quality],
          ["Stress level", d.stress_level],
          ["Water intake (L/day)", d.water_litres],
          ["Smoking", d.smoking],
          ["Alcohol use", d.drinking]
        ]
      },
      {
        title: "06 · Nutrition Assessment",
        fields: [
          ["Diet preference", d.diet_preference],
          ["Food allergies / intolerances", d.food_allergies],
          ["Foods avoided", d.foods_avoided],
          ["Typical breakfast", d.typical_breakfast],
          ["Typical lunch", d.typical_lunch],
          ["Typical dinner", d.typical_dinner],
          ["Snacks / beverages", d.snacks_beverages],
          ["Supplements", d.supplements],
          ["Meal timing / work schedule", d.meal_timing],
          ["Digestive issues", d.digestive_issues]
        ]
      },
      {
        title: "07 · Training Readiness & Preferences",
        fields: [
          ["Exercises enjoyed", d.enjoyed_exercises],
          ["Exercises disliked / cannot do", d.disliked_exercises],
          ["Available equipment", d.available_equipment],
          ["Weekly exercise routine", d.weekly_routine],
          ["Fitness limitations", d.fitness_limitations],
          ["Preferred coaching support", d.coaching_support]
        ]
      },
      {
        title: "08 · Commitment & Expectations",
        fields: [
          ["Days per week committed", d.commit_days],
          ["Minutes per session", d.session_minutes],
          ["Expected trainer support", d.trainer_expectations],
          ["Consistency barriers", d.consistency_barriers],
          ["Anything else", d.anything_else]
        ]
      },
      {
        title: "09 · Client Declaration",
        fields: [
          ["Client confirmation", selected.client_confirmation],
          ["Declaration", selected.declaration ? "Confirmed" : "Not confirmed"],
          ["Date of submission", d.confirmation_date]
        ]
      }
    ];

    addAssessmentStyles();

    assessmentDetails.innerHTML = sections.map(section => `
      <details class="rw-assessment-section">
        <summary>${escapeHtml(section.title)}</summary>
        <div class="rw-assessment-section-body">
          ${section.fields.map(([label, value]) => detailItem(label, value)).join("")}
        </div>
      </details>
    `).join("");

    detailPanel.classList.remove("rw-hidden");
    const isMobile = mobileLayout.matches;
    detailPanel.setAttribute("aria-modal", String(isMobile));
    document.body.classList.toggle("rw-detail-open", isMobile);
    $("detailScrollArea").scrollTop = 0;
    if (isMobile) $("closeDetail").focus();
    if (!isMobile) {
      detailPanel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    msg(notesMessage, "", "");
  }

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    msg(loginMessage, "", "");

    const button = $("loginButton");
    button.disabled = true;
    button.textContent = "Signing in…";

    try {
      supabaseClient = supabaseClient || getClient();

      const { error } = await supabaseClient.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value
      });

      if (error) throw error;

      showDashboard(true);
      await loadAssessments();
    } catch (error) {
      console.error(error);
      msg(
        loginMessage,
        "Sign-in failed. Check your email/password, Supabase configuration, and email/password sign-in settings.",
        "error"
      );
    } finally {
      button.disabled = false;
      button.textContent = "Sign in";
    }
  });

  $("forgotPasswordButton").addEventListener("click", async function () {
    const email = $("email").value.trim();
    if (!email) {
      msg(loginMessage, "Enter your trainer email address first.", "error");
      $("email").focus();
      return;
    }

    const button = $("forgotPasswordButton");
    button.disabled = true;
    msg(loginMessage, "Requesting password reset…", "");

    try {
      supabaseClient = supabaseClient || getClient();
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: "https://rawwayfit.in/trainer.html"
      });
      if (error) throw error;

      msg(
        loginMessage,
        "If an account exists for that email, password reset instructions will be sent.",
        "success"
      );
    } catch (error) {
      console.error(error);
      msg(loginMessage, "Unable to start password reset right now. Please try again later.", "error");
    } finally {
      button.disabled = false;
    }
  });

  passwordRecoveryForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const password = $("newPassword").value;
    if (password !== $("confirmNewPassword").value) {
      msg($("passwordRecoveryMessage"), "The passwords do not match.", "error");
      return;
    }

    const button = $("saveNewPasswordButton");
    button.disabled = true;
    button.textContent = "Updating…";
    msg($("passwordRecoveryMessage"), "", "");

    try {
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;

      const { error: signOutError } = await supabaseClient.auth.signOut();
      if (signOutError) throw signOutError;

      passwordRecoveryForm.reset();
      showPasswordRecovery(false);
      showDashboard(false);
      msg(loginMessage, "Password updated. Sign in with your new password.", "success");
    } catch (error) {
      console.error(error);
      msg($("passwordRecoveryMessage"), "Could not update your password. Request a new reset email and try again.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Update password";
    }
  });

  $("signOutButton").addEventListener("click", async function () {
    const button = $("signOutButton");
    button.disabled = true;

    try {
      if (supabaseClient) {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
      }

      allAssessments = [];
      selected = null;
      clientPage = 0;
      clientStatusFilter = "all";
      detailPanel.classList.add("rw-hidden");
      detailPanel.setAttribute("aria-modal", "false");
      document.body.classList.remove("rw-detail-open");
      showDashboard(false);
    } catch (error) {
      console.error(error);
      msg(listMessage, "Could not sign out. Please try again.", "error");
    } finally {
      button.disabled = false;
    }
  });

  searchInput.addEventListener("input", function () {
    clientPage = 0;
    renderRows();
  });

  $("previousClients").addEventListener("click", function () {
    if (clientPage === 0) return;
    clientPage -= 1;
    renderRows();
  });

  $("nextClients").addEventListener("click", function () {
    if ((clientPage + 1) * clientPageSize >= getFilteredAssessments().length) return;
    clientPage += 1;
    renderRows();
  });

  document.querySelectorAll("[data-status-filter]").forEach(button => {
    button.addEventListener("click", function () {
      clientStatusFilter = button.dataset.statusFilter;
      clientPage = 0;
      renderRows();
    });
  });

  clientRows.addEventListener("click", function (event) {
    const button = event.target.closest("[data-id]");
    if (button) {
      lastClientTrigger = button;
      openAssessment(button.dataset.id);
    }
  });

  $("closeDetail").addEventListener("click", function () {
    detailPanel.classList.add("rw-hidden");
    detailPanel.setAttribute("aria-modal", "false");
    document.body.classList.remove("rw-detail-open");
    if (lastClientTrigger && lastClientTrigger.isConnected) lastClientTrigger.focus();
  });

  mobileLayout.addEventListener("change", function (event) {
    renderRows();
    const isOpen = !detailPanel.classList.contains("rw-hidden");
    detailPanel.setAttribute("aria-modal", String(event.matches && isOpen));
    document.body.classList.toggle("rw-detail-open", event.matches && isOpen);
    if (event.matches && isOpen) $("closeDetail").focus();
  });

  detailPanel.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && detailPanel.getAttribute("aria-modal") === "true") {
      $("closeDetail").click();
      return;
    }
    if (event.key !== "Tab" || detailPanel.getAttribute("aria-modal") !== "true") return;

    const focusable = Array.from(detailPanel.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
    )).filter(element => element.getClientRects().length);
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

  $("deleteAssessmentButton").addEventListener("click", async function () {
    if (!selected) return;

    const clientCode =
      "RWF-" + String(selected.client_number || 0).padStart(6, "0");
    const clientName = selected.client_name || "this client";
    if (!window.confirm(
      `Permanently delete the assessment for ${clientName} (${clientCode})? This cannot be undone.`
    )) return;

    const button = $("deleteAssessmentButton");
    button.disabled = true;
    button.textContent = "Deleting…";
    msg(notesMessage, "", "");

    try {
      const { error } = await supabaseClient
        .from("client_assessments")
        .delete()
        .eq("id", selected.id)
        .select("id")
        .single();

      if (error) throw error;

      allAssessments = allAssessments.filter(a => a.id !== selected.id);
      selected = null;
      detailPanel.classList.add("rw-hidden");
      detailPanel.setAttribute("aria-modal", "false");
      document.body.classList.remove("rw-detail-open");
      lastClientTrigger = null;
      renderRows();
      msg(listMessage, `${clientCode} was permanently deleted.`, "success");
    } catch (error) {
      console.error(error);
      msg(
        notesMessage,
        "Could not delete this assessment. Confirm the delete policy has been applied and try again.",
        "error"
      );
    } finally {
      button.disabled = false;
      button.textContent = "Delete assessment";
    }
  });

  $("trainerNotesForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!selected) return;

    const button = $("saveNotesButton");
    button.disabled = true;
    button.textContent = "Saving…";
    msg(notesMessage, "", "");

    try {
      const patch = {
        training_status: $("trainingStatus").value,
        trainer_summary: $("trainerSummary").value.trim() || null,
        initial_plan: $("initialPlan").value.trim() || null,
        next_review_date: $("nextReviewDate").value || null
      };

      const { error } = await supabaseClient
        .from("client_assessments")
        .update(patch)
        .eq("id", selected.id);

      if (error) throw error;

      Object.assign(selected, patch);

      const index = allAssessments.findIndex(a => a.id === selected.id);
      if (index >= 0) {
        Object.assign(allAssessments[index], patch);
      }

      msg(
        notesMessage,
        "Training status, next review date and trainer notes saved.",
        "success"
      );

      renderRows();
    } catch (error) {
      console.error(error);
      msg(
        notesMessage,
        "Could not save changes. Check your trainer access and try again.",
        "error"
      );
    } finally {
      button.disabled = false;
      button.textContent = "Save trainer notes";
    }
  });

  (async function init() {
    try {
      addStyles();
      addAssessmentStyles();

      supabaseClient = getClient();
      showDashboard(false);

      supabaseClient.auth.onAuthStateChange((event, sessionNow) => {
        if (event === "PASSWORD_RECOVERY") {
          showPasswordRecovery(true);
          msg($("passwordRecoveryMessage"), "", "");
          return;
        }

        if (!sessionNow) {
          if (passwordRecoveryActive) return;
          showDashboard(false);
          allAssessments = [];
        }
      });

      const {
        data: { session }
      } = await supabaseClient.auth.getSession();

      if (passwordRecoveryActive) {
        showPasswordRecovery(true);
      } else if (session) {
        showDashboard(true);
        await loadAssessments();
      } else {
        showDashboard(false);
      }
    } catch (error) {
      console.error(error);
      msg(
        loginMessage,
        error.message || "Could not initialize the dashboard.",
        "error"
      );
    }
  })();
})();
