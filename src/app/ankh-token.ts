import { C, Constructor } from "@thegraid/common-lib";
import { CenterText } from "@thegraid/easeljs-lib";
import { Graphics } from "@thegraid/easeljs-module";
import { AnkhMeeple, AnkhSource, Monument } from "./ankh-figure";
import type { AnkhHex } from "./ankh-map";
import { Hex1, Hex2 } from "./hex";
import type { Player } from "./player";
import type { DragContext } from "./table";
import { TP } from "./table-params";



export class AnkhToken extends AnkhMeeple {
  static source: AnkhSource<AnkhToken>[] = [];

  static makeSource(player: Player, hex: Hex2, token: Constructor<AnkhMeeple>, n: number) {
    return AnkhToken.makeSource0((AnkhSource<AnkhToken>), token, player, hex, n);
  }
  override get radius() { return TP.ankhRad; }
  override isDragable(arg: DragContext) {
    return this.hex && this.player.gamePlay.isPhase('Claim');
  }

  constructor(player: Player, serial: number) {
    super(player, serial, `Ankh`); // `Ankh:${player?.index}-${serial}`, player);
    this.name = `Ankh:${player?.index}-${serial}`;
    const r = this.radius;
    const ankhChar = new CenterText(TP.ankhString, r * 2.2, C.black);
    ankhChar.y += r * 0.1;
    this.addChild(ankhChar);
    this.setNameText('');
    this.baseShape.cgf = (color) => this.atcgf(color);
  }
  override cache(x, y, w, h) {
    //this.scaleX = this.scaleY = 8;
    super.cache(x, y, w, h, 5);
    // this.scaleX = this.scaleY = 1;
  }
  override sendHome(): void {
    super.sendHome();
  }

  atcgf(color: string) {
    const g = new Graphics(), r = this.radius;
    g.f(color).es().dc(0, 0, r - 0);
    return g;
  }

  override moveTo(hex: Hex1) {
    if (hex?.meep instanceof AnkhToken && hex.meep !== this) {
      hex.meep.sendHome();  // Assert: (phase === 'Claim') && no unclaimed Monuments.
    }
    super.moveTo(hex);
    if (hex?.isOnMap) {
      this.y += TP.ankh2Rad - this.radius;
      if (hex.tile) {
        hex.tile.setPlayerAndPaint(this.player); // Claim Monument
        this.highlight(false);
        if (this.gamePlay.isPhase('Claim')) this.gamePlay.phaseDone(hex); // Claim done
      }
    }
  }

  claimableMonuments(player = this.player) {
    const hexAry = player.gamePlay.hexMap.hexAry;
    const montsOnMap = hexAry.filter(hex => hex.isOnMap && (hex.tile instanceof Monument)).map(hex => hex.tile) as Monument[];
    const unClaimedMnts = montsOnMap.filter(mon => !mon.player)
    const numUnclaimed = unClaimedMnts.length;

    const isAdjacentToPlayer = (monument: Monument) => {
      return !!monument.hex.findAdjHexByRegion(hex => hex.meep?.player === player);
    }
    const claimable = ((numUnclaimed === 0 ) ? montsOnMap : unClaimedMnts).filter(mnt => isAdjacentToPlayer(mnt))
    return claimable;
  }

  override isLegalTarget(hex: AnkhHex, ctx?: DragContext): boolean {
    const tile = hex.tile, player = this.player;
    if (!player.gamePlay.isPhase('Claim') && (this.hex === this.source.hex)) return false;
    if (!(tile instanceof Monument)) return false;
    return this.claimableMonuments(player).includes(tile);
  }
}
