// Desk configurator: reads the choices, finds the matching variants, shows the
// price and build summary, drives the 3D viewer and adds the build to the cart.

// SKU codes -> 3D viewer presets.
const TOPS = { oak: 'oak', wal: 'walnut', bam: 'bamboo', wht: 'white', lin: 'linoleum' };
const FRAMES = { blk: 'black', wht: 'white', gra: 'graphite', alu: 'aluminium' };

class DeskConfigurator extends HTMLElement {
  connectedCallback() {
    this.data = JSON.parse(this.querySelector('[data-config-data]').textContent);
    this.strings = this.data.strings;
    this.form = this.querySelector('[data-config-form]');
    this.money = new Intl.NumberFormat(this.data.locale, { style: 'currency', currency: this.data.currency });

    // "LL-TOP-OAK-160-80" -> "oak-160-80"; "LL-FRM-BLK" -> "blk"
    this.tops = new Map(this.data.tops.map((v) => [v.sku.toLowerCase().split('-').slice(2).join('-'), v]));
    this.frames = new Map(this.data.frames.map((v) => [v.sku.toLowerCase().split('-').slice(2).join('-'), v]));
    this.height = 0.74;

    this.restoreFromHash();
    this.form.addEventListener('change', () => this.update());
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.addToCart();
    });
    this.querySelector('[data-sticky-add]').addEventListener('click', () => this.addToCart());
    this.querySelector('[data-reset-view]').addEventListener('click', () => this.viewer && this.viewer.resetView());
    this.querySelectorAll('[data-height]').forEach((button) => {
      button.addEventListener('click', () => this.setHeight(Number(button.dataset.height)));
    });
    this.querySelector('[data-share]').addEventListener('click', () => this.share());

    this.update();
    this.loadViewerWhenVisible();
    this.watchSticky();
  }

  // ---------- Selection ----------

  selection() {
    const form = new FormData(this.form);
    return {
      material: form.get('material'),
      width: form.get('width'),
      depth: form.get('depth'),
      edge: form.get('edge') || 'square',
      frame: form.get('frame'),
      accessories: form.getAll('accessory').filter((id) => this.data.accessories[id]),
    };
  }

  label(name) {
    const input = this.form.querySelector(`input[name="${name}"]:checked`);
    return input ? input.dataset.label : '';
  }

  topVariant(s) {
    return this.tops.get(`${s.material}-${s.width}-${s.depth}`);
  }

  // Marks choices that would lead to a missing or sold-out part.
  markAvailability(s) {
    const check = (name, test) => {
      this.form.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
        const ok = test(input.value);
        input.closest('label').classList.toggle('is-unavailable', !ok);
      });
    };
    const topOk = (overrides) => {
      const variant = this.topVariant({ ...s, ...overrides });
      return Boolean(variant && variant.available);
    };
    check('material', (value) => topOk({ material: value }));
    check('width', (value) => topOk({ width: value }));
    check('depth', (value) => topOk({ depth: value }));
    check('frame', (value) => Boolean(this.frames.get(value) && this.frames.get(value).available));
  }

  // ---------- Pricing ----------

  price(s) {
    const top = this.topVariant(s);
    const frame = this.frames.get(s.frame);
    const accessories = s.accessories.map((id) => ({ blockId: id, ...this.data.accessories[id] }));
    const accessoryTotal = accessories.reduce((sum, a) => sum + a.price, 0);

    // Highest tier reached by the number of accessories.
    const tiers = [...this.data.tiers].filter((t) => t.percent > 0).sort((a, b) => a.count - b.count);
    const reached = tiers.filter((t) => accessories.length >= t.count).pop();
    const next = tiers.find((t) => accessories.length < t.count);
    const discount = reached ? Math.round((accessoryTotal * reached.percent) / 100) : 0;

    const subtotal = (top ? top.price : 0) + (frame ? frame.price : 0) + accessoryTotal;
    return {
      top,
      frame,
      accessories,
      reached,
      next,
      discount,
      total: subtotal - discount,
      available: Boolean(top && top.available && frame && frame.available),
    };
  }

  format(cents) {
    return this.money.format(cents / 100);
  }

  // ---------- Rendering ----------

  update() {
    const s = this.selection();
    const p = this.price(s);
    this.markAvailability(s);

    for (const name of ['material', 'width', 'depth', 'edge', 'frame']) {
      const target = this.querySelector(`[data-config-label="${name}"]`);
      if (target) target.textContent = this.label(name);
    }

    // Build summary
    const lines = [];
    const sizeText = `${this.label('width')} × ${this.label('depth')}`;
    lines.push([`${this.strings.top}: ${this.label('material')}`, `${sizeText}, ${this.label('edge').toLowerCase()}`, p.top ? p.top.price : null, p.top && !p.top.available]);
    lines.push([`${this.strings.frame}: ${this.label('frame')}`, this.data.frameTitle, p.frame ? p.frame.price : null, p.frame && !p.frame.available]);
    for (const a of p.accessories) lines.push([a.title, '', a.price, !a.available]);

    const list = this.querySelector('[data-summary-lines]');
    list.replaceChildren(
      ...lines.map(([title, detail, cents, soldOut]) => {
        const li = document.createElement('li');
        li.className = 'config-summary__line';
        const text = document.createElement('span');
        text.innerHTML = '<span class="config-summary__name"></span><span class="config-summary__detail small muted"></span>';
        text.children[0].textContent = title;
        text.children[1].textContent = detail;
        const price = document.createElement('span');
        price.className = 'config-summary__price' + (soldOut ? ' status-error' : '');
        price.textContent = soldOut || cents === null ? this.strings.soldOut : this.format(cents);
        li.append(text, price);
        return li;
      })
    );
    if (p.discount > 0) {
      const li = document.createElement('li');
      li.className = 'config-summary__line config-summary__line--discount';
      li.innerHTML = '<span></span><span class="config-summary__price"></span>';
      li.children[0].textContent = this.strings.discount.replace('{percent}', p.reached.percent);
      li.children[1].textContent = `−${this.format(p.discount)}`;
      list.append(li);
    }

    // Discount tier nudge
    const tier = this.querySelector('[data-tier]');
    if (p.next) {
      tier.textContent = this.strings.tierNext
        .replace('{count}', p.next.count - p.accessories.length)
        .replace('{percent}', p.next.percent);
      tier.hidden = false;
      tier.classList.remove('is-reached');
    } else if (p.reached) {
      tier.textContent = this.strings.tierReached.replace('{percent}', p.reached.percent);
      tier.hidden = false;
      tier.classList.add('is-reached');
    } else {
      tier.hidden = true;
    }

    const total = this.format(p.total);
    this.querySelector('[data-total]').textContent = total;
    this.querySelector('[data-sticky-total]').textContent = total;

    const addButtons = this.querySelectorAll('[data-add], [data-sticky-add]');
    addButtons.forEach((button) => {
      button.disabled = !p.available;
      button.textContent = p.available ? this.strings.add : this.strings.soldOut;
    });

    this.current = { s, p };
    this.writeHash(s);
    this.syncViewer();
  }

  viewerConfig() {
    const { s } = this.current;
    const accessories = {};
    for (const id of s.accessories) {
      const model = this.data.accessories[id].model;
      if (model && model !== 'none') accessories[model] = true;
    }
    return {
      width: Number(s.width) / 100,
      depth: Number(s.depth) / 100,
      height: this.height,
      top: TOPS[s.material] || 'oak',
      frame: FRAMES[s.frame] || 'black',
      edge: s.edge,
      accessories,
    };
  }

  syncViewer() {
    if (this.viewer && this.current) this.viewer.set(this.viewerConfig());
  }

  setHeight(height) {
    this.height = height;
    this.querySelectorAll('[data-height]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.height) === height));
    });
    this.syncViewer();
  }

  // ---------- 3D viewer ----------

  loadViewerWhenVisible() {
    const stage = this.querySelector('[data-viewer]');
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
        idle(() => this.loadViewer(stage));
      },
      { rootMargin: '200px' }
    );
    observer.observe(stage);
  }

  async loadViewer(stage) {
    try {
      const { DeskViewer } = await import(this.dataset.viewerSrc);
      this.viewer = new DeskViewer(stage);
      this.viewer.set(this.viewerConfig(), { instant: true });
      stage.classList.add('is-loaded');
    } catch (error) {
      stage.classList.add('is-failed');
      console.error(error);
    }
  }

  // ---------- Cart ----------

  async addToCart() {
    const { s, p } = this.current;
    if (!p.available || this.busy) return;
    this.busy = true;
    const buttons = this.querySelectorAll('[data-add], [data-sticky-add]');
    buttons.forEach((button) => {
      button.disabled = true;
      button.textContent = this.strings.adding;
    });
    const error = this.querySelector('[data-error]');
    error.hidden = true;

    const build = `LL-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const size = `${this.label('width')} × ${this.label('depth')}`;
    let items;

    if (this.data.mode === 'bundle' && this.data.bundleVariant) {
      // One line; the Cart Transform Function expands it into the parts.
      items = [
        {
          id: this.data.bundleVariant,
          quantity: 1,
          properties: {
            [this.strings.build]: build,
            [this.strings.top]: this.label('material'),
            [this.strings.size]: size,
            [this.strings.edge]: this.label('edge'),
            [this.strings.frame]: this.label('frame'),
            _build: build,
            _edge: s.edge,
            _top: String(p.top.id),
            _frame: String(p.frame.id),
            _accessories: p.accessories.map((a) => a.id).join(','),
          },
        },
      ];
    } else {
      // Separate lines sharing a build ID, so the cart can group them.
      const shared = { [this.strings.build]: build, _build: build };
      items = [
        { id: p.top.id, quantity: 1, properties: { ...shared, [this.strings.size]: size, [this.strings.edge]: this.label('edge'), _role: 'top', _edge: s.edge } },
        { id: p.frame.id, quantity: 1, properties: { ...shared, _role: 'frame' } },
        ...p.accessories.map((a) => ({ id: a.id, quantity: 1, properties: { ...shared, _role: 'accessory' } })),
      ];
    }

    const drawer = document.querySelector('cart-drawer');
    try {
      const response = await fetch(`${window.theme.routes.cartAdd}.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items,
          sections: drawer ? drawer.sectionIds : undefined,
          sections_url: window.location.pathname,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.description || result.message || this.strings.error);

      if (drawer) {
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: { sections: result.sections, open: true, source: 'configurator' } }));
      } else {
        window.location.href = window.theme.routes.cart;
      }
    } catch (err) {
      error.textContent = err.message || this.strings.error;
      error.hidden = false;
    } finally {
      this.busy = false;
      this.update();
    }
  }

  // ---------- Share link and sticky bar ----------

  writeHash(s) {
    const params = new URLSearchParams({ m: s.material, w: s.width, d: s.depth, e: s.edge, f: s.frame });
    if (s.accessories.length) params.set('a', s.accessories.join('.'));
    history.replaceState(null, '', `#${params}`);
  }

  restoreFromHash() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const set = (name, value) => {
      if (!value) return;
      const input = this.form.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
      if (input) input.checked = true;
    };
    set('material', params.get('m'));
    set('width', params.get('w'));
    set('depth', params.get('d'));
    set('edge', params.get('e'));
    set('frame', params.get('f'));
    for (const id of (params.get('a') || '').split('.').filter(Boolean)) {
      const input = this.form.querySelector(`input[name="accessory"][value="${CSS.escape(id)}"]`);
      if (input && !input.disabled) input.checked = true;
    }
  }

  async share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      const done = this.querySelector('[data-share-done]');
      done.hidden = false;
      setTimeout(() => (done.hidden = true), 2500);
    } catch (error) {
      window.prompt('', window.location.href);
    }
  }

  // On phones, a bar with the total stays at the bottom until the summary is in view.
  watchSticky() {
    const sticky = this.querySelector('[data-sticky]');
    const summary = this.querySelector('[data-summary]');
    let inSection = false;
    let summaryVisible = false;
    const apply = () => {
      const show = inSection && !summaryVisible;
      sticky.classList.toggle('is-visible', show);
      sticky.setAttribute('aria-hidden', String(!show));
      sticky.querySelector('button').tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(([entry]) => {
      inSection = entry.isIntersecting;
      apply();
    }).observe(this);
    new IntersectionObserver(([entry]) => {
      summaryVisible = entry.isIntersecting;
      apply();
    }).observe(summary);
  }
}

customElements.define('desk-configurator', DeskConfigurator);
