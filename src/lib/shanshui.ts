/**
 * shan-shui-inf integration for 风雨情
 * Ported from https://github.com/LingDong-/shan-shui-inf
 *
 * Generates procedural Chinese ink-wash landscape SVG backgrounds.
 */

// ── PRNG ──────────────────────────────────────────────────────────────────────

class Prng {
  private s = 1234;
  private p = 999979;
  private q = 999983;
  private m = this.p * this.q;

  private hash(x: unknown): number {
    const y = btoa(JSON.stringify(x));
    let z = 0;
    for (let i = 0; i < y.length; i++) {
      z += y.charCodeAt(i) * Math.pow(128, i);
    }
    return z;
  }

  seed(x?: number): void {
    if (x === undefined) x = Date.now();
    let y = 0;
    let z = 0;
    const redo = () => {
      y = (this.hash(x) + z) % this.m;
      z += 1;
    };
    redo();
    while (y % this.p === 0 || y % this.q === 0 || y === 0 || y === 1) redo();
    this.s = y;
    for (let i = 0; i < 10; i++) this.next();
  }

  next(): number {
    this.s = (this.s * this.s) % this.m;
    return this.s / this.m;
  }

  random(): number {
    return this.next();
  }
}

const prng = new Prng();
const rand = () => prng.random();
const randInt = (m: number, M: number) => m + rand() * (M - m);
const randChoice = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

// ── Perlin Noise ───────────────────────────────────────────────────────────────

// Simple but effective value noise (Perlin-like)
class Noise {
  private perm: number[] = [];

  constructor() {
    this.noiseSeed();
  }

  noiseSeed(seed?: number): void {
    const base = new Array(256).fill(0).map((_, i) => i);
    // Seeded shuffle
    let s = seed ?? Math.floor(rand() * 65536);
    for (let i = 255; i > 0; i--) {
      s = ((s * 1103515245 + 12345) & 0x7fffffff) % (i + 1);
      [base[i], base[s]] = [base[s], base[i]];
    }
    this.perm = [...base, ...base];
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x: number, y = 0, z = 0): number {
    if (this.perm.length === 0) this.noiseSeed();
    const p = this.perm;
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    return lerp(
      lerp(
        lerp(this.grad(p[AA], xf, yf, zf), this.grad(p[BA], xf - 1, yf, zf), u),
        lerp(this.grad(p[AB], xf, yf - 1, zf), this.grad(p[BB], xf - 1, yf - 1, zf), u),
        v
      ),
      lerp(
        lerp(this.grad(p[AA + 1], xf, yf, zf - 1), this.grad(p[BA + 1], xf - 1, yf, zf - 1), u),
        lerp(this.grad(p[AB + 1], xf, yf - 1, zf - 1), this.grad(p[BB + 1], xf - 1, yf - 1, zf - 1), u),
        v
      ),
      w
    );
  }

  noiseDetail(_lod: number, _falloff: number): void {
    // Simplified: ignore detail params for cleaner code
  }
}

const noise = new Noise();

// ── Geometry helpers ───────────────────────────────────────────────────────────

function dist(p0: [number, number], p1: [number, number]): number {
  return Math.sqrt(Math.pow(p0[0] - p1[0], 2) + Math.pow(p0[1] - p1[1], 2));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function loopNoise(x: number, len: number, scale: number): number[] {
  const s: number[] = [];
  for (let i = 0; i < len; i++) s.push(noise.noise((x + i) * scale));
  const min = Math.min(...s);
  const max = Math.max(...s);
  return s.map(v => (v - min) / (max - min + 0.0001));
}

// ── SVG primitive generators ────────────────────────────────────────────────────

function poly(
  pts: [number, number][],
  opts: { fil?: string; str?: string; wid?: number; opa?: number } = {}
): string {
  const { fil, str, wid = 1, opa = 1 } = opts;
  const pts_str = pts.map(p => p.join(",")).join(" ");
  let s = `<polygon points="${pts_str}"`;
  if (fil) s += ` fill="${fil}"`;
  if (str) s += ` stroke="${str}" stroke-width="${wid}" stroke-opacity="${opa}"`;
  s += " />";
  return s;
}

function path(
  d: string,
  opts: { fil?: string; str?: string; wid?: number; opa?: number } = {}
): string {
  const { fil, str, wid = 1, opa = 1 } = opts;
  let s = `<path d="${d}"`;
  if (fil) s += ` fill="${fil}"`;
  if (str) s += ` stroke="${str}" stroke-width="${wid}" stroke-opacity="${opa}"`;
  s += " />";
  return s;
}

function stroke(
  pts: [number, number][],
  opts: { col?: string; wid?: number; noi?: number } = {}
): string {
  const { col = "rgba(0,0,0,0.8)", wid = 2, noi = 0.5 } = opts;
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
  }
  return `<path d="${d}" stroke="${col}" stroke-width="${wid}" fill="none" />`;
}

