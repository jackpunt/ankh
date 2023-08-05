
// TODO: namespace or object for GameState names

import { Constructor, S } from "@thegraid/common-lib";
import { AnkhPiece, Figure, GodFigure, Monument, Obelisk, Pyramid, Temple, Warrior } from "./ankh-figure"
import { HexDir } from "./hex-intfs";
import { KeyBinder } from "@thegraid/easeljs-lib";
import { AnkhMap, AnkhHex } from "./ankh-map";
import { AnkhToken } from "./god";
import { Hex2 } from "./hex";
import { Player } from "./player";
import { TileSource } from "./tile-source";
import { GamePlay } from "./game-play";

type GodName = string;
type GuardName = string;
type GuardIdent = { g1: GuardName, g2: GuardName, g3: GuardName };
type RegionElt = [row: number, col: number, bid: number];
type PlaceElt = [row: number, col: number, cons?: Constructor<AnkhPiece | Figure> | GodName, pid?: number];
type ClaimElt = [row: number, col: number, pid: number];
type MoveElt = [row: number, col: number, row1: number, col1: number]; // move Piece from [r,c] to [r1,c1]

/** [row, col, bid] -> new rid, with battle order = bid ;
 * - For Ex: [3, 0, 1], [4, 0, 'N', 'NE'], [4, 1, 'N']
 */
type SplitBid = [row: number, col: number, bid: number];
type SplitDir = [row: number, col: number, d0: HexDir, d1?: HexDir, d2?: HexDir, d3?: HexDir, d4?: HexDir, d5?: HexDir];
type SplitElt = (SplitBid | SplitDir)

type SetupElt = {
  coins?: number[],
  score?: number[],
  player?: number, // default to first player.
  event0?: number,
  actions?: { Move?: number, Summon?: number, Gain?: number, Ankh?: number },
  guards?: GuardIdent,   // Guardian types in use.
  stable?: GuardIdent[], // per-player
}

type RegionSpec = { region: RegionElt[] }
type PlaceSpec = { place: PlaceElt[] }
type SplitSpec = { split: SplitElt[] }
type ClaimSpec = { claim: ClaimElt[] }
type SetupSpec = { setup: SetupElt }

type SwapSpec = { swap: [rid: number, bid: number][] }
type ScenarioSpec = RegionSpec | PlaceSpec | SplitSpec | SetupSpec;
type Scenario = ScenarioSpec[];

// Rivers make first 3 Regions: West(1), East(2), Delta(3)
export class AnkhScenario {
  static readonly MiddleKingdom: Scenario[] = [
    // 2 Player:
    [
      { region: [[4, 5, 1], [4, 6, 2], [3, 5, 3],] },
      {
        place: [
          [0, 3, Temple],
          [2, 5, Pyramid],
          [1, 8, Obelisk],
          [5, 0, Obelisk, 1],
          [4, 1, Warrior, 1],
          [5, 1, GodFigure, 1],
          [8, 1, Pyramid],
          [6, 5, Temple, 2],
          [6, 6, Warrior, 2],
          [7, 6, GodFigure, 2],
          [5, 8, Pyramid],
        ]
      }
    ],
    // 3 player
    [
      { region: [[4, 5, 1], [4, 6, 2], [3, 5, 3],] },
      {
        place: [
          [4, 3, GodFigure, 1],
          [4, 4, Warrior, 1],
          [5, 4, Temple, 1],
          [3, 0, Pyramid],
          [7, 2, Obelisk],

          [7, 6, GodFigure, 2],
          [6, 6, Warrior, 2],
          [6, 5, Obelisk, 2],
          [5, 9, Temple],
          [3, 7, Pyramid],

          [2, 5, GodFigure, 3],
          [3, 4, Warrior, 3],
          [2, 4, Pyramid, 3],
          [1, 8, Obelisk],
          [3, 5, Temple],
        ]
      }
    ],
    // 4 player
    [
      { region: [[4, 5, 2], [3, 5, 3], [4, 6, 4],] },
      { split: [[3, 0, 1], [4, 0, 'N', 'NE'], [4, 1, 'N', 'NE']] },
      {
        place: [
          [3, 1, GodFigure, 1],
          [3, 2, Warrior, 1],
          [4, 2, Temple, 1],
          [5, 5, Pyramid],

          [7, 3, GodFigure, 2],
          [7, 4, Warrior, 2],
          [8, 4, Temple, 2],
          [7, 0, Pyramid],
          [4, 1, Obelisk],

          [2, 5, GodFigure, 3],
          [3, 4, Warrior, 3],
          [3, 5, Obelisk, 3],
          [1, 3, Temple],
          [2, 8, Pyramid],

          [4, 7, GodFigure, 4],
          [5, 6, Warrior, 4],
          [5, 7, Pyramid, 4],
          [3, 8, Obelisk],
          [8, 6, Temple],
        ]
      }],
    // 5-player
    [
      { region: [[4, 5, 1], [4, 6, 2], [3, 5, 4]] },
      { split: [[6, 7, 3], [7, 5, 'N'], [7, 6, 'NW', 'N'], [6, 7, 'NW', 'N', 'NE']] },
      { split: [[4, 0, 5], [4, 0, 'N', 'NE'], [4, 1, 'N', 'NE']] },
      {
        place: [
          [2, 1, Temple, 1],
          [3, 1, GodFigure, 1],
          [3, 2, Warrior, 1],
          [4, 5, Pyramid],
          [4, 1, Obelisk],
          [6, 1, GodFigure, 5],
          [7, 1, Pyramid, 5],
          [7, 2, Warrior, 5],
          [8, 4, Temple],
          [7, 6, Obelisk],
          [8, 7, Warrior, 3],
          [8, 8, GodFigure, 3],
          [8, 9, Temple, 3],

          [6, 6, Pyramid],
          [4, 8, GodFigure, 2],
          [3, 8, Obelisk, 2],
          [3, 7, Warrior, 2],
          [1, 6, Temple],
          [3, 4, GodFigure, 4],
          [2, 5, Warrior, 4],
          [3, 5, Pyramid, 4],
          [0, 2, Temple],
        ]
      }
    ],
  ];

