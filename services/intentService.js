export function evaluateIntent(text = '') {
  const clean = text.trim().toLowerCase();
  const rawText = text.trim();

  // 1. Detectar intenciones de Difuntos (Debe ir PRIMERO para evitar conflicto con la palabra "misa")
  // Coincide con: "misa por difunto...", "intencion por...", "misa de difunto...", "misa por Juan Perez"
  const regexDifunto = /(?:misa|intención|intencion)\s+(?:por|para)?\s*(?:el\s+)?(?:difunto|fallecido|fallecida)?\s*(.+)/i;
  const match = rawText.match(regexDifunto);

if (match && match[1]) {
    const nombreExtraido = match[1].trim();
    return {
      intent: 'INTENCION_DIFUNTO',
      idTipoIntencion: 1, // 👈 ID correspondiente a Difuntos en tu base de datos
      nombrePersona: nombreExtraido,
      responseText: `⛪ *Intención de Misa Registrada*\n\nHemos anotado la intención por el descanso eterno de *${nombreExtraido}*.\n\nSera programado para la próxima misa disponible.`
    };
  }

  // 2. Horarios
  if (clean === '1' || ['misa', 'misas', 'horario', 'horarios'].some(w => clean.includes(w))) {
    return { 
      intent: 'GET_MASS_TIMES', 
      responseText: '⛪ *Horarios de Misas*\n\n• Lunes a Viernes: 6:30 PM\n• Sábados: 6:00 PM\n• Domingos: 8:00 AM, 10:30 AM y 6:00 PM' 
    };
  }

  // 3. Ubicación
  if (clean === '2' || ['ubicacion', 'donde', 'direccion', 'contacto'].some(w => clean.includes(w))) {
    return { 
      intent: 'GET_LOCATION', 
      responseText: '📍 *Ubicación*\n\nNos encontramos en la Av. Principal #123.' 
    };
  }

  // 4. Saludo / Menú por defecto
  return { 
    intent: 'GREETING', 
    responseText: '¡Hola! 👋 Bienvenido.\n\n1. Ver horarios de misas ⛪\n2. Ubicación 📍\n\nResponde con el número de tu opción o escribe la intención de misa.' 
  };
}
