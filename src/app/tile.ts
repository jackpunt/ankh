import { C, Constructor, F, ImageLoader, S, className, stime } from "@thegraid/common-lib";
import { Bitmap, Container, DisplayObject, MouseEvent, Shape, Text } from "@thegraid/easeljs-module";
import { GP } from "./game-play";
import { Hex, Hex2, HexMap } from "./hex";
import type { Player } from "./player";
import { BalMark, C1, CapMark, CenterText, HexShape, InfRays, InfShape, Paintable, TileShape } from "./shapes";
import type { DragContext, Table } from "./table";
import { PlayerColor, PlayerColorRecord, TP, criminalColor, playerColorRecord, playerColorsC } from "./table-params";

export type AuctionBonus = 'star' | 'econ' | 'infl' | 'actn';
export type AdjBonusId = 'Bank' | 'Lake';
export type BonusId = 'Star' | 'Econ' | AdjBonusId | AuctionBonus;
type BonusObj = { [key in AuctionBonus]: boolean}

type BonusInfo<T extends DisplayObject> = {
  bonusId: BonusId, dtype: Constructor<T>,
  x: number, y: number, size: number,
  paint?: (s: T, info: BonusInfo<T>) => void
}

export class BonusMark extends Container {

  static bonusInfo: BonusInfo<DisplayObject>[] = [
    {
      // mark the AdjBonus for Bank
      bonusId: 'Bank', dtype: CenterText, x: 0, y: -1.9, size: TP.hexRad / 3, paint: (t: Text, info) => {
        t.text = '$'
        t.color = C.GREEN
        t.font = F.fontSpec(info.size)
        t.x = info.x * info.size
        t.y = info.y * info.size
      }
    },
    // mark the AdjBonus for Lake
    {
      bonusId: 'Lake', dtype: Shape, x: 0, y: -2.5, size: TP.hexRad / 4, paint: (s: Shape, info, tilt = 90) => {
        s.graphics.f(C.briteGold).dp(info.x, info.y, 1, 5, 2, tilt)
        s.scaleX = s.scaleY = info.size;
      }
    },
    // drawStar when vp > 0
    {
      bonusId: 'Star', dtype: Shape, x: 0, y: 1.3, size: TP.hexRad / 3, paint: (s: Shape, info, tilt = -90) => {
        s.graphics.f(C.briteGold).dp(info.x, info.y, 1, 5, 2, tilt)
        s.scaleX = s.scaleY = info.size;
      }
    },
    // drawEcon when econ > 0
    {
      bonusId: 'Econ', dtype: CenterText, x: 0, y: 1.3, size: TP.hexRad / 3, paint: (t: Text, info) => {
        t.text = '$'
        t.color = C.GREEN
        t.font = F.fontSpec(info.size)
        t.x = info.x * info.size
        t.y = info.y * info.size
      }
    },
    // Bonus mark for any ActionTile
    {
      bonusId: 'star', dtype: Shape, x: 0, y: 0, size: TP.hexRad / 3, paint: (s: Shape, info, tilt = -90) => {
        s.graphics.f(C.briteGold).dp(info.x, info.y, 1, 5, 2, tilt)
        s.scaleX = s.scaleY = info.size;
      }
    },
    // Bonus mark for any AuctionTile
    {
      bonusId: 'econ', dtype: CenterText, x: 0, y: -1.1, size: TP.hexRad / 2, paint: (t: Text, info) => {
        t.text = '$'
        t.color = C.GREEN
        t.font = F.fontSpec(info.size)
        t.x = info.x * info.size
        t.y = info.y * info.size
      }
    },
    {
      bonusId: 'infl', dtype: InfShape, x: 1.4, y: -1.3, size: TP.hexRad / 4, paint: (c: Container, info) => {
        c.scaleX = c.scaleY = .25;
        c.x = info.x * info.size;
        c.y = info.y * info.size;
      }
    },
    {
      bonusId: 'actn', dtype: Shape, x: -1.4, y: -1.3, size: TP.hexRad / 4, paint: (s: Shape, info) => {
        s.scaleX = s.scaleY = info.size / 4
        let path: [x: number, y: number][] = [[-1, 4], [2, -1], [-2, 1], [1, -4]].map(([x, y]) => [x + info.x*4, y + info.y*4])
        let g = s.graphics.ss(1).s(C.YELLOW).mt(...path.shift())
        path.map((xy) => g.lt(...xy))
        g.es()
      }
    },
  ];
  static bonusMap = new Map<BonusId, BonusInfo<DisplayObject>>()
  static ignore = BonusMark.bonusInfo.map(info => BonusMark.bonusMap.set(info.bonusId, info));

