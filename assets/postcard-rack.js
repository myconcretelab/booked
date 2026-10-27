/* A single-tier postcard rack, inspired by Lee Martin's CodePen VwVMRYr.
 * Uses the existing Booked postcards and native CSS 3D; no WebGL/render loop. */
(function () {
  const { t } = window.BookedI18n;
  let nextId = 0;
  const node = (tag, className, text) => {
    const result = document.createElement(tag);
    result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  };
  const button = (label, text, action, signal) => {
    const result = node("button", "booked-postcard-rack__button", text);
    result.type = "button";
    result.setAttribute("aria-label", label);
    result.addEventListener("click", action, { signal });
    return result;
  };

  function mount(root, gites, options) {
    const doc = root.ownerDocument;
    const events = new AbortController();
    const { signal } = events;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer, visibilityObserver, sizeObserver, frame = 0, drag, extraction;
    let disposed = false, initialized = false, visible = false, angle = -24;
    let selected = null, dialog, slots = [], cards = [], rotor, stage, status;
    const listening = { signal };

    function stopMotion() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      drag = null;
      stage?.classList.remove("is-dragging");
      extraction?.cancel();
      extraction = null;
      // Complete short CSS transitions when hidden; nothing runs while idle.
      root.getAnimations({ subtree: true }).forEach((animation) => {
        try { animation.finish(); } catch (_) { animation.cancel(); }
      });
    }
    function destroy() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      visibilityObserver?.disconnect();
      sizeObserver?.disconnect();
      stopMotion();
      if (dialog?.open) dialog.close();
      events.abort();
      delete root.bookedPostcardRackDestroy;
    }
    root.bookedPostcardRackDestroy = destroy;

    function updateVisibility() {
      const active = visible && !doc.hidden;
      root.classList.toggle("is-rack-paused", !active);
      if (!active) stopMotion();
    }
    function paint() {
      frame = 0;
      if (disposed || !rotor) return;
      rotor.style.setProperty("--rack-angle", `${angle}deg`);
    }
    function turn(delta) {
      if (disposed || extraction || selected !== null) return;
      angle += delta;
      paint();
      status.textContent = t("Choisissez une carte pour découvrir le gîte.");
    }
    function closeSelection() {
      if (selected === null) return;
      const index = selected;
      selected = null;
      const card = cards[index];
      if (card.classList.contains("is-flipped")) card.querySelector(".booked-postcard__return").click();
      card.inert = true;
      slots[index].appendChild(card);
      slots[index].classList.remove("is-empty");
      root.classList.remove("has-rack-selection");
    }
    async function select(index) {
      if (disposed || extraction || selected !== null || doc.hidden) return;
      const target = -index * 90;
      const delta = ((target - angle + 180) % 360 + 360) % 360 - 180;
      turn(delta);
      const card = cards[index];
      const animation = card.animate([
        { transform: "translateY(0)" },
        { transform: "translateY(-48px) rotateX(-8deg)" },
      ], { duration: 550, easing: "cubic-bezier(.2,.65,.3,1)", fill: "forwards" });
      extraction = animation;
      try {
        await animation.finished;
        if (disposed || extraction !== animation) return;
        selected = index;
        slots[index].classList.add("is-empty");
        card.inert = false;
        dialog.querySelector(".booked-postcard-rack__selected").appendChild(card);
        dialog.querySelector("h2").textContent = gites[index].name;
        const visit = dialog.querySelector(".booked-postcard-rack__visit");
        visit.hidden = !gites[index].url;
        if (gites[index].url) visit.href = gites[index].url;
        root.classList.add("has-rack-selection");
        dialog.showModal();
      } catch (_) {
        // Visibility changes or editor rerenders cancel an extraction safely.
        if (dialog && !dialog.open) closeSelection();
      } finally {
        animation.cancel();
        if (extraction === animation) extraction = null;
      }
    }

    function initialize() {
      if (initialized || disposed) return;
      initialized = true;
      root.replaceChildren();
      // The ordinary postcards are also the accessible, reduced-motion fallback.
      if (reducedMotion.matches || !CSS.supports("transform-style", "preserve-3d") || typeof HTMLDialogElement === "undefined") {
        root.classList.add("is-rack-static");
        const grid = node("div", "booked-gite-cards__grid");
        gites.forEach((gite, index) => grid.appendChild(window.BookedPostcards.createCard(gite, options, index)));
        root.appendChild(grid);
        return;
      }

      root.classList.remove("is-rack-static");
      stage = node("div", "booked-postcard-rack__stage");
      stage.setAttribute("aria-hidden", "true");
      const world = node("div", "booked-postcard-rack__world");
      const stand = node("div", "booked-postcard-rack__stand");
      stand.appendChild(node("div", "booked-postcard-rack__base"));
      stand.appendChild(node("div", "booked-postcard-rack__pole"));
      const sign = node("div", "booked-postcard-rack__sign");
      sign.appendChild(node("span", "", t("Souvenirs de")));
      sign.appendChild(node("strong", "", "Brocéliande"));
      stand.appendChild(sign);
      rotor = node("div", "booked-postcard-rack__rotor");
      gites.forEach((gite, index) => {
        const slot = node("div", "booked-postcard-rack__slot");
        slot.style.setProperty("--slot-angle", `${index * 90}deg`);
        const card = window.BookedPostcards.createCard(gite, { ...options, postcardHover: false }, index);
        card.inert = true;
        slot.appendChild(card);
        slot.appendChild(node("span", "booked-postcard-rack__wire"));
        slot.addEventListener("click", (event) => {
          event.preventDefault();
          if (Date.now() < suppressClickUntil) return;
          void select(index);
        }, listening);
        slots.push(slot);
        cards.push(card);
        rotor.appendChild(slot);
      });
      world.appendChild(stand);
      world.appendChild(rotor);
      stage.appendChild(world);
      root.appendChild(stage);
      const caption = node("p", "booked-postcard-rack__caption", t("Faites tourner vos souvenirs."));
      status = node("p", "booked-postcard-rack__hint", t("Glissez pour tourner · Choisissez une carte pour la sortir"));
      status.setAttribute("aria-live", "polite");
      root.appendChild(caption);
      root.appendChild(status);
      const controls = node("div", "booked-postcard-rack__controls");
      controls.setAttribute("role", "group");
      controls.setAttribute("aria-label", t("Commandes du présentoir"));
      controls.appendChild(button(t("Tourner vers la gauche"), "←", () => turn(90), signal));
      const choices = node("div", "booked-postcard-rack__choices");
      gites.forEach((gite, index) => {
        const choice = button(t("Sortir la carte de {name}", { name: gite.name }), gite.name, () => void select(index), signal);
        choice.classList.add("booked-postcard-rack__choice");
        choices.appendChild(choice);
      });
      controls.appendChild(choices);
      controls.appendChild(button(t("Tourner vers la droite"), "→", () => turn(-90), signal));
      root.appendChild(controls);

      dialog = node("dialog", "booked-postcard-rack__dialog");
      const heading = node("h2", "booked-postcard-rack__dialog-title");
      heading.id = `booked-rack-title-${++nextId}`;
      dialog.setAttribute("aria-labelledby", heading.id);
      dialog.appendChild(heading);
      dialog.appendChild(node("div", "booked-postcard-rack__selected"));
      const actions = node("div", "booked-postcard-rack__actions");
      actions.appendChild(button(t("Ranger la carte"), t("Ranger la carte"), () => dialog.close(), signal));
      const visit = node("a", "booked-postcard-rack__visit", `${t("Découvrir le gîte")} →`);
      actions.appendChild(visit);
      dialog.appendChild(actions);
      dialog.addEventListener("close", closeSelection, listening);
      dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }, listening);
      root.appendChild(dialog);

      let suppressClickUntil = 0;
      stage.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || event.button !== 0 || extraction || selected !== null) return;
        drag = { id: event.pointerId, start: event.clientX, angle, moved: false };
      }, listening);
      stage.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        const distance = event.clientX - drag.start;
        if (!drag.moved && Math.abs(distance) < 8) return;
        drag.moved = true;
        stage.setPointerCapture(event.pointerId);
        stage.classList.add("is-dragging");
        angle = drag.angle + distance * 0.35;
        if (!frame) frame = window.requestAnimationFrame(paint);
      }, listening);
      const finishDrag = (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        if (drag.moved) suppressClickUntil = Date.now() + 250;
        if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
        drag = null;
        window.cancelAnimationFrame(frame);
        frame = 0;
        stage.classList.remove("is-dragging");
        paint();
      };
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => stage.addEventListener(name, finishDrag, listening));
      root.addEventListener("keydown", (event) => {
        if (dialog.open || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        turn(event.key === "ArrowLeft" ? 90 : -90);
      }, listening);
      sizeObserver = new ResizeObserver(([entry]) => {
        if (!disposed) world.style.setProperty("--rack-scale", String(Math.min(1, Math.max(0.2, entry.contentRect.width / 820))));
      });
      sizeObserver.observe(stage);
      paint();
      updateVisibility();
    }

    reducedMotion.addEventListener("change", () => {
      if (disposed) return;
      destroy();
      mount(root, gites, options);
    }, listening);
    doc.addEventListener("visibilitychange", updateVisibility, listening);
    root.replaceChildren(node("p", "booked-postcard-rack__placeholder", t("Vos cartes postales se préparent…")));
    observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      initialize();
      observer.disconnect();
    }, { rootMargin: "160px 0px" });
    observer.observe(root);
    visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updateVisibility();
    });
    visibilityObserver.observe(root);
  }
  window.BookedPostcardRack = { mount };
})();
