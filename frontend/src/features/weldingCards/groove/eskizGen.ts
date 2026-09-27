/**
 * Эскиз разделки — генератор из прежней версии портала (Vue), утверждённый вид.
 * Слева подготовка кромок, справа сваренный шов с проходами.
 *
 * Отличия от оригинала:
 * - убраны лишние символы `">` после открывающего <svg>;
 * - размеры подписываются с запятой: 1,5 вместо 1.5;
 * - без разделки (c = 0, α = 0) не рисуются дуга угла и размер c.
 */

const INK = '#1a1d21';

/** 1.5 → «1,5» */
const ru = (n: number): string => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

export interface GrooveParams {
  jt: string; // тип разделки (пока 'С17')
  s: number; // толщина, мм
  alpha: number; // угол разделки, °
  b: number; // зазор, мм
  c: number; // притупление, мм
  n: number; // число проходов
  g: number; // усиление сверху, мм
  g1: number; // усиление корня, мм
  f: number; // ширина шва (toe), мм
}

interface Groove {
  s: number;
  alpha: number;
  b: number;
  c: number;
  beta: number; // полуугол, рад
  open: number; // раскрытие на сторону, мм
}

interface Geo {
  halfGap: number;
  openPx: number;
  apexY: number;
  pyTop: number;
  pyRoot: number;
  PW: number;
}

type Band = readonly [top: number, bottom: number];

function grooveC17({ s, alpha, b, c }: GrooveParams): Groove {
  const cc = Math.min(c, s - 0.1);
  const beta = ((alpha / 2) * Math.PI) / 180;
  const open = Math.max(0, s - cc) * Math.tan(beta);
  return { s, alpha, b, c: cc, beta, open };
}

/** ломаная линия обрыва (край пластины) */
function brk(x: number, y1: number, y2: number): string {
  const len = y2 - y1;
  const amp = 5;
  const steps = 40;
  let d = '';
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const y = y1 + len * t;
    const dx = amp * Math.sin(t * 2 * Math.PI);
    d += `L ${(x + dx).toFixed(1)} ${y.toFixed(1)} `;
  }
  return d;
}

/** контур пластины (левая side=-1 / правая side=1) */
function plate(side: number, cx: number, g: Geo): string {
  const edge = side < 0 ? cx - g.PW : cx + g.PW;
  const inTop = cx + side * (g.halfGap + g.openPx);
  const inRoot = cx + side * g.halfGap;
  return (
    `M ${inTop.toFixed(1)} ${g.pyTop} L ${edge.toFixed(1)} ${g.pyTop} ` +
    brk(edge, g.pyTop, g.pyRoot) +
    `L ${inRoot.toFixed(1)} ${g.pyRoot} L ${inRoot.toFixed(1)} ${g.apexY.toFixed(1)} Z`
  );
}

/** стрелка размерной линии */
function arrow(x: number, y: number, ax: number, ay: number, L: number): string {
  const bx = x - ax * L;
  const by = y - ay * L;
  const px = -ay * L * 0.32;
  const py = ax * L * 0.32;
  return `<path d="M ${x} ${y} L ${(bx + px).toFixed(1)} ${(by + py).toFixed(1)} L ${(bx - px).toFixed(1)} ${(by - py).toFixed(1)} Z" fill="${INK}"/>`;
}

/** вертикальный размер */
function dimV(xd: number, y1: number, y2: number, o1: number, o2: number, label: string): string {
  const yn = Math.min(y1, y2);
  const yx = Math.max(y1, y2);
  const s = xd >= o1 ? 1 : -1;
  const L = Math.min(7, Math.abs(y2 - y1) * 0.42 || 1);
  const tx = xd + (s > 0 ? 11 : -8);
  const ty = (y1 + y2) / 2;
  return (
    `<line x1="${o1}" y1="${y1}" x2="${xd + s * 4}" y2="${y1}" stroke="${INK}" stroke-width=".5"/>` +
    `<line x1="${o2}" y1="${y2}" x2="${xd + s * 4}" y2="${y2}" stroke="${INK}" stroke-width=".5"/>` +
    `<line x1="${xd}" y1="${yn}" x2="${xd}" y2="${yx}" stroke="${INK}" stroke-width=".6"/>` +
    arrow(xd, yn, 0, -1, L) +
    arrow(xd, yx, 0, 1, L) +
    `<text x="${tx}" y="${ty}" text-anchor="middle" font-size="11" fill="${INK}" transform="rotate(-90 ${tx} ${ty})">${label}</text>`
  );
}

