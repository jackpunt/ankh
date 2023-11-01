import { AT, C, Constructor, Dragger, DragInfo, F, KeyBinder, S, ScaleableContainer, stime, XY } from "@thegraid/easeljs-lib";
import { Container, DisplayObject, EventDispatcher, Graphics, MouseEvent, Shape, Stage, Text } from "@thegraid/easeljs-module";
import { AnkhSource, Guardian, Monument } from "./ankh-figure";
import { AnkhHex, AnkhMap, RegionId } from "./ankh-map";
import { ClassByName } from "./class-by-name";
import { type GamePlay } from "./game-play";
import type { GameState } from "./game-state";
import { AnkhMarker } from "./god";
import { Hex, Hex2, HexMap, IHex } from "./hex";
import { H, XYWH } from "./hex-intfs";
import { Player } from "./player";
import { PlayerPanel } from "./player-panel";
import { RegionMarker } from "./RegionMarker";
import { ActionIdent, MapXY, Scenario } from "./scenario-parser";
import { CenterText, CircleShape, HexShape, PaintableShape, RectShape, UtilButton } from "./shapes";
import { PlayerColor, playerColor0, playerColor1, TP } from "./table-params";
import { Tile } from "./tile";
import { TileSource } from "./tile-source";
//import { TablePlanner } from "./planner";

function firstChar(s: string, uc = true) { return uc ? s.substring(0, 1).toUpperCase() : s.substring(0, 1) };

export type EventName = 'Claim' | 'Split' | 'Conflict' | 'merge' | 'redzone';
export interface ActionButton extends Container { isEvent: boolean, pid: number, rollover?: ((b: ActionButton, over: boolean) => void) }
interface EventIcon extends Container { eventName: EventName, pid: number; special: 'merge' | 'redzone' }
interface ScoreMark extends RectShape { score: number, rank: number }

export interface Dragable {
  dragFunc0(hex: Hex2, ctx: DragContext): void;
  dropFunc0(hex: Hex2, ctx: DragContext): void;
}

/** rowCont is an ActionContainer; children are EventButton. */
export class ActionContainer extends Container {
  readonly buttons: ActionButton[] = [];
  constructor(public rad = 30, public table: Table) {
    super();
    this.highlight = new CircleShape(C.WHITE, this.rad + 5, '');
    this.highlight.name = `highlight`;
    this.addChildAt(this.highlight, 0);
    this.highlight.visible = true;
  }
  highlight: PaintableShape;
  active: ActionButton; // most recently activated button
  /** just the Buttons, ignore the highlight Shape. */
  //get buttons() { return this.children.filter(c => (c instanceof Container)) as ActionButton[] }
  addButton(button: ActionButton) {
    this.addChild(button);
    this.buttons.push(button);
  }
  getButton(cn: number) {
    return this.buttons[cn];
  }

  get nextButton() { return this.buttons.find(button => !button.children.find(c => (c instanceof AnkhMarker))) }
  resetToFirstButton() {
    this.buttons.forEach(b => b.removeChildType(AnkhMarker));
    return this.buttons[0];
  }
  /** activate the first button without an AnkhMarker OR reset to first button (after Event) */
  activate() {
    const hl = this.highlight;
    const button = this.nextButton ?? this.resetToFirstButton(); // reset after Event!
    const rowCont = button.parent as ActionContainer; // === this !!!
    hl.paint(C.WHITE);
    hl.x = button.x;
    hl.y = button.y;
    hl.visible = button.mouseEnabled = true;
    this.active = button;
    if (this.rollover) button.on('rollover', () => this.rollover(button, true), this);
    if (this.rollover) button.on('rollout', () => this.rollover(button, false), this);
    this.stage.update();
    return button;
  }

  deactivate() {
    if (this.active) {
      this.active.removeAllEventListeners('rollover');
      this.active.removeAllEventListeners('rollout');
      this.highlight.visible = this.active.mouseEnabled = false;
    }
    this.stage.update();
  }

  rollover: (button: ActionButton, over?: boolean) =>void;

  readonly gainText = (() => {
    const gt = new Container();
    gt.name = 'gainText';
    const bg = new Shape(new Graphics().f('rgba(240,240,240,.8').dc(0, 0, 15));
    const txt = new CenterText('0');
    gt.addChild(bg, txt);
    return gt;
  })();

  overGain(button: ActionButton, v: boolean) {
    const gt = this.gainText;
    if (v) {
      (gt.children[1] as Text).text = `${this.table.gamePlay.gameState.countCurrentGain()}`;
      // 'button' is not a Container, so add gainText to button's (ActionContaine) parent:
      button.localToLocal(TP.ankhRad, -TP.ankhRad, button.parent, gt);
      button.parent.addChild(gt);
      button.stage.update();
    } else {
      // remove gainText, so resetToFirstButton is not confused:
      gt.parent?.removeChild(gt);
      button.stage.update();
    }
  }


}
interface ScoreShape extends Shape {
  color: string;
}

/** to own file... */
class TablePlanner {
  constructor(gamePlay: GamePlay) {}
}
interface StageTable extends Stage {
  table: Table;
}

type MinDragInfo = { first?: boolean, event?: MouseEvent };

export interface DragContext {
  targetHex: Hex2;      // last isLegalTarget() or fromHex
  lastShift: boolean;   // true if Shift key is down
  lastCtrl: boolean;    // true if control key is down
  info: MinDragInfo;    // we only use { first, event }
  tile: Tile;           // the DisplayObject being dragged
  nLegal?: number;      // number of legal drop tiles (excluding recycle)
  gameState?: GameState;// gamePlay.gameState
  phase?: string;       // keysof GameState.states
  regionId?: RegionId;  // during Battle
}

class TextLog extends Container {
  constructor(public Aname: string, nlines = 6, public size: number = 30, public lead = 3) {
    super()
    this.lines = new Array<Text>(nlines);
    for (let ndx = 0; ndx < nlines; ndx++) this.lines[ndx] = this.newText(`//0:`)
    this.addChild(...this.lines);
  }

  lines: Text[];
  lastLine = '';
  nReps = 0;

  height(n = this.lines.length) {
    return (this.size + this.lead) * n;
  }

  clear() {
    this.lines.forEach(tline => tline.text = '');
    this.stage?.update();
  }

  private newText(line = '') {
    const text = new Text(line, F.fontSpec(this.size));
    text.textAlign = 'left';
    text.mouseEnabled = false;
    return text;
  }

  private spaceLines(cy = 0, lead = this.lead) {
    this.lines.forEach(tline => (tline.y = cy, cy += tline.getMeasuredLineHeight() + lead))
  }

  log(line: string, from = '', toConsole = true) {
    line = line.replace('/\n/g', '-');
    toConsole && console.log(stime(`${from}:`), line);
    if (line === this.lastLine) {
      this.lines[this.lines.length - 1].text = `[${++this.nReps}] ${line}`;
    } else {
      this.removeChild(this.lines.shift());
      this.lines.push(this.addChild(this.newText(line)));
      this.spaceLines();
      this.lastLine = line;
      this.nReps = 0;
    }
    this.stage?.update();
    return line;
  }
}

