/* =====================================================
   MOBILE MENU
===================================================== */

const menuToggle = document.getElementById("menuToggle");

const mobileMenu = document.getElementById("mobileMenu");

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener("click", function () {
    const isOpen = mobileMenu.classList.toggle("open");

    menuToggle.classList.toggle("active", isOpen);

    menuToggle.setAttribute("aria-expanded", String(isOpen));

    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation menu" : "Open navigation menu",
    );
  });

  /* CLOSE MENU WHEN LINK IS CLICKED */

  mobileMenu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      mobileMenu.classList.remove("open");

      menuToggle.classList.remove("active");

      menuToggle.setAttribute("aria-expanded", "false");

      menuToggle.setAttribute("aria-label", "Open navigation menu");
    });
  });
}

/* =====================================================
   CERTIFICATIONS CAROUSEL
===================================================== */

const certificateSlides = document.querySelectorAll(".certificate-slide");

const certificatePrevious = document.getElementById("certificatePrevious");

const certificateNext = document.getElementById("certificateNext");

const certificateCounter = document.getElementById("certificateCounter");

let certificateCurrent = 0;

let certificateAutoSlide;

/* SHOW CERTIFICATE */

function showCertificate(index) {
  if (!certificateSlides.length) {
    return;
  }

  if (index < 0) {
    certificateCurrent = certificateSlides.length - 1;
  } else if (index >= certificateSlides.length) {
    certificateCurrent = 0;
  } else {
    certificateCurrent = index;
  }

  certificateSlides.forEach(function (slide, i) {
    slide.classList.toggle("active", i === certificateCurrent);
  });

  if (certificateCounter) {
    certificateCounter.textContent = `${certificateCurrent + 1} / ${certificateSlides.length}`;
  }
}

/* NEXT */

if (certificateNext) {
  certificateNext.addEventListener("click", function () {
    showCertificate(certificateCurrent + 1);

    resetCertificateAutoSlide();
  });
}

/* PREVIOUS */

if (certificatePrevious) {
  certificatePrevious.addEventListener("click", function () {
    showCertificate(certificateCurrent - 1);

    resetCertificateAutoSlide();
  });
}

/* START */

showCertificate(0);

/* AUTO CHANGE EVERY 3 SECONDS */

function startCertificateAutoSlide() {
  certificateAutoSlide = setInterval(function () {
    showCertificate(certificateCurrent + 1);
  }, 3000);
}

/* RESET AUTO SLIDE */

function resetCertificateAutoSlide() {
  clearInterval(certificateAutoSlide);

  startCertificateAutoSlide();
}

startCertificateAutoSlide();

/* =====================================================
   BEFORE & AFTER CAROUSEL
===================================================== */

const baSlides = document.querySelectorAll(".ba-slide");

const baPrevious = document.getElementById("baPrevious");

const baNext = document.getElementById("baNext");

const baCounter = document.getElementById("baCounter");

let baCurrent = 0;

let baAutoSlide;

/* SHOW BEFORE / AFTER */

function showBeforeAfter(index) {
  if (!baSlides.length) {
    return;
  }

  if (index < 0) {
    baCurrent = baSlides.length - 1;
  } else if (index >= baSlides.length) {
    baCurrent = 0;
  } else {
    baCurrent = index;
  }

  baSlides.forEach(function (slide, i) {
    slide.classList.toggle("active", i === baCurrent);
  });

  if (baCounter) {
    baCounter.textContent = `${baCurrent + 1} / ${baSlides.length}`;
  }
}

/* NEXT */

if (baNext) {
  baNext.addEventListener("click", function () {
    showBeforeAfter(baCurrent + 1);

    resetBAAutoSlide();
  });
}

/* PREVIOUS */

if (baPrevious) {
  baPrevious.addEventListener("click", function () {
    showBeforeAfter(baCurrent - 1);

    resetBAAutoSlide();
  });
}

/* START */

showBeforeAfter(0);

/* AUTO CHANGE */

function startBAAutoSlide() {
  baAutoSlide = setInterval(function () {
    showBeforeAfter(baCurrent + 1);
  }, 3000);
}

/* RESET */

function resetBAAutoSlide() {
  clearInterval(baAutoSlide);

  startBAAutoSlide();
}

startBAAutoSlide();

/* =====================================================
   MY JOURNEY CAROUSEL
===================================================== */

const journeySlides = document.querySelectorAll(".journey-slide");

const journeyPrevious = document.getElementById("journeyPrevious");

const journeyNext = document.getElementById("journeyNext");

const journeyCounter = document.getElementById("journeyCounter");