  constructor(
    public bonusId?: BonusId,
    rotation = 0,
    ) {
    super();            // this is a Container
    const info = BonusMark.bonusMap.get(bonusId); // has a paint() function
    const dobj = new info.dtype();             // Shape or Text
    this.addChild(dobj) // dobj is a Shape or Text or other info.dtype()
    info.paint(dobj, info); // paint dobj with polystar(tilt) or Text(...)
    this.rotation = rotation;
  }
}

class TileLoader {
  Uname = ['Univ0', 'Univ1'];
  Monu = new Array(TP.inMarket['Monument']).fill(1).map((v, k) => `Monument${k}`);
  imageMap = new Map<string, HTMLImageElement>();
  aliases = { Monument1: 'arc_de_triomphe3', Monument2: 'Statue-of-liberty' };
  fromAlias(names: string[]) {
    return names.map(name => this.aliases[name] ?? name);
  }
  imageArgs = {
    root: 'assets/images/',
    fnames: this.fromAlias(['Recycle']),
    ext: 'png',
  };

  /** use ImageLoader to load images, THEN invoke callback. */
  loadImages(cb: () => void) {
    new ImageLoader(this.imageArgs, this.imageMap, (imap) => cb())
  }
  getImage(name: string) {
    return this.imageMap.get(this.aliases[name] ?? name);
  }
}

/** Someday refactor: all the cardboard bits (Tiles, Meeples & Coins) */
class Tile0 extends Container {
  static loader = new TileLoader();
  // constructor() { super(); }

  public player: Player | undefined;
  get infColor() { return this.player?.color }
  get recycleVerb(): string { return 'demolished'; }

  /** name in set of filenames loaded in GameSetup */
  addImageBitmap(name: string, at = this.numChildren - 1) {
    const img = Tile0.loader.getImage(name), bm = new Bitmap(img);
    const width = TP.hexRad, scale = width / Math.max(img.height, img.width);
    bm.scaleX = bm.scaleY = scale;
    const sw = img.width * scale, sh = img.height * scale;
    bm.x = -sw / 2;
    bm.y = -sh / 2;
    bm.y -= Tile.textSize / 2;
    this.addChildAt(bm, at);
    return bm;
  }

  get radius() { return TP.hexRad};
  readonly baseShape: Paintable = this.makeShape();

  /** Default is TileShape; a HexShape with translucent disk.
   * add more graphics with paint(colorn)
   * also: addBitmapImage()
   */
  makeShape(): Paintable {
    return new TileShape(this.radius);
  }

  /** paint with PlayerColor; updateCache()
   * @param pColor the 'short' PlayerColor
   * @param colorn the actual color (default = TP.colorScheme[pColor])
   */
  paint(pColor = this.player?.color, colorn = pColor ? TP.colorScheme[pColor] : C1.grey) {
    this.baseShape.paint(colorn); // recache baseShape
    this.updateCache();
  }

  vpStar: DisplayObject;
  // Looks just like the Bonus star! ('Star' y0 = 1.3 * hexRad; 'star' y0 = 0 [center])
  drawStar(star: BonusId = 'Star', show = true) {
    const info = BonusMark.bonusMap.get(star);
    let mark = this.vpStar;
    if (!mark && show) {
      const index = this.econEcon ? this.getChildIndex(this.econEcon) : this.numChildren - 1;
      mark = this.vpStar = this.addChildAt(new info.dtype(), index);
      info.paint(mark, info);
    } else if (mark) {
      mark.visible = show;
    }
    this.updateCache();
    return mark;
  }

