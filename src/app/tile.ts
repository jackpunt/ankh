import { C, Constructor, F, ImageLoader, S, className, stime } from "@thegraid/common-lib";
import { Bitmap, Container, DisplayObject, MouseEvent, Shape, Text } from "@thegraid/easeljs-module";
import { GP } from "./game-play";
import { Hex, Hex1, Hex2, HexMap } from "./hex";
import type { Player } from "./player";
import { BalMark, C1, CapMark, CenterText, HexShape, InfShape, Paintable, TileShape } from "./shapes";
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
  homeHex: Hex1 = undefined;
  /** location at start-of-drag */
  fromHex: Hex2;

  _hex: Hex1 = undefined;
  /** the map Hex on which this Tile sits. */
  get hex() { return this._hex; }
  /** only one Tile on a Hex, Tile on only one Hex */
  set hex(hex: Hex1) {
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


  /** name in set of filenames loaded in GameSetup
   * @param at = 2; above HexShape & BalMark
   */
  override addImageBitmap(name: string, at = 2) {
    let bm = super.addImageBitmap(name, at);
    this.updateCache();
    return bm;
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
  moveTo(hex: Hex1) {
    this.hex = hex;     // INCLUDES: hex.tile = tile
    return hex;
  }

  /** Tile.dropFunc() --> placeTile (to Map, reserve, ~>auction; not Recycle); semantic move/action. */
  placeTile(toHex: Hex1, payCost = true) {
    GP.gamePlay.placeEither(this, toHex, payCost);
  }

  flipOwner(targetHex: Hex2, ctx: DragContext) {
    const gamePlay = GP.gamePlay, player = ctx?.lastCtrl ? this.player.otherPlayer : gamePlay.curPlayer;
    if (targetHex?.isOnMap && (targetHex === this.fromHex)) {
      return true;
    }
    return false;
  }

  resetTile() {
    this.clearThreats();
    this.removeBonus();
    this.x = this.y = 0;
    this.setInfText('');
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
  isLegalTarget(toHex: Hex1, ctx?: DragContext) {
    if (!toHex) return false;
    if (!!toHex.tile) return false; // note: from AuctionHexes to Reserve overrides this.
    if (toHex.meep && !(toHex.meep.player === GP.gamePlay.curPlayer)) return false; // QQQ: can place on non-player meep?
    if ((this.hex as Hex2)?.isOnMap && !ctx?.lastShift) return false;
    // [newly] placed tile must be adjacent to an existing [non-BonusTile] Tile:
    if (TP.placeAdjacent && toHex.isOnMap && !toHex.findLinkHex(hex => (hex.tile?.player !== undefined ))) return false;
    return true;
  }

  isLegalRecycle(ctx: DragContext) {
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
    const info = { Aname: this.Aname, fromHex: this.fromHex?.Aname, cp: cp.colorn, tile: {...this} }
    console.log(stime(this, `.recycleTile[${loc}]: ${verb}`), info);
    GP.gamePlay.logText(`${cp.Aname} ${verb} ${this}`, `GamePlay.recycle`);
  }
}

/** Marker class: a Tile that is not draggable */
export class NoDragTile extends Tile {}

/** A plain WHITE tile; for Debt */
export class WhiteTile extends NoDragTile {
  // TileShape does not work here:
  override makeShape(): Paintable { return new HexShape(this.radius); }

  override paint(pColor?: PlayerColor, colorn?: string): void {
    super.paint(pColor, C.WHITE);
  }
}

/** a half-sized Tile. */
export class Token extends Tile {

  override makeShape(): Paintable {
    return new HexShape(this.radius * .5);
  }

}

/** Tiles that can be played to the Map: AuctionTile, Civic, Monument, BonusTile */
export class MapTile extends Tile {
  override dragStart(ctx: DragContext): void {
    super.dragStart(ctx);
  }
}
