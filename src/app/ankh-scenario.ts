
// TODO: namespace or object for GameState names

import { Constructor, S, className, stime } from "@thegraid/common-lib";
import { KeyBinder } from "@thegraid/easeljs-lib";
import { AnkhPiece, AnkhSource, Figure, GodFigure, Guardian, Monument, RadianceMarker, Scorpion } from "./ankh-figure";
import type { AnkhHex, AnkhMap, RegionId } from "./ankh-map";
import { AnkhToken } from "./ankh-token";
import { ClassByName } from "./class-by-name";
import { removeEltFromArray } from "./functions";
import type { GamePlay } from "./game-play";
import { AnkhMarker } from "./god";
import { EwDir, HexDir } from "./hex-intfs";
import { Meeple } from "./meeple";
import { Player } from "./player";
import { CardName, CardState, PlayerPanel, cardStates } from "./player-panel";
import { ActionContainer } from "./table";
import { Tile } from "./tile";

type GodName = string;
export type GuardName = string | Constructor<Guardian>;
export type GuardIdent = [ g1?: GuardName, g2?: GuardName, g3?: GuardName ];
export type PowerIdent = 'Commanding' | 'Inspiring' | 'Omnipresent' | 'Revered' | 'Resplendent' | 'Obelisk' | 'Temple' | 'Pyramid' | 'Glorious' | 'Magnanimous' | 'Bountiful' | 'Worshipful';
export type RegionElt = [row: number, col: number, bid: RegionId];
/** ...elt4 is 'Ra' for Radiance and/or EwDir for Scorpion */
type PlaceElt = [row: number, col: number, cons?: Constructor<AnkhPiece | Figure> | GodName, pid?: number, ...elt4: any[]];
type AnkhElt = PowerIdent[];
export type ActionIdent = 'Move' | 'Summon' | 'Gain' | 'Ankh';
/** 'Move': [1,2] showing playerId */
type PlayerId = number;
type ActionElt = { [key in ActionIdent]?: PlayerId[]; } & { selected?: ActionIdent[]; };
type EventElt = PlayerId[];

/** [row, col, bid] -> new rid, with battle order = bid ;
 * - For Ex: [3, 0, 1], [4, 0, 'N', 'EN'], [4, 1, 'N']
 */
export type SplitBid = [row: number, col: number, bid: RegionId];
export type SplitDir = [row: number, col: number, d0: HexDir, d1?: HexDir, d2?: HexDir, d3?: HexDir, d4?: HexDir, d5?: HexDir];
export type SplitElt = (SplitBid | SplitDir)
export type SplitSpec = SplitElt[];

type SetupElt = {
  Aname?: string,        // {orig-scene}#{turn}
  ngods: number,         // == nPlayers (used to select, verify scenario)
  places: PlaceElt[],    // must have some GodFigure on the board!
  splits?: SplitSpec[],  // added camel train borders
  regions: RegionElt[],  // delta, east, west, ...; after splits.
  // the rest assume defaults or random values:
  godNames?: string[]    // Gods in the game ?? use names from URL command.
  cards?: (0|1|2)[][],   // [flood...cycle][0=inHand|1=inBattl|2=onTable]
  coins?: number[],      // 1
  scores?: number[],     // 0
  events?: EventElt,
  guards?: GuardIdent,   // Guardian types in use. default to random
  stable?: GuardIdent[], // Guardians in player's stable.
  actions?: ActionElt,
  ankhs?: AnkhElt[],     // per-player; [1, ['Revered', 'Omnipresent'], ['Satet']]
  turn?: number;   // default to 0; (or 1...)
}

export type Scenario = SetupElt;

