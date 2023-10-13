import { Arrays_intersect, C, XY, stime } from "@thegraid/common-lib";
import { DragInfo } from "@thegraid/easeljs-lib";
import { DisplayObject } from "@thegraid/easeljs-module";
import { RegionMarker } from "./RegionMarker";
import { AnkhHex, RegionId } from "./ankh-map";
import { GamePlay } from "./game-play";
import { GameState, SplitterShape } from "./game-state";
import { EwDir, H, HexDir, NsDir } from "./hex-intfs";
import { RegionElt, SplitDir, SplitSpec } from "./scenario-parser";
import { CircleShape, EdgeShape } from "./shapes";
import { DragContext, Table } from "./table";
import { TP } from "./table-params";
import { Tile } from "./tile";

export class AnkhMapSplitter {
  isLegalSwap(toHex: AnkhHex, ctx: DragContext): boolean {
    const marker = ctx.tile as RegionMarker;
    if (marker.regionId > this.gamePlay.hexMap.regions.length) return false;
    if (!toHex || toHex.terrain === 'w') return false;
    return true;
  }

  constructor (public gameState: GameState) {
    this.gamePlay = gameState.gamePlay;
    this.table = gameState.table;
  }
 gamePlay: GamePlay; table: Table;

  splitShape: SplitterShape;
  splitMark: CircleShape;
  makeSplitShape(markRad: number) {
    const hexMap = this.gamePlay.hexMap;
    const mapCont = hexMap.mapCont;
    this.splitShape = new SplitterShape();
    this.splitShape.paint(TP.splitColor);
    this.splitShape.visible = true;
    mapCont.tileCont.addChild(this.splitShape);
    this.splitMark = new CircleShape(C.grey, markRad * 1.5, '');
    mapCont.markCont.addChild(this.splitMark);
    this.lineShape = hexMap.edgeShape(TP.splitColor);
    this.pathShape = hexMap.edgeShape(TP.splitColor);
  }
  lineShape: EdgeShape; // singleton: rubberband, follow the mouse
  pathShape: EdgeShape; // singleton: extend graphics to show each selected edge

