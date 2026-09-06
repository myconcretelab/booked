(function () {
  const language = String(document.documentElement.lang || window.BookedWidgetConfig?.language || 'fr').toLowerCase().split(/[-_]/)[0];
  const locale = {fr: 'fr-FR', en: 'en-GB', es: 'es-ES'}[language] || 'fr-FR';
  const messages = {
  "Mise à jour...": {
    "en": "Updating…",
    "es": "Actualizando…"
  },
  "Mise à jour impossible.": {
    "en": "Unable to update. Please try again.",
    "es": "No se ha podido actualizar. Inténtalo de nuevo."
  },
  "Erreur Booked.": {
    "en": "Unable to process your request. Please try again.",
    "es": "No se ha podido procesar la solicitud. Inténtalo de nuevo."
  },
  "Mois précédent": {
    "en": "Previous month",
    "es": "Mes anterior"
  },
  "Mois suivant": {
    "en": "Next month",
    "es": "Mes siguiente"
  },
  "Calendrier des disponibilités": {
    "en": "Availability calendar",
    "es": "Calendario de disponibilidad"
  },
  "Disponible": {
    "en": "Available",
    "es": "Disponible"
  },
  "Réservé": {
    "en": "Booked",
    "es": "Reservado"
  },
  "Option": {
    "en": "Temporarily held",
    "es": "Reserva provisional"
  },
  "Navigation impossible.": {
    "en": "Unable to load these dates.",
    "es": "No se han podido cargar estas fechas."
  },
  "Chargement des disponibilités…": {
    "en": "Loading availability…",
    "es": "Cargando disponibilidad…"
  },
  "Calendrier indisponible.": {
    "en": "Calendar unavailable.",
    "es": "Calendario no disponible."
  },
  "Widget indisponible.": {
    "en": "Booking widget unavailable.",
    "es": "El módulo de reservas no está disponible."
  },
  "Ajouter une date": {
    "en": "Add a date",
    "es": "Añadir fecha"
  },
  "Ajoutez vos dates de voyage pour connaître le prix exact": {
    "en": "Add your travel dates to see the exact price",
    "es": "Añade las fechas de tu estancia para ver el precio exacto"
  },
  "Sélection des dates": {
    "en": "Date selection",
    "es": "Selección de fechas"
  },
  "Sélectionnez les dates": {
    "en": "Select dates",
    "es": "Selecciona las fechas"
  },
  "Arrivée": {
    "en": "Check-in",
    "es": "Llegada"
  },
  "Départ": {
    "en": "Check-out",
    "es": "Salida"
  },
  "Effacer les dates": {
    "en": "Clear dates",
    "es": "Borrar fechas"
  },
  "Fermer": {
    "en": "Close",
    "es": "Cerrar"
  },
  "Retour aux détails": {
    "en": "Back to details",
    "es": "Volver a los detalles"
  },
  "Demande de réservation": {
    "en": "Booking request",
    "es": "Solicitud de reserva"
  },
  "Prénom": {
    "en": "First name",
    "es": "Nombre"
  },
  "Nom": {
    "en": "Last name",
    "es": "Apellidos"
  },
  "Téléphone": {
    "en": "Phone",
    "es": "Teléfono"
  },
  "Email": {
    "en": "Email",
    "es": "Correo electrónico"
  },
  "Envoi...": {
    "en": "Sending…",
    "es": "Enviando…"
  },
  "Envoyer la demande": {
    "en": "Send booking request",
    "es": "Enviar solicitud"
  },
  "Demande enregistrée.": {
    "en": "Your request has been received.",
    "es": "Hemos recibido tu solicitud."
  },
  "Envoi impossible.": {
    "en": "Unable to send. Please try again.",
    "es": "No se ha podido enviar. Inténtalo de nuevo."
  },
  "Indiquez vos dates pour afficher les prix": {
    "en": "Enter your dates to see prices",
    "es": "Indica tus fechas para ver los precios"
  },
  "Voyageurs": {
    "en": "Guests",
    "es": "Huéspedes"
  },
  "Nombre de voyageurs": {
    "en": "Number of guests",
    "es": "Número de huéspedes"
  },
  "Vérification...": {
    "en": "Checking…",
    "es": "Comprobando…"
  },
  "Vérifier la disponibilité": {
    "en": "Check availability",
    "es": "Comprobar disponibilidad"
  },
  "Aucun montant ne vous sera débité pour le moment": {
    "en": "You will not be charged yet",
    "es": "Todavía no se realizará ningún cargo"
  },
  "Carte de réservation indisponible.": {
    "en": "Booking form unavailable.",
    "es": "Formulario de reserva no disponible."
  },
  "Prix indisponible.": {
    "en": "Price unavailable for these dates.",
    "es": "Precio no disponible para estas fechas."
  },
  "Surface": {
    "en": "Floor area",
    "es": "Superficie"
  },
  "Capacité": {
    "en": "Capacity",
    "es": "Capacidad"
  },
  "Couchages": {
    "en": "Sleeps",
    "es": "Plazas para dormir"
  },
  "Cheminée": {
    "en": "Fireplace",
    "es": "Chimenea"
  },
  "Oui": {
    "en": "Yes",
    "es": "Sí"
  },
  "Non": {
    "en": "No",
    "es": "No"
  },
  "Jardin privé": {
    "en": "Private garden",
    "es": "Jardín privado"
  },
  "Cour privée": {
    "en": "Private courtyard",
    "es": "Patio privado"
  },
  "Chambres": {
    "en": "Bedrooms",
    "es": "Dormitorios"
  },
  "Salles d'eau": {
    "en": "Shower rooms",
    "es": "Baños con ducha"
  },
  "Voir le gîte": {
    "en": "View cottage",
    "es": "Ver alojamiento"
  },
  "Chargement des gîtes...": {
    "en": "Loading cottages…",
    "es": "Cargando alojamientos…"
  },
  "Aucun gîte disponible.": {
    "en": "No cottages available.",
    "es": "No hay alojamientos disponibles."
  },
  "Sélectionnez au moins un gîte.": {
    "en": "Select at least one cottage.",
    "es": "Selecciona al menos un alojamiento."
  },
  "Sélectionnez un gîte.": {
    "en": "Select a cottage.",
    "es": "Selecciona un alojamiento."
  },
  "Agrandir l'image": {
    "en": "Enlarge image",
    "es": "Ampliar imagen"
  },
  "Précédente": {
    "en": "Previous",
    "es": "Anterior"
  },
  "Suivante": {
    "en": "Next",
    "es": "Siguiente"
  },
  "Chargement...": {
    "en": "Loading…",
    "es": "Cargando…"
  },
  "Galerie Booked indisponible.": {
    "en": "Photo gallery unavailable.",
    "es": "Galería de fotos no disponible."
  },
  "Galerie indisponible.": {
    "en": "Gallery unavailable.",
    "es": "Galería no disponible."
  },
  "Aucune image disponible.": {
    "en": "No images available.",
    "es": "No hay imágenes disponibles."
  },
  "Aucune information disponible.": {
    "en": "No information available.",
    "es": "No hay información disponible."
  },
  "Contenu Booked indisponible.": {
    "en": "Cottage information unavailable.",
    "es": "Información del alojamiento no disponible."
  },
  "Contenu indisponible.": {
    "en": "Content unavailable.",
    "es": "Contenido no disponible."
  },
  "Infos du gîte": {
    "en": "Cottage information",
    "es": "Información del alojamiento"
  },
  "Détails": {
    "en": "Details",
    "es": "Detalles"
  },
  "départ possible, indisponible à partir de cette date": {
    "en": "check-out available, unavailable from this date",
    "es": "salida posible, no disponible a partir de esta fecha"
  },
  "disponible": {
    "en": "available",
    "es": "disponible"
  },
  "indisponible": {
    "en": "unavailable",
    "es": "no disponible"
  },
  "option temporaire": {
    "en": "temporarily held",
    "es": "reserva provisional"
  },
  "{count} nuit": {
    "en": "{count} night",
    "es": "{count} noche"
  },
  "{count} nuits": {
    "en": "{count} nights",
    "es": "{count} noches"
  },
  "{count} voyageur": {
    "en": "{count} guest",
    "es": "{count} huésped"
  },
  "{count} voyageurs": {
    "en": "{count} guests",
    "es": "{count} huéspedes"
  },
  "{count} nuits minimum": {
    "en": "Minimum {count} nights",
    "es": "Mínimo {count} noches"
  },
  "Un minimum de {count} nuits est requis": {
    "en": "A minimum of {count} nights is required",
    "es": "Se requiere un mínimo de {count} noches"
  },
  "Capacité max {count} personnes": {
    "en": "Up to {count} guests",
    "es": "Hasta {count} huéspedes"
  },
  "Modifier les dates du séjour, {nights}": {
    "en": "Change stay dates, {nights}",
    "es": "Cambiar las fechas de la estancia, {nights}"
  },
  "Demande enregistrée. Les dates sont bloquées jusqu'au {date}.": {
    "en": "Your request has been received. The dates are held until {date}.",
    "es": "Hemos recibido tu solicitud. Las fechas quedan bloqueadas hasta el {date}."
  },
  "{price} au total": {
    "en": "{price} total",
    "es": "{price} en total"
  },
  "Voir {name}": {
    "en": "View {name}",
    "es": "Ver {name}"
  },
  "Agrandir {name}": {
    "en": "Enlarge {name}",
    "es": "Ampliar {name}"
  },
  "Voir les {count} photos": {
    "en": "View all {count} photos",
    "es": "Ver las {count} fotos"
  },
  "{count} pers.": {
    "en": "{count} guests",
    "es": "{count} personas"
  },
  "Le gîte est déjà réservé sur cette période.": {
    "en": "This cottage is already booked for these dates.",
    "es": "Este alojamiento ya está reservado para estas fechas."
  },
  "Le gîte est temporairement bloqué par une autre demande.": {
    "en": "These dates are temporarily held by another booking request.",
    "es": "Estas fechas están bloqueadas temporalmente por otra solicitud."
  },
  "La date de sortie doit être postérieure à la date d'entrée.": {
    "en": "Check-out must be after check-in.",
    "es": "La salida debe ser posterior a la llegada."
  },
  "Date invalide.": {
    "en": "Invalid date.",
    "es": "Fecha no válida."
  },
  "Capacité invalide pour ce gîte.": {
    "en": "The number of guests exceeds this cottage’s capacity.",
    "es": "El número de huéspedes supera la capacidad del alojamiento."
  },
  "Trop de demandes. Réessayez dans quelques minutes.": {
    "en": "Too many requests. Please try again in a few minutes.",
    "es": "Demasiadas solicitudes. Inténtalo de nuevo en unos minutos."
  },
  "{count} nuit minimum": {
    "en": "Minimum {count} night",
    "es": "Mínimo {count} noche"
  },
  "Un minimum de {count} nuit est requis": {
    "en": "A minimum of {count} night is required",
    "es": "Se requiere un mínimo de {count} noche"
  },
  "Trop de requêtes. Réessayez dans quelques minutes.": {
    "en": "Too many requests. Please try again in a few minutes.",
    "es": "Demasiadas solicitudes. Inténtalo de nuevo en unos minutos."
  },
  "Service Booked temporairement indisponible.": {
    "en": "The booking service is temporarily unavailable. Please try again later.",
    "es": "El servicio de reservas no está disponible temporalmente. Inténtalo de nuevo más tarde."
  },
  "Vacances scolaires": {
    "en": "School holidays",
    "es": "Vacaciones escolares"
  },
  "Pont": {
    "en": "Bank holiday weekend",
    "es": "Puente festivo"
  },
  "Juillet et août": {
    "en": "July and August",
    "es": "Julio y agosto"
  },
  "Veuillez renseigner ce champ.": {
    "en": "Please fill in this field.",
    "es": "Completa este campo."
  },
  "Veuillez saisir une adresse email valide.": {
    "en": "Please enter a valid email address.",
    "es": "Introduce una dirección de correo electrónico válida."
  },
  "Image défilante": {
    "en": "Image slideshow",
    "es": "Presentación de imágenes"
  },
  "Photo précédente": {
    "en": "Previous photo",
    "es": "Foto anterior"
  },
  "Photo suivante": {
    "en": "Next photo",
    "es": "Foto siguiente"
  },
  "Afficher la photo {count}": {
    "en": "Show photo {count}",
    "es": "Mostrar foto {count}"
  }
};
  const t = (message, values = {}) => {
    const translated = messages[message]?.[language] || message;
    return translated.replace(/\{(\w+)\}/g, (match, key) => Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match);
  };
  const count = (value, singular, plural) => t(value === 1 ? singular : plural, {count:value});
  const error = (payload) => {
    const message = payload.error || payload.message || 'Erreur Booked.';
    if (language === 'fr' || messages[message]) return t(message);
    const minimum = message.match(/La durée minimale pour cette période est de (\d+) nuit/);
    if (minimum) return t('Un minimum de {count} nuits est requis', {count:minimum[1]});
    if (message.includes('Aucun tarif saisonnier')) return t('Prix indisponible.');
    if (message.includes('capacité') || message.includes('Capacité') || message.includes('adultes') || message.includes('enfants')) return t('Capacité invalide pour ce gîte.');
    return t('Erreur Booked.');
  };
  window.BookedI18n = {language, locale, t, count, error};
})();
