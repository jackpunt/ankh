import { C, Constructor, WH, className } from "@thegraid/common-lib";
import { DragInfo } from "@thegraid/easeljs-lib";
import { Container, Shape } from "@thegraid/easeljs-module";
import { RegionMarker } from "./RegionMarker";
import { AnkhMeeple, AnkhSource, GodFigure, Portal, RadianceMarker, Warrior } from "./ankh-figure";
import { AnkhHex, RegionId, SpecialHex } from "./ankh-map";
import { Hex2 } from "./hex";
import { Player } from "./player";
import { CardSelector, PlayerPanel } from "./player-panel";
import { PowerIdent } from "./scenario-parser";
import { CenterText, CircleShape, PaintableShape, PolyShape, UtilButton } from "./shapes";
import type { DragContext, Table } from "./table";
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
  static get allGodNames() {
    return Array.from(God.byName).map(([gname, god]) => gname);
  }

  static get allNames() { return Object.keys(godCbyName); };

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
  readonly ankhPowers: PowerIdent[] = [];

  radius = TP.ankh2Rad;
  getAnkhMarker(rad = TP.ankhRad, color = this.color) {
    return new AnkhMarker(color, rad);
  }

  makeSpecial(cont: Container, wh: WH, table: Table, panel: PlayerPanel) {
    const fillc = 'rgb(140,140,140)';
    const rad = TP.ankhRad + 4, y = wh.height / 2 + rad / 2;
    const bg = new Shape(); bg.graphics.f(fillc).dr(0, 0, wh.width, wh.height)
    cont.addChild(bg);
    const tname = new CenterText(this.Aname, rad, 'white' );
    tname.x = wh.width / 2; tname.y += 2; tname.textBaseline = 'top';
    cont.addChild(tname);
  }
  doSpecial(...args: any[]): any { return; }

  get nCardsAllowedInBattle() { return 1; }
  set nCardsAllowedInBattle(n: number) { }
  figure: GodFigure;

  /** return 'any' (typically [...] or {...}); if (!undefined) it will be JSON'd into SetupElt['special'][godName] = saveState() */
  saveState(): any { return undefined; }
  /** restore state as materialized by saveState() */
  parseState(state: any) {}
}

class AnubisHex extends SpecialHex {
  anubis = God.byName.get('Anubis');
  override get meep(): AnkhMeeple {
    return super.meep;
  }
  override set meep(fig: AnkhMeeple) {
    if (fig !== undefined) {
      this.anubis.player.gamePlay.table.logText(`Anubis traps ${fig} of ${fig.player.godName}`);
    }
    super.meep = fig;
  }
}

class Anubis extends God {
  constructor() { super('Anubis', 'green') }
  anubisHexes: AnubisHex[] = [];

