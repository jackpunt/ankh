import { C, stime } from "@thegraid/common-lib";
import { Figure, GodFigure, Monument, Obelisk, Portal, Scorpion, Warrior } from "./ankh-figure";
import { AnkhHex, RegionId } from "./ankh-map";
import type { ActionIdent } from "./ankh-scenario";
import { AnkhMapSplitter } from "./ankhmap-splitter";
import { json } from "./functions";
import type { GamePlay } from "./game-play";
import { God } from "./god";
import { Hex1 } from "./hex";
import type { Player } from "./player";
import type { PlayerPanel, PowerLine } from "./player-panel";
import { HexShape, PaintableShape } from "./shapes";
import { DragContext, EventName } from "./table";
import { TP } from "./table-params";
import { Tile } from "./tile";

interface Phase {
  Aname?: string,
  start(...args: any[]): void; // what to do in this phase
  done?: (...args: any[]) => void;          // for async; when done clicked: proceed
  undo?: () => void;
  region?: number,
  panels?: PlayerPanel[],
  players?: Player[],
  deadFigs?: Figure[], // for Plague
}

export class GameState {

  constructor(public gamePlay: GamePlay) {
    Object.keys(this.states).forEach((key) => this.states[key].Aname = key);
  }
  _ankhMapSplitter: AnkhMapSplitter;
  get ankhMapSplitter() { return this._ankhMapSplitter ?? (this._ankhMapSplitter = new AnkhMapSplitter(this)) }

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
  conflictRegion: RegionId = undefined;

