// Builds the configuration the two Functions read from their
// $app:function-configuration metafields:
// - Desk bundle (Cart Transform): a price per variant, so prices never come from the cart.
// - Accessory tiers (Discount): the tiers.
import { MATERIALS, FRAME_COLOURS, legacyId, parseFrameSku, parseTopSku } from './skus';

export type Tier = { count: number; percent: number };

export const DEFAULT_TIERS: Tier[] = [
  { count: 1, percent: 5 },
  { count: 3, percent: 10 },
];

export type CatalogVariant = { id: string; sku: string | null; price: string; title: string };
export type CatalogProduct = { id: string; title: string; productType: string; variants: CatalogVariant[] };

export type Component = { price: string; kind: 'top' | 'frame' | 'accessory'; title: string };
export type BundleConfig = { title: string; tiers: Tier[]; components: Record<string, Component> };

const KIND_BY_TYPE: Record<string, Component['kind']> = {
  'Desk top': 'top',
  'Desk frame': 'frame',
  Accessory: 'accessory',
};

function componentTitle(kind: Component['kind'], product: CatalogProduct, variant: CatalogVariant): string {
  if (kind === 'top') {
    const top = parseTopSku(variant.sku);
    if (top) return `${MATERIALS[top.material]?.name ?? top.material}, ${top.widthCm} x ${top.depthCm} cm`;
  }
  if (kind === 'frame') {
    const colour = parseFrameSku(variant.sku);
    if (colour) return `${FRAME_COLOURS[colour]?.name ?? colour} frame`;
  }
  return variant.title === 'Default Title' ? product.title : `${product.title}, ${variant.title}`;
}

export function buildBundleConfig(products: CatalogProduct[], tiers: Tier[] = DEFAULT_TIERS, title = 'Custom desk'): BundleConfig {
  const components: Record<string, Component> = {};
  for (const product of products) {
    const kind = KIND_BY_TYPE[product.productType];
    if (!kind) continue;
    for (const variant of product.variants) {
      components[legacyId(variant.id)] = {
        price: Number(variant.price).toFixed(2),
        kind,
        title: componentTitle(kind, product, variant),
      };
    }
  }
  return { title, tiers: normaliseTiers(tiers), components };
}

export function buildDiscountConfig(tiers: Tier[] = DEFAULT_TIERS) {
  return { tiers: normaliseTiers(tiers), message: 'Desk set: {percent}% off accessories' };
}

/** Sorted by count, whole numbers, no empty tiers. */
export function normaliseTiers(tiers: Tier[]): Tier[] {
  return tiers
    .map((t) => ({ count: Math.max(1, Math.round(Number(t.count))), percent: Math.max(0, Math.min(90, Number(t.percent))) }))
    .filter((t) => t.percent > 0)
    .sort((a, b) => a.count - b.count);
}

/** Size of the configuration in bytes, shown in the app; Functions read it on every cart change, so it stays small. */
export function configSize(config: unknown): number {
  return new TextEncoder().encode(JSON.stringify(config)).length;
}
