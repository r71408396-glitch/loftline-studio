// Desk viewer: scene, lighting, camera, and smooth changes between configurations.
// Renders only when something moves, and pauses when scrolled out of view.
import {
  Box3,
  CanvasTexture,
  NeutralToneMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Timer,
  VSMShadowMap,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DeskModel } from './desk-model.js';
import { MaterialLibrary } from './materials.js';
import { contactShadow } from './textures.js';
import { lightStage, nightStage, studioStage } from './stages.js';

const ACCESSORIES = ['desk_pad', 'monitor_arm', 'cable_tray', 'drawer'];

// How far each piece moves when the desk is pulled apart (metres, up / back).
// The top lifts off the brackets with what sits on it; the cable tray, drawer
// and keypad, which hang under the top, float in the gap; the brackets and
// cross beam rise a little off the columns.
const EXPLODE = {
  top: 0.46,
  desk_pad: 0.54,
  props: 0.54,
  monitor_arm: 0.58,
  keypad: 0.26,
  cable_tray: 0.25,
  drawer: 0.25,
  bracket: 0.1,
  beam: 0.05,
};
const EXPLODE_BACK = {};
const DEFAULTS = {
  width: 1.6,
  depth: 0.8,
  height: 0.74,
  edge: 'square',
  top: 'oak',
  frame: 'black',
  accessories: {},
};

export class DeskViewer {
  constructor(container, options = {}) {
    this.container = container;
    // stage: 'light' | 'paper' | 'studio' | 'room' | 'night' (see stages.js)
    // view: { direction: [x, y, z] camera direction from the desk, center / centerY:
    //   where the desk sits in the canvas (0.5 = middle, 0.62 = right of / below it), margin }
    // explodedFraming: frame the desk with its parts pulled apart, so the camera
    //   holds still while setExplode() animates.
    // props: keyboard and mouse on the desk pad (for scenes, not sold).
    // woodDetail: wood texture pixels per metre (higher for close-up renders).
    // pixelRatio: cap on the device pixel ratio (default 2); lower for big canvases.
    this.options = { autoRotate: false, interactive: true, stage: 'light', view: {}, explodedFraming: false, props: false, ...options };
    this.drift = { yaw: 0, pitch: 0, dolly: 0 };
    this.explode = 0;
    this.renderCallbacks = new Set();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.frame = this.frame.bind(this);
    this.timer = new Timer();
    this.dirty = true;
    this.visible = true;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.options.pixelRatio || 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NeutralToneMapping;
    renderer.toneMappingExposure = ['studio', 'room'].includes(this.options.stage) ? 1.1 : 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'pan-y';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new Scene();
    this.scene = scene;
    this.camera = new PerspectiveCamera(26, 1, 0.05, 30);
    this.target = new Vector3(0, 0.5, 0);

    this.materials = new MaterialLibrary(renderer, { woodDetail: this.options.woodDetail });
    let stage;
    if (this.options.stage === 'night') stage = nightStage(scene, renderer, this.materials, { animate: !this.reducedMotion });
    else if (['studio', 'room'].includes(this.options.stage)) stage = studioStage(scene, renderer, this.materials, this.options.stage);
    else stage = lightStage(scene, renderer, { paper: this.options.stage === 'paper' });
    // Stages with something moving (night: the dust) keep the frames coming while in view.
    this.stageUpdate = stage.update || null;
    this.key = stage.key;
    this.shadowTexture = new CanvasTexture(contactShadow());
    this.desk = new DeskModel(this.materials, { shadowColor: stage.shadowColor, props: this.options.props });
    scene.add(this.desk.group);

    // Current (animated) and target values.
    this.state = { ...DEFAULTS, presence: {} };
    this.goal = { ...DEFAULTS, presence: {} };
    for (const key of ACCESSORIES) {
      this.state.presence[key] = 0;
      this.goal.presence[key] = 0;
    }

    if (this.options.interactive) {
      const controls = new OrbitControls(this.camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.minPolarAngle = Math.PI * 0.18;
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.rotateSpeed = 0.7;
      controls.zoomSpeed = 0.6;
      controls.autoRotateSpeed = 0.6;
      controls.addEventListener('change', () => this.invalidate());
      controls.addEventListener('start', () => {
        if (controls.autoRotate) this.setAutoRotate(false);
      });
      this.controls = controls;
    }
    this.setAutoRotate(this.options.autoRotate);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.invalidate();
    });
    this.intersectionObserver.observe(container);