// Rivers make first 3 Regions: West(1), East(2), Delta(3)
export class AnkhScenario {
  static readonly MiddleKingdom: Scenario[] = [
    // 2 Player:
    {
      ngods: 2,
      regions: [[4, 5, 1], [4, 6, 2], [3, 5, 3],],
      places: [
        [0, 3, 'Temple'],
        [2, 5, 'Pyramid'],
        [1, 8, 'Obelisk'],
        [5, 0, 'Obelisk', 1],
        [4, 1, 'Warrior', 1],
        [5, 1, 'GodFigure', 1],
        [8, 1, 'Pyramid'],
        [6, 5, 'Temple', 2],
        [6, 6, 'Warrior', 2],
        [7, 6, 'GodFigure', 2],
        [5, 8, 'Pyramid'],
      ],
    },
    // 3 player
    {
      ngods: 3,
      regions: [[4, 5, 1], [4, 6, 2], [3, 5, 3],],
      places: [
        [4, 3, 'GodFigure', 1],
        [4, 4, 'Warrior', 1],
        [5, 4, 'Temple', 1],
        [3, 0, 'Pyramid'],
        [7, 2, 'Obelisk'],

        [7, 6, 'GodFigure', 2],
        [6, 6, 'Warrior', 2],
        [6, 5, 'Obelisk', 2],
        [5, 9, 'Temple'],
        [3, 7, 'Pyramid'],

        [2, 5, 'GodFigure', 3],
        [3, 4, 'Warrior', 3],
        [2, 4, 'Pyramid', 3],
        [1, 8, 'Obelisk'],
        [3, 5, 'Temple'],
      ],
    },

    // 4 player
    {
      ngods: 4,
      regions: [[4, 5, 2], [3, 5, 3], [4, 6, 4],],
      splits: [
        [[3, 0, 1,], [4, 0, 'N', 'EN'], [4, 1, 'N', 'EN']],
      ],
      places: [
        [3, 1, 'GodFigure', 1],
        [3, 2, 'Warrior', 1],
        [4, 2, 'Temple', 1],
        [5, 5, 'Pyramid'],

        [7, 3, 'GodFigure', 2],
        [7, 4, 'Warrior', 2],
        [8, 4, 'Temple', 2],
        [7, 0, 'Pyramid'],
        [4, 1, 'Obelisk'],

        [2, 5, 'GodFigure', 3],
        [3, 4, 'Warrior', 3],
        [3, 5, 'Obelisk', 3],
        [1, 3, 'Temple'],
        [2, 8, 'Pyramid'],

        [4, 7, 'GodFigure', 4],
        [5, 6, 'Warrior', 4],
        [5, 7, 'Pyramid', 4],
        [3, 8, 'Obelisk'],
        [8, 6, 'Temple'],
      ],
    },
    // 5-player
    {
      ngods: 5,
      regions: [[4, 5, 1], [4, 6, 2], [3, 5, 4]],
      splits: [
        [[6, 7, 3], [7, 5, 'N'], [7, 6, 'WN', 'N'], [6, 7, 'WN', 'N', 'EN']],
        [[4, 0, 5], [4, 0, 'N', 'EN'], [4, 1, 'N', 'EN']],
      ],
      places: [
        [2, 1, 'Temple', 1],
        [3, 1, 'GodFigure', 1],
        [3, 2, 'Warrior', 1],
        [4, 5, 'Pyramid'],
        [4, 1, 'Obelisk'],
        [6, 1, 'GodFigure', 5],
        [7, 1, 'Pyramid', 5],
        [7, 2, 'Warrior', 5],
        [8, 4, 'Temple'],
        [7, 6, 'Obelisk'],
        [8, 7, 'Warrior', 3],
        [8, 8, 'GodFigure', 3],
        [8, 9, 'Temple', 3],

        [6, 6, 'Pyramid'],
        [4, 8, 'GodFigure', 2],
        [3, 8, 'Obelisk', 2],
        [3, 7, 'Warrior', 2],
        [1, 6, 'Temple'],
        [3, 4, 'GodFigure', 4],
        [2, 5, 'Warrior', 4],
        [3, 5, 'Pyramid', 4],
        [0, 2, 'Temple'],
      ],
    },
  ];
  static preBattle: Scenario = {
    ngods: 2,
    // godNames: ["Amun", "Osiris"],
    turn: 9,
    regions: [[4, 5, 1], [4, 6, 2], [3, 5, 3]],
    splits: [],
    guards: ["CatMum", "Apep", "Scorpion"],
    events: [0, 1, 0],
    actions: { "Move": [0, 1], "Summon": [0, 0, 0], "Gain": [1], "Ankh": [1, 0], "selected": [] },
    coins: [3, 1],
    scores: [0, 0.1],
    stable: [[], []],
    ankhs: [["Revered", "Omnipresent", "Pyramid", "Obelisk"], ["Revered", "Omnipresent", "Pyramid", "Obelisk"]],
    places: [[1, 8, "Obelisk", null], [5, 0, "Obelisk", 1], [2, 5, "Pyramid", 1], [8, 1, "Pyramid", 1], [5, 8, "Pyramid", 2], [0, 3, "Temple", null], [6, 5, "Temple", 2], [3, 4, "Warrior", 1], [4, 1, "Warrior", 1], [7, 1, "Warrior", 1], [1, 7, "Warrior", 1], [2, 4, "Warrior", 1], [3, 6, "Warrior", 2], [2, 6, "CatMum", 1], [0, 4, "Apep", 1], [8, 2, "GodFigure", 1], [4, 7, "GodFigure", 2]],
  };

