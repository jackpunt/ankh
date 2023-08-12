import { C, XY, stime } from "@thegraid/common-lib";
import { DragInfo } from "@thegraid/easeljs-lib";
import { DisplayObject } from "@thegraid/easeljs-module";
import { Figure, GodFigure, Monument } from "./ankh-figure";
import { AnkhHex, RegionId } from "./ankh-map";
import type { ActionIdent, SplitDir, SplitElt, SplitSpec } from "./ankh-scenario";
import type { GamePlay } from "./game-play";
import { EwDir, H, HexDir, NsDir } from "./hex-intfs";
import type { Player } from "./player";
import type { PlayerPanel, PowerLine } from "./player-panel";
import { CircleShape, EdgeShape, HexShape, PaintableShape, UtilButton } from "./shapes";
import { DragContext, EventName } from "./table";
import { TP } from "./table-params";
import { Tile } from "./tile";
import { Hex1, Hex2 } from "./hex";
import { Arrays_intersect } from "./functions";

interface Phase {
  Aname?: string,
  start(...args: any[]): void; // what to do in this phase
  done?: (...args: any[]) => void;          // for async; when done clicked: proceed
  undo?: () => void;
  region?: number,
  panels?: PlayerPanel[],
  players?: Player[],
}

export class GameState {

  constructor(public gamePlay: GamePlay) {
    Object.keys(this.states).forEach((key) => this.states[key].Aname = key);
  }

  state: Phase;
  get table() { return this.gamePlay?.table; }
  get panel() { return this.gamePlay.curPlayer.panel; }

  get eventName() { return this.gamePlay.eventName; }
  set eventName(eventName: EventName) { this.gamePlay.eventName = eventName; }
  get selectedAction() { return this.gamePlay.selectedAction; }
  set selectedAction(val) { this.gamePlay.selectedAction = val; }
  get selectedActionIndex() { return this.gamePlay.selectedActionIndex; }
  readonly selectedActions: ActionIdent[] = [];
  areActiveActions: boolean;

  get playerFigures() { const plyr = this.gamePlay.curPlayer; return Figure.allFigures.filter(fig => fig.player === plyr) }

  highlights: Figure[];
  conflictRegion: RegionId = 1;
  get panelsInConflict() {
    return this.table.panelsInRank.filter(panel => panel.isPlayerInRegion(this.conflictRegion - 1));
  }
  panelsInThisConflict: PlayerPanel[];
  buildPanels: PlayerPanel[];

  battleResults: any; // TODO: record winner, who lost units, etc for use by special powers (Osiris move) and Cards.

  actionsDone = 0;
  bastetEnabled = false;
  chooseAction(val = 0) {
    this.actionsDone = val;
    return 'ChooseAction';
  }

  findGod(name: string) {
    return this.gamePlay.allPlayers.find(p => p.god.Aname == name);
  }

  start(phase = 'BeginTurn') {
    this.phase(phase);
  }

  phase(phase: string, startArg?: any) {
    this.state = this.states[phase];
    console.log(stime(this, `.phase:`), phase);
    this.state.start(startArg);
  }

  /** set label & paint button with color;
   * empty label hides & disables.
   * optional continuation function on 'drawend'.
   */
  doneButton(label?: string, color = this.gamePlay.curPlayer.color, afterUpdate: ((evt?: Object, ...args: any[]) => void) = undefined) {
    const doneButton = this.table.doneButton;
    doneButton.label.text = label;
    doneButton.paint(color, true);
    doneButton.updateWait(!!label, afterUpdate);
  }

  /** invoked when 'Done' button clicked. [or whenever phase is 'done' by other means] */
  done(...args: any[]) {
    console.log(stime(this, `.done: ${this.state.Aname}-${this.selectedActions.length}`), this.state, args);
    this.state.done(...args);
  }
  undoAction() {
    const action = this.selectedAction;
    if (!action) return;
    this.states[action].undo?.();
  }

  highlightRegions(vis = true, regionId = this.conflictRegion, afterUpdate?: () => void) {
    const map = this.gamePlay.hexMap;
    map.regions.forEach((region, ndx) => {
      const color = vis ? ((ndx === regionId - 1) ? '' : 'rgba(230,230,230,.6)') : '';
      map.showRegion(ndx, color);
    })
    afterUpdate && map.mapCont.stage.on('drawend', afterUpdate, this, true);
 }

