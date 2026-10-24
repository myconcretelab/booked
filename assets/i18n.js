(function () {
  const language = String(document.documentElement.lang || window.BookedWidgetConfig?.language || 'fr').toLowerCase().split(/[-_]/)[0];
  const locale = {fr: 'fr-FR', en: 'en-GB', es: 'es-ES'}[language] || 'fr-FR';
  const messages = {
  "Comment souhaitez-vous régler ?": {"en": "How would you like to pay?", "es": "¿Cómo quieres pagar?"},
  "Mode test : aucun paiement réel.": {"en": "Test mode: no real payment.", "es": "Modo de prueba: ningún pago real."},
  "Paiement sur place": {"en": "Pay on arrival", "es": "Pago en el alojamiento"},
  "Votre demande sera soumise à notre approbation. Aucun paiement maintenant.": {"en": "Your request will require our approval. No payment now.", "es": "Tu solicitud requiere nuestra aprobación. No pagas ahora."},
  "Payer les arrhes par carte": {"en": "Pay the deposit by card", "es": "Pagar la señal con tarjeta"},
  "Réservation confirmée après paiement. Solde sur place : {price}.": {"en": "Booking confirmed after payment. Balance on arrival: {price}.", "es": "Reserva confirmada tras el pago. Saldo en el alojamiento: {price}."},
  "Payer la totalité par carte": {"en": "Pay in full by card", "es": "Pagar la totalidad con tarjeta"},
  "Réservation confirmée après paiement. Tout est réglé.": {"en": "Booking confirmed after payment. Fully paid.", "es": "Reserva confirmada tras el pago. Todo pagado."},
  "Arrhes sur l’hébergement : {base} × {rate} = {amount}": {"en": "Deposit on accommodation: {base} × {rate} = {amount}", "es": "Señal sobre el alojamiento: {base} × {rate} = {amount}"},
  "Arrhes à régler maintenant": {"en": "Deposit due now", "es": "Señal a pagar ahora"},
  "À régler maintenant": {"en": "Due now", "es": "A pagar ahora"},
  "Solde à régler sur place": {"en": "Balance due on arrival", "es": "Saldo a pagar en el alojamiento"},
  "À régler maintenant : {price}": {"en": "Due now: {price}", "es": "A pagar ahora: {price}"},
  "Redirection vers Stripe…": {"en": "Redirecting to Stripe…", "es": "Redirigiendo a Stripe…"},
  "Payer et confirmer ma réservation": {"en": "Pay and confirm my booking", "es": "Pagar y confirmar mi reserva"},
  "Paiement sécurisé par Stripe. Confirmation automatique après paiement.": {"en": "Secure payment by Stripe. Automatically confirmed after payment.", "es": "Pago seguro con Stripe. Confirmación automática tras el pago."},
  "Vérification de votre paiement…": {"en": "Checking your payment…", "es": "Verificando tu pago…"},
  "Nous vérifions le paiement auprès de Stripe. Patientez quelques instants.": {"en": "We are checking your payment with Stripe. Please wait a moment.", "es": "Estamos verificando tu pago con Stripe. Espera un momento."},
  "Votre réservation est confirmée !": {"en": "Your booking is confirmed!", "es": "¡Tu reserva está confirmada!"},
  "Paiement reçu : {paid}. Solde à régler sur place : {remaining}. Un email de confirmation vous sera envoyé.": {"en": "Payment received: {paid}. Balance on arrival: {remaining}. A confirmation email will be sent.", "es": "Pago recibido: {paid}. Saldo en el alojamiento: {remaining}. Recibirás un correo de confirmación."},
  "Paiement annulé ou expiré": {"en": "Payment cancelled or expired", "es": "Pago cancelado o caducado"},
  "Votre réservation n’est pas confirmée. Vous pouvez faire une nouvelle demande.": {"en": "Your booking is not confirmed. You can make a new request.", "es": "Tu reserva no está confirmada. Puedes hacer una nueva solicitud."},
  "Votre paiement nécessite un suivi": {"en": "Your payment needs a follow-up", "es": "Tu pago necesita seguimiento"},
  "Contactez-nous avec la référence {reference}. Aucun nouveau paiement n’est nécessaire.": {"en": "Contact us with reference {reference}. Do not make another payment.", "es": "Contacta con nosotros con la referencia {reference}. No hace falta pagar otra vez."},
  "La vérification prend plus de temps que prévu. Réessayez ici dans un instant, sans effectuer un nouveau paiement.": {"en": "Verification is taking longer than expected. Try again here shortly, without making another payment.", "es": "La verificación tarda más de lo previsto. Inténtalo de nuevo aquí en un momento, sin volver a pagar."},
  "Vérifier à nouveau": {"en": "Check again", "es": "Verificar de nuevo"},

  "Personnalisez votre séjour": {"en": "Make your stay your own", "es": "Personaliza tu estancia"},
  "Ajoutez les petits plus qui vous font plaisir. Tout est facultatif.": {"en": "Choose the extras you would enjoy. Everything is optional.", "es": "Elige los extras que te apetezcan. Todo es opcional."},
  "Un jeu de draps par lit choisi.": {"en": "One set of bed linen for each selected bed.", "es": "Un juego de sábanas por cada cama elegida."},
  "Linge de toilette": {"en": "Towels", "es": "Toallas"},
  "Du linge de toilette pour les personnes de votre choix.": {"en": "Towels for as many guests as you choose.", "es": "Toallas para las personas que elijas."},
  "Chiens": {"en": "Dogs", "es": "Perros"},
  "Votre compagnon vous accompagne pendant le séjour.": {"en": "Bring your dog along for your stay.", "es": "Tu perro te acompaña durante la estancia."},
  "Ménage de fin de séjour": {"en": "End-of-stay cleaning", "es": "Limpieza al final de la estancia"},
  "Profitez du départ, nous nous occupons du ménage.": {"en": "Enjoy your last moments; we will take care of the cleaning.", "es": "Disfruta hasta el final, nosotros nos encargamos de la limpieza."},
  "Départ tardif": {"en": "Late check-out", "es": "Salida tardía"},
  "Prolongez votre dernière matinée, selon disponibilité.": {"en": "Enjoy a longer last morning, subject to availability.", "es": "Disfruta de una última mañana más larga, según disponibilidad."},
  "Nombre de personnes": {"en": "Number of people", "es": "Número de personas"},
  "Nombre de chiens": {"en": "Number of dogs", "es": "Número de perros"},
  "{price} / lit / séjour": {"en": "{price} / bed / stay", "es": "{price} / cama / estancia"},
  "{price} / personne / séjour": {"en": "{price} / person / stay", "es": "{price} / persona / estancia"},
  "{price} / chien / nuit": {"en": "{price} / dog / night", "es": "{price} / perro / noche"},
  "{price} / séjour": {"en": "{price} / stay", "es": "{price} / estancia"},
  "Diminuer : {option}": {"en": "Decrease: {option}", "es": "Reducir: {option}"},
  "Augmenter : {option}": {"en": "Increase: {option}", "es": "Aumentar: {option}"},
  "Calcul en cours…": {"en": "Calculating…", "es": "Calculando…"},
  "{price} pour le séjour": {"en": "{price} for the stay", "es": "{price} por la estancia"},
  "Vos coordonnées": {"en": "Your contact details", "es": "Tus datos de contacto"},
  "Hébergement": {"en": "Accommodation", "es": "Alojamiento"},
  "Options choisies": {"en": "Selected extras", "es": "Extras elegidos"},
  "Taxe de séjour": {"en": "Tourist tax", "es": "Tasa turística"},
  "Total du séjour": {"en": "Stay total", "es": "Total de la estancia"},
  "Mise à jour du total…": {"en": "Updating total…", "es": "Actualizando el total…"},
  "Options": {"en": "Extras", "es": "Extras"},
  "Ménage": {"en": "Cleaning", "es": "Limpieza"},
  "Draps": {"en": "Bed linen", "es": "Sábanas"},
  "Nombre de lits": {"en": "Number of beds", "es": "Número de camas"},
  "{count} lit": {"en": "{count} bed", "es": "{count} cama"},
  "{count} lits": {"en": "{count} beds", "es": "{count} camas"},
  "{price} / lit": {"en": "{price} / bed", "es": "{price} / cama"},

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
  "Demandes ou commentaires (facultatif)": {
    "en": "Requests or comments (optional)",
    "es": "Peticiones o comentarios (opcional)"
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
