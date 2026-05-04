(function (wp) {
  const { registerBlockType } = wp.blocks;
  const { InspectorControls, useBlockProps } = wp.blockEditor;
  const { Button, Notice, PanelBody, RangeControl, SelectControl, Spinner, TextControl, ToggleControl } = wp.components;
  const { createElement: el, Fragment, useEffect, useRef, useState } = wp.element;
  const { __ } = wp.i18n;
  const apiFetch = wp.apiFetch;

  const normalizeGites = (payload) => {
    const items = payload && Array.isArray(payload.gites) ? payload.gites : [];
    return items.map((item) => ({
      id: String(item.id || ""),
      name: item.name || item.nom || item.id,
      capacity: item.capacity || item.capacite_max || null,
    })).filter((item) => item.id);
  };

  const Preview = ({ attributes }) => {
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

  registerBlockType("booked/widget", {
    edit({ attributes, setAttributes }) {
      const blockProps = useBlockProps({ className: "booked-block" });
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

      const giteOptions = [
        { label: __("Sélectionner un gîte", "booked"), value: "" },
        ...gites.map((gite) => ({
          label: gite.capacity ? `${gite.name} (${gite.capacity} pers.)` : gite.name,
          value: gite.id,
        })),
      ];

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
              options: giteOptions,
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
        el("div", blockProps, el(Preview, { attributes }))
      );
    },

    save() {
      return null;
    },
  });
})(window.wp);
