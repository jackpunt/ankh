import { Constructor, json } from "@thegraid/common-lib";
import { KeyBinder, S, Undo, stime } from "@thegraid/easeljs-lib";
import { Container } from "@thegraid/easeljs-module";
import { EzPromise } from "@thegraid/ezpromise";
import { CostIncCounter } from "./counters";
import { GameSetup } from "./game-setup";
import { Hex, Hex2, HexMap, IHex } from "./hex";
import { H } from "./hex-intfs";
import type { Planner } from "./plan-proxy";
import { Player } from "./player";
import { CenterText } from "./shapes";
import { GameStats, TableStats } from "./stats";
import { LogWriter } from "./stream-writer";
import { Table } from "./table";
import { PlayerColor, PlayerColorRecord, TP, criminalColor, otherColor, playerColorRecord, playerColors, } from "./table-params";
import { BagTile, Civic, MapTile, Tile } from "./tile";
import { TileSource } from "./tile-source";
import { Meeple } from "./meeple";
//import { NC } from "./choosers";
export type NamedObject = { name?: string, Aname?: string };

class HexEvent {}
class Move{
  Aname: string = "";
  ind: number = 0;
  board: any = {};
}

export class GP {
  static gamePlay: GamePlay;
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
  recycleHex: Hex;
  ll(n: number) { return TP.log > n }
  readonly logWriter: LogWriter

  get allPlayers() { return Player.allPlayers; }

  readonly hexMap: HexMap = new HexMap()
  readonly history: Move[] = []          // sequence of Move that bring board to its state
  readonly gStats: GameStats             // 'readonly' (set once by clone constructor)
  readonly redoMoves = []
  readonly auctionTiles: BagTile[] = []     // per game

  logWriterLine0() {
    let time = stime('').substring(6,15)
    let line = {
      time: stime.fs(), maxBreadth: TP.maxBreadth, maxPlys: TP.maxPlys,
      mHexes: TP.mHexes, tHexes: TP.tHexes
    }
    let line0 = json(line, false)
    let logFile = `log_${time}`
    console.log(stime(this, `.constructor: -------------- ${line0} --------------`))
    let logWriter = new LogWriter(logFile)
    logWriter.writeLine(line0)
    return logWriter;
  }

  constructor() {
    this.logWriter = this.logWriterLine0()
    this.hexMap.Aname = `mainMap`;
    this.hexMap.makeAllDistricts(); // may be re-created by Table, after addToMapCont()

    this.gStats = new GameStats(this.hexMap) // AFTER allPlayers are defined so can set pStats
    // Create and Inject all the Players: (picking a townStart?)
    Player.allPlayers.length = 0;
    playerColors.forEach((color, ndx) => new Player(ndx, color, this)); // make real Players...
    this.playerByColor = playerColorRecord(...Player.allPlayers);
    this.curPlayerNdx = 0;
    this.curPlayer = Player.allPlayers[this.curPlayerNdx];

    const len = playerColors.length; // actual players
    this.crimePlayer = new Player(len, criminalColor, this);  //
    Player.allPlayers.length = len; // truncate allPlayers: exclude crimePlayer

    this.dice = new Dice();
  }

  crimePlayer: Player;
  turnNumber: number = 0    // = history.lenth + 1 [by this.setNextPlayer]
  curPlayerNdx: number = 0  // curPlayer defined in GamePlay extends GamePlay0
  curPlayer: Player;
  preGame = true;
  curPlayerMapTiles: Tile[] = [];
  get didPlayerBuild() {
    const plyr = this.curPlayer;
    const nowTiles = plyr.allOnMap(MapTile);
    const isNew = !!nowTiles.find(tile => !this.curPlayerMapTiles.includes(tile))
    plyr.vpCounter.setLabel(isNew ? 'vps' : 'vps*');
    return isNew;
  }

  dice: Dice;

