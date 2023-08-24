import { Constructor } from "@thegraid/common-lib";
import { Androsphinx, Apep, CatMum, Figure, GodFigure, Monument, Mummy, Obelisk, Portal, Pyramid, Satet, Scorpion, Temple, Warrior } from "./ankh-figure";
import { AnkhToken } from "./ankh-token";

export class ClassByName {
    static classByName: { [key in string]: Constructor<GodFigure | Monument | Figure | AnkhToken > } =
    { 'GodFigure': GodFigure, 'Warrior': Warrior,
      'Obelisk': Obelisk, 'Pyramid': Pyramid, 'Temple': Temple,
      'Satet': Satet, 'CatMum': CatMum,
      'Apep': Apep, 'Mummy': Mummy,
      'Androsphinx': Androsphinx, 'Scorpion': Scorpion,
      'AnkhToken': AnkhToken,
      "Portal": Portal,
    }

}