  static preSplit: Scenario = {
    ngods: 2,
    // godNames: ["Amun", "Osiris"],
    turn: 10,
    regions: [[4,5,1],[4,6,2],[3,5,3]],
    splits: [],
    guards: ["CatMum","Apep","Scorpion"],
    events: [0,1,0,1],
    actions: {"Move":[0,1],"Summon":[0,0,0],"Gain":[1,1],"Ankh":[1,0],"selected":[]},
    coins: [4,1],
    scores: [4,2],
    stable: [[],[]],
    ankhs: [["Revered","Omnipresent","Pyramid","Temple"],["Revered","Omnipresent","Pyramid","Temple","Bountiful"]],
    places: [[2,6,"CatMum",1],[0,4,"Apep",1],[1,8,"Obelisk",null],[5,0,"Obelisk",1],[2,5,"Pyramid",1],[8,1,"Pyramid",1],[5,8,"Pyramid",2],[2,3,"Pyramid",1],[2,7,"Pyramid",2],[0,3,"Temple",null],[6,5,"Temple",2],[3,4,"Warrior",1],[1,7,"Warrior",1],[4,1,"Warrior",1],[7,1,"Warrior",1],[2,4,"Warrior",1],[8,2,"GodFigure",1],[4,7,"GodFigure",2]],
  };
  static preClaim = {
    ngods: 2,
    // godNames: ["Amun","Anubis"],
    turn: 13,
    regions: [[6,7,1],[7,7,2],[0,1,3],[4,5,4]],
    splits: [[[6,6,4,false],[6,7,"S"],[7,6,"EN"],[6,7,"WN"],[6,6,"EN"],[6,6,"N"]]],
    guards: ["CatMum","Apep","Scorpion"],
    events: [0,1,0,1,1,0],
    actions: {"Move":[0,1],"Summon":[],"Gain":[1,1,0],"Ankh":[0],"selected":[]},
    coins: [8,1],
    scores: [4,2],
    stable: [[],[,,"Scorpion"]],
    ankhs: [["Revered","Omnipresent","Pyramid","Temple","Bountiful"],["Revered","Omnipresent","Pyramid","Temple","Bountiful"]],
    places: [[4,7,"CatMum",1],[1,3,"Apep",1],[1,8,"Obelisk",null],[5,0,"Obelisk",1],[2,5,"Pyramid",1],[8,1,"Pyramid",1],[5,8,"Pyramid",2],[2,3,"Pyramid",1],[2,7,"Pyramid",2],[0,3,"Temple",1],[6,5,"Temple",2],[5,6,"Warrior",1],[1,7,"Warrior",1],[4,1,"Warrior",1],[8,2,"Warrior",1],[3,5,"Warrior",1],[6,6,"Warrior",2],[3,6,"Warrior",2],[5,7,"Warrior",2],[7,5,"GodFigure",1],[2,8,"GodFigure",2]],
  }
  static battle4 = {
    ngods: 4,
    godNames: ["Set","Amun","Hathor","Isis"],
    turn: 15,
    regions: [[4,0,1],[3,0,2],[0,1,3],[4,6,4]],
    splits: [[[3,0,1],[4,0,"N","EN"],[4,1,"N","EN"]]],
    guards: ["CatMum","Apep","Scorpion"],
    events: [0,1,2],
    actions: {"Move":[0,1,2,3],"Summon":[1,0],"Gain":[2,3,1,2],"Ankh":[3,0,1,2],"selected":[]},
    coins: [1,5,2,2],
    scores: [0,0.1,0.2,0.3],
    stable: [["Apep"],[],["CatMum","Apep"],[]],
    ankhs: [["Revered","Omnipresent","Pyramid","Temple"],["Revered","Omnipresent","Pyramid"],["Revered","Omnipresent","Pyramid","Temple"],["Revered","Omnipresent","Pyramid"]],
    places: [[4,1,"Obelisk",null],[3,5,"Obelisk",3],[3,8,"Obelisk",null],[5,5,"Pyramid",2],[7,0,"Pyramid",1],[2,8,"Pyramid",3],[5,7,"Pyramid",4],[4,2,"Temple",1],[8,4,"Temple",2],[1,3,"Temple",null],[8,6,"Temple",null],[2,4,"Warrior",1],[3,3,"Warrior",1],[5,4,"Warrior",2],[4,5,"Warrior",3],[7,5,"Warrior",4],[6,0,"CatMum",1],[7,4,"CatMum",2],[6,1,"GodFigure",1],[7,1,"GodFigure",2],[2,7,"GodFigure",3],[1,7,"GodFigure",4]],
  }
  static withPortal = {
    ngods: 2,
    godNames: ["Anubis","Osiris"],
    turn: 13,
    regions: [[1,5,1],[4,6,2],[4,5,3],[1,6,4]],
    splits: [[[3,5,4,false],[1,5,"EN"],[2,6,"WN"],[2,6,"WS"],[3,6,"WN"],[2,5,"S"],[3,5,"WN"]]],
    guards: ["CatMum","Apep","Scorpion"],
    events: [0,1,0,1,1,0],
    actions: {"Move":[0,1],"Summon":[0],"Gain":[1,1,0],"Ankh":[0],"selected":[]},
    coins: [14,2],
    scores: [5,7],
    stable: [[],[]],
    ankhs: [["Revered","Omnipresent","Pyramid","Obelisk","Bountiful"],["Revered","Omnipresent","Pyramid","Obelisk","Bountiful"]],
    places: [[2,6,"CatMum",1],[1,8,"Obelisk",null],[5,0,"Obelisk",1],[2,5,"Pyramid",1],[8,1,"Pyramid",1],[5,8,"Pyramid",2],[0,3,"Temple",1],[6,5,"Temple",2],[3,4,"Warrior",1],[1,7,"Warrior",1],[4,1,"Warrior",1],[1,3,"Warrior",1],[7,1,"Warrior",1],[2,4,"Warrior",1],[1,4,"Warrior",2],[1,5,"Portal",2],[0,4,"Apep",1],[1,5,"Scorpion",2],[8,2,"GodFigure",1],[4,7,"GodFigure",2]],
  }
  static big16 = {
    ngods: 4,
    godNames: ["Horus","Ra","Anubis","Osiris"],
    turn: 16,
    regions: [[4,0,1],[3,0,2],[0,1,3],[4,6,4]],
    splits: [[[3,0,1],[4,0,"N","EN"],[4,1,"N","EN"]]],
    guards: ["CatMum","Apep","Androsphinx"],
    events: [0,1,0,3],
    actions: {"Move":[0,1,2,3],"Summon":[0,2,3,0],"Gain":[1,2,3],"Ankh":[2,3,1,2],"selected":[]},
    coins: [2,0,0,3],
    scores: [4,3,2,1],
    stable: [[],["Apep"],["CatMum","Apep"],["CatMum"]],
    ankhs: [["Revered","Omnipresent","Pyramid"],["Revered","Omnipresent","Pyramid","Temple"],["Revered","Omnipresent","Pyramid","Obelisk"],["Revered","Omnipresent","Pyramid","Temple"]],
    places: [[4,1,"Obelisk",null],[3,5,"Obelisk",3],[3,8,"Obelisk",null],[5,5,"Pyramid",null],[7,0,"Pyramid",1],[2,8,"Pyramid",null],[5,7,"Pyramid",4],[8,2,"Pyramid",1],[1,5,"Pyramid",1],[5,0,"Pyramid",2],[3,2,"Pyramid",3],[3,3,"Pyramid",4],[4,2,"Temple",1],[8,4,"Temple",2],[1,3,"Temple",1],[8,6,"Temple",2],[7,6,"Warrior",2],[2,5,"Warrior",3],[6,6,"Warrior",4],[4,3,"Portal",4],[4,8,"Portal",4],[2,4,"Portal",4],[3,4,"CatMum",3],[6,1,"GodFigure",1],[7,1,"GodFigure",2],[2,7,"GodFigure",3],[1,7,"GodFigure",4]],
  }
  static big21 = {
    ngods: 4,
    godNames: ["Horus","Ra","Anubis","Osiris"],
    turn: 21,
    regions: [[7,2,1],[3,0,2],[6,1,3],[4,6,4],[0,1,5]],
    splits: [[[3,0,1],[4,0,"N","EN"],[4,1,"N","EN"]],[[8,1,5,false],[6,1,"ES"],[7,1,"EN"],[8,2,"WN"],[7,1,"S"],[8,1,"WN"]]],
    guards: ["CatMum","Apep","Androsphinx"],
    events: [0,1,0,3,0,1,2],
    actions: {"Move":[],"Summon":[],"Gain":[1,2,3,3,0],"Ankh":[3,0],"selected":[]},
    coins: [3,0,0,2],
    scores: [4,4.1,2,1],
    stable: [["Androsphinx"],[],["Apep"],["CatMum","Androsphinx"]],
    ankhs: [["Revered","Omnipresent","Pyramid","Temple","Bountiful"],["Revered","Omnipresent","Pyramid","Temple"],["Revered","Omnipresent","Pyramid","Obelisk"],["Revered","Omnipresent","Pyramid","Temple","Bountiful"]],
    places: [[4,4,"CatMum",3],[6,4,"Apep",2,'Ra'],[4,1,"Obelisk",null],[3,5,"Obelisk",3],[3,8,"Obelisk",null],[5,5,"Pyramid",2],[7,0,"Pyramid",1],[2,8,"Pyramid",3],[5,7,"Pyramid",4],[8,2,"Pyramid",1],[1,5,"Pyramid",1],[5,0,"Pyramid",2],[3,2,"Pyramid",3],[3,3,"Pyramid",4],[4,2,"Temple",1],[8,4,"Temple",2],[1,3,"Temple",1],[8,6,"Temple",2],[6,0,"Warrior",1],[3,1,"Warrior",1],[7,3,"Warrior",1],[1,4,"Warrior",1],[5,6,"Warrior",2],[5,1,"Warrior",2,'Ra'],[3,7,"Warrior",3],[6,6,"Warrior",4],[4,3,"Portal",4],[4,8,"Portal",4],[2,4,"Portal",4],[6,1,"GodFigure",1],[8,3,"GodFigure",2],[2,7,"GodFigure",3],[1,7,"GodFigure",4]],
  }

