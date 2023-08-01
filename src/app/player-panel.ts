import { C, S, stime } from "@thegraid/easeljs-lib";
import { Container, Graphics, Shape } from "@thegraid/easeljs-module";
import { GP } from "./game-play";
import { AnkhHex } from "./ankh-map";
import { Player } from "./player";
import { CenterText, CircleShape, PaintableShape, RectShape, UtilButton } from "./shapes";
import { TP } from "./table-params";
import { Warrior } from "./ankh-figure";
import { TileSource } from "./tile-source";
import { AnkhToken } from "./god";
import { Table, AnkhPowerInfo, AnkhPowerCont } from "./table";
import { NumCounter, NumCounterBox } from "./counters";

export class PlayerPanel extends Container {
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
    this.makeAnkhPanel();
    this.makeAnkhSource();
    this.makeAnkhPower();
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
      ['Obelisk', 'Teleport to Obelisk in conflict'],
      ['Temple', '+2 strength when adjacent to Temple'],
      ['Pyramid', 'Summon to Temple']
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
    const colWide = 176, ankhColx = wide - (2 * brad), ankhRowy = 3.95 * rowh;
    return {dir, dydr, wide, high, brad, gap, rowh, colWide, ankhColx, ankhRowy}
  }
  get objects() {
    const player = this.player, index = player.index, panel = this, god = this.player.god;
    const table  = this.table;
    return { panel, player, index, god, table }
  }

  makeAnkhPanel() {
    const { wide, high, brad, gap } = this.metrics;
    this.setRect = (t1 = 2, bg = this.bg0) => {
      const t2 = t1 * 2 + 1, g = new Graphics().ss(t2);
      this.removeChild(this.outline);
      this.outline = new RectShape({ x: -t1, y: -(brad + gap + t1), w: wide + t2, h: high + t2 }, bg, this.god.color, g);
      this.addChildAt(this.outline, 0);
    };
    this.setRect(2);
  }

  makeAnkhSource() {
    const table = this.table;
    const index = this.player.index;
    const ankhHex = table.newHex2(0, 0, `AnkSource:${index}`, AnkhHex);
    const { ankhColx, ankhRowy } = this.metrics;
    this.localToLocal(ankhColx, ankhRowy, ankhHex.cont.parent, ankhHex.cont);
    const ankhSource = this.ankhSource = AnkhToken.makeSource(this.player, ankhHex, AnkhToken, 16);
    table.sourceOnHex(ankhSource, ankhHex);
  }

  makeAnkhPower() {
    const { rowh } = this.metrics;
    const { player, god, panel } = this.objects;
    // select AnkhPower: onClick->selectAnkhPower(info)
    const selectAnkhPower = (evt: Object, info?: AnkhPowerInfo) => {
      const { button, name, ankhs } = info;
      const ankh = ankhs.shift();
      if (!ankh) return;
      ankh.x = 0; ankh.y = 0;
      god.ankhPowers.push(name);
      console.log(stime(this, `.onClick: ankhPowers =`), god.ankhPowers, button.id);
      // mark power as taken:
      const parent = button.parent;
      const powerCont = parent.parent as AnkhPowerCont;
      parent.addChild(ankh);
      parent.stage.update();
      if (powerCont.guardianSlot === ankhs.length) {
        console.log(stime(this, `.onClick: takeGuardian powerCont =`), powerCont, powerCont.guardianSlot, ankhs);
        // TODO: take Guardian (move to god.stable)
      }
    };
    // Ankh Power line: circle + text; Ankhs
    const { brad, gap, ankhRowy, colWide, dir } = this.metrics;
    this.ankhPowers.forEach((ary, rank) => {
      const colCont = new Container() as AnkhPowerCont;
      panel.addChild(colCont);
      // TODO: take from god.ankhSource; store for multi-click
      const ankhs = [this.ankhSource.takeUnit(), this.ankhSource.takeUnit(),];
      ankhs.forEach((ankh, i) => {
        ankh.x = (3 * brad + gap) + i * (2 * brad + gap);
        ankh.y = ankhRowy;
      });
      colCont.guardianSlot = (rank < 2) ? 0 : 1;
      colCont.ankhs = ankhs;
      colCont.addChild(...ankhs);
      colCont.x = rank * colWide;

      // place powerLines --> selectAnkhPower:
      ary.forEach(([name, val], nth) => {
        const powerLine = new Container();
        powerLine.x = brad + gap;
        powerLine.y = nth * rowh;
        colCont.addChild(powerLine);

        const button = new CircleShape(C.white, brad, );
        button.on(S.click, selectAnkhPower, this, false, { button, name, ankhs });
        powerLine.addChild(button);

        const text = new CenterText(name, brad);
        text.textAlign = 'left';
        text.x = brad + gap;
        powerLine.addChild(text);

        const [w, h] = [text.getMeasuredWidth(), text.getMeasuredHeight()];
        const hitArea = new Shape(new Graphics().f(C.black).dr(0, -brad / 2, w, h));
        hitArea.x = text.x;
        hitArea.visible = false;
        text.hitArea = hitArea;

        const doctext = new UtilButton('rgb(240,240,240)', val, 2 * brad);
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

  makeFollowers() {
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
    layoutCounter('coin', C.coinGold, gap, ankhColx, true, );
  }


    // Stable:
  makeStable() {
    const { wide, gap, rowh, dir, brad } = this.metrics
    const { panel, god, player, index, table} = this.objects
    const stableCont = new Container();
    const srad1 = TP.ankh1Rad, srad2 = TP.ankh2Rad;
    const swide0 = 4 * (srad1 + srad2);
    const swidth = 210; // reserved for God's special Container
    const sgap = (wide - (gap + swidth + gap + gap + swide0 + 0 * gap)) / 3;
    const swide = (swide0 + 2 * sgap);
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
      const hex = player.stableHexes[i] = table.newHex2(0, 0, `w-${index}`, AnkhHex);
      circle.parent.localToLocal(circle.x, circle.y, hex.cont.parent, hex.cont);
      const source = (i === 0) ? Warrior.makeSource(player, hex) : table.guardSources[i - 1];
      table.sourceOnHex(source, hex);
    });
    // Special:
    const specl = new Container();
    specl.y = 5.5 * rowh - srad2;
    specl.x = ((dir + 1) / 2) * (wide - swide + brad) - (brad / 2); // [(wide-swide-brad/2) , -brad/2, ]
    specl.x = [gap, wide - swidth - (1 * gap),][(1 + dir) / 2];
    panel.addChild(specl);
    god.makeSpecial(specl, { width: swidth, height: srad2 * 2 }, table);
  }
  setRect;
  bg0 = 'rgba(255,255,255,.3)';
  bg1 = 'rgba(255,255,255,.5)';
  showPlayer(show = (this.player === GP.gamePlay.curPlayer)) {
    this.setRect(show ? 4 : 2, show ? this.bg1 : this.bg0);
  }
}
