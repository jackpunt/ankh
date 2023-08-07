import { C, className, stime } from "@thegraid/common-lib";
import { Figure, Monument } from "./ankh-figure";
import { GamePlay, GP } from "./game-play";
import { Player } from "./player";
import { PlayerPanel, PowerLine } from "./player-panel";
import { UtilButton } from "./shapes";
import { Tile } from "./tile";

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
  get selectedAction() { return this.gamePlay.selectedAction; }
  set selectedAction(val) { this.gamePlay.selectedAction = val; }
  get selectedActionIndex() { return this.gamePlay.selectedActionIndex; }
  readonly selectedActions: string[] = [];
  areActiveActions: boolean;

  get playerFigures() { const plyr = this.gamePlay.curPlayer; return Figure.allFigures.filter(fig => fig.player === plyr) }

  doneButton: UtilButton;
  highlights: Figure[];
  conflictRegion = 0;
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
    return GP.gamePlay.allPlayers.find(p => p.god.Aname == name);
  }

  start(phase = 'BeginTurn') {
    this.doneButton = this.gamePlay.table?.doneButton;
    this.phase(phase);
  }

  phase(phase: string, startArg?: any) {
    this.state = this.states[phase];
    console.log(stime(this, `.phase:`), phase);
    this.state.start(startArg);
  }

  button(label?: string, color = this.gamePlay.curPlayer.color, hide = false, afterUpdate = undefined) {
    this.doneButton.label.text = label;
    this.doneButton.paint(color, true);
    this.doneButton.visible = this.doneButton.mouseEnabled = !!label;
    this.doneButton.updateWait(hide, afterUpdate);
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
          this.button(`Choice ${n} Done`);
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
        this.button('Move done');
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
        this.button('Summon done');
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
        if (!ok && this.gamePlay.curPlayer.coins <= rank) {
          console.log(stime(this, `.Ankh: ays.listeners=`), panel.confirmContainer);
          panel.areYouSure('Not enough followers to obtain Anhk power!',
            () => {
              console.log(stime(this, `.Ankh state: yes`))
              panel.selectAnkhPower();       // as if a button was clicked: take Ankh, get Guardian.
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
        this.button();
        panel.activateAnkhPowerSelector();
      },
      // mouseEnable next Upgrades;
      // on click: move Anhk to button (cover: now unclickable), set bit on Player.
      // mouse disable button
      done: () => {
        this.button('Done');
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
        this.gamePlay.eventName = undefined;
        this.phase('EndTurn');
      },
      // phase(EndTurn)
    },
    Split: {
      start: () => {
        console.log(stime(this, `Split:`));
        this.button('Split done');
      },
      done: () => {
        this.phase('Swap');
      },
      // mouse enable edges (of land tiles)
      // disable edges of hexes in region of < 12 hexes!
      // click each edge! to light
      // validate(<= 6 selected; from board/water to board/water; 6 hexes per region )
      // click Done(assign number, phase(Swap))
    },
    Swap: {
      start: () => {
        console.log(stime(this, `Swap:`))
        this.button('Swap done');
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
        // TODO: highlight AnkhToken source of PlayerPanel
        // TODO: limit to One monument claimed; auto 'EventDone'
        // TODO: highlight current Action until end of Action;
        this.panel.ankhSource.sourceHexUnit.highlight(true, C.BLACK);
        this.button('Claim done');
      },
      done: () => {
        this.phase('EventDone');
      }
      // x = isUnclaimedMonument() ?
      // mouse enable Hex; with (x ? unclaimed : any monument) and adj(curPlayer))
      // click: unmark & remark
      // Done(phase(EventDone))
    },
    Conflict: {
      start: () => {
        this.conflictRegion = 0;
        this.panel.canUseTiebreaker = true;
        this.phase('ConflictNextRegion');
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
      start: () => {
        const conflictRegion = ++this.conflictRegion;  // 1..n
        const isRegion = (conflictRegion <= this.gamePlay.hexMap.regions.length);
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
        omni.forEach(panel => panel.player.coins += panel.nFiguresInRegion(this.conflictRegion - 1));

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
        this.button('Reveal Done', C.grey);
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
        this.button('Build Done', panels[0].player.color);
      },
      // *should* be triggered by 'buildDone' event from panel.enableBuild() --> Monument.dropFunc
      done: (panel: PlayerPanel = this.state.panels[0]) => {
        // no cost if Done *without* building (cbir>0)
        if (panel.canBuildInRegion < 0 && !panel.hasAnkhPower('Inspiring')) {
          panel.player.coins -= 3;
        }

        const panels = this.state.panels;
        const ndx = panels.indexOf(panel);
        panels.splice(ndx, 1);  // or rig it up to use Promise/PromiseAll
        if (panels.length === 0) {
          this.button('Build Done', C.grey, true, () => this.phase('Plague'));
          return;
        }
        console.log(stime(this, `Build.done: return NOT done...`))
        this.button('Build Done', panels[0].player.color);
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
          if (powers.includes('Commanding')) player.coins += 3;
          player.score += dev;
          console.log(stime(this, `.BattleResolution: ${winner.name} wins, get ${dev} Devotion`));
          panels.splice(0, 1); // remove winner, panels now has all the losers.
        }
        const winp = winner.player;
        panels.forEach(panel => {
          if (panel.hasAnkhPower('Magnanimous') && panel.nFigsInBattle >= 2) panel.player.score += 2;
        });
        // TODO Set adjacency.
        const belongsTo = (fig: Figure, player: Player) => { return fig.player === player }
        const floodProtected = (fig: Figure, player: Player, ) => player.panel.hasCardInBattle('Flood') && fig.hex.terrain === 'd';
        const regionId = this.conflictRegion;
        const figuresInRegion = Figure.allFigures.filter(fig => fig.hex?.district === regionId);
        const deadFigs = figuresInRegion.map(fig => !belongsTo(fig, winp) && !floodProtected(fig, fig.player) ? fig : undefined).filter(fig => !!fig);
        console.log(stime(this, `.BattleResolution: Figures KIA:`), deadFigs);
        deadFigs.forEach(fig => fig.sendHome());

        const worships0 = panels0.filter(panel => panel.hasAnkhPower('Workshipful'));
        const workship1 = worships0.filter(panel => panel.player.coins >= 2)
        // TODO sort by score:rank.
        workship1.forEach(panel => (panel.player.coins -= 2, panel.player.score += 1));
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
        this.highlightRegions(false);
        this.phase('EndTurn');
      },
      // coins from Scales to Toth, add Devotion(Scales)
      // mark on Event panel
      // phase EndTurn
    },
    EndTurn: {
      start: () => {
        this.selectedAction = undefined;
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
    const allMonts = Tile.allTiles.filter(tile => (tile instanceof Monument) && (tile.hex?.isOnMap));
    const monts =  allMonts.filter(mont => (mont.player === player || mont.player === undefined)) as Monument[];
    const mine = monts.filter(mont => mont.hex.findAdjHex(hex => hex.meep?.player === player));
    const n = mine.length;
    player.coins += n;
    if (player.god.ankhPowers.includes('Revered')) player.coins += 1;
  }

  static typeNames = ['Obelisk', 'Pyramid', 'Temple'];
  /** score each monument type in conflictRegion */
  scoreMonuments(dom = false) {
    const regionId = this.conflictRegion - 1;
    const allPlayers = this.gamePlay.allPlayers;
    const players = this.panelsInConflict.map(panel => panel.player);
    console.log(stime(this, `.scoreMonuments[${this.conflictRegion}]`), players);
    const hexes = this.gamePlay.hexMap.regions[regionId].filter(hex => (hex.tile instanceof Monument) && hex.tile.player);
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
      if (players.includes(p)) p.score + 1;
    })
    return;
  }
  scoreMonuments2() {
    const regionId = this.conflictRegion - 1;
    const allPlayers = this.gamePlay.allPlayers;
    const players = this.panelsInConflict.map(panel => panel.player);
    console.log(stime(this, `.scoreMonuments[${this.conflictRegion}]`), players);
    const hexes = this.gamePlay.hexMap.regions[regionId].filter(hex => (hex.tile instanceof Monument) && hex.tile.player);
    const tiles = hexes.map(hex => hex.tile);
    const types = GameState.typeNames;
    types.forEach(type => {
      // [ {p: p0, n: 0}, {p: p1, n: 0}, {p: p2, n: 0} ]
      const nTilesByPlayer = allPlayers.map(p => ({ p, n: 0 }))
      tiles.forEach(tile => nTilesByPlayer[tile.player.index].n += 1)
      const pnary = nTilesByPlayer.sort((a, b) => b.n - a.n);
      const pndary = ({ p: pnary[0].p, n: pnary[0].n, d: (pnary[0].n - (pnary[1] ? pnary[1].n : 0)) })
      const {p, n, d} = pndary;
      const winer = ({ p: ((n > 0 && d > 0) ? p : undefined), n, d });
      console.log(stime(this, `.scoreMonuments[${this.conflictRegion}]: ${type} -> Player=${p?.Aname}, d=${d}, n=${n}`))
      if (players.includes(p)) p.score + 1;
    })
  }
}
