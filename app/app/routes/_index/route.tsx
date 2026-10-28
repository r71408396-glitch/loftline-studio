import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import styles from "./styles.module.css";

// What someone sees opening the app's address directly. The app itself runs
// inside the Shopify admin; a request carrying ?shop= goes straight there.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function App() {
  return (
    <main className={styles.index}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>Loftline Studio</p>
        <h1 className={styles.heading}>Loftline Ops</h1>
        <p className={styles.text}>
          The workshop app behind Loftline Studio's made-to-order standing desks. It runs inside the
          Shopify admin, where staff open it from Apps &gt; Loftline Ops.
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Production queue.</strong> Every desk on an order becomes a build with its own
            build sheet, moved through cutting, assembly, quality check and shipping.
          </li>
          <li>
            <strong>Desk bundles and discounts.</strong> Shopify Functions price a configured desk
            from its parts and give accessory discounts with a desk in the cart.
          </li>
          <li>
            <strong>Delivery dates.</strong> Lead time and carrier transit to the customer's ZIP or
            postcode, on the product page and in checkout.
          </li>
        </ul>
      </div>
    </main>
  );
}
