// <desk-details>: the exploded desk next to the Size / Finish / Add-ons rows.
// Scrolling through the section pulls the top, frame and accessories apart,
// holds them there, then settles them together again. Numbered markers follow
// the parts they describe; hovering a row lights up its marker.
// Before the 3D view loads (and with reduced motion) a render of the exploded
// desk is shown, with the markers at their places on it.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { canLoad3d, desktop, motionOn } from './shared.js';

gsap.registerPlugin(ScrollTrigger);

// The same camera as preview/renders.html (details-exploded.webp).
const VIEW = { direction: [0.5, 0.42, 1], margin: 0.9 };
const SCENE = { top: 'walnut', frame: 'black', edge: 'rounded', width: 1.6, depth: 0.8, accessories: { cable_tray: true, desk_pad: true } };

class DeskDetails extends HTMLElement {
  connectedCallback() {
    // Set up once: moving the element in the page (GSAP pinning does) connects it again.
    if (this.ready) return;
    this.ready = true;
    this.stage = this.querySelector('[data-stage]');
    this.visual = this.querySelector('[data-details-visual]');
    this.markers = [...this.querySelectorAll('[data-marker]')];
    this.rows = [...this.querySelectorAll('[data-row]')];
    this.amount = { explode: 1 };

    for (const row of this.rows) {
      const marker = this.markers.find((m) => m.dataset.marker === row.dataset.row);
      const on = (active) => {
        row.classList.toggle('is-active', active);
        marker?.classList.toggle('is-active', active);
      };
      for (const element of [row, marker].filter(Boolean)) {
        element.addEventListener('pointerenter', () => on(true));
        element.addEventListener('pointerleave', () => on(false));
      }
      row.addEventListener('focusin', () => on(true));
      row.addEventListener('focusout', () => on(false));
    }

    if (!canLoad3d() || !this.stage) return;
    new IntersectionObserver(
      ([entry], observer) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        this.load();
      },
      { rootMargin: '400px 0px' },
    ).observe(this);
  }

  async load() {
    try {
      const { DeskViewer } = await import(this.dataset.viewerSrc);
      this.viewer = new DeskViewer(this.stage, { interactive: false, stage: 'paper', explodedFraming: true, view: VIEW });
      this.viewer.set(SCENE, { instant: true });
      this.viewer.onRender(() => this.placeMarkers());
      if (motionOn()) this.sequence();
      else this.viewer.setExplode(1);
      await this.viewer.ready();
      this.classList.add('is-live');
    } catch (error) {
      console.error(error);
    }
  }

  // Pull apart over the first 40 %, hold, settle over the last 40 %.
  sequence() {
    const timeline = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onUpdate: () => this.viewer.setExplode(this.amount.explode) });
    this.amount.explode = 0;
    timeline.to(this.amount, { explode: 1, duration: 0.4 }).to(this.amount, { explode: 1, duration: 0.2 }).to(this.amount, { explode: 0, duration: 0.4 });

    if (desktop()) {
      // Wide screens: hold the section on screen while the desk comes apart.
      // The inner grid is pinned, so the section's background grows with it.
      const content = this.firstElementChild;
      const tall = () => content.offsetHeight > window.innerHeight;
      ScrollTrigger.create({
        trigger: content,
        start: () => (tall() ? 'top top' : 'center center'),
        end: '+=110%',
        pin: content,
        pinSpacing: true,
        scrub: 0.8,
        animation: timeline,
        invalidateOnRefresh: true,
      });
    } else {
      // Phones: no pinning; the sequence plays as the desk passes through.
      ScrollTrigger.create({ trigger: this.visual, start: 'top 85%', end: 'bottom 15%', scrub: 0.8, animation: timeline });
    }
    this.viewer.setExplode(this.amount.explode);
    // The pin adds scroll room: move the triggers further down the page too.
    ScrollTrigger.refresh();
  }

  // Markers follow their parts, and show while the desk is apart (their
  // parts are hidden under the top once it settles).
  placeMarkers() {
    const show = Math.min(1, Math.max(0, (this.viewer.explode - 0.3) / 0.4));
    for (const marker of this.markers) {
      marker.style.opacity = show;
      const point = this.viewer.anchor(marker.dataset.anchor, Number(marker.dataset.along) || 0);
      if (!point) continue;
      const { x, y } = this.viewer.project(point);
      marker.style.setProperty('--x', `${x}px`);
      marker.style.setProperty('--y', `${y}px`);
    }
  }
}

customElements.define('desk-details', DeskDetails);