  econEcon: DisplayObject;
  drawEcon(econ = 1, show = true) {
    const info = BonusMark.bonusMap.get('Econ');
    let mark = this.econEcon;
    if (!mark && show) {
      mark = this.econEcon = this.addChild(new info.dtype());
      info.paint(mark, info);
      if (econ < 0) (mark as Text).text  = `${econ}`; // show '-n' instead of '$'
    } else if (mark) {
      mark.visible = show;
    }
    this.updateCache();
    return mark;
  }

  readonly bonus: BonusObj = { star: false, infl: false, actn: false, econ: false }
  /** GamePlay.addBonus(tile) restricts this to (tile instanceof AuctionTile) */
  addBonus(bonusId: AuctionBonus) {
    this.bonus[bonusId] = true;
  }

  bonusInf(color = this.infColor) { return (color === this.infColor && this.bonus['infl']) ? 1 : 0; }

  get bonusCount() {
    let rv = 0;
    Object.values(this.bonus).forEach(isBonus => rv += (isBonus ? 1 : 0));
    return rv;
  }

  forEachBonus(f: (b: AuctionBonus, v: boolean) => void) {
    Object.keys(this.bonus).forEach((k: AuctionBonus) => f(k, this.bonus[k]));
  }

  removeBonus(bonusId?: BonusId, crit = (c: BonusMark) => (c.bonusId === bonusId)) {
    // console.log(stime(this, `.removeBonus: ${bonusId}`), this.bonus);
    if (!bonusId) {
      BonusMark.bonusInfo.forEach(info => this.removeBonus(info.bonusId));
      return;
    }
    this.bonus[bonusId] = false;
    this.removeChildType(BonusMark, crit);
    this.paint();
  }

  removeChildType(type: Constructor<DisplayObject>, pred = (dobj: DisplayObject) => true ) {
    const rems = this.children.filter(c => (c instanceof type) && pred(c));
    this.removeChild(...rems);
    this.updateCache()
  }

}

/** all the [Hexagonal] game pieces that appear; can be dragged/dropped. */
export class Tile extends Tile0 {
  static allTiles: Tile[] = [];

  static textSize = 20;
  nameText: Text;
  get nB() { return 0; }
  get nR() { return 0; }
  get fB() { return 0; }
  get fR() { return 0; }

  /** location at start-of-game & after-Recycle; Meeple & Civic; Policy: sendHome -> sendToBag */
  homeHex: Hex = undefined;
  /** location at start-of-drag */
  fromHex: Hex2;

  _hex: Hex = undefined;
  /** the map Hex on which this Tile sits. */
  get hex() { return this._hex; }
  /** only one Tile on a Hex, Tile on only one Hex */
  set hex(hex: Hex) {
    if (this.hex?.tile === this) this.hex.tile = undefined;
    this._hex = hex;
    if (hex !== undefined) hex.tile = this;
  }

  loanLimit = 0;

  get infP() { return this.inf }

  get vp() { return this._vp + (this.bonus.star ? 1 : 0); } // override in Lake
  get econ() { return this._econ + (this.bonus.econ ? 1 : 0); } // override in Bank
  get cost() { return this._cost; }

  static costMark: Text = new CenterText('$ 0');
  showCostMark(show = true, dy = .5) {
    const mark = Tile.costMark;
    if (!show) {
      this.removeChild(mark);
    }
    this.updateCache();
  }

