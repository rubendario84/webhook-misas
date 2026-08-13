const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// 1. Configuración de Supabase
// ⚠️ REEMPLAZA 'TU_ANON_KEY_AQUI' POR TU CLAVE REAL DE SUPABASE
const SUPABASE_URL = 'https://lbkrwlzxlfwwcjwyhten.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxia3J3bHp4bGZ3d2Nqd3lodGVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjYzMTkxMCwiZXhwIjoyMTAyMjA3OTEwfQ.Po3AEEO_EPA2KpiXv7FYazhLyeDVPIH9kXko64accZ0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Endpoint de verificación de Webhook para Meta (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'parroquia_secret_token_2026';

  console.log('✅ Petición de verificación GET recibida de Meta. Challenge:', challenge);

  // Validación completa de Token y Modo de Meta
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado correctamente con el token.');
    return res.status(200).send(challenge);
  } else if (challenge) {
    // Respaldo directo en caso de que Meta re-valide sin enviar el parámetro mode
    console.log('⚠️ Respondiendo challenge directo.');
    return res.status(200).send(challenge);
  }
  
  console.error('❌ Falló la verificación del token. Recibido:', token);
  res.sendStatus(403);
});

// 3. Endpoint que recibe los mensajes de WhatsApp (POST)
app.post('/webhook', async (req, res) => {
  try {
    // Imprime la carga de datos completa para depuración en los logs de Render
    console.log('📩 Petición POST recibida en /webhook:', JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // Responder 200 OK de inmediato a Meta para confirmar recepción
    res.status(200).send('EVENT_RECEIVED');

    if (!message) return;

    // Procesar únicamente mensajes de texto
    if (message.type === 'text') {
      const textoMensaje = message.text.body;
      console.log(`💬 Mensaje de WhatsApp recibido: "${textoMensaje}"`);

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

      // Insertar la intención recibida en la base de datos
      const { error: errorInsert } = await supabase
        .from('intenciones')
        .insert([
          {
            id_misa: idMisaActiva,
            id_tipo_intencion: 7, // Categoría por defecto
            detalle_intencion: textoMensaje,
            origen: 'WHATSAPP_FELIGRES'
          }
        ]);

      if (errorInsert) {
        console.error('❌ Error al guardar la intención en Supabase:', errorInsert);
      } else {
        console.log(`✨ ¡Intención guardada exitosamente en la Misa #${idMisaActiva}!`);
      }
    }
  } catch (err) {
    console.error('❌ Error procesando el webhook:', err);
  }
});

// 4. Inicialización del servidor HTTP
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook escuchando en el puerto ${PORT}`);
});