  runSplitShape() {
    const hexMap = this.gamePlay.hexMap, hexCont = hexMap.mapCont.hexCont;
    const rad = TP.hexRad, r = rad / 4, rangeSq = (rad + 2 * r) * (rad + 2 * r);
    if (!this.splitShape) this.makeSplitShape(r);
    hexMap.regions.filter(r => r.length > 12).forEach((region, ndx) => hexMap.showRegion(ndx, 'rgba(240,240,240,.4'))
    const mark = this.splitMark;
    const dragger = this.table.dragger;
    const pn = (n: number) => n.toFixed(2);
    const cornerId = (hex: AnkhHex, ewDir: EwDir) => {
      const xy = hex.cornerXY(ewDir)
      const mxy = hex.cont.localToLocal(xy.x, xy.y, hex.cont.parent.parent);
      return `@[${mxy.x.toFixed(1)}${mxy.y.toFixed(1)}]` // unique point identifier.
    }
    const pc = ([hex, dir]) => `${hex.Aname}-${dir}${cornerId(hex, dir)}`;

    let target: { mx: number, my: number, hex: AnkhHex, ewDir: EwDir, cxy: XY, cid: string } = undefined;
    const path = [] as (typeof target)[];
    const pathShape = this.pathShape; // real segment, on Path
    const lineShape = this.lineShape; // temp segment, pathN to mouse.
    pathShape.reset(); lineShape.reset();
    pathShape.visible = lineShape.visible = true;

    const inRangeOf = (cx, cy, base = path[0]) => {
      const pn = (n: number) => n.toFixed(2);
      const { mx, my } = path[0];
      const d2 = (mx - cx) * (mx - cx) + (my - cy) * (my - cy);
      return (d2 < rangeSq);
    }

    const doLine = (lx, ly) => {
      lineShape.reset();
      if (path[0]) {
        lineShape.graphics.mt(path[0].mx, path[0].my).lt(lx, ly);
      }
      hexMap.update();
    }
    const noMark = () => {
      mark.visible = false;
      target = undefined;
    }


    const dragFunc = (splitShape: Tile, ctx: DragInfo) => {
      const hex = this.table.hexUnderObj(splitShape, false);
      const pt = splitShape.parent.localToLocal(splitShape.x, splitShape.y, hexCont); // mouse (on mapCont)

      const isTerminal = (hex: AnkhHex, ewDir: EwDir, cid: string, n = 1) => {
        // count exits from given corner: is hex, is !water, & no border fro
        // count hexes adjacent to corner [hex,ewDir]: excludes hex, & water
        const adjHexes = hex.cornerAdjHexes(ewDir).filter(([chex, ewDir]) => chex.terrain !== 'w' && !!hex.canEnter(chex) );
        return adjHexes.length === n;
      }

      let lx = pt.x, ly = pt.y;
      if (hex instanceof AnkhHex) {
        const [hexDir, xy] = hex.cornerDir(pt, undefined, H.ewDirs), ewDir = hexDir as EwDir;
        const onCorner = hex.isNearCorner(xy, ewDir, r);
        const cid = onCorner && cornerId(hex, ewDir);
        if (!H.ewDirRot[ewDir]) {
          noMark();
          doLine(lx, ly);
          return; // not EwDir --> not onTarget
        }
        if (!path[0]) {
          // check legal start:
          if (hex.terrain === 'w') return;
          if (!isTerminal(hex, ewDir, cid)) {
            doLine(lx, ly); // line, no mark, onCorner or not...
            return;
          }
        }
        if (onCorner && path.length > 1) {
          if (path.slice(1).find(({ cid: pcid }) => pcid === cid)) {
            doLine(lx, ly); // no going back beyond the last mark.
            return;
          }
        }
        if (path.length > 0 && isTerminal(path[0].hex, path[0].ewDir, path[0].cid) && isTerminal(hex, ewDir, cid, 0)) {
          doLine(lx, ly);  // no more after reaching a terminal.
          return;
        }
        if (path.length > 6) {
          doLine(lx, ly);  // too long, need to start again.
          return;
        }
        // if not adj to path[0] then not a target
        const inRange = !path[0] || inRangeOf(pt.x, pt.y, path[0]);
        if (!inRange) {
          doLine(lx, ly);
          return;
        }

        if (true || inRange) {
          const cxy = hex.cornerXY(ewDir);
          hex.cont.localToLocal(cxy.x, cxy.y, mark.parent, mark); // mark.x, mark.y: corner (on mapCont)
          mark.visible = onCorner;
          target = onCorner ? { hex: hex, ewDir, mx: mark.x, my: mark.y, cxy, cid } : undefined;
          if (onCorner) { lx = mark.x, ly = mark.y } // snap to corner if on target;
        }
      }
      doLine(lx, ly);
    }
    // click:
    const dropFunc = (splitShape: DisplayObject, ctx: DragInfo) => {
      if (target) {
        if (path[0]?.cid === target.cid) {
          if (path.length > 1) finalize();
          return;
        }
        if (!path[0]) pathShape.graphics.mt(target.mx, target.my);
        else pathShape.graphics.lt(target.mx, target.my);
        path.unshift(target);
        lineShape.reset();
      } else {
        // clear and reset path
        path.length = 0;
        pathShape.reset();
        lineShape.reset();
      }
      dragSplitter(); // keep going...
    }
    let seed: AnkhHex;
    const finalize = () => {
      // midAngle of two ewDirs as nsDirRot: [0, 60, 120, ... 240, 300, 0] => [30, 90, 150, ... 330]
      // ewAngle would use ewDirRot
      // (Math.abs(a0 - a1) < 90) ? (a0 + a1) / 2 : 180 + (a0 + a1) / 2;
      const midAngle = (dir0: HexDir, dir1: HexDir) => {
        const a0 = H.dirRot[dir0], a1 = H.dirRot[dir1];
        return (Math.abs(a0 - a1) <= 180) ? (a0 + a1) / 2 : ((360 + a0 + a1) / 2) % 360;
        //return Math.abs(a0 - a1) < 300 ? Math.min(a0, a1) + 30 : (Math.max(a0, a1) + 30) % 360;
      }
      const nsDirOfAngle = (nsAngle: number) => H.nsDirs.find((value) => H.nsDirRot[value] === nsAngle);
      const nsDirOfEwDirs = (ewDir0: EwDir, ewDir1: EwDir) => {
        return nsDirOfAngle(midAngle(ewDir0, ewDir1))
      }

      console.log(stime(this, `.finalize: ------------------`), path.map(({ hex, ewDir }, n) => `${n}: ${pc([hex,ewDir])}`));
      lineShape.visible = pathShape.visible = false;
      this.table.dragger.stopDrag();
      this.table.dragger.stopDragable(this.splitShape);
      this.splitShape.visible = this.splitMark.visible = false;
      dragger.stopDragable(this.splitShape);

      // for corner[n: hexn, ewDir] find corner[n+1] on same hex
      const splits = path.map(({ hex: hex1, ewDir: ewDir1 }, n, ary) => {
        if (n == 0) return undefined as [AnkhHex, NsDir];
        let { hex: hex0, ewDir: ewDir0 } = ary[n - 1];
        let [hexU, ewDirU] = [hex0, ewDir0];
        if (hexU !== hex1) {
          // [hex1,ewDir1] is same corner as [hex0,ewDirQ] need to find ewDirQ:
          // there are 2 corners on the segment: [hex0, ewDir0] & [hex1, ewDir1];
          // there are 2 hexes common to both points, may be neither hex0 nor hex1;
          // need to find one of the common hexes, and the ewDirs to each corner.
          const c0adj = hex0.cornerAdjHexes(ewDir0); c0adj.unshift([hex0, ewDir0]);
          const c1adj = hex1.cornerAdjHexes(ewDir1); c1adj.unshift([hex1, ewDir1]);
          const inter = Arrays_intersect(c1adj, c0adj, ([hex, ewdir]) => hex); // elts of c1adj
          // expect 1 or 2 common elements:
          const [hexC1, ewDirC1] = inter[0];
          const [hexC0, ewDirC0] = c0adj.find(([hexC0, dir]) => hexC0 === hexC1); // elts of c0adj
          hexU = hexC1;
          ewDir1 = ewDirC1;
          ewDirU = ewDirC0;
          const nsDir = nsDirOfEwDirs(ewDirU, ewDir1);
          if (!nsDir) debugger;
        }
        const nsDir = nsDirOfEwDirs(ewDirU, ewDir1);
        if (!nsDir) debugger;
        // hexU.addEdge(nsDir, TP.borderColor);
        seed = hexU; // it has an edge, must be a real hex.
        return [hexU, nsDir] as [AnkhHex, NsDir];
      });
      const { row, col } = seed, rid = hexMap.regions.length + 1 as RegionId;
      const splitBid = [row, col, rid, false];    // false => TP.edgeColor vs TP.riverColor
      const splitDirs = splits.slice(1).map(([hex, nsDir]) => [hex.row, hex.col, nsDir] as SplitDir);
      const splitSpec = [splitBid, ...splitDirs] as SplitSpec;
      const [rid1, rid2] = hexMap.addSplit(splitSpec, true);
      this.table.setRegionMarker(rid1);  // runSplitter.finalize
      this.table.setRegionMarker(rid2);   // runSplitter.finalize
      hexMap.regions.forEach((region, ndx) => hexMap.showRegion(ndx)); // remove highlight
      hexMap.update();
      this.checkRegionSizes(rid1, rid2, 'Swap');
    }

    const dragSplitter = () => {
      this.splitShape.visible = this.splitShape.mouseEnabled = true;
      dragger.dragTarget(this.splitShape, { x: 0, y: 0 });
    }
    dragger.makeDragable(this.splitShape, this, dragFunc, dropFunc);
    dragger.clickToDrag(this.splitShape);
    dragSplitter();
  }

