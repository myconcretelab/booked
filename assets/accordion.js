(function () {
  const DETAILS_SELECTOR = ".booked-accordion__details";
  const PANEL_SELECTOR = ".booked-accordion__panel";
  const SUMMARY_SELECTOR = ".booked-accordion__summary";

  const openDetails = (details) => {
    const panel = details.querySelector(PANEL_SELECTOR);
    if (!panel || details.classList.contains("booked-accordion__details--open")) return;

    const accordion = details.closest(".booked-accordion");
    if (accordion && accordion.dataset.bookedAccordionSingle === "1") {
      accordion.querySelectorAll(DETAILS_SELECTOR).forEach((item) => {
        if (item !== details) closeDetails(item);
      });
    }

    details.open = true;
    details.classList.remove("booked-accordion__details--closing");
    details.classList.add("booked-accordion__details--open");
    panel.style.maxHeight = "0px";
    panel.style.opacity = "0";
    panel.offsetHeight;
    panel.style.maxHeight = `${panel.scrollHeight}px`;
    panel.style.opacity = "1";

    const finishOpening = (transitionEvent) => {
      if (transitionEvent.propertyName !== "max-height") return;
      panel.style.maxHeight = "";
      panel.style.opacity = "";
      panel.removeEventListener("transitionend", finishOpening);
    };
    panel.addEventListener("transitionend", finishOpening);
  };

  const closeDetails = (details) => {
    const panel = details.querySelector(PANEL_SELECTOR);
    if (!panel || !details.open || details.classList.contains("booked-accordion__details--closing")) return;

    panel.style.maxHeight = `${panel.scrollHeight}px`;
    panel.style.opacity = "1";
    details.classList.remove("booked-accordion__details--open");
    details.classList.add("booked-accordion__details--closing");
    panel.offsetHeight;
    panel.style.maxHeight = "0px";
    panel.style.opacity = "0";

    const finishClosing = (transitionEvent) => {
      if (transitionEvent.propertyName !== "max-height") return;
      if (details.classList.contains("booked-accordion__details--open")) {
        details.classList.remove("booked-accordion__details--closing");
        panel.removeEventListener("transitionend", finishClosing);
        return;
      }
      details.open = false;
      details.classList.remove("booked-accordion__details--closing");
      panel.removeEventListener("transitionend", finishClosing);
    };
    panel.addEventListener("transitionend", finishClosing);
  };

  const init = (root) => {
    const scope = root || document;
    scope.querySelectorAll(DETAILS_SELECTOR).forEach((details) => {
      if (details.dataset.bookedAccordionInitialized === "1") return;
      details.dataset.bookedAccordionInitialized = "1";

      if (details.open) {
        details.classList.add("booked-accordion__details--open");
      }

      const summary = details.querySelector(SUMMARY_SELECTOR);
      if (!summary) return;

      summary.addEventListener("click", (event) => {
        event.preventDefault();
        if (details.classList.contains("booked-accordion__details--open")) {
          closeDetails(details);
          return;
        }
        openDetails(details);
      });
    });
  };

  window.BookedAccordion = {
    init,
    open: openDetails,
    close: closeDetails,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(document));
  } else {
    init(document);
  }
})();
