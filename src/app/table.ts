import { AT, C, Constructor, Dragger, DragInfo, F, KeyBinder, S, ScaleableContainer, stime, XY } from "@thegraid/easeljs-lib";
import { Container, DisplayObject, Event, EventDispatcher, Graphics, MouseEvent, Shape, Stage, Text } from "@thegraid/easeljs-module";
import type { GamePlay } from "./game-play";
import { Hex, Hex2, HexMap, IHex, RecycleHex } from "./hex";
import { H, HexDir, XYWH } from "./hex-intfs";
import { Player } from "./player";
import { CenterText, CircleShape, HexShape, RectShape } from "./shapes";
import { PlayerColor, playerColor0, playerColor1, TP } from "./table-params";
import { NoDragTile, Tile } from "./tile";
import { God } from "./god";
//import { TablePlanner } from "./planner";

function firstChar(s: string, uc = true) { return uc ? s.substring(0, 1).toUpperCase() : s.substring(0, 1) };

interface ScoreShape extends Shape {
  color: string;
}
interface AnkhPowerInfo {
  button: Shape;
  ankhs: DisplayObject[];
  radius?: number;
  name?: string;
}

interface AnkhPowerCont extends Container {
  ankhs: DisplayObject[];
  guardian: number;
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
  scaleCont: Container
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

