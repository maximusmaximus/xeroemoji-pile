import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  CoefficientCombineRule,
  CuboidCollider,
  Physics,
  RigidBody,
  useRapier,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import { bodies, bodyIds, emitPile, pileBus } from "./bus";
import { liveLimit, onPhone } from "./device";
import { EmojiTextureLoader } from "./emoji-texture";
import { loadEmojiLibrary, type EmojiAsset } from "./library";

type Drop = {
  key: string;
  asset: EmojiAsset;
  position: [number, number, number];
  rotation: [number, number, number];
};

const AREA = 2.85;
const THICK = 0.08;

function Lights({ lit }: { lit: boolean }) {
  return (
    <>
      <hemisphereLight args={lit ? ["#fff6e8", "#cbbba6", 1.2] : ["#3a342c", "#090807", 0.16]} />
      <ambientLight intensity={lit ? 0.78 : 0.04} />
      <directionalLight
        position={[7, 12, 5]}
        intensity={lit ? 2.8 : 0.38}
        color={lit ? "#fffaf2" : "#ffe0b0"}
        castShadow={!onPhone()}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={2}
        shadow-camera-far={28}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.00035}
      />
      <directionalLight
        position={[-6, 6, -4]}
        intensity={lit ? 1.15 : 0.08}
        color={lit ? "#ffe7c2" : "#8a7a66"}
      />
    </>
  );
}

function Backdrop({ lit }: { lit: boolean }) {
  const { scene } = useThree();
  useEffect(() => {
    const color = new THREE.Color(lit ? "#f3ece3" : "#0e0d0b");
    scene.background = color;
    scene.fog = new THREE.Fog(color, 13, 32);
  }, [lit, scene]);
  return null;
}

function discGeometry(radius: number, rings: number, segs: number) {
  const positions = [0, 0, 0];
  const indices: number[] = [];
  for (let ring = 1; ring <= rings; ring++) {
    const rad = (ring / rings) * radius;
    for (let seg = 0; seg < segs; seg++) {
      const angle = (seg / segs) * Math.PI * 2;
      positions.push(Math.cos(angle) * rad, Math.sin(angle) * rad, 0);
    }
  }
  for (let seg = 0; seg < segs; seg++) {
    indices.push(0, 1 + seg, 1 + ((seg + 1) % segs));
  }
  for (let ring = 1; ring < rings; ring++) {
    const row = 1 + (ring - 1) * segs;
    const next = row + segs;
    for (let seg = 0; seg < segs; seg++) {
      const a = row + seg;
      const b = row + ((seg + 1) % segs);
      const c = next + seg;
      const d = next + ((seg + 1) % segs);
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Membrane({ lit }: { lit: boolean }) {
  const rings = 16;
  const segs = 32;
  const geometry = useMemo(() => discGeometry(AREA, rings, segs), []);
  const rest = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry]);
  const velocity = useMemo(() => new Float32Array(geometry.attributes.position.count), [geometry]);
  const edgeStart = 1 + (rings - 1) * segs;

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.033);
    const position = geometry.attributes.position;
    const array = position.array as Float32Array;
    const presses: { x: number; y: number; depth: number }[] = [];
    for (const body of bodies) {
      if (body === pileBus.held) continue;
      const t = body.translation();
      const speed = body.linvel();
      if (t.y > 0.85) continue;
      const localX = t.x;
      const localY = -t.z;
      if (Math.hypot(localX, localY) > AREA) continue;
      const depth = Math.min(0.46, Math.max(0, -speed.y) * 0.045 + Math.max(0, 0.42 - t.y) * 0.55);
      if (depth > 0.012) presses.push({ x: localX, y: localY, depth });
    }
    for (let i = 0; i < position.count; i++) {
      const o = i * 3;
      if (i >= edgeStart) {
        array[o + 2] = 0;
        velocity[i] = 0;
        continue;
      }
      const x = rest[o] ?? 0;
      const y = rest[o + 1] ?? 0;
      let target = 0;
      for (const press of presses) {
        const dist = Math.hypot(x - press.x, y - press.y);
        const reach = 0.72;
        if (dist >= reach) continue;
        target -= press.depth * Math.cos((dist / reach) * Math.PI * 0.5);
      }
      target = Math.max(target, -0.4);
      const z = array[o + 2] ?? 0;
      const next = (velocity[i] ?? 0) + ((target - z) * 78 - (velocity[i] ?? 0) * 8.5) * step;
      velocity[i] = next;
      array[o + 2] = z + next * step;
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
      <meshStandardMaterial color={lit ? "#d7c2ae" : "#241c16"} roughness={0.48} metalness={0} />
    </mesh>
  );
}

