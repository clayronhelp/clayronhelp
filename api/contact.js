// api/contact.js

import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Solo POST' });
  }

  // Leggi i dati inviati dal form
  const { firstName, lastName, email, subject, message } = req.body;

  // Configura il transporter di Nodemailer
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // Testo dell'email
  const text = `
Hai un nuovo messaggio da ${firstName} ${lastName} <${email}>.

Oggetto: ${subject}

${message}
  `;

  try {
    // Invia l'email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to:   process.env.EMAIL_USER,
      subject: `[ClayRon Contatti] ${subject}`,
      text
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Errore invio email:', err);
    return res.status(500).json({ success: false, message: 'Invio fallito' });
  }
}
