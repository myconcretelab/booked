# AGENTS

Ce dépôt contient le plugin WordPress `Booked`, utilisé pour afficher les blocs et widgets de réservation reliés à l'application contrats.

- À chaque modification du plugin, augmentez toujours très légèrement la version dans `booked.php` (`Version` dans l'en-tête du plugin et constante `BOOKED_VERSION`). Cette incrémentation permet de nettoyer le cache côté WordPress/navigateur et de forcer la prise en compte des nouveaux assets ou comportements.
- Les données utilisées par les blocs ne sont pas définies directement dans ce plugin. Elles sont fournies par le dépôt `contrats`, installé à côté de l'installation WordPress, et consommées par le plugin via l'API/configuration existante.
- Gardez les changements ciblés sur le plugin et évitez de dupliquer dans ce dépôt des données ou règles métier qui appartiennent au dépôt `contrats`.
- Faire un commit + push après chaque changement
- si la commande existe sur la machine, apres commit et push, executer "update booked".