/** горизонтальный размер */
function dimH(yd: number, x1: number, x2: number, yo: number, label: string): string {
  const s = yd >= yo ? 1 : -1;
  const L = Math.min(7, Math.abs(x2 - x1) * 0.42 || 1);
  return (
    `<line x1="${x1}" y1="${yo}" x2="${x1}" y2="${yd + s * 4}" stroke="${INK}" stroke-width=".5"/>` +
    `<line x1="${x2}" y1="${yo}" x2="${x2}" y2="${yd + s * 4}" stroke="${INK}" stroke-width=".5"/>` +
    `<line x1="${x1}" y1="${yd}" x2="${x2}" y2="${yd}" stroke="${INK}" stroke-width=".6"/>` +
    arrow(x1, yd, -1, 0, L) +
    arrow(x2, yd, 1, 0, L) +
    `<text x="${(x1 + x2) / 2}" y="${yd + (s > 0 ? 13 : -6)}" text-anchor="middle" font-size="11" fill="${INK}">${label}</text>`
  );
}

function buildBands(
  n: number,
  spanTop: number,
  spanBot: number,
  pyTop: number,
  apexY: number,
): Band[] {
  if (n <= 1) return [[spanBot, spanTop]];
  const bands: Band[] = [];
  const fill = n - 1;
  if (fill === 1) {
    bands.push([spanBot, pyTop]);
  } else {
    bands.push([spanBot, apexY]);
    const bh = (apexY - pyTop) / (fill - 1);
    for (let k = 1; k <= fill - 1; k++) bands.push([apexY - (k - 1) * bh, apexY - k * bh]);
  }
  bands.push([pyTop, spanTop]);
  return bands;
}

