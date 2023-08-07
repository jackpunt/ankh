import { C, Constructor, DragInfo, S, className, stime } from "@thegraid/easeljs-lib";
import { Container, Graphics, MouseEvent, Shape } from "@thegraid/easeljs-module";
import { GP } from "./game-play";
import { AnkhHex } from "./ankh-map";
import { Player } from "./player";
import { CenterText, CircleShape, PaintableShape, RectShape, UtilButton } from "./shapes";
import { TP } from "./table-params";
import { AnkhSource, Figure, Guardian, Monument, Temple, Warrior } from "./ankh-figure";
import { TileSource, UnitSource } from "./tile-source";
import { AnkhToken } from "./god";
import { DragContext, Table } from "./table";
import { NumCounter, NumCounterBox } from "./counters";
import { Meeple } from "./meeple";
import { Hex2 } from "./hex";


/** children as [button: typeof CircleShape, qmark: typeof CenterText, text: typeof CenterText, token?: AnkhToken] */
export interface PowerLine extends Container {
  ankhToken: AnkhToken;
  button: CircleShape;
  showDocText: (vis?: boolean) => void
}

export interface AnkhPowerCont extends Container {
  rank: number;
  ankhs: AnkhToken[];
  powerLines: PowerLine[]; // powerLine.children: CircleShape, qMark, Text, maybe AnkhToken
  guardianSlot: number;
}

interface CardSelector extends Container {
  y0: number;    // drag keep this.y = y0;
  x0: number;    //
  dxmax: number; // drag is not to exceed Math.abs(this.x - x0) > dxmax;
  dragFunc0: (hex: Hex2, ctx: DragContext) => void;
  dropFunc0: () => void;
  powerLines: PowerLine[]; // powerLine.children: CircleShape, qMark, Text, maybe AnkhToken
}
type CardSpec = [name: string, doc: string, power: number];

export class PlayerPanel extends Container {
  canUseTiebreaker = false;

  isPlayerInRegion(regionId: number) {
    const region = this.table.gamePlay.hexMap.regions[regionId];
    return region.find(hex => hex.meep?.player === this.player) ?? false;
  }
  templeHexesInRegion(regionId: number) {
    const region = this.table.gamePlay.hexMap.regions[regionId];
    return region.filter(hex => hex.meep?.player === this.player && hex.tile instanceof Temple);
  }
  nFiguresInRegion(regionId: number) {
    const region = this.table.gamePlay.hexMap.regions[regionId];
    return region.filter(hex => hex.meep?.player === this.player && hex.meep instanceof Figure).length;
  }
  figuresInRegion(regionId: number, player = this.player) {
    const figuresInRegion = Figure.allFigures.filter(fig => fig.hex?.district === regionId);
    const belongsTo = (fig: Figure, player: Player) => { return fig.player === player } // consider Set power.
    return figuresInRegion.filter(fig => belongsTo(fig, player))
  }
  hasAnkhPower(power: string) {
    return this.god.ankhPowers.includes(power);
  }
  get isResplendent() {
    const hasThreeOfMonu = (typeName: string) => Figure.allFigures.filter(fig => fig.hex?.isOnMap && fig.player == this.player && (fig.name === typeName)).length >= 3;
    return this.hasAnkhPower('Resplendent') && Monument.typeNames.find(type => hasThreeOfMonu(type));
  }

  /** at start of Battle */
  nFigsInBattle: number;
  strength = 0;
  reasons: { name: string, total: number, cards?, Chariots?, Temple?, Resplendent?};
  /** BattleResolution phase */
  strengthInRegion(regionId: number) {
    this.reasons = {name: this.name, total: 0};
    this.strength = 0;
    const addStrength = (val, why) => { this.strength += val; this.reasons[why] = val; this.reasons.total = this.strength; }
    const nFigures = this.nFigsInBattle = this.nFiguresInRegion(regionId); addStrength(nFigures, 'Figures');
    const cardsInPlay = this.cardsInBattle;
    const cardSpecsInPlay = cardsInPlay.map(pl => PlayerPanel.cardSpecs.find(([name, doc, power]) => name === pl.name));
    cardSpecsInPlay.forEach(([name, doc, power]) => addStrength(power, name));
    if (this.hasAnkhPower('Temple')) {
      const temples = this.templeHexesInRegion(regionId);
      const activeTemples = temples.filter(tmpl => tmpl.filterAdjHex(hex => hex.meep?.player == this.player));
      addStrength(2 * activeTemples.length, `Temple`)
    }
    if (this.isResplendent) addStrength(3, 'Resplendent');
    // TODO: add Bastet-Cats
    return this.strength;
  }

