
// TODO: namespace or object for GameState names

import { Constructor, S, className, stime } from "@thegraid/common-lib";
import { Androsphinx, AnkhPiece, Apep, Figure, GodFigure, Guardian, Monument, MumCat, Mummy, Obelisk, Pyramid, Satet, Scorpion, Temple, Warrior } from "./ankh-figure"
import { HexDir } from "./hex-intfs";
import { KeyBinder } from "@thegraid/easeljs-lib";
import { AnkhMap, AnkhHex } from "./ankh-map";
import { AnkhMarker, AnkhToken } from "./god";
import { Hex2 } from "./hex";
import { Player } from "./player";
import { TileSource } from "./tile-source";
import { GamePlay } from "./game-play";
import { ActionContainer, EventButton } from "./table";
import { Tile } from "./tile";
import { Container } from "@thegraid/easeljs-module";

type GodName = string;
type GuardName = string | Constructor<Guardian>;
type GuardIdent = [ g1?: GuardName, g2?: GuardName, g3?: GuardName ];
type PowerIdent = 'Commanding' | 'Inspiring' | 'Omnipresent' | 'Revered' | 'Resplendent' | 'Obelisk' | 'Temple' | 'Pyramid' | 'Glorius' | 'Magnanimous' | 'Bountiful' | 'Worshipful';
type RegionElt = [row: number, col: number, bid: number];
type PlaceElt = [row: number, col: number, cons?: Constructor<AnkhPiece | Figure> | GodName, pid?: number];
type ClaimElt = [row: number, col: number, pid: number];
type MoveElt = [row: number, col: number, row1: number, col1: number]; // move Piece from [r,c] to [r1,c1];
type AnkhElt = PowerIdent[];

/** [row, col, bid] -> new rid, with battle order = bid ;
 * - For Ex: [3, 0, 1], [4, 0, 'N', 'NE'], [4, 1, 'N']
 */
type SplitBid = [row: number, col: number, bid: number];
type SplitDir = [row: number, col: number, d0: HexDir, d1?: HexDir, d2?: HexDir, d3?: HexDir, d4?: HexDir, d5?: HexDir];
type SplitElt = (SplitBid | SplitDir)

type SetupElt = {
  Aname?: string,         // {orig-scene}#{turn}
  ngods: number,         // == nPlayers (used to select, verify scenario)
  places: PlaceElt[],    // must have some GodFigure on the board!
  splits?: SplitElt[],   // added camel train borders
  regions: RegionElt[],  // delta, east, west, ...; after splits.
  // the rest assume defaults or random values:
  gods?: GodName[],      // ngods & gods as per URL parsing
  coins?: number[],      // 1
  scores?: number[],     // 0
  events?: number,
  guards?: GuardIdent,   // Guardian types in use. default to random
  stable?: GuardIdent[], // Guardians in player's stable.
  actions?: { Move?: number, Summon?: number, Gain?: number, Ankh?: number },
  ankhs?: AnkhElt[],     // per-player; [1, ['Revered', 'Omnipresent'], ['Satet']]
  turn?: number;   // default to 0; (or 1...)
}

type RegionSpec = { region: RegionElt[] }
type PlaceSpec = { place: PlaceElt[] }
type SplitSpec = { split: SplitElt[] }
type ClaimSpec = { claim: ClaimElt[] }
type SetupSpec = { setup: SetupElt }

type SwapSpec = { swap: [rid: number, bid: number][] }
export type ScenarioSpec = RegionSpec | PlaceSpec | SplitSpec | SetupSpec;
export type Scenario = SetupElt;

