import { C, Constructor, CycleChoice, DropdownStyle, makeStage, ParamGUI, ParamItem, stime } from "@thegraid/easeljs-lib";
import { Container, Stage } from "@thegraid/easeljs-module";
import { EBC, PidChoice } from "./choosers";
import { GamePlay } from "./game-play";
import { Meeple } from "./meeple";
import { Player } from "./player";
import { Table } from "./table";
import { TP } from "./table-params";
import { Tile } from "./tile";
import { selectN } from "./functions";
import { God } from "./god";
import { Androsphinx, Apep, Guardian, MumCat, Mummy, Satet, Scorpion } from "./ankh-figure";

/** show " R" for " N" */
stime.anno = (obj: string | { constructor: { name: string; }; }) => {
  let stage = obj?.['stage'] || obj?.['table']?.['stage']
  return !!stage ? (!!stage.canvas ? " C" : " R") : " -" as string
}

/** initialize & reset & startup the application/game. */
export class GameSetup {
  stage: Stage;
  gamePlay: GamePlay
  paramGUIs: ParamGUI[]
  netGUI: ParamGUI // paramGUIs[2]

  /**
   * ngAfterViewInit --> start here!
   * @param canvasId supply undefined for 'headless' Stage
   */
  constructor(canvasId: string, ext?: string[], ngods = 4) {
    stime.fmt = "MM-DD kk:mm:ss.SSS"
    this.stage = makeStage(canvasId, false)
    this.stage.snapToPixel = TP.snapToPixel;
    Tile.loader.loadImages(() => this.startup(ext, ngods));
  }
  _netState = " " // or "yes" or "ref"
  set netState(val: string) {
    this._netState = (val == "cnx") ? this._netState : val || " "
    this.gamePlay.ll(2) && console.log(stime(this, `.netState('${val}')->'${this._netState}'`))
    this.netGUI?.selectValue("Network", val)
  }
  get netState() { return this._netState }
  set playerId(val: string) { this.netGUI?.selectValue("PlayerId", val || "     ") }

