import { C, F, WH } from "@thegraid/common-lib";
import { Container, Shape, Text } from "@thegraid/easeljs-module";
import { CenterText, CircleShape } from "./shapes";
import { TP } from "./table-params";

export class God {
  static gods = new Map<string, God>();
  static godSpecs = [['Bastet', 'orange'], ['Isis', 'blue'], ['Ra', 'yellow'], ['Amun', 'red'], ['Osiris', 'green']];
  static init = God.godSpecs.forEach(([name, color]) => God.gods.set(name, new God(name, color)));

  constructor(
    public  name: string,
    public color: string,
  ) {
    // constructor here:
  }
  ankhPowers: string[] = [];

  radius = TP.anhkRad;
  getAnhkToken(rad = this.radius) {
    const cont = new Container();
    const shape = new CircleShape(rad, this.color, );
    const ankh = new CenterText(`${'\u2625'}`, rad * 2.2, C.black);
    ankh.y += rad * .1;
    cont.addChild(shape);
    cont.addChild(ankh);
    return cont;
  }

  makeSpecial(wh: WH): Container {
    const cont = new Container, rad = this.radius, y = wh.height/2 + rad/2;
    const bg = new Shape(); bg.graphics.f('rgb(40,40,40)').dr(0, 0, wh.width, wh.height)
    cont.addChild(bg);
    const tname = new CenterText(this.name, rad, this.color );
    tname.x = wh.width / 2; tname.textBaseline = 'top';
    cont.addChild(tname);
    if (this.name === 'Amun') {
      const sgap = (wh.width - 6 * rad) / 4;
      [rad, rad, rad].forEach((radi, i) => {
        const circle = new CircleShape(radi, 'lightgrey', this.color);
        // circle.graphics.ss(1).f(C.black).sd([5, 5]).f('transparent').dc(0, 0, radi + 2);
        circle.x = sgap + radi + i * (2 * radi + sgap);
        circle.y = y;
        cont.addChild(circle);
      });
    }
    return cont;
  }

}