// Rivers make first 3 Regions: West(1), East(2), Delta(3)
export class AnkhScenario {
  static readonly MiddleKingdom: SetupElt[] = [
    // 2 Player:
    {
      ngods: 2,
      regions: [[4, 5, 1], [4, 6, 2], [3, 5, 3],],
      places: [
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
      ],
    },
    // 3 player
    {
      ngods: 3,
      regions: [[4, 5, 1], [4, 6, 2], [3, 5, 3],],
      places: [
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
      ],
    },

    // 4 player
    {
      ngods: 4,
      regions: [[4, 5, 2], [3, 5, 3], [4, 6, 4],],
      splits: [[3, 0, 1], [4, 0, 'N', 'NE'], [4, 1, 'N', 'NE']],
      places: [
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
      ],
    },
    // 5-player
    {
      ngods: 5,
      regions: [[4, 5, 1], [4, 6, 2], [3, 5, 4]],
      splits: [[6, 7, 3], [7, 5, 'N'], [7, 6, 'NW', 'N'], [6, 7, 'NW', 'N', 'NE'],
      [4, 0, 5], [4, 0, 'N', 'NE'], [4, 1, 'N', 'NE']],
      places: [
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
      ],
    },
  ];

  static AltMidKingom2 =
    {
      ngods: 2,
      turn: 3,
      regions: [[2, 0, 1], [2, 10, 2], [0, 2, 3]],
      guards: ['Satet', 'Apep', 'Scorpion'],
      events: 3,
      actions: { Move: 2, Ankh: 2 },
      coins: [4, 5],
      scores: [2, 3],
      stable: [['Satet'], []],
      ankhs: [['Commanding', 'Revered'], ['Inspiring', 'Omnipresent', 'Temple']],
      places: [
        [3, 4, Warrior, 1],
        [8, 2, GodFigure, 1],
        [3, 6, Warrior, 2],
        [4, 7, GodFigure, 2],

        [0, 3, Temple],
        [2, 5, Pyramid],
        [1, 8, Obelisk],
        [5, 0, Obelisk, 1],
        [8, 1, Pyramid],
        [6, 5, Temple, 2],
        [5, 8, Pyramid],
      ]
    }

  static saveState(gamePlay: GamePlay) {
    const table = gamePlay.table;
    const ngods = gamePlay.allPlayers.length;
    const turn = gamePlay.turnNumber - 1;
    const guards = gamePlay.guards.map(cog => cog.name) as GuardIdent;
    const events = table.nextEventIndex;
    const actions = {};
    const regions = gamePlay.hexMap.regions.map((region, n) => [region[0].row, region[0].col, n + 1]);
    table.actionRows.forEach(({id}) => {
      const rowCont = table.actionPanels[id] as ActionContainer;
      const buttons = rowCont.children.filter(ch => ch instanceof Container) as EventButton[];
      actions[id] = buttons.findIndex(elt => !elt.children.find(ch => ch instanceof AnkhMarker));
    })
    const coins = gamePlay.allPlayers.map(p => p.coins);
    const scores = table.playerScores;
    const stable = table.panelForPlayer.map(panel => {
      return panel.stableHexes.slice(1).map(hex => hex.meep?.name).filter(elt => elt !== undefined) as GuardIdent;
    })
    const ankhs = gamePlay.allPlayers.map(p => p.god.ankhPowers.concat());
    const places = Tile.allTiles.filter(t => t.hex?.isOnMap).map(t => {
      const row = t.hex.row, col = t.hex.col, cons = className(t), pid = t.player ? t.player.index + 1 : undefined;
      return [row, col, cons, pid] as PlaceElt;
    })

    return { ngods, turn, regions, guards, events, actions, coins, scores, stable, ankhs, places } as SetupElt;
  }
}

export class ScenarioParser {
  static classByName: { [index: string]: Constructor<GodFigure | Monument | Figure > } =
    { 'GodFigure': GodFigure, 'Warrior': Warrior,
      'Obelisk': Obelisk, 'Pyramid': Pyramid, 'Temple': Temple,
      'Satet': Satet, 'MumCat': MumCat,
      'Apep': Apep, 'Mummy': Mummy,
      'Androsphinx': Androsphinx, 'Scorpion': Scorpion,
    }

