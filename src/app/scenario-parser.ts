
// TODO: namespace or object for GameState names

import { Constructor, S, className, stime } from "@thegraid/common-lib";
import { KeyBinder } from "@thegraid/easeljs-lib";
import { AnkhPiece, AnkhSource, Figure, GodFigure, Guardian, Monument, RadianceMarker, Scorpion } from "./ankh-figure";
import type { AnkhHex, AnkhMap, RegionId } from "./ankh-map";
import { AnkhToken } from "./ankh-token";
import { ClassByName } from "./class-by-name";
import { removeEltFromArray } from "./functions";
import type { GamePlay } from "./game-play";
import { AnkhMarker, God } from "./god";
import { EwDir, HexDir } from "./hex-intfs";
import { Meeple } from "./meeple";
import { Player } from "./player";
import { PlayerPanel, cardStates } from "./player-panel";
import { ActionContainer } from "./table";
import { Tile } from "./tile";
import { GameState } from "./game-state";

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

export type SetupElt = {
  Aname?: string,        // {orig-scene}@{turn}
  ngods: number,         // == nPlayers (used to select, verify scenario)
  places: PlaceElt[],    // must have some GodFigure on the board!
  splits?: SplitSpec[],  // added camel train borders
  regions: RegionElt[],  // delta, east, west, ...; after splits.
  // the rest assume defaults or random values:
  godNames?: string[],   // Gods in the game ?? use names from URL command.
  merged?: [unter: string, uber: string], //
  time?: string,         // stime.fs() when state was saved.
  cards?: (0|1|2)[][],   // [flood...cycle][0=inHand|1=inBattl|2=onTable]
  coins?: number[],      // 1
  scores?: number[],     // 0
  events?: EventElt,
  actions?: ActionElt,
  bastet?: PlaceElt[],
  godStates?: {},         // objects from God.saveState(), [index: god.name]
  ankhs?: AnkhElt[],     // per-player; [1, ['Revered', 'Omnipresent'], ['Satet']]
  guards?: GuardIdent,   // Guardian types in use. default to random
  stable?: GuardIdent[], // Guardians in player's stable.
  turn?: number;         // default to 0; (or 1...)
}
export type StartElt = { start: { time: string, scene: string, turn: number, ngods: 2 | 3 | 4 | 5, gods: string[], guards: GuardIdent } };
export type LogElts = [ StartElt, ...SetupElt[]];