  plagueBid = 0;  // TODO wireup a NumCounter (with a close-gesture)
  enablePlagueBid(region: number): void {
    this.plagueBid = 0;
    GP.gamePlay.phaseDone(this);  // TODO: convert async/Promise ?
  }
  canBuildInRegion: number = -1; // disabled.
  // really: detectBuildDne.
  enableBuild(regionId: number): void {
    this.canBuildInRegion = regionId;
    const panel = this;
    const onBuildDone = this.table.on('buildDone', (evt: { panel0?: PlayerPanel, monument?: Monument }) => {
      const { panel0, monument } = evt;
      // Monument, hex.isOnMap, mont.player === this.player,
      console.log(stime(this, `.enableBuild[${this.player.color}]: buildDone eq? ${panel0 === this} `), panel0.player.color, monument)
      if (panel0 === panel) {
        this.table.off('buildDone', onBuildDone);
        panel0.canBuildInRegion = -1;
        GP.gamePlay.phaseDone(panel0);
      }
    })
  }
  // detectObeliskTeleport... oh! this requires a 'Done' indication.
  enableObeliskTeleport(region: number): void {
    this.activateCardSelector(true);
  }
  outline: RectShape;
  ankhSource: TileSource<AnkhToken>;
  get god() { return this.player.god; }

  constructor(
    public table: Table,
    public player: Player,
    row: number,
    col: number,
    public dir = -1
  ) {
    super();
    this.name = this.god.name;   // for debugger
    table.hexMap.mapCont.resaCont.addChild(this);
    table.setToRowCol(this, row, col);
    this.setOutline();
    this.makeConfirmation();
    this.makeAnkhSource();
    this.makeAnkhPowerGUI();
    this.makeCardSelector();
    this.makeFollowers();
    this.makeStable();
  }
  static readonly ankhPowers = [
    [
      ['Commanding', '+3 Followers when win battle'],
      ['Inspiring', 'Monument cost is 0'],
      ['Omnipresent', '+1 Follower per occupied region in Conflict'],
      ['Revered', '+1 Follower in Gain action']
    ],
    [
      ['Resplendent', '+3 Strength when 3 of a kind'],
      ['Obelisk', 'Teleport to Obelisk before battle'],
      ['Temple', '+2 strength when adjacent to Temple'],
      ['Pyramid', 'Summon to Pyramid']
    ],
    [
      ['Glorious', '+3 Devotion when win by 3 Strength'],
      ['Magnanimous', '+2 Devotion when 2 Figures in battle and lose'],
      ['Bountiful', '+1 Devotion when gain Devotion in Red'],
      ['Worshipful', '+1 Devotion when sacrifice 2 after Battle']
    ], // rank 2
  ];
  get metrics() {
    const dydr = this.table.hexMap.xywh.dydr, dir = this.dir;
    const wide = 590, high = dydr * 3.2, brad = TP.ankhRad, gap = 6, rowh = 2 * brad + gap;
    const colWide = 176, ankhColx = wide - (2 * brad), ankhRowy = 3.85 * rowh;
    const swidth = 210; // reserved for God's special Container
    return {dir, dydr, wide, high, brad, gap, rowh, colWide, ankhColx, ankhRowy, swidth}
  }
  get objects() {
    const player = this.player, index = player.index, panel = this, god = this.player.god;
    const table  = this.table, gamePlay = GP.gamePlay;
    return { panel, player, index, god, table, gamePlay }
  }

