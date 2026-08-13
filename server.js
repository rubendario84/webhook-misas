const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Conexión a Supabase usando variables de entorno
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// 1. Endpoint de verificación requerida por Meta (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
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

    // Responder inmediatamente 200 OK a Meta
    res.status(200).send('EVENT_RECEIVED');

    if (!message) return;

    if (message.type === 'text') {
      const textoMensaje = message.text.body;
      console.log(`💬 Mensaje recibido: "${textoMensaje}"`);

      // Buscar la misa activa en Supabase
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

      // Guardar la intención en Supabase
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
