import { C, Constructor, XY, className } from "@thegraid/common-lib";
import { Container, Graphics, Shape } from "@thegraid/easeljs-module";
import { AnkhHex, AnkhMap, StableHex } from "./ankh-map";
import { AnkhToken } from "./ankh-token";
import { NumCounter } from "./counters";
import { selectN } from "./functions";
import { Anubis, Bastet, God, SetGod } from "./god";
import { Hex, Hex1, Hex2 } from "./hex";
import { EwDir, H } from "./hex-intfs";
import { Meeple } from "./meeple";
import { Player } from "./player";
import { GuardName } from "./scenario-parser";
import { C1, CircleShape, HexShape, PaintableShape } from "./shapes";
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
        const cont = hex.map.mapCont.counterCont; // this.gamePlay.hexMap.mapCont.counterCont;
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
    super(`${Aname}-${serial}`, player);
    this.name = className(this);         // lookup className and store it.
  }
  override get hex() { return super.hex as AnkhHex; }
  override set hex(hex: AnkhHex) { super.hex = hex; }

  isPhase(name: string) {
    return this.gamePlay.isPhase(name);
  }

  isLegalWater(hex: AnkhHex) {
    return (hex.terrain !== 'w');
  }

  override sendHome(): void { // AnkhPiece
      super.sendHome()
  }
}
export class Monument extends AnkhPiece {
  static typeNames = ['Obelisk', 'Pyramid', 'Temple'];

  override get radius() { return TP.ankh2Rad }
  override textVis(vis?: boolean): void {
      super.textVis(vis);
  }

  constructor(player: Player, serial: number, Aname = 'Monument') {
    super(player, serial, Aname);
    this.nameText.y -= this.radius/2;
    const rad = this.radius;
    const hitArea = new Shape(new Graphics().f(C.black).dc(0, 0, rad))
    this.hitArea = hitArea;
    this.setBounds(-rad, -rad, rad * 2, rad * 2);
  }

  override isLegalTarget(toHex: AnkhHex, ctx?: DragContext): boolean {
    if (ctx.lastShift && toHex.isOnMap) return true;
    if (this.hex?.isOnMap) return false;    // can't move if already placed on map.
    if (!this.gamePlay.isPhase('BuildMonument')) return false;
    const panel = this.gamePlay.gameState.state.panels?.[0];   // current 'Build' player
    if (panel?.canBuildInRegion === undefined) return false;   // can't build IN conflictRegion; also: can't build outside conflictRegion.
    const regionNdx = this.gamePlay.gameState.conflictRegion - 1;
    const region = this.gamePlay.hexMap.regions[regionNdx];
    if (!region?.includes(toHex)) return false;  // now: toHex !== undefined, toHex.isOnMap
    if (toHex.occupied) return false;
    if (toHex.terrain == 'w') return false;
    return true;
  }

  override dropFunc(targetHex: Hex2, ctx: DragContext): void {
    super.dropFunc(targetHex, ctx);
    if (targetHex.isOnMap && !targetHex.meep) { // override placeTile?
      const tohex = targetHex as AnkhHex, map = tohex.map as AnkhMap<AnkhHex>;
      const gamePlay = this.gamePlay, gameState = gamePlay.gameState;
      if (!this.isPhase('BuildMonument')) return;
      const panel0 = gameState.state.panels[0]; // 'active' player.
      const regionId = panel0.canBuildInRegion, region = map.regions[regionId - 1];
      if (region?.includes(tohex)) {
        const ankh = panel0.ankhSource.takeUnit(), monument = this;
        ankh.moveTo(this.hex);
        // console.log(stime(this, `.dropFunc: emit buildDone panel0=`), panel0);
        setTimeout( () => this.gamePlay.table.dispatchEvent({ type: 'buildDone', panel0, monument }), 10);
      }
    }
  }

  override placeTile(toHex: Hex1, payCost?: boolean): void {
    super.placeTile(toHex, payCost);
    const ankhToken = this.fromHex?.meep as AnkhToken;
    if (ankhToken) {
      if (toHex && toHex !== this.fromHex) ankhToken.moveTo(this.hex);
      ankhToken.parent?.addChild(ankhToken); // above Monument
    }
  }