/** layout display components, setup callbacks to GamePlay */
export class Table extends EventDispatcher  {
  static table: Table
  static stageTable(obj: DisplayObject) {
    return (obj.stage as StageTable).table
  }
  gamePlay: GamePlay;
  stage: Stage;
  bgRect: Shape
  hexMap: HexMap<Hex2>; // from gamePlay.hexMap

  undoCont: Container = new Container();
  undoShape: Shape = new Shape();
  skipShape: Shape = new Shape();
  redoShape: Shape = new Shape();
  undoText: Text = new Text('', F.fontSpec(30));  // length of undo stack
  redoText: Text = new Text('', F.fontSpec(30));  // length of history stack
  winText: Text = new Text('', F.fontSpec(40), 'green')
  winBack: Shape = new Shape(new Graphics().f(C.nameToRgbaString("lightgrey", .6)).r(-180, -5, 360, 130))

  dragger: Dragger

  overlayCont = new Container();
  constructor(stage: Stage) {
    super();
    this.overlayCont.name = 'overlay';
    // backpointer so Containers can find their Table (& curMark)
    Table.table = (stage as StageTable).table = this;
    this.stage = stage
    this.scaleCont = this.makeScaleCont(!!this.stage.canvas) // scaleCont & background
    this.scaleCont.addChild(this.overlayCont); // will add again at top/end of the list.
  }
  bagLog = new TextLog('bagLog', 1);    // show 1 line of bag contents
  turnLog = new TextLog('turnLog', 2);  // shows the last 2 start of turn lines
  textLog = new TextLog('textLog', TP.textLogLines); // show other interesting log strings.

  logTurn(line: string) {
    this.turnLog.log(line, 'table.logTurn'); // in top two lines
  }
  logText(line: string, from = '') {
    const text = this.textLog.log(`${this.gamePlay.turnNumber}: ${line}`, from || '***'); // scrolling lines below
    this.gamePlay.logWriter.writeLine(`// ${text}`);
    // JSON string, instead of JSON5 comment:
    // const text = this.textLog.log(`${this.gamePlay.turnNumber}: ${line}`, from); // scrolling lines below
    // this.gamePlay.logWriter.writeLine(`"${line}",`);
  }

  setupUndoButtons(xOffs: number, bSize: number, skipRad: number, bgr: XYWH, row = 10, col = -9) {
    const undoC = this.undoCont; undoC.name = "undo buttons"; // holds the undo buttons.
    undoC.name = `undoCont`;
    this.setToRowCol(undoC, row, col);
    const progressBg = new Shape(), bgw = 200, bgym = 140, y0 = 0; // bgym = 240
    const bgc = C.nameToRgbaString(TP.bgColor, .8);
    progressBg.graphics.f(bgc).r(-bgw / 2, y0, bgw, bgym - y0);
    undoC.addChildAt(progressBg, 0)
    this.enableHexInspector(30)
    this.dragger.makeDragable(undoC)
    if (true && xOffs > 0) return

    this.skipShape.graphics.f("white").dp(0, 0, 40, 4, 0, skipRad)
    this.undoShape.graphics.f("red").dp(-xOffs, 0, bSize, 3, 0, 180);
    this.redoShape.graphics.f("green").dp(+xOffs, 0, bSize, 3, 0, 0);
    this.undoText.x = -52; this.undoText.textAlign = "center"
    this.redoText.x = 52; this.redoText.textAlign = "center"
    this.winText.x = 0; this.winText.textAlign = "center"
    undoC.addChild(this.skipShape)
    undoC.addChild(this.undoShape)
    undoC.addChild(this.redoShape)
    undoC.addChild(this.undoText); this.undoText.y = -14;
    undoC.addChild(this.redoText); this.redoText.y = -14;
    let bgrpt = this.bgRect.parent.localToLocal(bgr.x, bgr.h, undoC)
    this.undoText.mouseEnabled = this.redoText.mouseEnabled = false
    let aiControl = this.aiControl('pink', 75); aiControl.x = 0; aiControl.y = 100
    let pmy = 0;
    undoC.addChild(aiControl)
    undoC.addChild(this.winBack);
    undoC.addChild(this.winText);
    this.winText.y = Math.min(pmy, bgrpt.y) // 135 = winBack.y = winBack.h
    this.winBack.visible = this.winText.visible = false
    this.winBack.x = this.winText.x; this.winBack.y = this.winText.y;
  }
  showWinText(msg?: string, color = 'green') {
    this.winText.text = msg || "COLOR WINS:\nSTALEMATE (10 -- 10)\n0 -- 0"
    this.winText.color = color
    this.winText.visible = this.winBack.visible = true
    this.hexMap.update()
  }
  enableHexInspector(qY = 52, cont = this.undoCont) {
    const qShape = new HexShape(TP.hexRad/3);
    qShape.paint(C.BLACK);
    qShape.y = qY;  // size of 'skip' Triangles
    cont.addChild(qShape);
    this.dragger.makeDragable(qShape, this,
      // dragFunc:
      (qShape: Shape, ctx: DragInfo) => { },
      // dropFunc:
      (qShape: Shape, ctx: DragInfo) => {
        this.downClick = true;
        const hex = this.hexUnderObj(qShape, false);  // also check hexCont!
        qShape.x = 0; qShape.y = qY; // return to regular location
        cont.addChild(qShape);
        if (!hex) return;
        const info = hex; //{ hex, stone: hex.playerColor, InfName }
        console.log(`HexInspector:`, hex.Aname, info)
      })
    qShape.on(S.click, () => this.toggleText(), this); // toggle visible
  }

  downClick = false;
  isVisible = false;
  /** method invokes closure defined in enableHexInspector. */
  toggleText(vis?: boolean) {
    if (this.downClick) return (this.downClick = false, undefined) // skip one 'click' when pressup/dropfunc
    if (vis === undefined) vis = this.isVisible = !this.isVisible;
    Tile.allTiles.forEach(tile => tile.textVis(vis));
    this.hexMap.forEachHex<Hex2>(hex => hex.showText(vis))
    this.hexMap.update()               // after toggleText & updateCache()
  }

