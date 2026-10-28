// Store setup from the command line (the same steps as Loftline Ops > Store setup).
//
//   npx vite-node scripts/setup-store.ts -- --dry-run
//       prints what would be sent, no store needed
//   SHOP=loftline-dev.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_... npx vite-node scripts/setup-store.ts
//       runs against the store; the token comes from a custom app made in the
//       store admin (Settings > Apps > Develop apps) with the scopes in docs/store-setup.md
//   add --images to upload photos again for products that already have some
import fs from 'node:fs';
import path from 'node:path';
import { setupStore } from '../app/setup/store-setup.server';
import { catalogVariants, productSetInput, type Catalog } from '../app/setup/catalog';
import type { AdminApi } from '../app/models/admin.server';

const API_VERSION = '2026-10';
const args = process.argv.slice(2);

if (args.includes('--dry-run')) {
  const dir = [process.env.LOFTLINE_DATA_DIR, path.resolve('../data'), path.resolve('data')].find((d) => d && fs.existsSync(path.join(d, 'catalog.json')))!;
  const catalog: Catalog = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
  for (const product of catalog.products) {
    const input = productSetInput(product, {
      locationId: 'gid://shopify/Location/1',
      imageUrls: new Map((product.images ?? []).map((i) => [i.file, `https://staged.example/${i.file}`])),
      materialIds: new Map([[product.material ?? '', 'gid://shopify/Metaobject/1']]),
    });
    const tracked = catalogVariants(product).filter((v) => v.inventory !== null).length;
    console.log(
      `${product.handle.padEnd(20)} ${String(input.variants?.length).padStart(3)} variants, ${String(tracked).padStart(3)} tracked, ` +
        `${input.files?.length ?? 0} photos, ${input.metafields?.length ?? 0} spec fields${product.selling_plans ? ', subscriptions' : ''}`,
    );
  }
  process.exit(0);
}

const shop = process.env.SHOP;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
if (!shop || !token) {
  console.error('Set SHOP and SHOPIFY_ADMIN_TOKEN, or use --dry-run.');
  process.exit(1);
}

const admin: AdminApi = {
  graphql: (query, options) =>
    fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables: options?.variables ?? {} }),
    }),
};

const result = await setupStore(admin, { reuploadImages: args.includes('--images'), log: (line) => console.log(line) });
console.log(`\n${result.products} products. Bundle variant: ${result.bundleVariantId}`);
