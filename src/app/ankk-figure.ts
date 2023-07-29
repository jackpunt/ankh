import { C, Constructor } from "@thegraid/common-lib";
import { Hex2, Hex, Hex1 } from "./hex";
import { Player } from "./player";
import { C1 } from "./shapes";
import { DragContext } from "./table";
import { TP } from "./table-params";
import { UnitSource } from "./tile-source";
import { Meeple } from "./meeple";
import { AnkhHex } from "./ankh-map";
import { GP } from "./game-play";
import { MapTile } from "./tile";

class AnkhPiece extends MapTile {

}

export class Monument extends MapTile {

}
export class Pyramid extends Monument {
}

export class Obelisk extends Monument {
}

export class Temple extends Monument {
}

export class Figure extends Meeple {
  isPhase(phase: string) {
    return GP.gamePlay.gamePhase === phase;
  }

  isLegalTarget0(hex: AnkhHex, ctx?: DragContext) {  // Meeple
    if (!hex) return false;
    if (hex.piece) return false;
    if (!hex.isOnMap) return false; // RecycleHex is "on" the map?
    if (!ctx?.lastShift && this.backSide.visible) return false;
    return true;
  }

  override isLegalTarget(hex: AnkhHex, ctx?: DragContext) { // Police
    if (!this.isLegalTarget0(hex, ctx)) return false;
    const isSummon = (this.hex === this.source.hex);
    // adjacent to existing, player-owned Figure or Monument.
    if (isSummon && !(hex.findAdjHex(adj => adj.piece?.player === this.player))) return false;
    // TODO: account for Pyramid power: after a non-Pyramid placement, only adj-Pyramid is legal.
    // TODO: also apply when teleporting to Temple: if gameState.phase == Battle
    const isTeleport = this.isPhase('Conflict') && this.hex.isOnMap;
    if (isTeleport && !(hex.findAdjHex(adj => (adj.tile instanceof Pyramid) && adj.tile.player === this.player))) return false;
    if (this.isPhase('Move') && this.distWithin(this.hex, hex, 3)) return false;
    return true;
  }
  distWithin(hex: Hex, hex1: Hex, n = 3) {
    // TODO: optimize; use only links in the right direction?
    const loop = (hex1: Hex, n = 3, excl: Hex[] = []) => {
      if (Math.abs(hex.row - hex1.row) > n || Math.abs(hex.col - hex1.col) > n) return false;
      excl.push(hex1);
      return hex.findLinkHex(lhex => hex === lhex || (n > 1 && !excl.includes(lhex) && loop(lhex, n - 1, excl)))
    }
    if (hex === hex1) return true;
    if (Math.abs(hex.row - hex1.row) > n || Math.abs(hex.col - hex1.col) > n) return false;
    return loop(hex1, n, [hex]);
  }

}

class GodFigure extends Figure {

}

export class Warrior extends Figure {
  private static source: UnitSource<Warrior>[] = [];

  /**
   * invoke Warrior.makeSource(player, hex, n) to create all the Warriors for Player.
   * makeSource0 will invoke new Warrior(), etc.
   */
  static makeSource(player: Player, hex: Hex2, n = TP.warriorPerPlayer) {
    return Meeple.makeSource0(UnitSource<Warrior>, Warrior, player, hex, n);
  }

  override get radius() { return TP.anhk1Rad }

  // Warrior
  constructor(player: Player, serial: number) {
    super(`W:${player.index}-${serial}`, player);
    this.source = Warrior.source[player.index];
  }
  override paint(pColor = this.player?.color, colorn = pColor ?? C1.grey) {
    this.paintRings(colorn, colorn, 4, 4); // one fat ring...
  }
}
export class Guardian extends Figure {
  static n = 2;
  static makeSource(hex: Hex2, guard: Constructor<Guardian>, n = guard['n']) {
    return Meeple.makeSource0(UnitSource<Guardian>, guard, undefined, hex, n);
  }
}
class Guardian1 extends Guardian {
  static override n = 3;
  override get radius() { return TP.anhk1Rad; }
}

class Guardian2 extends Guardian {
  override get radius() { return TP.anhk2Rad; }
}

class Guardian3 extends Guardian {
  override get radius() { return TP.anhk2Rad; }
}

export class Satet extends Guardian1 {

}

export class MumCat extends Guardian1 {

}

export class Apep extends Guardian2 {

}

export class Mummy extends Guardian2 {

}

export class Scorpion extends Guardian3 {

}

export class Androsphinx extends Guardian3 {

}
