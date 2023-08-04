import { AT, C, Constructor, Dragger, DragInfo, F, KeyBinder, S, ScaleableContainer, stime, XY } from "@thegraid/easeljs-lib";
import { Container, DisplayObject, EventDispatcher, Graphics, MouseEvent, Shape, Stage, Text } from "@thegraid/easeljs-module";
import { AnkhSource, Guardian } from "./ankh-figure";
import { AnkhHex, AnkhMap } from "./ankh-map";
import { AnkhScenario, ScenarioParser } from "./ankh-scenario";
import { GP, type GamePlay } from "./game-play";
import { Hex, Hex2, HexMap, IHex, RecycleHex } from "./hex";
import { XYWH } from "./hex-intfs";
import { Player } from "./player";
import { PlayerPanel } from "./player-panel";
import { CenterText, CGF, CircleShape, HexShape, Paintable, PaintableShape, RectShape, UtilButton } from "./shapes";
import { PlayerColor, playerColor0, playerColor1, TP } from "./table-params";
import { Tile } from "./tile";
import { TileSource, UnitSource } from "./tile-source";
import { AnkhMarker, AnkhToken } from "./god";
//import { TablePlanner } from "./planner";

function firstChar(s: string, uc = true) { return uc ? s.substring(0, 1).toUpperCase() : s.substring(0, 1) };

interface EventButton extends Container { isEvent: boolean; }
interface EventIcon extends Container { eventName: string; }

/** rowCont is an ActionContainer; each child is a CircleButton Container. */
class ActionContainer extends Container {
  constructor(public rad = 30) {
    super();
    this.highlight = new CircleShape(C.WHITE, this.rad + 5, '');
    this.highlight.name = `highlight`;
    this.addChildAt(this.highlight, 0);
    this.highlight.visible = true;
  }
  highlight: PaintableShape;
  active: DisplayObject; // most recently activated button

  /** activate the first button witout a AnkhMarker */
  activate() {
    const hl = this.highlight;
    const buttons = this.children.filter(c => (c instanceof Container)) as EventButton[]; // minus highlight;
    let button = buttons.find(button => !button.children.find(c => (c instanceof AnkhMarker))) as EventButton;
    if (!button) { // reset after Event!
      buttons.forEach(b => b.removeChildType(AnkhMarker));
      button = buttons[0];
    }
    hl.x = button.x;
    hl.y = button.y;
    hl.visible = button.mouseEnabled = true;
    this.active = button;
    this.stage.update();
    return button;
  }

  deactivate() {
    if (this.active) this.highlight.visible = this.active.mouseEnabled = false;
    this.stage.update();
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
}

class TextLog extends Container {
  constructor(public Aname: string, nlines = 6, public size: number = 30, public lead = 3) {
    super()
    this.lines = new Array<Text>(nlines);
    for (let ndx = 0; ndx < nlines; ndx++) this.lines[ndx] = this.newText(`#0:`)
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
    const text = new Text(line, F.fontSpec(this.size))
    text.textAlign = 'left'
    return text;
  }

  private spaceLines(cy = 0, lead = this.lead) {
    this.lines.forEach(tline => (tline.y = cy, cy += tline.getMeasuredLineHeight() + lead))
  }

  log(line: string, from = '', toConsole = true) {
    line = line.replace('\n', '-');
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

  undoCont: Container = new Container()
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
    this.textLog.log(`#${this.gamePlay.turnNumber}: ${line}`, from); // scrolling lines below
  }
  setupUndoButtons(xOffs: number, bSize: number, skipRad: number, bgr: XYWH, row = 4, col = -9) {
    const undoC = this.undoCont; undoC.name = "undo buttons"; // holds the undo buttons.
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
        const hex = this.hexUnderObj(qShape);
        qShape.x = 0; qShape.y = qY; // return to regular location
        cont.addChild(qShape);
        if (!hex) return;
        const info = hex; //{ hex, stone: hex.playerColor, InfName }
        console.log(`HexInspector:`, hex.Aname, info)
      })
    qShape.on(S.click, () => this.toggleText(), this); // toggle visible
    this.toggleText(false);         // set initial visibility
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
      let cont = new Container
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
    let bpanel = new Container()
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