function blob(
  x: number,
  y: number,
  opts: { len?: number; wid?: number; ang?: number; col?: string } = {}
): string {
  const { len = 10, wid = 4, ang = 0, col = "rgba(0,0,0,0.5)" } = opts;
  const dx = Math.cos(ang) * len;
  const dy = Math.sin(ang) * len;
  const pts: [number, number][] = [];
  const N = 12;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = wid * (0.6 + 0.4 * noise.noise(x * 0.1 + i, y * 0.1));
    pts.push([x + dx + Math.cos(a) * r, y + dy + Math.sin(a) * r]);
  }
  return poly(pts, { fil: col });
}

function div(pts: [number, number][], reso = 8): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = 0; j < reso; j++) {
      const t = j / reso;
      out.push([lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ── Tree generators ─────────────────────────────────────────────────────────────

function tree01(x: number, y: number, scale = 1): string {
  let canv = "";
  const h = 80 * scale;
  const trunk: [number, number][] = [
    [x, y],
    [x - 2 * scale, y - h * 0.4],
    [x + 2 * scale, y - h * 0.4],
    [x, y],
  ];
  canv += stroke(trunk, { col: "rgba(60,40,20,0.7)", wid: 4 });

  const leafcol = [80, 100, 70];
  const N = 12;
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2;
    const r = h * 0.35 * (0.7 + 0.3 * noise.noise(x + i, y));
    const lx = x + Math.cos(angle) * r;
    const ly = y - h * 0.5 + Math.sin(angle) * r * 0.5;
    canv += blob(lx, ly, {
      len: 8 * scale,
      wid: 12 * scale,
      ang: angle,
      col: `rgba(${leafcol[0]},${leafcol[1]},${leafcol[2]},0.5)`,
    });
  }
  return canv;
}

function tree02(x: number, y: number, scale = 1): string {
  let canv = "";
  const h = 100 * scale;
  canv += stroke(
    [[x, y], [x, y - h]],
    { col: "rgba(60,40,20,0.6)", wid: 3 }
  );
  // Branch strokes
  for (let i = 0; i < 3; i++) {
    const by = y - h * (0.3 + i * 0.2);
    const bangle = (i % 2 === 0 ? 1 : -1) * (0.3 + rand() * 0.4);
    const blen = h * 0.4 * (0.6 + rand() * 0.4);
    canv += stroke(
      [[x, by], [x + Math.cos(bangle - Math.PI / 2) * blen, by + Math.sin(bangle - Math.PI / 2) * blen]],
      { col: "rgba(60,40,20,0.5)", wid: 2 }
    );
  }
  // Leaf blobs
  for (let i = 0; i < 20; i++) {
    const lx = x + (rand() - 0.5) * h * 0.7;
    const ly = y - h * 0.7 + (rand() - 0.5) * h * 0.5;
    const lc = [70 + rand() * 30, 90 + rand() * 30, 60 + rand() * 20];
    canv += blob(lx, ly, {
      len: 6 * scale,
      wid: 8 * scale,
      col: `rgba(${lc[0]},${lc[1]},${lc[2]},${0.3 + rand() * 0.3})`,
    });
  }
  return canv;
}

function tree03(x: number, y: number, scale = 1): string {
  let canv = "";
  const h = 120 * scale;
  // Bent trunk using noise
  const trunkPts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const bx = (noise.noise(x * 0.05 + i, y * 0.05) - 0.5) * 20 * scale;
    trunkPts.push([x + bx * t, y - h * t]);
  }
  canv += stroke(trunkPts, { col: "rgba(50,35,15,0.6)", wid: 5 * scale });

  // Foliage as a blob cluster
  const tip = trunkPts[trunkPts.length - 1];
  for (let i = 0; i < 15; i++) {
    const angle = rand() * Math.PI * 2;
    const r = 20 * scale * (0.5 + rand());
    const lx = tip[0] + Math.cos(angle) * r;
    const ly = tip[1] + Math.sin(angle) * r;
    const lc = [50, 70, 45];
    canv += blob(lx, ly, {
      len: 10 * scale,
      wid: 15 * scale,
      col: `rgba(${lc[0]},${lc[1]},${lc[2]},${0.3 + rand() * 0.3})`,
    });
  }
  return canv;
}

function tree04(x: number, y: number, scale = 1): string {
  let canv = "";
  const h = 90 * scale;
  canv += stroke(
    [[x, y], [x + 4 * scale, y - h]],
    { col: "rgba(55,38,18,0.65)", wid: 4 * scale }
  );
  // Bark texture strokes
  for (let i = 0; i < 4; i++) {
    const by = y - h * (0.2 + i * 0.2);
    canv += stroke(
      [[x + 2 * scale, by], [x + 8 * scale + rand() * 6, by - 5 * scale]],
      { col: "rgba(55,38,18,0.3)", wid: 1.5 * scale }
    );
  }
  // Pagoda-style layered canopy
  for (let i = 0; i < 4; i++) {
    const layerY = y - h * (0.6 + i * 0.15);
    const layerW = (4 - i) * 12 * scale;
    canv += poly(
      [
        [x, layerY],
        [x - layerW, layerY + 10 * scale],
        [x + layerW, layerY + 10 * scale],
      ],
      { fil: `rgba(60,90,50,${0.4 - i * 0.07})`, str: "rgba(40,60,30,0.4)", wid: 1.5 }
    );
  }
  return canv;
}

const treeFns = [tree01, tree02, tree03, tree04];

function randomTree(x: number, y: number, scale = 1): string {
  return randChoice(treeFns)(x, y, scale);
}

// ── Mountain generators ────────────────────────────────────────────────────────

function mountainLayer(
  pts: [number, number][],
  col: string,
  strCol = "rgba(30,20,10,0.4)",
  wid = 1.5
): string {
  let canv = poly(pts, { fil: col, str: strCol, wid });
  // Add mist band at bottom
  const mistY = pts[pts.length - 1][1];
  const mist: [number, number][] = [];
  for (const p of pts) {
    if (p[1] >= mistY - 10) {
      mist.push([p[0], p[1]]);
    }
  }
  if (mist.length > 2) {
    // Already included in main poly
  }
  return canv;
}

function mountain(
  x: number,
  y: number,
  seed = 0,
  scale = 1
): string {
  noise.noiseSeed(seed);
  let canv = "";

  // Peak shape using noise
  const N = 32;
  const peakPts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const h = Math.sin(t * Math.PI) * 280 * scale;
    const nx = noise.noise(i * 0.15, seed) * 40 * scale;
    peakPts.push([x + (t - 0.5) * 200 * scale + nx, y - h]);
  }

  // Mountain body (filled polygon)
  const bodyPts: [number, number][] = [
    [peakPts[0][0], y],
    ...peakPts,
    [peakPts[peakPts.length - 1][0], y],
  ];
  canv += mountainLayer(bodyPts, "rgba(200,185,165,0.35)", "rgba(80,60,40,0.25)", 1.5);

  // Inner ink wash detail (subtle dark strokes)
  for (let i = 0; i < 3; i++) {
    const offset = (i - 1) * 30 * scale;
    const detailPts = peakPts.map((p, idx) => {
      const t = idx / (N - 1);
      return [p[0] + offset, p[1] - 5 * scale - i * 8 * scale] as [number, number];
    });
    canv += stroke(detailPts, {
      col: "rgba(60,45,30,0.15)",
      wid: 2,
    });
  }

  // Add small trees on the mountain slope
  for (let i = 0; i < 6; i++) {
    const tx = x + (rand() - 0.5) * 150 * scale;
    const ty = y - rand() * 150 * scale;
    if (ty < y - 20 * scale) {
      canv += randomTree(tx, ty, 0.4 * scale);
    }
  }

  return canv;
}

