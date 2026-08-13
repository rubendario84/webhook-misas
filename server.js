const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Credenciales fijas para evitar fallos de lectura en variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lbkrwlzxlfwwcjwyhten.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxia3J3bHp4bGZ3d2Nqd3lodGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzE5MTAsImV4cCI6MjEwMjIwNzkxMH0.toQCx9yoL9pqi6vrjuuuIYFgBl5KRtlllorWlVA8LU4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1. Endpoint de verificación requerida por Meta (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'parroquia_secret_token_2026';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado correctamente con Meta');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Falló la verificación del token');
    res.sendStatus(403);
  }
});

// 2. Endpoint que recibe los mensajes de WhatsApp (POST)
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // Responder 200 OK de inmediato a Meta
    res.status(200).send('EVENT_RECEIVED');

    if (!message) return;

    if (message.type === 'text') {
      const textoMensaje = message.text.body;
      console.log(`💬 Mensaje recibido: "${textoMensaje}"`);

      // Obtener la misa activa
      const { data: misas, error: errorMisa } = await supabase
        .from('misas_instancia')
        .select('id_misa')
        .eq('estado', 'ACTIVA')
        .order('id_misa', { ascending: false })
        .limit(1);

      if (errorMisa || !misas || misas.length === 0) {
        console.error('⚠️ No hay Misa ACTIVA para asignar la intención.');
        return;
      }

      const idMisaActiva = misas[0].id_misa;

      // Guardar la intención
      const { error: errorInsert } = await supabase
        .from('intenciones')
        .insert([
          {
            id_misa: idMisaActiva,
            id_tipo_intencion: 7, // Categoría "Otros / Intención General"
            detalle_intencion: textoMensaje,
            origen: 'WHATSAPP_FELIGRES'
          }
        ]);

      if (errorInsert) {
        console.error('❌ Error al guardar en Supabase:', errorInsert);
      } else {
        console.log(`✨ Intención guardada exitosamente en la Misa #${idMisaActiva}!`);
      }
    }
  } catch (err) {
    console.error('Error procesando webhook:', err);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook escuchando en el puerto ${PORT}`);
});
