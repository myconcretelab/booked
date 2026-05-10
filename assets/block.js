(function (wp) {
  const { createBlock, registerBlockType } = wp.blocks;
  const { BlockControls, InnerBlocks, InspectorControls, RichText, useBlockProps } = wp.blockEditor;
  const { Button, CheckboxControl, DropdownMenu, Notice, PanelBody, RangeControl, SelectControl, Spinner, TextControl, ToggleControl, ToolbarGroup } = wp.components;
  const { createElement: el, Fragment, useEffect, useRef, useState } = wp.element;
  const { __ } = wp.i18n;
  const apiFetch = wp.apiFetch;
  const NO_SELECTION_ID = "__booked_no_selection__";
  const DEFAULT_GITE_META_KEY = "_booked_default_gite_id";

  const normalizeGites = (payload) => {
    const items = payload && Array.isArray(payload.gites) ? payload.gites : [];
    return items.map((item) => ({
      id: String(item.id || ""),
      name: item.name || item.nom || item.id,
      capacity: item.capacity || item.capacite_max || null,
      prefix: item.prefix || item.prefixe || "",
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

  const useGiteVariables = (giteId) => {
    const [variables, setVariables] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const loadVariables = () => {
      if (!giteId) {
        setVariables([]);
        setError("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");
      apiFetch({ path: `/booked/v1/gites/${encodeURIComponent(giteId)}/variables?refresh=1` })
        .then((payload) => {
          setVariables(payload && Array.isArray(payload.variables) ? payload.variables : []);
          setIsLoading(false);
        })
        .catch((apiError) => {
          setVariables([]);
          setError(apiError.message || __("Impossible de charger les variables du gîte.", "booked"));
          setIsLoading(false);
        });
    };

    useEffect(loadVariables, [giteId]);

    return { variables, isLoading, error, loadVariables };
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

  registerBlockType("booked/accordion", {
    attributes: {
      summary: {
        type: "string",
        source: "html",
        selector: "summary",
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

    edit({ attributes, setAttributes }) {
      const blockProps = useBlockProps({ className: "booked-block booked-block--text" });
      const { gites, isLoading, error, loadGites } = useGites();
      const { variables, isLoading: isVariablesLoading, error: variablesError, loadVariables } = useGiteVariables(attributes.giteId || "");

      const insertVariable = (token) => {
        setAttributes({ content: appendToken(attributes.content, token) });
      };

      const variableControls = getVariableControls(variables, insertVariable);

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
                  title: attributes.giteId
                    ? __("Aucune variable disponible", "booked")
                    : __("Sélectionnez un gîte", "booked"),
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
            el(Button, { variant: "secondary", onClick: loadGites, disabled: isLoading }, __("Recharger les gîtes", "booked"))
          ),
          el(
            PanelBody,
            { title: __("Variables", "booked"), initialOpen: true },
            !attributes.giteId
              ? el("p", { className: "booked-block-help" }, __("Sélectionnez un gîte pour afficher ses variables.", "booked"))
              : null,
            isVariablesLoading ? el(Spinner) : null,
            variablesError ? el(Notice, { status: "error", isDismissible: false }, variablesError) : null,
            attributes.giteId && !isVariablesLoading && !variablesError && variables.length === 0
              ? el("p", { className: "booked-block-help" }, __("Aucune variable disponible pour ce gîte.", "booked"))
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
            attributes.giteId
              ? el(Button, { variant: "secondary", onClick: loadVariables, disabled: isVariablesLoading }, __("Recharger les variables", "booked"))
              : null
          )
        ),
        el(
          "div",
          blockProps,
          el(RichText, {
            tagName: "p",
            className: "booked-text__editor",
            value: attributes.content || "",
            placeholder: attributes.placeholder || __("Rédigez votre texte Booked...", "booked"),
            onChange: (content) => setAttributes({ content }),
          })
        )
      );
    },

    save() {
      return null;
    },
  });

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
