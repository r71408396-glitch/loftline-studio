import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { handleWebhook } from "../models/webhooks.server";

// Webhooks can arrive more than once and after the app is gone; deleting is safe to repeat.
export const action = async ({ request }: ActionFunctionArgs) =>
  handleWebhook(request, async ({ shop }) => {
    await db.session.deleteMany({ where: { shop } });
    await db.shopSettings.deleteMany({ where: { shop } });
    return "Sessions and settings removed";
  });
