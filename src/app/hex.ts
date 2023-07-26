import { C, Constructor, F, RC, S } from "@thegraid/easeljs-lib";
import { Container, Point, Shape, Text } from "@thegraid/easeljs-module";
import { EwDir, H, HexDir, NsDir } from "./hex-intfs";
import type { Meeple } from "./meeple";
import { HexShape, LegalMark } from "./shapes";
import { PlayerColor, TP } from "./table-params";
import type { MapTile, Tile } from "./tile";

export const S_Resign = 'Hex@Resign'
export const S_Skip = 'Hex@skip '
export type IHex = { Aname: string, row: number, col: number }

type HexConstructor<T extends Hex> = new (map: HexMap<T>, row: number, col: number) => T;
// Note: graphics.drawPolyStar(x,y,radius, sides, pointSize, angle) will do a regular polygon

type LINKS<T extends Hex> = { [key in HexDir]?: T }
type DCR    = { [key in "dc" | "dr"]: number }  // Delta for Col & Row
type TopoEW = { [key in EwDir]: DCR }
type TopoNS = { [key in NsDir]: DCR }
type Topo = TopoEW | TopoNS

export type HSC = { hex: Hex, sc: PlayerColor, Aname: string }
export function newHSC(hex: Hex, sc: PlayerColor, Aname = hex.Aname) { return { Aname, hex, sc } }

/** to recognize this class in hexUnderPoint and obtain the associated Hex2. */
class HexCont extends Container {
  constructor(public hex2: Hex2) {
    super()
  }
}

/** Base Hex, has no connection to graphics.
 * topological links to adjacent hex objects.
 *
 * each Hex may contain Tile and/or Meeple. (Planet, Ship)
 */
export class Hex {
  /** return indicated Hex from otherMap */
  static ofMap(ihex: IHex, otherMap: HexMap<Hex>) {
    try {
      return otherMap[ihex.row][ihex.col]
    } catch (err) {
      console.warn(`ofMap failed:`, err, { ihex, otherMap }) // eg: otherMap is different (mh,nh)
      throw err
    }
  }
  static aname(row: number, col: number) {
    return (row >= 0) ? `Hex@[${row},${col}]` : col == -1 ? S_Skip : S_Resign
  }
  constructor(map: HexMap<Hex>, row: number, col: number, name = Hex.aname(row, col)) {
    this.Aname = name
    this.map = map
    this.row = row
    this.col = col
    this.links = {}
  }
  /** (x,y): center of hex; (width,height) of hex; scaled by radius if supplied
   * @param radius [1] radius used in drawPolyStar(radius,,, H.dirRot[tiltDir])
   * @param ewTopo [true] suitable for ewTopo (long axis of hex is N/S)
   * @param row [this.row]
   * @param col [this.col]
   * @returns \{ x, y, w, h } of cell at [row, col]
   */
  xywh(radius = TP.hexRad, ewTopo = true, row = this.row, col = this.col) {
    if (ewTopo) { // tiltDir = 'NE'; tilt = 30-degrees; nsTOPO
      const h = 2 * radius, w = radius * H.sqrt3;  // h height of hexagon (long-vertical axis)
      const x = (col + Math.abs(row % 2) / 2) * w;
      const y = row * 1.5 * radius;   // dist between rows
      return { x, y, w, h }
    } else { // tiltdir == 'N'; tile = 0-degrees; ewTOPO
      const w = 2 * radius, h = radius * H.sqrt3 // radius * 1.732
      const x = (col) * 1.5 * radius;
      const y = (row + Math.abs(col % 2) / 2) * h;
      return { x, y, w, h }
    }
  }

  readonly Aname: string
  /** reduce to serializable IHex (removes map, inf, links, etc) */
  get iHex(): IHex { return { Aname: this.Aname, row: this.row, col: this.col } }
  protected nf(n: number) { return `${n !== undefined ? (n === Math.floor(n)) ? n : n.toFixed(1) : ''}`; }
  /** [row,col] OR special name */
  get rcs(): string { return (this.row >= 0) ? `[${this.nf(this.row)},${this.nf(this.col)}]` : this.Aname.substring(4)}
  get rowsp() { return (this.nf(this.row ?? -1)).padStart(2) }
  get colsp() { return (this.nf(this.col ?? -1)).padStart(2) } // col== -1 ? S_Skip; -2 ? S_Resign
  /** [row,col] OR special name */
  get rcsp(): string { return (this.row >= 0) ? `[${this.rowsp},${this.colsp}]` : this.Aname.substring(4).padEnd(7)}
  /** compute ONCE, *after* HexMap is populated with all the Hex! */
  get rc_linear(): number { return this._rcLinear || (this._rcLinear = this.map.rcLinear(this.row, this.col))}
  _rcLinear: number | undefined = undefined
  /** accessor so Hex2 can override-advise */
  _district: number | undefined // district ID
  get district() { return this._district }
  set district(d: number) {
    this._district = d
  }
  get isOnMap() { return this.district !== undefined; } // also: (row !== undefined) && (col !== undefined)