  /**
   * While curPlayer = *last* player.
   * [so autoCrime() -> meep.player = curPlayer]
   *
   * - Shift Auction
   * - Roll 2xD6, enable effects.
   * - - 1+1: add Star
   * - - 2+2: add Action
   * - - 3+3: add Coin
   * - - 6+4-6: add Criminal
   */
  rollDiceForBonus() {
    let dice = this.dice.roll();
    dice.sort(); // ascending
    console.log(stime(this, `.endTurn2: Dice =`), dice)
    this.hexMap.update()
  }

  /** allow curPlayer to place a Criminal [on empty hex] for free. Override in GamePlay. */
  autoCrime() {
  }

  playerByColor: PlayerColorRecord<Player>
  otherPlayer(plyr: Player = this.curPlayer) { return this.playerByColor[otherColor(plyr.color)]}

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


  /** when Player has completed their Action & maybe a hire.
   * { shiftAuction, processEvent }* -> endTurn2() { roll dice, set Bonus, NextPlayer }
   */
  endTurn() {
  }
  endTurn2() {
    // this.rollDiceForBonus();
    // Jubilee if win condition:
    const playerVps = this.curPlayer.isComplete ? 2 * this.curPlayer.vps : this.curPlayer.vps;
    this.curPlayer.totalVps += this.didPlayerBuild ? playerVps : Math.floor(playerVps / 2);
    if (this.isEndOfGame()) {
      this.endGame();
    } else {
      this.setNextPlayer();
    }
  }

  endGame() {
    const scores: number[] = [];
    let topScore = -1, winner: Player;
    console.log(stime(this, `.endGame: Game Over`), this.vca);
    this.allPlayers.forEach(p => {
      p.endGame();
      // TODO: include TownRules bonuses
      const score = p.totalVps;
      scores.push(score);
      console.log(stime(this, `.endGame: ${p.Aname} score =`), score);
      if (topScore < score) {
        topScore = score;
        winner = p;
      }
    });
    // console.log(stime(this, `.endGame: Winner = ${winner.Aname}`), scores);
  }

  setNextPlayer(plyr = this.otherPlayer()): void {
    this.preGame = false;
    this.turnNumber += 1 // this.history.length + 1
    this.curPlayer = plyr
    this.curPlayerNdx = plyr.index
    this.curPlayer.actions = 0;
    this.curPlayerMapTiles = this.curPlayer.allOnMap(MapTile);
    this.didPlayerBuild; // false: set 'vps*'
    this.curPlayer.newTurn();
    this.assessThreats();
  }

  vca: { vc1: number, vc2: number }[] = [{ vc1: -3, vc2: -3 }, { vc1: -3, vc2: -3 }];
  vTurn1(player: Player, n = 0) {
    return this.vca[player.index]['vc1'] == (this.turnNumber - n) || this.vca[player.index]['vc2'] == (this.turnNumber - n);
  }
  /** true if curVal true, twice in a row... */
  vTurn2(player: Player, vc: 'vc1' | 'vc2', curVal: boolean) {
    const rv = curVal && this.vca[player.index][vc] == this.turnNumber - 2;
    // console.log(stime(this, `.vc2: [${player.index}][${vc}] = ${rv}; curVal=`), curVal);
    // last turn when curVal was true:
    if (curVal) this.vca[player.index][vc] = this.turnNumber;
    return rv;
  }

  isPlayerWin(player: Player) {
    const end1 = this.vTurn2(player, 'vc1', player.otherPlayer.isDestroyed);
    const end2 = this.vTurn2(player, 'vc2', player.isComplete);
    return end1 || end2;
  }

  isEndOfGame() {
    // can only win at the end of curPlayer's turn:
    const endp = this.isPlayerWin(this.curPlayer)
    if (endp) console.log(stime(this, `.isEndOfGame:`), this.vca.flatMap(v => v));
    return endp;
  }

