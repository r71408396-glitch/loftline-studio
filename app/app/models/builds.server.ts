// Production queue: creates builds from orders and moves them through the
// stages, mirroring each stage on the Shopify order (tag + metafield) and
// telling the customer by email.
import db from '../db.server';
import { buildSheet, buildsFromLineItems, deliveryForBuilds, type BuildSheet, type OrderLineItem } from '../lib/builds';
import { STAGE_EMAILS, STAGE_LABELS, tagChanges, type Stage } from '../lib/stages';
import { adminQuery, assertNoUserErrors, type AdminApi } from './admin.server';
import { sendCustomerEmail } from './email.server';

// The order as it arrives in an orders/create or orders/updated webhook (REST format).
export type OrderWebhookPayload = {
  admin_graphql_api_id: string;
  name: string;
  email?: string | null;
  contact_email?: string | null;
  note_attributes?: { name: string; value: string | null }[];
  line_items: {
    admin_graphql_api_id: string;
    name: string;
    sku: string | null;
    quantity: number;
    variant_title: string | null;
    properties?: { name: string; value: string | null }[];
  }[];
};

export function lineItemsFromPayload(order: OrderWebhookPayload): OrderLineItem[] {
  return order.line_items.map((line) => ({
    id: line.admin_graphql_api_id,
    name: line.name,
    sku: line.sku,
    quantity: line.quantity,
    variantTitle: line.variant_title,
    customAttributes: (line.properties ?? []).map((p) => ({ key: p.name, value: p.value })),
    product: null,
  }));
}

/** Creates (or refreshes) a build for every configured desk on the order. Returns how many. */
export async function upsertBuildsFromOrder(shop: string, order: OrderWebhookPayload): Promise<number> {
  const lines = lineItemsFromPayload(order);
  const builds = buildsFromLineItems(lines);
  const attributes = (order.note_attributes ?? []).map((a) => ({ key: a.name, value: a.value }));
  const deliveries = deliveryForBuilds(builds, lines, attributes);
  for (const [i, build] of builds.entries()) {
    const sheet = buildSheet(build, order.name, deliveries[i]);
    const customerEmail = order.email || order.contact_email || null;
    await db.build.upsert({
      where: { shop_buildNumber: { shop, buildNumber: build.buildNumber } },
      create: {
        shop,
        orderId: order.admin_graphql_api_id,
        orderName: order.name,
        buildNumber: build.buildNumber,
        quantity: build.quantity,
        customerEmail,
        sheet,
      },
      // Order edits can change parts; the stage stays where the workshop left it.
      update: { orderName: order.name, quantity: build.quantity, customerEmail, sheet },
    });
  }
  return builds.length;
}

const UPDATE_ORDER_STAGE = `#graphql
  mutation LoftlineOrderStage($id: ID!, $add: [String!]!, $remove: [String!]!, $metafields: [MetafieldsSetInput!]!) {
    tagsAdd(id: $id, tags: $add) {
      userErrors {
        message
      }
    }
    tagsRemove(id: $id, tags: $remove) {
      userErrors {
        message
      }
    }
    metafieldsSet(metafields: $metafields) {
      userErrors {
        field
        message
      }
    }
  }`;

export async function moveBuild(admin: AdminApi, shop: string, buildId: string, to: Stage) {
  const build = await db.build.findFirstOrThrow({ where: { id: buildId, shop } });
  if (build.stage === to) return build;

  // Shopify first, so the order and the queue never disagree.
  const tags = tagChanges(to);
  const data: any = await adminQuery(admin, UPDATE_ORDER_STAGE, {
    id: build.orderId,
    add: tags.add,
    remove: tags.remove,
    metafields: [
      {
        ownerId: build.orderId,
        namespace: 'loftline',
        key: 'production_stage',
        type: 'single_line_text_field',
        value: `${STAGE_LABELS[to]} (${build.buildNumber})`,
      },
    ],
  });
  assertNoUserErrors(data.tagsAdd, 'Tagging the order');
  assertNoUserErrors(data.tagsRemove, 'Updating order tags');
  assertNoUserErrors(data.metafieldsSet, 'Saving the stage on the order');

  let emailed = false;
  const email = STAGE_EMAILS[to];
  if (email) {
    try {
      emailed = await sendCustomerEmail(build.customerEmail, email.subject, email.body.replace('{build}', build.buildNumber));
    } catch (error) {
      console.error(`Stage email for ${build.buildNumber} failed`, error);
    }
  }

  return db.build.update({
    where: { id: build.id },
    data: { stage: to, events: { create: { fromStage: build.stage, toStage: to, emailed } } },
  });
}

export const sheetOf = (build: { sheet: unknown }) => build.sheet as BuildSheet;
