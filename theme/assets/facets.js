// Collection and search filters: every change re-renders the section through
// the Section Rendering API instead of reloading the page.

class FacetPage extends HTMLElement {
  connectedCallback() {
    this.sectionId = this.dataset.sectionId;
    this.cache = new Map();
    this.bind();
    window.addEventListener('popstate', () => this.render(window.location.search.slice(1), false));
  }

  get form() {
    return this.querySelector('[data-facets-form]');
  }

  bind() {
    const form = this.form;
    if (!form) return;

    // Checkboxes and sort apply at once; price fields wait until typing stops.
    let timer;
    form.addEventListener('input', (event) => {
      clearTimeout(timer);
      const delay = event.target.type === 'number' ? 600 : 0;
      timer = setTimeout(() => this.render(this.params(form)), delay);
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.render(this.params(form));
    });

    this.querySelectorAll('[data-facets-open]').forEach((button) => button.addEventListener('click', () => this.togglePanel(true)));
    this.querySelectorAll('[data-facets-close]').forEach((button) => button.addEventListener('click', () => this.togglePanel(false)));
  }

  params(form) {
    const data = new FormData(form);
    // Empty price fields would otherwise filter everything out.
    for (const [key, value] of [...data.entries()]) if (value === '') data.delete(key);
    return new URLSearchParams(data).toString();
  }

  togglePanel(open) {
    const panel = this.querySelector('[data-facets-panel]');
    panel.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);
    this.querySelector('[data-facets-open]')?.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector('[data-facets-close]')?.focus();
    else this.querySelector('[data-facets-open]')?.focus();
    this.panelOpen = open;
  }

  async render(params, push = true) {
    const url = `${window.location.pathname}?${params}`;
    const fetchUrl = `${window.location.pathname}?section_id=${this.sectionId}${params ? `&${params}` : ''}`;
    this.classList.add('is-loading');

    try {
      let html = this.cache.get(fetchUrl);
      if (!html) {
        html = await (await fetch(fetchUrl)).text();
        this.cache.set(fetchUrl, html);
      }
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector('[data-facets-root]');
      if (!fresh) return;

      // Remember which control had focus and which groups were open.
      const active = document.activeElement;
      const focusKey = active && active.name ? `${active.name}=${active.value}` : null;
      const openGroups = [...this.querySelectorAll('.facets__group')].map((group) => group.open);
      const panelOpen = this.panelOpen;

      this.querySelector('[data-facets-root]').replaceWith(fresh);
      this.querySelectorAll('.facets__group').forEach((group, i) => {
        if (openGroups[i] !== undefined) group.open = openGroups[i];
      });
      this.bind();
      if (panelOpen) this.querySelector('[data-facets-panel]').classList.add('is-open');
      if (focusKey) {
        const [name, value] = focusKey.split('=');
        const target = [...this.querySelectorAll(`[name="${CSS.escape(name)}"]`)].find((el) => el.type !== 'checkbox' || el.value === value);
        target?.focus({ preventScroll: true });
      }

      if (push) window.history.pushState({}, '', url);
    } catch (error) {
      console.error(error);
    } finally {
      this.classList.remove('is-loading');
    }
  }
}

// Chip and pagination links inside the section re-render too.
document.addEventListener('click', (event) => {
  const link = event.target.closest('facet-page [data-facet-link], facet-page .pagination a');
  if (!link) return;
  const page = link.closest('facet-page');
  event.preventDefault();
  const url = new URL(link.href);
  page.render(url.searchParams.toString()).then(() => {
    if (link.closest('.pagination')) page.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

customElements.define('facet-page', FacetPage);