  static AltMidKingdom5: Scenario = {
    ngods: 5,
    turn: 15,
    godNames: ['Amun', 'Osiris', 'Set', 'Toth', 'Bastet'],
    actions: { Move: [0,1,2,3,4], Summon: [2], Gain: [0,1,3,4], Ankh: [3,4], selected: [] },
    ankhs: [
      ['Inspiring', 'Omnipresent', 'Pyramid'],
      ['Inspiring', 'Omnipresent'],
      ['Inspiring', 'Omnipresent', 'Pyramid'],
      ['Revered', 'Omnipresent', 'Pyramid'],
      ['Revered', 'Omnipresent', 'Pyramid'],
    ],
    coins: [2, 2, 0, 0, 0],
    events: [0, 2, 3],
    guards: ['Satet', 'Apep', 'Androsphinx'],
    places: [
      [2, 5, 'Satet', 2],
      [4, 1, 'Obelisk', undefined],
      [7, 6, 'Obelisk', undefined],
      [3, 8, 'Obelisk', 2],
      [6, 6, 'Pyramid', 2],
      [3, 5, 'Pyramid', 4],
      [4, 5, 'Pyramid', 1],
      [7, 1, 'Pyramid', 5],
      [8, 4, 'Temple', 3],
      [0, 2, 'Temple', undefined],
      [8, 9, 'Temple', 3],
      [1, 6, 'Temple', undefined],
      [2, 1, 'Temple', 1],
      [1, 5, 'Warrior', 1],
      [2, 6, 'Warrior', 2],
      [7, 4, 'Warrior', 3],
      [4, 4, 'Warrior', 4],
      [6, 5, 'Warrior', 5],
      [5, 4, 'GodFigure', 1],
      [7, 3, 'GodFigure', 5],
      [7, 5, 'GodFigure', 3],
      [5, 7, 'GodFigure', 2],
      [1, 2, 'GodFigure', 4],
    ],
    splits: [
      [[6, 7, 3], [7, 5, 'N'], [7, 6, 'WN', 'N'], [6, 7, 'WN', 'N', 'EN']], // [[6, 7, 3], ...]
      [[4, 0, 5], [4, 0, 'N', 'EN'], [4, 1, 'N', 'EN']],
    ],
    regions: [
      [1, 0, 1],
      [2, 9, 2],
      [7, 6, 3],
      [0, 2, 4],
      [4, 1, 5],
    ],
    scores: [0.0, 0.1, 0.2, 0.3, 0.4],
    stable: [
      ['Satet', 'Apep'],
      [],
      ['Satet', 'Apep'],
      [],
      [],
    ],
  };

