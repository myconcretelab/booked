(function () {
  const config = window.BookedWidgetConfig || {};

  const BED_LABELS = {
    single: "Lit 90",
    double: "Lit 140",
    queen: "Lit 160",
    king: "Lit 180",
    bunk: "Lits superposés",
    sofa_bed: "Canapé-lit",
    baby: "Lit bébé",
  };

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
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

  const apiFetch = async (path) => {
    const response = await fetch(buildApiUrl(path), {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Contenu Booked indisponible.");
    }
    return payload;
  };

  const formatItem = (item) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || item.kind !== "bed") {
      return String(item || "").trim();
    }
    const count = Number.isFinite(Number(item.count)) ? Math.max(1, Math.round(Number(item.count))) : 1;
    const label = BED_LABELS[item.type] || "Lit";
    return count > 1 ? `${count} x ${label}` : label;
  };

  const getFilteredSections = (payload, selectedSectionIds, selectedGroupIds) => {
    const sectionFilter = new Set(selectedSectionIds);
    const groupFilter = new Set(selectedGroupIds);
    const shouldFilterSections = sectionFilter.size > 0;
    const shouldFilterGroups = groupFilter.size > 0;
    const sections = Array.isArray(payload.sections) ? payload.sections : [];

    return sections
      .filter((section) => !shouldFilterSections || sectionFilter.has(String(section.id || "")))
      .map((section) => ({
        ...section,
        groupes: (Array.isArray(section.groupes) ? section.groupes : []).filter(
          (group) => !shouldFilterGroups || groupFilter.has(String(group.id || ""))
        ),
      }))
      .filter((section) => section.groupes.length > 0);
  };

  const renderItems = (items) => {
    const list = createElement("ul", "booked-gite-info__items");
    (Array.isArray(items) ? items : []).map(formatItem).filter(Boolean).forEach((item) => {
      list.appendChild(createElement("li", "booked-gite-info__item", item));
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
        sectionElement.appendChild(createElement("h3", "booked-gite-info__section-title", section.titre || "Infos"));
      }
      section.groupes.forEach((group) => {
        const groupElement = createElement("article", "booked-gite-info__group");
        groupElement.appendChild(createElement("h4", "booked-gite-info__group-title", group.titre || "Rubrique"));
        groupElement.appendChild(renderGroupContent(group, options.showNotes));
        sectionElement.appendChild(groupElement);
      });
      wrapper.appendChild(sectionElement);
    });
    return wrapper;
  };

  const renderAccordion = (sections, options) => {
    const wrapper = createElement("div", "booked-gite-info__layout booked-gite-info__layout--accordion");
    sections.forEach((section) => {
      if (options.showSectionTitles) {
        wrapper.appendChild(createElement("h3", "booked-gite-info__section-title", section.titre || "Infos"));
      }
      section.groupes.forEach((group, index) => {
        const details = createElement("details", "booked-gite-info__details");
        if (index === 0) details.open = true;
        details.appendChild(createElement("summary", "booked-gite-info__summary", group.titre || "Rubrique"));
        details.appendChild(renderGroupContent(group, options.showNotes));
        wrapper.appendChild(details);
      });
    });
    return wrapper;
  };

  const renderCards = (sections, options) => {
    const wrapper = createElement("div", "booked-gite-info__layout booked-gite-info__layout--cards");
    sections.forEach((section) => {
      if (options.showSectionTitles) {
        const title = createElement("h3", "booked-gite-info__section-title booked-gite-info__section-title--cards", section.titre || "Infos");
        wrapper.appendChild(title);
      }
      const grid = createElement("div", "booked-gite-info__cards");
      section.groupes.forEach((group) => {
        const card = createElement("article", "booked-gite-info__card");
        card.appendChild(createElement("h4", "booked-gite-info__group-title", group.titre || "Rubrique"));
        card.appendChild(renderGroupContent(group, options.showNotes));
        grid.appendChild(card);
      });
      wrapper.appendChild(grid);
    });
    return wrapper;
  };

  const renderContent = (root, payload) => {
    const selectedSectionIds = parseList(root.dataset.selectedSectionIds);
    const selectedGroupIds = parseList(root.dataset.selectedGroupIds);
    const layout = ["list", "accordion", "cards"].includes(root.dataset.layout) ? root.dataset.layout : "list";
    const options = {
      showTitle: root.dataset.showTitle !== "0",
      showSectionTitles: root.dataset.showSectionTitles !== "0",
      showNotes: root.dataset.showNotes !== "0",
    };
    const sections = getFilteredSections(payload, selectedSectionIds, selectedGroupIds);

    root.innerHTML = "";
    if (options.showTitle) {
      root.appendChild(createElement("h2", "booked-gite-info__title", payload.public_title || payload.nom || "Infos du gîte"));
    }
    if (sections.length === 0) {
      root.appendChild(createElement("div", "booked-gite-info__empty", "Aucune information disponible."));
      return;
    }
    root.appendChild(layout === "accordion" ? renderAccordion(sections, options) : layout === "cards" ? renderCards(sections, options) : renderList(sections, options));
  };

  const renderGiteInfo = async (root) => {
    const giteId = root.dataset.giteId;
    if (!giteId) {
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-gite-info__empty", "Sélectionnez un gîte."));
      return;
    }

    root.innerHTML = "";
    root.appendChild(createElement("div", "booked-gite-info__loading", "Chargement..."));
    try {
      const payload = await apiFetch(`/gites/${encodeURIComponent(giteId)}/content`);
      renderContent(root, payload);
    } catch (error) {
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
