import { Constructor, json } from "@thegraid/common-lib";
import { KeyBinder, S, Undo, stime } from "@thegraid/easeljs-lib";
import { EzPromise } from "@thegraid/ezpromise";
import { Guardian } from "./ankh-figure";
import { AnkhHex, AnkhMap } from "./ankh-map";
import { ActionIdent, Scenario, ScenarioParser } from "./ankh-scenario";
import type { GameSetup } from "./game-setup";
import { GameState } from "./game-state";
import { Hex, Hex1, IHex } from "./hex";
import { Meeple } from "./meeple";
import type { Planner } from "./plan-proxy";
import { Player } from "./player";
import { LogWriter } from "./stream-writer";
import { EventName, Table } from "./table";
import { PlayerColor, TP } from "./table-params";
import { Tile } from "./tile";
//import { NC } from "./choosers";
export type NamedObject = { name?: string, Aname?: string };

class HexEvent {}
class Move{
  Aname: string = "";
  ind: number = 0;
  board: any = {};
}

/** Implement game, enforce the rules, manage GameStats & hexMap; no GUI/Table required.
 *
 * Actions are:
 * - Reserve: place one Tile from auction to Player reserve
 * - Recruit: place a Builder/Leader (in Civic);
 *   do Build/Police action (requires 5 Econ)
 * - Build: move Master/Builders, build one Tile (from auction or reserve)
 * - Police: place one (in Station), move police (& leaders/builders), attack/capture;
 *   collatoral damge (3 Econ); dismiss Police
 * - Crime: place one on unoccupied hex adjacent to opponent Tile (requires 3 Econ)
 *   move Criminals, attack/capture;
 *   (Player keeps the captured Tile/Meeple; maybe earn VP if Crime Lord)
 * -
 */
export class GamePlay0 {
  /** the latest GamePlay instance in this VM/context/process */
  static gamePlay: GamePlay0;
  static gpid = 0
  readonly id = GamePlay0.gpid++

  readonly gameState: GameState = (this instanceof GamePlay) ? new GameState(this as GamePlay) : undefined;
  get gamePhase() { return this.gameState.state; }
  isPhase(name: string) { return this.gamePhase === this.gameState.states[name]; }
  phaseDone(...args: any[]) { this.gameState.done(...args); }

  recycleHex: Hex1;
  ll(n: number) { return TP.log > n }
  readonly logWriter: LogWriter

  get allPlayers() { return Player.allPlayers; }
  get allTiles() { return Tile.allTiles; }
  selectedActionIndex: number;
  selectedAction: ActionIdent; // set when click on action panel or whatever. read by ActionPhase;
  eventName: EventName;

  readonly hexMap = new AnkhMap<AnkhHex>(); // create base map; no districts until Table.layoutTable!
  readonly history: Move[] = []          // sequence of Move that bring board to its state
  readonly redoMoves = []

  logWriterLine0() {
    let time = stime('').substring(6,15)
    let line = {
      time: stime.fs(), maxBreadth: TP.maxBreadth, maxPlys: TP.maxPlys,
      mHexes: TP.mHexes, tHexes: TP.tHexes
    }
    let line0 = json(line, false)
    let logFile = `log_${time}.js`
    console.log(stime(this, `.constructor: -------------- ${line0} --------------`))
    let logWriter = new LogWriter(logFile)
    logWriter.writeLine(`[\n{start: ${line0}},`)
    return logWriter;
  }

  /** GamePlay0 - supply GodNames for each: new Player(...). */
  constructor(godNames: string[]) {
    this.logWriter = this.logWriterLine0()
    this.hexMap.Aname = `mainMap`;
    //this.hexMap.makeAllDistricts(); // For 'headless'; re-created by Table, after addToMapCont()

    // Create and Inject all the Players:
    this.allPlayers.length = 0;
    const gamePlay = (this instanceof GamePlay) ? this as GamePlay : undefined;
    godNames.forEach((godName, ndx) => new Player(ndx, godName, gamePlay)); // make real Players...
    this.curPlayerNdx = 0;
    this.curPlayer = this.allPlayers[this.curPlayerNdx];
  }

  turnNumber: number = 0    // = history.lenth + 1 [by this.setNextPlayer]
  curPlayerNdx: number = 0  // curPlayer defined in GamePlay extends GamePlay0
  curPlayer: Player;
  preGame = true;

  nextPlayer(plyr: Player = this.curPlayer) {
    const nxt = (plyr.index + 1) % Player.allPlayers.length;
    return Player.allPlayers[nxt];
  }