  aiControl(color = TP.bgColor, dx = 100, rad = 16) {
    let table = this
    // c m v on buttons
    let makeButton = (dx: number, bc = TP.bgColor, tc = TP.bgColor, text: string, key = text) => {
      let cont = new Container(); cont.name='aiControl'
      let circ = new Graphics().f(bc).drawCircle(0, 0, rad)
      let txt = new Text(text, F.fontSpec(rad), tc)
      txt.y = - rad/2
      txt.textAlign = 'center'
      txt.mouseEnabled = false
      cont.x = dx
      cont.addChild(new Shape(circ))
      cont.addChild(txt)
      cont.on(S.click, (ev) => { KeyBinder.keyBinder.dispatchChar(key) })
      return cont
    }
    let bpanel = new Container(); bpanel.name = 'bpanel';
    let c0 = TP.colorScheme[playerColor0], c1 = TP.colorScheme[playerColor1]
    let cm = "rgba(100,100,100,.5)"
    let bc = makeButton(-dx, c0, c1, 'C', 'c')
    let bv = makeButton(dx, c1, c0, 'V', 'v')
    let bm = makeButton(0, cm, C.BLACK, 'M', 'm'); bm.y -= 10
    let bn = makeButton(0, cm, C.BLACK, 'N', 'n'); bn.y += rad*2
    let bs = makeButton(0, cm, C.BLACK, ' ', ' '); bs.y += rad*5
    bpanel.addChild(bc)
    bpanel.addChild(bv)
    bpanel.addChild(bm)
    bpanel.addChild(bn)
    bpanel.addChild(bs)
    return bpanel
  }

  /** all the non-map hexes created by newHex2 */
  newHexes: Hex2[] = [];
  newHex2(row = 0, col = 0, name: string, claz: Constructor<Hex2> = Hex2, sy = 0) {
    const hex = new claz(this.hexMap, row, col, name);
    hex.distText.text = name;
    if (row <= 0) {
      hex.y += (sy + row * .5 - .75) * (this.hexMap.radius);
    }
    this.newHexes.push(hex);
    return hex
  }

  noRowHex(name: string, crxy: { row: number, col: number }, claz?: Constructor<Hex2>) {
    const { row, col } = crxy;
    const hex = this.newHex2(row, col, name, claz);
    return hex;
  }

  layoutTable(gamePlay: GamePlay) {
    this.gamePlay = gamePlay
    const hexMap = this.hexMap = gamePlay.hexMap as AnkhMap<AnkhHex>;
    hexMap.addToMapCont();                   // addToMapCont; make AnkhHex
    hexMap.makeAllDistricts();               //
    // hexCont is offset to be centered on mapCont (center of hexCont is at mapCont[0,0])
    // mapCont is offset [0,0] to scaleCont
    const mapCont = hexMap.mapCont, hexCont = mapCont.hexCont; // local reference
    this.scaleCont.addChild(mapCont);

    // background sized for hexMap:
    const { width: rw, height: rh } = hexCont.getBounds();
    const { x, y, w, h, dxdc: colw, dydr: rowh } = hexMap.xywh;
    const bgr: XYWH = { x: -2 * colw, y: 0, w: rw + 14 * colw, h: rh + .5 * rowh }
    // align center of mapCont(0,0) == hexMap(center) with center of background
    mapCont.x = bgr.x + (bgr.w) / 2;
    mapCont.y = bgr.y + (bgr.h) / 2;
    bgr.h += 1.5 * rowh;

    this.bgRect = this.setBackground(this.scaleCont, bgr); // bounded by bgr
    const p00 = this.scaleCont.localToLocal(bgr.x, bgr.y, hexCont);
    const pbr = this.scaleCont.localToLocal(bgr.w, bgr.h, hexCont);
    hexCont.cache(p00.x, p00.y, pbr.x - p00.x, pbr.y - p00.y); // cache hexCont (bounded by bgr)

    this.makeGuardSources();
    this.makeMounumentSources();

    this.makeActionCont();
    this.makeEventCont();
    this.makeScoreStacks();
    this.makeRegionMarkers();
    this.makePerPlayer();

    this.gamePlay.recycleHex = this.makeRecycleHex();
    this.setupUndoButtons(55, 60, 45, bgr) // & enableHexInspector()

    const initialVis = false;
    this.stage.on('drawend', () => setTimeout(() => this.toggleText(initialVis), 10), this, true );
    this.hexMap.update();
    // position turnLog & turnText
    {
      const parent = this.scaleCont, colx = -15;
      this.setToRowCol(this.bagLog, 4, colx);
      this.setToRowCol(this.turnLog, 4, colx);
      this.setToRowCol(this.textLog, 4, colx);
      this.bagLog.y -= this.turnLog.height(1);
      this.textLog.y += this.turnLog.height(Player.allPlayers.length + 1);

      parent.addChild(this.bagLog, this.turnLog, this.textLog);
      parent.stage.update()
    }

    this.on(S.add, this.gamePlay.playerMoveEvent, this.gamePlay)[S.Aname] = "playerMoveEvent"
  }

  // col locations, left-right mirrored:
  colf(pIndex: number, icol: number, row: number) {
    const dc = 10 - Math.abs(row) % 2;
    const col = (pIndex == 0 ? (icol) : (dc - icol));
    return { row, col };
  }

  readonly allPlayerPanels: PlayerPanel[] = [];
  makePerPlayer(c0 = -7.4, c1 = TP.nHexes + .9, r0 = -.3, dr = 3.4) {
    const panelLocs = [[r0, c0], [r0 + dr, c0], [r0 + 2 * dr, c0], [r0, c1], [r0 + dr, c1]];
    const seq = [[], [0], [0, 3], [0, 3, 1], [0, 3, 4, 1], [0, 3, 4, 2, 1]];
    const np = Player.allPlayers.length, seqn = seq[np];
    this.allPlayerPanels.length = 0; // TODO: maybe deconstruct
    Player.allPlayers.forEach((player, pIndex) => {
      const ndx = seqn[pIndex];
      const [row, col] = panelLocs[ndx];
      this.allPlayerPanels[pIndex] = player.panel = new PlayerPanel(this, player, row, col, ndx < 3 ? -1 : 1);
      player.makePlayerBits();
    });
  }

  /** move cont to nominal [row, col] of hexCont */
  setToRowCol(cont: Container, row = 0, col = 0) {
    if (!cont.parent) this.scaleCont.addChild(cont);
    const hexCont = this.hexMap.mapCont.hexCont;
    //if (cont.parent === hexCont) debugger;
    const fcol = Math.floor((col)), ecol = fcol - fcol % 2, cresi = col - ecol;
    const frow = Math.floor((row)), erow = frow - frow % 2, rresi = row - erow;
    const hexC = this.hexMap.centerHex;
    const { x, y, w, h, dxdc, dydr } = hexC.xywh(undefined, undefined, erow, ecol);
    const xx = x + cresi * dxdc;
    const yy = y + rresi * dydr;
    hexCont.localToLocal(xx, yy, cont.parent, cont);
    if (cont.parent === hexCont) {
      cont.x = xx; cont.y = yy;
    }
  }

  sourceOnHex(source: TileSource<Tile>, hex: Hex2) {
    if (source) source.counter.mouseEnabled = false;
    hex.legalMark.setOnHex(hex);
    hex.cont.visible = false;
  }

  makeCircleButton(color = C.WHITE, rad = 20, c?: string, fs = 30) {
    const button = new Container(); button.name = 'circle';
    const shape = new CircleShape(color, rad, '');
    button.addChild(shape);
    if (c) {
      const t = new CenterText(c, fs); t.y += 2;
      button.addChild(t);
    }
    button.setBounds(-rad, -rad, rad * 2, rad * 2);
    button.mouseEnabled = false;
    return button;
  }

