// Procedural textures for desk tops, edges, frame finish and the floor shadow.
// Everything is drawn on canvases at runtime, so the viewer ships no image files.
import { createNoise, clamp, mix, smoothstep } from './noise.js';

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Writes per-pixel results from fn(x, y) => [r, g, b, rough, bump] into three canvases.
function paint(width, height, fn) {
  const color = makeCanvas(width, height);
  const rough = makeCanvas(width, height);
  const bump = makeCanvas(width, height);
  const colorData = new ImageData(width, height);
  const roughData = new ImageData(width, height);
  const bumpData = new ImageData(width, height);
  const out = [0, 0, 0, 0, 0];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      fn(x, y, out);
      const i = (y * width + x) * 4;
      colorData.data[i] = clamp(out[0]) * 255;
      colorData.data[i + 1] = clamp(out[1]) * 255;
      colorData.data[i + 2] = clamp(out[2]) * 255;
      colorData.data[i + 3] = 255;
      const r = clamp(out[3]) * 255;
      roughData.data[i] = roughData.data[i + 1] = roughData.data[i + 2] = r;
      roughData.data[i + 3] = 255;
      const b = clamp(out[4]) * 255;
      bumpData.data[i] = bumpData.data[i + 1] = bumpData.data[i + 2] = b;
      bumpData.data[i + 3] = 255;
    }
  }

  color.getContext('2d').putImageData(colorData, 0, 0);
  rough.getContext('2d').putImageData(roughData, 0, 0);
  bump.getContext('2d').putImageData(bumpData, 0, 0);
  return { color, rough, bump };
}

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const hex = (h) => [1, 3, 5].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255));

/**
 * Glued-stave solid wood top, grain running along the desk's width.
 * The texture covers worldU x worldV metres, so one tile spans the largest top.
 */