function Floor({ lit }: { lit: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[22, 64]} />
        <meshStandardMaterial color={lit ? "#e6ded2" : "#12100c"} roughness={1} metalness={0} />
      </mesh>
      <Membrane lit={lit} />
      <RigidBody type="fixed" colliders={false} friction={0.55} restitution={0.72}>
        <CuboidCollider
          args={[24, 4, 24]}
          position={[0, -4, 0]}
          friction={0.55}
          restitution={0.72}
          restitutionCombineRule={CoefficientCombineRule.Max}
        />
        {Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * Math.PI * 2;
          return (
            <CuboidCollider
              key={i}
              args={[0.16, 1.7, 0.58]}
              position={[Math.sin(a) * (AREA + 0.2), 1.6, Math.cos(a) * (AREA + 0.2)]}
              rotation={[0, a - Math.PI / 2, 0]}
              friction={0.7}
              restitution={0.18}
            />
          );
        })}
      </RigidBody>
    </group>
  );
}

class QuietBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

type OrbitLike = {
  enabled: boolean;
  target: THREE.Vector3;
  update: () => void;
};

function EmojiCard({
  asset,
  position,
  rotation,
}: {
  asset: EmojiAsset;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const map = useLoader(EmojiTextureLoader, asset.url);
  const body = useRef<RapierRigidBody>(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const held = useRef(false);
  const ndc = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const plane = useRef(new THREE.Plane());
  const hit = useRef(new THREE.Vector3());
  const grabOffset = useRef(new THREE.Vector3());
  const velocity = useRef(new THREE.Vector3());
  const normal = useRef(new THREE.Vector3());
  const size = asset.size;

  const materials = useMemo(() => {
    const backMap = map.clone();
    backMap.wrapS = THREE.RepeatWrapping;
    backMap.repeat.x = -1;
    backMap.offset.x = 1;
    backMap.needsUpdate = true;
    const face = {
      roughness: 0.46,
      metalness: 0.02,
      transparent: true,
      alphaTest: 0.18,
      depthWrite: true,
    };
    const edge = new THREE.MeshStandardMaterial({ color: "#efe4d4", roughness: 0.72, metalness: 0 });
    const front = new THREE.MeshStandardMaterial({ ...face, map });
    const back = new THREE.MeshStandardMaterial({ ...face, map: backMap });
    return [edge, edge, edge, edge, front, back];
  }, [map]);

  useEffect(() => {
    const current = body.current;
    if (current) {
      bodies.add(current);
      bodyIds.set(current, asset.id);
      current.setAngvel(
        {
          x: (Math.random() - 0.5) * 2.2,
          y: (Math.random() - 0.5) * 2.2,
          z: (Math.random() - 0.5) * 2.2,
        },
        true,
      );
    }
    return () => {
      if (current) {
        bodies.delete(current);
        bodyIds.delete(current);
      }
      if (pileBus.held === current) pileBus.held = null;
    };
  }, [asset.id]);

  const release = () => {
    if (!held.current) return;
    held.current = false;
    pileBus.dragging = false;
    if (pileBus.held === body.current) pileBus.held = null;
    if (controls) controls.enabled = true;
    const current = body.current;
    if (!current) return;
    const v = velocity.current;
    const speed = v.length();
    if (speed > 7) v.multiplyScalar(7 / speed);
    current.setLinvel({ x: v.x * 0.7, y: v.y * 0.7, z: v.z * 0.7 }, true);
  };

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!held.current || pileBus.held !== body.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      ndc.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
    };
    const up = () => release();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [gl, controls]);

  useFrame((_, delta) => {
    const current = body.current;
    if (!held.current || !current || pileBus.held !== current) return;
    raycaster.current.setFromCamera(ndc.current, camera);
    const point = raycaster.current.ray.intersectPlane(plane.current, hit.current);
    if (!point) return;
    point.add(grabOffset.current);
    point.y = Math.max(0.06, point.y);
    const p = current.translation();
    const dt = Math.max(delta, 0.016);
    velocity.current.set((point.x - p.x) / dt, (point.y - p.y) / dt, (point.z - p.z) / dt);
    current.setTranslation({ x: point.x, y: point.y, z: point.z }, true);
    current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    current.setAngvel({ x: 0, y: 0, z: 0 }, true);
  });

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const current = body.current;
    if (!current) return;
    held.current = true;
    pileBus.dragging = true;
    pileBus.heat = Math.min(1, pileBus.heat + 0.16);
    pileBus.held = current;
    if (controls) controls.enabled = false;
    const rect = gl.domElement.getBoundingClientRect();
    ndc.current.set(
      ((e.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.nativeEvent.clientY - rect.top) / rect.height) * 2 + 1,
    );
    camera.getWorldDirection(normal.current);
    plane.current.setFromNormalAndCoplanarPoint(normal.current, e.point);
    const p = current.translation();
    grabOffset.current.set(p.x - e.point.x, p.y - e.point.y, p.z - e.point.z);
    velocity.current.set(0, 0, 0);
    current.wakeUp();
    current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    current.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };

  return (
    <RigidBody
      ref={body}
      position={position}
      rotation={rotation}
      colliders={false}
      linearDamping={0.12}
      angularDamping={0.42}
      ccd
      canSleep
    >
      <mesh
        castShadow={!onPhone()}
        receiveShadow={!onPhone()}
        material={materials}
        onPointerDown={onDown}
      >
        <boxGeometry args={[size, size, THICK]} />
      </mesh>
      <CuboidCollider
        args={[size / 2, size / 2, THICK / 2]}
        mass={0.28 + size * 0.45}
        friction={0.92}
        restitution={0.08}
      />
    </RigidBody>
  );
}

