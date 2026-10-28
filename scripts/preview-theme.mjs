// Renders theme templates locally with LiquidJS and sample data from
// data/catalog.json, so pages can be checked in a browser before a Shopify
// store exists. It mimics only the Shopify objects, filters and tags this theme
// uses; the real check is still `shopify theme dev` on the development store.
//
// Usage: node scripts/preview-theme.mjs   -> writes preview/out/*.html
import fs from 'node:fs';
import path from 'node:path';
import { Drop, Liquid, Tag } from 'liquidjs';

const THEME = 'theme';
const OUT = 'preview/out';
const read = (file) => fs.readFileSync(path.join(THEME, file), 'utf8');
const readJSON = (file) => JSON.parse(read(file).replace(/^\/\*[\s\S]*?\*\//, ''));

const locale = readJSON('locales/en.default.json');
const catalog = JSON.parse(fs.readFileSync('data/catalog.json', 'utf8'));

// ---------- Sample store data ----------

let nextId = 1000;
const cents = (amount) => Math.round(amount * 100);

// A value that prints as text but also has properties, like Shopify's
// product_option_value (prints its name, has .id, .selected, .available...).
class TextDrop extends Drop {
  constructor(text, props = {}) {
    super();
    this.text = text;
    Object.assign(this, props);
  }
  valueOf() {
    return this.text;
  }
  toString() {
    return this.text;
  }
}

const field = (value) => (value === undefined || value === null ? null : { value });

function specsMetafields(specs = {}, material) {
  const out = {};
  for (const [key, value] of Object.entries(specs)) out[key] = field(value);
  if (material) {
    out.material = field({
      name: field(material.name),
      summary: field(material.summary),
      origin: field(material.origin),
      swatch: field(material.swatch),
    });
  }
  return out;
}

function buildProduct(entry) {
  let variants = entry.variants;
  if (entry.role === 'top') {
    variants = [];
    for (const m of entry.materials) {
      for (const w of entry.widths) {
        for (const d of entry.depths) {
          const sku = `LL-TOP-${m.code}-${w}-${d}`;
          const price = m.base + ((w - entry.widths[0]) / 20) * entry.price_per_20cm_width + (d === 80 ? entry.price_deep : 0);
          variants.push({ options: [m.label, `${w} cm`, `${d} cm`], sku, price, inventory: entry.sold_out.includes(sku) ? 0 : 10 });
        }
      }
    }
  }
  const productId = nextId++;

  // Subscription plans (selling plans) with their discounted prices per variant.
  const groups = entry.selling_plans
    ? [{
        name: entry.selling_plans.group,
        selling_plans: entry.selling_plans.plans.map((plan) => ({
          id: nextId++,
          name: plan.name,
          selected: false,
          price_adjustments: [{ value_type: 'percentage', value: plan.discount_percent }],
          _pct: plan.discount_percent,
        })),
      }]
    : [];

  const vs = variants.map((v) => ({
    id: nextId++,
    sku: v.sku,
    title: v.options.join(' / '),
    options: v.options,
    option1: v.options[0],
    option2: v.options[1] || null,
    option3: v.options[2] || null,
    price: cents(v.price),
    compare_at_price: null,
    available: v.inventory > 0,
    url: `/products/${entry.handle}?variant=${v.sku}`,
    featured_media: null,
    selected_selling_plan_allocation: null,
    selling_plan_allocations: groups.flatMap((g) =>
      g.selling_plans.map((plan) => ({ selling_plan: plan, price: Math.round(cents(v.price) * (1 - plan._pct / 100)) }))
    ),
  }));
  // Rendered product photos; variant_match ties a photo to a SKU or material code.
  const media = (entry.images || []).map((image, i) => ({
    id: productId * 100 + i,
    media_type: 'image',
    src: `/data/images/${image.file}`,
    alt: image.alt,
    width: 1600,
    height: 1600,
    aspect_ratio: 1,
    _match: image.variant_match,
  }));
  for (const v of vs) {
    v.featured_media = media.find((m) => m._match && (m._match === v.sku || v.sku.includes(`-${m._match}-`))) || media[0] || null;
    v.image = v.featured_media;
  }
  const selected = vs.find((v) => v.available) || vs[0];
  const prices = vs.map((v) => v.price);
  const options = entry.options.map((name, i) => {
    const values = [...new Set(vs.map((v) => v.options[i]))].map((label) => {
      const match = vs.filter((v) => v.options[i] === label);
      return new TextDrop(label, {
        id: nextId++,
        selected: selected.options[i] === label,
        available: match.some((v) => v.available),
        swatch: null,
        variant: match[0],
      });
    });
    return { name, position: i + 1, values, selected_value: selected.options[i] };
  });

  return {
    id: productId,
    handle: entry.handle,
    title: entry.title,
    url: `/products/${entry.handle}`,
    description: entry.description || '',
    type: entry.product_type,
    available: vs.some((v) => v.available),
    price: Math.min(...prices),
    price_min: Math.min(...prices),
    price_max: Math.max(...prices),
    price_varies: new Set(prices).size > 1,
    compare_at_price: null,
    featured_image: media[0] || null,
    featured_media: media[0] || null,
    media,
    options: entry.options,
    options_with_values: options,
    variants: vs,
    selected_or_first_available_variant: selected,
    has_only_default_variant: entry.options.length === 1 && entry.options[0] === 'Title',
    selling_plan_groups: groups,
    requires_selling_plan: false,
    metafields: { specs: specsMetafields(entry.specs, entry.material) },
    _note: entry.note,
    _model: entry.model,
  };
}

// Single-material products show the material card; the desk top has several.
for (const entry of catalog.products) {
  if (entry.handle === 'felt-desk-pad') {
    entry.material = {
      name: 'Merino felt',
      summary: 'Pressed merino wool, 3 mm thick. Warm to the touch and quiet under a keyboard.',
      origin: 'Germany',
      swatch: '#3a3e45',
    };
  }
}

const products = Object.fromEntries(catalog.products.map((p) => [p.handle, buildProduct(p)]));
const accessories = Object.values(products).filter((p) => p._model);

// Search & Discovery style filters for the accessories collection.
function filterValue(param, value, label, count, active = false) {
  return { param_name: param, value, label, count, active, url_to_add: '#', url_to_remove: '/collections/accessories', swatch: null };
}
const accessoryFilters = [
  {
    type: 'list',
    label: 'Availability',
    param_name: 'filter.v.availability',
    values: [filterValue('filter.v.availability', '1', 'In stock', 6, true), filterValue('filter.v.availability', '0', 'Out of stock', 1)],
  },
  {
    type: 'list',
    label: 'Category',
    param_name: 'filter.p.m.custom.category',
    values: [
      filterValue('filter.p.m.custom.category', 'organising', 'Organising', 3),
      filterValue('filter.p.m.custom.category', 'screens', 'Screens', 1),
      filterValue('filter.p.m.custom.category', 'comfort', 'Comfort', 1),
    ],
  },
  {
    type: 'price_range',
    label: 'Price',
    param_name: 'filter.v.price',
    min_value: { param_name: 'filter.v.price.gte', value: null },
    max_value: { param_name: 'filter.v.price.lte', value: null },
    range_max: 12900,
    url_to_remove: '/collections/accessories',
  },
];
for (const f of accessoryFilters) f.active_values = (f.values || []).filter((v) => v.active);

const collections = {
  accessories: {
    handle: 'accessories',
    title: 'Accessories',
    url: '/collections/accessories',
    description: '<p>Everything that makes a desk work harder: arms, trays, drawers and pads.</p>',
    products: accessories,
    products_count: accessories.length,
    filters: accessoryFilters,
    sort_by: null,
    default_sort_by: 'manual',
    sort_options: [
      { value: 'manual', name: 'Featured' },
      { value: 'best-selling', name: 'Best selling' },
      { value: 'price-ascending', name: 'Price, low to high' },
      { value: 'price-descending', name: 'Price, high to low' },
    ],
  },
};

const link = (title, url, links = []) => ({ title, url, links, current: false });
const linklists = {
  'main-menu': { links: [link('Build a desk', '/pages/build'), link('Accessories', '/collections/accessories'), link('How it\'s made', '/pages/about'), link('Help', '/pages/faq')] },
  footer: { links: [link('Shipping and delivery', '/policies/shipping-policy'), link('Returns', '/policies/refund-policy'), link('Warranty', '/pages/warranty'), link('Contact', '/pages/contact')] },
};

// Colour settings print as hex and expose .red/.green/.blue, like Shopify's colour object.
class ColorDrop extends Drop {
  constructor(hex) {
    super();
    this.hex = hex;
    this.red = parseInt(hex.slice(1, 3), 16);
    this.green = parseInt(hex.slice(3, 5), 16);
    this.blue = parseInt(hex.slice(5, 7), 16);
  }
  valueOf() {
    return this.hex;
  }
}

function themeSettings() {
  const schema = readJSON('config/settings_schema.json');
  const defaults = {};
  const colors = new Set();
  for (const group of schema) {
    for (const s of group.settings || []) {
      if ('default' in s) defaults[s.id] = s.default;
      if (s.type === 'color') colors.add(s.id);
    }
  }
  const data = readJSON('config/settings_data.json');
  const settings = { ...defaults, ...data.presets[data.current] };
  for (const id of colors) if (settings[id]) settings[id] = new ColorDrop(settings[id]);
  for (const group of schema) {
    for (const def of group.settings || []) {
      if (def.type === 'collection') settings[def.id] = collections[settings[def.id]] || null;
    }
  }
  return settings;
}

// ---------- Liquid engine ----------

const engine = new Liquid({
  root: [path.join(THEME, 'snippets'), path.join(THEME, 'sections')],
  extname: '.liquid',
  ownPropertyOnly: false,
});

// Filters receive keyword arguments as [name, value] pairs.
const kw = (args) => Object.fromEntries(args.filter(Array.isArray));

function translate(key, ...args) {
  const vars = kw(args);
  let value = key.split('.').reduce((obj, part) => (obj ? obj[part] : undefined), locale);
  if (value && typeof value === 'object') value = vars.count === 1 ? value.one : value.other;
  if (typeof value !== 'string') return `translation missing: en.${key}`;
  return value.replace(/{{\s*(\w+)\s*}}/g, (_, name) => (name in vars ? vars[name] : ''));
}

const money = (value) => `$${(Number(value || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const attrs = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => (v === true ? k : `${k}="${String(v).replace(/"/g, '&quot;')}"`))
    .join(' ');

