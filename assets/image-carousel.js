(function () {
  const ROOT_SELECTOR = ".booked-image-carousel";

  const readInterval = (root) => {
    const interval = Number.parseInt(root.dataset.interval || "", 10);
    return Number.isFinite(interval) ? Math.max(1500, Math.min(20000, interval)) : 4500;
  };

  const getInitialIndex = (slides) => {
    const activeIndex = slides.findIndex((slide) => slide.classList.contains("booked-image-carousel__slide--active"));
    return activeIndex >= 0 ? activeIndex : 0;
  };

  const normalizeIndex = (index, total) => (index + total) % total;

  const updateSlideOffsets = (slides, activeIndex) => {
    slides.forEach((slide, index) => {
      let offset = index - activeIndex;
      if (offset > slides.length / 2) offset -= slides.length;
      if (offset < slides.length / -2) offset += slides.length;
      slide.style.setProperty("--booked-carousel-offset", String(offset));
    });
  };

  const initCarousel = (root) => {
    if (root.dataset.bookedImageCarouselInitialized === "1") return;
    root.dataset.bookedImageCarouselInitialized = "1";

    const slides = Array.from(root.querySelectorAll(".booked-image-carousel__slide"));
    const previousButton = root.querySelector(".booked-image-carousel__arrow--previous");
    const nextButton = root.querySelector(".booked-image-carousel__arrow--next");
    const dots = Array.from(root.querySelectorAll(".booked-image-carousel__dot"));
    const total = slides.length;
    let currentIndex = getInitialIndex(slides);
    let autoplayTimer = null;
    let pointerStartX = null;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (total === 0) return;

    const render = () => {
      updateSlideOffsets(slides, currentIndex);
      slides.forEach((slide, index) => {
        const isActive = index === currentIndex;
        slide.classList.toggle("booked-image-carousel__slide--active", isActive);
        slide.setAttribute("aria-hidden", isActive ? "false" : "true");
      });
      dots.forEach((dot, index) => {
        const isActive = index === currentIndex;
        dot.classList.toggle("booked-image-carousel__dot--active", isActive);
        dot.setAttribute("aria-current", isActive ? "true" : "false");
      });
    };

    const stopAutoplay = () => {
      if (!autoplayTimer) return;
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    };

    const startAutoplay = () => {
      stopAutoplay();
      if (root.dataset.autoplay !== "1" || total < 2 || reduceMotion) return;
      autoplayTimer = window.setInterval(() => {
        currentIndex = normalizeIndex(currentIndex + 1, total);
        render();
      }, readInterval(root));
    };

    const moveTo = (index, shouldRestartAutoplay) => {
      currentIndex = normalizeIndex(index, total);
      render();
      if (shouldRestartAutoplay) startAutoplay();
    };

    if (previousButton) {
      previousButton.addEventListener("click", () => moveTo(currentIndex - 1, true));
    }

    if (nextButton) {
      nextButton.addEventListener("click", () => moveTo(currentIndex + 1, true));
    }

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => moveTo(index, true));
    });

    root.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveTo(currentIndex - 1, true);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveTo(currentIndex + 1, true);
      }
    });

    root.addEventListener("pointerdown", (event) => {
      pointerStartX = event.clientX;
    });

    root.addEventListener("pointerup", (event) => {
      if (pointerStartX === null) return;
      const distance = event.clientX - pointerStartX;
      pointerStartX = null;
      if (Math.abs(distance) < 42 || total < 2) return;
      moveTo(currentIndex + (distance < 0 ? 1 : -1), true);
    });

    if (root.dataset.pauseOnHover !== "0") {
      root.addEventListener("pointerenter", stopAutoplay);
      root.addEventListener("pointerleave", startAutoplay);
      root.addEventListener("focusin", stopAutoplay);
      root.addEventListener("focusout", (event) => {
        if (!root.contains(event.relatedTarget)) startAutoplay();
      });
    }

    render();
    startAutoplay();
  };

  window.BookedImageCarousel = {
    init(root) {
      initCarousel(root);
    },
    initAll() {
      document.querySelectorAll(ROOT_SELECTOR).forEach(initCarousel);
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    window.BookedImageCarousel.initAll();
  });
})();
