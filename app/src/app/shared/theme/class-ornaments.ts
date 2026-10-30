/**
 * Illuminated frames for the class themes: every class gets its own ornament, drawn as inline
 * SVG in the colours of the theme (CSS classes, see ornament-kit.ts and themes.scss), so
 * subclasses (their own hue) and the candlelight theme tint it for free.
 *
 * An ornament is three drawings, in a 48-unit-thick band:
 *   run     a seamless tile (w × 48) repeated along the top band and, turned, down the margins;
 *           the outer edge is y = 0, its spine runs along y = 24; keep it inside 0 < y < 48
 *   corner  128 × 128, where the margin (x 0–48) and the band (y 0–48) meet; usually the run
 *           itself, mitred (see `mitre`), under a medallion centred on (24, 24); the text
 *           starts at about (62, 54), so nothing goes there
 *   centre  cw × 48, the piece in the middle of the band (the two halves of the band fade
 *           into it); its spine enters at (0, 24) and leaves at (cw, 24)
 *
 * Loaded lazily by ClassThemeDirective; laid out by themes.scss.
 */
import {
  P,
  blade,
  circle,
  curve,
  drop,
  eye,
  gear,
  ivy,
  moved,
  n,
  offset,
  op,
  path,
  place,
  ring,
  sample,
  sparkle,
  spiral,
  star,
  sw,
  sword,
  taper,
} from './ornament-kit';

export interface Ornament {
  /** Period of the run tile. */
  w: number;
  run: string;
  /** May reference the instance's ids as `{u}` (see `mitre`). */
  corner: string;
  /** Width of the centre piece. */
  cw: number;
  centre: string;
}

export const BAND = 48;
export const CORNER = 128;

type Map2 = (p: P) => P;
const id: Map2 = (p) => p;
/** Mirror about x = cw / 2. */
const mx =
  (cw: number): Map2 =>
  (p) => [cw - p[0], p[1]];
const map = (pts: readonly P[], m: Map2): P[] => pts.map(m);
const rect = (x: number, y: number, w: number, h: number, cls: string, extra = '') =>
  `<rect class="${cls}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${extra ? ' ' + extra : ''}/>`;

/** Points of y = 24 - a·sin(2π(x + phase)/w) from x0 to x1 (a wavy spine). */
function wave(w: number, a: number, x0 = -w / 4, x1 = w * 1.25, step = w / 8, phase = 0): P[] {
  const pts: P[] = [];
  for (let x = x0; x <= x1 + 0.01; x += step)
    pts.push([x, 24 - a * Math.sin((2 * Math.PI * (x + phase)) / w)]);
  return pts;
}

/**
 * The run continued into the corner as a mitred frame: along the top up to x = 128 and down
 * the side from y = 128, meeting on the diagonal; the tiles line up with the band and the
 * margin that start there.
 */
function mitre(w: number): string {
  const k = Math.ceil(150 / w) + 1;
  let h = '';
  let v = '';
  for (let j = 1; j <= k; j++) {
    h += `<use href="#{u}-r" x="${128 - j * w}"/>`;
    v += `<use href="#{u}-r" x="${(j - 1) * w}"/>`;
  }
  return (
    `<clipPath id="{u}-mh"><path d="M-30 -30H128V128Z"/></clipPath>` +
    `<clipPath id="{u}-mv"><path d="M-30 -30L128 128H-30Z"/></clipPath>` +
    `<g clip-path="url(#{u}-mh)">${h}</g>` +
    `<g clip-path="url(#{u}-mv)"><g transform="translate(0 128) rotate(-90)">${v}</g></g>`
  );
}

/** Braid of two strands crossing every p/2 along y = 24 (from x0 to x1), mapped by m. */
function braid(x0: number, x1: number, p: number, a: number, wd: number, m: Map2 = id): string {
  const strand = (sgn: number, from: number, to: number) => {
    const pts: P[] = [];
    for (let x = from; x <= to + 0.01; x += p / 12)
      pts.push(m([x, 24 + sgn * a * Math.sin((2 * Math.PI * x) / p)]));
    return curve(pts);
  };
  const draw = (d: string, butt = false) => {
    const cap = butt ? ' stroke-linecap="butt"' : '';
    return (
      path(d, 'sc', sw(wd + 1.8) + cap) +
      path(d, 'sa', sw(wd) + cap) +
      path(d, 'sl', `${sw(wd * 0.22)} ${op(0.45)}${cap}`)
    );
  };
  let out = draw(strand(1, x0, x1)) + draw(strand(-1, x0, x1));
  // strand 1 goes over at every other crossing
  for (let x = Math.ceil(x0 / p) * p; x <= x1; x += p)
    out += draw(strand(1, x - p / 6, x + p / 6), true);
  return out;
}

// -- artificer: gears, copper pipes and rivets ------------------------------------------------

/** A spoked cogwheel: the toothed rim, spokes and a hub. */
function wheel(c: P, R: number, teeth: number, cls = 'a', rot = 0, spokes = 4): string {
  const r = R * 0.8;
  let out = path(gear(c, R, r, teeth, r * 0.72, rot), cls, 'fill-rule="evenodd"');
  out += circle(c, r * 0.72, cls === 'a' ? 'b' : 'e', op(0.7));
  for (let i = 0; i < spokes; i++) {
    const a = rot + (i * Math.PI) / spokes;
    const d = r * 0.72;
    out += path(
      `M${n(c[0] - d * Math.cos(a))} ${n(c[1] - d * Math.sin(a))}L${n(c[0] + d * Math.cos(a))} ${n(c[1] + d * Math.sin(a))}`,
      'sc',
      sw(Math.max(1.2, R * 0.13)),
    );
  }
  return out + circle(c, R * 0.24, cls) + circle(c, R * 0.09, 'l');
}

/** A straight copper pipe from x0 to x1 along y = 24 (mapped), with rivets every `riv`. */
function pipe(x0: number, x1: number, m: Map2 = id, riv = 12): string {
  const d = curve([m([x0, 24]), m([x1, 24])]);
  let out =
    path(d, 'sc', sw(9)) +
    path(d, 'sa', sw(7)) +
    path(curve([m([x0, 22.2]), m([x1, 22.2])]), 'sl', `${sw(1.3)} ${op(0.5)}`);
  for (let x = Math.ceil(x0 / riv) * riv; x <= x1; x += riv) out += circle(m([x, 25]), 1, 'c');
  return out;
}

function flange(c: P): string {
  return (
    rect(c[0] - 2.5, c[1] - 7, 5, 14, 'c', 'rx="1"') +
    circle([c[0], c[1] - 4.5], 0.9, 'l') +
    circle([c[0], c[1] + 4.5], 0.9, 'l')
  );
}

function artificer(): Ornament {
  const w = 96;
  const filigree = wave(w, 2.5, -24, 120, 12).map(([x, y]) => [x, y + 17] as P);
  const run =
    path(curve(filigree), 'sa', `${sw(0.8)} ${op(0.7)}`) +
    wheel([28, 12], 10.5, 11, 'a', 0.2) +
    wheel([47.5, 7], 6, 8, 'd', 0.5, 3) +
    wheel([74, 36], 9.5, 10, 'd', 0.1) +
    pipe(-10, 106) +
    flange([0, 24]) +
    flange([52, 24]);
  const corner =
    mitre(w) +
    wheel([50, 47], 9, 10, 'd', 0.3) +
    wheel([24, 24], 23, 16, 'a', 0.1, 6) +
    path(ring([24, 24], 27.5, 26.2), 'c', op(0.5));
  const cw = 104;
  const centre =
    pipe(-4, 108) +
    flange([22, 24]) +
    flange([82, 24]) +
    wheel([33, 10], 7, 9, 'd', 0.4, 3) +
    wheel([71, 38], 7, 9, 'd', 0.1, 3) +
    wheel([52, 24], 20, 15, 'a', 0, 6) +
    path(ring([52, 24], 9.5, 8.3), 'c', op(0.6));
  return { w, run, corner, cw, centre };
}

