// Home page motion (GSAP): the headline rises line by line out of a mask and
// the rest of the hero follows; headings and groups reveal as they scroll in;
// numbers count up; the ticker loops and slows under the pointer; on a mouse,
// big buttons lean toward it and accessory cards tilt in 3D.
// home.css hides the animated parts until this runs (2.5 s at most).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { motionOn } from './shared.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

if (motionOn()) {
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
    document.querySelectorAll('[data-animate="split"]').forEach((heading) => {
      const split = SplitText.create(heading, { type: 'lines', mask: 'lines' });
      gsap.set(heading, { visibility: 'visible' });
      timeline.from(split.lines, { yPercent: 120, duration: 1.1, ease: 'expo.out', stagger: 0.14 }, 0);
    });
    timeline.from('[data-animate="hero"]', { y: 22, autoAlpha: 0, duration: 0.8, stagger: 0.1 }, 0.35);

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
