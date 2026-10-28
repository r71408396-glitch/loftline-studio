import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getSettings } from "../models/functions.server";
import { STAGES, STAGE_LABELS } from "../lib/stages";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [counts, recent, webhooks, settings] = await Promise.all([
    db.build.groupBy({ by: ["stage"], where: { shop }, _count: true }),
    db.build.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.webhookEvent.findMany({ where: { shop }, orderBy: { receivedAt: "desc" }, take: 8 }),
    getSettings(shop),
  ]);

  return {
    counts: Object.fromEntries(counts.map((c) => [c.stage, c._count])),
    recent: recent.map((b) => ({ id: b.id, buildNumber: b.buildNumber, orderName: b.orderName, stage: b.stage })),
    webhooks: webhooks.map((w) => ({ id: w.id, topic: w.topic, status: w.status, error: w.error, receivedAt: w.receivedAt.toISOString() })),
    functionsReady: Boolean(settings.cartTransformId && settings.discountId),
    pricesSyncedAt: settings.pricesSyncedAt?.toISOString() ?? null,
  };
};

export default function Overview() {
  const { counts, recent, webhooks, functionsReady, pricesSyncedAt } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Loftline Ops">
      <s-button slot="primary-action" href="/app/queue">
        Open production queue
      </s-button>

      {!functionsReady && (
        <s-banner tone="warning" heading="Desk bundles and accessory discounts aren't set up">
          <s-paragraph>
            Go to <s-link href="/app/rules">Configurator rules</s-link> and save once. That creates the cart transform and the
            automatic discount and sends them the current prices.
          </s-paragraph>
        </s-banner>
      )}

      <s-section heading="Desks in production">
        <s-grid gridTemplateColumns="repeat(5, 1fr)" gap="base">
          {STAGES.map((stage) => (
            <s-box key={stage} padding="base" background="subdued" borderRadius="base">
              <s-text color="subdued">{STAGE_LABELS[stage]}</s-text>
              <s-heading>{String(counts[stage] ?? 0)}</s-heading>
            </s-box>
          ))}
        </s-grid>
      </s-section>

      <s-section heading="Latest builds">
        {recent.length === 0 ? (
          <s-paragraph>No desk orders yet. Each order with a configured desk shows up here when it's placed.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Build</s-table-header>
              <s-table-header>Order</s-table-header>
              <s-table-header>Stage</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {recent.map((b) => (
                <s-table-row key={b.id}>
                  <s-table-cell>
                    <s-link href={`/app/builds/${b.id}`}>{b.buildNumber}</s-link>
                  </s-table-cell>
                  <s-table-cell>{b.orderName}</s-table-cell>
                  <s-table-cell>
                    <s-badge>{STAGE_LABELS[b.stage as keyof typeof STAGE_LABELS] ?? b.stage}</s-badge>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section slot="aside" heading="Prices sent to checkout">
        <s-paragraph>
          {pricesSyncedAt ? `Last sent ${new Date(pricesSyncedAt).toLocaleString()}` : "Not sent yet"}
        </s-paragraph>
        <s-link href="/app/rules">Configurator rules</s-link>
      </s-section>

      <s-section slot="aside" heading="Webhook log">
        {webhooks.length === 0 ? (
          <s-paragraph>Nothing received yet.</s-paragraph>
        ) : (
          <s-stack gap="small-200">
            {webhooks.map((w) => (
              <s-stack key={w.id} direction="inline" gap="small-200" alignItems="center">
                <s-badge tone={w.status === "processed" ? "success" : "critical"}>{w.status}</s-badge>
                <s-text>{w.topic}</s-text>
                <s-text color="subdued">{new Date(w.receivedAt).toLocaleTimeString()}</s-text>
              </s-stack>
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