export function eskizSVG(P: GrooveParams): string {
  const g = grooveC17(P);
  const VW = 470;
  const VH = 250;
  const scale = Math.min(18, Math.max(4, 120 / P.s));
  const HWmm = Math.max(9, 0.85 * P.s);
  const PW = Math.min(HWmm * scale, 95);
  const xA = 125;
  const xB = 345;

  const pyTop = 130 - (P.s * scale) / 2;
  const pyRoot = pyTop + P.s * scale;
  const halfGap = (P.b / 2) * scale;
  const openPx = g.open * scale;
  const rootPx = P.c * scale;
  const apexY = pyTop + (P.s - P.c) * scale;
  const tb = Math.tan(g.beta);
  const geo: Geo = { halfGap, openPx, apexY, pyTop, pyRoot, PW };
  const PAD_L = 10;

  // левая пластина (разделка «в металле»)
  const platesA =
    `<path d="${plate(-1, xA, geo)}" fill="url(#h)" stroke="${INK}" stroke-width="1.1"/>` +
    `<path d="${plate(1, xA, geo)}" fill="url(#h)" stroke="${INK}" stroke-width="1.1"/>`;

  const dims =
    dimV(xA - PW - 16, pyTop, pyRoot, xA - PW, xA - PW, `s=${ru(P.s)}`) +
    dimH(pyRoot + 22, xA - halfGap, xA + halfGap, pyRoot, `b=${ru(P.b)}`) +
    (P.c > 0 && P.alpha > 0 ? dimV(xA + halfGap + 22, apexY, pyRoot, xA + halfGap, xA + halfGap, `c=${ru(P.c)}`) : '');

  const avX = xA - halfGap;
  const rA = 34;
  const p1x = avX - rA * Math.sin(g.beta);
  const p1y = apexY - rA * Math.cos(g.beta);
  const labR = rA + 14;
  const labA = g.beta / 2;
  const lx = avX - labR * Math.sin(labA);
  const ly = apexY - labR * Math.cos(labA);
  const ang = P.alpha <= 0 ? '' :
    `<line x1="${avX}" y1="${apexY}" x2="${avX}" y2="${(apexY - rA - 10).toFixed(1)}" ` +
    `stroke="${INK}" stroke-width=".4" stroke-dasharray="4 3"/>` +
    `<path d="M ${avX} ${apexY - rA} A ${rA} ${rA} 0 0 0 ${p1x.toFixed(1)} ${p1y.toFixed(1)}" fill="none" stroke="${INK}" stroke-width=".7"/>` +
    `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="11" fill="${INK}">${ru(P.alpha / 2)}°</text>`;

  // правая пластина (заполненный шов с валиками)
  const capH = Math.max(2, P.g * scale);
  const rootH = Math.max(2, P.g1 * scale);
  const toe = Math.max(3, P.f * scale);
  const spanTop = pyTop - capH;
  const spanBot = pyRoot + rootH;
  const topL = xB - halfGap - openPx;
  const topR = xB + halfGap + openPx;
  const halfW = halfGap + openPx + toe;

  const hAt = (y: number): number => {
    if (y <= pyTop) return halfGap + openPx;
    if (y >= pyRoot) return halfGap;
    const hh = pyRoot - y;
    return hh <= rootPx ? halfGap : halfGap + (hh - rootPx) * tb;
  };

  const bands = buildBands(P.n, spanTop, spanBot, pyTop, apexY);

  const cap =
    ` C ${(xB - halfW * 0.46).toFixed(1)} ${pyTop} ${(xB - halfW * 0.46).toFixed(1)} ${spanTop} ${xB} ${spanTop}` +
    ` C ${(xB + halfW * 0.46).toFixed(1)} ${spanTop} ${(xB + halfW * 0.46).toFixed(1)} ${pyTop} ${(topR + toe).toFixed(1)} ${pyTop}`;

  const region =
    `M ${xB - halfGap} ${pyRoot} L ${xB - halfGap} ${apexY.toFixed(1)} L ${topL.toFixed(1)} ${pyTop} L ${(topL - toe).toFixed(1)} ${pyTop}${cap}` +
    ` L ${topR.toFixed(1)} ${pyTop} L ${xB + halfGap} ${apexY.toFixed(1)} L ${xB + halfGap} ${pyRoot} Q ${xB} ${(pyRoot + 2 * rootH).toFixed(1)} ${xB - halfGap} ${pyRoot} Z`;

  const prep = `<path d="M ${topL.toFixed(1)} ${pyTop} L ${xB - halfGap} ${apexY.toFixed(1)} L ${xB - halfGap} ${pyRoot} L ${xB + halfGap} ${pyRoot} L ${xB + halfGap} ${apexY.toFixed(1)} L ${topR.toFixed(1)} ${pyTop}" fill="none" stroke="${INK}" stroke-width=".6"/>`;
  const capLine = `<path d="M ${(topL - toe).toFixed(1)} ${pyTop}${cap}" fill="none" stroke="${INK}" stroke-width="1.3"/>`;
  const rootLine = `<path d="M ${xB + halfGap} ${pyRoot} Q ${xB} ${(pyRoot + 2 * rootH).toFixed(1)} ${xB - halfGap} ${pyRoot}" fill="none" stroke="${INK}" stroke-width="1.3"/>`;

  let divs = '';
  for (let i = 0; i < bands.length - 1; i++) {
    const band = bands[i];
    if (!band) continue;
    const y = band[1];
    let xl: number;
    let xr: number;
    if (Math.abs(y - pyTop) < 0.5) {
      xl = topL - toe;
      xr = topR + toe;
    } else {
      const hw = hAt(y);
      xl = xB - hw;
      xr = xB + hw;
    }
    const dep = Math.min(12, Math.max(3, (band[0] - band[1]) * 0.4));
    divs += `<path d="M ${xl.toFixed(1)} ${y.toFixed(1)} Q ${xB} ${(y + dep).toFixed(1)} ${xr.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${INK}" stroke-width="1.3"/>`;
  }

  const nums = bands
    .map((band, i) => {
      const cy = (band[0] + band[1]) / 2;
      const nf = Math.max(7, Math.min(11, Math.abs(band[0] - band[1]) * 0.55));
      return `<text x="${xB}" y="${(cy + nf * 0.35).toFixed(1)}" text-anchor="middle" font-size="${nf.toFixed(0)}" fill="${INK}" style="paint-order:stroke;stroke:#fff;stroke-width:2px;stroke-linejoin:round">${i + 1}</text>`;
    })
    .join('');

  const outB = (side: number): string => {
    const edge = side < 0 ? xB - PW : xB + PW;
    const inRoot = xB + side * halfGap;
    const top = xB + side * (halfGap + openPx + toe);
    return (
      `M ${top.toFixed(1)} ${pyTop} L ${edge.toFixed(1)} ${pyTop} ` +
      brk(edge, pyTop, pyRoot) +
      `L ${inRoot.toFixed(1)} ${pyRoot}`
    );
  };

  const eMM = ru(Number(((2 * (halfGap + openPx + toe)) / scale).toFixed(1)));
  const dims2 =
    dimH(spanTop - 11, topL - toe, topR + toe, pyTop, `e=${eMM}`) +
    dimV(topR + toe + 18, spanTop, pyTop, xB, topR, `g=${ru(P.g)}`) +
    dimV(xB - halfGap - 14, pyRoot, spanBot, xB, xB, `g₁=${ru(P.g1)}`);

  return (
    `<svg viewBox="${-PAD_L} 0 ${VW + PAD_L} ${VH}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="h" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="6" stroke="#565656" stroke-width=".6"/></pattern></defs>` +
    `${platesA}${dims}${ang}` +
    `<path d="${plate(-1, xB, geo)}" fill="url(#h)" stroke="none"/><path d="${plate(1, xB, geo)}" fill="url(#h)" stroke="none"/>` +
    `<path d="${outB(-1)}" fill="none" stroke="${INK}" stroke-width="1.1"/><path d="${outB(1)}" fill="none" stroke="${INK}" stroke-width="1.1"/>` +
    `<path d="${region}" fill="#fff" stroke="none"/>${prep}${divs}${capLine}${rootLine}${nums}${dims2}</svg>`
  );
}
