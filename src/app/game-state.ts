import { C, className, stime } from "@thegraid/common-lib";
import { Figure, Monument, Obelisk, Pyramid, Temple } from "./ankh-figure";
import { GamePlay, GP } from "./game-play";
import { Player } from "./player";
import { PlayerPanel } from "./player-panel";
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
  get panel() { return this.table.panelForPlayer[this.gamePlay.curPlayerNdx]; }

  get eventName() { return this.gamePlay.eventName; }
  get selectedAction() { return this.gamePlay.selectedAction; }
  set selectedAction(val) { this.gamePlay.selectedAction = val; }
  get selectedActionIndex() { return this.gamePlay.selectedActionIndex; }
  readonly selectedActions: string[] = [];
  areActiveActions: boolean;

  get playerFigures() { return this.gamePlay.curPlayer.meeples.filter(meep => (meep instanceof Figure)) as Figure[]}
  doneButton: UtilButton;
  highlights: Figure[];
  conflictRegion = 0;
  get panelsInConflict() {
    return this.table.panelForPlayer.filter(panel => panel.isPlayerInRegion(this.conflictRegion));
  }
  panelsInThisConflict: PlayerPanel[];

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

  phase(phase: string) {
    this.state = this.states[phase];
    console.log(stime(this, `.phase:`), phase);
    this.state.start();
  }

  button(label?: string) {
    this.doneButton.label.text = label;
    this.doneButton.paint(this.gamePlay.curPlayer.color, true);
    this.doneButton.visible = this.doneButton.mouseEnabled = !!label;
    this.doneButton.updateWait(false)
  }

  /** invoked when 'Done' button clicked. [or whenever phase is 'done' by other means] */
  done(...args: any[]) {
    console.log(stime(this, `.done: ${this.state.Aname}-${this.selectedActions.length}`), this.state);
    this.state.done();
  }
  undoAction() {
    const action = this.selectedAction;
    if (!action) return;
    this.states[action].undo?.();
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
              panel.selectAnkhPower(undefined, { }); // as if a button was clicked: take Ankh, get Guardian.
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
      done: () => { this.phase('EndAction') },
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
        const conflictRegion = ++this.conflictRegion; // 1..n
        if (conflictRegion > this.gamePlay.hexMap.regions.length) this.phase('ConflictDone');
        else this.phase('ConflictInRegion');
      },
    },
    ConflictInRegion: {
      start: () => {
        const panels = this.panelsInThisConflict = this.panelsInConflict;  // original players; before plague, Set, or whatever.
        if (panels.length > 1) this.phase('Obelisks'); // do battle, check for Obelisk
        else if (panels.length === 0) this.phase('ConflictNextRegion'); // no points for anyone.
        else if (panels.length === 1) this.phase('Dominate');   // no battle
      }
    },
    Dominate: {
      start: (panel: PlayerPanel) => {
        this.scoreMonuments(true); // monunent majorities (for sole player in region)
        this.phase('ConflictNextRegion');
      }
    },
    Obelisks: {
      panels: [],
      start: () => {
        const panels = this.panelsInConflict.filter(panel => panel.god.ankhPowers.includes('Obelisk'));
        // enable on-panel 'Obelisk done' button => phaseDone(panel);
        panels.forEach(panel => panel.enableObeliskTeleport(this.conflictRegion));
      },
      done: (p: PlayerPanel) => {
        const panels = this.state.panels;
        const ndx = panels.indexOf(p);
        panels.splice(ndx, 0);  // or rig it up to use Promise/PromiseAll
        if (panels.length === 0) this.phase('Card');
      }
    },
    Card: {
      panels: [],
      start: () => {
        const panels = this.state.panels = this.panelsInConflict;
        panels.forEach(panel => panel.selectCards());
      },
      done: (p: PlayerPanel) => {
        const panels = this.state.panels;
        const ndx = panels.indexOf(p);
        panels.splice(ndx, 0);  // or rig it up to use Promise/PromiseAll
        if (panels.length === 0) this.phase('Reveal');
      }
      // Open all player card lists! (atop meeple stable area)
      // if (Horus) mark excluded card (GREEN to GREY)
      // click card to select/play (GREEN to YELLOW)
      // if Amun-power unused: allow click second card (set Amun-Power used)
      // click Card-Done: close Player
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
      start: () => {
        // "reveal" all cards; (YELLOW)
        // trigger Flood
        this.phase('Build');
      },
    },
    Build: {
      panels: [],
      start: () => {
        const panels = this.state.panels = this.panelsInConflict;
        panels.forEach(panel => panel.enableBuild(this.conflictRegion));
      },
      done: (p: PlayerPanel) => {
        const panels = this.state.panels;
        const ndx = panels.indexOf(p);
        panels.splice(ndx, 0);  // or rig it up to use Promise/PromiseAll
        if (panels.length === 0) this.phase('Plague');
      }

      // for each build card in player-score order:
      // mouse enable empty hex in region & monument sources (obelisk, temple, pyramid)
      // drag & drop: place monument, set owner
      // allow unMove
      // click Done: phase Plague
    },
    Plague: {
      panels: [],
      start: () => {
        const panels = this.state.panels = this.panelsInConflict;
        panels.forEach(panel => panel.enablePlagueBid(this.conflictRegion));
      },
      done: (p: PlayerPanel) => {
        const panels = this.state.panels;
        const ndx = panels.indexOf(p);
        panels.splice(ndx, 0);  // or rig it up to use Promise/PromiseAll
        if (panels.length === 0) this.phase('PlagueResolution');
      }

      // mouse enable plague big counters (max value: player.coins)
      // on Done --> process result: remove meeples, (process mummy cat, etc)
      // phase Monuments
    },
    PlagueResolution:{
      start: () => {
        const panels = this.state.panels = this.panelsInConflict;
        // reveal bids, sacrifice followers, determine highest bidder, kill-units
        this.phase('Monuments');
      },
    },

    Monuments: {
      // score Monuments in conflictRegion; incr Player.devotion (score);
      start: () => {
        this.scoreMonuments(false);
        this.phase('BattleResolution')
      },
      // count valueInRegion[type][player] (for curRegion)
      // for each type(incl strength): valueInRegion[type] = 0;
      // forEachHex(in region, with claimed Monument: incr playerCount, record Max/Tie)
      // note: claimed Temple may incr strength, account for Set effect, etc.
      // assign Devotion (Monuments)
      // phase: BattleResolution
    },
    BattleResolution: {
      start: () => {
        this.panelsInConflict.forEach(panel => setStrengthInRegion(this.conflictRegion));
        this.panelsInConflict.sort((a, b) => a.strength - b.strength)

        this.phase('ConflictNextRegion')
      },
      // add Temple to strength (if not done above)
      // add Replendent to strength
      // add Cards to strength (Plague, Drought, Chariots)
      // add Bastet-Cats
      //
      // compute winner (and size of win for Glorious)
      // remove losers (modulo Flood, Set); process Cat
      // assign Devotion (for Miracle)
      // assign Devotion (win & Drought)
      // mark cards done (YELLOW to RED, GREP to GREEN)
      // phase(ConflictRegions) do next region in list
    },
    ConflictDone: {
      start: () => { },
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

  /** score each monument type in conflictRegion */
  scoreMonuments(dom = false) {
    const allPlayers = this.gamePlay.allPlayers;
    const players = this.panelsInConflict.map(panel => panel.player);
    console.log(stime(this, `.scoreMonuments[${this.conflictRegion}]`), players);
    const hexes = this.gamePlay.hexMap.regions[this.conflictRegion].filter(hex => hex.tile instanceof Monument);
    const tiles = hexes.map(hex => hex.tile);
    const types = [Obelisk, Pyramid, Temple];
    const typeNameToNdx = new Map<string, number>();
    types.forEach((type, n) => typeNameToNdx.set(type.name, n)); // { Obelisk: 0, Pyramid: 1, Temple: 2 }
    const countsByPlayerOfType = allPlayers.map(type => types.map(type => 0));// [[0,0,0], [0,0,0], [0,0,0], ...]
    tiles.forEach(tile => allPlayers.forEach(p => countsByPlayerOfType[p.index][typeNameToNdx.get(className(tile))]++));
    // [ [p1nOb, p2nOb, p3nOb], [p1nPy, p2nPy, p3nTe], [p1nTe, p2nTe, p3nTe], ... ]
    const labeledCounts = countsByPlayerOfType.map((pnary, pndx) => pnary.map(pn => ({ n: pn, p: pndx })));
    // [{ n: p1nOb, p: p1 }, { n: p2nOb, p: p2 }, { n: p3nOb, p: p3 }], [p1nPy, p2nPy, p3nPy], [p1nTe, p2nTn, p3nTe]]
    const sortedCount = labeledCounts.map(pnary => pnary.sort((a, b) => a.n - b.n));
    const deltas = sortedCount.map(pnary => ({ p: pnary[0].p, n: pnary[0].n, d: (pnary[0].n - (pnary[1] ? pnary[1].n : 0)) }));
    const winers = deltas.map(({ p, n, d }) => ({ p: ((n > 0 && d > 0) ? allPlayers[p] : undefined), n, d }));
    winers.forEach(({ p, n, d }) => {
      console.log(stime(this, `.scoreMonuments[${this.conflictRegion}] - ${types[n].name}: Player=${p?.Aname}, d=${d}, n=${n}`))
      if (players.includes(p)) p.score + 1;
    })

  }
}
function setStrengthInRegion(conflictRegion: number): void {
  throw new Error("Function not implemented.");
}