// -- barbarian: braided leather cord, bone beads and fangs, claw marks ------------------------

function fang(base: P, a: number, s: number): string {
  const d = 'M-.3 0C-.3 .45 -.12 .8 .1 1C.06 .7 .2 .35 .3 0Z';
  const at = { x: base[0], y: base[1], a: a - 90, s };
  return (
    path(moved(d, at), 'e') +
    path(moved(d, at), 'sd', sw(0.9)) +
    path(moved('M-.12 .15C-.1 .45 -.02 .65 .06 .8', at), 'sl', `${sw(0.8)} ${op(0.7)}`)
  );
}

function bead(c: P): string {
  return (
    rect(c[0] - 5, c[1] - 3.5, 10, 7, 'e', 'rx="2.6"') +
    rect(c[0] - 5, c[1] - 3.5, 10, 7, 'sd', 'rx="2.6" stroke-width=".9"') +
    path(
      `M${n(c[0] - 1.6)} ${n(c[1] - 3.5)}V${n(c[1] + 3.5)}M${n(c[0] + 1.6)} ${n(c[1] - 3.5)}V${n(c[1] + 3.5)}`,
      'sd',
      `${sw(0.7)} ${op(0.8)}`,
    )
  );
}

/** Three claw slashes from p0 towards p1 (ragged tapered strokes). */
function claws(p0: P, p1: P, gap: number, cls = 'c'): string {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  let out = '';
  for (const k of [-1, 0, 1]) {
    const o = k * gap;
    const s = 1 - Math.abs(k) * 0.18;
    const a: P = [p0[0] + nx * o + dx * (1 - s) * 0.5, p0[1] + ny * o + dy * (1 - s) * 0.5];
    const b: P = [a[0] + dx * s, a[1] + dy * s];
    const mid: P = [(a[0] + b[0]) / 2 + nx * 1.5, (a[1] + b[1]) / 2 + ny * 1.5];
    out += path(taper([a, mid, b], 0.4, 0, 4.2), cls);
  }
  return out;
}

function barbarian(): Ornament {
  const w = 72;
  const run =
    fang([18, 30], 90, 15) +
    fang([54, 18], -90, 13) +
    braid(-12, 84, 36, 4.2, 3.4) +
    bead([18, 24]) +
    bead([54, 24]);
  const corner =
    mitre(w) +
    circle([24, 24], 24, 'c') +
    circle([24, 24], 22.4, 'b') +
    path(ring([24, 24], 19, 17.6), 'a', op(0.8)) +
    claws([9, 13], [37, 37], 7.5, 'a') +
    fang([41, 41], 45, 15) +
    circle([24, 24], 24, 'sa', sw(2.2));
  const cw = 92;
  const centre =
    braid(-12, 104, 36, 4.2, 3.4) +
    fang([36, 28], 115, 15) +
    fang([56, 28], 65, 15) +
    fang([46, 28], 90, 19) +
    bead([46, 24]) +
    bead([28, 24]) +
    bead([64, 24]);
  return { w, run, corner, cw, centre };
}

// -- bard: a ribbon of stave with notes, a clef, a lyre ----------------------------------------

function staff(spine: readonly P[], wd = 0.7): string {
  let out = '';
  for (const o of [-6, -3, 0, 3, 6]) out += path(curve(offset(spine, o)), 'sa', sw(wd));
  return out;
}

/** A note head on a stave point; stem up (+1) or down (-1); an optional quaver flag. */
function note(c: P, dir: number, flag = false, hollow = false): string {
  const at = { x: c[0], y: c[1], a: -22, s: 2.6 };
  const head = 'M-1 0C-1 -.55 -.2 -.75 .4 -.6C1 -.45 1.1 .1 .7 .45C.2 .8 -1 .6 -1 0Z';
  let out = path(moved(head, at), hollow ? 'l' : 'a');
  if (hollow) out += path(moved(head, at), 'sa', sw(1));
  const x = c[0] + (dir > 0 ? 2.3 : -2.3);
  const y1 = c[1] - dir * 14;
  out += path(`M${n(x)} ${n(c[1])}V${n(y1)}`, 'sa', sw(0.9));
  if (flag)
    out += path(
      `M${n(x)} ${n(y1)}C${n(x + 1)} ${n(y1 + dir * 4)} ${n(x + 6)} ${n(y1 + dir * 5)} ${n(x + 4)} ${n(y1 + dir * 10)}`,
      'sa',
      sw(1.3),
    );
  return out;
}

const CLEF: P[] = [
  [25, 27],
  [21, 29],
  [20.5, 24.5],
  [25, 21],
  [31, 24.5],
  [30, 31.5],
  [23, 34],
  [16, 29.5],
  [17, 21],
  [25, 12.5],
  [29, 6.5],
  [27.5, 1.5],
  [24, 3],
  [22.5, 10],
  [24, 30],
  [26, 43],
  [23, 47],
  [19.5, 45.5],
];

function bard(): Ornament {
  const w = 120;
  const sp = wave(w, 3.5, -12, 132, 12);
  const yAt = (x: number) => 24 - 3.5 * Math.sin((2 * Math.PI * x) / w);
  const run =
    staff(sp) +
    note([14, yAt(14) + 3], 1) +
    note([30, yAt(30) - 1.5], 1) +
    note([42, yAt(42) - 4.5], 1) +
    path(`M32.3 ${n(yAt(30) - 15.5)}L44.3 ${n(yAt(42) - 18.5)}`, 'sa', sw(2.4)) +
    note([64, yAt(64) + 1.5], -1, false, true) +
    note([84, yAt(84)], -1, true) +
    note([100, yAt(100) - 3], 1) +
    note([112, yAt(112) + 1.5], 1) +
    path(`M102.3 ${n(yAt(100) - 17)}L114.3 ${n(yAt(112) - 12.5)}`, 'sa', sw(2.4)) +
    path(sparkle([58, 6], 3.4), 'd') +
    path(sparkle([92, 42], 2.6), 'd');
  const corner =
    mitre(w) +
    circle([24, 24], 25, 'b', op(0.92)) +
    circle([24, 24], 25, 'sd', sw(1.6)) +
    circle([24, 24], 22.5, 'sd', `${sw(0.6)} stroke-dasharray="1 2.2"`) +
    path(taper(CLEF, 1.2, 1.4, 2.4, 6), 'a') +
    circle([21, 43.5], 2.6, 'a') +
    path(sparkle([46, 46], 4.5), 'd') +
    path(sparkle([4, 4], 3), 'd');
  const cw = 76;
  // a lyre: two horns, a yoke, strings
  const horn: P[] = [
    [27, 42],
    [19, 36],
    [17, 25],
    [22, 15],
    [23, 8],
    [18, 4],
  ];
  const centre =
    staff([
      [-6, 24],
      [24, 24],
    ]) +
    staff([
      [52, 24],
      [82, 24],
    ]) +
    circle([38, 24], 23, 'b', op(0.92)) +
    path(taper(horn, 4, 1.2, 1.5), 'd') +
    path(taper(map(horn, mx(76)), 4, 1.2, 1.5), 'd') +
    path('M26 41.5H50', 'sd', sw(3)) +
    path('M20.5 12.5Q38 9 55.5 12.5', 'sd', sw(2)) +
    path('M31 41V11.6M35.5 41V11M40.5 41V11M45 41V11.6', 'sa', sw(0.7)) +
    circle([38, 41.5], 1.4, 'l');
  return { w, run, corner, cw, centre };
}