  makeSquareButton(color = C.WHITE, xywh: XYWH, c?: string, fs = 30) {
    const button = new Container(); button.name = 'square';
    const shape = new RectShape(xywh, color, '');
    button.addChild(shape);
    if (c) {
      const t = new CenterText(c, fs); t.y += 2;
      button.addChild(t);
    }
    shape.mouseEnabled = false;
    return button;
  }

  makeRecycleHex(row = 9.2, col = 0) {
    const name = 'Recycle'
    const image = new Tile(name).addImageBitmap(name); // ignore Tile, get image.
    image.y = -TP.hexRad / 2; // recenter

    const rHex = this.newHex2(row, col, name, AnkhHex);
    this.setToRowCol(rHex.cont, row, col);
    rHex.rcText.visible = rHex.distText.visible = false;
    rHex.setHexColor(C.WHITE);
    rHex.cont.addChild(image);
    rHex.cont.updateCache();
    return rHex;
  }

  guardSources: AnkhSource<Guardian>[] = [];
  makeGuardSources(row = 7, col = TP.nHexes + 6.8) {
    this.gamePlay.guards.forEach((guard, i) => { // make source for each Guardian
      const rowi = row + i * 1.25;
      const hex = this.newHex2(rowi, col, `gs-${i}`, AnkhHex);
      this.setToRowCol(hex.cont, rowi, col);
      const np = Player.allPlayers.length; // (0,1) 2,3,4,5
      const n = [[0],[0],[1,1,1],[2,2,2],[3,2,2],[3,2,2]][np][i];
      const source = Guardian.makeSource(hex, guard, n);
      this.guardSources.push(source);
      this.sourceOnHex(source, hex);
    });
  }

  monumentSources: AnkhSource<Monument>[] = [];
  makeMounumentSources(row = 7, col = TP.nHexes + 1.7) {
    const monmts = Monument.typeNames.map(name => ClassByName.classByName[name]);
    monmts.forEach((momnt, i) => { // .filter((g, i) => i > 0)
      const ci = col + i * 1.25;
      const hex = this.newHex2(row, ci, `ms-${i}`, AnkhHex);
      this.setToRowCol(hex.cont, row, ci);
      const source = Monument.makeSource0(AnkhSource<Monument>, momnt, undefined, hex, 12)  //(hex, monmt, n);
      this.monumentSources.push(source);
      this.sourceOnHex(source, hex);
      // source.nextUnit();
    });
  }

  actionPanels: ActionContainer[] = [];
  readonly actionRows  = [
    { id: 'Move',  dn: 2 }, { id: 'Summon', dn: 2 }, { id: 'Gain', dn: 2 }, { id: 'Ankh', dn: 1 }
  ] as const;
  makeActionCont(row = TP.nHexes -2, col = TP.nHexes + 1.2) {
    const np = Player.allPlayers.length, rad = 30, rh = 2 * rad + 5;//, wide = (2 * rad + 5) * (5 + 1)
    const wide = 400;
    console.log(stime(this, `.makeActionCont`), np);
    // TODO: class actionCont, with slots to hold button & each circle/state (number activated)
    // or could use children[] and the color/visiblity of each shape/cont
    const actionCont = new Container(); actionCont.name = `actionRowCont`;
    this.hexMap.mapCont.resaCont.addChild(actionCont);
    this.setToRowCol(actionCont, row, col);

    //for (let rn = 0; rn < actionRows.length; rn++) {
    this.actionRows.forEach((actionRow, rn) => {
      const nc = np + actionRow.dn, dx = wide / (nc - 1), id = actionRow.id;
      const rowCont = new ActionContainer(rad, this);
      rowCont.name = `rowCont-${id}`;
      rowCont.y = rn * rh;
      actionCont.addChild(rowCont);
      const overName = `over${actionRow.id}`; // 'overGain'
      rowCont.rollover = rowCont[overName] as (button: ActionButton, over: boolean) => void;
      const k = firstChar(actionRow.id);
      for (let cn = 0; cn < nc; cn++) {
        // make ActionSelectButton:
        const color = (cn < nc - 1) ? C.lightgrey : C.coinGold;
        const button = this.makeCircleButton(color, rad, k) as ActionButton; // container with CircleShape(radius)
        button.name = `${id}-${cn}`;
        button.isEvent = (cn === nc - 1);
        button.x = cn * dx;
        rowCont.addButton(button);
        button.on(S.click, (evt: Object) => this.selectAction(id, button, cn), this);
      }
      this.actionPanels[actionRow.id] = rowCont;
    });
    this.addDoneButton(actionCont, rh)
  }

  /** onClick: mark Action as selected, inform GamePlay & phaseDone() */
  selectAction (id: ActionIdent, button: ActionButton, cn: number) {
    ;(button.parent as ActionContainer).rollover?.(button, false);  // implicit 'rollout'
    this.gamePlay.gameState.selectedAction = id;
    this.gamePlay.gameState.selectedActionIndex = cn;
    if (button.isEvent) {
      this.setEventMarker(this.nextEventIndex);
    }
    this.activateActionSelect(false, id); // de-activate this row and the ones above.
    this.setActionMarker(button, undefined, C.grey);

    this.gamePlay.phaseDone(); // --> phase(selectedAction)
  }

  setActionMarker(button: ActionButton, player = this.gamePlay.curPlayer, color?: string) {
    const rad = (button.children[0] as CircleShape).rad;
    const god = player.god;
    const ankhToken = god.getAnkhMarker(rad);
    if (color) {
      const hl = (button.parent as ActionContainer).highlight;
      hl.paint(color);
      hl.visible = true;
    }
    button.pid = player.index;
    button.addChild(ankhToken);
    button.stage.update();
  }

  activeButtons: {[key in ActionIdent]?: [ActionButton, number]} = {}
  /**
   * On each row: activate or deactivate the first button without an AnkhMarker on each line.
   * If a row is 'full' (previous Event) it is reset to the beginning.
   *
   * @param afterRow name of previous actionSelected; that row and above are deactivated.
   * @return false if no buttons were activated (afterRow == 'Ankh')
   */
  activateActionSelect(activate: boolean, afterRow?: string) {
    let isAfter = (afterRow === undefined);
    let active = 0;
    this.activeButtons = {};
    this.actionRows.map(({id, dn}, cn) => {
      const rowCont = this.actionPanels[id] as ActionContainer;
      if (!activate) {
        rowCont.deactivate();   // highlight & mouse = false
      } else if (isAfter) {
        this.activeButtons[id]= [rowCont.activate(), cn];
        active++; // number of rows activated.
      }
      isAfter = isAfter || id === afterRow;
    })
    this.stage.enableMouseOver(active > 0 ? 5 : 0);// enable or disable MouseOver
    return active > 0;
  }

