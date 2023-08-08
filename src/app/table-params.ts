import type { Constructor } from "@thegraid/common-lib"

export const playerColors = ['b', 'w'] as const // Player Colors!
export const playerColorsC = ['b', 'w', 'c'] as const // Player Colors + Criminal!
export const playerColor0 = playerColors[0]
export const playerColor1 = playerColors[1]
export const playerColor2 = playerColorsC[2]
export const criminalColor = playerColorsC[2]
//type playerColorTuple = typeof playerColors
export type PlayerColor = typeof playerColorsC[number];
export function otherColor(color: PlayerColor): PlayerColor { return color === playerColor0 ? playerColor1 : playerColor0 }

/** PlayerColerRecord<T> maps from PlayerColor -> T */
export type PlayerColorRecord<T> = Record<PlayerColor, T>
export function playerColorRecord<T>(b: T = undefined, w: T = undefined, c: T = undefined): PlayerColorRecord<T> { return { b, w, c } };
export function playerColorRecordF<T>(f: (sc: PlayerColor) => T) { return playerColorRecord(f(playerColor0), f(playerColor1), f(playerColor2)) }

export function buildURL(scheme = 'wss', host = TP.ghost, domain = TP.gdomain, port = TP.gport, path = ''): string {
  return `${scheme}://${host}.${domain}:${port}${path}`
}
export class TP {
  static cacheTiles = 2;
  static snapToPixel = true;
  static useEwTopo = false;
  static ankhRad = 20;
  static ankh1Rad = 36;
  static ankh2Rad = 48;
  static warriorPerPlayer = 6;
  static textLogLines = 6;
  static placeAdjacent = true;
  static alwaysShift = false;
  static parallelAttack = true;  // true --> N intersects S
  static allowSacrifice = true;
  static yield = true
  static yieldMM = 1
  static pPlaner = true
  static pWorker = false
  static pWeight = 1      // allocation of new value: vNew * w + vOld * (1-w)
  static keepMoves = 4;   // number of predicted/evaluated moves to retain in State.moveAry
  static pResign = 1      // if lookahead(resignAhead).bv = -Infinity --> Resign
  static pBoards = true   // true: evalState saves board->state
  static pMoves = true    // true: use predicted moveAry
  static pGCM = true      // GC state.moveAry (except bestHexState.moveAry)
  static maxPlys = 5      // for robo-player lookahead
  static maxBreadth = 7   // for robo-player lookahead
  static nPerDist = 4     // samples per district
  // Note that DARKGREY is actually lighter than GREY
  static Black_White = playerColorRecord<'BLACK' | 'WHITE' | 'DARKGREY'>('BLACK', 'WHITE', 'DARKGREY')
  static Blue_Red = playerColorRecord<'BLUE' | 'RED' | 'DARKGREY'>('BLUE', 'RED', 'DARKGREY')
  static Red_Blue = playerColorRecord<'RED' | 'BLUE' | 'DARKGREY'>('RED', 'BLUE', 'DARKGREY')
  static schemeNames = ['Red_Blue', 'Blue_Red'];
  static colorScheme = TP.Blue_Red;
  static numPlayers = 2;
  /** Order [number of rings] of metaHexes */
  static mHexes = 1;   // number hexes on side of Meta-Hex
  /** Order [number of Hexs on side] of District [# rings of Hexes in each metaHex] */
  static nHexes = 10;    // number of Hexes on side of District
  static nDistricts = 1;
  static nVictory = 3  // number of Colony to win
  static tHexes = TP.ftHexes(this.mHexes) * TP.ftHexes(this.nHexes)
  static hexRad = 60;
  static meepleRad = TP.hexRad * .4;
  static meepleY0 = 0;//TP.hexRad * .25;
  static log = 0
  static riverColor = '#90b2f4';
  static borderColor = '#4D5656'; // darker than riverColor
  static splitColor = '#6D9686'; // lighter than borderColor

  /** map size for (dpb, dop) */
  static fnHexes(nh = TP.nHexes, nm = TP.mHexes) {
    TP.nHexes = nh;
    TP.mHexes = nm;
    TP.tHexes = TP.ftHexes(TP.mHexes)
  }
  /** number of hexes in a metaHex of order n; number of districts(n=TP.mHexes)
   * @return an odd number: 1, 7, 19, 37, 61, 97, ... */
  static ftHexes(n: number): number { return (n <= 1) ? n : 6 * (n-1) + TP.ftHexes(n - 1) }
  /** initialize fnHexes using initial nHexes, mHexes */
  static xxx = TP.fnHexes();

  /** exclude whole Extension sets */
  static excludeExt: string[] = ["Policy", "Event", "Roads", "Transit"]; // url?ext=Transit,Roads
  // timeout: see also 'autoEvent'
  static stepDwell:  number = 150
  static moveDwell:  number = 600
  static flashDwell: number = 500
  static flipDwell:  number = 200 // chooseStartPlayer dwell between each card flip

  static bgColor: string = 'tan' //'wheat'// C.BROWN
  static xborderColor: string = 'peru'//TP.bgColor; //'burlywood'

  static ghost: string = 'cgserver'   // game-setup.network()
  static gdomain: string = 'thegraid.com'
  static gport: number = 8447
  static networkUrl = buildURL();  // URL to cgserver (wspbserver)
  static networkGroup: string = "hexagon";
}
