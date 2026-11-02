// <home-hero>: the studio scene with the desk, the finish swatches and the
// height readout. The hero is taller than the screen and its inner frame
// sticks; scrolling through it raises the desk from 72 to 127 cm. A poster
// shows at once; on wide screens with a pointer the live 3D desk replaces it
// after the page has loaded. Phones keep the posters (a swatch swaps them).
// Either way the chosen finish travels into the desk builder through the
// button link.
import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { afterLoad, canLoad3d, desktop, motionOn } from './shared.js';

gsap.registerPlugin(ScrambleTextPlugin);

// The same camera as preview/renders.html, so the posters line up with the 3D
// view: the desk right of the headline on wide screens, above it when tall.
const portrait = () => window.matchMedia('(max-aspect-ratio: 1/1)').matches;
const VIEW = {
  direction: [-0.42, 0.3, 0.86],
  margin: 0.8,
  center: () => (portrait() ? 0.5 : 0.66),
  centerY: () => (portrait() ? 0.32 : 0.55),
};
const SCENE = { edge: 'rounded', width: 1.6, depth: 0.8, accessories: { monitor_arm: true, desk_pad: true, cable_tray: true } };
// Top height in cm at the start and the end of the scroll.
const LOW = 72;
const HIGH = 127;

class HomeHero extends HTMLElement {
  connectedCallback() {
    // Set up once: moving the element in the page connects it again.
    if (this.ready) return;
    this.ready = true;
    this.swatches = [...this.querySelectorAll('[data-finish]')];
    this.poster = this.querySelector('[data-poster]');
    this.posterSource = this.querySelector('[data-poster-mobile]');
    this.stage = this.querySelector('[data-stage]');
    this.name = this.querySelector('[data-finish-name]');
    this.readout = this.querySelector('[data-readout-value]');
    this.dot = this.querySelector('[data-readout-dot]');
    this.links = [...this.querySelectorAll('[data-build-link]')];
    this.progress = 0;
    this.shown = LOW;

    this.swatches.forEach((swatch, index) => swatch.addEventListener('click', () => this.select(index)));
    this.index = Math.max(0, this.swatches.findIndex((swatch) => swatch.getAttribute('aria-pressed') === 'true'));

    // With motion on, a pill slides behind the chosen finish.
    this.thumb = this.querySelector('[data-swatch-thumb]');
    if (this.thumb && motionOn()) {
      this.thumb.parentElement.classList.add('has-thumb');
      this.placeThumb(false);
      new ResizeObserver(() => this.placeThumb(false)).observe(this.thumb.parentElement);
      document.fonts?.ready.then(() => this.placeThumb(false));
    }

    this.onScroll = this.onScroll.bind(this);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll);
    this.onScroll();

    if (this.wants3d()) afterLoad(() => this.load());
  }

  wants3d() {
    return desktop() && window.matchMedia('(hover: hover)').matches && canLoad3d();
  }

  get current() {
    return this.swatches[this.index];
  }

  select(index) {
    this.index = index;
    const swatch = this.current;
    const { top, frame, code, label } = swatch.dataset;
    this.swatches.forEach((other) => other.setAttribute('aria-pressed', String(other === swatch)));
    if (this.name) {
      if (motionOn()) gsap.to(this.name, { duration: 0.6, scrambleText: { text: label, chars: 'lowerCase', speed: 0.8 }, overwrite: true });
      else this.name.textContent = label;
    }
    if (this.thumb && motionOn()) {
      this.placeThumb(true);
      const dot = swatch.querySelector('.lh-dot');
      if (dot) gsap.fromTo(dot, { scale: 0.7 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', clearProps: 'transform' });
    }
    for (const link of this.links) link.href = `${link.dataset.base}#${code}`;

    if (this.viewer) {
      this.viewer.set({ top, frame });
    } else {
      // Not live (yet): show this finish's poster.
      if (this.posterSource) this.posterSource.srcset = swatch.dataset.posterMobile;
      this.poster.src = swatch.dataset.poster;
      this.poster.alt = swatch.dataset.alt;
      if (this.wants3d()) this.load();
    }
  }

  placeThumb(animate) {
    const swatch = this.current;
    if (!swatch || !this.thumb) return;
    const target = { x: swatch.offsetLeft, width: swatch.offsetWidth };
    if (animate) gsap.to(this.thumb, { ...target, duration: 0.55, ease: 'power3.out', overwrite: true });
    else gsap.set(this.thumb, target);
  }

  // How far the visitor has scrolled through the hero (0 to 1).
  onScroll() {
    if (this.frameRequest) return;
    this.frameRequest = requestAnimationFrame(() => {
      this.frameRequest = null;
      const total = this.offsetHeight - window.innerHeight;
      const top = this.getBoundingClientRect().top;
      this.progress = total > 0 ? Math.min(1, Math.max(0, -top / total)) : 0;
      this.update();
    });
  }

  update() {
    const p = this.progress;
    const cm = Math.round(LOW + p * (HIGH - LOW));
    if (cm !== this.shown) {
      this.shown = cm;
      if (this.readout) this.readout.textContent = cm;
    }
    if (this.dot) this.dot.style.bottom = `${p * 100}%`;
    this.drift = { yaw: -0.14 * p, pitch: 0.04 * p, dolly: 0.05 * p };
    if (this.viewer) {
      this.viewer.setDrift(this.drift);
      this.viewer.set({ height: (LOW + p * (HIGH - LOW)) / 100 }, { instant: true });
    } else if (this.poster) {
      // Poster only: a slow push in stands in for the camera move.
      this.poster.style.transform = `scale(${1 + 0.06 * p})`;
    }
  }

  async load() {
    if (this.loading) return;
    this.loading = true;
    try {
      const { DeskViewer } = await import(this.dataset.viewerSrc);
      const { top, frame } = this.current.dataset;
      this.viewer = new DeskViewer(this.stage, {
        interactive: false,
        stage: 'night',
        props: true,
        // A full-screen canvas: 1.5x is plenty, and far cheaper than 2x on a retina screen.
        pixelRatio: 1.5,
        view: VIEW,
      });
      this.viewer.set({ ...SCENE, top, frame, height: (LOW + this.progress * (HIGH - LOW)) / 100 }, { instant: true });
      if (this.drift) this.viewer.setDrift(this.drift);
      await this.viewer.ready();
      this.classList.add('is-live');
    } catch (error) {
      this.loading = false;
      console.error(error);
    }
  }
}

customElements.define('home-hero', HomeHero);