  forEachPlayer(f: (p:Player, index?: number, players?: Player[]) => void) {
    this.allPlayers.forEach((p, index, players) => f(p, index, players));
  }

  logText(line: string, from = '') {
    if (this instanceof GamePlay) this.table.logText(line, from);
  }

  permute(stack: any[]) {
    for (let i = 0, len = stack.length; i < len; i++) {
      let ndx: number = Math.floor(Math.random() * (len - i)) + i
      let tmp = stack[i];
      stack[i] = stack[ndx]
      stack[ndx] = tmp;
    }
    return stack;
  }

  eventInProcess: EzPromise<void>;
  async awaitEvent(init: () => void) {
    this.eventInProcess = new EzPromise<void>();
    init(); // tile0.moveTo(eventHex);
    return this.eventInProcess;
  }
  /** when Player click's 'Done' ? */
  finishEvent() {
    this.eventInProcess.fulfill();
  }

  async processEventTile(tile0: Tile) {
    // manually D&D event (to Player.Policies or RecycleHex)
    // EventTile.dropFunc will: gamePlay.finishEvent();
    await this.awaitEvent(() => {
      // tile0.setPlayerAndPaint(this.curPlayer);
      // tile0.moveTo(this.eventHex);
      this.hexMap.update();
    });
  }


  /**
   * When player has completed Actions and Event, do next player.
   */
  endTurn() {
    // Jubilee if win condition:
    if (this.isEndOfGame()) {
      this.endGame();
    } else {
      this.setNextPlayer();
    }
  }

  endGame() {
    const scores: number[] = [];
    let topScore = -1, winner: Player;
    console.log(stime(this, `.endGame: Game Over`), );

    // console.log(stime(this, `.endGame: Winner = ${winner.Aname}`), scores);
  }

  setNextPlayer(turnNumber?: number): void {
    if (turnNumber === undefined) turnNumber = this.turnNumber + 1;
    this.turnNumber = turnNumber;
    const index = (turnNumber % this.allPlayers.length);
    this.preGame = false;
    this.curPlayerNdx = index;
    this.curPlayer = this.allPlayers[index];
    this.curPlayer.newTurn();
  }

  isEndOfGame() {
    // can only win at the end of curPlayer's turn:
    const endp = false;
    if (endp) console.log(stime(this, `.isEndOfGame:`), );
    return endp;
  }

  /** Planner may override with alternative impl. */
  newMoveFunc: ((hex: Hex, sc: PlayerColor, caps: Hex[], gp: GamePlay0) => Move) | undefined
  newMove(hex: Hex, sc: PlayerColor, caps: Hex[], gp: GamePlay0) {
    return this.newMoveFunc? this.newMoveFunc(hex,sc, caps, gp) : new Move()
  }
  undoRecs: Undo = new Undo().enableUndo();
  addUndoRec(obj: NamedObject, name: string, value: any | Function = obj.name) {
    this.undoRecs.addUndoRec(obj, name, value);
  }

  /** update Counters (econ, expense, vp) for ALL players. */
  updateCounters() {       // TODO: find users of hexMap.update()
    // Player.allPlayers.forEach(player => player.setCounters(false));
    this.hexMap.update();
  }

  logFailure(type: string, reqd: number, avail: number, toHex: Hex) {
    const failText = `${type} required: ${reqd} > ${avail}`;
    console.log(stime(this, `.failToPayCost:`), failText, toHex.Aname);
    this.logText(failText, `GamePlay.failToPayCost`);
  }

  /**
   * Move tile to hex (or recycle), updating influence.
   *
   * Tile.dropFunc() -> Tile.placeTile() -> gp.placeEither()
   * @param tile ignore if undefined
   * @param toHex tile.moveTo(toHex)
   * @param payCost commit and verify payment
   */
  placeEither(tile: Tile, toHex: Hex1, payCost = true) {
    if (!tile) return;
    const fromHex = tile.fromHex;
    const info = { tile, fromHex, toHex, payCost };
    const verb = this.gamePhase.Aname;
    if (toHex !== fromHex) this.logText(`${verb} ${tile} -> ${toHex}`, `gamePlay.placeEither`)
    if (toHex !== fromHex) console.log(stime(this, `.placeEither:`), info);
    tile.moveTo(toHex);  // placeEither(tile, hex) --> moveTo(hex)
    if (toHex === this.recycleHex) {
      this.logText(`Recycle ${tile} from ${fromHex?.Aname || '?'}`, `gamePlay.placeEither`)
      this.recycleTile(tile);    // Score capture; log; return to homeHex
    }
    this.updateCounters();
  }

