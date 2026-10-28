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

- Node 22, Postgres database `loftline_ops`, the app behind HTTPS at e.g. `https://ops.loftline.studio` (nginx proxy to port 3000).
- Environment: see `app/.env.example`.
- `npm ci && npm run setup && npm run build && npm run start`, kept running by systemd (or the template's `Dockerfile`).
- Set `application_url` and `[auth] redirect_urls` in `shopify.app.toml` to that URL, then `npm run deploy`.