  constructor(public map: AnkhMap<AnkhHex>, public gamePlay: GamePlay) {

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
      const player = (pid !== undefined) && Player.allPlayers[pid - 1];
      // find each piece, place on map
      // console.log(stime(this, `.place0:`), { hex: `${hex}`, cons: cons.name, pid });
      const source0 = cons['source'];
      const source = ((source0 instanceof Array) ? source0[player?.index] : source0) as TileSource<AnkhPiece>;
      const godFig = (cons.name !== 'GodFigure') ? undefined : GodFigure.named(player.god.Aname) ?? new cons(player, 0, player.god.Aname) as GodFigure;
      let piece0 = godFig ?? ((source instanceof TileSource) ? source.takeUnit() : undefined);
      const piece = piece0 ?? new cons(player, 0, cons.name);
      piece.moveTo(hex);
      // if a Claimed Monument, add AnkhToken:
      if (player && (piece instanceof Monument)) {
        this.claimHex(hex, player); // claimMonument?
      }
    })
    //console.groupEnd();
  }

  claimHex(hex: AnkhHex, player: Player) {
    const unit = AnkhToken.source[player.index].takeUnit();
    unit.moveTo(hex);
    unit.setPlayerAndPaint(player);
    console.log(stime(this, `.claimHex: ${hex}`), player.color);
  }

  // coins, score, actions, events, AnkhPowers, Guardians in stable; Amun, Bastet, Horus, ...
  parseScenario(setup: SetupElt) {
    if (!setup) return;
    const { coins, scores, turn, guards, events, actions, stable, ankhs, places } = setup;
    const map = this.map, gamePlay = this.gamePlay, allPlayers = gamePlay.allPlayers, table = gamePlay.table;
    coins?.forEach((v, ndx) => allPlayers[ndx].coins = v);
    scores?.forEach((v, ndx) => allPlayers[ndx].score = v);
    if (turn !== undefined) {
      table.turnLog.log(`turn = ${turn}`, `parseSetup`);
      table.gamePlay.turnNumber = turn - 1;
    }
    if (events !== undefined) {
      for (let ndx = 0; ndx < events; ndx++) {
        table.setEventMarker(ndx);
      }
      gamePlay.eventName = undefined;
      map.update();
    }
    if (actions !== undefined) {
      table.actionRows.forEach(({ id }) => {
        const nSelected = actions[id] ?? 0;
        for (let cn = 0; cn < nSelected; cn++) {
          const rowCont = table.actionPanels[id];
          const button = rowCont.getButton(cn);
          table.setActionMarker(button);
        }
      });
    }
    guards?.forEach((name, ndx) => {
      if (typeof name !== 'string') name = name.name;
      const source = table.guardSources[ndx];
      const type = ScenarioParser.classByName[name] as Constructor<Guardian>;
      if (name !== source.type.name) {
        const n = source.deleteAll();
        const newSource = Guardian.makeSource(source.hex, type, n);
        gamePlay.guards[ndx] = type;
        table.guardSources[ndx] = newSource;
        newSource.nextUnit();
      }
    });
    stable?.forEach((gNames, pid) => {
      const player = allPlayers[pid], panel = player.panel;
      console.log(stime(this, `.stable:[${pid}]`), gNames)
      gNames.forEach((gName, ndx) => {
        table.guardSources.find(source => {
          if (source.type.name === gName) {
            const unit = source.takeUnit();
            unit.moveTo(panel.stableHexes[ndx + 1]);
            unit.setPlayerAndPaint(player);
            return true;
          }
          return false;
        })
      })
    });
    ankhs?.forEach((powers: AnkhElt, pid) => {
      console.log(stime(this, `.ankhs[${pid}]`), powers);
      const player = allPlayers[pid], panel = player.panel;
      const god = player.god;
      // remove existing AnkhPowers & AnkhTokens
      god.ankhPowers.length = 0;
      god.ankhPowers.push(...powers);
      panel.ankhArrays.length = 0;
      // add ankhs for each colCont:
      panel.powerCols.forEach((colCont, cn) => {
        colCont.removeChildType(AnkhToken).forEach(ankhToken => ankhToken.sendHome());
        // leaving only the marker children!
        const ankhs = [panel.ankhSource.takeUnit(), panel.ankhSource.takeUnit(),];
        ankhs.forEach((ankh, cn) => {
          const marker = colCont.children[cn];
          ankh.x = marker.x; ankh.y = marker.y;
        })
        panel.ankhArrays.push(...ankhs); // add 2 ankhs to supply
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
    this.parsePlaces(places);
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

