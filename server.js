const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { evaluateIntent } = require('./services/intentService.js');

const app = express();

// Middleware nativo para habilitar CORS sin dependencias externas
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// 1. Configuración de Supabase
const SUPABASE_URL = 'https://lbkrwlzxlfwwcjwyhten.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxia3J3bHp4bGZ3d2Nqd3lodGVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjYzMTkxMCwiZXhwIjoyMTAyMjA3OTEwfQ.Po3AEEO_EPA2KpiXv7FYazhLyeDVPIH9kXko64accZ0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 2. Función helper para responder al usuario vía WhatsApp Cloud API
async function sendWhatsAppMessage(to, textBody) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('⚠️ No se han configurado WHATSAPP_TOKEN o PHONE_NUMBER_ID en las variables de entorno.');
    return;
  }

  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
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
      console.log(`📤 Respuesta enviada exitosamente a ${to}. ID del mensaje:`, data.messages?.[0]?.id);
    }
  } catch (error) {
    console.error('❌ Error en la petición a WhatsApp Cloud API:', error.message);
  }
}

// 3. Endpoint de verificación de Webhook para Meta (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'parroquia_secret_token_2026';

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verificado correctamente con el token.');
      return res.status(200).send(challenge);
    } else {
      console.error('❌ Falló la verificación del token. Recibido:', token);
      return res.sendStatus(403);
    }
  } else if (challenge) {
    console.log('⚠️ Respondiendo challenge directo.');
    return res.status(200).send(challenge);
  }

  res.status(200).send('🚀 Servidor del Webhook de Misas activo y listo.');
});

// 4. Endpoint que recibe los mensajes de WhatsApp (POST)
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Validar que la estructura sea un evento de Meta/WhatsApp
    if (body.object) {
      // Responder a Meta de inmediato (< 3s) para evitar timeouts y reintentos
      res.status(200).send('EVENT_RECEIVED');

      console.log('📩 Petición POST recibida en /webhook:', JSON.stringify(body, null, 2));

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      // Si no es un mensaje (ej. notificación de estado "read" o "delivered"), salir silenciosamente
      if (!message) return;

      if (message.type === 'text') {
        const textoMensaje = message.text.body;
        const numeroRemitente = message.from; // Número de WhatsApp del feligrés

        // 🧠 EVALUAR INTENCIÓN
        const { intent, responseText } = await evaluateIntent(textoMensaje);
        console.log(`💬 Mensaje recibido de ${numeroRemitente}: "${textoMensaje}" | Intención: [${intent}]`);
        console.log(`🤖 Respuesta preparada:\n${responseText}`);

        // 📤 1. Responder automáticamente al feligrés por WhatsApp
        await sendWhatsAppMessage(numeroRemitente, responseText);

        // 🗄️ 2. Buscar la misa activa en Supabase
        const { data: misas, error: errorMisa } = await supabase
          .from('misas_instancia')
          .select('id_misa')
          .eq('estado', 'ACTIVA')
          .order('id_misa', { ascending: false })
          .limit(1);

        if (errorMisa || !misas || misas.length === 0) {
          console.error('⚠️ No se encontró ninguna Misa ACTIVA para asignar la intención.', errorMisa);
          return;
        }

        const idMisaActiva = misas[0].id_misa;

        // 📝 3. Registrar la intención en Supabase
        const { error: errorInsert } = await supabase
          .from('intenciones')
          .insert([
            {
              id_misa: idMisaActiva,
              id_tipo_intencion: 7, 
              detalle_intencion: `[${intent}] ${textoMensaje}`,
              origen: 'WHATSAPP_FELIGRES'
            }
          ]);

        if (errorInsert) {
          console.error('❌ Error al guardar la intención en Supabase:', errorInsert.message);
        } else {
          console.log(`✨ ¡Intención (${intent}) guardada exitosamente en Misa #${idMisaActiva}!`);
        }
      }
    } else {
      console.log('⚠️ Se recibió un POST sin la estructura "object" de Meta:', body);
      res.status(400).send('Formato no válido: se requiere el objeto de Meta/WhatsApp.');
    }
  } catch (err) {
    console.error('❌ Error procesando el webhook:', err.message);
    if (!res.headersSent) {
      res.sendStatus(500);
    }
  }
});

// 5. Inicialización del servidor HTTP
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook escuchando en el puerto ${PORT}`);
});
