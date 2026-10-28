// Product page delivery estimate: asks the app (through the app proxy) for a
// delivery window and remembers the shopper's code for next time.
(() => {
  if (customElements.get('delivery-estimate')) return;
  const STORAGE_KEY = 'loftline:zip';

  class DeliveryEstimate extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('[data-form]');
      this.result = this.querySelector('[data-result]');
      this.input = this.form.elements.zip;
      this.dates = new Intl.DateTimeFormat(this.dataset.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

      this.form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.check(this.input.value);
      });

      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          this.input.value = saved;
          this.check(saved);
        }
      } catch (error) {
        // Storage can be blocked; the shopper just types the code again.
      }
    }

    format(day) {
      return this.dates.format(new Date(`${day}T00:00:00Z`));
    }

    async check(zip) {
      const params = new URLSearchParams({ zip: zip.trim(), country: this.dataset.country, lead: this.dataset.lead });
      this.result.textContent = '…';
      try {
        const response = await fetch(`/apps/loftline/delivery?${params}`, { headers: { Accept: 'application/json' } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || this.dataset.error);
        this.result.innerHTML = '';
        const arrives = document.createElement('strong');
        arrives.textContent = this.dataset.arrives.replace('{from}', this.format(data.earliest)).replace('{to}', this.format(data.latest));
        const ships = document.createElement('span');
        ships.textContent = this.dataset.ships.replace('{date}', this.format(data.shipsOn));
        this.result.append(arrives, ships);
        try {
          localStorage.setItem(STORAGE_KEY, zip.trim());
        } catch (error) {}
      } catch (error) {
        this.result.textContent = error.message || this.dataset.error;
      }
    }
  }

  customElements.define('delivery-estimate', DeliveryEstimate);
})();
