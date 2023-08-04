import { C, Constructor } from "@thegraid/common-lib";
import { Shape } from "@thegraid/easeljs-module";
import { GP, NamedObject } from "./game-play";
import type { Hex, Hex1, Hex2 } from "./hex";
import type { Player } from "./player";
import { C1, PaintableShape } from "./shapes";
import type { DragContext, Table } from "./table";
import { TP } from "./table-params";
import { Tile } from "./tile";
import { TileSource, UnitSource } from "./tile-source";

class MeepleShape extends PaintableShape {
  static fillColor = 'rgba(225,225,225,.7)';
  static backColor = 'rgba(210,210,120,.5)'; // transparent light green

  constructor(public player: Player, public radius = TP.meepleRad) {
    super((color) => this.mscgf(color));
    this.y = TP.meepleY0;
    this.setMeepleBounds();
    this.backSide = this.makeOverlay(this.y);
  }
  setMeepleBounds(r = this.radius) {
    this.setBounds(-r, -r, 2 * r, 2 * r);
  }

  backSide: Shape;  // visible when Meeple is 'faceDown' after a move.
  makeOverlay(y0: number) {
    const { x, width: w } = this.getBounds();
    const over = new Shape();
    over.graphics.f(MeepleShape.backColor).dc(x + w / 2, y0, w / 2);
    over.visible = false;
    over.name = (over as NamedObject).Aname = 'backSide';
    return over;
  }

  /** stroke a ring of colorn, stroke-width = 2, r = radius-2; fill disk with (~WHITE,.7) */
  mscgf(colorn = this.player?.colorn ?? C1.grey) {
    const r = this.radius, ss = 2, rs = 1;
    const g = this.graphics.c().ss(ss).s(colorn).dc(0, 0, r - rs);
    g.f(MeepleShape.fillColor).dc(0, 0, r - 1);  // disk
    return g;
  }
}

export class Meeple extends Tile {
  static allMeeples: Meeple[] = [];

  readonly colorValues = C.nameToRgba("blue"); // with alpha component
  get backSide() { return this.baseShape.backSide; }
  override get recycleVerb() { return 'dismissed'; }

  /**
   * Meeple - Leader, Police, Criminal
   * @param Aname
   * @param player (undefined for Chooser)
   * @param civicTile Tile where this Meeple spawns
   */
  constructor(
    Aname: string,
    player?: Player,
  ) {
    super(Aname, player);
    this.addChild(this.backSide);
    this.player = player;
    this.nameText.visible = true;
    this.nameText.y = this.baseShape.y;
    // this.paint();
    Meeple.allMeeples.push(this);
  }

  /** the map Hex on which this Meeple sits. */
  override get hex() { return this._hex; }
  /** only one Meep on a Hex, Meep on only one Hex */
  override set hex(hex: Hex1) {
    if (this.hex?.meep === this) this.hex.meep = undefined
    this._hex = hex
    if (hex !== undefined) hex.meep = this;
  }

  override get radius() { return TP.meepleRad } // 31.578 vs 60*.4 = 24
  override textVis(v: boolean) { super.textVis(true); }
  override makeShape() { return new MeepleShape(this.player, this.radius); }
  override baseShape: MeepleShape;

  /** location at start-of-turn; for Meeples.unMove() */
  startHex: Hex1;

  // we need to unMove meeples in the proper order; lest we get 2 meeps on a hex.
  // meepA -> hexC, meepB -> hexA; undo: meepA -> hexA (collides with meepB), meepB -> hexB
  // Assert: if meepA.startHex is occupied by meepB, then meepB is NOT on meepB.startHex;
  // So: recurse to move meepB to its startHex;
  // Note: with multiple/illegal moves, meepA -> hexB, meepB -> hexA; infinite recurse
  // So: remove meepA from hexB before moving meepB -> hexB
  unMove() {
    if (this.hex === this.startHex) return;
    this.placeTile(undefined, false);       // take meepA off the map;
    this.startHex.meep?.unMove();           // recurse to move meepB to meepB.startHex
    this.placeTile(this.startHex, false);   // Move & update influence; Note: no unMove for Hire! (sendHome)
    this.faceUp();
  }

  /** start of turn, faceUp(undefined) --> faceUp; moveTo(true|false) --> faceUp|faceDn */
  faceUp(up = true) {
    if (this.backSide) this.backSide.visible = !up;
    if (up && this.hex) this.startHex = this.hex; // set at start of turn.
    this.updateCache();
    if (this.hex?.isOnMap) GP.gamePlay.hexMap.update();
  }

