import type { ActionFunctionArgs } from "react-router";
import { handleWebhook } from "../models/webhooks.server";
import { getSettings, syncFunctions } from "../models/functions.server";

// A variant price changed (Events subscription in shopify.app.toml): send the new
// prices to the desk bundle Function, so checkout never uses an old price.
export const action = async ({ request }: ActionFunctionArgs) =>
  handleWebhook(request, async ({ shop, admin }) => {
    const settings = await getSettings(shop);
    if (!admin || !settings.cartTransformId) return "Functions not set up; nothing to update";
    const result = await syncFunctions(admin, shop);
    return result.done.at(-1);
  });
