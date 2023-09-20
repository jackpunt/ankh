import { Constructor } from "@thegraid/common-lib";
import { Androsphinx, AnkhPiece, Apep, CatMum, Figure, GodFigure, Monument, Mummy, Obelisk, Portal, Pyramid, Satet, Scorpion, Temple, Warrior } from "./ankh-figure";
import { AnkhToken } from "./ankh-token";

export class ClassByName {
  /** see also God.byName */
  static classByName: { [key in string]: Constructor<Figure | AnkhPiece | AnkhToken> } =
    {
      'GodFigure': GodFigure, 'Warrior': Warrior,
      'Obelisk': Obelisk, 'Pyramid': Pyramid, 'Temple': Temple,
      'Satet': Satet, 'CatMum': CatMum,
      'Apep': Apep, 'Mummy': Mummy,
      'Androsphinx': Androsphinx, 'Scorpion': Scorpion,
      'AnkhToken': AnkhToken,
      "Portal": Portal,
    }
  /** invert classByName */
  static nameOfClass(claz: Constructor<Figure | AnkhPiece | AnkhToken>) {
    return Object.keys(ClassByName.classByName).find(key => ClassByName.classByName[key] === claz);
  }
}
