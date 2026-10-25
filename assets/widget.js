(function () {
  const { t, locale, count } = window.BookedI18n;
  const config = window.BookedWidgetConfig || {};
  const SELECTION_EVENT = "booked:selection-change";
  const CACHE_PREFIX = "booked:api:v1:";
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
    return date ? new Intl.DateTimeFormat(locale).format(date) : "";
  };

  const formatShortDisplayDate = (value) => {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date) : "";
  };

  const getNightCount = (startValue, endValue) => {
    const start = parseDate(startValue);
    const end = parseDate(endValue);
    if (!start || !end || end <= start) return 0;
    return Math.round((end - start) / 86400000);
  };

  const formatTotalPrice = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat(locale, {
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

  const createRefreshIndicator = (label = t("Mise à jour...")) => {
    const indicator = createElement("div", "booked-refresh-indicator");
    indicator.setAttribute("role", "status");
    indicator.setAttribute("aria-live", "polite");
    indicator.appendChild(createElement("span", "booked-refresh-indicator__spinner"));
    indicator.appendChild(createElement("span", "booked-refresh-indicator__label", label));
    return indicator;
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

    url.searchParams.set("lang", window.BookedI18n.language);
    return url.toString();
  };

  const getCacheKey = (path) => `${CACHE_PREFIX}${buildApiUrl(path)}`;

  const readCachedApi = (path) => {
    try {
      const cached = window.localStorage.getItem(getCacheKey(path));
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      return parsed && Object.prototype.hasOwnProperty.call(parsed, "data") ? parsed.data : null;
    } catch (error) {
      log("cache read error", error);
      return null;
    }
  };

  const writeCachedApi = (path, data) => {
    try {
      window.localStorage.setItem(getCacheKey(path), JSON.stringify({
        savedAt: Date.now(),
        data,
      }));
    } catch (error) {
      log("cache write error", error);
    }
  };

  const apiFetch = async (path, options) => {
    const method = String(options?.method || "GET").toUpperCase();
    const response = await fetch(buildApiUrl(path), {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    }).catch(() => { throw new Error(t("Service Booked temporairement indisponible.")); });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(window.BookedI18n.error(payload));
    }
    if (method === "GET") {
      writeCachedApi(path, payload);
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

  const getDefaultMinimumNights = (giteConfig) =>
    getMinimumNightsFromObject(giteConfig, [
      "nb_nuits_minimum_toute_annee",
      "min_nuits_toute_annee",
      "minimum_nights",
      "minimum_nuits",
      "min_nights",
      "min_nuits",
      "nights_minimum",
    ]);

  const getDateMinimumNights = (dateValue, periodDays, giteConfig) => {
    const period = periodDays.get(dateValue);
    return period?.minimumNights || getConfigMinimumNights(period?.type, giteConfig) || getDefaultMinimumNights(giteConfig);
  };

  const getNextBlockedStart = (startValue, availability) => {
    if (!startValue) return "";

    return (availability?.blocked_ranges || [])
      .map((item) => String(item.date_entree || "").slice(0, 10))
      .filter((dateValue) => dateValue > startValue)
      .sort()[0] || "";
  };

  const getEffectiveDateMinimumNights = (dateValue, availability, periodDays, giteConfig) => {
    const configuredMinimum = getDateMinimumNights(dateValue, periodDays, giteConfig);
    const nextBlockedStart = getNextBlockedStart(dateValue, availability);
    const availableNights = nextBlockedStart ? getNightCount(dateValue, nextBlockedStart) : 0;

    return availableNights > 0 ? Math.min(configuredMinimum, availableNights) : configuredMinimum;
  };

  const formatMinimumNights = (nights) => count(nights, "{count} nuit minimum", "{count} nuits minimum");

  const formatMinimumNightsRequired = (nights) => count(nights, "Un minimum de {count} nuit est requis", "Un minimum de {count} nuits est requis");

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
          label: window.BookedI18n.language === "fr" ? String(item.label || "") : t({school_holiday: "Vacances scolaires", bridge: "Pont", july_august: "Juillet et août"}[type]),
          minimumNights: getPeriodItemMinimumNights(item),
        });
      }
    });
    return periodDays;
  };

  const isStayBelowMinimum = (startValue, endValue, availability, giteConfig) => {
    if (!startValue || !endValue || endValue <= startValue) return false;
    const periodDays = getPeriodDays(availability || {});
    const minimumNights = getEffectiveDateMinimumNights(startValue, availability, periodDays, giteConfig);
    return minimumNights > 1 && getNightCount(startValue, endValue) < minimumNights;
  };

  const getDayStatus = (day, blockedDays) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (day < today) return "past";
    return blockedDays.get(formatDate(day)) || "free";
  };

  const renderMonth = (monthDate, blockedDays, periodDays, periodColors, selectedStart, selectedEnd, selectedStartCheckoutDate, selectedStartMinimumNights, onDayClick, showPeriodColors = true) => {
    const month = startOfMonth(monthDate);
    const monthEnd = endOfMonth(month);
    const firstWeekday = (month.getDay() + 6) % 7;
    const monthElement = createElement("section", "booked-widget__month");
    const title = createElement(
      "h5",
      "booked-widget__month-title",
      new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month)
    );
    monthElement.appendChild(title);

    const grid = createElement("div", "booked-widget__calendar-grid");
    let dateCells = 0;
    Array.from({length: 7}, (_, i) => new Intl.DateTimeFormat(locale, {weekday: "short"}).format(new Date(2024, 0, 1 + i))).forEach((label) => {
      grid.appendChild(createElement("div", "booked-widget__weekday", label));
    });

    for (let i = 0; i < firstWeekday; i += 1) {
      grid.appendChild(createElement("div", "booked-widget__day booked-widget__day--empty"));
      dateCells += 1;
    }

    for (let day = month; day <= monthEnd; day = addDays(day, 1)) {
      const status = getDayStatus(day, blockedDays);
      const dateValue = formatDate(day);
      const isCheckoutDate = Boolean(
        selectedStart &&
        dateValue === selectedStartCheckoutDate &&
        (!selectedEnd || dateValue === selectedEnd)
      );
      const isSelectable = status === "free" || isCheckoutDate;
      const period = showPeriodColors && status === "free" ? periodDays.get(dateValue) : null;
      const periodClass = period ? ` booked-widget__day--period booked-widget__day--period-${period.type}` : "";
      const isTooShortStay =
        isSelectable &&
        selectedStart &&
        !selectedEnd &&
        dateValue > selectedStart &&
        selectedStartMinimumNights > 1 &&
        getNightCount(selectedStart, dateValue) < selectedStartMinimumNights;
      const tooShortClass = isTooShortStay ? " booked-widget__day--too-short" : "";
      const checkoutClass = isCheckoutDate ? " booked-widget__day--checkout" : "";
      const selectionClass =
        dateValue === selectedStart || dateValue === selectedEnd
          ? " booked-widget__day--selected"
          : selectedStart && selectedEnd && dateValue > selectedStart && dateValue < selectedEnd
            ? " booked-widget__day--in-range"
            : "";
      const button = createElement(
        "button",
        `booked-widget__day booked-widget__day--${status}${periodClass}${selectionClass}${tooShortClass}${checkoutClass}`,
        String(day.getDate())
      );
      button.type = "button";
      button.dataset.date = dateValue;
      if (period) {
        button.dataset.periodType = period.type;
        button.dataset.periodLabel = period.label;
        button.style.setProperty("--booked-period-color", periodColors[period.type] || DEFAULT_PERIOD_COLORS[period.type]);
      }
      if (isTooShortStay) {
        button.dataset.tooltip = formatMinimumNightsRequired(selectedStartMinimumNights);
        button.setAttribute("aria-disabled", "true");
        button.tabIndex = -1;
      }
      button.disabled = !isSelectable || !onDayClick;
      button.setAttribute(
        "aria-label",
        `${dateValue} ${isCheckoutDate ? t("départ possible, indisponible à partir de cette date") : status === "free" ? t("disponible") : status === "option" ? t("option temporaire") : t("indisponible")}${period?.label ? `, ${period.label}` : ""}${isTooShortStay ? `, ${formatMinimumNightsRequired(selectedStartMinimumNights)}` : ""}`
      );
      if (isSelectable && onDayClick && !isTooShortStay) {
        button.addEventListener("click", () => onDayClick(dateValue));
      }
      grid.appendChild(button);
      dateCells += 1;
    }

    while (dateCells % 7 !== 0) {
      grid.appendChild(createElement("div", "booked-widget__day booked-widget__day--empty"));
      dateCells += 1;
    }

    monthElement.appendChild(grid);
    return monthElement;
  };

  const renderAvailabilityCalendar = (target, availability, monthCursor, monthsCount, selectedStart, selectedEnd, onNavigate, onDayClick, periodColors = DEFAULT_PERIOD_COLORS, showPeriodColors = true, giteConfig = null) => {
    const blockedDays = getBlockedDays(availability);
    const periodDays = getPeriodDays(availability);
    const selectedStartCheckoutDate = selectedStart ? getNextBlockedStart(selectedStart, availability) : "";
    const selectedStartMinimumNights = selectedStart && !selectedEnd
      ? getEffectiveDateMinimumNights(selectedStart, availability, periodDays, giteConfig)
      : 0;
    target.innerHTML = "";

    const toolbar = createElement("div", "booked-widget__calendar-toolbar");
    const previous = createElement("button", "booked-widget__calendar-nav", "‹");
    previous.type = "button";
    previous.setAttribute("aria-label", t("Mois précédent"));
    previous.addEventListener("click", () => onNavigate(-1));
    const next = createElement("button", "booked-widget__calendar-nav", "›");
    next.type = "button";
    next.setAttribute("aria-label", t("Mois suivant"));
    next.addEventListener("click", () => onNavigate(1));
    const label = createElement("div", "booked-widget__calendar-heading", t("Calendrier des disponibilités"));
    toolbar.append(previous, label, next);
    target.appendChild(toolbar);

    const months = createElement("div", "booked-widget__months");
    months.style.setProperty("--booked-month-count", String(Math.min(monthsCount, 3)));
    for (let index = 0; index < monthsCount; index += 1) {
      months.appendChild(renderMonth(
        addMonths(monthCursor, index),
        blockedDays,
        periodDays,
        periodColors,
        selectedStart,
        selectedEnd,
        selectedStartCheckoutDate,
        selectedStartMinimumNights,
        onDayClick,
        showPeriodColors
      ));
    }
    target.appendChild(months);

    const legend = createElement("div", "booked-widget__legend");
    [
      ["free", t("Disponible")],
      ["booked", t("Réservé")],
      ["option", t("Option")],
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
    let currentAvailability = null;
    let currentGiteConfig = null;
    let currentMonthCursor = monthCursor;
    let isNavigating = false;
    let isRefreshing = false;
    let calendar = null;
    let feedbackBox = null;
    let shell = null;

    const getAvailabilityPath = (cursor) => {
      const availabilityMonths = Math.max(2, monthsCount);
      const availabilityFrom = formatDate(cursor);
      const availabilityTo = formatDate(addDays(endOfMonth(addMonths(cursor, availabilityMonths - 1)), 1));
      return `/gites/${encodeURIComponent(giteId)}/availability?from=${availabilityFrom}&to=${availabilityTo}`;
    };

    const configPath = `/gites/${encodeURIComponent(giteId)}/config`;
    const initialAvailabilityPath = getAvailabilityPath(monthCursor);

    const renderRefreshState = () => {
      if (!shell) return;
      Array.from(shell.children).forEach((item) => {
        if (item.classList.contains("booked-refresh-indicator")) {
          item.remove();
        }
      });
      if (isRefreshing) {
        shell.appendChild(createRefreshIndicator());
      }
    };

    const renderCalendar = () => {
      if (!calendar || !currentAvailability || !currentGiteConfig) return;
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
        currentGiteConfig
      );
      renderRefreshState();
    };

    const renderShell = () => {
      shell = createElement("div", "booked-widget__shell");
      if (showTitle || showCapacity) {
        const header = createElement("div", "booked-widget__header");
        if (showTitle) {
          header.appendChild(createElement("h3", "booked-widget__title", currentGiteConfig.nom));
        }
        if (showCapacity) {
          header.appendChild(createElement("p", "booked-widget__subtitle", t("Capacité max {count} personnes", {count: currentGiteConfig.capacite_max})));
        }
        shell.appendChild(header);
      }

      const availabilityCard = createElement("div", "booked-widget__card");
      calendar = createElement("div", "booked-widget__calendar");
      availabilityCard.appendChild(calendar);
      shell.appendChild(availabilityCard);
      feedbackBox = createElement("div", "booked-widget__feedback");
      shell.appendChild(feedbackBox);
      root.innerHTML = "";
      root.appendChild(shell);
      renderCalendar();
    };

    const applyData = (giteConfig, availability, nextMonthCursor = currentMonthCursor) => {
      currentGiteConfig = giteConfig;
      currentAvailability = availability;
      currentMonthCursor = nextMonthCursor;
      root.dataset.monthCursor = formatDate(currentMonthCursor);
      renderShell();
    };

    const storeSelection = () => {
      root.dataset.selectedStart = selectedStart;
      root.dataset.selectedEnd = selectedEnd;
      publishSelection(root, giteId, selectedStart, selectedEnd, 1);
    };

    async function navigateCalendar(direction) {
      if (isNavigating) return;

      isNavigating = true;
      const nextMonthCursor = addMonths(currentMonthCursor, direction);
      const availabilityPath = getAvailabilityPath(nextMonthCursor);
      const cachedAvailability = readCachedApi(availabilityPath);
      const previousAvailability = currentAvailability;
      const previousMonthCursor = currentMonthCursor;
      if (calendar) {
        calendar.setAttribute("aria-busy", "true");
      }

      if (cachedAvailability) {
        currentAvailability = cachedAvailability;
        currentMonthCursor = nextMonthCursor;
        root.dataset.monthCursor = formatDate(currentMonthCursor);
        isRefreshing = true;
        renderCalendar();
      }

      try {
        currentAvailability = await apiFetch(availabilityPath);
        currentMonthCursor = nextMonthCursor;
        root.dataset.monthCursor = formatDate(currentMonthCursor);
        feedbackBox.textContent = "";
        renderCalendar();
      } catch (error) {
        log("calendar navigation error", error);
        if (!cachedAvailability) {
          currentAvailability = previousAvailability;
          currentMonthCursor = previousMonthCursor;
          root.dataset.monthCursor = formatDate(currentMonthCursor);
          renderCalendar();
        }
        feedbackBox.textContent = error.message || t("Navigation impossible.");
      } finally {
        isRefreshing = false;
        if (calendar) {
          calendar.removeAttribute("aria-busy");
        }
        renderRefreshState();
        isNavigating = false;
      }
    }

    function handleCalendarDayClick(date) {
      if (date === selectedEnd) {
        selectedEnd = "";
      } else if (date === selectedStart) {
        selectedStart = "";
        selectedEnd = "";
      } else if (!selectedStart || selectedEnd) {
        selectedStart = date;
        selectedEnd = "";
      } else if (date > selectedStart) {
        if (isStayBelowMinimum(selectedStart, date, currentAvailability, currentGiteConfig)) return;
        selectedEnd = date;
      } else {
        selectedStart = date;
        selectedEnd = "";
      }
      feedbackBox.textContent = "";
      storeSelection();
      renderCalendar();
    }

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

    const cachedConfig = readCachedApi(configPath);
    const cachedAvailability = readCachedApi(initialAvailabilityPath);
    if (cachedConfig && cachedAvailability) {
      isRefreshing = true;
      applyData(cachedConfig, cachedAvailability, monthCursor);
    } else {
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-widget__loading", t("Chargement des disponibilités…")));
    }

    try {
      const [giteConfig, availability] = await Promise.all([
        apiFetch(configPath),
        apiFetch(initialAvailabilityPath),
      ]);
      isRefreshing = false;
      applyData(giteConfig, availability, monthCursor);
    } catch (error) {
      log("widget error", error);
      if (cachedConfig && cachedAvailability) {
        isRefreshing = false;
        renderRefreshState();
        if (feedbackBox) {
          feedbackBox.textContent = error.message || t("Mise à jour impossible.");
        }
        return;
      }
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-widget booked-widget--error", error.message || t("Widget indisponible.")));
    }
  };

  const confirmationUrl = (value) => {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
    } catch { return ""; }
  };

  const appendConfirmationMessage = (parent, text) => {
    String(text || "").split(/\n\s*\n/).filter(Boolean).forEach(block => {
      const paragraph = createElement("p");
      const parts = block.split(/(https?:\/\/[^\s<>"']+)/g);
      parts.forEach(part => {
        const url = confirmationUrl(part);
        if (!url) { paragraph.appendChild(document.createTextNode(part)); return; }
        const link = createElement("a", "", part);
        link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
        paragraph.appendChild(link);
      });
      parent.appendChild(paragraph);
    });
  };

  const confirmationHomeLink = (returnStorage) => {
    const home = createElement("a", "booked-confirmation__home", t("Retour au site")); home.href = "/";
    home.addEventListener("click", () => { try { sessionStorage.removeItem(returnStorage); } catch { /* Storage is optional. */ } });
    return home;
  };

  const renderBookingConfirmation = (panel, result, returnStorage) => {
    const data = result.confirmation;
    panel.replaceChildren();
    panel.classList.add("booked-payment-return--confirmed");
    const heading = createElement("header", "booked-confirmation__heading");
    if (data?.brand) {
      const brand = createElement("div", "booked-confirmation__brand");
      const logo = confirmationUrl(data.brand.logo_url);
      if (logo) {
        const img = createElement("img"); img.src = logo; img.alt = "";
        img.width = 56; img.height = 56;
        brand.appendChild(img);
      }
      brand.appendChild(createElement("span", "", data.brand.name));
      heading.appendChild(brand);
    }
    heading.appendChild(createElement("span", "booked-confirmation__badge", t("Réservation confirmée")));
    panel.appendChild(heading);
    const hero = createElement("div", "booked-confirmation__hero");
    const photo = confirmationUrl(data?.gite?.photo_url);
    if (photo) {
      const img = createElement("img", "booked-confirmation__photo");
      img.src = photo; img.alt = data.gite.photo_alt || data.gite.name || "";
      hero.appendChild(img);
    }
    const introduction = createElement("div", "booked-confirmation__intro");
    introduction.appendChild(createElement("span", "booked-confirmation__eyebrow", t("Au plaisir de vous accueillir")));
    const title = createElement("h2", "", t("Votre réservation est confirmée !")); title.id = "booked-confirmation-title";
    introduction.appendChild(title);
    if (data?.gite?.name) introduction.appendChild(createElement("p", "booked-confirmation__gite", data.gite.name));
    introduction.appendChild(createElement("p", "booked-confirmation__notice", t("Un email de confirmation vous est envoyé avec le détail de votre séjour.")));
    hero.appendChild(introduction); panel.appendChild(hero);
    const content = createElement("div", "booked-confirmation__content");
    if (data?.stay) {
      const stay = createElement("dl", "booked-confirmation__stay");
      const travelers = [count(data.stay.adults, "{count} adulte", "{count} adultes")];
      if (data.stay.children) travelers.push(count(data.stay.children, "{count} enfant", "{count} enfants"));
      for (const [label, value] of [[t("Arrivée"), formatShortDisplayDate(data.stay.arrival)], [t("Départ"), formatShortDisplayDate(data.stay.departure)], [t("Votre séjour"), count(data.stay.nights, "{count} nuit", "{count} nuits") + " · " + travelers.join(", ")]]) {
        const fact = createElement("div");
        fact.append(createElement("dt", "", label), createElement("dd", "", value)); stay.appendChild(fact);
      }
      content.appendChild(stay);
    }
    const payment = createElement("section", "booked-confirmation__payment");
    payment.appendChild(createElement("h3", "", t("Votre règlement")));
    const amounts = createElement("dl");
    const lines = [[t("Total du séjour"), result.total], [t(result.purpose === "deposit" ? "Arrhes déjà réglées" : "Déjà réglé par carte"), result.amount_paid], [t("Solde à régler sur place"), result.remaining]];
    lines.forEach(([label, amount]) => {
      if (typeof amount !== "number" || !Number.isFinite(amount)) return;
      const line = createElement("div");
      line.append(createElement("dt", "", label), createElement("dd", "", formatTotalPrice(amount))); amounts.appendChild(line);
    });
    payment.appendChild(amounts);
    if (result.remaining === 0) payment.appendChild(createElement("p", "booked-confirmation__paid", t("Votre séjour est réglé en totalité.")));
    content.appendChild(payment);
    if (data?.options?.length) {
      const options = createElement("section", "booked-confirmation__options");
      options.appendChild(createElement("h3", "", t("Options choisies")));
      const list = createElement("ul"); data.options.forEach(line => list.appendChild(createElement("li", "", line)));
      options.appendChild(list); content.appendChild(options);
    }
    if (data?.gite?.address) {
      const address = createElement("section", "booked-confirmation__address");
      address.append(createElement("h3", "", t("Adresse du gîte")), createElement("p", "", data.gite.address)); content.appendChild(address);
    }
    if (data?.message?.text) {
      const details = createElement("details", "booked-confirmation__message");
      details.appendChild(createElement("summary", "", t("Votre message de confirmation et nos conseils pour le séjour")));
      const body = createElement("div"); appendConfirmationMessage(body, data.message.text);
      details.appendChild(body); content.appendChild(details);
    }
    const footer = createElement("footer", "booked-confirmation__footer");
    if (result.reference) footer.appendChild(createElement("small", "", t("Référence : {reference}", {reference: result.reference})));
    footer.appendChild(confirmationHomeLink(returnStorage)); content.appendChild(footer); panel.appendChild(content);
    panel.setAttribute("aria-labelledby", title.id);
  };

  const showPaymentReturn = async () => {
    const confirmationRoot = document.querySelector(".booked-confirmation-root");
    const placeholder = confirmationRoot?.querySelector(".booked-confirmation-placeholder");
    if (placeholder) placeholder.textContent = t("Votre confirmation s’affichera ici après le paiement.");
    let values = new URLSearchParams(window.location.hash.slice(1));
    const returnStorage = "booked-payment-return-v2";
    try {
      if (values.has("booked_payment") && values.has("token")) {
        sessionStorage.setItem(returnStorage, JSON.stringify({ value: values.toString(), at: Date.now(), path: window.location.pathname }));
      } else {
        const saved = JSON.parse(sessionStorage.getItem(returnStorage) || "null");
        if (saved && saved.path === window.location.pathname && Date.now() - saved.at < 60 * 60 * 1000) values = new URLSearchParams(saved.value);
      }
    } catch { /* The confirmation still works when browser storage is unavailable. */ }
    const id = values.get("booked_payment"), token = values.get("token");
    if (!id || !token) return;
    // Keep the capability out of server access logs, referrers and the visible URL.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const panel = createElement("section", "booked-payment-return");
    panel.setAttribute("role", "region"); panel.tabIndex = -1;
    const title = createElement("h2", "", t("Vérification de votre paiement…"));
    title.id = "booked-confirmation-title"; panel.setAttribute("aria-labelledby", title.id);
    const text = createElement("p", "", t("Nous vérifions le paiement auprès de Stripe. Patientez quelques instants."));
    panel.append(title, text);
    const bookingForms = Array.from(document.querySelectorAll(".booked-booking-card, .booked-widget[data-gite-id]"));
    bookingForms.forEach(form => { form.hidden = true; });
    const card = document.querySelector(".booked-booking-card");
    if (confirmationRoot) confirmationRoot.replaceChildren(panel);
    else if (card) card.parentNode.insertBefore(panel, card);
    else (document.querySelector("main") || document.body).prepend(panel);
    panel.focus({ preventScroll: true });
    panel.setAttribute("aria-busy", "true");
    title.setAttribute("aria-live", "polite");
    const verify = async (cancel = false, attempt = 0) => {
      panel.setAttribute("aria-busy", "true");
      try {
        const result = await apiFetch("/payments/status", { method: "POST", body: { payment_id: id, token, cancel } });
        if (result.confirmed) {
          renderBookingConfirmation(panel, result, returnStorage);
          panel.setAttribute("aria-busy", "false");
        } else if (result.status === "expired") {
          panel.setAttribute("aria-busy", "false");
          bookingForms.forEach(form => { form.hidden = false; });
          try { sessionStorage.removeItem(returnStorage); } catch { /* Storage is optional. */ }
          title.textContent = t("Paiement annulé ou expiré");
          text.textContent = t("Votre réservation n’est pas confirmée. Vous pouvez faire une nouvelle demande.");
          panel.appendChild(confirmationHomeLink(returnStorage));
        } else if (["requires_review", "refunded", "partially_refunded"].includes(result.status)) {
          panel.setAttribute("aria-busy", "false");
          title.textContent = t("Votre paiement nécessite un suivi");
          text.textContent = t("Contactez-nous avec la référence {reference}. Aucun nouveau paiement n’est nécessaire.", { reference: result.reference });
          panel.appendChild(confirmationHomeLink(returnStorage));
        } else if (attempt < 10) {
          window.setTimeout(() => void verify(false, attempt + 1), 3000);
        } else throw new Error(t("La vérification prend plus de temps que prévu. Réessayez ici dans un instant, sans effectuer un nouveau paiement."));
      } catch (error) {
        panel.setAttribute("aria-busy", "false");
        text.textContent = error.message || t("Envoi impossible.");
        const retry = createElement("button", "booked-booking-card__primary", t("Vérifier à nouveau"));
        retry.type = "button"; retry.addEventListener("click", () => { retry.remove(); void verify(); });
        panel.appendChild(retry);
      }
    };
    await verify(values.get("result") === "cancel");
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void showPaymentReturn(), { once: true });
  else void showPaymentReturn();

  const renderBookingCard = async (root) => {
    if (root._bookedBookingCardCleanup) {
      root._bookedBookingCardCleanup();
      root._bookedBookingCardCleanup = null;
    }
    root.classList.remove("booked-booking-card--floating");

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
    let paymentChoice = "manual";
    let isRefreshing = false;
    let isPopoverOpen = false;
    let isModalOpen = false;
    let quoteSequence = 0;
    let giteContent = null;
    const selectedOptions = getDefaultOptionsPayload();
    const contact = { prenom: "", nom: "", telephone: "", email: "", message_client: "" };
    let giteConfig = null;
    let areEventsBound = false;
    let previousBodyOverflow = null;
    let previousFocus = null;

    const configuredMonths = Math.max(1, Math.min(2, Number(root.dataset.months || 2)));
    const getVisibleMonths = () => window.matchMedia("(max-width: 720px)").matches ? 1 : configuredMonths;

    const getAvailabilityPath = (monthCursor) => {
      const visibleMonths = Math.max(2, getVisibleMonths());
      const availabilityFrom = formatDate(monthCursor);
      const availabilityTo = formatDate(addDays(endOfMonth(addMonths(monthCursor, visibleMonths - 1)), 1));
      return `/gites/${encodeURIComponent(giteId)}/availability?from=${availabilityFrom}&to=${availabilityTo}`;
    };

    const loadAvailability = async (monthCursor, options = {}) => {
      const availabilityPath = getAvailabilityPath(monthCursor);
      const cachedAvailability = options.useCache === false ? null : readCachedApi(availabilityPath);
      if (cachedAvailability) {
        currentAvailability = cachedAvailability;
        currentMonthCursor = monthCursor;
        root.dataset.monthCursor = formatDate(currentMonthCursor);
        if (options.renderCached) {
          isRefreshing = true;
          renderCard();
        }
      }
      currentAvailability = await apiFetch(availabilityPath);
      currentMonthCursor = monthCursor;
      root.dataset.monthCursor = formatDate(currentMonthCursor);
    };

    const loadAvailabilityAndRender = async (monthCursor, errorMessage) => {
      isRefreshing = true;
      renderCard();
      try {
        await loadAvailability(monthCursor, { renderCached: true });
        feedback = "";
      } catch (error) {
        feedback = error.message || errorMessage;
      } finally {
        isRefreshing = false;
        renderCard();
      }
    };

    const storeSelection = (shouldPublish = true) => {
      root.dataset.selectedStart = selectedStart;
      root.dataset.selectedEnd = selectedEnd;
      root.dataset.travelers = String(travelers);
      if (shouldPublish) {
        publishSelection(root, giteId, selectedStart, selectedEnd, travelers);
      }
    };

    const getOptionDefinitions = () => {
      const beds = (giteContent?.sections || []).flatMap(section => section.groupes || [])
        .flatMap(group => group.items || []).filter(item => item?.kind === "bed" && item.type !== "baby");
      const bedCount = beds.reduce((total, bed) => total + Number(bed.count || 0) * (bed.type === "bunk" ? 2 : 1), 0);
      const maxBeds = Math.max(1, Math.min(bedCount || Number(giteConfig?.capacite_max || 1), Number(giteConfig?.capacite_max || 1), 50));
      return [
        { key: "draps", label: "Draps", description: "Un jeu de draps par lit choisi.", quantity: "nb_lits", name: "nb_lits", quantityLabel: "Nombre de lits", max: maxBeds, unit: "{price} / lit / séjour", detail: "draps" },
        { key: "linge_toilette", label: "Linge de toilette", description: "Du linge de toilette pour les personnes de votre choix.", quantity: "nb_personnes", name: "nb_personnes", quantityLabel: "Nombre de personnes", max: travelers, unit: "{price} / personne / séjour", detail: "linge" },
        { key: "chiens", label: "Chiens", description: "Votre compagnon vous accompagne pendant le séjour.", quantity: "nb", name: "nb_chiens", quantityLabel: "Nombre de chiens", max: 10, unit: "{price} / chien / nuit", detail: "chiens" },
        { key: "menage", label: "Ménage de fin de séjour", description: "Profitez du départ, nous nous occupons du ménage.", unit: "{price} / séjour", detail: "menage" },
        { key: "depart_tardif", label: "Départ tardif", description: "Prolongez votre dernière matinée, selon disponibilité.", unit: "{price} / séjour", detail: "depart_tardif" },
      ];
    };

    const isOptionAvailable = (key) => {
      const option = giteConfig?.options?.[key];
      const price = Number(option?.prix_unitaire ?? option?.prix_forfait);
      return Boolean(option?.enabled) && Number.isFinite(price) && price > 0
        && (key !== "chiens" || giteConfig?.rules?.regle_animaux_acceptes !== false);
    };

    const quotePayload = () => {
      for (const definition of getOptionDefinitions()) {
        const option = selectedOptions[definition.key];
        option.enabled = option.enabled && isOptionAvailable(definition.key);
        if (definition.quantity) {
          option[definition.quantity] = option.enabled
            ? Math.max(1, Math.min(definition.max, Math.trunc(Number(option[definition.quantity])) || 1)) : 0;
        }
      }
      return {
        date_entree: selectedStart,
        date_sortie: selectedEnd,
        nb_adultes: travelers,
        nb_enfants_2_17: 0,
        options: Object.fromEntries(Object.entries(selectedOptions).map(([key, value]) => [key, { ...value }])),
      };
    };

    const requestQuote = async () => {
      const sequence = ++quoteSequence;
      // Keep the last valid total visible while an option is being recalculated in
      // the modal. It remains unusable until the fresh quote has been received.
      if (!isModalOpen) quote = null;
      if (!selectedStart || !selectedEnd) {
        isQuoting = false;
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
        const result = await apiFetch(`/gites/${encodeURIComponent(giteId)}/quote`, {
          method: "POST",
          body: quotePayload(),
        });
        if (sequence !== quoteSequence) return;
        feedback = "";
        hasSelectionError = false;
        quote = result;
      } catch (error) {
        if (sequence !== quoteSequence) return;
        quote = null;
        feedback = error.message || t("Prix indisponible.");
        hasSelectionError = true;
      } finally {
        if (sequence !== quoteSequence) return;
        isQuoting = false;
        renderCard();
      }
    };

    const closeFloatingUi = () => {
      if (isSubmitting) return;
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
        renderCard();
      }
    };

    const openPopover = () => {
      isPopoverOpen = true;
      isModalOpen = false;
      const startDate = parseDate(selectedStart);
      if (startDate) {
        const nextMonthCursor = startOfMonth(startDate);
        if (formatDate(nextMonthCursor) !== formatDate(currentMonthCursor)) {
          void loadAvailabilityAndRender(nextMonthCursor, t("Calendrier indisponible."));
        }
      }
      renderCard();
    };

    const clearDates = () => {
      ++quoteSequence;
      isQuoting = false;
      selectedStart = "";
      selectedEnd = "";
      quote = null;
      feedback = "";
      hasSelectionError = false;
      storeSelection();
      renderCard();
    };

    const handleDayClick = (date) => {
      ++quoteSequence;
      isQuoting = false;
      if (date === selectedEnd) {
        selectedEnd = "";
        quote = null;
      } else if (date === selectedStart) {
        selectedStart = "";
        selectedEnd = "";
        quote = null;
      } else if (!selectedStart || selectedEnd) {
        selectedStart = date;
        selectedEnd = "";
        quote = null;
      } else if (date > selectedStart) {
        if (isStayBelowMinimum(selectedStart, date, currentAvailability, giteConfig)) return;
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
        void requestQuote();
      }
    };

    const navigatePopover = async (direction) => {
      const nextMonthCursor = addMonths(currentMonthCursor, direction);
      await loadAvailabilityAndRender(nextMonthCursor, t("Navigation impossible."));
    };

    const buildDateButton = (className, label, value, showClearIcon = false) => {
      const button = createElement("button", className);
      button.type = "button";
      button.addEventListener("click", openPopover);
      button.appendChild(createElement("span", "booked-booking-card__field-label", label));
      button.appendChild(createElement("span", "booked-booking-card__field-value", value ? formatDisplayDate(value) : t("Ajouter une date")));
      if (showClearIcon && value) {
        button.appendChild(createElement("span", "booked-booking-card__field-clear", "×"));
      }
      return button;
    };

    const renderPopover = (card) => {
      const popover = createElement("div", "booked-booking-card__popover");
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-label", t("Sélection des dates"));

      const header = createElement("div", "booked-booking-card__popover-header");
      const intro = createElement("div", "booked-booking-card__popover-intro");
      const nights = getNightCount(selectedStart, selectedEnd);
      intro.appendChild(createElement("h3", "", nights > 0 ? count(nights, "{count} nuit", "{count} nuits") : t("Sélectionnez les dates")));
      intro.appendChild(createElement(
        "p",
        "",
        selectedStart && selectedEnd
          ? `${formatShortDisplayDate(selectedStart)} - ${formatShortDisplayDate(selectedEnd)}`
          : t("Ajoutez vos dates de voyage pour connaître le prix exact")
      ));

      const fields = createElement("div", "booked-booking-card__popover-fields");
      fields.appendChild(buildDateButton("booked-booking-card__popover-field", t("Arrivée"), selectedStart, true));
      fields.appendChild(buildDateButton("booked-booking-card__popover-field", t("Départ"), selectedEnd, true));
      header.append(intro, fields);
      popover.appendChild(header);
      const closeButton = createElement("button", "booked-booking-card__modal-close", "×");
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", t("Fermer"));
      closeButton.addEventListener("click", closeFloatingUi);
      popover.appendChild(closeButton);

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

      if (feedback) {
        const popoverFeedback = createElement("div", "booked-booking-card__popover-feedback", feedback);
        popoverFeedback.setAttribute("aria-live", "polite");
        popover.appendChild(popoverFeedback);
      }

      const actions = createElement("div", "booked-booking-card__popover-actions");
      const clearButton = createElement("button", "booked-booking-card__text-button", t("Effacer les dates"));
      clearButton.type = "button";
      clearButton.addEventListener("click", clearDates);
      actions.appendChild(clearButton);
      if (selectedStart && selectedEnd) {
        const bookButton = createElement("button", "booked-booking-card__primary", isQuoting ? t("Vérification...") : t("Demande de réservation"));
        bookButton.type = "button";
        bookButton.disabled = isQuoting || !quote || hasSelectionError;
        bookButton.addEventListener("click", () => {
          isPopoverOpen = false;
          isModalOpen = true;
          renderCard();
        });
        actions.appendChild(bookButton);
      }
      popover.appendChild(actions);

      card.appendChild(popover);
    };

    const renderModal = (card, previousState = null) => {
      const overlay = createElement("div", "booked-booking-card__modal-overlay");
      const dialog = createElement("div", "booked-booking-card__modal");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.tabIndex = -1;
      dialog.setAttribute("aria-label", t("Demande de réservation"));
      if (isQuoting) dialog.setAttribute("aria-busy", "true");

      const closeButton = createElement("button", "booked-booking-card__modal-close", "×");
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", t("Fermer"));
      closeButton.disabled = isSubmitting;
      closeButton.addEventListener("click", () => {
        isModalOpen = false;
        renderCard();
      });

      const title = createElement("h3", "booked-booking-card__modal-title", t("Demande de réservation"));
      const nights = getNightCount(selectedStart, selectedEnd);
      const summary = createElement("button", "booked-booking-card__modal-summary");
      summary.type = "button";
      summary.disabled = isSubmitting;
      summary.setAttribute("aria-label", t("Modifier les dates du séjour, {nights}", {nights: count(nights, "{count} nuit", "{count} nuits")}));
      const backArrow = createElement("span", "booked-booking-card__modal-back", "←");
      backArrow.setAttribute("aria-hidden", "true");
      summary.append(
        backArrow,
        createElement("span", "", `${count(nights, "{count} nuit", "{count} nuits")} · ${formatDisplayDate(selectedStart)} - ${formatDisplayDate(selectedEnd)}`)
      );
      summary.addEventListener("click", () => {
        isModalOpen = false;
        isPopoverOpen = true;
        renderCard();
      });

      const form = createElement("form", "booked-booking-card__modal-form");
      form.innerHTML = `
        <h4 class="booked-booking-card__section-title">${t("Vos coordonnées")}</h4>
        <div class="booked-booking-card__contact-row"><label>${t("Prénom")}<input type="text" name="prenom" autocomplete="given-name" required></label>
        <label>${t("Nom")}<input type="text" name="nom" autocomplete="family-name" required></label></div>
        <div class="booked-booking-card__contact-row"><label>${t("Téléphone")}<input type="tel" name="telephone" autocomplete="tel" required></label>
        <label>${t("Email")}<input type="email" name="email" autocomplete="email" required></label></div>
        <label>${t("Demandes ou commentaires (facultatif)")}<textarea name="message_client" rows="4"></textarea></label>
        <div class="booked-booking-card__modal-feedback" aria-live="polite">${feedback ? escapeHtml(feedback) : ""}</div>
        <button type="submit" class="booked-booking-card__primary"${isSubmitting || isQuoting || !quote ? " disabled" : ""}>${isSubmitting ? t("Envoi...") : t("Envoyer la demande")}</button>
      `;
      Object.entries(contact).forEach(([name, value]) => {
        const input = form.elements.namedItem(name);
        input.value = value;
        input.disabled = isSubmitting;
        input.addEventListener("input", () => { contact[name] = input.value; });
      });
      const extras = createElement("fieldset", "booked-booking-card__options");
      extras.disabled = isSubmitting;
      extras.appendChild(createElement("legend", "", t("Personnalisez votre séjour")));
      extras.appendChild(createElement("p", "booked-booking-card__options-intro", t("Ajoutez les petits plus qui vous font plaisir. Tout est facultatif.")));
      const optionsGrid = createElement("div", "booked-booking-card__options-grid");
      for (const definition of getOptionDefinitions().filter(item => isOptionAvailable(item.key))) {
        const { key, quantity: quantityKey } = definition;
        const chosen = selectedOptions[key];
        const option = giteConfig.options[key];
        const row = createElement("div", "booked-booking-card__option-card");
        row.classList.toggle("is-selected", chosen.enabled);
        const label = createElement("label", "booked-booking-card__option-heading");
        const checkbox = createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = key;
        checkbox.setAttribute("aria-label", t(definition.label));
        checkbox.checked = chosen.enabled;
        const text = createElement("span", "booked-booking-card__option-text");
        text.appendChild(createElement("strong", "", t(definition.label)));
        text.appendChild(createElement("span", "booked-booking-card__option-description", t(definition.description)));
        label.append(checkbox, text);
        row.appendChild(label);
        const footer = createElement("div", "booked-booking-card__option-footer");
        const price = option.prix_unitaire ?? option.prix_forfait ?? 0;
        footer.appendChild(createElement("span", "booked-booking-card__option-unit", t(definition.unit, { price: formatTotalPrice(price) })));
        const updateQuantity = (value) => {
          chosen[quantityKey] = Math.max(0, Math.min(definition.max, Math.trunc(Number(value)) || 0));
          chosen.enabled = chosen[quantityKey] > 0;
          void requestQuote();
        };
        checkbox.addEventListener("change", () => {
          chosen.enabled = checkbox.checked;
          if (quantityKey) chosen[quantityKey] = checkbox.checked ? Math.min(definition.max, chosen[quantityKey] || (key === "linge_toilette" ? travelers : 1)) : 0;
          void requestQuote();
        });
        if (quantityKey) {
          const stepper = createElement("div", "booked-booking-card__stepper");
          stepper.setAttribute("role", "group");
          stepper.setAttribute("aria-label", t(definition.quantityLabel));
          const quantity = createElement("input");
          quantity.type = "number";
          quantity.name = definition.name;
          quantity.min = "0";
          quantity.max = String(definition.max);
          quantity.step = "1";
          quantity.inputMode = "numeric";
          quantity.value = String(chosen[quantityKey] || 0);
          quantity.setAttribute("aria-label", t(definition.quantityLabel));
          quantity.addEventListener("change", () => updateQuantity(quantity.value));
          for (const [direction, symbol, action] of [[-1, "−", "Diminuer : {option}"], [1, "+", "Augmenter : {option}"]]) {
            const button = createElement("button", "", symbol);
            button.type = "button";
            button.name = `${key}_${direction > 0 ? "increase" : "decrease"}`;
            button.setAttribute("aria-label", t(action, { option: t(definition.label) }));
            button.disabled = direction < 0 ? !chosen[quantityKey] : chosen[quantityKey] >= definition.max;
            button.addEventListener("click", () => updateQuantity((chosen[quantityKey] || 0) + direction));
            if (direction < 0) stepper.append(button, quantity);
            else stepper.appendChild(button);
          }
          footer.appendChild(stepper);
        }
        row.appendChild(footer);
        const amount = quote?.options_detail?.[definition.detail];
        if (chosen.enabled) row.appendChild(createElement("span", "booked-booking-card__option-amount", isQuoting ? t("Calcul en cours…") : typeof amount === "number" ? t("{price} pour le séjour", { price: formatTotalPrice(amount) }) : ""));
        optionsGrid.appendChild(row);
      }
      extras.appendChild(optionsGrid);
      if (optionsGrid.children.length) form.insertBefore(extras, form.elements.namedItem("message_client").closest("label"));
      if (giteConfig?.payments?.online && quote) {
        const payments = createElement("fieldset", "booked-booking-card__payments");
        payments.disabled = isSubmitting || isQuoting;
        payments.appendChild(createElement("legend", "", t("Comment souhaitez-vous régler ?")));
        if (giteConfig.payments.mode === "test") payments.appendChild(createElement("p", "booked-booking-card__test-note", t("Mode test : aucun paiement réel.")));
        const totalAmount = getQuoteTotal(quote);
        const depositAmount = Number(quote.arrhes_theoriques || 0);
        const choices = [
          ["manual", "Paiement sur place", "Par chèque, en espèces ou via Wero. Votre demande sera soumise à notre approbation. Aucun paiement maintenant.", null],
          ["deposit", "Payer les arrhes par carte", "Réservation confirmée après paiement. Solde sur place : {price}.", depositAmount],
          ["full", "Payer la totalité par carte", "Réservation confirmée après paiement. Tout est réglé.", totalAmount],
        ];
        for (const [value, label, description, amount] of choices) {
          if (value !== "manual" && (amount < 0.5 || amount > totalAmount)) continue;
          const row = createElement("label", "booked-booking-card__payment-choice");
          row.classList.toggle("is-selected", paymentChoice === value);
          const radio = createElement("input");
          radio.type = "radio"; radio.name = "payment_choice"; radio.value = value; radio.checked = paymentChoice === value;
          radio.addEventListener("change", () => { paymentChoice = value; renderCard(); });
          const text = createElement("span");
          text.appendChild(createElement("strong", "", t(label)));
          text.appendChild(createElement("small", "", t(description, { price: formatTotalPrice(Math.max(0, totalAmount - depositAmount)) })));
          row.append(radio, text);
          if (amount !== null) row.appendChild(createElement("strong", "booked-booking-card__payment-amount", formatTotalPrice(amount)));
          payments.appendChild(row);
        }
        form.insertBefore(payments, form.querySelector(".booked-booking-card__modal-feedback"));
      }
      if (isQuoting) form.querySelector(".booked-booking-card__modal-feedback").textContent = t("Vérification...");
      if (!quote && !isQuoting) {
        const retry = createElement("button", "booked-booking-card__text-button", t("Vérifier la disponibilité"));
        retry.type = "button";
        retry.addEventListener("click", () => void requestQuote());
        form.insertBefore(retry, form.querySelector("button[type=submit]"));
      }
      form.addEventListener("invalid", (event) => {
        const field = event.target;
        field.setCustomValidity(field.validity.typeMismatch ? t("Veuillez saisir une adresse email valide.") : t("Veuillez renseigner ce champ."));
      }, true);
      form.addEventListener("input", (event) => event.target.setCustomValidity?.(""));
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isSubmitting || isQuoting || !quote) return;
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
              payment_choice: paymentChoice,
              hote_nom: `${prenom} ${nom}`.trim(),
              telephone: String(formData.get("telephone") || "").trim(),
              email: String(formData.get("email") || "").trim(),
              message_client: String(formData.get("message_client") || "").trim(),
            }),
          });
          if (created?.checkout_url) {
            const destination = new URL(created.checkout_url);
            if (destination.protocol !== "https:" || destination.hostname !== "checkout.stripe.com") throw new Error(t("Envoi impossible."));
            window.location.assign(destination.href);
            return;
          }
          feedback = created && created.hold_expires_at
            ? t("Demande enregistrée. Les dates sont bloquées jusqu'au {date}.", {date: new Date(created.hold_expires_at).toLocaleString(locale)})
            : t("Demande enregistrée.");
          isSubmitting = false;
          isModalOpen = false;
          renderCard();
        } catch (error) {
          feedback = error.message || t("Envoi impossible.");
          isSubmitting = false;
          isModalOpen = true;
          renderCard();
        }
      });

      const priceSummary = createElement("div", "booked-booking-card__price-summary");
      if (quote) {
        const addPriceLine = (label, amount) => {
          if (typeof amount !== "number") return;
          const line = createElement("div", "");
          line.append(createElement("span", "", t(label)), createElement("strong", "", formatTotalPrice(amount)));
          priceSummary.appendChild(line);
        };
        addPriceLine("Hébergement", quote.tourist_tax_result?.accommodation_amount ?? quote.montant_hebergement);
        addPriceLine("Options choisies", quote.total_options);
        if (quote.tourist_tax_result?.host_amount > 0) addPriceLine("Taxe de séjour", quote.tourist_tax_result.host_amount);
      }
      form.insertBefore(priceSummary, form.querySelector(".booked-booking-card__modal-feedback"));
      const checkout = createElement("div", "booked-booking-card__checkout");
      const total = createElement("div", "booked-booking-card__checkout-summary");
      total.appendChild(createElement("span", "booked-booking-card__total-label", isQuoting ? t("Mise à jour du total…") : t("Total du séjour")));
      if (quote) total.appendChild(createElement("p", "booked-booking-card__modal-total", t("{price} au total", { price: formatTotalPrice(getQuoteTotal(quote)) })));
      if (paymentChoice !== "manual" && quote) {
        checkout.classList.add("booked-booking-card__checkout--online");
        const amount = Number(paymentChoice === "deposit" ? quote.arrhes_theoriques : getQuoteTotal(quote));
        const breakdown = createElement("div", "booked-booking-card__payment-breakdown");
        breakdown.setAttribute("role", "status");
        breakdown.setAttribute("aria-live", "polite");
        breakdown.setAttribute("aria-atomic", "true");
        if (isQuoting) {
          breakdown.appendChild(createElement("p", "", t("Calcul en cours…")));
        } else {
          const due = createElement("div", "booked-booking-card__due-now");
          due.append(createElement("span", "", t(paymentChoice === "deposit" ? "Arrhes à régler maintenant" : "À régler maintenant")), createElement("strong", "", formatTotalPrice(amount)));
          breakdown.appendChild(due);
          if (paymentChoice === "deposit") {
            const balance = createElement("div", "booked-booking-card__remaining");
            balance.append(createElement("span", "", t("Solde à régler sur place")), createElement("strong", "", formatTotalPrice(Math.max(0, getQuoteTotal(quote) - amount))));
            breakdown.appendChild(balance);
            const rate = giteConfig?.arrhes_taux_defaut;
            const accommodation = quote.montant_hebergement;
            if (typeof rate === "number" && Number.isFinite(rate) && rate > 0 && typeof accommodation === "number") {
              const percentage = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 6 }).format(rate);
              breakdown.appendChild(createElement("p", "booked-booking-card__deposit-calculation", t("Arrhes sur l’hébergement : {base} × {rate} = {amount}", {
                base: formatTotalPrice(accommodation), rate: percentage, amount: formatTotalPrice(amount),
              })));
            }
          }
        }
        total.appendChild(breakdown);
      }
      const submit = form.querySelector("button[type=submit]");
      submit.textContent = isSubmitting ? t(paymentChoice === "manual" ? "Envoi..." : "Redirection vers Stripe…") : t(paymentChoice === "manual" ? "Envoyer la demande" : "Payer et confirmer ma réservation");
      checkout.append(total, form.querySelector("button[type=submit]"));
      form.appendChild(checkout);
      form.appendChild(createElement("small", "booked-booking-card__payment-note", t(paymentChoice === "manual" ? "Aucun montant ne vous sera débité pour le moment" : "Paiement sécurisé par Stripe. Confirmation automatique après paiement.")));
      dialog.addEventListener("keydown", event => {
        if (event.key !== "Tab") return;
        const fields = Array.from(dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(field => field.getClientRects().length);
        const first = fields[0], last = fields[fields.length - 1];
        if (!first) { event.preventDefault(); dialog.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      });
      dialog.append(closeButton, title, summary);
      dialog.appendChild(form);
      overlay.appendChild(dialog);
      overlay.addEventListener("click", (event) => {
        if (event.target !== overlay || isSubmitting) return;
        isModalOpen = false;
        renderCard();
      });
      card.appendChild(overlay);

      if (!previousState) window.setTimeout(() => {
        if (!dialog.isConnected) return;
        dialog.focus({ preventScroll: true });
      }, 0);
    };

    function renderCard() {
      let restoreFocus = false;
      if (isModalOpen && previousBodyOverflow === null) {
        previousBodyOverflow = document.body.style.overflow;
        previousFocus = document.activeElement;
        document.body.style.overflow = "hidden";
      } else if (!isModalOpen && previousBodyOverflow !== null) {
        document.body.style.overflow = previousBodyOverflow;
        previousBodyOverflow = null;
        restoreFocus = true;
      }
      const currentDialog = root.querySelector(".booked-booking-card__modal");
      const activeElement = document.activeElement;
      const modalState = currentDialog ? {
        scrollTop: currentDialog.scrollTop,
        activeName: currentDialog.contains(activeElement) ? activeElement.name || "" : "",
        selectionStart: currentDialog.contains(activeElement) ? activeElement.selectionStart : null,
        selectionEnd: currentDialog.contains(activeElement) ? activeElement.selectionEnd : null,
      } : null;
      root.innerHTML = "";
      root.classList.toggle("booked-booking-card--floating", isPopoverOpen || isModalOpen);
      const card = createElement("div", "booked-booking-card__panel");
      const hasDates = Boolean(selectedStart && selectedEnd);
      const hasQuote = Boolean(hasDates && quote);
      if (isRefreshing) {
        card.appendChild(createRefreshIndicator());
      }

      const title = createElement("h2", hasQuote ? "booked-booking-card__total" : "booked-booking-card__title");
      title.textContent = hasQuote ? t("{price} au total", {price: formatTotalPrice(getQuoteTotal(quote))}) : t("Indiquez vos dates pour afficher les prix");
      card.appendChild(title);

      const fields = createElement("div", "booked-booking-card__fields");
      fields.appendChild(buildDateButton("booked-booking-card__field booked-booking-card__field--arrival", t("Arrivée"), selectedStart));
      fields.appendChild(buildDateButton("booked-booking-card__field booked-booking-card__field--departure", t("Départ"), selectedEnd));

      if (showTravelers) {
        const travelersField = createElement("div", "booked-booking-card__travelers");
        travelersField.appendChild(createElement("span", "booked-booking-card__field-label", t("Voyageurs")));
        const row = createElement("div", "booked-booking-card__travelers-row");
        const input = createElement("input", "booked-booking-card__travelers-input");
        input.type = "number";
        input.min = "1";
        input.max = String(giteConfig && giteConfig.capacite_max ? giteConfig.capacite_max : 99);
        input.value = String(travelers);
        input.setAttribute("aria-label", t("Nombre de voyageurs"));
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
        row.appendChild(createElement("span", "booked-booking-card__field-value", count(travelers, "{count} voyageur", "{count} voyageurs")));
        row.appendChild(input);
        travelersField.appendChild(row);
        fields.appendChild(travelersField);
      }
      card.appendChild(fields);

      const primary = createElement(
        "button",
        "booked-booking-card__primary",
        hasQuote ? t("Demande de réservation") : isQuoting ? t("Vérification...") : t("Vérifier la disponibilité")
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
        card.appendChild(createElement("p", "booked-booking-card__small-note", t(paymentChoice === "manual" ? "Aucun montant ne vous sera débité pour le moment" : "Paiement sécurisé par Stripe. Confirmation automatique après paiement.")));
      }

      if (isPopoverOpen) {
        renderPopover(card);
      }
      if (isModalOpen) {
        renderModal(card, modalState);
      }

      root.appendChild(card);
      if (restoreFocus) (previousFocus?.isConnected ? previousFocus : card.querySelector(".booked-booking-card__primary"))?.focus({ preventScroll: true });
      if (modalState) {
        const nextDialog = root.querySelector(".booked-booking-card__modal");
        if (!nextDialog) return;
        const restoreModalState = () => {
          if (!nextDialog.isConnected) return;
          nextDialog.scrollTop = modalState.scrollTop;
          const nextForm = nextDialog.querySelector("form");
          const field = modalState.activeName === "payment_choice" ? nextForm.querySelector('input[name="payment_choice"]:checked') : modalState.activeName ? nextForm.elements.namedItem(modalState.activeName) : null;
          const previousField = field?.disabled ? field.closest(".booked-booking-card__stepper")?.querySelector("input") : field;
          if (previousField && typeof previousField.focus === "function") {
            previousField.focus({ preventScroll: true });
            if (typeof modalState.selectionStart === "number" && typeof previousField.setSelectionRange === "function") previousField.setSelectionRange(modalState.selectionStart, modalState.selectionEnd);
            nextDialog.scrollTop = modalState.scrollTop;
          }
        };
        restoreModalState();
        window.setTimeout(restoreModalState, 0);
      }
    }

    const bindEvents = () => {
      if (areEventsBound) return;
      areEventsBound = true;

      const externalSelectionHandler = (event) => {
        const detail = event.detail || {};
        if (detail.source === root || String(detail.giteId || "") !== String(giteId || "")) return;
        ++quoteSequence;
        isQuoting = false;
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
        root.classList.remove("booked-booking-card--floating");
        if (previousBodyOverflow !== null) document.body.style.overflow = previousBodyOverflow;
        document.removeEventListener(SELECTION_EVENT, externalSelectionHandler);
        document.removeEventListener("click", handleOutsideClick);
        document.removeEventListener("keydown", handleEscape);
        window.removeEventListener("resize", handleResize);
      };
    };

    const configPath = `/gites/${encodeURIComponent(giteId)}/config`;
    const initialAvailabilityPath = getAvailabilityPath(currentMonthCursor);
    const cachedConfig = readCachedApi(configPath);
    const cachedAvailability = readCachedApi(initialAvailabilityPath);
    if (cachedConfig && cachedAvailability) {
      giteConfig = cachedConfig;
      currentAvailability = cachedAvailability;
      isRefreshing = true;
      renderCard();
      bindEvents();
    } else {
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-widget__loading", t("Chargement...")));
    }

    try {
      [giteConfig, currentAvailability, giteContent] = await Promise.all([
        apiFetch(configPath),
        apiFetch(initialAvailabilityPath),
        apiFetch(`/gites/${encodeURIComponent(giteId)}/content`).catch(() => null),
      ]);
      isRefreshing = false;
      renderCard();
      bindEvents();
    } catch (error) {
      log("booking card error", error);
      if (cachedConfig && cachedAvailability) {
        isRefreshing = false;
        feedback = error.message || t("Mise à jour impossible.");
        renderCard();
        bindEvents();
        return;
      }
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-widget--error", error.message || t("Carte de réservation indisponible.")));
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
