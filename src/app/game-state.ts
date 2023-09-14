import { C, stime } from "@thegraid/common-lib";
import { Figure, GodFigure, Guardian, Monument, Obelisk, Scorpion, Warrior } from "./ankh-figure";
import { AnkhHex, RegionId } from "./ankh-map";
import { AnkhMapSplitter } from "./ankhmap-splitter";
import { json } from "./functions";
import type { GamePlay } from "./game-play";
import { Amun, Anubis, Bastet, God, Hathor, Horus, Isis, Osiris, Ra } from "./god";
import { Hex1 } from "./hex";
import type { Player } from "./player";
import { PlayerPanel, PowerLine } from "./player-panel";
import type { ActionIdent } from "./scenario-parser";
import { HexShape, PaintableShape } from "./shapes";
import { DragContext, EventName } from "./table";
import { TP } from "./table-params";
import { Tile } from "./tile";

interface Phase {
  Aname?: string,
  start(...args: any[]): void; // what to do in this phase
  done?: (...args: any[]) => void;          // for async; when done clicked: proceed
  undo?: () => void;
  panels?: PlayerPanel[],
  deadFigs?: Figure[], // for Plague
  nextPhase?: string,  // for BastetDeploy
}

export class GameState {

  constructor(public gamePlay: GamePlay) {
    Object.keys(this.states).forEach((key) => this.states[key].Aname = key);
  }
  _ankhMapSplitter: AnkhMapSplitter;
  get ankhMapSplitter() { return this._ankhMapSplitter ?? (this._ankhMapSplitter = new AnkhMapSplitter(this)) }

  state: Phase;
  get table() { return this.gamePlay?.table; }
  get curPlayer() { return this.gamePlay.curPlayer; }
  get panel() { return this.curPlayer.god.panel; }

  selectedActionIndex: number; // where in the row [0..n] to place an AnkhMarker
  selectedAction: ActionIdent; // set when click on action panel or whatever. read by ActionPhase;
  eventName: EventName;
  eventSpecial: 'merge' | 'redzone';

  readonly selectedActions: ActionIdent[] = [];

  bastetPlayer: Player = undefined;
  /** Player has done a BastetDisarm this turn. */
  bastetDisarmed = false;
  disarmBastet = 'Disarm Bastet?';
  /** Player has done a BastetDisarm this turn, remove doneButton. */
  setBastetDisarmed() {
    this.bastetDisarmed = true;
    if (this.table.doneButton.label_text === this.disarmBastet) {
      this.done();
    }
  }
  get bastetDisarmable() {
    // [player can select Bastet Cat for disarming] if any BastetMark is adj to Figure(this.curPlayer)
    const bms = Bastet.instance?.bastetMarks.filter(bm => bm.bastHex);
    const adj = bms?.find(bmark => bmark.bastHex.findAdjHexByRegion((hex => hex.figure?.player === this.curPlayer)));
    return !this.bastetDisarmed && !!adj && TP.promptBastetDisarm;
  }

  get playerFigures() { const plyr = this.curPlayer; return Figure.allFigures.filter(fig => fig.player === plyr) }

  highlights: Figure[];
  conflictRegion: RegionId = undefined;

  get panelsInConflict() {
    return this.table.panelsInRank.filter(panel => panel.isPlayerInRegion(this.conflictRegion));
  }
  panelsInThisConflict: PlayerPanel[];
  buildPanels: PlayerPanel[];

  battleResults: any; // TODO: record winner, who lost units, etc for use by special powers (Osiris move) and Cards.
  bannedCard: string; // keyof PlayerPanel.colorForState

  get actionsDone() { return this.selectedActions.length};

  findGod(name: string) {
    return this.gamePlay.allPlayers.find(p => p.god.Aname == name);
  }

  saveGame() {
    this.gamePlay.gameSetup.scenarioParser.saveState(this.gamePlay);
  }

  saveState() {
    return (this.state.Aname === 'ConflictInRegion')
    ? ['ConflictNextRegion', this.conflictRegion]
    : ['BeginTurn'];
  }

  parseState(phaseWithArgs: any[]) {
    if (phaseWithArgs) {
      const [phase, ...args] = phaseWithArgs;
      this.startPhase = phase;
      this.startArgs = args;
    }
  }
  startPhase = 'BeginTurn';
  startArgs = [];
  /** Bootstrap the Scenario: set bastetPlayer and then this.phase(startPhase, ...startArgs). */
  start() {
    this.bastetPlayer = Bastet.instance?.player;
    this.phase(this.startPhase, ...this.startArgs);
  }

  phase(phase: string, ...args: any[]) {
    console.log(stime(this, `.phase: ${this.state?.Aname ?? 'Initialize'} -> ${phase}`));
    this.state = this.states[phase];
    this.state.start(...args);
  }

  /** set label & paint button with color;
   * empty label hides & disables.
   * optional continuation function on 'drawend'.
   */
  doneButton(label?: string, color = this.curPlayer.color, afterUpdate: ((evt?: Object, ...args: any[]) => void) = undefined) {
    const doneButton = this.table.doneButton;
    doneButton.visible = !!label;
    doneButton.label_text = label;
    doneButton.paint(color, true);
    doneButton.updateWait(false, afterUpdate);
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
    map.showRegion(regionId - 1, '');
    afterUpdate && map.mapCont.stage.on('drawend', afterUpdate, this, true);
 }

