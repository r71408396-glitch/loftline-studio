// Home hero entrance on wide screens: the heading rises line by line from
// behind a mask, then the text, buttons and points follow, and the desk eases
// into place. The desk image is never hidden, so it still paints first.
// On phones the hero shows at once (it is the first thing on screen).
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

export function initHero() {
  const hero = document.querySelector('[data-hero]');
  if (!hero || !window.matchMedia('(min-width: 990px)').matches) return;

  const heading = hero.querySelector('[data-hero-heading]');
  const items = hero.querySelectorAll('[data-hero-item]');
  const visual = hero.querySelector('[data-hero-visual]');

  if (heading) {
    // autoSplit splits again when fonts load or the width changes; returning
    // the tween lets SplitText carry its progress over to the new lines.
    SplitText.create(heading, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit(self) {
        gsap.set(heading, { opacity: 1 });
        return gsap.from(self.lines, { yPercent: 110, duration: 1.1, stagger: 0.09, ease: 'power4.out' });
      },
    });
  }

  const timeline = gsap.timeline({ defaults: { ease: 'power4.out' } });
  if (items.length) {
    timeline.fromTo(items, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, clearProps: 'transform' }, 0.35);
  }
  if (visual) {
    timeline.from(visual, { scale: 0.94, y: 24, duration: 1.4, ease: 'expo.out', clearProps: 'scale' }, 0.1);

    // The desk drifts a little slower than the page as you scroll away.
    gsap.to(visual, {
      yPercent: 8,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
  }
}
