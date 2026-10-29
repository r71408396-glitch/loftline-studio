// <logo-3d>: the 3D Loftline emblem. Three.js and the model load only when the
// element comes near the screen (a separate chunk, shared with the desk viewer).
//
// data-mode="intro"  plays the assembly once it has loaded (password page).
// data-mode="scroll" ties the assembly to scrolling.
// Both keep the floating line gently floating and tilt toward the pointer.
// data-mode="once"   plays the assembly once when it comes into view, then
//                    holds still (a brief brand detail in the footer).
// With reduced motion or no WebGL the still render stays in place.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

class Logo3D extends HTMLElement {
  connectedCallback() {
    this.mode = ['scroll', 'once'].includes(this.dataset.mode) ? this.dataset.mode : 'intro';
    this.stage = this.querySelector('[data-stage]');
    const motion = document.documentElement.classList.contains('motion');
    if (!this.stage || !motion || !webglAvailable()) {
      this.showStill();
      return;
    }

    this.tick = this.tick.bind(this);
    this.onPointer = this.onPointer.bind(this);
    this.observer = new IntersectionObserver(
      ([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible && !this.started) this.load();
        this.updateTicker();
      },
      { rootMargin: '300px 0px' },
    );
    this.observer.observe(this);
    // Slow connection: show the still rather than an empty space.
    this.fallback = setTimeout(() => this.showStill(), 4000);
  }

  disconnectedCallback() {
    clearTimeout(this.fallback);
    this.observer?.disconnect();
    gsap.ticker.remove(this.tick);
    window.removeEventListener('pointermove', this.onPointer);
    this.triggers?.forEach((trigger) => trigger.kill());
    this.tweens?.forEach((tween) => tween.kill());
    this.scene?.dispose();
  }

  showStill() {
    if (!this.classList.contains('is-live')) this.classList.add('is-still');
  }

  async load() {
    this.started = true;
    try {
      const { LogoScene, REST } = await import('../logo-3d/scene.js');
      if (!this.isConnected) return;
      this.scene = new LogoScene(this.stage);
      await this.scene.loaded;
      this.rest = REST;
      this.animate();
      clearTimeout(this.fallback);
      this.classList.remove('is-still');
      this.classList.add('is-live');
      this.updateTicker();
    } catch (error) {
      console.error(error);
      this.showStill();
    }
  }

  animate() {
    // pose holds offsets from the assembled logo; tick() applies them.
    this.pose = { frameY: 0, frameZ: 0, lineX: 0, lineY: 0, lineTurn: 0, spin: 0, drift: 0, scale: 1, float: 0 };
    this.tilt = { x: 0, y: 0 };
    this.tweens = [];
    this.triggers = [];

    const assemble = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    assemble
      .from(this.pose, { frameY: -1.5, frameZ: -0.6, duration: 1 }, 0)
      .from(this.pose, { lineY: 1.7, lineX: 0.5, lineTurn: -0.45, duration: 1.1, ease: 'back.out(1.5)' }, 0.2)
      .from(this.pose, { spin: -1.3, scale: 0.82, duration: 1.5, ease: 'expo.out' }, 0);
    assemble.progress(1).progress(0);
    this.tweens.push(assemble);

    if (this.mode === 'scroll') {
      this.triggers.push(
        ScrollTrigger.create({ trigger: this, start: 'top 85%', end: 'center 55%', scrub: 1, animation: assemble }),
        ScrollTrigger.create({
          trigger: this,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.5,
          animation: gsap.fromTo(this.pose, { drift: -0.35 }, { drift: 0.35, ease: 'none' }),
        }),
      );
    } else if (this.mode === 'once') {
      // Renders only while the assembly plays.
      assemble.eventCallback('onUpdate', () => this.tick());
      this.triggers.push(ScrollTrigger.create({ trigger: this, start: 'top 90%', once: true, onEnter: () => assemble.play() }));
      this.tick();
      return;
    } else {
      assemble.play();
    }

    // The floating line floats.
    this.tweens.push(gsap.to(this.pose, { float: 0.06, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }));

    if (window.matchMedia('(hover: hover)').matches) {
      this.tiltX = gsap.quickTo(this.tilt, 'x', { duration: 1.2, ease: 'power3.out' });
      this.tiltY = gsap.quickTo(this.tilt, 'y', { duration: 1.2, ease: 'power3.out' });
      window.addEventListener('pointermove', this.onPointer, { passive: true });
    }
  }

  onPointer(event) {
    if (!this.visible) return;
    const box = this.getBoundingClientRect();
    const x = (event.clientX - (box.left + box.width / 2)) / window.innerWidth;
    const y = (event.clientY - (box.top + box.height / 2)) / window.innerHeight;
    this.tiltY(gsap.utils.clamp(-0.5, 0.5, x) * 0.45);
    this.tiltX(gsap.utils.clamp(-0.5, 0.5, y) * 0.3);
  }

  updateTicker() {
    gsap.ticker.remove(this.tick);
    if (this.visible && this.pose && this.mode !== 'once') gsap.ticker.add(this.tick);
  }

  tick() {
    const { frame, line, pivot, tilt } = this.scene;
    const pose = this.pose;
    frame.position.y = pose.frameY;
    frame.position.z = pose.frameZ;
    line.position.x = pose.lineX;
    line.position.y = pose.lineY + pose.float;
    line.rotation.z = pose.lineTurn;
    pivot.rotation.y = this.rest.y + pose.spin + pose.drift;
    pivot.scale.setScalar(pose.scale);
    tilt.rotation.x = this.tilt.x;
    tilt.rotation.y = this.tilt.y;
    this.scene.render();
  }
}

customElements.define('logo-3d', Logo3D);