  static AltMidKingdom2: Scenario = {
      ngods: 2,
      turn: 3,
      regions: [[2, 0, 1], [2, 10, 2], [0, 2, 3]],
      guards: ['Satet', 'Apep', 'Scorpion'],
      events: [0, 1],
      actions: { Move: [0,1], Ankh: [0,1] },
      coins: [4, 5],
      scores: [2, 3],
      stable: [['Satet'], []],
      ankhs: [['Commanding', 'Revered'], ['Inspiring', 'Omnipresent', 'Temple']],
      places: [
        [3, 4, 'Warrior', 1],
        [8, 2, 'GodFigure', 1],
        [3, 6, 'Warrior', 2],
        [4, 7, 'GodFigure', 2],

        [0, 3, 'Temple'],
        [2, 5, 'Pyramid'],
        [1, 8, 'Obelisk'],
        [5, 0, 'Obelisk', 1],
        [8, 1, 'Pyramid'],
        [6, 5, 'Temple', 2],
        [5, 8, 'Pyramid'],
      ]
  };
}

export class ScenarioParser {

  constructor(public map: AnkhMap<AnkhHex>, public gamePlay: GamePlay) {

  }

  parseRegions(regionElt: RegionElt[]) {
    const ankhMap = this.map;
    // regions have been split; river splits and given splits
    // now: make sure all the regionIds are correct:
    regionElt.forEach(([row, col, rid]) => {
      // assign battleOrder for region[seed]; in order, from saveScenario
      // we will simply permute the regions array.
      const hex = ankhMap[row][col];
      const rindex = ankhMap.regionIndex(row, col, hex);
      const xregion = ankhMap.regions[rid - 1];
      ankhMap.regions[rid - 1] = ankhMap.regions[rindex];
      ankhMap.setRegionId(rid);
      ankhMap.regions[rindex] = xregion;
      ankhMap.setRegionId(rindex + 1 as RegionId);

      ankhMap.regions[rid - 1]['Aname'] = `${hex}`
    });
  }

