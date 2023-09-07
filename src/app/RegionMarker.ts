import { C, DragInfo, XY } from "@thegraid/easeljs-lib";
import { AnkhHex, AnkhMap, RegionId } from "./ankh-map";
import { Hex2 } from "./hex";
import { Player } from "./player";
import { CenterText, PaintableShape, PolyShape } from "./shapes";
import { TP } from "./table-params";
import { Tile } from "./tile";
import { Table, DragContext } from "./table";
import { Text } from "@thegraid/easeljs-module";

/** a Tile, but it lives on markCont !! */

export class RegionMarker extends Tile {
  override get radius() { return TP.ankh1Rad; }
  override makeShape(): PaintableShape {
    return new PolyShape(4, 0, 'rgba(40,40,40,.7)', this.radius, C.WHITE);
  }
  idText: Text;
  hexMap: AnkhMap<AnkhHex>;
  constructor(public table: Table, public regionId = 1 as RegionId, Aname = `Region=${regionId}`) {
    super(Aname);
    this.hexMap = table.hexMap as AnkhMap<AnkhHex>;
    const txt = this.idText = new CenterText(`${regionId}`, this.radius, C.WHITE);
    this.baseShape.paint();
    const rad = this.radius;
    this.setBounds(-rad, -rad, 2 * rad, 2 * rad);
    this.addChild(txt);
  }
  override setPlayerAndPaint(player: Player): this {
    return this;
  }
  override isLegalTarget(toHex: AnkhHex, ctx?: DragContext): boolean {
    if (this.regionId > this.hexMap.regions.length) return false;
    if (!this.gamePlay.isPhase('Swap')) {
      ctx.nLegal = 1;
      return false;
    } else {
      if (!toHex || !toHex.isOnMap) return false;
      return this.gamePlay.gameState.ankhMapSplitter.isLegalSwap(toHex, ctx);
    }
  }
  override isLegalRecycle(ctx: DragContext): boolean {
    return false;
  }

  readonly lastXY: XY = { x: 500, y: 500 }; // <--- a bit like targtHex
  override dragFunc0(legalHex: AnkhHex, ctx: DragContext): void {
    const swap = ctx.phase === 'Swap';
    const hex = this.hexMap.hexUnderObj(this, swap);
    const legalXY = !!hex && hex.isOnMap && (swap ? hex.terrain !== 'w' : this.hexMap.regions[this.regionId - 1]?.includes(hex));
    const srcCont = (ctx.info as DragInfo).srcCont;

    if (ctx?.info.first) {
    }
    if (this.regionId > this.hexMap.regions.length) {
      this.table.dragger.stopDrag();
      return;
    } else if (legalXY) {
      ctx.targetHex = hex;
      // record location in original parent coordinates:
      this.parent.localToLocal(this.x, this.y, srcCont, this.lastXY);
      if (swap) {
        this.showTargetMark(legalHex, ctx); // set ctx.target and showMark()
      }
    } else {
      // keep this at lastXY (in dragCont coordinates):
      srcCont.localToLocal(this.lastXY.x, this.lastXY.y, this.parent, this);
    }
    return;
  }
  override dropFunc(targetHex: Hex2, ctx: DragContext): void {
    const hex = targetHex as AnkhHex;
    if (!(ctx.phase === 'Swap')) { return; }
    if (!hex) return;
    const regionA = this.regionId, regionB = hex.regionId;
    if (regionA !== regionB) {
      this.swapRegions(regionA, regionB);
    }
    return;
  }

  /** marker(ra=4, '4') has moved into region of marker(rb=1, '1') */
  swapRegions(ra: RegionId, rb: RegionId) {
    const table = this.table, hexMap = this.hexMap, regions = hexMap.regions;
    const ndxa = ra - 1, ndxb = rb - 1;
    const ma = table.regionMarkers[ndxa], mb = table.regionMarkers[ndxb];

    const xregion = regions[ndxa];
    regions[ndxa] = regions[ndxb];
    regions[ndxb] = xregion;
    hexMap.setRegionId(ra); // the original (1) is now in slot (4); set the district/RegionId
    hexMap.setRegionId(rb); // the original (4) is now in slot (1); set the district/RegionId

    mb.x = ma.x; mb.y = ma.y;
    // the marker for RegionB ('1') now in same location as marker for RegionA ('4')
    // move ma '4' to its center of regionB
    table.setRegionMarker(rb); // Swap: move ma to center of rb
    const mb2 = table.regionMarkers[rb - 1];
    mb2.lastXY.x = mb2.x; mb2.lastXY.y = mb2.y; // using srcCont coords!
    hexMap.update();
  }
}
