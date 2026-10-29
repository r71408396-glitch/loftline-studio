// Desk geometry built from the configuration in metres. Floor is y = 0,
// the desk is centred on x and z, and the front edge faces +z.
import {
  CanvasTexture,
  CapsuleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  SRGBColorSpace,
  Vector2,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { keyboardKeys, keypadDisplay } from './textures.js';

const TOP_THICKNESS = 0.025;
const FOOT_HEIGHT = 0.04;
const GLIDE_HEIGHT = 0.012;
const BRACKET_HEIGHT = 0.03;

function roundedRect(width, depth, radius) {
  const r = Math.min(radius, width / 2, depth / 2);
  const x = -width / 2;
  const y = -depth / 2;
  const shape = new Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + depth - r);
  shape.quadraticCurveTo(x + width, y + depth, x + width - r, y + depth);
  shape.lineTo(x + r, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

// Caps get UVs in metres (x, y of the shape). Side walls get u along the edge
// and v from 0 to 1 across the slab thickness, for the plywood plies.
function slabUVs(minZ, maxZ) {
  const span = maxZ - minZ;
  return {
    generateTopUV(geometry, vertices, a, b, c) {
      return [a, b, c].map((i) => new Vector2(vertices[i * 3], vertices[i * 3 + 1]));
    },
    generateSideWallUV(geometry, vertices, a, b, c, d) {
      const ax = vertices[a * 3];
      const ay = vertices[a * 3 + 1];
      const bx = vertices[b * 3];
      const by = vertices[b * 3 + 1];
      const alongX = Math.abs(ay - by) < Math.abs(ax - bx);
      return [a, b, c, d].map((i) => {
        const along = alongX ? vertices[i * 3] : vertices[i * 3 + 1];
        return new Vector2(along, (vertices[i * 3 + 2] - minZ) / span);
      });
    },
  };
}

/** A horizontal slab with rounded corners and a soft or crisp edge, top face at y = 0. */
function slabGeometry(width, depth, thickness, cornerRadius, edgeRadius) {
  const bevel = Math.min(edgeRadius, thickness / 2 - 0.0005);
  const shape = roundedRect(width - bevel * 2, depth - bevel * 2, Math.max(cornerRadius - bevel, 0.001));
  const geometry = new ExtrudeGeometry(shape, {
    depth: thickness - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: bevel > 0.002 ? 8 : 2,
    curveSegments: 24,
    UVGenerator: slabUVs(-bevel, thickness - bevel),
  });
  // Extruded along +z from -bevel to thickness - bevel: lay it flat, top at y = 0.
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -(thickness - bevel), 0);
  return geometry;
}

/** Tapered foot profile seen from the side, extruded across its width. */
function footGeometry(length, height, width) {
  const taper = 0.035;
  const shape = new Shape();
  shape.moveTo(-length / 2, 0);
  shape.lineTo(length / 2, 0);
  shape.lineTo(length / 2 - taper, height);
  shape.lineTo(-length / 2 + taper, height);
  shape.closePath();
  const bevel = 0.004;
  const geometry = new ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 3,
  });
  geometry.translate(0, 0, -(width - bevel * 2) / 2);
  geometry.rotateY(Math.PI / 2);
  return geometry;
}

function box(width, height, depth, radius = 0.004, segments = 3) {
  return new RoundedBoxGeometry(width, height, depth, segments, Math.min(radius, width / 2, height / 2, depth / 2));
}

export class DeskModel {
  constructor(materials, { shadowColor = '#0b1220', props = false } = {}) {
    this.materials = materials;
    this.shadowColor = shadowColor;
    this.props = props;
    this.group = new Group();
    this.parts = new Group();
    this.shadows = new Group();
    this.group.add(this.parts, this.shadows);
    this.accessories = {};
    this.keypadCanvas = null;
    this.keypadTexture = null;
    this.keypadValue = '';
  }

