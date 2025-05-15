// assets/js/auth.js

// 1) NAVBAR DINAMICA
async function updateNavbar() {
  const { data:{ session } } = await supabase.auth.getSession();
  const authArea = document.getElementById('auth-area');
  if (session) {
    authArea.innerHTML = `
      <div class="dropdown">
        <button class="btn btn-outline-light dropdown-toggle" type="button"
                id="userDropdown" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
          ${session.user.email}
        </button>
        <div class="dropdown-menu dropdown-menu-right" aria-labelledby="userDropdown">
          <a class="dropdown-item" href="area.html">Area Personale</a>
          <a class="dropdown-item" href="impostazioni.html">Impostazioni</a>
          <button class="dropdown-item" id="logoutBtn">Esci</button>
        </div>
      </div>`;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });
  } else {
    authArea.innerHTML = `<a href="login.html" class="btn btn-outline-light">Accedi/Registrati</a>`;
  }
}
document.addEventListener('DOMContentLoaded', updateNavbar);

// 2) ERRORI IN ITALIANO
function italianError(msg) {
  if (msg.includes('Invalid login credentials')) return 'Email o password non valide';
  if (msg.includes('User not found')) return 'Utente non trovato';
  if (msg.includes('Email not confirmed')) return 'Conferma prima la tua email';
  if (msg.includes('Password should be')) return 'La password non rispetta i requisiti';
  return msg;
}

// 3) LOGIN CUSTOM
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

// 4) REGISTER CUSTOM
if (document.getElementById('registerForm')) {
  $('#registerForm').on('submit', async e => {
    e.preventDefault();
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

// 5) NOTIFICHE DINAMICHE (eventi + community)
async function initNotifications() {
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;
  const bellCount = document.getElementById('notifCount');
  const list      = document.getElementById('notifList');

  function clearNotifs() {
    bellCount.style.display = 'none';
    bellCount.textContent = '0';
  }
  function addNotif(text) {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    item.textContent = text;
    list.prepend(item);
    bellCount.textContent = +bellCount.textContent + 1;
    bellCount.style.display = 'inline-block';
  }

  $('#notifBell').on('click', () => {
    setTimeout(() => clearNotifs(), 100);
  });

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const { data: events } = await supabase
    .from('events')
    .select('title,start')
    .eq('user_id', userId)
    .gte('start', new Date().toISOString())
    .lte('start', tomorrow.toISOString())
    .order('start', { ascending: true });

  list.innerHTML = '';
  if (events.length) {
    events.forEach(ev =>
      addNotif(`Scade domani: “${ev.title}”`)
    );
  } else {
    const none = document.createElement('div');
    none.className = 'dropdown-item text-muted';
    none.textContent = 'Nessun evento in scadenza';
    list.append(none);
  }

  supabase
    .channel(`events_user_${userId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'events',
      filter: `user_id=eq.${userId}`
    }, payload => {
      addNotif(`Nuovo evento: “${payload.new.title}” il ${new Date(payload.new.start).toLocaleDateString()}`);
    })
    .subscribe();

  let notified = false;
  supabase
    .channel('messages_global')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `room=eq.generale`
    }, () => {
      if (!notified) {
        addNotif('Ci sono nuovi messaggi in Community!');
        notified = true;
      }
    })
    .subscribe();
}

document.addEventListener('DOMContentLoaded', initNotifications);

// ----------------------
// 6) BLOCCO FUNZIONALITÀ SE PROFILO INCOMPLETO
// ----------------------
async function enforceCompleteProfile() {
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) return;

  // eseguo solo in area.html (body.area-page)
  if (!document.body.classList.contains('area-page')) return;

  const md = session.user.user_metadata || {};
  const complete = md.firstName && md.lastName;
  if (complete) return;

  // 1) Banner sotto la navbar
  const banner = document.createElement('div');
  banner.id = 'profileBanner';
  banner.innerHTML = `
    <div class="alert alert-warning text-center mb-0">
      ⚠️ Devi completare il tuo <a href="profile.html" class="alert-link">profilo</a> (nome e cognome)
      per usare tutte le funzionalità!
    </div>
  `;
  document.body.insertBefore(banner, document.querySelector('main'));

  // 2) Blocca card e metti lucchetto
  document.querySelectorAll('.requires-profile').forEach(el => {
    el.classList.add('locked');
    el.addEventListener('click', e => e.preventDefault());

    const cardBody = el.querySelector('.card-body');
    if (cardBody && !cardBody.querySelector('.lock-icon')) {
      cardBody.insertAdjacentHTML('afterbegin',
        `<i class="fas fa-lock lock-icon"></i>`
      );
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  updateNavbar();
  initNotifications();
  enforceCompleteProfile();
});
