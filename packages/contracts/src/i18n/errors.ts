export const errors = {
  "error.invalid_request": [
    "The request was rejected. Rescan and try again.",
    "सेवा ने अनुरोध स्वीकार नहीं किया। पैनल फिर पढ़ें और दोबारा कोशिश करें।",
    "Se rechazó la solicitud. Vuelve a leer e inténtalo de nuevo.",
    "Requête refusée. Relisez et réessayez.",
    "رُفض الطلب. أعد القراءة وحاول مجدداً."
  ],
  "error.unauthorized": [
    "The pilot credential is invalid or expired. Get a new credential.",
    "पायलट क्रेडेंशियल मान्य नहीं है या समाप्त हो गया है। नया क्रेडेंशियल लें।",
    "La credencial es inválida o ha caducado. Obtén una nueva.",
    "L’identifiant est invalide ou expiré. Obtenez-en un nouveau.",
    "بيانات الاعتماد غير صالحة أو منتهية. احصل على بيانات جديدة."
  ],
  "error.rate_limited": [
    "Too many requests. Wait a minute and try again.",
    "बहुत जल्दी अनुरोध हुए। एक मिनट रुककर फिर कोशिश करें।",
    "Demasiadas solicitudes. Espera un minuto.",
    "Trop de requêtes. Attendez une minute.",
    "طلبات كثيرة. انتظر دقيقة وحاول مجدداً."
  ],
  "error.payload_too_large": [
    "The recording is too large. Make a shorter recording.",
    "रिकॉर्डिंग बहुत बड़ी है। छोटी रिकॉर्डिंग करें।",
    "La grabación es demasiado grande. Haz una más corta.",
    "Enregistrement trop volumineux. Faites-en un plus court.",
    "التسجيل كبير جداً. أنشئ تسجيلاً أقصر."
  ],
  "error.unsupported_media": [
    "The service cannot read this audio format.",
    "सेवा रिकॉर्डिंग का यह रूप नहीं समझती।",
    "El servicio no admite este formato de audio.",
    "Le service ne lit pas ce format audio.",
    "لا تدعم الخدمة تنسيق الصوت هذا."
  ],
  "error.provider_unavailable": [
    "The language service is unavailable. Continue with the keyboard and try later.",
    "भाषा सेवा अभी उपलब्ध नहीं है। कीबोर्ड से काम जारी रखें और बाद में कोशिश करें।",
    "El servicio no está disponible. Sigue con el teclado e inténtalo más tarde.",
    "Service linguistique indisponible. Continuez au clavier et réessayez plus tard.",
    "خدمة اللغة غير متاحة. تابع بلوحة المفاتيح وحاول لاحقاً."
  ],
  "error.provider_response_invalid": [
    "The language service returned an unusable reply. No suggestion was accepted.",
    "भाषा सेवा का जवाब समझ में नहीं आया, इसलिए कोई सुझाव नहीं लिया गया।",
    "La respuesta no es utilizable. No se aceptó ninguna sugerencia.",
    "Réponse inutilisable. Aucune suggestion acceptée.",
    "أعادت خدمة اللغة رداً غير صالح للاستخدام. لم يُقبل اقتراح."
  ],
  "error.service_not_configured": [
    "This service is not configured. Reading and local checks still work.",
    "यह सेवा इस सर्वर पर चालू नहीं है। पढ़ना और जाँच चलते रहते हैं।",
    "Este servicio no está configurado. La lectura y las comprobaciones locales funcionan.",
    "Service non configuré. Lecture et contrôles locaux restent disponibles.",
    "الخدمة غير مهيأة. تبقى القراءة والفحوص المحلية متاحة."
  ],
  "error.cancelled": [
    "Request cancelled.",
    "अनुरोध रद्द किया गया।",
    "Solicitud cancelada.",
    "Requête annulée.",
    "أُلغي الطلب."
  ],
  "error.not_found": [
    "This feature was not found on the service.",
    "सेवा पर यह सुविधा नहीं मिली।",
    "No se encontró esta función.",
    "Fonction introuvable sur le service.",
    "لم توجد هذه الميزة في الخدمة."
  ],
  "error.internal": [
    "The service encountered a problem. Try later.",
    "सेवा में गड़बड़ी हुई। बाद में कोशिश करें।",
    "El servicio tuvo un problema. Inténtalo más tarde.",
    "Le service a rencontré un problème. Réessayez plus tard.",
    "واجهت الخدمة مشكلة. حاول لاحقاً."
  ],
  "error.no_credential": [
    "Save a pilot credential in Settings first.",
    "पहले सेटिंग्स में पायलट क्रेडेंशियल भरें।",
    "Guarda primero una credencial en Ajustes.",
    "Enregistrez d’abord un identifiant dans les paramètres.",
    "احفظ بيانات اعتماد التجربة في الإعدادات أولاً."
  ],
  "error.network": [
    "Could not reach the service. Continue with the keyboard.",
    "सेवा से संपर्क नहीं हो पाया। कीबोर्ड से काम जारी रखें।",
    "No se pudo conectar. Sigue con el teclado.",
    "Service injoignable. Continuez au clavier.",
    "تعذر الاتصال بالخدمة. تابع بلوحة المفاتيح."
  ],
  "error.timeout": [
    "The service did not respond in time. Continue with the keyboard and try later.",
    "सेवा ने समय पर जवाब नहीं दिया। कीबोर्ड से काम जारी रखें और बाद में कोशिश करें।",
    "El servicio no respondió a tiempo. Sigue con el teclado e inténtalo más tarde.",
    "Le service n’a pas répondu à temps. Continuez au clavier et réessayez plus tard.",
    "لم ترد الخدمة في الوقت المحدد. تابع بلوحة المفاتيح وحاول لاحقاً."
  ],
  "error.invalid_response": [
    "The reply did not match the expected format and was discarded.",
    "सेवा का जवाब अनुबंध से मेल नहीं खाया, इसलिए उसे नहीं लिया गया।",
    "La respuesta no tenía el formato esperado y se descartó.",
    "La réponse ne respectait pas le format attendu et a été ignorée.",
    "لم يطابق الرد التنسيق المتوقع فتُجاهل."
  ],
  "error.microphone_denied": [
    "Microphone permission was denied. Allow it in Chrome settings or type the value.",
    "माइक्रोफ़ोन की अनुमति नहीं मिली। Chrome सेटिंग में अनुमति दें या मान कीबोर्ड से लिखें।",
    "Se denegó el micrófono. Permítelo en Chrome o escribe el valor.",
    "Microphone refusé. Autorisez-le dans Chrome ou saisissez la valeur.",
    "رُفض إذن الميكروفون. اسمح به في إعدادات Chrome أو اكتب القيمة."
  ],
  "error.microphone_unavailable": [
    "No microphone is available. Type the value.",
    "कोई माइक्रोफ़ोन नहीं मिला। मान कीबोर्ड से लिखें।",
    "No hay micrófono. Escribe el valor.",
    "Aucun microphone disponible. Saisissez la valeur.",
    "لا يتوفر ميكروفون. اكتب القيمة."
  ],
  "error.nothing_recorded": [
    "Nothing was recorded. Try again.",
    "रिकॉर्डिंग में कुछ नहीं मिला। फिर कोशिश करें।",
    "No se grabó nada. Reinténtalo.",
    "Rien n’a été enregistré. Réessayez.",
    "لم يُسجل شيء. حاول مجدداً."
  ],
  "kind.name": [
    "Name",
    "नाम",
    "Nombre",
    "Nom",
    "الاسم"
  ],
  "kind.date": [
    "Date",
    "तारीख",
    "Fecha",
    "Date",
    "التاريخ"
  ],
  "kind.address": [
    "Address",
    "पता",
    "Dirección",
    "Adresse",
    "العنوان"
  ],
  "kind.place": [
    "Place",
    "स्थान",
    "Lugar",
    "Lieu",
    "المكان"
  ],
  "kind.identifier": [
    "Identifier",
    "पहचान संख्या",
    "Identificador",
    "Identifiant",
    "المعرّف"
  ],
  "kind.contact": [
    "Contact",
    "संपर्क",
    "Contacto",
    "Contact",
    "التواصل"
  ],
  "kind.choice": [
    "Choice",
    "विकल्प",
    "Opción",
    "Choix",
    "الخيار"
  ],
  "kind.document": [
    "Document",
    "दस्तावेज़",
    "Documento",
    "Document",
    "المستند"
  ],
  "kind.amount": [
    "Amount",
    "राशि",
    "Importe",
    "Montant",
    "المبلغ"
  ],
  "kind.other": [
    "Other",
    "अन्य",
    "Otro",
    "Autre",
    "أخرى"
  ]
} as const satisfies Record<string, readonly [string, string, string, string, string]>;
