import { C, Constructor, XY, stime } from "@thegraid/common-lib";
import { Container, Graphics } from "@thegraid/easeljs-module";
import { AnkhHex } from "./ankh-map";
import { NumCounter } from "./counters";
import { GP } from "./game-play";
import { Hex, Hex1, Hex2 } from "./hex";
import { H } from "./hex-intfs";
import { Meeple } from "./meeple";
import { Player } from "./player";
import { C1, CenterText, CircleShape, HexShape, PaintableShape } from "./shapes";
import { DragContext } from "./table";
import { TP } from "./table-params";
import { MapTile, Tile } from "./tile";
import { TileSource } from "./tile-source";


export class AnkhSource<T extends Tile> extends TileSource<T> {
  static dummyCounter = new NumCounter('dummy');
  constructor(type: Constructor<T>, player: Player, hex: Hex2, xy?: XY, counter?: NumCounter) {
    const myCounter = () => {
      if (!counter) {
        const makeCounter = (name: string, initValue: number, color: string, fontSize: number, fontName?: string, textColor?: string) => {
          return new NumCounter(name, initValue, 'rgba(240,240,240,.6)', fontSize, fontName, textColor);
        }
        const radius = type.prototype.radius ?? 0, fs = TP.hexRad / 2, x0 = radius / 2, y0 = radius - fs / 4;
        const cont = hex.map.mapCont.counterCont; // GP.gamePlay.hexMap.mapCont.counterCont;
        const { x, y } = hex.cont.localToLocal(xy ? xy.x ?? x0 : x0, xy ? xy.y ?? y0 : y0, cont);
        const counter = makeCounter(`${type.name}:${player?.index ?? 'any'}`, 0, `lightblue`, TP.hexRad / 2);
        counter.attachToContainer(cont, { x: counter.x + x, y: counter.y + y });
        return counter;
      }
      return counter;
    }
    super(type, player, hex, myCounter());
  }

  override makeCounter(name: string, initValue: number, color: string, fontSize: number, fontName?: string, textColor?: string): NumCounter {
    return new NumCounter(name, initValue, 'rgba(240,240,240,.6)', fontSize, fontName, textColor);
  }
}

/** Monument, Portal  */
export class AnkhPiece extends MapTile {
  constructor(player: Player, serial: number, Aname?: string) {
    super(`${Aname}\n${serial}`, player);
  }
  override get hex() { return super.hex as AnkhHex; }
  override set hex(hex: AnkhHex) { super.hex = hex; }

  // TODO: can we put this in Tile? as common code with Meeple.moveTo override.
  override moveTo(hex: Hex1) {
    const source = this.source;
    const fromHex = this.hex;
    const toHex = super.moveTo(hex);  // may collide with source.hex.meep
    if (source && fromHex === this.source.hex && fromHex !== toHex) {
      source.nextUnit()   // shift; moveTo(source.hex); update source counter
    }
    return hex;
  }
  isPhase(name: string) {
    return GP.gamePlay.isPhase(name);
  }

  isStableHex(hex: Hex1) {
    return (Player.allPlayers.find(p => p.stableHexes.includes(hex as Hex2)));
  }

  override sendHome(): void {
      super.sendHome()
  }
}
export class Monument extends AnkhPiece {

  override get radius() { return TP.ankh2Rad }
  override textVis(vis?: boolean): void {
      super.textVis(true);
  }

  constructor(player: Player, serial: number, Aname = 'Monument') {
    super(player, serial, Aname);
    this.nameText.y -= this.radius/2;
  }

}
export class Pyramid extends Monument {
  constructor(player: Player, serial?: number) {
    super(player, serial, 'Pyramid');
    this.baseShape.cgf = (color) =>  new Graphics().f(color).dp(0, 0, this.radius, 3, 0, 30);;
  }
}

export class Obelisk extends Monument {
  constructor(player: Player, serial?: number) {
    super(player, serial, 'Obelisk');
    this.baseShape.cgf = (color) =>  {
      const r = this.radius, h = 1.8 * r, w = h/8;
      return new Graphics().f(color).dr(-w/2, -h / 2, w, h);
    }
  }
}

export class Temple extends Monument {
  static deg45 = H.degToRadians * 45;
  constructor(player: Player, serial?: number) {
    super(player, serial, 'Temple');
    this.baseShape.cgf = (color) =>  new Graphics().f(color).dp(0, 0, this.radius, 4, 0, 45);;
  }
}

