/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.js';

export type LoftlineOrderStageMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  add: Array<AdminTypes.Scalars['String']['input']> | AdminTypes.Scalars['String']['input'];
  remove: Array<AdminTypes.Scalars['String']['input']> | AdminTypes.Scalars['String']['input'];
  metafields: Array<AdminTypes.MetafieldsSetInput> | AdminTypes.MetafieldsSetInput;
}>;


export type LoftlineOrderStageMutation = { tagsAdd?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.UserError, 'message'>> }>, tagsRemove?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.UserError, 'message'>> }>, metafieldsSet?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.MetafieldsSetUserError, 'field' | 'message'>> }> };

export type LoftlineDeskProductsQueryVariables = AdminTypes.Exact<{
  cursor?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type LoftlineDeskProductsQuery = { products: { pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'>, nodes: Array<(
      Pick<AdminTypes.Product, 'id' | 'title' | 'productType'>
      & { variants: { nodes: Array<Pick<AdminTypes.ProductVariant, 'id' | 'sku' | 'price' | 'title'>> } }
    )> } };

export type LoftlineCartTransformsQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type LoftlineCartTransformsQuery = { cartTransforms: { nodes: Array<Pick<AdminTypes.CartTransform, 'id' | 'functionId'>> } };

export type LoftlineCreateCartTransformMutationVariables = AdminTypes.Exact<{
  handle: AdminTypes.Scalars['String']['input'];
  metafields?: AdminTypes.InputMaybe<Array<AdminTypes.MetafieldInput> | AdminTypes.MetafieldInput>;
}>;


export type LoftlineCreateCartTransformMutation = { cartTransformCreate?: AdminTypes.Maybe<{ cartTransform?: AdminTypes.Maybe<Pick<AdminTypes.CartTransform, 'id'>>, userErrors: Array<Pick<AdminTypes.CartTransformCreateUserError, 'field' | 'message'>> }> };

export type LoftlineCreateTierDiscountMutationVariables = AdminTypes.Exact<{
  discount: AdminTypes.DiscountAutomaticAppInput;
}>;


export type LoftlineCreateTierDiscountMutation = { discountAutomaticAppCreate?: AdminTypes.Maybe<{ automaticAppDiscount?: AdminTypes.Maybe<Pick<AdminTypes.DiscountAutomaticApp, 'discountId'>>, userErrors: Array<Pick<AdminTypes.DiscountUserError, 'field' | 'message'>> }> };

export type LoftlineFindTierDiscountQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type LoftlineFindTierDiscountQuery = { discountNode?: AdminTypes.Maybe<Pick<AdminTypes.DiscountNode, 'id'>> };

export type LoftlineSetFunctionConfigMutationVariables = AdminTypes.Exact<{
  metafields: Array<AdminTypes.MetafieldsSetInput> | AdminTypes.MetafieldsSetInput;
}>;


export type LoftlineSetFunctionConfigMutation = { metafieldsSet?: AdminTypes.Maybe<{ metafields?: AdminTypes.Maybe<Array<Pick<AdminTypes.Metafield, 'id'>>>, userErrors: Array<Pick<AdminTypes.MetafieldsSetUserError, 'field' | 'message'>> }> };

export type LoftlineSetupLocationQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type LoftlineSetupLocationQuery = { locations: { nodes: Array<Pick<AdminTypes.Location, 'id' | 'name'>> } };

export type LoftlineSetupMetafieldDefinitionsQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type LoftlineSetupMetafieldDefinitionsQuery = { metafieldDefinitions: { nodes: Array<Pick<AdminTypes.MetafieldDefinition, 'key'>> } };

export type LoftlineSetupCreateMetafieldDefinitionMutationVariables = AdminTypes.Exact<{
  definition: AdminTypes.MetafieldDefinitionInput;
}>;


export type LoftlineSetupCreateMetafieldDefinitionMutation = { metafieldDefinitionCreate?: AdminTypes.Maybe<{ createdDefinition?: AdminTypes.Maybe<Pick<AdminTypes.MetafieldDefinition, 'id'>>, userErrors: Array<Pick<AdminTypes.MetafieldDefinitionCreateUserError, 'field' | 'message' | 'code'>> }> };

