import { C, Constructor, WH } from "@thegraid/common-lib";
import { Container, Shape } from "@thegraid/easeljs-module";
import { Hex1, Hex2 } from "./hex";
import { Meeple } from "./meeple";
import { Player } from "./player";
import { CenterText, CircleShape, ColorGraphics, Paintable, PaintableShape } from "./shapes";
import { Table } from "./table";
import { TP } from "./table-params";
import { Tile } from "./tile";
import { TileSource, UnitSource } from "./tile-source";

class AnhkShape extends CircleShape {
  constructor(rad = TP.ankhRad, color: string) {
    super(rad - 1, color);
  }
}
export class AnkhToken extends Meeple {
  static source: UnitSource<Meeple>[] = [];

  static makeSource(player: Player, hex: Hex2, token: Constructor<Meeple>, n: number) {
    return Tile.makeSource0(UnitSource<Meeple>, token, player, hex, n);
  }
  override get radius() { return TP.ankhRad; }
  // override isDragable(arg: DragContext) { return false; }

  constructor(player: Player, serial: number) {
    super(`Ankh:${player?.index}\n${serial}`, player);
    const r = this.radius;
    const ankh = new CenterText(`${'\u2625'}`, r * 2.2, C.black);
    ankh.y += r * .1;
    this.addChild(ankh);
    this.nameText.y += 2 * this.radius; // outside of cache bounds, so we don;t see it.
    this.baseShape.cgf = ColorGraphics.circleShape();
  }

  override moveTo(hex: Hex1): Hex1 {
    const rv = super.moveTo(hex);
    if (hex?.isOnMap) {
      this.y += TP.ankh2Rad - this.radius;
      if (hex.tile) {
        hex.tile.player = this.player
        hex.tile.paint()
      }
    }
    return rv;
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
    public  name: string,
    public color: string,
  ) {
    // constructor here:
    God.byName.set(name, this);
  }
  ankhPowers: string[] = [];

  radius = TP.ankh2Rad;
  getAnhkToken(rad = TP.ankhRad) {
    const cont = new Container();
    const shape = new CircleShape(rad, this.color, );
    const ankh = new CenterText(`${'\u2625'}`, rad * 2.2, C.black);
    ankh.y += rad * .1;
    cont.addChild(shape);
    cont.addChild(ankh);
    return cont;
  }

  makeSpecial(cont: Container, wh: WH, table: Table): Container {
    const fillc = 'rgb(140,140,140)';
    const rad = TP.ankhRad, y = wh.height/2 + rad/2;
    const bg = new Shape(); bg.graphics.f(fillc).dr(0, 0, wh.width, wh.height)
    cont.addChild(bg);
    const tname = new CenterText(this.name, rad, this.color );
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
      const circle = new CircleShape(radi, 'lightgrey', this.color);
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
