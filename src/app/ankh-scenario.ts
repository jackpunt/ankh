
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

export type RegionSpec = { region: [row: number, col: number, bid: number][] }
export type PlaceSpec = { place: [row: number, col: number, cons?: Constructor<AnkhPiece | Figure>, pid?: number][] }
/** [row, col, bid] -> new rid, with battle order = bid */
export type SplitSpec = { split: (string | number)[][] }
export type splitsc0 = {
  split: [[row: number, col: number, bid: number] | [row: number, col: number,
    d0: HexDir, d1?: HexDir, d2?: HexDir, d3?: HexDir, d4?: HexDir, d5?: HexDir][]]
}
export type SetupSpec = { coins?: number[], devs?: number[], event0: number, actions: { M: number, S: number, G: number, A: number } }

export type SwapSpec = { swap: [rid: number, bid: number][] }

export type Scenario = (RegionSpec | PlaceSpec | SplitSpec | SetupSpec)[];
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
}

export class ScenarioParser {
  constructor(public map: AnkhMap<AnkhHex>) {

  }
  parseScenario(scenario: Scenario) {
    const region0 = scenario.find(elt => elt['region']) as RegionSpec;
    const splits = scenario.filter(elt => elt['split']) as SplitSpec[];
    const place0 = scenario.find(elt => elt['place']) as PlaceSpec;
    const setup = scenario.find(elt => elt['setup']) as SetupSpec;
    this.parseRegions(region0);
    this.parseSplits(splits);
    this.parsePlaces(place0);
    this.parseSetup(setup);
  }

  parseRegions(region0: RegionSpec) {
    const map = this.map;
    region0.region.forEach(elt => {
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
    splits.forEach((splitElt, i) => {
      // console.log(stime(this, `.splits[${i}]`), splitElt, splitElt.split);
      const splitN = (splitElt.split as any as number[][]);
      const splitD = (splitElt.split as any as (number | string)[][]);
      // hex[row,col] will be in the NEW region, with NEW bid.
      const split0 = splitN[0];
      const [row, col, bid] = split0; //(split as any as (number)[][]).shift();
      const newHex = this[row][col];
      const origNdx = map.regionOfHex(row, col, newHex);
      // console.log(stime(this, `.splits[${i}] hex: ${newHex} origNdx: ${origNdx} bid: ${bid}`))
      //splitD.shift();
      const splitShape = map.edgeShape('#4D5656'); // grey
      map.mapCont.infCont.addChild(splitShape);
      splitD.forEach((elt, i) => {
        if (i === 0) return undefined;
        const [row, col, d0, d1, d2, d3, d4, d5] = elt as [number, number, HexDir, HexDir, HexDir, HexDir, HexDir, HexDir];
        const dirs = [d0, d1, d2, d3, d4, d5].filter(dir => dir !== undefined);
        // add border on each edge of [row, col]
        const hex = this[row][col];
        // console.log(stime(this, `.split: border ${hex}`), dirs);
        dirs.forEach(dir => map.addEdge([row, col, dir], splitShape));
        return hex;
      });
      map.update();

      // region will split to 2 region IDs: [regions.length, origNdx]
      const ids = [bid - 1, origNdx,]; // given hex gets NEW region;
      const [newRs, adjRs] = map.findRegions(map.regions[origNdx], newHex, ids.concat());
      // console.log(stime(this, `.split: newRs`), map.regionList(newRs), ids);
      map.regions[ids[0]] = newRs[0]; // rid = len
      map.regions[ids[1]] = newRs[1]; // rid = original
      map.regions[ids[0]].forEach(hex => hex.district = ids[0] + 1);
      map.regions[ids[1]].forEach(hex => hex.district = ids[1] + 1);
    })
    // console.log(stime(this, `.split adjRegions:`), map.regionList());
  }
  parsePlaces(place0: PlaceSpec) {
    const map = this.map;
    //console.groupCollapsed('place');
    place0.place.forEach(elt => {
      const [row, col, cons, pid] = elt;
      const hex = map[row][col];
      const player = Player.allPlayers[pid - 1], pNdx = player?.index;
      // find each piece, place on map
      // console.log(stime(this, `.place0:`), { hex: `${hex}`, cons: cons.name, pid });
      const source0 = cons['source'];
      const source = ((source0 instanceof Array) ? source0[player?.index] : source0) as TileSource<AnkhPiece>;
      const godFig = (cons.name === 'GodFigure') ? new cons(player, 0, player.god.Aname) as GodFigure : undefined;
      let piece0 = godFig ?? ((source instanceof TileSource) ? source.takeUnit() : undefined);
      const piece = piece0 ?? new cons(player, 0, cons.name);
      piece.moveTo(hex);
      // if a Claimed Monument, add AnkhToken:
      if ((pNdx !== undefined) && (piece instanceof Monument)) {
        AnkhToken.source[pNdx].takeUnit().moveTo(hex);
      }
    })
    //console.groupEnd();
  }
  parseSetup(setup: SetupSpec) {

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