  _isLegal: boolean;
  get isLegal() { return this._isLegal; }
  set isLegal(v: boolean) { this._isLegal = v; }

  readonly map: HexMap<Hex>;  // Note: this.parent == this.map.hexCont [cached] TODO: typify ??
  readonly row: number;
  readonly col: number;
  /** Link to neighbor in each H.dirs direction [NE, E, SE, SW, W, NW] */
  readonly links: LINKS<this> = {}

  get linkDirs() { return Object.keys(this.links) as HexDir[];}

  /** colorScheme(playerColor)@rcs */
  toString(sc?: PlayerColor) {
    return `${TP.colorScheme[sc] ?? 'Empty'}@${this.rcs}` // hex.toString => COLOR@[r,c] | COLOR@Skip , COLOR@Resign
  }
  /** hex.rcspString => COLOR@[ r, c] | 'COLOR@Skip   ' , 'COLOR@Resign ' */
  rcspString(sc?: PlayerColor) {
    return `${TP.colorScheme[sc] ?? 'Empty'}@${this.rcsp}`
  }

  /** convert LINKS object to Array */
  get linkHexes() {
    return Object.keys(this.links).map((dir: HexDir) => this.links[dir])
  }
  forEachLinkHex(func: (hex: Hex, dir: HexDir, hex0: Hex) => unknown, inclCenter = false) {
    if (inclCenter) func(this, undefined, this);
    this.linkDirs.forEach((dir: HexDir) => func(this.links[dir], dir, this));
  }
  /** search each Hex linked to this. */
  findLinkHex(pred: (hex: this, dir: HexDir, hex0: this) => boolean) {
    return this.linkDirs.find((dir: HexDir) => pred(this.links[dir], dir, this));
  }

  findInDir(dir: HexDir, pred: (hex: Hex, dir: HexDir, hex0: Hex) => boolean) {
    let hex: Hex = this;
    do {
       if (pred(hex, dir, this)) return hex;
    } while(!!(hex = hex.nextHex(dir)));
    return undefined;
  }

  hexesInDir(dir: HexDir, rv: Hex[] = []) {
    let hex: Hex = this;
    while (!!(hex = hex.links[dir])) rv.push(hex);
    return rv;
  }

  /** for each Hex in each Dir: func(hex, dir, this) */
  forEachHexDir(func: (hex: Hex, dir: HexDir, hex0: Hex) => unknown) {
    this.linkDirs.forEach((dir: HexDir) => this.hexesInDir(dir).filter(hex => !!hex).map(hex => func(hex, dir, this)));
  }

  nextHex(ds: HexDir, ns: number = 1) {
    let hex: Hex = this;
    while (!!(hex = hex.links[ds]) && --ns > 0) {  }
    return hex;
  }
  /** return last Hex on axis in given direction */
  lastHex(ds: HexDir): Hex {
    let hex: Hex = this, nhex: Hex
    while (!!(nhex = hex.links[ds])) { hex = nhex }
    return hex
  }
  /** distance between Hexes: adjacent = 1, based on row, col, sqrt3 */
  radialDist(hex: Hex): number {
    let unit = 1 / H.sqrt3 // so w = delta(col) = 1
    let { x: tx, y: ty } = this.xywh(unit), { x: hx, y: hy } = hex.xywh(unit)
    let dx = tx - hx, dy = ty - hy
    return Math.sqrt(dx * dx + dy * dy);
  }
}

export class Hex1 extends Hex {

  _tile: MapTile;
  get tile() { return this._tile; }
  set tile(tile: Tile) { this._tile = tile; } // override in Hex2!
  // Note: set hex.tile mostly invoked from: tile.hex = hex;

  _meep: Meeple;
  get meep() { return this._meep; }
  set meep(meep: Meeple) { this._meep = meep }

  get occupied(): [Tile, Meeple] { return (this.tile || this.meep) ? [this.tile, this.meep] : undefined; }

