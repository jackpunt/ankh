import { Constructor } from "@thegraid/common-lib";
import { Androsphinx, Apep, Figure, GodFigure, Monument, MumCat, Mummy, Obelisk, Pyramid, Satet, Scorpion, Temple, Warrior } from "./ankh-figure";
import { AnkhToken } from "./ankh-token";

export class ClassByName {
    static classByName: { [index: string]: Constructor<GodFigure | Monument | Figure | AnkhToken > } =
    { 'GodFigure': GodFigure, 'Warrior': Warrior,
      'Obelisk': Obelisk, 'Pyramid': Pyramid, 'Temple': Temple,
      'Satet': Satet, 'MumCat': MumCat,
      'Apep': Apep, 'Mummy': Mummy,
      'Androsphinx': Androsphinx, 'Scorpion': Scorpion,
      'AnkhToken': AnkhToken,
    }

}