export function woodTexture(species, { worldU = 2.0, worldV = 0.8, pxPerMetre = 768 } = {}) {
  const width = Math.round(worldU * pxPerMetre);
  const height = Math.round(worldV * pxPerMetre);
  const { noise, fbm, random } = createNoise(species.seed);

  const light = hex(species.light);
  const dark = hex(species.dark);
  const sap = species.sapwood ? hex(species.sapwood) : null;

  // Staves of slightly varying width, each with its own tone and figure.
  const staves = [];
  let edge = 0;
  while (edge < worldV + 0.2) {
    const w = species.staveWidth * (0.8 + random() * 0.4);
    staves.push({
      start: edge,
      end: edge + w,
      tone: 0.86 + random() * 0.26,
      warmth: (random() - 0.5) * 0.1,
      offset: random() * 10,
      seed: random() * 100,
      // The board runs at a slight angle to the log, so its distance to the
      // pith changes steadily along its length: arches open toward one end.
      // Staves cut far from the pith show almost straight grain.
      ...(() => {
        const slope = (random() < 0.5 ? -1 : 1) * (0.003 + random() * 0.009);
        const near = random() < 0.4;
        const pith = (near ? 0.003 + random() * 0.012 : 0.04 + random() * 0.06) + (slope < 0 ? -slope * worldU : 0);
        return { slope, pith };
      })(),
      centre: w * (0.2 + random() * 0.6),
      sapwood: sap && random() < species.sapwoodChance ? 0.35 + random() * 0.5 : 0,
      nodes: species.nodeSpacing ? Array.from({ length: 8 }, (_, i) => (i + random() * 0.6) * species.nodeSpacing) : null,
    });
    edge += w;
  }

  let staveIndex = 0;
  const seam = 0.7 / pxPerMetre;

  return paint(width, height, (x, y, out) => {
    const u = x / pxPerMetre;
    const v = y / pxPerMetre;
    if (x === 0) {
      staveIndex = 0;
      while (staves[staveIndex].end < v) staveIndex++;
    }
    const stave = staves[staveIndex];
    const local = v - stave.start;

    // Flat-sawn figure: the board is a plane cutting through cylindrical growth
    // rings. Ring radius = distance to the pith, which drifts slowly along the
    // board, so rings show as straight lines with occasional nested arches.
    const pithDistance = Math.max(stave.pith + stave.slope * u + noise(u * species.figureScale + stave.seed, stave.seed) * species.figure, 0.001);
    const across = local - stave.centre;
    const radius = Math.sqrt(pithDistance * pithDistance + across * across);
    const wobble = noise(u * 3 + stave.seed, local * 30) * 0.15 + noise(u * 14, local * 60 + stave.seed) * 0.04;
    const t = radius * species.ringDensity + wobble + stave.offset;
    const ring = t - Math.floor(t);
    const latewood = smoothstep(0.62, 0.86, ring) * (1 - smoothstep(0.9, 1.0, ring));

    // Pores and fine streaks run along the grain.
    const streak = noise(u * 5 + stave.seed, v * species.poreDensity) * 0.5 + 0.5;
    const pores = smoothstep(0.6, 0.9, streak) * species.pores;
    const tone = fbm(u * 1.6 + stave.seed, v * 7, 2) * 0.1;

    let k = clamp(latewood * species.ringContrast + pores + tone + 0.12);
    let r = mix(light[0], dark[0], k);
    let g = mix(light[1], dark[1], k);
    let b = mix(light[2], dark[2], k);

    if (stave.sapwood && sap) {
      const s = smoothstep(0.2, 0.8, noise(u * 1.4 + stave.seed, local * 20) * 0.5 + 0.5) * stave.sapwood;
      r = mix(r, sap[0], s);
      g = mix(g, sap[1], s);
      b = mix(b, sap[2], s);
    }

    let rough = species.roughness + pores * 0.25 + latewood * 0.04;
    let bump = 0.6 - pores * 0.5 - latewood * 0.1;

    // Bamboo knuckles: a darker band across each strip.
    if (stave.nodes) {
      for (const node of stave.nodes) {
        const d = Math.abs(u - node);
        if (d < 0.006) {
          const n = 1 - d / 0.006;
          r *= 1 - n * 0.35;
          g *= 1 - n * 0.38;
          b *= 1 - n * 0.42;
          bump -= n * 0.2;
        }
      }
    }

    const tint = stave.tone;
    r *= tint * (1 + stave.warmth);
    g *= tint;
    b *= tint * (1 - stave.warmth);

    // Glue line between staves.
    if (local < seam) {
      r *= 0.8;
      g *= 0.8;
      b *= 0.8;
      rough += 0.1;
      bump = 0.2;
    }

    out[0] = linearToSrgb(r);
    out[1] = linearToSrgb(g);
    out[2] = linearToSrgb(b);
    out[3] = rough;
    out[4] = bump;
  });
}

/** Solid surfaces (linoleum, laminate): a seamless tile with soft mottling. */
export function solidTexture(surface, { size = 512, worldSize = 0.5 } = {}) {
  const { noise } = createNoise(surface.seed);
  const base = hex(surface.color);
  const scale = worldSize;

  // Tileable noise: blend four offsets of the same noise.
  const tileable = (x, y, f) => {
    const s = x / size;
    const t = y / size;
    const a = noise(s * f, t * f);
    const b = noise((s - 1) * f, t * f);
    const c = noise(s * f, (t - 1) * f);
    const d = noise((s - 1) * f, (t - 1) * f);
    return mix(mix(a, b, s), mix(c, d, s), t);
  };

  return paint(size, size, (x, y, out) => {
    const mottle = tileable(x, y, 6 * scale * 4) * 0.5 + tileable(x, y, 24 * scale * 4) * 0.3;
    const speck = tileable(x, y, 160) ;
    const k = 1 + mottle * surface.mottle + (speck > 0.55 ? surface.speck : 0);
    out[0] = linearToSrgb(base[0] * k);
    out[1] = linearToSrgb(base[1] * k);
    out[2] = linearToSrgb(base[2] * k);
    out[3] = surface.roughness + mottle * 0.05;
    out[4] = 0.5 + speck * 0.25 + mottle * 0.1;
  });
}

