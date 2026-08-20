import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Three.js "small world" hero scene: miniature, stylized Hong Kong
 * landmarks (Victoria Peak, the Star Ferry, a double-decker tram)
 * floating inside glass bubbles, with a faint field of discovery
 * sparkles and pointer-driven parallax.
 *
 * The module is loaded lazily by SmallWorldScene so three.js never
 * blocks the initial page load.
 */

export interface SmallWorldSceneHandle {
  setPaused(paused: boolean): void;
  dispose(): void;
}

const PALETTE = {
  pine: 0x2e5d55,
  pineDeep: 0x1d403b,
  pineDark: 0x274e46,
  teal: 0x4f8f86,
  clay: 0xc2703e,
  clayDark: 0xa95c2f,
  cream: 0xf6f3ec,
  amber: 0xe8b04b,
} as const;

const CAMERA_FOV = 35;
const CAMERA_DISTANCE = 14;
const MAX_PIXEL_RATIO = 1.75;
const SPARKLE_COUNT = 90;

interface BubbleSpec {
  readonly group: THREE.Group;
  readonly contents: THREE.Group;
  readonly floatSpeed: number;
  readonly floatAmplitude: number;
  readonly floatPhase: number;
  readonly spinSpeed: number;
  basePosition: THREE.Vector3;
}

function standardMaterial(
  color: number,
  options: { flat?: boolean; emissive?: number; emissiveIntensity?: number } = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: options.flat ?? false,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
}

function addMesh(
  parent: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: readonly [number, number, number],
  rotation?: readonly [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) {
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  }
  parent.add(mesh);
  return mesh;
}

/** Flattened sphere used as the tiny "micro-planet" ground. */
function addPlanetBase(parent: THREE.Group, color: number): void {
  const base = addMesh(
    parent,
    new THREE.SphereGeometry(1.45, 28, 18),
    standardMaterial(color),
    [0, -1.15, 0],
  );
  base.scale.set(1, 0.4, 1);
}

/** Victoria Peak: layered ridges, the Peak Tower, and a lit skyline. */
function buildPeakWorld(): THREE.Group {
  const world = new THREE.Group();
  addPlanetBase(world, PALETTE.pine);

  addMesh(
    world,
    new THREE.ConeGeometry(0.85, 1.2, 7),
    standardMaterial(PALETTE.pine, { flat: true }),
    [-0.3, -0.2, 0],
  );
  addMesh(
    world,
    new THREE.ConeGeometry(0.55, 0.75, 6),
    standardMaterial(PALETTE.pineDark, { flat: true }),
    [0.42, -0.5, 0.18],
  );

  const towerMaterial = standardMaterial(PALETTE.cream);
  addMesh(
    world,
    new THREE.CylinderGeometry(0.045, 0.045, 0.22, 10),
    towerMaterial,
    [-0.38, 0.5, 0],
  );
  addMesh(
    world,
    new THREE.CylinderGeometry(0.045, 0.045, 0.22, 10),
    towerMaterial,
    [-0.22, 0.5, 0],
  );
  addMesh(
    world,
    new THREE.CylinderGeometry(0.17, 0.08, 0.14, 12),
    towerMaterial,
    [-0.3, 0.66, 0],
  );

  const skylineHeights = [0.42, 0.6, 0.34];
  skylineHeights.forEach((height, index) => {
    const x = 0.72 + index * 0.22;
    const z = index % 2 === 0 ? -0.12 : 0.16;
    addMesh(
      world,
      new THREE.BoxGeometry(0.15, height, 0.15),
      standardMaterial(PALETTE.pineDeep, {
        emissive: PALETTE.amber,
        emissiveIntensity: 0.35,
      }),
      [x, -0.85 + height / 2, z],
    );
  });

  return world;
}