  readonly states: { [index: string]: Phase } = {
    BastetDeploy: {
      // (turn === 0 -> ChooseAction) OR (ConflictDone -> EventDone) OR (when bastetExplodes)
      nextPhase: 'ChooseAction',
      // after Setup and after each Conflict, Bastet deploys all three 'cats'.
      // Once per turn, player may choose to reveal a Cat Token (adjacent to their Figure)
      // (drag Cat onto adjacent Figure)
      // if '1' | '3' return it (deactivated) to Bastet.
      // if '*', it explodes, killing the adjacent Figure (unless it's a God)
      // and Bastet gathers and redeploys all the Cats.
      // when Bastet is in Battle and there is a cat, it is revealed ('Reveal' phase)
      // and '1' | '3' is added to Bastet's strength.
      start: (phase: string) => {
        if (phase !== undefined) this.state.nextPhase = phase;
        // enable Cats on the board; onClick-> {gamePlay.bastetCat(cat); curState.done()}
        Bastet.instance.bastetMarks.forEach(bmark => {
          bmark.sendHome();
          bmark.highlight(true);
        });
        this.doneButton('Bastet Deploy', this.bastetPlayer.color);
      },
      done: () =>  {
        const bmarks = Bastet.instance.bastetMarks;
        if (bmarks.find(bm => !bm.bastHex)) {
          setTimeout(() => this.phase('BastetDeploy', this.state.nextPhase), 4);
          return; // must deploy all BastetMarks
        }
        bmarks.forEach(bmark => bmark.highlight(false));
        this.doneButton(); // Bastet Deploy: remove doneButton
        this.phase(this.state.nextPhase);
      }
    },
    BeginTurn: {
      start: () => {
        this.selectedAction = undefined;
        this.selectedActions.length = 0;
        this.saveGame();
        this.bastetDisarmed = Bastet.instance?.isGodOf(this.curPlayer); // if false: curPlayer can try to disarm Bastet
        if (this.bastetDisarmable) {
          this.states['BastetDeploy'].nextPhase = 'ChooseAction';// explode -> ChooseAction
          this.doneButton(this.disarmBastet);
          return;
        }
        const bastetDeploy = !!Bastet.instance && (this.gamePlay.turnNumber === 0);
        this.phase(!bastetDeploy ? 'ChooseAction' : 'BastetDeploy', 'ChooseAction');
      },
      done: () => {
        this.phase('ChooseAction');
      }
    },
    // ChooseAction:
    // if (2 action done || no actions to activate || Event) phase(EndTurn)
    // else { place AnkhMarker, phase(actionName) }
    ChooseAction: {
      start: () => {
        const maxActs = (this.curPlayer.god.uberGod || this.curPlayer.god.unterGod) ? 1 : 2;
        if (this.actionsDone >= maxActs) this.phase('EndTurn');
        // enable and highlight open spots on Action Panel
        const lastAction = this.selectedActions[0], n = this.selectedActions.length + 1;
        const active = this.table.activateActionSelect(true, lastAction);
        if (!active) {
          this.phase('EndTurn');  // assert: selectedActions[0] === 'Ankh'
        } else {
          this.selectedAction = undefined;
          this.doneButton(`Choice ${n} Done`); // ???
         }
      },
      done: (ok?: boolean) => {
        const action = this.selectedAction; // set by dropFunc() --> state.done()
        if (!ok && !action) {
          this.panel.areYouSure('You have an unused action.', () => {
            setTimeout(() => this.state.done(true), 50);
          }, () => {
            setTimeout(() => this.state.start(), 50);
          });
          return;
        }
        this.selectedActions.unshift(action); // may unshift(undefined)
        this.phase(action ?? 'EndTurn');
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
          this.curPlayer.panel.areYouSure('You have not moved any Figures', () => {
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
        const reason = (rank > 3) ? `No more Ankh Tokens to obtain Ankh power` :
          (rank > panel.player.coins) ? `Need ${rank} followers to obtain Anhk power!` : undefined;
        if (!ok && reason) {
          console.log(stime(this, `.Ankh: Are You sure? [${rank}: ${reason}]`));
          panel.areYouSure(reason,
            () => {
              console.log(stime(this, `.Ankh state: yes [${rank}]`));
              this.state.start(true);
            },
            () => {
              console.log(stime(this, `.Ankh state: cancel`), this.selectedActions)
              this.table.undoActionSelection(this.selectedAction, this.selectedActionIndex);
              this.selectedAction = undefined;
              this.selectedActions.shift();     // action1 or undefined
              const active = this.table.activateActionSelect(true, this.selectedActions[0]); // true.
              if (!active) debugger;
              this.state = this.states['ChooseAction']; // set state, but do not start()
            });
          return;
        }
        this.doneButton(); // Ankh Power: no done button
        panel.activateAnkhPowerSelector();
      },
      done: () => {
        this.phase(!this.hathorSummon ? 'EndAction' : 'HathorSummon', 'EndAction');
      },
    },
    EndAction: {
      nextPhase: 'ChooseAction',
      start: () => {
        const nextPhase = this.state.nextPhase = !!this.eventName ? 'Event' : 'ChooseAction';
        if (this.bastetDisarmable) {
          this.states['BastetDeploy'].nextPhase = nextPhase; // explode -> BastetDeploy -> nextPhase
          this.doneButton(this.disarmBastet);                // doneButton -> done() -> nextPhase
          return;
        }
        this.phase(nextPhase);     // directl -> nextPhase
      },
      done: () => {
        this.phase(this.state.nextPhase);
      }
    },
    Event: {
      start: () => {
        const godName = this.curPlayer.godName, action = this.selectedAction;
        this.table.logText(`${godName}'s ${action} triggers Event: ${this.eventName}`);
        this.phase(this.eventName); // Split/Swap, Claim, Conflict:
        // ChooseCard, Reveal, BuildMonument, Plague, ScoreMonument, BattleResolution)
      },
    },
    Split: {
      start: () => {
        console.log(stime(this, `.Split:`));
        this.table.logText(`${this.curPlayer.godName} makes Split [${this.gamePlay.hexMap.regions.length}]`);
        // overlay is HexShape child of hex.cont; on mapCont.hexCont;
        this.ankhMapSplitter.runSplitShape();
        this.doneButton(); // Split: hide doneButton
      },
      done: () => {
        this.phase('Swap');
      },
      // disable edges of hexes in region of < 12 hexes!
    },
    Swap: {
      start: () => {
        console.log(stime(this, `Swap:`));
        this.table.logText(`${this.curPlayer.godName} does Swap [${this.gamePlay.hexMap.regions.length}]`);
        this.ankhMapSplitter.runSwap();
        this.doneButton('Swap done');
      },
      done: () => {
        this.phase('EventDone');
      }
    },
    Claim: {
      start: () => {
        const done = () => this.phase('EventDone');
        const ankhToken = this.panel.ankhSource.sourceHexUnit; //takeUnit();
        if (ankhToken?.claimableMonuments(this.panel.player).length > 0) {
          this.panel.ankhSource.sourceHexUnit?.highlight(true, C.BLACK);
          this.table.dragger.dragTarget(ankhToken, { x: 8, y: 8 });
          this.doneButton('Claim done');
        } else if (ankhToken) {
          this.panel.areYouSure(`No monuments to Claim.`, done);
        } else {
          this.panel.areYouSure(`No Ankh Tokens for claim.`, done);
        }
      },
      // invoked AnkhToken.dropFunc()
      done: (hex: AnkhHex) => {
        this.table.logText(`${this.curPlayer.godName} Claimed ${hex}`)
        this.phase('EventDone');
      }
    },
    Conflict: {
      start: () => {
        this.panel.canUseTiebreaker = true;
        const panels = this.table.panelsInRank;
        // do Omnipresent:
        const omni = panels.filter(panel => panel.hasAnkhPower('Omnipresent'));
        omni.forEach(panel => this.addFollowers(panel.player, panel.nRegionsWithFigures(), `Omnipresent`));
        // do Scorpions:
        const scorps = Scorpion.source?.filterUnits(scorp => scorp.hex?.isOnMap);
        scorps?.forEach(scorp => {
          const monts = scorp.attackMonuments;
          if (monts.length > 0) {
            this.table.logText(`${scorp.Aname} kills ${monts}`); // show Aname@Hex[...] before sendHome()
            monts.forEach(mont => mont.sendHome());
          }
        });

        this.phase(Horus.instance ? 'Horus' : 'ConflictNextRegion', 1);
      },
    },
    Horus: {
      start: () => {
        this.doneButton('Horus Eyes', 'darkred');
      },
      done: () => {
        const regionIds = Horus.instance.regionIds;
        this.table.logText(`Horus Eyes to ${regionIds}`)
        this.phase('ConflictNextRegion', 1); // AKA: Conflict FIRST Region
      }
      // place enable Eyes, drag to each Region (to Region index marker...)
      // Done(phase(ConflictNextRegion))
    },
    ConflictNextRegion: {
      start: (regionId = this.conflictRegion + 1) => {
        this.conflictRegion = regionId; // 1..n;
        const isRegion = (regionId <= this.gamePlay.hexMap.regions.length);
        this.highlightRegions(isRegion, regionId);
        setTimeout(() => this.phase(isRegion ? 'ConflictInRegion' : 'ConflictDone'), 1000);
      },
    },
    ConflictInRegion: {
      start: () => {
        this.plagueDeadFigs.length = 0;
        this.saveGame();
        const panels = this.panelsInThisConflict = this.panelsInConflict;  // original players; before plague, Set, or whatever.
        this.table.logText(`${this.state.Aname}[${this.conflictRegion}] ${panels.map(panel => panel.player.godName)}`);

        if (panels.length > 1) this.phase('Obelisks'); // begin 'Battle': check for Obelisk
        else if (panels.length === 0) this.phase('ConflictRegionDone'); // no points for anyone.
        else if (panels.length === 1) this.phase('Dominate', panels[0]);   // no battle
      }
    },
    Dominate: {
      start: (panel: PlayerPanel) => {
        let dev = 0, reasons = '';
        const devReason = (n, reason: string) => { dev += n, reasons = `${reasons} ${reason}:${n}` }
        this.table.logText(`${this.state.Aname}[${this.conflictRegion}] Player-${panel.player.index}`);
        this.scoreMonuments(true); // Monument majorities (for sole player in region)
        devReason(1, `Dominate[${this.conflictRegion}]`)
        if (this.hasRadiance(panel)) devReason(1, 'Radiance');
        this.addDevotion(panel.player, dev, reasons);
        this.phase('ConflictRegionDone');
      }
    },
    Obelisks: {
      panels: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        const panels0 = this.panelsInConflict.filter(panel => panel.hasAnkhPower('Obelisk'));
        const region = this.gamePlay.hexMap.regions[this.conflictRegion - 1];
        this.state.panels = panels0.filter(p => region.find(hex => hex.tile instanceof Obelisk && hex.tile.player === p.player))
        this.state.done();
      },
      done: (panel: PlayerPanel) => {
        const panels = this.state.panels;
        if (panel) {
          const ndx = panels.indexOf(panel); // ndx === 0!
          if (ndx < 0) return;    // ignore extra doneification.
          panel.showCardSelector(false, 'X');
          panels.splice(ndx, 1);  // or rig it up to use Promise/PromiseAll
        }
        if (panels.length > 0) {
          panels[0].showCardSelector(true, 'Teleport');
          return;
        }
        this.phase(this.horusInRegion(this.conflictRegion) ? 'HorusCard' : 'ChooseCard');
      }
    },
    HorusCard: {
      start: () => {
        const horus = Horus.instance;
        const cardSelector = horus.cardSelector;
        const panel = horus.player.panel;
        this.bannedCard = 'Cycle';
        cardSelector.activateCardSelector(true, 'Ban Card', panel);
      },
      done: () => {
        const cardSelector = Horus.instance.cardSelector;
        this.bannedCard = cardSelector.cardsInState('inBattle')[0].name;
        this.table.logText(`Horus banned card: ${this.bannedCard}`);
        this.phase('ChooseCard');
      }
    },
    ChooseCard: {
      panels: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        this.table.allPlayerPanels.forEach(panel => panel.cardSelector.doneButton.label_text='X'); // TODO encapsulate?
        const panels = this.state.panels = this.panelsInConflict;
        if (panels.length === 0) { this.phase('Reveal'); return; }
        panels.forEach(panel => panel.activateCardSelector('Choose'));
        this.doneButton(); // Choose: hide doneButton
      },
      done: (panel: PlayerPanel) => {
        const panels = this.state.panels;
        const ndx = panels.indexOf(panel);
        if (ndx < 0) return;    // ignore extra doneification.
        if (panel.cardsInBattle.length === 0) return; // must select a Card.
        panels.splice(ndx, 1);  // or rig it up to use Promise/PromiseAll
        // console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}].done(panel=${panel?.player.color})`));
        if (panels.length > 0) return; // wait for more panels to signal done
        this.phase('Reveal');
      }
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
        panels.forEach(panel => {
          panel.revealCards(true);
          if (panel.hasCardInBattle('Flood')) {
            const inRegion = panel.figuresInRegion(this.conflictRegion, panel.player);
            const nFlood = inRegion.filter(fig => fig.hex.terrain === 'f').length;
            this.addFollowers(panel.player, nFlood, 'Flood');
          }
          if (panel.cardsInBattle.length === 2) Amun.instance.setTokenFaceUp(false); // must be Amun:Two Cards used
        });
        // reveal BastetMark
        const bmark = Bastet.instance?.bastetMarks.filter(bmark => bmark.regionId === this.conflictRegion)?.[0];
        if (bmark) { bmark.setNameText(`${bmark.strength}`); bmark.updateCache() }
        this.gamePlay.hexMap.update();
        this.doneButton('Reveal Done', C.white);
        if (TP.autoRevealDone > 0) setTimeout(() => { this.state.done(); }, TP.autoRevealDone);
      },
      done: () => {
        const gamePlay = this.gamePlay;
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
        const buildPanels = []; let pl: PowerLine;
        if (this.state.panels?.length ?? 0 === 0) {}
        const panels = this.state.panels = this.panelsInConflict.filter(panel =>
          (pl = panel.hasCardInBattle('Build'), buildPanels.push(pl), pl) && (panel.canAffordMonument));
        if (panels.length === 0) {
          console.log(stime(this, `.BuildMonument: no panels will Build ()`), ...buildPanels.map(p=>p ?p.name : ''));
          this.phase('Plague');
          return;
        }
        const panel0 = panels[0], player = panel0.player;
        panel0.enableBuild(this.conflictRegion); // ankh-figure: Monument.dropFunc() --> buildDone --> panel.enableBuild
        this.table.monumentSources.forEach(ms => ms.sourceHexUnit?.paint(player.color));
        this.doneButton('Build Done', player.color);
      },
      // Triggered by 'Build Done' button (no panel/Monument!)
      // OR by 'buildDone' event from panel.enableBuild() --> Monument.dropFunc (with: panel/Monument)
      done: (panel: PlayerPanel = this.state.panels[0], monument?: Monument) => {
        if (panel && monument) {
          this.table.logText(`${panel.player.godName} built Monument: ${monument?.hex.toString()}`);
          // no cost if Done *without* building (cbir>0)
          if (!panel.canBuildInRegion && !panel.hasAnkhPower('Inspiring')) {
            this.addFollowers(panel.player, -3, `Build Monument[${this.conflictRegion}]`);
            if (this.hathorSummon) {
              this.phase('HathorSummon', () => {
                // return to BuildMonument.done(panel);
                ; (this.state = this.states['BuildMonument']).done(panel); // with no Monument!
              });
              return;
            }
          }
        }
        const panels = this.state.panels;
        const ndx = panels.indexOf(panel);
        if (ndx >= 0) {           // vs repeated or undefined panel
          panels.splice(ndx, 1);  // or rig it up to use Promise/PromiseAll
          if (panels.length === 0) {
            this.table.monumentSources.forEach(ms => ms.sourceHexUnit?.paint(undefined));
            this.doneButton('', C.grey, () => this.phase('Plague'));
            return;
          }
        }
        // console.log(stime(this, `Build.done: return NOT done...`))
        const panel0 = panels[0], player = panel0.player;
        panel0.enableBuild(this.conflictRegion); // ankh-figure: Monument.dropFunc() --> buildDone --> panel.enableBuild
        this.table.monumentSources.forEach(ms => ms.sourceHexUnit?.paint(player.color));
        this.doneButton('Build Done', player.color);
     }
    },
    Plague: {
      panels: [],    // panels in this region
      start: () => {
        const plaguePanels = this.panelsInThisConflict.filter(panel => panel.hasCardInBattle('Plague'));
        const plaguePanel = plaguePanels.shift();
        if (!plaguePanel) { this.phase('ScoreMonuments'); return; }
        plaguePanel.battleCardsToTable(plaguePanel.hasCardInBattle('Plague')); // will not appear in plaguePanels...

        const panels = this.state.panels = this.panelsInThisConflict.concat(), rid = this.conflictRegion;
        console.log(stime(this, `.${this.state.Aname}[${rid}]`));
        panels.forEach(panel => panel.enablePlagueBid(rid));
      },
      done: (p: PlayerPanel) => {
        const panels = this.state.panels;
        const ndx = panels.indexOf(p);
        panels.splice(ndx, 1);
        if (panels.length !== 0) return; // waiting for other panels to make their bid.
        this.phase('PlagueResolution');
      }

      // mouse enable plague big counters (max value: player.coins)
      // on Done --> process result: remove meeples, (process mummy cat, etc)
      // phase Monuments
    },
    PlagueResolution:{
      panels: [],
      start: () => {
        this.plagueDeadFigs = this.resolvePlague();
        this.phase(!this.hathorSummon ? 'ScoreMonuments' : 'HathorSummon', 'ScoreMonuments');
      },
    },

