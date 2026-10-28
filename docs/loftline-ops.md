# Loftline Ops (the store's admin app)

Embedded Shopify admin app in `app/`, built on Shopify's React Router app template (React Router 7, Polaris web components, App Bridge, Prisma). Postgres for app data.

## What it does

| Page / handler | What it does |
|---|---|
| **Overview** (`/app`) | Desks per production stage, latest builds, whether the Functions are set up, webhook log. |
| **Production queue** (`/app/queue`) | Every desk on an order, oldest first, filterable by stage, with a button to move it to the next stage. |
| **Build** (`/app/builds/:id`) | The build sheet, stage history, and the build sheet PDF. |
| **Configurator rules** (`/app/rules`) | Discount tiers and the price table the desk bundle Function uses; one button creates the cart transform and the automatic discount if they're missing and sends current prices. |
| `orders/create` | Each desk on the order (lines sharing a `_build` property) becomes a build in the queue, with its build sheet. |
| `orders/updated` | Order edits refresh the build sheets; the stage the workshop set is kept. |
| `inventory_levels/update` | Logged; back-in-stock emails hook in here later. |
| Product price change (Events) | Re-sends prices to the desk bundle Function so checkout never uses an old price. |
| `app/uninstalled` | Removes sessions and settings. |

## Delivery dates and extensions

The delivery window is the parts' longest lead time plus carrier transit to the destination zone, counted in working days. It skips weekends and carrier holidays, with a 2 pm cut-off (`app/lib/delivery.ts`):

- **US:** first digit of the ZIP, from Columbus.
- **Canada:** first letter of the postal code, from Toronto.
- **UK:** mainland, or Northern Ireland, the Highlands and the islands, from Birmingham.

| Extension | Where | Plan |
|---|---|---|
| `delivery-estimate` (theme app block) | Product page: ZIP/postcode in, "Arrives Thu 19 – Fri 20 Nov" out, through the app proxy `/apps/loftline/delivery` (signed by Shopify). Remembers the code. | All plans |
| `checkout-delivery` | Checkout, under the shipping options: delivery window for the shipping address, optional preferred delivery day (saved as the "Preferred delivery date" order attribute). Under the cart lines: assembly at home, one per desk. | Plus and development stores |
| `thank-you-build` | Thank-you page: build numbers and what happens next, assembly video link. | All plans |

Checkout extension settings (in the checkout editor) need two values: the Loftline Ops URL, and the variant of an "Assembly at home" service product, which isn't in the catalogue yet.

Moving a build to a stage:

1. Tags the order (`build-cutting`, `build-assembly`, ...).
2. Writes the stage to the `loftline.production_stage` order metafield.
3. Emails the customer if `SMTP_URL` is set; without it, the stage still changes.
4. Records the change in the build's history.

Shopify doesn't let apps add comments to an order's timeline. Staff see the stage in the tags and the metafield instead.

Webhooks: `authenticate.webhook` checks Shopify's HMAC signature, so an unsigned or wrongly signed request gets 401 before any handler runs. Every delivery is logged by its `X-Shopify-Webhook-Id`. A delivery that already succeeded isn't processed twice, and a failure returns 500 so Shopify retries.

## Checks you can run without a store

```bash
cd app
npm test                    # app logic (8 tests) + both Functions (13 test carts, schema-validated)
npm run typecheck           # downloads the Admin API schema, validates every GraphQL query, then TypeScript
npm run build               # production build
npm run test:wasm           # the 13 test carts through the built Functions (build them first)
npm run test:webhooks       # signed webhooks against a running server + Postgres (see the script header)
npx vite-node scripts/sample-build-sheet.ts out.pdf   # a sample build sheet
```

## What still needs the store

1. Partner account and development store; `shopify auth login`.
2. In `app/`: `npm run config:link`, which fills in `client_id`.
3. Request protected customer data access for the app in the Partner Dashboard (order webhooks need it).
4. `npm run dev` on the development store, or deploy to the server (below), then `npm run deploy` for the Functions and webhooks.
5. Open Loftline Ops > Configurator rules and save once.

## Running it on srv1215499

Live at `https://ops.loftline.studio`, from `/opt/loftline-ops` on the server (files in `deploy/`):

- **Containers:** `deploy/docker-compose.yml` runs the app (on `127.0.0.1:3100` only) and its own Postgres 16 (no published port, data in the `pgdata` volume). Migrations run on every start. `data/` is mounted read-only for the store setup.
- **Apache:** `deploy/apache/ops.loftline.studio.conf` proxies the name to the app; certbot added the HTTPS copy and renews it. Needs `mod_proxy` and `mod_proxy_http`.
- **Environment:** `deploy/.env` from `deploy/env.example` (root only). Put the client secret in with `ssh -t srv1215499 /opt/loftline-ops/deploy/set-secret.sh`.
- **Update the app:** copy the changed files to `/opt/loftline-ops`, then `cd /opt/loftline-ops/deploy && docker compose up -d --build`.
- **Update Shopify's side** (config, Functions, extensions): `npm run deploy` in `app/`.

Things to know:

- `shopify.app.toml` points at the server and `automatically_update_urls_on_dev` is off. Don't run `shopify app dev` against this app; it would point the store at a laptop tunnel. Use a separate dev app for development.
- The checkout editor stores the two checkout blocks' "Loftline Ops URL"; change it there if the address ever changes.
- App block IDs differ between `app dev` and a released version. After the first deploy, the delivery estimate block was added again and its new ID copied into `theme/templates/product.json`.