  setOutline(t1 = 2, bg = this.bg0) {
    const { wide, high, brad, gap } = this.metrics;
    const t2 = t1 * 2 + 1, g = new Graphics().ss(t2);
    this.removeChild(this.outline);
    this.outline = new RectShape({ x: -t1, y: -(brad + gap + t1), w: wide + t2, h: high + t2 }, bg, this.god.color, g);
    this.addChildAt(this.outline, 0);
  }
  bg0 = 'rgba(255,255,255,.3)';
  bg1 = 'rgba(255,255,255,.5)';
  showPlayer(show = (this.player === GP.gamePlay.curPlayer)) {
    this.setOutline(show ? 4 : 2, show ? this.bg1 : this.bg0);
  }

  confirmContainer: Container;
  makeConfirmation() {
    const { wide, high, brad, gap, rowh } = this.metrics;
    const { table } = this.objects;
    const conf = this.confirmContainer = new Container();
    const bg0 = new RectShape({ x: 0, y: - brad - gap, w: wide, h: high }, '', '');
    bg0.paint('rgba(240,240,240,.2)');
    const bg1 = new RectShape({ x: 0, y: 4 * rowh - brad - 2 * gap, w: wide, h: high - 4 * rowh + gap }, '', '');
    bg1.paint('rgba(240,240,240,.8)');

    const title = new CenterText('Are you sure?', 30);
    title.x = wide / 2;
    title.y = 3.85 * rowh;
    const msgText = new CenterText('', 30);
    msgText.x = wide / 2;
    msgText.y = 5 * rowh;
    const button1 = new UtilButton('lightgreen', 'Yes', TP.ankhRad);
    const button2 = new UtilButton('rgb(255, 100, 100)', 'Cancel', TP.ankhRad);
    button1.y = button2.y = 6 * rowh;
    button1.x = wide * .4;
    button2.x = wide * .6;
    conf.addChild(bg0, bg1, button1, button2, msgText, title, );
    conf.visible = false;
    table.overlayCont.addChild(conf);
  }

  /** keybinder access to areYouSure */
  clickConfirm(yes = true) {
    // let target = (this.confirmContainer.children[2] as UtilButton);
    if (!this.confirmContainer.visible) return;
    const event = new MouseEvent(S.click, false, true, 0, 0, undefined, -1, true, 0, 0);
    (yes ? this.buttonYes : this.buttonCan).dispatchEvent(event);
  }

  buttonYes: UtilButton;
  buttonCan: UtilButton;
  areYouSure(msg: string, yes: () => void, cancel: () => void, afterUpdate: () => void = () => {}) {
    const { panel, table } = this.objects;
    const conf = this.confirmContainer;
    const button1 = this.buttonYes = conf.children[2] as UtilButton;
    const button2 = this.buttonCan = conf.children[3] as UtilButton;
    const msgText = conf.children[4] as CenterText;
    msgText.text = msg;
    const clear = (func: () => void) => {
      conf.visible = false;
      button1.removeAllEventListeners();
      button2.removeAllEventListeners();
      table.doneButton.mouseEnabled = table.doneButton.visible = true;
      button1.updateWait(false, func);
    }

    button1.on(S.click, () => clear(yes), this, true);
    button2.on(S.click, () => clear(cancel), this, true);
    console.log(stime(this, `.areYouSure?, ${msg}`));
    panel.localToLocal(0, 0, table.overlayCont, conf);
    conf.visible = true;
    table.doneButton.mouseEnabled = table.doneButton.visible = false;
    button1.updateWait(false, afterUpdate);
    // setTimeout(cancel, 500);
  }

  highlightStable(show = true) {
    // we want to HIGHLIGHT when 'Move' action is choosen.
    // if stable is normally faceDown, then we can face them up when activated !?
    return this.stableHexes.map(hex => hex.meep?.highlight(show, C.BLACK) as Figure).filter(m => (m !== undefined))
  }