  parseSplits(splits: SplitSpec[], turnSet = false) {
    const map = this.map;
    if (map.splits.length > 3) {
      map.splits = [];
      map.oneRegion();
      map.addRiverSplits();
    }
    splits.forEach((splitSpec) => {
      map.addSplit(splitSpec, true); // ignore bid; parseRegions will sort it out.
    })
    map.update();
  }

  /** Place (or replace) all the Figures on the map. */
  parsePlaces(place: PlaceElt[], unplaceAnkhs = false) {
    const map = this.map;
    if (unplaceAnkhs) {
      this.gamePlay.allPlayers.forEach(player => {
        const source = player.panel.ankhSource;
        const units = source.filterUnits(unit => unit.hex !== source.hex);
        units.forEach(unit => source.availUnit(unit));
      })
    }
    //console.groupCollapsed('place');
    place.forEach(elt => {
      const [row, col, cons0, pid, ...elt4] = elt;
      const cons = (typeof cons0 === 'string') ? ClassByName.classByName[cons0] : cons0;
      const hex = map[row][col];
      const player = (pid !== undefined) ? this.gamePlay.allPlayers[pid - 1] : undefined; // required for Figure
      // find each piece, place on map
      // console.log(stime(this, `.place0:`), { hex: `${hex}`, cons: cons.name, pid });
      const source0 = cons['source'];
      const source = ((source0 instanceof Array) ? source0[pid - 1] : source0) as AnkhSource<AnkhPiece>;
      const godFig = (cons.name !== 'GodFigure') ? undefined : GodFigure.named(player.god.Aname) ?? new cons(player, 0, player.god) as GodFigure;
      const piece0 = godFig ?? ((source !== undefined) ? source.takeUnit().setPlayerAndPaint(player) : undefined);
      const piece = piece0 ?? new cons(player, 0, cons.name);
      if (piece instanceof Guardian) {
        // first: put in Stable, to reserve its slot for future sendHome()
        player.panel.takeGuardianIfAble(undefined, piece); // setPlayerAndPaint()
        if (piece instanceof Scorpion) {
          const dir = elt4.shift() as EwDir;
          piece.rotDir = dir;
        }
      }
      piece.moveTo(hex);
      if (elt4[0] === 'Ra') {
        elt4.shift();
        const source = RadianceMarker.source.find(s => !!s);
        const rm = source.takeUnit();
        rm?.moveTo(hex);    // set Radiance on piece.
      }
      // if a Claimed Monument, add AnkhToken:
      if (player && (piece instanceof Monument)) {
        this.claimHex(hex, player); // claimMonument
      }
    })
    //console.groupEnd();
  }

  claimHex(hex: AnkhHex, player: Player) {
    const ankhToken = AnkhToken.source[player.index].takeUnit();
    ankhToken.moveTo(hex);
    ankhToken.setPlayerAndPaint(player);
    // console.log(stime(this, `.claimHex: ${hex}`), player.color);
  }

