// FAQ answers slide open and closed instead of jumping. The <details> element
// still does the work, so keyboard and screen readers behave as before.
import { gsap } from 'gsap';

export function initAccordions() {
  document.addEventListener('click', (event) => {
    const summary = event.target.closest('.faq-item > summary');
    if (!summary) return;
    const details = summary.parentElement;
    const body = summary.nextElementSibling;
    if (!body) return;
    event.preventDefault();
    if (gsap.isTweening(body)) return;

    if (details.open) {
      gsap.to(body, {
        height: 0,
        opacity: 0,
        overflow: 'hidden',
        duration: 0.35,
        ease: 'power2.inOut',
        onComplete() {
          details.open = false;
          gsap.set(body, { clearProps: 'all' });
        },
      });
    } else {
      details.open = true;
      gsap.from(body, { height: 0, opacity: 0, overflow: 'hidden', duration: 0.45, ease: 'power3.out', clearProps: 'all' });
    }
  });
}
