import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { moveBuild, sheetOf } from "../models/builds.server";
import { STAGES, STAGE_LABELS, isStage, type Stage } from "../lib/stages";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const build = await db.build.findFirst({
    where: { id: params.id, shop: session.shop },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  if (!build) throw new Response("Build not found", { status: 404 });

  return {
    id: build.id,
    buildNumber: build.buildNumber,
    orderName: build.orderName,
    orderId: build.orderId.split("/").pop(),
    stage: build.stage as Stage,
    sheet: sheetOf(build),
    events: build.events.map((e) => ({ id: e.id, from: e.fromStage, to: e.toStage, emailed: e.emailed, at: e.createdAt.toISOString() })),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const to = (await request.formData()).get("to");
  if (!isStage(to)) return { ok: false, error: "Unknown stage" };
  try {
    await moveBuild(admin, session.shop, String(params.id), to);
    return { ok: true, message: `Moved to ${STAGE_LABELS[to]}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export default function BuildPage() {
  const { id, buildNumber, orderName, orderId, stage, sheet, events } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show(fetcher.data.message ?? "Saved");
    else shopify.toast.show(fetcher.data.error ?? "Something went wrong", { isError: true });
  }, [fetcher.data, shopify]);

  // The PDF route needs the session token App Bridge adds to fetch, so fetch it and open the file.
  // The window opens on the click itself (a window opened after an await counts as a popup and
  // is blocked); if it is blocked anyway, the file downloads instead.
  const openPdf = async () => {
    setPdfLoading(true);
    const win = window.open("", "_blank");
    try {
      const response = await fetch(`/app/builds/${id}/pdf`);
      if (!response.ok) throw new Error(`Build sheet failed (${response.status})`);
      const url = URL.createObjectURL(await response.blob());
      if (win) {
        win.location.href = url;
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = `build-sheet-${buildNumber}.pdf`;
        link.click();
      }
    } catch (error) {
      win?.close();
      shopify.toast.show(error instanceof Error ? error.message : "Build sheet failed", { isError: true });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <s-page heading={`Build ${buildNumber}`}>
      <s-link slot="breadcrumb-actions" href="/app/queue">
        Production queue
      </s-link>
      <s-button slot="primary-action" onClick={openPdf} {...(pdfLoading ? { loading: true } : {})}>
        Build sheet (PDF)
      </s-button>
      <s-button slot="secondary-actions" href={`shopify://admin/orders/${orderId}`} target="_top">
        Open order {orderName}
      </s-button>

      {sheet.problems.length > 0 && (
        <s-banner tone="critical" heading="Check this build">
          <s-paragraph>{sheet.problems.join(" ")}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Stage">
        <s-stack direction="inline" gap="small-200">
          {STAGES.map((s) => (
            <s-button
              key={s}
              variant={s === stage ? "primary" : "secondary"}
              disabled={s === stage}
              onClick={() => fetcher.submit({ to: s }, { method: "POST" })}
            >
              {STAGE_LABELS[s]}
            </s-button>
          ))}
        </s-stack>
      </s-section>

      {sheet.top && (
        <s-section heading="Desk top">
          <s-paragraph>
            {sheet.top.material}, {sheet.top.finishedSizeMm} mm. {sheet.top.edge}, corners {sheet.top.cornerRadiusMm} mm. {sheet.top.core}.
          </s-paragraph>
        </s-section>
      )}
      {sheet.frame && (
        <s-section heading="Frame">
          <s-paragraph>
            {sheet.frame.colour}, powder coat {sheet.frame.ral}. Cross beam set to {sheet.frame.crossBeamMm} mm.
          </s-paragraph>
        </s-section>
      )}
      {sheet.accessories.length > 0 && (
        <s-section heading="Accessories">
          <s-unordered-list>
            {sheet.accessories.map((a) => (
              <s-list-item key={a.sku}>
                {a.quantity} x {a.name}
              </s-list-item>
            ))}
          </s-unordered-list>
        </s-section>
      )}
      {sheet.delivery && (
        <s-section heading="Delivery">
          <s-paragraph>
            {sheet.delivery.assembly ? "Assembly at home booked." : "No assembly at home."} Preferred delivery day:{" "}
            {sheet.delivery.preferredDate ?? "none chosen"}.
          </s-paragraph>
        </s-section>
      )}

      <s-section slot="aside" heading="History">
        {events.length === 0 ? (
          <s-paragraph>Queued, not started.</s-paragraph>
        ) : (
          <s-stack gap="small-200">
            {events.map((e) => (
              <s-text key={e.id}>
                {new Date(e.at).toLocaleString()}: {STAGE_LABELS[e.to as Stage] ?? e.to}
                {e.emailed ? " (customer emailed)" : ""}
              </s-text>
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