    this.makeActionCont();
    this.makeEventCont();
    this.makeScoreCont();
    this.makePerPlayer();

    this.gamePlay.recycleHex = this.makeRecycleHex();
    this.setupUndoButtons(55, 60, 45, bgr) // & enableHexInspector()

    this.hexMap.update();
    // position turnLog & turnText
    {
      const parent = this.scaleCont, n = TP.nHexes + 2, colx = -14;
      this.setToRowCol(this.turnLog, 6, colx);
      this.setToRowCol(this.bagLog, 6, colx);
      this.setToRowCol(this.textLog, 6, colx);
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

  readonly panelForPlayer: PlayerPanel[] = [];
  makePerPlayer(c0 = -7.4, c1 = TP.nHexes + .9, r0 = -.3, dr = 3.4) {
    const panelLocs = [[r0, c0], [r0 + dr, c0], [r0 + 2 * dr, c0], [r0, c1], [r0 + dr, c1]];
    const seq = [[], [0], [0, 3], [0, 3, 1], [0, 3, 4, 1], [0, 3, 4, 2, 1]];
    const np = Player.allPlayers.length, seqn = seq[np];
    this.panelForPlayer.length = 0; // TODO: maybe deconstruct
    Player.allPlayers.forEach((p, pIndex) => {
      const ndx = seqn[pIndex];
      const [row, col] = panelLocs[ndx];
      this.panelForPlayer[pIndex] = new PlayerPanel(this, p, row, col, ndx < 3 ? -1 : 1);
      p.makePlayerBits();
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
    source.counter.mouseEnabled = false;
    hex.legalMark.setOnHex(hex);
    hex.cont.visible = false;
  }

  makeCircleButton(color = C.WHITE, rad = 20, c?: string, fs = 30) {
    const button = new Container();
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
    const button = new Container();
    const shape = new RectShape(xywh, color, '');
    button.addChild(shape);
    if (c) {
      const t = new CenterText(c, fs); t.y += 2;
      button.addChild(t);
    }
    shape.mouseEnabled = false;
    return button;
  }

  makeRecycleHex(row = 7, col = TP.nHexes + 6) {
    const name = 'Recycle'
    const image = new Tile(name).addImageBitmap(name); // ignore Tile, get image.
    image.y = -TP.hexRad / 2; // recenter

    const rHex = this.newHex2(row, col, name, RecycleHex);
    this.setToRowCol(rHex.cont, row, col);
    rHex.rcText.visible = rHex.distText.visible = false;
    rHex.setHexColor(C.WHITE);
    rHex.cont.addChild(image);
    rHex.cont.updateCache();
    return rHex;
  }
  guardSources: AnkhSource<Guardian>[] = [];
  makeGuardSources(row = 7, col = TP.nHexes + 1.7) {
    const guards = this.gamePlay.guards;
    guards.forEach((guard, i) => { // .filter((g, i) => i > 0)
      const ci = col + i * 1.25;
      const hex = this.newHex2(row, ci, `gs-${i}`, AnkhHex);
      this.setToRowCol(hex.cont, row, ci);
      const np = Player.allPlayers.length;
      const n = [[0],[1,1,1],[1,1,1],[2,2,2],[3,2,2],[3,2,2],[3,2,2]][np][i];
      const source = Guardian.makeSource(hex, guard, n);
      this.guardSources.push(source);
      this.sourceOnHex(source, hex);
    });
  }

  actionPanels: ActionContainer[] = [];
  actionRows = [{ id: 'Move' }, { id: 'Summon' }, { id: 'Gain' }, { id: 'Ankh', dn: -1 }];
  makeActionCont(row = TP.nHexes -2, col = TP.nHexes + 1.6) {
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
      const nc = np + 2 + (actionRow.dn ?? 0), dx = wide / (nc - 1), id = actionRow.id;
      const rowCont = new ActionContainer(rad);
      rowCont.name = `rowCont-${id}`;
      rowCont.y = rn * rh;
      actionCont.addChild(rowCont);
      const k = firstChar(actionRow.id);
      for (let cn = 0; cn < nc; cn++) {
        // make ActionSelectButton:
        const color = (cn < nc - 1) ? C.lightgrey : C.coinGold;
        const button = this.makeCircleButton(color, rad, k) as EventButton;
        button.name = `${id}-${cn}`;
        button.isEvent = (cn === nc - 1);
        button.x = cn * dx;
        rowCont.addChild(button);
        button.on(S.click, (evt: Object) => this.selectAction(id, button, cn), this);
      }
      this.actionPanels[actionRow.id] = rowCont;
    });
    this.addDoneButton(actionCont, rh)
  }

  undoActionSelection(action: string, index: number) {
    const rowCont = this.actionPanels[action] as ActionContainer;
    if (!rowCont) debugger;    // TODO: undo 'Ankh' [isEvent!] -> 'Gain' -> direct to Event!
    const button = rowCont.children.filter(ch => ch instanceof Container)[index] as EventButton;
    button.removeChildType(AnkhMarker);
    if (button.isEvent) {
      const index = this.nextEventIndex - 1;
      this.eventCells[index].removeChildType(AnkhMarker);
    }
    rowCont.activate();;
  }

  get nextEventIndex() { return this.eventCells.findIndex(ec => !ec.children.find(c => (c instanceof AnkhMarker)))}
  /** mark Action as selected, inform GamePlay & phaseDone() */
  selectAction (id: string, button: EventButton, index: number) {
    this.gamePlay.selectedAction = id;
    this.gamePlay.selectedActionIndex = index;
    if (button.isEvent) {
      const index = this.nextEventIndex;
      const cell = this.eventCells[index];
      const ankhToken = this.gamePlay.curPlayer.god.getAnkhToken(TP.ankhRad);
      cell.addChild(ankhToken)
      this.gamePlay.eventName = cell.eventName;
    }
    this.activateActionSelect(false, id); // de-activate this row and the ones above.
    const { x, y, width, height } = button.getBounds()
    const ankhToken = this.gamePlay.curPlayer.god.getAnkhToken(width / 2);
    button.addChild(ankhToken);
    button.stage.update();
    GP.gamePlay.phaseDone(); // --> phase(selectedAction)
  }

  activeButtons: {[index: string]: [EventButton, number]} = {}
  /**
   * On each row: activate or deactivate the first button without an AnkhMarker on each line.
   * If a row is 'full' (previous Event) it is reset to the beginning.
   *
   * @return false if no buttons were activated (after == 'Ankh')
   */
  activateActionSelect(activate: boolean, after?: string, cat = false) {
    let isAfter = (after === undefined);
    let active = 0;
    this.activeButtons = {};
    this.actionRows.map(({id, dn}, cn) => {
      const rowCont = this.actionPanels[id] as ActionContainer;
      if (!activate) { rowCont.deactivate() } // mouseEnable
      else if (isAfter) { this.activeButtons[id]= [rowCont.activate(), cn]; active++; }
      isAfter = isAfter || id === after;
    })
    if (cat) {
      // [de]activate 'Cat' & 'Pass' buttons..?
    }
    // this.doneButton.visible = this.doneButton.mouseEnabled = true;
    return active > 0;
  }

  doneButton: UtilButton;
  doneClicked = (evt?) => {
    this.activateActionSelect(false); // deactivate all
    GP.gamePlay.phaseDone();
  }
  addDoneButton(actionCont: Container, rh: number) {
    const w = 90, h = 56;
    const doneButton = this.doneButton = new UtilButton('lightgreen', 'Done', 36, C.black);
    doneButton.x = -(w + 10);
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

  eventCells: EventIcon[] = [];
  makeEventCont(row = TP.nHexes + 0.5, col = 7.05) {
    const eventCont = new Container();
    this.hexMap.mapCont.resaCont.addChild(eventCont);
    this.setToRowCol(eventCont, row, col);
    const events = [
      'Claim', 'Claim', 'Claim', 'Conflict',
      'Split', 'Claim', 'Claim', 'Conflict',
      'Split', 'Claim', 'Claim', 'Conflict', 'merge',
      'Split', 'Claim', 'Claim', 'Conflict', 'redzone',
      'Claim', 'Conflict',
    ];
    const lf = false, rad = TP.ankhRad, gap = 5, dx = 2 * rad + gap, bx = .5;
    let cx = 0;
    events.forEach((evt, nth) => {
      const icon = new Container() as EventIcon;
      icon.eventName = evt;
      const k = (evt === 'Conflict') ? 'B' : firstChar(evt);
      const shape = new CircleShape('rgb(240,240,240)', rad, );
      const text = new CenterText(k, rad * 1.8); text.y += 2;
      if (lf && Math.floor(cx) === 8) cx = Math.floor(cx);
      const row = lf ? Math.min(1, Math.floor(Math.floor(cx) / 8)) : 0;
      icon.y = row * dx;
      icon.x = ((row == 0) ? cx : cx - 8 ) * dx;
      cx += 1;
      if (k === 'B') {
        cx += bx;  // extra gap after Conflict
      }
      if (k === 'M' || k === 'R') {
        icon.y += dx;
        cx -= 1;
        shape.graphics.c().f('brown').dr(-rad, -rad * 3 - 2 * gap, 2 * rad, 4 * rad + 2 * gap);
      } else {
        this.eventCells.push(icon);
      }
      icon.addChild(shape);
      icon.addChild(text);
      eventCont.addChild(icon);
    })
    return eventCont;
  }

  readonly emptyColor = 'rgb(240,240,240)';
  makeScoreCont(row = TP.nHexes + .2, col = -7.2, np = Player.allPlayers.length, w = 34) {
    const redzone = 'rgb(230,100,100)', empty = this.emptyColor, win = C.lightgreen;
    const scoreCont = new Container()
    this.hexMap.mapCont.resaCont.addChild(scoreCont);
    this.setToRowCol(scoreCont, row, col);
    const h = 20, gap = 5, dx = w + gap, x = -w / 2, y = -h / 2, rz = 20, ym = (np - 1) * h;
    scoreCont.y += (5 - np) * np * h / 5;
    const bg1 = new Shape();
    bg1.graphics.f(redzone).dr(x - gap, y - gap, rz * dx + gap, np * h + 2 * gap);
    scoreCont.addChild(bg1);
    const bg2 = new Shape();
    bg1.graphics.f(win).dr(x + 31 * dx - gap, y - gap, dx + gap, np * h + 2 * gap);
    scoreCont.addChild(bg2);
    for (let cn = 0; cn < 32; cn++) {   // a value for 'score'
      for (let pn = 0; pn < np; pn++) { // rank of player at that score
        const box = new Shape() as ScoreShape;
        box.x = cn * dx;
        box.y = ym - pn * h;
        scoreCont.addChild(box);
        if (!this.scoreCells[cn]) this.scoreCells[cn] = [];
        this.scoreCells[cn][pn] = box;
        this.drawBox(box, empty);
      }
    }
    return scoreCont;
  }
  scoreCells: ScoreShape[][] = [[]];
  drawBox(box: ScoreShape, color: string) {
    const w = 36, h = 20, x = -w/2, y = -h/2, rz = 20;
    box.color = color;
    box.graphics.f(color).s(C.black).dr(x, y, w, h);
  }

  setPlayerScore(plyr: Player, score: number) {
    const s1 = Math.min(score, 31);
    const empty = this.emptyColor;
    const s0 = plyr.score;
    const stack0 = this.scoreCells[s0], np = Player.allPlayers.length;
    const ndx0 = stack0.findIndex(box => box.color === plyr.color);
    if (ndx0 > 0) {
      this.drawBox(stack0[ndx0], empty);
      for (let i = ndx0 + 1; i < np; i++) {
        if (stack0[i].color === empty) break;
        const color = stack0[i].color;
        this.drawBox(stack0[i - 1], color);
        this.drawBox(stack0[i], empty);
      }
    }
    const stack1 = this.scoreCells[s1];
    for (let i = 0; i < np; i++) {
      if (stack1[i].color !== empty) continue;
      this.drawBox(stack1[i], plyr.color);
      plyr.score = score + i / 10; // record decimal score, for sort order;
      break;
    }
  }

  startGame(sname: string) {
    const np = Player.allPlayers.length;
    const scenario = AnkhScenario[sname][np-2];
    new ScenarioParser(this.hexMap as AnkhMap<AnkhHex>).parseScenario(scenario);

    // All Tiles (& Meeple) are Draggable:
    Tile.allTiles.forEach(tile => {
      this.makeDragable(tile);
    })

    this.gamePlay.forEachPlayer(p => {
      // p.initialHex.forEachLinkHex(hex => hex.isLegal = true, true )
      // this.hexMap.update();
      // // place Town on hexMap
      // p.initialHex.forEachLinkHex(hex => hex.isLegal = false, true )
      this.toggleText(false)
    })
    // this.stage.enableMouseOver(10);
    this.scaleCont.addChild(this.overlayCont); // now at top of the list.
    this.gamePlay.setNextPlayer(this.gamePlay.allPlayers[0]);
    this.gamePlay.gameState.start();   // enable Table.GUI to drive game state.
  }

  makeDragable(tile: Tile) {
    const dragger = this.dragger;
    dragger.makeDragable(tile, this, this.dragFunc, this.dropFunc);
    dragger.clickToDrag(tile, true); // also enable clickToDrag;
  }

  hexUnderObj(dragObj: DisplayObject) {
    const pt = dragObj.parent.localToLocal(dragObj.x, dragObj.y, this.hexMap.mapCont.markCont);
    return this.hexMap.hexUnderPoint(pt.x, pt.y);
  }

  dragContext: DragContext;
  dragFunc(tile: Tile, info: MinDragInfo) {
    const hex = this.hexUnderObj(tile); // clickToDrag 'snaps' to non-original hex!
    this.dragFunc0(tile, info, hex);
  }

  /** interpose inject drag/start actions programatically */
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
      tile.fromHex = tile.hex as Hex2;  // dragStart: set tile.fromHex
      ctx = {
        tile: tile,                  // ASSERT: hex === tile.hex
        targetHex: tile.fromHex,     // last isLegalTarget() or fromHex
        lastShift: event?.shiftKey,
        lastCtrl:  event?.ctrlKey,
        info: info,
        nLegal: 0,
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
      console.log(stime(this, `.dragStart: ${reason}: ${tile},`), 'ctx=',{...ctx});
      this.logText(`${reason}: ${tile}`, 'Table.dragStart');
      this.stopDragging();
    } else {
      // mark legal targets for tile; SHIFT for all hexes, if payCost
      const hexIsLegal = (hex: Hex2) => ctx.nLegal += ((hex !== tile.hex) && (hex.isLegal = tile.isLegalTarget(hex, ctx)) ? 1 : 0);
      tile.markLegal(this, hexIsLegal, ctx);           // delegate to check each potential target
      this.gamePlay.recycleHex.isLegal = tile.isLegalRecycle(ctx); // do not increment ctx.nLegal!
      tile.moveTo(undefined); // notify source Hex, so it can scale; also triggers nextUnit !!
      tile.dragStart(ctx);  // which *could* reset nLegal ?
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
    const info = { turn: `#${tn}`, plyr: plyr.Aname, prev, gamePlay: this.gamePlay, curPlayer: plyr }
    console.log(stime(this, `.logCurPlayer --${robo}--`), info);
    this.logTurn(`#${tn}: ${plyr.Aname}`);
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

  dispatchPressup(target: DisplayObject, ctd = true) { return this.dragger.getDragData(target)  }
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
    const zpt = { x: 120, y: 104 }

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
  /**
   * set scale exactly; set scale index approximately and return it.
   * @param ns new scale
   * @param xy scale around this point (so 'p' does not move on display) = {0,0}
   * @param sxy move to offset? in new coords?
   * @returns the nearby scaleNdx
   */
  setScale(ns = 1.0, xy: XY = { x: 0, y: 0 }, sxy: XY = { x: 0, y: 0 }): number {
    this.getScale(this.findIndex(ns)); // close appx, no side effects.
    this.scaleInternal(this.scaleX, ns, xy);
    return ns;
  }
  override scaleContainer(di: number, xy?: XY): number {
    let os = this.scaleX;   // current -> old / original scale
    let ns = this.incScale(di);
    if (di == 0) { os = 0; ns = this.getScale(this.initIndex) }
    return this.scaleInternal(os, ns, xy);
  }
}
