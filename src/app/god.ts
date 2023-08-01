import { C, Constructor, WH } from "@thegraid/common-lib";
import { Container, Graphics, Shape } from "@thegraid/easeljs-module";
import { Hex1, Hex2 } from "./hex";
import { Meeple } from "./meeple";
import { Player } from "./player";
import { CenterText, CircleShape } from "./shapes";
import { DragContext, Table } from "./table";
import { TP } from "./table-params";
import { Tile } from "./tile";
import { UnitSource } from "./tile-source";
import { GP } from "./game-play";
export class AnkhToken extends Meeple {
  static source: UnitSource<Meeple>[] = [];

  static makeSource(player: Player, hex: Hex2, token: Constructor<Meeple>, n: number) {
    return Tile.makeSource0(UnitSource<AnkhToken>, token, player, hex, n);
  }
  override get radius() { return TP.ankhRad; }
  override isDragable(arg: DragContext) {
    return this.hex && GP.gamePlay.isPhase('Claim');
  }

  constructor(player: Player, serial: number) {
    super(`Ankh:${player?.index}\n${serial}`, player);
    const r = this.radius;
    const ankhChar = new CenterText(`${'\u2625'}`, r * 2.2, C.black);
    ankhChar.y += r * .1;
    this.addChild(ankhChar);
    this.nameText.text = '';
    // this.nameText.y += 2 * this.radius; // outside of cache bounds, so we don;t see it.
    this.baseShape.cgf = (color) => this.atcgf(color);
  }
  override cache(x, y, w, h) {
    //this.scaleX = this.scaleY = 8;
    super.cache(x, y, w, h, 5)
    // this.scaleX = this.scaleY = 1;
  }

  atcgf(color: string) {
      const g = new Graphics(), r = this.radius;
      g.ss(1).s(C.black).dc(0, 0, r - 1);
      g.f(color).dc(0, 0, r - 1);
      return g;
  }

  override moveTo(hex: Hex1): Hex1 {
    const rv = super.moveTo(hex);
    if (hex?.isOnMap) {
      this.y += TP.ankh2Rad - this.radius;
      if (hex.tile) {
        hex.tile.setPlayerAndPaint(this.player);
      }
    }
    return rv;
  }
}

/** Looks like AnkhToken, but is just a marker for Actions & Events */
export class AnkhMarker extends Container {
  constructor(color: string, rad = TP.ankhRad) {
    super();
    const shape = new CircleShape(color, rad, );
    const ankh = new CenterText(`${'\u2625'}`, rad * 2.2, C.black);
    ankh.y += rad * .1;
    this.addChild(shape);
    this.addChild(ankh);
  }
}
export class God {
  static byName = new Map<string, God>();

  static get allGods() {
    return Array.from(God.byName).map(([gname, god]) => god);
  }
  static get allNames() {
    return Array.from(God.byName).map(([gname, god]) => gname);
  }

  constructor(
    public Aname: string,
    public color: string,
  ) {
    // constructor here:
    God.byName.set(Aname, this);
  }
  ankhPowers: string[] = [];

  radius = TP.ankh2Rad;
  getAnkhToken(rad = TP.ankhRad) {
    return new AnkhMarker(this.color, rad);
  }

  makeSpecial(cont: Container, wh: WH, table: Table): Container {
    const fillc = 'rgb(140,140,140)';
    const rad = TP.ankhRad, y = wh.height/2 + rad/2;
    const bg = new Shape(); bg.graphics.f(fillc).dr(0, 0, wh.width, wh.height)
    cont.addChild(bg);
    const tname = new CenterText(this.Aname, rad, this.color );
    tname.x = wh.width / 2; tname.textBaseline = 'top';
    cont.addChild(tname);
    return cont;
  }

}
class Anubis extends God {
  constructor() { super('Anubis', 'green') }

}

class Amun extends God {
  constructor() { super('Amun', 'red') }
  override makeSpecial(cont0: Container, wh: WH, table: Table): Container {
    super.makeSpecial(cont0, wh, table);
    const cont = new Container(), sc = cont.scaleX = cont.scaleY = AmunHex.scale;
    cont0.addChild(cont);
    const rad = TP.ankh1Rad, r2 = TP.ankh1Rad / 2, y = wh.height / 2 + r2;
    const sgap = (wh.width / sc - 6 * rad) / 4;
    [rad, rad, rad].forEach((radi, i) => {
      const circle = new CircleShape('lightgrey', radi, this.color);
      circle.x = sgap + radi + i * (2 * radi + sgap);
      circle.y = y;
      cont.addChild(circle);
      const hex = table.newHex2(0, 0, `amun-${i}`, AmunHex);
      hex.cont.visible = false;
      cont.localToLocal(circle.x, circle.y, hex.cont.parent, hex.cont);
      hex.legalMark.setOnHex(hex);
    });
    return cont0;
  }
}
/** AmunHex scales the Tile by .8 */
class AmunHex extends Hex2 {
  static scale = .8;
  override get meep() { return super.meep; }

  override set meep(meep: Meeple) {
    if (meep === undefined && this.meep) {
      this.meep.scaleX = this.meep.scaleY = 1;
      this.meep.updateCache();
    }
    super.meep = meep;
    if (meep !== undefined) {
      meep.scaleX = meep.scaleY = AmunHex.scale;
      meep.updateCache();
    }
  }
}

class Bastet extends God {
  constructor() { super('Bastet', 'orange') }
}

class Hathor extends God {
  constructor() { super('Hathor', 'magenta') }
  // constructor() { super('Hathor', 'rgb(74,35,90)') }
}

class Horus extends God {
  constructor() { super('Horus', 'darkred') }
}

class Isis extends God {
  constructor() { super('Isis', 'lightblue') }
}

class Osiris extends God {
  constructor() { super('Osiris', 'lightgreen') }
}

class Ra extends God {
  constructor() { super('Ra', 'yellow') }
}

class SetGod extends God {
  constructor() { super('Set', C.coinGold) }
}

class Toth extends God {
  constructor() { super('Toth', 'cyan') }
}

// Make all the Gods:
const godSpecs: Constructor<God>[] = [Anubis, Amun, Bastet, Hathor, Horus, Isis, Osiris, Ra, SetGod, Toth];
godSpecs.forEach(god => new god());
