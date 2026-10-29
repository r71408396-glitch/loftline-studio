// 3D Loftline emblem: the L frame and the floating line from the logo kit's
// GLB (embedded in the bundle), lit like the desk viewer. GSAP drives every
// movement; this file only builds the scene and renders it.
import {
  Color,
  DirectionalLight,
  Group,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import model from './loftline-logo.glb';

// Resting pose: turned a little to the right and seen from slightly above,
// like the rendered logo (assets/logo-3d-still.webp).
export const REST = { x: 0.18, y: -0.32 };

export class LogoScene {
  constructor(container) {
    this.container = container;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();
    this.scene = scene;

    // Soft key from above left and a cool rim from behind right, so the
    // bevels catch a highlight on both sides of the mark.
    const key = new DirectionalLight(new Color('#ffffff'), 2.8);
    key.position.set(-3, 5, 2);
    const rim = new DirectionalLight(new Color('#c7d2fe'), 1.6);
    rim.position.set(4, 2, -3);
    scene.add(key, rim);

    this.camera = new PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0, 6.6);

    // tilt follows the pointer, pivot turns the whole mark, and the frame and
    // line move on their own inside it.
    this.tilt = new Group();
    this.pivot = new Group();
    this.pivot.rotation.set(REST.x, REST.y, 0);
    this.tilt.add(this.pivot);
    scene.add(this.tilt);

    this.resize = this.resize.bind(this);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.resize();

    this.loaded = this.load();
  }

  async load() {
    const loader = new GLTFLoader();
    const buffer = model.buffer.slice(model.byteOffset, model.byteOffset + model.byteLength);
    const gltf = await loader.parseAsync(buffer, '');
    const root = gltf.scene;
    this.frame = root.getObjectByName('L_Frame');
    this.line = root.getObjectByName('Floating_Line');
    if (!this.frame || !this.line) throw new Error('Logo model is missing L_Frame or Floating_Line');
    this.pivot.add(root);
    this.render();
    return this;
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // Keep the whole mark in view on narrow stages.
    this.camera.position.z = width < height ? 6.6 * (height / width) : 6.6;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
