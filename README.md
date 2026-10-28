# Loftline Studio

Shopify store: modular standing desks with a 3D configurator, sold in the US, Canada and the UK.

- `theme/`: Online Store 2.0 theme written from scratch (no Dawn code). Colours, fonts and spacing are theme settings (`theme/config/settings_schema.json`), turned into CSS variables in `theme/snippets/css-variables.liquid`.
- `src/desk-viewer/`: the 3D desk (three.js), built in code from the configuration in metres. Procedural textures for wood, linoleum, plywood edges and powder coat; no model or image files. Bundled into `theme/assets/desk-viewer.js`.
- `data/catalog.json`: products, SKUs and prices. Source for the local preview now and the product import later.
- `app/`: the Loftline Ops app. So far: two Shopify Functions, `desk-bundle` (Cart Transform) and `accessory-tiers` (Discount). How they price and when they run: [docs/discounts-and-bundles.md](docs/discounts-and-bundles.md). The admin app comes next.

## Commands

```bash
npm run build                      # bundle the 3D viewer into theme/assets
npm run preview                    # rebuild on change + serve on http://localhost:5178
node scripts/preview-theme.mjs     # render pages with sample data into preview/out/
npm run check                      # Theme Check
shopify theme dev --path theme --store <store>.myshopify.com
```

Local pages (with `npm run preview` running):

- `/preview/out/index.html`: home
- `/preview/out/build.html`: desk configurator
- `/preview/out/cart-drawer.html`: configurator with a sample cart (click the cart icon)
- `/preview/desk.html`: 3D viewer on its own, with controls
- `/preview/out/product.html`, `/preview/out/product-frame.html`: product pages (subscription options on the desk pad)
- `/preview/out/collection.html`: accessories with filters
- `/preview/poster.html`: re-renders the home hero still (`theme/assets/desk-poster.webp`); needs `node scripts/capture-server.mjs`
- `/preview/shots.html`: re-renders the product photos into `data/images/` from the 3D model (`?only=<name>` for one); needs `node scripts/capture-server.mjs`

The local renderer imitates only the Shopify objects this theme uses. It is for layout checks; the real test is `shopify theme dev` on the development store.

## Functions

```bash
cd app
npm test                                                   # schema-checked test carts, JavaScript
npx shopify app function build --path extensions/desk-bundle
npx shopify app function build --path extensions/accessory-tiers
node scripts/test-wasm.mjs                                 # same test carts through the built wasm
```

## Product setup the theme expects

- Frame product: one option (Colour), SKUs `LL-FRM-BLK`, `LL-FRM-WHT`, `LL-FRM-GRA`, `LL-FRM-ALU`.
- Desk top product: options in the order Material, Width, Depth; SKUs `LL-TOP-<MATERIAL>-<W>-<D>`, e.g. `LL-TOP-OAK-160-80` (materials `OAK`, `WAL`, `BAM`, `WHT`, `LIN`).
- Product types: `Accessory`, `Desk top`, `Desk frame`, and `Desk` for the `custom-desk` bundle product. The cart, the Discount Function and the Cart Transform rely on them.
- Specs come from `specs.*` product metafields and the `material` metaobject; definitions are in `data/metafields.json`, values in `data/catalog.json`.
- Subscriptions (desk pad, cable kit) are selling plans; the product page shows them as purchase options.
- "Frequently bought together" uses complementary products set in the Search & Discovery app; filters on collection pages are also set up there.
- The configurator page uses the `page.build` template; it already points at the handles in `data/catalog.json`.

## Cart modes

- **Separate parts** (default, every plan): the configurator adds the top, frame and accessories as separate lines that share a `_build` property; the cart drawer shows and changes them as one desk.
- **One desk line**: adds a single bundle line that the Cart Transform Function expands into the parts. Custom apps with Functions run only on Shopify Plus, so this mode is for the development store.

Fonts (Syne, Instrument Sans) are variable WOFF2 files in `theme/assets/`, licensed under the SIL Open Font License 1.1.
