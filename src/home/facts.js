// <home-facts>: the numbers in the facts grid count up from zero once the
// grid scrolls into view. Without motion they simply stand at their values.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motionOn } from './shared.js';

gsap.registerPlugin(ScrollTrigger);

class HomeFacts extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    const numbers = [...this.querySelectorAll('[data-count]')].filter((el) => !Number.isNaN(parseFloat(el.dataset.count)));
    if (!numbers.length || !motionOn()) return;

    ScrollTrigger.create({
      trigger: this,
      start: 'top 70%',
      once: true,
      onEnter: () => {
        numbers.forEach((el, index) => {
          const target = parseFloat(el.dataset.count);
          const decimals = (el.dataset.count.split('.')[1] || '').length;
          const counter = { value: 0 };
          gsap.to(counter, {
            value: target,
            duration: 1.8,
            delay: index * 0.08,
            ease: 'power3.out',
            onUpdate: () => {
              el.textContent = counter.value.toFixed(decimals);
            },
          });
        });
      },
    });
  }
}

customElements.define('home-facts', HomeFacts);