  /** colorScheme(playerColor)@rcs */
  override toString(sc = this.tile?.player?.color || this.meep?.player?.color) {
    return `${TP.colorScheme[sc] || 'Empty'}@${this.rcs}` // hex.toString => COLOR@[r,c] | COLOR@Skip , COLOR@Resign
  }
  /** hex.rcspString => COLOR@[ r, c] | 'COLOR@Skip   ' , 'COLOR@Resign ' */
  override rcspString(sc = this.tile?.player.color || this.meep?.player?.color) {
    return `${TP.colorScheme[sc] || 'Empty'}@${this.rcsp}`
  }
}
/** One Hex cell in the game, shown as a polyStar Shape */
export class Hex2 extends Hex1 {
  // cont holds hexShape(color), rcText, distText, capMark
  readonly cont: HexCont = new HexCont(this); // Hex IS-A Hex0, HAS-A HexCont Container
  readonly radius = TP.hexRad;                // determines width & height
  readonly hexShape = this.makeHexShape();    // shown on this.cont: colored hexagon
  get mapCont() { return this.map.mapCont; }
  get markCont() { return this.mapCont.markCont; }

  get x() { return this.cont.x}
  set x(v: number) { this.cont.x = v}
  get y() { return this.cont.y}
  set y(v: number) { this.cont.y = v}
  get scaleX() { return this.cont.scaleX}
  get scaleY() { return this.cont.scaleY}

  // if override set, then must override get!
  override get district() { return this._district }
  override set district(d: number) {
    this._district = d    // cannot use super.district = d [causes recursion, IIRC]
    this.distText.text = `${d}`
  }
  distColor: string // district color of hexShape (paintHexShape)
  distText: Text    // shown on this.cont
  rcText: Text      // shown on this.cont

  override get tile() { return super.tile; }
  override set tile(tile: Tile) {
    const cont: Container = this.map.mapCont.tileCont, x = this.x, y = this.y;
    const underTile = this.tile;
    super.tile = tile  // this._tile = tile
    if (tile !== undefined) {
      tile.x = x; tile.y = y;
      cont.addChildAt(tile, 0); // under hex.meep (and various Text)
    }
    if (tile && underTile) tile.overSet(underTile);
  }

  override get meep() { return super.meep; }
  override set meep(meep: Meeple) {
    const cont: Container = this.map.mapCont.tileCont, x = this.x, y = this.y;
    let k = true;     // debug double meep; maybe overMeep.overSet(this)?
    if (k && meep !== undefined && this.meep !== undefined) debugger;
    super.meep = meep // this._meep = meep    super.meep = meep
    if (meep !== undefined) {
      meep.x = x; meep.y = y;
      cont.addChild(meep);      // tile will go under meep
    }
  }

  /** Hex2 in hexMap.mapCont.hexCont; hex.cont contains:
   * - polyStar Shape of radius @ (XY=0,0)
   * - stoneIdText (user settable stoneIdText.text)
   * - rcText (r,c)
   * - distText (d)
   */
  constructor(map: HexMap<Hex2>, row: number, col: number, name?: string) {
    super(map, row, col, name);
    this.initCont(row, col);
    map?.mapCont.hexCont.addChild(this.cont);
    this.hexShape.name = this.Aname;
    const nf = (n: number) => `${n !== undefined ? (n === Math.floor(n)) ? n : n.toFixed(1) : ''}`;
    const rc = `${nf(row)},${nf(col)}`, tdy = -25;
    const rct = this.rcText = new Text(rc, F.fontSpec(26), 'white'); // radius/2 ?
    rct.textAlign = 'center'; rct.y = tdy; // based on fontSize? & radius
    this.cont.addChild(rct);

    this.distText = new Text(``, F.fontSpec(20));
    this.distText.textAlign = 'center'; this.distText.y = tdy + 46 // yc + 26+20
    this.cont.addChild(this.distText);
    this.legalMark.setOnHex(this);
    this.showText(true); // & this.cache()
  }

  /** set visibility of rcText & distText */
  showText(vis = this.rcText.visible) {
    this.rcText.visible = this.distText.visible = vis;
    this.cont.updateCache();
  }

  readonly legalMark = new LegalMark();
  override get isLegal() { return this._isLegal; }
  override set isLegal(v: boolean) {
    super.isLegal = v;
    this.legalMark.visible = v;
  }

  private initCont(row: number, col: number) {
    const cont = this.cont, ewTopo = this.map.topo === this.map.ewTopo;
    const { x, y, w, h } = this.xywh(this.radius, ewTopo, row, col); // include margin space between hexes
    cont.x = x;
    cont.y = y;
    // initialize cache bounds:
    cont.setBounds(-w / 2, -h / 2, w, h);
    const b = cont.getBounds();
    cont.cache(b.x, b.y, b.width, b.height);
  }

