// Material presets. Keys match the codes in variant SKUs (LL-TOP-OAK-..., LL-FRM-BLK),
// so the theme can map a variant to its look without relying on translated names.
import {
  CanvasTexture,
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  NoColorSpace,
} from 'three';
import { woodTexture, solidTexture, plywoodTexture, powderCoatBump, feltTexture } from './textures.js';

export const TOPS = {
  oak: {
    kind: 'wood',
    species: {
      seed: 11, light: '#cdaa80', dark: '#987049', staveWidth: 0.068,
      ringDensity: 170, figure: 0.003, figureScale: 1.2, ringContrast: 0.5,
      poreDensity: 320, pores: 0.2, roughness: 0.52,
    },
    clearcoat: 0.2,
  },
  walnut: {
    kind: 'wood',
    species: {
      seed: 23, light: '#755039', dark: '#3d281b', sapwood: '#b88f63', sapwoodChance: 0.12,
      staveWidth: 0.088, ringDensity: 140, figure: 0.004, figureScale: 1.0, ringContrast: 0.55,
      poreDensity: 260, pores: 0.16, roughness: 0.46,
    },
    clearcoat: 0.3,
  },
  bamboo: {
    kind: 'wood',
    species: {
      seed: 37, light: '#dcc293', dark: '#bf9c66', staveWidth: 0.021,
      ringDensity: 400, figure: 0.002, figureScale: 2.0, ringContrast: 0.15,
      poreDensity: 500, pores: 0.3, roughness: 0.5, nodeSpacing: 0.34,
    },
    clearcoat: 0.25,
  },
  white: {
    kind: 'solid',
    surface: { seed: 3, color: '#eeeeec', mottle: 0.012, speck: 0, roughness: 0.55 },
    edge: 'plywood',
  },
  linoleum: {
    kind: 'solid',
    surface: { seed: 5, color: '#3b3e42', mottle: 0.09, speck: 0.035, roughness: 0.88 },
    edge: 'plywood',
  },
};

export const FRAMES = {
  black: { color: '#26282c', roughness: 0.55, metalness: 0, clearcoat: 0.12 },
  white: { color: '#e9ebee', roughness: 0.5, metalness: 0, clearcoat: 0.12 },
  graphite: { color: '#5a5f67', roughness: 0.5, metalness: 0, clearcoat: 0.12 },
  aluminium: { color: '#dde1e6', roughness: 0.3, metalness: 1, clearcoat: 0, envMapIntensity: 1.8 },
};

export class MaterialLibrary {
  constructor(renderer) {
    this.anisotropy = renderer.capabilities.getMaxAnisotropy();
    this.tops = new Map();
    this.frames = new Map();
    this.shared = {};
  }

  texture(canvas, { srgb = false, repeat = [1, 1], offset = [0, 0] } = {}) {
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(...repeat);
    texture.offset.set(...offset);
    texture.anisotropy = this.anisotropy;
    texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    return texture;
  }

  /** Returns [faceMaterial, edgeMaterial] for a top preset; textures are built once. */
  top(key) {
    if (this.tops.has(key)) return this.tops.get(key);
    const preset = TOPS[key] || TOPS.oak;
    let face;

    if (preset.kind === 'wood') {
      // Texture covers 2.0 x 0.8 m; UVs are in metres centred on the desk.
      const maps = woodTexture(preset.species);
      const options = { repeat: [1 / 2.0, 1 / 0.8], offset: [0.5, 0.5] };
      face = new MeshPhysicalMaterial({
        map: this.texture(maps.color, { ...options, srgb: true }),
        roughnessMap: this.texture(maps.rough, options),
        bumpMap: this.texture(maps.bump, options),
        bumpScale: 0.35,
        roughness: 1,
        clearcoat: preset.clearcoat,
        clearcoatRoughness: 0.4,
      });
    } else {
      const maps = solidTexture(preset.surface);
      const options = { repeat: [2, 2] };
      face = new MeshPhysicalMaterial({
        map: this.texture(maps.color, { ...options, srgb: true }),
        roughnessMap: this.texture(maps.rough, options),
        bumpMap: this.texture(maps.bump, { repeat: [6, 6] }),
        bumpScale: 0.15,
        roughness: 1,
      });
    }

    let edge = face;
    if (preset.edge === 'plywood') {
      this.shared.plywood ||= plywoodTexture();
      const maps = this.shared.plywood;
      edge = new MeshPhysicalMaterial({
        map: this.texture(maps.color, { srgb: true, repeat: [2, 1] }),
        roughnessMap: this.texture(maps.rough, { repeat: [2, 1] }),
        roughness: 1,
        clearcoat: 0.15,
        clearcoatRoughness: 0.5,
      });
    }

    const pair = [face, edge];
    this.tops.set(key, pair);
    return pair;
  }

  frame(key) {
    if (this.frames.has(key)) return this.frames.get(key);
    const preset = FRAMES[key] || FRAMES.black;
    this.shared.powder ||= powderCoatBump();
    const material = new MeshPhysicalMaterial({
      color: new Color(preset.color),
      roughness: preset.roughness,
      metalness: preset.metalness,
      clearcoat: preset.clearcoat,
      clearcoatRoughness: 0.45,
      bumpMap: this.texture(this.shared.powder, { repeat: [20, 20] }),
      bumpScale: preset.metalness ? 0.02 : 0.06,
      envMapIntensity: preset.envMapIntensity ?? 1,
    });
    this.frames.set(key, material);
    return material;
  }

  get rubber() {
    return (this.shared.rubber ||= new MeshStandardMaterial({ color: '#1b1d20', roughness: 0.9 }));
  }

  felt(color = '#34373c') {
    this.shared.felts ||= new Map();
    if (!this.shared.felts.has(color)) {
      this.shared.feltTexture ||= this.texture(feltTexture(), { repeat: [8, 8] });
      const texture = this.shared.feltTexture;
      this.shared.felts.set(color, new MeshPhysicalMaterial({
        color,
        roughness: 1,
        roughnessMap: texture,
        bumpMap: texture,
        bumpScale: 0.4,
        sheen: 0.6,
        sheenRoughness: 0.7,
        sheenColor: new Color('#7d8189'),
      }));
    }
    return this.shared.felts.get(color);
  }

  // A switched-on screen with a quiet gradient, so the monitor doesn't read as a black hole.
  get screen() {
    if (!this.shared.screen) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 144;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 256, 144);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(0.6, '#1e1b4b');
      gradient.addColorStop(1, '#3730a3');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 144);
      const glow = ctx.createRadialGradient(190, 40, 0, 190, 40, 140);
      glow.addColorStop(0, 'rgba(199, 210, 254, 0.35)');
      glow.addColorStop(1, 'rgba(199, 210, 254, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 256, 144);
      const map = this.texture(canvas, { srgb: true });
      this.shared.screen = new MeshPhysicalMaterial({
        color: '#000000',
        emissive: '#ffffff',
        emissiveMap: map,
        emissiveIntensity: 0.45,
        roughness: 0.15,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      });
    }
    return this.shared.screen;
  }

  get plastic() {
    return (this.shared.plastic ||= new MeshPhysicalMaterial({ color: '#2b2e34', roughness: 0.6, clearcoat: 0.1 }));
  }
}
