# Contenus multilingues

Booked utilise la langue courante Polylang, puis WPML, puis la locale WordPress. Les langues prises en charge sont `fr`, `en`, `es` ; les autres utilisent `fr`.

Les textes restent gérés dans Contrats, dans Présentation web → Traductions du site. Les blocs de texte, informations gîte et galeries demandent les contenus et les métadonnées photo dans la langue de la page. Les caches PHP et navigateur de ces contenus sont séparés par langue. Les photos WordPress restent uniques : seuls leurs textes affichés sont localisés, sans écraser la médiathèque française.

Les routes REST `/booked/v1/gites/{id}/content` et `/booked/v1/gites/{id}/photos` acceptent `?lang=en` ou `?lang=es`. Sans paramètre elles utilisent la langue WordPress. Le serveur Contrats doit être mis à jour et sa migration appliquée avant ce plugin.

Les pages, les menus, les phrases personnalisées WordPress et le formulaire de réservation constituent des contenus distincts des fiches gîtes ; leur traduction est à gérer séparément. Polylang ne traduit pas automatiquement les textes.

Vérification autonome : `php tests/language.php` (résolution des langues, isolation du cache, transmission à Contrats).