    ScoreMonuments: {
      // score Monuments in conflictRegion; incr Player.devotion (score);
      start: () => {
        // console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        this.scoreMonuments(false);
        this.phase('BattleResolution')
      },
    },
    BattleResolution: {
      panels: [],
      start: () => {
        const rid = this.conflictRegion;
        // all those who have played a Battle card for this region:
        const panels0 = this.panelsInThisConflict.concat();
        const panels = panels0.concat();
        this.table.logText(`${this.state.Aname}[${rid}]`);
        // After Plague, nFigsInRegion may be 0!
        panels.forEach(panel => panel.strength = panel.strengthInRegion(rid));
        panels.sort((a, b) => b.strength - a.strength);
        panels.forEach(panel => this.table.logText(`Battle[${rid}] ${json(panel.reasons)}`))

        const d = panels[0].strength - (panels[1]?.strength ?? 0) // after Plague, only one Player...
        let winner = (d > 0) ? panels[0] : undefined;
        const resolution = () => {
          if (winner) {
            const winPlyr = winner.player, powers = winPlyr.god.ankhPowers;
            if (powers.includes('Commanding')) this.addFollowers(winPlyr, 3, `Commanding[${rid}]`);
            let dev = 0, reasons = '';
            const devReason = (n, reason: string) => { dev += n, reasons = `${reasons} ${reason}:${n}` }
            devReason(1, 'Win');
            if (winner.hasCardInBattle('Drought')) {
              const inDesert = winner.figuresInRegion(rid, winPlyr).filter(fig => fig.hex.terrain === 'd').length;
              devReason(inDesert, 'Drought');
            }
            if (powers.includes('Glorious') && d >= 3) devReason(3, 'Glorious');
            if (this.hasRadiance(winner)) devReason(1, `Radiance`);
            this.table.logText(`Battle[${rid}]: ${winner.name} Wins! {${reasons.slice(1)}}`); //slice initial SPACE
            this.addDevotion(winPlyr, dev, `Battle[${rid}]:${dev}`);
            panels.splice(0, 1); // remove winner, panels now has all the losers.
          }

          // ----------- After Battle Resolution: panels contains losers --------------
          // no need to re-sort: only winner has changed score [?]
          panels.forEach(panel => {
            if (panel.hasAnkhPower('Magnanimous') && panel.nFigsInBattle >= 2) {
              this.addDevotion(panel.player, 2, `Magnanimous[${rid}]:2`);
            }
          });

          const battleDeadFigs = this.deadFigs('Battle', winner?.player.god, rid, true);
          // Resolve Miracle cards:
          panels0.filter(panel => panel.hasCardInBattle('Miracle')).forEach(panel => {
            const player = panel.player, ofPlayer = (fig: Figure) => fig.lastController === player.god;
            const nPlague = this.plagueDeadFigs.filter(ofPlayer).length;
            const nBattle = battleDeadFigs.filter(ofPlayer).length;
            const nKilled = nPlague + nBattle;
            if (nKilled > 0) this.addDevotion(player, nKilled, `Miracle - Plague:${nPlague} Battle:${nBattle}`);
          })
          this.phase(panels.includes(Osiris.instance?.panel) ? 'Osiris' : 'Worshipful');
        }

        if (d == 0) {          // consider tiebreaker;
          const curPanel = this.panel;
          const contenders = panels.filter(panel => panel.strength === panels[0].strength);
          if (contenders.includes(curPanel) && curPanel.canUseTiebreaker) {
            const ndx = panels.indexOf(curPanel);
            panels[ndx] = panels[0];
            panels[0] = curPanel;   // move curPanel to [0]; the slot for a winner
            curPanel.areYouSure(`Use tiebreaker to win?`,
              () => {
                winner = curPanel;
                this.table.logText(`${winner.name} uses tiebreaker: +1 strength`)
                console.log(stime(this, `Battle[${rid}]: ${winner.name} uses tiebreaker (${d})`));
                curPanel.canUseTiebreaker = false;
                resolution();
              },
              () => {
                resolution();
              })
          } else {
            resolution();
          }
        } else {
          resolution();
        }
      },
    },
    Osiris: {
      start: () => {
        // isLegalTarget marks empty hexes in conflictRegion
        Osiris.instance.highlight(true);   // highlight Portal tiles.
        this.doneButton('Place Portal', Osiris.instance.color);
      },
      done: () => {
        Osiris.instance.highlight(false);  // un-highlight Portal tiles.
        this.doneButton();  // Osiris: Portal done
        this.phase('Worshipful');
      }
    },
    Worshipful: {
      panels: [],
      start: () => {
        const panels0 = this.panelsInThisConflict.concat();
        // ASSERT: panels0 is [still] sorted by player rank.
        this.state.panels = panels0.filter(panel => panel.hasAnkhPower('Worshipful') && panel.player.coins >= 2);
        this.done();
      },
      done: (panel: PlayerPanel) => {
        const panels = this.state.panels, rid = this.conflictRegion;
        if (panel) {
          const ndx = panels.indexOf(panel);
          panels.splice(ndx, 1);
        }
        if (panels.length === 0) {
          this.phase(!this.hathorSummon ? 'ConflictRegionDone' : 'HathorSummon', 'ConflictRegionDone');
          return;
        }
        const panel0 = panels[0];
        panel0.areYouSure('Sacrifice 2 for Worshipful?', () => {
          this.addFollowers(panel0.player, -2, `Worshipful[${rid}]`); // assume yes: they want Devotion
          this.addDevotion(panel0.player, 1, `Worshipful[${rid}]:1`);
          this.done(panel0);
        }, () => { this.done(panel0) })
      }
    },
    ConflictRegionDone: {
      start: () => {
        this.horusInRegion(this.conflictRegion)?.sendHome();
        this.bannedCard = undefined;
        // battle cards go to table:
        const panels0 = this.table.panelsInRank.filter(panel => panel.cardsInBattle.length > 0)
        panels0.forEach(panel => panel.battleCardsToTable());
        panels0.forEach(panel => panel.cycleWasPlayed && panel.allCardsToHand());
        this.phase('ConflictNextRegion');
      }
    },
    ConflictDone: {
      start: () => {
        this.conflictRegion = undefined;
        this.highlightRegions(false);
        Amun.instance?.setTokenFaceUp(true); // reset 'Two Cards' token.
        this.phase(!this.bastetPlayer ? 'EventDone' : 'BastetDeploy', 'EventDone');
      },
      // TODO: coins from Scales to Toth, add Devotion(Scales)
    },
    EventDone: {
      start: () => {
        const special = this.eventSpecial;
        console.log(stime(this, `.EventDone: ${this.eventName} ${special ? `--> ${special}` : ''}`));
        this.eventName = this.eventSpecial = undefined;
        if (special === 'merge') { this.doMerge('EndTurn') }
        else if (special === 'redzone') { this.doRedzone('EndTurn') }
        else { this.phase('EndTurn') };
      },
    },
    EndTurn: {
      start: () => {
        this.selectedAction = undefined;
        this.selectedActions.length = 0;
        this.gamePlay.endTurn();
        this.phase('BeginTurn');
      },
    },
    /** Hathor: after addFollowers() Ankh-Event, BuildMonument, Worshipful, Summon-AnubisRansom */
    HathorSummon: {
      start: (nextPhase: string | (() => void)) => {
        const hathor = Hathor.instance, hathorFigs = () => this.gamePlay.hexMap.hexAry.filter(hex => hex.figure && hathor.isGodOf(hex.figure.player)).length;
        const nFigsOnMap0 = hathorFigs();
        if (!nextPhase) debugger;
        const next = (typeof nextPhase === 'function') ? nextPhase : () => this.phase(nextPhase);
        const highlights = hathor.panel.highlightStable(true);
        this.state.done = () => {
          highlights.forEach(fig => (fig.highlight(false), fig.faceUp(true)));
          const nFigsOnMap1 = hathorFigs();
          if (nFigsOnMap1 > nFigsOnMap0) this.addFollowers(hathor.player, -1, `to Summon the Figure`);
          this.hathorSummon = undefined;
          next();
        }

        this.doneButton('Hathor Summon', Hathor.instance.player.color);
      },
      done: () => {
        // dyna-set above with highlights & nextPhase
      },
    },
  };

  setup() {

  }
  // if (winner === undefined): all non-GodFigure are at risk.
  deadFigs(cause: string, winner: God | undefined, rid: RegionId, isBattle = true) {
    const floodProtected = (fig: Figure, player: Player,) => player.panel.hasCardInBattle('Flood') && (fig.hex.terrain === 'f');
    const region = this.gamePlay.hexMap.regions[rid - 1];
    const figsInRegion = region.filter(hex => hex?.figure).map(hex => hex.figure);
    const deadFigs0 = figsInRegion.filter(fig => !(fig instanceof GodFigure) && !(fig.controller === winner));
    const deadFigs1 = isBattle ? deadFigs0.filter(fig => !Isis.instance?.isProtected(fig)) : deadFigs0;
    const deadFigs = isBattle ? deadFigs1.filter(fig => !floodProtected(fig, fig.controller.player)) : deadFigs1;
    this.table.logText(`${cause}[${rid}] killed: ${deadFigs}`);
    this.filterAnubisTrap(deadFigs).forEach(fig => fig.sendHome()); // they all died; some are not sentHome.
    return deadFigs;
  }

  filterAnubisTrap(deadFigs: Figure[]) {
    const anubis = Anubis.instance;
    const trappedFigs = [];
    return deadFigs.filter(fig => {
      const slot = anubis?.emptySlot();
      if (!!slot && (fig instanceof Warrior) && (fig.player.godName !== 'Anubis') && !trappedFigs.find(af => af.player === fig.player)) {
        trappedFigs.push(fig);              // prevent 2nd Figure from same player.
        fig.moveTo(slot);
        fig.removeRaMarker();
        return false;
      } else {
        return true;
      }
    });
  }

  plagueDeadFigs: Figure[] = [];
  resolvePlague() {
    const panels = this.panelsInThisConflict.concat(), rid = this.conflictRegion;
    const plaguePanels = panels.filter(panel => panel.hasCardInBattle('Plague')), nToGo = plaguePanels.length;
    console.log(stime(this, `.${this.state.Aname}[${rid}]-${nToGo}`), panels);
    panels.forEach(panel => panel.showCardSelector(false, ''));
    const bids = panels.map(panel => panel.plagueBid);
    panels.forEach(panel => {
      const bid = panel.plagueBid;
      panel.player.coins += bid;
      this.addFollowers(panel.player, -bid, `for Plague`, 'sacrifices'); // may set this.hathorSummons !
    })
    panels.sort((a, b) => b.plagueBid - a.plagueBid);
    const [b0, b1] = [panels[0].plagueBid, panels[1].plagueBid]; // Battle, not Dominance
    const isWinner = (b0 > b1);
    const winner = isWinner ? panels[0].player.god : undefined;
    this.table.logText(`Plague[${rid}]-${nToGo} ${winner?.Aname ?? 'Nobody'} survives! [${bids}]`)
    return this.deadFigs('Plague', winner, rid, false);
  }

  monumentsOfPlayer(player = this.curPlayer) {
    player = player.god.uberGod?.player ?? player;
    const montsOnMap = this.gamePlay.allTiles.filter(tile => (tile.hex?.isOnMap) && (tile instanceof Monument));
    const monts =  montsOnMap.filter(mont => (mont.player === player || mont.player === undefined)) as Monument[];
    return monts;
  }

  countCurrentGain(player = this.curPlayer) {
    const monts = this.monumentsOfPlayer(player);
    const adjPlayer = monts.filter(mont => mont.hex.findAdjHexByRegion(hex => hex.figure?.player === player));
    const n = adjPlayer.length + (player.god.ankhPowers.includes('Revered') ? 1 : 0);
    return n
  }

  gainFollowersAction() {
    const player = this.curPlayer;
    const n = this.countCurrentGain(player);
    const revered = player.god.ankhPowers.includes('Revered') ? ' (Revered)' : '';
    this.addFollowers(player, n, `Gain Followers action${revered}`);
  }

  addFollowers(player: Player, n: number, reason?: string, verb0 = 'gains') {
    player.coins += n;
    const verb = (n >= 0) ? verb0 : 'sacrifices';
    const noun = (n == 1) ? 'Follower' : 'Followers';
    this.gamePlay.logText(`${player.god.name} ${verb} ${Math.abs(n)} ${noun}: ${reason}`);
    if (n < 0 && Hathor.instance?.isGodOf(player)) {
      player.panel.highlightStable(true);
    }
    this.hathorSummon = (Hathor.instance?.isGodOf(player)) && (n < 0) && (player.coins > 0) ? player : undefined;
  }
  // TODO: check that plague kills mummy before battle resolution (so can be in Drought or adj-Temple)
  // after Ankh(Event), (BuildMonument)BuildMonument, (Worshipful)Worshipful, (Summon)AnubisRansom
  /** Hathor.player when Hathor gets a free Summon (due to sacrificing a Follower) */
  hathorSummon: Player = undefined;

  addDevotion(player: Player, n: number, reason?: string) {
    const score0 = player.score;
    if (n > 0 && player.god.ankhPowers.includes('Bountiful') && player.score <= TP.inRedzone) {
      n += 1; reason = `${reason ?? ''} Bountiful:1`
    }
    player.score = Math.max(0, score0 + n);
    const score = Math.floor(player.score), dscore = player.score - score0; // n or 0
    this.gamePlay.logText(`${player.god.name} ${n >= 0 ? 'gains' : 'loses'} ${Math.abs(dscore)} Devotion: ${reason} [${score}]`);
    if ((player.score) === 31) this.gamePlay.logText(`-------- Game Over: ${player.god.name} WINS! -------`);
  }

  hasRadiance(panel: PlayerPanel) {
    const raGod = Ra.instance;
    return raGod && panel.figuresInRegion(this.conflictRegion, panel.player).find(fig => raGod.isRadiant(fig));
  }

  horusInRegion(rid: RegionId) {
    return Horus.instance?.getRegionId(rid);
  }

  static typeNames = ['Obelisk', 'Pyramid', 'Temple'];
  /** score each monument type in conflictRegion */
  scoreMonuments(dom = false) {
    const rid = this.conflictRegion, regionNdx = rid - 1, logInfo = false;
    const allPlayers = this.gamePlay.allPlayers;
    const players = this.panelsInConflict.map(panel => panel.player);
    // console.log(stime(this, `.scoreMonuments[${rid}]`), players);
    const hexes = this.gamePlay.hexMap.regions[regionNdx].filter(hex => (hex.tile instanceof Monument) && hex.tile.player);
    const tiles = hexes.map(hex => hex.tile);
    const types = GameState.typeNames;
    const countsOfTypeByPlayer = types.map(type => allPlayers.map(player => ({type, player, n: 0})));// [[{p, n:0},,0,0...], [0,0,0,0...], [0,0,0...]]
    tiles.forEach((tile, n) => countsOfTypeByPlayer[types.indexOf(tile.name)][tile.player.index].n += 1);
    // [{ n: p1nOb, p: p1 }, { n: p2nOb, p: p2 }, { n: p3nOb, p: p3 }], [p1nPy, p2nPy, p3nPy], [p1nTe, p2nTn, p3nTe]]
    const sortedCount = countsOfTypeByPlayer.map(pnary => pnary.sort((a, b) => b.n - a.n));
    // reduce to elment[0]
    const deltas = sortedCount.map(pnary => ({t: pnary[0].type, p: pnary[0].player, n: pnary[0].n, d: (pnary[0].n - (pnary[1] ? pnary[1].n : 0)) }));
    const winners = deltas.map(({ p, n, d, t }) => ({ p: ((n > 0 && d > 0) ? p : undefined), n, d, t }));
    winners.forEach(({ p, n, d, t }) => {
      logInfo && console.log(stime(this, `.scoreMonuments[${rid}]: ${t} -> ${p?.godName}, d=${d}, n=${n}`));
    })
    const winp = players.filter(player => winners.find(({ p }) => p === player));
    const winnerp = winp.map(p => winners.filter(elt => elt.p === p)); // monuments won by player
    const rfun = (pv, { p, n, d, t }) => ({ p, n, d, t: `${pv?.t ?? ''} ${t}:1` });
    const winsum = winnerp.map(winpary => winpary.reduce(rfun, {}))
    winsum.forEach(({ p, n, d, t }) => {
      const t1 = t.slice(1); // one leading space.
      const dev = t1.split(' ').length
      this.addDevotion(p, dev, `${t1}`);
    })
    return;
  }

  doMerge(nextPhase: string) {
    // find bottom player & second to bottom
    // remove Warriors, Monuments, of bottom; GodFigure.moveTo(undefined)
    // set score of second to bottom;
    // set bottom.uberGod = second; second.unterGod = bottom
    // resolve Guardians (may need to open second stableHex for rank==1), setPlayerAndColor.
    const panels = this.table.panelsInRank;
    const bottom = panels[0], second = panels[1], bp = bottom.player, sp = second.player;
    bottom.warriorSource.filterUnits(unit => (unit.sendHome(), false)); // remove Warriors from board
    this.gamePlay.hexMap.forEachHex(hex => (hex.tile instanceof Monument) && hex.tile.player === bp && hex.tile.sendHome())
    bp.god.figure.moveTo(undefined);
    bp.god.figure.visible = false;
    this.table.logText(`MergeGods: ${bp.god.name}[${bp.score}] under ${sp.god.name}[${sp.score}]`);
    this.addFollowers(sp, bp.coins, `from merge with ${bp.godName}`);
    bp.coins = 0;
    const dd = Math.floor(bp.score) - Math.floor(sp.score);
    // no change if 3 or 4 'tied' in last place:
    if (sp.score !== bp.score + .1) this.addDevotion(sp, dd, `from merge with ${bp.godName}`);
    sp.score = bp.score;
    sp.god.unterGod = bp.god;
    bp.god.uberGod = sp.god;
    // TODO: adjust AnkhPowers to match uberGod
    bottom.setAnkhPowers(second.god.ankhPowers);
    // mergeGuardians: Select up to 2 of each size of Guardians:
    const guards = second.stableHexes.map(shex => shex.usedBy).filter(guard => !!guard);
    bottom.stableHexes.forEach(shex => {
      const guard = shex.usedBy;
      if (guard) {
        guard.setPlayerAndPaint(second.player); // all your guards are belong to us...
        guards.push(guard);
      }
    })
    const g1 = guards.filter(g => g.radius === TP.ankh1Rad); // length = [0..2]
    const g2 = guards.filter(g => g.radius === TP.ankh2Rad); // length = [0..4]
    // TODO: enforce that uberGod *must* keep their Guardians, and then add from unterGod
    const keepThese = (base = 1, ...guards: Guardian[]) => {
      guards.forEach((guard, ndx) => {
        const stableHex = second.stableHexes[ndx === 1 && base === 1 ? 4 : base + ndx];
        stableHex.usedBy = guard;
        guard.homeHex = stableHex;
        if (guard.hex.isStableHex()) {
          guard.source.takeUnit(); // remove from
          guard.moveTo(stableHex); // to new/correct StableHex
        }
        this.table.logText(`${sp.god.name} keeps ${guard}`);
      })
      if (base === 2) {
        g2.forEach(guard => {
          if (!second.stableHexes.find(shex => shex.usedBy === guard)) {
            guard.setPlayerAndPaint(undefined);
            guard.sendHome();
            this.table.logText(`${sp.god.name} releases ${guard}`);
          }
        })
        this.phase(nextPhase);
      }
    }
    if (g1.length > 1) {
      // assert: (g1.length === 2)
      second.makeAuxStable();  // open new stableHex on second:
    }
    keepThese(1, ...g1);

    if (g2.length > 2) {
      g2.sort((a, b) => a.radius - b.radius); // ascending order
      const oneEach = [g2[0], g2[2]], names = oneEach.map(g => g.Aname);
      // offer choice: 2*rank2, 2*rank3, 1*rank2 + 1*rank3
      const oneOfEach = () => keepThese(2, ...oneEach);
      const twoOfSame = () => {
        if (g2.length === 3) {
          const keep = g2.filter(g => g.radius === g[1].radius)
          keepThese(2, ...keep);
        } else {
          const rank2 = () => keepThese(2, g2[0], g2[1]);
          const rank3 = () => keepThese(2, g2[2], g2[3]);
          second.areYouSure(`Keep rank2 ${g2[1].Aname} (or rank3 ${g2[2].Aname})`, rank2, rank3);
        }
      }
      if (g2[1].radius !== g2[2].radius) {
        second.areYouSure(`Keep one of each [${names}] (or two of the same)`, oneOfEach, twoOfSame);
      }
    } else {
      keepThese(2, ...g2);
    }
  }

  doRedzone(nextPhase: string) {

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