  moveTo0(hex: Hex1) {
    const destMeep = hex?.meep;
    if (destMeep && destMeep !== this) {
      destMeep.x += 10; // make double occupancy apparent [until this.unMove()]
      destMeep.unMove();
    }
    const fromHex = this.fromHex;
    super.moveTo(hex); // hex.set(meep) = this; this.x/y = hex.x/y
    this.faceUp(!(hex?.isOnMap && fromHex?.isOnMap && hex !== this.startHex));
    return hex;
  }

  override moveTo(hex: Hex1) {
    const source = this.source;
    const fromHex = this.hex;
    const toHex = this.moveTo0(hex);  // may collide with source.hex.meep
    if (source && fromHex === this.source.hex && fromHex !== toHex) {
      source.nextUnit()   // shift; moveTo(source.hex); update source counter
    }
    return hex;
  }

  override cantBeMovedBy(player: Player, ctx: DragContext) {
    const reason1 = super.cantBeMovedBy(player, ctx);
    if (reason1 || reason1 === false) return reason1;
    // if (!ctx?.lastShift && !this.canAutoUnmove && this.backSide.visible) return "already moved"; // no move if not faceUp
    return undefined;
  }

  isOnLine(hex0: Hex, fromHex = this.hex) {
    return !!fromHex.linkDirs.find(dir => fromHex.hexesInDir(dir).includes(hex0));
    // return !!fromHex.linkDirs.find(dir => fromHex.findInDir(dir, hex => hex === hex0));
    // return !!fromHex.findLinkHex((hex, dir) => !!hex.findInDir(dir, hex => hex === hex0));
  }

  get canAutoUnmove() { return this.player?.allOnMap(Meeple).filter(meep => meep.hex !== meep.startHex).length == 1 }

  /** override markLegal(), if *this* is the only meeple to have moved,
   * unMove it to reset influence; can always move back to startHex; */
  override markLegal(table: Table, setLegal?: (hex: Hex2) => void, ctx?: DragContext): void {
    if (!ctx?.lastShift && !!setLegal && this.canAutoUnmove) {
      this.unMove();          // this.hex = this.startHex;
    }
    super.markLegal(table, setLegal);
    this.startHex.isLegal = !!setLegal;
    return;
  }

  isLegalTarget0(hex: Hex1, ctx?: DragContext) {  // Meeple
    if (!hex) return false;
    if (hex.meep) return false;
    if (!hex.isOnMap) return false; // RecycleHex is "on" the map?
    if (!ctx?.lastShift && this.backSide.visible) return false;
    return true;
  }

  override isLegalTarget(hex: Hex1, ctx?: DragContext) {  // Meeple
    return this.isLegalTarget0(hex, ctx);
  }

  override isLegalRecycle(ctx: DragContext) {
    if (this.player === GP.gamePlay.curPlayer) return true;
    // if (this.hex.getInfT(GP.gamePlay.curPlayer.color) > this.hex.getInfT(this.infColor)) return true;
    return false;
  }

  override sendHome(): void { // Criminal
    this.faceUp();
    super.sendHome();         // this.resetTile(); moveTo(this.homeHex = undefined)
    const source = this.source;
    if (source) {
      source.availUnit(this);
      if (!source.hex.meep) source.nextUnit();
    }
  }

  // from SourcedMeeple:
  paintRings(colorn: string, rColor = C.BLACK, ss = 4, rs = 4) {
    const meepleShape = this.baseShape as MeepleShape;
    const r = meepleShape.radius;
    const g = meepleShape.paint(colorn);       // [2, 1]
    g.ss(ss).s(rColor).dc(0, 0, r - rs) // stroke a colored ring inside black ring
    this.updateCache();
  }


  static xmakeSource0<T extends Meeple, TS extends UnitSource<T>>(
    unitSource: new (type: Constructor<Meeple>, p: Player, hex: Hex2) => TS,
    type: Constructor<T>,
    player: Player,
    hex: Hex2,
    n = 0,
  ) {
    const source = new unitSource(type, player, hex);
    // static source: TS = [];
    if (player) {
      type['source'][player.index] = source;
    } else {
      type['source'] = source;
    }
    for (let i = 0; i < n; i++) {
      const unit = new type(player, i + 1);
      source.availUnit(unit);
    }
    source.nextUnit();  // unit.moveTo(source.hex)
    return source as TS;
  }
}