  constructor(stage: Stage) {
    super();

    // backpointer so Containers can find their Table (& curMark)
    Table.table = (stage as StageTable).table = this;
    this.stage = stage
    this.scaleCont = this.makeScaleCont(!!this.stage.canvas) // scaleCont & background
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
  setupUndoButtons(xOffs: number, bSize: number, skipRad: number, bgr: XYWH, row = TP.nHexes, col = -8) {
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
    const qShape = new HexShape(TP.hexRad/3, 'N');
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

  set showCap(val) { (this.hexMap.mapCont.capCont.visible = val)}
  get showCap() { return this.hexMap.mapCont.capCont.visible}

  set showInf(val) { (this.hexMap.mapCont.infCont.visible = val) ? this.markAllSacrifice() : this.unmarkAllSacrifice() }
  get showInf() { return this.hexMap.mapCont.infCont.visible }
  _showSac = true
  get showSac() { return this._showSac }
  set showSac(val: boolean) { (this._showSac = val) ? this.markAllSacrifice() : this.unmarkAllSacrifice() }
  markAllSacrifice() {}
  unmarkAllSacrifice() {}

  downClick = false;
  isVisible = false;
  /** method invokes closure defined in enableHexInspector. */
  toggleText(vis?: boolean) {
    if (this.downClick) return (this.downClick = false, undefined) // skip one 'click' when pressup/dropfunc
    if (vis === undefined) vis = this.isVisible = !this.isVisible;
    Tile.allTiles.forEach(tile => tile.textVis(vis));
    this.homeRowHexes.forEach(hex => hex.showText(vis));
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

  // pIndex = 2 for non-player Hexes (auctionHexes, crimeHex)
  readonly homeRowHexes: Hex2[] = [];
  leaderHexes: Hex2[][] = [[], []]; // per player

  newHex2(row = 0, col = 0, name: string, claz: Constructor<Hex2> = Hex2, sy = 0) {
    const hex = new claz(this.hexMap, row, col, name);
    hex.distText.text = name;
    if (row <= 0) {
      hex.y += (sy + row * .5 - .75) * (this.hexMap.radius);
    }
    return hex
  }

  noRowHex(name: string, crxy: { row: number, col: number }, claz?: Constructor<Hex2>) {
    const { row, col } = crxy;
    const hex = this.newHex2(row, col, name, claz);
    return hex;
  }

  // row typically 0 or -1; sy[row=0]: 0, -1, -2;
  homeRowHex(name: string, crxy: { row: number, col: number }, sy = 0, claz?: Constructor<Hex2>) {
    const { row, col } = crxy;
    const hex = this.newHex2(row, col, name, claz, sy);
    this.homeRowHexes.push(hex);
    hex.legalMark.setOnHex(hex);
    return hex;
  }

  layoutTable(gamePlay: GamePlay) {
    this.gamePlay = gamePlay
    const hexMap = this.hexMap = gamePlay.hexMap as HexMap<Hex2>;
    hexMap.addToMapCont(Hex2);               // addToMapCont; make Hex2
    hexMap.makeAllDistricts();               //
    // hexCont is offset to be centered on mapCont (center of hexCont is at mapCont[0,0])
    // mapCont is offset [0,0] to scaleCont
    const mapCont = hexMap.mapCont, hexCont = mapCont.hexCont; // local reference
    this.scaleCont.addChild(mapCont);

    // background sized for hexMap:
    const { width: rw, height: rh } = hexCont.getBounds();
    const rowh = hexMap.rowHeight, colw = hexMap.colWidth;
    const bgr: XYWH = { x: -2 * colw, y: 0, w: rw + 14 * colw, h: rh + .5 * rowh }
    // align center of mapCont(0,0) == hexMap(center) with center of background
    mapCont.x = bgr.x + (bgr.w) / 2;
    mapCont.y = bgr.y + (bgr.h) / 2;
    bgr.h += 1.5 * rowh;

    this.bgRect = this.setBackground(this.scaleCont, bgr); // bounded by bgr
    const p00 = this.scaleCont.localToLocal(bgr.x, bgr.y, hexCont);
    const pbr = this.scaleCont.localToLocal(bgr.w, bgr.h, hexCont);
    hexCont.cache(p00.x, p00.y, pbr.x - p00.x, pbr.y - p00.y); // cache hexCont (bounded by bgr)

    this.homeRowHexes.length = 0;

    this.makeActionCont();
    this.makeEventCont();
    this.makeScoreCont();
    this.makePerPlayer();

    this.gamePlay.recycleHex = this.makeRecycleHex(TP.nHexes, TP.nHexes);
    this.setupUndoButtons(55, 60, 45, bgr) // & enableHexInspector()

    this.hexMap.update();
    // position turnLog & turnText
    {
      const parent = this.scaleCont, n = TP.nHexes + 2;
      const lhex = this.hexMap.getCornerHex('SW');
      let rhex = lhex.links['N'] as Hex2;
      const {x, y, w, h, dxdc, dydr } = this.hexMap.centerHex.xywh();
      let rhpt = rhex.cont.parent.localToLocal(rhex.x - n * dxdc, rhex.y, parent)
      this.bagLog.x = rhpt.x; this.bagLog.y = rhpt.y - this.turnLog.height(1);;
      this.turnLog.x = rhpt.x; this.turnLog.y = rhpt.y;
      this.textLog.x = rhpt.x; this.textLog.y = rhpt.y + this.turnLog.height(Player.allPlayers.length + 1);

      parent.addChild(this.bagLog, this.turnLog, this.textLog);
      parent.stage.update()
    }

    this.on(S.add, this.gamePlay.playerMoveEvent, this.gamePlay)[S.Aname] = "playerMoveEvent"
  }

  makeRecycleHex(row = TP.nHexes + 1.5, col = TP.nHexes) {
    const name = 'Recycle'
    const image = new Tile(name).addImageBitmap(name); // ignore Tile, get image.
    image.y = -TP.hexRad / 2; // recenter

    const rHex = this.newHex2(row, col, name, RecycleHex);
    rHex.rcText.visible = rHex.distText.visible = false;
    rHex.setHexColor(C.WHITE);
    rHex.cont.addChild(image);
    rHex.cont.updateCache();
    return rHex;
  }

  // col locations, left-right mirrored:
  colf(pIndex: number, icol: number, row: number) {
    const dc = 10 - Math.abs(row) % 2;
    const col = (pIndex == 0 ? (icol) : (dc - icol));
    return { row, col };
  }

  makePerPlayer() {
    this.panelForPlayer.length = 0; // TODO: maybe deconstruct
    Player.allPlayers.forEach((p, pIndex) => {
      this.makePlayerPanel(p);
      p.makePlayerBits();
      const colf = (col: number, row: number) => this.colf(pIndex, col, row);

      {
        // Win indicators:
        const parent = this.hexMap.mapCont.capCont;
        const cont = this.winIndForPlayer[pIndex] = new Container();
        const refHex = this.hexMap.centerHex;
        const { x, y, w, h } = refHex.xywh();
        const x0 = x - 3 * w * (1 - 2 * pIndex);
        const y0 = y - 8 * this.hexMap.rowHeight;
        refHex.cont.parent.localToLocal(x0, y0, parent, cont);
        parent.addChild(cont);
      }
    });
  }
  readonly winIndForPlayer: Container[] = [];

  setToRowCol(cont: Container, row = 0, col = 0) {
    if (!cont.parent) this.scaleCont.addChild(cont);
    const hexC = this.hexMap.centerHex;
    const fcol = Math.floor((col)), ecol = fcol - fcol % 2, cresi = col - ecol;
    const frow = Math.floor((row)), erow = frow - frow % 2, rresi = row - erow;
    const { x, y, w, h, dxdc, dydr } = hexC.xywh(undefined, undefined, erow, ecol);
    const xx = x + cresi * dxdc;
    const yy = y + rresi * dydr;
    this.hexMap.mapCont.hexCont.localToLocal(xx, yy, cont.parent, cont);
  }

  readonly panelForPlayer: Container[] = [];
  readonly panelLocs = [[0-.2, -6.5], [3.6, -6.5], [7.5, -6.5], [0-.2, TP.nHexes-.5], [3.6, TP.nHexes-.5]];
  /** per player buttons to invoke GamePlay */
  makePlayerPanel(player: Player) {
    const index = player.index;
    const god = player.god;
    const row = this.panelLocs[index][0], col = this.panelLocs[index][1];
    const panel = this.panelForPlayer[index] = new Container();
    this.setToRowCol(panel, row , col);
    const ankhPowers = [
      ['Commanding', 'Inspiring', 'Omnipresent', 'Revered'],  // rank 0
      ['Resplendent', 'Obelisk', 'Temple', 'Pyramid'],        // rank 1
      ['Glorious', 'Magnanimous', 'Bountiful', 'Worshipful'], // rank 2
    ];
    const { x, y, w, h, dydr } = this.hexMap.centerHex.xywh();
    const wide = 590, high = dydr * 3.7, brad = god.radius, gap = 6, rowh = 2 * brad + gap, colWide = 190;
    const g = new Graphics().ss(5);
    const outline = new RectShape({ x: 0, y: -(brad + gap), w: wide, h: high }, '', god.color, g);
    panel.addChild(outline);
    const onClick = (evt: Object, info: AnkhPowerInfo) => {
      const god = player.god, ankh = info.ankhs.shift();
      if (!ankh) return;
      ankh.x = 0; ankh.y = 0;
      god.ankhPowers.push(info.name);
      console.log(stime(this, `.onClick: ankhPowers =`), god.ankhPowers, info.button.id);
      const parent = info.button.parent;
      const powerCont = parent.parent as AnkhPowerCont;
      parent.addChild(ankh);
      parent.stage.update();
      if (powerCont.guardian === info.ankhs.length) {
        console.log(stime(this, `.onClick: takeGuardian powerCont =`), powerCont, powerCont.guardian, info.ankhs);
        // TODO: take Guardian (move to god.stable)
      }
    }
    // Ankh Powers: circle + text
    ankhPowers.forEach((ary, rank) => {
      const colCont = new Container() as AnkhPowerCont;
      panel.addChild(colCont);
      // TODO: take from god.ankhSource; store for multi-click
      const ankhs = [god.getAnhkToken(), god.getAnhkToken()];
      ankhs.forEach((ankh, i) => {
        ankh.x = 30 + i * (2 * brad + gap);
        ankh.y = 4 * rowh;
      });
      colCont.guardian = (rank < 2) ? 0 : 1;
      colCont.ankhs = ankhs;
      colCont.addChild(...ankhs);
      colCont.x = rank * colWide;

      // place powerLines:
      ary.forEach((name, nth) => {
        const powerLine = new Container();
        const button = new CircleShape(brad, C.white, );
        button.on(S.click, onClick as any, this, false, { button, name, ankhs });
        powerLine.addChild(button);
        const text = new CenterText(name, brad);
        text.textAlign = 'left';
        text.x = brad + gap;
        powerLine.addChild(text);
        powerLine.x = brad + gap;
        powerLine.y = nth * rowh;
        colCont.addChild(powerLine);
      })
    });
    // Stable:
    const stableCont = new Container();
    const srad1 = 32, srad2 = 40, dir = (index < 3) ? -1 : 1;
    const x0 = [wide - (srad1 + 3 * gap), srad1 + 2 * gap][(1 + dir) / 2];
    const sgap = 1.25 * srad2;
    const swide = 2 * (srad1 + srad2 + sgap + sgap);
    stableCont.y = 5.5 * rowh;
    panel.addChild(stableCont);
    const sourceInfo = [srad1, srad1, srad2, srad2, ]; // size for each type: Warrior, G1, G2, G3
    sourceInfo.forEach((radi, i) => {
      const g0 = new Graphics().ss(1).sd([5, 5]);
      const circle = new CircleShape(radi + 1, 'lightgrey', god.color, g0);
      // circle.graphics.f('').dc(0, 0, radi + 1);
      circle.x = x0 + dir * i * (radi + sgap);
      stableCont.addChild(circle);
    });
    // Special:
    const swidth = 200;
    const specl = god.makeSpecial({ width: swidth, height: srad2 * 2 });
    specl.y = 5.5 * rowh - srad2;
    specl.x = ((dir + 1) / 2) * (wide - swide + brad) - (brad / 2); // [(wide-swide-brad/2) , -brad/2, ]
    specl.x = [ gap, wide -swidth - (1*gap), ][(1 + dir) / 2]
    panel.addChild(specl)
    // amun special area

  }

  makeButton(color = C.WHITE, rad = 20, c?: string) {
    const button = new Container();
    const shape = new CircleShape(rad, color, '');
    button.addChild(shape);
    if (c) {
      const t = new CenterText(c, rad); t.y += 2;
      button.addChild(t);
    }
    shape.mouseEnabled = true;
    return button;
  }

  actionPanels: { [index: string]: Container } = {};
  makeActionCont(row = TP.nHexes - 2, col = TP.nHexes) {
    const np = Player.allPlayers.length, rad = 30, wide = (2 * rad + 5) * (np + 1), rh = 2 * rad + 5;
    console.log(stime(this, `.makeActionCont`), np);
    // TODO: class actionCont, with slots to hold button & each circle/state (number activated)
    // or could use children[] and the color/visiblity of each shape/cont
    const actionCont = new Container()
    this.setToRowCol(actionCont, row, col);
    const actionRows = [{ id: 'Move' }, { id: 'Summon ' }, { id: 'Gain' }, { id: 'Ankh', dn: -1 }];
    const selectAction = (id: string, button: Container) => {
      this.gamePlay.selectedAction = id;
      const ankh = this.gamePlay.curPlayer.god.getAnhkToken(rad);
      button.addChild(ankh);
      button.mouseEnabled = false;
      button.stage.update();
    }
    //for (let rn = 0; rn < actionRows.length; rn++) {
    actionRows.forEach((action, rn) => {
      const nc = np + 2 + (action.dn ?? 0), dx = wide/(nc-1), id = action.id;
      const rowCont = new Container();
      rowCont.y = rn * rh;
      actionCont.addChild(rowCont);
      const k = firstChar(action.id);
      for (let cn = 0; cn < nc; cn++) {
        const color = (cn < nc - 1) ? C.lightgrey : C.white;
        const t = (cn < nc - 1) ? k : 'E';
        const button = this.makeButton(color, rad, t);
        button.x = cn * dx;
        rowCont.addChild(button);
        if (cn == nc - 1) { button['isEvent'] = true; }
        button.on(S.click, (evt: Object) => selectAction(id, button));
      }
      this.actionPanels[action.id] = rowCont;
    });
    return actionCont;
  }

  makeEventCont(row = TP.nHexes + 1.5, col = TP.nHexes) {
    const eventCont = new Container();
    this.setToRowCol(eventCont, row, col);
    const events = [
      'claim', 'claim', 'claim', 'battle',
      'split', 'claim', 'claim', 'battle',
      'split', 'claim', 'claim', 'battle', 'merge',
      'split', 'claim', 'claim', 'battle', 'redzone',
      'claim', 'battle',
    ];
    const x0 = 0, y = 0, rad = TP.anhkRad, gap = 5, dx = 2 * rad + gap;
    let cx = 0;
    events.forEach((evt, nth) => {
      const icon = new Container();
      const k = firstChar(evt);
      const shape = new CircleShape(rad, 'rgb(240,240,240)');
      const text = new CenterText(k, rad * 1.8); text.y += 2;
      if (Math.floor(cx) === 8) cx = Math.floor(cx);
      const row = Math.min(1, Math.floor(Math.floor(cx) / 8));
      icon.y = row * dx;
      icon.x = x0 + ((row == 0) ? cx : cx - 8 ) * dx;
      cx += 1;
      if (k === 'B') {
        cx += .4;
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
  eventCells: Container[] = [];

  readonly emptyColor = 'rgb(240,240,240)';
  makeScoreCont(row = TP.nHexes + 1.5, col = -5, np = Player.allPlayers.length) {
    const redzone = 'rgb(230,100,100)', empty = this.emptyColor, win = C.lightgreen;
    const scoreCont = new Container()
    this.setToRowCol(scoreCont, row, col);
    const w = 36, h = 20, gap = 5, dx = w + gap, x = -w / 2, y = -h / 2, rz = 20, ym = (np - 1) * h;
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
      break;
    }
  }

  makeDragable(tile: Tile) {
    const dragger = this.dragger;
    dragger.makeDragable(tile, this, this.dragFunc, this.dropFunc);
    dragger.clickToDrag(tile, true); // also enable clickToDrag;
  }

  startGame() {
    // initialize Players & TownStart & draw pile
    // All Tiles (Civics, Resi, Busi, PStation, Lake, & Meeple) are Draggable:
    Tile.allTiles.filter(tile => !(tile instanceof NoDragTile)).forEach(tile => {
      this.makeDragable(tile);
    })

    this.gamePlay.forEachPlayer(p => {
      // p.initialHex.forEachLinkHex(hex => hex.isLegal = true, true )
      // this.hexMap.update();
      // // place Town on hexMap
      // p.initialHex.forEachLinkHex(hex => hex.isLegal = false, true )
      this.toggleText(false)
    })
    this.gamePlay.setNextPlayer(this.gamePlay.allPlayers[0])
  }

  hexUnderObj(dragObj: DisplayObject) {
    const pt = dragObj.parent.localToLocal(dragObj.x, dragObj.y, this.hexMap.mapCont.hexCont);
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
      ctx = this.dragContext = {
        tile: tile,                  // ASSERT: hex === tile.hex
        targetHex: tile.fromHex,     // last isLegalTarget() or fromHex
        lastShift: event?.shiftKey,
        lastCtrl:  event?.ctrlKey,
        info: info,
        nLegal: 0,
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
    if (shiftKey !== ctx.lastShift || ctx.targetHex !== hex) {
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
  /** makeScaleableBack and setup scaleParams
   * @param bindkeys true if there's a GUI/user/keyboard
   */
  makeScaleCont(bindKeys: boolean): ScaleableContainer {
    /** scaleCont: a scalable background */
    const scaleC = new ScaleableContainer(this.stage, this.scaleParams);
    this.dragger = new Dragger(scaleC);
    this.dragger.dragTarget = this.dragTargetPatch; // PATCH until next easeljs-lib
    if (!!scaleC.stage.canvas) {
      // Special case of makeDragable; drag the parent of Dragger!
      this.dragger.makeDragable(scaleC, scaleC, undefined, undefined, true); // THE case where not "useDragCont"
      //this.scaleUp(Dragger.dragCont, 1.7); // Items being dragged appear larger!
    }
    if (bindKeys) {
      this.bindKeysToScale("a", scaleC, 820, 10);
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
  /**
   * @param xos x-offset-to-center in Original Scale
   * @param xos y-offset-to-center in Original Scale
   * @param scale Original Scale
   */
  // bindKeysToScale(scaleC, 800, 0, scale=.324)
  bindKeysToScale(char: string, scaleC: ScaleableContainer, xos: number, yos: number) {
    let ns0 = scaleC.getScale(), sXY = { x: -scaleC.x, y: -scaleC.y } // generally == 0,0
    let nsA = scaleC.findIndex(.5), apt = { x: -xos, y: -yos }
    let nsZ = scaleC.findIndex(ns0), zpt = { x: -xos, y: -yos }

    // set Keybindings to reset Scale:
    /** xy in [unscaled] model coords; sxy in screen coords */
    const setScaleXY = (si?: number, xy?: XY, sxy: XY = sXY) => {
      let ns = scaleC.setScaleXY(si, xy, sxy)
      //console.log({si, ns, xy, sxy, cw: this.canvas.width, iw: this.map_pixels.width})
      this.stage.update()
    }
    let setScaleZ = () => {
      ns0 = scaleC.getScale()
      nsZ = scaleC.findIndex(ns0)
      zpt = { x: -scaleC.x/ns0, y: -scaleC.y/ns0 }
    };
    let goup = () => {
      this.stage.getObjectsUnderPoint(500, 100, 1)
    }

    // Scale-setting keystrokes:
    KeyBinder.keyBinder.setKey("x", { func: () => setScaleZ() });
    KeyBinder.keyBinder.setKey("z", { func: () => setScaleXY(nsZ, zpt) });
    KeyBinder.keyBinder.setKey("a", { func: () => setScaleXY(nsA, apt) });
    KeyBinder.keyBinder.setKey("p", { func: () => goup(), thisArg: this});
    KeyBinder.keyBinder.dispatchChar(char)
  }
}
