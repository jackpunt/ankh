import { C, S, stime } from "@thegraid/easeljs-lib";
import { Container, Graphics, Shape } from "@thegraid/easeljs-module";
import { GP } from "./game-play";
import { AnkhHex } from "./ankh-map";
import { Player } from "./player";
import { CenterText, CircleShape, PaintableShape, RectShape, UtilButton } from "./shapes";
import { TP } from "./table-params";
import { AnkhSource, Figure, Guardian, Warrior } from "./ankh-figure";
import { TileSource, UnitSource } from "./tile-source";
import { AnkhToken } from "./god";
import { Table } from "./table";
import { NumCounter, NumCounterBox } from "./counters";
import { Meeple } from "./meeple";

interface AnkhPowerInfo {
  button?: Shape;
  radius?: number;
}
interface PowerLine extends Container {
  ankhToken: AnkhToken;
  button: CircleShape;
}

interface AnkhPowerCont extends Container {
  rank: number;
  ankhs: AnkhToken[];
  powerLines: Container[]; // powerLine.children: CircleShape, Text, maybe AnkhToken
  guardianSlot: number;
}

export class PlayerPanel extends Container {
  strength: any;
  isPlayerInRegion(conflictRegion: number): unknown {
    throw new Error("Method not implemented.");
  }
  enablePlagueBid(region: number): void {
    throw new Error("Method not implemented.");
  }
  enableBuild(region: number): void {
    throw new Error("Method not implemented.");
  }
  enableObeliskTeleport(region: number): void {
    throw new Error("Method not implemented.");
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
    table.hexMap.mapCont.resaCont.addChild(this);
    table.setToRowCol(this, row, col);
    this.setOutline();
    this.makeConfirmation();
    this.makeAnkhSource();
    this.makeAnkhPowerGUI();
    this.makeFollowers();
    this.makeStable();
  }
  readonly ankhPowers = [
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
      ['Magnanimous', '+2 Devotion when lose with 2 Figures'],
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
    const table  = this.table;
    return { panel, player, index, god, table }
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

  areYouSure(msg: string, yes: () => void, cancel: () => void, afterUpdate: () => void = () => {}) {
    const { panel, table } = this.objects;
    const conf = this.confirmContainer, button1 = conf.children[2], button2 = conf.children[3];
    const utilButton = button1 as UtilButton;
    const msgText = conf.children[4] as CenterText;
    msgText.text = msg;
    const clear = (func: () => void) => {
      conf.visible = false;
      button1.removeAllEventListeners();
      button2.removeAllEventListeners();
      table.doneButton.mouseEnabled = table.doneButton.visible = true;
      utilButton.updateWait(false, func);
    }

    button1.on(S.click, () => clear(yes), this, true);
    button2.on(S.click, () => clear(cancel), this, true);
    console.log(stime(this, `.areYouSure?, ${msg}`));
    panel.localToLocal(0, 0, table.overlayCont, conf);
    conf.visible = true;
    table.doneButton.mouseEnabled = table.doneButton.visible = false;
    utilButton.updateWait(false, afterUpdate);
    // setTimeout(cancel, 500);
  }

  highlightStable(show = true) {
    // we want to HIGHLIGHT when 'Move' action is choosen.
    // if stable is normally faceDown, then we can face them up when activated !?
    return this.stableHexes.map(hex => hex.meep?.highlight(show, C.BLACK)).filter(m => (m !== undefined))
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

  /** the click handler for AnkhPower buttons; info supplied by on.Click() */
  selectAnkhPower(evt: Object, info?: AnkhPowerInfo) {
    const { button } = info;
    const rank = this.nextAnkhRank;
    const ankhs = this.ankhArrays[rank], ankh = ankhs.shift();
    if (!ankh) return;
    // mark power as taken:
    if (button) {
      const powerLine = button.parent;
      ankh.x = 0; ankh.y = 0;
      powerLine.addChild(ankh);
      powerLine.stage.update();
    }
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
    if (colCont.guardianSlot === 1 - ankhs.length) {
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

  get nextAnkhRank() {
    return this.ankhArrays.findIndex(elt => elt.length > 0);
  }
  powerCols: AnkhPowerCont[] = [];
  ankhArrays: AnkhToken[][] =[] ;
  makeAnkhPowerGUI() {
    const { rowh } = this.metrics;
    const { panel, player } = this.objects;
    // select AnkhPower: onClick->selectAnkhPower(info)
    // Ankh Power line: circle + text; Ankhs
    const { brad, gap, ankhRowy, colWide, dir } = this.metrics;
    this.ankhPowers.forEach((ary, colNdx) => {
      const colCont = new Container() as AnkhPowerCont, rank = colNdx +1;
      colCont.rank = rank;
      colCont.guardianSlot = (colNdx < 2) ? 1 : 0;
      colCont.x = colNdx * colWide;
      panel.addChild(colCont);
      panel.powerCols.push(colCont);

      const ankhs = [this.ankhSource.takeUnit(), this.ankhSource.takeUnit(),];
      this.ankhArrays.push(ankhs);
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

      // place powerLines --> selectAnkhPower:
      colCont.powerLines = []; // Container of { CircleShape, CenterText & maybe AnkhToken }
      ary.forEach(([powerName, docString], nth) => {
        const powerLine = new Container() as PowerLine;
        powerLine.name = `Powerline-${nth}`
        powerLine.x = brad + gap;
        powerLine.y = nth * rowh;
        colCont.addChild(powerLine);
        colCont.powerLines.push(powerLine);

        const button = new CircleShape(C.white, brad, );
        button.name = powerName;
        button.on(S.click, this.selectAnkhPower, this, false, { button } as AnkhPowerInfo);
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
        doctext.x = text.x - dir * (60 + doctext.label.getMeasuredWidth()/2); doctext.y = text.y;
        this.table.overlayCont.addChild(doctext);
        powerLine.localToLocal(doctext.x, doctext.y, this.table.overlayCont.parent, doctext);
        const showDocText = (doctext: UtilButton) => {
          if (doctext.visible) {
            this.table.overlayCont.children.forEach(doctext => doctext.visible = false)
          } else {
            doctext.visible = true;
          }
          doctext.stage.update();
        }
        doctext.on(S.click, () => showDocText(doctext) );
        text.on(S.click, () => showDocText(doctext));
      });
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
    const coinsCounter = layoutCounter('coin', C.coinGold, 2 * rowh, ankhColx, true, );
    coinsCounter.setValue(initialCoins);
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

  makeCardSelector() {

  }

  selectCards(): void {
    throw new Error("Method not implemented.");
  }

}