/** The Star Ferry crossing a small disc of harbour water. */
function buildFerryWorld(): THREE.Group {
  const world = new THREE.Group();

  addMesh(
    world,
    new THREE.CylinderGeometry(1.32, 1.32, 0.12, 30),
    new THREE.MeshStandardMaterial({
      color: PALETTE.pineDark,
      roughness: 0.25,
      metalness: 0.2,
    }),
    [0, -1.0, 0],
  );

  const ferry = new THREE.Group();
  addMesh(
    ferry,
    new THREE.BoxGeometry(1.5, 0.22, 0.52),
    standardMaterial(PALETTE.pineDeep),
    [0, 0, 0],
  );
  addMesh(
    ferry,
    new THREE.BoxGeometry(1.3, 0.18, 0.46),
    standardMaterial(PALETTE.cream),
    [0, 0.2, 0],
  );
  addMesh(
    ferry,
    new THREE.BoxGeometry(1.02, 0.16, 0.4),
    standardMaterial(PALETTE.cream),
    [0, 0.37, 0],
  );
  addMesh(
    ferry,
    new THREE.BoxGeometry(1.1, 0.05, 0.44),
    standardMaterial(PALETTE.teal),
    [0, 0.48, 0],
  );
  addMesh(
    ferry,
    new THREE.CylinderGeometry(0.055, 0.075, 0.2, 12),
    standardMaterial(PALETTE.clay),
    [0.16, 0.6, 0],
  );
  addMesh(
    ferry,
    new THREE.SphereGeometry(0.05, 10, 8),
    standardMaterial(PALETTE.amber, {
      emissive: PALETTE.amber,
      emissiveIntensity: 0.8,
    }),
    [-0.68, 0.22, 0],
  );
  ferry.position.set(0, -0.82, 0);
  ferry.rotation.y = -0.35;
  world.add(ferry);

  return world;
}

/** A miniature double-decker tram on a leafy street. */
function buildTramWorld(): THREE.Group {
  const world = new THREE.Group();
  addPlanetBase(world, PALETTE.pine);

  addMesh(
    world,
    new THREE.BoxGeometry(1.7, 0.1, 0.72),
    standardMaterial(PALETTE.pineDark),
    [0, -0.72, 0],
  );

  const tram = new THREE.Group();
  addMesh(
    tram,
    new THREE.BoxGeometry(0.56, 0.88, 0.42),
    standardMaterial(PALETTE.clay),
    [0, 0, 0],
  );
  addMesh(
    tram,
    new THREE.BoxGeometry(0.58, 0.2, 0.43),
    standardMaterial(PALETTE.cream, {
      emissive: PALETTE.cream,
      emissiveIntensity: 0.25,
    }),
    [0, 0.18, 0],
  );
  addMesh(
    tram,
    new THREE.BoxGeometry(0.58, 0.16, 0.43),
    standardMaterial(PALETTE.cream, {
      emissive: PALETTE.amber,
      emissiveIntensity: 0.3,
    }),
    [0, -0.18, 0],
  );
  addMesh(
    tram,
    new THREE.BoxGeometry(0.64, 0.09, 0.48),
    standardMaterial(PALETTE.pineDeep),
    [0, 0.49, 0],
  );
  const wheelGeometry = new THREE.CylinderGeometry(0.09, 0.09, 0.46, 14);
  addMesh(
    tram,
    wheelGeometry,
    standardMaterial(PALETTE.pineDeep),
    [-0.16, -0.48, 0],
    [Math.PI / 2, 0, 0],
  );
  addMesh(
    tram,
    wheelGeometry,
    standardMaterial(PALETTE.pineDeep),
    [0.16, -0.48, 0],
    [Math.PI / 2, 0, 0],
  );
  tram.position.set(-0.1, -0.1, 0);
  tram.rotation.y = 0.4;
  world.add(tram);

  const foliage = addMesh(
    world,
    new THREE.SphereGeometry(0.3, 12, 10),
    standardMaterial(0x5d9e6b, { flat: true }),
    [0.85, -0.3, -0.15],
  );
  foliage.scale.set(1, 1.15, 1);
  addMesh(
    world,
    new THREE.CylinderGeometry(0.05, 0.06, 0.4, 8),
    standardMaterial(0x8c5a38),
    [0.85, -0.62, -0.15],
  );

  return world;
}

function createBubble(
  contents: THREE.Group,
  floatSpeed: number,
  floatPhase: number,
  spinSpeed: number,
): BubbleSpec {
  const group = new THREE.Group();
  contents.scale.setScalar(0.92);
  group.add(contents);

  const glassGeometry = new THREE.SphereGeometry(2, 48, 32);
  const glass = new THREE.Mesh(
    glassGeometry,
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.16,
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.4,
      side: THREE.FrontSide,
      depthWrite: false,
    }),
  );
  glass.renderOrder = 2;
  group.add(glass);

  const innerGlow = new THREE.Mesh(
    glassGeometry,
    new THREE.MeshBasicMaterial({
      color: PALETTE.teal,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  innerGlow.renderOrder = 1;
  group.add(innerGlow);

  return {
    group,
    contents,
    floatSpeed,
    floatAmplitude: 0.22,
    floatPhase,
    spinSpeed,
    basePosition: new THREE.Vector3(),
  };
}

function createSparkles(): THREE.Points {
  const positions = new Float32Array(SPARKLE_COUNT * 3);
  for (let index = 0; index < SPARKLE_COUNT; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 22;
    positions[index * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[index * 3 + 2] = -3 - Math.random() * 6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3),
  );
  const material = new THREE.PointsMaterial({
    color: PALETTE.amber,
    size: 0.055,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return new THREE.Points(geometry, material);
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) {
        material.dispose();
      }
    }
  });
}