  readonly states: { [index: string]: Phase } = {
    BeginTurn: {
      start: () => {
        this.bastetEnabled = !!this.findGod('Bastet');
        this.selectedAction = undefined;
        this.actionsDone = 0;
        this.selectedActions.length = 0;
        this.phase('ChooseAction');
      },
    },
    ChooseAction: {
      start: () => {
        if (this.bastetEnabled) {
          /* enable 'Cats' button; onClick --> phase('Bastet') */
        }
        if (this.actionsDone >= 2) this.phase('EndTurn');
        // enable and highlight open spots on Action Panel
        const lastAction = this.selectedActions[0], n = this.actionsDone + 1;
        const active = this.areActiveActions = this.table.activateActionSelect(true, lastAction);
        if (!active) {
          this.phase('EndTurn');  // assert: selectedActions[0] === 'Ankh'
        } else {
          this.selectedAction = undefined;
          this.doneButton(`Choice ${n} Done`);
         }
      },
      done: (ok?: boolean) => {
        const action = this.selectedAction;
        if (!ok && !action) {
          this.panel.areYouSure('You have an unused action.', () => {
            setTimeout(() => this.state.done(true), 50);
          }, () => {
            setTimeout(() => this.state.start(), 50);
          });
          return;
        }
        this.selectedActions.unshift(action);
        this.phase(action ?? 'EndTurn');
      }
    },
    Bastet: {
      start: () => {
        // enable Cats on the board; onClick-> {gamePlay.bastetCat(cat); curState.done()}
      },
      done: () =>  {
        this.bastetEnabled = false;
        this.phase('ChooseAction');
      }
    },
    Move: {
      start: () => {
        this.highlights = this.playerFigures.filter(fig => fig.hex?.isOnMap)
        this.highlights.forEach(fig => fig.highlight(true, C.BLACK));
        this.doneButton('Move done');
      },
      done: (ok?: boolean) => {
        const nmoved = this.highlights.filter(fig => fig.hex !== fig.startHex).length;
        if (!ok && nmoved === 0) {
          this.panel.areYouSure('You have not moved any Figures', () => {
            setTimeout(() => this.state.done(true), 50); // new thread
          }, () => {
            console.log(stime(this, `.Move done: cancel`), this.selectedActions)
          });
          return;
        }
        this.highlights.forEach(fig => fig.highlight(false));
        this.playerFigures.forEach(fig => fig.faceUp()); // set meep.startHex
        this.phase('EndAction')
      },
    },
    Summon: {
      start: () => {
        this.highlights = this.panel.highlightStable(true);
        this.playerFigures.forEach(fig => fig.faceUp()); // set meep.startHex
        this.doneButton('Summon done');
      },
      // mouse enable summonable Meeples (Stable)
      // Mark legal hexes
      // Drag & Drop;
      done: () => {
        this.highlights.forEach(fig => (fig.highlight(false), fig.faceUp(true)));
        this.phase('EndAction');
      },
    },
    Gain: {
      start: () => {
        this.gainFollowersAction();// curPlayer.coins += filterHex( adjToMeep(curPlayer) ).length
        this.phase('EndAction')
      },
    },
    Ankh: {
      start: (ok?: boolean) => {
        const panel = this.panel, rank = panel.nextAnkhRank;
        if (!ok && (panel.player.coins < rank)) {
          console.log(stime(this, `.Ankh: ays.listeners=`), panel.confirmContainer);
          panel.areYouSure(`Need ${rank} followers to obtain Anhk power!`,
            () => {
              console.log(stime(this, `.Ankh state: yes`))
              panel.selectAnkhPower();       // as if a button was clicked: take the AnkhToken, get Guardian.
            },
            () => {
              console.log(stime(this, `.Ankh state: cancel`), this.selectedActions)
              this.table.undoActionSelection(this.selectedAction, this.selectedActionIndex);
              this.selectedAction = undefined;
              this.selectedActions.shift();     // action1 or undefined
              const active = this.table.activateActionSelect(true, this.selectedActions[0]); // true.
              if (!active) debugger;
              this.state = this.states['ChooseAction'];
            });
          return;
        }
        this.doneButton();
        panel.activateAnkhPowerSelector();
      },
      // mouseEnable next Upgrades;
      // on click: move Anhk to button (cover: now unclickable), set bit on Player.
      // mouse disable button
      done: () => {
        this.doneButton('Done');
        this.phase('EndAction')
      },
    },
    EndAction: {
      start: () => {
        // [player can select Bastet Cat for disarming]
        this.actionsDone += 1;
        if (!!this.eventName) this.phase('Event');
        else this.phase('ChooseAction');
      },
    },
    Event: {
      start: () => {
        console.log(stime(this, `.Event: ${this.eventName}`));
        this.phase(this.eventName);  // --> EventDone
      },
    },
    EventDone: {
      start: () => {
        console.log(stime(this, `.EventDone: ${this.eventName}`))
        this.eventName = undefined;
        this.phase('EndTurn');
      },
      // phase(EndTurn)
    },
    // Plan: attach a dragable (but mostly invisible?) token to mouse (per click to drag)
    // use normal dragFunc to track it an paint lineTo.
    // on click: mark target or add point to path.
    // click on last path point to finalize. (addEdges)
    Split: {
      start: () => {
        // todo: disable table.dragger!
        console.log(stime(this, `.Split:`));
        const hexMap = this.gamePlay.hexMap;
        hexMap.regions.forEach((region, ndx) => hexMap.showRegion(ndx, 'rgba(240,240,240,.4'))
        // overlay is HexShape child of hex.cont; on mapCont.hexCont;
        this.runSplitShape();
        this.doneButton('Split done');
      },
      done: () => {
        const hexMap = this.gamePlay.hexMap;
        hexMap.regions.forEach((region, ndx) => hexMap.showRegion(ndx)); // remove highlight
        this.phase('Swap');
      },
      // disable edges of hexes in region of < 12 hexes!
      // validate(<= 6 selected; from board/water to board/water; 6 hexes per region )
    },
    Swap: {
      start: () => {
        console.log(stime(this, `Swap:`))
        this.doneButton('Swap done');
      },
      done: () => {
        this.phase('EventDone');
      }

      // after Split
      // mark startRegion of each marker
      // mouse enable all region markers
      // dragStart: mark legal (either of 2 split regions that contain new/old markers)
      // click Done(phase(EventDone))
    },
    Claim: {
      start: () => {
        const ankhToken = this.panel.ankhSource.sourceHexUnit; //takeUnit();
        if (ankhToken) {
          this.panel.ankhSource.sourceHexUnit.highlight(true, C.BLACK);
          this.table.dragger.dragTarget(ankhToken, { x: 8, y: 8 });
          this.doneButton('Claim done');
        } else {
          const done = () => this.phase('EventDone');
          this.panel.areYouSure(`No Ankh Tokens for claim.`, done, done);
        }
      },
      done: () => {
        this.phase('EventDone');
      }
    },
    Conflict: {
      start: () => {
        this.panel.canUseTiebreaker = true;
        this.phase('ConflictNextRegion', 1);
      },
      // process Omnipresent
      // process TeleportToTemple (for each player!)
      // phase(Horus ? Horus : ConflictRegions)
    },
    Horus: {
      start: () => { },
      // place enable Eyes, drag to each Region (to Region index marker...)
      // Done(phase(ConflictNextRegion))
    },
    ConflictNextRegion: {
      start: (regionId = this.conflictRegion + 1) => {
        this.conflictRegion = regionId; // 1..n;
        const isRegion = (regionId <= this.gamePlay.hexMap.regions.length);
        this.highlightRegions(isRegion);
        this.phase(isRegion ? 'ConflictInRegion' : 'ConflictDone');
      },
    },
    ConflictInRegion: {
      panels: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        const panels = this.panelsInThisConflict = this.panelsInConflict;  // original players; before plague, Set, or whatever.
        const omni = panels.filter(panel => panel.hasAnkhPower('Omnipresent'));
        omni.forEach(panel => panel.player.coins += panel.nRegionsWithFigures());

        if (panels.length > 1) this.phase('Obelisks'); // do battle, check for Obelisk
        else if (panels.length === 0) this.phase('ConflictNextRegion'); // no points for anyone.
        else if (panels.length === 1) this.phase('Dominate', panels[0]);   // no battle
      }
    },
    Dominate: {
      start: (panel: PlayerPanel) => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}] Player-${panel.player.index}`));
        this.scoreMonuments(true); // monunent majorities (for sole player in region)
        this.phase('ConflictNextRegion');
      }
    },
    Obelisks: {
      panels: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        const panels = this.panelsInConflict.filter(panel => panel.hasAnkhPower('Obelisk'));
        // enable on-panel 'Obelisk done' button => phaseDone(panel);
        if (panels.length === 0) { this.phase('Card'); return; }
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}] panels =`), panels);
        panels.forEach(panel => panel.enableObeliskTeleport(this.conflictRegion));
      },
      done: (p: PlayerPanel) => {
        const panels = this.state.panels;
        const ndx = panels.indexOf(p);
        panels.splice(ndx, 1);  // or rig it up to use Promise/PromiseAll
        if (panels.length === 0) this.phase('Card');
      }
    },
    Card: {
      panels: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        const panels = this.state.panels = this.panelsInConflict;
        if (panels.length === 0) { this.phase('Reveal'); return; }
        panels.forEach(panel => panel.activateCardSelector());
        this.table.hexMap.update();
      },
      done: (panel: PlayerPanel) => {
        const panels = this.state.panels;
        const ndx = panels.indexOf(panel);
        panels.splice(ndx, 1);  // or rig it up to use Promise/PromiseAll
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}].done(panel=${panel?.player.color})`));
        if (panels.length > 0) return; // wait for more panels to signal done
        this.phase('Reveal')
      }
      // if (Horus) mark excluded card (GREEN to GREY)
      // if Amun-power unused: allow click second card (set Amun-Power used)
      // click Done: phase phase Toth ?? Reveal
    },
    Toth: {
      start: () => { },
      // click Done(no guess): phase Reveal
      // place Follower on Scales
      // click a Card (on other players board)
      // "reveal" all cards;
      // Toth-correct: followers stay on Scales
      // Toth-incorrect: followers from Scales to player
    },
    Reveal: {
      panels: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        const panels = this.state.panels = this.panelsInConflict;
        panels.forEach(panel => panel.revealCards(true));
        this.gamePlay.hexMap.update();
        this.doneButton('Reveal Done', C.grey);
        //setTimeout(() => { state.done(); }, 8000);
      },
      done: () => {
        // "reveal" all cards; (YELLOW)
        // record Figures for Miracle & Flood
        // trigger Flood
        const gamePlay = this.gamePlay, state = this.state;
        this.state.panels.forEach(panel => panel.revealCards(false));
        gamePlay.cardShowing = false;
        gamePlay.hexMap.update();
        this.phase('BuildMonument');
      }
    },
    BuildMonument: {
      panels: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        const buildPanels = []; let t: PowerLine;
        const panels = this.state.panels = this.panelsInConflict.filter(panel =>
          (t = panel.hasCardInBattle('Build Monument'), buildPanels.push(t), t) && (panel.canAffordMonument));
        if (panels.length === 0) {
          console.log(stime(this, `.BuildMonument: no panels will Build ()`), ...buildPanels.map(p=>p ?p.name : ''));
          this.phase('Plague');
          return;
        }
        panels.forEach(panel => {
          panel.enableBuild(this.conflictRegion); // ankh-figure: Monument.dropFunc() --> buildDone --> panel.enableBuild
        });
        this.table.monumentSources.forEach(ms => ms.sourceHexUnit.paint(panels[0].player.color));
        this.doneButton('Build Done', panels[0].player.color);
      },
      // *should* be triggered by 'buildDone' event from panel.enableBuild() --> Monument.dropFunc
      done: (panel: PlayerPanel = this.state.panels[0]) => {
        // no cost if Done *without* building (cbir>0)
        if (!panel.canBuildInRegion && !panel.hasAnkhPower('Inspiring')) {
          this.addFollowers(panel.player, -3, `Build Monument[${this.conflictRegion}]`);
        }

        const panels = this.state.panels;
        const ndx = panels.indexOf(panel);
        panels.splice(ndx, 1);  // or rig it up to use Promise/PromiseAll
        if (panels.length === 0) {
          this.table.monumentSources.forEach(ms => ms.sourceHexUnit.paint(undefined));
          this.doneButton('', C.grey, () => this.phase('Plague'));
          return;
        }
        console.log(stime(this, `Build.done: return NOT done...`))
        this.table.monumentSources.forEach(ms => ms.sourceHexUnit.paint(panels[0].player.color));
        this.doneButton('Build Done', panels[0].player.color);
        // TODO: at ConflictDone, mark yellow cards green, and check reclaimCards (Cycle of Ma`at)
      }
    },
    Plague: {
      panels: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        const panels = this.state.panels = this.panelsInConflict.filter(panel => panel.hasCardInBattle('Plague'));
        if (panels.length === 0) { this.phase('ScoreMonuments'); return; }
        panels.forEach(panel => panel.enablePlagueBid(this.conflictRegion));
      },
      done: (p: PlayerPanel) => {
        const panels = this.state.panels;
        const ndx = panels.indexOf(p);
        panels.splice(ndx, 1);  // or rig it up to use Promise/PromiseAll
        if (panels.length === 0) { this.phase('PlagueResolution'); return }
      }

      // mouse enable plague big counters (max value: player.coins)
      // on Done --> process result: remove meeples, (process mummy cat, etc)
      // phase Monuments
    },
    PlagueResolution:{
      panels: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        const panels = this.state.panels = this.panelsInConflict;
        panels.sort((a, b) => a.strength - b.strength);

        // reveal bids, sacrifice followers, determine highest bidder, kill-units
        this.phase('ScoreMonuments');
      },
    },

    ScoreMonuments: {
      // score Monuments in conflictRegion; incr Player.devotion (score);
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        this.scoreMonuments(false);
        this.phase('BattleResolution')
      },
    },
    BattleResolution: {
      panels: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        const panels = this.state.panels = this.panelsInConflict;
        if (panels.length === 0) {
          // wtf? plague killed the all?
          console.log(stime(this, `.BattleResolution: no Figures in Battle[${this.conflictRegion}]`));
          this.phase('ConflictNextRegion'); return;
        }
        const panels0 = panels.concat();
        panels.forEach(panel => panel.strength = panel.strengthInRegion(this.conflictRegion - 1));
        panels.sort((a, b) => b.strength - a.strength);
        console.log(stime(this, `.BattleResolution: strengths =`), ...panels.map(panel => panel.reasons));

        const d = panels[0].strength - panels[1].strength
        let winner = (d > 0) && panels[0];
        if (d == 0) {          // consider tiebreaker;
          const curPanel = this.gamePlay.curPlayer.panel;
          const contenders = panels.filter(panel => panel.strength === panels[0].strength);
          // TODO: offer curPanel a choice, mark choice used.
          if (contenders.includes(curPanel)) {
            winner = curPanel;
            console.log(stime(this, `.BattleResolution: ${winner.name} gets uses tiebreaker (${d})`));
            curPanel.canUseTiebreaker = false
          }
        }
        if (winner) {
          const powers = winner.player.god.ankhPowers, player = winner.player;
          let dev = 0;
          dev += 1
          if (powers.includes('Glorious') && d >= 3) dev += 3;
          if (powers.includes('Bountiful') && player.score <= 20) dev += 3;
          if (powers.includes('Worshipful') && player.coins > 2) (player.coins -= 2, dev += 1); // assume yes, they want the point.
          if (powers.includes('Commanding')) this.addFollowers(player, 3, `Commanding[${this.conflictRegion}]`);
          this.addDevotion(player, dev, `BattleResolution[${this.conflictRegion}]`);
          console.log(stime(this, `.BattleResolution: ${winner.name} wins, get ${dev} Devotion`));
          panels.splice(0, 1); // remove winner, panels now has all the losers.
        }
        const winp = winner.player;
        panels.forEach(panel => {
          if (panel.hasAnkhPower('Magnanimous') && panel.nFigsInBattle >= 2) {
            this.addDevotion(panel.player, 2, `Magnanimous[${this.conflictRegion}]`);
          }
        });
        // TODO Set adjacency.
        const belongsTo = (fig: Figure, player: Player) => { return fig.player === player }
        const floodProtected = (fig: Figure, player: Player, ) => player.panel.hasCardInBattle('Flood') && fig.hex.terrain === 'd';
        const regionId = this.conflictRegion;
        const figuresInRegion = Figure.allFigures.filter(fig => fig.hex?.district === regionId);
        const deadFigs = figuresInRegion.map(fig => !(fig instanceof GodFigure) && !belongsTo(fig, winp) && !floodProtected(fig, fig.player) ? fig : undefined).filter(fig => !!fig);
        console.log(stime(this, `.BattleResolution: Figures KIA:`), deadFigs);
        deadFigs.forEach(fig => fig.sendHome());

        // ASSERT: panels0 is [still] sorted by player rank.
        const worships0 = panels0.filter(panel => panel.hasAnkhPower('Workshipful'));
        const workship1 = worships0.filter(panel => panel.player.coins >= 2)
        workship1.forEach(panel => {
          this.addFollowers(panel.player, -2, `Worshipful[${this.conflictRegion}]`);
          this.addDevotion(panel.player, 1, `Worshipful[${this.conflictRegion}]`);
        });
        panels0.forEach(panel => panel.battleCardsToTable());
        this.phase('ConflictNextRegion')
      },
      //
      // compute winner (and size of win for Glorious)
      // remove losers (modulo Flood, Set); process Cat
      // assign Devotion (for Miracle)
      // assign Devotion (win & Drought)
      // mark cards done (YELLOW to RED, GREP to GREEN)
      // phase(ConflictRegions) do next region in list
    },
    ConflictDone: {
      start: () => {
        this.conflictRegion = undefined;
        this.highlightRegions(false);
        this.phase('EventDone');
      },
      // coins from Scales to Toth, add Devotion(Scales)
      // mark on Event panel
      // phase EndTurn
    },
    EndTurn: {
      start: () => {
        this.selectedAction = undefined;
        this.selectedActions.length = 0;
        this.gamePlay.endTurn();
        this.phase('BeginTurn');
      },
    },

  };

  setup() {

  }

  gainFollowersAction() {
    const player = this.gamePlay.curPlayer;
    // Osiris Portal begins offMap.
    const allMonts = this.gamePlay.allTiles.filter(tile => (tile instanceof Monument) && (tile.hex?.isOnMap));
    const monts =  allMonts.filter(mont => (mont.player === player || mont.player === undefined)) as Monument[];
    const mine = monts.filter(mont => mont.hex.findAdjHex(hex => hex.meep?.player === player));
    const n = mine.length;
    this.addFollowers(player, n, `Gain Followers action`)
    if (player.god.ankhPowers.includes('Revered')) this.addFollowers(player, 1, `Revered`);
  }

  addFollowers(player: Player, n: number, reason?: string) {
    player.coins += n;
    const verb = (n >= 0) ? 'gains' : 'sacrifices';
    this.gamePlay.logText(`${player.god.name} ${verb} ${Math.abs(n)} Followers: ${reason}`);
  }

  addDevotion(player: Player, n: number, reason?: string) {
    player.score += n;
    this.gamePlay.logText(`${player.god.name} gains ${n} Devotion: ${reason}`);
  }

  static typeNames = ['Obelisk', 'Pyramid', 'Temple'];
  /** score each monument type in conflictRegion */
  scoreMonuments(dom = false) {
    const regionNdx = this.conflictRegion - 1;
    const allPlayers = this.gamePlay.allPlayers;
    const players = this.panelsInConflict.map(panel => panel.player);
    console.log(stime(this, `.scoreMonuments[${this.conflictRegion}]`), players);
    const hexes = this.gamePlay.hexMap.regions[regionNdx].filter(hex => (hex.tile instanceof Monument) && hex.tile.player);
    const tiles = hexes.map(hex => hex.tile);
    const types = GameState.typeNames;
    const countsOfTypeByPlayer = types.map(type => allPlayers.map(player => ({type, player, n: 0})));// [[{p, n:0},,0,0...], [0,0,0,0...], [0,0,0...]]
    tiles.forEach((tile, n) => countsOfTypeByPlayer[types.indexOf(tile.name)][tile.player.index].n += 1);
    // [{ n: p1nOb, p: p1 }, { n: p2nOb, p: p2 }, { n: p3nOb, p: p3 }], [p1nPy, p2nPy, p3nPy], [p1nTe, p2nTn, p3nTe]]
    const sortedCount = countsOfTypeByPlayer.map(pnary => pnary.sort((a, b) => b.n - a.n));
    // reduce to elment[0]
    const deltas = sortedCount.map(pnary => ({t: pnary[0].type, p: pnary[0].player, n: pnary[0].n, d: (pnary[0].n - (pnary[1] ? pnary[1].n : 0)) }));
    const winers = deltas.map(({ p, n, d, t }) => ({ p: ((n > 0 && d > 0) ? p : undefined), n, d, t }));
    winers.forEach(({ p, n, d, t }) => {
      console.log(stime(this, `.scoreMonuments[${this.conflictRegion}]: ${t} -> Player=${p?.Aname}, d=${d}, n=${n}`))
      if (players.includes(p)) this.addDevotion(p, 1, `Score Monuments[${this.conflictRegion}]`);
    })
    return;
  }

  splitShape: SplitterShape;
  splitMark: CircleShape;
  makeSplitShape(markRad: number) {
    const hexMap = this.gamePlay.hexMap;
    const mapCont = hexMap.mapCont;
    this.splitShape = new SplitterShape();
    this.splitShape.paint(TP.splitColor);
    this.splitShape.visible = true;
    mapCont.tileCont.addChild(this.splitShape);
    this.splitMark = new CircleShape(C.grey, markRad * 1.5, '');
    mapCont.markCont.addChild(this.splitMark);
    this.lineShape = hexMap.edgeShape(TP.splitColor);
    this.pathShape = hexMap.edgeShape(TP.splitColor);
  }
  lineShape: EdgeShape;
  pathShape: EdgeShape;

  runSplitShape() {
    const hexMap = this.gamePlay.hexMap, hexCont = hexMap.mapCont.hexCont;
    const rad = TP.hexRad, r = rad / 4, rad2 = rad*rad*1.1;
    if (!this.splitShape) this.makeSplitShape(r);
    const mark = this.splitMark;
    const dragger = this.table.dragger;
    const pn = (n: number) => n.toFixed(2);
    const cornerId = (hex: AnkhHex, ewDir: EwDir) => {
      const xy = hex.cornerXY(ewDir)
      const mxy = hex.cont.localToLocal(xy.x, xy.y, hex.cont.parent.parent);
      return `@[${mxy.x.toFixed(1)}${mxy.y.toFixed(1)}]` // unique point identifier.
    }
    const pc = ([hex, dir]) => `${hex.Aname}-${dir}${cornerId(hex, dir)}`;

    let target: { mx: number, my: number, hex: AnkhHex, ewDir: EwDir, cxy: XY, cid: string } = undefined;
    const path = [] as (typeof target)[];
    let pathN: typeof target = undefined; // the final element of path
    const pathShape = this.pathShape; // real segment, on Path
    const lineShape = this.lineShape; // temp segment, pathN to mouse.
    pathShape.reset(); lineShape.reset();
    pathShape.visible = lineShape.visible = true;

    const inRangeOf = (cx, cy, base = path[0]) => {
      const pn = (n: number) => n.toFixed(2);
      const { mx, my } = path[0];
      const d2 = (mx - cx) * (mx - cx) + (my - cy) * (my - cy);
      return (d2 < rad2);
    }

    const doLine = (lx, ly) => {
      lineShape.reset();
      if (path[0]) {
        lineShape.graphics.mt(path[0].mx, path[0].my).lt(lx, ly);
      }
      hexMap.update();
    }
    const noMark = () => {
      mark.visible = false;
      target = undefined;
    }


    const dragFunc = (splitShape: Tile, ctx: DragInfo) => {
      const hex = this.table.hexUnderObj(splitShape, false);
      const pt = splitShape.parent.localToLocal(splitShape.x, splitShape.y, hexCont); // mouse (on mapCont)

      const isTerminal = (hex: AnkhHex, ewDir: EwDir, cid: string, n = 1) => {
        // count exits from given corner: is hex, is !water, & no border fro
        // count hexes adjacent to corner [hex,ewDir]: excludes hex, & water
        const adjHexes = hex.cornerAdjHexes(ewDir).filter(([chex, ewDir]) => chex.terrain !== 'w' && !!hex.canEnter(chex) );
        return adjHexes.length === n;
      }

      let lx = pt.x, ly = pt.y;
      if (hex instanceof AnkhHex) {
        const { x: hx, y: hy, hexDir } = hex.cornerDir(pt), ewDir = hexDir as EwDir;
        if (!H.ewDirRot[ewDir]) {
          noMark();
          doLine(lx, ly);
          return; // not onTarget
        }
        // isNearCorner(hex, ewDir, r)
        const onCorner = hex.isNearCorner({ x: hx, y: hy }, ewDir, r)
        const { x: cx, y: cy } = hex.cornerXY(ewDir);
        const cid = onCorner && cornerId(hex, ewDir);

        if (!path[0]) {
          // check legal start:
          if (hex.terrain === 'w') return;
          if (!isTerminal(hex, ewDir, cid)) {
            doLine(lx, ly); // line, no mark, onCorner or not...
            return;
          }
        }
        if (onCorner && path.length > 1) {
          if (path.slice(1).find(({ cid: pcid }) => pcid === cid)) {
            doLine(lx, ly); // no going back beyond the last mark.
            return;
          }
        }
        if (path.length > 0 && isTerminal(path[0].hex, path[0].ewDir, path[0].cid) && isTerminal(hex, ewDir, cid, 0)) {
          doLine(lx, ly);  // no more after reaching a terminal.
          return;
        }
        // if not adj to path[0] then not a target
        const inRange = !path[0] || inRangeOf(pt.x, pt.y, path[0]);
        if (!inRange) {
          doLine(lx, ly);
          return;
        }

        if (true || inRange) {
          hex.cont.localToLocal(cx, cy, mark.parent, mark);        // mark.x, mark.y: corner (on mapCont)
          mark.visible = onCorner;
          target = onCorner ? { hex: hex, ewDir, mx: mark.x, my: mark.y, cxy: { x: cx, y: cy }, cid } : undefined;
          if (onCorner) { lx = mark.x, ly = mark.y } // snap to corner if on target;
        }
      }
      doLine(lx, ly);
    }
    // click:
    const dropFunc = (dispObj: DisplayObject, ctx: DragInfo) => {
      if (target) {
        if (path[0]?.hex === target.hex && path[0]?.ewDir === target.ewDir) {
          finalize()  // TODO return to normal, process path.
          return;
        }
        if (!path[0]) pathShape.graphics.mt(target.mx, target.my);
        else pathShape.graphics.lt(target.mx, target.my);
        path.unshift(target);
        lineShape.reset();
      } else {
        // clear and reset path
        path.length = 0;
        pathShape.reset();
        lineShape.reset();
      }
      dragSplitter();
    }
    let seed: AnkhHex;
    const finalize = () => {
      // midAngle of two ewDirs as nsDirRot: [0, 60, 120, ... 240, 300, 0] => [30, 90, 150, ... 330]
      // ewAngle would use ewDirRot
      // (Math.abs(a0 - a1) < 90) ? (a0 + a1) / 2 : 180 + (a0 + a1) / 2;
      const midAngle = (dir0: HexDir, dir1: HexDir) => {
        const a0 = H.dirRot[dir0], a1 = H.dirRot[dir1];
        return (Math.abs(a0 - a1) <= 180) ? (a0 + a1) / 2 : ((360 + a0 + a1) / 2) % 360;
        //return Math.abs(a0 - a1) < 300 ? Math.min(a0, a1) + 30 : (Math.max(a0, a1) + 30) % 360;
      }
      const nsDirOfAngle = (nsAngle: number) => H.nsDirs.find((value) => H.nsDirRot[value] === nsAngle);
      const nsDirOfEwDirs = (ewDir0: EwDir, ewDir1: EwDir) => {
        return nsDirOfAngle(midAngle(ewDir0, ewDir1))
      }

      console.log(stime(this, `.finalize: ------------------`), path.map(({ hex, ewDir }, n) => `${n}: ${pc([hex,ewDir])}`));
      lineShape.visible = pathShape.visible = false;
      this.table.dragger.stopDrag();
      this.table.dragger.stopDragable(this.splitShape);
      this.splitShape.visible = this.splitMark.visible = false;
      dragger.stopDragable(this.splitShape);

      // for corner[n: hexn, ewDir] find corner[n+1] on same hex
      const splits = path.map(({ hex: hex1, ewDir: ewDir1 }, n, ary) => {
        if (n == 0) return undefined as [AnkhHex, NsDir];
        let { hex: hex0, ewDir: ewDir0 } = ary[n - 1];
        if (hex1 !== hex0) {
          // [hex1,ewDir1] is same corner as [hex0,ewDirQ] need to find ewDirQ:
          // there are 2 corners on the segment: [hex0, ewDir0] & [hex1, ewDir1];
          // there are 2 hexes common to both points, may be neither hex0 nor hex1;
          // need to find one of the common hexes, and the ewDirs to each corner.
          const c0adj = hex0.cornerAdjHexes(ewDir0); c0adj.unshift([hex0, ewDir0]);
          const c1adj = hex1.cornerAdjHexes(ewDir1); c1adj.unshift([hex1, ewDir1]);
          const inter = Arrays_intersect(c1adj, c0adj, ([hex, ewdir]) => hex); // elts of c1adj
          // expect 1 or 2 common elements:
          const [hexC1, ewDirC1] = inter[0];
          const [hexC0, ewDirC0] = c0adj.find(([hexC0, dir]) => hexC0 === hexC1); // elts of c0adj
          hex0 = hexC1; ewDir1 = ewDirC1; ewDir0 = ewDirC0;
        }
        const nsDir = nsDirOfEwDirs(ewDir0, ewDir1);
        hex0.addEdge(nsDir, TP.borderColor)
        seed = hex0; // it has an edge, must be a real hex.
        return [hex0, nsDir] as [AnkhHex, NsDir];
      });
      const { row, col } = seed, rid = hexMap.regions.length + 1 as RegionId;
      const splitBid = [row, col, rid, false];    // false => TP.edgeColor vs TP.riverColor
      const splitDirs = splits.slice(1).map(([hex, nsDir]) => [hex.row, hex.col, nsDir] as SplitDir);
      const splitSpec = [splitBid, ...splitDirs] as SplitSpec;
      //hexMap.splits.push(splitSpec);
      hexMap.addSplit(splitSpec, true);
    }
    const dragSplitter = () => {
      this.splitShape.visible = this.splitShape.mouseEnabled = true;
      dragger.dragTarget(this.splitShape, { x: 0, y: 0 });
    }
    dragger.makeDragable(this.splitShape, this, dragFunc, dropFunc);
    dragger.clickToDrag(this.splitShape);
    dragSplitter();
  }
}
/** a tiny HexShape */
export class SplitterShape extends Tile {
  override get radius(): number { return TP.hexRad/6; }
  constructor() {
    super('split', undefined);
  }
  override makeShape(): PaintableShape {
    const base = new HexShape(this.radius);
    base.paint(TP.splitColor);
    return base;
  }

  /** return true if within radius/3 of corner. */
  override isLegalTarget(toHex: Hex1, ctx?: DragContext): boolean {

    return false;
  }
}