  get panelsInConflict() {
    return this.table.panelsInRank.filter(panel => panel.isPlayerInRegion((this.conflictRegion ?? 0) - 1));
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

  phase(phase: string, ...args: any[]) {
    console.log(stime(this, `.phase: ${this.state?.Aname ?? 'BeginGame'} -> ${phase}`));
    this.state = this.states[phase];
    this.state.start(...args);
  }

  /** set label & paint button with color;
   * empty label hides & disables.
   * optional continuation function on 'drawend'.
   */
  doneButton(label?: string, color = this.gamePlay.curPlayer.color, afterUpdate: ((evt?: Object, ...args: any[]) => void) = undefined) {
    const doneButton = this.table.doneButton;
    doneButton.visible = true;
    doneButton.label.text = label;
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
        // console.log(stime(this, `.Event: ${this.eventName}`));
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
        // overlay is HexShape child of hex.cont; on mapCont.hexCont;
        this.ankhMapSplitter.runSplitShape();
        this.doneButton();
      },
      done: () => {
        this.phase('Swap');
      },
      // disable edges of hexes in region of < 12 hexes!
    },
    Swap: {
      start: () => {
        console.log(stime(this, `Swap:`));
        this.ankhMapSplitter.runSwap();
        // TODO: no Button until 'finalize'
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
        const done = () => this.phase('EventDone');
        const ankhToken = this.panel.ankhSource.sourceHexUnit; //takeUnit();
        if (ankhToken?.nClaimableMonuments(this.panel.player) > 0) {
          this.panel.ankhSource.sourceHexUnit.highlight(true, C.BLACK);
          this.table.dragger.dragTarget(ankhToken, { x: 8, y: 8 });
          this.doneButton('Claim done');
        } else if (ankhToken) {
          this.panel.areYouSure(`No monuments to Claim.`, done);
        } else {
          this.panel.areYouSure(`No Ankh Tokens for claim.`, done);
        }
      },
      done: (hex: AnkhHex) => {
        this.table.logText(`${this.gamePlay.curPlayer.godName} Claimed ${hex}`)
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
        const scorps = Scorpion.source.filterUnits(scorp => scorp.hex?.isOnMap);
        scorps.forEach(scorp => {
          const monts = scorp.attackMonuments;
          if (monts.length > 0) {
            this.table.logText(`${scorp.Aname} kills ${monts}`); // show Aname@Hex[...] before sendHome()
            monts.forEach(mont => mont.sendHome());
          }
        });

        this.phase('ConflictNextRegion', 1);
      },
      // process Scorpion
      // process Omnipresent
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
        setTimeout(() => this.phase(isRegion ? 'ConflictInRegion' : 'ConflictDone'), 1000);
      },
    },
    ConflictInRegion: {
      panels: [],
      start: () => {
        const panels = this.panelsInThisConflict = this.panelsInConflict;  // original players; before plague, Set, or whatever.
        this.table.logText(`.${this.state.Aname}[${this.conflictRegion}] ${panels.map(panel=>panel.player.godName)}`);

        if (panels.length > 1) this.phase('Obelisks'); // begin 'Battle': check for Obelisk
        else if (panels.length === 0) this.phase('ConflictNextRegion'); // no points for anyone.
        else if (panels.length === 1) this.phase('Dominate', panels[0]);   // no battle
      }
    },
    Dominate: {
      start: (panel: PlayerPanel) => {
        let dev = 0, reasons = '';
        const devReason = (n, reason: string) => { dev += n, reasons = `${reasons} ${reason}:${n}` }
        this.table.logText(`.${this.state.Aname}[${this.conflictRegion}] Player-${panel.player.index}`);
        this.scoreMonuments(true); // Monument majorities (for sole player in region)
        devReason(1, `Dominate[${this.conflictRegion}]`)
        if (this.hasRadiance(panel)) devReason(1, 'Radiance');
        this.addDevotion(panel.player, dev, reasons);
        this.phase('ConflictNextRegion');
      }
    },
    Obelisks: {
      panels: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        const panels0 = this.panelsInConflict.filter(panel => panel.hasAnkhPower('Obelisk'));
        const region = this.gamePlay.hexMap.regions[this.conflictRegion - 1];
        const panels = panels0.filter(p => region.find(hex => hex.tile instanceof Obelisk && hex.tile.player === p.player))
        // enable on-panel 'Obelisk done' button => phaseDone(panel);
        if (panels.length === 0) { this.phase('Card'); return; }
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}] panels =`), panels);
        this.state.panels = panels;
        panels[0].enableObeliskTeleport(this.conflictRegion);
        //panels.forEach(panel => panel.enableObeliskTeleport(this.conflictRegion));
      },
      done: (p: PlayerPanel) => {
        const panels = this.state.panels;
        const ndx = panels.indexOf(p); // ndx === 0!
        panels.splice(ndx, 1);  // or rig it up to use Promise/PromiseAll
        if (panels.length === 0) { this.phase('Card'); return; }
        panels[0].enableObeliskTeleport(this.conflictRegion);
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
        if (ndx < 0) return;    // ignore extra doneification.
        if (panel.cardsInBattle.length === 0) return; // must select a Card.
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
        panels.forEach(panel => {
          panel.revealCards(true);
          if (panel.cardsInBattle.length === 2) panel.player.god.doSpecial(false); // must be Amun
        });
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
          (t = panel.hasCardInBattle('Build'), buildPanels.push(t), t) && (panel.canAffordMonument));
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
      done: (panel: PlayerPanel = this.state.panels[0], monument: Monument) => {
          this.table.logText(`${panel.player.godName} built Monument: ${monument.hex.toString()}`);
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
        // console.log(stime(this, `Build.done: return NOT done...`))
        this.table.monumentSources.forEach(ms => ms.sourceHexUnit.paint(panels[0].player.color));
        this.doneButton('Build Done', panels[0].player.color);
        // TODO: at ConflictDone, mark yellow cards green, and check reclaimCards (Cycle of Ma`at)
      }
    },
    Plague: {
      panels: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        const panels = this.state.panels = this.panelsInConflict;
        const hasPlague = panels.filter(panel => panel.hasCardInBattle('Plague'));
        if (hasPlague.length === 0) { this.phase('ScoreMonuments'); return; }
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
      deadFigs: [],
      start: () => {
        console.log(stime(this, `.${this.state.Aname}[${this.conflictRegion}]`));
        const panels = this.state.panels = this.panelsInConflict, rid = this.conflictRegion;
        panels.forEach(panel => panel.showCardSelector(false, ''));
        panels.sort((a, b) => b.plagueBid - a.plagueBid);
        const [b0, b1] = [panels[0].plagueBid, panels[1].plagueBid]
        const isWinner = (b0 > b1);
        const winner = isWinner ? panels[0].player.god : undefined;
        this.table.logText(`Plague[${rid}] ${winner.Aname ?? 'Nobody'} survives! [${b0}]`)
        this.state.deadFigs = this.deadFigs('Plague', winner, rid, false);
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
        const rid = this.conflictRegion;
        // all those who have played a Battle card for this region:
        const panels0 = this.table.panelsInRank.filter(panel => panel.cardsInBattle.length > 0)
        const panels = panels0.concat();
        this.table.logText(`${this.state.Aname}[${rid}]`);
        if (panels.length === 0) {
          // wtf? plague killed the all?
          this.table.logText(`Battle[${rid}]: no Figures in Battle[${rid}]`);
          this.phase('ConflictNextRegion'); return;
        }
        panels.forEach(panel => panel.strength = panel.strengthInRegion(rid - 1));
        panels.sort((a, b) => b.strength - a.strength);
        panels.forEach(panel => this.table.logText(`Battle[${rid}] ${json(panel.reasons)}`))

        const d = panels[0].strength - (panels[1]?.strength ?? 0) // after Plague, only one Player...
        let winner = (d > 0) ? panels[0] : undefined;
        if (d == 0) {          // consider tiebreaker;
          const curPanel = this.gamePlay.curPlayer.panel;
          const contenders = panels.filter(panel => panel.strength === panels[0].strength);
          // TODO: offer curPanel a choice, mark choice used.
          if (contenders.includes(curPanel)) {
            winner = curPanel;
            console.log(stime(this, `Battle[${rid}]: ${winner.name} uses tiebreaker (${d})`));
            curPanel.canUseTiebreaker = false
          }
        }
        if (winner) {
          const winPlyr = winner.player, powers = winPlyr.god.ankhPowers;
          if (powers.includes('Commanding')) this.addFollowers(winPlyr, 3, `Commanding[${rid}]`);
          let dev = 0, reasons = '';
          const devReason = (n, reason: string) => {dev += n, reasons = `${reasons} ${reason}:${n}`}
          devReason(1, 'Win');
          if (winner.hasCardInBattle('Drought')) {
            const inDesert = winner.figuresInRegion(rid, winPlyr).filter(fig => fig.hex.terrain === 'd').length;
            devReason(inDesert, 'Drought');
          }
          if (powers.includes('Glorious') && d >= 3) devReason(3, 'Glorious');
          if (powers.includes('Worshipful') && winPlyr.coins >= 2) (winPlyr.coins -= 2, devReason(1, 'Worshipful')); // assume yes, they want the point.
          if (this.hasRadiance(winner)) devReason(1, `Radiance`);
          this.table.logText(`Battle[${rid}]: ${winner.name} Wins! {${reasons.slice(1)}}`); //slice initial SPACE
          this.addDevotion(winPlyr, dev, `Battle[${rid}]:${dev}`);
          panels.splice(0, 1); // remove winner, panels now has all the losers.
        }

        const deadFigs = this.deadFigs('Battle', winner?.player.god, rid, true);

        // ----------- After Battle Resolution: panels contains losers --------------

        panels.forEach(panel => {
          if (panel.hasAnkhPower('Magnanimous') && panel.nFigsInBattle >= 2) {
            this.addDevotion(panel.player, 2, `Magnanimous[${rid}]:2`);
          }
        });

        // Resolve Miracle cards:
        panels0.filter(panel => panel.hasCardInBattle('Miracle')).forEach(panel => {
          const player = panel.player, ofPlayer = (fig: Figure) => fig.lastController === player.god;
          const nPlague = this.states['PlagueResolution'].deadFigs.filter(ofPlayer).length;
          const nBattle = deadFigs.filter(ofPlayer).length;
          const nKilled = nPlague + nBattle;
          if (nKilled > 0) this.addDevotion(player, nKilled, `Miracle - Plague:${nPlague} Battle:${nBattle}`);
        })

        // ASSERT: panels0 is [still] sorted by player rank.
        const worships0 = panels0.filter(panel => panel.hasAnkhPower('Workshipful'));
        const workship1 = worships0.filter(panel => panel.player.coins >= 2)
        workship1.forEach(panel => {
          this.addFollowers(panel.player, -2, `Worshipful[${rid}]`);
          this.addDevotion(panel.player, 1, `Worshipful[${rid}]:1`);
        });
        panels0.forEach(panel => panel.battleCardsToTable());
        panels0.forEach(panel => panel.cycleWasPlayed && panel.allCardsToHand());
        // resolve Mummy in deadFigs;
        // resolve Osiris:
        const nextState = panels.find(panel => panel.player.godName === 'Osiris') ? 'Osiris' : 'ConflictNextRegion';
        this.phase(nextState);
      },
    },
    Osiris: {
      start: () => {
        const osiris = God.byName.get('Osiris'); Portal
        // highlight empty cells of conflictRegion
        osiris.doSpecial(true);// highlight Portal tiles.
        this.doneButton('Place Portal', osiris.color);
      },
      done: () => {
        const osiris = God.byName.get('Osiris');
        osiris.doSpecial(false);  // un-highlight Portal tiles.
        this.phase('ConflictNextRegion');
      }
    },
    ConflictDone: {
      start: () => {
        this.conflictRegion = undefined;
        this.highlightRegions(false);
        God.byName.get('Amun')?.doSpecial(true); // reset 'Two Cards' token.
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
  // if (winner === undefined): all non-GodFigure are at risk.
  deadFigs(cause: string, winner: God | undefined, rid: RegionId, isBattle = true) {
    const floodProtected = (fig: Figure, player: Player,) => player.panel.hasCardInBattle('Flood') && (fig.hex.terrain === 'f');
    const isisProtected = (fig: Figure) => (fig.player.godName === 'Isis') && fig.hex.findAdjHex(hex => hex.meep && (hex.meep?.player.godName !== 'Isis'));
    const region = this.gamePlay.hexMap.regions[rid - 1];
    const figsInRegion = region.map(hex => hex?.meep).filter(meep => meep instanceof Figure) as Figure[];
    const deadFigs0 = figsInRegion.filter(fig => !(fig instanceof GodFigure) && !(fig.controller === winner));
    const deadFigs1 = isBattle ? deadFigs0.filter(fig => !isisProtected(fig)) : deadFigs0;
    const deadFigs = isBattle ? deadFigs1.filter(fig => !floodProtected(fig, fig.controller.player)) : deadFigs1;
    this.table.logText(`${cause}[${rid}] killed: ${deadFigs}`);
    const anubis = God.byName.get('Anubis');
    const anubisFigs = [], deadFigs2 = deadFigs.concat();
    deadFigs2.forEach(fig => {
      const slot = anubis?.doSpecial('empty') as AnkhHex;
      if (!!slot && (fig instanceof Warrior) && (fig.player.godName !== 'Anubis') && !anubisFigs.find(af => af.player === fig.player)) {
        this.table.logText(`Anubis traps ${fig} of ${fig.player.godName}`);
        anubisFigs.push(fig);              // prevent 2nd figure from same player.
        fig.moveTo(slot);
      } else {
        fig.sendHome();
      }
    });
    return deadFigs;
  }


  countCurrentGain(player = this.gamePlay.curPlayer) {
    // Osiris Portal begins offMap.
    const allMonts = this.gamePlay.allTiles.filter(tile => (tile instanceof Monument) && (tile.hex?.isOnMap));
    const monts =  allMonts.filter(mont => (mont.player === player || mont.player === undefined)) as Monument[];
    const mine = monts.filter(mont => mont.hex.findAdjHex(hex => hex.meep?.player === player));
    const n = mine.length + (player.god.ankhPowers.includes('Revered') ? 1 : 0);
    return n
  }

  gainFollowersAction() {
    const player = this.gamePlay.curPlayer;
    const n = this.countCurrentGain(player);
    const revered = player.god.ankhPowers.includes('Revered') ? ' (Revered)' : '';
    this.addFollowers(player, n, `Gain Followers action${revered}`);
  }

  addFollowers(player: Player, n: number, reason?: string) {
    player.coins += n;
    const verb = (n >= 0) ? 'gains' : 'sacrifices';
    this.gamePlay.logText(`${player.god.name} ${verb} ${Math.abs(n)} Followers: ${reason}`);
  }

  addDevotion(player: Player, n: number, reason?: string) {
    const score0 = player.score;
    if (n > 0 && player.god.ankhPowers.includes('Bountiful') && player.score <= TP.inRedzone) {
      n += 1; reason = `${reason ?? ''} Bountiful:1`
    }
    player.score = Math.max(0, score0 + n);
    const dscore = player.score - score0; // n or 0
    this.gamePlay.logText(`${player.god.name} ${n >= 0 ? 'gains' : 'loses'} ${Math.abs(dscore)} Devotion: ${reason}`);
  }

  hasRadiance(panel: PlayerPanel) {
    const playerFigs = panel.figuresInRegion(this.conflictRegion, panel.player);
    return playerFigs.find(fig => fig.raMarker !== undefined);
  }

  static typeNames = ['Obelisk', 'Pyramid', 'Temple'];
  /** score each monument type in conflictRegion */
  scoreMonuments(dom = false) {
    const rid = this.conflictRegion, regionNdx = rid - 1;
    const allPlayers = this.gamePlay.allPlayers;
    const players = this.panelsInConflict.map(panel => panel.player);
    console.log(stime(this, `.scoreMonuments[${rid}]`), players);
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
      console.log(stime(this, `.scoreMonuments[${rid}]: ${t} -> Player=${p?.Aname}, d=${d}, n=${n}`));
    })
    const winp = players.filter(player => winners.find(({p})=> p === player));
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