  override makeSpecial(cont: Container, wh: WH, table: Table, panel: PlayerPanel) {
    super.makeSpecial(cont, wh, table, panel);
    const cont2 = new Container(), sc = cont2.scaleX = cont2.scaleY = SpecialHex.scale;
    cont2.name = 'AnubisCont';
    cont.addChild(cont2);
    const rad = TP.ankh1Rad, r2 = TP.ankh1Rad / 2, y = wh.height / 2 + r2;
    const sgap = (wh.width / sc - 6 * rad) / 4;
    [rad, rad, rad].forEach((radi, i) => {
      const circle = new CircleShape('lightgrey', radi, this.color);
      circle.x = sgap + radi + i * (2 * radi + sgap);
      circle.y = y;
      cont2.addChild(circle);
      const hex = table.newHex2(0, 0, `amun-${i}`, AnubisHex) as AnubisHex;
      this.anubisHexes.push(hex);
      hex.cont.visible = false;
      cont2.localToLocal(circle.x, circle.y, hex.cont.parent, hex.cont);
      hex.legalMark.setOnHex(hex);
    });
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
  /** identify 1--3 Warriors from other Players */
  override saveState() {
    // ASSERT: player order will not change.
    const trapped = this.anubisHexes.map(hex => hex.figure?.player.index)
      .filter(pid => pid !== undefined);
    return { trapped };
  }
  override parseState(state: { trapped: number[] }): void {
    const trapped = state.trapped;
    trapped.forEach((pid, ndx) => {
      const player = this.player.gamePlay.allPlayers[pid];
      const source = Warrior.source[player.index]
      const warrior = source.takeUnit();
      warrior.moveTo(this.anubisHexes[ndx]);
    });
  }
}

class Amun extends God {
  _tokenFaceUp = true;
  get tokenFaceUp() { return this._tokenFaceUp; }
  set tokenFaceUp(v: boolean) {
    this._tokenFaceUp = v;
    this.token.label_text = v ? 'Two Cards' : 'Face Down';
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
  override makeSpecial(cont: Container, wh: WH, table: Table, panel: PlayerPanel) {
    super.makeSpecial(cont, wh, table, panel);
    const token = this.token;
    token.x = wh.width / 2; token.y = wh.height * .6;
    cont.addChild(token);
  }
}

class Bastet extends God {
  constructor() { super('Bastet', 'orange') }
}

class Hathor extends God {
  constructor() { super('Hathor', 'magenta') }
  // constructor() { super('Hathor', 'rgb(74,35,90)') }
}

class HorusMarker extends RegionMarker {
  static source: AnkhSource<HorusMarker>;
  static table: Table;
  constructor(player: Player, serial: number, Aname: string) {
    super(HorusMarker.table, 1, `Aname-${serial}`);
    this.regionId = undefined;
    return;
  }
  override makeShape(): PaintableShape {
    return new PolyShape(4, 0, C.nameToRgbaString('darkred', .8), this.radius, C.WHITE);
  }
  override dragStart(ctx: DragContext): void {
    this.regionId = undefined;
    super.dragStart(ctx);
  }
  override isLegalTarget(toHex: AnkhHex, ctx?: DragContext): boolean {
      ctx.nLegal = 1;
      if (!toHex || !toHex.isOnMap || toHex.terrain === 'w') return false;
      if (this.source.filterUnits(((unit: HorusMarker) => unit.regionId === toHex.regionId)).length > 0) return false;
      return true;
  }
  override dragFunc0(ankhHex: AnkhHex, ctx: DragContext): void {
    const hex = this.hexMap.hexUnderObj(this, false);
    const legalXY = !!hex && hex.isOnMap && hex.terrain !== 'w';
    const srcCont = (ctx.info as DragInfo).srcCont;
    if (legalXY) {
      ctx.targetHex = hex;
      this.regionId = hex.regionId;
      this.idText.text = `${this.regionId}`
      this.updateCache()
      // record location in original parent coordinates:
      this.parent.localToLocal(this.x, this.y, srcCont, this.lastXY);
      this.showTargetMark(hex, ctx);
    } else if (this.regionId === undefined) {
      this.showTargetMark(hex, ctx);
    } else {
      // keep this at lastXY (in dragCont coordinates):
      srcCont.localToLocal(this.lastXY.x, this.lastXY.y, this.parent, this);
    }
    return;
  }
  override dropFunc(hex: Hex2, ctx: DragContext): void {
    // const { x, y } = this.table.hexMap.mapCont.hexCont.localToLocal(hex.x, hex.y, hex.cont.parent);
    this.parent.addChild(this);
    if (this.regionId !== undefined) this.table.placeRegionMarker(this, hex as AnkhHex, this.x, this.y);
  }
  override sendHome(): void {
    this.regionId = undefined;
    super.sendHome();
  }
}


class Horus extends God {
  specialHex: SpecialHex;
  specialSource: AnkhSource<HorusMarker>;
  cardSelector: CardSelector;
  constructor() { super('Horus', 'darkred') }
  override makeSpecial(cont: Container, wh: WH, table: Table, panel: PlayerPanel) {
    super.makeSpecial(cont, wh, table, panel); cont.name = 'Horus-Special'
    HorusMarker.table = table;
    const hex = this.specialHex = table.newHex2(0, 0, `portalSrc`, SpecialHex) as SpecialHex; hex.scale = .9;
    cont.localToLocal(wh.width / 2, wh.height / 2 + 7, hex.cont.parent, hex.cont);
    const source = this.specialSource = HorusMarker.makeSource0(AnkhSource<HorusMarker>, HorusMarker, undefined, hex, 2);
    source.counter.y -= TP.ankh2Rad * .3;
    source.counter.x += TP.ankh2Rad * .5;
    table.sourceOnHex(source, hex);
    this.cardSelector = panel.makeCardSelector(`cs:Horus`);
    this.cardSelector.activateCardSelector(false, 'Ban Card', undefined);
  }
  override doSpecial(regionId?: RegionId | 'cardSelector') {
    if (regionId === 'cardSelector') {
      return this.cardSelector;
    }
    if (!regionId) return HorusMarker.source.filterUnits(hm => true).map(hm => hm.regionId);
    const inRegion = HorusMarker.source.filterUnits(hm => hm.regionId === regionId);
    return (inRegion[0] as HorusMarker);
  }
}

class Isis extends God {
  constructor() { super('Isis', 'lightblue') }
}

class Osiris extends God {
  constructor() { super('Osiris', 'lightgreen') }
  specialHex: SpecialHex;
  specialSource: AnkhSource<Portal>;

