// <home-hero>: the studio scene with the desk, a finish selector and the build
// button. A poster render shows at once. On wide screens with a pointer the
// live 3D desk replaces it after the page has loaded, and rises from sitting to
// standing height as the visitor scrolls through the hero (the hero is taller
// than the screen; its inner frame sticks). Phones keep the poster: choosing a
// finish swaps the poster image. Either way the finish travels into the desk
// builder through the button link, and tints the glow behind the desk.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { afterLoad, canLoad3d, desktop, motionOn } from './shared.js';

gsap.registerPlugin(ScrollTrigger);

// The same camera as preview/renders.html, so the posters line up with the 3D view.
const VIEW = { direction: [0.55, 0.27, 1], margin: 0.95 };
const SCENE = { edge: 'rounded', width: 1.6, depth: 0.8, accessories: { monitor_arm: true, desk_pad: true, cable_tray: true } };
// Sitting and standing heights of the top, in metres.
const SIT = 0.72;
const STAND = 1.18;
const ease = gsap.parseEase('power2.inOut');

class HomeHero extends HTMLElement {
  connectedCallback() {
    // Set up once: moving the element in the page connects it again.
    if (this.ready) return;
    this.ready = true;
    this.inputs = [...this.querySelectorAll('input[data-finish]')];
    this.poster = this.querySelector('[data-poster]');
    this.posterSource = this.querySelector('[data-poster-mobile]');
    this.stage = this.querySelector('[data-stage]');
    this.thumb = this.querySelector('[data-finish-thumb]');
    this.name = this.querySelector('[data-finish-name]');
    this.readout = this.querySelector('[data-readout-value]');
    this.dot = this.querySelector('[data-readout-dot]');
    this.links = [...this.querySelectorAll('[data-build-link]')];
    this.height = SIT;

    this.inputs.forEach((input, index) => input.addEventListener('change', () => this.select(index)));
    this.select(Math.max(0, this.inputs.findIndex((input) => input.checked)), { initial: true });
    if (this.thumb) {
      // Fonts arriving and resizes change the chip widths.
      new ResizeObserver(() => this.placeThumb()).observe(this.thumb.parentElement);
      document.fonts?.ready.then(() => this.placeThumb());
    }

    if (this.wants3d()) afterLoad(() => this.load());
    if (motionOn() && desktop()) this.rise();
    this.stickyButton();
  }

  wants3d() {
    return desktop() && window.matchMedia('(hover: hover)').matches && canLoad3d();
  }

  get current() {
    return this.inputs[this.index];
  }

  select(index, { initial = false } = {}) {
    this.index = index;
    const input = this.current;
    if (!input) return;
    const { top, frame, code, label, glow } = input.dataset;
    if (this.name) this.name.textContent = label;
    if (glow) this.style.setProperty('--glow', glow);
    for (const link of this.links) link.href = `${link.dataset.base}#${code}`;
    this.placeThumb();
    if (initial) return;

    if (this.viewer) {
      this.viewer.set({ top, frame });
    } else {
      // Not live (yet): show this finish's poster.
      if (this.posterSource) this.posterSource.srcset = input.dataset.posterMobile;
      this.poster.src = input.dataset.poster;
      this.poster.alt = input.dataset.alt;
      if (this.wants3d()) this.load();
    }
  }

  // The highlight slides behind the chosen chip.
  placeThumb() {
    const input = this.current;
    if (!this.thumb || !input) return;
    const chip = input.closest('.finish-chip');
    const box = chip.getBoundingClientRect();
    const parent = this.thumb.parentElement.getBoundingClientRect();
    this.thumb.style.transform = `translateX(${box.left - parent.left}px)`;
    this.thumb.style.width = `${box.width}px`;
    this.thumb.classList.add('is-placed');
  }

  async load() {
    if (this.loading) return;
    this.loading = true;
    try {
      const { DeskViewer } = await import(this.dataset.viewerSrc);
      const { top, frame } = this.current.dataset;
      this.viewer = new DeskViewer(this.stage, {
        interactive: false,
        stage: 'studio',
        props: true,
        // A full-screen canvas: 1.5x is plenty, and far cheaper than 2x on a retina screen.
        pixelRatio: 1.5,
        view: { ...VIEW, center: 0.62, centerY: 0.56 },
      });
      this.viewer.set({ ...SCENE, top, frame, height: this.height }, { instant: true });
      if (this.drift) this.viewer.setDrift(this.drift);
      await this.viewer.ready();
      this.classList.add('is-live');
    } catch (error) {
      this.loading = false;
      console.error(error);
    }
  }

  // Scrolling through the hero raises the desk from sitting to standing
  // height, turns the camera a little, and ticks the height readout.
  rise() {
    ScrollTrigger.create({
      trigger: this,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => this.setProgress(self.progress),
    });
  }

  setProgress(progress) {
    const p = ease(progress);
    this.height = SIT + (STAND - SIT) * p;
    this.drift = { yaw: -0.14 * p, pitch: 0.04 * p, dolly: 0.05 * p };
    this.style.setProperty('--rise', p.toFixed(3));
    if (this.readout) this.readout.textContent = Math.round(this.height * 100);
    if (this.dot) this.dot.style.transform = `translateY(${(-p * 100).toFixed(1)}%)`;
    if (this.viewer) {
      this.viewer.setDrift(this.drift);
      this.viewer.set({ height: this.height }, { instant: true });
    } else if (this.poster) {
      // Poster only: a slow push in stands in for the camera move.
      this.poster.style.transform = `scale(${1 + 0.06 * p})`;
    }
  }

  // Phones: a build button stays at the bottom of the screen once the hero's
  // own button has scrolled away, until the footer's button comes into view.
  stickyButton() {
    const bar = this.querySelector('[data-sticky-build]');
    const button = this.querySelector('[data-hero-button]');
    if (!bar || !button) return;
    const footerButton = document.querySelector('[data-footer-build]');
    const state = { heroVisible: true, footerVisible: false };
    const update = () => {
      const show = !state.heroVisible && !state.footerVisible;
      bar.classList.toggle('is-visible', show);
      bar.inert = !show;
    };
    new IntersectionObserver(([entry]) => {
      state.heroVisible = entry.isIntersecting || entry.boundingClientRect.top > 0;
      update();
    }).observe(button);
    if (footerButton) {
      new IntersectionObserver(([entry]) => {
        state.footerVisible = entry.isIntersecting;
        update();
      }).observe(footerButton);
    }
    update();
  }
}

customElements.define('home-hero', HomeHero);