  // Tile
  constructor(
    /** the owning Player. */
    public readonly Aname?: string,
    player?: Player,
    /** aka: infP */
    public readonly inf: number = 0,
    private readonly _vp: number = 0,
    public readonly _cost: number = 1,
    public readonly _econ: number = 1,
  ) {
    super()
    Tile.allTiles.push(this);
    if (!Aname) this.Aname = `${className(this)}-${Tile.allTiles.length}`;
    const rad = this.radius;
    this.cache(-rad, -rad, 2 * rad, 2 * rad);
    this.addChild(this.baseShape);
    this.addChild(new BalMark(this));
    this.setPlayerAndPaint(player);
    if (_vp > 0) this.drawStar();
    if (_econ !== 0) this.drawEcon(_econ);
    this.nameText = this.addTextChild(rad / 4);
    this.infText = this.addTextChild(rad / 2, '');
  }

  setPlayerAndPaint(player: Player) {
    this.player = player;
    this.paint();
  }

  override toString(): string {
    return `${this.Aname}@${this.hex?.Aname ?? '?'}`;
  }

  get andInfStr()  { return `${this} ${this.hex?.infStr ?? ''}`};

  /** name in set of filenames loaded in GameSetup
   * @param at = 2; above HexShape & BalMark
   */
  override addImageBitmap(name: string, at = 2) {
    let bm = super.addImageBitmap(name, at);
    this.updateCache();
    return bm;
  }

  /** add influence rays to Tile (for infP).
   * @inf this.hex.getInfP(this.infColor)
   */
  setInfRays(inf = this.hex?.getInfP(this.infColor) ?? this.infP, ) {
    this.removeChildType(InfRays);
    if (inf !== 0) {
      this.addChild(new InfRays(inf, this.infColor));
    }
    const rad = this.radius;
    this.cache(-rad, -rad, 2 * rad, 2 * rad);
  }

  override paint(pColor?: "b" | "w" | "c", colorn?: string): void {
    super.paint(pColor, colorn);
    if (this.inf > 0) this.setInfRays();
  }

  infText: Text
  setInfText(text = '') {
    this.infText.text = text;
  }

  isThreat: PlayerColorRecord<boolean> = playerColorRecord(false, false, false);

  clearThreats() {
    this.isThreat = playerColorRecord(false, false, false);
    Object.values(this.capMarks).forEach(cm => cm && (cm.visible = false))
  }

  assessThreat(atkr: PlayerColor) {
    this.isThreat[atkr] = this.infColor && (this.hex.getInfT(this.infColor) < this.hex.getInfT(atkr));
  }
  assessThreats() {
    playerColorsC.forEach(pc => this.assessThreat(pc) )
  }
  capMarks: PlayerColorRecord<CapMark> = playerColorRecord()

  setCapMark(pc: PlayerColor, capMark = CapMark) {
    const vis = this.isThreat[pc];
    let mark = this.capMarks[pc];
    if (vis && !mark) {
      mark = this.capMarks[pc] = new capMark(pc);
    }
    if (mark) mark.visible = vis;
    // put CapMark on its own Container, so we can disable them en masse
    const cont = this.hex?.map.mapCont.capCont;
    if (mark && cont && vis) {
      mark.setXY(pc, this, cont);
    }
  }

  override addBonus(bonusId: AuctionBonus) {
    super.addBonus(bonusId);
    const mark = new BonusMark(bonusId);
    this.addChildAt(mark, this.getChildIndex(this.nameText));
    this.paint();
  }

  addTextChild(y0 = this.radius / 2, text = this.Aname, size = Tile.textSize, vis = false) {
    const nameText = new CenterText(text, size);
    nameText.y = y0;         // Meeple overrides in constructor!
    nameText.visible = vis;
    this.addChild(nameText);
    return nameText;
  }

  textVis(vis = !this.nameText.visible) {
    this.nameText.visible = vis
    this.infText.visible = vis
    this.updateCache()
  }

  rightClickable() {
    const ifRightClick = (evt: MouseEvent) => {
      const nevt = evt.nativeEvent;
      if (nevt.button === 2) {
        this.onRightClick(evt);
        nevt.preventDefault();           // evt is non-cancelable, but stop the native event...
        nevt.stopImmediatePropagation(); // TODO: prevent Dragger.clickToDrag() when button !== 0
      }
    };
    this.on(S.click, ifRightClick, this, false, {}, true);
  }