  recycleTile(tile: Tile) {
    if (!tile) return;    // no prior reserveTile...
    let verb = tile.recycleVerb ?? 'recycled';
    if (tile.fromHex?.isOnMap) {
      if (tile.player !== this.curPlayer) {
        verb = 'defeated';
      } else if (tile instanceof Meeple) {
      }
    }
    tile.logRecycle(verb);
    tile.sendHome();  // recycleTile
  }
}

/** GamePlay with Table & GUI (KeyBinder, ParamGUI & Dragger) */
export class GamePlay extends GamePlay0 {
  readonly table: Table   // access to GUI (drag/drop) methods.
  readonly guards: Constructor<Guardian>[];
  /** GamePlay is the GUI-augmented extension of GamePlay0; uses Table */
  constructor(public scenario: Scenario, table: Table, public gameSetup: GameSetup) {
    super(scenario.godNames);            // hexMap, history, gStats...
    Tile.gamePlay = this; // table
    // Players have: civics & meeples & TownSpec
    this.table = table;
    if (this.table.stage.canvas) this.bindKeys();
    this.guards = Guardian.randomGuards;
  }

  /** suitable for keybinding */
  unMove() {
    this.curPlayer.meeples.forEach((meep: Meeple) => meep.hex?.isOnMap && meep.unMove());
  }


  bindKeys() {
    let table = this.table
    let roboPause = () => { this.forEachPlayer(p => this.pauseGame(p) )}
    let roboResume = () => { this.forEachPlayer(p => this.resumeGame(p) )}
    let roboStep = () => {
      let p = this.curPlayer, op = this.nextPlayer(p)
      this.pauseGame(op); this.resumeGame(p);
    }
    // KeyBinder.keyBinder.setKey('p', { thisArg: this, func: roboPause })
    // KeyBinder.keyBinder.setKey('r', { thisArg: this, func: roboResume })
    // KeyBinder.keyBinder.setKey('s', { thisArg: this, func: roboStep })
    KeyBinder.keyBinder.setKey('R', { thisArg: this, func: () => this.runRedo = true })
    KeyBinder.keyBinder.setKey('q', { thisArg: this, func: () => this.runRedo = false })
    KeyBinder.keyBinder.setKey(/1-9/, { thisArg: this, func: (e: string) => { TP.maxBreadth = Number.parseInt(e) } })

    KeyBinder.keyBinder.setKey('M-z', { thisArg: this, func: this.undoMove })
    KeyBinder.keyBinder.setKey('b', { thisArg: this, func: this.undoMove })
    KeyBinder.keyBinder.setKey('f', { thisArg: this, func: this.redoMove })
    //KeyBinder.keyBinder.setKey('S', { thisArg: this, func: this.skipMove })
    KeyBinder.keyBinder.setKey('Escape', {thisArg: table, func: table.stopDragging}) // Escape
    KeyBinder.keyBinder.setKey('C-s', { thisArg: this.gameSetup, func: () => { this.gameSetup.restart() } })// C-s START
    KeyBinder.keyBinder.setKey('C-c', { thisArg: this, func: this.stopPlayer })// C-c Stop Planner
    KeyBinder.keyBinder.setKey('u', { thisArg: this, func: this.unMove })
    KeyBinder.keyBinder.setKey('n', { thisArg: this, func: this.endTurn })
    KeyBinder.keyBinder.setKey('C', { thisArg: this, func: this.reCacheTiles })

    KeyBinder.keyBinder.setKey('m', { thisArg: this, func: this.chooseAction, argVal: 'Move' })
    KeyBinder.keyBinder.setKey('s', { thisArg: this, func: this.chooseAction, argVal: 'Summon' })
    KeyBinder.keyBinder.setKey('g', { thisArg: this, func: this.chooseAction, argVal: 'Gain' })
    KeyBinder.keyBinder.setKey('w', { thisArg: this, func: this.chooseAction, argVal: 'Ankh' })
    KeyBinder.keyBinder.setKey('c', { thisArg: this, func: this.clickConfirm, argVal: false })
    KeyBinder.keyBinder.setKey('y', { thisArg: this, func: this.clickConfirm, argVal: true })
    KeyBinder.keyBinder.setKey('d', { thisArg: this, func: this.clickDone, argVal: true })
    KeyBinder.keyBinder.setKey('U', { thisArg: this.gameState, func: this.gameState.undoAction, argVal: true })
    KeyBinder.keyBinder.setKey('p', { thisArg: this, func: this.saveState, argVal: true })
    KeyBinder.keyBinder.setKey('P', { thisArg: this, func: this.pickState, argVal: true })
    KeyBinder.keyBinder.setKey('C-p', { thisArg: this, func: this.pickState, argVal: false }) // can't use Meta-P
    KeyBinder.keyBinder.setKey('o', { thisArg: this, func: this.showCards, argVal: undefined })
    KeyBinder.keyBinder.setKey('M-S', { thisArg: this, func: this.runSplitter, argVal: true })

    // diagnostics:
    table.undoShape.on(S.click, () => this.undoMove(), this)
    table.redoShape.on(S.click, () => this.redoMove(), this)
  }
  runSplitter() {
    this.gameState.ankhMapSplitter.runSplitShape();
  }