const placeholder = `<svg class="placeholder-svg" viewBox="0 0 525 525" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="525" height="525" fill="#e2e8f0"/><path d="M150 360h225M190 360V230h145v130M220 230v-40h85v40" stroke="#94a3b8" stroke-width="6" fill="none"/></svg>`;

const filters = {
  t: translate,
  money,
  money_with_currency: (v) => `${money(v)} USD`,
  money_without_currency: (v) => (Number(v || 0) / 100).toFixed(2),
  asset_url: (name) => `/theme/assets/${name}`,
  stylesheet_tag: (url) => `<link rel="stylesheet" href="${url}">`,
  preload_tag: (url, ...args) => `<link rel="preload" href="${url}" ${attrs(kw(args))}>`,
  image_url: (image) => (image && image.src) || '',
  image_tag: (url, ...args) => {
    const o = kw(args);
    return `<img ${attrs({ src: url, width: o.width, height: o.height, alt: o.alt || '', loading: o.loading, sizes: o.sizes })}>`;
  },
  placeholder_svg_tag: () => placeholder,
  payment_type_svg_tag: (type) => `<svg viewBox="0 0 38 24" role="img" aria-label="${type}"><rect width="38" height="24" rx="3" fill="#fff"/><text x="19" y="15" font-size="6" text-anchor="middle" fill="#0b1220">${type.slice(0, 6)}</text></svg>`,
  default_errors: () => '',
  link_to: (text, url) => `<a href="${url}">${text}</a>`,
  time_tag: (date) => `<time>${date}</time>`,
  format_code: (code) => code,
  handle: (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  payment_button: () => '',
  json: (v) => JSON.stringify(v === undefined ? null : v),
  metafield_text: (m) => {
    const v = m && m.value;
    if (v && typeof v === 'object' && 'unit' in v) return `${v.value} ${v.unit}`;
    return v === undefined || v === null ? '' : String(v);
  },
  newline_to_br: (text) => String(text || '').replace(/\n/g, '<br>'),
  url_encode: (text) => encodeURIComponent(String(text || '')),
};
for (const [name, fn] of Object.entries(filters)) engine.registerFilter(name, fn);

// {% schema %} ... {% endschema %}: skipped when rendering.
engine.registerTag(
  'schema',
  class extends Tag {
    constructor(token, remain, liquid) {
      super(token, remain, liquid);
      while (remain.length) if (remain.shift().name === 'endschema') return;
    }
    *render() {}
  }
);

// Block tags that render their body with an extra variable.
function blockTag(name, end, open) {
  engine.registerTag(
    name,
    class extends Tag {
      constructor(token, remain, liquid) {
        super(token, remain, liquid);
        this.args = token.args;
        this.templates = [];
        const stream = liquid.parser.parseStream(remain).on(`tag:${end}`, () => stream.stop()).on('template', (tpl) => this.templates.push(tpl)).on('end', () => {
          throw new Error(`${name} not closed`);
        });
        stream.start();
      }
      *render(ctx, emitter) {
        const [before, scope] = open(this.args, ctx);
        ctx.push(scope);
        emitter.write(before);
        yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
        emitter.write(name === 'form' ? '</form>' : '');
        ctx.pop();
      }
    }
  );
}

blockTag('form', 'endform', (args) => {
  const type = (args.match(/'([^']+)'/) || [])[1];
  const extra = {};
  for (const [, key, value] of args.matchAll(/([\w-]+):\s*'([^']*)'/g)) extra[key] = value === '' ? true : value;
  const action = type === 'product' ? 'cart/add' : type;
  return [`<form method="post" action="/${action}" ${attrs(extra)}>`, { form: { errors: null, 'posted_successfully?': false } }];
});
blockTag('paginate', 'endpaginate', () => ['', { paginate: { pages: 1, current_page: 1, parts: [] } }]);

// ---------- Sections ----------

function sectionSchema(type) {
  const source = read(`sections/${type}.liquid`);
  const match = source.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
  return match ? JSON.parse(match[1]) : {};
}

// Turns setting values the way Shopify does: product handles into products, etc.
function resolveSettings(definitions = [], values = {}) {
  const settings = {};
  for (const def of definitions) {
    if (!def.id) continue;
    let value = def.id in values ? values[def.id] : def.default;
    if (def.type === 'product') value = products[value] || null;
    if (def.type === 'collection') value = collections[value] || null;
    if (def.type === 'link_list') value = linklists[value] || null;
    settings[def.id] = value === undefined ? null : value;
  }
  return settings;
}

async function renderSection(type, id, data = {}, scope = {}) {
  const schema = sectionSchema(type);
  const blockOrder = data.block_order || Object.keys(data.blocks || {});
  const blocks = blockOrder.map((blockId) => {
    const block = data.blocks[blockId];
    const def = (schema.blocks || []).find((b) => b.type === block.type) || {};
    return { id: blockId, type: block.type, settings: resolveSettings(def.settings, block.settings), shopify_attributes: '' };
  });
  const section = { id, settings: resolveSettings(schema.settings, data.settings), blocks };
  const html = await engine.parseAndRender(read(`sections/${type}.liquid`), { ...scope, section }, { globals: scope });
  return `<div id="shopify-section-${id}" class="shopify-section">${html}</div>`;
}

async function renderGroup(name, scope) {
  const group = readJSON(`sections/${name}.json`);
  const parts = [];
  for (const key of group.order) parts.push(await renderSection(group.sections[key].type, `${name}-${key}`, group.sections[key], scope));
  return parts.join('\n');
}

engine.registerTag(
  'section',
  class extends Tag {
    constructor(token, remain, liquid) {
      super(token, remain, liquid);
      this.type = token.args.replace(/['"\s]/g, '');
    }
    *render(ctx, emitter) {
      emitter.write(yield renderSection(this.type, this.type, {}, ctx.getAll()));
    }
  }
);

engine.registerTag(
  'sections',
  class extends Tag {
    constructor(token, remain, liquid) {
      super(token, remain, liquid);
      this.group = token.args.replace(/['"\s]/g, '');
    }
    *render(ctx, emitter) {
      emitter.write(yield renderGroup(this.group, ctx.getAll()));
    }
  }
);

// ---------- Pages ----------

async function renderPage(templateName, outName, extra = {}) {
  const template = readJSON(`templates/${templateName}.json`);
  const settings = themeSettings();
  const scope = {
    shop: {
      name: 'Loftline Studio',
      url: '/',
      description: 'Modular standing desks, built to your size.',
      customer_accounts_enabled: true,
      enabled_payment_types: ['visa', 'master', 'american_express', 'paypal', 'apple_pay', 'google_pay', 'shopify_pay'],
      currency: 'USD',
    },
    settings,
    routes: {
      root_url: '/', cart_url: '/cart', cart_add_url: '/cart/add', cart_change_url: '/cart/change', cart_update_url: '/cart/update',
      search_url: '/search', account_url: '/account', collections_url: '/collections', all_products_collection_url: '/collections/all',
    },
    cart: extra.cart || emptyCart(),
    request: { locale: { iso_code: 'en' }, page_type: extra.page_type || templateName.split('.')[0], design_mode: false, origin: 'http://localhost:5178' },
    localization: {
      country: { iso_code: 'US' },
      language: { iso_code: 'en' },
      available_countries: [
        { iso_code: 'US', name: 'United States', currency: { iso_code: 'USD', symbol: '$' } },
        { iso_code: 'CA', name: 'Canada', currency: { iso_code: 'CAD', symbol: '$' } },
        { iso_code: 'GB', name: 'United Kingdom', currency: { iso_code: 'GBP', symbol: '£' } },
      ],
      available_languages: [
        { iso_code: 'en', endonym_name: 'English' },
        { iso_code: 'fr', endonym_name: 'français' },
      ],
    },
    linklists,
    collections,
    template: { name: templateName.split('.')[0] },
    canonical_url: `http://localhost:5178/${outName}`,
    page_title: extra.page_title || 'Loftline Studio',
    current_page: 1,
    content_for_header: '',
    ...extra.scope,
  };

  const sections = [];
  for (const key of template.order) sections.push(await renderSection(template.sections[key].type, key, template.sections[key], scope));

  const layout = read(`layout/${template.layout || 'theme'}.liquid`);
  const html = await engine.parseAndRender(layout, { ...scope, content_for_layout: sections.join('\n') }, { globals: scope });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${outName}.html`), html);
  console.log(`preview/out/${outName}.html`);
}

const emptyCart = () => ({ item_count: 0, items: [], total_price: 0, currency: { iso_code: 'USD' }, cart_level_discount_applications: [] });

// A cart with one desk build (added as separate parts) and a loose accessory.
function sampleCart() {
  const top = products['desk-top'].variants.find((v) => v.sku === 'LL-TOP-OAK-160-80');
  const frame = products['dual-motor-frame'].variants[0];
  const build = 'LL-7K2QD';
  const line = (product, variant, properties, quantity = 1) => ({
    key: `${variant.id}:${Math.random().toString(16).slice(2, 10)}`,
    product,
    product_id: product.id,
    variant,
    title: product.title,
    url: product.url,
    image: variant.featured_media,
    quantity,
    properties,
    original_line_price: variant.price * quantity,
    final_line_price: variant.price * quantity,
    selling_plan_allocation: null,
  });
  const shared = { Build: build, _build: build };
  const items = [
    line(products['desk-top'], top, { ...shared, Size: '160 cm × 80 cm', Edge: 'Rounded', _role: 'top' }),
    line(products['dual-motor-frame'], frame, { ...shared, _role: 'frame' }),
    line(products['monitor-arm'], products['monitor-arm'].variants[0], { ...shared, _role: 'accessory' }),
    line(products['felt-desk-pad'], products['felt-desk-pad'].variants[0], {}),
  ];
  return {
    items,
    item_count: items.reduce((n, i) => n + i.quantity, 0),
    total_price: items.reduce((n, i) => n + i.final_line_price, 0),
    currency: { iso_code: 'USD' },
    cart_level_discount_applications: [],
  };
}

await renderPage('index', 'index', { page_title: 'Loftline Studio' });
await renderPage('product', 'product', { page_title: 'Felt desk pad', scope: { product: products['felt-desk-pad'] } });
await renderPage('product', 'product-frame', { page_title: 'Dual-motor frame', scope: { product: products['dual-motor-frame'] } });
await renderPage('collection', 'collection', { page_title: 'Accessories', scope: { collection: collections.accessories } });
await renderPage('page.build', 'cart-drawer', { page_type: 'page', page_title: 'Build your desk', cart: sampleCart() });
await renderPage('page.build', 'build', { page_type: 'page', page_title: 'Build your desk' });
