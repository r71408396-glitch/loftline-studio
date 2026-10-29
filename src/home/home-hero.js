// <home-hero>: full-width studio scene with the desk, a finish selector and the
// build button. A poster render shows at once; the live 3D desk replaces it
// after the page has loaded (wide screens) or after the first touch or scroll
// (phones). Choosing a finish changes the desk (or the poster), its name, and
// the finish the build button carries into the desk builder.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { afterLoad, canLoad3d, desktop, motionOn } from './shared.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

// The same camera as preview/renders.html, so the posters line up with the 3D view.
const VIEW = { direction: [0.55, 0.27, 1], margin: 0.95 };
const SCENE = { edge: 'rounded', width: 1.6, depth: 0.8, accessories: { monitor_arm: true, desk_pad: true, cable_tray: true } };

class HomeHero extends HTMLElement {
  connectedCallback() {
    // Set up once: moving the element in the page (GSAP pinning does) connects it again.
    if (this.ready) return;
    this.ready = true;
    this.inputs = [...this.querySelectorAll('input[data-finish]')];
    this.poster = this.querySelector('[data-poster]');
    this.posterSource = this.querySelector('[data-poster-mobile]');
    this.stage = this.querySelector('[data-stage]');
    this.media = this.querySelector('[data-hero-media]');
    this.name = this.querySelector('[data-finish-name]');
    this.count = this.querySelector('[data-finish-count]');
    this.links = [...this.querySelectorAll('[data-build-link]')];

    this.inputs.forEach((input, index) => input.addEventListener('change', () => this.select(index)));
    this.querySelector('[data-finish-prev]')?.addEventListener('click', () => this.step(-1));
    this.querySelector('[data-finish-next]')?.addEventListener('click', () => this.step(1));
    this.select(Math.max(0, this.inputs.findIndex((input) => input.checked)), { initial: true });

    if (canLoad3d()) {
      if (desktop() && window.matchMedia('(hover: hover)').matches) {
        afterLoad(() => this.load());
      } else {
        // Phones: wait for the visitor, so the first load stays light.
        const start = () => this.load();
        for (const type of ['pointerdown', 'scroll', 'keydown']) window.addEventListener(type, start, { once: true, passive: true });
      }
    }

    if (motionOn()) {
      this.entrance();
      this.scrollDrift();
    }
    this.stickyButton();
  }

  get current() {
    return this.inputs[this.index];
  }

  step(direction) {
    const index = (this.index + direction + this.inputs.length) % this.inputs.length;
    this.inputs[index].checked = true;
    this.select(index);
    this.inputs[index].focus();
  }

  select(index, { initial = false } = {}) {
    this.index = index;
    const input = this.current;
    if (!input) return;
    const { top, frame, code, label } = input.dataset;
    if (this.name) this.name.textContent = label;
    if (this.count) this.count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(this.inputs.length).padStart(2, '0')}`;
    for (const link of this.links) link.href = `${link.dataset.base}#${code}`;
    if (initial) return;

    if (this.viewer) {
      this.viewer.set({ top, frame });
    } else {
      // Not live (yet): show this finish's poster.
      if (this.posterSource) this.posterSource.srcset = input.dataset.posterMobile;
      this.poster.src = input.dataset.poster;
      this.poster.alt = input.dataset.alt;
      if (canLoad3d()) this.load();
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
        stage: 'studio',
        props: true,
        view: { ...VIEW, center: () => (desktop() ? 0.62 : 0.5), centerY: () => (desktop() ? 0.56 : 0.5) },
      });
      this.viewer.set({ ...SCENE, top, frame }, { instant: true });
      if (this.drift) this.viewer.setDrift(this.drift);
      await this.viewer.ready();
      this.classList.add('is-live');
    } catch (error) {
      this.loading = false;
      console.error(error);
    }
  }

  // Headline lines rise, then the desk settles, then the controls arrive.
  // Phones show the headline at once (it is the first thing on screen).
  entrance() {
    const heading = this.querySelector('[data-home-heading]');
    const items = this.querySelectorAll('[data-home-item]');
    const timeline = gsap.timeline({ defaults: { ease: 'power4.out' } });

    if (desktop() && heading) {
      SplitText.create(heading, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit(self) {
          gsap.set(heading, { opacity: 1 });
          return gsap.from(self.lines, { yPercent: 110, duration: 1.2, stagger: 0.1, ease: 'power4.out' });
        },
      });
    }
    // The poster is the largest paint, so it is never hidden: it only eases in.
    if (this.media) timeline.from(this.media, { scale: 1.06, duration: 1.8, ease: 'expo.out', clearProps: 'scale' }, 0.15);
    if (desktop() && items.length) {
      timeline.fromTo(items, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, clearProps: 'transform' }, 0.55);
    }
  }

  // As the hero scrolls away the camera turns a little around the desk and
  // moves in (the poster zooms slightly until the 3D view is live).
  scrollDrift() {
    ScrollTrigger.create({
      trigger: this,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.6,
      onUpdate: (self) => {
        const p = self.progress;
        this.drift = { yaw: -0.18 * p, pitch: 0.05 * p, dolly: 0.08 * p };
        if (this.viewer) this.viewer.setDrift(this.drift);
        else gsap.set(this.poster, { scale: 1 + 0.05 * p });
      },
    });
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
