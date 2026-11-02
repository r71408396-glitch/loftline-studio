// Home page motion (GSAP): the hero comes in piece by piece (heroEntrance);
// headings and groups reveal as they scroll in;
// numbers count up; the ticker loops and slows under the pointer; on a mouse,
// big buttons lean toward it and accessory cards tilt in 3D.
// home.css hides the animated parts until this runs (2.5 s at most).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { motionOn } from './shared.js';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

// The hero, in reading order: the dot pops and the small heading decodes
// itself, the headline's letters rise out of their lines, the intro's words
// come out of a blur, the button springs in (then a sheen crosses it now and
// then), the finishes pop in and the height readout slides in. While the desk
// rises the copy drifts up a little.
function heroEntrance() {
  const hero = document.querySelector('.lh-hero');
  if (!hero) return;
  const eyebrow = hero.querySelector('[data-hero-eyebrow]');
  const heading = hero.querySelector('[data-animate="split"]');
  const lede = hero.querySelector('[data-hero-lede]');
  const actions = hero.querySelector('.lh-hero-actions');
  const button = hero.querySelector('[data-hero-button]');
  const link = hero.querySelector('[data-hero-link]');
  const finish = hero.querySelector('.lh-hero-finish');
  const readout = hero.querySelector('.lh-readout');
  gsap.set([eyebrow, heading, lede, actions, finish, readout].filter(Boolean), { visibility: 'visible' });

  const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (eyebrow) {
    const dot = eyebrow.querySelector('.lh-pulse');
    const textNode = [...eyebrow.childNodes].find((node) => node.nodeType === 3 && node.textContent.trim());
    if (dot) timeline.from(dot, { scale: 0, duration: 0.6, ease: 'back.out(3)' }, 0);
    if (textNode) {
      const text = document.createElement('span');
      const words = textNode.textContent.trim();
      text.setAttribute('aria-label', words);
      text.textContent = '';
      eyebrow.replaceChild(text, textNode);
      timeline.to(text, { duration: 1.3, scrambleText: { text: words, chars: 'upperCase', speed: 0.5, revealDelay: 0.25 }, ease: 'none' }, 0.1);
    }
  }

  if (heading) {
    const split = SplitText.create(heading, { type: 'lines,chars', mask: 'lines' });
    timeline.from(split.chars, { yPercent: 115, rotate: 7, duration: 1, ease: 'expo.out', stagger: 0.022 }, 0.15);
  }

  if (lede) {
    const split = SplitText.create(lede, { type: 'words', wordsClass: 'lh-word' });
    timeline.from(split.words, { autoAlpha: 0, y: 14, filter: 'blur(8px)', duration: 0.7, stagger: 0.025, clearProps: 'filter' }, 0.6);
  }

  if (button) timeline.from(button, { autoAlpha: 0, scale: 0.86, y: 18, duration: 0.9, ease: 'back.out(1.8)' }, 0.9);
  if (link) timeline.from(link, { autoAlpha: 0, x: -16, duration: 0.6 }, 1.05);
  if (finish) {
    timeline
      .from(finish.querySelectorAll('.lh-swatch'), { autoAlpha: 0, scale: 0.6, duration: 0.6, stagger: 0.08, ease: 'back.out(2)' }, 1.1)
      .from(finish.querySelector('.lh-finish-label'), { autoAlpha: 0, x: -10, duration: 0.5 }, 1.35);
  }
  if (readout) {
    timeline
      .from(readout, { autoAlpha: 0, x: 24, duration: 0.8 }, 1.0)
      .from(readout.querySelector('.lh-readout-track'), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.9, ease: 'power2.inOut' }, 1.2);
  }

  // A light sheen sweeps across the main button every few seconds.
  const shine = button && button.querySelector('.lh-shine');
  if (shine) {
    gsap.set(shine, { skewX: -18 });
    gsap.fromTo(shine, { xPercent: -160 }, { xPercent: 330, duration: 1.1, ease: 'power2.inOut', repeat: -1, repeatDelay: 3.6, delay: timeline.duration() });
  }

  // While the desk rises, the copy drifts up and softens a little.
  const copy = hero.querySelector('.lh-hero-copy');
  const wrap = hero.closest('.lh-hero-wrap');
  if (copy && wrap) {
    gsap.to(copy, {
      y: -60,
      opacity: 0.45,
      ease: 'none',
      scrollTrigger: { trigger: wrap, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
    });
  }
}

