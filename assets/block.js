(function (wp) {
  const { registerBlockType } = wp.blocks;
  const { InspectorControls, useBlockProps } = wp.blockEditor;
  const { Button, CheckboxControl, Notice, PanelBody, RangeControl, SelectControl, Spinner, TextControl, ToggleControl } = wp.components;
  const { createElement: el, Fragment, useEffect, useRef, useState } = wp.element;
  const { __ } = wp.i18n;
  const apiFetch = wp.apiFetch;
  const NO_SELECTION_ID = "__booked_no_selection__";

  const normalizeGites = (payload) => {
    const items = payload && Array.isArray(payload.gites) ? payload.gites : [];
    return items.map((item) => ({
      id: String(item.id || ""),
      name: item.name || item.nom || item.id,
      capacity: item.capacity || item.capacite_max || null,
    })).filter((item) => item.id);
  };

  const useGites = () => {
    const [gites, setGites] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const loadGites = () => {
      setIsLoading(true);
      setError("");
      apiFetch({ path: "/booked/v1/gites" })
        .then((payload) => {
          setGites(normalizeGites(payload));
          setIsLoading(false);
        })
        .catch((apiError) => {
          setError(apiError.message || __("Impossible de charger les gîtes.", "booked"));
          setIsLoading(false);
        });
    };

    useEffect(loadGites, []);

    return { gites, isLoading, error, loadGites };
  };

  const getGiteOptions = (gites) => [
    { label: __("Sélectionner un gîte", "booked"), value: "" },
    ...gites.map((gite) => ({
      label: gite.capacity ? `${gite.name} (${gite.capacity} pers.)` : gite.name,
      value: gite.id,
    })),
  ];

  const normalizeIdList = (value) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);
  const isNoSelection = (value) => normalizeIdList(value).includes(NO_SELECTION_ID);
  const withoutNoSelection = (value) => normalizeIdList(value).filter((id) => id !== NO_SELECTION_ID);

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

    useEffect(() => {
      if (!ref.current || !attributes.giteId || !window.BookedWidget) return;
      ref.current.dataset.bookedInitialized = "0";
      window.BookedWidget.render(ref.current);
    }, [attributes.giteId, attributes.mode, attributes.months, attributes.showTitle, attributes.showCapacity]);

    if (!attributes.giteId) {
      return el("div", { className: "booked-block-placeholder" }, __("Sélectionnez un gîte dans les réglages du bloc.", "booked"));
    }

    return el("div", {
      ref,
      className: "booked-widget",
      "data-gite-id": attributes.giteId,
      "data-mode": attributes.mode,
      "data-months": String(attributes.months || 2),
      "data-show-title": attributes.showTitle ? "1" : "0",
      "data-show-capacity": attributes.showCapacity ? "1" : "0",
    });
  };

  const GiteInfoPreview = ({ attributes }) => {
    const ref = useRef(null);

    useEffect(() => {
      if (!ref.current || !attributes.giteId || !window.BookedGiteInfo) return;
      ref.current.dataset.bookedInfoInitialized = "0";
      window.BookedGiteInfo.render(ref.current);
    }, [
      attributes.giteId,
      attributes.layout,
      attributes.cardColumns,
      JSON.stringify(attributes.selectedSectionIds || []),
      JSON.stringify(attributes.selectedGroupIds || []),
      attributes.showTitle,
      attributes.showSectionTitles,
      attributes.showNotes,
    ]);

    if (!attributes.giteId) {
      return el("div", { className: "booked-block-placeholder" }, __("Sélectionnez un gîte dans les réglages du bloc.", "booked"));
    }

    return el("div", {
      ref,
      className: "booked-gite-info",
      "data-gite-id": attributes.giteId,
      "data-layout": attributes.layout || "list",
      "data-card-columns": String(attributes.cardColumns || 3),
      "data-selected-section-ids": JSON.stringify(attributes.selectedSectionIds || []),
      "data-selected-group-ids": JSON.stringify(attributes.selectedGroupIds || []),
      "data-show-title": attributes.showTitle === false ? "0" : "1",
      "data-show-section-titles": attributes.showSectionTitles === false ? "0" : "1",
      "data-show-notes": attributes.showNotes === false ? "0" : "1",
    });
  };

  registerBlockType("booked/widget", {
    edit({ attributes, setAttributes }) {
      const blockProps = useBlockProps({ className: "booked-block" });
      const { gites, isLoading, error, loadGites } = useGites();

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
              options: getGiteOptions(gites),
              onChange: (value) => setAttributes({ giteId: value }),
            }),
            error
              ? el(TextControl, {
                  label: __("ID du gîte", "booked"),
                  value: attributes.giteId || "",
                  help: __("Saisie manuelle disponible si la liste API est indisponible.", "booked"),
                  onChange: (value) => setAttributes({ giteId: value }),
                })
              : null,
            el(SelectControl, {
              label: __("Mode", "booked"),
              value: attributes.mode || "booking",
              options: [
                { label: __("Calendrier + formulaire", "booked"), value: "booking" },
                { label: __("Calendrier seul", "booked"), value: "calendar" },
              ],
              onChange: (value) => setAttributes({ mode: value }),
            }),
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

  registerBlockType("booked/gite-info", {
    edit({ attributes, setAttributes }) {
      const blockProps = useBlockProps({ className: "booked-block booked-block--gite-info" });
      const { gites, isLoading, error, loadGites } = useGites();
      const [content, setContent] = useState(null);
      const [contentError, setContentError] = useState("");
      const [isContentLoading, setIsContentLoading] = useState(false);

      useEffect(() => {
        if (!attributes.giteId) {
          setContent(null);
          setContentError("");
          return;
        }

        setIsContentLoading(true);
        setContentError("");
        apiFetch({ path: `/booked/v1/gites/${encodeURIComponent(attributes.giteId)}/content` })
          .then((payload) => {
            setContent(payload);
            setIsContentLoading(false);
          })
          .catch((apiError) => {
            setContent(null);
            setContentError(apiError.message || __("Impossible de charger les infos du gîte.", "booked"));
            setIsContentLoading(false);
          });
      }, [attributes.giteId]);

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
              options: getGiteOptions(gites),
              onChange: (value) => setAttributes({ giteId: value, selectedSectionIds: [NO_SELECTION_ID], selectedGroupIds: [NO_SELECTION_ID] }),
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
