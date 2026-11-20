// Seeded PRNG (mulberry32) + helpers for MONSOON ISLES
export class PRNG {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  // mulberry32
  next() {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Random float in [0, 1)
  random() {
    return this.next();
  }

  // Random float in [min, max)
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Random integer in [min, max] inclusive
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // Random element from array
  choice(arr) {
    return arr[this.int(0, arr.length - 1)];
  }

  // Random boolean with probability p
  chance(p) {
    return this.next() < p;
  }

  // Shuffle array in-place (Fisher-Yates)
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Reset to seed
  reset() {
    this.state = this.seed;
  }

  // Create a derived PRNG (for sub-systems)
  fork() {
    return new PRNG(this.int(1, 0xFFFFFFFF));
  }
}

// Parse seed from URL ?seed= parameter
export function getSeedFromURL() {
  const params = new URLSearchParams(window.location.search);
  const seed = parseInt(params.get('seed') || '1', 10);
  return Number.isFinite(seed) && seed > 0 ? seed : 1;
}

// Global PRNG instance
export const prng = new PRNG(getSeedFromURL());

// Deterministic noise helpers
export function noise1d(x, prng = PRNG.prototype) {
  // Simple value noise
  const i = Math.floor(x);
  const f = x - i;
  const a = prng.int(0, 255) / 255;
  const b = prng.int(0, 255) / 255;
  return a + (b - a) * f * f * (3 - 2 * f);
}

export function noise2d(x, y, prng = PRNG.prototype) {
  // Simple 2D value noise
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);

  const a = prng.int(0, 255) / 255;
  const b = prng.int(0, 255) / 255;
  const c = prng.int(0, 255) / 255;
  const d = prng.int(0, 255) / 255;

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Export a seeded noise function creator
export function createNoise2D(seed) {
  const p = new PRNG(seed);
  return (x, y) => noise2d(x, y, p);
}