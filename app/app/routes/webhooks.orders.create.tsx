import type { ActionFunctionArgs } from "react-router";
import { handleWebhook } from "../models/webhooks.server";
import { upsertBuildsFromOrder, type OrderWebhookPayload } from "../models/builds.server";

// A new order: every configured desk on it joins the production queue.
export const action = async ({ request }: ActionFunctionArgs) =>
  handleWebhook(request, async ({ shop, payload }) => {
    const count = await upsertBuildsFromOrder(shop, payload as OrderWebhookPayload);
    return count ? `${count} build(s) queued` : "No desks on this order";
  });