// -- blood hunter: crimson briar, thorns and dripping blood ------------------------------------

function thorn(base: P, a: number, s: number): string {
  return path(
    moved('M-.35 0C-.2 -.3 .1 -.7 .5 -1C.3 -.55 .32 -.25 .4 0Z', { x: base[0], y: base[1], a, s }),
    'c',
  );
}

function briar(pts: readonly P[], w0: number, w1: number, every: number, s = 5): string {
  let out = path(taper(pts, w0, w1, 0.6), 'a');
  const sm = sample(pts, 8);
  let side = 1;
  let acc = 0;
  for (let i = 1; i < sm.length - 1; i++) {
    acc += Math.hypot(sm[i][0] - sm[i - 1][0], sm[i][1] - sm[i - 1][1]);
    if (acc < every) continue;
    acc = 0;
    side = -side;
    const dir =
      (Math.atan2(sm[i + 1][1] - sm[i - 1][1], sm[i + 1][0] - sm[i - 1][0]) * 180) / Math.PI;
    const wd = w0 + ((w1 - w0) * i) / sm.length;
    const off = place([0, (side * wd) / 2], { x: sm[i][0], y: sm[i][1], a: dir });
    out += thorn(off, dir + (side > 0 ? 180 : 0), s);
  }
  return out;
}

/** A five-petalled briar rose. */
function rose(c: P, r: number): string {
  let out = '';
  for (let i = 0; i < 5; i++) {
    const at = { x: c[0], y: c[1], a: -90 + i * 72, s: r };
    out += path(
      moved('M0 0C.1 -.35 .5 -.6 .8 -.45C1.05 -.3 1.05 .3 .8 .45C.5 .6 .1 .35 0 0Z', at),
      'a',
    );
    out += path(moved('M.2 0Q.55 .05 .85 0', at), 'sc', `${sw(0.6)} ${op(0.6)}`);
  }
  out += circle(c, r * 0.32, 'c');
  for (let i = 0; i < 7; i++) {
    const a = (i * 2 * Math.PI) / 7;
    out += circle([c[0] + r * 0.2 * Math.cos(a), c[1] + r * 0.2 * Math.sin(a)], r * 0.06, 'e');
  }
  return out;
}

function bloodHunter(): Ornament {
  const w = 96;
  const run =
    path(taper(wave(w, 7, -16, 112, 12, w / 2), 1, 1), 'c', op(0.55)) +
    briar(wave(w, 5, -16, 112, 12), 2.6, 2.6, 9) +
    blade({ x: 30, y: 19, a: -70, s: 12 }, 0.32, 'c') +
    blade({ x: 76, y: 29, a: 105, s: 11 }, 0.32, 'c') +
    drop([48, 28], 9) +
    drop([86, 30], 6) +
    drop([12, 27], 7.5);
  const corner =
    mitre(w) +
    briar(
      [
        [46, 52],
        [30, 46],
        [10, 30],
        [6, 10],
        [14, 4],
      ],
      3,
      1,
      8,
      4,
    ) +
    blade({ x: 40, y: 8, a: -20, s: 13 }, 0.32, 'c') +
    blade({ x: 6, y: 40, a: 110, s: 13 }, 0.32, 'c') +
    rose([24, 24], 15) +
    drop([44, 38], 10) +
    drop([30, 46], 7);
  const cw = 80;
  let thornRing = '';
  for (let i = 0; i < 12; i++) {
    const a = i * 30;
    thornRing += thorn(place([18, 0], { x: 40, y: 24, a }), a - 60, 5);
  }
  const centre =
    briar(
      [
        [-6, 24],
        [10, 22],
        [24, 24],
      ],
      2.6,
      2.6,
      9,
    ) +
    briar(
      [
        [56, 24],
        [70, 22],
        [86, 24],
      ],
      2.6,
      2.6,
      9,
    ) +
    thornRing +
    circle([40, 24], 18, 'sa', sw(3)) +
    circle([40, 24], 15.5, 'b', op(0.9)) +
    drop([40, 10], 22);
  return { w, run, corner, cw, centre };
}

// -- cleric: gilded interlace, halo rays, cross pattée ----------------------------------------

const PATTEE =
  'M-.2 -1C-.1 -.6 -.1 -.3 -.13 -.13C-.3 -.1 -.6 -.1 -1 -.2V.2C-.6 .1 -.3 .1 -.13 .13C-.1 .3 -.1 .6 -.2 1H.2C.1 .6 .1 .3 .13 .13C.3 .1 .6 .1 1 .2V-.2C.6 -.1 .3 -.1 .13 -.13C.1 -.3 .1 -.6 .2 -1Z';

function halo(c: P, r0: number, r1: number, k: number, cls = 'a'): string {
  let d = '';
  const p = (rad: number, a: number) =>
    `${n(c[0] + rad * Math.cos(a))} ${n(c[1] + rad * Math.sin(a))}`;
  for (let i = 0; i < k; i++) {
    const a = (i * 2 * Math.PI) / k;
    const r = i % 2 ? r1 * 0.78 : r1;
    const da = Math.PI / k / 2.4;
    d += `M${p(r0, a - da)}L${p(r, a)}L${p(r0, a + da)}Z`;
  }
  return path(d, cls);
}

function cleric(): Ornament {
  const w = 48;
  const run =
    path('M-2 3.5H50M-2 44.5H50', 'sa', sw(0.9)) +
    path('M-2 6H50M-2 42H50', 'sa', `${sw(0.5)} ${op(0.6)}`) +
    braid(-12, 60, 48, 9, 3.2) +
    path(sparkle([12, 24], 3.4), 'd') +
    path(sparkle([36, 24], 3.4), 'd') +
    circle([24, 9.5], 1.2, 'a') +
    circle([24, 38.5], 1.2, 'a') +
    circle([0, 9.5], 1.2, 'a') +
    circle([0, 38.5], 1.2, 'a');
  const cross = (c: P, s: number) =>
    path(moved(PATTEE, { x: c[0], y: c[1], s }), 'a') +
    path(moved(PATTEE, { x: c[0], y: c[1], s }), 'sc', sw(0.8)) +
    circle(c, s * 0.2, 'd');
  const corner =
    mitre(w) +
    circle([24, 24], 27, 'b', op(0.95)) +
    halo([24, 24], 12, 26, 24) +
    circle([24, 24], 13.5, 'sa', sw(1.4)) +
    cross([24, 24], 11);
  const cw = 72;
  const centre =
    path('M-2 3.5H18M54 3.5H74M-2 44.5H18M54 44.5H74', 'sa', sw(0.9)) +
    braid(-12, 14, 48, 9, 3.2) +
    braid(-12, 14, 48, 9, 3.2, mx(72)) +
    circle([36, 24], 23, 'b', op(0.95)) +
    halo([36, 24], 11, 23, 20) +
    circle([36, 24], 12, 'sa', sw(1.3)) +
    cross([36, 24], 10);
  return { w, run, corner, cw, centre };
}

