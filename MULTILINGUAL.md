# Contenus multilingues

Booked utilise la langue courante Polylang, puis WPML, puis la locale WordPress. Les langues prises en charge sont `fr`, `en`, `es` ; les autres utilisent `fr`.

Les textes restent gérés dans Contrats, dans Présentation web → Traductions du site. Les blocs de texte, informations gîte et galeries demandent les contenus et les métadonnées photo dans la langue de la page. Les caches PHP et navigateur de ces contenus sont séparés par langue. Les photos WordPress restent uniques : seuls leurs textes affichés sont localisés, sans écraser la médiathèque française.

Les routes REST `/booked/v1/gites/{id}/content` et `/booked/v1/gites/{id}/photos` acceptent `?lang=en` ou `?lang=es`. Sans paramètre elles utilisent la langue WordPress. Le serveur Contrats doit être mis à jour et sa migration appliquée avant ce plugin.

Les pages et menus sont des traductions natives Polylang, gérées par le thème Gîtes Brocéliande. Le formulaire, les calendriers, cartes et galeries utilisent `assets/i18n.js` : dates, devises, libellés et messages suivent la langue de la page. Les champs envoyés à l’API et la logique de réservation restent identiques. Polylang ne traduit pas automatiquement les textes éditoriaux.

Vérification autonome : `php tests/language.php` (résolution des langues, isolation du cache, transmission à Contrats).

Test navigateur du formulaire (devis, soumission simulée et confirmation FR/EN/ES) : importer `runBookingI18nChecks` depuis `tests/booking-i18n.mjs` et lui transmettre `chromium` de Playwright. Le test intercepte toutes les requêtes ; aucune réservation ni aucun email réel n’est créé.
