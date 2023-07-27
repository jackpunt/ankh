import { C, Constructor, WH } from "@thegraid/common-lib";
import { Container, Shape } from "@thegraid/easeljs-module";
import { CenterText, CircleShape } from "./shapes";
import { TP } from "./table-params";


export class God {
  static gods = new Map<string, God>();
  constructor(
    public  name: string,
    public color = godSpecs.find(spec => spec[0].name == name)[1],
  ) {
    // constructor here:
    God.gods.set(name, this);
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
    const bg = new Shape(); bg.graphics.f('rgb(140,140,140)').dr(0, 0, wh.width, wh.height)
    cont.addChild(bg);
    const tname = new CenterText(this.name, rad, this.color );
    tname.x = wh.width / 2; tname.textBaseline = 'top';
    cont.addChild(tname);
    return cont;
  }

}
class Anubis extends God {
  constructor() { super('Anubis', 'lavender') }

}
class Amun extends God {
  constructor() { super('Amun', 'red') }
  override makeSpecial(wh: WH): Container {
    const cont = super.makeSpecial(wh), rad = this.radius, y = wh.height / 2 + rad / 2;;
    const sgap = (wh.width - 6 * rad) / 4;
    [rad, rad, rad].forEach((radi, i) => {
      const circle = new CircleShape(radi, 'lightgrey', this.color);
      // circle.graphics.ss(1).f(C.black).sd([5, 5]).f('transparent').dc(0, 0, radi + 2);
      circle.x = sgap + radi + i * (2 * radi + sgap);
      circle.y = y;
      cont.addChild(circle);
    });
    return cont;
  }
}

class Bastet extends God {
  constructor() { super('Bastet', 'orange') }
}

class Hathor extends God {
  constructor() { super('Hathor', 'magenta') }
  // constructor() { super('Hathor', 'rgb(74,35,90)') }
}

class Horus extends God {
  constructor() { super('Horus', 'darkred') }
}

class Isis extends God {
  constructor() { super('Isis', 'lightblue') }
}

class Osiris extends God {
  constructor() { super('Osiris', 'lightgreen') }
}

class Ra extends God {
  constructor() { super('Ra', 'yellow') }
}

class SetGod extends God {
  constructor() { super('Set', C.coinGold) }
}

class Toth extends God {
  constructor() { super('Toth', 'cyan') }
}


const godSpecs: Constructor<God>[] = [Anubis, Amun, Bastet, Hathor, Horus, Isis, Osiris, Ra, SetGod, Toth];
godSpecs.forEach((god) => {
  const name = god.name;
  God.gods.set(name, new god(name))
});

// TODO: move to util functions
export function selectN(n = 1, remove = true, bag = Array.from(God.gods).map(([n, g]) => g.name)) {
  const rv = [];
  for (let i = 0; i < n; i++) {
  const index = Math.floor(Math.random() * bag.length);
  rv.push(remove ? bag.splice(index, 1)[0] : bag[index]);
  }
  return rv;
}