  onRightClick(evt: MouseEvent) {
    console.log(stime(this, `.rightclick: ${this}`), this);
  }

  overSet(tile: Tile) {
    tile.parent && console.log(stime(this, `.overSet: removeChild: ${tile}`))
    tile.parent?.removeChild(tile);         // moveBonusTo/sendHome may do this.
  }

  // Tile
  /** Post-condition: tile.hex == hex; low-level, physical move */
  moveTo(hex: Hex) {
    this.hex = hex;     // INCLUDES: hex.tile = tile
    return hex;
  }

  /** Tile.dropFunc() --> placeTile (to Map, reserve, ~>auction; not Recycle); semantic move/action. */
  placeTile(toHex: Hex, payCost = true) {
    GP.gamePlay.placeEither(this, toHex, payCost);
  }

  flipOwner(targetHex: Hex2, ctx: DragContext) {
    const gamePlay = GP.gamePlay, player = ctx?.lastCtrl ? this.player.otherPlayer : gamePlay.curPlayer;
    if (targetHex?.isOnMap && (targetHex === this.fromHex)) {
      const infT = this.hex?.getInfT(this.player?.color);
      if (targetHex.getInfT(player.color) > infT || ctx?.lastCtrl) {
        this.flipPlayer(player, gamePlay); // flip if Infl or ctrlKey:
      }
      return true;
    }
    return false;
  }

  // flipOwer->flipPlayer; compare to gamePlay.placeEither()
  private flipPlayer(player: Player, gamePlay = GP.gamePlay) {
    gamePlay.logText(`Flip ${this} to ${player.colorn}`, `FlipableTile.flipPlayer`);
    const hex = this.hex, hadInfP = (this.infP + this.bonusInf()) > 0; // Monument && bonusInf
    if (hadInfP) {
      this.moveTo(undefined); // tile.hex = hex.tile = undefined
      gamePlay.decrInfluence(hex, this, this.player.color);
    }
    this.setPlayerAndPaint(player); // Flip ownership
    if (hadInfP) {
      this.moveTo(hex);
      gamePlay.incrInfluence(hex, player.color);
    }
    gamePlay.updateCounters();
  }

  resetTile() {
    this.clearThreats();
    this.removeBonus();
    this.x = this.y = 0;
    this.setInfText('');
    this.setInfRays(0);    // Civics and Leaders
  }

  /**
   * After Capture or Recycle/Replace.
   * Post-condition: !tile.hex.isOnMap; tile.hex = this.homeHex may be undefined [UnitSource, AuctionTile, BonusTile]
   */
  sendHome() {
    this.resetTile();
    this.moveTo(this.homeHex) // override for AuctionTile.tileBag & UnitSource<Meeple>
    if (!this.homeHex) this.parent?.removeChild(this);
  }

  /**
   * Augment Table.dragFunc0().
   *
   * isLegal already set;
   * record ctx.targetHex & showMark() when Tile is over a legal targetHex.
   */
  dragFunc0(hex: Hex2, ctx: DragContext) {
    ctx.targetHex = hex?.isLegal ? hex : this.fromHex;
    ctx.targetHex.map.showMark(ctx.targetHex);
  }

  /** entry point from Table.dropFunc; delegate to this.dropFunc() */
  dropFunc0(hex: Hex2, ctx: DragContext) {
    this.dropFunc(ctx.targetHex, ctx);
    this.showCostMark(false); // QQQ: should this be in dropFunc() ??
    ctx.targetHex.map.showMark(undefined);
  }

  cantBeMovedBy(player: Player, ctx: DragContext): string | boolean {
    return (ctx?.lastShift || this.player === undefined || this.player === player) ? undefined : "Not your Tile";
  }

