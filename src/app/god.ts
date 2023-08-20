import { C, Constructor, WH, className } from "@thegraid/common-lib";
import { Container, Shape } from "@thegraid/easeljs-module";
import { AnkhMeeple, AnkhPiece, AnkhSource, GodFigure, Portal } from "./ankh-figure";
import { AnkhHex } from "./ankh-map";
import { Player } from "./player";
import { CenterText, CircleShape, UtilButton } from "./shapes";
import { Table } from "./table";
import { TP } from "./table-params";


/** Looks like AnkhToken, but is just a marker for Actions & Events */
export class AnkhMarker extends Container {
  constructor(color: string, rad = TP.ankhRad) {
    super();
    this.name = className(this);
    const shape = new CircleShape(color, rad, );
    const ankh = new CenterText(TP.ankhString, rad * 2.2, C.black);
    ankh.y += rad * .1;
    this.addChild(shape);
    this.addChild(ankh);
  }
}
export class God {
  static byName = new Map<string, God>(); // by god.name, not className(god): 'Set' not 'SetGod'

  static get godCbyName() { return godCbyName; }

  /** all God instances */
  static get allGods() {
    return Array.from(God.byName).map(([gname, god]) => god);
  }
  static get allNames() { return Object.keys(godCbyName); }

  public player: Player;
  public name: string;

  constructor(
    public Aname: string,
    public color: string,
  ) {
    // constructor here:
    God.byName.set(Aname, this); // Aname === className(this);
    this.name = Aname;
  }
  readonly ankhPowers: string[] = [];

  radius = TP.ankh2Rad;
  getAnkhMarker(rad = TP.ankhRad, color = this.color) {
    return new AnkhMarker(color, rad);
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
  doSpecial(...args: any[]): any { return; }

  get nCardsAllowedInBattle() { return 1; }
  set nCardsAllowedInBattle(n: number) { }
  figure: GodFigure;
}

/** SpecialHex scales the Tile or Meep by .8 */
class SpecialHex extends AnkhHex {
  static scale = .8;
  scale = SpecialHex.scale;

  override get meep() { return super.meep; }

  override set meep(meep: AnkhMeeple) {
    if (meep === undefined && this.meep) {
      this.meep.scaleX = this.meep.scaleY = 1;
      this.meep.updateCache();
    }
    super.meep = meep;
    if (meep !== undefined) {
      meep.scaleX = meep.scaleY = SpecialHex.scale;
      meep.updateCache();
    }
  }

  override get tile() { return super.tile; }

  override set tile(tile: AnkhPiece) {
    if (tile === undefined && this.tile) {
      this.tile.scaleX = this.tile.scaleY = 1;
      this.tile.updateCache();
    }
    super.tile = tile;
    if (tile !== undefined) {
      tile.scaleX = tile.scaleY = this.scale;
      tile.updateCache();
    }
  }
}


class Anubis extends God {
  constructor() { super('Anubis', 'green') }
  anubisHexes: SpecialHex[] = [];

  override makeSpecial(cont0: Container, wh: WH, table: Table): Container {
    super.makeSpecial(cont0, wh, table);
    const cont = new Container(), sc = cont.scaleX = cont.scaleY = SpecialHex.scale;
    cont.name = 'AnubisCont';
    cont0.addChild(cont);
    const rad = TP.ankh1Rad, r2 = TP.ankh1Rad / 2, y = wh.height / 2 + r2;
    const sgap = (wh.width / sc - 6 * rad) / 4;
    [rad, rad, rad].forEach((radi, i) => {
      const circle = new CircleShape('lightgrey', radi, this.color);
      circle.x = sgap + radi + i * (2 * radi + sgap);
      circle.y = y;
      cont.addChild(circle);
      const hex = table.newHex2(0, 0, `amun-${i}`, SpecialHex) as SpecialHex;
      this.anubisHexes.push(hex);
      hex.cont.visible = false;
      cont.localToLocal(circle.x, circle.y, hex.cont.parent, hex.cont);
      hex.legalMark.setOnHex(hex);
    });
    return cont0;
  }
  override doSpecial(query: string) {
    switch (query) {
      case 'empty': {
        return this.anubisHexes.find(ah=> ah.figure === undefined);
      }
      case 'occupied': {
        return this.anubisHexes.filter(ah => ah.figure !== undefined);
      }
    }
    return this.anubisHexes;
  }
}

class Amun extends God {
  _tokenFaceUp = true;
  get tokenFaceUp() { return this._tokenFaceUp; }
  set tokenFaceUp(v: boolean) {
    this._tokenFaceUp = v;
    this.token.text = v ? 'Two Cards' : 'Face Down';
    this.token.paint(v ? C.legalRed : C.grey );
  }
  constructor() { super('Amun', 'red') }

  override get nCardsAllowedInBattle(): number {
    return this.tokenFaceUp ? 2 : 1
  }
  token = new UtilButton(C.legalRed, 'Two Cards', TP.ankh1Rad);

  override doSpecial(faceUp: boolean): void {
    this.tokenFaceUp = faceUp;
  }
  override makeSpecial(cont: Container, wh: WH, table: Table): Container {
    super.makeSpecial(cont, wh, table);
    const token = this.token;
    token.x = wh.width / 2; token.y = wh.height * .6;
    cont.addChild(token);
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
  osirisHex: SpecialHex;
  osirisSource: AnkhSource<Portal>;
  override makeSpecial(cont: Container, wh: WH, table: Table): Container {
    super.makeSpecial(cont, wh, table);
    const hex = this.osirisHex = table.newHex2(0, 0, `portals`, SpecialHex) as SpecialHex; hex.scale = .6;
    cont.localToLocal(wh.width / 2, wh.height / 2 + 7, hex.cont.parent, hex.cont);
    const source = this.osirisSource = Portal.makeSource0(AnkhSource<Portal>, Portal, this.player, hex, 3);
    source.counter.y -= TP.ankh2Rad * 1.5;
    source.counter.x += TP.ankh2Rad * .5;
    table.sourceOnHex(source, hex);
    return cont;
  }

  override doSpecial(vis = true) {
    this.osirisSource.filterUnits(unit => (unit.highlight(vis), false));
  }
}

class Ra extends God {
  constructor() { super('Ra', 'yellow') }
}

class SetGod extends God {
  constructor() { super('Set', '#F1C40F') } // ~ C.coinGold
}

class Toth extends God {
  constructor() { super('Toth', 'cyan') }
}

// List all the God constructors:
const godCbyName: {[index: string]: Constructor<God>} = {Anubis: Anubis, Amun: Amun, Bastet: Bastet, Hathor: Hathor, Horus: Horus, Isis: Isis, Osiris: Osiris, Ra: Ra, Set: SetGod, Toth: Toth};

// godSpecs.forEach(god => new god());
