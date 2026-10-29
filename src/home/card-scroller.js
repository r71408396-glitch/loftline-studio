// <card-scroller>: a row of cards that scrolls sideways (touch, trackpad or
// the previous / next buttons). The buttons disable at either end.
class CardScroller extends HTMLElement {
  connectedCallback() {
    // Set up once: moving the element in the page (GSAP pinning does) connects it again.
    if (this.ready) return;
    this.ready = true;
    this.track = this.querySelector('[data-track]');
    this.prev = this.querySelector('[data-prev]');
    this.next = this.querySelector('[data-next]');
    if (!this.track) return;
    this.prev?.addEventListener('click', () => this.go(-1));
    this.next?.addEventListener('click', () => this.go(1));
    this.track.addEventListener('scroll', () => this.update(), { passive: true });
    new ResizeObserver(() => this.update()).observe(this.track);
    this.update();
  }

  go(direction) {
    const card = this.track.firstElementChild;
    const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
    const step = card ? card.getBoundingClientRect().width + gap : this.track.clientWidth;
    this.track.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  update() {
    const { scrollLeft, scrollWidth, clientWidth } = this.track;
    const scrollable = scrollWidth > clientWidth + 2;
    this.toggleAttribute('data-scrollable', scrollable);
    if (this.prev) this.prev.disabled = scrollLeft < 4;
    if (this.next) this.next.disabled = scrollLeft + clientWidth > scrollWidth - 4;
  }
}

customElements.define('card-scroller', CardScroller);
