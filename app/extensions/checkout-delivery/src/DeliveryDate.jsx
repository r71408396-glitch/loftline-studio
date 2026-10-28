// Shows when the order arrives at the shipping address (from Loftline Ops)
// and lets the customer pick a preferred delivery day, saved on the order as
// the "Preferred delivery date" attribute.
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export default async () => {
  render(<DeliveryDate />, document.body);
};

const ATTRIBUTE = 'Preferred delivery date';
const DEFAULT_LEAD_DAYS = 2;

// Longest lead time of the products in the cart (specs.lead_time_days metafield).
function leadDays() {
  const values = shopify.appMetafields.value
    .filter((entry) => entry.target.type === 'product' && entry.metafield.key === 'lead_time_days')
    .map((entry) => Number(entry.metafield.value))
    .filter((n) => Number.isFinite(n));
  return values.length ? Math.max(...values) : DEFAULT_LEAD_DAYS;
}

function addDays(day, days) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function DeliveryDate() {
  const address = shopify.shippingAddress?.value;
  const zip = address?.zip;
  const country = address?.countryCode;
  const lead = leadDays();
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState(false);
  const chosen = shopify.attributes.value.find((a) => a.key === ATTRIBUTE)?.value ?? '';

  useEffect(() => {
    if (!zip || !country) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const base = String(shopify.settings.value.api_url || 'https://ops.loftline.studio').replace(/\/$/, '');
        const token = await shopify.sessionToken.get();
        const params = new URLSearchParams({ zip, country, lead: String(lead) });
        const response = await fetch(`${base}/api/delivery?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error);
        setEstimate(data);
        setError(false);
      } catch (e) {
        if (!cancelled) {
          setEstimate(null);
          setError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zip, country, lead]);

  const t = (key, values) => shopify.i18n.translate(key, values);
  const day = (isoDay) =>
    shopify.i18n.formatDate(new Date(`${isoDay}T12:00:00Z`), { weekday: 'short', day: 'numeric', month: 'short' });

  if (!zip || !country) return <s-text color="subdued">{t('enterAddress')}</s-text>;
  if (error) return <s-banner tone="warning">{t('error')}</s-banner>;
  if (!estimate) return <s-spinner accessibilityLabel={t('deliveryHeading')} />;

  const canSave = shopify.instructions.value.attributes.canUpdateAttributes;

  async function onChange(event) {
    const value = event.currentTarget.value;
    await shopify.applyAttributeChange(
      value ? { type: 'updateAttribute', key: ATTRIBUTE, value } : { type: 'removeAttribute', key: ATTRIBUTE },
    );
  }

  return (
    <s-stack gap="base">
      <s-stack gap="small-200">
        <s-heading>{t('deliveryHeading')}</s-heading>
        <s-text type="strong">{t('arrives', { from: day(estimate.earliest), to: day(estimate.latest) })}</s-text>
        {estimate.leadDays > 2 && <s-text color="subdued">{t('ships', { date: day(estimate.shipsOn) })}</s-text>}
      </s-stack>
      {canSave && (
        <s-stack gap="small-200">
          <s-text>{t('pickDate')}</s-text>
          <s-date-picker
            type="single"
            value={chosen}
            allow={`${estimate.earliest}--${addDays(estimate.latest, 30)}`}
            disallowDays="saturday, sunday"
            onChange={onChange}
          />
          <s-text color="subdued">{t('pickDateHelp')}</s-text>
        </s-stack>
      )}
    </s-stack>
  );
}