  add(geometry, material, parent = this.parts) {
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  clear(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
      });
    }
  }

  /**
   * Rebuilds the desk. state: { width, depth, height, edge, top, frame, presence: { key: 0..1 } }
   */
  build(state, shadowTexture) {
    this.clear(this.parts);
    this.clear(this.shadows);

    const { width: W, depth: D, height: H } = state;
    const [topFace, topEdge] = this.materials.top(state.top);
    const frame = this.materials.frame(state.frame);
    const rounded = state.edge === 'rounded';

    // Top
    const top = this.add(
      slabGeometry(W, D, TOP_THICKNESS, rounded ? 0.045 : 0.006, rounded ? 0.007 : 0.0015),
      [topFace, topEdge]
    );
    top.position.y = H;
    top.userData.part = 'top';

    // Frame: legs inset from the ends, centred front to back.
    const legX = W / 2 - Math.min(0.16, W * 0.1);
    const underTop = H - TOP_THICKNESS;
    const footLength = Math.min(0.7, D - 0.06);
    const columnBottom = GLIDE_HEIGHT + FOOT_HEIGHT;
    const columnTop = underTop - BRACKET_HEIGHT;
    const columnLength = columnTop - columnBottom;
    const bottomStage = Math.min(columnLength, 0.4);
    const upperStage = Math.max(columnLength - bottomStage, 0) / 2;

    for (const side of [-1, 1]) {
      const x = side * legX;

      const foot = this.add(footGeometry(footLength, FOOT_HEIGHT, 0.07), frame);
      foot.position.set(x, GLIDE_HEIGHT, 0);
      foot.userData.piece = 'base';

      for (const z of [-footLength / 2 + 0.045, footLength / 2 - 0.045]) {
        const glide = this.add(new CylinderGeometry(0.017, 0.019, GLIDE_HEIGHT, 20), this.materials.rubber);
        glide.position.set(x, GLIDE_HEIGHT / 2, z);
      }

      // Three-stage column, widest at the bottom.
      const stages = [
        [0.086, 0.066, bottomStage, columnBottom],
        [0.076, 0.056, upperStage + 0.004, columnBottom + bottomStage - 0.004],
        [0.066, 0.046, upperStage + 0.004, columnBottom + bottomStage + upperStage - 0.004],
      ];
      for (const [sx, sz, length, y0] of stages) {
        if (length < 0.006) continue;
        const stage = this.add(box(sx, length, sz, 0.008), frame);
        stage.position.set(x, y0 + length / 2, 0);
        stage.userData.piece = 'column';
      }

      const bracket = this.add(box(0.055, BRACKET_HEIGHT, D - 0.12, 0.004), frame);
      bracket.position.set(x, underTop - BRACKET_HEIGHT / 2, 0);
      bracket.userData.piece = 'bracket';
    }

    // Telescoping cross beam between the brackets.
    const beamY = underTop - BRACKET_HEIGHT / 2 - 0.004;
    const beamZ = -0.03;
    const outer = this.add(box(legX + 0.12, 0.036, 0.06, 0.004), frame);
    outer.position.set(-legX + (legX + 0.12) / 2, beamY, beamZ);
    outer.userData.piece = 'beam';
    const inner = this.add(box(legX, 0.028, 0.05, 0.004), frame);
    inner.position.set(legX / 2, beamY, beamZ);
    inner.userData.piece = 'beam';

    // Height keypad under the front right corner.
    const keypadX = W / 2 - Math.min(0.28, W * 0.18);
    const keypad = this.add(box(0.13, 0.022, 0.05, 0.006), this.materials.plastic);
    keypad.position.set(keypadX, underTop - 0.013, D / 2 - 0.035);
    keypad.userData.part = 'keypad';
    this.displayMaterial ||= new MeshBasicMaterial();
    this.displayMaterial.map = this.keypadDisplay(H);
    const display = new Mesh(new PlaneGeometry(0.036, 0.0135), this.displayMaterial);
    display.position.set(keypadX - 0.025, underTop - 0.013, D / 2 - 0.0095);
    display.userData.part = 'keypad';
    this.parts.add(display);

    this.buildAccessories(state, frame);
    if (this.props && state.presence.desk_pad > 0.5) this.buildProps(state);
    this.buildShadows(W, D, legX, footLength, shadowTexture);

    // Resting positions, for pulling the desk apart (DeskViewer.setExplode).
    for (const child of this.parts.children) {
      child.userData.baseY = child.position.y;
      child.userData.baseZ = child.position.z;
    }
  }

  // A keyboard and mouse on the desk pad, for scenes (not sold).
  buildProps(state) {
    const { depth: D, height: H } = state;
    const g = new Group();
    g.userData.part = 'props';
    this.parts.add(g);
    if (!this.keysMaterial) {
      const keys = new CanvasTexture(keyboardKeys());
      keys.colorSpace = SRGBColorSpace;
      keys.anisotropy = 8;
      this.keysMaterial = new MeshStandardMaterial({ map: keys, roughness: 0.7 });
    }
    const pd = Math.min(0.4, D - 0.22);
    const padZ = D / 2 - pd / 2 - 0.07;
    const keyboard = this.add(box(0.36, 0.014, 0.125, 0.005), this.materials.plastic, g);
    keyboard.position.set(-0.06, 0.003 + 0.007, 0);
    const keyTops = new Mesh(new PlaneGeometry(0.345, 0.11), this.keysMaterial);
    keyTops.rotation.x = -Math.PI / 2;
    keyTops.position.set(-0.06, 0.003 + 0.0145, 0);
    g.add(keyTops);
    const mouse = this.add(new CapsuleGeometry(0.03, 0.045, 6, 16), this.materials.plastic, g);
    mouse.rotation.x = Math.PI / 2;
    mouse.scale.set(1, 1, 0.55);
    mouse.position.set(0.2, 0.003 + 0.016, 0.01);
    g.position.set(0, H, padZ + 0.02);
  }

  keypadDisplay(height) {
    const text = (Math.round(height * 200) / 2).toFixed(1);
    if (!this.keypadTexture) {
      this.keypadTexture = new CanvasTexture(keypadDisplay(text));
      this.keypadTexture.colorSpace = SRGBColorSpace;
      this.keypadValue = text;
    } else if (text !== this.keypadValue) {
      this.keypadTexture.image = keypadDisplay(text);
      this.keypadTexture.needsUpdate = true;
      this.keypadValue = text;
    }
    return this.keypadTexture;
  }

  accessoryGroup(key, presence) {
    const group = new Group();
    // Accessories settle into place as they are added.
    const p = presence * presence * (3 - 2 * presence);
    group.scale.setScalar(0.85 + p * 0.15);
    group.userData.drop = (1 - p) * 0.06;
    group.visible = presence > 0.02;
    group.userData.part = key;
    this.parts.add(group);
    this.accessories[key] = group;
    return group;
  }

  buildAccessories(state, frame) {
    const { width: W, depth: D, height: H, presence = {} } = state;
    const underTop = H - TOP_THICKNESS;

    if (presence.desk_pad > 0) {
      const g = this.accessoryGroup('desk_pad', presence.desk_pad);
      const pw = Math.min(0.9, W - 0.3);
      const pd = Math.min(0.4, D - 0.22);
      const pad = this.add(slabGeometry(pw, pd, 0.003, 0.02, 0.001), this.materials.felt(state.padColor), g);
      pad.position.set(0, 0.003, 0);
      g.position.set(0, H + g.userData.drop, D / 2 - pd / 2 - 0.07);
    }

    if (presence.monitor_arm > 0) {
      const g = this.accessoryGroup('monitor_arm', presence.monitor_arm);
      const zBack = 0;
      // Clamp over the back edge
      this.add(box(0.07, 0.035, 0.08, 0.006), frame, g).position.set(0, 0.0175, zBack);
      this.add(box(0.07, 0.012, 0.08, 0.004), frame, g).position.set(0, -TOP_THICKNESS - 0.006, zBack);
      this.add(box(0.07, TOP_THICKNESS + 0.03, 0.012, 0.004), frame, g).position.set(0, -TOP_THICKNESS / 2 + 0.008, zBack - 0.046);
      // Pole and two arm segments reaching forward
      const pole = this.add(new CylinderGeometry(0.017, 0.017, 0.33, 24), frame, g);
      pole.position.set(0, 0.035 + 0.165, zBack);
      this.add(box(0.045, 0.032, 0.22, 0.012), frame, g).position.set(0, 0.33, zBack + 0.11);
      this.add(new CylinderGeometry(0.02, 0.02, 0.05, 20), frame, g).position.set(0, 0.33, zBack + 0.22);
      this.add(box(0.04, 0.03, 0.14, 0.012), frame, g).position.set(0, 0.34, zBack + 0.29);
      // Monitor (shown for scale, not sold)
      const monitor = new Group();
      this.add(box(0.615, 0.365, 0.016, 0.006), this.materials.plastic, monitor);
      const screen = this.add(new PlaneGeometry(0.6, 0.338), this.materials.screen, monitor);
      screen.position.set(0, 0.006, 0.0081);
      this.add(box(0.24, 0.18, 0.035, 0.02), this.materials.plastic, monitor).position.set(0, 0, -0.022);
      monitor.position.set(0, 0.34, zBack + 0.395);
      g.add(monitor);
      g.position.set(0, H + g.userData.drop, -D / 2 + 0.045);
    }

    if (presence.cable_tray > 0) {
      const g = this.accessoryGroup('cable_tray', presence.cable_tray);
      const length = Math.min(1.0, W - 0.5);
      this.add(box(length, 0.003, 0.11, 0.001), frame, g).position.set(0, 0, 0);
      this.add(box(length, 0.075, 0.003, 0.001), frame, g).position.set(0, 0.0375, 0.0535);
      this.add(box(length, 0.075, 0.003, 0.001), frame, g).position.set(0, 0.0375, -0.0535);
      for (const side of [-1, 1]) {
        this.add(box(0.03, 0.03, 0.11, 0.003), frame, g).position.set(side * (length / 2 - 0.06), 0.09, 0);
      }
      g.position.set(0, underTop - 0.105 - g.userData.drop, -D / 2 + 0.13);
    }

    if (presence.drawer > 0) {
      const g = this.accessoryGroup('drawer', presence.drawer);
      this.add(box(0.42, 0.065, 0.32, 0.004), frame, g);
      const front = this.add(box(0.43, 0.07, 0.012, 0.004), frame, g);
      front.position.set(0, 0, 0.165);
      const handle = this.add(box(0.16, 0.012, 0.006, 0.003), this.materials.plastic, g);
      handle.position.set(0, -0.012, 0.172);
      g.position.set(-W / 2 + 0.36, underTop - 0.0375 - g.userData.drop, D / 2 - 0.2);
    }
  }

  buildShadows(W, D, legX, footLength, texture) {
    // Soft contact shadows: one under the top, one under each foot.
    if (!this.shadowMaterial) {
      this.shadowMaterial = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        color: this.shadowColor,
      });
      this.footShadowMaterial = this.shadowMaterial.clone();
      this.footShadowMaterial.opacity = 0.6;
    }
    const material = this.shadowMaterial;
    const footMaterial = this.footShadowMaterial;
    const under = new Mesh(new PlaneGeometry(W + 0.35, D + 0.35), material);
    under.rotation.x = -Math.PI / 2;
    under.position.y = 0.0005;
    this.shadows.add(under);

    for (const side of [-1, 1]) {
      const foot = new Mesh(new PlaneGeometry(0.2, footLength + 0.18), footMaterial);
      foot.rotation.x = -Math.PI / 2;
      foot.position.set(side * legX, 0.001, 0);
      this.shadows.add(foot);
    }
  }
}

export const DIMENSIONS = { TOP_THICKNESS };
