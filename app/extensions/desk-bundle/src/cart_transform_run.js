// @ts-check
// Expands a "Custom desk" cart line into its real parts (top, frame,
// accessories) so stock and fulfilment are per part.
//
// The line's attributes only say WHICH variants were chosen (_top, _frame,
// _accessories). Prices never come from the cart: each part is priced from the
// price table the Loftline Ops app keeps in this Function's configuration
// metafield, so a shopper editing attributes can't change what they pay. If a
// chosen variant isn't in the table the line is left alone, and the bundle
// product's own (deliberately high) price applies.
//
// Accessories in a desk get the same tier discount the Discount Function gives
// loose accessories, counted across the whole cart.

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

const DEFAULT_TIERS = [
  { count: 1, percent: 5 },
  { count: 3, percent: 10 },
];

/**
 * @param {number} count accessories in the cart
 * @param {{count: number, percent: number}[]} tiers
 */
export function tierPercent(count, tiers = DEFAULT_TIERS) {
  let percent = 0;
  for (const tier of [...tiers].sort((a, b) => a.count - b.count)) {
    if (count >= tier.count) percent = tier.percent;
  }
  return percent;
}

/** @param {string | undefined | null} value */
const idList = (value) =>
  (value || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^\d+$/.test(id));

const money = (amount) => (Math.round(amount * 100) / 100).toFixed(2);

/**
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  const config = /** @type {any} */ (input.cartTransform?.configuration?.jsonValue) || {};
  const components = config.components || {};
  const tiers = config.tiers || DEFAULT_TIERS;
  const rate = Number(input.presentmentCurrencyRate) || 1;
  const lines = input.cart.lines;

  const isBundle = (line) => Boolean(line.top?.value && line.frame?.value);
  const productType = (line) =>
    line.merchandise.__typename === 'ProductVariant' ? line.merchandise.product.productType : null;

  // Accessories across the cart: loose accessory lines plus those inside desks.
  let accessoryCount = 0;
  for (const line of lines) {
    if (isBundle(line)) accessoryCount += idList(line.accessories?.value).length * line.quantity;
    else if (productType(line) === 'Accessory') accessoryCount += line.quantity;
  }
  const percent = tierPercent(accessoryCount, tiers);

  const operations = [];
  for (const line of lines) {
    if (!isBundle(line)) continue;

    const ids = [line.top?.value, line.frame?.value, ...idList(line.accessories?.value)].map(String);
    if (!ids.every((id) => components[id])) continue;

    // One expanded item per variant; the same accessory twice becomes quantity 2.
    const quantities = new Map();
    for (const id of ids) quantities.set(id, (quantities.get(id) || 0) + 1);

    // The order's build sheet needs the build number on every part and the
    // edge profile on the top.
    const attributes = line.build?.value ? [{ key: '_build', value: line.build.value }] : [];
    const edge = line.edge?.value === 'rounded' || line.edge?.value === 'square' ? line.edge.value : null;
    const expandedCartItems = [...quantities].map(([id, quantity]) => {
      const part = components[id];
      const partAttributes = part.kind === 'top' && edge ? [...attributes, { key: '_edge', value: edge }] : attributes;
      const discount = part.kind === 'accessory' ? percent : 0;
      const unit = Number(part.price) * rate * (1 - discount / 100);
      return {
        merchandiseId: `gid://shopify/ProductVariant/${id}`,
        quantity,
        price: { adjustment: { fixedPricePerUnit: { amount: money(unit) } } },
        attributes: partAttributes,
      };
    });

    const top = components[String(line.top?.value)];
    operations.push({
      lineExpand: {
        cartLineId: line.id,
        title: top?.title ? `${config.title || 'Custom desk'}: ${top.title}` : config.title || 'Custom desk',
        expandedCartItems,
      },
    });
  }

  return { operations };
}
