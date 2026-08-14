const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { evaluateIntent } = require('./services/intentService.js');

const app = express();
app.use(express.json());

// 1. Configuración de Supabase
const SUPABASE_URL = 'https://lbkrwlzxlfwwcjwyhten.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxia3J3bHp4bGZ3d2Nqd3lodGVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjYzMTkxMCwiZXhwIjoyMTAyMjA3OTEwfQ.Po3AEEO_EPA2KpiXv7FYazhLyeDVPIH9kXko64accZ0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 2. Endpoint de verificación de Webhook para Meta (GET)
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

// 3. Endpoint que recibe los mensajes de WhatsApp (POST)
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    if (body.object) {
      res.status(200).send('EVENT_RECEIVED');

      console.log('📩 Petición POST recibida en /webhook:', JSON.stringify(body, null, 2));

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (!message) return;

      if (message.type === 'text') {
        const textoMensaje = message.text.body;
        
        // 🧠 EVALUAR INTENCIÓN CON EL SERVICIO CREADO
        const { intent, responseText } = evaluateIntent(textoMensaje);
        console.log(`💬 Mensaje recibido: "${textoMensaje}" | Intención detectada: [${intent}]`);
        console.log(`🤖 Respuesta preparada:\n${responseText}`);

        // Buscar la misa con estado ACTIVA
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

        // Insertar en Supabase incluyendo el detalle y la intención evaluada
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
      res.sendStatus(404);
    }
  } catch (err) {
    console.error('❌ Error procesando el webhook:', err.message);
  }
});

// 4. Inicialización del servidor HTTP
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook escuchando en el puerto ${PORT}`);
});
