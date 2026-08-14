// Función para enviar mensajes a través de la API de WhatsApp Cloud
async function sendWhatsAppMessage(to, textBody) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || 'TU_WHATSAPP_TOKEN_AQUI';
  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || 'TU_PHONE_NUMBER_ID_AQUI';

  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to, // Número de teléfono del destinatario (ej. "1809XXXXXXX")
    type: 'text',
    text: {
      preview_url: false,
      body: textBody
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error al enviar mensaje por WhatsApp:', data);
    } else {
      console.log(`📤 Respuesta enviada a ${to} por WhatsApp. Message ID:`, data.messages?.[0]?.id);
    }
  } catch (error) {
    console.error('❌ Error en la llamada a Meta API:', error.message);
  }
}