function distMount(x: number, y: number, seed = 0, scale = 1): string {
  noise.noiseSeed(seed);
  let canv = "";
  const N = 20;
  const pts: [number, number][] = [[x - 200 * scale, y]];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const h = (0.4 + 0.6 * Math.sin(t * Math.PI)) * 180 * scale;
    const nx = noise.noise(i * 0.2 + seed) * 50 * scale;
    pts.push([x + (t - 0.5) * 400 * scale + nx, y - h]);
  }
  pts.push([x + 200 * scale, y]);

  // Light gray distant mountains with multiply blend
  canv += mountainLayer(pts, "rgba(180,170,155,0.2)", "rgba(100,90,80,0.1)", 1);
  return canv;
}

function flatMount(x: number, y: number, seed = 0, scale = 1): string {
  noise.noiseSeed(seed);
  let canv = "";

  // Flat-top plateau shape
  const W = 180 * scale;
  const H = 160 * scale;
  const pts: [number, number][] = [
    [x - W * 0.6, y],
    [x - W * 0.3, y - H * 0.3],
    [x - W * 0.2, y - H * 0.95],
    [x + W * 0.2, y - H * 0.95],
    [x + W * 0.3, y - H * 0.3],
    [x + W * 0.6, y],
  ];

  canv += mountainLayer(pts, "rgba(170,155,140,0.38)", "rgba(80,65,50,0.3)", 2);

  // Add small vegetation
  for (let i = 0; i < 5; i++) {
    const tx = x + (rand() - 0.5) * W * 0.5;
    const ty = y - H * 0.95;
    canv += randomTree(tx, ty, 0.3 * scale);
  }

  return canv;
}

