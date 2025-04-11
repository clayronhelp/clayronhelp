// server.js

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());

// Serve file statici dalla cartella "public"
app.use(express.static(path.join(__dirname, 'public')));

// Route per servire la Home Page (home.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint API per il login dummy
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'user' && password === '123') {
    res.cookie('auth', 'dummy_token', { httpOnly: true });
    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false, message: 'Credenziali non valide' });
  }
});

// Endpoint API per la registrazione (dummy)
app.post('/api/register', (req, res) => {
  res.json({ success: true, message: 'Registrazione avvenuta con successo' });
});

app.listen(port, () => {
  console.log(`Server in ascolto su http://localhost:${port}`);
});
