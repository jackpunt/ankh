import { C, DragInfo, S, ValueEvent, stime } from "@thegraid/easeljs-lib";
import { Container, DisplayObject, Graphics, MouseEvent, Shape, Text } from "@thegraid/easeljs-module";
import { AnkhSource, Figure, Guardian, Monument, Temple, Warrior } from "./ankh-figure";
import { AnkhHex, RegionId, StableHex } from "./ankh-map";
import { AnkhToken } from "./ankh-token";
import { NumCounter, NumCounterBox } from "./counters";
import { God } from "./god";
import { Hex2 } from "./hex";
import { Player } from "./player";
import { CenterText, CircleShape, RectShape, UtilButton } from "./shapes";
import { DragContext, Table } from "./table";
import { TP } from "./table-params";


/** children as [button: typeof CircleShape, qmark: typeof CenterText, text: typeof CenterText, token?: AnkhToken] */
export interface PowerLine extends Container {
  ankhToken: AnkhToken;
  button: CircleShape;
  power: number;
  qmark: Text;
  text: Text;
  docText: UtilButton;
  showDocText: (vis?: boolean) => void
}

export interface AnkhPowerCont extends Container {
  rank: number;
  ankhs: AnkhToken[];
  powerLines: PowerLine[]; // powerLine.children: CircleShape, qMark, Text, maybe AnkhToken
  guardianSlot: number;
}

interface ConfirmCont extends Container {
  titleText: Text;
  messageText: Text;
  buttonYes: UtilButton;
  buttonCan: UtilButton;
}

interface CardSelector extends Container {
  y0: number;    // drag keep this.y = y0;
  x0: number;    //
  dragFunc0: (hex: Hex2, ctx: DragContext) => void;
  dropFunc0: () => void;
  bground: RectShape;
  powerLines: PowerLine[]; // powerLine.children: CircleShape, qMark, Text, maybe AnkhToken
  doneButton: UtilButton;
  // CardSelector children // CircleShape, qMark, Text, docText
  cycleCard: CircleShape;
}

type CardSpec = [name: string, text: string, doc: string, power: number];
type PowerSpec = [name: string, text: string, doc: string, power?: number];
export class PlayerPanel extends Container {
  canUseTiebreaker = false;

  isPlayerInRegion(regionNdx: number) {
    const region = this.table.gamePlay.hexMap.regions[regionNdx], god = this.god;
    return !!region.find(hex => (hex.meep instanceof Figure) && hex.meep.controller === god);
  }
  templeHexesInRegion(regionNdx: number) {
    const region = this.table.gamePlay.hexMap.regions[regionNdx];
    return region.filter(hex => hex.tile instanceof Temple && hex.tile?.player === this.player);
  }
  nFiguresInRegion(regionNdx: number) {
    const region = this.table.gamePlay.hexMap.regions[regionNdx], god = this.god;
    return region.filter(hex => hex.meep instanceof Figure && hex.meep.controller === god).length;
  }
  nRegionsWithFigures() {
    return this.table.gamePlay.hexMap.regions.filter((region, ndx) => this.isPlayerInRegion(ndx)).length;
  }
  /** Figures in Region controled by player.god */
  figuresInRegion(regionId: RegionId, player = this.player) {
    const figuresInRegion = Figure.allFigures.filter(fig => fig.hex?.district === regionId);
    return figuresInRegion.filter(fig => fig.controller === player.god);
  }
  hasAnkhPower(power: string) {
    return this.god.ankhPowers.includes(power);
  }
  get isResplendent() {
    const hasThreeOfMonu = (ndx: number) =>
      this.table.monumentSources[ndx].filterUnits(mont => mont.player === this.player).length >= 3;
    return this.hasAnkhPower('Resplendent') && Monument.typeNames.find((type, ndx) => hasThreeOfMonu(ndx));
  }

