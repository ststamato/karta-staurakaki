(function () {
  var TITLES = {
    today: 'Σήμερα',
    family: 'Οικογένεια',
    home: 'Σπίτι',
    auto: 'Αυτοκίνητο',
    shopping: 'Αγορές',
    timeline: 'Timeline',
    settings: 'Ρυθμίσεις',
    backup: 'Backup',
    premium: 'Premium'
  };

  var MAIN_SCREENS = ['today', 'family', 'home', 'auto', 'shopping'];

  var topbarTitle = document.getElementById('topbar-title');
  var navButtons = document.querySelectorAll('.nav-btn');
  var profileBackdrop = document.getElementById('profile-backdrop');
  var quickaddBackdrop = document.getElementById('quickadd-backdrop');

  function closeSheets() {
    profileBackdrop.hidden = true;
    quickaddBackdrop.hidden = true;
  }

  function goto(screen) {
    document.querySelectorAll('[data-screen]').forEach(function (el) {
      el.hidden = el.id !== 'screen-' + screen;
    });

    topbarTitle.textContent = TITLES[screen] || 'Η Μέρα Μου';

    navButtons.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.goto === screen);
    });

    closeSheets();
  }

  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-goto]');
    if (target) {
      goto(target.dataset.goto);
      return;
    }

    if (event.target.id === 'profile-btn') {
      profileBackdrop.hidden = false;
      return;
    }

    if (event.target.id === 'quick-add-btn') {
      quickaddBackdrop.hidden = false;
      return;
    }

    if (event.target === profileBackdrop) {
      profileBackdrop.hidden = true;
      return;
    }

    if (event.target === quickaddBackdrop) {
      quickaddBackdrop.hidden = true;
      return;
    }

    if (event.target.id === 'quickadd-save') {
      quickaddBackdrop.hidden = true;
      var input = document.querySelector('.quickadd-input');
      input.value = '';
      return;
    }
  });

  goto('today');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
