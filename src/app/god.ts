import { C, Constructor, WH } from "@thegraid/common-lib";
import { Container, Shape } from "@thegraid/easeljs-module";
import { Hex2 } from "./hex";
import { Player } from "./player";
import { CenterText, CircleShape, Paintable } from "./shapes";
import { TP } from "./table-params";
import { Tile, Token } from "./tile";
import { TileSource } from "./tile-source";

class AnhkShape extends CircleShape {
  constructor(rad = 30, color: string) {
    super(rad, color);
  }
}
export class AnkhToken extends Token {
  static source: TileSource<AnkhToken>[] = [];

  static makeSource(player: Player, hex: Hex2, token: Constructor<Token>, n: number) {
    return Tile.makeSource0(TileSource<Token>, token, player, hex, n);
  }
  override get radius() { return TP.anhkRad; }

  constructor(player: Player, serial: number) {
    super(`Ankh:${player?.index}\n${serial}`, player);
    const ankh = new CenterText(`${'\u2625'}`, this.radius * 2.2, C.black);
    ankh.y += this.radius * .1;
    this.addChild(ankh);
  }

  override makeShape(): Paintable {
    return new AnhkShape(TP.anhkRad, this.pColor);
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

  radius = TP.anhkRad;
  getAnhkToken(rad = this.radius) {
    const cont = new Container();
    const shape = new CircleShape(rad, this.color, );
    const ankh = new CenterText(`${'\u2625'}`, rad * 2.2, C.black);
    ankh.y += rad * .1;
    cont.addChild(shape);
    cont.addChild(ankh);
    return cont;
  }

  makeSpecial(wh: WH): Container {
    const cont = new Container, rad = this.radius, y = wh.height/2 + rad/2;
    const bg = new Shape(); bg.graphics.f('rgb(140,140,140)').dr(0, 0, wh.width, wh.height)
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
  override makeSpecial(wh: WH): Container {
    const cont = super.makeSpecial(wh), rad = this.radius, y = wh.height / 2 + rad / 2;;
    const sgap = (wh.width - 6 * rad) / 4;
    [rad, rad, rad].forEach((radi, i) => {
      const circle = new CircleShape(radi, 'lightgrey', this.color);
      // circle.graphics.ss(1).f(C.black).sd([5, 5]).f('transparent').dc(0, 0, radi + 2);
      circle.x = sgap + radi + i * (2 * radi + sgap);
      circle.y = y;
      cont.addChild(circle);
    });
    return cont;
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
