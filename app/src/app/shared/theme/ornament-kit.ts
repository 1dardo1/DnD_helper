/**
 * A tiny vector toolkit for the class ornaments (class-ornaments.ts): smooth curves through
 * points, tapered brush strokes, leaves, gears, stars… Everything returns SVG markup whose
 * colours come from CSS classes (see themes.scss, `.th-orn`):
 *
 *   a  main ink (the class colour)     b  pale wash of it      c  deep shade (on top of a/b)
 *   d  second hue (class hue2)         e  pale second hue      l  highlight (paper colour)
 *
 * and their stroked variants `sa`, `sb`, `sc`, `sd`, `sl` (no fill).
 */

export type P = readonly [number, number];

/** Rounds to one decimal (keeps the markup short). */
export const n = (v: number): string => String(Math.round(v * 10) / 10);
const pt = (p: P): string => `${n(p[0])} ${n(p[1])}`;

export const path = (d: string, cls: string, extra = ''): string =>
  `<path class="${cls}" d="${d}"${extra ? ' ' + extra : ''}/>`;
export const circle = (c: P, r: number, cls: string, extra = ''): string =>
  `<circle class="${cls}" cx="${n(c[0])}" cy="${n(c[1])}" r="${n(r)}"${extra ? ' ' + extra : ''}/>`;
export const sw = (w: number): string => `stroke-width="${n(w)}"`;
export const op = (o: number): string => `opacity="${o}"`;

/** A point on the Catmull-Rom spline through pts at segment i, parameter t. */
function crAt(pts: readonly P[], i: number, t: number): P {
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(pts.length - 1, i + 2)];
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