  // coins, score, actions, events, AnkhPowers, Guardians in stable; Amun, Bastet, Horus, ...
  parseScenario(setup: SetupElt) {
    if (!setup) return;
    console.log(stime(this, `.parseScenario: curState =`), this.saveState(this.gamePlay, true)); // log current state for debug...
    console.log(stime(this, `.parseScenario: newState =`), setup);

    const { regions, splits, coins, scores, turn, guards, cards, events, actions, stable, ankhs, places } = setup;
    const map = this.map, gamePlay = this.gamePlay, allPlayers = gamePlay.allPlayers, table = gamePlay.table;
    coins?.forEach((v, ndx) => allPlayers[ndx].coins = v);
    scores?.forEach((v, ndx) => allPlayers[ndx].score = v);
    const turnSet = (turn !== undefined); // indicates a Saved Scenario.
    if (turnSet) {
      gamePlay.turnNumber = turn;
      table.turnLog.log(`turn = ${turn}`, `parseSetup`);
      table.guardSources.forEach(source => {
        // retrieve Units from board or stables; return to source:
        source.filterUnits(u => true).forEach(unit => (unit.moveTo(undefined), source.availUnit(unit)))
        source.nextUnit();
      });
      this.gamePlay.allTiles.forEach(tile => tile.hex?.isOnMap ? tile.sendHome() : undefined);
    }
    const states = cardStates, colorForState = PlayerPanel.colorForState;
    if (cards !== undefined) {
      table.panelForPlayer.forEach((panel, pi) => {
        panel.cardSelector.powerLines.forEach((pl, ndx) => pl.button.colorn = colorForState[states[cards[pi][ndx]]] );
      })
    } else {
      table.panelForPlayer.forEach(panel => {
        panel.cardSelector.powerLines.forEach((pl, ndx) => pl.button.colorn = colorForState[states[0]] );
      })
    }
    if (events !== undefined) {
      table.eventCells.forEach((evc, ndx) => table.removeEventMarker(ndx))
      events.forEach((pid, ndx) => {
        table.setEventMarker(ndx, this.gamePlay.allPlayers[pid]);
      })
      gamePlay.eventName = undefined;
      map.update();
    }
    if (actions !== undefined) {
      const players = this.gamePlay.allPlayers;
      table.actionRows.forEach(({ id }) => {
        const rowCont = table.actionPanels[id] as ActionContainer;
        rowCont.resetToFirstButton();
        const pids = actions[id] ?? [];
        pids.forEach((pid, cn) => table.setActionMarker(rowCont.getButton(cn), players[pid]));
      });
      const selected = actions.selected ?? [];
      table.activateActionSelect(true, selected[0])
    }
    if (splits) this.parseSplits(splits, turnSet);
    if (regions) this.parseRegions(regions);
    table.regionMarkers.forEach((r, n) => table.setRegionMarker(n + 1 as RegionId)); // after parseRegions
    guards?.forEach((name, ndx) => {
      const source = table.guardSources[ndx];
      source.filterUnits((unit) => !unit.setPlayerAndPaint(undefined));

      if (typeof name !== 'string') name = name.name; // if Constructor was given in Scenario def'n
      if (name !== source.type.name) {
        const guardianConstructor = ClassByName.classByName[name] as Constructor<Guardian>;
        // replace existing gamePlay.guards[ndx] & install new TileSource:
        const n = source.deleteAll(unit => {
          removeEltFromArray(unit, Tile.allTiles);
          removeEltFromArray(unit, Meeple.allMeeples);
          removeEltFromArray(unit, Figure.allFigures);
        });
        source.hex.cont.updateCache();
        const newSource = Guardian.makeSource(source.hex, guardianConstructor, n);
        gamePlay.guards[ndx] = guardianConstructor;
        table.guardSources[ndx] = newSource;
        newSource.nextUnit();
      }
    });
    stable?.forEach((gNames, pid) => {
      const player = allPlayers[pid], panel = player.panel;
      console.log(stime(this, `.stable:[${pid}]`), gNames);
      gNames.forEach((gName) => {
        const ndx = table.guardSources.findIndex(source => (source.type.name === gName))
        const source = table.guardSources[ndx];
        if (source) {
          player.panel.takeGuardianIfAble(ndx);
        }
        console.log(stime(this, `.stable:[${pid}]-${ndx} ${gName} source.allUnits=`), source?.filterUnits(u => true))
      });
    });
    // reset all AnkhTokens, ready for claim some Monument:
    this.parsePlaces(places, turnSet);  // turnSet indicates a saved Scenario, vs original.
    // set AnkhPowers in panel:
    ankhs?.forEach((powers: AnkhElt, pid) => {
      // console.log(stime(this, `.ankhs[${pid}]`), powers);
      const player = allPlayers[pid], panel = player.panel;
      const god = player.god;
      // remove existing AnkhPowers & AnkhTokens
      god.ankhPowers.length = 0;
      god.ankhPowers.push(...powers);
      panel.ankhPowerTokens.length = 0;
      // add ankhs for each colCont:
      panel.powerCols.forEach((colCont, cn) => {
        colCont.removeChildType(AnkhToken).forEach(ankhToken => ankhToken.sendHome());
        // leaving only the marker children!
        const ankhs = [panel.ankhSource.takeUnit(), panel.ankhSource.takeUnit(),];
        ankhs.forEach((ankh, cn) => {
          const marker = colCont.children[cn];
          ankh.x = marker.x; ankh.y = marker.y;
        })
        panel.ankhPowerTokens.push(...ankhs); // add 2 ankhs to supply
        colCont.addChild(...ankhs);
        colCont.ankhs = ankhs;
      })
      // find {colCont, powerLine} in panel.powerCols where button.name === powers[i]
      powers.forEach(power => {
        panel.powerCols.find(colCont =>
          colCont.powerLines.find(pl => (pl.button.name === power) && (panel.addAnkhToPowerLine(pl), true))
        );
      })
    });
    this.gamePlay.hexMap.update();
  }

