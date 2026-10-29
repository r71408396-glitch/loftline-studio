// Lighting and surroundings for the desk viewer.
//   light   white page: soft key, cool rim, shadow only (builder, product photos)
//   paper   the same on the warm off-white sections, with a warmer shadow
//   studio  a dark charcoal room: concrete floor and wall, one warm window
//           light falling across the desk, fading into darkness (home hero)
//   room    the same room with warm plaster walls in daylight (editorial shots)
import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  CanvasTexture,
  NoColorSpace,
  ShadowMaterial,
  SpotLight,
  SRGBColorSpace,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { solidTexture } from './textures.js';

export const STUDIO_COLOR = '#141414';

function environment(scene, renderer, intensity) {
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = intensity;
  pmrem.dispose();
}

function softShadow(light, size, extent) {
  light.castShadow = true;
  light.shadow.mapSize.set(size, size);
  light.shadow.bias = -0.0005;
  light.shadow.radius = 12;
  light.shadow.blurSamples = 20;
  if (light.shadow.camera.isOrthographicCamera) {
    Object.assign(light.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 2, far: 10 });
  }
}

export function lightStage(scene, renderer, { paper = false } = {}) {
  environment(scene, renderer, 0.8);

  // Soft key light high above front left (like a large studio softbox),
  // a cool rim from behind, and a soft sky fill.
  const key = new DirectionalLight(new Color(paper ? '#fff1e2' : '#fff6ee'), 2.0);
  key.position.set(-1.4, 5, 2.4);
  softShadow(key, 1536, 5);
  scene.add(key);

  const rim = new DirectionalLight(new Color('#e6edff'), 0.9);
  rim.position.set(2.5, 2.2, -3);
  scene.add(rim);

  scene.add(new HemisphereLight('#ffffff', paper ? '#e4ddd2' : '#d9dde3', 0.35));

  const floor = new Mesh(
    new PlaneGeometry(7, 7),
    new ShadowMaterial({ opacity: paper ? 0.16 : 0.13, color: paper ? '#2a2016' : '#0b1220' }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  return { key, shadowColor: paper ? '#2a2016' : '#0b1220' };
}

function concrete(seed, color, repeat) {
  const maps = solidTexture({ seed, color, mottle: 0.16, speck: 0.03, roughness: 0.82 }, { size: 512, worldSize: 1 });
  const texture = (canvas, srgb) => {
    const t = new CanvasTexture(canvas);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    return t;
  };
  return new MeshStandardMaterial({
    map: texture(maps.color, true),
    roughnessMap: texture(maps.rough, false),
    bumpMap: texture(maps.bump, false),
    bumpScale: 0.2,
    roughness: 1,
  });
}

const ROOMS = {
  studio: { background: STUDIO_COLOR, floor: '#2c2c2b', wall: '#2a2a29', env: 0.3, sun: 150, hemi: 0.2, fog: true },
  room: { background: '#b9b1a6', floor: '#8a8178', wall: '#cfc7bb', env: 0.55, sun: 120, hemi: 0.55, fog: false },
};

export function studioStage(scene, renderer, materials, kind = 'studio') {
  const look = ROOMS[kind] || ROOMS.studio;
  environment(scene, renderer, look.env);
  scene.background = new Color(look.background);
  if (look.fog) scene.fog = new Fog(look.background, 7, 15);

  const floor = new Mesh(new PlaneGeometry(16, 16), concrete(41, look.floor, 7));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wall = new Mesh(new PlaneGeometry(16, 7), concrete(43, look.wall, 5));
  wall.position.set(0, 3.5, -2.4);
  wall.receiveShadow = true;
  scene.add(wall);

  // Warm light from a tall window up and to the left: a soft pool across the
  // desk and floor, with the room falling off into shadow around it.
  const sun = new SpotLight(new Color('#fff3e6'), look.sun, 0, 0.55, 0.8, 2);
  sun.position.set(-3.2, 4.4, 3.0);
  sun.target.position.set(0.4, 0.3, -0.3);
  softShadow(sun, 2048, 0);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 14;
  scene.add(sun, sun.target);

  // A soft wash high on the wall behind, so the desk stands out against it.
  const wash = new SpotLight(new Color('#f3eee8'), 40, 0, 0.7, 1, 2);
  wash.position.set(1.5, 3.2, 1.5);
  wash.target.position.set(1.2, 1.8, -2.4);
  scene.add(wash, wash.target);

  // Cool bounce from the front right so the dark frame keeps its outline.
  const bounce = new DirectionalLight(new Color('#d6dcff'), 0.7);
  bounce.position.set(3, 1.4, 2.5);
  scene.add(bounce);
  scene.add(new HemisphereLight('#ece8e2', '#101010', look.hemi));

  // The monitor is off, as in a quiet room.
  if (materials) materials.screen.emissiveIntensity = 0.08;

  return { key: sun, shadowColor: '#000000' };
}
