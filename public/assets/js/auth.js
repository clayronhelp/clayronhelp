// assets/js/auth.js

// ----------------------
// 1) NAVBAR DINAMICA
// ----------------------
async function updateNavbar() {
    // recupera sessione
    const { data: { session } } = await supabase.auth.getSession();
    const authArea = document.getElementById('auth-area');
    if (session) {
      // se loggato: dropdown con “Esci”
      authArea.innerHTML = `
        <div class="dropdown">
          <button class="btn btn-outline-light dropdown-toggle" type="button"
                  id="userDropdown" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
            ${session.user.email}
          </button>
          <div class="dropdown-menu dropdown-menu-right" aria-labelledby="userDropdown">
            <a class="dropdown-item" href="area.html">Area Personale</a>
            <button class="dropdown-item" id="logoutBtn">Esci</button>
          </div>
        </div>`;
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
      });
    } else {
      // se non loggato: link a login/register
      authArea.innerHTML = `<a href="login.html" class="btn btn-outline-light">Accedi/Registrati</a>`;
    }
  }
  
  // esegue all’avvio di pagina
  document.addEventListener('DOMContentLoaded', updateNavbar);
  
  
  // ----------------------
  // 2) TRADUZIONE ERRORI
  // ----------------------
  function italianError(msg) {
    if (msg.includes('Invalid login credentials'))      return 'Email o password non valide';
    if (msg.includes('User not found'))                 return 'Utente non trovato';
    if (msg.includes('Email not confirmed'))            return 'Conferma prima la tua email';
    if (msg.includes('Password should be'))             return 'La password non rispetta i requisiti';
    // aggiungi qui altri mapping...
    return msg;  // di default, restituisce il messaggio originale
  }
  
  
  // ----------------------
  // 3) LOGIN CUSTOM
  // ----------------------
  if (document.getElementById('loginForm')) {
    $('#loginForm').on('submit', async e => {
      e.preventDefault();
      const email = $('#loginEmail').val(),
            pwd   = $('#loginPassword').val();
      const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
      if (error) {
        $('#loginMessage').html(`<div class="alert alert-danger">${italianError(error.message)}</div>`);
      } else {
        window.location.href = 'area.html';
      }
    });
  }
  
  
  // ----------------------
  // 4) REGISTER CUSTOM
  // ----------------------
  if (document.getElementById('registerForm')) {
    $('#registerForm').on('submit', async e => {
      e.preventDefault();
      // reCAPTCHA
      const rec = grecaptcha.getResponse();
      if (!rec) {
        $('#registerMessage').html('<div class="alert alert-danger">Completa la verifica reCAPTCHA.</div>');
        return;
      }
      const email = $('#regEmail').val(),
            pwd   = $('#regPassword').val();
      const { data, error } = await supabase.auth.signUp({
        email, 
        password: pwd,
        options: { data: {} }
      });
      if (error) {
        $('#registerMessage').html(`<div class="alert alert-danger">${italianError(error.message)}</div>`);
      } else {
        $('#registerMessage').html('<div class="alert alert-success">Controlla la tua email per confermare l’account.</div>');
        setTimeout(() => window.location.href = 'login.html', 2000);
      }
    });
  }
  