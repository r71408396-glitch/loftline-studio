// SKU format shared with the theme and the catalogue:
//   frame:  LL-FRM-<COLOUR>                e.g. LL-FRM-BLK
//   top:    LL-TOP-<MATERIAL>-<W>-<D>      e.g. LL-TOP-OAK-160-80 (cm)
//   others: LL-ACC-...                     accessories

export const MATERIALS: Record<string, { name: string; thicknessMm: number; core: string }> = {
  OAK: { name: 'Oak', thicknessMm: 25, core: 'Solid oak staves' },
  WAL: { name: 'Walnut', thicknessMm: 25, core: 'Solid walnut staves' },
  BAM: { name: 'Bamboo', thicknessMm: 25, core: 'Pressed bamboo strips' },
  WHT: { name: 'White laminate', thicknessMm: 25, core: 'Birch plywood, HPL face' },
  LIN: { name: 'Charcoal linoleum', thicknessMm: 25, core: 'Birch plywood, linoleum face' },
};

// Powder coat colours for the frame, with the RAL code the workshop orders by.
export const FRAME_COLOURS: Record<string, { name: string; ral: string }> = {
  BLK: { name: 'Black', ral: 'RAL 9005 Jet black, matt' },
  WHT: { name: 'White', ral: 'RAL 9016 Traffic white, matt' },
  GRA: { name: 'Graphite', ral: 'RAL 7024 Graphite grey, matt' },
  ALU: { name: 'Aluminium', ral: 'RAL 9006 White aluminium' },
};

export type TopSku = { material: string; widthCm: number; depthCm: number };

export function parseTopSku(sku: string | null | undefined): TopSku | null {
  const match = /^LL-TOP-([A-Z]{3})-(\d{2,3})-(\d{2,3})$/.exec(sku ?? '');
  if (!match) return null;
  return { material: match[1], widthCm: Number(match[2]), depthCm: Number(match[3]) };
}

export function parseFrameSku(sku: string | null | undefined): string | null {
  const match = /^LL-FRM-([A-Z]{3})$/.exec(sku ?? '');
  return match ? match[1] : null;
}

/** "gid://shopify/ProductVariant/123" -> "123" */
export function legacyId(gid: string): string {
  return gid.split('/').pop() ?? gid;
}