  undoActionSelection(action: string, index: number) {
    const rowCont = this.actionPanels[action] as ActionContainer;
    if (!rowCont) debugger;    // TODO: undo 'Ankh' [isEvent!] -> 'Gain' -> direct to Event!
    const button = rowCont.buttons[index];
    button.removeChildType(AnkhMarker);
    if (button.isEvent) {
      this.removeEventMarker(this.nextEventIndex - 1); // maybe reset gamePlay.eventName??
    }
    rowCont.activate();;
  }

  doneButton: UtilButton;
  doneClicked = (evt?) => {
    this.activateActionSelect(false); // deactivate all
    this.doneButton.visible = false;
    this.gamePlay.phaseDone();   // <--- main doneButton does not supply 'panel'
  }
  addDoneButton(actionCont: Container, rh: number) {
    const w = 90, h = 56;
    const doneButton = this.doneButton = new UtilButton('lightgreen', 'Done', 36, C.black);
    doneButton.name = 'doneButton';
    doneButton.x = -(w);
    doneButton.y = 3 * rh;
    doneButton.label.textAlign = 'right';
    doneButton.on(S.click, this.doneClicked, this);
    actionCont.addChild(doneButton);

    // prefix advice: set text color
    const o_cgf = doneButton.shape.cgf;
    const cgf = (color) => {
      const tcolor = (C.dist(color, C.WHITE) < C.dist(color, C.black)) ? C.black : C.white;
      doneButton.label.color = tcolor;
      return o_cgf(color);
    }
    doneButton.shape.cgf = cgf; // invokes shape.paint(cgf) !!
    return actionCont;
  }

  get nextEventIndex() { return this.eventCells.findIndex(ec => !ec.children.find(c => (c instanceof AnkhMarker)))}
  eventCells: EventIcon[] = [];
  makeEventCont(row = TP.nHexes + 0.5, col = 7.05) {
    const eventCont = new Container(); eventCont.name = 'eventCont';
    this.hexMap.mapCont.resaCont.addChild(eventCont);
    this.setToRowCol(eventCont, row, col);
    const events: EventName[] = [
      'Claim', 'Claim', 'Claim', 'Conflict',
      'Split', 'Claim', 'Claim', 'Conflict',
      'Split', 'Claim', 'Claim', 'Conflict', 'merge',
      'Split', 'Claim', 'Claim', 'Conflict', 'redzone',
      'Claim', 'Conflict',
    ];
    const rad = TP.ankhRad, gap = 5, dx = 2 * rad + gap, bx = .5;
    let cx = 0, lastIcon: EventIcon;
    events.forEach((eventName, ndx) => {
      const icon = new Container() as EventIcon; icon.name = 'eventIcon';
      icon.eventName = eventName;
      const k = (eventName === 'Conflict') ? 'B' : firstChar(eventName);
      const shape = new CircleShape('rgb(240,240,240)', rad, );
      const text = new CenterText(k, rad * 1.8); text.y += 2;
      icon.y = 0;
      icon.x = cx * dx;
      icon.addChild(shape);
      icon.addChild(text);
      eventCont.addChild(icon);
      const flag = new Shape(new Graphics().f('brown').dr(-(rad + gap / 2), -(rad + gap / 2), 2 * (rad + gap / 2), 2 * (rad + gap / 2)));
      cx += 1;
      if (eventName === 'Conflict') {
        cx += bx;  // extra gap after Conflict
        icon.addChildAt(flag, 0);
      }
      if (eventName === 'merge' || eventName === 'redzone') {
        cx -= 1;
        lastIcon.special = eventName;
        icon.y += dx;
        icon.x = lastIcon.x;
        icon.addChildAt(flag, 0);
        icon.removeChild(shape);
        eventCont.addChildAt(icon, 0);
      } else {
        this.eventCells.push(icon);
        lastIcon = icon;
      }
    })
    return eventCont;
  }

  removeEventMarker(index: number) {
    this.eventCells[index].removeChildType(AnkhMarker);
    // if (this.gamePlay.eventName) this.setEventMarker(index - 1); // <--- QQQ: Why this?
  }

  /** set GameState.eventName when a new event has been triggered. */
  setEventMarker(index: number, player = this.gamePlay.curPlayer) {
    const cell = this.eventCells[index];
    cell.pid = player.index;
    cell.addChild(player.god.getAnkhMarker(TP.ankhRad));
    this.gamePlay.gameState.eventName = cell.eventName;
    this.gamePlay.gameState.eventSpecial = cell.special;
  }

  readonly emptyColor = 'rgb(240,240,240)';
  makeScoreStacks(row = TP.nHexes + .5, col = -7.2, np = Player.allPlayers.length, w = 34) {
    const inRed = TP.inRedzone;
    const redzone = 'rgb(230,100,100)', win = C.lightgreen;
    const scoreCont = this.scoreCont = new Container(); scoreCont.name = 'scoreCont';
    this.hexMap.mapCont.resaCont.addChild(scoreCont);
    this.setToRowCol(scoreCont, row, col);
    const h = 20, gap = 5, dx = w + gap, x = -w / 2, y = -h / 2, sh = h * np; // stack height; ym = (np - 1) * h;
    //scoreCont.y +=  sh / 2;
    // a RectShape for each score slot:
    for (let cn = 0; cn < 32; cn++) {   // a value for 'score'
      const stroke = cn <= inRed ? redzone : cn > 30 ? win : C.grey;
      const stackRect = new RectShape({ x, y: -sh / 2, w, h: sh }, C.white, stroke, new Graphics().ss(gap));
      stackRect.x = cn * dx;
      scoreCont.addChild(stackRect);
      this.scoreStacks.push([]);
    }
    // make scoreMarks, and stack them on slot[0]:
    // push on scoreStack; splice to remove; display at stackIndex*cellHeight
    this.scoreMarks.length = 0;
    for (let ndx = 0; ndx < np; ndx++) {
      const index = np - ndx - 1;             // initial stack in reverse order.
      const plyr = Player.allPlayers[index];
      const pmark = new RectShape({ x, y: - sh / 2, w, h }, plyr.color) as ScoreMark;
      pmark.name = `pmark-${plyr.index}`;
      this.scoreMarks[index] = (pmark);
      this.pushScoreMark(pmark, 0);      // score is zero initially.
      scoreCont.addChild(pmark);
    }
    this.showScoreMarks();
    return scoreCont;
  }

  pushScoreMark(pmark: ScoreMark, score: number, rank?: number) {
    pmark.score = score;
    const pmrank = (rank === undefined) ? this.scoreStacks[score].length : rank;
    this.scoreStacks[score][pmrank] = pmark;    // .push(pmark) if rank not supplied.
  }

