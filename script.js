/* =====================================================
   LOAD APPROVED FEEDBACK
===================================================== */

const feedbackViewport =
  document.getElementById("publishedFeedback");

const feedbackTrack =
  document.getElementById("feedbackTrack");

const feedbackSortButtons =
  document.querySelectorAll("[data-sort]");

const feedbackRatingSelect =
  document.getElementById("feedbackRatingFilter");

const feedbackPrevious =
  document.getElementById("feedbackPrevious");

const feedbackNext =
  document.getElementById("feedbackNext");

const feedbackCounter =
  document.getElementById("feedbackCounter");

let approvedFeedback = [];

let feedbackIndex = 0;

let feedbackSortOrder = "latest";

let feedbackRatingFilter = "all";


/* =====================================================
   HOW MANY CARDS CAN BE SHOWN
===================================================== */

function getVisibleFeedbackCount() {

  if (!feedbackViewport) {
    return 1;
  }

  const width = feedbackViewport.clientWidth;

  if (width <= 600) {
    return 1;
  }

  if (width <= 900) {
    return 2;
  }

  return 3;
}


/* =====================================================
   GET FILTERED + SORTED FEEDBACK
===================================================== */

function getFilteredFeedback() {

  let filteredFeedback = approvedFeedback.filter(
    function (item) {

      if (feedbackRatingFilter === "all") {
        return true;
      }

      return (
        Number(item.rating) ===
        Number(feedbackRatingFilter)
      );

    }
  );


  /* SORT */

  filteredFeedback.sort(function (first, second) {

    const firstDate =
      Date.parse(first.created_at) || 0;

    const secondDate =
      Date.parse(second.created_at) || 0;


    if (feedbackSortOrder === "oldest") {

      return firstDate - secondDate;

    }


    return secondDate - firstDate;

  });


  return filteredFeedback;
}


/* =====================================================
   UPDATE FEEDBACK CAROUSEL
===================================================== */

function updateFeedbackCarousel() {

  if (!feedbackTrack || !feedbackViewport) {
    return;
  }


  const cards =
    feedbackTrack.querySelectorAll(
      ".testimonial"
    );


  const totalCards =
    cards.length;


  const visibleCount =
    Math.min(
      getVisibleFeedbackCount(),
      totalCards
    );


  const maximumIndex =
    Math.max(
      0,
      totalCards - visibleCount
    );


  /* Keep index inside valid range */

  if (feedbackIndex > maximumIndex) {
    feedbackIndex = maximumIndex;
  }


  if (feedbackIndex < 0) {
    feedbackIndex = 0;
  }


  /* No feedback */

  if (totalCards === 0) {

    feedbackTrack.style.transform =
      "translateX(0)";


    if (feedbackPrevious) {
      feedbackPrevious.disabled = true;
    }


    if (feedbackNext) {
      feedbackNext.disabled = true;
    }


    if (feedbackCounter) {
      feedbackCounter.textContent = "";
    }


    return;
  }


  /* Get card width */

  const firstCard = cards[0];


  const cardWidth =
    firstCard.getBoundingClientRect().width;


  const gap =
    parseFloat(
      window.getComputedStyle(
        feedbackTrack
      ).gap
    ) || 0;


  const movement =
    cardWidth + gap;


  /* Move carousel */

  feedbackTrack.style.transform =
    `translateX(-${feedbackIndex * movement}px)`;


  /* Previous button */

  if (feedbackPrevious) {

    feedbackPrevious.disabled =
      feedbackIndex === 0;

  }


  /* Next button */

  if (feedbackNext) {

    feedbackNext.disabled =
      feedbackIndex >= maximumIndex;

  }


  /* Counter */

  if (feedbackCounter) {

    const firstVisible =
      feedbackIndex + 1;


    const lastVisible =
      Math.min(
        feedbackIndex + visibleCount,
        totalCards
      );


    feedbackCounter.textContent =
      `${firstVisible}-${lastVisible} / ${totalCards}`;

  }

}


/* =====================================================
   RENDER FEEDBACK
===================================================== */

function renderFeedback() {

  if (!feedbackTrack) {
    return;
  }


  const filteredFeedback =
    getFilteredFeedback();


  /* Always return to first card after
     changing filter or sorting */

  feedbackIndex = 0;


  /* No matching feedback */

  if (filteredFeedback.length === 0) {

    let message =
      "No client feedback has been published yet.";


    if (
      approvedFeedback.length > 0 &&
      feedbackRatingFilter !== "all"
    ) {

      message =
        `No feedback with a ${feedbackRatingFilter}-star rating yet.`;

    }


    feedbackTrack.innerHTML = `
      <div class="empty-feedback">
        ${escapeHTML(message)}
      </div>
    `;


    updateFeedbackCarousel();

    return;
  }


  /* Create feedback cards */

  feedbackTrack.innerHTML =
    filteredFeedback
      .map(function (item) {

        return `
          <article class="testimonial">

            <div
              class="rating"
              aria-label="${escapeHTML(item.rating)} out of 5 stars"
            >
              ${getStars(item.rating)}
            </div>

            <p>
              “${escapeHTML(item.feedback)}”
            </p>

            <strong>
              — ${escapeHTML(item.name)}
            </strong>

          </article>
        `;

      })
      .join("");


  updateFeedbackCarousel();

}


/* =====================================================
   SORT BUTTONS
===================================================== */