  checkRegionSizes(rid1: RegionId, rid2: RegionId, nextPhase: string) {
    const hexMap = this.gamePlay.hexMap;
    const l1 = hexMap.regions[rid1 - 1]?.filter(h => h.terrain !== 'w').length ?? 0;
    const l2 = hexMap.regions[rid2 - 1]?.filter(h => h.terrain !== 'w').length ?? 0;
    const OhWell = () => this.gameState.phase(nextPhase);
    const UndoIt = () => this.removeLastSplit('Split');
    if (l1 < 6 || l2 < 6) {
      this.gameState.panel.areYouSure(`Region is too small`, OhWell, UndoIt);
      return;
    }
    this.gameState.phase(nextPhase);
  }

  removeLastSplit(nextPhase: string) {
    const hexMap = this.gamePlay.hexMap;
    const splitsX = this.gamePlay.hexMap.splits.slice(2); // not the rivers!
    const splitSpec = splitsX.pop();
    // const splitN = splitSpec[0] as SplitBid;
    // const [row, col, bid] = splitN, hex0 = hexMap[row][col];
    // const ri = hexMap.regionIndex(row, col, hex0);
    let hex1: AnkhHex, hex2: AnkhHex;
    const splitD = splitSpec.slice(1);
    splitD.forEach(([row, col, dir])  => {
      const hex = hexMap[row][col], rDir = H.dirRev[dir];
      const edge = hexMap.mapCont.infCont.removeChildType(EdgeShape, (es) => (es.hex === hex) && (es.dir === dir));
      hex.cont.updateCache();
      hex1 = hex;  // save for seeds to merge.
      hex2 = hex.links[dir];
      delete hex1.borders[dir];
      delete hex2.borders[rDir];
    })
    // move region of last split to last slot in regions;
    const rid1a = hex1.regionId, rid2a = hex2.regionId, ridN = hexMap.regions.length as RegionId;
    const [rid1, rid2] = (rid1a < rid2a) ? [rid1a, rid2a] : [rid2a, rid1a];
    const rm1 = this.table.regionMarkers[rid1 - 1];
    const r1 = hexMap.regions[rid1 - 1];
    const r2 = hexMap.regions[rid2 - 1];

    for (let ridS = rid2; ridS < ridN; ridS++) {
      rm1.swapRegions(ridS, ridS + 1 as RegionId); // ripple to the end of the list.
    }
    // now the r2 is in slot ridN; suitable to be pop'd
    const oldR = hexMap.regions.pop();
    if (oldR !== r2) debugger;   // Assert (oldR === r2)
    const mergedR = r1 ? r1.concat(r2) : r2.concat();
    const regionElt = [r1[0].row, r1[0].col, rid1] as RegionElt;
    const newRs = hexMap.findRegions(mergedR, [regionElt]);      // newRs[0] is (r1 + r2)
    hexMap.regions[rid1 - 1] = newRs[0];
    hexMap.setRegionId(rid1);  // maybe unnecessary; findRegions should set everything; but Water!
    const rmN = this.table.regionMarkers[ridN - 1];
    rmN.x = rmN.y = 0; // TODO ??
    hexMap.update();
    this.gameState.phase(nextPhase);
  }

  newRegionIds = [];
  swapRegionId = undefined;

  runSwap() {
    // inPhase('Swap'); RegionMarkers can be moved
    // either newRegionId can be moved to anywhere.
    // when newRegionId is dropped in another region (not in newRegionId)
    // then that target destination becomes 'swapRegionId'
    // if swapRegionId is already set, unMove() to get it back to 'startHex'
    // associate the new 'swapRegionId' to the 'empty' region (the drop marker's startHex->regionId)
    // and swap the regions.
    // if a newRegion is dropped in the other newRegion, just swap them.
  }

}
