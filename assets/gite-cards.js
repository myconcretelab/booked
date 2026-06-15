(function () {
  const config = window.BookedWidgetConfig || {};
  const contentRequests = new Map();
  const CACHE_PREFIX = "booked:gite-cards:v1:";

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const createSvgElement = (tag, attributes = {}) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  };

  const appendSvgShape = (svg, tag, attributes) => {
    svg.appendChild(createSvgElement(tag, attributes));
  };

  const createIcon = (type) => {
    const svg = createSvgElement("svg", {
      class: `booked-gite-cards__icon booked-gite-cards__icon--${type}`,
      viewBox: "0 0 24 24",
      fill: "none",
      "aria-hidden": "true",
      focusable: "false",
    });

    if (type === "people") {
      appendSvgShape(svg, "path", { d: "M16 11a4 4 0 1 0-8 0" });
      appendSvgShape(svg, "path", { d: "M4 20a8 8 0 0 1 16 0" });
      appendSvgShape(svg, "path", { d: "M18.5 8.5a3 3 0 0 1 2.5 3M3 11.5a3 3 0 0 1 2.5-3" });
    } else if (type === "bedrooms") {
      appendSvgShape(svg, "path", { d: "M5 20V5h14v15" });
      appendSvgShape(svg, "path", { d: "M9 20v-7h6v7M8 8h2M14 8h2" });
    } else if (type === "beds") {
      appendSvgShape(svg, "path", { d: "M4 11V7a2 2 0 0 1 2-2h5v6" });
      appendSvgShape(svg, "path", { d: "M4 11h16a2 2 0 0 1 2 2v5H4zM4 18v2M20 18v2M7 8h3v3H7zM12 8h5v3h-5z" });
    } else if (type === "bath") {
      appendSvgShape(svg, "path", { d: "M6 11V6a3 3 0 0 1 6 0" });
      appendSvgShape(svg, "path", { d: "M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM7 20l-1 2M18 20l1 2" });
    } else if (type === "surface") {
      appendSvgShape(svg, "path", { d: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" });
      appendSvgShape(svg, "path", { d: "M8 8h8v8H8z" });
    } else {
      appendSvgShape(svg, "path", { d: "M12 3l8 6v11H4V9z" });
      appendSvgShape(svg, "path", { d: "M9 20v-6h6v6" });
    }

    return svg;
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
      // Cache is optional; rendering still works without localStorage.
    }
  };

  const apiFetch = async (path) => {
    const response = await fetch(buildApiUrl(path), {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Contenu Booked indisponible.");
    }
    writeCachedApi(path, payload);
    return payload;
  };

  const getContentPath = (giteId) => `/gites/${encodeURIComponent(String(giteId || ""))}/content`;

  const fetchGiteContent = (giteId) => {
    const normalizedGiteId = String(giteId || "");
    const path = getContentPath(normalizedGiteId);
    if (!contentRequests.has(normalizedGiteId)) {
      contentRequests.set(
        normalizedGiteId,
        apiFetch(path).catch((error) => {
          contentRequests.delete(normalizedGiteId);
          throw error;
        })
      );
    }
    return contentRequests.get(normalizedGiteId);
  };

  const parseJsonList = (value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return String(value).split(",").map((item) => item.trim()).filter(Boolean);
    }
  };

  const getNumber = (...values) => {
    for (const value of values) {
      if (value === null || value === undefined || value === "") continue;
      const number = Number.parseInt(String(value).replace(/[^\d-]/g, ""), 10);
      if (Number.isFinite(number) && number > 0) return number;
    }
    return null;
  };

  const getText = (...values) => {
    for (const value of values) {
      const text = String(value || "").trim();
      if (text) return text;
    }
    return "";
  };

  const stripHtml = (value) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = String(value || "");
    return wrapper.textContent.replace(/\s+/g, " ").trim();
  };

  const truncateText = (value, maxLength) => {
    const text = stripHtml(value);
    if (text.length <= maxLength) return text;
    const shortened = text.slice(0, maxLength + 1).replace(/\s+\S*$/, "");
    return `${shortened || text.slice(0, maxLength)}...`;
  };

  const getSections = (payload) => (Array.isArray(payload && payload.sections) ? payload.sections : []);

  const getGroups = (payload) =>
    getSections(payload).flatMap((section) => (Array.isArray(section.groupes) ? section.groupes : []));

  const countGroupsMatching = (payload, pattern) =>
    getGroups(payload).filter((group) => pattern.test(String(group.titre || group.title || ""))).length;

  const countBeds = (payload) =>
    getGroups(payload).reduce((total, group) => {
      const items = Array.isArray(group.items) ? group.items : [];
      return total + items.reduce((itemTotal, item) => {
        if (!item || typeof item !== "object" || item.kind !== "bed") return itemTotal;
        const count = Number.parseInt(item.count, 10);
        return itemTotal + (Number.isFinite(count) && count > 0 ? count : 1);
      }, 0);
    }, 0);

  const getPrimaryPhoto = (payload) => {
    const photos = Array.isArray(payload && payload.photos) ? payload.photos : [];
    const photo = photos.find((item) => item && item.is_primary && item.url) || photos.find((item) => item && item.url);
    if (!photo) return null;

    return {
      url: String(photo.url || ""),
      alt: getText(photo.alt, photo.title, payload.public_title, payload.nom),
    };
  };

  const normalizeGite = (giteId, payload, metadata) => {
    const capacity = getNumber(payload.capacite_max, payload.capacity, payload.capacite, metadata.capacity);
    const bedrooms = getNumber(payload.nb_chambres, payload.bedrooms, payload.chambres) || countGroupsMatching(payload, /chambre/i);
    const beds = getNumber(payload.nb_lits, payload.beds, payload.couchages) || countBeds(payload);
    const bathrooms = getNumber(payload.nb_salles_de_bain, payload.bathrooms, payload.salles_de_bain) || countGroupsMatching(payload, /salle d('|e )?eau|salle de bain|douche/i);
    const surface = getNumber(payload.surface, payload.surface_m2, payload.superficie);
    const description = truncateText(getText(payload.public_description, payload.description_longue, payload.public_technical_description, payload.description_technique), 168);

    return {
      id: giteId,
      name: getText(payload.public_title, payload.nom, payload.name, metadata.name, giteId),
      eyebrow: getText(payload.public_subtitle, payload.subtitle, payload.accroche),
      description,
      photo: getPrimaryPhoto(payload),
      url: getText(metadata.pageUrl, metadata.url, payload.public_url, payload.url, payload.permalink, payload.link),
      stats: [
        capacity ? { icon: "people", label: "Capacité", value: `${capacity} pers.` } : null,
        bedrooms ? { icon: "bedrooms", label: "Chambres", value: String(bedrooms) } : null,
        beds ? { icon: "beds", label: "Lits", value: String(beds) } : null,
        bathrooms ? { icon: "bath", label: "Salles d'eau", value: String(bathrooms) } : null,
        surface ? { icon: "surface", label: "Surface", value: `${surface} m2` } : null,
      ].filter(Boolean),
    };
  };

  const renderPhoto = (gite, options) => {
    const media = createElement(gite.url ? "a" : "div", gite.url ? "booked-gite-cards__media booked-gite-cards__media--link" : "booked-gite-cards__media");
    if (!options.showImages) return media;
    if (gite.url) {
      media.href = gite.url;
      media.setAttribute("aria-label", `Voir ${gite.name}`);
    }

    if (gite.photo && gite.photo.url) {
      const image = createElement("img", "booked-gite-cards__image");
      image.src = gite.photo.url;
      image.alt = gite.photo.alt || "";
      image.loading = "lazy";
      media.appendChild(image);
      return media;
    }

    const placeholder = createElement("div", "booked-gite-cards__placeholder");
    placeholder.appendChild(createIcon("home"));
    placeholder.appendChild(createElement("span", "", gite.name));
    media.appendChild(placeholder);
    return media;
  };

  const renderStats = (stats) => {
    const table = createElement("table", "booked-gite-cards__stats");
    const body = createElement("tbody", "");
    stats.forEach((stat) => {
      const row = createElement("tr", "booked-gite-cards__stat-row");
      const iconCell = createElement("td", "booked-gite-cards__stat-icon");
      const labelCell = createElement("th", "booked-gite-cards__stat-label", stat.label);
      const valueCell = createElement("td", "booked-gite-cards__stat-value", stat.value);

      labelCell.scope = "row";
      iconCell.appendChild(createIcon(stat.icon));
      row.appendChild(iconCell);
      row.appendChild(labelCell);
      row.appendChild(valueCell);
      body.appendChild(row);
    });
    table.appendChild(body);
    return table;
  };

  const renderCard = (gite, options, index) => {
    const card = createElement("article", `booked-gite-cards__card${index === 0 ? " booked-gite-cards__card--first" : ""}`);
    if (options.showImages) {
      card.appendChild(renderPhoto(gite, options));
    }

    const body = createElement("div", "booked-gite-cards__body");
    if (options.layout !== "page-compact" && gite.eyebrow) {
      body.appendChild(createElement("p", "booked-gite-cards__eyebrow", gite.eyebrow));
    }
    if (options.layout !== "page-compact") {
      const title = createElement("h3", "booked-gite-cards__title");
      if (gite.url) {
        const titleLink = createElement("a", "booked-gite-cards__title-link", gite.name);
        titleLink.href = gite.url;
        title.appendChild(titleLink);
      } else {
        title.textContent = gite.name;
      }
      body.appendChild(title);
    }
    if (options.showDescription && gite.description) {
      body.appendChild(createElement("p", "booked-gite-cards__description", gite.description));
    }
    if (options.showStats && gite.stats.length > 0) {
      body.appendChild(renderStats(gite.stats));
    }
    if (options.showCta && gite.url) {
      const link = createElement("a", "booked-gite-cards__link", options.ctaLabel);
      link.href = gite.url;
      link.appendChild(createElement("span", "booked-gite-cards__link-arrow", "→"));
      body.appendChild(link);
    }
    card.appendChild(body);

    return card;
  };

  const renderContent = (root, gites, options) => {
    root.innerHTML = "";
    root.classList.toggle("booked-gite-cards--compact", options.layout === "compact");
    root.classList.toggle("booked-gite-cards--grid", options.layout === "grid");
    root.classList.toggle("booked-gite-cards--spotlight", options.layout === "spotlight");
    root.classList.toggle("booked-gite-cards--page-compact", options.layout === "page-compact");
    root.classList.toggle("booked-gite-cards--no-images", !options.showImages);
    root.style.setProperty("--booked-gite-cards-columns", String(options.columns));
    root.style.setProperty("--booked-gite-cards-ratio", options.imageRatioCss);

    if (gites.length === 0) {
      root.appendChild(createElement("div", "booked-gite-cards__empty", "Aucun gîte disponible."));
      return;
    }

    const grid = createElement("div", "booked-gite-cards__grid");
    gites.forEach((gite, index) => grid.appendChild(renderCard(gite, options, index)));
    root.appendChild(grid);
  };

  const getOptions = (root) => {
    const ratios = {
      "1-1": "1 / 1",
      "4-3": "4 / 3",
      "3-2": "3 / 2",
      "16-9": "16 / 9",
    };
    const columns = Number.parseInt(root.dataset.columns || "3", 10);
    const imageRatio = root.dataset.imageRatio || "4-3";
    const layout = ["grid", "compact", "spotlight", "page-compact"].includes(root.dataset.layout) ? root.dataset.layout : "grid";

    return {
      layout,
      columns: layout === "page-compact" ? 1 : Number.isFinite(columns) ? Math.max(1, Math.min(4, columns)) : 3,
      imageRatioCss: ratios[imageRatio] || ratios["4-3"],
      showImages: layout !== "page-compact" && root.dataset.showImages !== "0",
      showDescription: layout !== "page-compact" && root.dataset.showDescription !== "0",
      showStats: layout === "page-compact" || root.dataset.showStats !== "0",
      showCta: layout !== "page-compact" && root.dataset.showCta !== "0",
      ctaLabel: root.dataset.ctaLabel || "Voir le gîte",
    };
  };

  const renderGiteCards = async (root) => {
    const giteIds = parseJsonList(root.dataset.giteIds).map(String).filter(Boolean);
    const metadata = parseJsonList(root.dataset.gites).reduce((items, item) => {
      if (item && item.id) items[String(item.id)] = item;
      return items;
    }, {});
    const options = getOptions(root);

    if (giteIds.length === 0) {
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-gite-cards__empty", "Sélectionnez au moins un gîte."));
      return;
    }

    const cachedGites = giteIds.map((giteId) => {
      const cached = readCachedApi(getContentPath(giteId));
      return cached ? normalizeGite(giteId, cached, metadata[giteId] || {}) : null;
    }).filter(Boolean);

    if (cachedGites.length > 0) {
      renderContent(root, cachedGites, options);
    } else {
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-gite-cards__loading", "Chargement des gîtes..."));
    }

    try {
      const payloads = await Promise.all(giteIds.map((giteId) => fetchGiteContent(giteId).then((payload) => ({ giteId, payload }))));
      renderContent(root, payloads.map(({ giteId, payload }) => normalizeGite(giteId, payload, metadata[giteId] || {})), options);
    } catch (error) {
      if (cachedGites.length > 0) return;
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-widget--error", error.message || "Contenu indisponible."));
    }
  };

  window.BookedGiteCards = {
    render: renderGiteCards,
    initAll() {
      document.querySelectorAll(".booked-gite-cards[data-gite-ids]").forEach((root) => {
        if (root.dataset.bookedGiteCardsInitialized === "1") return;
        root.dataset.bookedGiteCardsInitialized = "1";
        void renderGiteCards(root);
      });
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    window.BookedGiteCards.initAll();
  });
})();