  backStates = [];
  saveState() {
    if (this.nstate !== 0) {
      this.backStates = this.backStates.slice(this.nstate); // remove ejected states
      this.nstate = 0;
    }

    const scenarioParser = new ScenarioParser(this.hexMap, this);
    const state = scenarioParser.saveState(this);
    this.backStates.unshift(state);
    console.log(stime(this, `.saveState -------- turn=${state.turn}`), state);
    scenarioParser.logState(state);
  }
  // TODO: setup undo index to go fwd and back? wire into undoPanel?
  nstate = 0;
  pickState(back = true) {
    this.nstate = back ? Math.min(this.backStates.length, this.nstate + 1) : Math.max(0, this.nstate - 1);
    const state = this.backStates[this.nstate];
    console.log(stime(this, `.pickState -------- #${this.nstate} turn=${state.turn}:`), state);
    this.table.parseScenenario(state);
    this.setNextPlayer(this.turnNumber);
  }

  cardShowing: boolean = false;
  showCards(vis = !this.cardShowing) {
    this.cardShowing = vis;
    this.forEachPlayer(player => player.panel.showCardSelector(vis));
    this.hexMap.update();
  }

  chooseAction(action: ActionIdent) {
    if (!this.isPhase('ChooseAction')) return;
    // find action in actionSelectPanel, dispatch event to click highlighted button.
    const [button, n] = this.table.activeButtons[action];
    setTimeout(() => this.table.selectAction(action, button, n), 10);
  }
  clickDone() {
    this.table.doneClicked({})
  }
  clickConfirm(val: boolean) {
    this.curPlayer.panel.clickConfirm(val);
  }

  useReferee = true

  async waitPaused(p = this.curPlayer, ident = '') {
    this.hexMap.update()
    let isPaused = !(p.planner as Planner).pauseP.resolved
    if (isPaused) {
      console.log(stime(this, `.waitPaused: ${p.colorn} ${ident} waiting...`))
      await p.planner.waitPaused(ident)
      console.log(stime(this, `.waitPaused: ${p.colorn} ${ident} running`))
    }
    this.hexMap.update();
  }
  pauseGame(p = this.curPlayer) {
    p.planner?.pause();
    this.hexMap.update();
    console.log(stime(this, `.pauseGame: ${p.colorn}`))
  }
  resumeGame(p = this.curPlayer) {
    p.planner?.resume();
    this.hexMap.update();
    console.log(stime(this, `.resumeGame: ${p.colorn}`))
  }
  /** tell [robo-]Player to stop thinking and make their Move; also set useRobo = false */
  stopPlayer() {
    this.autoMove(false)
    this.curPlayer.stopMove();
    console.log(stime(this, `.stopPlan:`), { planner: this.curPlayer.planner }, '----------------------')
    setTimeout(() => { this.table.showWinText(`stopPlan`) }, 400)
  }
  /** undo and makeMove(incb=1) */
  makeMoveAgain(arg?: boolean, ev?: any) {
    if (this.curPlayer.plannerRunning) return
    this.undoMove();
    this.makeMove(true, undefined, 1)
  }

  cacheScale = TP.cacheTiles;
  reCacheTiles() {
    this.cacheScale = Math.max(1, this.table.scaleCont.scaleX);
    TP.cacheTiles = (TP.cacheTiles == 0) ? this.cacheScale : 0;
    console.log(stime('GamePlay', `.reCacheTiles: TP.cacheTiles=`), TP.cacheTiles, this.table.scaleCont.scaleX);
    Tile.allTiles.forEach(tile => {
      if (tile.cacheID) {
        tile.uncache();
      } else {
        const rad = tile.radius, b = tile.getBounds() ?? { x: -rad, y: -rad, width: 2 * rad, height: 2 * rad };
        // tile.cache(b?.x ?? -rad, b?.y ?? -rad, b?.width ?? 2 * rad, b?.height ?? 2 * rad, TP.cacheTiles);
        tile.cache(b.x, b.y , b.width, b.height, TP.cacheTiles);
      }
    });
    this.hexMap.update();
  }

