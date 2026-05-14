(function () {
  const config = window.BookedWidgetConfig || {};
  const SELECTION_EVENT = "booked:selection-change";
  const DEFAULT_PERIOD_COLORS = {
    school_holiday: "#22c55e",
    bridge: "#f97316",
    july_august: "#0ea5e9",
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (value) => {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat("fr-FR").format(date) : "";
  };

  const formatShortDisplayDate = (value) => {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(date) : "";
  };

  const getNightCount = (startValue, endValue) => {
    const start = parseDate(startValue);
    const end = parseDate(endValue);
    if (!start || !end || end <= start) return 0;
    return Math.round((end - start) / 86400000);
  };

  const formatTotalPrice = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  };

  const parseDate = (value) => {
    if (!value) return null;
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const addDays = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };

  const addMonths = (date, months) => {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months, 1);
    return next;
  };

  const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const getQuoteTotal = (quote) => {
    if (!quote) return 0;
    const totalKey = ["total_global", "total", "montant_total", "montant"].find((key) => quote[key] !== undefined);
    return Number(totalKey ? quote[totalKey] : 0);
  };

  const getDefaultOptionsPayload = (travelers = 0) => ({
    draps: { enabled: false, nb_lits: 0 },
    linge_toilette: { enabled: false, nb_personnes: Number(travelers || 0) },
    menage: { enabled: false },
    depart_tardif: { enabled: false },
    chiens: { enabled: false, nb: 0 },
  });

  const publishSelection = (source, giteId, selectedStart, selectedEnd, travelers) => {
    document.dispatchEvent(new CustomEvent(SELECTION_EVENT, {
      detail: {
        source,
        giteId: String(giteId || ""),
        selectedStart: selectedStart || "",
        selectedEnd: selectedEnd || "",
        travelers: Number(travelers || 1),
      },
    }));
  };

  const log = (...args) => {
    if (config.debug) {
      console.log("[booked]", ...args);
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
      queryParams.forEach((value, key) => {
        url.searchParams.append(key, value);
      });
    }

    return url.toString();
  };

  const apiFetch = async (path, options) => {
    const response = await fetch(buildApiUrl(path), {
      method: options?.method || "GET",
      headers: {
        "Content-Type": "application/json",
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Erreur Booked.");
    }
    return payload;
  };

  const getBlockedDays = (availability) => {
    const blockedDays = new Map();
    (availability.blocked_ranges || []).forEach((item) => {
      const start = parseDate(item.date_entree);
      const end = parseDate(item.date_sortie);
      if (!start || !end) return;

      for (let day = start; day < end; day = addDays(day, 1)) {
        blockedDays.set(formatDate(day), item.type === "booking_request" ? "option" : "booked");
      }
    });
    return blockedDays;
  };

  const normalizeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "").trim())
    ? String(value).trim()
    : fallback;

  const getPeriodColors = (root) => ({
    school_holiday: normalizeColor(root.dataset.holidayColor, DEFAULT_PERIOD_COLORS.school_holiday),
    bridge: normalizeColor(root.dataset.bridgeColor, DEFAULT_PERIOD_COLORS.bridge),
    july_august: normalizeColor(root.dataset.summerColor, DEFAULT_PERIOD_COLORS.july_august),
  });

  const shouldShowPeriodColors = (root) => root.dataset.showPeriodColors !== "0";

  const getNightMinimum = (value) => {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
    const match = String(value).match(/\d+/);
    return match ? Math.max(0, Number(match[0])) : 0;
  };

  const normalizeDataKey = (value) =>
    String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const flattenScalars = (value, prefix = "", output = {}) => {
    if (!value || typeof value !== "object") return output;

    Object.entries(value).forEach(([key, item]) => {
      const normalizedKey = normalizeDataKey(key);
      if (!normalizedKey) return;
      const path = prefix ? `${prefix}.${normalizedKey}` : normalizedKey;
      if (item && typeof item === "object" && !Array.isArray(item)) {
        flattenScalars(item, path, output);
        return;
      }
      if (Array.isArray(item)) return;
      output[path] = item;
    });

    return output;
  };

  const getMinimumNightsFromObject = (value, keys) => {
    const flat = flattenScalars(value);
    const normalizedKeys = keys.map(normalizeDataKey).filter(Boolean);

    for (const key of normalizedKeys) {
      const exact = getNightMinimum(flat[key]);
      if (exact > 0) return exact;
    }

    for (const key of normalizedKeys) {
      const matchingPath = Object.keys(flat).find((path) => path.endsWith(`.${key}`));
      const nights = getNightMinimum(flat[matchingPath]);
      if (nights > 0) return nights;
    }

    return 0;
  };

  const getPeriodItemMinimumNights = (item) => {
    const nights = getMinimumNightsFromObject(item, [
      "minimum_nights",
      "min_nights",
      "nb_nuits_minimum",
      "minimum_nuits",
      "min_nuits",
      "nights_minimum",
    ]);

    return nights || getNightMinimum(item?.label);
  };

  const getConfigMinimumNights = (type, giteConfig) => {
    const keysByType = {
      school_holiday: ["nb_nuits_minimum_vacances_scolaires", "min_nuits_vacances_scolaires"],
      bridge: ["nb_nuits_minimum_ponts", "min_nuits_ponts", "nb_nuits_minimum_toute_annee", "min_nuits_toute_annee"],
      july_august: ["nb_nuits_minimum_juillet_aout", "min_nuits_juillet_aout"],
    };

    return getMinimumNightsFromObject(giteConfig, keysByType[type] || []);
  };

  const formatMinimumNights = (nights) => `${nights} nuit${nights > 1 ? "s" : ""} minimum`;

  const getPeriodDays = (availability) => {
    const periodDays = new Map();
    (availability.calendar_periods || []).forEach((item) => {
      const start = parseDate(item.start);
      const end = parseDate(item.end);
      const type = String(item.type || "");
      if (!start || !end || !DEFAULT_PERIOD_COLORS[type]) return;

      for (let day = start; day < end; day = addDays(day, 1)) {
        periodDays.set(formatDate(day), {
          type,
          label: String(item.label || ""),
          minimumNights: getPeriodItemMinimumNights(item),
        });
      }
    });
    return periodDays;
  };

  const getDayStatus = (day, blockedDays) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (day < today) return "past";
    return blockedDays.get(formatDate(day)) || "free";
  };

  const renderMonth = (monthDate, blockedDays, periodDays, periodColors, selectedStart, selectedEnd, onDayClick, showPeriodColors = true) => {
    const month = startOfMonth(monthDate);
    const monthEnd = endOfMonth(month);
    const firstWeekday = (month.getDay() + 6) % 7;
    const monthElement = createElement("section", "booked-widget__month");
    const title = createElement(
      "h5",
      "booked-widget__month-title",
      new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(month)
    );
    monthElement.appendChild(title);

    const grid = createElement("div", "booked-widget__calendar-grid");
    let dateCells = 0;
    ["L", "M", "M", "J", "V", "S", "D"].forEach((label) => {
      grid.appendChild(createElement("div", "booked-widget__weekday", label));
    });

    for (let i = 0; i < firstWeekday; i += 1) {
      grid.appendChild(createElement("div", "booked-widget__day booked-widget__day--empty"));
      dateCells += 1;
    }

    for (let day = month; day <= monthEnd; day = addDays(day, 1)) {
      const status = getDayStatus(day, blockedDays);
      const dateValue = formatDate(day);
      const period = showPeriodColors && status === "free" ? periodDays.get(dateValue) : null;
      const periodClass = period ? ` booked-widget__day--period booked-widget__day--period-${period.type}` : "";
      const selectionClass =
        dateValue === selectedStart || dateValue === selectedEnd
          ? " booked-widget__day--selected"
          : selectedStart && selectedEnd && dateValue > selectedStart && dateValue < selectedEnd
            ? " booked-widget__day--in-range"
            : "";
      const button = createElement(
        "button",
        `booked-widget__day booked-widget__day--${status}${periodClass}${selectionClass}`,
        String(day.getDate())
      );
      button.type = "button";
      button.dataset.date = dateValue;
      if (period) {
        button.dataset.periodType = period.type;
        button.dataset.periodLabel = period.label;
        button.style.setProperty("--booked-period-color", periodColors[period.type] || DEFAULT_PERIOD_COLORS[period.type]);
      }
      button.disabled = status !== "free" || !onDayClick;
      button.setAttribute(
        "aria-label",
        `${dateValue} ${status === "free" ? "disponible" : status === "option" ? "option temporaire" : "indisponible"}${period?.label ? `, ${period.label}` : ""}`
      );
      if (status === "free" && onDayClick) {
        button.addEventListener("click", () => onDayClick(dateValue));
      }
      grid.appendChild(button);
      dateCells += 1;
    }

    while (dateCells < 42) {
      grid.appendChild(createElement("div", "booked-widget__day booked-widget__day--empty"));
      dateCells += 1;
    }

    monthElement.appendChild(grid);
    return monthElement;
  };

  const renderAvailabilityCalendar = (target, availability, monthCursor, monthsCount, selectedStart, selectedEnd, onNavigate, onDayClick, periodColors = DEFAULT_PERIOD_COLORS, showPeriodColors = true, giteConfig = null) => {
    const blockedDays = getBlockedDays(availability);
    const periodDays = getPeriodDays(availability);
    target.innerHTML = "";

    const toolbar = createElement("div", "booked-widget__calendar-toolbar");
    const previous = createElement("button", "booked-widget__calendar-nav", "‹");
    previous.type = "button";
    previous.setAttribute("aria-label", "Mois précédent");
    previous.addEventListener("click", () => onNavigate(-1));
    const next = createElement("button", "booked-widget__calendar-nav", "›");
    next.type = "button";
    next.setAttribute("aria-label", "Mois suivant");
    next.addEventListener("click", () => onNavigate(1));
    const label = createElement("div", "booked-widget__calendar-heading", "Calendrier des disponibilités");
    toolbar.append(previous, label, next);
    target.appendChild(toolbar);

    const months = createElement("div", "booked-widget__months");
    months.style.setProperty("--booked-month-count", String(Math.min(monthsCount, 3)));
    for (let index = 0; index < monthsCount; index += 1) {
      months.appendChild(renderMonth(addMonths(monthCursor, index), blockedDays, periodDays, periodColors, selectedStart, selectedEnd, onDayClick, showPeriodColors));
    }
    target.appendChild(months);

    const legend = createElement("div", "booked-widget__legend");
    [
      ["free", "Disponible"],
      ["booked", "Réservé"],
      ["option", "Option"],
    ].forEach(([status, labelText]) => {
      const item = createElement("span", "booked-widget__legend-item");
      item.appendChild(createElement("span", `booked-widget__legend-dot booked-widget__legend-dot--${status}`));
      item.appendChild(createElement("span", "", labelText));
      legend.appendChild(item);
    });
    if (showPeriodColors) {
      [
        "school_holiday",
        "bridge",
        "july_august",
      ].forEach((type) => {
        const period = Array.from(periodDays.values()).find((periodItem) => periodItem.type === type);
        if (!period) return;
        const minimumNights = period.minimumNights || getConfigMinimumNights(type, giteConfig);
        const labelText = minimumNights > 0 ? formatMinimumNights(minimumNights) : "";
        if (!labelText) return;
        const item = createElement("span", "booked-widget__legend-item");
        const dot = createElement("span", "booked-widget__legend-dot booked-widget__legend-dot--period");
        dot.style.setProperty("--booked-period-color", periodColors[type] || DEFAULT_PERIOD_COLORS[type]);
        item.appendChild(dot);
        item.appendChild(createElement("span", "", labelText));
        legend.appendChild(item);
      });
    }
    target.appendChild(legend);
  };

  const renderWidget = async (root) => {
    if (root._bookedSelectionHandler) {
      document.removeEventListener(SELECTION_EVENT, root._bookedSelectionHandler);
      root._bookedSelectionHandler = null;
    }

    const giteId = root.dataset.giteId;
    const monthsCount = Math.max(1, Math.min(12, Number(root.dataset.months || 2)));
    const showTitle = root.dataset.showTitle !== "0";
    const showCapacity = root.dataset.showCapacity !== "0";
    const periodColors = getPeriodColors(root);
    const showPeriodColors = shouldShowPeriodColors(root);
    let selectedStart = root.dataset.selectedStart || "";
    let selectedEnd = root.dataset.selectedEnd || "";
    const initialMonth = root.dataset.monthCursor ? parseDate(root.dataset.monthCursor) : startOfMonth(new Date());
    const monthCursor = initialMonth || startOfMonth(new Date());
    root.innerHTML = "";
    root.appendChild(createElement("div", "booked-widget__loading", "Chargement des disponibilités…"));

    try {
      const availabilityFrom = formatDate(monthCursor);
      const availabilityTo = formatDate(addDays(endOfMonth(addMonths(monthCursor, monthsCount - 1)), 1));
      const [giteConfig, availability] = await Promise.all([
        apiFetch(`/gites/${encodeURIComponent(giteId)}/config`),
        apiFetch(`/gites/${encodeURIComponent(giteId)}/availability?from=${availabilityFrom}&to=${availabilityTo}`),
      ]);

      const shell = createElement("div", "booked-widget__shell");
      if (showTitle || showCapacity) {
        const header = createElement("div", "booked-widget__header");
        if (showTitle) {
          header.appendChild(createElement("h3", "booked-widget__title", giteConfig.nom));
        }
        if (showCapacity) {
          header.appendChild(createElement("p", "booked-widget__subtitle", `Capacité max ${giteConfig.capacite_max} personnes`));
        }
        shell.appendChild(header);
      }

      const availabilityCard = createElement("div", "booked-widget__card");
      const calendar = createElement("div", "booked-widget__calendar");
      availabilityCard.appendChild(calendar);
      shell.appendChild(availabilityCard);
      const feedbackBox = createElement("div", "booked-widget__feedback");
      shell.appendChild(feedbackBox);
      root.innerHTML = "";
      root.appendChild(shell);

      let currentAvailability = availability;
      let currentMonthCursor = monthCursor;
      let isNavigating = false;

      const renderCalendar = () => {
        renderAvailabilityCalendar(
          calendar,
          currentAvailability,
          currentMonthCursor,
          monthsCount,
          selectedStart,
          selectedEnd,
          navigateCalendar,
          handleCalendarDayClick,
          periodColors,
          showPeriodColors,
          giteConfig
        );
      };

      const storeSelection = () => {
        root.dataset.selectedStart = selectedStart;
        root.dataset.selectedEnd = selectedEnd;
        publishSelection(root, giteId, selectedStart, selectedEnd, 1);
      };

      const navigateCalendar = async (direction) => {
        if (isNavigating) return;

        isNavigating = true;
        const nextMonthCursor = addMonths(currentMonthCursor, direction);
        const availabilityFrom = formatDate(nextMonthCursor);
        const availabilityTo = formatDate(addDays(endOfMonth(addMonths(nextMonthCursor, monthsCount - 1)), 1));
        calendar.setAttribute("aria-busy", "true");

        try {
          currentAvailability = await apiFetch(
            `/gites/${encodeURIComponent(giteId)}/availability?from=${availabilityFrom}&to=${availabilityTo}`
          );
          currentMonthCursor = nextMonthCursor;
          root.dataset.monthCursor = formatDate(currentMonthCursor);
          renderCalendar();
        } catch (error) {
          log("calendar navigation error", error);
          feedbackBox.textContent = error.message || "Navigation impossible.";
        } finally {
          calendar.removeAttribute("aria-busy");
          isNavigating = false;
        }
      };

      const handleCalendarDayClick = (date) => {
        if (!selectedStart || selectedEnd) {
          selectedStart = date;
          selectedEnd = "";
        } else if (date > selectedStart) {
          selectedEnd = date;
        } else {
          selectedStart = date;
          selectedEnd = "";
        }
        feedbackBox.textContent = "";
        storeSelection();
        renderCalendar();
      };

      root._bookedSelectionHandler = (event) => {
        const detail = event.detail || {};
        if (detail.source === root || String(detail.giteId || "") !== String(giteId || "")) return;

        selectedStart = detail.selectedStart || "";
        selectedEnd = detail.selectedEnd || "";
        root.dataset.selectedStart = selectedStart;
        root.dataset.selectedEnd = selectedEnd;
        renderCalendar();
      };
      document.addEventListener(SELECTION_EVENT, root._bookedSelectionHandler);

      renderCalendar();
    } catch (error) {
      log("widget error", error);
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-widget booked-widget--error", error.message || "Widget indisponible."));
    }
  };

  const renderBookingCard = async (root) => {
    if (root._bookedBookingCardCleanup) {
      root._bookedBookingCardCleanup();
      root._bookedBookingCardCleanup = null;
    }

    let giteId = String(root.dataset.giteId || "").trim();
    if (!giteId) {
      const fallbackWidget = document.querySelector(".booked-widget[data-gite-id]");
      giteId = String(fallbackWidget && fallbackWidget.dataset ? fallbackWidget.dataset.giteId || "" : "").trim();
      if (giteId) {
        root.dataset.giteId = giteId;
      }
    }

    if (!giteId) {
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-widget--error", "Ajoutez un gîte au bloc Booked Réservation ou placez-le avec un calendrier Booked."));
      return;
    }

    const showTravelers = root.dataset.showTravelers !== "0";
    const periodColors = getPeriodColors(root);
    let travelers = Math.max(1, Number(root.dataset.travelers || 1));
    let selectedStart = root.dataset.selectedStart || "";
    let selectedEnd = root.dataset.selectedEnd || "";
    let currentMonthCursor = root.dataset.monthCursor ? parseDate(root.dataset.monthCursor) : startOfMonth(new Date());
    currentMonthCursor = currentMonthCursor || startOfMonth(new Date());
    let currentAvailability = null;
    let quote = null;
    let feedback = "";
    let hasSelectionError = false;
    let isQuoting = false;
    let isSubmitting = false;
    let isPopoverOpen = false;
    let isModalOpen = false;
    let giteConfig = null;

    root.innerHTML = "";
    root.appendChild(createElement("div", "booked-widget__loading", "Chargement..."));

    const getVisibleMonths = () => 2;

    const loadAvailability = async (monthCursor) => {
      const visibleMonths = getVisibleMonths();
      const availabilityFrom = formatDate(monthCursor);
      const availabilityTo = formatDate(addDays(endOfMonth(addMonths(monthCursor, visibleMonths - 1)), 1));
      currentAvailability = await apiFetch(`/gites/${encodeURIComponent(giteId)}/availability?from=${availabilityFrom}&to=${availabilityTo}`);
      currentMonthCursor = monthCursor;
      root.dataset.monthCursor = formatDate(currentMonthCursor);
    };

    const storeSelection = (shouldPublish = true) => {
      root.dataset.selectedStart = selectedStart;
      root.dataset.selectedEnd = selectedEnd;
      root.dataset.travelers = String(travelers);
      if (shouldPublish) {
        publishSelection(root, giteId, selectedStart, selectedEnd, travelers);
      }
    };

    const quotePayload = () => ({
      date_entree: selectedStart,
      date_sortie: selectedEnd,
      nb_adultes: travelers,
      nb_enfants_2_17: 0,
      options: getDefaultOptionsPayload(travelers),
    });

    const requestQuote = async (options = {}) => {
      if (!selectedStart || !selectedEnd) {
        quote = null;
        feedback = "";
        hasSelectionError = false;
        renderCard();
        return;
      }

      isQuoting = true;
      feedback = "";
      hasSelectionError = false;
      renderCard();
      try {
        quote = await apiFetch(`/gites/${encodeURIComponent(giteId)}/quote`, {
          method: "POST",
          body: quotePayload(),
        });
        feedback = "";
        hasSelectionError = false;
        if (options.closePopoverOnSuccess) {
          isPopoverOpen = false;
        }
      } catch (error) {
        quote = null;
        feedback = error.message || "Prix indisponible.";
        hasSelectionError = true;
        if (options.keepPopoverOpenOnError) {
          isPopoverOpen = true;
          isModalOpen = false;
        }
      } finally {
        isQuoting = false;
        renderCard();
      }
    };

    const closeFloatingUi = () => {
      if (!isPopoverOpen && !isModalOpen) return;
      isPopoverOpen = false;
      isModalOpen = false;
      renderCard();
    };

    const handleOutsideClick = (event) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (!isPopoverOpen || path.includes(root) || root.contains(event.target)) return;
      isPopoverOpen = false;
      renderCard();
    };

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      closeFloatingUi();
    };

    const handleResize = () => {
      if (isPopoverOpen) {
        void loadAvailability(currentMonthCursor).then(renderCard).catch((error) => {
          feedback = error.message || "Calendrier indisponible.";
          renderCard();
        });
      }
    };

    const openPopover = () => {
      isPopoverOpen = true;
      isModalOpen = false;
      const startDate = parseDate(selectedStart);
      if (startDate) {
        const nextMonthCursor = startOfMonth(startDate);
        if (formatDate(nextMonthCursor) !== formatDate(currentMonthCursor)) {
          void loadAvailability(nextMonthCursor).then(renderCard).catch((error) => {
            feedback = error.message || "Calendrier indisponible.";
            renderCard();
          });
        }
      }
      renderCard();
    };

    const clearDates = () => {
      selectedStart = "";
      selectedEnd = "";
      quote = null;
      feedback = "";
      hasSelectionError = false;
      storeSelection();
      renderCard();
    };

    const handleDayClick = (date) => {
      if (!selectedStart || selectedEnd) {
        selectedStart = date;
        selectedEnd = "";
        quote = null;
      } else if (date > selectedStart) {
        selectedEnd = date;
      } else {
        selectedStart = date;
        selectedEnd = "";
        quote = null;
      }
      feedback = "";
      hasSelectionError = false;
      storeSelection();
      renderCard();
      if (selectedStart && selectedEnd) {
        void requestQuote({ closePopoverOnSuccess: true, keepPopoverOpenOnError: true });
      }
    };

    const navigatePopover = async (direction) => {
      const nextMonthCursor = addMonths(currentMonthCursor, direction);
      try {
        await loadAvailability(nextMonthCursor);
        renderCard();
      } catch (error) {
        feedback = error.message || "Navigation impossible.";
        renderCard();
      }
    };

    const buildDateButton = (className, label, value, showClearIcon = false) => {
      const button = createElement("button", className);
      button.type = "button";
      button.addEventListener("click", openPopover);
      button.appendChild(createElement("span", "booked-booking-card__field-label", label));
      button.appendChild(createElement("span", "booked-booking-card__field-value", value ? formatDisplayDate(value) : "Ajouter une date"));
      if (showClearIcon && value) {
        button.appendChild(createElement("span", "booked-booking-card__field-clear", "×"));
      }
      return button;
    };

    const renderPopover = (card) => {
      const popover = createElement("div", "booked-booking-card__popover");
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-label", "Sélection des dates");

      const header = createElement("div", "booked-booking-card__popover-header");
      const intro = createElement("div", "booked-booking-card__popover-intro");
      const nights = getNightCount(selectedStart, selectedEnd);
      intro.appendChild(createElement("h3", "", nights > 0 ? `${nights} nuit${nights > 1 ? "s" : ""}` : "Sélectionnez les dates"));
      intro.appendChild(createElement(
        "p",
        "",
        selectedStart && selectedEnd
          ? `${formatShortDisplayDate(selectedStart)} - ${formatShortDisplayDate(selectedEnd)}`
          : "Ajoutez vos dates de voyage pour connaître le prix exact"
      ));

      const fields = createElement("div", "booked-booking-card__popover-fields");
      fields.appendChild(buildDateButton("booked-booking-card__popover-field", "Arrivée", selectedStart, true));
      fields.appendChild(buildDateButton("booked-booking-card__popover-field", "Départ", selectedEnd, true));
      header.append(intro, fields);
      popover.appendChild(header);

      const calendar = createElement("div", "booked-booking-card__calendar");
      if (currentAvailability) {
        renderAvailabilityCalendar(
          calendar,
          currentAvailability,
          currentMonthCursor,
          getVisibleMonths(),
          selectedStart,
          selectedEnd,
          navigatePopover,
          handleDayClick,
          periodColors,
          true,
          giteConfig
        );
      }
      popover.appendChild(calendar);

      const popoverFeedback = createElement("div", "booked-booking-card__popover-feedback", feedback);
      popoverFeedback.setAttribute("aria-live", "polite");
      popoverFeedback.setAttribute("aria-hidden", feedback ? "false" : "true");
      popover.appendChild(popoverFeedback);

      const actions = createElement("div", "booked-booking-card__popover-actions");
      const clearButton = createElement("button", "booked-booking-card__text-button", "Effacer les dates");
      clearButton.type = "button";
      clearButton.addEventListener("click", clearDates);
      const closeButton = createElement("button", "booked-booking-card__close-button", "Fermer");
      closeButton.type = "button";
      closeButton.addEventListener("click", () => {
        isPopoverOpen = false;
        renderCard();
      });
      actions.append(clearButton, closeButton);
      popover.appendChild(actions);

      card.appendChild(popover);
    };

    const renderModal = (card) => {
      const overlay = createElement("div", "booked-booking-card__modal-overlay");
      const dialog = createElement("div", "booked-booking-card__modal");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-label", "Demande de réservation");

      const closeButton = createElement("button", "booked-booking-card__modal-close", "×");
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", "Fermer");
      closeButton.addEventListener("click", () => {
        isModalOpen = false;
        renderCard();
      });

      const title = createElement("h3", "booked-booking-card__modal-title", "Demande de réservation");
      const summary = createElement(
        "p",
        "booked-booking-card__modal-summary",
        `${formatDisplayDate(selectedStart)} - ${formatDisplayDate(selectedEnd)}${quote ? ` · ${formatTotalPrice(getQuoteTotal(quote))}` : ""}`
      );

      const form = createElement("form", "booked-booking-card__modal-form");
      form.innerHTML = `
        <label>Prénom<input type="text" name="prenom" autocomplete="given-name" required></label>
        <label>Nom<input type="text" name="nom" autocomplete="family-name" required></label>
        <label>Téléphone<input type="tel" name="telephone" autocomplete="tel" required></label>
        <label>Email<input type="email" name="email" autocomplete="email" required></label>
        <div class="booked-booking-card__modal-feedback" aria-live="polite">${feedback ? escapeHtml(feedback) : ""}</div>
        <button type="submit" class="booked-booking-card__primary"${isSubmitting ? " disabled" : ""}>${isSubmitting ? "Envoi..." : "Envoyer la demande"}</button>
      `;
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        isSubmitting = true;
        feedback = "";
        renderCard();

        try {
          const prenom = String(formData.get("prenom") || "").trim();
          const nom = String(formData.get("nom") || "").trim();
          const created = await apiFetch("/requests", {
            method: "POST",
            body: Object.assign({ gite_id: giteId }, quotePayload(), {
              hote_nom: `${prenom} ${nom}`.trim(),
              telephone: String(formData.get("telephone") || "").trim(),
              email: String(formData.get("email") || "").trim(),
              message_client: "",
            }),
          });
          feedback = created && created.hold_expires_at
            ? `Demande enregistrée. Les dates sont bloquées jusqu'au ${new Date(created.hold_expires_at).toLocaleString("fr-FR")}.`
            : "Demande enregistrée.";
          isSubmitting = false;
          isModalOpen = false;
          renderCard();
        } catch (error) {
          feedback = error.message || "Envoi impossible.";
          isSubmitting = false;
          isModalOpen = true;
          renderCard();
        }
      });

      dialog.append(closeButton, title, summary, form);
      overlay.appendChild(dialog);
      overlay.addEventListener("click", (event) => {
        if (event.target !== overlay) return;
        isModalOpen = false;
        renderCard();
      });
      card.appendChild(overlay);

      window.setTimeout(() => {
        const firstInput = dialog.querySelector("input");
        if (firstInput) firstInput.focus();
      }, 0);
    };

    function renderCard() {
      root.innerHTML = "";
      const card = createElement("div", "booked-booking-card__panel");
      const hasDates = Boolean(selectedStart && selectedEnd);
      const hasQuote = Boolean(hasDates && quote);

      const title = createElement("h2", hasQuote ? "booked-booking-card__total" : "booked-booking-card__title");
      title.textContent = hasQuote ? `${formatTotalPrice(getQuoteTotal(quote))} au total` : "Indiquez vos dates pour afficher les prix";
      card.appendChild(title);

      const fields = createElement("div", "booked-booking-card__fields");
      fields.appendChild(buildDateButton("booked-booking-card__field booked-booking-card__field--arrival", "Arrivée", selectedStart));
      fields.appendChild(buildDateButton("booked-booking-card__field booked-booking-card__field--departure", "Départ", selectedEnd));

      if (showTravelers) {
        const travelersField = createElement("div", "booked-booking-card__travelers");
        travelersField.appendChild(createElement("span", "booked-booking-card__field-label", "Voyageurs"));
        const row = createElement("div", "booked-booking-card__travelers-row");
        const input = createElement("input", "booked-booking-card__travelers-input");
        input.type = "number";
        input.min = "1";
        input.max = String(giteConfig && giteConfig.capacite_max ? giteConfig.capacite_max : 99);
        input.value = String(travelers);
        input.setAttribute("aria-label", "Nombre de voyageurs");
        input.addEventListener("change", () => {
          travelers = Math.max(1, Math.min(Number(input.max || 99), Number(input.value || 1)));
          quote = null;
          feedback = "";
          hasSelectionError = false;
          storeSelection();
          renderCard();
          if (selectedStart && selectedEnd) {
            void requestQuote();
          }
        });
        row.appendChild(createElement("span", "booked-booking-card__field-value", `${travelers} voyageur${travelers > 1 ? "s" : ""}`));
        row.appendChild(input);
        travelersField.appendChild(row);
        fields.appendChild(travelersField);
      }
      card.appendChild(fields);

      const primary = createElement(
        "button",
        "booked-booking-card__primary",
        hasQuote ? "Demande de réservation" : isQuoting ? "Vérification..." : "Vérifier la disponibilité"
      );
      primary.type = "button";
      primary.disabled = isQuoting || hasSelectionError;
      primary.addEventListener("click", () => {
        if (!selectedStart || !selectedEnd) {
          openPopover();
          return;
        }
        if (!quote) {
          void requestQuote();
          return;
        }
        isPopoverOpen = false;
        isModalOpen = true;
        feedback = "";
        renderCard();
      });
      card.appendChild(primary);

      if (feedback && !isModalOpen && !isPopoverOpen) {
        card.appendChild(createElement("div", "booked-booking-card__feedback", feedback));
      }

      if (hasQuote) {
        card.appendChild(createElement("p", "booked-booking-card__small-note", "Aucun montant ne vous sera débité pour le moment"));
      }

      if (isPopoverOpen) {
        renderPopover(card);
      }
      if (isModalOpen) {
        renderModal(card);
      }

      root.appendChild(card);
    }

    try {
      const availabilityFrom = formatDate(currentMonthCursor);
      const availabilityTo = formatDate(addDays(endOfMonth(addMonths(currentMonthCursor, getVisibleMonths() - 1)), 1));
      [giteConfig, currentAvailability] = await Promise.all([
        apiFetch(`/gites/${encodeURIComponent(giteId)}/config`),
        apiFetch(`/gites/${encodeURIComponent(giteId)}/availability?from=${availabilityFrom}&to=${availabilityTo}`),
      ]);
      renderCard();

      const externalSelectionHandler = (event) => {
        const detail = event.detail || {};
        if (detail.source === root || String(detail.giteId || "") !== String(giteId || "")) return;
        selectedStart = detail.selectedStart || "";
        selectedEnd = detail.selectedEnd || "";
        travelers = Math.max(1, Number(detail.travelers || travelers || 1));
        quote = null;
        feedback = "";
        hasSelectionError = false;
        storeSelection(false);
        renderCard();
        if (selectedStart && selectedEnd) {
          void requestQuote();
        }
      };

      document.addEventListener(SELECTION_EVENT, externalSelectionHandler);
      document.addEventListener("click", handleOutsideClick);
      document.addEventListener("keydown", handleEscape);
      window.addEventListener("resize", handleResize);
      root._bookedBookingCardCleanup = () => {
        document.removeEventListener(SELECTION_EVENT, externalSelectionHandler);
        document.removeEventListener("click", handleOutsideClick);
        document.removeEventListener("keydown", handleEscape);
        window.removeEventListener("resize", handleResize);
      };
    } catch (error) {
      log("booking card error", error);
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-widget--error", error.message || "Carte de réservation indisponible."));
    }
  };

  window.BookedWidget = {
    render: renderWidget,
    initAll() {
      document.querySelectorAll(".booked-widget[data-gite-id]").forEach((root) => {
        if (root.dataset.bookedInitialized === "1") return;
        root.dataset.bookedInitialized = "1";
        renderWidget(root);
      });
    },
  };

  window.BookedBookingCard = {
    render: renderBookingCard,
    initAll() {
      document.querySelectorAll(".booked-booking-card").forEach((root) => {
        if (root.dataset.bookedBookingCardInitialized === "1") return;
        root.dataset.bookedBookingCardInitialized = "1";
        renderBookingCard(root);
      });
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".booked-widget[data-gite-id]").forEach((root) => {
      if (root.dataset.bookedInitialized === "1") return;
      root.dataset.bookedInitialized = "1";
      renderWidget(root);
    });
    document.querySelectorAll(".booked-booking-card").forEach((root) => {
      if (root.dataset.bookedBookingCardInitialized === "1") return;
      root.dataset.bookedBookingCardInitialized = "1";
      renderBookingCard(root);
    });
  });
})();
