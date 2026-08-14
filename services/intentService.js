export function evaluateIntent(text = '') {
  const clean = text.trim().toLowerCase();

  // 1. Horarios
  if (clean === '1' || ['misa', 'misas', 'horario', 'horarios'].some(w => clean.includes(w))) {
    return { 
      intent: 'GET_MASS_TIMES', 
      responseText: '⛪ *Horarios de Misas*\n\n• Lunes a Viernes: 6:30 PM\n• Sábados: 6:00 PM\n• Domingos: 8:00 AM, 10:30 AM y 6:00 PM' 
    };
  }

  // 2. Ubicación
  if (clean === '2' || ['ubicacion', 'donde', 'direccion', 'contacto'].some(w => clean.includes(w))) {
    return { 
      intent: 'GET_LOCATION', 
      responseText: '📍 *Ubicación*\n\nNos encontramos en la Av. Principal #123.' 
    };
  }

// Ejemplo dentro de intentService.js
   const textoLimpio = texto.trim();

  // Patrón para detectar solicitudes de difuntos
  // Coincide con: "misa por difunto...", "intención por el difunto...", "misa de difunto..."
  const regexDifunto = /(?:misa|intención|intencion)\s+(?:por|para)?\s*(?:el\s+)?(?:difunto|fallecido|fallecida)?\s*(.+)/i;
  const match = textoLimpio.match(regexDifunto);

  if (match) {
    // match[1] captura todo lo que viene después de la frase clave (el nombre)
    const nombreExtraido = match[1].trim(); 

    return {
      intent: 'INTENCION_DIFUNTO',
      nombrePersona: nombreExtraido,
      responseText: `⛪ *Intención de Misa Registrada*\n\nHemos anotado la intención por el descanso eterno de *${nombreExtraido}*.\n\nSera programado para la próxima misa disponible.`
    };
  
  
  // Saludo / Menú por defecto
  return { 
    intent: 'GREETING', 
    responseText: '¡Hola! 👋 Bienvenido.\n\n1. Ver horarios de misas ⛪\n2. Ubicación 📍\n\nResponde con el número de tu opción.' 
  };


 

  
}
  
}