const LAST_KEY = "xero-pile-last-ids";

function readLastIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeLastIds(ids: string[]) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(ids.slice(-8000)));
  } catch {
    // private mode and full storage can refuse the write
  }
}

function shuffleAssets(assets: EmojiAsset[]) {
  for (let i = assets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = assets[i]!;
    assets[i] = assets[j]!;
    assets[j] = swap;
  }
  return assets;
}

function rememberIds(ids: string[]) {
  const last = readLastIds();
  for (const id of ids) last.add(id);
  writeLastIds([...last]);
}

function freshQueue(library: EmojiAsset[]) {
  const unique: EmojiAsset[] = [];
  const seenIds = new Set<string>();
  for (const asset of library) {
    if (seenIds.has(asset.id)) continue;
    seenIds.add(asset.id);
    unique.push(asset);
  }
  const last = readLastIds();
  let pool = unique.filter((asset) => !last.has(asset.id));
  const minKeep = Math.max(12, Math.round(unique.length * 0.01));
  if (pool.length < minKeep) {
    const recent = [...last].slice(-minKeep * 2);
    const block = new Set(recent);
    pool = unique.filter((asset) => !block.has(asset.id));
    writeLastIds(recent);
  }
  return shuffleAssets(pool);
}

function Spawner() {
  const [drops, setDrops] = useState<Drop[]>([]);
  const queue = useRef<EmojiAsset[] | null>(null);
  const ready = useRef(false);
  const batch = useRef(12);
  const limit = useRef(240);
  const live = useRef(0);
  const waveLeft = useRef(0);
  const falling = useRef(false);
  const landAt = useRef(0);
  const moreSeen = useRef(0);
  const nextDrop = useRef(0);

  const beginWave = (remaining: number) => {
    const count = Math.min(remaining, batch.current, limit.current - live.current);
    if (count <= 0) {
      falling.current = false;
      pileBus.moreReady = false;
      emitPile();
      return;
    }
    waveLeft.current = count;
    falling.current = true;
    nextDrop.current = performance.now();
    landAt.current = Number.POSITIVE_INFINITY;
    pileBus.moreReady = false;
    emitPile();
  };

  useEffect(() => {
    let stop = false;
    void (async () => {
      const library = await loadEmojiLibrary();
      if (stop) return;
      limit.current = liveLimit();
      const pending = freshQueue(library);
      queue.current = pending;
      live.current = 0;
      ready.current = true;
      batch.current = Math.max(12, Math.round(library.length * 0.01));
      beginWave(pending.length);
    })();
    return () => {
      stop = true;
    };
  }, []);

  useFrame(() => {
    const pending = queue.current;
    if (!ready.current || !pending) return;
    if (pileBus.moreTick !== moreSeen.current && !falling.current && pending.length > 0) {
      moreSeen.current = pileBus.moreTick;
      beginWave(pending.length);
    }
    if (waveLeft.current > 0) {
      const now = performance.now();
      const next: Drop[] = [];
      while (waveLeft.current > 0 && pending.length > 0 && now >= nextDrop.current) {
        const asset = pending.pop()!;
        waveLeft.current -= 1;
        nextDrop.current += 80;
        rememberIds([asset.id]);
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * (AREA - 1.05);
        next.push({
          key: `${asset.id}-${live.current + next.length}`,
          asset,
          position: [
            Math.cos(angle) * radius,
            2.5 + Math.random() * 1.6,
            Math.sin(angle) * radius,
          ],
          rotation: [Math.random() * Math.PI, Math.random() * Math.PI * 2, Math.random() * 0.6],
        });
      }
      if (next.length) {
        live.current += next.length;
        setDrops((prev) => [...prev, ...next]);
      }
      if (waveLeft.current === 0) landAt.current = performance.now() + 1100;
    }
    if (!falling.current || waveLeft.current > 0 || performance.now() < landAt.current) return;
    falling.current = false;
    pileBus.moreReady = pending.length > 0 && live.current < limit.current;
    emitPile();
  });

  return (
    <>
      {drops.map((drop) => (
        <QuietBoundary key={drop.key}>
          <Suspense fallback={null}>
            <EmojiCard asset={drop.asset} position={drop.position} rotation={drop.rotation} />
          </Suspense>
        </QuietBoundary>
      ))}
    </>
  );
}

