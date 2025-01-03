import { Constructor, permute, XY, stime, RC } from "@thegraid/common-lib";
import { C, KeyBinder } from "@thegraid/easeljs-lib";
import { Graphics } from "@thegraid/easeljs-module";
import { AnkhMeeple, AnkhPiece, Figure, Guardian } from "./ankh-figure";
import { Hex, Hex2, HexConstructor, HexMap } from "./hex";
import { EwDir, H, HexDir, NsDir } from "./hex-intfs";
import type { Meeple } from "./meeple";
import type { RegionElt, SplitDir, SplitElt, SplitSpec } from "./scenario-parser";
import { EdgeShape, HexShape } from "./shapes";
import { TP } from "./table-params";
import { Tile } from "./tile";

export type RegionId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 ;
export type RegionNdx = number;
export class RectMap<T extends Hex> extends HexMap<T> {
  constructor(radius: number = TP.hexRad, addToMapCont = false, hexC?: HexConstructor<T>) {
    super(radius, addToMapCont, hexC);
    this.topo = TP.useEwTopo ? H.ewTopo : H.nsTopo;
  }

  override makeAllDistricts(nh = TP.nHexes, mh = TP.mHexes): T[] {
    if (TP.useEwTopo) return super.makeAllDistricts();
    else {
      const hexAry = this.makeRect(nh, mh); // implicit: district = 0;
      this.mapCont.hexCont && this.centerContainers();
      return hexAry;
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
  makeRect(nr: number, nc = nr + 1, district = 0, roundCorner = true): T[] {
    const hexAry = Array<T>(); hexAry['Nr'] = nr; hexAry['Nc'] = nc;
    //console.groupCollapsed(`makelDistrict [mr: ${mr}, mc: ${mc}] hex0= ${hex.Aname}:${district}-${dcolor}`)
    //console.log(`.makeDistrict: [mr: ${mr}, mc: ${mc}] hex0= ${hex.Aname}`, hex)
    const nc0 = roundCorner ? nc - 1 - (nc % 2) : nc
    const ncf = roundCorner ? nc - 3 : nc;
    this.newHexesOnRow(nc0, { row: 0, col: roundCorner ? 1 : 0 }, district, hexAry);
    for (let row = 1; row < nr - 1; row++) {
      // place 'row' of hexes
      this.newHexesOnRow(nc, { row, col: 0 }, district, hexAry);
    }
    this.newHexesOnRow(ncf, { row: nr - 1, col: roundCorner ? 2 : 0 }, district, hexAry, roundCorner ? 2 : 1);
    //console.groupEnd()
    this.setDistrictColor(hexAry, district);
    this.hexAry = hexAry;
    return hexAry
  }

  newHexesOnRow(n: number, rc: RC, district: number, hexAry: Hex[], di = 1): RC {
    const { row, col } = rc;
    for (let i = 0; i < n; i += di) {
      hexAry.push(this.addHex(row, col + i, district))
    }
    return rc;
  }
}

class AnkhHexShape extends HexShape {
  // TODO: use cgf?
  override paint(color: string): Graphics {
    this.setHexBounds();
    const g = this.graphics.c();
    return g.s(C.grey).f(color).dp(0, 0, Math.floor(this.radius * 60 / 60), 6, 0, this.tilt);
  }
}
export type Terrain = 'd' | 'f' | 'w';
export class AnkhHex extends Hex2 {
  // directions that are blocked; non-adjacent in Ankh.
  readonly borders: { [key in NsDir]?: boolean | undefined } = {};
  Avisit: number = undefined;
  terrain: Terrain;
  regionId: RegionId;
  overlay: HexShape = this.newOverlay();
  get piece() { return this.tile ?? this.meep }      // Assert: meep ISA Figure: else Tile ISA Monument
  isStableHex(): this is StableHex { return false; } // must be function/method not a 'get' to use 'is...'

  override get meep(): AnkhMeeple { return super.meep as AnkhMeeple; }
  override set meep(meep: Meeple) { super.meep = meep; }

  override get tile(): AnkhPiece { return super.tile as AnkhPiece; }
  override set tile(tile: Tile) { super.tile = tile; }

  get figure(): Figure { return (this.meep instanceof Figure) ? this.meep : undefined }

  declare map: AnkhMap<AnkhHex>;

  override toString(sc?: string): string {
    return `${this.piece ?? this.Aname}`;
  }

  newOverlay() {
    const overlay = new HexShape(); // for showRegion()
    overlay.paint('rgba(250,250,250,.3)');
    overlay.visible = false;
    this.cont.addChild(overlay);
    return overlay
  }

  override makeHexShape(shape?: Constructor<HexShape>): HexShape {
    return super.makeHexShape(shape ?? AnkhHexShape);
  }

  /** find hexDir of a [Border-adjacent] Hex that statifies predicate. */
  findAdjHex(pred: (hex: this, dir: HexDir, hex0: this) => boolean = () => true) {
    return this.linkDirs.find((dir: HexDir) => !this.borders[dir] && pred(this.links[dir], dir, this));
  }

  /** select each [in this/same region] Hex linked to this that satisfies predicate */
  filterAdjHexByRegion(pred: ((hex: this, dir: HexDir, hex0: this) => boolean)) {
    const region = this.map.regions[this.regionId - 1];
    return this.linkDirs.filter(dir => !!this.links[dir] && region ? region.includes(this.links[dir]) : true).filter(dir => pred(this.links[dir], dir, this), this);
  }
  /** adjHexByRegion allows for Apep in adjacent water. */
  findAdjHexByRegion(pred: ((hex: this, dir: HexDir, hex0: this) => boolean)) {
    const region = this.map.regions[this.regionId - 1];
    return this.linkDirs.filter(dir => !!this.links[dir] && region ? region.includes(this.links[dir]) : true).find(dir => pred(this.links[dir], dir, this), this);
  }

  /** returns the dir to hex if there is no border, undefined otherwise */
  canEnter(hex: AnkhHex) {
    return this.findLinkHex((lhex, dir) => (lhex === hex) && !this.borders[dir]);
  }

  /**
   * return XY of the corner nearest the given point.
   *
   * The perimeter is partitioned into sectors centered on the given HexDirs.
   * @param xy {x,y}
   * @param basis DisplayObject basis for xy coordinates (this.cont.parent --> hexMap.hexCont).
   * @param hexDirs any selection of HexDirs
   * @return [hexDir to nearest corner, xy in this.cont]
   */
  cornerDir(xy: XY, basis = this.cont.parent, hexDirs = H.hexDirs ) {
    const { x, y } = basis.localToLocal(xy.x, xy.y, this.cont); // on hex
    const deg = ((Math.atan2(y, x) * 180 / Math.PI) + 90 + 360) % 360;
    const rots = hexDirs.map(dir => H.dirRot[dir] as number).sort((a, b) => a - b); // ascending
    const n = rots.length;
    rots.push(rots[0] + 360);    // rots[n]
    let rotLow = ((rots[0] + rots[n - 1] - 360) / 2);
    // find ndx:: rot[ndx-1]<rot[ndx]<rot[ndx+1]  indicies modulo (dirs.length-1)
    const rot = rots.find((rot: number, ndx: number) => {
      const rotHi = (rot + (rots[ndx + 1] ?? 720)) / 2; // (rotHi >= 720/2) guarantees: (deg <= rotHi)
      if (deg >= rotLow && deg <= rotHi) return true;
      rotLow = rotHi;
      return false;
    });
    const hexDir = H.rotDir[rot % 360] as HexDir; // ASSERT: rot > 0;
    return [hexDir, { x, y }] as [HexDir, XY];
  }

  /**
   * The XY coordinates of the indicated hexDir corner (or would-be corner for the indicated topo).
   *
   * simply convert from polar to cartesian coords; sin(angle(dir))*radius
   */
  cornerXY(hexDir: HexDir, rad = this.radius): XY {
    const angleR = H.dirRot[hexDir] * Math.PI / 180;
    return { x: Math.sin(angleR) * rad, y: -Math.cos(angleR) * rad }; // corner coordinates (on hex)
  }
  static adjCornerDir: { [key in EwDir]: [NsDir, EwDir][] } = {
    NE: [['N', 'SE'], ['EN', 'W']], E: [['EN', 'SW'], ['ES', 'NW']], SE: [['ES', 'W'], ['S', 'NE']],
    SW: [['S', 'NW'], ['WS', 'E']], W: [['WS', 'NE'], ['WN', 'SE']], NW: [['WN', 'E'], ['N', 'SW']],
  }
  /** returns selected hexes adjacent to the indicated corner.
   * @param pred (hex, nsDir) => boolean;
  */
  cornerAdjHexes(ewDir: EwDir, pred: ((hex: this, dir?: EwDir) => boolean) = (hex => !!hex), log=false) {
    const adjC = AnkhHex.adjCornerDir[ewDir];
    const adjH = adjC.map(([nsDir, ewDir]) => [this.links[nsDir], ewDir]) as [this, EwDir][];
    const rv = adjH.filter(([hex, ewDir]) => !!hex && pred(hex, ewDir));
    log && console.log(stime(this, `.cornerAdjHexes: ${this.Aname}-${ewDir} ${rv[0]?.[0].Aname}-${rv[0]?.[1]}`), adjC, adjH, rv);
    return rv;
  }
  /** return true if given XY point is within r of the corner at hexDir. */
  isNearCorner(pt: XY, hexDir: HexDir, r = 0.35 * this.radius) {
    const { x: cx, y: cy } = this.cornerXY(hexDir);
    const [dx, dy] = [pt.x - cx, pt.y - cy];                     // mouseToCorner (on hex)
    const d2 = dx * dx + dy * dy;
    return (d2 < r * r);
  }

  /** add an EdgeShape to infCont over the indicated edge of this Hex. */
  addEdge(dir: HexDir, color: string) {
    const dirRot = TP.useEwTopo ? H.ewDirRot : H.nsDirRot;
    const angle: number = dirRot[dir];
    const rshape = new EdgeShape(color, this, dir, this.map.mapCont.infCont);
    const pt = this.cont.localToLocal(0, 0, rshape.parent);
    const { x, y } = pt, r = this.radius;
    // 0-degrees is 'North'; -sin() because y-axis goes South.
    const a0 = angle - 30, a1 = angle + 30;
    const x0 = x + r * Math.sin(a0 * H.degToRadians);
    const y0 = y - r * Math.cos(a0 * H.degToRadians);
    const x1 = x + r * Math.sin(a1 * H.degToRadians);
    const y1 = y - r * Math.cos(a1 * H.degToRadians);
    rshape.graphics.mt(x0, y0).lt(x1, y1);
  }
}
export class StableHex extends AnkhHex {
  size: number;  // TP.ankh1Rad | TP.ankh2rad; ideally would be readonly constructor arg, but newHex2()...
  usedBy: Guardian;  // gets set, but not un-set
  override isStableHex(): this is StableHex { return true; }

  override get meep() { return super.meep; }
  override set meep(meep: AnkhMeeple) {
    super.meep = meep;
    if (!meep) return;
    if (this.usedBy && this.usedBy !== meep) debugger;
    if (this.size !== meep.radius) debugger;
    this.usedBy = meep as Guardian;  // never un-set usedBy.
    meep.homeHex = this;
    this.size = meep.radius;
  }
}

/** SpecialHex scales the Tile or Meep by .8 */
export class SpecialHex extends AnkhHex {
  scale = .8;

  override get meep() { return super.meep; }

  override set meep(meep: AnkhMeeple) {
    if (meep === undefined && this.meep) {
      this.meep.scaleX = this.meep.scaleY = 1;
      this.meep.updateCache();
    }
    super.meep = meep;
    if (meep !== undefined) {
      meep.scaleX = meep.scaleY = this.scale;
      meep.updateCache();
    }
  }

  override get tile() { return super.tile; }

  override set tile(tile: AnkhPiece) {
    if (tile === undefined && this.tile) {
      this.tile.scaleX = this.tile.scaleY = 1;
      this.tile.updateCache();
    }
    super.tile = tile;
    if (tile !== undefined) {
      tile.scaleX = tile.scaleY = this.scale;
      tile.updateCache();
    }
  }
}


/** row, col, terrain-type, edges(river) */
export type hexSpec = [r: number, c: number];
export type hexSpecr = [r: number, c: number, ...e: HexDir[]];


export class AnkhMap<T extends AnkhHex> extends RectMap<T> {
  static fspec: hexSpec[] = [
    [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7], [3, 8], [4, 4], [4, 5], [4, 6], [5, 5], [5, 6], [6, 5], [6, 6], [7, 4], [7, 5], [8, 4], [8, 5], [9, 4]
  ];
  static dspec: hexSpec[] = [
    [3, 0], [3, 1], [3, 10], [4, 0], [4, 1], [4, 2], [4, 3], [4, 7], [4, 8], [4, 9], [5, 0], [5, 1], [5, 3], [5, 4], [5, 7], [5, 8], [5, 9], [6, 0], [6, 1], [6, 7], [6, 8], [7, 0], [7, 1], [7, 2], [7, 3], [7, 6], [7, 7], [7, 9], [8, 0], [8, 1], [8, 2], [8, 3], [8, 6], [8, 7], [8, 8], [8, 9], [9, 2], [9, 6], [9, 8],
  ];
  static wspec: hexSpec[] = [
    [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [1, 10], [3, 9], [4, 10], [5, 2], [5, 10], [6, 2], [6, 3], [6, 4], [6, 9], [6, 10], [7, 8], [7, 10], [8, 10],
  ];
  static rspec: SplitSpec[]  = [
    [
      [0, 1, 'WS'], [1, 1, 'WN', 'WS', 'S'], [2, 2, 'WS', 'S'], [2, 3, 'WS', 'S'], [3, 4, 'WS', 'S'],
      [3, 5, 'WS', 'S', 'ES'], [3, 6, 'S', 'ES'], [2, 7, 'S', 'ES'], [2, 8, 'S', 'ES'], [1, 9, 'S', 'ES']],
    [
      [4, 5, 'EN', 'ES'], [5, 5, 'EN', 'ES', 'S'], [6, 5, 'WS'], [7, 5, 'WN', 'WS'], [8, 5, 'WN', 'WS']],
  ];
  static tColor = { d: '#ffe599', f: '#93c47d', w: '#a4c2f4' };

  regions: T[][] = [];
  splits: SplitSpec[] = [];

  constructor(radius?: number, addToMapCont?: boolean, hexC?: HexConstructor<T>) {
    super(radius, addToMapCont, hexC ? AnkhHex as any as HexConstructor<T> : hexC);
    this.bindKeys();
  }

  bindKeys() {
    KeyBinder.keyBinder.setKey('l', { thisArg: this, func: () => this.showRegions() });
    KeyBinder.keyBinder.setKey('L', {
      thisArg: this, func: () => {
        this.hexAry.forEach(hex => { hex.overlay.visible = false; hex.cont.updateCache() })
        this.update();
      }
    });
  }

  override addToMapCont(hexC?: Constructor<T>): this {
    return super.addToMapCont(hexC ?? AnkhHex as any as HexConstructor<T>);
  }

  override makeAllDistricts(nh?: number, mh?: number) {
    const rv = super.makeAllDistricts(nh, mh);
    this.regions[0] = this.hexAry.concat();
    this.setRegionId(1)
    this.addTerrain();
    this.addRiverSplits();
    return rv;
  }

  setTerrain([r, c]: hexSpec, terrain: Terrain, color = AnkhMap.tColor[terrain]) {
    const hex = this[r]?.[c];
    if (!hex) return;
    hex.terrain = terrain;
    const hexShape = hex.hexShape;
    hexShape.paint(color);
    hex.cont.updateCache();
  }

  /** stop movement from hex in the given direction.
   * Also stop movement in other direction (unless sym == false).
   */
  addBorder(hex: AnkhHex, dir: HexDir, sym = true) {
    if (!dir) return;
    hex.borders[dir] = true;
    if (sym) {
      if (!H.nsDirs.includes(dir as NsDir)) debugger;
      hex.links[dir].borders[H.dirRev[dir]] = true;
    }
  }

  /** add graphics to rshape to show edges
   * @param border if true, include edge as border to region.
   */
  addEdges([row, col, ...hexDir]: SplitDir, border = true) {
    const hex = this[row][col];
    if (!hex) return;
    const color = this.splits.length >= 3 ? TP.borderColor : TP.riverColor;;
    hexDir.filter(elt => !!elt).forEach(dir => {
      if (!H.nsDirs.includes(dir as NsDir)) debugger; // assuming TP.useNs
      hex.addEdge(dir, color);
      if (border) this.addBorder(hex, dir);
    });
  }

  // regionId = district = external Region Ident: (1 .. N)
  // regionNdx = internal index; regions[regionNdx] => AnkhHex[]: (0 .. N-1)
  // Outside of this 'addSplit' critical section: regionNdx === regionId - 1;
  /** add borders; also do some regionIds... */
  addSplit(splitSpec: SplitElt[], border?: boolean) {
    this.splits.push(splitSpec);
    const ankhMap = this;
    const [row, col, dir] = splitSpec[0];
    if (typeof dir !== 'string') splitSpec = splitSpec.slice(1); // skip old-style spec where [0] = [row, col, bid]

    splitSpec.forEach(splitDir => this.addEdges(splitDir, border)); // add edges as borders.

    // find 2 seed hexes, determined by splitSpec[0]; one on either side of the first edge.
    const [row0, col0, dir0] = splitSpec[0];
    const hex0 = this[row0][col0];
    const hex1 = hex0.links[dir0];
    const [row1, col1] = [hex1.row, hex1.col];

    // region will split to 2 region IDs: [rid0, rid1]
    const rid0 = ankhMap.regionIndex(row0, col0, hex0) + 1 as RegionId;
    const rid1 = ankhMap.regions.length + 1 as RegionId; // new regionId
    const seed0 = [row0, col0, rid0] as RegionElt;
    const seed1 = [row1, col1, rid1] as RegionElt;
    const seeds = [seed0, seed1]; // [row1, col1, orid]
    const newRs = ankhMap.findRegions(ankhMap.regions[rid0 - 1], seeds);
    // Assert: newRs.length = 2; labeled (possibly incorrectly) with [origRid, newRid];
    // the Region containing the given Hex in [row,col] is given newRid.

    const bidHexInR1 = newRs[1].includes(hex0);
    if (bidHexInR1) {
      ankhMap.regions[rid0 - 1] = newRs[0]; // put in region Index cooresponding to regionId
      ankhMap.regions[rid1 - 1] = newRs[1]; // put in region Index cooresponding to regionId
    } else {
      ankhMap.regions[rid1 - 1] = newRs[0]; // put in region Index cooresponding to regionId
      ankhMap.regions[rid0 - 1] = newRs[1]; // put in region Index cooresponding to regionId
      // regionIds are incorrect, fix them:
      this.setRegionId(rid1);
      this.setRegionId(rid0);
    }
    // console.log(stime(this, `.split: newRs`), map.regionList(newRs), ids);
    return [rid0, rid1];
  }

  /** Set hex.district = regionId; for all (non-water) hexes in region[regionId-1] */
  setRegionId(regionId: RegionId) {
    const regionNdx = regionId -1, waterId = 0 as RegionId;
    this.regions[regionNdx].map(hex => hex.regionId = hex.district = ((hex.terrain === 'w') ? waterId : regionId));
    this.regions[regionNdx].map(hex => hex.cont.updateCache());
  }

  edgeShape(color = TP.borderColor, hex?: Hex2, dir?: HexDir) {
    return new EdgeShape(color, hex, dir, this.mapCont.infCont); // slightly darker
  }

  addTerrain() {
    // add Rivers: (one growing shape.graphics)
    AnkhMap.fspec.forEach(spec => this.setTerrain(spec, 'f'));
    AnkhMap.dspec.forEach(spec => this.setTerrain(spec, 'd'));
    AnkhMap.wspec.forEach(spec => this.setTerrain(spec, 'w'));
    AnkhMap.wspec.forEach(([r, c]: hexSpec) => {
      const whex = this[r][c];
      whex.forEachLinkHex((ohex: AnkhHex, dir) => {
        if (ohex.terrain !== 'w') this.addBorder(ohex, H.dirRev[dir], false)
      });
    });
  }

  addRiverSplits() {
    AnkhMap.rspec.forEach(spec => this.addSplit(spec));        // after marking water!
  }

  oneRegion(hexAry = this.hexAry, regionId: RegionId = 1) {
    this.regions = [hexAry];
    hexAry.forEach(hex => hex.regionId = regionId);
    // regionMarkers should all sendHome(), but that is fixed later in parseScenario...
  }
  /**
   * split region into [region(hex0), otherRegion]
   * @param hexAry an array to be split.
   * @param seeds assign a region to hexes adjacent to each seed;
   * @param rids regionId to assign to each seed-region;
   * @returns [newRegion(seed0), ...newRegions(seedN)]
   */
  findRegions(hexAry = this.hexAry, regionElts: RegionElt[]): T[][] {
    const regions: T[][] = []; // each element is AnkhHex[];
    let avisit = 0;
    const setRegion = (hex: T, region: T[], regionId: RegionId) => {
      hex.regionId = hex.district = regionId;
      hex.Avisit = avisit++;
      region.push(hex);
      return hex.terrain === 'w';
    }
    /**
     * Expand region to include neighbors of given hex.
     * @param hex seed from which to expand
     * @param region hex[] to be expanded
     * @param regionId set each hex.regionId; differentiates regions; regions[id] = region!
     * @param rndx 0-based index in this.regions;
     */
    const addNeighbors = (hex: T, region: T[], regionId: RegionId) => {
      hex.forEachLinkHex((nhex: T, dir: HexDir) => {
        if (nhex.regionId !== undefined) return;
        if (hex.borders[dir] && nhex.terrain !== 'w') return;          // not semantically adjacent
        // adjacent water is in each region, but does not propagate.
        if (setRegion(nhex, region, regionId)) return;
        addNeighbors(nhex, region, regionId);
      });
    }
    hexAry.forEach(hex => hex.regionId = undefined);    // mark all as not in any region:
    const seeds = regionElts.map(([row, col, rids]) => this[row][col]) ;
    const rids =regionElts.map(([row, col, rids]) => rids) ;
    seeds.forEach((hex, rndx) => {
      // put hex and its adjacent neighbors in the same region;
      const region: T[] = [], rid = rids[rndx];
      regions[rndx] = region;
      if (!hex) return;   // bad seed
      if (hex.regionId !== undefined) return; // already done; seeds not distinct!
      if (setRegion(hex, region, rid)) return; // water seed! single hex in region...
      addNeighbors(hex, region, rid);   // claim adjacent hexes and water
      hexAry.forEach(hex => hex.terrain === 'w' && (hex.regionId = undefined)); // water again available!
    });
    regions.forEach(region => region.filter(hex => hex.terrain === 'w').forEach(hex => { hex.district = 0; hex.cont.updateCache() }));
    // console.log(stime(this, `.findRegions: [${seeds}, ${rids}] found:`), regions.map(r => r.concat()));
    return regions;
  }

  colors = ['red', 'yellow', 'cyan', 'magenta', 'blue', 'green', 'lightgreen', 'purple', 'lightblue'];
  showRegions(hexAry = this.hexAry, colors = permute(this.colors.concat())) {
    hexAry.forEach(ahex => {
      if (ahex.regionId !== undefined) {
        const color = C.nameToRgbaString(colors[ahex.regionId % colors.length], .2)
        ahex.overlay.paint(color);
        ahex.overlay.visible = ahex.terrain !== 'w';
        if (ahex.cont.cacheID) ahex.cont.updateCache();
      }
    })
    this.update();
  }

  showRegion(regionNdx = 0, color?: string) {
    const region = this.regions[regionNdx]
    region?.forEach(ahex => {
      ahex.overlay.paint(color ?? 'rgba(240,240,240,.2');
      ahex.overlay.visible = !!color;
      ahex.cont.updateCache();
    });
    this.update();
  }
  regionIndex(row: number, col: number, hex = this[row][col]) {
    return this.regions.findIndex(r => r?.includes(hex)) as RegionId;
  }
  /** debug aid: return array of {r.Aname, r.index, r.length} */
  regionList(regions = this.regions) {
    return regions.map((r, i) => { return { r: r && r['Aname'], i: i+1, l: r?.length ?? -1 } })
  }

  battleOrder: number[] = [];
}