  scoreCont: Container; // 31 RectShapes
  readonly scoreStacks: RectShape[][] = []; // each player's RectShape marker, indexed by score;
  readonly scoreMarks: ScoreMark[] = [];    // each player's marker, indexed by player.index
  showScoreMarks() {
    const np = Player.allPlayers.length;
    this.scoreStacks.forEach((ss, cn) => {
      const cnx = this.scoreCont.children[cn].x;
      ss.forEach((pt, rank) => {
        pt.x = cnx, pt.y = (np - rank - 1) * pt.rect.h;
      })
    })
    this.hexMap.update();
  }

  get playerScores() {
    // return this.scoreMarks.map(pm => pm.score + pm.rank/10);
    return this.scoreMarks.map(pm => pm.score + this.scoreStacks[pm.score].indexOf(pm)/10);
  }
  get panelsInRank() { return this.panelsByScore(); }
  panelsByScore(panels = this.allPlayerPanels.concat()) {
    const scores = this.playerScores;
    return panels.sort((pa, pb) => scores[pa.player.index] - scores[pb.player.index]);
  }

  // TODO: AnkhTable extends Table { override hexMap: HexMap<AnkhHex> }
  regionMarkers: RegionMarker[] = [];
  makeRegionMarkers(n: RegionId = 8) {
    RegionMarker.table = this;
    for (let regionId: RegionId = n; regionId > 0; --regionId) {
      const marker = new RegionMarker(undefined, regionId);
      this.regionMarkers.unshift(marker);
      this.hexMap.mapCont.markCont.addChild(marker);
    }
  }

  /** set the appropriate RegionMarker on the specifiied Region. */
  setRegionMarker(rid: RegionId, mapXY?: MapXY) {
    const marker = this.regionMarkers[rid - 1];
    if (mapXY !== undefined) {
      const [x, y] = mapXY;
      marker.lastXY.x = marker.x = x;
      marker.lastXY.y = marker.y = y;
      return;
    }
    // move marker to 'corner' of hex (or {0,0} of markCont):
    const [x, y] = this.centerOfRegion(rid);
    const hex = this.hexMap.hexUnderPoint(x, y, false);
    this.placeRegionMarker(marker, hex as AnkhHex, x, y);
    return;
  }
  centerOfRegion(regionId: RegionId) {
    const hexMap = this.hexMap as AnkhMap<AnkhHex>, regions = hexMap.regions;
    const region = regions[regionId - 1] ?? [], nHexes = region.length || 1;
    // if (region.length === 0) 'debugger'; // we have injected a intial value, but something is wrong.
    const txy = (region.length > 0) ? (region.map(hex => hex.cont) as XY[]).reduce((pv, cv, ci) => {
      return { x: pv.x + cv.x, y: pv.y + cv.y }
    }, { x: 0, y: 0 }) : { x: 0, y: 0 };
    return [txy.x / nHexes, txy.y / nHexes] as MapXY; // hexCont coordinates: centroid of region Hexes
  }
  placeRegionMarker(marker: RegionMarker, hex: AnkhHex, x = hex?.x, y = hex?.y) {
    if (hex) {
      const cxy = hex.cornerXY(hex.cornerDir({ x, y }, undefined, H.nsDirs)[0]);
      hex.cont.localToLocal(cxy.x * H.sqrt3_2, cxy.y * H.sqrt3_2, marker.parent, marker);
      hex.cont.localToLocal(cxy.x * H.sqrt3_2, cxy.y * H.sqrt3_2, marker.parent, marker.lastXY);
    } else {
      this.hexMap.mapCont.markCont.localToLocal(0, 0, marker.parent, marker)
      this.hexMap.mapCont.markCont.localToLocal(0, 0, marker.parent, marker.lastXY);
    }
  }


  // Initially: 0.[np-pid-1], that is for 4 plyrs: 0.3, 0.2, 0.1, 0.0 (reverse player order)
  setPlayerScore(plyr: Player, score: number, rank?: number) {
    if (!this.scoreStacks) this.makeScoreStacks();
    const pm = this.scoreMarks[plyr.index];
    const stack0 = this.scoreStacks[pm.score]; // pm in on stack0
    const index = stack0.indexOf(pm);
    const m = stack0.splice(index, 1); // remove it;
    if (m[0] !== pm) debugger;
    const score1 = Math.min(Math.floor(score), 31);
    this.pushScoreMark(pm, score1, rank);
    this.showScoreMarks();
  }

  startGame(scenario: Scenario) {
    // All Tiles (& Meeple) are Dragable:
    Tile.allTiles.forEach(tile => {
      this.makeDragable(tile);
    })

    // this.stage.enableMouseOver(10);
    this.scaleCont.addChild(this.overlayCont); // now at top of the list.
    this.gamePlay.setNextPlayer(this.gamePlay.turnNumber > 0 ? this.gamePlay.turnNumber : 0);
    // this.gamePlay.saveState();         // save parsed scenario
    this.gamePlay.gameState.start();   // enable Table.GUI to drive game state.
  }

  makeDragable(tile: DisplayObject) {
    const dragger = this.dragger;
    dragger.makeDragable(tile, this, this.dragFunc, this.dropFunc);
    dragger.clickToDrag(tile, true); // also enable clickToDrag;
  }

  hexUnderObj(dragObj: DisplayObject, legalOnly = true ) {
    return this.hexMap.hexUnderObj(dragObj, legalOnly);
  }

  dragContext: DragContext;
  dragFunc(tile: Tile, info: MinDragInfo) {
    const hex = this.hexUnderObj(tile); // clickToDrag 'snaps' to non-original hex!
    this.dragFunc0(tile, info, hex);
  }

  /** Table.dragFunc0 (Table.dragFunc to inject drag/start actions programatically)
   * @param tile is being dragged
   * @param info { first: boolean, mouse: MouseEvent }
   * @param hex the Hex that tile is currently over (may be undefined or off map)
   */
  dragFunc0(tile: Tile, info: MinDragInfo, hex = this.hexUnderObj(tile)) {
    let ctx = this.dragContext;
    if (info?.first) {
      if (ctx?.tile) {
        // clickToDrag intercepting a drag in progress!
        // mouse not over drag object! fix XY in call to dragTarget()
        console.log(stime(this, `.dragFunc: OOPS! adjust XY on dragTarget`), ctx);
        this.stopDragging(ctx.targetHex); // stop original drag
        this.dragger.stopDrag();          // stop new drag;  this.dropFunc(ctx.tile, ctx.info);
        return;
      }
      const event = info.event?.nativeEvent;
      tile.fromHex = tile.hex as Hex2;  // dragStart: set tile.fromHex when first move!
      ctx = {
        tile: tile,                  // ASSERT: hex === tile.hex
        targetHex: tile.fromHex,     // last isLegalTarget() or fromHex
        lastShift: event?.shiftKey,
        lastCtrl:  event?.ctrlKey,
        info: info,
        nLegal: 0,
        gameState: this.gamePlay.gameState,
        phase: this.gamePlay.gamePhase.Aname,
        regionId: this.gamePlay.gameState.conflictRegion,
      }
      this.dragContext = ctx;
      if (!tile.isDragable(ctx)) {
        this.stopDragging(tile.fromHex); // just slide off this tile, no drag, no drop.
        return;
      }
      this.dragStart(tile, ctx);     // canBeMoved, isLegalTarget, tile.dragStart(ctx);
      if (!ctx.tile) return;         // stopDragging() was invoked
    }
    this.checkShift(hex, ctx);
    tile.dragFunc0(hex, ctx);
  }

