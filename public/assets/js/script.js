/* script.js */

console.log('Script personalizzato caricato.');

$(document).ready(function(){
  // Animazione fade-in per le feature-box all'avvio
  $('.feature-box').hide().fadeIn(1500);
  
  // Ruota la freccetta nell'accordion al click
  $('.accordion-toggle').on('click', function() {
    $(this).find('i').toggleClass('rotate');
  });
});
