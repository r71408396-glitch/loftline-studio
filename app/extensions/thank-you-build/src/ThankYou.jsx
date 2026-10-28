// Thank-you page: for each configured desk in the order, its build number and
// what happens next (the production stages Loftline Ops emails about), plus the
// assembly video. Orders without a desk show nothing.
import '@shopify/ui-extensions/preact';
import { render } from 'preact';

export default async () => {
  render(<ThankYou />, document.body);
};

const STEPS = ['stepCutting', 'stepAssembly', 'stepCheck', 'stepShipped'];

function ThankYou() {
  const t = (key, values) => shopify.i18n.translate(key, values);
  const builds = [
    ...new Set(shopify.lines.value.flatMap((line) => line.attributes.filter((a) => a.key === '_build').map((a) => a.value))),
  ];
  if (!builds.length) return null;

  const video = shopify.settings.value.assembly_video_url ? String(shopify.settings.value.assembly_video_url) : null;

  return (
    <s-section heading={t('heading', { count: builds.length })}>
      <s-stack gap="base">
        <s-text>{t('intro', { builds: builds.join(', ') })}</s-text>
        <s-ordered-list>
          {STEPS.map((step) => (
            <s-list-item key={step}>{t(step)}</s-list-item>
          ))}
        </s-ordered-list>
        {video && (
          <s-link href={video} target="_blank">
            {t('video')}
          </s-link>
        )}
      </s-stack>
    </s-section>
  );
}