export class Portal extends AnkhPiece {
  static source = [[]]; // per-player source, although only 1 Osiris player...
  static makeSource(player: Player, hex: Hex2, n = TP.warriorPerPlayer) {
    return AnkhPiece.makeSource0(AnkhSource<Portal>, Portal, player, hex, n);
  }
  static radius0 = TP.ankh2Rad;
  static dr = 3;
  override get radius() { return Portal.radius0 + Portal.dr };

  constructor(player: Player, serial?: number) {
    super(player, serial, 'Portal');
    const base = this.baseShape;
    const hscgf = base.cgf;
    base.cgf = (color) => {
      base.graphics.c().f(color).dp(0, 0, this.radius, 6, 0, 0);
      return hscgf('rgba(80,80,80,.8)');
    }
   }

   override makeShape(): PaintableShape {
    return new HexShape(Portal.radius0); // hexgon properly oriented...
   }

  override isLegalTarget(toHex: Hex1, ctx?: DragContext): boolean {
    if (this.isPhase('Summon')) {
      if (this.isStableHex(this.hex)) {

      }
    }
    return false;
  }
}


// Figure == Meeple: [underlay, [baseShape, bitmapImage?], backSide]
/** GodFigure, Warrior, Guardian */
export class Figure extends Meeple {

  static get allFigures() { return Meeple.allMeeples.filter(meep => meep instanceof Figure) }

  constructor(player: Player, serial: number, Aname?: string) {
    super(Aname ?? `${Aname}\n${serial}`, player);
    this.underlay = new CircleShape();
    this.addChildAt(this.underlay, 0);
    this.underlay.visible = false;
  }
  underlay: CircleShape;

  override get hex() { return super.hex as AnkhHex; }
  override set hex(hex: AnkhHex) { super.hex = hex; }

  override paint(pColor = this.player?.color, colorn = pColor ?? C1.grey) {
    this.paintRings(colorn, colorn, 4, 4); // one fat ring...
  }

  makeUnderlay() {
    const underlay = new CircleShape();
    underlay.visible = false;
    this.addChildAt(underlay, 1);
    return underlay;
  }

  highlight(show = true, color = C.WHITE, dr = 4) {
    const rad = this.radius + dr;
    if (show) {
      // cgf with color *and* rad:
      this.underlay.cgf = (color) => new Graphics().f(color).dc(0, 0, rad);
      this.underlay.paint(color);
      this.underlay.visible = true;
      if (this.cacheID) {
        const { x, y, width, height } = this.getBounds();
        const nw = Math.max(width, 2 * rad), dw = nw - width;
        this.cache(x - dw / 2, y - dw / 2, nw, nw); // assume symmetry
      }
    } else {
      this.underlay.visible = false;
      this.updateCache();
    }
    this.stage?.update();
    return this;
  }

  override moveTo(hex: Hex1) {
    const startHex = this.startHex;
    const rv = super.moveTo(hex);
    if (GP.gamePlay.isPhase('Summon') && startHex) {
      this.startHex = startHex;
    }
    return rv;
  }
  override dragStart(ctx: DragContext): void {
    // console.log(stime(this, `.dragStart:`), ctx.tile, ctx.targetHex);
    super.dragStart(ctx);
  }

  override dropFunc(targetHex: Hex2, ctx: DragContext): void {
    super.dropFunc(targetHex, ctx);
  }

  isPhase(name: string) {
    return GP.gamePlay.isPhase(name);
  }

  isStableHex(hex: Hex1) {
    return (Player.allPlayers.find(p => p.stableHexes.includes(hex as Hex2)));
  }

  isLegalWater(hex: AnkhHex) {
    return (hex.terrain !== 'w');
  }

  get isOsirisSummon() {
    return !!this.isStableHex(this.hex) && this.isPhase('Summon') && this.player?.god.Aname === 'Osiris';
  }
  isOccupiedLegal(hex: AnkhHex, ctx: DragContext) {
    return !hex.piece || ((hex.piece instanceof Portal) && this.isOsirisSummon);
  }

  override isLegalRecycle(ctx: DragContext): boolean {
    return ctx.lastShift;
  }