// ── Water / reflection ────────────────────────────────────────────────────────

function water(x: number, y: number, width: number, height: number): string {
  let canv = "";
  // Water base
  canv += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="rgba(180,195,210,0.15)" />`;

  // Horizontal ripple lines
  for (let i = 0; i < 8; i++) {
    const ry = y + (i / 7) * height;
    const waveOffset = noise.noise(i * 0.3) * 30;
    const pts: [number, number][] = [];
    for (let j = 0; j <= 20; j++) {
      const wx = x + (j / 20) * width;
      const wy = ry + Math.sin((j / 20) * Math.PI * 3 + waveOffset) * 3;
      pts.push([wx, wy]);
    }
    canv += stroke(pts, {
      col: "rgba(100,120,150,0.12)",
      wid: 1,
    });
  }
  return canv;
}

// ── Cloud / mist ───────────────────────────────────────────────────────────────

function cloud(x: number, y: number, width: number, seed = 0): string {
  noise.noiseSeed(seed);
  let canv = "";
  const blobs: string[] = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const bx = x + (i / (N - 1)) * width * 0.6 + noise.noise(i, seed) * width * 0.4;
    const by = y + noise.noise(seed, i) * 40 - 20;
    const br = 40 + noise.noise(seed + i, seed) * 60;
    blobs.push(`<ellipse cx="${bx}" cy="${by}" rx="${br}" ry="${br * 0.5}" fill="rgba(220,215,205,0.25)" />`);
  }
  canv += blobs.join("");
  return canv;
}

function mist(x: number, y: number, width: number, height: number): string {
  let canv = "";
  canv += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="rgba(240,235,225,0.08)" />`;
  // Wavy mist edge
  for (let i = 0; i < 3; i++) {
    const my = y + i * 20;
    const pts: [number, number][] = [];
    for (let j = 0; j <= 30; j++) {
      const mx = x + (j / 30) * width;
      const my2 = my + Math.sin((j / 30) * Math.PI * 4 + i) * 8;
      pts.push([mx, my2]);
    }
    canv += stroke(pts, { col: "rgba(220,215,205,0.1)", wid: 2 });
  }
  return canv;
}

// ── Birds ─────────────────────────────────────────────────────────────────────

function birds(x: number, y: number, count = 3): string {
  let canv = "";
  for (let i = 0; i < count; i++) {
    const bx = x + i * 30 + noise.noise(i, x) * 20;
    const by = y + noise.noise(y, i) * 20;
    const sz = 6 + noise.noise(i * 0.5) * 4;
    canv += `<path d="M${bx},${by} Q${bx + sz},${by - sz * 0.8} ${bx + sz * 2},${by}" stroke="rgba(60,50,40,0.2)" stroke-width="1.2" fill="none" />`;
    canv += `<path d="M${bx},${by} Q${bx - sz},${by - sz * 0.8} ${bx - sz * 2},${by}" stroke="rgba(60,50,40,0.2)" stroke-width="1.2" fill="none" />`;
  }
  return canv;
}

