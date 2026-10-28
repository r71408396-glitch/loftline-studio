import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getSettings, loadDeskCatalog, syncFunctions } from "../models/functions.server";
import { buildBundleConfig, configSize, type Tier } from "../lib/price-table";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [settings, catalog] = await Promise.all([getSettings(session.shop), loadDeskCatalog(admin)]);
  const preview = buildBundleConfig(catalog, settings.tiers);

  return {
    tiers: settings.tiers,
    pricesSyncedAt: settings.pricesSyncedAt?.toISOString() ?? null,
    functionsReady: Boolean(settings.cartTransformId && settings.discountId),
    size: configSize(preview),
    parts: Object.entries(preview.components).map(([id, c]) => ({ id, ...c })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const tiers: Tier[] = [1, 2].map((n) => ({
    count: Number(form.get(`tier${n}Count`)),
    percent: Number(form.get(`tier${n}Percent`)),
  }));
  try {
    const result = await syncFunctions(admin, session.shop, tiers);
    return { ok: true, done: result.done };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

const KIND_LABEL = { top: "Desk top", frame: "Frame", accessory: "Accessory" } as const;

export default function Rules() {
  const { tiers, pricesSyncedAt, functionsReady, size, parts } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [tier1, tier2] = [tiers[0] ?? { count: 1, percent: 0 }, tiers[1] ?? { count: 3, percent: 0 }];
  const [filter, setFilter] = useState<"all" | "top" | "frame" | "accessory">("all");
  const saving = fetcher.state !== "idle";

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show(fetcher.data.done?.at(-1) ?? "Saved");
    else shopify.toast.show(fetcher.data.error ?? "Something went wrong", { isError: true });
  }, [fetcher.data, shopify]);

  const shown = parts.filter((p) => filter === "all" || p.kind === filter);

  return (
    <s-page heading="Configurator rules">
      <fetcher.Form method="post">
        <s-section heading="Accessory discount">
          <s-paragraph>
            With a desk in the cart, accessories get these discounts. The configurator and the cart show the same tiers (set them in the
            theme's Accessory discount settings too).
          </s-paragraph>
          <s-grid gridTemplateColumns="repeat(4, 1fr)" gap="base">
            <s-number-field label="First tier: accessories" name="tier1Count" defaultValue={String(tier1.count)} min={1} max={10} />
            <s-number-field label="First tier: % off" name="tier1Percent" defaultValue={String(tier1.percent)} min={0} max={50} suffix="%" />
            <s-number-field label="Second tier: accessories" name="tier2Count" defaultValue={String(tier2.count)} min={1} max={10} />
            <s-number-field label="Second tier: % off" name="tier2Percent" defaultValue={String(tier2.percent)} min={0} max={50} suffix="%" />
          </s-grid>
        </s-section>

        <s-section heading="Prices sent to checkout">
          <s-paragraph>
            When a desk is added as one line, checkout prices each part from this table, never from the cart. Prices come from the products;
            saving sends the current ones. {pricesSyncedAt ? `Last sent ${new Date(pricesSyncedAt).toLocaleString()}.` : "Not sent yet."}{" "}
            {parts.length} parts, {Math.round(size / 102.4) / 10} KB.
          </s-paragraph>
          <s-button type="submit" variant="primary" {...(saving ? { loading: true } : {})}>
            {functionsReady ? "Save and send prices" : "Set up desk bundles and discounts"}
          </s-button>
        </s-section>
      </fetcher.Form>

      <s-section heading="Parts" padding="none">
        <s-box padding="base">
          <s-stack direction="inline" gap="small-200">
            {(["all", "top", "frame", "accessory"] as const).map((k) => (
              <s-button key={k} variant={filter === k ? "primary" : "secondary"} onClick={() => setFilter(k)}>
                {k === "all" ? "All" : KIND_LABEL[k]}
              </s-button>
            ))}
          </s-stack>
        </s-box>
        <s-table>
          <s-table-header-row>
            <s-table-header>Part</s-table-header>
            <s-table-header>Type</s-table-header>
            <s-table-header format="numeric">Price</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {shown.map((p) => (
              <s-table-row key={p.id}>
                <s-table-cell>{p.title}</s-table-cell>
                <s-table-cell>{KIND_LABEL[p.kind]}</s-table-cell>
                <s-table-cell>{p.price}</s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