  override isLegalTarget0(hex: AnkhHex, ctx?: DragContext) {  // Meeple
    if (!hex) return false;
    // AnkhToken can moveTo Monument, but that is not a user-drag.
    if (!this.isOccupiedLegal(hex, ctx)) return false;
    if (!hex.isOnMap) return false; // RecycleHex is "on" the map?
    if (!ctx?.lastShift && this.backSide.visible) return false;
    return true;
  }
  isLegalSummon(hex: AnkhHex, ctx?: DragContext) {
    if (!(hex.findAdjHex(adj => adj.piece?.player === this.player && adj.piece !== this))) return false;
    return true;
  }
  isLegalMove(hex: AnkhHex, ctx?: DragContext) {
    return (hex.isOnMap && this.distWithin(hex, this.hex, 3));
  }

  override isLegalTarget(hex: AnkhHex, ctx?: DragContext) { // Police
    if (!this.isLegalTarget0(hex, ctx)) return false;
    if (!this.isLegalWater(hex)) return false;              // Apep can Summon to water!

    // isSummon: adjacent to existing, player-owned Figure or Monument.
    if (this.isPhase('Summon')) {
      return this.isStableHex(this.hex) && this.isLegalSummon(hex, ctx);
      // TODO: account for Pyramid power: after a non-Pyramid placement, only adj-Pyramid is legal.
    }
    if (this.isPhase('Move')) {
      return this.isLegalMove(hex, ctx);
    }
    if (this.isPhase('ConflictInRegion')) {
      // apply when teleporting to Temple: if gameState.phase == Battle
      if (this.player?.god.ankhPowers.includes('Obelisk')) {
        const obelisk = (hex.tile instanceof Obelisk) ? hex.tile : undefined;
        return (obelisk?.player === this.player);
      }
    }
    return false;
  }

  distWithin(hex: Hex, target: Hex, n = 3) {
    // TODO: optimize; use only links in the right direction?
    const loop = (testhex: Hex, n = 3, excl: Hex[] = []) => {
      if (testhex === target) return true;
      if (Math.abs(testhex.row - target.row) > n || Math.abs(testhex.col - target.col) > n) return false;
      excl.push(testhex);

      return !!testhex.findLinkHex(lhex => {
        if (lhex === target) return true;
        if (n <= 1) return false;
        if (excl.includes(lhex)) return false;
        return loop(lhex, n - 1, excl);
      });
    }
    return loop(hex, n);
  }

}

export class GodFigure extends Figure {
  /** so we can keep GodFigures as singlton instances of each type. */
  static named(name: string) {
    const allMeeps = Meeple.allMeeples;
    const allGodFigs = allMeeps.filter(meep => meep instanceof GodFigure );
    const namedGod = allGodFigs.find(fig => fig.Aname === name) as GodFigure;
    return namedGod;
    // return Meeple.allMeeples.find(meep => meep instanceof GodFigure && meep.name == name) as GodFigure;
  }

  constructor(player: Player, serial?: number, Aname?: string) {
    super(player, serial, Aname);
    this.name = this.Aname;
  }
  override sendHome(): void {
    this.moveTo(undefined);   // "there's no place like home" (home is like no-place...)
    return;
  }

  override get radius() { return TP.ankh2Rad; }

  override isLegalRecycle(ctx: DragContext): boolean {
    return false;
  }

}

export class Warrior extends Figure {
  private static source: AnkhSource<Warrior>[][] = [[]];  // makeSource sets

  /**
   * invoke Warrior.makeSource(player, hex, n) to create all the Warriors for Player.
   * makeSource0 will invoke new Warrior(), etc.
   */
  static makeSource(player: Player, hex: Hex2, n = TP.warriorPerPlayer) {
    return Warrior.makeSource0(AnkhSource<Warrior>, Warrior, player, hex, n);
  }

  override get radius() { return TP.ankh1Rad }

  // Warrior
  constructor(player: Player, serial: number) {
    super(player, serial, `W:${player.index+1}`, );
    // this.nameText.y -= this.radius / 5;
  }
}

export class Guardian extends Figure {

  static makeSource(hex: Hex2, guard: Constructor<Guardian>, n = 0) {
    return Guardian.makeSource0(AnkhSource<Guardian>, guard, undefined, hex, n);
  }

  override isLegalTarget(hex: AnkhHex, ctx?: DragContext): boolean {
    // Coming from global source:
    if (this.hex === this.source.hex) {
      // allow moveTo a stable if ctx.lastShift
      const index = GP.gamePlay.table.guardSources.findIndex(s => s === this.source) + 1;
      const toStable =  !!GP.gamePlay.allPlayers.find(p => p.stableHexes[index] === hex);
      if (ctx.lastShift && toStable && !hex.occupied) return true;
    }
    return super.isLegalTarget(hex, ctx);
  }

