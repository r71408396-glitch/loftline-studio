// Turns data/catalog.json, data/metafields.json and data/pages.json into
// Admin API inputs. Pure functions: no network, so they're unit tested, and the
// return types are the generated Admin API input types, so TypeScript checks
// every field name against the schema.
import type { ProductSetInput, SellingPlanGroupInput } from '../types/admin.types';

// The generated types use TypeScript enums; accept their string values too.
export type Plain<T> = T extends (infer U)[]
  ? Plain<U>[]
  : T extends string
    ? `${T}`
    : T extends object
      ? { [K in keyof T]: Plain<T[K]> }
      : T;

export type CatalogVariant = {
  options: string[];
  sku: string;
  price: number;
  inventory: number | null;
  requires_shipping?: boolean;
};
export type CatalogImage = { file: string; alt: string; variant_match?: string };
export type CatalogProduct = {
  handle: string;
  title: string;
  role: string;
  product_type: string;
  description?: string;
  options: string[];
  variants?: CatalogVariant[];
  materials?: { label: string; code: string; base: number }[];
  widths?: number[];
  depths?: number[];
  price_per_20cm_width?: number;
  price_deep?: number;
  sold_out?: string[];
  specs?: Record<string, unknown>;
  material?: string;
  images?: CatalogImage[];
  selling_plans?: { group: string; plans: { name: string; interval: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'; count: number; discount_percent: number }[] };
};
export type Catalog = { currency: string; products: CatalogProduct[] };

/** The desk top's 40 variants are generated from materials x widths x depths. */
export function catalogVariants(product: CatalogProduct): CatalogVariant[] {
  if (product.role !== 'top') return product.variants ?? [];
  const variants: CatalogVariant[] = [];
  const widths = product.widths ?? [];
  for (const m of product.materials ?? []) {
    for (const w of widths) {
      for (const d of product.depths ?? []) {
        const sku = `LL-TOP-${m.code}-${w}-${d}`;
        const price = m.base + ((w - widths[0]) / 20) * (product.price_per_20cm_width ?? 0) + (d === 80 ? product.price_deep ?? 0 : 0);
        variants.push({ options: [m.label, `${w} cm`, `${d} cm`], sku, price, inventory: product.sold_out?.includes(sku) ? 0 : 10 });
      }
    }
  }
  return variants;
}

const UNITS: Record<string, string> = { kg: 'KILOGRAMS', g: 'GRAMS', lb: 'POUNDS', oz: 'OUNCES' };
const SPEC_TYPES: Record<string, string> = {
  dimensions: 'single_line_text_field',
  height_range: 'single_line_text_field',
  load_capacity: 'weight',
  weight: 'weight',
  assembly_minutes: 'number_integer',
  warranty_years: 'number_integer',
  lead_time_days: 'number_integer',
  care: 'multi_line_text_field',
};

export function specMetafields(specs: Record<string, unknown> = {}) {
  return Object.entries(specs)
    .filter(([key, value]) => SPEC_TYPES[key] && value !== null && value !== undefined)
    .map(([key, value]) => {
      const type = SPEC_TYPES[key];
      let text: string;
      if (type === 'weight') {
        const w = value as { value: number; unit: string };
        text = JSON.stringify({ value: w.value, unit: UNITS[w.unit] ?? w.unit });
      } else {
        text = String(value);
      }
      return { namespace: 'specs', key, type, value: text };
    });
}

type SetupContext = {
  locationId: string;
  /** Uploaded image URLs by file name; null skips images (re-runs keep existing media). */
  imageUrls: Map<string, string> | null;
  /** Metaobject IDs of materials by handle, for the specs.material reference. */
  materialIds: Map<string, string>;
};

/** One productSet input per catalogue product. */
export function productSetInput(product: CatalogProduct, ctx: SetupContext): Plain<ProductSetInput> {
  const variants = catalogVariants(product);
  const optionNames = product.options;
  const images = ctx.imageUrls ? (product.images ?? []).filter((image) => ctx.imageUrls!.has(image.file)) : [];

  const imageFor = (sku: string) => {
    const image = images.find((i) => i.variant_match && (i.variant_match === sku || sku.includes(`-${i.variant_match}-`)));
    return image ? { originalSource: ctx.imageUrls!.get(image.file)!, alt: image.alt, contentType: 'IMAGE' as const } : undefined;
  };

  const metafields = specMetafields(product.specs);
  if (product.material && ctx.materialIds.has(product.material)) {
    metafields.push({ namespace: 'specs', key: 'material', type: 'metaobject_reference', value: ctx.materialIds.get(product.material)! });
  }
  // The bundle line and the assembly service are only added by the configurator and the checkout,
  // so they stay out of storefront search and the sitemap.
  if (product.product_type === 'Desk' || product.product_type === 'Service') {
    metafields.push({ namespace: 'seo', key: 'hidden', type: 'number_integer', value: '1' });
  }

  return {
    handle: product.handle,
    title: product.title,
    productType: product.product_type,
    vendor: 'Loftline Studio',
    status: 'ACTIVE',
    descriptionHtml: product.description ?? '',
    productOptions: optionNames.map((name, i) => ({
      name,
      position: i + 1,
      values: [...new Set(variants.map((v) => v.options[i]))].map((value) => ({ name: value })),
    })),
    variants: variants.map((v) => {
      const tracked = v.inventory !== null;
      const file = imageFor(v.sku);
      return {
        optionValues: v.options.map((value, i) => ({ optionName: optionNames[i], name: value })),
        price: v.price.toFixed(2),
        inventoryPolicy: 'DENY',
        inventoryItem: { sku: v.sku, tracked, requiresShipping: v.requires_shipping ?? true },
        ...(tracked ? { inventoryQuantities: [{ locationId: ctx.locationId, name: 'available', quantity: v.inventory as number }] } : {}),
        ...(file ? { file } : {}),
      };
    }),
    metafields,
    ...(images.length
      ? { files: images.map((image) => ({ originalSource: ctx.imageUrls!.get(image.file)!, alt: image.alt, contentType: 'IMAGE' as const })) }
      : {}),
  };
}

/** Plain text to Shopify's rich text JSON (one paragraph). */
export function richText(text: string) {
  return JSON.stringify({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: text }] }] });
}

/** Selling plan group for a subscribable product: same options as the theme shows. */
export function sellingPlanGroupInput(product: CatalogProduct): Plain<SellingPlanGroupInput> {
  const group = product.selling_plans!;
  return {
    name: group.group,
    merchantCode: `loftline-${product.handle}`,
    options: ['Delivery every'],
    sellingPlansToCreate: group.plans.map((plan, i) => ({
      name: plan.name,
      options: [`${plan.count} ${plan.interval === 'MONTH' ? 'months' : plan.interval.toLowerCase()}`],
      category: 'SUBSCRIPTION',
      position: i + 1,
      billingPolicy: { recurring: { interval: plan.interval, intervalCount: plan.count } },
      deliveryPolicy: { recurring: { interval: plan.interval, intervalCount: plan.count } },
      pricingPolicies: [{ fixed: { adjustmentType: 'PERCENTAGE', adjustmentValue: { percentage: plan.discount_percent } } }],
    })),
  };
}