    this.rebuild();
    this.resize();
    this.fitCamera(true);
  }

  /** Apply a configuration. Sizes and accessories animate; finishes change at once. */
  set(config, { instant = false } = {}) {
    const goal = this.goal;
    for (const key of ['width', 'depth', 'height']) {
      if (typeof config[key] === 'number') goal[key] = config[key];
    }
    for (const key of ['edge', 'top', 'frame', 'padColor']) {
      if (config[key]) {
        goal[key] = config[key];
        this.state[key] = config[key];
      }
    }
    if (config.accessories) {
      for (const key of ACCESSORIES) goal.presence[key] = config.accessories[key] ? 1 : 0;
    }
    if (instant || this.reducedMotion) {
      Object.assign(this.state, { width: goal.width, depth: goal.depth, height: goal.height });
      Object.assign(this.state.presence, goal.presence);
      this.fitCamera(true);
    }
    this.needsRebuild = true;
    this.invalidate();
  }

  setAutoRotate(on) {
    if (!this.controls) return;
    this.controls.autoRotate = Boolean(on) && !this.reducedMotion;
    this.invalidate();
  }

  /** Renders one frame and returns it as an image data URL (used to make poster images). */
  snapshot(type = 'image/webp', quality = 0.9) {
    if (this.needsRebuild) this.rebuild();
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL(type, quality);
  }

  /** Resolves once the first frame has been drawn. */
  ready() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  resetView() {
    this.fitCamera(true);
    this.invalidate();
  }

  // Finds the closest camera distance along `direction` at which every corner
  // of the box stays inside the frame, then centres the box on screen.
  frameBox(box, direction, margin = 0.86, marginX = margin) {
    const corners = [];
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z));
      }
    }
    // Fit inside the whole (virtual) frame; resize() shifts it afterwards.
    const camera = this.camera.clone();
    camera.clearViewOffset();
    const point = new Vector3();
    const project = (target, distance) => {
      camera.position.copy(target).addScaledVector(direction, distance);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const corner of corners) {
        point.copy(corner).project(camera);
        minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      }
      return { minX, maxX, minY, maxY };
    };

    const target = box.getCenter(new Vector3());
    const tanV = Math.tan((this.camera.fov * Math.PI) / 360);
    let distance = 4;
    for (let pass = 0; pass < 3; pass++) {
      let near = 0.05;
      let far = 20;
      for (let i = 0; i < 26; i++) {
        const mid = (near + far) / 2;
        const b = project(target, mid);
        const fits = b.minX > -marginX && b.maxX < marginX && b.minY > -margin && b.maxY < margin;
        if (fits) far = mid; else near = mid;
      }
      distance = far;
      // Move the target so the box sits in the middle of the frame.
      const b = project(target, distance);
      const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      target.addScaledVector(up, ((b.minY + b.maxY) / 2) * distance * tanV * 0.9);
      target.addScaledVector(right, ((b.minX + b.maxX) / 2) * distance * tanV * camera.aspect * 0.9);
    }
    return { target, distance };
  }

  /**
   * Product photo: frames one part of the build and returns an image data URL.
   * focus: 'desk', 'frame', 'top' or an accessory key; hide: parts to leave out.
   */
  shoot({ focus = 'desk', hide = [], direction = [0.62, 0.42, 1], margin = 0.82, type = 'image/webp', quality = 0.88 } = {}) {
    if (this.needsRebuild) this.rebuild();
    const parts = this.desk.parts.children;
    for (const child of parts) {
      const part = child.userData.part || 'frame';
      if (hide.includes(part)) child.visible = false;
    }
    this.desk.shadows.visible = !hide.includes('frame');

    const focusObjects = focus === 'desk' ? parts.filter((c) => c.visible) : parts.filter((c) => (c.userData.part || 'frame') === focus && c.visible);
    const box = new Box3();
    for (const object of focusObjects) box.expandByObject(object);
    if (focus === 'desk' || focus === 'frame') box.min.y = 0;

    const dir = new Vector3(...direction).normalize();
    const { target, distance } = this.frameBox(box, dir, margin);
    const saved = { position: this.camera.position.clone(), target: this.target.clone() };
    this.camera.position.copy(target).addScaledVector(dir, distance);
    this.camera.lookAt(target);
    this.renderer.render(this.scene, this.camera);
    const data = this.renderer.domElement.toDataURL(type, quality);

    // Put everything back for the live view.
    this.camera.position.copy(saved.position);
    this.camera.lookAt(saved.target);
    this.desk.shadows.visible = true;
    this.rebuild();
    return data;
  }

  /** Editorial shot from an exact camera position; returns an image data URL. */
  shootFrom({ position, target, fov = 26, type = 'image/webp', quality = 0.88 }) {
    if (this.needsRebuild) this.rebuild();
    const { clientWidth: w, clientHeight: h } = this.container;
    const camera = this.camera.clone();
    camera.clearViewOffset();
    camera.fov = fov;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.position.set(...position);
    camera.lookAt(...target);
    this.renderer.render(this.scene, camera);
    return this.renderer.domElement.toDataURL(type, quality);
  }

  // Frames the desk from the front right, a little above table height.
  // Without orbit controls the camera follows options.view and the scroll drift.
  fitCamera(jump = false) {
    const { width, depth, height, presence } = this.goal;
    const view = this.options.view;
    // Room above the top for the highest piece when the desk is pulled apart.
    let lift = 0;
    if (this.options.explodedFraming) {
      lift = EXPLODE.top;
      if (presence.desk_pad) lift = Math.max(lift, EXPLODE.desk_pad);
      if (presence.monitor_arm) lift = Math.max(lift, EXPLODE.monitor_arm);
    }
    const top = height + lift + (presence.monitor_arm ? 0.52 : 0.02);
    let direction;
    if (jump || !this.controls) {
      direction = new Vector3(...(view.direction || [0.62, 0.42, 1])).normalize();
      if (!this.controls) {
        // Scroll drift: turn around the desk, lift and move in a little.
        direction.applyAxisAngle(new Vector3(0, 1, 0), this.drift.yaw);
        direction.y += this.drift.pitch;
        direction.normalize();
      }
    } else {
      direction = this.camera.position.clone().sub(this.controls.target).normalize();
    }

    const box = new Box3(
      new Vector3(-width / 2 - 0.04, 0, -depth / 2 - 0.02),
      new Vector3(width / 2 + 0.04, top, depth / 2 + 0.02),
    );
    const margin = view.margin || 0.86;
    // The desk sits off centre: frame it in a window that is as wide on both
    // sides as the space to its right (and below), then shift that window (setViewOffset).
    const [cx, cy] = this.center();
    const room = (c) => Math.min(c, 1 - c) / Math.max(c, 1 - c);
    const { target, distance } = this.frameBox(box, direction, margin * room(cy), margin * room(cx));
    const dolly = 1 - this.drift.dolly;

    this.target.copy(target);
    this.distance = distance;
    if (jump || !this.controls) {
      this.camera.position.copy(this.target).addScaledVector(direction, distance * dolly);
      this.camera.lookAt(this.target);
    }
    if (this.controls) {
      this.controls.target.copy(this.target);
      this.controls.minDistance = distance * 0.55;
      this.controls.maxDistance = distance * 1.6;
      this.controls.update();
    }
  }

  /** Where the desk sits in the canvas: [x, y] fractions (view.center, view.centerY). */
  center() {
    const { center = 0.5, centerY = 0.5 } = this.options.view;
    const value = (v) => (typeof v === 'function' ? v() : v);
    return [value(center), value(centerY)];
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const [cx, cy] = this.center();
    if (cx !== 0.5 || cy !== 0.5) {
      // Render part of a larger virtual frame whose middle is at (cx, cy) of the canvas.
      const fullW = w * 2 * Math.max(cx, 1 - cx);
      const fullH = h * 2 * Math.max(cy, 1 - cy);
      this.camera.aspect = fullW / fullH;
      this.camera.setViewOffset(fullW, fullH, cx < 0.5 ? fullW - w : 0, cy < 0.5 ? fullH - h : 0, w, h);
    } else {
      this.camera.aspect = w / h;
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
    if (!this.controls) this.fitCamera(true);
    this.invalidate();
  }

  /** Camera drift for scroll: yaw (radians around the desk), pitch (lift), dolly (0..1 closer). */
  setDrift({ yaw = this.drift.yaw, pitch = this.drift.pitch, dolly = this.drift.dolly } = {}) {
    Object.assign(this.drift, { yaw, pitch, dolly });
    if (!this.controls) this.fitCamera(true);
    this.invalidate();
  }

  /** Pulls the top, frame and accessories apart (0 = assembled, 1 = fully apart). */
  setExplode(amount) {
    this.explode = Math.max(0, Math.min(1, amount));
    this.applyExplode();
    this.invalidate();
  }

  applyExplode() {
    const e = this.explode;
    for (const child of this.desk.parts.children) {
      const key = child.userData.piece || child.userData.part;
      const offset = EXPLODE[key] || 0;
      const back = EXPLODE_BACK[key] || 0;
      if (child.userData.baseY === undefined) continue;
      child.position.y = child.userData.baseY + offset * e;
      child.position.z = child.userData.baseZ + back * e;
    }
  }

  /** Called after every rendered frame (for labels that follow the model). */
  onRender(callback) {
    this.renderCallbacks.add(callback);
    return () => this.renderCallbacks.delete(callback);
  }

  /** World position -> CSS pixels inside the container. */
  project(point) {
    const v = point.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * this.container.clientWidth, y: ((1 - v.y) / 2) * this.container.clientHeight };
  }

  /**
   * A point on a named part in world space: 'top', 'beam', 'cable_tray', ...
   * along: -1 (left end) to 1 (right end) of the part; 0 is its centre.
   */
  anchor(name, along = 0) {
    const box = new Box3();
    for (const child of this.desk.parts.children) {
      if ((child.userData.piece || child.userData.part) === name && child.visible) box.expandByObject(child);
    }
    if (box.isEmpty()) return null;
    const point = box.getCenter(new Vector3());
    point.x += ((box.max.x - box.min.x) / 2) * along;
    return point;
  }

  rebuild() {
    this.desk.build(this.state, this.shadowTexture);
    this.applyExplode();
    this.needsRebuild = false;
  }

  invalidate() {
    this.dirty = true;
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  // Moves the animated values toward their goals; returns true while still moving.
  step(dt) {
    const k = 1 - Math.exp(-dt * 9);
    let moving = false;
    const approach = (obj, goalObj, key) => {
      const diff = goalObj[key] - obj[key];
      if (Math.abs(diff) > 0.0004) {
        obj[key] += diff * k;
        moving = true;
      } else {
        obj[key] = goalObj[key];
      }
    };
    for (const key of ['width', 'depth', 'height']) approach(this.state, this.goal, key);
    for (const key of ACCESSORIES) approach(this.state.presence, this.goal.presence, key);
    return moving;
  }

  frame(time) {
    this.raf = null;
    this.timer.update(time);
    const dt = Math.min(this.timer.getDelta(), 0.05);

    const moving = this.step(dt);
    if (moving || this.needsRebuild) {
      this.rebuild();
      this.dirty = true;
    }
    if (moving) this.fitCamera(false);

    const controlsMoving = this.controls ? this.controls.update(dt) : false;
    if (this.stageUpdate) {
      this.stageUpdate(dt);
      this.dirty = true;
    }
    if (this.dirty || controlsMoving) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
      for (const callback of this.renderCallbacks) callback(this);
    }

    const autoRotating = this.controls && this.controls.autoRotate;
    if (this.visible && (moving || controlsMoving || autoRotating || this.stageUpdate)) {
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    if (this.controls) this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
