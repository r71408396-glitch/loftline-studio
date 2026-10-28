// End-to-end check of the webhook path against a running app server and its
// database: signs webhooks the way Shopify does (HMAC-SHA256 of the raw body
// with the app secret) and checks what lands in Postgres.
//
// Usage (server running with the same SHOPIFY_API_SECRET and DATABASE_URL):
//   APP_URL=http://localhost:3123 SHOPIFY_API_SECRET=... DATABASE_URL=... node scripts/webhook-smoke.mjs
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const APP_URL = process.env.APP_URL || 'http://localhost:3123';
const SECRET = process.env.SHOPIFY_API_SECRET;
const SHOP = 'loftline-dev.myshopify.com';
const db = new PrismaClient();

const order = {
  id: 820982911946154500,
  admin_graphql_api_id: 'gid://shopify/Order/820982911946154500',
  name: '#1042',
  email: 'customer@example.com',
  line_items: [
    { admin_graphql_api_id: 'gid://shopify/LineItem/1', name: 'Desk top - Walnut / 180 cm / 80 cm', sku: 'LL-TOP-WAL-180-80', quantity: 1, variant_title: 'Walnut / 180 cm / 80 cm', properties: [{ name: 'Build', value: 'LL-SMOKE1' }, { name: '_build', value: 'LL-SMOKE1' }, { name: '_edge', value: 'rounded' }] },
    { admin_graphql_api_id: 'gid://shopify/LineItem/2', name: 'Dual-motor frame - Graphite', sku: 'LL-FRM-GRA', quantity: 1, variant_title: 'Graphite', properties: [{ name: '_build', value: 'LL-SMOKE1' }] },
    { admin_graphql_api_id: 'gid://shopify/LineItem/3', name: 'Monitor arm', sku: 'LL-ACC-ARM', quantity: 1, variant_title: null, properties: [{ name: '_build', value: 'LL-SMOKE1' }] },
    { admin_graphql_api_id: 'gid://shopify/LineItem/4', name: 'Cable kit', sku: 'LL-ACC-CBL', quantity: 2, variant_title: null, properties: [] },
  ],
};

async function send(topic, path, payload, { id = crypto.randomUUID(), sign = true } = {}) {
  const body = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', sign ? SECRET : 'wrong-secret').update(body, 'utf8').digest('base64');
  const response = await fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Hmac-Sha256': hmac,
      'X-Shopify-Topic': topic,
      'X-Shopify-Shop-Domain': SHOP,
      'X-Shopify-Webhook-Id': id,
      'X-Shopify-Event-Id': crypto.randomUUID(),
      'X-Shopify-API-Version': '2026-10',
      'X-Shopify-Triggered-At': new Date().toISOString(),
    },
    body,
  });
  return { status: response.status, id };
}

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

await db.build.deleteMany({ where: { shop: SHOP } });
await db.webhookEvent.deleteMany({ where: { shop: SHOP } });

const bad = await send('orders/create', '/webhooks/orders/create', order, { sign: false });
check(bad.status === 401, `wrong signature is refused (status ${bad.status})`);
check((await db.build.count({ where: { shop: SHOP } })) === 0, 'nothing stored for the refused webhook');

const first = await send('orders/create', '/webhooks/orders/create', order);
check(first.status === 200, `signed orders/create accepted (status ${first.status})`);
const build = await db.build.findUnique({ where: { shop_buildNumber: { shop: SHOP, buildNumber: 'LL-SMOKE1' } } });
check(Boolean(build), 'build LL-SMOKE1 created');
check(build?.stage === 'queued', 'new build starts in the queue');
check(build?.sheet?.top?.finishedSizeMm === '1800 x 800 x 25', `build sheet has the cut size (${build?.sheet?.top?.finishedSizeMm})`);
check(build?.sheet?.frame?.ral?.startsWith('RAL 7024'), 'build sheet has the powder coat');
check(build?.customerEmail === 'customer@example.com', 'customer email kept for stage emails');

const repeat = await send('orders/create', '/webhooks/orders/create', order, { id: first.id });
const event = await db.webhookEvent.findUnique({ where: { id: first.id } });
check(repeat.status === 200 && event?.attempts === 1, `retried delivery acknowledged, processed once (attempts ${event?.attempts})`);
check(event?.error === '1 build(s) queued', `webhook log note: "${event?.error}"`);

await db.build.update({ where: { id: build.id }, data: { stage: 'assembly' } });
const edited = { ...order, line_items: order.line_items.map((l) => (l.sku === 'LL-FRM-GRA' ? { ...l, sku: 'LL-FRM-BLK', name: 'Dual-motor frame - Black' } : l)) };
const updated = await send('orders/updated', '/webhooks/orders/updated', edited);
const after = await db.build.findUnique({ where: { id: build.id } });
check(updated.status === 200, `orders/updated accepted (status ${updated.status})`);
check(after?.sheet?.frame?.colour === 'Black' && after?.stage === 'assembly', 'order edit refreshes the sheet and keeps the stage');

const stock = await send('inventory_levels/update', '/webhooks/inventory_levels/update', { inventory_item_id: 271878346596884000, available: 12 });
check(stock.status === 200, `inventory_levels/update logged (status ${stock.status})`);

await db.$disconnect();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
