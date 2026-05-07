(function () {
  const config = window.BookedWidgetConfig || {};

  const formatPrice = (value) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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

  const buildOptionsPayload = (form) => {
    const adults = Number(form.querySelector("[name=nb_adultes]").value || 1);
    return {
      draps: {
        enabled: form.querySelector("[name=opt_draps]").checked,
        nb_lits: Number(form.querySelector("[name=draps_nb_lits]").value || 0),
      },
      linge_toilette: {
        enabled: form.querySelector("[name=opt_linge]").checked,
        nb_personnes: Number(form.querySelector("[name=linge_nb_personnes]").value || adults),
      },
      menage: {
        enabled: form.querySelector("[name=opt_menage]").checked,
      },
      depart_tardif: {
        enabled: form.querySelector("[name=opt_depart_tardif]").checked,
      },
      chiens: {
        enabled: form.querySelector("[name=opt_chiens]").checked,
        nb: Number(form.querySelector("[name=chiens_nb]").value || 0),
      },
    };
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

  const getDayStatus = (day, blockedDays) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (day < today) return "past";
    return blockedDays.get(formatDate(day)) || "free";
  };

  const renderMonth = (monthDate, blockedDays, selectedStart, selectedEnd, onDayClick) => {
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
      const selectionClass =
        dateValue === selectedStart || dateValue === selectedEnd
          ? " booked-widget__day--selected"
          : selectedStart && selectedEnd && dateValue > selectedStart && dateValue < selectedEnd
            ? " booked-widget__day--in-range"
            : "";
      const button = createElement(
        "button",
        `booked-widget__day booked-widget__day--${status}${selectionClass}`,
        String(day.getDate())
      );
      button.type = "button";
      button.dataset.date = dateValue;
      button.disabled = status !== "free" || !onDayClick;
      button.setAttribute(
        "aria-label",
        `${dateValue} ${status === "free" ? "disponible" : status === "option" ? "option temporaire" : "indisponible"}`
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

  const renderAvailabilityCalendar = (target, availability, monthCursor, monthsCount, selectedStart, selectedEnd, onNavigate, onDayClick) => {
    const blockedDays = getBlockedDays(availability);
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
      months.appendChild(renderMonth(addMonths(monthCursor, index), blockedDays, selectedStart, selectedEnd, onDayClick));
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
    target.appendChild(legend);
  };

  const renderWidget = async (root) => {
    const giteId = root.dataset.giteId;
    const mode = root.dataset.mode === "calendar" ? "calendar" : "booking";
    const monthsCount = Math.max(1, Math.min(12, Number(root.dataset.months || 2)));
    const showTitle = root.dataset.showTitle !== "0";
    const showCapacity = root.dataset.showCapacity !== "0";
    const selectedStart = root.dataset.selectedStart || "";
    const selectedEnd = root.dataset.selectedEnd || "";
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

      const form = createElement("form", "booked-widget__form");
      form.innerHTML = `
        <div class="booked-widget__grid">
          <label>Date d'arrivée<input type="date" name="date_entree" required></label>
          <label>Date de départ<input type="date" name="date_sortie" required></label>
          <label>Adultes<input type="number" name="nb_adultes" min="1" max="${giteConfig.nb_adultes_max}" value="2" required></label>
          <label>Enfants<input type="number" name="nb_enfants_2_17" min="0" max="${giteConfig.nb_enfants_max}" value="0" required></label>
          <label>Nom<input type="text" name="hote_nom" required></label>
          <label>Téléphone<input type="text" name="telephone" required></label>
          <label>Email<input type="email" name="email"></label>
        </div>
        <div class="booked-widget__options">
          <label><input type="checkbox" name="opt_draps"> Draps</label>
          <label><input type="number" name="draps_nb_lits" min="0" value="0"> Nb lits</label>
          <label><input type="checkbox" name="opt_linge"> Linge</label>
          <label><input type="number" name="linge_nb_personnes" min="0" value="2"> Nb pers.</label>
          <label><input type="checkbox" name="opt_menage"> Ménage</label>
          <label><input type="checkbox" name="opt_depart_tardif"> Départ tardif</label>
          <label><input type="checkbox" name="opt_chiens" ${giteConfig.rules.regle_animaux_acceptes ? "" : "disabled"}> Chiens</label>
          <label><input type="number" name="chiens_nb" min="0" value="0"> Nb chiens</label>
        </div>
        <label>Message<textarea name="message_client" rows="4" placeholder="Précisions éventuelles"></textarea></label>
        <div class="booked-widget__quote"></div>
        <div class="booked-widget__feedback"></div>
        <button type="submit" class="booked-widget__submit">Envoyer la demande</button>
      `;
      if (mode === "booking") {
        shell.appendChild(form);
      }
      root.innerHTML = "";
      root.appendChild(shell);

      const quoteBox = form.querySelector(".booked-widget__quote");
      const feedbackBox = form.querySelector(".booked-widget__feedback");
      const dateEntreeInput = form.querySelector("[name=date_entree]");
      const dateSortieInput = form.querySelector("[name=date_sortie]");

      if (selectedStart) {
        dateEntreeInput.value = selectedStart;
      }
      if (selectedEnd) {
        dateSortieInput.value = selectedEnd;
      }

      const updateQuote = async () => {
        const dateEntree = dateEntreeInput.value;
        const dateSortie = dateSortieInput.value;
        if (!dateEntree || !dateSortie) {
          quoteBox.innerHTML = "";
          return;
        }

        try {
          const quote = await apiFetch(`/gites/${encodeURIComponent(giteId)}/quote`, {
            method: "POST",
            body: {
              date_entree: dateEntree,
              date_sortie: dateSortie,
              nb_adultes: Number(form.querySelector("[name=nb_adultes]").value || 1),
              nb_enfants_2_17: Number(form.querySelector("[name=nb_enfants_2_17]").value || 0),
              options: buildOptionsPayload(form),
            },
          });
          quoteBox.innerHTML = `
            <div class="booked-widget__quote-card">
              <strong>Estimation</strong>
              <div>Hébergement: ${formatPrice(quote.montant_hebergement)}</div>
              <div>Options: ${formatPrice(quote.total_options)}</div>
              <div>Taxe de séjour: ${formatPrice(quote.taxe_sejour)}</div>
              <div class="booked-widget__quote-total">Total: ${formatPrice(quote.total_global)}</div>
              <div>Séjour minimum requis: ${quote.required_min_nights} nuit(s)</div>
            </div>
          `;
          feedbackBox.textContent = "";
        } catch (error) {
          quoteBox.innerHTML = "";
          feedbackBox.textContent = error.message;
        }
      };

      form.addEventListener("change", () => {
        root.dataset.selectedStart = dateEntreeInput.value;
        root.dataset.selectedEnd = dateSortieInput.value;
        void updateQuote();
      });

      let currentAvailability = availability;
      let currentMonthCursor = monthCursor;
      let isNavigating = false;

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
          renderAvailabilityCalendar(
            calendar,
            currentAvailability,
            currentMonthCursor,
            monthsCount,
            dateEntreeInput.value,
            dateSortieInput.value,
            navigateCalendar,
            mode === "booking" ? handleCalendarDayClick : null
          );
        } catch (error) {
          log("calendar navigation error", error);
          feedbackBox.textContent = error.message || "Navigation impossible.";
        } finally {
          calendar.removeAttribute("aria-busy");
          isNavigating = false;
        }
      };

      const handleCalendarDayClick = (date) => {
        if (!dateEntreeInput.value || dateSortieInput.value) {
          dateEntreeInput.value = date;
          dateSortieInput.value = "";
        } else if (date > dateEntreeInput.value) {
          dateSortieInput.value = date;
        } else {
          dateEntreeInput.value = date;
          dateSortieInput.value = "";
        }
        root.dataset.selectedStart = dateEntreeInput.value;
        root.dataset.selectedEnd = dateSortieInput.value;
        form.dispatchEvent(new Event("change", { bubbles: true }));
        renderAvailabilityCalendar(
          calendar,
          currentAvailability,
          currentMonthCursor,
          monthsCount,
          dateEntreeInput.value,
          dateSortieInput.value,
          navigateCalendar,
          handleCalendarDayClick
        );
      };

      renderAvailabilityCalendar(
        calendar,
        currentAvailability,
        currentMonthCursor,
        monthsCount,
        selectedStart,
        selectedEnd,
        navigateCalendar,
        mode === "booking" ? handleCalendarDayClick : null
      );

      if (mode !== "booking") {
        return;
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        feedbackBox.textContent = "";
        const submitButton = form.querySelector(".booked-widget__submit");
        submitButton.disabled = true;
        submitButton.textContent = "Envoi…";

        try {
          const created = await apiFetch("/requests", {
            method: "POST",
            body: {
              gite_id: giteId,
              date_entree: form.querySelector("[name=date_entree]").value,
              date_sortie: form.querySelector("[name=date_sortie]").value,
              nb_adultes: Number(form.querySelector("[name=nb_adultes]").value || 1),
              nb_enfants_2_17: Number(form.querySelector("[name=nb_enfants_2_17]").value || 0),
              hote_nom: form.querySelector("[name=hote_nom]").value,
              telephone: form.querySelector("[name=telephone]").value,
              email: form.querySelector("[name=email]").value,
              message_client: form.querySelector("[name=message_client]").value,
              options: buildOptionsPayload(form),
            },
          });
          feedbackBox.textContent = `Demande enregistrée. Les dates sont bloquées jusqu'au ${new Date(created.hold_expires_at).toLocaleString("fr-FR")}.`;
          form.reset();
          quoteBox.innerHTML = "";
          await renderWidget(root);
        } catch (error) {
          log("submit error", error);
          feedbackBox.textContent = error.message || "Envoi impossible.";
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = "Envoyer la demande";
        }
      });
    } catch (error) {
      log("widget error", error);
      root.innerHTML = "";
      root.appendChild(createElement("div", "booked-widget booked-widget--error", error.message || "Widget indisponible."));
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

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".booked-widget[data-gite-id]").forEach((root) => {
      if (root.dataset.bookedInitialized === "1") return;
      root.dataset.bookedInitialized = "1";
      renderWidget(root);
    });
  });
})();
