// @ts-check
// "Desk set" tiers: with a desk in the cart, accessories get 5% off from one
// accessory and 10% off from three (tiers come from the discount's
// configuration metafield, written by the Loftline Ops app).
//
// Counts loose accessory lines and the accessories inside configured desks.
// Only loose accessory lines are discounted here; accessories inside a desk
// are already priced with the same tier by the Desk bundle Cart Transform.

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

const DEFAULT_TIERS = [
  { count: 1, percent: 5 },
  { count: 3, percent: 10 },
];

// Product types that count as "a desk in the cart".
const DESK_TYPES = ['Desk', 'Desk top'];

/**
 * @param {number} count
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
const idCount = (value) =>
  (value || '')
    .split(',')
    .filter((id) => /^\d+$/.test(id.trim())).length;

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const NONE = { operations: [] };
  if (!input.discount.discountClasses.includes('PRODUCT')) return NONE;

  const config = /** @type {any} */ (input.discount.configuration?.jsonValue) || {};
  const tiers = config.tiers || DEFAULT_TIERS;
  const productType = (line) =>
    line.merchandise.__typename === 'ProductVariant' ? line.merchandise.product.productType : null;

  const hasDesk = input.cart.lines.some((line) => DESK_TYPES.includes(productType(line) || ''));
  if (!hasDesk) return NONE;

  const looseAccessories = input.cart.lines.filter((line) => productType(line) === 'Accessory');
  const count =
    looseAccessories.reduce((sum, line) => sum + line.quantity, 0) +
    input.cart.lines
      .filter((line) => productType(line) === 'Desk')
      .reduce((sum, line) => sum + idCount(line.accessories?.value) * line.quantity, 0);

  const percent = tierPercent(count, tiers);
  if (!percent || !looseAccessories.length) return NONE;

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: (config.message || 'Desk set: {percent}% off accessories').replace('{percent}', String(percent)),
              targets: looseAccessories.map((line) => ({ cartLine: { id: line.id } })),
              value: { percentage: { value: percent } },
            },
          ],
          selectionStrategy: 'FIRST',
        },
      },
    ],
  };
}