// Arrows in buttons and arrow links slip out and come back in on hover.
function arrowHops() {
  document.querySelectorAll('.lh-hero .button, .lh-link-arrow, .lh-summary .button, .site-footer__cta .button, .site-header__cta').forEach((element) => {
    const icon = element.querySelector('.icon');
    if (!icon) return;
    const diagonal = icon.classList.contains('icon-arrow-up-right');
    const out = diagonal ? { x: 12, y: -12 } : { x: 14, y: 0 };
    const back = diagonal ? { x: -12, y: 12 } : { x: -14, y: 0 };
    element.addEventListener('pointerenter', () => {
      gsap
        .timeline({ overwrite: true })
        .to(icon, { ...out, autoAlpha: 0, duration: 0.18, ease: 'power2.in' })
        .set(icon, back)
        .to(icon, { x: 0, y: 0, autoAlpha: 1, duration: 0.3, ease: 'power3.out' });
    });
  });
}

if (motionOn()) {
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    heroEntrance();

    gsap.utils.toArray('[data-animate="reveal"]').forEach((element) => {
      gsap.from(element, {
        y: 32,
        autoAlpha: 0,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: { trigger: element, start: 'top 85%', once: true },
      });
    });

    gsap.utils.toArray('[data-animate="stagger"]').forEach((group) => {
      gsap.from(group.children, {
        y: 28,
        autoAlpha: 0,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.08,
        clearProps: 'transform',
        scrollTrigger: { trigger: group, start: 'top 85%', once: true },
      });
    });

    gsap.utils.toArray('[data-animate="count"]').forEach((element) => {
      const to = Number(element.dataset.to || element.textContent.replace(/[^0-9.]/g, '')) || 0;
      const counter = { n: 0 };
      const trigger = { trigger: element, start: 'top 90%', once: true };
      gsap.from(element, { autoAlpha: 0, duration: 0.3, scrollTrigger: trigger });
      gsap.to(counter, {
        n: to,
        duration: 1.4,
        ease: 'power1.out',
        scrollTrigger: trigger,
        onUpdate: () => {
          element.textContent = Math.round(counter.n).toLocaleString();
        },
      });
    });

    // Ticker: one copy of the items follows the other, so the loop is seamless.
    const copies = [];
    gsap.utils.toArray('[data-marquee]').forEach((track) => {
      [...track.children].forEach((item) => {
        const copy = item.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        track.appendChild(copy);
        copies.push(copy);
      });
      const speed = Number(track.dataset.marquee) || 40;
      const loop = gsap.to(track, { xPercent: -50, ease: 'none', repeat: -1, duration: () => track.scrollWidth / 2 / speed });
      track.addEventListener('pointerenter', () => gsap.to(loop, { timeScale: 0.2, duration: 0.5 }));
      track.addEventListener('pointerleave', () => gsap.to(loop, { timeScale: 1, duration: 0.5 }));
    });
    return () => copies.forEach((copy) => copy.remove());
  });

  mm.add('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)', () => {
    arrowHops();
    const cleanups = [];
    const listen = (element, move, leave) => {
      element.addEventListener('pointermove', move);
      element.addEventListener('pointerleave', leave);
      cleanups.push(() => {
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerleave', leave);
      });
    };

    document.querySelectorAll('[data-magnetic]').forEach((element) => {
      const pull = Number(element.dataset.magnetic) || 0.3;
      listen(
        element,
        (event) => {
          const box = element.getBoundingClientRect();
          gsap.to(element, {
            x: (event.clientX - box.left - box.width / 2) * pull,
            y: (event.clientY - box.top - box.height / 2) * pull,
            duration: 0.4,
            ease: 'power3.out',
            overwrite: 'auto',
          });
        },
        () => gsap.to(element, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' }),
      );
    });

    document.querySelectorAll('[data-tilt]').forEach((element) => {
      gsap.set(element, { transformPerspective: 900 });
      const rotateX = gsap.quickTo(element, 'rotationX', { duration: 0.5, ease: 'power3' });
      const rotateY = gsap.quickTo(element, 'rotationY', { duration: 0.5, ease: 'power3' });
      listen(
        element,
        (event) => {
          const box = element.getBoundingClientRect();
          rotateY(((event.clientX - box.left) / box.width - 0.5) * 12);
          rotateX(-((event.clientY - box.top) / box.height - 0.5) * 12);
        },
        () => {
          rotateX(0);
          rotateY(0);
        },
      );
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  });
}