// -- fighter: chain links, heraldic shield, crossed swords ------------------------------------

const HEATER = 'M-1 -1H1V-.1C1 .5 .5 .85 0 1.05C-.5 .85 -1 .5 -1 -.1Z';

function shield(c: P, s: number): string {
  const at = { x: c[0], y: c[1], s };
  return (
    path(moved(HEATER, { ...at, s: s * 1.12 }), 'c') +
    path(moved(HEATER, at), 'a') +
    path(moved('M-1 .05L0 -.55L1 .05V.35L0 -.25L-1 .35Z', at), 'd') +
    path(moved('M-.7 -.82H.7', at), 'sl', `${sw(s * 0.06)} ${op(0.5)}`) +
    circle(place([0, -0.62], at), s * 0.09, 'l', op(0.8))
  );
}

function chain(x0: number, x1: number, m: Map2 = id): string {
  let out = '';
  for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) {
    // a link seen from the side, then one seen face-on
    const side = curve([m([x + 20, 24]), m([x + 41, 24])]);
    out += path(side, 'sc', sw(5.2)) + path(side, 'sa', sw(3.4));
    out += path(curve([m([x + 21, 23.3]), m([x + 40, 23.3])]), 'sl', `${sw(0.8)} ${op(0.5)}`);
    const c = m([x + 10, 24]);
    const e = (cls: string, dy: number, extra: string) =>
      `<ellipse class="${cls}" cx="${n(c[0])}" cy="${n(c[1] + dy)}" rx="12" ry="6" ${extra}/>`;
    out += e('sc', 0, 'stroke-width="5.2"') + e('sa', 0, 'stroke-width="3.4"');
    out += e('sl', -0.6, 'stroke-width=".8" opacity=".45"');
  }
  return out;
}

function fighter(): Ornament {
  const w = 40;
  const run =
    path('M-2 6H42M-2 42H42', 'sa', `${sw(0.8)} ${op(0.7)}`) +
    chain(-40, 80) +
    path(star([30, 11], 3, 1.2, 4), 'd') +
    path(star([30, 37], 3, 1.2, 4), 'd');
  const corner =
    mitre(w) + sword([2, 46], [50, 0], 4.2) + sword([2, 2], [56, 56], 4.2) + shield([24, 24], 15);
  const cw = 100;
  const centre =
    path('M-2 6H30M70 6H102M-2 42H30M70 42H102', 'sa', `${sw(0.8)} ${op(0.7)}`) +
    chain(-40, 24) +
    chain(-40, 24, mx(100)) +
    sword([24, 44], [80, 4], 4) +
    sword([76, 44], [20, 4], 4) +
    shield([50, 22], 13);
  return { w, run, corner, cw, centre };
}

// -- monk: bamboo and ensō brush circles --------------------------------------------------------

function bamboo(x0: number, x1: number, seg: number, m: Map2 = id): string {
  let out = '';
  for (let x = Math.floor(x0 / seg) * seg; x < x1; x += seg) {
    const pts: P[] = [
      [x + 1.6, 24.4],
      [x + seg / 2, 23.6],
      [x + seg - 1.6, 24.2],
    ];
    out += path(taper(map(pts, m), 6, 6.6, 0.6), 'a');
    out += path(curve(map(offset(pts, -1.6), m)), 'sl', `${sw(0.9)} ${op(0.45)}`);
    out += path(
      curve(
        map(
          [
            [x, 19.6],
            [x, 28.4],
          ],
          m,
        ),
      ),
      'sc',
      sw(1.6),
    );
  }
  return out;
}

function enso(c: P, r: number, wd: number, start = 110): string {
  const pts: P[] = [];
  for (let a = start; a <= start + 330; a += 22) {
    const rad = (a * Math.PI) / 180;
    const rr = r * (1 + 0.04 * Math.sin(rad * 2));
    pts.push([c[0] + rr * Math.cos(rad), c[1] + rr * Math.sin(rad)]);
  }
  return path(taper(pts, wd, wd * 0.15, wd * 0.5, 4), 'a');
}

function monk(): Ornament {
  const w = 144;
  const run =
    bamboo(-48, 192, 48) +
    blade({ x: 49, y: 21, a: -22, s: 26 }, 0.17) +
    blade({ x: 49, y: 21, a: -50, s: 22 }, 0.17, 'c') +
    blade({ x: 50, y: 22, a: 2, s: 20 }, 0.17) +
    blade({ x: 95, y: 27, a: 158, s: 25 }, 0.17) +
    blade({ x: 95, y: 27, a: 132, s: 20 }, 0.17, 'c') +
    blade({ x: 122, y: 27, a: 24, s: 15 }, 0.17) +
    blade({ x: 18, y: 21, a: -150, s: 13 }, 0.17, 'c');
  const seal = (c: P, s: number) =>
    rect(c[0] - s / 2, c[1] - s / 2, s, s, 'd', 'rx="1"') +
    path(
      `M${n(c[0] - s * 0.25)} ${n(c[1] - s * 0.25)}H${n(c[0] + s * 0.25)}M${n(c[0])} ${n(c[1] - s * 0.25)}V${n(c[1] + s * 0.28)}M${n(c[0] - s * 0.25)} ${n(c[1] + s * 0.05)}H${n(c[0] + s * 0.25)}`,
      'sl',
      sw(s * 0.1),
    );
  const corner =
    mitre(w) + circle([24, 24], 23, 'b', op(0.9)) + enso([24, 24], 18.5, 7.5) + seal([44, 45], 10);
  const cw = 92;
  const centre =
    bamboo(-48, 24, 48) +
    bamboo(-48, 24, 48, mx(92)) +
    circle([46, 24], 22, 'b', op(0.85)) +
    enso([46, 24], 18.5, 7.2, 300) +
    blade({ x: 40, y: 30, a: -50, s: 14 }, 0.17) +
    blade({ x: 42, y: 30, a: -15, s: 12 }, 0.17, 'c');
  return { w, run, corner, cw, centre };
}

// -- paladin: silver laurel, fleur-de-lis filigree, shield ------------------------------------

const FLEUR = [
  'M0 -1C.26 -.72 .3 -.34 .12 0H-.12C-.3 -.34 -.26 -.72 0 -1Z',
  'M.14 0C.24 -.4 .6 -.62 .86 -.42C1.02 -.28 .96 -.04 .78 -.04C.66 -.04 .62 -.2 .72 -.26C.56 -.32 .34 -.2 .28 .08Z',
  'M-.14 0C-.24 -.4 -.6 -.62 -.86 -.42C-1.02 -.28 -.96 -.04 -.78 -.04C-.66 -.04 -.62 -.2 -.72 -.26C-.56 -.32 -.34 -.2 -.28 .08Z',
  'M-.12 .2C-.14 .44 -.3 .58 -.46 .56C-.3 .72 -.08 .64 0 .48C.08 .64 .3 .72 .46 .56C.3 .58 .14 .44 .12 .2Z',
];

