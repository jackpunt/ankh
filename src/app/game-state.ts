import { GamePlay, GP } from "./game-play";
import { stime } from "@thegraid/common-lib";
import { UtilButton } from "./shapes";

interface Phase {
  Aname?: string,
  start(): void;           // what to do in this phase
  done?: () => void;       // for async; when done clicked: proceed
}

export class GameState {
  constructor(public gamePlay: GamePlay) {
    Object.keys(this.states).forEach((key) => this.states[key].Aname = key);
  }

  state: Phase;
  get table() { return this.gamePlay?.table; }
  get actionIsEvent() { return this.gamePlay.actionIsEvent; }
  get selectedAction() { return this.gamePlay.selectedAction; }
  set selectedAction(val) { this.gamePlay.selectedAction = val; }
  doneButton: UtilButton;

  actionsDone = 0;
  bastetEnabled = false;
  chooseAction(val = 0) {
    this.actionsDone = val;
    return 'ChooseAction';
  }
  isEvent(action: string) {
    const panel = this.table.actionPanels[action];
    return panel.children.find(b => b['isEvent'] ?? false);
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

  /** invoked when 'Done' button clicked. [or otherwise we determine phase is done] */
  done() {
    console.log(stime(this, `.done: ${this.state.Aname}`), this.state);
    this.state.done();
  }

  readonly states: { [index: string]: Phase } = {
    BeginTurn: {
      start: () => {
        this.bastetEnabled = !!this.findGod('Bastet');
        this.selectedAction = undefined;
        this.actionsDone = 0;
        this.phase('ChooseAction');
      },
    },
    ChooseAction: {
      start: () => {
        if (this.bastetEnabled) {
          /* enable 'Cats' button; onClick --> phase('Bastet') */
        }
        if (this.actionsDone >= 2) this.phase('EndTurn')
        // enable and highlight open spots on Action Panel
        const active = this.table.activateActionSelect(true, this.selectedAction);
        if (!active) this.phase('EndTurn');
        this.doneButton.visible = this.doneButton.mouseEnabled = true;
      },
      done: () => {
        const action = this.gamePlay.selectedAction;
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
      // mouse enable moveable Meeples; (faceUp all Figures onMap)
      // onClick/dragStart: mark legal hexes
      // onDrop: meep.moveTo(hex)
      },
      done: () => { this.phase('EndAction') },
    },
    Summon: {
      start: () => { },
      // mouse enable summonable Meeples (Stable)
      // Mark legal hexes
      // Drag & Drop;
      done: () => { this.phase('EndAction') },
    },
    Gain: {
      start: () => { },
      // curPlayer.coins += filterHex( adjToMeep(curPlayer) ).length
      done: () => { this.phase('EndAction') },
    },
    Ankh: {
      start: () => {
        const ndx = this.gamePlay.curPlayerNdx;
        const panel = this.gamePlay.table.panelForPlayer[ndx];
        panel.activateSelectAnkhPower();
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
        if (!!this.actionIsEvent) this.phase('Event');
        this.phase('ChooseAction');
      },
    },
    Event: {
      start: () => {
        console.log(stime(this, `.Event: ${this.actionIsEvent}`));
        this.phase(this.actionIsEvent);
      },
    },
    EventDone: {
      start: () => {

      },
      // phase(EndTurn)
    },
    Split: {
      start: () => { },
      // mouse enable edges (of land tiles)
      // disable edges of hexes in region of < 12 hexes!
      // click each edge! to light
      // validate(<= 6 selected; from board/water to board/water; 6 hexes per region )
      // click Done(assign number, phase(Swap))
    },
    Swap: {
      start: () => { }, // after Split
      // mark startRegion of each marker
      // mouse enable all region markers
      // dragStart: mark legal (either of 2 split regions that contain new/old markers)
      // click Done(phase(EventDone))
    },
    Claim: {
      start: () => { },
      // x = isUnclaimedMonument() ?
      // mouse enable Hex; with (x ? unclaimed : any monument) and adj(curPlayer))
      // click: unmark & remark
      // Done(phase(EventDone))
    },
    Conflict: {
      start: () => { },
      // process Omnipresent
      // process TeleportToTemple (for each player!)
      // phase(Horus ? Horus : ConflictRegions)
    },
    Horus: {
      start: () => { },
      // place enable Eyes, drag to each Region (to Region index marker...)
      // Done(phase(ConflictEachRegion))
    },
    ConflictEachRegion: {
      start: () => { },
      // region = region ? ++region  : 1;
      // if (region > nRegions) phase(ConflictDone)
      // phase(ConflictInRegion)
    },
    ConflictInRegion: {
      start: () => { },
      // process Obelisk-attuned!
      // phase(Card);
    },
    Card: {
      start: () => { }, // for battleRegion
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
      start: () => { },
      // "reveal" all cards; (YELLOW)
      // trigger Flood
      // phase Build
    },
    Build: {
      start: () => { }, // for battleRegion
      // for each build card in player-score order:
      // mouse enable empty hex in region & monument sources (obelisk, temple, pyramid)
      // drag & drop: place monument, set owner
      // allow unMove
      // click Done: phase Plague
    },
    Plague: {
      start: () => { },
      // mouse enable plague big counters (max value: player.coins)
      // on Done --> process result: remove meeples, (process mummy cat, etc)
      // phase Monuments
    },
    Monuments: {
      start: () => { },
      // count valueInRegion[type][player] (for curRegion)
      // for each type(incl strength): valueInRegion[type] = 0;
      // forEachHex(in region, with claimed Monument: incr playerCount, record Max/Tie)
      // note: claimed Temple may incr strength, account for Set effect, etc.
      // assign Devotion (Monuments)
      // phase: BattleResolution
    },
    BattleResolution: {
      start: () => { },
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
}
