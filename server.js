// server.js

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Variabili d'ambiente (se non sono definite, usa i valori di default per test locale)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://MyUser:myRealPassword@cluster0.hco2yrt.mongodb.net/clayron-db?retryWrites=true&w=majority';
const JWT_SECRET = process.env.JWT_SECRET || 'mySuperSecretKey123!';
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || 'TUO_RECAPTCHA_SECRET';

// Connetti a MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connesso a MongoDB'))
  .catch(err => console.error('Errore di connessione a MongoDB:', err));

// Definisci il modello Utente
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Impostiamo verified a true subito (visto che usiamo reCAPTCHA)
  verified: { type: Boolean, default: true },
  name: { type: String, default: '' },
  surname: { type: String, default: '' },
  nationality: { type: String, default: '' },
  region: { type: String, default: '' },
  municipality: { type: String, default: '' },
  profilePicture: { type: String, default: 'assets/img/default-profile.png' },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Definisci il modello Materiale (se vuoi materiali esclusivi)
const materialSchema = new mongoose.Schema({
  title: String,
  description: String,
  subject: String,
  price: { type: Number, default: 0 },
  image: { type: String, default: 'assets/img/default-material.jpg' },
  file: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const Material = mongoose.model('Material', materialSchema);

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Funzione per creare un token JWT
function createToken(user) {
  return jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

// Middleware per proteggere le route usando JWT
function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ success: false, message: 'Token mancante' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Token non valido' });
    req.user = user;
    next();
  });
}

// Route homepage: "/" serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API per la registrazione con reCAPTCHA
app.post('/api/register', async (req, res) => {
  const { email, password, 'g-recaptcha-response': recaptchaResponse } = req.body;
  if (!email || !password || !recaptchaResponse) {
    return res.status(400).json({ success: false, message: 'Email, password e verifica reCAPTCHA sono richiesti' });
  }
  
  // Verifica reCAPTCHA
  try {
    const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${recaptchaResponse}`;
    const recaptchaRes = await axios.post(verificationURL);
    if (!recaptchaRes.data.success) {
      return res.status(400).json({ success: false, message: 'Verifica reCAPTCHA fallita' });
    }
  } catch (err) {
    console.error('Errore reCAPTCHA:', err);
    return res.status(500).json({ success: false, message: 'Errore nella verifica reCAPTCHA' });
  }
  
  // Controlla se l'email è già registrata
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Email già registrata' });
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = new User({
    email,
    password: hashedPassword,
    verified: true
  });
  try {
    await newUser.save();
    // Genera un token per tenere l'utente loggato e salva i dati lato client
    const token = createToken(newUser);
    return res.json({ success: true, message: 'Registrazione avvenuta con successo', token, redirect: '/survey.html' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Errore durante la registrazione' });
  }
});

// API per il login (usa JWT)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email e password sono richiesti' });
  try {
    const user = await User.findOne({ email });
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ success: false, message: 'Credenziali non valide' });
    const token = createToken(user);
    return res.json({ success: true, message: 'Login effettuato con successo', token });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Errore durante il login' });
  }
});

// API per ottenere i dati del profilo (usando JWT)
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ success: false, message: 'Utente non trovato' });
    const { email, name, surname, nationality, region, municipality, profilePicture } = user;
    res.json({ success: true, profile: { email, name, surname, nationality, region, municipality, profilePicture } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Errore nel recupero del profilo' });
  }
});

// API per aggiornare il profilo
app.post('/api/profile', authenticateToken, async (req, res) => {
  const { name, surname, nationality, region, municipality, profilePicture } = req.body;
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ success: false, message: 'Utente non trovato' });
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

// API per ottenere i materiali (tutti); a livello demo
app.get('/api/materials', async (req, res) => {
  try {
    const materials = await Material.find();
    res.json({ success: true, materials });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Errore nel recupero dei materiali' });
  }
});

// API per ottenere i dettagli di un materiale
app.get('/api/material/:id', async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ success: false, message: 'Materiale non trovato' });
    res.json({ success: true, material });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Errore nel recupero del materiale' });
  }
});

// API per il logout (su client, elimina il token)
app.post('/api/logout', (req, res) => {
  // Poiché usiamo JWT (stateless), il client deve semplicemente eliminare il token.
  return res.json({ success: true, message: 'Logout effettuato con successo' });
});

// Route protetta per l'area personale
app.get('/area', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'area.html'));
});

app.listen(port, () => {
  console.log(`Server in ascolto su http://localhost:${port}`);
});