  // just push/concat more ScenarioSpec on the end:
  static setup(scenario: Scenario, ...specs: Scenario) {
    // First: convert PlaceElt Constructor<> to use 'string':
    const place0 = scenario.find(elt => elt['place']) as PlaceSpec; // initial placements, before Move
    const placeElt0 = place0.place;
    const placeElt2 = placeElt0.map(([row, col, cons, pid]) => [row, col, (typeof cons === 'string') ? cons : cons.name, pid]) as PlaceElt[];
    place0.place = placeElt2;
    const acopy = structuredClone(scenario);
    return acopy.concat(specs);
  }
  static AltMidKingom2 = AnkhScenario.setup(AnkhScenario.MiddleKingdom[0],
    { place: [
          [3, 4, Warrior, 1],
          [8, 2, GodFigure, 1],
          [3, 6, Warrior, 2],
          [4, 7, GodFigure, 2],
        ]},
    { setup: {
        event0: 2,
        actions: { Move: 2, Ankh: 2 },
        coins: [4, 5],
        score: [2, 3],
      }
    },
  )
}

export class ScenarioParser {
  static classByName: { [index: string]: Constructor<GodFigure | Monument> } = { 'GodFigure': GodFigure, 'Obelisk': Obelisk, 'Pyramid': Pyramid, 'Temple': Temple, 'Warrior': Warrior }
  constructor(public map: AnkhMap<AnkhHex>, public gamePlay: GamePlay) {

  }
  parseScenario(scenario: Scenario) {
    const regionSpec = scenario.find(elt => elt['region']) as RegionSpec;
    const splitSpecs = scenario.filter(elt => elt['split']) as SplitSpec[];
    const placeSpecs = scenario.filter(elt => elt['place']) as PlaceSpec[];
    const setupSpecs = scenario.filter(elt => elt['setup']) as SetupSpec[];
    this.parseRegions(regionSpec?.region);
    this.parseSplits(splitSpecs);
    placeSpecs.forEach(placeSpec => this.parsePlaces(placeSpec?.place));
    this.parseSetup(setupSpecs[setupSpecs.length - 1]?.setup); // only the last 'setup' is used.
  }

  parseRegions(region: RegionElt[]) {
    const map = this.map;
    region.forEach(elt => {
      // assign battleOrder for region[seed]
      // we will simply permute the regions array.
      const [row, col, bid] = elt, hex = map[row][col];
      const rindex = map.regionOfHex(row, col, hex);
      const xregion = map.regions[bid - 1];
      map.regions[bid - 1] = map.regions[rindex];
      map.regions[bid - 1].forEach(hex => hex.district = bid);
      map.regions[rindex] = xregion;
      map.regions[rindex]?.forEach(hex => hex.district = rindex + 1);

      map.regions[bid - 1]['Aname'] = `${hex}`
    });
  }
  // console.log(stime(this, `.regions: input`), region0.region);
  // console.log(stime(this, `.regions: result`), map.regionList());
  parseSplits(splits: SplitSpec[]) {
    const map = this.map;
    splits.forEach((splitElt) => {
      // console.log(stime(this, `.splits[${i}]`), splitElt, splitElt.split);
      const splitN = (splitElt.split[0] as SplitBid);
      const splitD = (splitElt.split as SplitDir[]); // we will skip splitD[0] !!
      // hex[row,col] will be in the NEW region, with NEW bid.
      const [row, col, bid] = splitN; // (split as any as (number)[][]).shift();
      const newHex = map[row][col];
      const origNdx = map.regionOfHex(row, col, newHex);
      // console.log(stime(this, `.splits[${i}] hex: ${newHex} origNdx: ${origNdx} bid: ${bid}`))
      //splitD.shift();
      const splitShape = map.edgeShape('#4D5656'); // grey
      map.mapCont.infCont.addChild(splitShape);
      splitD.forEach((elt, i) => {
        if (i === 0) return undefined; // element 0 is SplitN: SplitInt;
        const [row, col, d0, d1, d2, d3, d4, d5] = elt; // generally no more than 3 edges per cell...
        const dirs = [d0, d1, d2, d3, d4, d5].filter(dir => dir !== undefined);
        // add border on each edge of [row, col]
        const hex = map[row][col];
        // console.log(stime(this, `.split: border ${hex}`), dirs);
        dirs.forEach(dir => map.addEdge([row, col, dir], splitShape));
        return hex;
      });
      map.update();

      // region will split to 2 region IDs: [regions.length, origNdx]
      // given Hex put in slot 'len', but labeled with id/Ndx = bid-1, other get origNdx
      const ids = [bid - 1, origNdx,];
      const [newRs, adjRs] = map.findRegions(map.regions[origNdx], newHex, ids.concat());
      // console.log(stime(this, `.split: newRs`), map.regionList(newRs), ids);
      // copy regions to their designated slots:
      map.regions[ids[0]] = newRs[0]; // rid = 'bid-1'; put in slot 'bid-1'
      map.regions[ids[1]] = newRs[1]; // rid = origNdx; put in slot origNdx
      map.regions[ids[0]].forEach(hex => hex.district = ids[0] + 1); // always: district = Ndx+1
      map.regions[ids[1]].forEach(hex => hex.district = ids[1] + 1); // always: district = Ndx+1
    })
    // console.log(stime(this, `.split adjRegions:`), map.regionList());
  }

