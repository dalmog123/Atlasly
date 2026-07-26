/**
 * A continuously rendering WebGL globe is the most expensive thing a phone can
 * be asked to do in a browser, and the cost is paid in battery and heat rather
 * than in dropped frames — so on a phone we deliberately render less.
 *
 * Decided once, at load: WebGL context options cannot be changed afterwards.
 */
export interface DeviceProfile {
  /** Coarse pointer or a small screen: assume a phone or tablet. */
  handheld: boolean;
  /**
   * Rendering at a device pixel ratio of 3 means nine times the fragment work
   * of ratio 1. On a sphere, 1.5 is visually near-identical.
   */
  maxPixelRatio: number;
  /** Multi-sample antialiasing is a luxury a phone GPU should not pay for. */
  antialias: boolean;
  /** Half-resolution Earth imagery: a quarter of the texture memory. */
  textureVariant: '' | '-2k';
  /** How many ambient flight routes to draw; each one is two arc meshes. */
  ambientRoutes: number;
}

function detect(): DeviceProfile {
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;
  // Only genuinely tiny machines: plenty of capable laptops report four threads.
  const weakCpu = (navigator.hardwareConcurrency ?? 8) <= 2;
  const handheld = coarsePointer || smallScreen || weakCpu;

  return {
    handheld,
    maxPixelRatio: Math.min(window.devicePixelRatio || 1, handheld ? 1.5 : 2),
    antialias: !handheld,
    textureVariant: handheld ? '-2k' : '',
    ambientRoutes: handheld ? 18 : 48,
  };
}

let cached: DeviceProfile | null = null;

export function deviceProfile(): DeviceProfile {
  cached ??= detect();
  return cached;
}
