import type { RapierRigidBody } from "@react-three/rapier";

type Listener = () => void;

export const bodies = new Set<RapierRigidBody>();
export const bodyIds = new Map<RapierRigidBody, string>();

export const pileBus = {
  dragging: false,
  held: null as RapierRigidBody | null,
  lit: true,
  shakeSeq: 0,
  shakePower: 1,
  orient: { beta: 0, gamma: 0, active: false },
  jolt: { x: 0, y: 0, z: 0, mag: 0 },
  rush: 0,
  heat: 0,
  moreReady: false,
  moreTick: 0,
};

const listeners = new Set<Listener>();

export function emitPile() {
  for (const fn of listeners) fn();
}

export function subscribePile(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
