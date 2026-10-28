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

interface GeneratedQueryTypes {
  "#graphql\n  query LoftlineDeskProducts($cursor: String) {\n    products(first: 50, after: $cursor, query: \"product_type:'Desk top' OR product_type:'Desk frame' OR product_type:Accessory\") {\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      nodes {\n        id\n        title\n        productType\n        variants(first: 100) {\n          nodes {\n            id\n            sku\n            price\n            title\n          }\n        }\n      }\n    }\n  }": {return: LoftlineDeskProductsQuery, variables: LoftlineDeskProductsQueryVariables},
  "#graphql\n  query LoftlineCartTransforms {\n    cartTransforms(first: 10) {\n      nodes {\n        id\n        functionId\n      }\n    }\n  }": {return: LoftlineCartTransformsQuery, variables: LoftlineCartTransformsQueryVariables},
  "#graphql\n  query LoftlineFindTierDiscount($id: ID!) {\n    discountNode(id: $id) {\n      id\n    }\n  }": {return: LoftlineFindTierDiscountQuery, variables: LoftlineFindTierDiscountQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation LoftlineOrderStage($id: ID!, $add: [String!]!, $remove: [String!]!, $metafields: [MetafieldsSetInput!]!) {\n    tagsAdd(id: $id, tags: $add) {\n      userErrors {\n        message\n      }\n    }\n    tagsRemove(id: $id, tags: $remove) {\n      userErrors {\n        message\n      }\n    }\n    metafieldsSet(metafields: $metafields) {\n      userErrors {\n        field\n        message\n      }\n    }\n  }": {return: LoftlineOrderStageMutation, variables: LoftlineOrderStageMutationVariables},
  "#graphql\n  mutation LoftlineCreateCartTransform($handle: String!, $metafields: [MetafieldInput!]) {\n    cartTransformCreate(functionHandle: $handle, blockOnFailure: false, metafields: $metafields) {\n      cartTransform {\n        id\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }": {return: LoftlineCreateCartTransformMutation, variables: LoftlineCreateCartTransformMutationVariables},
  "#graphql\n  mutation LoftlineCreateTierDiscount($discount: DiscountAutomaticAppInput!) {\n    discountAutomaticAppCreate(automaticAppDiscount: $discount) {\n      automaticAppDiscount {\n        discountId\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }": {return: LoftlineCreateTierDiscountMutation, variables: LoftlineCreateTierDiscountMutationVariables},
  "#graphql\n  mutation LoftlineSetFunctionConfig($metafields: [MetafieldsSetInput!]!) {\n    metafieldsSet(metafields: $metafields) {\n      metafields {\n        id\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }": {return: LoftlineSetFunctionConfigMutation, variables: LoftlineSetFunctionConfigMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
