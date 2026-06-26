(function () {
  const config = window.BookedWidgetConfig || {};
  const contentRequests = new Map();
  const CACHE_PREFIX = "booked:gite-info:v1:";
  const NO_SELECTION_ID = "__booked_no_selection__";
  const GENERAL_INFO_SECTION_ID = "__booked_general_info";
  const GENERAL_INFO_GROUP_ID = "__booked_general_info_details";

  const BED_LABELS = {
    single: "Lit 90",
    double: "Lit 140",
    queen: "Lit 160",
    king: "Lit 180",
    bunk: "Lits superposés",
    sofa_bed: "Canapé-lit",
    baby: "Lit bébé",
  };

  const BED_DIMENSIONS = {
    single: "90 x 190 cm",
    double: "140 x 190 cm",
    queen: "160 x 200 cm",
    king: "180 x 200 cm",
    bunk: "90 x 190 cm",
    sofa_bed: "140 x 190 cm",
    baby: "60 x 120 cm",
  };

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const getText = (value) => String(value || "").trim();

  const appendObfuscatedText = (element, value) => {
    const text = getText(value);
    element.setAttribute("aria-label", text);
    text.match(/.{1,3}/g).forEach((part) => {
      const span = createElement("span", "", part);
      span.setAttribute("aria-hidden", "true");
      element.appendChild(span);
    });
  };

  const getPathValue = (source, path) => {
    if (!source || typeof source !== "object") return "";

    return String(path || "").split(".").reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      if (Array.isArray(current)) {
        const index = Number.parseInt(key, 10);
        return Number.isFinite(index) ? current[index] : undefined;
      }
      return Object.prototype.hasOwnProperty.call(Object(current), key) ? current[key] : undefined;
    }, source);
  };

  const getFirstText = (source, paths) => {
    for (const path of paths) {
      const value = getPathValue(source, path);
      if (Array.isArray(value)) {
        const text = value.map(getText).filter(Boolean).join(", ");
        if (text) return text;
        continue;
      }
      const text = getText(value);
      if (text) return text;
    }
    return "";
  };

  const createMapsUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  const createInfoIcon = (name, className = "") => {
    const iconName = String(name || "info").replace(/[^a-z0-9_-]/gi, "");
    const svg = createSvgElement("svg", {
      class: ["booked-gite-info__info-icon", `booked-gite-info__info-icon--${iconName}`, className].filter(Boolean).join(" "),
      viewBox: "0 0 24 24",
      fill: "none",
      "aria-hidden": "true",
      focusable: "false",
    });
    const path = (d) => appendSvgShape(svg, "path", { d });
    const circle = (attributes) => appendSvgShape(svg, "circle", attributes);

    if (name === "address") {
      path("M12 21s7-5.1 7-11a7 7 0 0 0-14 0c0 5.9 7 11 7 11z");
      circle({ cx: "12", cy: "10", r: "2.4" });
    } else if (name === "price") {
      path("M15.5 7.5a4.8 4.8 0 1 0 0 9M6 10h8M6 14h8");
    } else if (name === "arrival") {
      path("M4 12h11M11 8l4 4-4 4M19 5v14");
    } else if (name === "departure") {
      path("M20 12H9M13 8l-4 4 4 4M5 5v14");
    } else if (name === "manager") {
      circle({ cx: "12", cy: "8", r: "3" });
      path("M5 20a7 7 0 0 1 14 0");
    } else if (name === "cleaning") {
      path("M6 19l8-8M12 7l5 5M4 21l4-4M15 4l5 5M14 5l5 5");
    } else if (name === "sheets") {
      path("M4 8h16v10H4zM4 11h16M8 8v3M16 8v3");
    } else if (name === "towels") {
      path("M7 4h9a3 3 0 0 1 0 6H7zM7 10h10v10H7zM10 14h4");
    } else if (name === "pets") {
      circle({ cx: "8", cy: "9", r: "1.5" });
      circle({ cx: "12", cy: "7", r: "1.5" });
      circle({ cx: "16", cy: "9", r: "1.5" });
      path("M7 17a5 5 0 0 1 10 0c0 2-2 3-5 3s-5-1-5-3z");
    } else if (name === "late-checkout") {
      circle({ cx: "12", cy: "12", r: "8" });
      path("M12 8v5l3 2");
    } else {
      circle({ cx: "12", cy: "12", r: "8" });
      path("M12 11v5M12 8h.01");
    }

    return svg;
  };

  const getManagerName = (payload) => {
    const firstName = getFirstText(payload, [
      "gestionnaire.prenom",
      "manager.prenom",
      "variables.gestionnaire_prenom",
      "variables.manager_prenom",
    ]);
    const lastName = getFirstText(payload, [
      "gestionnaire.nom",
      "manager.nom",
      "variables.gestionnaire_nom",
      "variables.manager_nom",
    ]);
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    return fullName || getFirstText(payload, [
      "gestionnaire.nom_complet",
      "gestionnaire.name",
      "manager.nom_complet",
      "manager.name",
      "variables.gestionnaire_nom_complet",
      "variables.manager_name",
    ]);
  };

  const getGeneralInfoRows = (payload) => {
    const rows = [];
    const address = getFirstText(payload, ["variables.adresse_complete", "adresse_complete"]);
    const managerName = getManagerName(payload);
    const managerPhone = getFirstText(payload, [
      "gestionnaire.telephone",
      "gestionnaire.tel",
      "gestionnaire.phone",
      "manager.telephone",
      "manager.tel",
      "manager.phone",
      "variables.gestionnaire_telephone",
      "variables.gestionnaire_tel",
      "variables.manager_telephone",
      "variables.manager_phone",
      "telephone_gestionnaire",
      "tel_gestionnaire",
    ]);

    [
      ["price-low", "Prix basse saison", "variables.prix_nuit_basse_saison"],
      ["price-high", "Prix haute saison", "variables.prix_nuit_haute_saison"],
    ].forEach(([id, label, path]) => {
      const value = getFirstText(payload, [path]);
      if (value) rows.push({ id, kind: "general_info", icon: "", label, value, emphasis: true });
    });

    if (address) {
      rows.push({ id: "address", kind: "general_info", icon: "address", label: "Adresse", value: address, href: createMapsUrl(address) });
    }

    [
      ["arrival", "Arrivée", "variables.horaire_arrivee", "arrival"],
      ["departure", "Départ", "variables.horaire_depart", "departure"],
    ].forEach(([id, label, path, icon]) => {
      const value = getFirstText(payload, [path]);
      if (value) rows.push({ id, kind: "general_info", icon, label, value });
    });

    if (managerName || managerPhone) {
      rows.push({
        id: "manager",
        kind: "general_info",
        icon: "manager",
        label: "Gestionnaire",
        value: [managerName, managerPhone].filter(Boolean).join(" - "),
        obfuscate: Boolean(managerPhone),
      });
    }

    const options = [];
    [
      ["Ménage", "variables.service_menage_forfait", "cleaning"],
      ["Draps", "variables.service_draps_par_lit", "sheets"],
      ["Linge de toilette", "variables.service_linge_toilette_par_personne", "towels"],
      ["Chiens", "variables.service_chiens_par_nuit", "pets"],
      ["Départ tardif", "variables.service_depart_tardif_forfait", "late-checkout"],
    ].forEach(([label, path, icon]) => {
      const value = getFirstText(payload, [path]);
      if (value) options.push({ icon, label, value });
    });
    if (options.length > 0) {
      rows.push({ id: "options", kind: "general_options", label: "Options", options });
    }

    return rows;
  };

  const createGeneralInfoSection = (payload, selectedItemIds = []) => {
    if (selectedItemIds.includes(NO_SELECTION_ID)) return null;

    const itemFilter = new Set(selectedItemIds);
    const rows = getGeneralInfoRows(payload).filter((row) => itemFilter.size === 0 || itemFilter.has(String(row.id || "")));
    if (rows.length === 0) return null;

    return {
      id: GENERAL_INFO_SECTION_ID,
      titre: "Informations générales",
      groupes: [
        {
          id: GENERAL_INFO_GROUP_ID,
          titre: "Coordonnées et tarifs",
          items: rows,
        },
      ],
    };
  };

  const createSvgElement = (tag, attributes = {}) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  };

  const appendSvgShape = (svg, tag, attributes) => {
    svg.appendChild(createSvgElement(tag, attributes));
  };

  const parseList = (value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
    } catch {
      return String(value).split(",").map((item) => item.trim()).filter(Boolean);
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

  const formatItem = (item) => {
    if (item && typeof item === "object" && !Array.isArray(item) && item.kind === "general_info") {
      const label = getText(item.label);
      const value = getText(item.value);
      if (!label || !value) return null;
      return {
        kind: "general-info",
        icon: getText(item.icon),
        label,
        value,
        href: getText(item.href),
        obfuscate: Boolean(item.obfuscate),
        emphasis: Boolean(item.emphasis),
      };
    }

    if (item && typeof item === "object" && !Array.isArray(item) && item.kind === "general_options") {
      const options = (Array.isArray(item.options) ? item.options : []).map((option) => ({
        icon: getText(option.icon),
        label: getText(option.label),
        value: getText(option.value),
      })).filter((option) => option.label && option.value);

      return options.length > 0 ? {
        kind: "general-options",
        label: getText(item.label) || "Options",
        options,
      } : null;
    }

    if (!item || typeof item !== "object" || Array.isArray(item) || item.kind !== "bed") {
      const label = String(item || "").trim();
      return label ? { kind: "text", label, type: "" } : null;
    }
    const count = Number.isFinite(Number(item.count)) ? Math.max(1, Math.round(Number(item.count))) : 1;
    const label = BED_LABELS[item.type] || "Lit";
    return {
      kind: "bed",
      label: count > 1 ? `${count} x ${label}` : label,
      dimensions: BED_DIMENSIONS[item.type] || "",
      type: String(item.type || "bed"),
    };
  };

  const createBedIcon = (type) => {
    const iconType = ["single", "double", "queen", "king", "bunk", "sofa_bed", "baby"].includes(type) ? type : "bed";
    const svg = createSvgElement("svg", {
      class: `booked-gite-info__bed-icon booked-gite-info__bed-icon--${iconType}`,
      viewBox: "0 0 24 24",
      fill: "none",
      "aria-hidden": "true",
      focusable: "false",
    });

    if (iconType === "bunk") {
      appendSvgShape(svg, "path", { d: "M5 4v16M19 4v16M7 6h10v4H7zM7 14h10v4H7zM5 11h14M5 19h14" });
    } else if (iconType === "sofa_bed") {
      appendSvgShape(svg, "path", { d: "M6 10V8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2M5 11h14a2 2 0 0 1 2 2v5H3v-5a2 2 0 0 1 2-2zM7 18v2M17 18v2" });
    } else if (iconType === "baby") {
      appendSvgShape(svg, "path", { d: "M5 8h14v8H5zM5 8V6M19 8V6M8 16v3M16 16v3M8 11h8M11 8v8" });
    } else {
      appendSvgShape(svg, "path", { d: "M4 11V7a2 2 0 0 1 2-2h5v6M4 11h16a2 2 0 0 1 2 2v5H4zM4 18v2M20 18v2" });
      appendSvgShape(svg, "path", { d: iconType === "single" ? "M7 8h3v3H7z" : "M7 8h3v3H7zM12 8h5v3h-5z" });
    }

    return svg;
  };

  const getFilteredSections = (payload, selectedSectionIds, selectedGroupIds, selectedGeneralInfoItemIds) => {
    const generalInfoSection = createGeneralInfoSection(payload, selectedGeneralInfoItemIds);
    const sectionFilter = new Set(selectedSectionIds.filter((id) => id !== NO_SELECTION_ID));
    const groupFilter = new Set(selectedGroupIds);
    const shouldHideContentSections = selectedSectionIds.includes(NO_SELECTION_ID);
    const shouldFilterSections = !shouldHideContentSections && sectionFilter.size > 0;
    const shouldFilterGroups = groupFilter.size > 0;
    const sections = Array.isArray(payload.sections) ? payload.sections : [];
    const filteredSections = shouldHideContentSections
      ? []
      : sections
        .filter((section) => !shouldFilterSections || sectionFilter.has(String(section.id || "")))
        .map((section) => ({
          ...section,
          groupes: (Array.isArray(section.groupes) ? section.groupes : []).filter(
            (group) => !shouldFilterGroups || groupFilter.has(String(group.id || ""))
          ),
        }))
        .filter((section) => section.groupes.length > 0);

    return generalInfoSection ? [generalInfoSection, ...filteredSections] : filteredSections;
  };

  const renderItems = (items) => {
    const list = createElement("ul", "booked-gite-info__items");
    (Array.isArray(items) ? items : []).map(formatItem).filter(Boolean).forEach((item) => {
      const kind = item.kind || (item.type ? "bed" : "text");
      const itemElement = createElement("li", `booked-gite-info__item booked-gite-info__item--${kind}`);
      if (item.emphasis) {
        itemElement.classList.add("booked-gite-info__item--emphasis");
      }
      if (kind === "bed") {
        itemElement.appendChild(createBedIcon(item.type));
      } else if (kind === "general-info") {
        if (item.icon) {
          itemElement.appendChild(createInfoIcon(item.icon));
        }
        itemElement.appendChild(createElement("span", "booked-gite-info__item-label", item.label));
        const valueElement = item.href && !item.obfuscate
          ? createElement("a", "booked-gite-info__item-value", item.value)
          : createElement("span", "booked-gite-info__item-value", item.obfuscate ? undefined : item.value);
        if (item.href) {
          valueElement.href = item.href;
          valueElement.target = "_blank";
          valueElement.rel = "noopener noreferrer";
        }
        if (item.obfuscate) {
          valueElement.classList.add("booked-gite-info__item-value--obfuscated");
          appendObfuscatedText(valueElement, item.value);
        }
        itemElement.appendChild(valueElement);
        list.appendChild(itemElement);
        return;
      } else if (kind === "general-options") {
        const valueElement = createElement("span", "booked-gite-info__options");
        item.options.forEach((option) => {
          const optionElement = createElement("span", "booked-gite-info__option");
          optionElement.appendChild(createInfoIcon(option.icon || "info", "booked-gite-info__option-icon"));
          optionElement.appendChild(createElement("span", "booked-gite-info__option-label", option.label));
          optionElement.appendChild(createElement("span", "booked-gite-info__option-value", option.value));
          valueElement.appendChild(optionElement);
        });
        itemElement.appendChild(valueElement);
        list.appendChild(itemElement);
        return;
      }
      itemElement.appendChild(createElement("span", "booked-gite-info__item-label", item.label));
      if (item.dimensions) {
        itemElement.appendChild(createElement("span", "booked-gite-info__item-dimensions", `(${item.dimensions})`));
      }
      list.appendChild(itemElement);
    });
    return list;
  };

  const renderGroupContent = (group, showNotes) => {
    const content = createElement("div", "booked-gite-info__group-content");
    content.appendChild(renderItems(group.items));
    if (showNotes && group.note) {
      content.appendChild(createElement("p", "booked-gite-info__note", group.note));
    }
    return content;
  };

  const renderList = (sections, options) => {
    const wrapper = createElement("div", "booked-gite-info__layout booked-gite-info__layout--list");
    sections.forEach((section) => {
      const sectionElement = createElement("section", "booked-gite-info__section");
      if (options.showSectionTitles) {
        sectionElement.appendChild(createElement("h2", "booked-gite-info__section-title", section.titre || "Infos"));
      }
      section.groupes.forEach((group) => {
        const groupElement = createElement("article", "booked-gite-info__group");
        if (options.showGroupTitles) {
          groupElement.appendChild(createElement("h3", "booked-gite-info__group-title", group.titre || "Rubrique"));
        }
        groupElement.appendChild(renderGroupContent(group, options.showNotes));
        sectionElement.appendChild(groupElement);
      });
      wrapper.appendChild(sectionElement);
    });
    return wrapper;
  };

  const renderAccordion = (sections, options) => {
    const wrapper = createElement("div", "booked-gite-info__layout booked-gite-info__layout--accordion booked-accordion booked-accordion--gite-info");
    wrapper.dataset.bookedAccordionSingle = "1";
    let isFirstGroup = true;

    sections.forEach((section) => {
      if (options.showSectionTitles) {
        wrapper.appendChild(createElement("h2", "booked-gite-info__section-title", section.titre || "Infos"));
      }
      section.groupes.forEach((group) => {
        const details = createElement("details", "booked-gite-info__details booked-accordion__details");
        const panel = createElement("div", "booked-gite-info__panel booked-accordion__panel");
        const summary = createElement("summary", "booked-gite-info__summary booked-accordion__summary", group.titre || "Rubrique");

        panel.appendChild(renderGroupContent(group, options.showNotes));
        details.appendChild(summary);
        details.appendChild(panel);
        if (isFirstGroup) {
          details.open = true;
          details.classList.add("booked-gite-info__details--open", "booked-accordion__details--open");
          isFirstGroup = false;
        }
        wrapper.appendChild(details);
      });
    });
    if (window.BookedAccordion) window.BookedAccordion.init(wrapper);
    return wrapper;
  };

  const renderCards = (sections, options) => {
    const wrapper = createElement("div", "booked-gite-info__layout booked-gite-info__layout--cards");
    wrapper.style.setProperty("--booked-card-columns", String(options.cardColumns));
    sections.forEach((section) => {
      if (options.showSectionTitles) {
        const title = createElement("h2", "booked-gite-info__section-title booked-gite-info__section-title--cards", section.titre || "Infos");
        wrapper.appendChild(title);
      }
      const grid = createElement("div", "booked-gite-info__cards");
      section.groupes.forEach((group) => {
        const card = createElement("article", "booked-gite-info__card");
        if (options.showGroupTitles) {
          card.appendChild(createElement("h3", "booked-gite-info__group-title", group.titre || "Rubrique"));
        }
        card.appendChild(renderGroupContent(group, options.showNotes));
        grid.appendChild(card);
      });
      wrapper.appendChild(grid);
    });
    return wrapper;
  };

  const renderTechnicalDescription = (payload) => {
    const text = getText(payload.public_technical_description || payload.description_technique);
    if (!text) return null;

    const wrapper = createElement("div", "booked-gite-info__technical-description");
    text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean).forEach((paragraph) => {
      wrapper.appendChild(createElement("p", "", paragraph.replace(/\s*\n\s*/g, " ")));
    });
    return wrapper;
  };

  const renderContent = (root, payload) => {
    const selectedSectionIds = parseList(root.dataset.selectedSectionIds);
    const selectedGroupIds = parseList(root.dataset.selectedGroupIds);
    const selectedGeneralInfoItemIds = parseList(root.dataset.selectedGeneralInfoItemIds);
    const layout = ["list", "accordion", "cards"].includes(root.dataset.layout) ? root.dataset.layout : "list";
    const cardColumns = Number.parseInt(root.dataset.cardColumns || "3", 10);
    const options = {
      showTitle: root.dataset.showTitle !== "0",
      showSectionTitles: root.dataset.showSectionTitles !== "0",
      showGroupTitles: root.dataset.showGroupTitles !== "0",
      showNotes: root.dataset.showNotes !== "0",
      cardColumns: Number.isFinite(cardColumns) ? Math.max(1, Math.min(4, cardColumns)) : 3,
    };
    const sections = getFilteredSections(payload, selectedSectionIds, selectedGroupIds, selectedGeneralInfoItemIds);

    root.innerHTML = "";
    if (options.showTitle) {
      root.appendChild(createElement("h1", "booked-gite-info__title", payload.public_title || payload.nom || "Infos du gîte"));
    }
    const technicalDescription = renderTechnicalDescription(payload);
    if (technicalDescription) {
      root.appendChild(technicalDescription);
    }
    if (sections.length === 0 && !technicalDescription) {
      root.appendChild(createElement("div", "booked-gite-info__empty", "Aucune information disponible."));
      return;
    }
    if (sections.length > 0) {
      root.appendChild(layout === "accordion" ? renderAccordion(sections, options) : layout === "cards" ? renderCards(sections, options) : renderList(sections, options));
    }
  };

  const renderGiteInfo = async (root) => {
    const giteId = root.dataset.giteId;
    if (!giteId) {
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-gite-info__empty", "Sélectionnez un gîte."));
      return;
    }

    const cachedPayload = readCachedApi(getContentPath(giteId));
    if (cachedPayload) {
      renderContent(root, cachedPayload);
    } else {
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-gite-info__loading", "Chargement..."));
    }

    try {
      const payload = await fetchGiteContent(giteId);
      renderContent(root, payload);
    } catch (error) {
      if (cachedPayload) return;
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-widget--error", error.message || "Contenu indisponible."));
    }
  };

  window.BookedGiteInfo = {
    render: renderGiteInfo,
    initAll() {
      document.querySelectorAll(".booked-gite-info[data-gite-id]").forEach((root) => {
        if (root.dataset.bookedInfoInitialized === "1") return;
        root.dataset.bookedInfoInitialized = "1";
        void renderGiteInfo(root);
      });
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    window.BookedGiteInfo.initAll();
  });
})();
