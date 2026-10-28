// Sets up a store from the files in data/: custom data definitions,
// materials and FAQ entries, products with photos and stock, subscriptions,
// collections, pages and menus. Every step looks up what already exists first,
// so running it again updates prices, stock and specs without duplicating anything.
import fs from 'node:fs';
import path from 'node:path';
import { adminQuery, assertNoUserErrors, type AdminApi } from '../models/admin.server';
import { productSetInput, richText, sellingPlanGroupInput, type Catalog, type CatalogProduct, type Plain } from './catalog';
import type {
  CollectionCreateInput,
  MenuItemCreateInput,
  MetafieldDefinitionInput,
  MetaobjectDefinitionCreateInput,
  MetaobjectUpsertInput,
  PageCreateInput,
  StagedUploadInput,
} from '../types/admin.types';

export type SetupOptions = {
  dataDir?: string;
  /** Upload photos even for products that already have media. */
  reuploadImages?: boolean;
  log?: (line: string) => void;
};

export type SetupResult = {
  products: number;
  assemblyVariantId: string | null;
  bundleVariantId: string | null;
  log: string[];
};

function resolveDataDir(dataDir?: string) {
  const candidates = [dataDir, process.env.LOFTLINE_DATA_DIR, path.resolve(process.cwd(), '../data'), path.resolve(process.cwd(), 'data')];
  const found = candidates.find((dir) => dir && fs.existsSync(path.join(dir, 'catalog.json')));
  if (!found) throw new Error('Could not find data/catalog.json; set LOFTLINE_DATA_DIR.');
  return found;
}

const readJson = (dir: string, file: string) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));

// ---------- Queries and mutations ----------

const LOCATION = `#graphql
  query LoftlineSetupLocation {
    locations(first: 5, query: "active:true") {
      nodes {
        id
        name
      }
    }
  }`;

const METAFIELD_DEFINITIONS = `#graphql
  query LoftlineSetupMetafieldDefinitions {
    metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: "specs") {
      nodes {
        key
      }
    }
  }`;

const CREATE_METAFIELD_DEFINITION = `#graphql
  mutation LoftlineSetupCreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

const METAOBJECT_DEFINITION = `#graphql
  query LoftlineSetupMetaobjectDefinition($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      id
    }
  }`;

const CREATE_METAOBJECT_DEFINITION = `#graphql
  mutation LoftlineSetupCreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

