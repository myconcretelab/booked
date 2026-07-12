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

  let openOverlayCount = 0;

  const lockPageScroll = () => {
    openOverlayCount += 1;
    document.body.classList.add("booked-gallery-lightbox-is-open");
  };

  const unlockPageScroll = () => {
    openOverlayCount = Math.max(0, openOverlayCount - 1);
    if (openOverlayCount === 0) {
      document.body.classList.remove("booked-gallery-lightbox-is-open");
    }
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
      layoutMode: ["featured", "frames"].includes(root.dataset.layoutMode) ? root.dataset.layoutMode : "grid",
      featuredSideCount: readNumberOption(root, "featuredSideCount", 4, 1, 8),
      hoverDimOpacity: readNumberOption(root, "hoverDimOpacity", 0, 0, 80),
      lightbox: root.dataset.lightbox !== "0",
      expandMode: root.dataset.expandMode === "masonry" ? "masonry" : "lightbox",
      widthMode,
      maxWidth: readNumberOption(root, "maxWidth", 1200, 320, 2400),
      showCaptions: root.dataset.showCaptions === "1",
    };
  };

  const applyLayoutOptions = (root, options) => {
    root.dataset.columns = String(options.columns);
    root.dataset.layoutMode = options.layoutMode;
    root.dataset.featuredSideCount = String(options.featuredSideCount);
    root.dataset.hoverDimOpacity = String(options.hoverDimOpacity);
    root.classList.toggle("booked-gallery--fixed", options.widthMode === "fixed");
    root.classList.toggle("booked-gallery--full", options.widthMode === "full");
    root.classList.toggle("booked-gallery--layout-grid", options.layoutMode === "grid");
    root.classList.toggle("booked-gallery--layout-featured", options.layoutMode === "featured");
    root.classList.toggle("booked-gallery--layout-frames", options.layoutMode === "frames");
    root.style.setProperty("--booked-gallery-gap", `${options.gap}px`);
    root.style.setProperty("--booked-gallery-ratio", RATIOS[options.imageRatio]);
    root.style.setProperty("--booked-gallery-max-width", `${options.maxWidth}px`);
    root.style.setProperty("--booked-gallery-hover-dim-opacity", String(options.hoverDimOpacity / 100));
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

  const buildFullImage = (photo, index) => {
    const image = createElement("img", "booked-gallery-masonry-overlay__image");
    image.src = photo.fullUrl || photo.url;
    if (photo.srcset) image.srcset = photo.srcset;
    if (photo.sizes) image.sizes = photo.sizes;
    image.alt = photo.alt || photo.title || "";
    image.loading = index < 2 ? "eager" : "lazy";
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
      unlockPageScroll();
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
    lockPageScroll();
    renderCurrent();
    closeButton.focus();
  };

  const openMasonryOverlay = (photos) => {
    const overlay = createElement("div", "booked-gallery-masonry-overlay");
    const header = createElement("div", "booked-gallery-masonry-overlay__header");
    const closeButton = createElement("button", "booked-gallery-masonry-overlay__back", "Détails");
    const grid = createElement("div", "booked-gallery-masonry-overlay__grid");

    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Retour aux détails");

    const close = () => {
      document.removeEventListener("keydown", handleKeydown);
      unlockPageScroll();
      overlay.remove();
    };

    function handleKeydown(event) {
      if (event.key !== "Escape") return;
      if (document.querySelector(".booked-gallery-lightbox")) return;
      close();
    }

    photos.forEach((photo, index) => {
      const item = createElement("figure", "booked-gallery-masonry-overlay__item");
      const media = createElement("button", "booked-gallery-masonry-overlay__media");
      media.type = "button";
      media.setAttribute("aria-label", photo.title ? `Agrandir ${photo.title}` : "Agrandir l'image");
      media.addEventListener("click", () => openLightbox(photos, index));
      media.appendChild(buildFullImage(photo, index));
      item.appendChild(media);

      const captionText = buildCaptionText(photo);
      if (captionText) {
        item.appendChild(createElement("figcaption", "booked-gallery-masonry-overlay__caption", captionText));
      }

      grid.appendChild(item);
    });

    closeButton.addEventListener("click", close);
    document.addEventListener("keydown", handleKeydown);
    header.appendChild(closeButton);
    overlay.appendChild(header);
    overlay.appendChild(grid);
    document.body.appendChild(overlay);
    lockPageScroll();
    closeButton.focus();
  };

  const openGalleryExpansion = (photos, startIndex, options) => {
    if (options.expandMode === "masonry") {
      openMasonryOverlay(photos);
      return;
    }

    openLightbox(photos, startIndex);
  };

  const buildGalleryItem = (photos, index, options, itemClassName, showCountButton) => {
    const photo = photos[index];
    const figure = createElement("figure", ["booked-gallery__item", itemClassName].filter(Boolean).join(" "));
    const media = createElement(options.lightbox ? "button" : "div", "booked-gallery__media");

    if (options.lightbox) {
      const targetIndex = showCountButton ? 0 : index;
      media.type = "button";
      media.setAttribute("aria-label", showCountButton ? `Voir les ${photos.length} photos` : photo.title ? `Agrandir ${photo.title}` : "Agrandir l'image");
      media.addEventListener("click", () => openGalleryExpansion(photos, targetIndex, options));
    }

    media.appendChild(buildImage(photo, index));

    if (showCountButton && options.lightbox) {
      media.appendChild(createElement("span", "booked-gallery__count-button", `Voir les ${photos.length} photos`));
    }

    figure.appendChild(media);

    if (options.showCaptions) {
      const captionText = buildCaptionText(photo);
      if (captionText) {
        figure.appendChild(createElement("figcaption", "booked-gallery__caption", captionText));
      }
    }

    return figure;
  };

  const bindGalleryHoverState = (root) => {
    if (root.dataset.bookedGalleryHoverBound === "1") return;
    root.dataset.bookedGalleryHoverBound = "1";

    const setActiveMedia = (media) => {
      root.querySelectorAll(".booked-gallery__media").forEach((item) => {
        item.classList.toggle("booked-gallery__media--active", item === media);
      });
      root.classList.add("booked-gallery--has-active-media");
    };

    const clearActiveMedia = () => {
      root.querySelectorAll(".booked-gallery__media").forEach((item) => item.classList.remove("booked-gallery__media--active"));
      root.classList.remove("booked-gallery--has-active-media");
    };

    root.addEventListener("pointerover", (event) => {
      const media = event.target.closest(".booked-gallery__media");
      if (media && root.contains(media)) {
        setActiveMedia(media);
      }
    });

    root.addEventListener("focusin", (event) => {
      const media = event.target.closest(".booked-gallery__media");
      if (media && root.contains(media)) {
        setActiveMedia(media);
      }
    });

    root.addEventListener("pointerleave", () => {
      if (!root.contains(document.activeElement)) {
        clearActiveMedia();
      }
    });

    root.addEventListener("focusout", (event) => {
      if (!root.contains(event.relatedTarget)) {
        clearActiveMedia();
      }
    });
  };

  const renderGridContent = (root, photos, options) => {
    const grid = createElement("div", "booked-gallery__grid");
    photos.forEach((photo, index) => {
      grid.appendChild(buildGalleryItem(photos, index, options));
    });
    root.appendChild(grid);
  };

  const renderFeaturedContent = (root, photos, options) => {
    const sideCount = Math.min(options.featuredSideCount, Math.max(0, photos.length - 1));
    const wrapper = createElement("div", "booked-gallery__featured");
    const side = createElement("div", "booked-gallery__featured-side");

    wrapper.appendChild(buildGalleryItem(photos, 0, options, "booked-gallery__item--featured-main", false));

    for (let offset = 0; offset < sideCount; offset += 1) {
      const index = offset + 1;
      const isLastVisibleSideItem = offset === sideCount - 1;
      side.appendChild(buildGalleryItem(photos, index, options, "booked-gallery__item--featured-side", isLastVisibleSideItem));
    }

    wrapper.appendChild(side);
    root.appendChild(wrapper);
  };

  const getStableRotation = (photo, index, range, offset = 0) => {
    const seed = `${photo.id || photo.url || ""}-${index}`;
    let hash = 0;
    for (let position = 0; position < seed.length; position += 1) {
      hash = ((hash << 5) - hash + seed.charCodeAt(position)) | 0;
    }
    const normalized = (Math.abs(hash) % 1000) / 999;
    return `${(offset + (normalized * 2 - 1) * range).toFixed(2)}deg`;
  };

  const renderFramesContent = (root, photos, options) => {
    const wrapper = createElement("div", "booked-gallery__frames");
    const main = buildGalleryItem(photos, 0, options, "booked-gallery__frames-main", false);
    const mainFrame = createElement("span", "booked-gallery__wood-frame-overlay");
    const baseUrl = String(config.woodFrameBaseUrl || "").replace(/\/?$/, "/");
    main.style.setProperty("--booked-gallery-frame-rotation", getStableRotation(photos[0], 0, 0.9));
    mainFrame.style.backgroundImage = `url("${baseUrl}cadre-bois-orne.png")`;
    main.appendChild(mainFrame);
    wrapper.appendChild(main);

    const polaroids = createElement("div", "booked-gallery__frames-polaroids");
    photos.slice(1, 5).forEach((photo, offset) => {
      const index = offset + 1;
      const item = buildGalleryItem(photos, index, options, "booked-gallery__frames-polaroid", index === Math.min(4, photos.length - 1));
      item.style.setProperty("--booked-gallery-polaroid-rotation", getStableRotation(photo, index, 8.5));
      item.appendChild(createElement("span", "booked-gallery__polaroid-frame-overlay"));
      polaroids.appendChild(item);
    });
    wrapper.appendChild(polaroids);
    root.appendChild(wrapper);
  };

  const renderContent = (root, payload) => {
    const options = getOptions(root);
    const photos = normalizePhotos(payload);

    applyLayoutOptions(root, options);
    root.classList.remove("booked-gallery--has-active-media");
    root.innerHTML = "";

    if (photos.length === 0) {
      root.appendChild(createElement("div", "booked-gallery__empty", "Aucune image disponible."));
      return;
    }

    if (options.layoutMode === "frames") {
      renderFramesContent(root, photos, options);
      return;
    }

    if (options.layoutMode === "featured" && photos.length > 1) {
      renderFeaturedContent(root, photos, options);
      bindGalleryHoverState(root);
      return;
    }

    renderGridContent(root, photos, options);
    bindGalleryHoverState(root);
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