  makeHexShape() {
    const hs = new HexShape(this.radius);
    this.cont.addChildAt(hs, 0);
    this.cont.hitArea = hs;
    hs.paint('grey');
    return hs;
  }

  /** set hexShape using color: draw border and fill
   * @param color
   * @param district if supplied, set this.district
   */
  setHexColor(color: string, district?: number | undefined) {
    if (district !== undefined) this.district = district // hex.setHexColor update district
    this.distColor = color;
    this.hexShape.paint(color);
    this.cont.updateCache();
  }

  // The following were created for the map in hexmarket:
  /** unit distance between Hexes: adjacent = 1; see also: radialDist */
  metricDist(hex: Hex): number {
    let { x: tx, y: ty } = this.xywh(1), { x: hx, y: hy } = hex.xywh(1)
    let dx = tx - hx, dy = ty - hy
    return Math.sqrt(dx * dx + dy * dy); // tw == H.sqrt3
  }
  /** location of corner between dir0 and dir1; in parent coordinates. */
  cornerPoint(dir0: HexDir, dir1: HexDir) {
    let d0 = H.dirRot[dir0], d1 = H.dirRot[dir1]
    let a2 = (d0 + d1) / 2, h = this.radius
    if (Math.abs(d0 - d1) > 180) a2 += 180
    let a = a2 * H.degToRadians
    return new Point(this.x + Math.sin(a) * h, this.y - Math.cos(a) * h)
  }
  /** location of edge point in dir; in parent coordinates. */
  edgePoint(dir: HexDir) {
    let a = H.dirRot[dir] * H.degToRadians, h = this.radius * H.sqrt3_2
    return new Point(this.x + Math.sin(a) * h, this.y - Math.cos(a) * h)
  }
}

export class RecycleHex extends Hex2 { }

/** for contrast paint it black AND white, leave a hole in the middle unpainted. */
class HexMark extends Shape {
  hex: Hex2;
  constructor(public hexMap: HexMap<Hex2>, radius: number, radius0: number = 0) {
    super();
    const mark = this, cb = "rgba(0,0,0,.3)", cw="rgba(255,255,255,.3)"
    mark.mouseEnabled = false
    mark.graphics.f(cb).dp(0, 0, radius, 6, 0, 30)
    mark.graphics.f(cw).dp(0, 0, radius, 6, 0, 30)
    mark.cache(-radius, -radius, 2*radius, 2*radius)
    mark.graphics.c().f(C.BLACK).dc(0, 0, radius0)
    mark.updateCache("destination-out")
  }

  // Fail: markCont to be 'above' tileCont...
  showOn(hex: Hex2) {
    // when mark is NOT showing, this.visible === false && this.hex === undefined.
    // when mark IS showing, this.visible === true && (this.hex instanceof Hex2)
    if (this.hex === hex) return;
    if (this.hex) {
      this.visible = false;
      if (!this.hex.cont.cacheID) debugger;
      this.hex.cont.updateCache();
    }
    this.hex = hex;
    if (this.hex) {
      this.visible = true;
      hex.cont.addChild(this);
      if (!hex.cont.cacheID) debugger;
      hex.cont.updateCache();
    }
    this.hexMap.update();
  }
}

export class MapCont extends Container {
  constructor(public hexMap: HexMap<Hex2>) {
    super()
  }
  static cNames = ['hexCont', 'infCont', 'tileCont', 'resaCont', 'markCont', 'capCont', 'counterCont', 'eventCont'];
  hexCont: Container     // hex shapes on bottom stats: addChild(dsText), parent.rotation
  infCont: Container     // infMark below tileCont; Hex2.showInf
  tileCont: Container    // Tiles & Meeples on Hex2/HexMap.
  resaCont: Container    // reserveAuction hexes, above tileCont.
  markCont: Container    // showMark over Hex2; LegalMark
  capCont: Container     // for tile.capMark
  counterCont: Container // counters for AuctionCont
  eventCont: Container   // the eventHex & and whatever Tile is on it...
}

export interface HexM<T extends Hex> {
  readonly district: T[][]        // all the Hex in a given district
  readonly mapCont: MapCont
  rcLinear(row: number, col: number): number
  forEachHex<K extends T>(fn: (hex: K) => void): void // stats forEachHex(incCounters(hex))
  update(): void
  showMark(hex: T): void

}
/**
 * Collection of Hex *and* Graphics-Containers for Hex2
 * allStones: HSC[] and districts: Hex[]
 *
 * HexMap[row][col]: Hex or Hex2 elements.
 * If mapCont is set, then populate with Hex2
 *
 * (TP.mh X TP.nh) hexes in districts; allStones: HSC[]
 *
 * With a Mark and off-map: skipHex & resignHex
 *
 */