  makeAnkhSource() {
    const table = this.table;
    const index = this.player.index;
    const ankhHex = table.newHex2(0, 0, `AnkSource:${index}`, AnkhHex);
    const { ankhColx, ankhRowy, rowh, gap } = this.metrics;
    this.localToLocal(ankhColx, ankhRowy, ankhHex.cont.parent, ankhHex.cont);
    const ankhSource = this.ankhSource = AnkhToken.makeSource(this.player, ankhHex, AnkhToken, 16);
    ankhSource.counter.x += TP.ankhRad * .6;
    ankhSource.counter.y += TP.ankhRad * .15;
    table.sourceOnHex(ankhSource, ankhHex);
  }

  addAnkhToPowerLine(powerLine: PowerLine) {
    const ankh = this.ankhArrays.shift();
    if (ankh) {
      // mark power as taken:
      ankh.x = 0; ankh.y = 0;
      if (powerLine) {
        powerLine.addChild(ankh);
        powerLine.stage.update();
      } else {
        ankh.sendHome();
      }
    }
    return ankh;
  }

  /** the click handler for AnkhPower buttons; info supplied by on.Click() */
  selectAnkhPower(evt?: Object, button?: CircleShape) {
    const rank = this.nextAnkhRank, ankhCol = this.ankhArrays.length % 2;
    const ankh = this.addAnkhToPowerLine(button?.parent as PowerLine);
    const colCont = this.powerCols[rank];
    this.activateAnkhPowerSelector(colCont, false);

    // get God power, if can sacrific followers:
    if (this.player.coins >= colCont.rank) {
      this.player.coins -= colCont.rank;
      if (button?.name) this.god.ankhPowers.push(button.name); // 'Commanding', 'Resplendent', etc.
      console.log(stime(this, `.onClick: ankhPowers =`), this.god.ankhPowers, button?.name, button?.id);
    } else {
      ankh.sendHome();
    }
    // Maybe get Guardian:
    if (colCont.guardianSlot === 1 - ankhCol) {
      this.takeGuardianIfAble(colCont.rank)
    }
    GP.gamePlay.selectedAction = 'Ankh';
    GP.gamePlay.phaseDone();
  };

  takeGuardianIfAble(rank: number) {
    const radius = [TP.ankh1Rad, TP.ankh2Rad, TP.ankh2Rad][rank];
    const nRank = Meeple.allMeeples.filter(meep => {
      return (meep instanceof Guardian) && (meep.player === this.player) && (meep.radius === radius);
    }).length;
    if (nRank >= 2) return;
    const guardian = this.stableSources[rank].takeUnit();
    guardian?.setPlayerAndPaint(this.player);
    guardian?.moveTo(this.stableHexes[rank]);
  }

  activateAnkhPowerSelector(colCont?: AnkhPowerCont , activate = true){
    // identify Rank --> colCont
    // in that colCont, mouseEnable Buttons (ie Containers) that do not have AnkhToken child.
    const findAnhkToken = (c: Container) => c.children.find(ic => ic instanceof AnkhToken);
    if (!colCont) colCont = this.powerCols.find(findAnhkToken); // first col with AnkhToken; see also ankhArrays.
    // colCont has: 2 x (MarkerToken, AnkhToken), 4 x PowerLine
    const powerLines = colCont.children.filter((ch: PowerLine) => (ch instanceof Container) && !(ch instanceof AnkhToken)) as PowerLine[];
    powerLines.forEach(pl => {
      // enable and show qmark:
      const qmark = pl.button.parent.children.find(ch => (ch instanceof CenterText) && ch.text === '?') as CenterText;
      pl.button.mouseEnabled = qmark.visible = (activate && !pl.ankhToken);
    });
    this.stage.update();
  }

