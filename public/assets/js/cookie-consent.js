// public/assets/js/cookie-consent.js

$(document).ready(function() {
    const cookieConsentBanner = $('#cookieConsentBanner');
    const acceptCookiesBtn = $('#acceptCookies');
    const declineCookiesBtn = $('#declineCookies');
    const customizeCookiesBtn = $('#customizeCookies'); // Se hai un modal di personalizzazione

    // Funzione per impostare un cookie (o una voce in localStorage)
    function setCookieConsent(consentType) {
        localStorage.setItem('cookie_consent', consentType);
        cookieConsentBanner.removeClass('show').addClass('animate__animated animate__fadeOutDown');
        setTimeout(() => cookieConsentBanner.remove(), 600); // Rimuovi il banner dopo l'animazione
    }

    // Controlla se l'utente ha già dato il consenso
    if (localStorage.getItem('cookie_consent') === null) {
        // Se non ha ancora dato il consenso, mostra il banner dopo un breve ritardo
        setTimeout(() => {
            cookieConsentBanner.html(`
                <p>Utilizziamo i cookie per migliorare la tua esperienza di navigazione. Cliccando su "Accetta", acconsenti all'uso di tutti i cookie. Per maggiori informazioni o per personalizzare le tue preferenze, clicca su "Personalizza".
                    <a href="privacy-policy.html" target="_blank">Informativa sulla Privacy</a>.
                </p>
                <div class="cookie-buttons">
                    <button class="btn btn-primary" id="acceptCookies">Accetta</button>
                    <button class="btn btn-secondary" id="declineCookies">Rifiuta</button>
                    </div>
            `);
            cookieConsentBanner.addClass('show animate__animated animate__fadeInUp');

            // Aggiungi event listener ai pulsanti nel banner
            $('#acceptCookies').on('click', function() {
                setCookieConsent('accepted');
                console.log('Cookie accettati');
                // Qui puoi attivare script di tracking/analytics se consentiti
            });

            $('#declineCookies').on('click', function() {
                setCookieConsent('declined');
                console.log('Cookie rifiutati');
                // Qui dovresti disabilitare tutti gli script non essenziali
            });

            // Se hai un modal di personalizzazione
            /*
            $('#customizeCookies').on('click', function() {
                // Mostra il modal di personalizzazione cookie
                // Esempio: $('#cookieSettingsModal').modal('show');
                console.log('Personalizza cookie');
            });
            */

        }, 1000); // Mostra il banner dopo 1 secondo dal caricamento della pagina
    } else {
        // Se il consenso è già stato dato, rimuovi il placeholder
        cookieConsentBanner.remove();
        console.log('Consenso cookie già registrato:', localStorage.getItem('cookie_consent'));
        // Qui puoi caricare o meno gli script di tracking in base al consenso registrato
    }

    // Funzione per mostrare messaggi (se la usi qui, altrimenti la rimuovi)
    function showMessage(elementId, message, type) {
        const alertClass = `alert-${type}`;
        const alertHtml = `<div class="alert ${alertClass} animate__animated animate__fadeIn">${message}</div>`;
        $(`#${elementId}`).html(alertHtml).show();
        setTimeout(() => {
            $(`#${elementId}`).find('.alert').fadeOut(500, function() {
                $(this).remove();
            });
        }, 5000);
    }
});