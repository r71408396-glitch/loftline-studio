import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { catalogVariants, productSetInput, richText, sellingPlanGroupInput, specMetafields, type Catalog } from './catalog';

const catalog: Catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../data/catalog.json'), 'utf8'));
const product = (handle: string) => catalog.products.find((p) => p.handle === handle)!;
const ctx = (withImages: boolean) => ({
  locationId: 'gid://shopify/Location/1',
  imageUrls: withImages ? new Map(catalog.products.flatMap((p) => (p.images ?? []).map((i) => [i.file, `https://up/${i.file}`] as [string, string]))) : null,
  materialIds: new Map([['merino-felt', 'gid://shopify/Metaobject/9']]),
});

describe('catalogue to Admin API inputs', () => {
  test('desk top: 40 variants from materials x widths x depths, one sold out', () => {
    const variants = catalogVariants(product('desk-top'));
    expect(variants).toHaveLength(40);
    expect(variants.find((v) => v.sku === 'LL-TOP-OAK-160-80')).toMatchObject({ price: 409, options: ['Oak', '160 cm', '80 cm'] });
    expect(variants.find((v) => v.sku === 'LL-TOP-WAL-180-80')?.inventory).toBe(0);
  });

  test('every variant has a SKU, a price and option values that exist on the product', () => {
    for (const p of catalog.products) {
      const input = productSetInput(p, ctx(false));
      const options = new Map(input.productOptions!.map((o) => [o.name, new Set(o.values!.map((v) => v.name))]));
      for (const v of input.variants!) {
        expect(v.inventoryItem?.sku).toMatch(/^LL-/);
        expect(Number(v.price)).toBeGreaterThan(0);
        for (const ov of v.optionValues) expect(options.get(ov.optionName!)?.has(ov.name!)).toBe(true);
      }
    }
  });

  test('stock only for tracked items; services and the desk bundle are untracked', () => {
    const assembly = productSetInput(product('assembly-at-home'), ctx(false)).variants![0];
    expect(assembly.inventoryItem).toMatchObject({ tracked: false, requiresShipping: false });
    expect(assembly.inventoryQuantities).toBeUndefined();
    const frame = productSetInput(product('dual-motor-frame'), ctx(false)).variants![0];
    expect(frame.inventoryQuantities).toEqual([{ locationId: 'gid://shopify/Location/1', name: 'available', quantity: 40 }]);
  });

  test('photos go on the product and the matching variant; none on re-runs without images', () => {
    const top = productSetInput(product('desk-top'), ctx(true));
    expect(top.files).toHaveLength(6);
    expect(top.variants!.find((v) => v.inventoryItem?.sku === 'LL-TOP-WAL-140-70')?.file?.originalSource).toBe('https://up/top-walnut.webp');
    expect(productSetInput(product('desk-top'), ctx(false)).files).toBeUndefined();
  });

  test('specs become typed metafields, weights in Shopify units, material as a reference', () => {
    expect(specMetafields({ weight: { value: 34, unit: 'kg' }, assembly_minutes: 25 })).toEqual([
      { namespace: 'specs', key: 'weight', type: 'weight', value: '{"value":34,"unit":"KILOGRAMS"}' },
      { namespace: 'specs', key: 'assembly_minutes', type: 'number_integer', value: '25' },
    ]);
    const pad = productSetInput(product('felt-desk-pad'), ctx(false));
    expect(pad.metafields).toContainEqual({ namespace: 'specs', key: 'material', type: 'metaobject_reference', value: 'gid://shopify/Metaobject/9' });
  });

  test('the desk bundle and the assembly service are hidden from storefront search, parts are not', () => {
    const hidden = { namespace: 'seo', key: 'hidden', type: 'number_integer', value: '1' };
    expect(productSetInput(product('custom-desk'), ctx(false)).metafields).toContainEqual(hidden);
    expect(productSetInput(product('assembly-at-home'), ctx(false)).metafields).toContainEqual(hidden);
    expect(productSetInput(product('desk-top'), ctx(false)).metafields).not.toContainEqual(hidden);
  });

  test('refill subscriptions: three plans at 10% off', () => {
    const group = sellingPlanGroupInput(product('cable-kit'));
    expect(group.merchantCode).toBe('loftline-cable-kit');
    expect(group.sellingPlansToCreate!.map((p) => p.options![0])).toEqual(['3 months', '6 months', '12 months']);
    expect(group.sellingPlansToCreate![0].pricingPolicies![0].fixed?.adjustmentValue?.percentage).toBe(10);
  });

  test('rich text answer format', () => {
    expect(JSON.parse(richText('Yes.'))).toEqual({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Yes.' }] }] });
  });
});
