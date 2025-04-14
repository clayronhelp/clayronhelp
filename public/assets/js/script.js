/* script.js */

console.log('Script personalizzato caricato.');

$(document).ready(function(){
  // Animazione fade-in per le feature-box
  $('.feature-box').hide().fadeIn(1500);
  
  // Ruota la freccetta dell'accordion al click
  $('.accordion-toggle').on('click', function() {
    $(this).find('i').toggleClass('rotate');
  });
});
