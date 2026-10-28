import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { DeliveryError, deliveryWindow } from "../lib/delivery";

// Storefront: the "Delivery date" app block calls /apps/loftline/delivery,
// which Shopify's app proxy forwards here with a signature that
// authenticate.public.appProxy checks.
// ?zip=43215&country=US&lead=10
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
  const params = new URL(request.url).searchParams;

  try {
    const window = deliveryWindow({
      country: params.get("country") || "US",
      postalCode: params.get("zip") || "",
      leadDays: Number(params.get("lead") || 0),
    });
    return Response.json(window, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    if (error instanceof DeliveryError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
};
