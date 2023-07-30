import { C, F, XY } from "@thegraid/common-lib";
import { Container, DisplayObject, Graphics, Shape, Text } from "@thegraid/easeljs-module";
import type { Hex2 } from "./hex";
import { H, HexDir } from "./hex-intfs";
import { PlayerColor, PlayerColorRecord, TP, playerColorRecord } from "./table-params";
import type { Tile } from "./tile";

export class C1 {
  static GREY = 'grey';
  static grey = 'grey';
  static lightgrey2 = 'rgb(225,225,225)' // needs to contrast with WHITE influence lines
  static lightgrey_8 = 'rgb(225,225,225,.8)' // needs to contrast with WHITE influence lines
}

export class CenterText extends Text {
  constructor(text?: string, size = TP.hexRad / 2, color?: string) {
    super(text, F.fontSpec(size), color);
    this.textAlign = 'center';
    this.textBaseline = 'middle';
  }
}

export interface Paintable extends DisplayObject {
  /** paint with new player color; updateCache() */
  paint(colorn: string): void;
}

/**
 * The colored PaintableShape that fills a Hex.
 * @param radius in call to drawPolyStar()
 */
export class HexShape extends Shape implements Paintable {
  constructor(
    readonly radius = TP.hexRad,
    readonly tilt = 30,  // ewTopo->30, nsTopo->0
  ) {
    super();
  }

  setHexBounds(r = this.radius, tilt = this.tilt) {
    // dp(...6), so tilt: 30 | 0; being nsAxis or ewAxis;
    const w = r * Math.cos(H.degToRadians * tilt);
    const h = r * Math.cos(H.degToRadians * (tilt - 30));
    this.setBounds(-w, -h, 2 * w, 2 * h);
    return { x: -2, y: -H, w: 2 * w, h: 2 * h };
  }

  /**
   * Draw a Hexagon 1/60th inside the given radius.
   * overrides should include call to setHexBounds(radius, angle)
   * or in other way setBounds().
   */
  paint(color: string) {
    this.setHexBounds();
    const g = this.graphics.c();
    return g.f(color).dp(0, 0, Math.floor(this.radius * 59 / 60), 6, 0, this.tilt); // 30 or 0
  }
}
export class CircleShape extends Shape implements Paintable {
  constructor(public rad = 30, public fillc = C.white, public strokec = C.black, g0?: Graphics) {
    super(g0);
    this.paint(fillc);
    const g = this.graphics;
    (fillc ? g.f(fillc) : g.ef());
    (strokec ? g.s(strokec) : g.es());
    g.dc(0, 0, rad);
  }

  paint(fillc: string) {
    const g = this.graphics;
    (fillc ? g.f(fillc) : g.ef());
    (this.strokec ? g.s(this.strokec) : g.es());
    g.dc(0, 0, this.rad);

  }
}
export class RectShape extends Shape {
  constructor({ x = 0, y = 0, w = 30, h = 30 }, fillc = C.white, strokec = C.black, g0?: Graphics) {
    super(g0);
    const g = this.graphics;
    if (fillc) g.f(fillc);
    if (strokec) g.s(strokec);
    g.dr(x ?? 0, y ?? 0, w ?? 30, h ?? 30);
  }
}

/** lines showing influence of a Tile. */
export class InfRays extends Shape {
  /**
   * draw 6 rays (around a HexShape)
   * @param inf number of rays to draw (degree of influence)
   * @param infColor color of ray
   * @param y0 start of ray (ends at .9) X TP.hexRad
   * @param xw width of each ray
   */
  constructor(inf = 1, infColor?: PlayerColor, y0 = .7, xw = 3, g = new Graphics()) {
    super(g);
    const color = infColor ? TP.colorScheme[infColor] : C.WHITE;
    const rad = TP.hexRad, y1 = y0 * rad, y2 = .9 * rad;
    const xs = [[0], [-.1 * rad, +.1 * rad], [-.1 * rad, 0, +.1 * rad]][Math.abs(inf) - 1];
    const pts = xs.map(x => { return { mt: { x: x, y: y1 }, lt: { x: x, y: y2 } } })
    const rotpt = (rot: number, x: number, y: number) => {
      return { x: Math.cos(rot) * x + Math.sin(rot) * y, y: Math.cos(rot) * y - Math.sin(rot) * x }
    }
    g.ss(xw).s(color);
    H.ewDirs.forEach(dir => {
      const rot = H.ewDirRot[dir] * H.degToRadians;
      pts.forEach(mtlt => {
        const mt = rotpt(rot, mtlt.mt.x, mtlt.mt.y), lt = rotpt(rot, mtlt.lt.x, mtlt.lt.y);
        g.mt(mt.x, mt.y).lt(lt.x, lt.y);
      });
    })
    this.cache(-rad, -rad, 2 * rad, 2 * rad);
  }
}