  override makeSpecial(cont: Container, wh: WH, table: Table, panel: PlayerPanel) {
    super.makeSpecial(cont, wh, table, panel);
    cont.name = 'Osiris-Special'
    const hex = this.specialHex = table.newHex2(0, 0, `portalSrc`, SpecialHex) as SpecialHex; hex.scale = .6;
    cont.localToLocal(wh.width / 2, wh.height / 2 + 7, hex.cont.parent, hex.cont);
    const source = this.specialSource = Portal.makeSource0(AnkhSource<Portal>, Portal, this.player, hex, 3);
    source.counter.y -= TP.ankh2Rad * .9;
    source.counter.x += TP.ankh2Rad * .5;
    table.sourceOnHex(source, hex);
  }

  override doSpecial(vis = true) {
    this.specialSource.filterUnits(unit => (unit.highlight(vis), false));
  }
}

class Ra extends God {
  constructor() { super('Ra', 'yellow') }

  specialCont: Container;
  specialSource: AnkhSource<RadianceMarker>;
  specialHex: SpecialHex;

  override makeSpecial(cont: Container, wh: WH, table: Table, panel: PlayerPanel) {
    super.makeSpecial(cont, wh, table, panel);;
    cont.name = `Ra-Special`;
    const hex = this.specialHex = table.newHex2(0, 0, `radSrc`, SpecialHex) as SpecialHex; hex.scale = .6;
    cont.localToLocal(wh.width / 2, wh.height / 2 + 7, hex.cont.parent, hex.cont);
    const source = this.specialSource = RadianceMarker.makeSource0(AnkhSource<RadianceMarker>, RadianceMarker, this.player, hex, 3);
    source.counter.y -= TP.ankh2Rad * .7;
    source.counter.x += TP.ankh2Rad * .5;
    table.sourceOnHex(source, hex);
  }
}

class SetGod extends God {
  constructor() { super('Set', '#F1C40F') } // ~ C.coinGold
  override makeSpecial(cont: Container, wh: WH, table: Table, panel: PlayerPanel): void {
    super.makeSpecial(cont, wh, table, panel);
    const rad = TP.ankhRad, x = wh.width/2, y = wh.height/2 - 6;// measuredHeight/2...
    const text = new CenterText(`Set controls adjacent\nWarriors & Guardians\nduring Conflict`, rad, 'white');
    text.x += x;
    text.y += y;
    cont.addChild(text);
  }
}

class Toth extends God {
  constructor() { super('Toth', 'cyan') }
}

// List all the God constructors:
const godCbyName: { [index: string]: Constructor<God> } = { Anubis: Anubis, Amun: Amun, Bastet: Bastet, Hathor: Hathor, Horus: Horus, Isis: Isis, Osiris: Osiris, Ra: Ra, Set: SetGod } as const;

// godSpecs.forEach(god => new god());