export type Scenario = SetupElt;

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
    if (map.regions.length > 3) {
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
        const source = RadianceMarker.source.find(s => !!s); // find Player for 'Ra'
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

  // coins, score, actions, events, AnkhPowers, Guardians in stable; specials for Amun, Bastet, Horus, ...
  parseScenario(setup: SetupElt) {
    if (!setup) return;
    console.log(stime(this, `.parseScenario: curState =`), this.saveState(this.gamePlay, true)); // log current state for debug...
    console.log(stime(this, `.parseScenario: newState =`), setup);

    const { regions, splits, coins, scores, turn, guards, cards, godStates, events, actions, stable, ankhs, places, merged } = setup;
    const map = this.map, gamePlay = this.gamePlay, allPlayers = gamePlay.allPlayers, table = gamePlay.table;
    coins?.forEach((v, ndx) => allPlayers[ndx].coins = v);
    scores?.forEach((v, ndx) => allPlayers[ndx].score = v);
    const turnSet = (turn !== undefined); // indicates a Saved Scenario: assign & place everything
    if (turnSet) {
      gamePlay.turnNumber = turn;
      table.logText(`turn = ${turn}`, `parseScenario`);
      table.guardSources.forEach(source => {
        // retrieve Guardians from board or stables; return to source:
        source.filterUnits(unit => (unit.setPlayerAndPaint(undefined).sendHome(), false));
        source.nextUnit();
      });
      this.gamePlay.allTiles.forEach(tile => tile.hex?.isOnMap ? tile.sendHome() : undefined);
    }
    const cardstates = cardStates, colorForState = PlayerPanel.colorForState;
    table.allPlayerPanels.forEach((panel, pi) => {
      panel.cardSelector.powerLines.forEach((pl, ndx) =>
        pl.button.paint(colorForState[cardstates[cards?.[pi]?.[ndx] ?? 0]]));
    })
    if (events !== undefined) {
      table.eventCells.forEach((evc, ndx) => table.removeEventMarker(ndx))
      events.forEach((pid, ndx) => {
        table.setEventMarker(ndx, this.gamePlay.allPlayers[pid]);
      })
      gamePlay.gameState.eventName = gamePlay.gameState.eventSpecial = undefined; // do not saveState *during* an Event!
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
      const source = table.guardSources[ndx]

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
      const player = allPlayers[pid];
      console.log(stime(this, `.stable:[${pid}]`), gNames);
      gNames.forEach((gName) => {
        const ndx = table.guardSources.findIndex(source => (source.type.name === gName)) as 0 | 1 | 2;
        const source = table.guardSources[ndx];
        if (source) {
          player.panel.takeGuardianIfAble(ndx);
        }
        console.log(stime(this, `.stable:[${pid}]-${ndx} ${gName} source.allUnits=`), source?.filterUnits(u => true))
      });
    });
    // reset all AnkhTokens, ready for claim some Monument:
    this.parsePlaces(places, turnSet);  // turnSet indicates a saved Scenario, vs original.
    // For each Player, set AnkhPowers in panel:
    ankhs?.forEach((powers: AnkhElt, pid) => {
      // console.log(stime(this, `.ankhs[${pid}]`), powers);
      const panel = allPlayers[pid].panel;
      panel.setAnkhPowers(powers);
    });
    if (godStates) {
      Object.keys(godStates).forEach((godName: string) => {
        God.byName.get(godName).parseState(godStates[godName]);
      });
    }
    if (merged) {
      const [unter, uber] = merged;
      if (unter) {
        const unterGod = God.byName.get(unter), uberGod = God.byName.get(uber);
        unterGod.uberGod = uberGod;
        uberGod.unterGod = unterGod;
      }
    }
    this.gamePlay.hexMap.update();
  }

  saveState(gamePlay: GamePlay, silent = false) {
    const table = gamePlay.table;
    const ngods = gamePlay.allPlayers.length;
    const godNames = gamePlay.allPlayers.map(player => player.god.name);
    const turn = Math.max(0, gamePlay.turnNumber);
    const coins = gamePlay.allPlayers.map(p => p.coins);
    const scores = table.playerScores;
    const time = stime.fs();
    if (!silent) console.log(stime(this, `.saveState: --- `), { turn, ngods, godNames })
    const merged = [God.allGods.find(god => god.uberGod)?.name, God.allGods.find(god => god.unterGod)?.name];

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
      const ndx = buttons.findIndex(elt => !elt.children.find(ch => ch instanceof AnkhMarker));
      const nActions = ndx < 0 ? buttons.length : ndx;
      actions[id] = buttons.slice(0, nActions).map(elt => elt.pid);
    })
    actions.selected = this.gamePlay.gameState.selectedActions;
    const indexForColor = PlayerPanel.indexForColor;
    const cards = table.allPlayerPanels.map(panel =>
      panel.cardSelector.powerLines.map(pl => indexForColor[pl.button.colorn])
    );
    const stable = table.allPlayerPanels.map(panel =>
      panel.stableHexes.slice(1).map(hex => hex.figure?.name).filter(name => !!name) as GuardIdent
    );
    const ankhs = gamePlay.allPlayers.map(p => p.god.ankhPowers.concat());
    const places = this.gamePlay.allTiles.filter(t => t.hex?.isOnMap && !(t instanceof AnkhToken)).map(t => {
      const row = t.hex.row, col = t.hex.col, cons = className(t), pid = t.player ? t.player.index + 1 : undefined;
      const elt4 = [];
      if (t instanceof Scorpion) elt4.unshift(t.rotDir);
      return [row, col, cons, pid, ...elt4] as PlaceElt;
    })
    const godStates = {}
    gamePlay.allPlayers.forEach(player => {
      const godState = player.god.saveState();
      if (godState !== undefined) godStates[player.god.name] = godState;
    });
    const setupElt = { ngods, godNames, turn, time, regions, splits, guards, events, actions, coins, scores, merged, cards, godStates, stable, ankhs, places } as SetupElt;
    return setupElt;
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