function WorldForces() {
  const { world } = useRapier();
  const camera = useThree((s) => s.camera);
  const seen = useRef(0);
  const right = useRef(new THREE.Vector3());
  const screenUp = useRef(new THREE.Vector3());
  const gravity = useRef(new THREE.Vector3(0, -22, 0));
  const target = useRef(new THREE.Vector3(0, -22, 0));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    pileBus.rush *= Math.exp(-dt * 1.35);
    pileBus.heat = Math.max(0, pileBus.heat - dt * 0.035);
    const rush = pileBus.rush;
    const G = 24 + rush * 10;
    right.current.setFromMatrixColumn(camera.matrixWorld, 0);
    right.current.y = 0;
    if (right.current.lengthSq() < 1e-6) right.current.set(1, 0, 0);
    else right.current.normalize();
    screenUp.current.setFromMatrixColumn(camera.matrixWorld, 1);
    screenUp.current.y = 0;
    if (screenUp.current.lengthSq() < 1e-6) screenUp.current.set(0, 0, -1);
    else screenUp.current.normalize();

    if (pileBus.orient.active) {
      const orientAngle =
        ((window.screen.orientation?.angle ??
          (window as Window & { orientation?: number }).orientation ??
          0) *
          Math.PI) /
        180;
      const beta = (pileBus.orient.beta * Math.PI) / 180;
      const gamma = (pileBus.orient.gamma * Math.PI) / 180;
      const dx = Math.sin(gamma);
      const dy = -Math.cos(gamma) * Math.sin(beta);
      const dz = -Math.cos(gamma) * Math.cos(beta);
      const cos = Math.cos(-orientAngle);
      const sin = Math.sin(-orientAngle);
      const sx = dx * cos - dy * sin;
      const sy = dx * sin + dy * cos;
      target.current.set(0, dz * G, 0);
      target.current.addScaledVector(right.current, sx * G);
      target.current.addScaledVector(screenUp.current, sy * G);
      if (target.current.lengthSq() > 1e-6) target.current.normalize().multiplyScalar(G);
    } else {
      target.current.set(0, -G, 0);
    }
    const blend = 1 - Math.exp(-dt * 9);
    gravity.current.lerp(target.current, blend);
    world.gravity.x = gravity.current.x;
    world.gravity.y = gravity.current.y;
    world.gravity.z = gravity.current.z;

    const decay = Math.exp(-dt * 7);
    pileBus.jolt.x *= decay;
    pileBus.jolt.y *= decay;
    pileBus.jolt.z *= decay;
    pileBus.jolt.mag *= decay;
    const jmag = pileBus.jolt.mag;
    if (pileBus.orient.active || jmag > 2) {
      for (const body of bodies) {
        if (body !== pileBus.held) body.wakeUp();
      }
    }

    for (const body of bodies) {
      const mass = body.mass();
      if (!Number.isFinite(mass) || mass <= 0 || body === pileBus.held) continue;
      const t = body.translation();
      const dist = Math.hypot(t.x, t.z);
      if (t.y < -0.02) {
        const v = body.linvel();
        body.setTranslation({ x: t.x, y: 0.06, z: t.z }, true);
        body.setLinvel({ x: v.x * 0.9, y: Math.max(2.4, -v.y * 0.8), z: v.z * 0.9 }, true);
        continue;
      }
      const edge = AREA - 0.35;
      if (dist < edge) continue;
      const pull = Math.min(28, Math.max(0, dist - edge) * 6 + Math.max(0, -t.y) * 12);
      const scale = pull * mass * dt;
      const basis = Math.max(dist, 0.2);
      body.applyImpulse({ x: (-t.x / basis) * scale, y: t.y < 0 ? scale : 0, z: (-t.z / basis) * scale }, true);
    }

    if (pileBus.shakeSeq === seen.current) return;
    seen.current = pileBus.shakeSeq;
    const power = pileBus.shakePower;
    const jx = pileBus.jolt.x;
    const jy = pileBus.jolt.y;
    const denom = Math.max(Math.hypot(jx, jy), 0.001);
    const ix = jx / denom;
    const iy = jy / denom;
    for (const body of bodies) {
      const mass = body.mass();
      if (!Number.isFinite(mass) || mass <= 0 || body === pileBus.held) continue;
      body.wakeUp();
      body.applyImpulse(
        {
          x: (right.current.x * ix + screenUp.current.x * iy) * mass * 1.15 * power,
          y: -mass * (1.1 + power * 1.35),
          z: (right.current.z * ix + screenUp.current.z * iy) * mass * 1.15 * power,
        },
        true,
      );
      body.applyTorqueImpulse(
        {
          x: (Math.random() - 0.5) * mass * 0.7 * power,
          y: (Math.random() - 0.5) * mass * 0.45 * power,
          z: (Math.random() - 0.5) * mass * 0.7 * power,
        },
        true,
      );
    }
  });

  return null;
}

