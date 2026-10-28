import type { ActionFunctionArgs } from "react-router";
import { handleWebhook } from "../models/webhooks.server";

// Stock changes are logged for now; back-in-stock emails hook in here.
export const action = async ({ request }: ActionFunctionArgs) =>
  handleWebhook(request, async ({ payload }) => {
    const level = payload as { inventory_item_id?: number; available?: number | null };
    return `Item ${level.inventory_item_id}: ${level.available ?? "untracked"} available`;
  });
