import { C, Constructor, WH, className } from "@thegraid/common-lib";
import { Container, Graphics, Shape } from "@thegraid/easeljs-module";
import { AnkhMeeple, AnkhPiece, AnkhSource, Figure, Monument, Portal } from "./ankh-figure";
import { GP } from "./game-play";
import { Hex1, Hex2 } from "./hex";
import type { Meeple } from "./meeple";
import { Player } from "./player";
import { CenterText, CircleShape } from "./shapes";
import { DragContext, Table } from "./table";
import { TP } from "./table-params";
import { Tile } from "./tile";


export class AnkhToken extends AnkhMeeple {
  static source: AnkhSource<AnkhToken>[] = [];

  static makeSource(player: Player, hex: Hex2, token: Constructor<AnkhMeeple>, n: number) {
    return AnkhToken.makeSource0(AnkhSource<AnkhToken>, token, player, hex, n);
  }
  override get radius() { return TP.ankhRad; }
  override isDragable(arg: DragContext) {
    return this.hex && GP.gamePlay.isPhase('Claim');
  }

  constructor(player: Player, serial: number) {
    super(player, serial, `Ankh`);// `Ankh:${player?.index}\n${serial}`, player);
    this.name = `Ankh:${player?.index}-${serial}`;
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
        this.highlight(false);
      }
    }
    return rv;
  }

  override isLegalTarget(hex: Hex1, ctx?: DragContext): boolean {
    const tile = hex.tile, player = this.player;
    const allMonuments = GP.gamePlay.hexMap.hexAry.filter(hex => (hex.tile instanceof Monument)).map(hex => hex.tile);
    const allUnclaimed = allMonuments.filter(mon => mon.player === undefined);;
    const canBeClaimed = (tile instanceof Monument) && ((allUnclaimed.length === 0) ? true : (tile.player === undefined));
    const isClaimable = hex.findLinkHex(adj => adj.meep?.player === player);
    if (isClaimable && canBeClaimed && (this.hex === this.source.hex) && GP.gamePlay.isPhase('Claim')) return true;
    return false;
  }
}

/** Looks like AnkhToken, but is just a marker for Actions & Events */
export class AnkhMarker extends Container {
  constructor(color: string, rad = TP.ankhRad) {
    super();
    this.name = className(this);
    const shape = new CircleShape(color, rad, );
    const ankh = new CenterText(`${'\u2625'}`, rad * 2.2, C.black);
    ankh.y += rad * .1;
    this.addChild(shape);
    this.addChild(ankh);
  }
}
export class God {
  static byName = new Map<string, God>();

  static get constructors() { return constructors }

  static get allGods() {
    return Array.from(God.byName).map(([gname, god]) => god);
  }
  static get allNames() {
    return Array.from(constructors).map((god) => god.name);
  }

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
/** AmunHex scales the Tile or Meep by .8 */
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

  override get tile() { return super.tile; }

  override set tile(tile: Tile) {
    if (tile === undefined && this.tile) {
      this.tile.scaleX = this.tile.scaleY = 1;
      this.tile.updateCache();
    }
    super.tile = tile;
    if (tile !== undefined) {
      tile.scaleX = tile.scaleY = AmunHex.scale;
      tile.updateCache();
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
  override makeSpecial(cont0: Container, wh: WH, table: Table): Container {
    super.makeSpecial(cont0, wh, table);
    const hex = table.newHex2(0, 0, `portals`, AmunHex)
    cont0.localToLocal(wh.width / 2, wh.height / 2 + 7, hex.cont.parent, hex.cont);
    const source = Portal.makeSource0(AnkhSource<Portal>, Portal, this.player, hex, 3);
    source.counter.y -= TP.ankh2Rad * 1.5;
    source.counter.x += TP.ankh2Rad * .5;
    table.sourceOnHex(source, hex);
    return cont0;
  }

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

// List all the God constructors:
const constructors: Constructor<God>[] = [Anubis, Amun, Bastet, Hathor, Horus, Isis, Osiris, Ra, SetGod, Toth];
// godSpecs.forEach(god => new god());