  // invoke dragShift 'event' if shift state changes
  checkShift(hex: Hex2, ctx: DragContext) {
    const nativeEvent = ctx.info.event?.nativeEvent
    ctx.lastCtrl = nativeEvent?.ctrlKey;
    // track shiftKey because we don't pass 'event' to isLegalTarget(hex)
    const shiftKey = nativeEvent?.shiftKey;
    if (shiftKey !== ctx.lastShift || (hex && ctx.targetHex !== hex)) {
      ctx.lastShift = shiftKey;
      // do shift-down/shift-up actions...
      this.dragShift(ctx.tile, shiftKey, ctx); // was interesting for hexmarket
    }
  }

  dragStart(tile: Tile, ctx: DragContext) {
    // press SHIFT to capture [recycle] opponent's Criminals or Tiles
    const reason = tile.cantBeMovedBy(this.gamePlay.curPlayer, ctx);
    if (reason) {
      console.log(stime(this, `.dragStart: ${reason}: ${tile},`), 'ctx=', { ...ctx });
      // this.logText(`${reason}: ${tile}`, 'Table.dragStart');
      this.stopDragging();
    } else {
      // mark legal targets for tile; SHIFT for all hexes, if payCost
      tile.dragStart(ctx); // prepare for isLegalTarget

      const hexIsLegal = (hex: Hex2) => ((hex !== tile.hex) && (hex.isLegal = tile.isLegalTarget(hex, ctx)) && (ctx.nLegal += 1));
      tile.markLegal(this, hexIsLegal, ctx);           // delegate to check each potential target
      this.gamePlay.recycleHex.isLegal = tile.isLegalRecycle(ctx); // do not increment ctx.nLegal!
      tile.moveTo(undefined); // notify source Hex, so it can scale; also triggers nextUnit !!
      this.hexMap.update();
      if (ctx.nLegal === 0) {
        tile.noLegal();
        if (!this.gamePlay.recycleHex.isLegal) {
          this.stopDragging(); // actually, maybe let it drag, so we can see beneath...
        }
      }
    }
  }

  /** state of shiftKey has changed during drag */
  dragShift(tile: Tile, shiftKey: boolean, ctx: DragContext) {
    tile?.dragShift(shiftKey, ctx);
  }

  dropFunc(tile: Tile, info: MinDragInfo, hex = this.hexUnderObj(tile)) {
    tile.dropFunc0(hex, this.dragContext);
    tile.markLegal(this); // hex => hex.isLegal = false;
    this.gamePlay.recycleHex.isLegal = false;
    this.dragContext.lastShift = undefined;
    this.dragContext.tile = undefined; // mark not dragging
  }

  /** synthesize dragStart(tile), tile.dragFunc0(hex), dropFunc(tile);  */
  dragStartAndDrop(tile: Tile, toHex: Hex) {
    if (!tile) return; // C-q when no EventTile on eventHex
    const info = { first: true }, hex = toHex as Hex2;
    this.dragFunc0(tile, info, tile.hex as Hex2);  // dragStart()
    tile.dragFunc0(hex, this.dragContext);
    this.dropFunc(tile, info, hex);
  }

  private isDragging() { return this.dragContext?.tile !== undefined; }

  /** Force this.dragger to drop the current drag object on given target Hex */
  stopDragging(target: Hex2 = this.dragContext?.tile?.fromHex) {
    //console.log(stime(this, `.stopDragging: dragObj=`), this.dragger.dragCont.getChildAt(0), {noMove, isDragging: this.isDragging()})
    if (this.isDragging()) {
      if (target) this.dragContext.targetHex = target;
      this.dragger.stopDrag(); // ---> dropFunc(this.dragContext.tile, info)
    }
    const data = this.dragger.getDragData(this.scaleCont);
    if (data) data.dragStopped = true;
  }

  /** Toggle dragging: dragTarget(target) OR stopDragging(targetHex)
   * - attach supplied target to mouse-drag (default is eventHex.tile)
   */
  dragTarget(target: DisplayObject = this.gamePlay.recycleHex.tile, xy: XY = { x: TP.hexRad / 2, y: TP.hexRad / 2 }) {
    if (this.isDragging()) {
      this.stopDragging(this.dragContext.targetHex) // drop and make move
    } else if (target) {
      this.dragger.dragTarget(target, xy);
    }
  }

  logCurPlayer(plyr: Player) {
    const history = this.gamePlay.history
    const tn = this.gamePlay.turnNumber
    const lm = history[0]
    const prev = lm ? `${lm.Aname}${lm.ind}#${tn-1}` : ""
    const robo = plyr.useRobo ? AT.ansiText(['red','bold'],"robo") : "----";
    const info = { turn: tn, plyr: plyr.Aname, prev, gamePlay: this.gamePlay, curPlayer: plyr }
    console.log(stime(this, `.logCurPlayer --${robo}--`), info);
    this.logTurn(`//${tn}: ${plyr.Aname}`);
  }
  showRedoUndoCount() {
    this.undoText.text = `${this.gamePlay.undoRecs.length}`
    this.redoText.text = `${this.gamePlay.redoMoves.length}`
  }
  showNextPlayer(log: boolean = true) {
    let curPlayer = this.gamePlay.curPlayer // after gamePlay.setNextPlayer()
    if (log) this.logCurPlayer(curPlayer)
    this.showRedoUndoCount()
  }

  _tablePlanner: TablePlanner
  get tablePlanner() {
    return this._tablePlanner ||
    (this._tablePlanner = new TablePlanner(this.gamePlay))
  }
  /**
   * All manual moves feed through this (drop & redo)
   * TablePlanner.logMove(); then dispatchEvent() --> gamePlay.doPlayerMove()
   *
   * New: let Ship (Drag & Drop) do this.
   */
  doTableMove(ihex: IHex) {
  }
  /** All moves (GUI & player) feed through this: */
  moveStoneToHex(ihex: IHex, sc: PlayerColor) {
    // let hex = Hex.ofMap(ihex, this.hexMap)
    // this.hexMap.showMark(hex)
    // this.dispatchEvent(new HexEvent(S.add, hex, sc)) // -> GamePlay.playerMoveEvent(hex, sc)
  }

  /** default scaling-up value */
  upscale: number = 1.5;
  /** change cont.scale to given scale value. */
  scaleUp(cont: Container, scale = this.upscale) {
    cont.scaleX = cont.scaleY = scale;
  }
  scaleParams = { initScale: .125, scale0: .05, scaleMax: 4, steps: 30, zscale: .20,  };