export class InfShape extends Shape implements Paintable {
  /** hexagon scaled by TP.hexRad/4 */
  constructor(bgColor = 'grey') {
    super();
    this.paint(bgColor);
  }

  paint(colorn: string) {
    const g = this.graphics;
    g.c().f(colorn).dp(0, 0, TP.hexRad, 6, 0, 30);
    new InfRays(1, undefined, .3, 10, g); // short & wide; it gets scaled down
    return this.graphics;
  }
}

export class TileShape extends HexShape {
  static fillColor = C1.lightgrey_8;// 'rgba(200,200,200,.8)'

  replaceDisk(colorn: string, r2 = this.radius) {
    const g = this.graphics;
    // g.c().f(C.BLACK).dc(0, 0, r2);       // bits to remove
    // this.updateCache("destination-out"); // remove disk from solid hexagon
    g.c().f(colorn).dc(0, 0, r2);        // fill with translucent disk
    this.updateCache("source-over");     // update with new disk
    return g;
  }

  /** colored HexShape filled with very-lightgrey disk: */
  override paint(colorn: string) {
    super.paint('rgba(255,255,255,.8)');                 // solid hexagon
    // calculate bounds of hexagon for cache:
    const { x, y, width, height } = this.getBounds();
    this.cache(x, y, width, height);
    const fillColor = C.nameToRgbaString(colorn, .2); // was TileShape.fillcolor
    this.replaceDisk(fillColor, this.radius * H.sqrt3_2 * (55 / 60));
    return this.graphics;
  }
}


/** add to Tile to indicate nB, fB, nR, fR.
 * nB is blue disk, fB is blue circle.
 * nR is tan disk, fR is tan circle.
 */
export class BalMark extends Shape {
  static bColor = 'rgba(133,193,233,.8)';
  static rColor = 'rgba(200,180,160,.8)';

  constructor(tile: Tile) {
    super();
    const { nB, fB, nR, fR } = tile, x0 = TP.hexRad * H.sqrt3_2 * .75;
    this.bMark(nB, fB, x0-5, BalMark.bColor);
    this.bMark(nR, fR, x0-0, BalMark.rColor);
  }

  bMark(n = 0, f = 0, x = 0, color = C.black, ds = [5, 5]) {
    if (n + f <= 0) return;
    const g = this.graphics, y = TP.hexRad / 4;
    if (n) { g.ss(4) } else { g.sd(ds) };
    g.s(color).mt(-x, y).lt(x, y);
    return;
  }
}

function mulPCR(b: XY, w: XY, c: XY, scale: number) {
  const rv: PlayerColorRecord<XY> = playerColorRecord();
  const pcr = playerColorRecord(b, w, c);
  Object.keys(pcr).forEach((pc: PlayerColor) => { rv[pc] = { x: pcr[pc].x * scale, y: pcr[pc].y * scale } });
  return rv;
}

/** CapMark indicates if hex can be or has been captured. */
export class CapMark extends Shape {
  static capColor = H.capColor1    // dynamic bind in GamePlay.doProtoMove()
  static capSize = TP.hexRad / 4   // depends on HexMap.height
  static xyOffset = mulPCR({ x: -.5, y: .4 }, { x: .5, y: .4 }, { x: 0, y: -.6 }, TP.hexRad);
  constructor(pc: PlayerColor, vis = true, xy = CapMark.xyOffset[pc], rad = TP.hexRad) {
    super()
    this.visible = vis;
    this.mouseEnabled = false;
    this.paint(TP.colorScheme[pc]);
    this.setXY(pc);
  }

  setXY(pc: PlayerColor, tile?: Tile, cont?: Container, xyOff = CapMark.xyOffset) {
    const xy = xyOff[pc];
    tile?.localToLocal(xy.x, xy.y, cont, this);
    cont?.addChild(this);
  }

  // for each Player: hex.tile
  paint(color = CapMark.capColor, vis = true) {
    this.graphics.c().f(color).dp(0, 0, CapMark.capSize, 6, 0, 30);
    this.visible = vis;
  }
}

export class MeepCapMark extends CapMark {
  static override xyOffset = mulPCR({ x: -.6, y: .4 }, { x: .6, y: .4 }, { x: 0, y: 1.5 }, TP.meepleRad);

  override setXY(pc: PlayerColor, tile?: Tile, cont?: Container, xyOff = MeepCapMark.xyOffset) {
    super.setXY(pc, tile, cont, xyOff);
  }
}

export class LegalMark extends Shape {
  hex2: Hex2;
  setOnHex(hex: Hex2) {
    this.hex2 = hex;
    const parent = hex.mapCont.markCont;
    this.graphics.f(C.legalGreen).dc(0, 0, TP.hexRad/2);
    hex.cont.parent.localToLocal(hex.x, hex.y, parent, this);
    this.hitArea = hex.hexShape; // legal mark is used for hexUnderObject, so need to cover whole hex.
    this.mouseEnabled = true;
    this.visible = false;
    parent.addChild(this);
  }
}