  /** override as necessary. */
  dragStart(ctx: DragContext) {
    this.clearThreats();  // when lifting a Tile from map, hide the CapMarks
    if (!this.hex?.isOnMap) this.showCostMark();
  }

  /** state of shiftKey has changed during drag */
  dragShift(shiftKey: boolean, ctx: DragContext) { }

  markLegal(table: Table, setLegal = (hex: Hex2) => { hex.isLegal = false; }, ctx?: DragContext) {
    table.homeRowHexes.forEach(setLegal);
    table.hexMap.forEachHex(setLegal);
  }

  /**
   * Override in AuctionTile, Civic, Meeple/Leader
   * @param toHex a potential targetHex (table.hexUnderObj(dragObj.xy))
   */
  isLegalTarget(toHex: Hex, ctx?: DragContext) {
    if (!toHex) return false;
    if (!!toHex.tile) return false; // note: from AuctionHexes to Reserve overrides this.
    if (toHex.meep && !(toHex.meep.player === GP.gamePlay.curPlayer)) return false; // QQQ: can place on non-player meep?
    if ((this.hex as Hex2)?.isOnMap && !ctx?.lastShift) return false;
    // [newly] placed tile must be adjacent to an existing [non-BonusTile] Tile:
    if (TP.placeAdjacent && toHex.isOnMap && !toHex.findLinkHex(hex => (hex.tile?.player !== undefined ))) return false;
    return true;
  }

  isLegalRecycle(ctx: DragContext) {
    if (this.hex.getInfT(GP.gamePlay.curPlayer.color) > this.hex.getInfT(this.player.color)) return false;
    return true;
  }

  /**
   * Tile.dropFunc; Override in AuctionTile, Civic, Meeple/Leader.
   * @param targetHex Hex2 this Tile is over when dropped (may be undefined; see also: ctx.targetHex)
   * @param ctx DragContext
   */
  dropFunc(targetHex: Hex2, ctx: DragContext) {
    this.placeTile(targetHex);
  }

  noLegal() {
    // const cause = GP.gamePlay.failToBalance(this) ?? '';
    // const [infR, coinR] = GP.gamePlay.getInfR(this);
    // GP.gamePlay.logText(`No placement for ${this.andInfStr} ${cause} infR=${infR} coinR=${coinR}`, 'Tile.noLegal')
  }

  logRecycle(verb: string) {
    const cp = GP.gamePlay.curPlayer;
    const loc = this.hex?.isOnMap ? 'onMap' : 'offMap';
    const info = { Aname: this.Aname, fromHex: this.fromHex?.Aname, cp: cp.colorn, caps: cp.captures, tile: {...this} }
    console.log(stime(this, `.recycleTile[${loc}]: ${verb}`), info);
    GP.gamePlay.logText(`${cp.Aname} ${verb} ${this}`, `GamePlay.recycle`);
  }
}

/** Marker class: a Tile that is not draggable */
export class NoDragTile extends Tile {}

/** A plain WHITE tile; for Debt */
export class WhiteTile extends NoDragTile {
  override makeShape(): Paintable { return new HexShape(this.radius); }

  override paint(pColor?: PlayerColor, colorn?: string): void {
    this.setInfRays();
    super.paint(pColor, C.WHITE);
  }
}

/** a half-sized Tile. */
export class Token extends Tile {

  override makeShape(): Paintable {
    return new HexShape(this.radius * .5);
  }

}

/** Tiles that are placed in the TileBag (AuctionTile & EvalTile). */
export interface BagTile extends Tile {
  sendToBag(): void; //     GP.gamePlay.shifter.tileBag.unshift(this);
}

/** Tiles that can be played to the Map: AuctionTile, Civic, Monument, BonusTile */
export class MapTile extends Tile {
  override dragStart(ctx: DragContext): void {
    super.dragStart(ctx);
    if (this.infP > 0) this.setInfRays(this.infP);  // tile influence w/o meeple
    this.hex?.meep?.setInfRays(this.hex.meep.infP); // meeple influence w/o tile
  }