  get nextAnkhRank() { return 3 - Math.floor(this.ankhArrays.length / 2) }
  readonly powerCols: AnkhPowerCont[] = [];
  readonly ankhArrays: AnkhToken[] = [];
  makeAnkhPowerGUI() {
    const { rowh } = this.metrics;
    const { panel, player } = this.objects;
    // select AnkhPower: onClick->selectAnkhPower(info)
    // Ankh Power line: circle + text; Ankhs
    const { brad, gap, ankhRowy, colWide } = this.metrics;
    PlayerPanel.ankhPowers.forEach((powerList, colNdx) => {
      const colCont = new Container() as AnkhPowerCont, rank = colNdx +1;
      colCont.rank = rank;
      colCont.guardianSlot = (colNdx < 2) ? 1 : 0;
      colCont.x = colNdx * colWide;
      panel.addChild(colCont);
      panel.powerCols.push(colCont);

      const ankhs = [this.ankhSource.takeUnit(), this.ankhSource.takeUnit(),];
      this.ankhArrays.push(...ankhs);
      ankhs.forEach((ankh, i) => {
        const mColor = (colCont.guardianSlot === i) ? 'purple' : C.black;
        const marker = new CircleShape(mColor, brad);
        marker.name = `place-marker`;
        marker.x = ankh.x = (3 * brad + gap) + i * (2 * brad + gap);
        marker.y = ankh.y = ankhRowy;
        marker.mouseEnabled = false;
        colCont.addChild(marker, ankh);
      });
      colCont.ankhs = ankhs;
      this.makePowerLines(colCont, powerList, this.selectAnkhPower); // ankhPower element [name: string, docstring: string][]
    });
  }

  makePowerLines(colCont: AnkhPowerCont, powerList, onClick) {
    const {brad, gap, rowh, dir,} = this.metrics;
    const { player } = this.objects;
      // place powerLines --> selectAnkhPower:
      colCont.powerLines = []; // Container with children: [button:CircleShape, text: CenterText, token?: AnkhToken]
      powerList.forEach(([powerName, docString], nth) => {
        const powerLine = new Container() as PowerLine;
        powerLine.name = powerName;
        powerLine.x = brad + gap;
        powerLine.y = nth * rowh;
        colCont.addChild(powerLine);
        colCont.powerLines.push(powerLine);

        const button = new CircleShape(C.white, brad, );
        button.name = powerName;
        button.on(S.click, onClick, this, false, button);
        button.mouseEnabled = false;
        powerLine.addChild(button);
        powerLine.button = button;
        const qmark = new CenterText('?', brad * 1.4, player.color);
        qmark.visible = qmark.mouseEnabled = false;
        powerLine.addChild(qmark);

        const text = new CenterText(powerName, brad);
        text.textAlign = 'left';
        text.x = brad + gap;
        powerLine.addChild(text);

        const [w, h] = [text.getMeasuredWidth(), text.getMeasuredHeight()];
        const hitArea = new Shape(new Graphics().f(C.black).dr(0, -brad / 2, w, h));
        hitArea.name = 'hitArea';
        hitArea.visible = false;
        text.hitArea = hitArea;

        const doctext = new UtilButton('rgb(240,240,240)', docString, 2 * brad);
        doctext.name = `doctext`;
        doctext.visible = false;
        this.table.overlayCont.addChild(doctext);
        powerLine.localToLocal(doctext.x, doctext.y, this.table.overlayCont.parent, doctext);
        const showDocText = powerLine.showDocText = (vis = !doctext.visible) => {
          const pt = text.parent.localToLocal(text.x, text.y, doctext.parent, doctext);
          doctext.x -= dir * (60 + doctext.label.getMeasuredWidth() / 2);
          if (!vis) {
            this.table.overlayCont.children.forEach(doctext => doctext.visible = false)
          } else {
            doctext.visible = true;
          }
          doctext.stage.update();
        }
        doctext.on(S.click, () => showDocText() );
        text.on(S.click, () => showDocText());
      });
  }

