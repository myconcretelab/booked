(function () {
  const config = window.BookedWidgetConfig || {};

  const formatPrice = (value) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));

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

  const apiFetch = async (path, options) => {
    const response = await fetch(config.restUrl.replace(/\/$/, "") + path, {
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

  const renderBlockedRanges = (target, availability) => {
    target.innerHTML = "";
    if (!availability.blocked_ranges || availability.blocked_ranges.length === 0) {
      target.appendChild(createElement("div", "booked-widget__empty", "Aucune indisponibilité connue sur la période chargée."));
      return;
    }

    availability.blocked_ranges.forEach((item) => {
      const row = createElement("div", "booked-widget__range");
      row.appendChild(createElement("strong", "", item.type === "booking_request" ? "Option temporaire" : "Réservé"));
      row.appendChild(createElement("span", "", `${item.date_entree.slice(0, 10)} → ${item.date_sortie.slice(0, 10)}`));
      target.appendChild(row);
    });
  };

  const renderWidget = async (root) => {
    const giteId = root.dataset.giteId;
    root.innerHTML = "";
    root.appendChild(createElement("div", "booked-widget__loading", "Chargement des disponibilités…"));

    try {
      const [giteConfig, availability] = await Promise.all([
        apiFetch(`/gites/${encodeURIComponent(giteId)}/config`),
        apiFetch(`/gites/${encodeURIComponent(giteId)}/availability`),
      ]);

      const shell = createElement("div", "booked-widget__shell");
      const header = createElement("div", "booked-widget__header");
      header.appendChild(createElement("h3", "booked-widget__title", giteConfig.nom));
      header.appendChild(createElement("p", "booked-widget__subtitle", `Capacité max ${giteConfig.capacite_max} personnes`));
      shell.appendChild(header);

      const availabilityCard = createElement("div", "booked-widget__card");
      availabilityCard.appendChild(createElement("h4", "", "Disponibilités connues"));
      const blockedRanges = createElement("div", "booked-widget__ranges");
      renderBlockedRanges(blockedRanges, availability);
      availabilityCard.appendChild(blockedRanges);
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
      shell.appendChild(form);
      root.innerHTML = "";
      root.appendChild(shell);

      const quoteBox = form.querySelector(".booked-widget__quote");
      const feedbackBox = form.querySelector(".booked-widget__feedback");

      const updateQuote = async () => {
        const dateEntree = form.querySelector("[name=date_entree]").value;
        const dateSortie = form.querySelector("[name=date_sortie]").value;
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
        void updateQuote();
      });

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

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".booked-widget[data-gite-id]").forEach((root) => {
      renderWidget(root);
    });
  });
})();