export class HexMap<T extends Hex> extends Array<Array<T>> implements HexM<T> {
  // A color for each District: 'rgb(198,198,198)'
  static readonly distColor = ['lightgrey',"limegreen","deepskyblue","rgb(255,165,0)","violet","rgb(250,80,80)","yellow"]

  get asHex2Map() { return this as any as HexMap<Hex2> }
  /** Each occupied Hex, with the occupying PlayerColor  */
  readonly district: Array<T[]> = []
  readonly mapCont: MapCont = new MapCont(this.asHex2Map);   // if/when using Hex2

  //
  //                         |    //                         |    //                         |
  //         2        .      |  1 //         1        .      | .5 //         2/sqrt3  .      |  1/sqrt3
  //            .            |    //            .            |    //            .            |
  //      .                  |    //      .                  |    //      .                  |
  //  -----------------------+    //  -----------------------+    //  -----------------------+
  //         sqrt3                //         sqrt3/2              //         1
  //

  readonly radius = TP.hexRad
  // SEE ALSO: hex.xywh(radius, axis, row, col)
  /** height per row of cells with EW Topo */
  get rowHeight() { return this.radius * 1.5 };
  /** height of hexagonal cell with EW Topo */
  get cellHeight() { return this.radius * 2 }
  /** width per col of cells with EW Topo */
  get colWidth() { return this.radius * H.sqrt3 }
  /** width of hexagonal cell with EW Topo */
  get cellWidth() { return this.radius * H.sqrt3 }

  private minCol: number | undefined = undefined               // Array.forEach does not look at negative indices!
  private maxCol: number | undefined = undefined               // used by rcLinear
  private minRow: number | undefined = undefined               // to find centerHex
  private maxRow: number | undefined = undefined               // to find centerHex
  get centerHex() {
    let cr = Math.floor((this.maxRow + this.minRow) / 2)
    let cc = Math.floor((this.minCol + this.maxCol) / 2);
    return this[cr][cc]; // as Hex2; as T;
  }
  getCornerHex(dn: HexDir) {
    return this.centerHex.lastHex(dn)
  }
  rcLinear(row: number, col: number): number { return col + row * (1 + (this.maxCol || 0) - (this.minCol||0)) }

  readonly metaMap = Array<Array<Hex>>()           // hex0 (center Hex) of each MetaHex, has metaLinks to others.

  mark: HexMark | undefined                        // a cached DisplayObject, used by showMark
  Aname: string = '';

  /**
   * HexMap: TP.nRows X TP.nCols hexes.
   *
   * Basic map is non-GUI, addToMapCont uses Hex2 elements to enable GUI interaction.
   * @param addToMapCont use Hex2 for Hex, make Containers: hexCont, infCont, markCont, stoneCont
   */
  constructor(radius: number = TP.hexRad, addToMapCont = false, public hexC?: HexConstructor<T>) {
    super(); // Array<Array<Hex>>()
    this.radius = radius;
    // ((...args: any[]) => new Hex(args[0], args[1], args[2]) as T);
    this.hexC = hexC ?? (Hex as any as HexConstructor<T>);
    if (addToMapCont) this.addToMapCont(hexC);
  }

  /** create/attach Graphical components for HexMap */
  addToMapCont(hexC?: Constructor<T>): this {
    if (hexC) this.hexC = hexC;
    this.mark = new HexMark(this.asHex2Map, this.radius, this.radius/2.5)
    const mapCont = this.mapCont;
    MapCont.cNames.forEach(cname => {
      const cont = new Container();
      mapCont[cname] = cont;
      cont[S.Aname] = cont.name = cname;
      mapCont.addChild(cont);
    })
    return this
  }

  /** ...stage.update() */
  update() {
    this.mapCont.hexCont.updateCache()  // when toggleText: hexInspector
    this.mapCont.hexCont.parent?.stage.update()
  }

