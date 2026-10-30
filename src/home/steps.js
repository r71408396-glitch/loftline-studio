// <home-steps>: the three builder steps. As each step reaches the middle of
// the screen it lights up, the sticky picture beside the list changes to its
// picture, the big number flips, and the line along the list fills in.
// Phones show each step's picture inline (CSS); the highlighting still runs.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motionOn } from './shared.js';

gsap.registerPlugin(ScrollTrigger);

class HomeSteps extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.items = [...this.querySelectorAll('[data-step]')];
    this.pictures = [...this.querySelectorAll('[data-step-picture]')];
    this.number = this.querySelector('[data-step-number]');
    this.list = this.querySelector('[data-step-list]');
    const progress = this.querySelector('[data-step-progress]');
    if (!this.items.length) return;

    this.items.forEach((item, index) => {
      ScrollTrigger.create({
        trigger: item,
        start: 'top 58%',
        end: 'bottom 58%',
        onToggle: (self) => self.isActive && this.activate(index),
      });
    });

    if (progress && this.list) {
      gsap.fromTo(
        progress,
        { scaleY: 0 },
        { scaleY: 1, ease: 'none', scrollTrigger: { trigger: this.list, start: 'top 58%', end: 'bottom 58%', scrub: true } },
      );
    }
  }

  activate(index) {
    if (this.active === index) return;
    this.active = index;
    this.items.forEach((item, i) => item.classList.toggle('is-active', i === index));
    this.pictures.forEach((picture, i) => picture.classList.toggle('is-active', i === index));
    if (this.number) {
      this.number.textContent = String(index + 1).padStart(2, '0');
      if (motionOn()) gsap.fromTo(this.number, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'power3.out', overwrite: true });
    }
  }
}

customElements.define('home-steps', HomeSteps);
