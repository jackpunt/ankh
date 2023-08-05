import { Constructor, stime } from "@thegraid/common-lib";
import { NumCounter } from "./counters";
import { GP, GamePlay, GamePlay0 } from "./game-play";
import { God } from "./god";
import type { Hex2 } from "./hex";
import { HexDir } from "./hex-intfs";
import { Meeple } from "./meeple";
import { IPlanner, newPlanner } from "./plan-proxy";
import { TP } from "./table-params";
import { MapTile, Tile, } from "./tile";

export class Player {
  static allPlayers: Player[] = [];

  readonly Aname: string;
  constructor(
    readonly index: number,
    readonly godName: string,
    readonly gamePlay: GamePlay0,
  ) {
    const godc = God.constructors.find(g => g.name === godName);
    this.god =  new godc();
    this.god.player = this;
    Player.allPlayers[index] = this;
    this.Aname = `P${index}-${this.god.Aname}:${this.god.color}`;
    console.log(stime(this, `.new:`), this.Aname);
  }

  god: God;
  get color() { return this.god.color; }
  readonly stableHexes: Hex2[] = [];

  allOf<T extends Tile>(claz: Constructor<T>) { return (Tile.allTiles as T[]).filter(t => t instanceof claz && t.player === this); }
  allOnMap<T extends Tile>(claz: Constructor<T>) { return this.allOf(claz).filter(t => t.hex?.isOnMap); }
  /** Resi/Busi/PS/Lake/Civics in play on Map */
  get mapTiles() { return this.allOf(MapTile) as MapTile[] }
  // Player's Leaders, Police & Criminals
  get meeples() { return Meeple.allMeeples.filter(meep => meep.player == this) };

  _score: number = 0;
  get score() { return this._score }
  set score(score: number) {
    this._score = Math.floor(score);
    const rank = Math.round((score - this._score) * 10);
    GP.gamePlay.table.setPlayerScore(this, score, rank);
  }

  // Created in masse by Table.layoutCounter
  coinCounter: NumCounter; // set by layoutCounters: `${'Coin'}Counter`
  get coins() { return this.coinCounter?.getValue(); }
  set coins(v: number) { this.coinCounter?.updateValue(v); }

  get otherPlayer() { return Player.allPlayers[1 - this.index] }
  get colorn(): string { return TP.colorScheme[this.color] }

  planner: IPlanner;
  /** if true then invoke plannerMove */
  useRobo: boolean = false;

  readonly startDir: HexDir;

  /** make Civics, Leaders & Police; also makeLeaderHex() */
  makePlayerBits() {
  }

  get isDestroyed() {
    return this.allOnMap(MapTile).length == 0;
  }
  get isComplete() {
    return false;
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
    this.meeples.forEach(meep => meep.faceUp()); // set meep.startHex for unMove
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
