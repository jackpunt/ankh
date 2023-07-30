import { C, S, stime } from "@thegraid/easeljs-lib";
import { Container, Graphics } from "@thegraid/easeljs-module";
import { GP } from "./game-play";
import { AnkhHex } from "./ankh-map";
import { Player } from "./player";
import { CenterText, CircleShape, RectShape } from "./shapes";
import { TP } from "./table-params";
import { Warrior } from "./ankk-figure";
import { TileSource } from "./tile-source";
import { AnkhToken } from "./god";
import { Table, AnkhPowerInfo, AnkhPowerCont } from "./table";
import { NumCounter, NumCounterBox } from "./counters";

export class PlayerPanel extends Container {
  outline: RectShape;
  ankhSource: TileSource<AnkhToken>;

  constructor(
    public table: Table,
    public player: Player,
    row: number,
    col: number,
    dir = -1
  ) {
    super();
    const panel = this;
    const god = player.god;
    const index = player.index;
    table.hexMap.mapCont.resaCont.addChild(panel);
    table.setToRowCol(panel, row, col);
    const ankhPowers = [
      ['Commanding', 'Inspiring', 'Omnipresent', 'Revered'],
      ['Resplendent', 'Obelisk', 'Temple', 'Pyramid'],
      ['Glorious', 'Magnanimous', 'Bountiful', 'Worshipful'], // rank 2
    ];
    const dydr = table.hexMap.xywh.dydr;
    const wide = 590, high = dydr * 3.2, brad = TP.ankhRad, gap = 6, rowh = 2 * brad + gap, colWide = 176;
    const ankhColx = wide - (2 * brad), ankhRowy = 3.95 * rowh;
    this.setRect = (t1 = 2, bg = this.bg0) => {
      const t2 = t1 * 2 + 1, g = new Graphics().ss(t2);
      this.removeChild(this.outline);
      this.outline = new RectShape({ x: -t1, y: -(brad + gap + t1), w: wide + t2, h: high + t2 }, bg, god.color, g);
      this.addChildAt(this.outline, 0);
    };
    this.setRect(2);
    // AnkkSource:
    const ankhHex = table.newHex2(0, 0, `AnkSource:${index}`, AnkhHex);
    panel.localToLocal(ankhColx, ankhRowy, ankhHex.cont.parent, ankhHex.cont);
    const ankhSource = this.ankhSource = AnkhToken.makeSource(player, ankhHex, AnkhToken, 16);
    table.sourceOnHex(ankhSource, ankhHex);

    // select AnkhPower: onClick->selectAnkhPower(info)
    const selectAnkhPower = (evt: Object, info?: AnkhPowerInfo) => {
      const { button, name, ankhs } = info;
      const god = player.god, ankh = ankhs.shift();
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
    ankhPowers.forEach((ary, rank) => {
      const colCont = new Container() as AnkhPowerCont;
      panel.addChild(colCont);
      // TODO: take from god.ankhSource; store for multi-click
      const ankhs = [ankhSource.takeUnit(), ankhSource.takeUnit(),];
      ankhs.forEach((ankh, i) => {
        ankh.x = (3 * brad + gap) + i * (2 * brad + gap);
        ankh.y = ankhRowy;
      });
      colCont.guardianSlot = (rank < 2) ? 0 : 1;
      colCont.ankhs = ankhs;
      colCont.addChild(...ankhs);
      colCont.x = rank * colWide;

      // place powerLines --> selectAnkhPower:
      ary.forEach((name, nth) => {
        const powerLine = new Container();
        const button = new CircleShape(brad, C.white);
        button.on(S.click, selectAnkhPower, this, false, { button, name, ankhs });
        powerLine.addChild(button);
        const text = new CenterText(name, brad);
        text.textAlign = 'left';
        text.x = brad + gap;
        powerLine.addChild(text);
        powerLine.x = brad + gap;
        powerLine.y = nth * rowh;
        colCont.addChild(powerLine);
      });
    });

    // Followers/Coins counter
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

    // Stable:
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
      const circle = new CircleShape(radi - 1, '', god.color, g0);
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
