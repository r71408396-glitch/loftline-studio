import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { moveBuild, sheetOf } from "../models/builds.server";
import { STAGES, STAGE_LABELS, isStage, nextStage, type Stage } from "../lib/stages";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const filter = new URL(request.url).searchParams.get("stage");
  const stage = isStage(filter) ? filter : null;

  const builds = await db.build.findMany({
    where: { shop: session.shop, ...(stage ? { stage } : { stage: { not: "shipped" } }) },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return {
    stage,
    builds: builds.map((b) => {
      const sheet = sheetOf(b);
      return {
        id: b.id,
        buildNumber: b.buildNumber,
        orderName: b.orderName,
        stage: b.stage as Stage,
        quantity: b.quantity,
        top: sheet.top ? `${sheet.top.material}, ${sheet.top.finishedSizeMm} mm` : "Top missing",
        frame: sheet.frame ? sheet.frame.colour : "Frame missing",
        problems: sheet.problems.length,
        createdAt: b.createdAt.toISOString(),
      };
    }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const to = form.get("to");
  if (!isStage(to)) return { ok: false, error: "Unknown stage" };
  try {
    const build = await moveBuild(admin, session.shop, String(form.get("buildId")), to);
    return { ok: true, message: `${build.buildNumber} moved to ${STAGE_LABELS[to]}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export default function Queue() {
  const { builds, stage } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show(fetcher.data.message ?? "Saved");
    else shopify.toast.show(fetcher.data.error ?? "Something went wrong", { isError: true });
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="Production queue">
      <s-section>
        <s-stack direction="inline" gap="small-200">
          <s-button variant={stage ? "secondary" : "primary"} onClick={() => setSearchParams({})}>
            In production
          </s-button>
          {STAGES.map((s) => (
            <s-button key={s} variant={stage === s ? "primary" : "secondary"} onClick={() => setSearchParams({ stage: s })}>
              {STAGE_LABELS[s]}
            </s-button>
          ))}
        </s-stack>
      </s-section>

      <s-section padding="none">
        {builds.length === 0 ? (
          <s-box padding="base">
            <s-paragraph>No desks here.</s-paragraph>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Build</s-table-header>
              <s-table-header>Order</s-table-header>
              <s-table-header>Top</s-table-header>
              <s-table-header>Frame</s-table-header>
              <s-table-header>Stage</s-table-header>
              <s-table-header>Next</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {builds.map((b) => {
                const next = nextStage(b.stage);
                const busy = fetcher.state !== "idle" && fetcher.formData?.get("buildId") === b.id;
                return (
                  <s-table-row key={b.id}>
                    <s-table-cell>
                      <s-link href={`/app/builds/${b.id}`}>{b.buildNumber}</s-link>
                      {b.quantity > 1 && <s-text color="subdued"> x {b.quantity}</s-text>}
                    </s-table-cell>
                    <s-table-cell>{b.orderName}</s-table-cell>
                    <s-table-cell>{b.top}</s-table-cell>
                    <s-table-cell>{b.frame}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone={b.problems ? "critical" : b.stage === "shipped" ? "success" : "info"}>
                        {b.problems ? "Check parts" : STAGE_LABELS[b.stage]}
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      {next && (
                        <s-button
                          {...(busy ? { loading: true } : {})}
                          onClick={() => fetcher.submit({ buildId: b.id, to: next }, { method: "POST" })}
                        >
                          {STAGE_LABELS[next]}
                        </s-button>
                      )}
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
