// <home-builder>: the small desk builder on the home page. Size, finish and
// add-ons update a live 3D desk (it turns slowly until dragged), the chips on
// the stage, a one-line summary and the add-ons total. "Open the full builder"
// carries every choice to the desk builder page in its link (the same hash
// the builder writes: m, w, d, e, f and a for the add-ons).
import { canLoad3d } from './shared.js';

const SIT = 0.72;
const STAND = 1.12;

class HomeBuilder extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.form = this.querySelector('[data-config-form]');
    this.stage = this.querySelector('[data-stage]');
    this.width = this.form.elements.width;
    this.mode = this.querySelector('[data-mode]');
    this.out = {
      width: this.querySelector('[data-width-out]'),
      dims: this.querySelector('[data-dims]'),
      top: this.querySelector('[data-top-out]'),
      frame: this.querySelector('[data-frame-out]'),
      spec: this.querySelector('[data-spec-out]'),
      total: this.querySelector('[data-total-out]'),
    };
    this.link = this.querySelector('[data-builder-link]');
    this.money = new Intl.NumberFormat(this.dataset.locale || undefined, {
      style: 'currency',
      currency: this.dataset.currency || 'USD',
    });
    this.standing = false;

    this.form.addEventListener('input', () => this.render());
    this.mode.addEventListener('click', () => {
      this.standing = !this.standing;
      this.render();
    });
    this.render();

    if (canLoad3d()) {
      new IntersectionObserver(
        ([entry], observer) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          this.load();
        },
        { rootMargin: '300px 0px' },
      ).observe(this);
    }
  }

  checked(name) {
    return this.form.querySelector(`input[name="${name}"]:checked`);
  }

  get state() {
    const top = this.checked('top');
    const frame = this.checked('frame');
    const edge = this.checked('edge');
    const addons = [...this.form.querySelectorAll('input[name="addon"]:checked')];
    return {
      width: Number(this.width.value),
      depth: Number(this.checked('depth').value),
      top,
      frame,
      edge,
      addons,
    };
  }

  render() {
    const s = this.state;
    const percent = ((s.width - Number(this.width.min)) / (Number(this.width.max) - Number(this.width.min))) * 100;
    this.width.style.setProperty('--p', `${percent}%`);
    this.out.width.textContent = `${s.width} cm`;
    this.out.dims.textContent = `${s.width} x ${s.depth} cm`;
    this.out.top.textContent = s.top.dataset.name;
    this.out.frame.textContent = s.frame.dataset.name;
    this.mode.textContent = this.standing ? this.mode.dataset.standing : this.mode.dataset.sitting;
    this.mode.setAttribute('aria-pressed', String(this.standing));

    this.out.spec.textContent = this.form.dataset.spec
      .replace('[width]', s.width)
      .replace('[depth]', s.depth)
      .replace('[top]', s.top.dataset.name)
      .replace('[frame]', s.frame.dataset.name.toLowerCase())
      .replace('[edge]', s.edge.dataset.name);
    const cents = s.addons.reduce((sum, input) => sum + Number(input.dataset.price || 0), 0);
    this.out.total.textContent = this.money.format(cents / 100);

    const params = new URLSearchParams({
      m: s.top.dataset.code,
      w: s.width,
      d: s.depth,
      e: s.edge.value,
      f: s.frame.dataset.code,
    });
    const ids = s.addons.map((input) => input.value).filter(Boolean);
    if (ids.length) params.set('a', ids.join('.'));
    this.link.href = `${this.dataset.builder}#${params}`;

    if (this.viewer) this.viewer.set(this.viewerConfig(s));
  }

  viewerConfig(s = this.state) {
    const accessories = {};
    for (const input of this.form.querySelectorAll('input[name="addon"]')) {
      accessories[input.dataset.model] = input.checked;
    }
    return {
      width: s.width / 100,
      depth: s.depth / 100,
      height: this.standing ? STAND : SIT,
      top: s.top.value,
      frame: s.frame.value,
      edge: s.edge.value,
      accessories,
    };
  }

  async load() {
    try {
      const { DeskViewer } = await import(this.dataset.viewerSrc);
      this.viewer = new DeskViewer(this.stage, { stage: 'night', autoRotate: true, pixelRatio: 1.5 });
      this.viewer.set(this.viewerConfig(), { instant: true });
      await this.viewer.ready();
      this.classList.add('is-live');
    } catch (error) {
      console.error(error);
    }
  }
}

customElements.define('home-builder', HomeBuilder);
