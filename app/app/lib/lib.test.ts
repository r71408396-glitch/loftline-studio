import { describe, expect, test } from 'vitest';
import { buildBundleConfig, buildDiscountConfig, normaliseTiers, type CatalogProduct } from './price-table';
import { buildSheet, buildsFromLineItems, type OrderLineItem } from './builds';
import { nextStage, stageTag, tagChanges } from './stages';
import { parseTopSku } from './skus';
import { renderBuildSheetPdf } from './build-sheet-pdf';

const products: CatalogProduct[] = [
  {
    id: 'gid://shopify/Product/1',
    title: 'Desk top',
    productType: 'Desk top',
    variants: [{ id: 'gid://shopify/ProductVariant/101', sku: 'LL-TOP-OAK-160-80', price: '409.0', title: 'Oak / 160 cm / 80 cm' }],
  },
  {
    id: 'gid://shopify/Product/2',
    title: 'Dual-motor frame',
    productType: 'Desk frame',
    variants: [{ id: 'gid://shopify/ProductVariant/201', sku: 'LL-FRM-BLK', price: '549', title: 'Black' }],
  },
  {
    id: 'gid://shopify/Product/3',
    title: 'Felt desk pad',
    productType: 'Accessory',
    variants: [{ id: 'gid://shopify/ProductVariant/301', sku: 'LL-ACC-PAD-GRA', price: '49.00', title: 'Graphite' }],
  },
  {
    id: 'gid://shopify/Product/4',
    title: 'Gift card',
    productType: 'Gift card',
    variants: [{ id: 'gid://shopify/ProductVariant/401', sku: null, price: '50.00', title: 'Default Title' }],
  },
];

describe('price table for the Functions', () => {
  test('prices every desk part by variant ID and skips other products', () => {
    const config = buildBundleConfig(products);
    expect(config.components).toEqual({
      '101': { price: '409.00', kind: 'top', title: 'Oak, 160 x 80 cm' },
      '201': { price: '549.00', kind: 'frame', title: 'Black frame' },
      '301': { price: '49.00', kind: 'accessory', title: 'Felt desk pad, Graphite' },
    });
    expect(config.tiers).toEqual([
      { count: 1, percent: 5 },
      { count: 3, percent: 10 },
    ]);
  });

  test('tiers are sorted, whole counts, and empty tiers dropped', () => {
    expect(normaliseTiers([{ count: 3.4, percent: 10 }, { count: 1, percent: 0 }, { count: 2, percent: 7.5 }])).toEqual([
      { count: 2, percent: 7.5 },
      { count: 3, percent: 10 },
    ]);
    expect(buildDiscountConfig([{ count: 1, percent: 0 }, { count: 3, percent: 10 }]).tiers).toEqual([{ count: 3, percent: 10 }]);
  });
});

const line = (id: number, sku: string, type: string, attrs: Record<string, string>, name = sku, quantity = 1): OrderLineItem => ({
  id: `gid://shopify/LineItem/${id}`,
  name,
  sku,
  quantity,
  variantTitle: null,
  customAttributes: Object.entries(attrs).map(([key, value]) => ({ key, value })),
  product: { productType: type },
});

describe('builds from an order', () => {
  const lines = [
    line(1, 'LL-TOP-WAL-180-80', 'Desk top', { _build: 'LL-7K2QD', _edge: 'rounded' }, 'Desk top - Walnut / 180 cm / 80 cm'),
    line(2, 'LL-FRM-GRA', 'Desk frame', { _build: 'LL-7K2QD' }, 'Dual-motor frame - Graphite'),
    line(3, 'LL-ACC-ARM', 'Accessory', { _build: 'LL-7K2QD' }, 'Monitor arm'),
    line(4, 'LL-ACC-CBL', 'Accessory', {}, 'Cable kit'),
    line(5, 'LL-TOP-OAK-120-70', 'Desk top', { _build: 'LL-AB12C' }, 'Desk top - Oak / 120 cm / 70 cm'),
  ];

  test('groups parts by build number and ignores loose items', () => {
    const builds = buildsFromLineItems(lines);
    expect(builds.map((b) => b.buildNumber)).toEqual(['LL-7K2QD', 'LL-AB12C']);
    expect(builds[0].edge).toBe('rounded');
    expect(builds[0].frame?.sku).toBe('LL-FRM-GRA');
    expect(builds[0].accessories.map((a) => a.sku)).toEqual(['LL-ACC-ARM']);
  });

  test('build sheet: cut size, powder coat, leg spacing and boxes', () => {
    const sheet = buildSheet(buildsFromLineItems(lines)[0], '#1042');
    expect(sheet.problems).toEqual([]);
    expect(sheet.top).toMatchObject({ material: 'Walnut', finishedSizeMm: '1800 x 800 x 25', cornerRadiusMm: 45, weightKg: 23.4 });
    expect(sheet.frame).toMatchObject({ colour: 'Graphite', ral: 'RAL 7024 Graphite grey, matt', legSpacingMm: 1480 });
    expect(sheet.packing.map((p) => p.box)).toEqual([1, 2, 3]);
    expect(sheet.accessories).toEqual([{ name: 'Monitor arm', sku: 'LL-ACC-ARM', quantity: 1 }]);
  });

  test('a build with no frame is flagged, not dropped', () => {
    const sheet = buildSheet(buildsFromLineItems(lines)[1], '#1042');
    expect(sheet.problems).toEqual(['No frame found for this build.']);
    expect(sheet.frame).toBeNull();
    expect(sheet.top?.cornerRadiusMm).toBe(6);
  });

  test('renders a PDF', async () => {
    const pdf = await renderBuildSheetPdf(buildSheet(buildsFromLineItems(lines)[0], '#1042'));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1500);
  });
});

describe('stages and SKUs', () => {
  test('stages move forward and stop at shipped', () => {
    expect(nextStage('queued')).toBe('cutting');
    expect(nextStage('quality_check')).toBe('shipped');
    expect(nextStage('shipped')).toBeNull();
    expect(stageTag('quality_check')).toBe('build-quality-check');
    expect(tagChanges('assembly')).toEqual({
      add: ['build-assembly'],
      remove: ['build-queued', 'build-cutting', 'build-quality-check', 'build-shipped'],
    });
  });

  test('top SKUs parse, anything else does not', () => {
    expect(parseTopSku('LL-TOP-LIN-140-70')).toEqual({ material: 'LIN', widthCm: 140, depthCm: 70 });
    expect(parseTopSku('LL-FRM-BLK')).toBeNull();
    expect(parseTopSku(null)).toBeNull();
  });
});
