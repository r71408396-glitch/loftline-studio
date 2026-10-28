// Optional assembly at home: a checkbox under the cart lines that adds the
// assembly service (one per desk) or takes it out again.
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export default async () => {
  render(<Assembly />, document.body);
};

const PRICE_QUERY = `query AssemblyPrice($id: ID!) {
  node(id: $id) {
    ... on ProductVariant {
      price {
        amount
        currencyCode
      }
    }
  }
}`;

function Assembly() {
  const variantId = shopify.settings.value.assembly_variant ? String(shopify.settings.value.assembly_variant) : null;
  const [price, setPrice] = useState(null);
  const [busy, setBusy] = useState(false);
  const lines = shopify.lines.value;

  // One assembly per configured desk (its lines share a _build number).
  const desks = new Set(lines.flatMap((line) => line.attributes.filter((a) => a.key === '_build').map((a) => a.value))).size;
  const assemblyLine = lines.find((line) => line.merchandise.id === variantId);

  useEffect(() => {
    if (!variantId) return;
    shopify
      .query(PRICE_QUERY, { variables: { id: variantId } })
      .then(({ data }) => {
        const p = /** @type {any} */ (data)?.node?.price;
        if (p) setPrice(shopify.i18n.formatCurrency(Number(p.amount), { currency: p.currencyCode }));
      })
      .catch(() => {});
  }, [variantId]);

  if (!variantId || !desks || !price) return null;
  if (!shopify.instructions.value.lines.canAddCartLine) return null;

  async function onChange(event) {
    setBusy(true);
    try {
      if (event.currentTarget.checked) {
        await shopify.applyCartLinesChange({ type: 'addCartLine', merchandiseId: variantId, quantity: desks });
      } else if (assemblyLine) {
        await shopify.applyCartLinesChange({ type: 'removeCartLine', id: assemblyLine.id, quantity: assemblyLine.quantity });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-checkbox
          checked={Boolean(assemblyLine)}
          disabled={busy}
          label={String(shopify.i18n.translate('assemblyLabel', { price }))}
          onChange={onChange}
        />
        <s-text color="subdued">{shopify.i18n.translate('assemblyHelp')}</s-text>
      </s-stack>
    </s-box>
  );
}
