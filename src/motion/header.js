// The SVG logo (snippets/logo.liquid) assembles like the 3D emblem: the L frame
// rises, the floating line drops into place, then the letters follow. The
// header plays it once per visit; the footer plays it when it scrolls into view.
// Also: the cart count gives a small bounce when it changes.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const SESSION_KEY = 'loftline:logo-intro';

export function assembleLogo(logo) {
  const frame = logo.querySelector('[data-logo-frame]');
  const line = logo.querySelector('[data-logo-line]');
  const letters = logo.querySelectorAll('[data-logo-letter]');
  const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
  // Mark units are 240 per side (the svg clips anything outside it).
  if (frame) timeline.from(frame, { y: 240, duration: 0.8, clearProps: 'transform' }, 0);
  if (line) timeline.from(line, { y: -150, opacity: 0, duration: 0.9, ease: 'back.out(1.6)', clearProps: 'all' }, 0.2);
  if (letters.length) {
    timeline.from(letters, { y: 26, opacity: 0, duration: 0.6, stagger: 0.025, clearProps: 'all' }, 0.35);
  }
  return timeline;
}

function seen() {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return true;
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Storage blocked: play it every time.
  }
  return false;
}

export function initLogos() {
  const header = document.querySelector('[data-logo-intro]');
  if (header && !seen()) assembleLogo(header.querySelector('[data-logo]'));

  document.querySelectorAll('[data-logo-scroll] [data-logo]').forEach((logo) => {
    const timeline = assembleLogo(logo).pause();
    ScrollTrigger.create({ trigger: logo, start: 'top 95%', once: true, onEnter: () => timeline.play() });
  });
}

export function initCartCount() {
  document.querySelectorAll('[data-cart-count]').forEach((badge) => {
    let last = badge.textContent.trim();
    new MutationObserver(() => {
      const now = badge.textContent.trim();
      if (now === last || badge.hidden) return;
      last = now;
      gsap.fromTo(badge, { scale: 1.6 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.45)', clearProps: 'transform' });
    }).observe(badge, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  });
}