  saveState(gamePlay: GamePlay, silent = false) {
    const table = gamePlay.table;
    const ngods = gamePlay.allPlayers.length;
    const godNames = gamePlay.allPlayers.map(player => player.god.name);
    const turn = Math.max(0, gamePlay.turnNumber);
    const coins = gamePlay.allPlayers.map(p => p.coins);
    const scores = table.playerScores;
    if (!silent) console.log(stime(this, `.saveState: --- `), { turn, ngods, godNames })

    const allRegions = gamePlay.hexMap.regions;
    const rawRegions = allRegions.map((region, n) => region && region[0] && ([region[0].row, region[0].col, n + 1]) as SplitBid);
    const regions = rawRegions.filter(r => !!r);
    const splits = gamePlay.hexMap.splits.slice(2);
    const events = table.eventCells.slice(0, table.nextEventIndex).map(elt => elt.pid);
    // Guardian constructors used to fill table.guardSources:
    const guards = gamePlay.guards.map(CoG => CoG.name) as GuardIdent;
    const actions: ActionElt = {};
    table.actionRows.forEach(({id}) => {
      const rowCont = table.actionPanels[id] as ActionContainer;
      const buttons = rowCont.buttons;
      const nActions = buttons.findIndex(elt => !elt.children.find(ch => ch instanceof AnkhMarker));
      actions[id] = buttons.slice(0, nActions).map(elt => elt.pid);
    })
    actions.selected = this.gamePlay.gameState.selectedActions;
    const indexForColor = PlayerPanel.indexForColor;
    const cards = table.panelForPlayer.map(panel =>
      panel.cardSelector.powerLines.map(pl => indexForColor[pl.button.colorn])
    );
    const stable = table.panelForPlayer.map(panel => {
      return panel.stableHexes.slice(1).map(hex => hex.meep?.name).filter(elt => elt !== undefined) as GuardIdent;
    })
    const ankhs = gamePlay.allPlayers.map(p => p.god.ankhPowers.concat());
    const places = this.gamePlay.allTiles.filter(t => t.hex?.isOnMap && !(t instanceof AnkhToken)).map(t => {
      const row = t.hex.row, col = t.hex.col, cons = className(t), pid = t.player ? t.player.index + 1 : undefined;
      const elt4 = [];
      if ((t instanceof Figure) && t.raMarker) elt4.unshift('Ra');
      if (t instanceof Scorpion) elt4.unshift(t.rotDir);
      return [row, col, cons, pid, ...elt4] as PlaceElt;
    })

    return { ngods, godNames, turn, regions, splits, guards, events, actions, coins, scores, cards, stable, ankhs, places } as SetupElt;
  }

  logState(state: SetupElt, logWriter = this.gamePlay.logWriter) {
    let lines = '{', keys = Object.keys(state), n = keys.length - 1;
    keys.forEach((key, ndx) => {
      const line = JSON.stringify(state[key])
      lines = `${lines}\n  ${key}: ${line}${ndx < n ? ',' : ''}`;
    })
    lines = `${lines}\n},`
    logWriter.writeLine(lines);
  }

  /** debug utility */
  identCells(map: AnkhMap<AnkhHex>) {
    map.forEachHex(hex => {
      const hc = hex.cont;
      hc.mouseEnabled = true;
      hc.on(S.click, () => {
        hex.isLegal = !hex.isLegal;
        map.update();
      });
    });
    KeyBinder.keyBinder.setKey('x', {
      func: () => {
        const cells = map.filterEachHex(hex => hex.isLegal);
        const list = cells.map(hex => `${hex.rcs},`);
        console.log(''.concat(...list));
      }
    });
  }
}