function fleur(c: P, s: number, a = 0): string {
  const at = { x: c[0], y: c[1], a, s };
  let out = '';
  for (const d of FLEUR)
    out += path(moved(d, at), 'a') + path(moved(d, at), 'sc', `${sw(0.6)} ${op(0.5)}`);
  return out + path(moved('M-.4 .04H.4V.2H-.4Z', at), 'd');
}

function laurel(x0: number, x1: number, step: number, m: Map2 = id): string {
  let out = path(
    curve(
      map(
        [
          [x0, 24],
          [x1, 24],
        ],
        m,
      ),
    ),
    'sc',
    sw(1.3),
  );
  let k = 0;
  for (let x = Math.ceil(x0 / step) * step; x < x1; x += step, k++) {
    const side = k % 2 ? 1 : -1;
    const p = m([x, 24]);
    const q = m([x + 1, 24]);
    const dir = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
    const s2 = m === id || q[0] > p[0] ? 1 : -1;
    out += blade({ x: p[0], y: p[1], a: dir + side * s2 * 32, s: 17 }, 0.36, k % 4 < 2 ? 'a' : 'c');
    if (k % 2) out += circle(m([x + step / 2, 24 - side * 6]), 1.7, 'd');
  }
  return out;
}

function paladin(): Ornament {
  const w = 56;
  const run =
    path('M-2 3H58M-2 45H58', 'sa', sw(1)) +
    path('M-2 5.5H58M-2 42.5H58', 'sd', `${sw(0.6)} ${op(0.8)}`) +
    laurel(-16, 72, 7);
  const corner =
    mitre(w) +
    circle([24, 24], 26, 'b', op(0.95)) +
    circle([24, 24], 26, 'sa', sw(1.6)) +
    circle([24, 24], 23, 'sd', `${sw(0.7)} stroke-dasharray="2 2"`) +
    fleur([22, 22], 20, -45);
  const cw = 104;
  const wreath = (left: boolean) => {
    const m = left ? id : mx(cw);
    let out = path(
      curve(
        map(
          [
            [8, 24],
            [22, 26],
            [36, 40],
          ],
          m,
        ),
      ),
      'sc',
      sw(1.2),
    );
    for (const [x, y, a] of [
      [14, 24.5, 0],
      [22, 26.5, 15],
      [29, 31, 40],
    ] as const) {
      const p = m([x, y]);
      const dir = left ? a : 180 - a;
      out += blade({ x: p[0], y: p[1], a: dir - 40, s: 12 }, 0.3);
      out += blade({ x: p[0], y: p[1], a: dir + 40, s: 12 }, 0.3);
    }
    return out;
  };
  const at = { x: 52, y: 22, s: 15 };
  const centre =
    path('M-2 3H30M74 3H106M-2 45H30M74 45H106', 'sa', sw(1)) +
    laurel(-14, 6, 7) +
    laurel(-14, 6, 7, mx(cw)) +
    wreath(true) +
    wreath(false) +
    path(moved(HEATER, { ...at, s: 17 }), 'c') +
    path(moved(HEATER, at), 'a') +
    path(moved(PATTEE, { ...at, s: 9 }), 'd') +
    path(moved('M-.7 -.82H.7', at), 'sl', `${sw(0.9)} ${op(0.5)}`);
  return { w, run, corner, cw, centre };
}

// -- ranger: pine branches, cones, arrows and tracks ------------------------------------------

function needles(pts: readonly P[], len: number, every = 2.6): string {
  const sm = sample(pts, 10);
  let d = '';
  let acc = 0;
  for (let i = 1; i < sm.length - 1; i++) {
    acc += Math.hypot(sm[i][0] - sm[i - 1][0], sm[i][1] - sm[i - 1][1]);
    if (acc < every) continue;
    acc = 0;
    const dir = Math.atan2(sm[i + 1][1] - sm[i - 1][1], sm[i + 1][0] - sm[i - 1][0]);
    for (const side of [-1, 1]) {
      const a = dir + side * 0.75;
      const l = len * (0.8 + 0.2 * Math.sin(i * 1.7));
      d += `M${n(sm[i][0])} ${n(sm[i][1])}L${n(sm[i][0] + l * Math.cos(a))} ${n(sm[i][1] + l * Math.sin(a))}`;
    }
  }
  return path(d, 'sa', sw(0.9));
}

function cone(c: P, s: number, a: number): string {
  const at = { x: c[0], y: c[1], a, s };
  return (
    path(moved('M0 0C.3 -.32 .9 -.3 1 0C.9 .3 .3 .32 0 0Z', at), 'd') +
    path(
      moved('M.2 -.12L.32 0L.2 .12M.42 -.2L.56 0L.42 .2M.64 -.2L.78 0L.64 .2', at),
      'sl',
      `${sw(0.7)} ${op(0.6)}`,
    )
  );
}

function arrow(p0: P, p1: P): string {
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const a = (Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180) / Math.PI;
  const at = { x: p0[0], y: p0[1], a, s: len };
  const k = n(5 / len);
  return (
    path(moved('M0 0L.86 0', at), 'sd', sw(1.6)) +
    path(moved(`M1 0L.84 -${k}L.87 0L.84 ${k}Z`, at), 'a') +
    path(moved(`M.02 0L-.02 -${k}L.2 -${k}L.24 0Z`, at), 'a') +
    path(moved(`M.02 0L-.02 ${k}L.2 ${k}L.24 0Z`, at), 'c')
  );
}

function paw(c: P, s: number, a: number): string {
  const at = { x: c[0], y: c[1], a, s };
  let out = path(moved('M-.5 .35C-.5 -.05 .5 -.05 .5 .35C.5 .6 -.5 .6 -.5 .35Z', at), 'a');
  for (const t of [
    [-0.62, -0.25],
    [-0.22, -0.55],
    [0.22, -0.55],
    [0.62, -0.25],
  ] as const)
    out += circle(place(t, at), s * 0.17, 'a');
  return out;
}

function ranger(): Ornament {
  const w = 120;
  const twig = wave(w, 3, -15, 135, 15);
  const shoot: P[] = [
    [40, 25],
    [48, 31],
    [56, 34.5],
  ];
  const run =
    needles(twig, 8.5) +
    path(curve(twig), 'sd', sw(1.8)) +
    needles(shoot, 6) +
    path(curve(shoot), 'sd', sw(1.2)) +
    cone([88, 27.5], 15, 75) +
    paw([16, 9], 4.5, 100) +
    paw([28, 5.5], 4.5, 100);
  const corner =
    mitre(w) +
    circle([24, 24], 25, 'b', op(0.9)) +
    circle([24, 24], 25, 'sd', sw(1.5)) +
    arrow([4, 44], [46, 2]) +
    arrow([4, 4], [52, 52]) +
    cone([24, 30], 11, 90) +
    cone([24, 30], 10, 130) +
    cone([24, 30], 10, 50);
  const cw = 100;
  const sprig = (m: Map2) => {
    const pts = map(
      [
        [-6, 24],
        [12, 23],
        [26, 24],
      ],
      m,
    );
    return needles(pts, 8) + path(curve(pts), 'sd', sw(1.8));
  };
  const centre =
    sprig(id) +
    sprig(mx(cw)) +
    circle([50, 24], 22, 'b', op(0.9)) +
    circle([50, 24], 22, 'sd', sw(1.4)) +
    paw([42, 18], 6, 70) +
    paw([58, 30], 6, 70) +
    cone([22, 26], 11, 60) +
    cone([78, 26], 11, 120);
  return { w, run, corner, cw, centre };
}

