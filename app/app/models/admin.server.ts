// Small helper around the Admin GraphQL client: throws on GraphQL errors and
// on userErrors, so callers only deal with data.

export type AdminApi = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export async function adminQuery<T = any>(admin: AdminApi, query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await admin.graphql(query, variables ? { variables } : undefined);
  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data as T;
}

/** Throws if a mutation payload has userErrors. */
export function assertNoUserErrors(payload: { userErrors?: { message: string; field?: string[] | null }[] } | null | undefined, what: string) {
  const errors = payload?.userErrors ?? [];
  if (errors.length) throw new Error(`${what}: ${errors.map((e) => e.message).join('; ')}`);
}