  /** C-s ==> kill game, start a new one, possibly with new dbp */
  restart(nh = TP.nHexes, mh = TP.mHexes) {
    let netState = this.netState
    // this.gamePlay.closeNetwork('restart')
    // this.gamePlay.logWriter?.closeFile()
    this.gamePlay.forEachPlayer(p => p.endGame())
    Tile.allTiles.forEach(tile => tile.hex = undefined)
    let deContainer = (cont: Container) => {
      cont.children.forEach(dObj => {
        dObj.removeAllEventListeners()
        if (dObj instanceof Container) deContainer(dObj)
      })
      cont.removeAllChildren()
    }
    deContainer(this.stage)
    TP.fnHexes(nh, mh);
    let rv = this.startup()
    this.netState = " "      // onChange->noop; change to new/join/ref will trigger onChange(val)
    // next tick, new thread...
    setTimeout(() => this.netState = netState, 100) // onChange-> ("new", "join", "ref") initiate a new connection
    return rv
  }
  ext: string[] = [];
  ngods: number = 4;
  /**
   * Make new Table/layout & gamePlay/hexMap & Players.
   * @param ext Extensions from URL
   */
  startup(ext = this.ext, ngods = this.ngods) {
    this.ext = ext;
    this.ngods = ngods;
    Tile.allTiles = [];
    Meeple.allMeeples = [];
    Player.allPlayers = [];
    const gods = ext.length > 2 ? ext : selectN(God.allNames, ngods);
    gods.length = Math.min(gods.length, 5);
    const guardsC: Constructor<Guardian>[][] = [[Satet, MumCat], [Apep, Mummy], [Scorpion, Androsphinx]];
    const guards: Constructor<Guardian>[] = guardsC.map(gs => selectN(gs, 1)[0]);
    const table = new Table(this.stage)        // EventDispatcher, ScaleCont, GUI-Player
    const gamePlay = new GamePlay(gods, guards, table, this) // hexMap, players, fillBag, gStats, mouse/keyboard->GamePlay
    this.gamePlay = gamePlay
    table.layoutTable(gamePlay)              // mutual injection, all the GUI components, fill hexMap
    gamePlay.forEachPlayer(p => p.newGame(gamePlay))        // make Planner *after* table & gamePlay are setup
    gamePlay.forEachPlayer(p => table.setPlayerScore(p, 0));
    if (this.stage.canvas) {
      console.groupCollapsed('initParamGUI')
      // table.miniMap.mapCont.y = Math.max(gui.ymax, gui2.ymax) + gui.y + table.miniMap.wh.height / 2
      console.groupEnd()
    }
    table.startGame('MiddleKingdom'); // allTiles.makeDragable(); placeStartTowns(); setNextPlayer();
    return gamePlay
  }
  /** affects the rules of the game & board
   *
   * ParamGUI   --> board & rules [under stats panel]
   * ParamGUI2  --> AI Player     [left of ParamGUI]
   * NetworkGUI --> network       [below ParamGUI2]
   */
  makeParamGUI(table: Table, parent: Container, x: number, y: number) {
    let restart = false
    const gui = new ParamGUI(TP, { textAlign: 'right'})
    const schemeAry = TP.schemeNames.map(n => { return { text: n, value: TP[n] } })
    const setSize = (dpb: number, dop: number) => { restart && this.restart.call(this, dpb, dop) };
    gui.makeParamSpec("nh", [6, 7, 8, 9, 10, 11], { fontColor: "red" }); TP.nHexes;
    gui.makeParamSpec("mh", [0, 1, 2, 3], { fontColor: "red" }); TP.mHexes;
    gui.makeParamSpec("colorScheme", schemeAry, { chooser: CycleChoice, style: { textAlign: 'center' } });

    gui.spec("nh").onChange = (item: ParamItem) => { setSize(item.value, TP.mHexes) }
    gui.spec("mh").onChange = (item: ParamItem) => { setSize(TP.nHexes, item.value) }

    parent.addChild(gui)
    gui.x = x // (3*cw+1*ch+6*m) + max(line.width) - (max(choser.width) + 20)
    gui.y = y
    gui.makeLines()
    const gui2 = this.makeParamGUI2(parent, x - 320, y)
    const gui3 = this.makeNetworkGUI(parent, x - 320, y + gui.ymax + 20 );
    gui.parent.addChild(gui) // bring to top
    gui.stage.update()
    restart = true // *after* makeLines has stablilized selectValue
    return [gui, gui2, gui3]
  }
  /** configures the AI player */
  makeParamGUI2(parent: Container, x: number, y: number) {
    const gui = new ParamGUI(TP, { textAlign: 'center' })
    gui.makeParamSpec("log", [-1, 0, 1, 2], { style: { textAlign: 'right' } }); TP.log
    gui.makeParamSpec("maxPlys", [1, 2, 3, 4, 5, 6, 7, 8], { fontColor: "blue" }); TP.maxPlys
    gui.makeParamSpec("maxBreadth", [5, 6, 7, 8, 9, 10], { fontColor: "blue" }); TP.maxBreadth
    parent.addChild(gui)
    gui.x = x; gui.y = y
    gui.makeLines()
    gui.stage.update()
    return gui
  }
  netColor: string = "rgba(160,160,160, .8)"
  netStyle: DropdownStyle = { textAlign: 'right' };
  /** controls multiplayer network participation */
  makeNetworkGUI (parent: Container, x: number, y: number) {
    const gui = this.netGUI = new ParamGUI(TP, this.netStyle)
    gui.makeParamSpec("Network", [" ", "new", "join", "no", "ref", "cnx"], { fontColor: "red" })
    gui.makeParamSpec("PlayerId", ["     ", 0, 1, 2, 3, "ref"], { chooser: PidChoice, fontColor: "red" })
    gui.makeParamSpec("networkGroup", [TP.networkGroup], { chooser: EBC, name: 'gid', fontColor: C.GREEN, style: { textColor: C.BLACK } }); TP.networkGroup

    gui.spec("Network").onChange = (item: ParamItem) => {
      if (['new', 'join', 'ref'].includes(item.value)) {
        const group = (gui.findLine('networkGroup').chooser as EBC).editBox.innerText
        // this.gamePlay.closeNetwork()
        // this.gamePlay.network(item.value, gui, group)
      }
      // if (item.value == "no") this.gamePlay.closeNetwork()     // provoked by ckey
    }
    (this.stage.canvas as HTMLCanvasElement)?.parentElement?.addEventListener('paste', (ev) => {
      const text = ev.clipboardData?.getData('Text')
      ;(gui.findLine('networkGroup').chooser as EBC).setValue(text)
    });
    this.showNetworkGroup()
    parent.addChild(gui)
    gui.makeLines()
    gui.x = x; gui.y = y;
    parent.stage.update()
    return gui
  }
  showNetworkGroup(group_name = TP.networkGroup) {
    document.getElementById('group_name').innerText = group_name
    const line = this.netGUI.findLine("networkGroup"), chooser = line?.chooser
    chooser?.setValue(group_name, chooser.items[0], undefined)
  }
}