  override resetTile(): void {      // Monument AnkhToken.resetTile()
    const ankhToken = this.hex?.meep as AnkhToken;
    if (ankhToken) {
      ankhToken.sendHome();          // Assert: (this.hex.meep instanceof AnkhToken) but: circular dep...
    }
    this.setPlayerAndPaint(undefined); // un-Claim this Monument
  }
}

export class Pyramid extends Monument {
  constructor(player: Player, serial?: number) {
    super(player, serial, 'Pyramid');
    this.baseShape.cgf = (color) => new Graphics().f(color).dp(0, 0, this.radius, 3, 0, 30);
    this.updateCache();
  }
}

export class Obelisk extends Monument {
  constructor(player: Player, serial?: number) {
    super(player, serial, 'Obelisk');
    this.baseShape.cgf = (color) =>  {
      const r = this.radius, h = 1.8 * r, w = h/8;
      return new Graphics().f(color).dr(-w/2, -h / 2, w, h);
    }
    this.updateCache();
  }
}

export class Temple extends Monument {
  static deg45 = H.degToRadians * 45;
  constructor(player: Player, serial?: number) {
    super(player, serial, 'Temple');
    this.baseShape.cgf = (color) =>  new Graphics().f(color).dp(0, 0, this.radius, 4, 0, 45);;
    this.updateCache();
  }
}

export class Portal extends AnkhPiece {
  static source = [[]]; // per-player source, although only 1 Osiris player...
  static color = 'rgba(80,80,80,.8)';
  static dr = 3; // colored 'ring'
  static radius0 = TP.hexRad - Portal.dr - 2; // inner hex [or maybe the highlight is wrong, overwriting the green ring]
  override get radius() { return Portal.radius0 + Portal.dr };

  constructor(player: Player, serial?: number) {
    super(player, serial, 'Portal');
    const base = this.baseShape; // lexical bind the original baseShape
    const hscgf = base.cgf;
    base.cgf = (color) => {
      base.graphics.c().f(color).dp(0, 0, this.radius, 6, 0, 0);
      return hscgf(Portal.color);
    }
   }

  override makeShape(): PaintableShape {
    return new HexShape(Portal.radius0); // hexgon properly oriented...
  }

  highlight(vis = true) {
    this.paint(vis ? 'white' : this.player.color);
  }

  // override dropFunc(targetHex: Hex2, ctx: DragContext): void {
  //   super.dropFunc(targetHex, ctx);
  //   this.parent.addChildAt(this, 0); // under any Figure
  // }

  override cantBeMovedBy(player: Player, ctx: DragContext): string | boolean {
    return (ctx.phase === 'Osiris' || ctx.lastShift) ? undefined : 'Only after losing in Battle';
  }
   // at end of Battle: Osiris Special:
   // enable move Portal to any empty non-Water space in the conflictRegion.
   // any figure that was on the Portal remains where it was.
  override isLegalTarget(toHex: Hex1, ctx?: DragContext): boolean {
    return (ctx.phase === 'Osiris')
      && (toHex instanceof AnkhHex)
      && !toHex.occupied
      && (toHex.regionId === ctx.regionId)
  }
}

export class RadianceMarker extends AnkhPiece {
  static source: AnkhSource<RadianceMarker>[] = []; // per-player source, although only 1 Ra player...

  override get radius(): number { return TP.hexRad * H.sqrt3_2; }
  constructor(player: Player, serial: number) {
    super(player, serial, 'RaMark');
  }

  override makeShape(): PaintableShape {
    const rad = this.radius;
    const shape = new PaintableShape((color) => {
      return new Graphics().c().f(color).dp(0, 0, rad, 24, .4, 0).dc(0, 0, TP.ankh1Rad)
    });
    this.setBounds(-rad, -rad, rad * 2, rad * 2)
    return shape;
  }

  override textVis(vis?: boolean): void {
    super.textVis(vis);
    if (this.parent instanceof Figure) this.parent.updateCache();
  }