feedbackSortButtons.forEach(
  function (button) {

    button.addEventListener(
      "click",
      function () {

        feedbackSortOrder =
          button.dataset.sort || "latest";


        /* Update active button */

        feedbackSortButtons.forEach(
          function (sortButton) {

            const isActive =
              sortButton === button;


            sortButton.classList.toggle(
              "active",
              isActive
            );


            sortButton.setAttribute(
              "aria-pressed",
              String(isActive)
            );

          }
        );


        /* Re-render */

        renderFeedback();

      }
    );

  }
);


/* =====================================================
   RATING FILTER
===================================================== */

if (feedbackRatingSelect) {

  feedbackRatingSelect.addEventListener(
    "change",
    function () {

      feedbackRatingFilter =
        feedbackRatingSelect.value || "all";


      /* Re-render */

      renderFeedback();

    }
  );

}


/* =====================================================
   PREVIOUS BUTTON
===================================================== */

if (feedbackPrevious) {

  feedbackPrevious.addEventListener(
    "click",
    function () {

      if (feedbackIndex > 0) {

        feedbackIndex--;

        updateFeedbackCarousel();

      }

    }
  );

}


/* =====================================================
   NEXT BUTTON
===================================================== */

if (feedbackNext) {

  feedbackNext.addEventListener(
    "click",
    function () {

      if (!feedbackTrack) {
        return;
      }


      const cards =
        feedbackTrack.querySelectorAll(
          ".testimonial"
        );


      const visibleCount =
        Math.min(
          getVisibleFeedbackCount(),
          cards.length
        );


      const maximumIndex =
        Math.max(
          0,
          cards.length - visibleCount
        );


      if (feedbackIndex < maximumIndex) {

        feedbackIndex++;

        updateFeedbackCarousel();

      }

    }
  );

}


/* =====================================================
   WINDOW RESIZE
===================================================== */

window.addEventListener(
  "resize",
  function () {

    updateFeedbackCarousel();

  }
);


/* =====================================================
   LOAD FEEDBACK FROM SUPABASE
===================================================== */

async function loadFeedback() {

  if (!feedbackViewport || !feedbackTrack) {
    return;
  }


  /* Supabase not configured */

  if (!supabaseClient) {

    const carousel =
      feedbackViewport.closest(
        ".feedback-carousel"
      );


    if (carousel) {
      carousel.hidden = true;
    }


    const controls =
      document.querySelector(
        ".feedback-controls"
      );


    if (controls) {
      controls.hidden = true;
    }


    return;
  }


  /* Loading message */

  feedbackTrack.innerHTML = `
    <div class="empty-feedback">
      Loading client feedback...
    </div>
  `;


  /* Get approved feedback */

  const result =
    await supabaseClient
      .from("feedback")
      .select(
        "id,name,rating,feedback,created_at"
      )
      .eq(
        "status",
        "approved"
      );


  /* Error */

  if (result.error) {

    console.error(
      "Could not load feedback:",
      result.error
    );


    feedbackTrack.innerHTML = `
      <div class="empty-feedback">
        Client feedback is temporarily unavailable.
      </div>
    `;


    if (feedbackPrevious) {
      feedbackPrevious.disabled = true;
    }


    if (feedbackNext) {
      feedbackNext.disabled = true;
    }


    if (feedbackCounter) {
      feedbackCounter.textContent = "";
    }


    return;
  }


  /* Store feedback */

  approvedFeedback =
    result.data || [];


  /* Display */

  renderFeedback();

}


/* =====================================================
   FEEDBACK FORM
===================================================== */

const feedbackForm =
  document.getElementById(
    "feedbackForm"
  );


if (feedbackForm) {

  feedbackForm.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();


      const message =
        document.getElementById(
          "formMessage"
        );


      const submitButton =
        feedbackForm.querySelector(
          'button[type="submit"]'
        );


      const name =
        document.getElementById(
          "clientName"
        ).value.trim();


      const rating =
        Number(
          document.getElementById(
            "rating"
          ).value
        );


      const feedback =
        document.getElementById(
          "feedbackText"
        ).value.trim();


      const permission =
        document.getElementById(
          "permission"
        ).checked;


      message.textContent = "";


      /* VALIDATION */

      if (
        !name ||
        !rating ||
        !feedback
      ) {

        message.textContent =
          "Please complete all fields.";

        return;
      }


      if (!permission) {

        message.textContent =
          "Please give permission before submitting your feedback.";

        return;
      }


      if (
        name.length > 100 ||
        feedback.length > 2000
      ) {

        message.textContent =
          "Please keep your name under 100 characters and feedback under 2000 characters.";

        return;
      }


      if (!supabaseClient) {

        message.textContent =
          "Feedback system is not configured yet.";

        return;
      }


      /* Disable button */

      submitButton.disabled = true;

      submitButton.textContent =
        "SUBMITTING...";


      /* Insert feedback */

      const result =
        await supabaseClient
          .from("feedback")
          .insert([
            {
              name: name,

              rating: rating,

              feedback: feedback,

              permission: true,

              status: "pending",
            },
          ]);


      /* Enable button */

      submitButton.disabled = false;

      submitButton.textContent =
        "SUBMIT FEEDBACK";


      /* Error */

      if (result.error) {

        console.error(
          "Feedback submission error:",
          result.error
        );


        message.textContent =
          "We could not submit your feedback right now. Please try again.";

        return;
      }


      /* Success */

      feedbackForm.reset();


      message.textContent =
        "Thank you! Your feedback has been submitted and is awaiting review.";

    }
  );

}


/* =====================================================
   LOAD FEEDBACK
===================================================== */

loadFeedback();