  /** at start of Battle */
  nFigsInBattle: number;
  strength = 0;
  reasons: { name: string, total: number, cards?, Chariots?, Temple?, Resplendent?};
  /** BattleResolution phase */
  strengthInRegion(regionNdx: number) {
    this.reasons = { name: this.name, total: 0 };
    this.strength = 0;
    const addStrength = (val: number, why: string) => {
      this.strength += val;
      this.reasons[why] = val;
      this.reasons.total = this.strength;
    }
    const nFigures = this.nFigsInBattle = this.nFiguresInRegion(regionNdx); addStrength(nFigures, 'Figures');
    const cardsInPlay = this.cardsInBattle;
    const namePowerInPlay = cardsInPlay.map(pl => [pl.name, pl.power ?? 0] as [string, number]);
    namePowerInPlay.forEach(([name, power]) => addStrength(power, name));
    if (this.hasAnkhPower('Temple')) {
      const temples = this.templeHexesInRegion(regionNdx);
      const activeTemples = temples.filter(tmpl => tmpl.filterAdjHex(hex => hex.meep?.player == this.player));
      addStrength(2 * activeTemples.length, `Temple`)
    }
    if (this.isResplendent) addStrength(3, 'Resplendent');
    // TODO: add Bastet-Cats
    return this.strength;
  }

  get plagueBid() { return this.bidCounter.getValue() }
  set plagueBid(v: number) { this.bidCounter.setValue(v) }
  enablePlagueBid(region: RegionId): void {
    this.plagueBid = 0;
    this.bidCounter.visible = true;
    this.showCardSelector(true, 'Bid Done');
    // this.player.gamePlay.phaseDone(this);  // TODO: convert async/Promise ?
  }

