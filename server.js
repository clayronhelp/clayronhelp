// server.js

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Connetti a MongoDB (sostituisci <username>, <password> e <dbname> con i tuoi dati)
const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://MyUser:Giuseppe08@cluster0.hco2yrt.mongodb.net/clayron-db?retryWrites=true&w=majority';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connesso a MongoDB'))
  .catch(err => console.error('Errore di connessione a MongoDB:', err));

// Modello utente con campi per il profilo e un indice TTL per eliminare automaticamente utenti non verificati dopo 5 minuti
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  verified: { type: Boolean, default: true }, // Ora verifichiamo solo con reCAPTCHA, quindi settiamo true
  // Campi del profilo
  name: { type: String, default: '' },
  surname: { type: String, default: '' },
  nationality: { type: String, default: '' },
  region: { type: String, default: '' },
  municipality: { type: String, default: '' },
  profilePicture: { type: String, default: 'assets/img/default-profile.png' },
  createdAt: { type: Date, default: Date.now },
  expireAt: { type: Date, default: undefined } // Non serve ora, eliminato il sistema email
});
const User = mongoose.model('User', userSchema);

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
  secret: 'il_mio_segreto_super_sicuro',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(express.static(path.join(__dirname, 'public')));

// Route principale: "/" mostra index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Per il reCAPTCHA, registra il tuo sito su: https://www.google.com/recaptcha/admin/create
// Ottieni la "Site Key" e la "Secret Key"
// Inserisci la Secret Key qui (meglio usarla via variabile d'ambiente, ma per semplicità la mettiamo direttamente)
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '6LdQfBQrAAAAAHIH7k8BQODEpIPZlzVPTn8I7dRD';

// API di registrazione con reCAPTCHA
app.post('/api/register', async (req, res) => {
  const { email, password, 'g-recaptcha-response': recaptchaResponse } = req.body;
  if (!email || !password || !recaptchaResponse) {
    return res.status(400).json({ success: false, message: 'Email, Password e Verifica sono richiesti' });
  }
  
  // Verifica reCAPTCHA inviando il token a Google
  try {
    const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${recaptchaResponse}`;
    const recaptchaRes = await axios.post(verificationURL);
    if (!recaptchaRes.data.success) {
      return res.status(400).json({ success: false, message: 'Verifica reCAPTCHA fallita' });
    }
  } catch (err) {
    console.error('Errore nella verifica reCAPTCHA:', err);
    return res.status(500).json({ success: false, message: 'Errore nella verifica reCAPTCHA' });
  }
  
  // Controlla se l'email esiste già
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Email già registrata' });
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  const newUser = new User({
    email,
    password: hashedPassword,
    // Settiamo subito verified=true perché usiamo reCAPTCHA per verificare che l'utente non sia robot
    verified: true
  });
  
  try {
    await newUser.save();
    // Dopo la registrazione, reindirizza l'utente alla pagina del sondaggio dinamico
    return res.json({ success: true, message: 'Registrazione avvenuta con successo. Completa il sondaggio.', redirect: '/survey.html' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Errore durante la registrazione' });
  }
});

// API per il login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email e password sono richiesti' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenziali non valide' });
    }
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Credenziali non valide' });
    }
    req.session.user = user.email;
    return res.json({ success: true, message: 'Login effettuato con successo' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Errore durante il login' });
  }
});

// Middleware per proteggere le route private
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Non autorizzato' });
}

// Route protetta per l'area personale
app.get('/area', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'area.html'));
});

// API per ottenere il profilo dell'utente
app.get('/api/profile', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  }
  try {
    const user = await User.findOne({ email: req.session.user });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }
    const { email, name, surname, nationality, region, municipality, profilePicture } = user;
    res.json({ success: true, profile: { email, name, surname, nationality, region, municipality, profilePicture } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Errore nel recupero del profilo' });
  }
});

// API per aggiornare il profilo
app.post('/api/profile', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Non autorizzato' });
  }
  const { name, surname, nationality, region, municipality, profilePicture } = req.body;
  try {
    const user = await User.findOne({ email: req.session.user });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }
    user.name = name || user.name;
    user.surname = surname || user.surname;
    user.nationality = nationality || user.nationality;
    user.region = region || user.region;
    user.municipality = municipality || user.municipality;
    user.profilePicture = profilePicture || user.profilePicture;
    await user.save();
    res.json({ success: true, message: 'Profilo aggiornato con successo' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Errore durante l\'aggiornamento del profilo' });
  }
});

// API per ottenere materiali esclusivi (solo se loggato)
app.get('/api/exclusive', async (req, res) => {
  if (!req.session.user) {
    return res.json({ success: false, materials: [] });
  }
  // Demo: restituisce alcuni materiali esclusivi
  const exclusiveMaterials = [
    "Materiale esclusivo 1",
    "Materiale esclusivo 2",
    "Materiale esclusivo 3"
  ];
  res.json({ success: true, materials: exclusiveMaterials });
});

// API per il logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Errore durante il logout' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: 'Logout effettuato con successo' });
  });
});

app.listen(port, () => {
  console.log(`Server in ascolto su http://localhost:${port}`);
});
