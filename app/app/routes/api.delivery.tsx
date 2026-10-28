import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { DeliveryError, deliveryWindow } from "../lib/delivery";

// Checkout: the delivery date extension calls this with its session token;
// authenticate.public.checkout verifies it and answers the CORS preflight.
// ?zip=43215&country=US&lead=10
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { cors } = await authenticate.public.checkout(request);
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
