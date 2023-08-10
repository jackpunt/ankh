import { C, Constructor, KeyBinder, RC, XY, stime } from "@thegraid/easeljs-lib";
import { Graphics } from "@thegraid/easeljs-module";
import type { AnkhMeeple, AnkhPiece } from "./ankh-figure";
import type { RegionElt, SplitBid, SplitDir, SplitSpec } from "./ankh-scenario";
import { permute } from "./functions";
import { Hex, Hex2, HexConstructor, HexMap } from "./hex";
import { EwDir, H, HexDir } from "./hex-intfs";
import type { Meeple } from "./meeple";
import { EdgeShape, HexShape } from "./shapes";
import { TP } from "./table-params";
import type { Tile } from "./tile";

export type RegionId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 ;
export type RegionNdx = number;
export class SquareMap<T extends Hex> extends HexMap<T> {
  constructor(radius: number = TP.hexRad, addToMapCont = false, hexC?: HexConstructor<T>) {
    super(radius, addToMapCont, hexC);
    this.topo = TP.useEwTopo ? H.ewTopo : H.nsTopo;
  }

  override makeAllDistricts(nh = TP.nHexes, mh = TP.mHexes): T[] {
    if (TP.useEwTopo) return super.makeAllDistricts();
    else {
      const hexAry = this.makeRect(nh, nh + 1);
      this.mapCont.hexCont && this.centerOnContainer();
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
    const ncf = roundCorner ? nc -3 : nc;
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
  readonly borders: { [key in HexDir]?: boolean | undefined } = {};
  Avisit: number = undefined;
  terrain: Terrain;
  regionId: RegionId;
  overlay: HexShape;
  get piece() { return this.tile ?? this.meep }

  override get meep(): AnkhMeeple { return super.meep as AnkhMeeple; }
  override set meep(meep: Meeple) { super.meep = meep; }

  override get tile(): AnkhPiece { return super.tile as AnkhPiece; }
  override set tile(tile: Tile) { super.tile = tile; }

  override makeHexShape(shape?: Constructor<HexShape>): HexShape {
    if (!this.overlay) this.overlay = new HexShape(undefined); // for showRegion()
    this.overlay.paint('rgba(250,250,250,.3)');
    this.overlay.visible = false;
    this.cont.addChild(this.overlay);
    return super.makeHexShape(shape ?? AnkhHexShape);
  }

  /** search each Hex linked to this. */
  findAdjHex(pred: (hex: this, dir: HexDir, hex0: this) => boolean) {
    return this.linkDirs.find((dir: HexDir) => !this.borders[dir] && pred(this.links[dir], dir, this));
  }
  filterAdjHex(pred: (hex: this, dir: HexDir, hex0: this) => boolean) {
    return this.linkDirs.filter((dir: HexDir) => !this.borders[dir] && pred(this.links[dir], dir, this));
  }

  cornerDir(pt: XY, parent = this.cont.parent ) {
    const { x: x, y: y } = parent.localToLocal(pt.x, pt.y, this.cont); // on hex
    const atan = Math.atan(x / y); // [-PI/2 ... 0 ... +PI/2]; * WtoNtoE => [-1 .. 0 .. 1]
    const ndx = Math.round(3 * (atan * (2 / Math.PI) + ((y < 0) ? 3 : 1)))
    const hexDir = ['W', 'SW', 'SW', 'S', 'SE', 'SE', 'E', 'NE', 'NE', 'N', 'NW', 'NW', 'W'][ndx] as HexDir;
    return { x, y, hexDir };
  }

  cornerXY(ewDir: EwDir, rad = this.radius): XY {
    const angleR = H.ewDirRot[ewDir] * Math.PI / 180;
    return { x: Math.sin(angleR) * rad, y: -Math.cos(angleR) * rad }; // corner coordinates (on hex)
  }

  addEdge(angle: number, color: string) {
    const rshape = new EdgeShape(color, this.map.mapCont.infCont);
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

/** row, col, terrain-type, edges(river) */
export type hexSpec = [r: number, c: number];
export type hexSpecr = [r: number, c: number, ...e: HexDir[]];


export class AnkhMap<T extends AnkhHex> extends SquareMap<T> {
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
    [[1, 0, 2], [1, 0, 'NE', 'SE'], [2, 0, 'NE'], [2, 1, 'N', 'NE'], [3, 2, 'N', 'NE'], [3, 3, 'N', 'NE'], [4, 4, 'N', 'NE'],
    [4, 5, 'N', 'NE', 'SE'],
    [4, 6, 'NW', 'N'], [3, 7, 'NW', 'N'], [3, 8, 'NW', 'N'], [2, 9, 'NW', 'N'], [2, 10, 'NW']],
    [[5, 5, 3], [5, 5, 'NE', 'SE', 'S'], [6, 5, 'SW'], [7, 5, 'NW', 'SW'], [8, 5, 'NW', 'SW']],
  ];
  static tColor = { d: '#ffe599', f: '#93c47d', w: '#a4c2f4' };

  regions: T[][] = [];
  adjRegions: Map<number,number>;
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
    this.addTerrain();
    this.addRiverSplits();
    this.initialRegions();
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

  addBorder(hex: AnkhHex, dir: HexDir, sym = true) {
    if (!dir) return undefined;
    if (sym) {
      hex.borders[dir] = true;
    }
    const oHex = hex.links[dir], rdir = H.dirRev[dir];
    oHex && (oHex.borders[rdir] = true); // testing with ewTopo does not find oHex.
    return oHex;
  }

  /** add graphics to rshape to show edges
   * @param border if true, include edge as border to region.
   */
  addEdges([row, col, ...e]: SplitDir, border = true) {
    const hex = this[row][col];
    const color = this.splits.length >= 3 ? TP.borderColor : TP.riverColor;;
    if (!hex) return;
    const dirRot = TP.useEwTopo ? H.ewDirRot : H.nsDirRot;
    e.filter(elt => !!elt).forEach(dir => {
      hex.addEdge(dirRot[dir], color);
      if (border) this.addBorder(hex, dir);
    });
  }

  addSplit(splitSpec: SplitSpec, border?: boolean, ignoreBid = false) {
    this.splits.push(splitSpec);
    const splitN = splitSpec[0] as SplitBid, map = this;
    const splitD = splitSpec.slice(1) as SplitDir[];

    splitD.forEach(splitD => this.addEdges(splitD, border));
    const [row, col, bid] = splitN;
    const bidHex = map[row][col];
    const origRid = map.regionIndex(row, col, bidHex) + 1;

    // regionId = district = external Region Ident: 1--N
    // regionNdx = internal index; regions[regionNdx] => AnkhHex[]
    // Outside of 'addSplit': regionNdx == regionId - 1;
    const newRid = ignoreBid ? map.regions.length + 1 : bid; // new regionNdx

    // region will split to 2 region IDs: [regions.length, origNdx]
    // given Hex put in slot 'len', but labeled with: bid-1,
    // other stays in slot origNdx, labeled with: (origRid or newRid)
    // [r0,r1,r2]; (bid==3) ? [r0,r1,o2[oldRid],n3[bid]] : [r0,r1,o2[nRid],n3[bid]];
    // then we swap: [r0,r1,o2[len],n3[2]] ==> [r0,r1,n3[2],o2[len]]

    // const seed0 = splitN as RegionElt;   // [row, col, bid]
    const [row0, col0, dir0] = splitD[0];
    const seedHex0 = this[row0][col0];
    const seedHex1 = seedHex0.links[dir0];
    const seed0 = [seedHex0.row, seedHex0.col, origRid] as RegionElt;
    const seed1 = [seedHex1.row, seedHex1.col, newRid] as RegionElt;
    const seeds = [seed0, seed1]; // [row1, col1, orid]
    const newRs = map.findRegions(map.regions[origRid - 1], seeds);
    // Assert: newRs.length = 2; labeled (possibly incorrectly) with [origRid, newRid];

    const bidHexInR1 = newRs[1].includes(bidHex);
    if (bidHexInR1) {
      map.regions[origRid - 1] = newRs[0]; // put in region Index cooresponding to regionId
      map.regions[newRid - 1] = newRs[1]; // put in region Index cooresponding to regionId
    } else {
      map.regions[newRid - 1] = newRs[0]; // put in region Index cooresponding to regionId
      map.regions[origRid - 1] = newRs[1]; // put in region Index cooresponding to regionId
      // regionIds are incorrect, fix them:
      newRs[0].forEach(hex => hex.district = hex.regionId = newRid as RegionId);
      newRs[1].forEach(hex => hex.district = hex.regionId = origRid as RegionId);
    }
    // console.log(stime(this, `.split: newRs`), map.regionList(newRs), ids);
  }

  edgeShape(color = TP.borderColor) {
    return new EdgeShape(color, this.mapCont.infCont); // slightly darker
  }


  initialRegions() {
    // borders from river splits are installed
    const splits = [[4, 5, 1], [4, 6, 2], [3, 5, 3]] as RegionElt[];
    this.regions = this.findRegions(this.hexAry, splits);
  }

  addTerrain() {
    // add Rivers: (one growing shape.graphics)
    AnkhMap.fspec.forEach(spec => this.setTerrain(spec, 'f'));
    AnkhMap.dspec.forEach(spec => this.setTerrain(spec, 'd'));
    AnkhMap.wspec.forEach(spec => this.setTerrain(spec, 'w'));
    AnkhMap.wspec.forEach(spec => ([r, c]: hexSpec) => {
      const hex = this[r][c];
      Object.keys(hex.links).forEach((dir: HexDir) => {
        const ohex = hex.links[dir];
        if (ohex.terrain !== 'w') this.addBorder(hex, dir, false); // one-way border: Apep can exit
      });
    });
  }

  addRiverSplits() {
    AnkhMap.rspec.forEach(spec => this.addSplit(spec));        // after marking water!
  }

  noRegions(hexAry = this.hexAry) {
    hexAry.forEach(hex => hex.regionId = undefined);
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
        if (hex.borders[dir]) return;          // not semantically adjacent
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
      const region = [], rid = rids[rndx];
      regions[rndx] = region;
      if (!hex) return;   // bad seed
      if (hex.regionId !== undefined) return; // already done; seeds not distinct!
      if (setRegion(hex, region, rid)) return; // water seed! single hex in region...
      addNeighbors(hex, region, rid);
    });
    console.log(stime(this, `.findRegions: [${seeds}, ${rids}] found:`), regions.map(r => r.concat()));
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
    return this.regions.findIndex(r => r?.includes(hex));
  }
  /** debug aid: return array of {r.Aname, r.index, r.length} */
  regionList(regions = this.regions) {
    return regions.map((r, i) => { return { r: r && r['Aname'], i: i+1, l: r?.length ?? -1 } })
  }

  battleOrder: number[] = [];
}