// ── Seal / stamp decoration ──────────────────────────────────────────────────

function seal(x: number, y: number, text = "詩"): string {
  const size = 50;
  return `<g transform="translate(${x},${y})">
    <rect x="0" y="0" width="${size}" height="${size}" fill="none" stroke="rgba(192,57,43,0.35)" stroke-width="2" rx="2" />
    <text x="${size / 2}" y="${size * 0.7}" text-anchor="middle" font-size="24" fill="rgba(192,57,43,0.35)" font-family="serif" font-weight="bold">${text}</text>
  </g>`;
}

// ── Main scene generator ──────────────────────────────────────────────────────

export interface ShanShuiOptions {
  width?: number;
  height?: number;
  seed?: number;
  showSeal?: boolean;
}

export function generateShanShuiSVG(opts: ShanShuiOptions = {}): string {
  const { width = 1440, height = 900, seed, showSeal = true } = opts;

  if (seed !== undefined) prng.seed(seed);
  else prng.seed(Math.floor(width * height + 42));
  noise.noiseSeed(prng.next() * 10000);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<defs>
    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#e8e0d5" stop-opacity="0"/>
      <stop offset="60%" stop-color="#d8cdb8" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#c8b8a0" stop-opacity="0.25"/>
    </linearGradient>
    <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#b8c8d8" stop-opacity="0"/>
      <stop offset="100%" stop-color="#98b0c8" stop-opacity="0.2"/>
    </linearGradient>
    <filter id="inkBleed">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

  // ── Sky wash ──
  svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#skyGrad)" />`;

  // ── Clouds ──
  svg += cloud(100, 60, 300, prng.next() * 1000);
  svg += cloud(width * 0.5, 40, 400, prng.next() * 1000);
  svg += cloud(width * 0.75, 80, 250, prng.next() * 1000);

  // ── Distant mountains (3 layers) ──
  svg += distMount(width * 0.1, height * 0.5, prng.next() * 10000, 0.8);
  svg += distMount(width * 0.5, height * 0.45, prng.next() * 10000, 1.0);
  svg += distMount(width * 0.3, height * 0.55, prng.next() * 10000, 0.9);

  // ── Mist band ──
  svg += mist(0, height * 0.55, width, 80);

  // ── Middle mountains ──
  svg += mountain(width * 0.15, height * 0.72, prng.next() * 10000, 1.1);
  svg += mountain(width * 0.55, height * 0.7, prng.next() * 10000, 0.95);
  svg += flatMount(width * 0.82, height * 0.68, prng.next() * 10000, 0.9);

  // ── Mist ──
  svg += mist(0, height * 0.68, width, 60);

  // ── Near mountains ──
  svg += mountain(width * -0.05, height * 0.88, prng.next() * 10000, 1.3);
  svg += mountain(width * 0.35, height * 0.85, prng.next() * 10000, 1.15);
  svg += mountain(width * 0.7, height * 0.87, prng.next() * 10000, 1.2);

  // ── Mist ──
  svg += mist(0, height * 0.82, width, 50);

  // ── Water / reflection ──
  svg += water(0, height * 0.88, width, height * 0.12);
  // Water surface line
  svg += stroke([[0, height * 0.88], [width, height * 0.88]], {
    col: "rgba(120,140,165,0.2)",
    wid: 1,
  });

  // ── Trees on water edge ──
  const treePositions = [
    [width * 0.08, height * 0.88],
    [width * 0.2, height * 0.89],
    [width * 0.45, height * 0.87],
    [width * 0.6, height * 0.88],
    [width * 0.85, height * 0.87],
    [width * 0.92, height * 0.89],
  ];
  for (const [tx, ty] of treePositions) {
    svg += randomTree(tx, ty, 0.5 + rand() * 0.4);
  }

  // ── Birds ──
  svg += birds(width * 0.15, height * 0.3, 4);
  svg += birds(width * 0.7, height * 0.25, 3);

  // ── Seal ──
  if (showSeal) {
    svg += seal(width - 80, height - 100, "詩");
  }

  svg += `</svg>`;
  return svg;
}

// ── Background fill generation ─────────────────────────────────────────────────
// Generates a data-URI SVG string suitable for CSS background-image

export function shanShuiBackground(opts: ShanShuiOptions = {}): string {
  const svg = generateShanShuiSVG(opts);
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
