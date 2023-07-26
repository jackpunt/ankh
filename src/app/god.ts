import { C, F } from "@thegraid/common-lib";
import { Container, Shape, Text } from "@thegraid/easeljs-module";
import { CenterText } from "./shapes";

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

  radius = 20;

  getAnhkToken(rad = this.radius) {
    const cont = new Container();
    const shape = new Shape();
    shape.graphics.f(this.color).dc(0, 0, rad);
    const ankh = new CenterText(`${'\u2625'}`, rad * 2.2, C.black);
    ankh.y += rad * .1;
    cont.addChild(shape);
    cont.addChild(ankh);
    return cont;
  }

}
