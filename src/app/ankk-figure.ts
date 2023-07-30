import { C, Constructor, S, stime } from "@thegraid/common-lib";
import { Hex2, Hex, Hex1 } from "./hex";
import { Player } from "./player";
import { C1, CenterText, HexShape } from "./shapes";
import { DragContext } from "./table";
import { TP } from "./table-params";
import { UnitSource } from "./tile-source";
import { Meeple } from "./meeple";
import { AnkhHex } from "./ankh-map";
import { GP } from "./game-play";
import { MapTile, Tile } from "./tile";
import { H } from "./hex-intfs";
import { Container, Text } from "@thegraid/easeljs-module";

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

// Figure == Meeple:
export class Figure extends Meeple {

  override paint(pColor = this.player?.color, colorn = pColor ?? C1.grey) {
    this.paintRings(colorn, colorn, 4, 4); // one fat ring...
  }

  override isLegalRecycle(ctx: DragContext): boolean {
    return true;
  }

  isLegalTarget0(hex: AnkhHex, ctx?: DragContext) {  // Meeple
    if (!hex) return false;
    if (hex.piece) return false;
    if (!hex.isOnMap) return false; // RecycleHex is "on" the map?
    if (!ctx?.lastShift && this.backSide.visible) return false;
    return true;
  }

  override dragStart(ctx: DragContext): void {
    console.log(stime(this, `.dragStart:`), ctx.tile, ctx.targetHex);
    super.dragStart(ctx);
  }
  override dropFunc(targetHex: Hex2, ctx: DragContext): void {
    super.dropFunc(targetHex, ctx);
    const hex2 = this.hex?.map?.centerHex;
    console.log(stime(this, `.dropFunc:`), !!hex2 && this.distWithin(targetHex, hex2, 3));
  }
  isPhase(name: string) {
    return GP.gamePlay.isPhase(name);
  }


  isStable(hex: Hex1) {
    return (Player.allPlayers.find(p => p.stableHexes.includes(hex as Hex2)));
  }
  isLegalWater(hex: AnkhHex) {
    if (hex.terrain === 'w') return false;
    return true;
  }

  override isLegalTarget(hex: AnkhHex, ctx?: DragContext) { // Police
    if (!this.isLegalTarget0(hex, ctx)) return false;
    if (!this.isLegalWater(hex)) return false;

    // isSummon: adjacent to existing, player-owned Figure or Monument.
    if (this.isStable(this.hex)) {
      if (Meeple.allMeeples.filter(m => m.hex?.isOnMap && m.player === this.player).length < 1) return true; // Test Hack!
      if (!(hex.findAdjHex(adj => adj.piece?.player === this.player))) return false;
      return true;
    }
    // TODO: account for Pyramid power: after a non-Pyramid placement, only adj-Pyramid is legal.
    // TODO: also apply when teleporting to Temple: if gameState.phase == Battle
    if (this.hex.isOnMap) {
      if (this.isPhase('Conflict')) {
        if (!(hex.findAdjHex(adj => (adj.tile instanceof Pyramid) && adj.tile.player === this.player))) return false;
        return true;
      }
      if (this.isPhase('Move')) {
        if (!this.distWithin(hex, this.hex, 3)) return false;
        return true;
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

class GodFigure extends Figure {
  override isLegalRecycle(ctx: DragContext): boolean {
    return false;
  }
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

  override get radius() { return TP.ankh1Rad }

  // Warrior
  constructor(player: Player, serial: number) {
    super(`W:${player.index}\n${serial}`, player);
    this.nameText.y -= this.radius / 5;
  }
}
export class Guardian extends Figure {

  static makeSource(hex: Hex2, guard: Constructor<Guardian>, n = 0) {
    return Meeple.makeSource0(UnitSource<Guardian>, guard, undefined, hex, n);
  }

  override isLegalTarget(hex: AnkhHex, ctx?: DragContext): boolean {
    // Coming from global source:
    if (this.hex === this.source.hex) {
      const index = GP.gamePlay.table.guardSources.findIndex(s => s === this.source) + 1;
      const toStable = (!ctx.lastShift)
        ? (GP.gamePlay.curPlayer.stableHexes[index] === hex)
        : GP.gamePlay.allPlayers.find(p => p.stableHexes[index] === hex)
      if (toStable && !hex.occupied) return true;
    }
    return super.isLegalTarget(hex, ctx);
  }

  override dropFunc(targetHex: Hex2, ctx: DragContext): void {
    if (this.isStable(targetHex)) {
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
    super(`Satet\n${serial}`, player);
  }
}

export class MumCat extends Guardian1 {
  constructor(player: Player, serial: number) {
    super(`MCat\n${serial}`, player);
  }

}

export class Apep extends Guardian2 {
  constructor(player: Player, serial: number) {
    super(`Apep\n${serial}`, player);
  }
  override isLegalWater(hex: AnkhHex): boolean {
    // can Summon to water; but not move water-to-water!
    if (this.isStable(this.hex)) return true;
    return super.isLegalWater(hex);
  }
}

export class Mummy extends Guardian2 {
  constructor(player: Player, serial: number) {
    super(`Mummy\n${serial}`, player);
  }
}

export class Scorpion extends Guardian3 {
  dirDisk: Container;
  dirTxt: Text = new CenterText('\u2191   \u2191', this.radius * .5, this.player?.colorn ?? C.black);
  dirRot = 0;
  addDirDisk() {
    const uparrow = '\u2191', ax = this.radius/2, ay = this.radius * .8, ang = 30;
    const a1 = new CenterText(uparrow, this.radius/2, this.player?.colorn ?? C.black);
    const a2 = new CenterText(uparrow, this.radius/2, this.player?.colorn ?? C.black);
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
    //if (GP.gamePlay.curPlayer === this.player) {
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
    if (this.dirTxt) {
      let color = colorn ?? C.black;
      if (C.dist(color, C.white) < 50) color = C.black;
      this.dirTxt.color = color;
    }
    super.paint(pColor, colorn);
  }

  // Constructed from Meeple.makeSource0()
  constructor(player: Player, serial: number) {
    super(`Scorpion\n${serial}`, player);
    this.nameText.y -= this.nameText.getMeasuredHeight() / 4; // not clear why 3, rather than 2
    const { x, y, width, height } = H.hexBounds(TP.hexRad * 1.2, 30);
    this.setBounds(x, y, width, height);
    this.cache(x, y, width, height);
    this.addDirDisk();
    //this.on(S.click, (evt) => this.diskRotate())
  }

}

export class Androsphinx extends Guardian3 {
  constructor(player: Player, serial: number) {
    super(`Andro\nsphinx\n${serial}`, player);
    this.nameText.y -= this.nameText.getMeasuredHeight() / 4; // not clear why 3, rather than 2
  }
}
