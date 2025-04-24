// server.js
require('dotenv').config();
const express       = require('express');
const bodyParser    = require('body-parser');
const cookieParser  = require('cookie-parser');
const jwt           = require('jsonwebtoken');
const mongoose      = require('mongoose');
const axios         = require('axios');
const bcrypt        = require('bcryptjs');
const path          = require('path');
const nodemailer    = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;

// ENV vars
const MONGODB_URI      = process.env.MONGODB_URI    || 'mongodb+srv://MyUser:Giuseppe08@cluster0.hco2yrt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const JWT_SECRET       = process.env.JWT_SECRET;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '6LdO1BQrAAAAALIopx8_pYdIROzgrH0lWE1vfg3o';
const EMAIL_USER       = process.env.EMAIL_USER || 'clayronhelp@gmail.com';
const EMAIL_PASS       = process.env.EMAIL_PASS || 'xwtvukattljrwvgh';

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connesso a MongoDB'))
  .catch(err => console.error('Errore connessione MongoDB:', err));

// Schemas
const userSchema = new mongoose.Schema({
  email:      { type: String, required: true, unique: true },
  password:   { type: String, required: true },
  verified:   { type: Boolean, default: true },
  name:       { type: String, default: '' },
  surname:    { type: String, default: '' },
  nationality:{ type: String, default: '' },
  region:     { type: String, default: '' },
  municipality:{ type: String, default: '' },
  profilePicture:{ type: String, default: 'assets/img/default-profile.png' },
  createdAt:  { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

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

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// JWT helpers
function createToken(user) {
  return jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}
function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ success: false, message: 'Token mancante' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Token non valido' });
    req.user = user;
    next();
  });
}

// Routes
app.get('/',        (req, res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/area',    (req, res) => res.sendFile(path.join(__dirname,'public','area.html')));

// --- Contact form route ---
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
    return res.json({ success: true });
  } catch (err) {
    console.error('Errore invio email:', err);
    return res.status(500).json({ success: false, message: 'Invio fallito' });
  }
});

// --- Registration with reCAPTCHA ---
app.post('/api/register', async (req, res) => {
  const { email, password, 'g-recaptcha-response': recaptchaResponse } = req.body;
  if (!email || !password || !recaptchaResponse)
    return res.status(400).json({ success: false, message: 'Email, password e reCAPTCHA sono richiesti' });
  try {
    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${recaptchaResponse}`;
    const recRes = await axios.post(verifyURL);
    if (!recRes.data.success) return res.status(400).json({ success: false, message: 'reCAPTCHA fallita' });
  } catch (e) {
    console.error('Errore reCAPTCHA:', e);
    return res.status(500).json({ success: false, message: 'Errore verifica reCAPTCHA' });
  }
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ success: false, message: 'Email già registrata' });
  const hashed = bcrypt.hashSync(password, 10);
  const user = new User({ email, password: hashed, verified: true });
  try {
    await user.save();
    const token = createToken(user);
    return res.json({ success: true, token, redirect: '/survey.html' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Errore registrazione' });
  }
});

// --- Login ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email e password richieste' });
  try {
    const user = await User.findOne({ email });
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ success: false, message: 'Credenziali non valide' });
    const token = createToken(user);
    return res.json({ success: true, token });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Errore login' });
  }
});

// --- Profile ---
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ success: false, message: 'Utente non trovato' });
    const { email, name, surname, nationality, region, municipality, profilePicture } = user;
    return res.json({ success: true, profile: { email, name, surname, nationality, region, municipality, profilePicture } });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Errore recupero profilo' });
  }
});
app.post('/api/profile', authenticateToken, async (req, res) => {
  const { name, surname, nationality, region, municipality, profilePicture } = req.body;
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ success: false, message: 'Utente non trovato' });
    Object.assign(user, { name, surname, nationality, region, municipality, profilePicture });
    await user.save();
    return res.json({ success: true, message: 'Profilo aggiornato' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Errore aggiornamento profilo' });
  }
});

// --- Materials APIs ---
app.get('/api/materials', async (req, res) => {
  try {
    const mats = await Material.find();
    return res.json({ success: true, materials: mats });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Errore recupero materiali' });
  }
});
app.get('/api/material/:id', async (req, res) => {
  try {
    const mat = await Material.findById(req.params.id);
    if (!mat) return res.status(404).json({ success: false, message: 'Materiale non trovato' });
    return res.json({ success: true, material: mat });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Errore recupero materiale' });
  }
});

// --- Logout (JWT stateless) ---
app.post('/api/logout', (req, res) => {
  return res.json({ success: true, message: 'Logout effettuato' });
});

// Start server
app.listen(port, () => {
  console.log(`Server in ascolto su http://localhost:${port}`);
});
