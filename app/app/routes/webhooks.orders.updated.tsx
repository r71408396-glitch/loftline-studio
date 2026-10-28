import type { ActionFunctionArgs } from "react-router";
import { handleWebhook } from "../models/webhooks.server";
import { upsertBuildsFromOrder, type OrderWebhookPayload } from "../models/builds.server";

// Order edits can add, change or remove parts; refresh the build sheets (stages are kept).
export const action = async ({ request }: ActionFunctionArgs) =>
  handleWebhook(request, async ({ shop, payload }) => {
    const count = await upsertBuildsFromOrder(shop, payload as OrderWebhookPayload);
    return count ? `${count} build sheet(s) refreshed` : undefined;
  });
