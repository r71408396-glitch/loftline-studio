// Elements marked data-reveal fade up as they scroll into view. Elements that
// arrive in the same moment (a row of cards) follow each other with a short
// stagger. Children marked data-reveal-pop pop in after their parent.
// base.css hides data-reveal elements until this runs (with a 3 s fallback).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const SELECTOR = '[data-reveal]:not([data-revealed])';

function show(batch) {
  gsap.to(batch, {
    opacity: 1,
    y: 0,
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.08,
    overwrite: true,
    // A leftover transform would make fixed children (sticky bars, dialogs)
    // position against this element instead of the window.
    clearProps: 'transform',
  });
  const pops = batch.flatMap((element) => [...element.querySelectorAll('[data-reveal-pop]')]);
  if (pops.length) {
    gsap.from(pops, { scale: 0.4, opacity: 0, duration: 0.7, delay: 0.25, stagger: 0.08, ease: 'back.out(2.2)', clearProps: 'all' });
  }
}

export function initReveals(scope = document) {
  const items = [...scope.querySelectorAll(SELECTOR)];
  if (!items.length) return;
  items.forEach((element) => element.setAttribute('data-revealed', ''));

  // Already scrolled past (a reload halfway down the page): just show them.
  const above = items.filter((element) => element.getBoundingClientRect().bottom < 0);
  if (above.length) gsap.set(above, { opacity: 1 });

  const pending = items.filter((element) => !above.includes(element));
  if (!pending.length) return;
  gsap.set(pending, { y: 28 });
  ScrollTrigger.batch(pending, {
    start: 'top 92%',
    once: true,
    onEnter: show,
  });
}

// Sections re-rendered by filters, search, recommendations or the theme editor
// bring new data-reveal elements.
export function watchForReveals() {
  let queued = false;
  const observer = new MutationObserver((records) => {
    if (queued) return;
    const added = records.some((record) =>
      [...record.addedNodes].some((node) => node.nodeType === 1 && (node.matches(SELECTOR) || node.querySelector(SELECTOR))),
    );
    if (!added) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      initReveals();
      ScrollTrigger.refresh();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