  assessThreats() {
    this.hexMap.forEachHex(hex => hex.assessThreats()); // try ensure threats are correctly marked
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

  /** after add Tile to hex: propagate its influence in each direction; maybe capture. */
  incrInfluence(hex: Hex, infColor: PlayerColor) {
    H.infDirs.forEach(dn => {
      const inf = hex.getInf(infColor, dn);
      hex.propagateIncr(infColor, dn, inf); // use test to identify captured Criminals?
    })
  }

  /** after remove Tile [w/tileInf] from hex: propagate influence in each direction. */
  decrInfluence(hex: Hex, tile: Tile, infColor: PlayerColor) {
    H.infDirs.forEach(dn => {
      const inf = hex.getInf(infColor, dn);
      hex.propagateDecr(infColor, dn, inf, tile);       // because no-stone, hex gets (inf - 1)
    })
  }

  playerBalanceString(player: Player, ivec = [0, 0, 0, 0]) {
    const [nb, fb, nr, fr] = this.playerBalance(player, ivec);
    return `${nb}+${fb}:${nr}+${fr}`;
  }
  playerBalance(player: Player, ivec = [0, 0, 0, 0]) {
    let [nBusi, fBusi, nResi, fResi] = ivec;
    this.hexMap.forEachHex(hex => {
      const tile = hex.tile;
      if (tile && tile.player == player) {
        nBusi += tile.nB;
        fBusi += tile.fB;
        nResi += tile.nR;
        fResi += tile.fR;
      }
    });
    return [nBusi, fBusi, nResi, fResi];
  }

  failTurn: string | undefined = undefined;  // Don't repeat "Need Busi/Resi" message this turn.
  failToBalance(tile: Tile) {
    const player = this.curPlayer;
    // tile on map during Test/Dev, OR: when demolishing...
    const ivec = tile.hex?.isOnMap ? [0, 0, 0, 0] : [tile.nB, tile.fB, tile.nR, tile.fR];
    const [nBusi, fBusi, nResi, fResi] = this.playerBalance(player, ivec);
    const noBusi = nBusi > 1 * (nResi + fResi);
    const noResi = nResi > 2 * (nBusi + fBusi);
    const fail = (noBusi && (tile.nB > 0)) || (noResi && (tile.nR > 0));
    const failText = noBusi ? 'Need Residential' : 'Need Business';
    if (fail) {
      const failTurn = `${this.turnNumber}:${failText}`;
      if (this.failTurn != failTurn) {
        this.failTurn = failTurn;
        console.log(stime(this, `.failToBalance: ${failText} ${tile.Aname}`), [nBusi, fBusi, nResi, fResi], tile);
        this.logText(failText, 'GamePlay.failToBalance');
      }
    }
    return fail ? failText : undefined;
  }

  // Costinc [0] = curPlayer.civics.filter(civ => civ.hex.isOnMap).length + 1
  // each succeeding is 1 less; to min of 1, except last slot is min of -1;
  // costInc[nCivOnMap][slotN] => [0, 0, 0, -1], [1, 0, 0, -1], [2, 1, 0, -1], [3, 2, 1, 0], [4, 3, 2, 1]
  costIncMatrix(maxCivics = TP.maxCivics, nSlots = TP.auctionSlots) {
    const d3 = nSlots - 4;//nSlot=3:0, 4:1, 5:2 + mCivics
    // nCivics = [0...maxCivics]
    return new Array(maxCivics + 1).fill(1).map((civElt, nCivics) => {
      // iSlot = [0...nSlots - 1]
      return new Array(nSlots).fill(1).map((costIncElt, iSlot) => {
        let minVal = (iSlot === (nSlots - 1)) ? -1 : 0;
        return Math.max(minVal, nCivics + d3 - iSlot) // assert nSlots <= maxCivics; final slot always = 0
      })
    })
  }
  readonly costInc = this.costIncMatrix()

  /** show player color and cost. */
  readonly costIncHexCounters = new Map<Hex, CostIncCounter>()
  private costNdxFromHex(hex: Hex) {
    return this.costIncHexCounters.get(hex)?.ndx ?? -1; // Criminal/Police[constant cost]: no CostIncCounter, no ndx
  }

  updateCostCounter(cic: CostIncCounter) {
    const plyr = (cic.repaint instanceof Player) ? cic.repaint : this.curPlayer;
  }

  /** update when Auction, Market or Civic Tiles are dropped. */
  updateCostCounters() {
    this.costIncHexCounters.forEach(cic => this.updateCostCounter(cic));
  }

  /** update Counters (econ, expense, vp) for ALL players. */
  updateCounters() {
    this.didPlayerBuild;
    Player.allPlayers.forEach(player => player.setCounters(false));
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
  placeEither(tile: Tile, toHex: Hex, payCost = true) {
    if (!tile) return;
    const fromHex = tile.hex;
    const info = { tile, fromHex, toHex, infStr: toHex?.infStr ?? '?', payCost };
    if (toHex !== tile.hex) console.log(stime(this, `.placeEither:`), info);
    // commit to pay, and verify payment made:
    if (payCost) {
      console.log(stime(this, `.placeEither: payment failed`), tile, toHex);
      debugger;              // should not happen, since isLegalTarget() checks failToPayCost()
      tile.moveTo(tile.hex); // abort; return to fromHex
      return;
    }
    // update influence on map:
    const infColor = tile.infColor || this.curPlayer.color;
    const tileInfP = tile.infP + tile.bonusInf(infColor);
    if (fromHex?.isOnMap && tileInfP !== 0) {
      this.decrInfluence(fromHex, tile, infColor);        // as if tile has no influence
    }
    if (toHex !== fromHex) this.logText(`Place ${tile} -> ${toHex}`, `gamePlay.placeEither`)
    tile.moveTo(toHex);  // placeEither(tile, hex) --> moveTo(hex)
    if (fromHex?.meep || fromHex?.tile) {
      const infP = fromHex.getInfP(infColor);
      fromHex.meep?.setInfRays(infP); // meep inf w/o tile moved
      fromHex.tile?.setInfRays(infP); // tile inf w/o meep moved
    }
    if (toHex?.isOnMap) {
      this.incrInfluence(tile.hex, infColor);
      const infP = toHex.getInfP(infColor);
      toHex.meep?.setInfRays(infP);   // meep inf with tile placed
      toHex.tile?.setInfRays(infP);   // tile inf with meep placed
    } else if (toHex === this.recycleHex) {
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
        this.curPlayer.captures++;
        verb = 'captured';
      } else if (tile instanceof Meeple) {
        this.curPlayer.coins -= tile.econ;  // dismiss Meeple, claw-back salary.
      }
    }
    tile.logRecycle(verb);
    tile.sendHome();  // recycleTile
  }
}
/** GamePlayD has compatible hexMap(mh, nh) but does not share components. used by Planner */
export class GamePlayD extends GamePlay0 {
  //override hexMap: HexMaps = new HexMap();
  constructor(nh = TP.nHexes, mh = TP.mHexes) {
    super();
    this.hexMap.Aname = `GamePlayD#${this.id}`;
    // this.hexMap.makeAllDistricts(nh, mh); // included in GamePlay0
    return;
  }
}

/** GamePlay with Table & GUI (KeyBinder, ParamGUI & Dragger) */
export class GamePlay extends GamePlay0 {
  readonly table: Table   // access to GUI (drag/drop) methods.
  declare readonly gStats: TableStats // https://github.com/TypeStrong/typedoc/issues/1597
  /** GamePlay is the GUI-augmented extension of GamePlay0; uses Table */
  constructor(table: Table, public gameSetup: GameSetup) {
    super();            // hexMap, history, gStats...
    GP.gamePlay = this; // table
    // Players have: civics & meeples & TownSpec
    // setTable(table)
    this.table = table;
    this.gStats = new TableStats(this, table); // upgrade to TableStats
    if (this.table.stage.canvas) this.bindKeys();
  }

