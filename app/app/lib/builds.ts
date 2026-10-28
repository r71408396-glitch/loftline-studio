// Turns an order's line items into desk builds and build sheets.
// Every part of a configured desk carries the hidden `_build` property, in both
// cart modes: added as separate parts by the theme, or expanded from one desk
// line by the Desk bundle Function (which copies `_build` and `_edge` onto the parts).
import { FRAME_COLOURS, MATERIALS, parseFrameSku, parseTopSku } from './skus';

export type OrderLineItem = {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  variantTitle: string | null;
  customAttributes: { key: string; value: string | null }[];
  product: { productType: string } | null;
};

export type Build = {
  buildNumber: string;
  quantity: number;
  edge: 'square' | 'rounded';
  top: OrderLineItem | null;
  frame: OrderLineItem | null;
  accessories: OrderLineItem[];
};

const attribute = (line: OrderLineItem, key: string) => line.customAttributes.find((a) => a.key === key)?.value ?? null;

export function buildsFromLineItems(lines: OrderLineItem[]): Build[] {
  const builds = new Map<string, Build>();
  for (const line of lines) {
    const number = attribute(line, '_build');
    if (!number) continue;
    let build = builds.get(number);
    if (!build) {
      build = { buildNumber: number, quantity: 1, edge: 'square', top: null, frame: null, accessories: [] };
      builds.set(number, build);
    }
    if (parseTopSku(line.sku) || line.product?.productType === 'Desk top') {
      build.top = line;
      build.quantity = line.quantity;
      if (attribute(line, '_edge') === 'rounded') build.edge = 'rounded';
    } else if (parseFrameSku(line.sku) || line.product?.productType === 'Desk frame') {
      build.frame = line;
    } else {
      build.accessories.push(line);
    }
  }
  return [...builds.values()];
}

// Wood and board densities (kg/m3) for shipping weights.
const DENSITY: Record<string, number> = { OAK: 700, WAL: 650, BAM: 750, WHT: 650, LIN: 680 };
const FRAME_WEIGHT_KG = 34;

export type BuildSheet = {
  buildNumber: string;
  orderName: string;
  quantity: number;
  top: null | {
    sku: string;
    material: string;
    core: string;
    finishedSizeMm: string;
    edge: string;
    cornerRadiusMm: number;
    weightKg: number;
  };
  frame: null | { sku: string; colour: string; ral: string; legSpacingMm: number; crossBeamMm: number };
  accessories: { name: string; sku: string; quantity: number }[];
  packing: { box: number; contents: string; weightKg: number | null }[];
  checks: string[];
  problems: string[];
};

export function buildSheet(build: Build, orderName: string): BuildSheet {
  const problems: string[] = [];
  const topSku = parseTopSku(build.top?.sku);
  const frameCode = parseFrameSku(build.frame?.sku);
  if (!build.top || !topSku) problems.push('No desk top found for this build.');
  if (!build.frame || !frameCode) problems.push('No frame found for this build.');

  let top: BuildSheet['top'] = null;
  let frame: BuildSheet['frame'] = null;
  if (build.top && topSku) {
    const material = MATERIALS[topSku.material];
    const thickness = material?.thicknessMm ?? 25;
    const w = topSku.widthCm * 10;
    const d = topSku.depthCm * 10;
    const weight = ((w / 1000) * (d / 1000) * (thickness / 1000) * (DENSITY[topSku.material] ?? 700));
    top = {
      sku: build.top.sku ?? '',
      material: material?.name ?? topSku.material,
      core: material?.core ?? '',
      finishedSizeMm: `${w} x ${d} x ${thickness}`,
      edge: build.edge === 'rounded' ? 'Rounded, 7 mm radius' : 'Square, 1.5 mm arris',
      cornerRadiusMm: build.edge === 'rounded' ? 45 : 6,
      weightKg: Math.round(weight * 10) / 10,
    };
    if (frameCode) {
      // Matches the 3D model: legs sit in from each end by 10% of the width, at most 160 mm.
      const inset = Math.min(160, w * 0.1);
      const spacing = Math.round(w - inset * 2);
      frame = {
        sku: build.frame?.sku ?? '',
        colour: FRAME_COLOURS[frameCode]?.name ?? frameCode,
        ral: FRAME_COLOURS[frameCode]?.ral ?? '',
        legSpacingMm: spacing,
        crossBeamMm: spacing,
      };
    }
  }

  // An order line's name already includes the variant ("Felt desk pad - Graphite").
  const accessories = build.accessories.map((line) => ({
    name: line.name,
    sku: line.sku ?? '',
    quantity: line.quantity,
  }));

  const packing: BuildSheet['packing'] = [];
  if (top) packing.push({ box: 1, contents: `Desk top ${top.finishedSizeMm} mm, corner protectors, felt sheet`, weightKg: Math.round((top.weightKg + 2.5) * 10) / 10 });
  if (frame) packing.push({ box: packing.length + 1, contents: `Frame (${frame.colour}): 2 legs, cross beam set to ${frame.crossBeamMm} mm, keypad, control box, screw kit`, weightKg: FRAME_WEIGHT_KG + 2 });
  if (accessories.length) packing.push({ box: packing.length + 1, contents: accessories.map((a) => `${a.quantity} x ${a.name}`).join(', '), weightKg: null });

  const checks = [
    'Top: size and edge match this sheet, no chips on the edge',
    'Top: finish even, no dust in the oil or laminate',
    'Frame: both motors run to full height and back, no noise',
    'Frame: keypad shows height, memory buttons work',
    'Screw kit and assembly guide in the frame box',
    ...(accessories.length ? ['Accessories packed and listed on the box'] : []),
  ];

  return { buildNumber: build.buildNumber, orderName, quantity: build.quantity, top, frame, accessories, packing, checks, problems };
}
