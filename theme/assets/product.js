// Product page: variant changes through the Section Rendering API, add to cart
// into the drawer, gallery counter and zoom, sticky add-to-cart on phones.

class ProductPage extends HTMLElement {
  connectedCallback() {
    this.sectionId = this.dataset.sectionId;
    this.productUrl = this.dataset.productUrl;

    this.addEventListener('change', (event) => {
      if (event.target.matches('[data-option-value-id]')) this.changeVariant(event.target);
    });
    this.addEventListener('click', (event) => {
      const step = event.target.closest('[data-step]');
      if (step) {
        const input = step.parentElement.querySelector('input');
        input.value = Math.max(1, Number(input.value) + Number(step.dataset.step));
      }
      const zoom = event.target.closest('[data-zoom]');
      if (zoom) this.openLightbox(Number(zoom.dataset.zoom));
    });
    this.addEventListener('submit', (event) => {
      if (event.target.matches('[data-product-form]')) {
        event.preventDefault();
        this.addToCart(event.target);
      }
    });

    this.setupGallery();
    this.setupLightbox();
    this.setupSticky();
  }

  get info() {
    return this.querySelector('[data-product-info]');
  }

  // ---------- Variants ----------

  async changeVariant(changed) {
    const ids = [...this.info.querySelectorAll('[data-option-value-id]:checked')].map((input) => input.dataset.optionValueId);
    const form = this.info.querySelector('[data-product-form]');
    const keep = form
      ? { quantity: form.elements.quantity?.value, plan: form.querySelector('[name="selling_plan"]:checked')?.value }
      : {};

    this.controller?.abort();
    this.controller = new AbortController();
    this.info.classList.add('is-loading');
    try {
      const response = await fetch(`${this.productUrl}?option_values=${ids.join(',')}&section_id=${this.sectionId}`, {
        signal: this.controller.signal,
      });
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const fresh = doc.querySelector('[data-product-info]');
      if (!fresh) return;

      this.info.replaceWith(fresh);
      const info = this.info;

      // Carry over what the shopper had already chosen, and keep focus on the option.
      const newForm = info.querySelector('[data-product-form]');
      if (newForm && keep.quantity) newForm.elements.quantity.value = keep.quantity;
      if (newForm && keep.plan !== undefined) {
        const plan = newForm.querySelector(`[name="selling_plan"][value="${CSS.escape(keep.plan)}"]`);
        if (plan) plan.checked = true;
      }
      info.querySelector(`[data-option-value-id="${changed.dataset.optionValueId}"]`)?.focus();

      const url = new URL(window.location.href);
      url.searchParams.set('variant', info.dataset.variantId);
      window.history.replaceState({}, '', url);

      this.showMedia(info.dataset.featuredMedia);
      this.syncSticky(doc);
    } catch (error) {
      if (error.name !== 'AbortError') console.error(error);
    } finally {
      this.info.classList.remove('is-loading');
    }
  }

  // ---------- Cart ----------

  async addToCart(form) {
    const button = form.querySelector('[data-add-button]');
    const error = form.querySelector('[data-form-error]');
    const drawer = document.querySelector('cart-drawer');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    error.hidden = true;

    const body = new FormData(form);
    if (drawer) {
      body.append('sections', drawer.sectionIds.join(','));
      body.append('sections_url', window.location.pathname);
    }
    try {
      const response = await fetch(`${window.theme.routes.cartAdd}.js`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.description || result.message);
      if (drawer) {
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: { sections: result.sections, open: true, source: 'product' } }));
      } else {
        window.location.href = window.theme.routes.cart;
      }
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  // ---------- Gallery ----------

  setupGallery() {
    const list = this.querySelector('[data-gallery-list]');
    const counter = this.querySelector('[data-gallery-index]');
    if (!list || !counter) return;
    // On phones the gallery scrolls sideways; keep the "2 / 5" counter in step.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) counter.textContent = [...list.children].indexOf(entry.target) + 1;
        }
      },
      { root: list, threshold: 0.6 }
    );
    [...list.children].forEach((item) => observer.observe(item));
  }

  showMedia(mediaId) {
    const item = this.querySelector(`[data-media-id="${mediaId}"]`);
    if (!item) return;
    this.querySelectorAll('.product-gallery__item.is-active').forEach((el) => el.classList.remove('is-active'));
    item.classList.add('is-active');
    const list = item.parentElement;
    if (list.scrollWidth > list.clientWidth) {
      list.scrollTo({ left: item.offsetLeft - list.offsetLeft, behavior: 'smooth' });
    } else if (item.getBoundingClientRect().top < 0 || item.getBoundingClientRect().top > window.innerHeight) {
      item.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ---------- Zoom ----------

  setupLightbox() {
    this.lightbox = this.querySelector('[data-lightbox]');
    if (!this.lightbox) return;
    this.lightbox.querySelector('[data-lightbox-close]').addEventListener('click', () => this.lightbox.close());
    this.lightbox.addEventListener('click', (event) => {
      const image = event.target.closest('[data-lightbox-image]');
      if (!image) return;
      // Click toggles 2x zoom around the point clicked; moving the pointer pans.
      const zoomed = image.classList.toggle('is-zoomed');
      if (zoomed) this.panImage(image, event);
    });
    this.lightbox.addEventListener('pointermove', (event) => {
      const image = event.target.closest('[data-lightbox-image].is-zoomed');
      if (image) this.panImage(image, event);
    });
  }

  panImage(image, event) {
    const rect = image.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    image.style.transformOrigin = `${x}% ${y}%`;
  }

  openLightbox(index) {
    if (!this.lightbox) return;
    this.lightbox.showModal();
    const item = this.lightbox.querySelectorAll('.lightbox__item')[index];
    if (item) item.scrollIntoView({ block: 'start' });
  }

  // ---------- Sticky add to cart ----------

  setupSticky() {
    this.sticky = this.querySelector('[data-sticky]');
    if (!this.sticky) return;
    this.sticky.querySelector('[data-sticky-add]').addEventListener('click', () => {
      this.info.querySelector('[data-product-form]')?.requestSubmit();
    });
    this.watchBuyButton();
  }

  watchBuyButton() {
    this.stickyObserver?.disconnect();
    const button = this.info.querySelector('[data-add-button]');
    if (!button || !this.sticky) return;
    this.stickyObserver = new IntersectionObserver(([entry]) => {
      // Show the bar only once the main button has scrolled up out of view.
      const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      this.sticky.classList.toggle('is-visible', show);
      this.sticky.setAttribute('aria-hidden', String(!show));
      this.sticky.querySelector('button').tabIndex = show ? 0 : -1;
    });
    this.stickyObserver.observe(button);
  }

  syncSticky(doc) {
    if (!this.sticky) return;
    const fresh = doc.querySelector('[data-sticky]');
    if (fresh) {
      this.sticky.querySelector('[data-sticky-price]').innerHTML = fresh.querySelector('[data-sticky-price]').innerHTML;
      const button = this.sticky.querySelector('[data-sticky-add]');
      const freshButton = fresh.querySelector('[data-sticky-add]');
      button.disabled = freshButton.disabled;
      button.textContent = freshButton.textContent;
    }
    this.watchBuyButton();
  }
}

customElements.define('product-page', ProductPage);
