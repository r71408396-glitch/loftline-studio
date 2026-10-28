# Desk bundles and accessory discounts

Two Shopify Functions live in `app/extensions/`:

| Function | Target | What it does |
|---|---|---|
| `desk-bundle` | `cart.transform.run` | Expands one "Custom desk" line into the top, frame and accessories (real stock per part). Prices each part from the app's price table, never from the cart. |
| `accessory-tiers` | `cart.lines.discounts.generate.run` | With a desk in the cart: 5% off accessories from 1 accessory, 10% from 3. Counts accessories inside desks too. |

Shopify only runs Functions from a **custom app on a Shopify Plus store** (public App Store apps run on any plan). So:

- **Development store:** both Functions, the configurator in "One desk line" mode. This is what the Loom and screenshots show.
- **Live Basic store:** no Functions. The configurator adds separate parts, and Shopify's own automatic discounts stand in for the tiers (below).

## How the bundle is priced

The configurator adds the `custom-desk` product (one variant, priced 9,999 on purpose) with hidden line properties:

- `_top`, `_frame`: variant IDs
- `_accessories`: comma-separated variant IDs
- `_build`: the build number shown to the customer

The Cart Transform looks every ID up in its configuration metafield (`$app:function-configuration` on the cart transform), which the Loftline Ops app writes:

```json
{
  "title": "Custom desk",
  "tiers": [{ "count": 1, "percent": 5 }, { "count": 3, "percent": 10 }],
  "components": {
    "<variant id>": { "price": "409.00", "kind": "top", "title": "Oak, 160 x 80 cm" },
    "<variant id>": { "price": "549.00", "kind": "frame", "title": "Black frame" },
    "<variant id>": { "price": "49.00", "kind": "accessory", "title": "Felt desk pad" }
  }
}
```

- Prices are in the store currency; the Function multiplies by `presentmentCurrencyRate` for CAD and GBP. Markets price rounding rules are not applied inside the Function, so a CAD price can differ by a few cents from the same part bought on its own.
- If any ID is missing from the table, the line is not expanded and keeps the 9,999 price, so editing the hidden properties can never make a desk cheaper.
- Accessories inside a desk get the tier discount in the expanded price; the Discount Function only discounts loose accessory lines, so nothing is discounted twice.
- Shopify rejects expand operations on lines with a selling plan, which is why subscriptions stay on loose accessories.

To check on the development store: add a desk in bundle mode with quantity 2 and confirm each part shows quantity 2 at checkout (expanded quantities are per desk).

## Setup on the development store (after `shopify app deploy`)

1. Create the cart transform: `cartTransformCreate(functionHandle: "desk-bundle")`, then set its `$app:function-configuration` metafield to the JSON above (the app's "Configurator rules" screen will do this when prices change).
2. Create the discount: `discountAutomaticAppCreate` with `functionHandle: "accessory-tiers"`, discount class `PRODUCT`, and the same tiers in its `$app:function-configuration` metafield.
3. Theme: Desk configurator section → "Add to cart as" → "One desk line", bundle product `custom-desk`.

## Live Basic store: native automatic discounts

Shopify's own discounts can't say "only with a desk in the cart" for the percentage tier. The closest honest setup:

| Discount | Settings |
|---|---|
| **Accessory bundle: 10% off** (automatic, Amount off products) | 10% off the **Accessories** collection; minimum quantity of items: **3** (only items from that collection count towards it). |
| **Desk set: 5% off an accessory** (automatic, Buy X get Y) | Customer buys: minimum quantity 1 from **Desk tops**; customer gets: 1 item from **Accessories** at 5% off; no per-order cap, so each desk unlocks one discounted accessory. |

Differences from the Function, to keep the shop's wording true:

- The 10% tier applies to 3+ accessories even without a desk.
- The 5% tier covers one accessory per desk, not all of them.

So on the live store, set the theme's **Accessory discount** settings to a single tier (first tier 0%, second tier: 3 accessories, 10%). The configurator and cart then promise only what the native discount gives.