  /** attacks *against* color */
  processAttacks(attacker: PlayerColor) {
    // TODO: until next 'click': show flames on hex & show Tile in 'purgatory'.
    // loop to check again after capturing (cascade)
    while (this.hexMap.findHex(hex => {
      if (hex.tile?.isThreat[attacker]) {
        this.recycleTile(hex.tile);  // remove tile, allocate points; no change to infP!
        return true;
      }
      if (hex.meep?.isThreat[attacker]) {
        this.recycleTile(hex.meep);  // remove tile, allocate points; no change to infP!
        return true;
      }
      return false;
    }));
  }

  unMove() {
    this.curPlayer.meeples.forEach((meep: Meeple) => meep.hex?.isOnMap && meep.unMove());
    this.assessThreats();
  }


  bindKeys() {
    let table = this.table
    let roboPause = () => { this.forEachPlayer(p => this.pauseGame(p) )}
    let roboResume = () => { this.forEachPlayer(p => this.resumeGame(p) )}
    let roboStep = () => {
      let p = this.curPlayer, op = this.otherPlayer(p)
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
    KeyBinder.keyBinder.setKey('M-K', { thisArg: this, func: this.resignMove })// S-M-k
    KeyBinder.keyBinder.setKey('Escape', {thisArg: table, func: table.stopDragging}) // Escape
    KeyBinder.keyBinder.setKey('M-C', { thisArg: this, func: this.autoCrime, argVal: true })// S-M-C (force)
    KeyBinder.keyBinder.setKey('C-s', { thisArg: this.gameSetup, func: () => { this.gameSetup.restart() } })// C-s START
    KeyBinder.keyBinder.setKey('C-c', { thisArg: this, func: this.stopPlayer })// C-c Stop Planner
    KeyBinder.keyBinder.setKey('m', { thisArg: this, func: this.makeMove, argVal: true })
    KeyBinder.keyBinder.setKey('M', { thisArg: this, func: this.makeMoveAgain, argVal: true })
    KeyBinder.keyBinder.setKey('n', { thisArg: this, func: this.autoMove, argVal: false })
    KeyBinder.keyBinder.setKey('N', { thisArg: this, func: this.autoMove, argVal: true})
    KeyBinder.keyBinder.setKey('c', { thisArg: this, func: this.autoPlay, argVal: 0})
    KeyBinder.keyBinder.setKey('v', { thisArg: this, func: this.autoPlay, argVal: 1})
    KeyBinder.keyBinder.setKey('u', { thisArg: this, func: this.unMove })
    KeyBinder.keyBinder.setKey('i', { thisArg: this, func: () => {table.showInf = !table.showInf; this.hexMap.update() } })

    // diagnostics:
    //KeyBinder.keyBinder.setKey('x', { thisArg: this, func: () => {this.table.enableHexInspector(); }})
    KeyBinder.keyBinder.setKey('t', { thisArg: this, func: () => {this.table.toggleText(); }})
    //KeyBinder.keyBinder.setKey('z', { thisArg: this, func: () => {this.gStats.updateStats(); }})

    // KeyBinder.keyBinder.setKey('M-r', { thisArg: this, func: () => { this.gameSetup.netState = "ref" } })
    // KeyBinder.keyBinder.setKey('M-J', { thisArg: this, func: () => { this.gameSetup.netState = "new" } })
    // KeyBinder.keyBinder.setKey('M-j', { thisArg: this, func: () => { this.gameSetup.netState = "join" } })
    //KeyBinder.keyBinder.setKey('M-d', { thisArg: this, func: () => { this.gameSetup.netState = "no" } })
    table.undoShape.on(S.click, () => this.undoMove(), this)
    table.redoShape.on(S.click, () => this.redoMove(), this)
    table.skipShape.on(S.click, () => this.skipMove(), this)
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
    this.hexMap.update()
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
    this.curPlayer.stopMove()
    console.log(stime(this, `.stopPlan:`), { planner: this.curPlayer.planner }, '----------------------')
    setTimeout(() => { this.table.showWinText(`stopPlan`) }, 400)
  }
  /** undo and makeMove(incb=1) */
  makeMoveAgain(arg?: boolean, ev?: any) {
    if (this.curPlayer.plannerRunning) return
    this.undoMove()
    this.makeMove(true, undefined, 1)
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

  skipMove() {
    this.table.stopDragging() // drop on nextHex (no Move)
  }
  resignMove() {
    this.table.stopDragging() // drop on nextHex (no Move)
  }


  override endTurn2(): void {
    this.table.buttonsForPlayer[this.curPlayerNdx].visible = false;
    super.endTurn2();   // shift(), roll(); totalVps += vps
  }

  override isPlayerWin(player: Player): boolean {
    const cont = this.table.winIndForPlayer[player.index];
    const win = super.isPlayerWin(player)
    const warn = this.vTurn1(player) || win;
    cont.removeAllChildren();
    if (warn || win) {
      // console.log(stime(this, `.isPlayerWin: ${AT.ansiText(['$red'], 'warn!')} ${player.Aname}`))
      const color = win ? 'rgba(0,180,0,.8)' : 'rgba(180,0,0,.8)';
      const ddd = new CenterText('!!', 80, color); // F.fontSpec()
      cont.addChild(ddd);
    }
    this.hexMap.update();
    return win;
  }

  override setNextPlayer(plyr?: Player) {
    super.setNextPlayer(plyr); // update player.coins
    this.paintForPlayer();
    this.updateCostCounters();
    this.updateCounters(); // beginning of round...
    this.table.buttonsForPlayer[this.curPlayerNdx].visible = true;
    this.table.showNextPlayer(); // get to nextPlayer, waitPaused when Player tries to make a move.?
    this.hexMap.update();
    this.startTurn();
    this.makeMove();
  }

  /** After setNextPlayer() */
  startTurn() {
  }

  paintForPlayer() {
    this.costIncHexCounters.forEach(cic => {
      const plyr = (cic.repaint instanceof Player) ? cic.repaint : this.curPlayer;
      if (cic.repaint !== false) {
        cic.hex.tile?.setPlayerAndPaint(plyr);
      }
    })
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

class Dice {
  text: CenterText;
  textSize: number = .5 * TP.hexRad;
  constructor() {
    this.text = new CenterText(`0:0`, this.textSize);
  }
  roll(n = 2, d = 6) {
    let rv = new Array(n).fill(1).map(v => 1 + Math.floor(Math.random() * d));
    this.text.text = rv.reduce((pv, cv, ci) => `${pv}${ci > 0 ? ':' : ''}${cv}`, '');
    return rv
  }
  setContainer(parent: Container, x = 0, y = 0) {
    this.text.x = x;
    this.text.y = y;
    parent.addChild(this.text);
  }
}

/** a uniquifying 'symbol table' of Board.id */
class BoardRegister extends Map<string, Board> {}
/** Identify state of HexMap by itemizing all the extant Stones
 * id: string = Board(nextPlayer.color, captured)resigned?, allStones
 * resigned: PlayerColor
 * repCount: number
 */
export class Board {
  readonly id: string = ""   // Board(nextPlayer,captured[])Resigned?,Stones[]
  readonly resigned: PlayerColor //
  repCount: number = 1;

  /**
   * Record the current state of the game: {Stones, turn, captures}
   * @param move Move: color, resigned & captured [not available for play by next Player]
   */
  constructor(id: string, resigned: PlayerColor) {
    this.resigned = resigned
    this.id = id
  }
  toString() { return `${this.id}#${this.repCount}` }

  setRepCount(history: { board }[]) {
    return this.repCount = history.filter(hmove => hmove.board === this).length
  }
  get signature() { return `[${TP.mHexes}x${TP.nHexes}]${this.id}` }
}
