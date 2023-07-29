import { C, Constructor, KeyBinder, RC, S } from "@thegraid/easeljs-lib";
import { Graphics, Shape } from "@thegraid/easeljs-module";
import { H, HexDir } from "./hex-intfs";
import { HexShape } from "./shapes";
import { HexConstructor, Hex2, Hex, HexMap, HexMark } from "./hex";
import { TP } from "./table-params";
import { God } from "./god";

export class SquareMap<T extends Hex> extends HexMap<T> {
  constructor(radius: number = TP.hexRad, addToMapCont = false, hexC?: HexConstructor<T>) {
    super(radius, addToMapCont, hexC);
    this.topo = this.nsTopo;
  }

  override makeAllDistricts(nh = TP.nHexes, mh = TP.mHexes): T[] {
    if (false && this.topo === this.ewTopo) return super.makeAllDistricts();
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
  regionId: number;
  overlay: HexShape;
  get piece() { return this.tile ?? this.meep }

  override makeHexShape(shape?: Constructor<HexShape>): HexShape {
    if (!this.overlay) this.overlay = new HexShape(); // for showRegion()
    this.overlay.paint('rgba(250,250,250,.3)');
    this.overlay.visible = false;
    this.cont.addChild(this.overlay);
    return super.makeHexShape(shape ?? AnkhHexShape);
  }
    /** search each Hex linked to this. */
    findAdjHex(pred: (hex: this, dir: HexDir, hex0: this) => boolean) {
      return this.linkDirs.find((dir: HexDir) => !this.borders[dir] && pred(this.links[dir], dir, this));
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
  static rspec: hexSpecr[] = [
    [1, 0, 'NE', 'SE'], [2, 0, 'NE'], [2, 1, 'N', 'NE'], [3, 2, 'N', 'NE'], [3, 3, 'N', 'NE'], [4, 4, 'N', 'NE'],
    [4, 5, 'N', 'NE', 'SE'],
    [4, 6, 'NW', 'N'], [3, 7, 'NW', 'N'], [3, 8, 'NW', 'N'], [2, 9, 'NW', 'N'], [2, 10, 'NW'],
    [5, 5, 'NE', 'SE', 'S'], [6, 5, 'SW'], [7, 5, 'NW', 'SW'], [8, 5, 'NW', 'SW'],
  ];
  static tColor = { d: '#ffe599', f: '#93c47d', w: '#a4c2f4' };

  regions: AnkhHex[][];
  adjRegions: Map<number,number>;

  constructor(radius?: number, addToMapCont?: boolean, hexC?: HexConstructor<T>) {
    super(radius, addToMapCont, hexC ? AnkhHex as any as HexConstructor<T> : hexC);
    this.bindKeys();
  }

  bindKeys() {
    KeyBinder.keyBinder.setKey('C-l', {
      thisArg: this, func: () => {
        this.noRegions();
        this.findRegions();
        this.showRegions();
      }
    });
    KeyBinder.keyBinder.setKey('l', { thisArg: this, func: () => this.showRegions() });
    KeyBinder.keyBinder.setKey('L', {
      thisArg: this, func: () => {
        this.noRegions();
        this.hexAry.forEach(hex => { hex.overlay.visible = false; hex.cont.updateCache() })
        this.update();
      }
    });
    KeyBinder.keyBinder.setKey('M-l', {
      thisArg: this, func: () => {
        this.noRegions();
        const seedAry = [[3, 0], [4, 6], [0, 2]].map(([r, c]) => this[r][c])
        const [regions] = this.findRegions(seedAry);
        this.showRegions();
      }
    });
  }

  override addToMapCont(hexC?: Constructor<T>): this {
    return super.addToMapCont(hexC ?? AnkhHex as any as HexConstructor<T>);
  }

  override makeAllDistricts(nh?: number, mh?: number) {
    const rv = super.makeAllDistricts(nh, mh);
    this.addTerrain();
    const [regions, adjRegions]= this.findRegions(this.hexAry);
    this.regions = regions;
    this.adjRegions = adjRegions;
    return rv;
  }

  setTerrain([r, c]: hexSpec, terrain: Terrain, color = AnkhMap.tColor[terrain]) {
    const hex = this[r][c];
    hex.terrain = terrain;
    const hexShape = hex.hexShape;
    hexShape.paint(color);
    hex.cont.updateCache();
  }

  addBorder(hex: AnkhHex, dir: HexDir, sym = true) {
    if (sym) {
      hex.borders[dir] = true;
    }
    const oHex = hex.links[dir], rdir = H.dirRev[dir];
    oHex && (oHex.borders[rdir] = true); // testing with ewTopo does not find oHex.
  }

  addRiver([row, col, ...e]: hexSpecr, rshape: Shape) {
    const hex = this[row][col], x = hex.x, y = hex.y, r = hex.radius;
    e.forEach((dir: HexDir) => {
      // 0-degrees is North
      const a = H.nsDirRot[dir], a0 = a - 30, a1 = a + 30;
      const x0 = x + r * Math.sin(a0 * H.degToRadians);
      const y0 = y - r * Math.cos(a0 * H.degToRadians);
      const x1 = x + r * Math.sin(a1 * H.degToRadians);
      const y1 = y - r * Math.cos(a1 * H.degToRadians);
      rshape.graphics.mt(x0, y0).lt(x1, y1);
      this.addBorder(hex, dir);
    });
  }

  addTerrain() {
    // add Rivers:
    const rshape = new Shape(new Graphics().ss(12, 'round', 'round').s('#90b2f4')); // slightly darker
    AnkhMap.rspec.forEach(spec => this.addRiver(spec, rshape));
    this.mapCont.infCont.addChild(rshape);
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

  noRegions(hexAry = this.hexAry) {
    hexAry.forEach(hex => hex.regionId = undefined);
  }
  findRegions(hexAry = this.hexAry): [AnkhHex[][], Map<number, number>,] {
    const regions: AnkhHex[][] = []; // each element is AnkhHex[];
    const metaMap = new Map<number, number>();
    let avisit = 0;
    const setRegion = (hex: AnkhHex, regionId: number) => {
      hex.regionId = regionId;
      hex.Avisit = avisit++;
      regions[regionId].push(hex)
    }
    const addNeighbors = (hex: AnkhHex, region: AnkhHex[], id) => {
      hex.forEachLinkHex((nhex: AnkhHex, dir: HexDir) => {
        if (nhex.terrain === 'w') return;        // not member of any region
        if (nhex.regionId !== undefined) {
          if (nhex.regionId !== id) {
            metaMap.set(id, nhex.regionId);     // regions are adjacent
            metaMap.set(nhex.regionId, id);     // regions are adjacent
          }
          return;
        }
        if (hex.borders[dir]) return;          // not semantically adjacent
        setRegion(nhex, id);
        addNeighbors(nhex, region, id);
      });
    }
    this.noRegions(hexAry);
    hexAry.forEach(hex => {
      // put hex and its adjacent neighbors in the same region;
      if (hex.regionId !== undefined) return; // already done
      if (hex.terrain === 'w') return;        // not member of any region
      const region = [], id = regions.length;
      regions.push(region);
      addNeighbors(hex, region, id);
    });
    return [regions, metaMap];
  }

  showRegions(hexAry = this.hexAry, colors = God.allGods.map(g => g.color)) {
    hexAry.forEach(ahex => {
      if (ahex.regionId !== undefined) {
        ahex.overlay.paint(C.nameToRgbaString(colors[ahex.regionId % colors.length], .4))
        ahex.overlay.visible = true;
        ahex.cont.updateCache();
      }
    })
    this.update();
  }

  showRegion(regionId = 0, colors = God.allGods.map(g => g.color)) {
    const region = this.regions[regionId], color = C.nameToRgbaString(colors[regionId % colors.length], .4);
    region.forEach(ahex => {
      ahex.overlay.paint(color);
      ahex.overlay.visible = true;
      ahex.cont.updateCache();
    });
    this.update();
  }

  identCells() {
    this.forEachHex(hex => {
      const h2 = (hex as any as Hex2);
      const hc = h2.cont;
      hc.mouseEnabled = true;
      hc.on(S.click, () => {
        h2.isLegal = !h2.isLegal;
        this.update();
      });
    });
    KeyBinder.keyBinder.setKey('x', {
      func: () => {
        const cells = this.filterEachHex(hex => hex.isLegal);
        const list = cells.map(hex => `${hex.rcs},`);
        console.log(''.concat(...list));
      }
    });
  }
}