  makeFollowers(initialCoins = 1) {
    // Followers/Coins counter
    const { panel, player, index } = this.objects;
    const { gap, ankhColx, wide, rowh, dir } = this.metrics;
    const counterCont = panel, cont = panel;
    const layoutCounter = (name: string, color: string, rowy: number, colx = 0, incr: boolean | NumCounter = true,
      claz = NumCounterBox) => {
      //: new (name?: string, iv?: string | number, color?: string, fSize?: number) => NumCounter
      const cname = `${name}Counter`, fSize = TP.hexRad * .75;
      const counter = player[cname] = new claz(`${cname}:${index}`, 0, color, fSize)
      counter.setLabel(`${name}s`, { x: 0, y: fSize/2 }, 12);
      const pt = cont.localToLocal(colx, rowy, counterCont);
      counter.attachToContainer(counterCont, pt);
      counter.clickToInc(incr);
      return counter;
    }
    layoutCounter('coin', C.coinGold, 2 * rowh, ankhColx, true, );
    this.player.coins = initialCoins;
  }


    // Stable:
  stableSources: AnkhSource<Figure>[] = [];
  stableHexes: AnkhHex[] = [];
  makeStable() {
    const { wide, gap, rowh, dir, swidth } = this.metrics
    const { panel, god, player, index, table} = this.objects
    const stableCont = new Container();
    const srad1 = TP.ankh1Rad, srad2 = TP.ankh2Rad;
    const swide0 = 4 * (srad1 + srad2);
    const sgap = (wide - (gap + swidth + gap + gap + swide0 + 0 * gap)) / 3;
    stableCont.y = 5.5 * rowh;
    panel.addChild(stableCont);

    const sourceInfo = [srad1, srad1, srad2, srad2,]; // size for each type: Warrior, G1, G2, G3
    let x0 = [wide, 0][(1 + dir) / 2] + dir * (1 * gap); // edge of next circle
    sourceInfo.forEach((radi, i) => {
      const g0 = new Graphics().ss(2).sd([5, 5]);
      const circle = new CircleShape('', radi - 1, god.color, g0);
      circle.y += (srad2 - radi);
      circle.x = x0 + dir * radi;
      x0 += dir * (2 * radi + sgap);
      stableCont.addChild(circle);
      const hex = player.stableHexes[i] = table.newHex2(0, 0, `s:${index}-${i}`, AnkhHex) as AnkhHex;
      circle.parent.localToLocal(circle.x, circle.y, hex.cont.parent, hex.cont);
      const source = (i === 0) ? Warrior.makeSource(player, hex) : table.guardSources[i - 1];
      table.sourceOnHex(source, hex);
      this.stableSources.push(source);
      this.stableHexes.push(hex);
    });
    this.makeSpecial(stableCont.y - srad2, srad2 * 2)
  }
  // Special:
  makeSpecial(sy: number, shigh: number) {
    const { dir, wide, gap, swidth } = this.metrics;
    const { panel, god, table } = this.objects;
    const specl = new Container();
    specl.y = sy;
    specl.x = [gap, wide - (swidth + gap)][(1 + dir) / 2];
    panel.addChild(specl);
    god.makeSpecial(specl, { width: swidth, height: shigh }, table);
  }

  static readonly cardSpecs: CardSpec[] = [
    ['Flood', '+1 Follower for each Figure in fertile space; they cannot be killed in Battle.', 0],
    ['Build Monument', 'Build a monument for 3 Followers', 0],
    ['Plague of Locusts', 'Kill units unless highest bid', 1],
    ['Chariots', '+3 strength in battle resolution', 3],
    ['Miracle', '+1 devotion for each Figure killed', 0],
    ['Drought', '+1 devotion per Figure in desert, if you win', 1],
    ['Cycle of Ma`at', 'Reclaim all Battle Cards after battle resolution', 0],
  ]

