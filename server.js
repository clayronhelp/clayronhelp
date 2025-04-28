// server.js

const express     = require('express');
const bodyParser  = require('body-parser');
const nodemailer  = require('nodemailer');
const mongoose    = require('mongoose');
const path        = require('path');
const paypal      = require('@paypal/checkout-server-sdk');

const app = express();
const port = 3000;

// — MongoDB URI in chiaro —
const MONGODB_URI = 'mongodb+srv://MyUser:Giuseppe08@cluster0.hco2yrt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// — Nodemailer (Contact Form) —
const EMAIL_USER = 'clayronhelp@gmail.com';
const EMAIL_PASS = 'xwtvukattljrwvgh';

// — PayPal (Sandbox) —
// Client ID usato nel front-end per i bottoni PayPal
const PAYPAL_CLIENT_ID = 'Ad3Up0PLcvijOaaaI5_tLI49rILy1cPgJpB4k6XuDjiUOoi0QSv6ZK6nqEZihQ-xo6euC-1MhWnja_qt';
// Segreto di sandbox (sostituisci con il tuo, se ce l’hai)
const PAYPAL_SECRET    = 'TUO_PAYPAL_SANDBOX_SECRET';
// Usa sempre sandbox finché non sei in live
const PAYPAL_MODE      = 'sandbox';

//
// — Connessione a MongoDB —
//
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Connesso a MongoDB'))
  .catch(err => console.error('❌ Errore connessione MongoDB:', err));

//
// — Nodemailer setup —
//
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

//
// — PayPal environment —
//
function paypalEnv() {
  return PAYPAL_MODE === 'live'
    ? new paypal.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET)
    : new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_SECRET);
}
const payPalClient = new paypal.core.PayPalHttpClient(paypalEnv());

//
// — Modello Mongoose per i Materiali —
//
const materialSchema = new mongoose.Schema({
  title:       String,
  description: String,
  subject:     String,
  price:       { type: Number, default: 0 },
  image:       { type: String, default: 'assets/img/default-material.jpg' },
  file:        { type: String, default: '' },
  createdAt:   { type: Date, default: Date.now }
});
const Material = mongoose.model('Material', materialSchema);

//
// — Middleware generali —
//
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

//
// — Route per le pagine statiche —
//
app.get('/',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/area', (req, res) => res.sendFile(path.join(__dirname, 'public', 'area.html')));

//
// — Contact Form API —
//
app.post('/api/contact', async (req, res) => {
  const { firstName, lastName, email, subject, message } = req.body;
  const text = `
Hai ricevuto un nuovo messaggio da ${firstName} ${lastName} <${email}>.

Oggetto: ${subject}

Messaggio:
${message}
  `;
  try {
    await transporter.sendMail({
      from: EMAIL_USER,
      to:   EMAIL_USER,
      subject: `[ClayRon Contatti] ${subject}`,
      text
    });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Errore invio email:', err);
    res.status(500).json({ success: false, message: 'Invio fallito' });
  }
});

//
// — Materials API —
//
app.get('/api/materials', async (req, res) => {
  try {
    const mats = await Material.find();
    res.json({ success: true, materials: mats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Errore recupero materiali' });
  }
});

app.get('/api/material/:id', async (req, res) => {
  try {
    const mat = await Material.findById(req.params.id);
    if (!mat) return res.status(404).json({ success: false, message: 'Materiale non trovato' });
    res.json({ success: true, material: mat });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Errore recupero materiale' });
  }
});

//
// — (Opzionale) API PayPal per creare ordini —
//
// Se preferisci creare l’ordine lato server invece che client-only
app.post('/api/paypal/order', async (req, res) => {
  const { price, title } = req.body;
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [{
      amount: {
        currency_code: "EUR",
        value: price.toFixed(2)
      },
      description: title
    }]
  });
  try {
    const order = await payPalClient.execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error('❌ PayPal order creation error:', err);
    res.status(500).json({ error: 'PayPal order creation failed' });
  }
});

//
// — Avvio del server —
//
app.listen(port, () => {
  console.log(`🚀 Server in ascolto su http://localhost:${port}`);
});
