(function () {
  const config = window.BookedWidgetConfig || {};
  const photoRequests = new Map();
  const CACHE_PREFIX = "booked:gallery:v2:";
  const RATIOS = {
    "1-1": "1 / 1",
    "4-3": "4 / 3",
    "3-2": "3 / 2",
    "16-9": "16 / 9",
    "2-3": "2 / 3",
  };

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const buildApiUrl = (path) => {
    const pathValue = String(path || "");
    const queryIndex = pathValue.indexOf("?");
    const routePath = queryIndex === -1 ? pathValue : pathValue.slice(0, queryIndex);
    const queryString = queryIndex === -1 ? "" : pathValue.slice(queryIndex + 1);
    const url = new URL(config.restUrl || "", window.location.href);
    const normalizedPath = routePath.startsWith("/") ? routePath : `/${routePath}`;
    const restRoute = url.searchParams.get("rest_route");

    if (restRoute !== null) {
      url.searchParams.set("rest_route", `${restRoute.replace(/\/$/, "")}${normalizedPath}`);
    } else {
      url.pathname = `${url.pathname.replace(/\/$/, "")}${normalizedPath}`;
    }

    if (queryString) {
      const queryParams = new URLSearchParams(queryString);
      queryParams.forEach((value, key) => url.searchParams.append(key, value));
    }

    return url.toString();
  };

  const getCacheKey = (path) => `${CACHE_PREFIX}${buildApiUrl(path)}`;

  const readCachedApi = (path) => {
    try {
      const cached = window.localStorage.getItem(getCacheKey(path));
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      return parsed && Object.prototype.hasOwnProperty.call(parsed, "data") ? parsed.data : null;
    } catch {
      return null;
    }
  };

  const writeCachedApi = (path, data) => {
    try {
      window.localStorage.setItem(getCacheKey(path), JSON.stringify({
        savedAt: Date.now(),
        data,
      }));
    } catch {
      // Cache is optional; rendering must keep working without localStorage.
    }
  };

  const apiFetch = async (path) => {
    const response = await fetch(buildApiUrl(path), {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Galerie Booked indisponible.");
    }
    writeCachedApi(path, payload);
    return payload;
  };

  const getPhotosPath = (giteId) => `/gites/${encodeURIComponent(String(giteId || ""))}/photos`;

  const fetchGitePhotos = (giteId) => {
    const normalizedGiteId = String(giteId || "");
    const path = getPhotosPath(normalizedGiteId);
    if (!photoRequests.has(normalizedGiteId)) {
      photoRequests.set(
        normalizedGiteId,
        apiFetch(path).finally(() => {
          photoRequests.delete(normalizedGiteId);
        })
      );
    }
    return photoRequests.get(normalizedGiteId);
  };

  const readNumberOption = (root, name, fallback, min, max) => {
    const value = Number.parseInt(root.dataset[name] || "", 10);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, value));
  };

  const getOptions = (root) => {
    const imageRatio = Object.prototype.hasOwnProperty.call(RATIOS, root.dataset.imageRatio || "")
      ? root.dataset.imageRatio
      : "4-3";
    const widthMode = root.dataset.widthMode === "full" ? "full" : "fixed";

    return {
      columns: readNumberOption(root, "columns", 3, 1, 6),
      gap: readNumberOption(root, "gap", 16, 0, 64),
      imageRatio,
      lightbox: root.dataset.lightbox !== "0",
      widthMode,
      maxWidth: readNumberOption(root, "maxWidth", 1200, 320, 2400),
      showCaptions: root.dataset.showCaptions === "1",
    };
  };

  const applyLayoutOptions = (root, options) => {
    root.dataset.columns = String(options.columns);
    root.classList.toggle("booked-gallery--fixed", options.widthMode === "fixed");
    root.classList.toggle("booked-gallery--full", options.widthMode === "full");
    root.style.setProperty("--booked-gallery-gap", `${options.gap}px`);
    root.style.setProperty("--booked-gallery-ratio", RATIOS[options.imageRatio]);
    root.style.setProperty("--booked-gallery-max-width", `${options.maxWidth}px`);
  };

  const normalizePhotos = (payload) =>
    (Array.isArray(payload && payload.photos) ? payload.photos : [])
      .map((photo, index) => ({
        id: String(photo && photo.id ? photo.id : `photo-${index}`),
        url: String(photo && photo.url ? photo.url : ""),
        fullUrl: String(photo && photo.full_url ? photo.full_url : photo && photo.url ? photo.url : ""),
        srcset: String(photo && photo.srcset ? photo.srcset : ""),
        sizes: String(photo && photo.sizes ? photo.sizes : ""),
        title: String(photo && photo.title ? photo.title : ""),
        alt: String(photo && photo.alt ? photo.alt : ""),
        credit: String(photo && photo.credit ? photo.credit : ""),
      }))
      .filter((photo) => photo.url);

  const buildCaptionText = (photo) => [photo.title, photo.credit].filter(Boolean).join(" - ");

  const buildImage = (photo, index) => {
    const image = createElement("img", "booked-gallery__image");
    image.src = photo.url;
    if (photo.srcset) image.srcset = photo.srcset;
    if (photo.sizes) image.sizes = photo.sizes;
    image.alt = photo.alt || photo.title || "";
    image.loading = index === 0 ? "eager" : "lazy";
    image.decoding = "async";
    return image;
  };

  const openLightbox = (photos, startIndex) => {
    let currentIndex = startIndex;
    const overlay = createElement("div", "booked-gallery-lightbox");
    const dialog = createElement("div", "booked-gallery-lightbox__dialog");
    const image = createElement("img", "booked-gallery-lightbox__image");
    const caption = createElement("div", "booked-gallery-lightbox__caption");
    const closeButton = createElement("button", "booked-gallery-lightbox__close", "Fermer");
    const previousButton = createElement("button", "booked-gallery-lightbox__nav booked-gallery-lightbox__nav--previous", "Précédente");
    const nextButton = createElement("button", "booked-gallery-lightbox__nav booked-gallery-lightbox__nav--next", "Suivante");

    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    closeButton.type = "button";
    previousButton.type = "button";
    nextButton.type = "button";

    const renderCurrent = () => {
      const photo = photos[currentIndex];
      image.src = photo.fullUrl || photo.url;
      image.removeAttribute("srcset");
      image.removeAttribute("sizes");
      image.alt = photo.alt || photo.title || "";
      caption.textContent = buildCaptionText(photo);
      caption.hidden = caption.textContent === "";
      previousButton.hidden = photos.length < 2;
      nextButton.hidden = photos.length < 2;
    };

    const close = () => {
      document.removeEventListener("keydown", handleKeydown);
      document.body.classList.remove("booked-gallery-lightbox-is-open");
      overlay.remove();
    };

    const move = (direction) => {
      currentIndex = (currentIndex + direction + photos.length) % photos.length;
      renderCurrent();
    };

    function handleKeydown(event) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft" && photos.length > 1) move(-1);
      if (event.key === "ArrowRight" && photos.length > 1) move(1);
    }

    closeButton.addEventListener("click", close);
    previousButton.addEventListener("click", () => move(-1));
    nextButton.addEventListener("click", () => move(1));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    document.addEventListener("keydown", handleKeydown);

    dialog.appendChild(closeButton);
    dialog.appendChild(previousButton);
    dialog.appendChild(image);
    dialog.appendChild(nextButton);
    dialog.appendChild(caption);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    document.body.classList.add("booked-gallery-lightbox-is-open");
    renderCurrent();
    closeButton.focus();
  };

  const renderContent = (root, payload) => {
    const options = getOptions(root);
    const photos = normalizePhotos(payload);

    applyLayoutOptions(root, options);
    root.innerHTML = "";

    if (photos.length === 0) {
      root.appendChild(createElement("div", "booked-gallery__empty", "Aucune image disponible."));
      return;
    }

    const grid = createElement("div", "booked-gallery__grid");
    photos.forEach((photo, index) => {
      const figure = createElement("figure", "booked-gallery__item");
      const media = createElement(options.lightbox ? "button" : "div", "booked-gallery__media");
      if (options.lightbox) {
        media.type = "button";
        media.setAttribute("aria-label", photo.title ? `Agrandir ${photo.title}` : "Agrandir l'image");
        media.addEventListener("click", () => openLightbox(photos, index));
      }
      media.appendChild(buildImage(photo, index));
      figure.appendChild(media);

      if (options.showCaptions) {
        const captionText = buildCaptionText(photo);
        if (captionText) {
          figure.appendChild(createElement("figcaption", "booked-gallery__caption", captionText));
        }
      }

      grid.appendChild(figure);
    });

    root.appendChild(grid);
  };

  const renderGallery = async (root) => {
    const giteId = root.dataset.giteId;
    if (!giteId) {
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-gallery__empty", "Sélectionnez un gîte."));
      return;
    }

    const cachedPayload = readCachedApi(getPhotosPath(giteId));
    if (cachedPayload) {
      renderContent(root, cachedPayload);
    } else {
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-gallery__loading", "Chargement..."));
    }

    try {
      const payload = await fetchGitePhotos(giteId);
      renderContent(root, payload);
    } catch (error) {
      if (cachedPayload) return;
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-widget--error", error.message || "Galerie indisponible."));
    }
  };

  window.BookedGallery = {
    render: renderGallery,
    initAll() {
      document.querySelectorAll(".booked-gallery[data-gite-id]").forEach((root) => {
        if (root.dataset.bookedGalleryInitialized === "1") return;
        root.dataset.bookedGalleryInitialized = "1";
        void renderGallery(root);
      });
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    window.BookedGallery.initAll();
  });
})();