// -- rogue: smoke wisps, a dagger, lock filigree ----------------------------------------------

const KEYHOLE = 'M0 -.5C.3 -.5 .4 -.15 .2 .05L.32 .6H-.32L-.2 .05C-.4 -.15 -.3 -.5 0 -.5Z';
const PLATE =
  'M0 -1C.25 -1 .3 -.8 .5 -.75C.85 -.7 .95 -.4 .8 -.15C.7 0 .7 .1 .8 .25C.95 .5 .8 .8 .5 .8C.3 .8 .2 1 0 1C-.2 1 -.3 .8 -.5 .8C-.8 .8 -.95 .5 -.8 .25C-.7 .1 -.7 0 -.8 -.15C-.95 -.4 -.85 -.7 -.5 -.75C-.3 -.8 -.25 -1 0 -1Z';

function escutcheon(c: P, s: number): string {
  const at = { x: c[0], y: c[1], s };
  return (
    path(moved(PLATE, at), 'a') +
    path(moved(PLATE, { ...at, s: s * 0.8 }), 'sl', `${sw(0.7)} ${op(0.45)}`) +
    circle(place([0, -0.78], at), s * 0.06, 'l') +
    circle(place([0, 0.82], at), s * 0.06, 'l') +
    path(moved(KEYHOLE, { ...at, s: s * 0.5 }), 'c')
  );
}

/** A wisp of smoke: from `from`, a tapering stroke that winds into a curl around c. */
function wisp(from: P, via: P, c: P, turns: number, dir: number, w0: number, o = 1): string {
  const pts = [from, ...spiral(via, c, turns, dir, 1)];
  return path(taper(pts, w0, 0.2, w0 * 0.8, 4), 'a', o < 1 ? op(o) : '');
}

function rogue(): Ornament {
  const w = 128;
  const run =
    path(taper(wave(w, 8, -16, 144, 16, w / 4), 0.8, 0.8, 0), 'a', op(0.25)) +
    path(taper(wave(w, 4, -16, 144, 16, -w / 5), 1.2, 1.2, 0), 'a', op(0.35)) +
    path(taper(wave(w, 6, -16, 144, 16), 2.4, 2.4, 0), 'a', op(0.8)) +
    wisp([22, 20], [34, 12], [42, 11], 1.1, 1, 3.2) +
    wisp([28, 19], [40, 4], [50, 7], 0.9, 1, 1.6, 0.45) +
    wisp([88, 28], [98, 36], [106, 37], 1.1, -1, 3.2) +
    wisp([94, 29], [106, 44], [116, 41], 0.9, -1, 1.6, 0.45) +
    wisp([58, 23], [66, 30], [72, 30], 1, -1, 1.6, 0.6) +
    wisp([120, 25], [126, 18], [131, 18], 1, 1, 1.6, 0.6) +
    wisp([-8, 25], [-2, 18], [3, 18], 1, 1, 1.6, 0.6);
  const corner =
    mitre(w) +
    circle([24, 24], 24, 'b', op(0.9)) +
    escutcheon([24, 24], 19) +
    sword([0, 0], [54, 54], 4.4) +
    drop([54, 54], 6, 'd');
  const cw = 96;
  const smoke = (m: Map2) =>
    path(taper(map(wave(96, 3, -6, 30, 8), m), 2.4, 0.8, 0), 'a', op(0.8)) +
    path(taper(map(spiral([28, 23], [18, 13], 1.1, -1, 1), m), 3, 0.2, 2), 'a') +
    path(taper(map(spiral([24, 26], [12, 30], 0.9, 1, 1), m), 1.6, 0.2, 1), 'a', op(0.45));
  const centre = smoke(id) + smoke((p) => [cw - p[0], 48 - p[1]]) + escutcheon([48, 24], 21);
  return { w, run, corner, cw, centre };
}

// -- sorcerer: swirling flames, sparks and stars ----------------------------------------------

/** A flame tongue from base, leaning towards a (deg), length s, with a golden heart. */
function flame(base: P, a: number, s: number): string {
  const at = { x: base[0], y: base[1], a, s };
  const pts = (
    [
      [0, 0],
      [0.3, 0.08],
      [0.6, -0.08],
      [1, 0.06],
    ] as P[]
  ).map((p) => place(p, at));
  return (
    path(taper(pts, s * 0.42, 0, s * 0.08, 5), 'a') +
    path(taper(pts.slice(0, 3), s * 0.18, 0, 0, 5), 'd')
  );
}

function sorcerer(): Ornament {
  const w = 104;
  const run =
    path(taper(wave(w, 7, -13, 117, 13, w / 2), 0.9, 0.9, 0), 'a', op(0.45)) +
    path(taper(wave(w, 7, -13, 117, 13), 2.4, 2.4, 0), 'a') +
    flame([22, 17], -100, 15) +
    flame([78, 31], 80, 14) +
    path(star([50, 9], 5.5, 2.3), 'd') +
    path(sparkle([60, 38], 4), 'a') +
    path(sparkle([8, 39], 3), 'd') +
    path(sparkle([92, 8], 3.2), 'a') +
    circle([40, 40], 1.2, 'a') +
    circle([70, 6], 1, 'd') +
    circle([100, 40], 1.3, 'd');
  let burst = '';
  for (const [a, s] of [
    [-135, 26],
    [-100, 20],
    [-170, 20],
    [-70, 15],
    [160, 15],
  ] as const)
    burst += flame([24, 24], a, s);
  const corner =
    mitre(w) +
    burst +
    circle([24, 24], 11, 'b') +
    path(star([24, 24], 11, 4.8, 8, -90), 'a') +
    path(sparkle([24, 24], 5.5, 45), 'd') +
    path(sparkle([46, 44], 5), 'd') +
    path(star([6, 50], 3.5, 1.5), 'a') +
    path(star([50, 6], 3.5, 1.5), 'a');
  const cw = 92;
  const centre =
    path(taper(wave(92, 4, -6, 26, 8), 2.4, 1, 0), 'a') +
    path(taper(map(wave(92, 4, -6, 26, 8), mx(cw)), 2.4, 1, 0), 'a') +
    flame([46, 26], -125, 18) +
    flame([46, 26], -55, 18) +
    flame([46, 26], -90, 22) +
    path(star([46, 27], 13, 5.4, 8, -90), 'a') +
    path(sparkle([46, 27], 6, 45), 'd') +
    path(sparkle([24, 10], 3.4), 'd') +
    path(sparkle([68, 38], 3.4), 'd') +
    circle([20, 38], 1.3, 'a') +
    circle([73, 9], 1.3, 'a');
  return { w, run, corner, cw, centre };
}

// -- warlock: eldritch tentacles, eyes, a sealed pact ---------------------------------------

function suckers(pts: readonly P[], side: number, r: number, every: number): string {
  const off = offset(pts, side, 6);
  let out = '';
  for (let i = 2; i < off.length - 2; i += every)
    out += circle(off[i], r, 'b') + circle(off[i], r * 0.45, 'c', op(0.5));
  return out;
}

/** A tentacle from `from`, reaching through `via` and curling around c, suckers inside. */
function tentacle(pts: readonly P[], w0: number, side: number): string {
  return (
    path(taper(pts, w0, 0, w0 * 0.3, 5), 'a') +
    suckers(pts.slice(0, -2), (side * w0) / 3.4, w0 / 6.5, 3)
  );
}