  dispatchPressupX(target: DisplayObject, ctd = true) { return this.dragger.getDragData(target)  }
  getDragData(target: DisplayObject) { return target['DragData'] };
  dispatchPressup(target, ctd = true) {
    let dragData = this.getDragData(target);
    dragData.clickToDrag = ctd;
    let stage = target.stage, stageX = stage.mouseX, stageY = stage.mouseY;
    let mouseE = { button: 0 } as NativeMouseEvent;
    // MouseEvent with faux .nativeEvent:
    let event = new MouseEvent(S.pressup, false, true, stageX, stageY, mouseE, -1, true, stageX, stageY);
    target.dispatchEvent(event, target); // set dragData.dragCtx = startDrag()
    return dragData;
}
  /** Move [dragable] target to mouse as if clickToDrag at {x,y}. */
  dragTargetPatch(target: DisplayObject, dxy: XY = { x: 0, y: 0 }) {
    // invoke 'click' to start drag;
    const dragData = this.dispatchPressup(target);
    // if pressup -> dragStart -> dragStop then dragCtx = undefined!
    if (!dragData.dragCtx) return;
    dragData.dragCtx.dxy = dxy
    target.parent.globalToLocal(target.stage.mouseX, target.stage.mouseY, target) // move target to mouseXY
    target.x -= dxy.x                // offset by dxy
    target.y -= dxy.y
    target.stage.update()            // move and show new position
  }

  readonly scaleCont: ScaleableContainer2;
  /** makeScaleableBack and setup scaleParams
   * @param bindkeys true if there's a GUI/user/keyboard
   */
  makeScaleCont(bindKeys: boolean) {
    /** scaleCont: a scalable background */
    const scaleC = new ScaleableContainer2(this.stage, this.scaleParams);
    this.dragger = new Dragger(scaleC);
    this.dragger.dispatchPressup = this.dispatchPressup; // PATCH for nativeEvent?
    this.dragger.dragTarget = this.dragTargetPatch; // PATCH until next easeljs-lib
    if (!!scaleC.stage.canvas) {
      // Special case of makeDragable; drag the parent of Dragger!
      this.dragger.makeDragable(scaleC, scaleC, undefined, undefined, true); // THE case where not "useDragCont"
      //this.scaleUp(Dragger.dragCont, 1.7); // Items being dragged appear larger!
    }
    if (bindKeys) {
      this.bindKeysToScale(scaleC, "a", 436, 2);
      KeyBinder.keyBinder.setKey('Space',   { thisArg: this, func: () => this.dragTarget() });
      KeyBinder.keyBinder.setKey('S-Space', { thisArg: this, func: () => this.dragTarget() });
      KeyBinder.keyBinder.setKey('t', { thisArg: this, func: () => { this.toggleText(); } })
    }
    return scaleC;
  }

  /** put a Rectangle Shape at (0,0) with XYWH bounds as given */
  setBackground(parent: Container, bounds: XYWH, bgColor = TP.bgColor) {
    // specify an Area that is Dragable (mouse won't hit "empty" space)
    const bgRect = new RectShape(bounds, bgColor, '');
    bgRect[S.Aname] = "BackgroundRect"
    parent.addChildAt(bgRect, 0);
    return bgRect
  }

  zoom(z = 1.1) {
    const stage = this.stage;
    const pxy = { x: stage.mouseX / stage.scaleX, y: stage.mouseY / stage.scaleY };
    this.scaleCont.setScale(this.scaleCont.scaleX * z, pxy);
    // would require adjusting x,y offsets, so we just scale directly:
    // TODO: teach ScaleableContainer to check scaleC.x,y before scroll-zooming.

    // this.scaleCont.scaleX = this.scaleCont.scaleY = this.scaleCont.scaleX * z;
    this.stage?.update();
  }
  pan(xy: XY) {
    this.scaleCont.x += xy.x;
    this.scaleCont.y += xy.y;
    this.stage?.update();
  }

  /**
   * invoked before this.scaleC has been set
   * @param scaleC same Container as this.scaleC
   * @param char keybinding to set initial scale
   * @param xos x-offset of scaleC in screen coords (pre-scale)
   * @param yos y-offset of scaleC in screen coords (pre-scale)
   * @param scale0 imitial scale [.5]
   */
  // bindKeysToScale('a', scaleC, 436, 0, .5)
  bindKeysToScale(scaleC: ScaleableContainer2, char: string, xos: number, yos: number, scale0 = .5) {
    const nsA = scale0;
    const apt = { x: xos, y: yos }
    let nsZ = 0.647; //
    const zpt = { x: 120, y: 118 }

    // set Keybindings to reset Scale:
    /** save scale & offsets for later: */
    const saveScaleZ = () => {
      nsZ = scaleC.scaleX;
      zpt.x = scaleC.x; zpt.y = scaleC.y;
    }
    // xy is the fixed point, but is ignored because we set xy directly.
    // sxy is the final xy offset, saved by saveScaleZ()
    const setScaleXY = (ns?: number, sxy: XY = { x: 0, y: 0 }) => {
      scaleC.setScale(ns);
      //console.log({si, ns, xy, sxy, cw: this.canvas.width, iw: this.map_pixels.width})
      scaleC.x = sxy.x; scaleC.y = sxy.y;
      this.stage.update()
    }
    const getOop = () => {
      this.stage.getObjectsUnderPoint(500, 100, 1)
    }

    // Scale-setting keystrokes:
    KeyBinder.keyBinder.setKey("a", { func: () => setScaleXY(nsA, apt) });
    KeyBinder.keyBinder.setKey("z", { func: () => setScaleXY(nsZ, zpt) });
    KeyBinder.keyBinder.setKey("x", { func: () => saveScaleZ() });
    KeyBinder.keyBinder.setKey("p", { func: () => getOop(), thisArg: this});
    KeyBinder.keyBinder.setKey('S-ArrowUp', { thisArg: this, func: this.zoom, argVal: 1.03 })
    KeyBinder.keyBinder.setKey('S-ArrowDown', { thisArg: this, func: this.zoom, argVal: 1/1.03 })
    KeyBinder.keyBinder.setKey('S-ArrowLeft', { thisArg: this, func: this.pan, argVal: {x: -10, y:0} })
    KeyBinder.keyBinder.setKey('ArrowRight', { thisArg: this, func: this.pan, argVal: {x: 10, y: 0} })
    KeyBinder.keyBinder.setKey('ArrowLeft', { thisArg: this, func: this.pan, argVal: {x: -10, y:0} })
    KeyBinder.keyBinder.setKey('S-ArrowRight', { thisArg: this, func: this.pan, argVal: {x: 10, y: 0} })
    KeyBinder.keyBinder.setKey('ArrowUp', { thisArg: this, func: this.pan, argVal: { x: 0, y: -10 } })
    KeyBinder.keyBinder.setKey('ArrowDown', { thisArg: this, func: this.pan, argVal: { x: 0, y: 10 } })

    KeyBinder.keyBinder.dispatchChar(char)
  }
}

class ScaleableContainer2 extends ScaleableContainer {

}