export type LoftlineSetupMetaobjectDefinitionQueryVariables = AdminTypes.Exact<{
  type: AdminTypes.Scalars['String']['input'];
}>;


export type LoftlineSetupMetaobjectDefinitionQuery = { metaobjectDefinitionByType?: AdminTypes.Maybe<Pick<AdminTypes.MetaobjectDefinition, 'id'>> };

export type LoftlineSetupCreateMetaobjectDefinitionMutationVariables = AdminTypes.Exact<{
  definition: AdminTypes.MetaobjectDefinitionCreateInput;
}>;


export type LoftlineSetupCreateMetaobjectDefinitionMutation = { metaobjectDefinitionCreate?: AdminTypes.Maybe<{ metaobjectDefinition?: AdminTypes.Maybe<Pick<AdminTypes.MetaobjectDefinition, 'id'>>, userErrors: Array<Pick<AdminTypes.MetaobjectUserError, 'field' | 'message' | 'code'>> }> };

export type LoftlineSetupUpsertMetaobjectMutationVariables = AdminTypes.Exact<{
  handle: AdminTypes.MetaobjectHandleInput;
  metaobject: AdminTypes.MetaobjectUpsertInput;
}>;


export type LoftlineSetupUpsertMetaobjectMutation = { metaobjectUpsert?: AdminTypes.Maybe<{ metaobject?: AdminTypes.Maybe<Pick<AdminTypes.Metaobject, 'id'>>, userErrors: Array<Pick<AdminTypes.MetaobjectUserError, 'field' | 'message' | 'code'>> }> };

export type LoftlineSetupStagedUploadsMutationVariables = AdminTypes.Exact<{
  input: Array<AdminTypes.StagedUploadInput> | AdminTypes.StagedUploadInput;
}>;


