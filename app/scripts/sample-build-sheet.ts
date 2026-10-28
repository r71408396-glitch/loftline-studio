// Writes a sample build sheet PDF (a walnut desk with a graphite frame) for a look at the layout.
// Usage: npx vite-node scripts/sample-build-sheet.ts <out.pdf>
import fs from 'node:fs';
import { buildSheet, buildsFromLineItems, type OrderLineItem } from '../app/lib/builds';
import { renderBuildSheetPdf } from '../app/lib/build-sheet-pdf';

const line = (sku: string, name: string, attrs: Record<string, string>, quantity = 1): OrderLineItem => ({
  id: sku, name, sku, quantity, variantTitle: null, product: null,
  customAttributes: Object.entries(attrs).map(([key, value]) => ({ key, value })),
});

const [build] = buildsFromLineItems([
  line('LL-TOP-WAL-180-80', 'Desk top - Walnut / 180 cm / 80 cm', { _build: 'LL-SMOKE1', _edge: 'rounded' }),
  line('LL-FRM-GRA', 'Dual-motor frame - Graphite', { _build: 'LL-SMOKE1' }),
  line('LL-ACC-ARM', 'Monitor arm', { _build: 'LL-SMOKE1' }),
  line('LL-ACC-PAD-GRA', 'Felt desk pad - Graphite', { _build: 'LL-SMOKE1' }),
]);
const pdf = await renderBuildSheetPdf(buildSheet(build, '#1042'));
fs.writeFileSync(process.argv[2] || 'build-sheet.pdf', pdf);
console.log(`wrote ${pdf.length} bytes`);
