/* Loftline theme script. Small on purpose: each feature adds its own module. */
(() => {
  // Selects marked data-auto-submit submit their form on change
  // (sort order, country and language).
  document.addEventListener('change', (event) => {
    const select = event.target.closest('[data-auto-submit]');
    if (select && select.form) select.form.submit();
  });

  // Mobile menu: lock scroll while open, close on Escape.
  const drawer = document.getElementById('MenuDrawer');
  if (drawer) {
    drawer.addEventListener('toggle', () => {
      document.body.classList.toggle('is-locked', drawer.open);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && drawer.open) {
        drawer.open = false;
        drawer.querySelector('summary').focus();
      }
    });
  }
})();
