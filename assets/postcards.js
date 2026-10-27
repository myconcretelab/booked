(function () {
  const { t } = window.BookedI18n;
  const styles = ["escale", "campagne", "album", "voyage"];
  let nextId = 0;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const number = (value, fallback, max) => {
    const parsed = value === undefined || value === null || value === "" ? fallback : Number(value);
    return Math.max(0, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
  };

  const rotation = (id, amount) => {
    let hash = 2166136261;
    for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    return `${(((hash >>> 13) & 1 ? 1 : -1) * (0.45 + ((hash >>> 8) % 56) / 100) * amount).toFixed(2)}deg`;
  };

  const shortMessage = (text) => {
    const message = String(text || "").replace(/\s+/g, " ").trim();
    if (message.length <= 62) return message;
    return `${message.slice(0, 63).replace(/\s+\S*$/, "").replace(/[\s,;:.!?…-]+$/, "")}…`;
  };

  const createCard = (gite, options = {}, index = 0) => {
    const requested = (options.postcardAssignments || {})[gite.id];
    const style = styles.includes(requested) ? requested : styles[index % styles.length];
    const card = element("article", `booked-gite-cards__card booked-postcard booked-postcard--${style}`);
    card.dataset.postcardId = String(gite.id);
    const canvas = element(gite.url ? "a" : "div", "booked-postcard__canvas");
    if (gite.url) {
      canvas.href = gite.url;
      canvas.setAttribute("aria-label", t("Voir {name}", { name: gite.name }));
    }
    const tilt = element("div", "booked-postcard__tilt");
    const flipper = element("div", "booked-postcard__flipper");
    flipper.id = `booked-postcard-${++nextId}`;
    const front = element("div", "booked-postcard__face booked-postcard__front");
    const back = element("div", "booked-postcard__face booked-postcard__back");
    const filter = number(options.postcardPhotoFilter, 50, 100);
    const patina = number(options.postcardPatina, 23, 100);
    const inclination = number(options.postcardTilt, 3, 6);
    const tint = { escale: 0.62, campagne: 0.33, album: 0.14, voyage: 0.46 }[style];
    card.style.setProperty("--postcard-rotation", rotation(gite.id, inclination));
    card.style.setProperty("--postcard-tint", String(Math.min(0.92, tint * filter / 50)));
    card.style.setProperty("--postcard-sepia", String(filter / 100));
    card.style.setProperty("--postcard-saturation", String(1 - filter * 0.0096));
    card.style.setProperty("--postcard-contrast", String(1 - filter * 0.0018));
    card.style.setProperty("--postcard-patina", String(patina / 100));

    const photo = element("div", "booked-postcard__photo");
    if (gite.photo && gite.photo.url) {
      const image = element("img", "booked-postcard__image");
      image.src = gite.photo.url;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      photo.appendChild(image);
    }
    photo.appendChild(element("span", "booked-postcard__wash"));
    photo.appendChild(element("span", "booked-postcard__inset"));
    front.appendChild(photo);

    const content = element("div", "booked-postcard__front-content");
    const top = element("div", "booked-postcard__corners");
    top.appendChild(element("span", "", t("Gîtes de Brocéliande")));
    top.appendChild(element("span", "booked-postcard__number", `Nº ${String(index + 1).padStart(2, "0")}`));
    const title = element("h3", "booked-postcard__name");
    title.appendChild(element("span", "booked-postcard__prefix", t("Souvenir du gîte")));
    title.appendChild(element("span", "booked-postcard__name-main", gite.name));
    if (gite.name.length > 24) card.classList.add("booked-postcard--long-name");
    const bottom = element("div", "booked-postcard__corners");
    bottom.appendChild(element("span", "", "Brocéliande"));
    const capacity = (gite.stats || []).find((stat) => stat.icon === "people");
    bottom.appendChild(element("span", "booked-postcard__capacity", capacity ? capacity.value : "Bretagne"));
    content.appendChild(top);
    content.appendChild(title);
    content.appendChild(bottom);
    front.appendChild(content);

    const message = element("div", "booked-postcard__message");
    message.appendChild(element("h3", "booked-postcard__back-heading", gite.name));
    const description = shortMessage(gite.description || gite.eyebrow);
    if (description) message.appendChild(element("p", "booked-postcard__script", description));
    message.appendChild(element("p", "booked-postcard__signature", t("À bientôt ici…")));
    back.appendChild(message);

    const address = element("div", "booked-postcard__address");
    const stamp = element("span", "booked-postcard__stamp", "B");
    stamp.setAttribute("aria-hidden", "true");
    stamp.appendChild(element("small", "", "BRETAGNE"));
    const postmark = element("span", "booked-postcard__postmark", "SOUVENIR · BROCÉLIANDE");
    postmark.setAttribute("aria-hidden", "true");
    address.appendChild(stamp);
    address.appendChild(postmark);
    const facts = element("dl", "booked-postcard__facts");
    const priority = ["people", "sleeping", "surface", "garden", "courtyard", "bedrooms", "fireplace", "bath"];
    [...(gite.stats || [])].sort((a, b) => priority.indexOf(a.icon) - priority.indexOf(b.icon)).slice(0, 4).forEach((stat) => {
      const row = element("div", "booked-postcard__fact");
      row.appendChild(element("dt", "", stat.label));
      row.appendChild(element("dd", "", stat.value.replace(/ m2$/, " m²")));
      facts.appendChild(row);
    });
    address.appendChild(facts);
    if (gite.url) address.appendChild(element("span", "booked-postcard__visit", `${t("Découvrir le gîte")} ↗`));
    back.appendChild(address);
    flipper.appendChild(front);
    flipper.appendChild(back);
    tilt.appendChild(flipper);
    canvas.appendChild(tilt);
    card.appendChild(canvas);

    const button = element("button", "booked-postcard__return");
    button.type = "button";
    button.setAttribute("aria-controls", flipper.id);
    card.appendChild(button);
    let pinned = false;
    let hovering = false;
    let suppressHover = false;

    const sync = () => {
      const flipped = pinned || (hovering && !suppressHover);
      const showBack = flipped;
      card.dataset.postcardPinned = String(pinned);
      card.classList.toggle("is-flipped", showBack);
      front.inert = showBack;
      back.inert = !showBack;
      front.setAttribute("aria-hidden", String(showBack));
      back.setAttribute("aria-hidden", String(!showBack));
      button.setAttribute("aria-pressed", String(showBack));
      button.setAttribute("aria-label", t(showBack ? "Voir le recto de {name}" : "Voir le verso de {name}", { name: gite.name }));
      button.textContent = `${t(showBack ? "Voir la photo" : "Retourner")} ↻`;
    };
    canvas.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      hovering = true;
      suppressHover = false;
      sync();
    });
    canvas.addEventListener("pointerleave", () => { hovering = false; suppressHover = false; sync(); });
    card.addEventListener("focusout", () => window.setTimeout(sync, 0));
    button.addEventListener("click", () => {
      pinned = !card.classList.contains("is-flipped");
      suppressHover = !pinned;
      sync();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      pinned = false;
      hovering = false;
      suppressHover = true;
      sync();
    });
    sync();
    return card;
  };

  window.BookedPostcards = { createCard };
})();
