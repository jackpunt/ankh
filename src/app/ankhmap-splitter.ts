import { C, XY, stime } from "@thegraid/common-lib";
import { DragInfo } from "@thegraid/easeljs-lib";
import { DisplayObject } from "@thegraid/easeljs-module";
import { AnkhHex, RegionId } from "./ankh-map";
import { SplitDir, SplitSpec } from "./ankh-scenario";
import { Arrays_intersect } from "./functions";
import { GameState, SplitterShape } from "./game-state";
import { EwDir, H, HexDir, NsDir } from "./hex-intfs";
import { CircleShape, EdgeShape } from "./shapes";
import { TP } from "./table-params";
import { Tile } from "./tile";
import { GamePlay } from "./game-play";
import { Table } from "./table";

export class AnkhMapSplitter {
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
  lineShape: EdgeShape;
  pathShape: EdgeShape;

  runSplitShape() {
    const hexMap = this.gamePlay.hexMap, hexCont = hexMap.mapCont.hexCont;
    const rad = TP.hexRad, r = rad / 4, rad2 = rad*rad*1.1;
    if (!this.splitShape) this.makeSplitShape(r);
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
    let pathN: typeof target = undefined; // the final element of path
    const pathShape = this.pathShape; // real segment, on Path
    const lineShape = this.lineShape; // temp segment, pathN to mouse.
    pathShape.reset(); lineShape.reset();
    pathShape.visible = lineShape.visible = true;

    const inRangeOf = (cx, cy, base = path[0]) => {
      const pn = (n: number) => n.toFixed(2);
      const { mx, my } = path[0];
      const d2 = (mx - cx) * (mx - cx) + (my - cy) * (my - cy);
      return (d2 < rad2);
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
        const { x: hx, y: hy, hexDir } = hex.cornerDir(pt), ewDir = hexDir as EwDir;
        if (!H.ewDirRot[ewDir]) {
          noMark();
          doLine(lx, ly);
          return; // not onTarget
        }
        // isNearCorner(hex, ewDir, r)
        const onCorner = hex.isNearCorner({ x: hx, y: hy }, ewDir, r)
        const { x: cx, y: cy } = hex.cornerXY(ewDir);
        const cid = onCorner && cornerId(hex, ewDir);

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
        // if not adj to path[0] then not a target
        const inRange = !path[0] || inRangeOf(pt.x, pt.y, path[0]);
        if (!inRange) {
          doLine(lx, ly);
          return;
        }

        if (true || inRange) {
          hex.cont.localToLocal(cx, cy, mark.parent, mark);        // mark.x, mark.y: corner (on mapCont)
          mark.visible = onCorner;
          target = onCorner ? { hex: hex, ewDir, mx: mark.x, my: mark.y, cxy: { x: cx, y: cy }, cid } : undefined;
          if (onCorner) { lx = mark.x, ly = mark.y } // snap to corner if on target;
        }
      }
      doLine(lx, ly);
    }
    // click:
    const dropFunc = (dispObj: DisplayObject, ctx: DragInfo) => {
      if (target) {
        if (path[0]?.hex === target.hex && path[0]?.ewDir === target.ewDir) {
          finalize()  // TODO return to normal, process path.
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
      dragSplitter();
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
        if (hex1 !== hex0) {
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
          hex0 = hexC1; ewDir1 = ewDirC1; ewDir0 = ewDirC0;
        }
        const nsDir = nsDirOfEwDirs(ewDir0, ewDir1);
        hex0.addEdge(nsDir, TP.borderColor)
        seed = hex0; // it has an edge, must be a real hex.
        return [hex0, nsDir] as [AnkhHex, NsDir];
      });
      const { row, col } = seed, rid = hexMap.regions.length + 1 as RegionId;
      const splitBid = [row, col, rid, false];    // false => TP.edgeColor vs TP.riverColor
      const splitDirs = splits.slice(1).map(([hex, nsDir]) => [hex.row, hex.col, nsDir] as SplitDir);
      const splitSpec = [splitBid, ...splitDirs] as SplitSpec;
      //hexMap.splits.push(splitSpec);
      const [origRid, newRid] = this.newRegionIds = hexMap.addSplit(splitSpec, true);
      this.table.setRegionMarker(origRid);
      this.table.setRegionMarker(newRid);
      hexMap.update();
      this.gameState.done([origRid, newRid]); // --> Swap:
    }
    const dragSplitter = () => {
      this.splitShape.visible = this.splitShape.mouseEnabled = true;
      dragger.dragTarget(this.splitShape, { x: 0, y: 0 });
    }
    dragger.makeDragable(this.splitShape, this, dragFunc, dropFunc);
    dragger.clickToDrag(this.splitShape);
    dragSplitter();
  }
  newRegionIds = [];
}