  override dropFunc(targetHex: Hex2, ctx: DragContext): void {
    if (this.isStableHex(targetHex)) {
      const plyr = GP.gamePlay.allPlayers.find(p => p.stableHexes.includes(targetHex))
      this.setPlayerAndPaint(plyr);
    }
    super.dropFunc(targetHex, ctx);
  }

  override sendHome(): void {
    this.setPlayerAndPaint(undefined);
    super.sendHome();
  }
}
class Guardian1 extends Guardian {
  override get radius() { return TP.ankh1Rad; }
}

class Guardian2 extends Guardian {
  override get radius() { return TP.ankh2Rad; }
}

class Guardian3 extends Guardian {
  override get radius() { return TP.ankh2Rad; }
}

export class Satet extends Guardian1 {
  constructor(player: Player, serial: number) {
    super(player, serial, `Satet`);
  }
}

export class MumCat extends Guardian1 {
  constructor(player: Player, serial: number) {
    super(player, serial, `MCat`);
  }

}

export class Apep extends Guardian2 {
  constructor(player: Player, serial: number) {
    super(player, serial, `Apep`);
  }
  override isLegalWater(hex: AnkhHex): boolean {
    // can Summon to water; but not move water-to-water!
    return this.isStableHex(this.hex) ? true : super.isLegalWater(hex);
  }
  override isLegalTarget(hex: AnkhHex, ctx?: DragContext): boolean {
    return super.isLegalTarget(hex, ctx);
  }
}

export class Mummy extends Guardian2 {
  constructor(player: Player, serial: number) {
    super(player, serial, `Mummy`);
  }
}

export class Scorpion extends Guardian3 {
  // Constructed from Meeple.makeSource0()
  constructor(player: Player, serial: number) {
    super(player, serial, `Scorpion`);
    this.nameText.y -= this.nameText.getMeasuredHeight() / 4; // not clear why 3, rather than 2
    const { x, y, width, height } = H.hexBounds(TP.hexRad, TP.useEwTopo ? 0 : 30);
    this.setBounds(x, y, width, height * 1.1);
    this.cache(x, y, width, height);
    this.addDirDisk();
  }

  dirDisk: Container;
  dirRot = 0;
  a1: CenterText;
  a2: CenterText;
  addDirDisk() {
    const uparrow = '\u2191', ax = this.radius/2, ay = this.radius * .8, ang = 30;
    const a1 = this.a1 = new CenterText(uparrow, this.radius/2, this.player?.colorn ?? C.black);
    const a2 = this.a2 = new CenterText(uparrow, this.radius/2, this.player?.colorn ?? C.black);
    a1.rotation = -ang;
    a2.rotation = ang;
    a1.x = -ax; a2.x = ax;
    a1.y = a2.y = -ay;
    const dirDisk = this.dirDisk = new Container();
    dirDisk.rotation = 30 + this.dirRot * 60;
    dirDisk.addChild(a1, a2);
    this.addChild(dirDisk);
  }
  diskRotate() {
    this.dirDisk.rotation = 30 + (this.dirRot = ++this.dirRot % 6) * 60;
    this.updateCache();
    console.log(stime(this, `.Scorpion: attackDirs =`), this.attackDirs);
  }
  override dropFunc(targetHex: Hex2, ctx: DragContext): void {
    super.dropFunc(targetHex, ctx);
    if (this.hex !== this.startHex) {
      this.diskRotate();
    }
  }
  get attackDirs() {
    const rot1 = this.dirRot;
    const rot2 = (rot1 + 1) % 6;
    return [H.nsDirs[rot1], H.nsDirs[rot2]];
  }
  override paint(pColor?: string, colorn?: string): void {
    if (this.a1) {
      let color = colorn ?? C.black;
      if (C.dist(color, C.white) < 50) color = C.black;
      this.a1.color = color;
      this.a2.color = color;
    }
    super.paint(pColor, colorn);
  }


}

export class Androsphinx extends Guardian3 {
  constructor(player: Player, serial: number) {
    super(player, serial, `Andro\nsphinx\n${serial}`, );
    this.nameText.y -= this.nameText.getMeasuredHeight() / 4; // not clear why 3, rather than 2
  }
}