  override moveTo(hex: AnkhHex) {
    if (hex === this.source.hex) {
      super.moveTo(hex);
      return;
    }
    const figure = hex?.figure;
    if (figure) {
      figure.raMarker = this;
      const at = figure.children.indexOf(figure.baseShape);
      figure.addChildAt(this, at);     // below baseShape
      this.x = 0; this.y = 0;
      const { x, y, width, height } = this.getBounds()
      const { x: x0, y: y0, width: w0, height: h0} = figure.getBounds()
      figure.setBounds(Math.min(x, x0), Math.min(y, y0), Math.max(width, w0), Math.max(height, h0));
      {
        const { x, y, width, height } = figure.getBounds()
        figure.cache(x, y, width, height);
      }
      this.hex = undefined;            // take it off the source.hex
    } else if (this.parent instanceof Figure) {
      this.parent.raMarker = undefined;
      this.parent?.removeChild(this);
    } else if (hex === undefined) {
      super.moveTo(hex);
    }
  }

  override isLegalTarget(toHex: Hex1, ctx?: DragContext): boolean {
    if (!(ctx.phase === 'Summon' || ctx.lastShift)) return false;
    const figure = (toHex instanceof AnkhHex) && toHex.figure;
    return toHex.isOnMap
      && figure
      && figure.player === this.player
      && (figure instanceof Warrior || figure instanceof Guardian)
      && figure.raMarker === undefined;
  }
}

// AnkhMeeple == [underlay, [baseShape, bitmapImage?], backSide]
/** GodFigure, AnkhToken, Figure: Warrior, Guardian */
export class AnkhMeeple extends Meeple {

  constructor(player: Player, serial: number, Aname?: string) {
    super(`${Aname}-${serial}`, player);
    this.underlay = new CircleShape(); this.underlay.name = 'underlay-highlight';
    this.addChildAt(this.underlay, 0);
    this.underlay.visible = false;
    this.nameText.text = Aname.replace(/-/g, '\n');
    const nlines = this.nameText.text.split('\n').length - 1;
    if (nlines > 0) this.nameText.y -= nlines * this.nameText.getMeasuredHeight() / 4 * nlines;
  }
  underlay: CircleShape; // highlight when AnkhMeeple is moveable

  override get hex() { return super.hex as AnkhHex; }
  override set hex(hex: AnkhHex) { super.hex = hex; }

  makeUnderlay() {
    const underlay = new CircleShape();
    underlay.visible = false;
    this.addChildAt(underlay, 1);
    return underlay;
  }

