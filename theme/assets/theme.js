/* Loftline theme script. Small on purpose: each feature adds its own module. */
(() => {
  // Selects marked data-auto-submit submit their form on change
  // (sort order, country and language).
  document.addEventListener('change', (event) => {
    const select = event.target.closest('[data-auto-submit]');
    if (select && select.form) select.form.submit();
  });

  // Header: the menu folds under the bar on phones; the bar darkens once the
  // page has scrolled.
  const header = document.querySelector('[data-site-header]');
  const toggle = header && header.querySelector('[data-menu-toggle]');
  if (header && toggle) {
    const setMenu = (open) => {
      header.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    header.querySelector('#SiteNav').addEventListener('click', (event) => {
      if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && header.classList.contains('menu-open')) {
        setMenu(false);
        toggle.focus();
      }
    });
  }
  // Dialogs shown after a form posts (the newsletter sign-up).
  document.querySelectorAll('dialog[data-open-on-load]').forEach((dialog) => {
    dialog.showModal();
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target.closest('[data-close-dialog]')) dialog.close();
    });
  });

  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