export function createSmallWorldScene(
  host: HTMLElement,
): SmallWorldSceneHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch {
    return null;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
  );

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 60);
  camera.position.set(0, 0, CAMERA_DISTANCE);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;

  scene.add(new THREE.HemisphereLight(0x9fd3c7, 0x10231f, 0.9));
  const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.4);
  keyLight.position.set(4, 6, 8);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x4f8f86, 0.7);
  rimLight.position.set(-6, -2, -4);
  scene.add(rimLight);

  const bubbles: BubbleSpec[] = [
    createBubble(buildPeakWorld(), 0.55, 0, 0.16),
    createBubble(buildFerryWorld(), 0.42, 2.1, -0.12),
    createBubble(buildTramWorld(), 0.48, 4.2, 0.14),
  ];
  for (const bubble of bubbles) {
    scene.add(bubble.group);
  }

  const sparkles = createSparkles();
  scene.add(sparkles);

  function layout(width: number, height: number): void {
    const aspect = width / Math.max(height, 1);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const halfHeight =
      Math.tan((CAMERA_FOV * Math.PI) / 360) * CAMERA_DISTANCE;
    const halfWidth = halfHeight * aspect;
    const [peak, ferry, tram] = bubbles;
    const isNarrow = aspect < 0.95;

    if (isNarrow) {
      peak.basePosition.set(halfWidth * 0.62, halfHeight * 0.52, -2);
      ferry.basePosition.set(-halfWidth * 0.66, halfHeight * 0.66, -3.5);
      tram.basePosition.set(-halfWidth * 0.7, -halfHeight * 0.62, -3);
      peak.group.scale.setScalar(0.62);
      ferry.group.scale.setScalar(0.42);
      tram.group.scale.setScalar(0.5);
    } else {
      peak.basePosition.set(halfWidth * 0.56, -halfHeight * 0.02, 0);
      ferry.basePosition.set(-halfWidth * 0.62, halfHeight * 0.4, -2.5);
      tram.basePosition.set(-halfWidth * 0.4, -halfHeight * 0.52, -1.5);
      peak.group.scale.setScalar(1);
      ferry.group.scale.setScalar(0.66);
      tram.group.scale.setScalar(0.72);
    }
  }

  function resize(): void {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    renderer.setSize(width, height, false);
    layout(width, height);
  }

  const pointerTarget = new THREE.Vector2(0, 0);
  const pointerCurrent = new THREE.Vector2(0, 0);

  function onPointerMove(event: PointerEvent): void {
    pointerTarget.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      (event.clientY / window.innerHeight) * 2 - 1,
    );
  }

  const clock = new THREE.Clock();
  let elapsed = 0;
  let paused = false;

  function frame(): void {
    elapsed += clock.getDelta();

    pointerCurrent.lerp(pointerTarget, 0.045);
    camera.position.x = pointerCurrent.x * 0.55;
    camera.position.y = -pointerCurrent.y * 0.35;
    camera.lookAt(0, 0, 0);

    for (const bubble of bubbles) {
      const bob =
        Math.sin(elapsed * bubble.floatSpeed + bubble.floatPhase) *
        bubble.floatAmplitude;
      bubble.group.position.set(
        bubble.basePosition.x,
        bubble.basePosition.y + bob,
        bubble.basePosition.z,
      );
      bubble.contents.rotation.y = elapsed * bubble.spinSpeed;
      bubble.group.rotation.z =
        Math.sin(elapsed * bubble.floatSpeed * 0.7 + bubble.floatPhase) *
        0.03;
    }

    sparkles.rotation.y = elapsed * 0.008;
    const sparkleMaterial = sparkles.material as THREE.PointsMaterial;
    sparkleMaterial.opacity = 0.5 + Math.sin(elapsed * 0.9) * 0.2;

    renderer.render(scene, camera);
  }

  function setAnimating(animating: boolean): void {
    renderer.setAnimationLoop(animating ? frame : null);
  }

  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => resize())
      : null;
  resizeObserver?.observe(host);

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  host.appendChild(renderer.domElement);
  resize();
  setAnimating(true);

  return {
    setPaused(nextPaused: boolean): void {
      if (paused === nextPaused) {
        return;
      }
      paused = nextPaused;
      setAnimating(!nextPaused);
      if (!nextPaused) {
        clock.getDelta();
      }
    },
    dispose(): void {
      setAnimating(false);
      resizeObserver?.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      disposeObject(scene);
      environment.texture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