  /**
   * Current Player takes action.
   *
   * after setNextPlayer: enable Player (GUI or Planner) to respond
   * with playerMove() [table.moveStoneToHex()]
   *
   * Note: 1st move: player = otherPlayer(curPlayer)
   * @param auto this.runRedo || undefined -> player.useRobo
   * @param ev KeyBinder event, not used.
   * @param incb increase Breadth of search
   */
  makeMove(auto = undefined, ev?: any, incb = 0) {
    let player = this.curPlayer
    if (this.runRedo) {
      this.waitPaused(player, `.makeMove(runRedo)`).then(() => setTimeout(() => this.redoMove(), 10))
      return
    }
    if (auto === undefined) auto = player.useRobo
    player.playerMove(auto, incb) // make one robo move
  }
  /** if useRobo == true, then Player delegates to robo-player immediately. */
  autoMove(useRobo = false) {
    this.forEachPlayer(p => {
      this.roboPlay(p.index, useRobo)
    })
  }
  autoPlay(pid = 0) {
    this.roboPlay(pid, true)  // KeyBinder uses arg2
    if (this.curPlayerNdx == pid) this.makeMove(true)
  }
  roboPlay(pid = 0, useRobo = true) {
    let p = this.allPlayers[pid]
    p.useRobo = useRobo
    console.log(stime(this, `.autoPlay: ${p.colorn}.useRobo=`), p.useRobo)
  }
  /** when true, run all the redoMoves. */
  set runRedo(val: boolean) { (this._runRedo = val) && this.makeMove() }
  get runRedo() { return this.redoMoves.length > 0 ? this._runRedo : (this._runRedo = false) }
  _runRedo = false

  /** invoked by GUI or Keyboard */
  undoMove(undoTurn: boolean = true) {
    this.table.stopDragging() // drop on nextHex (no Move)
    //
    // undo state...
    //
    this.showRedoMark()
    this.hexMap.update()
  }
  /** doTableMove(redoMoves[0]) */
  redoMove() {
    this.table.stopDragging() // drop on nextHex (no Move)
    let move = this.redoMoves[0]// addStoneEvent will .shift() it off
    if (!move) return
    this.table.doTableMove(move.hex)
    this.showRedoMark()
    this.hexMap.update()
  }
  showRedoMark(hex: IHex | Hex = this.redoMoves[0]?.hex) {
    if (!!hex) { // unless Skip or Resign...
      this.hexMap.showMark((hex instanceof Hex) ? hex : Hex.ofMap(hex, this.hexMap))
    }
  }


  override endTurn(): void {
    // this.curPlayer.panel.visible = false;
    super.endTurn();
  }

  override setNextPlayer(turnNumber?: number) {
    this.curPlayer.panel.showPlayer(false);
    super.setNextPlayer(turnNumber); // update player.coins
    this.curPlayer.panel.showPlayer(true);
    this.paintForPlayer();
    this.updateCounters(); // beginning of round...
    this.curPlayer.panel.visible = true;
    this.table.showNextPlayer(); // get to nextPlayer, waitPaused when Player tries to make a move.?
    this.hexMap.update();
    this.startTurn();
    this.makeMove();
  }

  /** After setNextPlayer() */
  startTurn() {
    this.saveState();
  }

  paintForPlayer() {
  }

  /** dropFunc | eval_sendMove -- indicating new Move attempt */
  localMoveEvent(hev: HexEvent): void {
    let redo = this.redoMoves.shift()   // pop one Move, maybe pop them all:
    //if (!!redo && redo.hex !== hev.hex) this.redoMoves.splice(0, this.redoMoves.length)
    //this.doPlayerMove(hev.hex, hev.playerColor)
    this.setNextPlayer()
    this.ll(2) && console.log(stime(this, `.localMoveEvent: after doPlayerMove - setNextPlayer =`), this.curPlayer.color)

  }

  /** local Player has moved (S.add); network ? (sendMove.then(removeMoveEvent)) : localMoveEvent() */
  playerMoveEvent(hev: HexEvent): void {
    this.localMoveEvent(hev)
  }
}