let journeyCurrent = 0;

let journeyAutoSlide;

/* SHOW JOURNEY */

function showJourney(index) {
  if (!journeySlides.length) {
    return;
  }

  if (index < 0) {
    journeyCurrent = journeySlides.length - 1;
  } else if (index >= journeySlides.length) {
    journeyCurrent = 0;
  } else {
    journeyCurrent = index;
  }

  journeySlides.forEach(function (slide, i) {
    slide.classList.toggle("active", i === journeyCurrent);
  });

  if (journeyCounter) {
    journeyCounter.textContent = `${journeyCurrent + 1} / ${journeySlides.length}`;
  }
}

/* NEXT */

if (journeyNext) {
  journeyNext.addEventListener("click", function () {
    showJourney(journeyCurrent + 1);

    resetJourneyAutoSlide();
  });
}

/* PREVIOUS */

if (journeyPrevious) {
  journeyPrevious.addEventListener("click", function () {
    showJourney(journeyCurrent - 1);

    resetJourneyAutoSlide();
  });
}

/* START */

showJourney(0);

/* AUTO CHANGE EVERY 3 SECONDS */

function startJourneyAutoSlide() {
  journeyAutoSlide = setInterval(function () {
    showJourney(journeyCurrent + 1);
  }, 3000);
}

/* RESET */

function resetJourneyAutoSlide() {
  clearInterval(journeyAutoSlide);

  startJourneyAutoSlide();
}

startJourneyAutoSlide();

/* =====================================================
   SUPABASE FEEDBACK
===================================================== */

let supabaseClient = null;

if (
  window.supabase &&
  window.RAWWAYFIT_SUPABASE_URL &&
  window.RAWWAYFIT_SUPABASE_PUBLISHABLE_KEY
) {
  supabaseClient = window.supabase.createClient(
    window.RAWWAYFIT_SUPABASE_URL,
    window.RAWWAYFIT_SUPABASE_PUBLISHABLE_KEY,
  );
}

/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return {
      "&": "&amp;",

      "<": "&lt;",

      ">": "&gt;",

      '"': "&quot;",

      "'": "&#039;",
    }[character];
  });
}

/* =====================================================
   STAR RATING
===================================================== */

function getStars(rating) {
  const number = Number(rating) || 0;

  return "★".repeat(number) + "☆".repeat(5 - number);
}

/* =====================================================
   LOAD APPROVED FEEDBACK
===================================================== */

const feedbackViewport = document.getElementById("publishedFeedback");
const feedbackTrack = document.getElementById("feedbackTrack");
const feedbackSortButtons = document.querySelectorAll(".feedback-sort-button");
const feedbackPrevious = document.getElementById("feedbackPrevious");
const feedbackNext = document.getElementById("feedbackNext");
const feedbackCounter = document.getElementById("feedbackCounter");
let approvedFeedback = [];
let feedbackIndex = 0;
let feedbackSortOrder = "latest";

function getVisibleFeedbackCount() {
  if (!feedbackViewport || !feedbackTrack || !feedbackTrack.firstElementChild) {
    return 1;
  }

  const card = feedbackTrack.firstElementChild;
  const gap = Number.parseFloat(window.getComputedStyle(feedbackTrack).gap) || 0;
  const cardWidth = card.getBoundingClientRect().width;

  if (!cardWidth) {
    return 1;
  }

  return Math.max(
    1,
    Math.floor((feedbackViewport.clientWidth + gap) / (cardWidth + gap)),
  );
}

function updateFeedbackCarousel() {
  if (!feedbackTrack || !feedbackViewport) {
    return;
  }

  const cards = feedbackTrack.querySelectorAll(".testimonial");
  const visibleCount = getVisibleFeedbackCount();
  const maximumIndex = Math.max(0, cards.length - visibleCount);

  feedbackIndex = Math.min(feedbackIndex, maximumIndex);

  if (cards.length > 0) {
    const firstCard = cards[0];
    const gap =
      Number.parseFloat(window.getComputedStyle(feedbackTrack).gap) || 0;
    const step = firstCard.getBoundingClientRect().width + gap;

    feedbackTrack.style.transform = `translateX(-${feedbackIndex * step}px)`;
  } else {
    feedbackTrack.style.transform = "";
  }

  if (feedbackPrevious) {
    feedbackPrevious.disabled = feedbackIndex === 0;
  }

  if (feedbackNext) {
    feedbackNext.disabled = feedbackIndex >= maximumIndex;
  }

  if (feedbackCounter) {
    const firstVisible = cards.length === 0 ? 0 : feedbackIndex + 1;
    const lastVisible = Math.min(feedbackIndex + visibleCount, cards.length);

    feedbackCounter.textContent =
      cards.length === 0
        ? ""
        : `${firstVisible}-${lastVisible} / ${cards.length}`;
  }
}