  cardSelector: CardSelector;
  makeCardSelector() {
    const cardSelector = this.cardSelector = new Container as CardSelector;
    const apCont = cardSelector as Container as AnkhPowerCont;
    const { wide, high, dir, brad, gap, rowh } = this.metrics;
    const { panel, table, player, gamePlay } = this.objects;
    const dragFunc = (dobj: CardSelector, info: DragInfo) => {
      const dxmax = wide * table.scaleCont.scaleX;
      if (dobj.x0 === undefined) {
        dobj.x0 = dobj.x;
        dobj.y0 = dobj.y;
      }
      dobj.y = dobj.y0;
      dobj.x = Math.max(dobj.x0-dxmax, Math.min(dobj.x0+dxmax, dobj.x));
    }
    const dropFunc = () => {}
    table.dragger.makeDragable(cardSelector, this, dragFunc, dropFunc);
    const x = 0, y = -(brad + gap), w = wide / 2, h = high;
    const bg = new RectShape({ x, y, w, h }, 'rgba(240,240,240,.9)', )
    cardSelector.addChild(bg);
    this.makePowerLines(apCont, PlayerPanel.cardSpecs, this.selectForBattle);
    const inHand = PlayerPanel.colorForState['inHand'];
    cardSelector.powerLines.forEach(pl => (pl.button.paint(inHand)));
    // add a Done button:
    const doneButton = new UtilButton(player.color, 'Done');
    cardSelector.addChild(doneButton);
    doneButton.y = 4 * rowh;
    doneButton.x = w - 2 * (brad + gap);
    doneButton.on(S.click, () => {
      this.showCardSelector(false);
      doneButton.updateWait(false, () => {
        gamePlay.phaseDone(panel);
      }, this);
    });

    const cont = table.hexMap.mapCont.eventCont;
    cont.addChild(cardSelector);
    panel.localToLocal(w / 2 * (1 - dir), 0, cont, cardSelector, );
    this.activateCardSelector(false);
  }

  get canAffordMonument() { return this.player.coins >= 3 || this.hasAnkhPower('Inspiring') }
  activateCardSelector(activate = true) {
    const selector = this.cardSelector;
    selector.powerLines.forEach(pl => {
      const color = pl.button.colorn, inHand = PlayerPanel.colorForState['inHand'];
      if (pl.name === 'Build Monument' && (color === inHand)) {
        const colorB = this.canAffordMonument ? inHand : PlayerPanel.dubiusBuildColor;
        pl.button.paint(colorB, true);
        pl.button.colorn = color;
      }
      pl.button.mouseEnabled = activate && (color === inHand);
    });
    this.showCardSelector(activate);
  }

  showCardSelector(vis = true) {
    this.cardSelector.visible = vis;
    this.cardSelector.powerLines.forEach(pl => pl.showDocText(false));
  }

  static colorForState = { inHand: 'green', inBattle: 'yellow', onTable: 'red' };
  static dubiusBuildColor = C.nameToRgbaString(PlayerPanel.colorForState['inHand'], .5);

  cardsInState(state: keyof typeof PlayerPanel.colorForState) {
    const color = PlayerPanel.colorForState[state];
    return this.cardSelector.powerLines.filter(pl => pl.button.colorn === color);
  }

  get cardsInHand() { return this.cardsInState('inHand'); }
  get cardsOnTable() { return this.cardsInState('onTable'); }
  get cardsInBattle() { return this.cardsInState('inBattle'); }

  revealCards(vis = true): void {
    const inBattle = this.cardsInBattle.map(pl => pl.name);
    if (vis) console.log(stime(this, `.showCards: ${this.god.Aname}`), ... inBattle);
    this.showCardSelector(vis);
    this.stage.update();
  }

  battleCardsToTable() {
    this.cardsInBattle.forEach(pl => pl.button.paint(PlayerPanel.colorForState['onTable']));
    this.stage.update();
  }

  hasCardInBattle(cardName: string) {
    return this.cardsInBattle.find(pl => pl.name === cardName);
  }

  allCardsToHand(vis = false) {
    this.cardSelector.powerLines.forEach(pl => pl.button.paint(PlayerPanel.colorForState['inHand']));
  }

  // button.parent is the PowerLine.
  selectForBattle(evt, button: CircleShape) {
    const colorInHand = PlayerPanel.colorForState['inHand']
    const colorInBattle = PlayerPanel.colorForState['inBattle']
    button.paint(button.colorn === colorInHand ? colorInBattle : colorInHand);
    button.stage.update();
  }

}