const UPSERT_METAOBJECT = `#graphql
  mutation LoftlineSetupUpsertMetaobject($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
    metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
      metaobject {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

const STAGED_UPLOADS = `#graphql
  mutation LoftlineSetupStagedUploads($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }`;

const PRODUCT_BY_HANDLE = `#graphql
  query LoftlineSetupProduct($handle: String!) {
    productByIdentifier(identifier: { handle: $handle }) {
      id
      media(first: 1) {
        nodes {
          id
        }
      }
      sellingPlanGroups(first: 5) {
        nodes {
          merchantCode
        }
      }
    }
  }`;

const PRODUCT_SET = `#graphql
  mutation LoftlineSetupProductSet($handle: String!, $input: ProductSetInput!) {
    productSet(identifier: { handle: $handle }, input: $input, synchronous: true) {
      product {
        id
        variants(first: 1) {
          nodes {
            id
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

const CREATE_SELLING_PLAN_GROUP = `#graphql
  mutation LoftlineSetupSellingPlans($input: SellingPlanGroupInput!, $productIds: [ID!]!) {
    sellingPlanGroupCreate(input: $input, resources: { productIds: $productIds }) {
      sellingPlanGroup {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

const COLLECTION_BY_HANDLE = `#graphql
  query LoftlineSetupCollection($handle: String!) {
    collectionByIdentifier(identifier: { handle: $handle }) {
      id
    }
  }`;

const CREATE_COLLECTION = `#graphql
  mutation LoftlineSetupCreateCollection($collection: CollectionCreateInput!) {
    collectionCreate(collection: $collection) {
      collection {
        id
      }
      userErrors {
        field
        message
      }
    }
  }`;

const PUBLICATIONS = `#graphql
  query LoftlineSetupPublications {
    publications(first: 20) {
      nodes {
        id
        name
      }
    }
  }`;

const PUBLISH = `#graphql
  mutation LoftlineSetupPublish($id: ID!, $publicationId: ID!) {
    publishablePublish(id: $id, input: [{ publicationId: $publicationId }]) {
      userErrors {
        field
        message
      }
    }
  }`;

const PAGE_BY_HANDLE = `#graphql
  query LoftlineSetupPage($query: String!) {
    pages(first: 1, query: $query) {
      nodes {
        id
        handle
      }
    }
  }`;

const CREATE_PAGE = `#graphql
  mutation LoftlineSetupCreatePage($page: PageCreateInput!) {
    pageCreate(page: $page) {
      page {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

const MENUS = `#graphql
  query LoftlineSetupMenus {
    menus(first: 20) {
      nodes {
        id
        handle
      }
    }
  }`;

const UPDATE_MENU = `#graphql
  mutation LoftlineSetupUpdateMenu($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
    menuUpdate(id: $id, title: $title, items: $items) {
      menu {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

const CREATE_MENU = `#graphql
  mutation LoftlineSetupCreateMenu($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
    menuCreate(title: $title, handle: $handle, items: $items) {
      menu {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }`;

// ---------- Steps ----------

export async function setupStore(admin: AdminApi, options: SetupOptions = {}): Promise<SetupResult> {
  const lines: string[] = [];
  const log = (line: string) => {
    lines.push(line);
    options.log?.(line);
  };
  const dir = resolveDataDir(options.dataDir);
  const catalog: Catalog = readJson(dir, 'catalog.json');
  const custom = readJson(dir, 'metafields.json');
  const content = readJson(dir, 'pages.json');

  // 1. Where stock is kept.
  const locations: any = await adminQuery(admin, LOCATION);
  const location = locations.locations.nodes[0];
  if (!location) throw new Error('The store has no active location for stock.');
  log(`Stock location: ${location.name}`);

  // 2. Materials and FAQ items (metaobjects), before the product fields that point at them.
  const definitionIds = new Map<string, string>();
  for (const def of custom.metaobjects) {
    const existing: any = await adminQuery(admin, METAOBJECT_DEFINITION, { type: def.type });
    let id = existing.metaobjectDefinitionByType?.id;
    if (!id) {
      const definition: Plain<MetaobjectDefinitionCreateInput> = {
        type: def.type,
        name: def.name,
        displayNameKey: def.fields[0].key,
        access: { storefront: def.storefront ? 'PUBLIC_READ' : 'NONE' },
        fieldDefinitions: def.fields.map((f: any) => ({ key: f.key, name: f.key.replace(/_/g, ' '), type: f.type, required: Boolean(f.required) })),
      };
      const created: any = await adminQuery(admin, CREATE_METAOBJECT_DEFINITION, { definition });
      assertNoUserErrors(created.metaobjectDefinitionCreate, `Creating the ${def.name} definition`);
      id = created.metaobjectDefinitionCreate.metaobjectDefinition.id;
      log(`Created metaobject definition: ${def.name}`);
    }
    definitionIds.set(def.type, id);
  }

  const materialIds = new Map<string, string>();
  const materials = custom.metaobjects.find((d: any) => d.type === 'material');
  for (const entry of materials.entries) {
    const { handle, ...fields } = entry;
    const metaobject: Plain<MetaobjectUpsertInput> = { fields: Object.entries(fields).map(([key, value]) => ({ key, value: String(value) })) };
    const result: any = await adminQuery(admin, UPSERT_METAOBJECT, { handle: { type: 'material', handle }, metaobject });
    assertNoUserErrors(result.metaobjectUpsert, `Saving material ${handle}`);
    materialIds.set(handle, result.metaobjectUpsert.metaobject.id);
  }
  log(`Materials saved: ${materialIds.size}`);

  for (const item of content.faq) {
    const metaobject: Plain<MetaobjectUpsertInput> = {
      fields: [
        { key: 'question', value: item.question },
        { key: 'answer', value: richText(item.answer) },
        { key: 'topic', value: item.topic },
      ],
    };
    const result: any = await adminQuery(admin, UPSERT_METAOBJECT, { handle: { type: 'faq_item', handle: item.handle }, metaobject });
    assertNoUserErrors(result.metaobjectUpsert, `Saving FAQ ${item.handle}`);
  }
  log(`FAQ entries saved: ${content.faq.length}`);

  // 3. Product fields (specs.*), shown and filterable in the admin.
  const existingDefs: any = await adminQuery(admin, METAFIELD_DEFINITIONS);
  const haveKeys = new Set(existingDefs.metafieldDefinitions.nodes.map((n: any) => n.key));
  for (const def of custom.product_metafields) {
    if (haveKeys.has(def.key)) continue;
    const definition: Plain<MetafieldDefinitionInput> = {
      namespace: def.namespace,
      key: def.key,
      name: def.name,
      type: def.type,
      ownerType: 'PRODUCT',
      description: def.description,
      pin: Boolean(def.pin),
      access: { storefront: 'PUBLIC_READ' },
      ...(def.type === 'metaobject_reference'
        ? { validations: [{ name: 'metaobject_definition_id', value: definitionIds.get(def.metaobject) ?? '' }] }
        : {}),
    };
    const created: any = await adminQuery(admin, CREATE_METAFIELD_DEFINITION, { definition });
    assertNoUserErrors(created.metafieldDefinitionCreate, `Creating field specs.${def.key}`);
    log(`Created product field: specs.${def.key}`);
  }

  // 4. Products: photos are uploaded only for products without media (or when asked).
  const imagesDir = path.join(dir, 'images');
  let assemblyVariantId: string | null = null;
  let bundleVariantId: string | null = null;
  const productIds = new Map<string, string>();

  for (const product of catalog.products) {
    const existing: any = await adminQuery(admin, PRODUCT_BY_HANDLE, { handle: product.handle });
    const hasMedia = Boolean(existing.productByIdentifier?.media.nodes.length);
    const imageUrls = !hasMedia || options.reuploadImages ? await uploadImages(admin, product, imagesDir) : null;

    const input = productSetInput(product, { locationId: location.id, imageUrls, materialIds });
    const result: any = await adminQuery(admin, PRODUCT_SET, { handle: product.handle, input });
    assertNoUserErrors(result.productSet, `Saving ${product.title}`);
    const saved = result.productSet.product;
    productIds.set(product.handle, saved.id);
    if (product.handle === 'assembly-at-home') assemblyVariantId = saved.variants.nodes[0]?.id ?? null;
    if (product.handle === 'custom-desk') bundleVariantId = saved.variants.nodes[0]?.id ?? null;
    log(`${existing.productByIdentifier ? 'Updated' : 'Created'} ${product.title} (${input.variants?.length ?? 0} variants${imageUrls?.size ? `, ${imageUrls.size} photos` : ''})`);

    // Subscriptions (selling plans) on refills.
    if (product.selling_plans) {
      const group = sellingPlanGroupInput(product);
      const codes = existing.productByIdentifier?.sellingPlanGroups.nodes.map((n: any) => n.merchantCode) ?? [];
      if (!codes.includes(group.merchantCode)) {
        const created: any = await adminQuery(admin, CREATE_SELLING_PLAN_GROUP, { input: group, productIds: [saved.id] });
        assertNoUserErrors(created.sellingPlanGroupCreate, `Adding subscriptions to ${product.title}`);
        log(`Added subscriptions to ${product.title}`);
      }
    }
  }

  // 5. Collections the theme links to.
  // Automatic membership by product type (the 2026-10 "sources" form of a smart collection).
  const byType = (handle: string, title: string, types: string[]): Plain<CollectionCreateInput> => ({
    handle,
    title,
    sources: [{ source: { title: `Product type: ${types.join(' or ')}`, inclusion: { matchType: 'ANY', conditions: [{ productType: { relation: 'EQUALS', matchType: 'ANY', values: types } }] } } }],
  });
  const collections = [byType('accessories', 'Accessories', ['Accessory']), byType('desk-parts', 'Desk tops and frames', ['Desk top', 'Desk frame'])];
  const collectionIds = new Map<string, string>();
  for (const c of collections) {
    const found: any = await adminQuery(admin, COLLECTION_BY_HANDLE, { handle: c.handle });
    let id = found.collectionByIdentifier?.id;
    if (!id) {
      const created: any = await adminQuery(admin, CREATE_COLLECTION, { collection: c });
      assertNoUserErrors(created.collectionCreate, `Creating ${c.title}`);
      id = created.collectionCreate.collection.id;
      log(`Created collection: ${c.title}`);
    }
    collectionIds.set(c.handle!, id);
  }

  // 6. Make products and collections visible in the online store.
  const publications: any = await adminQuery(admin, PUBLICATIONS);
  const onlineStore = publications.publications.nodes.find((p: any) => p.name === 'Online Store');
  if (onlineStore) {
    for (const id of [...productIds.values(), ...collectionIds.values()]) {
      const published: any = await adminQuery(admin, PUBLISH, { id, publicationId: onlineStore.id });
      assertNoUserErrors(published.publishablePublish, 'Publishing to the online store');
    }
    log('Published products and collections to the online store');
  } else {
    log('No Online Store sales channel found; products were not published');
  }

  // 7. Pages.
  const pageIds = new Map<string, string>();
  for (const page of content.pages) {
    const found: any = await adminQuery(admin, PAGE_BY_HANDLE, { query: `handle:${page.handle}` });
    let id = found.pages.nodes.find((n: any) => n.handle === page.handle)?.id;
    if (!id) {
      const input: Plain<PageCreateInput> = {
        title: page.title,
        handle: page.handle,
        body: page.body,
        isPublished: true,
        ...(page.template_suffix ? { templateSuffix: page.template_suffix } : {}),
      };
      const created: any = await adminQuery(admin, CREATE_PAGE, { page: input });
      assertNoUserErrors(created.pageCreate, `Creating page ${page.title}`);
      id = created.pageCreate.page.id;
      log(`Created page: ${page.title}`);
    }
    pageIds.set(page.handle, id);
  }

  // 8. Menus (main menu and footer), matching the theme's header and footer.
  const page = (title: string, handle: string): Plain<MenuItemCreateInput> => ({ title, type: 'PAGE', resourceId: pageIds.get(handle) });
  const menus: { handle: string; title: string; items: Plain<MenuItemCreateInput>[] }[] = [
    {
      handle: 'main-menu',
      title: 'Main menu',
      items: [
        page('Build a desk', 'build'),
        { title: 'Accessories', type: 'COLLECTION', resourceId: collectionIds.get('accessories') },
        page("How it's made", 'about'),
        page('Help', 'faq'),
      ],
    },
    {
      handle: 'footer',
      title: 'Footer menu',
      items: [page('Shipping and delivery', 'shipping'), page('Returns', 'returns'), page('Warranty', 'warranty'), page('Contact', 'contact')],
    },
  ];
  const existingMenus: any = await adminQuery(admin, MENUS);
  for (const menu of menus) {
    const found = existingMenus.menus.nodes.find((m: any) => m.handle === menu.handle);
    if (found) {
      const updated: any = await adminQuery(admin, UPDATE_MENU, { id: found.id, title: menu.title, items: menu.items });
      assertNoUserErrors(updated.menuUpdate, `Updating ${menu.title}`);
    } else {
      const created: any = await adminQuery(admin, CREATE_MENU, { title: menu.title, handle: menu.handle, items: menu.items });
      assertNoUserErrors(created.menuCreate, `Creating ${menu.title}`);
    }
    log(`Menu saved: ${menu.title}`);
  }

  log(`Done. Assembly variant for the checkout extension: ${assemblyVariantId ?? 'not found'}`);
  return { products: productIds.size, assemblyVariantId, bundleVariantId, log: lines };
}

// Staged upload: ask Shopify for an upload target, post the file there, and
// use the returned resource URL as the image source in productSet.
async function uploadImages(admin: AdminApi, product: CatalogProduct, imagesDir: string) {
  const images = (product.images ?? []).filter((image) => fs.existsSync(path.join(imagesDir, image.file)));
  const urls = new Map<string, string>();
  if (!images.length) return urls;

  const input: Plain<StagedUploadInput>[] = images.map((image) => ({
    filename: image.file,
    mimeType: 'image/webp',
    resource: 'IMAGE',
    httpMethod: 'POST',
    fileSize: String(fs.statSync(path.join(imagesDir, image.file)).size),
  }));
  const staged: any = await adminQuery(admin, STAGED_UPLOADS, { input });
  assertNoUserErrors(staged.stagedUploadsCreate, `Preparing photos for ${product.title}`);

  await Promise.all(
    staged.stagedUploadsCreate.stagedTargets.map(async (target: any, i: number) => {
      const image = images[i];
      const form = new FormData();
      for (const p of target.parameters) form.append(p.name, p.value);
      form.append('file', new Blob([fs.readFileSync(path.join(imagesDir, image.file))], { type: 'image/webp' }), image.file);
      const response = await fetch(target.url, { method: 'POST', body: form });
      if (!response.ok) throw new Error(`Uploading ${image.file} failed (${response.status})`);
      urls.set(image.file, target.resourceUrl);
    }),
  );
  return urls;
}