const reach = (from: P, via: P, c: P, turns: number, dir: number): P[] => [
  from,
  ...spiral(via, c, turns, dir, 1.4),
];

function scroll(c: P, s: number, a: number): string {
  const at = { x: c[0], y: c[1], a, s };
  return (
    path(moved('M-.8 -.55H.75V.55H-.8Z', at), 'b') +
    path(moved('M-.8 -.55H.75M-.8 .55H.75', at), 'sa', sw(1.1)) +
    path(
      moved('M-.55 -.3H.4M-.55 -.1H.5M-.55 .1H.3M-.55 .3H.1', at),
      'sa',
      `${sw(0.6)} ${op(0.7)}`,
    ) +
    path(moved('M-.8 -.55C-1 -.55 -1 .55 -.8 .55C-.65 .55 -.65 -.55 -.8 -.55Z', at), 'a') +
    path(moved('M.75 -.55C.95 -.55 .95 .55 .75 .55C.6 .55 .6 -.55 .75 -.55Z', at), 'a')
  );
}

function warlock(): Ornament {
  const w = 120;
  const sp = wave(w, 5, -15, 135, 15);
  const run =
    path(taper(sp, 3.6, 3.6, 0), 'a') +
    suckers(sp, 3.2, 1.1, 3) +
    tentacle(reach([22, 20], [32, 9], [40, 10], 1.1, 1), 5, -1) +
    tentacle(reach([92, 28], [102, 39], [110, 38], 1.1, -1), 5, 1) +
    eye([64, 12], 7.5) +
    circle([12, 38], 1.4, 'd') +
    circle([18, 42], 0.9, 'd') +
    circle([110, 8], 1.2, 'd');
  const corner =
    mitre(w) +
    tentacle(reach([30, 30], [6, 30], [8, 18], 1.2, 1), 7, 1) +
    tentacle(reach([30, 30], [32, 6], [44, 8], 1, 1), 6, -1) +
    scroll([26, 26], 17, -45) +
    circle([39, 39], 7.2, 'd') +
    path(star([39, 39], 5, 2.2, 5), 'c', op(0.55)) +
    path('M36 44L33 52M42 44L45 51', 'sd', sw(2.2)) +
    eye([50, 12], 5.5);
  const cw = 100;
  const arm = (m: Map2, side: number) =>
    path(taper(map(wave(100, 4, -10, 34, 11), m), 3.6, 0.8, 0), 'a') +
    tentacle(map(reach([40, 30], [30, 40], [26, 33], 1.1, 1), m), 5, side);
  const centre = arm(id, 1) + arm(mx(cw), -1) + halo([50, 22], 12, 21, 16) + eye([50, 22], 12);
  return { w, run, corner, cw, centre };
}

// -- wizard: starry ribbon of runes, rune circles, an open book --------------------------------

const RUNES = [
  'M0 -4V4M0 -4L3 -1.5M0 0L3 2.5',
  'M-2 -4V4M-2 -4L2 0L-2 4M2 -4V4',
  'M0 -4V4M-3 -1L0 2L3 -1',
  'M-2.5 -4L2.5 4M2.5 -4L-2.5 4M0 -4V-1.5',
  'M-2 4V-4L2 -1L-2 1',
  'M0 -4V4M-2.5 -4L0 -1.5L2.5 -4',
];

function rune(c: P, k: number, s = 1): string {
  return path(moved(RUNES[k % RUNES.length], { x: c[0], y: c[1], s }), 'sa', sw(1.1 * s));
}

function wizard(): Ornament {
  const w = 96;
  const stars: P[] = [
    [6, 9],
    [18, 5],
    [30, 8],
    [38, 3],
    [58, 41],
    [70, 44],
    [80, 40],
    [92, 43],
  ];
  const run =
    rect(-2, 15, 100, 18, 'b', 'opacity=".7"') +
    path('M-2 15H98M-2 33H98', 'sa', sw(1.1)) +
    path('M-2 17.2H98M-2 30.8H98', 'sa', `${sw(0.5)} ${op(0.6)}`) +
    rune([12, 24], 0) +
    rune([36, 24], 1) +
    rune([60, 24], 2) +
    rune([84, 24], 3) +
    path(star([24, 24], 3.4, 1.4, 5), 'd') +
    path(star([72, 24], 3.4, 1.4, 5), 'd') +
    path(sparkle([48, 24], 3.6), 'd') +
    // constellations above and below the ribbon
    path('M6 9L18 5L30 8L38 3M58 41L70 44L80 40L92 43', 'sa', `${sw(0.5)} ${op(0.6)}`) +
    stars.map((p, i) => circle(p, i % 3 ? 1.1 : 1.6, 'a')).join('') +
    path(sparkle([66, 7], 2.6), 'd') +
    path(sparkle([20, 42], 2.2), 'd');
  let runes = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    runes += rune([24 + 19.5 * Math.cos(a), 24 + 19.5 * Math.sin(a)], i + 1, 0.62);
  }
  const corner =
    mitre(w) +
    circle([24, 24], 26, 'b') +
    circle([24, 24], 26, 'sa', sw(1.4)) +
    circle([24, 24], 23.5, 'sa', sw(0.5)) +
    circle([24, 24], 15.5, 'sa', sw(1)) +
    runes +
    path(star([24, 24], 14.5, 6, 6, -90), 'sd', sw(1)) +
    path(star([24, 24], 8, 3.3, 5), 'd') +
    path(sparkle([50, 50], 4), 'd');
  const cw = 96;
  // an open book: two pages from the spine at (48, 32)
  const page = 'M0 4C-6 1 -15 1 -22 3V-14C-15 -16 -6 -16 0 -13Z';
  const pages = [false, true]
    .map((flip) => {
      const d = moved(page, { x: 48, y: 32, s: 1, a: flip ? 180 : 0, flip });
      return path(d, 'l') + path(d, 'sa', sw(1.2));
    })
    .join('');
  const centre =
    rect(-2, 15, 22, 18, 'b', 'opacity=".7"') +
    rect(76, 15, 22, 18, 'b', 'opacity=".7"') +
    path('M-2 15H20M-2 33H20M76 15H98M76 33H98', 'sa', sw(1.1)) +
    circle([48, 24], 24, 'b') +
    pages +
    path(
      'M30 21C35 20 40 20 45 21M30 25C35 24 40 24 45 25M30 29C34 28 40 28 45 29M51 21C56 20 61 20 66 21M51 25C56 24 61 24 66 25M51 29C55 28 61 28 66 29',
      'sa',
      `${sw(0.5)} ${op(0.7)}`,
    ) +
    path(sparkle([48, 7], 5.5), 'd') +
    circle([48, 24], 24, 'sa', sw(1.2));
  return { w, run, corner, cw, centre };
}

// -- druid: climbing ivy ---------------------------------------------------------------------

