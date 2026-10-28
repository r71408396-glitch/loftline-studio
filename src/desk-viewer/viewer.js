// Desk viewer: scene, lighting, camera, and smooth changes between configurations.
// Renders only when something moves, and pauses when scrolled out of view.
import {
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Timer,
  VSMShadowMap,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DeskModel } from './desk-model.js';
import { MaterialLibrary } from './materials.js';
import { contactShadow } from './textures.js';

const ACCESSORIES = ['desk_pad', 'monitor_arm', 'cable_tray', 'drawer'];
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
    this.options = { autoRotate: false, interactive: true, ...options };
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.frame = this.frame.bind(this);
    this.timer = new Timer();
    this.dirty = true;
    this.visible = true;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NeutralToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'pan-y';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.8;
    pmrem.dispose();
    this.scene = scene;

    // Soft key light high above front left (like a large studio softbox),
    // a cool rim from behind, and a soft sky fill.
    const key = new DirectionalLight(new Color('#fff6ee'), 2.0);
    key.position.set(-1.4, 5, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 10;
    key.shadow.bias = -0.0005;
    key.shadow.radius = 12;
    key.shadow.blurSamples = 20;
    scene.add(key);
    this.key = key;

    const rim = new DirectionalLight(new Color('#e6edff'), 0.9);
    rim.position.set(2.5, 2.2, -3);
    scene.add(rim);

    scene.add(new HemisphereLight('#ffffff', '#d9dde3', 0.35));

    const floor = new Mesh(new PlaneGeometry(7, 7), new ShadowMaterial({ opacity: 0.13, color: '#0b1220' }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    this.camera = new PerspectiveCamera(26, 1, 0.05, 30);
    this.target = new Vector3(0, 0.5, 0);

    this.materials = new MaterialLibrary(renderer);
    this.shadowTexture = new CanvasTexture(contactShadow());
    this.desk = new DeskModel(this.materials);
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
  frameBox(box, direction, margin = 0.86) {
    const corners = [];
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z));
      }
    }
    const camera = this.camera.clone();
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
        const fits = b.minX > -margin && b.maxX < margin && b.minY > -margin && b.maxY < margin;
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

  // Frames the desk from the front right, a little above table height.
  fitCamera(jump = false) {
    const { width, depth, height, presence } = this.goal;
    const top = height + (presence.monitor_arm ? 0.52 : 0.02);
    const direction = jump || !this.controls
      ? new Vector3(0.62, 0.42, 1).normalize()
      : this.camera.position.clone().sub(this.controls.target).normalize();

    const box = new Box3(new Vector3(-width / 2 - 0.04, 0, -depth / 2 - 0.02), new Vector3(width / 2 + 0.04, top, depth / 2 + 0.02));
    const { target, distance } = this.frameBox(box, direction);

    this.target.copy(target);
    if (jump || !this.controls) {
      this.camera.position.copy(this.target).addScaledVector(direction, distance);
      this.camera.lookAt(this.target);
    }
    if (this.controls) {
      this.controls.target.copy(this.target);
      this.controls.minDistance = distance * 0.55;
      this.controls.maxDistance = distance * 1.6;
      this.controls.update();
    }
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  rebuild() {
    this.desk.build(this.state, this.shadowTexture);
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
    if (this.dirty || controlsMoving) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }

    const autoRotating = this.controls && this.controls.autoRotate;
    if (this.visible && (moving || controlsMoving || autoRotating)) {
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
