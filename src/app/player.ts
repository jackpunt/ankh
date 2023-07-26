import { Constructor, stime } from "@thegraid/common-lib";
import { DecimalCounter, NumCounter } from "./counters";
import { GP, GamePlay, GamePlay0 } from "./game-play";
import type { Hex, Hex1 } from "./hex";
import { HexDir } from "./hex-intfs";
import { Chancellor, Criminal, CriminalSource, Judge, Leader, Mayor, Meeple, Police, Priest } from "./meeple";
import { IPlanner, newPlanner } from "./plan-proxy";
import { CenterText } from "./shapes";
import { PlayerColor, TP } from "./table-params";
import { Church, Civic, Courthouse, MapTile, Tile, TownRules, TownStart, University } from "./tile";
import { UnitSource } from "./tile-source";

export class Player {
  static allPlayers: Player[] = [];
  static playerStartDir: HexDir[] = ['NW', 'E', 'SW'];

  setCounters(update = true) {
    this.econCounter.setValue(this.econs)
    this.expenseCounter.setValue(this.expenses)
    this.vpCounter.setValue(this.vps)
    //if (player && player !== curPlayer) player.totalVpCounter.setValue(player.totalVps)
    update && GP.gamePlay.hexMap.update();
  }

  readonly Aname: string;

  constructor(
    readonly index: number,
    readonly color: PlayerColor,
    readonly gamePlay: GamePlay0,
  ) {
    this.Aname = `Player${index}-${this.colorn}`
    Player.allPlayers[index] = this;
    this.startDir = Player.playerStartDir[index];
  }

  allOf<T extends Tile>(claz: Constructor<T>) { return (Tile.allTiles as T[]).filter(t => t instanceof claz && t.player === this); }
  allOnMap<T extends Tile>(claz: Constructor<T>) { return this.allOf(claz).filter(t => t.hex?.isOnMap); }
  /** Resi/Busi/PS/Lake/Civics in play on Map */
  get mapTiles() { return this.allOf(MapTile) as MapTile[] }
  // Player's Leaders, Police & Criminals
  get meeples() { return Meeple.allMeeples.filter(meep => meep.player == this) };
  get allLeaders() { return this.meeples.filter(m => m instanceof Leader) as Leader[] }
  get allPolice() { return this.meeples.filter(m => m instanceof Police) as Police[] }
  get criminals() { return this.meeples.filter(meep => meep instanceof Criminal) };

  policeSource: UnitSource<Police>;
  criminalSource: CriminalSource;

  readonly policyHexes: Hex1[] = new Array<Hex1>(TP.nPolicySlots).fill(undefined);
  isPolicyHex(hex: Hex1) {
    return this.policyHexes.includes(hex);
  }

  actionCounter: NumCounter;
  get actions() { return this.actionCounter?.getValue(); }
  set actions(v: number) { this.actionCounter?.updateValue(v); }
  useAction() { this.actions -= 1; }

  // Created in masse by Table.layoutCounter
  coinCounter: NumCounter; // set by layoutCounters: `${'Coin'}Counter`
  get coins() { return this.coinCounter?.getValue(); }
  set coins(v: number) { this.coinCounter?.updateValue(v); }

  captureCounter: NumCounter;
  get captures() { return this.captureCounter?.getValue(); }
  set captures(v: number) { this.captureCounter?.updateValue(v); }

  vp0Counter: NumCounter; // allow User to adjust VP for Event
  get vp0() { return this.vp0Counter.getValue(); }

  InflCounter: NumCounter; // TokenSource<InflToken>.counter C.grey counter
  get infls() { return this.InflCounter?.getValue(); }       // for gamePlay.failToPayCost()
  set infls(v: number) { this.InflCounter?.updateValue(v); }

  // incremented via: player[`${BuyToken.counterNames['infl','econ']}`].incValue();
  EconCounter: NumCounter; // TokenSource<EconToken>.counter C.white counter

  econCounter: NumCounter;
  get econs() {
    let econ = 0;
    this.gamePlay.hexMap.forEachHex(hex => {
      if ((hex.tile?.player === this) && !(hex.meep instanceof Criminal)) {
        econ += hex.tile.econ;      // Note: Monument has negative econ
      }
    })
    this.policyHexes.forEach(hex => econ += (hex.tile?.econ ?? 0));
    return econ;
  }

  expenseCounter: NumCounter;
  get expenses() {
    let expense = 0;
    this.gamePlay.hexMap.forEachHex(hex => {
      if (hex.meep?.player == this) {
        expense += hex.meep.econ     // meeples have negative econ
      }
    })
    return expense
  }