export type LoftlineSetupStagedUploadsMutation = { stagedUploadsCreate?: AdminTypes.Maybe<{ stagedTargets?: AdminTypes.Maybe<Array<(
      Pick<AdminTypes.StagedMediaUploadTarget, 'url' | 'resourceUrl'>
      & { parameters: Array<Pick<AdminTypes.StagedUploadParameter, 'name' | 'value'>> }
    )>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type LoftlineSetupProductQueryVariables = AdminTypes.Exact<{
  handle: AdminTypes.Scalars['String']['input'];
}>;


export type LoftlineSetupProductQuery = { productByIdentifier?: AdminTypes.Maybe<(
    Pick<AdminTypes.Product, 'id'>
    & { media: { nodes: Array<Pick<AdminTypes.ExternalVideo, 'id'> | Pick<AdminTypes.MediaImage, 'id'> | Pick<AdminTypes.Model3d, 'id'> | Pick<AdminTypes.Video, 'id'>> }, sellingPlanGroups: { nodes: Array<Pick<AdminTypes.SellingPlanGroup, 'merchantCode'>> } }
  )> };

export type LoftlineSetupProductSetMutationVariables = AdminTypes.Exact<{
  handle: AdminTypes.Scalars['String']['input'];
  input: AdminTypes.ProductSetInput;
}>;


export type LoftlineSetupProductSetMutation = { productSet?: AdminTypes.Maybe<{ product?: AdminTypes.Maybe<(
      Pick<AdminTypes.Product, 'id'>
      & { variants: { nodes: Array<Pick<AdminTypes.ProductVariant, 'id'>> } }
    )>, userErrors: Array<Pick<AdminTypes.ProductSetUserError, 'field' | 'message' | 'code'>> }> };

export type LoftlineSetupSellingPlansMutationVariables = AdminTypes.Exact<{
  input: AdminTypes.SellingPlanGroupInput;
  productIds: Array<AdminTypes.Scalars['ID']['input']> | AdminTypes.Scalars['ID']['input'];
}>;


export type LoftlineSetupSellingPlansMutation = { sellingPlanGroupCreate?: AdminTypes.Maybe<{ sellingPlanGroup?: AdminTypes.Maybe<Pick<AdminTypes.SellingPlanGroup, 'id'>>, userErrors: Array<Pick<AdminTypes.SellingPlanGroupUserError, 'field' | 'message' | 'code'>> }> };

export type LoftlineSetupCollectionQueryVariables = AdminTypes.Exact<{
  handle: AdminTypes.Scalars['String']['input'];
}>;


export type LoftlineSetupCollectionQuery = { collectionByIdentifier?: AdminTypes.Maybe<Pick<AdminTypes.Collection, 'id'>> };

export type LoftlineSetupCreateCollectionMutationVariables = AdminTypes.Exact<{
  collection: AdminTypes.CollectionCreateInput;
}>;


export type LoftlineSetupCreateCollectionMutation = { collectionCreate?: AdminTypes.Maybe<{ collection?: AdminTypes.Maybe<Pick<AdminTypes.Collection, 'id'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type LoftlineSetupPublicationsQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type LoftlineSetupPublicationsQuery = { publications: { nodes: Array<Pick<AdminTypes.Publication, 'id' | 'name'>> } };

export type LoftlineSetupPublishMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  publicationId: AdminTypes.Scalars['ID']['input'];
}>;


export type LoftlineSetupPublishMutation = { publishablePublish?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type LoftlineSetupPageQueryVariables = AdminTypes.Exact<{
  query: AdminTypes.Scalars['String']['input'];
}>;


export type LoftlineSetupPageQuery = { pages: { nodes: Array<Pick<AdminTypes.Page, 'id' | 'handle' | 'templateSuffix'>> } };

export type LoftlineSetupPageTemplateMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  page: AdminTypes.PageUpdateInput;
}>;


export type LoftlineSetupPageTemplateMutation = { pageUpdate?: AdminTypes.Maybe<{ page?: AdminTypes.Maybe<Pick<AdminTypes.Page, 'id'>>, userErrors: Array<Pick<AdminTypes.PageUpdateUserError, 'field' | 'message' | 'code'>> }> };

export type LoftlineSetupCreatePageMutationVariables = AdminTypes.Exact<{
  page: AdminTypes.PageCreateInput;
}>;


export type LoftlineSetupCreatePageMutation = { pageCreate?: AdminTypes.Maybe<{ page?: AdminTypes.Maybe<Pick<AdminTypes.Page, 'id'>>, userErrors: Array<Pick<AdminTypes.PageCreateUserError, 'field' | 'message' | 'code'>> }> };

export type LoftlineSetupMenusQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type LoftlineSetupMenusQuery = { menus: { nodes: Array<Pick<AdminTypes.Menu, 'id' | 'handle'>> } };

export type LoftlineSetupUpdateMenuMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  title: AdminTypes.Scalars['String']['input'];
  items: Array<AdminTypes.MenuItemUpdateInput> | AdminTypes.MenuItemUpdateInput;
}>;


export type LoftlineSetupUpdateMenuMutation = { menuUpdate?: AdminTypes.Maybe<{ menu?: AdminTypes.Maybe<Pick<AdminTypes.Menu, 'id'>>, userErrors: Array<Pick<AdminTypes.MenuUpdateUserError, 'field' | 'message' | 'code'>> }> };

export type LoftlineSetupCreateMenuMutationVariables = AdminTypes.Exact<{
  title: AdminTypes.Scalars['String']['input'];
  handle: AdminTypes.Scalars['String']['input'];
  items: Array<AdminTypes.MenuItemCreateInput> | AdminTypes.MenuItemCreateInput;
}>;


export type LoftlineSetupCreateMenuMutation = { menuCreate?: AdminTypes.Maybe<{ menu?: AdminTypes.Maybe<Pick<AdminTypes.Menu, 'id'>>, userErrors: Array<Pick<AdminTypes.MenuCreateUserError, 'field' | 'message' | 'code'>> }> };

interface GeneratedQueryTypes {
  "#graphql\n  query LoftlineDeskProducts($cursor: String) {\n    products(first: 50, after: $cursor, query: \"product_type:'Desk top' OR product_type:'Desk frame' OR product_type:Accessory\") {\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      nodes {\n        id\n        title\n        productType\n        variants(first: 100) {\n          nodes {\n            id\n            sku\n            price\n            title\n          }\n        }\n      }\n    }\n  }": {return: LoftlineDeskProductsQuery, variables: LoftlineDeskProductsQueryVariables},
  "#graphql\n  query LoftlineCartTransforms {\n    cartTransforms(first: 10) {\n      nodes {\n        id\n        functionId\n      }\n    }\n  }": {return: LoftlineCartTransformsQuery, variables: LoftlineCartTransformsQueryVariables},
  "#graphql\n  query LoftlineFindTierDiscount($id: ID!) {\n    discountNode(id: $id) {\n      id\n    }\n  }": {return: LoftlineFindTierDiscountQuery, variables: LoftlineFindTierDiscountQueryVariables},
  "#graphql\n  query LoftlineSetupLocation {\n    locations(first: 5, query: \"active:true\") {\n      nodes {\n        id\n        name\n      }\n    }\n  }": {return: LoftlineSetupLocationQuery, variables: LoftlineSetupLocationQueryVariables},
  "#graphql\n  query LoftlineSetupMetafieldDefinitions {\n    metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: \"specs\") {\n      nodes {\n        key\n      }\n    }\n  }": {return: LoftlineSetupMetafieldDefinitionsQuery, variables: LoftlineSetupMetafieldDefinitionsQueryVariables},
  "#graphql\n  query LoftlineSetupMetaobjectDefinition($type: String!) {\n    metaobjectDefinitionByType(type: $type) {\n      id\n    }\n  }": {return: LoftlineSetupMetaobjectDefinitionQuery, variables: LoftlineSetupMetaobjectDefinitionQueryVariables},
  "#graphql\n  query LoftlineSetupProduct($handle: String!) {\n    productByIdentifier(identifier: { handle: $handle }) {\n      id\n      media(first: 1) {\n        nodes {\n          id\n        }\n      }\n      sellingPlanGroups(first: 5) {\n        nodes {\n          merchantCode\n        }\n      }\n    }\n  }": {return: LoftlineSetupProductQuery, variables: LoftlineSetupProductQueryVariables},
  "#graphql\n  query LoftlineSetupCollection($handle: String!) {\n    collectionByIdentifier(identifier: { handle: $handle }) {\n      id\n    }\n  }": {return: LoftlineSetupCollectionQuery, variables: LoftlineSetupCollectionQueryVariables},
  "#graphql\n  query LoftlineSetupPublications {\n    publications(first: 20) {\n      nodes {\n        id\n        name\n      }\n    }\n  }": {return: LoftlineSetupPublicationsQuery, variables: LoftlineSetupPublicationsQueryVariables},
  "#graphql\n  query LoftlineSetupPage($query: String!) {\n    pages(first: 1, query: $query) {\n      nodes {\n        id\n        handle\n        templateSuffix\n      }\n    }\n  }": {return: LoftlineSetupPageQuery, variables: LoftlineSetupPageQueryVariables},
  "#graphql\n  query LoftlineSetupMenus {\n    menus(first: 20) {\n      nodes {\n        id\n        handle\n      }\n    }\n  }": {return: LoftlineSetupMenusQuery, variables: LoftlineSetupMenusQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation LoftlineOrderStage($id: ID!, $add: [String!]!, $remove: [String!]!, $metafields: [MetafieldsSetInput!]!) {\n    tagsAdd(id: $id, tags: $add) {\n      userErrors {\n        message\n      }\n    }\n    tagsRemove(id: $id, tags: $remove) {\n      userErrors {\n        message\n      }\n    }\n    metafieldsSet(metafields: $metafields) {\n      userErrors {\n        field\n        message\n      }\n    }\n  }": {return: LoftlineOrderStageMutation, variables: LoftlineOrderStageMutationVariables},
  "#graphql\n  mutation LoftlineCreateCartTransform($handle: String!, $metafields: [MetafieldInput!]) {\n    cartTransformCreate(functionHandle: $handle, blockOnFailure: false, metafields: $metafields) {\n      cartTransform {\n        id\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }": {return: LoftlineCreateCartTransformMutation, variables: LoftlineCreateCartTransformMutationVariables},
  "#graphql\n  mutation LoftlineCreateTierDiscount($discount: DiscountAutomaticAppInput!) {\n    discountAutomaticAppCreate(automaticAppDiscount: $discount) {\n      automaticAppDiscount {\n        discountId\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }": {return: LoftlineCreateTierDiscountMutation, variables: LoftlineCreateTierDiscountMutationVariables},
  "#graphql\n  mutation LoftlineSetFunctionConfig($metafields: [MetafieldsSetInput!]!) {\n    metafieldsSet(metafields: $metafields) {\n      metafields {\n        id\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }": {return: LoftlineSetFunctionConfigMutation, variables: LoftlineSetFunctionConfigMutationVariables},
  "#graphql\n  mutation LoftlineSetupCreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {\n    metafieldDefinitionCreate(definition: $definition) {\n      createdDefinition {\n        id\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }": {return: LoftlineSetupCreateMetafieldDefinitionMutation, variables: LoftlineSetupCreateMetafieldDefinitionMutationVariables},
  "#graphql\n  mutation LoftlineSetupCreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {\n    metaobjectDefinitionCreate(definition: $definition) {\n      metaobjectDefinition {\n        id\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }": {return: LoftlineSetupCreateMetaobjectDefinitionMutation, variables: LoftlineSetupCreateMetaobjectDefinitionMutationVariables},
  "#graphql\n  mutation LoftlineSetupUpsertMetaobject($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {\n    metaobjectUpsert(handle: $handle, metaobject: $metaobject) {\n      metaobject {\n        id\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }": {return: LoftlineSetupUpsertMetaobjectMutation, variables: LoftlineSetupUpsertMetaobjectMutationVariables},
  "#graphql\n  mutation LoftlineSetupStagedUploads($input: [StagedUploadInput!]!) {\n    stagedUploadsCreate(input: $input) {\n      stagedTargets {\n        url\n        resourceUrl\n        parameters {\n          name\n          value\n        }\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }": {return: LoftlineSetupStagedUploadsMutation, variables: LoftlineSetupStagedUploadsMutationVariables},
  "#graphql\n  mutation LoftlineSetupProductSet($handle: String!, $input: ProductSetInput!) {\n    productSet(identifier: { handle: $handle }, input: $input, synchronous: true) {\n      product {\n        id\n        variants(first: 1) {\n          nodes {\n            id\n          }\n        }\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }": {return: LoftlineSetupProductSetMutation, variables: LoftlineSetupProductSetMutationVariables},
  "#graphql\n  mutation LoftlineSetupSellingPlans($input: SellingPlanGroupInput!, $productIds: [ID!]!) {\n    sellingPlanGroupCreate(input: $input, resources: { productIds: $productIds }) {\n      sellingPlanGroup {\n        id\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }": {return: LoftlineSetupSellingPlansMutation, variables: LoftlineSetupSellingPlansMutationVariables},
  "#graphql\n  mutation LoftlineSetupCreateCollection($collection: CollectionCreateInput!) {\n    collectionCreate(collection: $collection) {\n      collection {\n        id\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }": {return: LoftlineSetupCreateCollectionMutation, variables: LoftlineSetupCreateCollectionMutationVariables},
  "#graphql\n  mutation LoftlineSetupPublish($id: ID!, $publicationId: ID!) {\n    publishablePublish(id: $id, input: [{ publicationId: $publicationId }]) {\n      userErrors {\n        field\n        message\n      }\n    }\n  }": {return: LoftlineSetupPublishMutation, variables: LoftlineSetupPublishMutationVariables},
  "#graphql\n  mutation LoftlineSetupPageTemplate($id: ID!, $page: PageUpdateInput!) {\n    pageUpdate(id: $id, page: $page) {\n      page {\n        id\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }": {return: LoftlineSetupPageTemplateMutation, variables: LoftlineSetupPageTemplateMutationVariables},
  "#graphql\n  mutation LoftlineSetupCreatePage($page: PageCreateInput!) {\n    pageCreate(page: $page) {\n      page {\n        id\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }": {return: LoftlineSetupCreatePageMutation, variables: LoftlineSetupCreatePageMutationVariables},
  "#graphql\n  mutation LoftlineSetupUpdateMenu($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {\n    menuUpdate(id: $id, title: $title, items: $items) {\n      menu {\n        id\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }": {return: LoftlineSetupUpdateMenuMutation, variables: LoftlineSetupUpdateMenuMutationVariables},
  "#graphql\n  mutation LoftlineSetupCreateMenu($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {\n    menuCreate(title: $title, handle: $handle, items: $items) {\n      menu {\n        id\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }": {return: LoftlineSetupCreateMenuMutation, variables: LoftlineSetupCreateMenuMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
