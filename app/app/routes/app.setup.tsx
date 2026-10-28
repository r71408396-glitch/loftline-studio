import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { setupStore } from "../setup/store-setup.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const result = await setupStore(admin, { reuploadImages: form.get("images") === "on" });
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), log: [] as string[] };
  }
};

export default function StoreSetup() {
  const fetcher = useFetcher<typeof action>();
  const running = fetcher.state !== "idle";
  const data = fetcher.data;

  return (
    <s-page heading="Store setup">
      <s-section heading="Products, pages and menus from the catalogue">
        <s-paragraph>
          Creates or updates the desk parts, accessories and services with their photos, stock, specs and subscriptions, plus materials,
          FAQ entries, collections, pages and the main and footer menus. Running it again updates prices, stock and specs and doesn't
          duplicate anything.
        </s-paragraph>
        <fetcher.Form method="post">
          <s-stack gap="base">
            <s-checkbox name="images" label="Upload photos again for products that already have some" />
            <s-button type="submit" variant="primary" {...(running ? { loading: true } : {})}>
              Run store setup
            </s-button>
          </s-stack>
        </fetcher.Form>
      </s-section>

      {data && !data.ok && "error" in data && (
        <s-banner tone="critical" heading="Setup stopped">
          <s-paragraph>{data.error}</s-paragraph>
        </s-banner>
      )}

      {data && data.log.length > 0 && (
        <s-section heading="What was done">
          <s-stack gap="small-200">
            {data.log.map((line, i) => (
              <s-text key={i}>{line}</s-text>
            ))}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