function druid(): Ornament {
  const w = 112;
  const stem = (pts: P[], width: number) => path(curve(pts), 'sd', sw(width));
  const berries = (c: P, k = 3) => {
    let out = '';
    const off: P[] = [
      [0, 0],
      [4.2, -2],
      [1.5, 4],
      [-3.8, 2.5],
      [5, 3.2],
    ];
    for (const o of off.slice(0, k)) {
      const p: P = [c[0] + o[0], c[1] + o[1]];
      out += circle(p, 2.4, 'c') + circle([p[0] - 0.8, p[1] - 0.8], 0.7, 'l', op(0.8));
    }
    return out;
  };
  const tendril = (pts: P[]) => path(curve(pts), 'sd', `${sw(0.9)} ${op(0.85)}`);

  const run =
    stem(wave(w, 6), 2.2) +
    tendril([
      [62, 25],
      [66, 33],
      [73, 38],
      [78, 36],
      [77, 32],
      [73.5, 32.5],
    ]) +
    ivy({ x: 25.5, y: 15, a: -100, s: 14 }, [28, 18.2]) +
    ivy({ x: 86, y: 33.5, a: 82, s: 13.5 }, [84, 30]) +
    ivy({ x: 56, y: 20, a: -28, s: 10 }, [53, 23.5], 'c') +
    ivy({ x: 12, y: 31, a: 70, s: 9 }, [9, 26.5], 'c') +
    berries([101, 13]);

  const spine: P[] = [
    [24, 128],
    [21, 112],
    [24, 92],
    [21, 70],
    [22, 52],
    [30, 34],
    [48, 25],
    [70, 27],
    [94, 28],
    [114, 26.5],
    [128, 24],
    [136, 21.4],
  ];
  const corner =
    path(taper(spine.slice(0, 10), 2.2, 2.2, 2.6), 'd') +
    path(curve(spine.slice(9)), 'sd', sw(2.2)) +
    // a second, thinner shoot curling out of the elbow
    stem(
      [
        [30, 34],
        [20, 22],
        [12, 16],
        [7, 10],
        [9, 5],
        [14, 6],
        [13, 10],
      ],
      1.4,
    ) +
    tendril([
      [52, 26],
      [58, 36],
      [64, 40],
      [69, 38],
      [67, 34],
      [63, 35],
    ]) +
    tendril([
      [22, 74],
      [12, 80],
      [8, 88],
      [11, 92],
      [15, 90],
      [14, 86],
    ]) +
    ivy({ x: 4, y: 38, a: 150, s: 14 }, [14, 36], 'c') +
    ivy({ x: 18, y: 30, a: -150, s: 21 }, [26, 40]) +
    ivy({ x: 34, y: 20, a: -78, s: 20 }, [38, 28]) +
    ivy({ x: 46, y: 14, a: -40, s: 14 }, [44, 24], 'c') +
    ivy({ x: 16, y: 44, a: 172, s: 17 }, [22, 48]) +
    ivy({ x: 62, y: 21, a: -70, s: 16 }, [60, 26]) +
    ivy({ x: 92, y: 32, a: 75, s: 14 }, [88, 28]) +
    ivy({ x: 112, y: 20, a: -60, s: 11 }, [110, 26], 'c') +
    ivy({ x: 26, y: 62, a: 12, s: 14 }, [22, 60]) +
    ivy({ x: 16, y: 96, a: 188, s: 15 }, [22, 96]) +
    ivy({ x: 27, y: 116, a: 20, s: 11 }, [22, 116], 'c') +
    berries([40, 42], 5) +
    berries([10, 60], 3);

  const cw = 120;
  const side = (m: Map2, a: number) =>
    stem(
      map(
        [
          [-8, 26],
          [0, 24],
          [14, 21],
          [28, 26],
          [42, 27],
          [54, 24],
        ],
        m,
      ),
      2.2,
    ) +
    tendril(
      map(
        [
          [26, 25.5],
          [28, 33],
          [34, 38],
          [39, 35],
          [37, 31],
          [34, 32.5],
        ],
        m,
      ),
    ) +
    ivy({ x: m([14, 17])[0], y: 17, a, s: 12 }, m([14, 21.5]));
  const centre =
    side(id, -110) +
    side(mx(cw), -70) +
    ivy({ x: 58, y: 21, a: -128, s: 21 }) +
    ivy({ x: 62, y: 21, a: -52, s: 21 }) +
    ivy({ x: 60, y: 27, a: 90, s: 17 }, undefined, 'c') +
    berries([58, 23], 3);

  return { w, run, corner, cw, centre };
}

// -- registry --------------------------------------------------------------------------------

const BUILDERS: Record<string, () => Ornament> = {
  artificer,
  barbarian,
  bard,
  'blood-hunter': bloodHunter,
  cleric,
  druid,
  fighter,
  monk,
  paladin,
  ranger,
  rogue,
  sorcerer,
  warlock,
  wizard,
};

/** Classes with an ornament of their own; any other class gets the wizard's arcane one. */
export const ORNAMENT_CLASSES = Object.keys(BUILDERS);

const cache = new Map<string, Ornament>();

/** The ornament of a class (unknown classes get a generic one). */
export function ornamentFor(classId: string): Ornament {
  const key = classId in BUILDERS ? classId : 'wizard';
  let o = cache.get(key);
  if (!o) {
    o = BUILDERS[key]();
    cache.set(key, o);
  }
  return o;
}

let uid = 0;

/**
 * The markup of a frame (pieces positioned by themes.scss): shared drawings in <defs>, then
 * the bands, margins, corners and centres that reuse them. Colour classes become inline
 * `var()` fills, which also reach the copies inside <use> (selectors don't).
 */
export function ornamentMarkup(classId: string): { html: string; cw: number } {
  const o = ornamentFor(classId);
  const u = `th-orn-${++uid}`;
  const tile = (rot: string) =>
    `<pattern id="${u}-${rot ? 'v' : 'h'}" width="${o.w}" height="${BAND}" patternUnits="userSpaceOnUse"${rot}>` +
    `<use href="#${u}-r"/><use href="#${u}-r" x="-${o.w}"/><use href="#${u}-r" x="${o.w}"/></pattern>`;
  const defs =
    `<svg class="th-orn-defs" width="0" height="0"><defs>` +
    `<g id="${u}-r">${o.run}</g><g id="${u}-c">${o.corner.replaceAll('{u}', u)}</g><g id="${u}-m">${o.centre}</g>` +
    tile('') +
    tile(' patternTransform="rotate(-90)"') +
    `</defs></svg>`;
  const L = 20000;
  const band = (pos: string) =>
    `<svg class="th-orn-band ${pos}" viewBox="0 0 ${L} ${BAND}" preserveAspectRatio="xMinYMin slice"><rect width="${L}" height="${BAND}" fill="url(#${u}-h)"/></svg>`;
  const side = (pos: string) =>
    `<svg class="th-orn-side ${pos}" viewBox="0 0 ${BAND} ${L}" preserveAspectRatio="xMinYMin slice"><rect width="${BAND}" height="${L}" fill="url(#${u}-v)"/></svg>`;
  const corner = (pos: string) =>
    `<svg class="th-orn-corner ${pos}" viewBox="0 0 ${CORNER} ${CORNER}"><use href="#${u}-c"/></svg>`;
  const centre = (pos: string) =>
    `<svg class="th-orn-centre ${pos}" viewBox="0 0 ${o.cw} ${BAND}"><use href="#${u}-m"/></svg>`;
  const html = (
    defs +
    ['tl', 'tr', 'bl', 'br'].map(band).join('') +
    ['l', 'r'].map(side).join('') +
    ['tl', 'tr', 'bl', 'br'].map(corner).join('') +
    ['t', 'b'].map(centre).join('')
  ).replace(/class="(s?)([a-e]|l)"/g, (_, s: string, c: string) =>
    s ? `style="fill:none;stroke:var(--o-${c})"` : `style="fill:var(--o-${c})"`,
  );
  return { html, cw: o.cw };
}