function OrbitRig() {
  const ref = useRef<OrbitLike>(null);
  useFrame(() => {
    if (ref.current) ref.current.enabled = !pileBus.dragging;
  });
  return (
    <OrbitControls
      ref={ref as never}
      makeDefault
      enablePan
      screenSpacePanning
      panSpeed={1.35}
      rotateSpeed={1.75}
      zoomSpeed={1.2}
      enableDamping
      dampingFactor={0.07}
      minDistance={2.4}
      maxDistance={28}
      minPolarAngle={0.08}
      maxPolarAngle={1.42}
      target={[0, 0.15, 0]}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
}

const PLANE_TILT = Math.PI / 6;

function FrameView() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as OrbitLike | null;

  useEffect(() => {
    const aspect = Math.max(0.35, size.width / Math.max(1, size.height));
    const fov = 40;
    camera.fov = fov;
    const vFov = THREE.MathUtils.degToRad(fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const span = AREA * 2 + 0.7;
    const dist = span / 2 / Math.tan(hFov / 2);
    const look = new THREE.Vector3(0, 0.12, 0);
    camera.position.set(0, look.y + Math.sin(PLANE_TILT) * dist, look.z + Math.cos(PLANE_TILT) * dist);
    camera.near = 0.08;
    camera.far = Math.max(80, dist * 4);
    camera.lookAt(look);
    const fullH = size.height * 1.06;
    camera.setViewOffset(size.width, fullH, 0, 0, size.width, size.height);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(look);
      controls.update();
    }
  }, [camera, controls, size.height, size.width]);

  return null;
}

function Stage({ lit }: { lit: boolean }) {
  return (
    <Physics gravity={[0, -18, 0]} timeStep={1 / 60} maxCcdSubsteps={4}>
      <Backdrop lit={lit} />
      <Lights lit={lit} />
      <Floor lit={lit} />
      <Spawner />
      <WorldForces />
      <OrbitRig />
      <FrameView />
    </Physics>
  );
}

export function PileCanvas({ lit }: { lit: boolean }) {
  const phone = onPhone();
  return (
    <Canvas
      className="h-full w-full touch-none"
      shadows={!phone}
      dpr={phone ? 1 : [1, 1.5]}
      camera={{ position: [0, 6.2, 10.8], fov: 40, near: 0.08, far: 80 }}
      gl={{ antialias: !phone, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => {
        pileBus.dragging = false;
      }}
    >
      <Suspense fallback={null}>
        <Stage lit={lit} />
      </Suspense>
    </Canvas>
  );
}
