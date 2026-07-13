(function () {
  const config = window.BookedWidgetConfig || {};
  const contentRequests = new Map();
  const CACHE_PREFIX = "booked:gite-cards:v2:";

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
    } else if (type === "sleeping") {
      appendSvgShape(svg, "path", { d: "M4 11V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" });
      appendSvgShape(svg, "path", { d: "M4 11h16a2 2 0 0 1 2 2v5H2v-5a2 2 0 0 1 2-2zM5 18v2M19 18v2" });
      appendSvgShape(svg, "path", { d: "M7 8h4v3H7zM13 8h4v3h-4z" });
    } else if (type === "bath") {
      appendSvgShape(svg, "path", { d: "M6 11V6a3 3 0 0 1 6 0" });
      appendSvgShape(svg, "path", { d: "M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM7 20l-1 2M18 20l1 2" });
    } else if (type === "surface") {
      appendSvgShape(svg, "path", { d: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" });
      appendSvgShape(svg, "path", { d: "M8 8h8v8H8z" });
    } else if (type === "fireplace") {
      appendSvgShape(svg, "path", { d: "M5 19h14M7 19v-6a5 5 0 0 1 10 0v6" });
      appendSvgShape(svg, "path", { d: "M12 16c2-1.5 3-3.2 1-6-1.5 1-2 2.2-1.8 3.4C10.1 12.7 9.5 11.6 9.5 10c-2 2.5-1.2 5.1 2.5 6z" });
    } else if (type === "garden") {
      appendSvgShape(svg, "path", { d: "M12 21V9" });
      appendSvgShape(svg, "path", { d: "M12 9C8 9 6 7 5 3c4 0 6 2 7 6zM12 11c4 0 6-2 7-6-4 0-6 2-7 6z" });
      appendSvgShape(svg, "path", { d: "M5 21h14" });
    } else if (type === "courtyard") {
      appendSvgShape(svg, "path", { d: "M4 20V9l8-5 8 5v11" });
      appendSvgShape(svg, "path", { d: "M8 20v-6h8v6M4 12h16" });
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

  const parseJsonObject = (value) => {
    try {
      const parsed = JSON.parse(value || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
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

  const getObject = (...values) => {
    for (const value of values) {
      if (value && typeof value === "object" && !Array.isArray(value)) return value;
    }
    return {};
  };

  const getBoolean = (...values) => {
    for (const value of values) {
      if (value === true) return true;
      if (typeof value === "string" && /^(1|true|oui|yes)$/i.test(value.trim())) return true;
      if (value === 1) return true;
    }
    return false;
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
    const webInfo = getObject(payload.public_web_info, payload.web_info, payload.informations_web);
    const capacity = getNumber(webInfo.max_people, webInfo.nombre_personnes_maximum, webInfo.capacite_max, payload.capacite_max, payload.capacity, payload.capacite, metadata.capacity);
    const bedrooms = getNumber(payload.nb_chambres, payload.bedrooms, payload.chambres) || countGroupsMatching(payload, /chambre/i);
    const beds = getNumber(payload.nb_lits, payload.beds, payload.couchages) || countBeds(payload);
    const sleepingCapacity = getNumber(webInfo.sleeping_capacity, webInfo.nombre_couchages, webInfo.couchages, payload.nb_couchages) || beds;
    const bathrooms = getNumber(payload.nb_salles_de_bain, payload.bathrooms, payload.salles_de_bain) || countGroupsMatching(payload, /salle d('|e )?eau|salle de bain|douche/i);
    const surface = getNumber(webInfo.surface_m2, webInfo.surface, payload.surface, payload.surface_m2, payload.superficie);
    const fireplace = getBoolean(webInfo.fireplace, webInfo.cheminee, payload.cheminee);
    const privateGarden = getBoolean(webInfo.private_garden, webInfo.jardin_prive, payload.jardin_prive);
    const privateCourtyard = getBoolean(webInfo.private_courtyard, webInfo.cour_privee, payload.cour_privee);
    const description = truncateText(getText(payload.public_description, payload.description_longue, payload.public_technical_description, payload.description_technique), 168);

    return {
      id: giteId,
      name: getText(payload.public_title, payload.nom, payload.name, metadata.name, giteId),
      eyebrow: getText(payload.public_subtitle, payload.subtitle, payload.accroche),
      description,
      photo: getPrimaryPhoto(payload),
      url: getText(metadata.pageUrl, metadata.url, payload.public_url, payload.url, payload.permalink, payload.link),
      stats: [
        surface ? { icon: "surface", label: "Surface", value: `${surface} m2` } : null,
        capacity ? { icon: "people", label: "Capacité", value: `${capacity} pers.` } : null,
        sleepingCapacity ? { icon: "sleeping", label: "Couchages", value: String(sleepingCapacity) } : null,
        fireplace ? { icon: "fireplace", label: "Cheminée", value: "Oui" } : null,
        privateGarden ? { icon: "garden", label: "Jardin privé", value: "Oui" } : null,
        privateCourtyard ? { icon: "courtyard", label: "Cour privée", value: "Oui" } : null,
        bedrooms ? { icon: "bedrooms", label: "Chambres", value: String(bedrooms) } : null,
        bathrooms ? { icon: "bath", label: "Salles d'eau", value: String(bathrooms) } : null,
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
      const labelCell = createElement("th", "booked-gite-cards__stat-label", `${stat.label} :`);
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

  const getPolaroidRotation = (giteId, index) => {
    const rotationSequence = [-2.8, 1.9, -1.4, 2.7, -2.1, 1.2, 3.1, -0.9, -3.3, 2.2, -1.8, 0.8];
    const seed = `${giteId || ""}-${index}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    const rotation = rotationSequence[index % rotationSequence.length] + (((Math.abs(hash) % 9) - 4) / 10);
    return `${rotation.toFixed(1)}deg`;
  };

  const renderPolaroidStats = (stats) => {
    const list = createElement("dl", "booked-gite-cards__polaroid-stats");
    stats.slice(0, 4).forEach((stat) => {
      const item = createElement("div", "booked-gite-cards__polaroid-stat");
      const label = createElement("dt", "booked-gite-cards__polaroid-stat-label");
      const value = createElement("dd", "booked-gite-cards__polaroid-stat-value", stat.value);

      label.appendChild(createIcon(stat.icon));
      label.appendChild(createElement("span", "", stat.label));
      item.appendChild(label);
      item.appendChild(value);
      list.appendChild(item);
    });
    return list;
  };

  const woodFrameFiles = {
    rustic: "cadre-bois-rustique.png",
    dark: "cadre-bois-rustique-sombre.png",
    patina: "cadre-bois-rustique-patine.png",
    ornate: "cadre-bois-orne.png",
    ancient: "cadre-bois-ancien.png",
    baroque: "cadre-baroque-bronze.png",
    oval: "cadre-bois-ovale.png",
    gold: "cadre-dore-ancien.png",
    polaroid: "cadre-polaroid.png",
  };

  const renderWoodFrame = (gite, options, index) => {
    const sequence = ["rustic", "dark", "patina", "ornate", "ancient", "baroque", "oval", "gold", "polaroid"];
    const requestedFrame = options.woodFrameAssignments[gite.id];
    const frame = woodFrameFiles[requestedFrame] ? requestedFrame : sequence[index % sequence.length];
    const composition = createElement(gite.url ? "a" : "div", `booked-gite-cards__wood-frame booked-gite-cards__wood-frame--${frame}`);
    const content = createElement("div", "booked-gite-cards__wood-content");
    const media = renderPhoto({ ...gite, url: "" }, { ...options, showImages: true });
    const details = createElement("div", "booked-gite-cards__wood-details");
    const overlay = createElement("span", "booked-gite-cards__wood-frame-image");
    const plaque = createElement("div", "booked-cartel booked-gite-cards__wood-plaque");
    const plaqueText = createElement("span", "booked-cartel__text booked-gite-cards__wood-plaque-text", gite.name);
    const baseUrl = String(config.woodFrameBaseUrl || "").replace(/\/?$/, "/");

    composition.style.setProperty("--booked-wood-frame-rotation", getPolaroidRotation(gite.id, index));

    if (gite.url) {
      composition.href = gite.url;
      composition.setAttribute("aria-label", `Voir ${gite.name}`);
    }
    if (gite.stats.length > 0) details.appendChild(renderPolaroidStats(gite.stats));
    media.classList.add("booked-gite-cards__wood-photo");
    overlay.style.backgroundImage = `url("${baseUrl}${woodFrameFiles[frame]}")`;
    plaque.appendChild(plaqueText);
    content.appendChild(media);
    content.appendChild(details);
    composition.appendChild(content);
    composition.appendChild(overlay);
    composition.appendChild(plaque);
    return composition;
  };

  const updateStatsLineState = (statsElement) => {
    const rows = Array.from(statsElement.querySelectorAll(".booked-gite-cards__stat-row"));
    if (rows.length === 0) return;

    const firstTop = rows[0].offsetTop;
    const isSingleLine = rows.every((row) => Math.abs(row.offsetTop - firstTop) < 2);
    statsElement.classList.toggle("booked-gite-cards__stats--single-line", isSingleLine);
    statsElement.classList.toggle("booked-gite-cards__stats--multi-line", !isSingleLine);
  };

  const updateStatsLineStates = (root = document) => {
    root.querySelectorAll(".booked-gite-cards__stats").forEach(updateStatsLineState);
  };

  let statsLineUpdateFrame = 0;
  const scheduleStatsLineStateUpdate = (root = document) => {
    window.cancelAnimationFrame(statsLineUpdateFrame);
    statsLineUpdateFrame = window.requestAnimationFrame(() => updateStatsLineStates(root));
  };

  const renderCard = (gite, options, index) => {
    const card = createElement("article", `booked-gite-cards__card${index === 0 ? " booked-gite-cards__card--first" : ""}`);
    if (options.layout === "wood-frames") {
      card.appendChild(renderWoodFrame(gite, options, index));
      return card;
    }
    if (options.layout === "polaroid") {
      card.style.setProperty("--booked-polaroid-rotation", getPolaroidRotation(gite.id, index));
      const polaroid = createElement("div", "booked-gite-cards__polaroid");
      const media = renderPhoto(gite, { ...options, showImages: true });
      media.classList.add("booked-gite-cards__polaroid-photo");

      const band = createElement("div", "booked-gite-cards__polaroid-band");
      const bandTitle = createElement("h3", "booked-gite-cards__polaroid-band-title", gite.name);
      const bandText = createElement("p", "booked-gite-cards__polaroid-band-text", gite.description || gite.eyebrow || "");
      const info = createElement("div", "booked-gite-cards__polaroid-info");

      if (gite.url) {
        const titleLink = createElement("a", "booked-gite-cards__title-link", gite.name);
        titleLink.href = gite.url;
        bandTitle.textContent = "";
        bandTitle.appendChild(titleLink);
      }
      band.appendChild(bandTitle);
      if (bandText.textContent) {
        band.appendChild(bandText);
      }
      if (gite.stats.length > 0) {
        info.appendChild(renderPolaroidStats(gite.stats));
      }

      polaroid.appendChild(media);
      polaroid.appendChild(band);
      polaroid.appendChild(info);
      polaroid.appendChild(createElement("span", "booked-gite-cards__polaroid-frame"));
      card.appendChild(polaroid);

      return card;
    }

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
    root.classList.toggle("booked-gite-cards--polaroid", options.layout === "polaroid");
    root.classList.toggle("booked-gite-cards--wood-frames", options.layout === "wood-frames");
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
    scheduleStatsLineStateUpdate(root);
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
    const layout = ["grid", "compact", "spotlight", "page-compact", "polaroid", "wood-frames"].includes(root.dataset.layout) ? root.dataset.layout : "grid";
    const isComposedLayout = layout === "polaroid" || layout === "wood-frames";

    return {
      layout,
      columns: layout === "page-compact" ? 1 : Number.isFinite(columns) ? Math.max(1, Math.min(4, columns)) : 3,
      imageRatioCss: ratios[imageRatio] || ratios["4-3"],
      showImages: isComposedLayout || (layout !== "page-compact" && root.dataset.showImages !== "0"),
      showDescription: isComposedLayout || (layout !== "page-compact" && root.dataset.showDescription !== "0"),
      showStats: layout === "page-compact" || isComposedLayout || root.dataset.showStats !== "0",
      showCta: layout !== "page-compact" && !isComposedLayout && root.dataset.showCta !== "0",
      ctaLabel: root.dataset.ctaLabel || "Voir le gîte",
      woodFrameAssignments: parseJsonObject(root.dataset.woodFrameAssignments),
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

  window.addEventListener("resize", () => scheduleStatsLineStateUpdate());
})();