  vpCounter: NumCounter;
  get vps() {
    let vp = this.vp0 + this.captures;
    this.gamePlay.hexMap.forEachHex(hex => {
      const myTile = hex.tile?.player === this;
      //hex.tile && console.log(stime(this, `.vps`), hex.tile.Aname, hex.Aname, vp, dv, (hex.tile?.player == this && hex.tile.vp), (hex.meep?.player == this && hex.meep.vp));
    });
    this.policyHexes.forEach(hex => vp += (hex.tile?.vp ?? 0));
    return vp;
  }

  tvp0Counter: NumCounter;    // adjustment to TVP from Event/Policy
  get tvp0() { return this.tvp0Counter.getValue(); }

  totalVpCounter: DecimalCounter;
  get totalVps() { return this.totalVpCounter.getValue(); }
  set totalVps(v: number) { this.totalVpCounter.setValue(v); }
  get vpsPerRound() { return this.totalVpCounter.perRound; }

  get otherPlayer() { return Player.allPlayers[1 - this.index] }
  get colorn(): string { return TP.colorScheme[this.color] }

  planner: IPlanner;
  /** if true then invoke plannerMove */
  useRobo: boolean = false;

  readonly startDir: HexDir;

  // HexMap is populated AFTER Players are created!
  get initialHex() {
    let hex = this.gamePlay.hexMap.centerHex as Hex;
    let path = [this.startDir, this.startDir, this.startDir];
    path.forEach(dir => hex = hex.nextHex(dir));
    return hex;
  }

  /** make Civics, Leaders & Police; also makeLeaderHex() */
  makePlayerBits() {
  }

  get isDestroyed() {
    return this.allOnMap(MapTile).length == 0;
  }
  get isComplete() {
    return false;
  }

  /** deposit Infls & Actns with Player */
  takeBonus(tile: Tile) {
    if (tile?.bonus['actn']) {
      this.actions += 1;              // triggers actionCounter.updateValue
      tile.removeBonus('actn');
    }
    if (tile?.bonus['infl']) {
      this.infls += 1;              // triggers inflCounter.updateValue
      tile.removeBonus('infl');
    }
  }

  endGame(): void {
    this.planner?.terminate()
    this.planner = undefined
  }
  static remotePlayer = 1 // temporary, bringup-debug: index of 'remotePlayer' (see below)
  /**
   * Before start each new game.
   *
   * [make newPlanner for this Player]
   */
  newGame(gamePlay: GamePlay, url = TP.networkUrl) {
    this.planner?.terminate()
    // this.hgClient = (this.index == Player.remotePlayer) ? new HgClient(url, (hgClient) => {
    //   console.log(stime(this, `.hgClientOpen!`), hgClient)
    // }) : undefined
    this.planner = newPlanner(gamePlay.hexMap, this.index)
  }

  newTurn() {
    // faceUp and record start location:
    this.meeples.forEach(meep => meep.faceUp());
    this.coins += (this.econs + this.expenses); // expenses include P & I
    this.actions = 1;
  }

  stopMove() {
    this.planner?.roboMove(false)
  }
  /** if Planner is not running, maybe start it; else wait for GUI */ // TODO: move Table.dragger to HumanPlanner
  playerMove(useRobo = this.useRobo, incb = 0) {
    let running = this.plannerRunning
    // feedback for KeyMove:

    TP.log > 0 && console.log(stime(this, `(${this.colorn}).playerMove(${useRobo}): useRobo=${this.useRobo}, running=${running}`))
    if (running) return
    if (useRobo || this.useRobo) {
    // start plannerMove from top of stack:
    // setTimeout(() => this.plannerMove(incb))
    }
    return      // robo or GUI will invoke gamePlay.doPlayerMove(...)
  }
  plannerRunning = false
  plannerMove(incb = 0) {
    this.planner?.roboMove(true)
    this.plannerRunning = true
    // let iHistory = this.table.gamePlay.iHistory
    // let ihexPromise = this.planner.makeMove(sc, iHistory, incb)
    // ihexPromise.then((ihex: IHex) => {
    //   this.plannerRunning = false
    //   this.table.moveStoneToHex(ihex, sc)
    // })
  }
}
class RemotePlayer extends Player {
  override newGame(gamePlay: GamePlay) {
    this.planner?.terminate()
    // this.hgClient = (this.index == RemotePlayer.remotePlayer) ? new HgClient() : undefined
    // this.planner = newPlanner(gamePlay.hexMap, this.index, gamePlay.logWriter)
  }
}