  /** to build this HexMap: create Hex (or Hex2) and link it to neighbors. */
  addHex(row: number, col: number, district: number, hexC?: Constructor<T> ): T {
    // If we have an on-screen Container, then use Hex2: (addToCont *before* makeAllDistricts)
    const hex = new this.hexC(this, row, col);
    hex.district = district // and set Hex2.districtText
    if (this[row] === undefined) {  // create new row array
      this[row] = new Array<T>()
      if (this.minRow === undefined || row < this.minRow) this.minRow = row
      if (this.maxRow === undefined || row > this.maxRow) this.maxRow = row
    }
    if (this.minCol === undefined || col < this.minCol) this.minCol = col
    if (this.maxCol === undefined || col > this.maxCol) this.maxCol = col
    this[row][col] = hex   // addHex to this Array<Array<Hex>>
    this.link(hex)   // link to existing neighbors
    return hex
  }
  /** find first Hex matching the given predicate function */
  findHex<K extends T>(fn: (hex: K) => boolean): K {
    for (let hexRow of this) {
      if (hexRow === undefined) continue
      const found = hexRow.find((hex: K) => hex && fn(hex)) as K
      if (found !== undefined) return found
    }
    return undefined;
  }
  /** Array.forEach does not use negative indices: ASSERT [row,col] is non-negative (so 'of' works) */
  forEachHex<K extends T>(fn: (hex: K) => void) {
    // minRow generally [0 or 1] always <= 5, so not worth it
    //for (let ir = this.minRow || 0; ir < this.length; ir++) {
    for (let ir of this) {
      // beginning and end of this AND ir may be undefined
      if (ir !== undefined) for (let hex of ir) { hex !== undefined && fn(hex as K) }
    }
  }
  /** return array of results of mapping fn over each Hex */
  mapEachHex<K extends T, R>(fn: (hex: K) => R): R[] {
    const rv: R[] = [];
    this.forEachHex<K>(hex => rv.push(fn(hex)));
    return rv
  }
  /** find all Hexes matching given predicate */
  filterEachHex<K extends T>(fn: (hex: K) => boolean): K[] {
    const rv: K[] = []
    this.forEachHex<K>(hex => fn(hex) && rv.push(hex))
    return rv
  }

  /** make this.mark visible above the given Hex */
  showMark(hex?: Hex) {
    const mark = this.mark
    if (!hex) {  // || hex.Aname === S_Skip || hex.Aname === S_Resign) {
      mark.visible = false;
    } else if (hex instanceof Hex2) {
      mark.scaleX = hex.scaleX; mark.scaleY = hex.scaleY;
      mark.visible = true;
      // put the mark, at location of hex, on hex.markCont:
      hex.cont.localToLocal(0, 0, hex.markCont, mark);
      hex.markCont.addChild(mark);
      this.update();
    }
  }

  /** neighborhood topology, E-W & N-S orientation; even(n0) & odd(n1) rows: */
  ewEvenRow: TopoEW = {
    NE: { dc: 0, dr: -1 }, E: { dc: 1, dr: 0 }, SE: { dc: 0, dr: 1 },
    SW: { dc: -1, dr: 1 }, W: { dc: -1, dr: 0 }, NW: { dc: -1, dr: -1 }}
  ewOddRow: TopoEW = {
    NE: { dc: 1, dr: -1 }, E: { dc: 1, dr: 0 }, SE: { dc: 1, dr: 1 },
    SW: { dc: 0, dr: 1 }, W: { dc: -1, dr: 0 }, NW: { dc: 0, dr: -1 }}
  nsEvenCol: TopoNS = {
    NE: { dc: +1, dr: -1 }, N: { dc: 0, dr: -1 }, SE: { dc: +1, dr: 0 },
    SW: { dc: -1, dr: 0 }, S: { dc: 0, dr: +1 }, NW: { dc: -1, dr: -1 }}
  nsOddCol: TopoNS = {
    NE: { dc: 1, dr: 0 }, N: { dc: 0, dr: -1 }, SE: { dc: 1, dr: 1 },
    SW: { dc: -1, dr: 1 }, S: { dc: 0, dr: 1 }, NW: { dc: -1, dr: 0 }}
  nsTopo(rc: RC): TopoNS { return (rc.col % 2 == 0) ? this.nsEvenCol : this.nsOddCol };
  ewTopo(rc: RC): TopoEW { return (rc.row % 2 == 0) ? this.ewEvenRow : this.ewOddRow };
  topo: (rc: RC) => (TopoEW | TopoNS) = this.ewTopo;

  /** see also: Hex.linkDirs */
  get linkDirs(): HexDir[] {
    return (this.topo === this.ewTopo) ? H.ewDirs : H.nsDirs;
  }

  nextRowCol(hex: RC, dir: HexDir, nt: Topo = this.topo(hex)): RC {
    let row = hex.row + nt[dir].dr, col = hex.col + nt[dir].dc
    return { row, col }
  }

