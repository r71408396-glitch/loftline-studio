# Store setup

One run fills an empty development store from the files in `data/`, and running it again changes nothing that doesn't need changing.

| Step | From | What it makes |
|---|---|---|
| Custom data | `data/metafields.json` | Metaobject definitions `material` and `faq_item`, product fields `specs.*` (dimensions, height range, load capacity, weight, assembly time, warranty, lead time, material, care) |
| Entries | `data/metafields.json`, `data/pages.json` | 6 materials, 6 FAQ entries |
| Products | `data/catalog.json` | 9 products, 53 variants with SKUs, prices and stock at the first active location; specs; the 17 photos from `data/images` (each variant gets its own) |
| Subscriptions | `data/catalog.json` | Felt desk pad and cable kit: every 3, 6 or 12 months, 10% off |
| Collections | built in | `accessories` (product type Accessory) and `desk-parts` (Desk top, Desk frame), filled automatically |
| Online Store | built in | Products and collections published to the Online Store channel |
| Pages | `data/pages.json` | build (configurator template), about, faq, warranty, shipping, returns, contact |
| Menus | built in | Main menu (Build a desk, Accessories, How it's made, Help) and footer menu |

On a re-run:

- **Products:** prices, stock, specs and descriptions are updated through `productSet`, matched by handle.
- **Photos:** uploaded only for products that have none yet. Tick "Upload photos again" or pass `--images` to upload them again.
- **Everything else:** found by handle or type and left as it is, except the two menus, which are rewritten.

At the end it prints the variant ID of "Assembly at home". That ID goes into the checkout extension's "Assembly service" setting.

## Ways to run it

1. **Loftline Ops > Store setup** (after `npm run dev` installs the app on the development store): one button. It uses the app's own access.
2. **Command line** with an Admin API token from a custom app made in the store admin (Settings > Apps > Develop apps):

   ```bash
   cd app
   SHOP=your-store.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_... npx vite-node scripts/setup-store.ts
   ```

3. **Dry run**, no store needed. It prints what would be sent:

   ```bash
   cd app
   npx vite-node scripts/setup-store.ts -- --dry-run
   ```

Scopes it needs (already in `shopify.app.toml`):

```text
write_products, write_inventory, read_locations, write_files,
write_metaobject_definitions, write_metaobjects,
write_online_store_pages, write_online_store_navigation,
write_publications, write_purchase_options
```

## Checked without a store

- **Queries:** every one is validated against the 2026-10 Admin API schema (`npm run typecheck` runs codegen).
- **Inputs:** every input object (products, variants, files, subscriptions, collections, pages, menus, field definitions, uploads) is typed with the generated Admin API input types, so a wrong field name fails the type check. That check caught three real issues while writing this: a collection field that moved to the new `sources` input in 2026-10, a missing source title, and two loose enum values.
- **Tests:** `app/setup/catalog.test.ts` covers the catalogue mapping (variants, stock, photos, specs, subscriptions).

Still to see on a real store: the photo uploads, and Shopify's acceptance of the subscription plans for this app.
