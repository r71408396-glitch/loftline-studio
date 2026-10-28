// Cart drawer: opens from the header cart, re-renders itself through the
// Section Rendering API after every change, and changes a desk build's lines together.

class CartDrawer extends HTMLElement {
  get sectionIds() {
    return [this.sectionId];
  }

  connectedCallback() {
    this.sectionId = this.closest('.shopify-section').id.replace('shopify-section-', '');
    this.onKeydown = this.onKeydown.bind(this);

    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-cart-toggle]');
      if (toggle && window.theme.cartType === 'drawer') {
        event.preventDefault();
        this.open(toggle);
      }
    });

    // Quick add forms on product cards add through the drawer.
    document.addEventListener('submit', (event) => {
      const form = event.target.closest('[data-quick-add]');
      if (!form) return;
      event.preventDefault();
      const button = form.querySelector('button');
      button.disabled = true;
      const id = Number(form.querySelector('[name="id"]').value);
      this.request(`${window.theme.routes.cartAdd}.js`, { items: [{ id, quantity: 1 }] }).then(() => {
        button.disabled = false;
        this.open(button);
      });
    });

    document.addEventListener('cart:updated', (event) => {
      const { sections, open } = event.detail || {};
      if (sections && sections[this.sectionId]) this.renderSection(sections[this.sectionId]);
      if (open) this.open();
    });

    this.bind();
  }

  // Listeners on the drawer's content, re-attached after each re-render.
  bind() {
    this.querySelectorAll('[data-drawer-close]').forEach((el) => el.addEventListener('click', () => this.close()));

    this.querySelectorAll('[data-keys]').forEach((row) => {
      const keys = row.dataset.keys.split(',').filter(Boolean);
      const input = row.querySelector('[data-quantity]');
      row.querySelectorAll('[data-step]').forEach((button) => {
        button.addEventListener('click', () => {
          const quantity = Math.max(0, Number(input.value) + Number(button.dataset.step));
          input.value = quantity;
          this.setQuantity(keys, quantity);
        });
      });
      if (input) input.addEventListener('change', () => this.setQuantity(keys, Math.max(0, Number(input.value) || 0)));
      const remove = row.querySelector('[data-remove]');
      if (remove) remove.addEventListener('click', () => this.setQuantity(keys, 0));
    });

    this.querySelectorAll('[data-add-variant]').forEach((button) => {
      button.addEventListener('click', () => this.addVariant(Number(button.dataset.addVariant), button));
    });
  }

  open(opener) {
    this.opener = opener || document.activeElement;
    this.hidden = false;
    requestAnimationFrame(() => this.classList.add('is-open'));
    document.body.classList.add('is-locked');
    document.addEventListener('keydown', this.onKeydown);
    this.querySelector('[role="dialog"]').focus();
  }

  close() {
    this.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    document.removeEventListener('keydown', this.onKeydown);
    setTimeout(() => (this.hidden = true), 250);
    if (this.opener && this.opener.focus) this.opener.focus();
  }

  onKeydown(event) {
    if (event.key === 'Escape') this.close();
    if (event.key !== 'Tab') return;
    // Keep focus inside the drawer.
    const focusable = [...this.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')].filter((el) => el.offsetParent);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async request(url, body) {
    this.classList.add('is-busy');
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...body, sections: this.sectionIds, sections_url: window.location.pathname }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.description || result.message);
      this.renderSection(result.sections[this.sectionId]);
    } catch (error) {
      this.querySelector('[data-drawer-status]').textContent = error.message;
    } finally {
      this.classList.remove('is-busy');
    }
  }

  setQuantity(keys, quantity) {
    const updates = Object.fromEntries(keys.map((key) => [key, quantity]));
    return this.request(`${window.theme.routes.cartUpdate}.js`, { updates });
  }

  addVariant(id, button) {
    button.disabled = true;
    return this.request(`${window.theme.routes.cartAdd}.js`, { items: [{ id, quantity: 1 }] });
  }

  // Swaps in the new drawer content and the header count, keeping the drawer open.
  renderSection(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const fresh = doc.querySelector('cart-drawer');
    if (!fresh) return;
    const panel = this.querySelector('[role="dialog"]');
    const scroll = this.querySelector('[data-drawer-body]')?.scrollTop || 0;
    panel.replaceWith(fresh.querySelector('[role="dialog"]'));
    this.querySelector('[role="dialog"]').focus({ preventScroll: true });
    const body = this.querySelector('[data-drawer-body]');
    if (body) body.scrollTop = scroll;
    this.bind();

    const count = Number(fresh.dataset.count);
    this.dataset.count = count;
    document.querySelectorAll('[data-cart-count]').forEach((badge) => {
      badge.hidden = count === 0;
      badge.querySelector('[aria-hidden]').textContent = count;
      badge.querySelector('.visually-hidden').textContent = fresh.dataset.countLabel;
    });
  }
}

customElements.define('cart-drawer', CartDrawer);
