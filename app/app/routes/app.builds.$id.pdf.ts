import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sheetOf } from "../models/builds.server";
import { renderBuildSheetPdf } from "../lib/build-sheet-pdf";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const build = await db.build.findFirst({ where: { id: params.id, shop: session.shop } });
  if (!build) throw new Response("Build not found", { status: 404 });

  const pdf = await renderBuildSheetPdf(sheetOf(build));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="build-sheet-${build.buildNumber}.pdf"`,
    },
  });
};