  /** link hex to/from each extant neighor */
  link(hex: T, rc: RC = hex, map: T[][] = this, nt: Topo = this.topo(rc), lf: (hex: T) => LINKS<T> = (hex) => hex.links) {
    const topoDirs = Object.keys(nt) as Array<HexDir>
    topoDirs.forEach(dir => {
      const nr = rc.row + nt[dir].dr;
      const nc = rc.col + nt[dir].dc;
      const nHex = map[nr] && map[nr][nc]
      if (!!nHex) {
        lf(hex)[dir] = nHex
        lf(nHex)[H.dirRev[dir]] = hex
      }
    });
  }
  /**
   * The Hex under the given x,y coordinates.
   * If on the line, then the top (last drawn) Hex.
   * @param x in local coordinates of this HexMap.cont
   * @param y
   * @returns the Hex under mouse or false, if not a Hex (background)
   */
  hexUnderPoint(x: number, y: number): Hex2 {
    let obj = this.mapCont.hexCont.getObjectUnderPoint(x, y, 1) // 0=all, 1=mouse-enabled (Hex, not Stone)
    return (obj instanceof HexCont) ? obj.hex2 : undefined
  }
  /**
   *
   * @param nh number of hexes on on edge of metaHex
   * @param mh order of metaHexes (greater than 0);
   */
  makeAllDistricts(nh = TP.nHexes, mh = TP.mHexes) {
    this.makeDistrict(nh, 0, mh, 0);    // nh hexes on outer ring; single meta-hex
    this.mapCont.hexCont && this.centerOnContainer()
  }
  centerOnContainer() {
    let mapCont = this.mapCont
    let hexRect = mapCont.hexCont.getBounds(); // based on aggregate of Hex2.cont.cache(bounds);
    let x0 = hexRect.x + hexRect.width/2, y0 = hexRect.y + hexRect.height/2;
    MapCont.cNames.forEach(cname => {
      mapCont[cname].x = -x0
      mapCont[cname].y = -y0
    })
  }

  pickColor(hexAry: Hex2[]): string {
    let hex = hexAry[0]
    let adjColor: string[] = [HexMap.distColor[0]] // colors not to use
    this.linkDirs.forEach(hd => {
      let nhex: Hex2 = hex;
      while (!!(nhex = nhex.nextHex(hd) as Hex2)) {
        if (nhex.district != hex.district) { adjColor.push(nhex.distColor); return }
      }
    })
    return HexMap.distColor.find(ci => !adjColor.includes(ci))
  }
  /**
   * rings of Hex with EwTopo; HexShape(tilt = 'NE')
   * @param nh order of inner-hex: number hexes on side of meta-hex
   * @param mr make new district on meta-row
   * @param mc make new district on meta-col
   */
  makeDistrict(nh: number, district: number, mr: number, mc: number): Hex[] {
    const mcp = Math.abs(mc % 2), mrp = Math.abs(mr % 2), dia = 2 * nh - 1;
    // irow-icol define topology of MetaHex composed of HexDistrict
    // TODO: generalize using this.topo to compute offsets!
    const irow = (mr: number, mc: number) => {
      let ir = mr * dia - nh * (mcp + 1) + 1
      ir -= Math.floor((mc) / 2)              // - half a row for each metaCol
      return ir
    }
    const icol = (mr: number, mc: number, row: number) => {
      let np = Math.abs(nh % 2), rp = Math.abs(row % 2)
      let ic = Math.floor(mc * ((nh * 3 - 1) / 2))
      ic += (nh - 1)                        // from left edge to center
      ic -= Math.floor((mc + (2 - np)) / 4) // 4-metaCol means 2-rows, mean 1-col
      ic += Math.floor((mr - rp) / 2)       // 2-metaRow means +1 col
      return ic
    }
    const row0 = irow(mr, mc), col0 = icol(mr, mc, row0);
    const hexAry = Array<T>(); hexAry['Mr'] = mr; hexAry['Mc'] = mc;
    const hex = this.addHex(row0, col0, district);
    hexAry.push(hex) // The *center* hex
    let rc: RC = { row: row0, col: col0 } // == {hex.row, hex.col}
    //console.groupCollapsed(`makelDistrict [mr: ${mr}, mc: ${mc}] hex0= ${hex.Aname}:${district}-${dcolor}`)
    //console.log(`.makeDistrict: [mr: ${mr}, mc: ${mc}] hex0= ${hex.Aname}`, hex)
    const dirs = this.linkDirs;
    const startDir = dirs[4]; // 'W' or 'NW'
    for (let ring = 1; ring < nh; ring++) {
      rc = this.nextRowCol(rc, startDir); // step West to start a ring
      // place 'ring' hexes along each axis-line:
      dirs.forEach(dir => rc = this.newHexesOnLine(ring, rc, dir, district, hexAry))
    }
    //console.groupEnd()
    this.setDistrictColor(hexAry, district);
    return hexAry
  }
  setDistrictColor(hexAry: T[], district = 0) {
  this.district[district] = hexAry;
    if (hexAry[0] instanceof Hex2) {
      const hex2Ary = hexAry as any as Hex2[];
      const dcolor = district == 0 ? HexMap.distColor[0] : this.pickColor(hex2Ary)
      hex2Ary.forEach(hex => hex.setHexColor(dcolor)) // makeDistrict: dcolor=lightgrey
    }
  }

