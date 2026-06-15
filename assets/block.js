(function (wp) {
  const { createBlock, registerBlockType } = wp.blocks;
  const { BlockControls, InnerBlocks, InspectorControls, RichText, useBlockProps } = wp.blockEditor;
  const { Button, CheckboxControl, DropdownMenu, Notice, PanelBody, RangeControl, SelectControl, Spinner, TextControl, ToggleControl, ToolbarGroup } = wp.components;
  const { createElement: el, Fragment, useEffect, useRef, useState } = wp.element;
  const { __, sprintf } = wp.i18n;
  const apiFetch = wp.apiFetch;
  const EDITOR_CACHE_PREFIX = "booked:block-api:v1:";
  const NO_SELECTION_ID = "__booked_no_selection__";
  const DEFAULT_GITE_META_KEY = "_booked_default_gite_id";
  const DEFAULT_PERIOD_COLORS = {
    holidayColor: "#22c55e",
    bridgeColor: "#f97316",
    summerColor: "#0ea5e9",
  };
  const HEADING_STYLES = [
    "line-ticks",
    "long-lines",
    "short-lines",
    "double-lines",
    "split-line",
    "corner-lines",
    "brackets",
    "underline",
    "overline",
    "marker",
    "ribbon",
    "boxed",
    "plain",
  ];

  const getHeadingStyleOptions = () => [
    { label: __("Traits avec repères", "booked"), value: "line-ticks" },
    { label: __("Longs traits", "booked"), value: "long-lines" },
    { label: __("Traits courts", "booked"), value: "short-lines" },
    { label: __("Double trait", "booked"), value: "double-lines" },
    { label: __("Trait séparé", "booked"), value: "split-line" },
    { label: __("Coins", "booked"), value: "corner-lines" },
    { label: __("Crochets", "booked"), value: "brackets" },
    { label: __("Souligné", "booked"), value: "underline" },
    { label: __("Surligné", "booked"), value: "overline" },
    { label: __("Marqueur", "booked"), value: "marker" },
    { label: __("Ruban", "booked"), value: "ribbon" },
    { label: __("Encadré", "booked"), value: "boxed" },
    { label: __("Simple", "booked"), value: "plain" },
  ];

  const getHeadingTagName = (level) => `h${[2, 3, 4].includes(Number(level)) ? Number(level) : 2}`;
  const getHeadingStyle = (style) => (HEADING_STYLES.includes(style) ? style : "line-ticks");
  const getHeadingTextAlign = (textAlign) => (["left", "center", "right"].includes(textAlign) ? textAlign : "center");
  const getHeadingClassName = (attributes) =>
    `booked-heading booked-heading--${getHeadingStyle(attributes.style)} booked-heading--align-${getHeadingTextAlign(attributes.textAlign)}`;

  const normalizeGites = (payload) => {
    const items = payload && Array.isArray(payload.gites) ? payload.gites : [];
    return items.map((item) => ({
      id: String(item.id || ""),
      name: item.name || item.nom || item.id,
      capacity: item.capacity || item.capacite_max || null,
      prefix: item.prefix || item.prefixe || "",
    })).filter((item) => item.id);
  };

  const readCachedEditorApi = (path) => {
    try {
      const cached = window.localStorage.getItem(`${EDITOR_CACHE_PREFIX}${path}`);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      return parsed && Object.prototype.hasOwnProperty.call(parsed, "data") ? parsed.data : null;
    } catch {
      return null;
    }
  };

  const writeCachedEditorApi = (path, data) => {
    try {
      window.localStorage.setItem(`${EDITOR_CACHE_PREFIX}${path}`, JSON.stringify({
        savedAt: Date.now(),
        data,
      }));
    } catch {
      // Cache is optional; the editor still works when storage is unavailable.
    }
  };

  const cachedApiFetch = (path) =>
    apiFetch({ path }).then((payload) => {
      writeCachedEditorApi(path, payload);
      return payload;
    });

  const useGites = () => {
    const [gites, setGites] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const loadGites = () => {
      const path = "/booked/v1/gites";
      const cached = readCachedEditorApi(path);
      if (cached) {
        setGites(normalizeGites(cached));
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      setError("");
      cachedApiFetch(path)
        .then((payload) => {
          setGites(normalizeGites(payload));
          setIsLoading(false);
        })
        .catch((apiError) => {
          if (!cached) {
            setError(apiError.message || __("Impossible de charger les gîtes.", "booked"));
          }
          setIsLoading(false);
        });
    };

    useEffect(loadGites, []);

    return { gites, isLoading, error, loadGites };
  };

  const getGiteName = (gites, giteId) => {
    const gite = gites.find((item) => item.id === giteId);
    return gite ? gite.name : giteId;
  };

  const getGiteOptions = (gites, defaultGiteId = "") => [
    {
      label: defaultGiteId
        ? sprintf(__("Gîte de la page (%s)", "booked"), getGiteName(gites, defaultGiteId))
        : __("Sélectionner un gîte", "booked"),
      value: "",
    },
    ...gites.map((gite) => ({
      label: gite.capacity ? `${gite.name} (${gite.capacity} pers.)` : gite.name,
      value: gite.id,
    })),
  ];

  const calendarColorAttributes = {
    holidayColor: {
      type: "string",
      default: DEFAULT_PERIOD_COLORS.holidayColor,
    },
    bridgeColor: {
      type: "string",
      default: DEFAULT_PERIOD_COLORS.bridgeColor,
    },
    summerColor: {
      type: "string",
      default: DEFAULT_PERIOD_COLORS.summerColor,
    },
  };

  const galleryAttributes = {
    giteId: {
      type: "string",
      default: "",
    },
    columns: {
      type: "number",
      default: 3,
    },
    gap: {
      type: "number",
      default: 16,
    },
    imageRatio: {
      type: "string",
      default: "4-3",
    },
    layoutMode: {
      type: "string",
      default: "grid",
    },
    featuredSideCount: {
      type: "number",
      default: 4,
    },
    hoverDimOpacity: {
      type: "number",
      default: 0,
    },
    lightbox: {
      type: "boolean",
      default: true,
    },
    expandMode: {
      type: "string",
      default: "lightbox",
    },
    widthMode: {
      type: "string",
      default: "fixed",
    },
    maxWidth: {
      type: "number",
      default: 1200,
    },
    showCaptions: {
      type: "boolean",
      default: false,
    },
  };

  const giteCardsAttributes = {
    selectedGiteIds: {
      type: "array",
      default: [],
      items: {
        type: "string",
      },
    },
    layout: {
      type: "string",
      default: "grid",
    },
    columns: {
      type: "number",
      default: 3,
    },
    imageRatio: {
      type: "string",
      default: "4-3",
    },
    showImages: {
      type: "boolean",
      default: true,
    },
    showDescription: {
      type: "boolean",
      default: true,
    },
    showStats: {
      type: "boolean",
      default: true,
    },
    showCta: {
      type: "boolean",
      default: true,
    },
    ctaLabel: {
      type: "string",
      default: __("Voir le gîte", "booked"),
    },
  };

  const getGalleryRatioOptions = () => [
    { label: __("Paysage 4:3", "booked"), value: "4-3" },
    { label: __("Carré 1:1", "booked"), value: "1-1" },
    { label: __("Paysage 3:2", "booked"), value: "3-2" },
    { label: __("Large 16:9", "booked"), value: "16-9" },
    { label: __("Portrait 2:3", "booked"), value: "2-3" },
  ];

  const getGalleryLayoutOptions = () => [
    { label: __("Grille", "booked"), value: "grid" },
    { label: __("Image principale", "booked"), value: "featured" },
  ];

  const getGalleryExpandOptions = () => [
    { label: __("Lightbox", "booked"), value: "lightbox" },
    { label: __("Masonry en overlay", "booked"), value: "masonry" },
  ];

  const getGiteCardsLayoutOptions = () => [
    { label: __("Grille élégante", "booked"), value: "grid" },
    { label: __("Liste compacte", "booked"), value: "compact" },
    { label: __("Mise en avant", "booked"), value: "spotlight" },
    { label: __("Compact gîte de la page", "booked"), value: "page-compact" },
  ];

  const getGiteCardsRatioOptions = () => [
    { label: __("Paysage 4:3", "booked"), value: "4-3" },
    { label: __("Carré 1:1", "booked"), value: "1-1" },
    { label: __("Paysage 3:2", "booked"), value: "3-2" },
    { label: __("Large 16:9", "booked"), value: "16-9" },
  ];

  const getCalendarColorControls = (attributes, setAttributes) => [
    el(TextControl, {
      key: "holidayColor",
      type: "color",
      label: __("Vacances scolaires", "booked"),
      value: attributes.holidayColor || DEFAULT_PERIOD_COLORS.holidayColor,
      onChange: (holidayColor) => setAttributes({ holidayColor }),
    }),
    el(TextControl, {
      key: "bridgeColor",
      type: "color",
      label: __("Ponts", "booked"),
      value: attributes.bridgeColor || DEFAULT_PERIOD_COLORS.bridgeColor,
      onChange: (bridgeColor) => setAttributes({ bridgeColor }),
    }),
    el(TextControl, {
      key: "summerColor",
      type: "color",
      label: __("Juillet / août", "booked"),
      value: attributes.summerColor || DEFAULT_PERIOD_COLORS.summerColor,
      onChange: (summerColor) => setAttributes({ summerColor }),
    }),
  ];

  const useDefaultGiteId = () =>
    wp.data.useSelect(
      (select) => {
        const meta = select("core/editor").getEditedPostAttribute("meta") || {};
        return meta[DEFAULT_GITE_META_KEY] || "";
      },
      []
    );

  const getEffectiveGiteId = (attributes, defaultGiteId) => attributes.giteId || defaultGiteId || "";

  const useGiteVariables = (giteId) => {
    const [variables, setVariables] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const loadVariables = () => {
      const path = giteId
        ? `/booked/v1/gites/${encodeURIComponent(giteId)}/variables?refresh=1`
        : "/booked/v1/variables";
      const cached = readCachedEditorApi(path);
      if (cached) {
        setVariables(cached && Array.isArray(cached.variables) ? cached.variables : []);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      setError("");
      cachedApiFetch(path)
        .then((payload) => {
          setVariables(payload && Array.isArray(payload.variables) ? payload.variables : []);
          setIsLoading(false);
        })
        .catch((apiError) => {
          if (!cached) {
            setVariables([]);
            setError(apiError.message || __("Impossible de charger les variables Booked.", "booked"));
          }
          setIsLoading(false);
        });
    };

    useEffect(loadVariables, [giteId]);

    return { variables, isCommon: !giteId, isLoading, error, loadVariables };
  };

  const useDynamicPhrases = () => {
    const [phrases, setPhrases] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const loadPhrases = () => {
      const path = "/booked/v1/dynamic-phrases";
      const cached = readCachedEditorApi(path);
      if (cached) {
        setPhrases(cached && Array.isArray(cached.phrases) ? cached.phrases : []);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      setError("");
      cachedApiFetch(path)
        .then((payload) => {
          setPhrases(payload && Array.isArray(payload.phrases) ? payload.phrases : []);
          setIsLoading(false);
        })
        .catch((apiError) => {
          if (!cached) {
            setPhrases([]);
            setError(apiError.message || __("Impossible de charger les phrases dynamiques.", "booked"));
          }
          setIsLoading(false);
        });
    };

    useEffect(loadPhrases, []);

    return { phrases, isLoading, error, loadPhrases };
  };

  const appendToken = (content, token) => {
    const value = content || "";
    const separator = value && !/\s$/.test(value) ? " " : "";
    return `${value}${separator}${token}`;
  };

  const getVariableControls = (variables, insertVariable) =>
    variables.slice(0, 30).map((variable) => ({
      title: variable.label || variable.token,
      onClick: () => insertVariable(variable.token),
    }));

  const getDynamicPhraseControls = (phrases, insertPhrase) =>
    phrases.map((phrase) => ({
      title: phrase.title || phrase.token,
      onClick: () => insertPhrase(phrase.token),
    }));

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const stripTokenBraces = (token) => String(token || "").replace(/^\{\{\s*|\s*\}\}$/g, "").toLowerCase();

  const normalizeBookedTextTokens = (content) => {
    const aliases = {
      "gite.min_nuits_toute_annee": "gite.nb_nuits_minimum_toute_annee",
      "gite.min_nuits_vacances_scolaires": "gite.nb_nuits_minimum_vacances_scolaires",
      "gite.min_nuits_juillet_aout": "gite.nb_nuits_minimum_juillet_aout",
    };

    return String(content || "").replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, token) => {
      const normalized = token.toLowerCase();
      return Object.prototype.hasOwnProperty.call(aliases, normalized) ? `{{${aliases[normalized]}}}` : match;
    });
  };

  const renderBookedTextPreview = (content, phrases, variables) => {
    const phraseMap = {};
    phrases.forEach((phrase) => {
      const token = stripTokenBraces(phrase.token);
      if (token) {
        phraseMap[token] = phrase.value || "";
      }
    });

    const variableMap = {};
    variables.forEach((variable) => {
      if (variable.common) return;
      const token = stripTokenBraces(variable.token);
      if (token) {
        variableMap[token] = variable.preview || "";
      }
    });

    let rendered = content || "";
    for (let i = 0; i < 5; i++) {
      const next = rendered.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, token) => {
        const normalized = token.toLowerCase();
        return Object.prototype.hasOwnProperty.call(phraseMap, normalized) ? phraseMap[normalized] : match;
      });
      if (next === rendered) break;
      rendered = next;
    }

    rendered = rendered.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, token) => {
      const normalized = token.toLowerCase();
      return Object.prototype.hasOwnProperty.call(variableMap, normalized)
        ? escapeHtml(variableMap[normalized])
        : `<span class="booked-text__preview-token">${escapeHtml(match)}</span>`;
    });

    return rendered;
  };

  const BookedDefaultGitePanel = () => {
    const { gites, isLoading, error, loadGites } = useGites();
    const meta = wp.data.useSelect(
      (select) => select("core/editor").getEditedPostAttribute("meta") || {},
      []
    );
    const { editPost } = wp.data.useDispatch("core/editor");
    const selectedGiteId = meta[DEFAULT_GITE_META_KEY] || "";

    return el(
      wp.editPost.PluginDocumentSettingPanel,
      {
        name: "booked-default-gite",
        title: __("Booked", "booked"),
        className: "booked-default-gite-panel",
      },
      isLoading ? el(Spinner) : null,
      error ? el(Notice, { status: "error", isDismissible: false }, error) : null,
      el(SelectControl, {
        label: __("Gîte par défaut de la page", "booked"),
        value: selectedGiteId,
        options: getGiteOptions(gites),
        onChange: (value) =>
          editPost({
            meta: {
              ...meta,
              [DEFAULT_GITE_META_KEY]: value,
            },
          }),
        help: __("Les blocs Gutenberg natifs peuvent utiliser les variables {{gite...}} de ce gîte.", "booked"),
      }),
      error
        ? el(TextControl, {
            label: __("ID du gîte", "booked"),
            value: selectedGiteId,
            help: __("Saisie manuelle disponible si la liste API est indisponible.", "booked"),
            onChange: (value) =>
              editPost({
                meta: {
                  ...meta,
                  [DEFAULT_GITE_META_KEY]: value,
                },
              }),
          })
        : null,
      el(Button, { variant: "secondary", onClick: loadGites, disabled: isLoading }, __("Recharger les gîtes", "booked"))
    );
  };

  if (wp.plugins && wp.editPost && wp.data) {
    wp.plugins.registerPlugin("booked-default-gite", {
      render: BookedDefaultGitePanel,
    });
  }

  const normalizeIdList = (value) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);
  const isNoSelection = (value) => normalizeIdList(value).includes(NO_SELECTION_ID);
  const withoutNoSelection = (value) => normalizeIdList(value).filter((id) => id !== NO_SELECTION_ID);

  const getSelectedGiteCardIds = (selectedGiteIds, gites) => {
    const selected = normalizeIdList(selectedGiteIds);
    return selected.length > 0 ? selected : gites.map((gite) => gite.id).filter(Boolean);
  };

  const toggleSelectedGiteCard = (selectedGiteIds, giteId, allGiteIds) => {
    const selected = normalizeIdList(selectedGiteIds);
    const all = normalizeIdList(allGiteIds);
    const effective = selected.length === 0 ? all : selected;
    const next = effective.includes(giteId) ? effective.filter((id) => id !== giteId) : [...effective, giteId];
    return next.length === all.length ? [] : next;
  };

  const toggleSelectedId = (currentValue, id, allIds) => {
    const current = withoutNoSelection(currentValue);
    const all = normalizeIdList(allIds);
    const effective = isNoSelection(currentValue) ? [] : current.length === 0 ? all : current;
    const next = effective.includes(id) ? effective.filter((item) => item !== id) : [...effective, id];
    if (next.length === 0) {
      return [NO_SELECTION_ID];
    }
    return next.length === all.length ? [] : next;
  };

  const getSectionGroupIds = (section) =>
    (Array.isArray(section.groupes) ? section.groupes : []).map((group) => String(group.id || "")).filter(Boolean);

  const toggleSelectedSection = (selectedSectionIds, selectedGroupIds, section, sectionIds, groupIds) => {
    const sectionId = String(section.id || "");
    const sectionGroupIds = getSectionGroupIds(section);
    const currentSectionIds = withoutNoSelection(selectedSectionIds);
    const currentGroupIds = withoutNoSelection(selectedGroupIds);
    const effectiveSectionIds = isNoSelection(selectedSectionIds) ? [] : currentSectionIds.length === 0 ? sectionIds : currentSectionIds;
    const effectiveGroupIds = isNoSelection(selectedGroupIds) ? [] : currentGroupIds.length === 0 ? groupIds : currentGroupIds;
    const isSelected = effectiveSectionIds.includes(sectionId);
    const nextSectionIds = isSelected
      ? effectiveSectionIds.filter((id) => id !== sectionId)
      : [...effectiveSectionIds, sectionId];
    const nextGroupIds = isSelected
      ? effectiveGroupIds.filter((id) => !sectionGroupIds.includes(id))
      : Array.from(new Set([...effectiveGroupIds, ...sectionGroupIds]));

    return {
      selectedSectionIds: nextSectionIds.length === 0 ? [NO_SELECTION_ID] : nextSectionIds.length === sectionIds.length ? [] : nextSectionIds,
      selectedGroupIds: nextGroupIds.length === 0 ? [NO_SELECTION_ID] : nextGroupIds.length === groupIds.length ? [] : nextGroupIds,
    };
  };

  const WidgetPreview = ({ attributes }) => {
    const ref = useRef(null);
    const defaultGiteId = useDefaultGiteId();
    const giteId = getEffectiveGiteId(attributes, defaultGiteId);

    useEffect(() => {
      if (!ref.current || !giteId || !window.BookedWidget) return;
      ref.current.dataset.bookedInitialized = "0";
      window.BookedWidget.render(ref.current);
    }, [giteId, attributes.months, attributes.showTitle, attributes.showCapacity, attributes.showPeriodColors, attributes.holidayColor, attributes.bridgeColor, attributes.summerColor]);

    if (!giteId) {
      return el("div", { className: "booked-block-placeholder" }, __("Sélectionnez un gîte dans les réglages du bloc.", "booked"));
    }

    return el("div", {
      ref,
      className: "booked-widget",
      "data-gite-id": giteId,
      "data-months": String(attributes.months || 2),
      "data-show-title": attributes.showTitle ? "1" : "0",
      "data-show-capacity": attributes.showCapacity ? "1" : "0",
      "data-show-period-colors": attributes.showPeriodColors === false ? "0" : "1",
      "data-holiday-color": attributes.holidayColor || DEFAULT_PERIOD_COLORS.holidayColor,
      "data-bridge-color": attributes.bridgeColor || DEFAULT_PERIOD_COLORS.bridgeColor,
      "data-summer-color": attributes.summerColor || DEFAULT_PERIOD_COLORS.summerColor,
    });
  };

  const BookingCardPreview = ({ attributes }) => {
    const ref = useRef(null);
    const defaultGiteId = useDefaultGiteId();
    const giteId = getEffectiveGiteId(attributes, defaultGiteId);

    useEffect(() => {
      if (!ref.current || !giteId || !window.BookedBookingCard) return;
      ref.current.dataset.bookedBookingCardInitialized = "0";
      window.BookedBookingCard.render(ref.current);
    }, [giteId, attributes.months, attributes.showTravelers, attributes.holidayColor, attributes.bridgeColor, attributes.summerColor]);

    if (!giteId) {
      return el("div", { className: "booked-block-placeholder" }, __("Sélectionnez un gîte dans les réglages du bloc.", "booked"));
    }

    return el("div", {
      ref,
      className: "booked-booking-card",
      "data-gite-id": giteId,
      "data-months": String(attributes.months || 2),
      "data-show-travelers": attributes.showTravelers === false ? "0" : "1",
      "data-holiday-color": attributes.holidayColor || DEFAULT_PERIOD_COLORS.holidayColor,
      "data-bridge-color": attributes.bridgeColor || DEFAULT_PERIOD_COLORS.bridgeColor,
      "data-summer-color": attributes.summerColor || DEFAULT_PERIOD_COLORS.summerColor,
    });
  };

  const GiteInfoPreview = ({ attributes }) => {
    const ref = useRef(null);
    const defaultGiteId = useDefaultGiteId();
    const giteId = getEffectiveGiteId(attributes, defaultGiteId);

    useEffect(() => {
      if (!ref.current || !giteId || !window.BookedGiteInfo) return;
      ref.current.dataset.bookedInfoInitialized = "0";
      window.BookedGiteInfo.render(ref.current);
    }, [
      giteId,
      attributes.layout,
      attributes.cardColumns,
      JSON.stringify(attributes.selectedSectionIds || []),
      JSON.stringify(attributes.selectedGroupIds || []),
      attributes.showTitle,
      attributes.showSectionTitles,
      attributes.showNotes,
    ]);

    if (!giteId) {
      return el("div", { className: "booked-block-placeholder" }, __("Sélectionnez un gîte dans les réglages du bloc.", "booked"));
    }

    return el("div", {
      ref,
      className: "booked-gite-info",
      "data-gite-id": giteId,
      "data-layout": attributes.layout || "list",
      "data-card-columns": String(attributes.cardColumns || 3),
      "data-selected-section-ids": JSON.stringify(attributes.selectedSectionIds || []),
      "data-selected-group-ids": JSON.stringify(attributes.selectedGroupIds || []),
      "data-show-title": attributes.showTitle === false ? "0" : "1",
      "data-show-section-titles": attributes.showSectionTitles === false ? "0" : "1",
      "data-show-notes": attributes.showNotes === false ? "0" : "1",
    });
  };

  const GalleryPreview = ({ attributes, refreshKey = 0 }) => {
    const ref = useRef(null);
    const defaultGiteId = useDefaultGiteId();
    const giteId = getEffectiveGiteId(attributes, defaultGiteId);

    useEffect(() => {
      if (!ref.current || !giteId || !window.BookedGallery) return;
      ref.current.dataset.bookedGalleryInitialized = "0";
      window.BookedGallery.render(ref.current);
    }, [
      giteId,
      attributes.columns,
      attributes.gap,
      attributes.imageRatio,
      attributes.layoutMode,
      attributes.featuredSideCount,
      attributes.hoverDimOpacity,
      attributes.lightbox,
      attributes.expandMode,
      attributes.widthMode,
      attributes.maxWidth,
      attributes.showCaptions,
      refreshKey,
    ]);

    if (!giteId) {
      return el("div", { className: "booked-block-placeholder" }, __("Sélectionnez un gîte dans les réglages du bloc.", "booked"));
    }

    return el("div", {
      ref,
      className: `booked-gallery booked-gallery--${attributes.widthMode === "full" ? "full" : "fixed"} booked-gallery--layout-${attributes.layoutMode === "featured" ? "featured" : "grid"}`,
      "data-gite-id": giteId,
      "data-columns": String(attributes.columns || 3),
      "data-gap": String(attributes.gap === undefined ? 16 : attributes.gap),
      "data-image-ratio": attributes.imageRatio || "4-3",
      "data-layout-mode": attributes.layoutMode === "featured" ? "featured" : "grid",
      "data-featured-side-count": String(attributes.featuredSideCount || 4),
      "data-hover-dim-opacity": String(attributes.hoverDimOpacity || 0),
      "data-lightbox": attributes.lightbox === false ? "0" : "1",
      "data-expand-mode": attributes.expandMode === "masonry" ? "masonry" : "lightbox",
      "data-width-mode": attributes.widthMode === "full" ? "full" : "fixed",
      "data-max-width": String(attributes.maxWidth || 1200),
      "data-show-captions": attributes.showCaptions ? "1" : "0",
    });
  };

  const GiteCardsPreview = ({ attributes, gites }) => {
    const ref = useRef(null);
    const defaultGiteId = useDefaultGiteId();
    const isPageCompact = (attributes.layout || "grid") === "page-compact";
    const selectedGiteIds = isPageCompact
      ? [defaultGiteId || normalizeIdList(attributes.selectedGiteIds)[0]].filter(Boolean)
      : getSelectedGiteCardIds(attributes.selectedGiteIds, gites);
    const giteMetadata = selectedGiteIds.map((giteId) => {
      const gite = gites.find((item) => item.id === giteId) || {};
      return {
        id: giteId,
        name: gite.name || giteId,
        capacity: gite.capacity || null,
      };
    });

    useEffect(() => {
      if (!ref.current || selectedGiteIds.length === 0 || !window.BookedGiteCards) return;
      window.BookedGiteCards.render(ref.current);
    }, [
      JSON.stringify(selectedGiteIds),
      JSON.stringify(giteMetadata),
      defaultGiteId,
      attributes.layout,
      attributes.columns,
      attributes.imageRatio,
      attributes.showImages,
      attributes.showDescription,
      attributes.showStats,
      attributes.showCta,
      attributes.ctaLabel,
    ]);

    if (selectedGiteIds.length === 0) {
      return el("div", { className: "booked-block-placeholder" }, __("Sélectionnez au moins un gîte ou rechargez la liste.", "booked"));
    }

    return el("div", {
      ref,
      className: `booked-gite-cards booked-gite-cards--${attributes.layout || "grid"}`,
      "data-gite-ids": JSON.stringify(selectedGiteIds),
      "data-gites": JSON.stringify(giteMetadata),
      "data-layout": attributes.layout || "grid",
      "data-columns": String(isPageCompact ? 1 : attributes.columns || 3),
      "data-image-ratio": attributes.imageRatio || "4-3",
      "data-show-images": isPageCompact || attributes.showImages === false ? "0" : "1",
      "data-show-description": isPageCompact || attributes.showDescription === false ? "0" : "1",
      "data-show-stats": isPageCompact || attributes.showStats !== false ? "1" : "0",
      "data-show-cta": isPageCompact || attributes.showCta === false ? "0" : "1",
      "data-cta-label": attributes.ctaLabel || __("Voir le gîte", "booked"),
    });
  };

  registerBlockType("booked/accordion", {
    attributes: {
      summary: {
        type: "string",
        source: "html",
        selector: ".booked-accordion__title",
        default: __("Titre de l’accordéon", "booked"),
      },
      open: {
        type: "boolean",
        default: false,
      },
      icon: {
        type: "string",
        default: "",
      },
    },
    supports: {
      anchor: true,
      className: true,
      align: true,
      spacing: {
        margin: true,
      },
    },
    edit({ attributes, setAttributes }) {
      const blockProps = useBlockProps({ className: "booked-accordion booked-accordion--block booked-block--accordion" });

      return el(
        Fragment,
        null,
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: __("Réglages de l’accordéon", "booked"), initialOpen: true },
            el(ToggleControl, {
              label: __("Ouvert par défaut", "booked"),
              checked: !!attributes.open,
              onChange: (value) => setAttributes({ open: value }),
            }),
            el(TextControl, {
              label: __("Picto avant le titre", "booked"),
              value: attributes.icon || "",
              placeholder: __("Ex. +, ?, ★", "booked"),
              onChange: (icon) => setAttributes({ icon }),
            })
          )
        ),
        el(
          "div",
          blockProps,
          el(
            "details",
            { className: "booked-accordion__details booked-accordion__details--open", open: true },
            el(
              "summary",
              { className: "booked-accordion__summary" },
              attributes.icon
                ? el("span", { className: "booked-accordion__icon", "aria-hidden": "true" }, attributes.icon)
                : null,
              el(RichText, {
                tagName: "span",
                className: "booked-accordion__title",
                value: attributes.summary || "",
                placeholder: __("Titre de l’accordéon", "booked"),
                allowedFormats: [],
                onChange: (summary) => setAttributes({ summary }),
              })
            ),
            el(
              "div",
              { className: "booked-accordion__panel" },
              el(
                "div",
                { className: "booked-accordion__content" },
                el(InnerBlocks, {
                  template: [["core/paragraph", { placeholder: __("Ajoutez le contenu de l’accordéon...", "booked") }]],
                  templateLock: false,
                })
              )
            )
          )
        )
      );
    },

    save({ attributes }) {
      const blockProps = useBlockProps.save({ className: "booked-accordion booked-accordion--block" });
      return el(
        "div",
        blockProps,
        el(
          "details",
          {
            className: `booked-accordion__details${attributes.open ? " booked-accordion__details--open" : ""}`,
            open: attributes.open ? true : undefined,
          },
          el(
            "summary",
            { className: "booked-accordion__summary" },
            attributes.icon
              ? el("span", { className: "booked-accordion__icon", "aria-hidden": "true" }, attributes.icon)
              : null,
            el(RichText.Content, {
              tagName: "span",
              className: "booked-accordion__title",
              value: attributes.summary || __("Titre de l’accordéon", "booked"),
            })
          ),
          el(
            "div",
            { className: "booked-accordion__panel" },
            el("div", { className: "booked-accordion__content" }, el(InnerBlocks.Content))
          )
        )
      );
    },
  });

  registerBlockType("booked/heading", {
    attributes: {
      content: {
        type: "string",
        default: __("Rez de chaussée", "booked"),
      },
      level: {
        type: "number",
        default: 2,
      },
      style: {
        type: "string",
        default: "line-ticks",
      },
      textAlign: {
        type: "string",
        default: "center",
      },
    },
    supports: {
      align: true,
      anchor: true,
      className: true,
      color: {
        background: true,
        gradients: true,
        text: true,
      },
      spacing: {
        margin: true,
        padding: true,
      },
      typography: {
        fontSize: true,
        lineHeight: true,
      },
    },
    transforms: {
      from: [
        {
          type: "block",
          blocks: ["core/heading"],
          transform: ({ content, level }) => createBlock("booked/heading", { content, level }),
        },
      ],
      to: [
        {
          type: "block",
          blocks: ["core/heading"],
          transform: ({ content, level }) => createBlock("core/heading", { content, level }),
        },
      ],
    },

    edit({ attributes, setAttributes }) {
      const blockProps = useBlockProps({ className: getHeadingClassName(attributes) });
      const tagName = getHeadingTagName(attributes.level);

      return el(
        Fragment,
        null,
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: __("Réglages du titre", "booked"), initialOpen: true },
            el(SelectControl, {
              label: __("Style", "booked"),
              value: getHeadingStyle(attributes.style),
              options: getHeadingStyleOptions(),
              onChange: (style) => setAttributes({ style }),
            }),
            el(SelectControl, {
              label: __("Niveau", "booked"),
              value: String(attributes.level || 2),
              options: [
                { label: "H2", value: "2" },
                { label: "H3", value: "3" },
                { label: "H4", value: "4" },
              ],
              onChange: (level) => setAttributes({ level: Number(level) }),
            }),
            el(SelectControl, {
              label: __("Alignement du texte", "booked"),
              value: getHeadingTextAlign(attributes.textAlign),
              options: [
                { label: __("Gauche", "booked"), value: "left" },
                { label: __("Centre", "booked"), value: "center" },
                { label: __("Droite", "booked"), value: "right" },
              ],
              onChange: (textAlign) => setAttributes({ textAlign }),
            })
          )
        ),
        el(
          "div",
          blockProps,
          el("span", { className: "booked-heading__line booked-heading__line--before", "aria-hidden": "true" }),
          el(RichText, {
            tagName,
            className: "booked-heading__text",
            value: attributes.content || "",
            placeholder: __("Votre titre...", "booked"),
            allowedFormats: [],
            onChange: (content) => setAttributes({ content }),
          }),
          el("span", { className: "booked-heading__line booked-heading__line--after", "aria-hidden": "true" })
        )
      );
    },

    save() {
      return null;
    },
  });

  registerBlockType("booked/text", {
    transforms: {
      from: [
        {
          type: "block",
          blocks: ["core/paragraph"],
          transform: ({ content }) => createBlock("booked/text", { content }),
        },
      ],
      to: [
        {
          type: "block",
          blocks: ["core/paragraph"],
          transform: ({ content }) => createBlock("core/paragraph", { content }),
        },
      ],
    },

    edit({ attributes, setAttributes, isSelected }) {
      const blockProps = useBlockProps({ className: "booked-block booked-block--text" });
      const { gites, isLoading, error, loadGites } = useGites();
      const defaultGiteId = useDefaultGiteId();
      const effectiveGiteId = getEffectiveGiteId(attributes, defaultGiteId);
      const { variables, isCommon: isCommonVariables, isLoading: isVariablesLoading, error: variablesError, loadVariables } = useGiteVariables(effectiveGiteId);
      const { phrases, isLoading: isPhrasesLoading, error: phrasesError, loadPhrases } = useDynamicPhrases();

      useEffect(() => {
        const normalizedContent = normalizeBookedTextTokens(attributes.content || "");
        if (normalizedContent !== (attributes.content || "")) {
          setAttributes({ content: normalizedContent });
        }
      }, [attributes.content]);

      const insertVariable = (token) => {
        setAttributes({ content: appendToken(attributes.content, token) });
      };

      const insertPhrase = (token) => {
        setAttributes({ content: appendToken(attributes.content, token) });
      };

      const variableControls = getVariableControls(variables, insertVariable);
      const dynamicPhraseControls = getDynamicPhraseControls(phrases, insertPhrase);
      const previewHtml = renderBookedTextPreview(attributes.content || "", phrases, variables);

      return el(
        Fragment,
        null,
        el(
          BlockControls,
          null,
          el(
            ToolbarGroup,
            null,
            el(DropdownMenu, {
              icon: "database",
              label: __("Insérer une variable Booked", "booked"),
              controls: variableControls.length > 0 ? variableControls : [
                {
                  title: effectiveGiteId
                    ? __("Aucune variable disponible", "booked")
                    : __("Aucune variable commune", "booked"),
                  isDisabled: true,
                },
              ],
            }),
            el(DropdownMenu, {
              icon: "editor-paste-text",
              label: __("Insérer une phrase dynamique", "booked"),
              controls: dynamicPhraseControls.length > 0 ? dynamicPhraseControls : [
                {
                  title: isPhrasesLoading
                    ? __("Chargement des phrases...", "booked")
                    : __("Aucune phrase dynamique", "booked"),
                  isDisabled: true,
                },
              ],
            })
          )
        ),
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: __("Réglages Booked Texte", "booked"), initialOpen: true },
            isLoading ? el(Spinner) : null,
            error ? el(Notice, { status: "error", isDismissible: false }, error) : null,
            el(SelectControl, {
              label: __("Gîte", "booked"),
              value: attributes.giteId || "",
              options: getGiteOptions(gites, defaultGiteId),
              onChange: (value) => setAttributes({ giteId: value }),
              help: defaultGiteId && !attributes.giteId
                ? __("Ce bloc utilise le gîte sélectionné dans les réglages de la page.", "booked")
                : undefined,
            }),
            error
              ? el(TextControl, {
                  label: __("ID du gîte", "booked"),
                  value: attributes.giteId || "",
                  help: __("Saisie manuelle disponible si la liste API est indisponible.", "booked"),
                  onChange: (value) => setAttributes({ giteId: value }),
                })
              : null,
            el(Button, { variant: "secondary", onClick: loadGites, disabled: isLoading }, __("Recharger les gîtes", "booked"))
          ),
          el(
            PanelBody,
            { title: __("Variables", "booked"), initialOpen: true },
            isCommonVariables
              ? el("p", { className: "booked-block-help" }, __("Variables communes insérables dans un modèle. Les valeurs seront remplacées si la page fournit un gîte.", "booked"))
              : null,
            isVariablesLoading ? el(Spinner) : null,
            variablesError ? el(Notice, { status: "error", isDismissible: false }, variablesError) : null,
            !isVariablesLoading && !variablesError && variables.length === 0
              ? el("p", { className: "booked-block-help" }, isCommonVariables ? __("Aucune variable commune disponible.", "booked") : __("Aucune variable disponible pour ce gîte.", "booked"))
              : null,
            variables.map((variable) =>
              el(
                "div",
                { key: variable.token, className: "booked-block-variable" },
                el(
                  Button,
                  { variant: "secondary", onClick: () => insertVariable(variable.token) },
                  variable.label || variable.token
                ),
                el("code", null, variable.token),
                variable.preview ? el("span", { className: "booked-block-variable__preview" }, variable.preview) : null
              )
            ),
            el(Button, { variant: "secondary", onClick: loadVariables, disabled: isVariablesLoading }, __("Recharger les variables", "booked"))
          ),
          el(
            PanelBody,
            { title: __("Phrases dynamiques", "booked"), initialOpen: false },
            isPhrasesLoading ? el(Spinner) : null,
            phrasesError ? el(Notice, { status: "error", isDismissible: false }, phrasesError) : null,
            !isPhrasesLoading && !phrasesError && phrases.length === 0
              ? el("p", { className: "booked-block-help" }, __("Aucune phrase dynamique configurée.", "booked"))
              : null,
            phrases.map((phrase) =>
              el(
                "div",
                { key: phrase.token, className: "booked-block-variable" },
                el(
                  Button,
                  { variant: "secondary", onClick: () => insertPhrase(phrase.token) },
                  phrase.title || phrase.token
                ),
                el("code", null, phrase.token)
              )
            ),
            el(Button, { variant: "secondary", onClick: loadPhrases, disabled: isPhrasesLoading }, __("Recharger les phrases", "booked"))
          )
        ),
        el(
          "div",
          blockProps,
          isSelected
            ? el(RichText, {
                tagName: "p",
                className: "booked-text__editor",
                value: attributes.content || "",
                placeholder: attributes.placeholder || __("Rédigez votre texte Booked...", "booked"),
                onChange: (content) => setAttributes({ content }),
              })
            : el("p", {
                className: "booked-text__editor booked-text__preview",
                dangerouslySetInnerHTML: {
                  __html: previewHtml || escapeHtml(attributes.placeholder || __("Rédigez votre texte Booked...", "booked")),
                },
              })
        )
      );
    },

    save() {
      return null;
    },
  });

  registerBlockType("booked/widget", {
    attributes: {
      giteId: {
        type: "string",
        default: "",
      },
      months: {
        type: "number",
        default: 2,
      },
      showTitle: {
        type: "boolean",
        default: true,
      },
      showCapacity: {
        type: "boolean",
        default: true,
      },
      showPeriodColors: {
        type: "boolean",
        default: true,
      },
      ...calendarColorAttributes,
    },
    edit({ attributes, setAttributes }) {
      const blockProps = useBlockProps({ className: "booked-block" });
      const { gites, isLoading, error, loadGites } = useGites();
      const defaultGiteId = useDefaultGiteId();

      return el(
        Fragment,
        null,
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: __("Réglages Booked", "booked"), initialOpen: true },
            isLoading ? el(Spinner) : null,
            error ? el(Notice, { status: "error", isDismissible: false }, error) : null,
            el(SelectControl, {
              label: __("Gîte", "booked"),
              value: attributes.giteId || "",
              options: getGiteOptions(gites, defaultGiteId),
              onChange: (value) => setAttributes({ giteId: value }),
              help: defaultGiteId && !attributes.giteId
                ? __("Ce bloc utilise le gîte sélectionné dans les réglages de la page.", "booked")
                : undefined,
            }),
            error
              ? el(TextControl, {
                  label: __("ID du gîte", "booked"),
                  value: attributes.giteId || "",
                  help: __("Saisie manuelle disponible si la liste API est indisponible.", "booked"),
                  onChange: (value) => setAttributes({ giteId: value }),
                })
              : null,
            el(RangeControl, {
              label: __("Nombre de mois", "booked"),
              min: 1,
              max: 12,
              value: attributes.months || 2,
              onChange: (value) => setAttributes({ months: value || 1 }),
            }),
            el(ToggleControl, {
              label: __("Afficher le titre", "booked"),
              checked: attributes.showTitle !== false,
              onChange: (value) => setAttributes({ showTitle: value }),
            }),
            el(ToggleControl, {
              label: __("Afficher la capacité", "booked"),
              checked: attributes.showCapacity !== false,
              onChange: (value) => setAttributes({ showCapacity: value }),
            }),
            el(ToggleControl, {
              label: __("Afficher les codes couleurs", "booked"),
              checked: attributes.showPeriodColors !== false,
              onChange: (value) => setAttributes({ showPeriodColors: value }),
              help: __("Affiche les couleurs des périodes liées aux nombres de nuits.", "booked"),
            }),
            ...(attributes.showPeriodColors !== false ? getCalendarColorControls(attributes, setAttributes) : []),
            el(Button, { variant: "secondary", onClick: loadGites, disabled: isLoading }, __("Recharger les gîtes", "booked"))
          )
        ),
        el("div", blockProps, el(WidgetPreview, { attributes }))
      );
    },

    save() {
      return null;
    },
  });

  registerBlockType("booked/booking-card", {
    supports: {
      align: true,
      anchor: true,
      className: true,
      color: {
        background: true,
        gradients: true,
        text: true,
      },
      spacing: {
        margin: true,
        padding: true,
      },
      typography: {
        fontSize: true,
        lineHeight: true,
      },
    },
    attributes: {
      giteId: {
        type: "string",
        default: "",
      },
      months: {
        type: "number",
        default: 2,
      },
      showTravelers: {
        type: "boolean",
        default: true,
      },
      ...calendarColorAttributes,
    },
    edit({ attributes, setAttributes }) {
      const blockProps = useBlockProps({ className: "booked-block booked-block--booking-card" });
      const { gites, isLoading, error, loadGites } = useGites();
      const defaultGiteId = useDefaultGiteId();

      return el(
        Fragment,
        null,
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: __("Réglages Booked Réservation", "booked"), initialOpen: true },
            isLoading ? el(Spinner) : null,
            error ? el(Notice, { status: "error", isDismissible: false }, error) : null,
            el(SelectControl, {
              label: __("Gîte", "booked"),
              value: attributes.giteId || "",
              options: getGiteOptions(gites, defaultGiteId),
              onChange: (value) => setAttributes({ giteId: value }),
              help: defaultGiteId && !attributes.giteId
                ? __("Ce bloc utilise le gîte sélectionné dans les réglages de la page.", "booked")
                : __("Laisser vide côté front permet de reprendre le premier calendrier Booked de la page.", "booked"),
            }),
            error
              ? el(TextControl, {
                  label: __("ID du gîte", "booked"),
                  value: attributes.giteId || "",
                  help: __("Saisie manuelle disponible si la liste API est indisponible.", "booked"),
                  onChange: (value) => setAttributes({ giteId: value }),
                })
              : null,
            el(RangeControl, {
              label: __("Nombre de mois", "booked"),
              min: 1,
              max: 12,
              value: attributes.months || 2,
              onChange: (value) => setAttributes({ months: value || 1 }),
            }),
            el(ToggleControl, {
              label: __("Afficher les voyageurs", "booked"),
              checked: attributes.showTravelers !== false,
              onChange: (value) => setAttributes({ showTravelers: value }),
            }),
            ...getCalendarColorControls(attributes, setAttributes),
            el(Button, { variant: "secondary", onClick: loadGites, disabled: isLoading }, __("Recharger les gîtes", "booked"))
          )
        ),
        el("div", blockProps, el(BookingCardPreview, { attributes }))
      );
    },

    save() {
      return null;
    },
  });

  registerBlockType("booked/gite-cards", {
    attributes: giteCardsAttributes,
    supports: {
      align: true,
      anchor: true,
      className: true,
      spacing: {
        margin: true,
        padding: true,
      },
    },
    edit({ attributes, setAttributes }) {
      const blockProps = useBlockProps({ className: "booked-block booked-block--gite-cards" });
      const { gites, isLoading, error, loadGites } = useGites();
      const defaultGiteId = useDefaultGiteId();
      const isPageCompact = (attributes.layout || "grid") === "page-compact";
      const selectedGiteIds = normalizeIdList(attributes.selectedGiteIds);
      const allGiteIds = gites.map((gite) => gite.id).filter(Boolean);
      const manualIds = selectedGiteIds.join(", ");

      return el(
        Fragment,
        null,
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: __("Gîtes à afficher", "booked"), initialOpen: true },
            isLoading ? el(Spinner) : null,
            error ? el(Notice, { status: "error", isDismissible: false }, error) : null,
            !isLoading && !error && gites.length === 0
              ? el("p", { className: "booked-block-help" }, __("Aucun gîte disponible.", "booked"))
              : null,
            gites.length > 0
              ? el(
                  "p",
                  { className: "booked-block-help" },
                  isPageCompact && defaultGiteId
                    ? sprintf(__("Ce mode utilise le gîte de la page (%s).", "booked"), getGiteName(gites, defaultGiteId))
                    : isPageCompact
                    ? __("Ce mode utilise d’abord le gîte associé à la page. L’ID ci-dessous sert de secours.", "booked")
                    : selectedGiteIds.length === 0
                    ? __("Tous les gîtes sont affichés.", "booked")
                    : sprintf(__("%d gîte(s) sélectionné(s).", "booked"), selectedGiteIds.length)
                )
              : null,
            gites.map((gite) =>
              el(CheckboxControl, {
                key: gite.id,
                label: gite.capacity ? `${gite.name} (${gite.capacity} pers.)` : gite.name,
                checked: isPageCompact
                  ? selectedGiteIds.includes(gite.id) || (selectedGiteIds.length === 0 && defaultGiteId === gite.id)
                  : selectedGiteIds.length === 0 || selectedGiteIds.includes(gite.id),
                onChange: () =>
                  setAttributes({
                    selectedGiteIds: toggleSelectedGiteCard(selectedGiteIds, gite.id, allGiteIds),
                  }),
              })
            ),
            selectedGiteIds.length > 0
              ? el(
                  Button,
                  { variant: "secondary", onClick: () => setAttributes({ selectedGiteIds: [] }) },
                  isPageCompact ? __("Retirer le gîte de secours", "booked") : __("Afficher tous les gîtes", "booked")
                )
              : null,
            el(TextControl, {
              label: __("IDs des gîtes", "booked"),
              value: manualIds,
              help: isPageCompact
                ? __("Optionnel : utilisé seulement si aucun gîte n’est associé à la page.", "booked")
                : __("Laisser vide pour afficher tous les gîtes disponibles.", "booked"),
              onChange: (value) =>
                setAttributes({
                  selectedGiteIds: value.split(",").map((item) => item.trim()).filter(Boolean),
                }),
            }),
            el(Button, { variant: "secondary", onClick: loadGites, disabled: isLoading }, __("Recharger les gîtes", "booked"))
          ),
          el(
            PanelBody,
            { title: __("Affichage", "booked"), initialOpen: true },
            el(SelectControl, {
              label: __("Style", "booked"),
              value: attributes.layout || "grid",
              options: getGiteCardsLayoutOptions(),
              onChange: (layout) => setAttributes({ layout }),
            }),
            !["compact", "page-compact"].includes(attributes.layout || "grid")
              ? el(RangeControl, {
                  label: __("Nombre de colonnes", "booked"),
                  value: attributes.columns || 3,
                  min: 1,
                  max: 4,
                  step: 1,
                  marks: [
                    { value: 1, label: "1" },
                    { value: 2, label: "2" },
                    { value: 3, label: "3" },
                    { value: 4, label: "4" },
                  ],
                  onChange: (value) => setAttributes({ columns: value || 3 }),
                })
              : null,
            isPageCompact
              ? el("p", { className: "booked-block-help" }, __("Ce style affiche uniquement le tableau des infos principales.", "booked"))
              : el(SelectControl, {
                  label: __("Format des images", "booked"),
                  value: attributes.imageRatio || "4-3",
                  options: getGiteCardsRatioOptions(),
                  onChange: (imageRatio) => setAttributes({ imageRatio }),
                }),
            isPageCompact
              ? null
              : el(ToggleControl, {
                  label: __("Afficher les images", "booked"),
                  checked: attributes.showImages !== false,
                  onChange: (showImages) => setAttributes({ showImages }),
                }),
            isPageCompact
              ? null
              : el(ToggleControl, {
                  label: __("Afficher le résumé", "booked"),
                  checked: attributes.showDescription !== false,
                  onChange: (showDescription) => setAttributes({ showDescription }),
                }),
            isPageCompact
              ? null
              : el(ToggleControl, {
                  label: __("Afficher les pictos", "booked"),
                  checked: attributes.showStats !== false,
                  onChange: (showStats) => setAttributes({ showStats }),
                }),
            isPageCompact
              ? null
              : el(ToggleControl, {
                  label: __("Afficher le bouton", "booked"),
                  checked: attributes.showCta !== false,
                  onChange: (showCta) => setAttributes({ showCta }),
                }),
            isPageCompact || attributes.showCta === false
              ? null
              : el(TextControl, {
                  label: __("Libellé du bouton", "booked"),
                  value: attributes.ctaLabel || __("Voir le gîte", "booked"),
                  onChange: (ctaLabel) => setAttributes({ ctaLabel }),
                })
          )
        ),
        el("div", blockProps, el(GiteCardsPreview, { attributes, gites }))
      );
    },

    save() {
      return null;
    },
  });

  registerBlockType("booked/gallery", {
    attributes: galleryAttributes,
    supports: {
      align: true,
      anchor: true,
      className: true,
      spacing: {
        margin: true,
        padding: true,
      },
    },
    edit({ attributes, setAttributes }) {
      const blockProps = useBlockProps({ className: "booked-block booked-block--gallery" });
      const { gites, isLoading, error, loadGites } = useGites();
      const defaultGiteId = useDefaultGiteId();
      const effectiveGiteId = getEffectiveGiteId(attributes, defaultGiteId);
      const [syncState, setSyncState] = useState({ isSyncing: false, message: "", error: "" });

      const syncPhotos = () => {
        if (!effectiveGiteId) return;
        setSyncState({ isSyncing: true, message: "", error: "" });
        apiFetch({
          path: `/booked/v1/gites/${encodeURIComponent(effectiveGiteId)}/photos/sync`,
          method: "POST",
        })
          .then(() => {
            setSyncState({
              isSyncing: false,
              message: __("Images synchronisées.", "booked"),
              error: "",
              refreshedAt: Date.now(),
            });
          })
          .catch((apiError) => {
            setSyncState({
              isSyncing: false,
              message: "",
              error: apiError.message || __("Impossible de synchroniser les images.", "booked"),
            });
          });
      };

      return el(
        Fragment,
        null,
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: __("Réglages Booked Galerie", "booked"), initialOpen: true },
            isLoading ? el(Spinner) : null,
            error ? el(Notice, { status: "error", isDismissible: false }, error) : null,
            el(SelectControl, {
              label: __("Gîte", "booked"),
              value: attributes.giteId || "",
              options: getGiteOptions(gites, defaultGiteId),
              onChange: (value) => setAttributes({ giteId: value }),
              help: defaultGiteId && !attributes.giteId
                ? __("Ce bloc utilise le gîte sélectionné dans les réglages de la page.", "booked")
                : undefined,
            }),
            error
              ? el(TextControl, {
                  label: __("ID du gîte", "booked"),
                  value: attributes.giteId || "",
                  help: __("Saisie manuelle disponible si la liste API est indisponible.", "booked"),
                  onChange: (value) => setAttributes({ giteId: value }),
                })
              : null,
            el(Button, {
              variant: "secondary",
              onClick: syncPhotos,
              disabled: !effectiveGiteId || syncState.isSyncing,
            }, syncState.isSyncing ? __("Synchronisation...", "booked") : __("Synchroniser les images", "booked")),
            syncState.message ? el(Notice, { status: "success", isDismissible: false }, syncState.message) : null,
            syncState.error ? el(Notice, { status: "error", isDismissible: false }, syncState.error) : null,
            el(Button, { variant: "secondary", onClick: loadGites, disabled: isLoading }, __("Recharger les gîtes", "booked"))
          ),
          el(
            PanelBody,
            { title: __("Grille", "booked"), initialOpen: true },
            el(SelectControl, {
              label: __("Largeur", "booked"),
              value: attributes.widthMode || "fixed",
              options: [
                { label: __("Fixe", "booked"), value: "fixed" },
                { label: __("Pleine largeur", "booked"), value: "full" },
              ],
              onChange: (widthMode) => setAttributes({ widthMode }),
            }),
            (attributes.widthMode || "fixed") === "fixed"
              ? el(RangeControl, {
                  label: __("Largeur maximale", "booked"),
                  value: attributes.maxWidth || 1200,
                  min: 320,
                  max: 2400,
                  step: 20,
                  onChange: (value) => setAttributes({ maxWidth: value || 1200 }),
                })
              : null,
            el(SelectControl, {
              label: __("Affichage", "booked"),
              value: attributes.layoutMode || "grid",
              options: getGalleryLayoutOptions(),
              onChange: (layoutMode) => setAttributes({ layoutMode }),
            }),
            (attributes.layoutMode || "grid") === "featured"
              ? el(RangeControl, {
                  label: __("Photos à côté", "booked"),
                  value: attributes.featuredSideCount || 4,
                  min: 1,
                  max: 8,
                  step: 1,
                  marks: [
                    { value: 1, label: "1" },
                    { value: 2, label: "2" },
                    { value: 4, label: "4" },
                    { value: 6, label: "6" },
                    { value: 8, label: "8" },
                  ],
                  onChange: (value) => setAttributes({ featuredSideCount: value || 4 }),
                })
              : null,
            (attributes.layoutMode || "grid") === "grid"
              ? el(RangeControl, {
                  label: __("Nombre de colonnes", "booked"),
                  value: attributes.columns || 3,
                  min: 1,
                  max: 6,
                  step: 1,
                  marks: [
                    { value: 1, label: "1" },
                    { value: 2, label: "2" },
                    { value: 3, label: "3" },
                    { value: 4, label: "4" },
                    { value: 5, label: "5" },
                    { value: 6, label: "6" },
                  ],
                  onChange: (value) => setAttributes({ columns: value || 3 }),
                })
              : null,
            el(RangeControl, {
              label: __("Espacement", "booked"),
              value: attributes.gap === undefined ? 16 : attributes.gap,
              min: 0,
              max: 64,
              step: 1,
              onChange: (value) => setAttributes({ gap: value === undefined || value === null ? 16 : value }),
            }),
            el(SelectControl, {
              label: __("Taille des images", "booked"),
              value: attributes.imageRatio || "4-3",
              options: getGalleryRatioOptions(),
              onChange: (imageRatio) => setAttributes({ imageRatio }),
            }),
            el(RangeControl, {
              label: __("Noircissement au survol", "booked"),
              value: attributes.hoverDimOpacity || 0,
              min: 0,
              max: 80,
              step: 5,
              marks: [
                { value: 0, label: "0%" },
                { value: 20, label: "20%" },
                { value: 40, label: "40%" },
                { value: 60, label: "60%" },
                { value: 80, label: "80%" },
              ],
              onChange: (value) => setAttributes({ hoverDimOpacity: value || 0 }),
            }),
            el(ToggleControl, {
              label: __("Agrandissement au clic", "booked"),
              checked: attributes.lightbox !== false,
              onChange: (lightbox) => setAttributes({ lightbox }),
            }),
            attributes.lightbox === false
              ? null
              : el(SelectControl, {
                  label: __("Mode d'agrandissement", "booked"),
                  value: attributes.expandMode || "lightbox",
                  options: getGalleryExpandOptions(),
                  onChange: (expandMode) => setAttributes({ expandMode }),
                }),
            el(ToggleControl, {
              label: __("Afficher les légendes", "booked"),
              checked: !!attributes.showCaptions,
              onChange: (showCaptions) => setAttributes({ showCaptions }),
            })
          )
        ),
        el("div", blockProps, el(GalleryPreview, { attributes, refreshKey: syncState.refreshedAt || 0 }))
      );
    },

    save() {
      return null;
    },
  });

  registerBlockType("booked/gite-info", {
    edit({ attributes, setAttributes }) {
      const blockProps = useBlockProps({ className: "booked-block booked-block--gite-info" });
      const { gites, isLoading, error, loadGites } = useGites();
      const defaultGiteId = useDefaultGiteId();
      const effectiveGiteId = getEffectiveGiteId(attributes, defaultGiteId);
      const [content, setContent] = useState(null);
      const [contentError, setContentError] = useState("");
      const [isContentLoading, setIsContentLoading] = useState(false);

      useEffect(() => {
        if (!effectiveGiteId) {
          setContent(null);
          setContentError("");
          return;
        }

        const path = `/booked/v1/gites/${encodeURIComponent(effectiveGiteId)}/content`;
        const cached = readCachedEditorApi(path);
        if (cached) {
          setContent(cached);
          setIsContentLoading(false);
        } else {
          setIsContentLoading(true);
        }
        setContentError("");
        cachedApiFetch(path)
          .then((payload) => {
            setContent(payload);
            setIsContentLoading(false);
          })
          .catch((apiError) => {
            if (!cached) {
              setContent(null);
              setContentError(apiError.message || __("Impossible de charger les infos du gîte.", "booked"));
            }
            setIsContentLoading(false);
          });
      }, [effectiveGiteId]);

      const sections = content && Array.isArray(content.sections) ? content.sections : [];
      const sectionIds = sections.map((section) => String(section.id || "")).filter(Boolean);
      const groupIds = sections.flatMap((section) =>
        (Array.isArray(section.groupes) ? section.groupes : []).map((group) => String(group.id || "")).filter(Boolean)
      );
      const selectedSectionIds = normalizeIdList(attributes.selectedSectionIds);
      const selectedGroupIds = normalizeIdList(attributes.selectedGroupIds);

      return el(
        Fragment,
        null,
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: __("Réglages Booked Infos", "booked"), initialOpen: true },
            isLoading ? el(Spinner) : null,
            error ? el(Notice, { status: "error", isDismissible: false }, error) : null,
            el(SelectControl, {
              label: __("Gîte", "booked"),
              value: attributes.giteId || "",
              options: getGiteOptions(gites, defaultGiteId),
              onChange: (value) => setAttributes({ giteId: value, selectedSectionIds: [NO_SELECTION_ID], selectedGroupIds: [NO_SELECTION_ID] }),
              help: defaultGiteId && !attributes.giteId
                ? __("Ce bloc utilise le gîte sélectionné dans les réglages de la page.", "booked")
                : undefined,
            }),
            error
              ? el(TextControl, {
                  label: __("ID du gîte", "booked"),
                  value: attributes.giteId || "",
                  help: __("Saisie manuelle disponible si la liste API est indisponible.", "booked"),
                  onChange: (value) => setAttributes({ giteId: value, selectedSectionIds: [NO_SELECTION_ID], selectedGroupIds: [NO_SELECTION_ID] }),
                })
              : null,
            el(SelectControl, {
              label: __("Affichage", "booked"),
              value: attributes.layout || "list",
              options: [
                { label: __("Liste", "booked"), value: "list" },
                { label: __("Accordéons", "booked"), value: "accordion" },
                { label: __("Cards", "booked"), value: "cards" },
              ],
              onChange: (value) => setAttributes({ layout: value }),
            }),
            (attributes.layout || "list") === "cards"
              ? el(RangeControl, {
                  label: __("Nombre de colonnes", "booked"),
                  value: attributes.cardColumns || 3,
                  min: 1,
                  max: 4,
                  step: 1,
                  marks: [
                    { value: 1, label: "1" },
                    { value: 2, label: "2" },
                    { value: 3, label: "3" },
                    { value: 4, label: "4" },
                  ],
                  onChange: (value) => setAttributes({ cardColumns: value || 3 }),
                })
              : null,
            el(ToggleControl, {
              label: __("Afficher le titre", "booked"),
              checked: attributes.showTitle !== false,
              onChange: (value) => setAttributes({ showTitle: value }),
            }),
            el(ToggleControl, {
              label: __("Afficher les titres de sections", "booked"),
              checked: attributes.showSectionTitles !== false,
              onChange: (value) => setAttributes({ showSectionTitles: value }),
            }),
            el(ToggleControl, {
              label: __("Afficher les notes", "booked"),
              checked: attributes.showNotes !== false,
              onChange: (value) => setAttributes({ showNotes: value }),
            }),
            el(Button, { variant: "secondary", onClick: loadGites, disabled: isLoading }, __("Recharger les gîtes", "booked"))
          ),
          el(
            PanelBody,
            { title: __("Sections et rubriques", "booked"), initialOpen: false },
            isContentLoading ? el(Spinner) : null,
            contentError ? el(Notice, { status: "error", isDismissible: false }, contentError) : null,
            !isContentLoading && !contentError && sections.length === 0
              ? el("p", { className: "booked-block-help" }, __("Aucune information disponible pour ce gîte.", "booked"))
              : null,
            sections.map((section) =>
              {
                const hasNoSelection = isNoSelection(selectedSectionIds);
                const isSectionSelected = !hasNoSelection && (selectedSectionIds.length === 0 || selectedSectionIds.includes(String(section.id)));

                return el(
                  "div",
                  { key: section.id, className: "booked-block-selection" },
                  el(CheckboxControl, {
                    label: section.titre || section.id,
                    checked: isSectionSelected,
                    onChange: () =>
                      setAttributes(toggleSelectedSection(selectedSectionIds, selectedGroupIds, section, sectionIds, groupIds)),
                  }),
                  (Array.isArray(section.groupes) ? section.groupes : []).map((group) =>
                    el(CheckboxControl, {
                      key: group.id,
                      className: "booked-block-selection__group",
                      label: group.titre || group.id,
                      checked: isSectionSelected && (selectedGroupIds.length === 0 || selectedGroupIds.includes(String(group.id))),
                      disabled: !isSectionSelected,
                      onChange: () =>
                        setAttributes({
                          selectedGroupIds: toggleSelectedId(selectedGroupIds, String(group.id), groupIds),
                        }),
                    })
                  )
                );
              }
            )
          )
        ),
        el("div", blockProps, el(GiteInfoPreview, { attributes }))
      );
    },

    save() {
      return null;
    },
  });
})(window.wp);