function renderFeedback() {
  if (!feedbackTrack) {
    return;
  }

  const sortedFeedback = [...approvedFeedback].sort(function (first, second) {
    const firstDate = Date.parse(first.created_at) || 0;
    const secondDate = Date.parse(second.created_at) || 0;

    return feedbackSortOrder === "oldest"
      ? firstDate - secondDate
      : secondDate - firstDate;
  });

  feedbackTrack.innerHTML = sortedFeedback
    .map(function (item) {
      return `
        <article class="testimonial">
          <div class="rating">${getStars(item.rating)}</div>
          <p>“${escapeHTML(item.feedback)}”</p>
          <strong>— ${escapeHTML(item.name)}</strong>
        </article>
      `;
    })
    .join("");

  feedbackIndex = 0;
  updateFeedbackCarousel();
}

feedbackSortButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    feedbackSortOrder = button.dataset.sort;

    feedbackSortButtons.forEach(function (sortButton) {
      const isActive = sortButton === button;

      sortButton.classList.toggle("active", isActive);
      sortButton.setAttribute("aria-pressed", String(isActive));
    });

    renderFeedback();
  });
});

if (feedbackPrevious) {
  feedbackPrevious.addEventListener("click", function () {
    feedbackIndex = Math.max(0, feedbackIndex - 1);
    updateFeedbackCarousel();
  });
}

if (feedbackNext) {
  feedbackNext.addEventListener("click", function () {
    feedbackIndex += 1;
    updateFeedbackCarousel();
  });
}

window.addEventListener("resize", updateFeedbackCarousel);

async function loadFeedback() {
  if (!feedbackViewport || !feedbackTrack) {
    return;
  }

  if (!supabaseClient) {
    feedbackViewport.closest(".feedback-carousel").hidden = true;
    document.querySelector(".feedback-controls").hidden = true;

    return;
  }

  const result = await supabaseClient
    .from("feedback")
    .select("id,name,rating,feedback,created_at")
    .eq("status", "approved")
    .order("created_at", {
      ascending: false,
    });

  if (result.error) {
    console.error(result.error);

    feedbackTrack.innerHTML =
      '<div class="empty-feedback">' +
      "Client feedback is temporarily unavailable." +
      "</div>";

    updateFeedbackCarousel();

    return;
  }

  if (!result.data || result.data.length === 0) {
    feedbackTrack.innerHTML =
      '<div class="empty-feedback">' +
      "No client feedback has been published yet." +
      "</div>";

    updateFeedbackCarousel();

    return;
  }

  approvedFeedback = result.data;
  renderFeedback();
}

/* =====================================================
   FEEDBACK FORM
===================================================== */

const feedbackForm = document.getElementById("feedbackForm");

if (feedbackForm) {
  feedbackForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const message = document.getElementById("formMessage");

    const submitButton = feedbackForm.querySelector('button[type="submit"]');

    const name = document.getElementById("clientName").value.trim();

    const rating = Number(document.getElementById("rating").value);

    const feedback = document.getElementById("feedbackText").value.trim();

    const permission = document.getElementById("permission").checked;

    message.textContent = "";

    /* VALIDATION */

    if (!name || !rating || !feedback) {
      message.textContent = "Please complete all fields.";

      return;
    }

    if (!permission) {
      message.textContent =
        "Please give permission before submitting your feedback.";

      return;
    }

    if (name.length > 100 || feedback.length > 2000) {
      message.textContent =
        "Please keep your name under 100 characters and feedback under 2000 characters.";

      return;
    }

    if (!supabaseClient) {
      message.textContent = "Feedback system is not configured yet.";

      return;
    }

    submitButton.disabled = true;

    submitButton.textContent = "SUBMITTING...";

    const result = await supabaseClient.from("feedback").insert([
      {
        name: name,

        rating: rating,

        feedback: feedback,

        permission: true,

        status: "pending",
      },
    ]);

    submitButton.disabled = false;

    submitButton.textContent = "SUBMIT FEEDBACK";

    if (result.error) {
      console.error(result.error);

      message.textContent =
        "We could not submit your feedback right now. Please try again.";

      return;
    }

    feedbackForm.reset();

    message.textContent =
      "Thank you! Your feedback has been submitted and is awaiting review.";
  });
}

/* =====================================================
   LOAD FEEDBACK
===================================================== */

loadFeedback();