/** Birch plywood edge: plies stacked across the thickness, v = 0..1 over the edge. */
export function plywoodTexture({ width = 512, height = 128, plies = 9 } = {}) {
  const { noise } = createNoise(7);
  const light = hex('#e3cfae');
  const dark = hex('#cdb38b');
  const glue = hex('#8a7356');

  return paint(width, height, (x, y, out) => {
    const v = y / height;
    const ply = v * plies;
    const index = Math.floor(ply);
    const f = ply - index;
    const base = index % 2 === 0 ? light : dark;
    const grain = noise(x / 40 + index * 13, y / 3) * 0.06;
    const isGlue = f < 0.07 && index > 0;
    const c = isGlue ? glue : base;
    out[0] = linearToSrgb(c[0] * (1 + grain));
    out[1] = linearToSrgb(c[1] * (1 + grain));
    out[2] = linearToSrgb(c[2] * (1 + grain));
    out[3] = isGlue ? 0.7 : 0.6;
    out[4] = isGlue ? 0.3 : 0.5 + grain;
  });
}

/** Fine "orange peel" bump for powder-coated steel, tiled densely. */
export function powderCoatBump(size = 256) {
  const { noise } = createNoise(21);
  const canvas = makeCanvas(size, size);
  const data = new ImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = x / size;
      const t = y / size;
      const f = 24;
      const a = noise(s * f, t * f);
      const b = noise((s - 1) * f, t * f);
      const c = noise(s * f, (t - 1) * f);
      const d = noise((s - 1) * f, (t - 1) * f);
      const n = mix(mix(a, b, s), mix(c, d, s), t);
      const i = (y * size + x) * 4;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = (0.5 + n * 0.5) * 255;
      data.data[i + 3] = 255;
    }
  }
  canvas.getContext('2d').putImageData(data, 0, 0);
  return canvas;
}

/** Felt for the desk pad: dense random fibres. */
export function feltTexture(size = 256) {
  const { noise, random } = createNoise(33);
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, size, size);
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 5000; i++) {
    const x = random() * size;
    const y = random() * size;
    const angle = random() * Math.PI * 2;
    const length = 2 + random() * 5;
    const shade = 100 + random() * 60 + noise(x / 30, y / 30) * 20;
    ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  return canvas;
}

/** Soft contact shadow: a rounded rectangle blurred on a canvas. */
export function contactShadow(size = 256) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(0.45, 'rgba(0,0,0,0.75)');
  gradient.addColorStop(0.75, 'rgba(0,0,0,0.25)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Display face of the height keypad, e.g. "72.0". */
export function keypadDisplay(text) {
  const canvas = makeCanvas(128, 48);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, 128, 48);
  ctx.fillStyle = '#e8f1ff';
  ctx.font = '600 30px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 26);
  return canvas;
}

/** Key caps seen from above for the scene keyboard: dark caps on a darker deck. */
export function keyboardKeys() {
  const canvas = makeCanvas(512, 160);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#15171a';
  ctx.fillRect(0, 0, 512, 160);
  const rows = [14, 14, 13, 12, 10];
  rows.forEach((count, row) => {
    const y = 6 + row * (148 / rows.length);
    const h = 148 / rows.length - 5;
    const w = (496 - (count - 1) * 4) / count;
    for (let i = 0; i < count; i++) {
      // The bottom row: a long space bar in the middle.
      if (row === 4 && i === 3) {
        ctx.fillStyle = '#2c2f34';
        ctx.fillRect(8 + i * (w + 4), y, w * 4 + 12, h);
        i += 3;
        continue;
      }
      ctx.fillStyle = '#2c2f34';
      ctx.fillRect(8 + i * (w + 4), y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(8 + i * (w + 4), y, w, 2);
    }
  });
  return canvas;
}
