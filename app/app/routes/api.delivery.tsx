import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { DeliveryError, deliveryWindow } from "../lib/delivery";

// Checkout: the delivery date extension calls this with its session token;
// authenticate.public.checkout verifies it and answers the CORS preflight.
// ?zip=43215&country=US&lead=10
export const loader = async ({ request }: LoaderFunctionArgs) => {
  let cors;
  try {
    ({ cors } = await authenticate.public.checkout(request));
  } catch (error) {
    // A rejected token comes back without CORS headers, which checkout only sees as a failed fetch.
    // Other thrown responses (the 204 answer to the CORS preflight) pass through unchanged.
    if (!(error instanceof Response) || error.status < 400) throw error;
    console.warn(`Delivery estimate: checkout request rejected (${error.status})`);
    const headers = new Headers(error.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    return Response.json({ error: "Unauthorized" }, { status: error.status, headers });
  }
  const params = new URL(request.url).searchParams;

  try {
    const window = deliveryWindow({
      country: params.get("country") || "US",
      postalCode: params.get("zip") || "",
      leadDays: Number(params.get("lead") || 0),
    });
    return cors(Response.json(window));
  } catch (error) {
    if (error instanceof DeliveryError) return cors(Response.json({ error: error.message }, { status: 400 }));
    throw error;
  }
};