  canBuildInRegion: RegionId = undefined; // disabled.
  // really: detectBuildDne.
  enableBuild(regionId: RegionId): void {
    this.canBuildInRegion = regionId;
    const panel = this;
    const onBuildDone = this.table.on('buildDone', (evt: { panel0?: PlayerPanel, monument?: Monument }) => {
      const { panel0, monument } = evt;
      panel0.table.monumentSources.forEach(ms => ms.sourceHexUnit.setPlayerAndPaint(undefined));
      // Monument, hex.isOnMap, mont.player === this.player,
      // console.log(stime(this, `.enableBuild[${this.player.color}]: buildDone eq? ${panel0 === this} `), panel0.player.color, monument)
      if (panel0 === panel) {
        this.table.off('buildDone', onBuildDone);
        panel0.canBuildInRegion = undefined;
        this.player.gamePlay.phaseDone(panel0, monument);
      }
    })
  }
  // detectObeliskTeleport... oh! this requires a 'Done' indication.
  enableObeliskTeleport(regionId: RegionId): void {
    this.activateCardSelector(false, 'Teleport');
  }
  outline: RectShape;
  ankhSource: AnkhSource<AnkhToken>;
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
    this.makeFollowers();
    this.makeCardSelector();
    this.makeStable();
  }
  static readonly ankhPowers: PowerSpec[][] = [
    [
      ['Commanding', undefined, '+3 Followers when win battle'],
      ['Inspiring', undefined, 'Monument cost is 0'],
      ['Omnipresent', undefined, '+1 Follower per occupied region in Conflict'],
      ['Revered', undefined, '+1 Follower in Gain action']
    ],
    [
      ['Resplendent', undefined, '+3 Strength when 3 of a kind'],
      ['Obelisk', undefined, 'Teleport to Obelisk before battle'],
      ['Temple', undefined, '+2 strength when adjacent to Temple'],
      ['Pyramid', undefined, 'Summon to Pyramid']
    ],
    [
      ['Glorious', undefined, '+3 Devotion when win by 3 Strength'],
      ['Magnanimous', undefined, '+2 Devotion when 2 Figures in battle and lose'],
      ['Bountiful', undefined, '+1 Devotion when gain Devotion in Red'],
      ['Worshipful', undefined, '+1 Devotion when sacrifice 2 after Battle']
    ], // rank 2
  ];
  get metrics() {
    const dydr = this.table.hexMap.xywh.dydr, dir = this.dir;
    const wide = 590, high = dydr * 3.2, brad = TP.ankhRad, gap = 6, rowh = 2 * brad + gap;
    const colWide = 176, ankhColx = [brad + 2 * gap, 0, wide - (brad + 3 * gap)][1 - dir], ankhRowy = 3.85 * rowh;
    const swidth = 210; // reserved for God's special Container
    return {dir, dydr, wide, high, brad, gap, rowh, colWide, ankhColx, ankhRowy, swidth}
  }
  get objects() {
    const player = this.player, index = player.index, panel = this, god = this.god;
    const table  = this.table, gamePlay = this.player.gamePlay;
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
  showPlayer(show = (this.player && this.player === this.player.gamePlay.curPlayer)) {
    this.setOutline(show ? 4 : 2, show ? this.bg1 : this.bg0);
  }

  confirmContainer: ConfirmCont;
  makeConfirmation() {
    const { wide, high, brad, gap, rowh } = this.metrics;
    const { table } = this.objects;
    const conf = this.confirmContainer = new Container() as ConfirmCont; conf.name = 'confirm'
    const bg0 = new RectShape({ x: 0, y: - brad - gap, w: wide, h: high }, '', '');
    bg0.paint('rgba(240,240,240,.2)');
    const bg1 = new RectShape({ x: 0, y: 4 * rowh - brad - 2 * gap, w: wide, h: high - 4 * rowh + gap }, '', '');
    bg1.paint('rgba(240,240,240,.8)');

    const title = conf.titleText = new CenterText('Are you sure?', 30);
    title.x = wide / 2;
    title.y = 3.85 * rowh;
    const msgText = conf.messageText = new CenterText('', 30);
    msgText.x = wide / 2;
    msgText.y = 5 * rowh;
    const button1 = conf.buttonYes = new UtilButton('lightgreen', 'Yes', TP.ankhRad);
    const button2 = conf.buttonCan = new UtilButton('rgb(255, 100, 100)', 'Cancel', TP.ankhRad);
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
    const buttonYes = this.confirmContainer.buttonYes;
    const buttonCan = this.confirmContainer.buttonCan;
    const event = new MouseEvent(S.click, false, true, 0, 0, undefined, -1, true, 0, 0);
    (yes ? buttonYes : buttonCan).dispatchEvent(event);
  }

  areYouSure(msg: string, yes: () => void, cancel?: () => void, afterUpdate: () => void = () => {}) {
    const { panel, table } = this.objects;
    const conf = this.confirmContainer;
    const button1 = conf.buttonYes;
    const button2 = conf.buttonCan;
    const msgText = conf.children[4] as CenterText;
    msgText.text = msg;
    const clear = (func: () => void) => {
      conf.visible = false;
      button1.removeAllEventListeners();
      button2.removeAllEventListeners();
      table.doneButton.mouseEnabled = table.doneButton.visible = true;
      button1.updateWait(false, func);
    }
    button2.visible = !!cancel;
    button1.label.text = !!cancel ? 'Yes' : 'Continue';
    conf.titleText.text = !!cancel ? 'Are your sure?' : 'Click to Confirm';

    button1.on(S.click, () => clear(yes), this, true);
    button2.on(S.click, () => clear(cancel ?? yes), this, true);
    console.log(stime(this, `.areYouSure?, ${msg}`));
    panel.localToLocal(0, 0, table.overlayCont, conf);
    conf.visible = true;
    table.doneButton.mouseEnabled = table.doneButton.visible = false;
    button1.updateWait(false, afterUpdate);
    // setTimeout(cancel, 500);
  }

  highlightStable(show = true) {
    // we want to HIGHLIGHT when 'Summon' action is choosen.
    // if stable is normally faceDown, then we can face them up when activated !?
    const stableFigs = this.stableHexes.map(hex => hex.figure).filter(fig => !!fig);
    const anubisHexes = (God.byName.get('Anubis')?.doSpecial('occupied') ?? []) as AnkhHex[];
    const anubisFigs = anubisHexes.map(hex => hex.figure).filter(fig => fig.player === this.player);
    const summonFigs = stableFigs.concat(anubisFigs);
    return summonFigs.filter(fig => fig.highlight(show, C.BLACK))
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
    const bg = new CircleShape('lightgrey', TP.ankhRad + 2, 'white', new Graphics().ss(4));
    this.addChild(bg);
      ankhHex.cont.localToLocal(0, 0, this, bg);
    table.sourceOnHex(ankhSource, ankhHex);
  }

  addAnkhToPowerLine(powerLine: PowerLine) {
    const ankh = this.ankhPowerTokens.shift();
    if (ankh) {
      // mark power as taken:
      ankh.x = 0; ankh.y = 0;
      if (powerLine) {
        powerLine.addChild(ankh);
      } else {
        ankh.sendHome(); // AnkhToken
      }
      powerLine?.stage.update();
    }
    return ankh;
  }

  /** the click handler for AnkhPower buttons; info supplied by on.Click()
   *  confirm supplies (button === undefined) when insufficent funds to purchase AnkhPower
   */
  selectAnkhPower(evt?: Object, button?: CircleShape) {
    const rank = this.nextAnkhRank, ankhCol = this.ankhPowerTokens.length % 2;
    const ankh = this.addAnkhToPowerLine(button?.parent as PowerLine);
    const colCont = this.powerCols[rank - 1];        // aka: button.parent.parent
    this.activateAnkhPowerSelector(colCont, false); // deactivate

    // get God power, if can sacrific followers:
    if (this.player.coins >= colCont.rank) {
      this.player.gamePlay.gameState.addFollowers(this.player, -colCont.rank, `Ankh Power: ${button?.name ?? '---'}`);
      if (button?.name) this.god.ankhPowers.push(button.name); // 'Commanding', 'Resplendent', etc.
      //console.log(stime(this, `.onClick: ankhPowers =`), this.god.ankhPowers, button?.name, button?.id);
    } else {
      ankh.sendHome(); // AnkhToken
    }
    // Maybe get Guardian:
    if (colCont.guardianSlot === ankhCol) {
      this.takeGuardianIfAble(colCont.rank - 1)
    }
    this.stage.on('drawend', () => this.player.gamePlay.phaseDone(), this, true);
    this.stage.update();
  };

  takeGuardianIfAble(rank: number, guard?: Guardian) {
    const guardian = guard ?? this.table.guardSources[rank].takeUnit();
    if (!guardian) return;    // no Guardian to be picked/placed.
    guardian.setPlayerAndPaint(this.player);
    this.stage.update();
    const size = guardian.radius;
    const slot = this.stableHexes.findIndex((hex, n) => (n > 0) && hex.size === size && !hex.usedBy);
    if (slot < 0) return;     // Stable is full! (no rings of the right size)
    guardian.moveTo(this.stableHexes[slot]);
  }

  activateAnkhPowerSelector(colCont?: AnkhPowerCont , activate = true){
    // identify Rank --> colCont
    // in that colCont, mouseEnable Buttons (ie Containers) that do not have AnkhToken child.
    const findAnhkToken = (c: Container) => c.children.find(ic => ic instanceof AnkhToken);
    if (!colCont) colCont = this.powerCols.find(findAnhkToken); // first col with AnkhToken; see also ankhArrays.
    // colCont has: 2 x (MarkerToken, AnkhToken), 4 x PowerLine
    const powerLines = colCont.children.filter((ch: PowerLine) => (ch instanceof Container) && !(ch instanceof AnkhToken)) as PowerLine[];
    powerLines.forEach(pl => {
      const active = (activate && !pl.ankhToken)
      pl.button.paint(active ? 'lightgrey' : C.WHITE);
      pl.button.mouseEnabled = pl.qmark.visible = active; // enable and show qmark:
    });
    this.stage.update();
  }

  get nextAnkhRank() { return [1, 1, 2, 2, 3, 3][Math.max(0, 6 - this.ankhPowerTokens.length)] }  // 6,5: 1, 4,3: 2, 0,1: 3
  readonly powerCols: AnkhPowerCont[] = [];
  readonly ankhPowerTokens: AnkhToken[] = [];
  makeAnkhPowerGUI() {
    const { panel, player } = this.objects;
    // select AnkhPower: onClick->selectAnkhPower(info)
    // Ankh Power line: circle + text; Ankhs
    const { brad, gap, ankhRowy, colWide, dir} = this.metrics;
    PlayerPanel.ankhPowers.forEach((powerList, colNdx) => {
      const colCont = new Container() as AnkhPowerCont, rank = colNdx +1; colCont.name = `colCont-${colNdx}`;
      colCont.rank = rank;
      colCont.guardianSlot = (colNdx < 2) ? 1 : 0;
      colCont.x = colNdx * colWide + [2 * brad + 3 * gap, 0, 0][1 - dir];
      panel.addChild(colCont);
      panel.powerCols.push(colCont);

      const ankhs = [this.ankhSource.takeUnit(), this.ankhSource.takeUnit(),];
      this.ankhPowerTokens.push(...ankhs);
      ankhs.forEach((ankh, i) => {
        const mColor = (colCont.guardianSlot === i) ? 'gold' : 'white';
        const marker = new CircleShape('lightgrey', brad + 2, mColor, new Graphics().ss(4));
        marker.name = `place-marker`;
        marker.x = ankh.x = (3 * brad + gap) + i * (2 * brad + 2 * gap);
        marker.y = ankh.y = ankhRowy;
        marker.mouseEnabled = false;
        colCont.addChild(marker, ankh);
      });
      colCont.ankhs = ankhs;
      this.makePowerLines(colCont, powerList, this.selectAnkhPower); // ankhPower element [name: string, docstring: string][]
    });
  }

  makePowerLines(colCont: AnkhPowerCont, powerList: PowerSpec[], onClick) {
    const panel = this;
    const {brad, gap, rowh, dir,} = panel.metrics;
    const { player } = panel.objects;
      // place powerLines --> selectAnkhPower:
      colCont.powerLines = []; // Container with children: [button:CircleShape, text: CenterText, token?: AnkhToken]
      powerList.forEach(([powerName, powerText, docString, power], nth) => {
        const powerLine = new Container() as PowerLine;
        powerLine.name = powerName;
        powerLine.x = brad + gap;
        powerLine.y = nth * rowh;
        colCont.addChild(powerLine);
        colCont.powerLines.push(powerLine);

        const button = new CircleShape(C.white, brad);
        button.name = powerName;
        button.on(S.click, onClick, panel, false, button);
        button.mouseEnabled = false;
        powerLine.addChild(button);
        powerLine.button = button;
        powerLine.power = power;
        const qmark = new CenterText('?', brad * 1.4, C.BLACK);
        qmark.visible = qmark.mouseEnabled = false;
        if (!!power) {
          // show Card power in qmark:
          qmark.text = `+${power}`;
          qmark.color = C.BLACK;
          qmark.x -= brad / 10;
          qmark.visible = true;
        }
        powerLine.addChild(qmark);
        powerLine.qmark = qmark;

        const text = new CenterText(powerText ?? powerName, brad);
        text.textAlign = 'left';
        text.x = brad + gap;
        powerLine.addChild(text);
        powerLine.text = text;

        const [w, h] = [text.getMeasuredWidth(), text.getMeasuredHeight()];
        const hitArea = new Shape(new Graphics().f(C.black).dr(0, -brad / 2, w, h));
        hitArea.name = 'hitArea';
        hitArea.visible = false;
        text.hitArea = hitArea;

        const doctext = new UtilButton('rgb(240,240,240)', docString, 2 * brad);
        doctext.name = `doctext`;
        doctext.visible = false;
        panel.table.overlayCont.addChild(doctext);
        powerLine.localToLocal(doctext.x, doctext.y, panel.table.overlayCont.parent, doctext);
        powerLine.docText = doctext;
        const showDocText = powerLine.showDocText = (vis = !doctext.visible) => {
          const pt = text.parent.localToLocal(text.x, text.y, doctext.parent, doctext);
          doctext.x -= dir * (60 + doctext.label.getMeasuredWidth() / 2);
          if (!vis) {
            panel.table.overlayCont.children.forEach(doctext => doctext.visible = false)
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
  stableHexes: StableHex[] = [];
  /** size for each type: Warrior, G1, G2, G3 */
  stableSizes = [TP.ankh1Rad, TP.ankh1Rad, TP.ankh2Rad, TP.ankh2Rad,]
  makeStable() {
    const { wide, gap, rowh, dir, swidth } = this.metrics
    const { panel, god, player, index, table} = this.objects
    const stableCont = new Container(); stableCont.name = `stableCont:${player.index}`
    const srad1 = TP.ankh1Rad, srad2 = TP.ankh2Rad;
    const swide0 = 4 * (srad1 + srad2); // 2 * sum(this.stableSizes)
    const sgap = (wide - (gap + swidth + gap + gap + swide0 + 0 * gap)) / 3;
    stableCont.y = 5.5 * rowh;
    panel.addChild(stableCont);

    let x0 = [wide, 0][(1 + dir) / 2] + dir * (1 * gap); // edge of next circle
    this.stableSizes.forEach((radi, i) => {
      const g0 = new Graphics().ss(2).sd([5, 5]);
      const circle = new CircleShape('', radi - 1, god.color, g0);
      circle.y += (srad2 - radi);
      circle.x = x0 + dir * radi;
      x0 += dir * (2 * radi + sgap);
      stableCont.addChild(circle);
      const hexC = i==0 ? AnkhHex : StableHex;
      const hex = table.newHex2(0, 0, `s:${index}-${i}`, hexC) as StableHex;
      hex.size = radi;
      circle.parent.localToLocal(circle.x, circle.y, hex.cont.parent, hex.cont);
      const source = (i === 0) ? Warrior.makeSource(player, hex) : table.guardSources[i - 1];
      table.sourceOnHex(source, hex);
      this.stableHexes.push(hex);
    });
    this.makeSpecial(stableCont.y - srad2, srad2 * 2)
  }
  // Special:
  makeSpecial(sy: number, shigh: number) {
    const { dir, wide, gap, swidth } = this.metrics;
    const { panel, god, table } = this.objects;
    const specl = new Container(); specl.name = `special:${god.name}`
    specl.y = sy;
    specl.x = [gap, wide - (swidth + gap)][(1 + dir) / 2];
    panel.addChild(specl);
    god.makeSpecial(specl, { width: swidth, height: shigh }, table);
  }

  static readonly cardSpecs: CardSpec[] = [
    ['Flood', 'Flood', '+1 Follower for each Figure in fertile space; they cannot be killed in Battle.', 0],
    ['Build', 'Build Monument', 'Build a monument for 3 Followers', 0],
    ['Plague', 'Plague of Locusts', 'Kill units unless highest bid', 1],
    ['Chariots','Chariots', '+3 strength in battle resolution', 3],
    ['Miracle', 'Miracle', '+1 devotion for each Figure killed', 0],
    ['Drought','Drought', '+1 devotion per Figure in desert, if you win', 1],
    ['Cycle', 'Cycle of Ma`at', 'Reclaim all Battle Cards after battle resolution', 0],
  ]

  cardSelector: CardSelector;
  makeCardSelector() {
    const cardSelector = this.cardSelector = new Container as CardSelector; cardSelector.name = `cs:${this.player.index}`
    const apCont = cardSelector as Container as AnkhPowerCont;
    const { wide, high, dir, brad, gap, rowh } = this.metrics;
    const { panel, table, player, gamePlay } = this.objects;
    const x = 0, y = -(brad + gap), w = wide * .5, h = high, di = (1 - dir) / 2;
    const dxmax = [wide - w, w][di], dxmin = dxmax - wide;
    const dragFunc = (dobj: CardSelector, info: DragInfo) => {
      if (dobj.x0 === undefined) {
        dobj.x0 = dobj.x; // coordinate on DragCont! [is aligned with mapCont.panelCont?]
        dobj.y0 = dobj.y;
      }
      dobj.y = dobj.y0;
      dobj.x = Math.max(dobj.x0 + dxmin, Math.min(dobj.x0 + dxmax, dobj.x))
    }
    const dropFunc = () => {}
    table.dragger.makeDragable(cardSelector, this, dragFunc, dropFunc);
    const bg = new RectShape({ x, y, w, h }, 'rgba(240,240,240,.8)',)
    cardSelector.bground = new RectShape({ x, y, w, h }, 'rgba(240,240,240,.4)',)
    cardSelector.addChild(bg, cardSelector.bground);
    // add PowerLines:
    {
      this.makePowerLines(apCont, PlayerPanel.cardSpecs, this.selectForBattle);
      const inHand = PlayerPanel.colorForState['inHand'];
      cardSelector.powerLines.forEach(pl => (pl.button.paint(inHand)));
    }
    // add a Done button:
    {
      const doneButton = cardSelector.doneButton = new UtilButton(player.color, 'Done');
      cardSelector.addChild(doneButton);
      doneButton.y = 4 * rowh;
      doneButton.x = w - 2 * (brad + gap);
      doneButton.on(S.click, () => {
        if (doneButton.text !== 'Teleport') {
          const nSelected = this.cardsInState('inBattle').length;
          if (nSelected === 0) {
            this.blink(doneButton, 80, true);
            return; // you must select a card
          }
        }
        this.showCardSelector(false);
        this.bidCounter.visible = false;
        doneButton.updateWait(false, () => {
          gamePlay.phaseDone(panel);
        }, this);
      });
    }
    // add Plague Counter:
    {
      const [x, y] = [w - 2 * (brad + gap), 1 * rowh];
      const counter = this.bidCounter = new BidCounter(panel, 'bid', 0, 'orange', TP.ankh1Rad);
      counter.x = x; counter.y = y;
      counter.visible = false;
      counter.clickToInc(panel.player.coinCounter);
      panel.cardSelector.addChild(counter);
    }
    const cont = table.hexMap.mapCont.eventCont;
    cont.addChild(cardSelector);
    panel.localToLocal((wide - w) * (1 - dir) / 2, 0, cont, cardSelector,);
    this.activateCardSelector(false);
  }
  bidCounter: BidCounter;

  get canAffordMonument() { return this.player.coins >= 3 || this.hasAnkhPower('Inspiring') }
  activateCardSelector(activate = true, done = 'Done') {
    const selector = this.cardSelector;
    selector.powerLines.forEach(pl => {
      const color = pl.button.colorn;
      const inHand = PlayerPanel.colorForState['inHand'];
      const inBattle = PlayerPanel.colorForState['inBattle'];
      if (pl.name === 'Build' && (color === inHand)) {
        pl.text.color = this.canAffordMonument ? C.BLACK : 'rgb(180,0,0)';
      }
      pl.button.mouseEnabled = activate && (color === inHand || color === inBattle);
    });
    this.showCardSelector(activate, done);
  }

  showCardSelector(vis = true, done = 'Done') {
    const cs = this.cardSelector;
    const asTeleport = (done === 'Teleport');
    if (asTeleport) {
      cs.visible = true;
      cs.addChildAt(cs.bground, cs.children.indexOf(cs.doneButton) - 1);
    } else {
      cs.visible = vis;
      cs.addChildAt(cs.bground, 0);
    }
    cs.doneButton.text = done;
    cs.powerLines.forEach(pl => pl.showDocText(false));
  }

  static colorForState = { inHand: 'green', inBattle: 'yellow', onTable: 'red' };

  cardsInState(state: keyof typeof PlayerPanel.colorForState) {
    const color = PlayerPanel.colorForState[state];
    return this.cardSelector.powerLines.filter(pl => pl.button.colorn === color);
  }

  get cardsInHand() { return this.cardsInState('inHand'); }     // GREEN
  get cardsInBattle() { return this.cardsInState('inBattle'); } // YELLOW
  get cardsOnTable() { return this.cardsInState('onTable'); }   // RED

  get cycleWasPlayed() { return !!this.cardsOnTable.find(pl => pl.button.name === 'Cycle') }

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
  blink(dispObj: DisplayObject, del = 80, vis = dispObj.visible){
    dispObj.visible = !vis;
    this.stage.update();
    setTimeout(() => { dispObj.visible = vis; this.stage.update(); }, del);
  }

  // button.parent is the PowerLine.
  selectForBattle(evt, button: CircleShape) {
    const max = this.god.nCardsAllowedInBattle;

    const colorInHand = PlayerPanel.colorForState['inHand']
    const colorInBattle = PlayerPanel.colorForState['inBattle']
    button.paint((button.colorn === colorInHand) ? colorInBattle : colorInHand);
    if(this.cardsInState('inBattle').length > max) {
      button.paint(colorInHand);
      this.blink(button);
    }
    button.stage.update();
  }

}
class BidCounter extends NumCounter {
  constructor(public panel: PlayerPanel, name: string, initValue?: string | number, color?: string, fontSize?: number, fontName?: string, textColor?: string) {
    super(name, initValue, color, fontSize, fontName, textColor);
  }

  override incValue(incr: number): void {
    if (this.getValue() + incr < 0) return;
    if (this.panel.player.coins - incr < 0) return;
    this.updateValue(this.getValue() + incr);
    this.dispatchEvent(new ValueEvent('incr', -incr));
  }
}
