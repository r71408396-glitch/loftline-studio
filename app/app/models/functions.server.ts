// Keeps the two Functions set up on the shop and their configuration current:
// creates the cart transform and the automatic discount if missing, and writes
// the price table and tiers into their $app:function-configuration metafields.
import db from '../db.server';
import {
  buildBundleConfig,
  buildDiscountConfig,
  configSize,
  DEFAULT_TIERS,
  normaliseTiers,
  type CatalogProduct,
  type Tier,
} from '../lib/price-table';
import { adminQuery, assertNoUserErrors, type AdminApi } from './admin.server';

const BUNDLE_HANDLE = 'desk-bundle';
const DISCOUNT_HANDLE = 'accessory-tiers';
const CONFIG = { namespace: '$app', key: 'function-configuration', type: 'json' } as const;

const DESK_PRODUCTS = `#graphql
  query LoftlineDeskProducts($cursor: String) {
    products(first: 50, after: $cursor, query: "product_type:'Desk top' OR product_type:'Desk frame' OR product_type:Accessory") {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        productType
        variants(first: 100) {
          nodes {
            id
            sku
            price
            title
          }
        }
      }
    }
  }`;

export async function loadDeskCatalog(admin: AdminApi): Promise<CatalogProduct[]> {
  const products: CatalogProduct[] = [];
  let cursor: string | null = null;
  do {
    const data: any = await adminQuery(admin, DESK_PRODUCTS, { cursor });
    for (const node of data.products.nodes) {
      products.push({ id: node.id, title: node.title, productType: node.productType, variants: node.variants.nodes });
    }
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);
  return products;
}

export async function getSettings(shop: string) {
  const settings = await db.shopSettings.findUnique({ where: { shop } });
  return {
    tiers: (settings?.tiers as Tier[] | undefined) ?? DEFAULT_TIERS,
    cartTransformId: settings?.cartTransformId ?? null,
    discountId: settings?.discountId ?? null,
    pricesSyncedAt: settings?.pricesSyncedAt ?? null,
    pricesSyncedSize: settings?.pricesSyncedSize ?? null,
  };
}

const FIND_CART_TRANSFORM = `#graphql
  query LoftlineCartTransforms {
    cartTransforms(first: 10) {
      nodes {
        id
        functionId
      }
    }
  }`;

const CREATE_CART_TRANSFORM = `#graphql
  mutation LoftlineCreateCartTransform($handle: String!, $metafields: [MetafieldInput!]) {
    cartTransformCreate(functionHandle: $handle, blockOnFailure: false, metafields: $metafields) {
      cartTransform {
        id
      }
      userErrors {
        field
        message
      }
    }
  }`;

const CREATE_DISCOUNT = `#graphql
  mutation LoftlineCreateTierDiscount($discount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $discount) {
      automaticAppDiscount {
        discountId
      }
      userErrors {
        field
        message
      }
    }
  }`;

const FIND_DISCOUNT = `#graphql
  query LoftlineFindTierDiscount($id: ID!) {
    discountNode(id: $id) {
      id
    }
  }`;

const SET_METAFIELDS = `#graphql
  mutation LoftlineSetFunctionConfig($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
      }
      userErrors {
        field
        message
      }
    }
  }`;

/**
 * Creates the Functions' shop objects if needed and writes fresh configuration.
 * Returns what was done, for the admin page.
 */
export async function syncFunctions(admin: AdminApi, shop: string, tiersInput?: Tier[]) {
  const settings = await getSettings(shop);
  const tiers = normaliseTiers(tiersInput ?? settings.tiers);
  const catalog = await loadDeskCatalog(admin);
  const bundleConfig = buildBundleConfig(catalog, tiers);
  const discountConfig = buildDiscountConfig(tiers);
  const done: string[] = [];

  // Cart transform: Shopify allows one per app per shop, so reuse the existing one.
  let cartTransformId = settings.cartTransformId;
  if (!cartTransformId) {
    const existing: any = await adminQuery(admin, FIND_CART_TRANSFORM);
    cartTransformId = existing.cartTransforms.nodes[0]?.id ?? null;
  }
  if (!cartTransformId) {
    const created: any = await adminQuery(admin, CREATE_CART_TRANSFORM, {
      handle: BUNDLE_HANDLE,
      metafields: [{ ...CONFIG, value: JSON.stringify(bundleConfig) }],
    });
    assertNoUserErrors(created.cartTransformCreate, 'Creating the desk bundle');
    cartTransformId = created.cartTransformCreate.cartTransform.id;
    done.push('Created the desk bundle cart transform');
  }

  // Automatic discount for the accessory tiers.
  let discountId = settings.discountId;
  if (discountId) {
    const found: any = await adminQuery(admin, FIND_DISCOUNT, { id: discountId });
    if (!found.discountNode) discountId = null;
  }
  if (!discountId) {
    const created: any = await adminQuery(admin, CREATE_DISCOUNT, {
      discount: {
        title: 'Desk set: accessory discount',
        functionHandle: DISCOUNT_HANDLE,
        discountClasses: ['PRODUCT'],
        startsAt: new Date().toISOString(),
        combinesWith: { orderDiscounts: true, productDiscounts: false, shippingDiscounts: true },
        metafields: [{ ...CONFIG, value: JSON.stringify(discountConfig) }],
      },
    });
    assertNoUserErrors(created.discountAutomaticAppCreate, 'Creating the accessory discount');
    discountId = created.discountAutomaticAppCreate.automaticAppDiscount.discountId;
    done.push('Created the accessory tier discount');
  }

  const result: any = await adminQuery(admin, SET_METAFIELDS, {
    metafields: [
      { ...CONFIG, ownerId: cartTransformId, value: JSON.stringify(bundleConfig) },
      { ...CONFIG, ownerId: discountId, value: JSON.stringify(discountConfig) },
    ],
  });
  assertNoUserErrors(result.metafieldsSet, 'Saving the Function settings');
  done.push(`Saved prices for ${Object.keys(bundleConfig.components).length} parts and ${tiers.length} discount tiers`);

  const size = configSize(bundleConfig);
  await db.shopSettings.upsert({
    where: { shop },
    create: { shop, tiers, cartTransformId, discountId, pricesSyncedAt: new Date(), pricesSyncedSize: size },
    update: { tiers, cartTransformId, discountId, pricesSyncedAt: new Date(), pricesSyncedSize: size },
  });

  return { done, bundleConfig, discountConfig };
}