  /**
   *
   * @param n number of Hex to create
   * @param hex start with a Hex to the West of this Hex
   * @param dir after first Hex move this Dir for each other hex
   * @param district
   * @param hexAry push created Hex(s) on this array
   * @returns RC of next Hex to create (==? RC of original hex)
   */
  newHexesOnLine(n: number, rc: RC, dir: HexDir, district: number, hexAry: Hex[]): RC {
    let hex: Hex
    for (let i = 0; i < n; i++) {
      hexAry.push(hex = this.addHex(rc.row, rc.col, district))
      rc = this.nextRowCol(hex, dir)
    }
    return rc
  }

}

/** Marker class for HexMap used by GamePlayD */
export class HexMapD extends HexMap<Hex> {

}

export class SquareMap<T extends Hex> extends HexMap<T> {
  constructor(radius: number = TP.hexRad, addToMapCont = false, hexC?: HexConstructor<T>) {
    super(radius, addToMapCont, hexC);
    this.topo = this.nsTopo;
    HexShape.tilt = 'N';
  }
  // SEE ALSO: hex.xywh(radius, axis, row, col)
  /** height per row of cells with NS Topo */
  override get rowHeight() { return this.radius * H.sqrt3 };
  /** height of hexagonal cell with EW Topo */
  override get cellHeight() { return this.radius * H.sqrt3 }
  /** width per col of cells with EW Topo */
  override get colWidth() { return this.radius * 1.5 }
  /** width of hexagonal cell with EW Topo */
  override get cellWidth() { return this.radius * 2 }

  override makeAllDistricts(nh = TP.nHexes, mh = TP.mHexes): void {
    if (this.topo === this.ewTopo) super.makeAllDistricts();
    else {
      this.makeRect(nh, nh + 1);
      this.mapCont.hexCont && this.centerOnContainer()
    }
  }

  /**
   * Rectangle of hexes (comprising a metaRect)
   * @param nr height
   * @param nc width
   * @param mr metaRow = 1
   * @param mc metaCol = 1
   * @returns flat array of the Hexes that were created.
   */
  makeRect(nr: number, nc = nr + 1, district = 0, roundCorner = true): Hex[] {
    const hexAry = Array<T>(); hexAry['Nr'] = nr; hexAry['Nc'] = nc;
    //console.groupCollapsed(`makelDistrict [mr: ${mr}, mc: ${mc}] hex0= ${hex.Aname}:${district}-${dcolor}`)
    //console.log(`.makeDistrict: [mr: ${mr}, mc: ${mc}] hex0= ${hex.Aname}`, hex)
    const nc0 = roundCorner ? nc - 1 - (nc % 2) : nc
    const ncf = roundCorner ? nc -3 : nc;
    this.newHexesOnRow(nc0, { row: 0, col: roundCorner ? 1 : 0 }, district, hexAry);
    for (let row = 1; row < nr - 1; row++) {
      // place 'row' of hexes
      this.newHexesOnRow(nc, { row, col: 0 }, district, hexAry);
    }
    this.newHexesOnRow(ncf, { row: nr - 1, col: roundCorner ? 2 : 0 }, district, hexAry, roundCorner ? 2 : 1);
    //console.groupEnd()
    this.setDistrictColor(hexAry, district);
    return hexAry
  }

  newHexesOnRow(n: number, rc: RC, district: number, hexAry: Hex[], di = 1): RC {
    let hex: Hex, { row, col } = rc;
    for (let i = 0; i < n; i += di) {
      // if (!(row == 0 && (i == 0 || i == n-1)) && !(false))
        hexAry.push(hex = this.addHex(row, col + i, district))
    }
    return rc
  }
}