/** Smooth path (Catmull-Rom as cubic Béziers) through the points. */
export function curve(pts: readonly P[], closed = false): string {
  const q = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : pts;
  const from = closed ? 1 : 0;
  const to = closed ? q.length - 2 : q.length - 1;
  let d = `M${pt(q[from])}`;
  for (let i = from; i < to; i++) {
    const p0 = q[Math.max(0, i - 1)];
    const p1 = q[i];
    const p2 = q[i + 1];
    const p3 = q[Math.min(q.length - 1, i + 2)];
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? d + 'Z' : d;
}

/** Samples the spline through pts (k samples per segment). */
export function sample(pts: readonly P[], k = 6): P[] {
  const out: P[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = 0; j < k; j++) out.push(crAt(pts, i, j / k));
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * A brush stroke along the spline through `spine`: width goes from w0 to w1 (with an optional
 * swell in the middle), ends rounded to a point when the width is 0.
 */
export function taper(spine: readonly P[], w0: number, w1: number, swell = 0, k = 5): string {
  const s = sample(spine, k);
  const left: P[] = [];
  const right: P[] = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[Math.max(0, i - 1)];
    const b = s[Math.min(s.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const t = i / (s.length - 1);
    const w = (w0 + (w1 - w0) * t + swell * Math.sin(Math.PI * t)) / 2;
    left.push([s[i][0] - (dy / len) * w, s[i][1] + (dx / len) * w]);
    right.push([s[i][0] + (dy / len) * w, s[i][1] - (dx / len) * w]);
  }
  // fewer points on the outline: every other sample, keeping both ends
  const thin = (q: P[]) => q.filter((_, i) => i % 2 === 0 || i === q.length - 1);
  return curve([...thin(left), ...thin(right).reverse()], true);
}

/** Affine placement of a unit drawing: translate, rotate (deg), scale, optional mirror. */
export interface Place {
  x: number;
  y: number;
  a?: number;
  s?: number;
  flip?: boolean;
}

export function place(p: P, at: Place): P {
  const a = ((at.a ?? 0) * Math.PI) / 180;
  const s = at.s ?? 1;
  const x = p[0] * s;
  const y = (at.flip ? -p[1] : p[1]) * s;
  return [at.x + x * Math.cos(a) - y * Math.sin(a), at.y + x * Math.sin(a) + y * Math.cos(a)];
}

/** Moves an absolute path (M L H V C Q Z; H and V become L). */
export function moved(d: string, at: Place): string {
  const tok = d.match(/[MLHVCQZ]|-?\d*\.?\d+/g) ?? [];
  let out = '';
  let cmd = 'M';
  let cur: P = [0, 0];
  for (let i = 0; i < tok.length;) {
    if (/[MLHVCQZ]/.test(tok[i])) {
      cmd = tok[i++];
      if (cmd === 'Z') out += 'Z';
      else if (cmd !== 'H' && cmd !== 'V') out += cmd;
      continue;
    }
    if (cmd === 'H' || cmd === 'V') {
      cur = cmd === 'H' ? [+tok[i], cur[1]] : [cur[0], +tok[i]];
      out += 'L' + pt(place(cur, at)) + ' ';
      i += 1;
      continue;
    }
    cur = [+tok[i], +tok[i + 1]];
    out += pt(place(cur, at)) + ' ';
    i += 2;
  }
  return out.trim();
}

/** Places a list of points. */
export const placeAll = (pts: readonly P[], at: Place): P[] => pts.map((p) => place(p, at));

// -- leaves ---------------------------------------------------------------------------------

/** Ivy leaf (unit: base at 0,0, tip at 1,0): three points, heart-shaped base. */
const IVY_HALF = 'M.14 0C.02 -.12 -.06 -.42 .16 -.54C.3 -.62 .42 -.6 .5 -.5C.62 -.36 .8 -.18 1 0';
const IVY = IVY_HALF + 'C.8 .18 .62 .36 .5 .5C.42 .6 .3 .62 .16 .54C-.06 .42 .02 .12 .14 0Z';

/** A veined ivy leaf, petiole from the stem point `from` (optional). */
export function ivy(at: Place, from?: P, tone = 'a'): string {
  const s = at.s ?? 1;
  const base = place([0, 0], at);
  let out = '';
  if (from) out += path(`M${pt(from)}Q${pt(place([-0.25, 0.05], at))} ${pt(base)}`, 'sc', sw(1.1));
  out += path(moved(IVY, at), tone);
  out += path(moved(IVY_HALF + 'Z', { ...at, flip: !at.flip }), 'c', op(0.35));
  const v = (q: P[]) =>
    path(curve(placeAll(q, at)), 'sl', `${sw(Math.max(0.5, s * 0.035))} ${op(0.7)}`);
  out += v([
    [0.1, 0],
    [0.5, 0.01],
    [0.86, 0],
  ]);
  out += v([
    [0.14, 0],
    [0.3, -0.24],
    [0.46, -0.44],
  ]);
  out += v([
    [0.14, 0],
    [0.3, 0.24],
    [0.46, 0.44],
  ]);
  return out;
}

/** A lanceolate leaf (laurel, bamboo, willow): base 0,0, tip 1,0, width w (0..1). */
export function blade(at: Place, w = 0.28, cls = 'a', vein = true): string {
  const d = `M0 0C.25 -${w} .65 -${w * 0.9} 1 0C.65 ${w * 0.9} .25 ${w} 0 0Z`;
  let out = path(moved(d, at), cls);
  out += path(moved(`M0 0C.25 -${w} .65 -${w * 0.9} 1 0Z`, at), 'c', op(0.3));
  if (vein)
    out += path(
      moved('M.05 0Q.5 .02 .9 0', at),
      'sl',
      `${sw(Math.max(0.5, (at.s ?? 1) * 0.03))} ${op(0.65)}`,
    );
  return out;
}

// -- shapes ---------------------------------------------------------------------------------

/** A cogwheel: n teeth between radius r (root) and R (tips), a hub hole of radius h. */
export function gear(c: P, R: number, r: number, teeth: number, h: number, rot = 0): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = rot + i * step;
    const q = (rad: number, da: number) =>
      pt([c[0] + rad * Math.cos(a + da * step), c[1] + rad * Math.sin(a + da * step)]);
    pts.push(`${i ? 'L' : 'M'}${q(r, -0.32)}L${q(R, -0.18)}L${q(R, 0.18)}L${q(r, 0.32)}`);
  }
  const hole = h
    ? `M${pt([c[0] + h, c[1]])}A${n(h)} ${n(h)} 0 1 0 ${pt([c[0] - h, c[1]])}A${n(h)} ${n(h)} 0 1 0 ${pt([c[0] + h, c[1]])}Z`
    : '';
  return pts.join('') + 'Z' + hole;
}

/** A star polygon: `k` points between radius R and r. */
export function star(c: P, R: number, r: number, k = 5, rot = -90): string {
  let d = '';
  for (let i = 0; i < k * 2; i++) {
    const a = ((rot + (i * 180) / k) * Math.PI) / 180;
    const rad = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${pt([c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a)])}`;
  }
  return d + 'Z';
}

/** A four-pointed sparkle with concave sides. */
export function sparkle(c: P, R: number, rot = 0): string {
  const [x, y] = c;
  const k = 0.13 / Math.SQRT2;
  const pts = [0, 1, 2, 3].map((i) => {
    const a = ((rot + i * 90) * Math.PI) / 180;
    return [x + R * Math.cos(a), y + R * Math.sin(a)] as P;
  });
  let d = `M${pt(pts[0])}`;
  for (let i = 1; i <= 4; i++) {
    const a = pts[i - 1];
    const b = pts[i % 4];
    d += `Q${pt([x + k * (a[0] + b[0] - 2 * x), y + k * (a[1] + b[1] - 2 * y)])} ${pt(b)}`;
  }
  return d + 'Z';
}

/** A ring (annulus) between radii R and r. */
export function ring(c: P, R: number, r: number): string {
  const [x, y] = c;
  const arc = (rad: number, sweep: number) =>
    `M${n(x + rad)} ${n(y)}A${n(rad)} ${n(rad)} 0 1 ${sweep} ${n(x - rad)} ${n(y)}A${n(rad)} ${n(rad)} 0 1 ${sweep} ${n(x + rad)} ${n(y)}Z`;
  return arc(R, 1) + arc(r, 0);
}

/** Points offset sideways (by d) from the spline through pts. */
export function offset(pts: readonly P[], d: number, k = 4): P[] {
  const s = sample(pts, k);
  return s.map((p, i) => {
    const a = s[Math.max(0, i - 1)];
    const b = s[Math.min(s.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - ((b[1] - a[1]) / len) * d, p[1] + ((b[0] - a[0]) / len) * d] as P;
  });
}

/** A teardrop (blood, water) hanging from c, length s. */
export function drop(c: P, s: number, cls = 'a'): string {
  const d =
    'M0 0C.12 .3 .42 .5 .42 .76C.42 1 .22 1.1 0 1.1C-.22 1.1 -.42 1 -.42 .76C-.42 .5 -.12 .3 0 0Z';
  return (
    path(moved(d, { x: c[0], y: c[1], s }), cls) +
    path(
      moved('M-.2 .7Q-.22 .9 -.06 .98', { x: c[0], y: c[1], s }),
      'sl',
      `${sw(s * 0.08)} ${op(0.7)}`,
    )
  );
}

/** An almond eye looking at the reader: white, iris in the second hue, a slit pupil. */
export function eye(c: P, s: number, a = 0): string {
  const at = { x: c[0], y: c[1], a, s };
  return (
    path(moved('M-1 0C-.5 -.62 .5 -.62 1 0C.5 .62 -.5 .62 -1 0Z', at), 'a') +
    path(moved('M-.8 0C-.4 -.42 .4 -.42 .8 0C.4 .42 -.4 .42 -.8 0Z', at), 'l') +
    circle(c, s * 0.36, 'd') +
    path(moved('M0 -.3C.08 -.1 .08 .1 0 .3C-.08 .1 -.08 -.1 0 -.3Z', at), 'c') +
    circle([c[0] + s * 0.12, c[1] - s * 0.12], s * 0.07, 'l')
  );
}

/** A sword from the pommel p0 to the tip p1 (blade, crossguard, grip, pommel). */
export function sword(p0: P, p1: P, w = 4): string {
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const a = (Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180) / Math.PI;
  const at = { x: p0[0], y: p0[1], a, s: len };
  const k = w / len;
  const g = 0.22; // where the guard sits
  return (
    path(moved(`M${g} -${k * 0.5}L.9 -${k * 0.45}L1 0L.9 ${k * 0.45}L${g} ${k * 0.5}Z`, at), 'a') +
    path(moved(`M${g} 0L.92 0`, at), 'sl', `${sw(w * 0.18)} ${op(0.55)}`) +
    path(moved(`M.05 0L${g} 0`, at), 'sd', sw(w * 0.6)) +
    path(moved(`M${g} -${k * 2}Q${g + 0.03} 0 ${g} ${k * 2}`, at), 'sc', sw(w * 0.55)) +
    circle(place([0.03, 0], at), w * 0.55, 'c')
  );
}

/**
 * Points from `start` winding inwards around c (a curl at the end of a wisp or tentacle):
 * `turns` revolutions, clockwise when dir = 1.
 */
export function spiral(start: P, c: P, turns = 1.2, dir = 1, end = 1.2): P[] {
  const r0 = Math.hypot(start[0] - c[0], start[1] - c[1]);
  const a0 = Math.atan2(start[1] - c[1], start[0] - c[0]);
  const k = Math.max(4, Math.round(turns * 8));
  const pts: P[] = [];
  for (let i = 0; i <= k; i++) {
    const t = i / k;
    const a = a0 + dir * t * turns * 2 * Math.PI;
    const r = r0 + (end - r0) * t;
    pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return pts;
}
