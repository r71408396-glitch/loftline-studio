// Home hero: shows a still image first (fast first paint), then swaps in the
// turning 3D desk. Desktop loads it after the page has loaded; phones wait for a tap.

class DeskHero extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('[data-load-3d]');
    if (this.button) this.button.addEventListener('click', () => this.load(true));

    const desktop = window.matchMedia('(min-width: 990px) and (hover: hover)').matches;
    const saveData = navigator.connection && navigator.connection.saveData;
    if (desktop && !saveData) {
      const start = () => (window.requestIdleCallback || setTimeout)(() => this.load(false), { timeout: 2000 });
      if (document.readyState === 'complete') start();
      else window.addEventListener('load', start, { once: true });
    }
  }

  async load(fromTap) {
    if (this.loading) return;
    this.loading = true;
    if (this.button) this.button.disabled = true;
    try {
      const { DeskViewer } = await import(this.dataset.viewerSrc);
      const stage = this.querySelector('[data-stage]');
      this.viewer = new DeskViewer(stage, { autoRotate: true });
      this.viewer.set(JSON.parse(this.dataset.config || '{}'), { instant: true });
      await this.viewer.ready();
      this.classList.add('is-live');
      if (fromTap) stage.focus();
    } catch (error) {
      this.loading = false;
      if (this.button) this.button.disabled = false;
      console.error(error);
    }
  }
}

customElements.define('desk-hero', DeskHero);
