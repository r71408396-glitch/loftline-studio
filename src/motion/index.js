// Store-wide motion with GSAP: scroll reveals, the home hero entrance, the
// animated logo, the 3D emblem, cart count and FAQ answers. Bundled into
// theme/assets/motion.js (npm run build).
//
// theme.liquid adds the `motion` class to <html> before first paint unless the
// visitor prefers reduced motion or the theme editor is open. Without it, every
// part below leaves the page as it is.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { initReveals, watchForReveals } from './reveal.js';
import { initHero } from './hero.js';
import { initLogos, initCartCount } from './header.js';
import { initAccordions } from './accordion.js';
import './logo-3d.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const root = document.documentElement;
const motion = root.classList.contains('motion');
root.classList.add('motion-ready');

if (motion) {
  initHero();
  initLogos();
  initReveals();
  watchForReveals();
  initCartCount();
  initAccordions();

  // Fonts and lazy images change the page height after load.
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}
