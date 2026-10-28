// "Frequently bought together": loads the recommendations section, keeps the
// total in step with the ticked items and adds them to the cart together.
if (!customElements.get('product-recommendations')) {
  customElements.define(
    'product-recommendations',
    class extends HTMLElement {
      connectedCallback() {
        if (this.querySelector('[data-fbt-form]')) return this.bind();
        // Load once the section is close to the screen.
        new IntersectionObserver((entries, observer) => {
          if (!entries[0].isIntersecting) return;
          observer.disconnect();
          fetch(this.dataset.url)
            .then((response) => response.text())
            .then((html) => {
              const fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('product-recommendations');
              if (fresh && fresh.innerHTML.trim()) {
                this.innerHTML = fresh.innerHTML;
                this.bind();
              } else {
                this.remove();
              }
            })
            .catch(() => this.remove());
        }, { rootMargin: '0px 0px 400px 0px' }).observe(this);
      }

      bind() {
        const form = this.querySelector('[data-fbt-form]');
        const total = this.querySelector('[data-fbt-total]');
        const label = this.querySelector('[data-fbt-count-label]');
        const money = new Intl.NumberFormat(total.dataset.locale, { style: 'currency', currency: total.dataset.currency });
        const boxes = () => [...form.querySelectorAll('[data-variant-id]')].filter((box) => box.checked);

        form.addEventListener('change', () => {
          const picked = boxes();
          total.textContent = money.format(picked.reduce((sum, box) => sum + Number(box.dataset.price), 0) / 100);
          label.textContent = label.dataset.template.replace('{count}', picked.length);
        });

        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const button = form.querySelector('[data-fbt-add]');
          const error = form.querySelector('[data-fbt-error]');
          const drawer = document.querySelector('cart-drawer');
          button.disabled = true;
          error.hidden = true;
          try {
            const response = await fetch(`${window.theme.routes.cartAdd}.js`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({
                items: boxes().map((box) => ({ id: Number(box.dataset.variantId), quantity: 1 })),
                sections: drawer ? drawer.sectionIds : undefined,
                sections_url: window.location.pathname,
              }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.description || result.message);
            if (drawer) document.dispatchEvent(new CustomEvent('cart:updated', { detail: { sections: result.sections, open: true } }));
            else window.location.href = window.theme.routes.cart;
          } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
          } finally {
            button.disabled = false;
          }
        });
      }
    }
  );
}