  /** Place (or replace) all the Figures on the map. */
  parsePlaces(place: PlaceElt[]) {
    const map = this.map;
    Figure.allFigures.forEach(fig => (fig.hex?.isOnMap ? fig.sendHome() : undefined));

    //console.groupCollapsed('place');
    place.forEach(elt => {
      const [row, col, cons0, pid] = elt;
      const cons = (typeof cons0 === 'string') ? ScenarioParser.classByName[cons0] : cons0;
      const hex = map[row][col];
      const player = Player.allPlayers[pid - 1], pNdx = player?.index;
      const godFigure = player
      // find each piece, place on map
      // console.log(stime(this, `.place0:`), { hex: `${hex}`, cons: cons.name, pid });
      const source0 = cons['source'];
      const source = ((source0 instanceof Array) ? source0[player?.index] : source0) as TileSource<AnkhPiece>;
      const godFig = (cons.name !== 'GodFigure') ? undefined : GodFigure.named(player.god.Aname) ?? new cons(player, 0, player.god.Aname) as GodFigure;
      let piece0 = godFig ?? ((source instanceof TileSource) ? source.takeUnit() : undefined);
      const piece = piece0 ?? new cons(player, 0, cons.name);
      piece.moveTo(hex);
      // if a Claimed Monument, add AnkhToken:
      if ((pNdx !== undefined) && (piece instanceof Monument)) {
        AnkhToken.source[pNdx].takeUnit().moveTo(hex);// this.parseClaim([row, col, pNdx + 1]);
      }
    })
    //console.groupEnd();
  }
  // {claim: [row, col, pid]}
  parseClaim(claimSpec: ClaimElt[]) {
    const map = this.map;
    claimSpec.forEach(spec => {
      const [row, col, pid] = spec;
      const hex = map[row][col];
      const player = Player.allPlayers[pid - 1], pNdx = player?.index;
      const piece = hex.tile;
      if ((pNdx !== undefined) && (piece instanceof Monument)) {
        AnkhToken.source[pNdx].takeUnit().moveTo(hex);
      }
    })
  }

  parseMove(moveSpec: MoveElt[]) {
    const map = this.map, gamePlay = this.gamePlay, allPlayers = gamePlay.allPlayers, table = gamePlay.table;
  }

  // coins, score, actions, events, AnkhPowers, Guardians in stable; Amun, Bastet, Horus, ...
  parseSetup(setup: SetupElt) {
    if (!setup) return;
    const map = this.map, gamePlay = this.gamePlay, allPlayers = gamePlay.allPlayers, table = gamePlay.table;
    setup.coins?.forEach((v, ndx) => allPlayers[ndx].coins = v);
    setup.score?.forEach((v, ndx) => allPlayers[ndx].score = v);
    if (setup.event0 !== undefined) {
      for (let ndx = 0; ndx < setup.event0; ndx++) {
        table.setEventMarker(ndx);
      }
      map.update();
    }
    if (setup.actions !== undefined) {
      table.actionRows.forEach(({ id }) => {
        const nSelected = setup.actions[id] ?? 0;
        for (let cn = 0; cn < nSelected; cn++) {
          const rowCont = table.actionPanels[id];
          const button = rowCont.getButton(cn);
          table.setActionMarker(button);
        }
      });
    }
  }

  /** debug utility */
  identCells(map: AnkhMap<AnkhHex>) {
    map.forEachHex(hex => {
      const h2 = (hex as any as Hex2);
      const hc = h2.cont;
      hc.mouseEnabled = true;
      hc.on(S.click, () => {
        h2.isLegal = !h2.isLegal;
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