  /** draw ring of size dr around the AnkhMeeple */
  highlight(show = true, color = C.BLACK, dr = 6) {
    const rad = this.radius + dr;
    if (show) {
      // cgf with color *and* rad:
      this.underlay.cgf = (color) => new Graphics().ss(dr).s(color).dc(0, 0, rad-dr/2);
      this.underlay.paint(color);
      this.underlay.visible = true;
      if (this.cacheID) {
        const { x, y, width, height } = this.getBounds();
        const nw = Math.max(width, 2 * rad), dw = nw - width;
        const nh = Math.max(height, 2 * rad), dh = nh - height;
        this.setBounds(x - dw / 2, y - dh / 2, nw, nh);
        this.cache(x - dw / 2, y - dh / 2, nw, nh);
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
    super.moveTo(hex);
    if (this.gamePlay.isPhase('Summon') && startHex) {
      this.startHex = startHex;
    }
  }

  override dragStart(ctx: DragContext): void {
    // console.log(stime(this, `.dragStart:`), ctx.tile, ctx.targetHex);
    super.dragStart(ctx);
  }

  override dropFunc(targetHex: Hex2, ctx: DragContext): void {
    super.dropFunc(targetHex, ctx);
  }

}

/** a marker, associated with a Hex, but not the hex.meep */
export class BastetMark extends AnkhMeeple {
  declare homeHex: AnkhHex; // the BastetHex 'source' hex.
  bastHex: AnkhHex;         // where this bmark is deployed.
  get bastetHexes() { return Bastet.instance.bastetHexes; }
  get bastetMarks() { return Bastet.instance.bastetHexes.map(hex => hex.bmark) }
  get regionId() { return this.bastHex ? this.bastHex.regionId : undefined }

  constructor(player: Player, index: number, public strength: number) {
    super(player, index, 'B-Cat');
    this.baseShape.cgf = this.bmcgf;
  }

  bmcgf(color: string) {
    return new Graphics().f(color).ss(2).s('black').dc(0, 0, this.radius - 1);
  }

  // BastetMark is on either its homeHex or its bastHex
  setOn(hex: AnkhHex) {
    const toHex = hex ?? this.bastHex ?? this.homeHex;
    toHex.map.mapCont.markCont.addChild(this);
    this.x = toHex.x ; this.y = toHex.y;
    if (toHex !== this.homeHex) {
      this.bastHex = toHex;
      this.x -= TP.ankh1Rad / 2;
    }
    toHex.map.update();
  }
  override sendHome(): void {
    this.bastHex = undefined;
    this.setOn(this.homeHex); this.moveTo
  }

  override cantBeMovedBy(player: Player, ctx: DragContext): string | boolean {
    if (player !== this.player.gamePlay.curPlayer) return 'not your turn';
    if (player === this.player && ctx.phase !== 'BastetDeploy' && !ctx.lastShift) return 'only during BastetDeploy';
    return undefined;
  }

  override dropFunc(targetHex: AnkhHex, ctx: DragContext): void {
    // super.dropFunc(targetHex, ctx);
    if (ctx.phase === 'BastetDeploy' || ctx.lastShift) {
      this.setOn(targetHex);
      this.player.gamePlay.logText(`Bastet[${this.strength}] deployed to ${this.bastHex}`);
    } else {
      // self-drop or drop on adj Figure of curPlayer.
      if (!targetHex || targetHex === this.bastHex) {
        this.setOn(this.bastHex)
      } else {
        const fig = targetHex.figure;
        if (this.strength === 0 && !(fig instanceof GodFigure)) {
          // bmark explodes, killing targetHex.Figure
          this.player.gamePlay.logText(`Bastet[${this.strength}] explodes, killing ${fig}`);
          fig.sendHome();
        } else {
          // bmark is disarmed, return to bastetHexes:
          this.player.gamePlay.logText(`Bastet[${this.strength}] disarmed by ${fig}`);
        }
        this.sendHome();
        this.gamePlay.gameState.setBastetDone();
      }
    }
  }

  override isLegalTarget(hex: AnkhHex, ctx?: DragContext): boolean {
    if (ctx.phase === 'BastetDeploy' || ctx.lastShift) {
      if (!(hex?.isOnMap && (hex.regionId >= 1))) return false;
      if (!(hex.tile instanceof Monument)) return false;
      const inSameRegion = (hex.regionId === this.bastHex?.regionId);
      if (inSameRegion) return true;
      const deployedRegions = this.bastetHexes.filter(hex => hex.bmark.bastHex).map(hex => hex.bmark.bastHex.regionId);
      const otherInRegion = deployedRegions.includes(hex.regionId);
      return !otherInRegion;
    } else {
      const player = this.player.gamePlay.curPlayer;
      const isAdj = hex.findAdjHex(adj => adj === this.bastHex);
      return isAdj && hex.figure?.player === player;
    }
  }
}

export class Figure extends AnkhMeeple {

  static get allFigures() { return Meeple.allMeeples.filter(meep => meep instanceof Figure) as Figure[] }

  override paint(pColor = this.player?.color, colorn = pColor ?? C1.grey) {
    this.baseShape.mscgf(colorn, 6, 0);     // [width-2 @ r-1]
    this.updateCache();
    return;
  }
  isLegalWater(hex: AnkhHex) {
    return (hex.terrain !== 'w');
  }

  /** Check for adjacent Set durning Conflict. */
  get controller() {
    const setGod = SetGod.instance;  // Special treatment when Set is on the table
    const ownedBySet = !!setGod
      && this.player.gamePlay.isConflictState
      && !(this instanceof GodFigure)
      && !!this.hex.findAdjHex(hex => hex?.figure === setGod.figure);
    this._lastController = (ownedBySet ? setGod : this.player.god);
    return this.lastController;
  }
  _lastController: God;
  get lastController() { return this._lastController ?? this.player.god; } // for Set

  raMarker: RadianceMarker;  // for Ra
  removeRa() {
    if (this.raMarker) {
      this.raMarker.sendHome();
      this.raMarker = undefined;
      this.updateCache();
    }
  }

  override resetTile(): void {
    this.removeRa();
    super.resetTile();
  }

  /** summon from Stable to Portal on map */
  isOsirisSummon(hex: AnkhHex, ctx: DragContext) {
    if (!(ctx.phase === 'Summon' || ctx.lastShift)) return false;
    return hex?.isOnMap
      && (hex.tile instanceof Portal)
      && (hex.meep === undefined)
      && this.isFromStable
      && (this.player?.godName === 'Osiris')
  }
  isOccupiedLegal(hex: AnkhHex, ctx: DragContext) {
    return !hex.piece;
  }
  isAnubisSummon() {
    // Can Summon from Anumbis special hexes if player can pay the ransom:
    const isFromAnubisHex = Anubis.instance?.isAnubisHex(this.hex);
    return (isFromAnubisHex && this.player.coins > 0);
  }

  override cantBeMovedBy(player: Player, ctx: DragContext): string | boolean {
    // see also Meeple.canBeMovedBy: canAutoUnmove && backside.visible
    if (ctx.phase === ('Obelisks')) {
      const oplayer = player.gamePlay.gameState.state.panels[0].player;
      return (ctx?.lastShift || this.controller === oplayer.god) ? undefined : "Not your Tile";
    }
    return super.cantBeMovedBy(player, ctx);
  }

  override isLegalRecycle(ctx: DragContext): boolean {
    return ctx.lastShift;
  }
  isObeliskMove(hex: AnkhHex, ctx?: DragContext) {
    if (ctx.phase !== 'Obelisks') return false;
    const gameState = ctx.gameState, rNdx = gameState.conflictRegion - 1;
    const player = gameState.state.panels[0].player;
    const region = gameState.gamePlay.hexMap.regions[rNdx];
    if (!region.includes(hex)) return false;
    const obeliskAdj = !!hex.findAdjHex(hex => (hex.tile instanceof Obelisk) && hex.tile.player === player)
    return obeliskAdj;
  }

  override isLegalTarget0(hex: AnkhHex, ctx?: DragContext) {  // Meeple
    if (!hex) return false;
    if (!hex.isOnMap) return false; // RecycleHex is "on" the map?
    if (this.backSide.visible && !ctx?.lastShift) return false;
    // AnkhToken (not a Figure!) can moveTo Monument, but that is not a user-drag.
    if (this.player.godName === 'Osiris' && hex.tile?.name === 'Portal' && !hex.meep) return true;
    if (!!hex.occupied) return false;
    return true;
  }

  get isFromStable() { return false; }

  isLegalSummon(hex: AnkhHex, ctx?: DragContext) {
    // must be adjacent to Monument or Figure owned by Player:
    return hex.findAdjHexByRegion(adj =>
      !hex.occupied && (adj.tile instanceof Monument) ? (adj.tile.player === this.player) : (adj.figure?.player === this.player));
  }

  isLegalMove(hex: AnkhHex, ctx?: DragContext) {
    return (hex.isOnMap && this.distWithin(hex, this.hex, 3));
  }

  override isLegalTarget(hex: AnkhHex, ctx?: DragContext) { // Police
    if (this.isOsirisSummon(hex, ctx)) return true;         // is Summon from Stable to Portal hex on map.
    if (!this.isLegalTarget0(hex, ctx)) return false;
    if (!this.isLegalWater(hex)) return false;              // Apep can Summon to water!

    // isSummon: adjacent to existing, player-owned Figure or Monument.
    if ((this.isFromStable || this.isAnubisSummon() ) && (ctx.phase === ('Summon') || ctx.lastShift)) {
      return this.isLegalSummon(hex, ctx);
      // TODO: account for Pyramid power: after a non-Pyramid placement, only adj-Pyramid is legal.
    }
    if (ctx.phase === ('Move') || ctx.lastShift) {
      return this.isLegalMove(hex, ctx);
    }
    if (ctx.phase === ('Obelisks')) {
      if (this.isObeliskMove(hex, ctx)) return true;
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

  constructor(player: Player, serial?: number, god?: God) {
    super(player, serial, god.Aname);
    god.figure = this;
  }

  override get radius() { return TP.ankh2Rad; }

  override isLegalRecycle(ctx: DragContext): boolean {
    return false;
  }
}

export class Warrior extends Figure {
  static source: AnkhSource<Warrior>[] = [];  // makeSource sets

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

  override get isFromStable(): boolean {
    return this.hex === this.source.hex;
  }

  override placeTile(toHex: Hex1, payCost?: boolean): void {
    const isFromAnubisHex = (God.byName.get('Anubis') as Anubis)?.isAnubisHex(this.fromHex);
    if (isFromAnubisHex && toHex.isOnMap) {
      this.player.gamePlay.gameState.addFollowers(this.player, -1, `Ransom to Amun for ${this.Aname}`);
    }
    super.placeTile(toHex, payCost);
  }
}

export class Guardian extends Figure {
  static source: AnkhSource<Guardian>;
  static get constructors() { return guardianConstructors } // Global godConstructors at bottom of file;
  static byName = new Map<GuardName, Constructor<Guardian>>();
  static setGuardiansByName() {
    Guardian.constructors.forEach(cons => Guardian.byName.set(cons.name, cons));
  }

  static get allGuardians() {
    return Array.from(Guardian.byName).map(([gname, guard]) => guard);
  }
  static get allNames() {
    return Array.from(Guardian.constructors).map((guard) => guard.name);
  }

  static namesByRank: GuardName[][] = [['Satet', 'CatMum'], ['Apep', 'Mummy'], ['Scorpion', 'Androsphinx']];
  static get randomGuards() {
    const guardianC = Guardian.namesByRank.map(ga => ga.map(gn => Guardian.byName.get(gn)));
    return guardianC.map(gs => selectN(gs, 1)[0])
  }
  static randomGuard(rank: 0 | 1 | 2) {
    return selectN(Guardian.namesByRank[rank], 1)[0]
  }

  static makeSource(hex: Hex2, guard: Constructor<Guardian>, n = 0) {
    return Guardian.makeSource0(AnkhSource<Guardian>, guard, undefined, hex, n);
  }

  constructor(player?: Player, serial?: number, Aname?: string) {
    super(player, serial, Aname)
  }

  override get isFromStable(): boolean {
    return this.hex.isStableHex();
  }

  override isLegalTarget(hex: AnkhHex, ctx?: DragContext): boolean {
    // Coming from global source:
    if (this.hex === this.source.hex) {
      // allow moveTo a stable (takeGuardianIfAble) if ctx.lastShift:
      const toStable = hex.isStableHex() && (hex.size === this.radius) && !hex.usedBy;
      if (ctx.lastShift && toStable) return true;
      return false;
    }
    // if ctx.lastShift: allow move from stable as if phase: 'Summon'
    if (ctx.lastShift && this.hex.isStableHex()) {
      return super.isLegalTarget(hex, { ...ctx, phase: 'Summon' });
    }
    if (ctx.lastShift && this.hex.isOnMap) {
      return super.isLegalTarget(hex, { ...ctx, phase: 'Move' });
    }
    return super.isLegalTarget(hex, ctx);
  }

  override dropFunc(targetHex: AnkhHex, ctx: DragContext): void {
    if (targetHex.isStableHex()) {
      const plyr = this.gamePlay.allPlayers.find(p => p.stableHexes.includes(targetHex as StableHex))
      this.setPlayerAndPaint(plyr);
    }
    super.dropFunc(targetHex, ctx);
  }

  override resetTile(): void {
    if (this.stableHex) {
      this.stableHex.usedBy = undefined;
      this.homeHex = undefined;
    }
    super.resetTile()
  }

  get stableHex() { return this.homeHex as StableHex; } // player.stableHexes.find(hex => hex.usedBy === this)

  override sendHome(): void {   // Guardian -> Stable OR Source
    const player = this.player;
    if (!player) { // same as !this.stableHex
      this.setPlayerAndPaint(undefined); // so use: takeUnit().setPlayerAndPaint(player);
      super.sendHome();          // resetTile(); source.availUnit();
      return;
    }
    this.moveTo(this.stableHex); // maybe just set homeHex === stableHex?
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
  static override source: AnkhSource<Satet> = undefined;
  constructor(player: Player, serial: number) {
    super(player, serial, `Satet`);
  }
  noMont(hex: AnkhHex) {
    return hex?.isOnMap && !(hex.tile instanceof Monument); // avoid AnkhToken
  }
  openHex(hex: AnkhHex, player: Player) {
    if (!hex) return false;
    if (!hex.tile && !hex.meep) return true;
    // open if: there is a hex; && is no meep (or meep is satet-inFlight) && no tile (or tile is open portal for Osiris)
    const noMeep = (!hex.meep || (hex.meep === this));
    return noMeep && (!hex.tile || (hex.tile instanceof Portal && player.godName === 'Osiris'))
  }
  override isLegalTarget(hex: AnkhHex, ctx?: DragContext): boolean {
    const figure = hex?.figure;
    if (ctx.phase === 'Move' && hex?.isOnMap && figure?.player && figure.player !== this.player) {
      const aPlayer = figure.player;
      if (hex.findAdjHex(ahex => this.openHex(ahex, aPlayer)) && this.distWithin(hex, this.hex, 3)) return true;
    }
    return super.isLegalTarget(hex, ctx);
  }

  override dragStart(ctx: DragContext): void {
    this.lastTarget = undefined;
    this.movedFigure = undefined;
  }
  lastTarget: Hex2;
  movedFigure: Meeple;
  // 'this' is over 'hex'; the previous legal target is ctx.lastTarget:
  override dragFunc0(hex: AnkhHex, ctx: DragContext): void {
    // move enemy to adj hex
    // super.dragFunc0 to set target & mark
    if (hex !== this.lastTarget && this.movedFigure) {
      this.movedFigure.moveTo(this.lastTarget)
      this.movedFigure = undefined;
      this.lastTarget = undefined;
    }
    const figure = hex?.figure;
    if (hex?.isOnMap && figure && (hex.figure?.player !== this.player)) {
      // find the right empty hex... opposite direction from which Satet entered hex
      const pt = this.parent.localToLocal(this.x, this.y, hex.cont); // from DragC --> targetHex coordinates
      const outDir = H.dirRev[hex.cornerDir(pt, hex.cont, H.nsDirs)[0]];
      const mHex = !hex.borders[outDir] && hex.links[outDir]; // may be false
      if (this.openHex(mHex, figure.player)) {
        this.lastTarget = hex;
        this.movedFigure = figure;
        figure.moveTo(mHex);
        // now: hex is empty, will be isLegalTarget(), will be available for drop of Satet;
      }
    }
    super.dragFunc0(hex, ctx);
  }
}

export class CatMum extends Guardian1 {
  static override source: AnkhSource<CatMum> = undefined;
  constructor(player: Player, serial: number) {
    super(player, serial, `Cat-Mum`);
  }
  override sendHome(): void {  // CatMum: addDevotion
    const gamePlay = this.player?.gamePlay;
    gamePlay?.allPlayers.forEach(player => {
      if (player !== this.player) gamePlay.gameState.addDevotion(player, -1, `${this} died!`);
    })
    super.sendHome();
  }
}

export class Apep extends Guardian2 {
  static override source: AnkhSource<Apep> = undefined;
  constructor(player: Player, serial: number) {
    super(player, serial, `Apep`);
  }
  override isLegalWater(hex: AnkhHex): boolean {
    // can Summon to water; but not move water-to-water!
    return this.hex.isStableHex() ? true : super.isLegalWater(hex);
  }
  override isLegalTarget(hex: AnkhHex, ctx?: DragContext): boolean {
    if (this.hex.isStableHex() && hex.terrain === 'w') return true;
    return super.isLegalTarget(hex, ctx);
  }
}

export class Mummy extends Guardian2 {
  static override source: AnkhSource<Mummy> = undefined;
  constructor(player: Player, serial: number) {
    super(player, serial, `Mummy`);
  }

  override sendHome(): void {
    const god = this.player?.god, godFig = god?.figure;
    const isLegal = (hex: AnkhHex) => !hex.occupied || (hex.tile instanceof Portal && god.name === 'Osiris');
    const dir = godFig?.hex.findAdjHex(hex => isLegal(hex)); // not water
    if (dir) {
      const toHex = godFig.hex.links[dir];
      this.moveTo(toHex);
    } else {
      super.sendHome();
    }
  }
}

export class Scorpion extends Guardian3 {
  static override source: AnkhSource<Scorpion>;
  // Constructed from Meeple.makeSource0()
  constructor(player: Player, serial: number) {
    super(player, serial, `Scorpion`);
    const { x, y, width, height } = H.hexBounds(TP.hexRad, TP.useEwTopo ? 0 : 30);
    this.setBounds(x, y, width, height);
    this.cache(x, y, width, height);
    this.addDirDisk();
  }
  drawClaw(g: Graphics, color: string, cl = 5) {
    const y = 3, py = -cl;
    return g.s(color).ss(7, 'butt', 'miter').mt(-1, y).lt(0, py).lt(1, y);
  }
  makeClaw(cl = 5, color = this.player?.colorn ?? C.black) {
    const clf = cl + 1, uparrow = '\u2191';
    const sc = new Shape(this.drawClaw(new Graphics(), 'black', cl));
    sc.setBounds(-4, -clf, 8, clf + 1);
    const rv = sc;
    return rv;
  }

  dirDisk: Container;
  dirRot = 0;  // [0..5] rotation/60; index into H.nsDir
  get rotDir() { return H.ewDirs[this.dirRot]}
  set rotDir(dir: EwDir) {
    this.dirDisk.rotation = H.ewDirRot[dir];
    this.dirRot = H.ewDirRot[dir] - 30;
  }
  get attackDirs() {
    const rot1 = (this.dirRot) % 6;
    const rot2 = (this.dirRot + 1) % 6;
    return [H.nsDirs[rot1], H.nsDirs[rot2]];
  }
  get attackMonuments() {
    const tiles = this.attackDirs.map(dir => this.hex?.links[dir]?.tile);
    const monts = tiles.filter(tile => tile instanceof Monument) as Monument[];
    return monts;
  }

  addDirDisk() {
    const ax = this.radius/2, ay = this.radius * .8, ang = 30, cl = 3;
    const a1 = this.makeClaw(cl), a2 = this.makeClaw(cl);
    a1.rotation = -ang;
    a2.rotation = ang;
    a1.x = -ax; a2.x = ax;
    a1.y = a2.y = -ay;
    const dirDisk = this.dirDisk = new Container(); dirDisk.name = 'dirDisk';
    dirDisk.rotation = this.dirRot * 60 + 30; // H.dirRot[dirRot(*60) --> nsDir(+30) --> ewDir]
    dirDisk.addChild(a1, a2);
    this.addChild(dirDisk);
    const { x, y, width, height } = this.getBounds();
    const clm = cl * 3;   // depends on miter, tan(cl/1)
    this.setBounds(x - clm, y - clm, width + 2 * clm, height + 2 * clm)
    this.cache(x - clm, y - clm, width + 2 * clm, height + 2 * clm)
  }

  diskRotate() {
    this.dirDisk.rotation = 30 + (this.dirRot = ++this.dirRot % 6) * 60;
    this.updateCache();
    // console.log(stime(this, `.Scorpion: attackDirs =`), this.attackDirs);
  }

  override dropFunc(targetHex: AnkhHex, ctx: DragContext): void {
    super.dropFunc(targetHex, ctx);
    if (this.hex !== this.startHex) {
      this.diskRotate();
    }
  }
  override setPlayerAndPaint(player: Player): this {
    if (!player && this.dirDisk) this.rotDir = 'NE'; // no dirDisk during Tile.constructor
    return super.setPlayerAndPaint(player);
  }
}

export class Androsphinx extends Guardian3 {
  static override source: AnkhSource<Androsphinx> = undefined;
  constructor(player: Player, serial: number) {
    super(player, serial, `Andro-sphinx`, );
  }
}

// List all the God constructors:
const guardianConstructors: Constructor<Guardian>[] = [Satet, CatMum, Mummy, Apep, Scorpion, Androsphinx];
// godSpecs.forEach(god => new god());