  override cantBeMovedBy(player: Player, ctx: DragContext): string | boolean {
    if (this.hex?.isOnMap) {
      const infT = this.hex.getInfT(this.player?.color);
      // captured - allow to recycle
      if (this.hex.getInfT(criminalColor) > infT) return false;
      // captured - allow to flip, no recycle
      if (this.hex.getInfT(player.color) > infT) return false;
    }
    return super.cantBeMovedBy(player, ctx);
  }

}

// Leader.civicTile -> Civic; Civic does not point to its leader...
export class Civic extends MapTile {
  constructor(player: Player, id: string, image: string, inf = 1, vp = 1, cost = TP.tileCost(Civic, 2), econ = 1) {
    super(`${id}:${player.index}`, player, inf, vp, cost, econ); // CivicTile
    this.player = player;
    this.loanLimit = 10;
    this.addImageBitmap(image);
  }

  override isLegalTarget(hex: Hex, ctx?: DragContext) { // Civic
    if (!super.isLegalTarget(hex, ctx)) return false; // check cost & influence (& balance)
    if (!hex.isOnMap) return false;
    return true;
  }

  override sendHome() {   // Civic - put under Leader
    super.sendHome();
    this.parent.addChildAt(this, 1); // above HexShape, under meeple
  }

  override dropFunc(targetHex: Hex2, ctx: DragContext): void {
      super.dropFunc(targetHex, ctx);
      // placing a Civic changes the cost of Auction Tiles:
      GP.gamePlay.updateCostCounters();
  }
}

type TownSpec = string

export class TownRules {
  static rulesText: Array<Array<TownSpec>> = [
    ['+1 Actn, +1 Coins  (fast start)', '+6 Econ  (fast start)'], // 6 Econ buys Police/Mayor
    ['+1 TVP per R/B in 37 meta-hex around TC, -2 TVP per other hex', // (compact) ~23 (4-Civic, Lake, Bank, PS)
     '+1 TVP per R/B*, R/B* are Level-1 (compact)'], // -1 inflR on R/B*
    ['+4 TVP per Civic-adj-Civic', '+1 per edge of Civic meta-triad'], // 12-20 TVP (dense), 6,12,24 (tactical/spread)
    ['+2 TVP per tile in longest strip', '+4 TVP per strip >= length 5 (strip)'], // 10-20 ; 12-24
    ['+3 TVP per business triad', '+3 per resi triad'], // 18-27 & Banks!; more R, but Lakes
    ['+10 TVP per business r-hex', '+10 per residential r-hex (hexes)'], // 6 in ring
    ['+1 TVP per Police & Station & Prisoner & Threat (police state)'],  // threats at EoG (also regular prisoner points)
    ['+24 TVP, -1 per Police & Station & Police Action (libertarian)'], // -1 everytime you build/recruit!
    ['+1 TVP, +1 Coin per Criminal hired', '+1 TVP for each tile/meep destroyed (crime boss)'], //
  ];
  rulesBag: TownSpec[] = [];
  fillRulesBag() {
    this.rulesBag = TownRules.rulesText.slice(0)[0];
  }
  selectOne(bag = this.rulesBag) {
    return bag.splice(Math.floor(Math.random() * bag.length), 1);
  }
  static inst = new TownRules();
}

export class TownStart extends Civic {
  override get fB() { return 1; } // TS
  override get fR() { return 1; } // TS

  rule: TownSpec;
  constructor(player: Player) {
    super(player, 'TS', 'TownStart')
  }
}

export class Courthouse extends Civic {
  constructor(player: Player) {
    super(player, 'CH', 'Courthouse')
  }
}

export class University extends Civic {
  override get fB() { return 1; } // Univ
  override get fR() { return 1; } // Univ
  constructor(player: Player) {
    super(player, 'U', Tile.loader.Uname[player.index])
  }
}

export class Church extends Civic {
  override get fR() { return 1; } // Church
  constructor(player: Player) {
    super(player, 'T', 'Temple')
  }
}
