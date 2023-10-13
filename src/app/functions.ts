import { Constructor } from "@thegraid/common-lib";
import { Container, DisplayObject, Text } from "@thegraid/easeljs-module";
import { CenterText } from "./shapes";

declare module "@thegraid/easeljs-module" {
  interface Container {
    removeChildType<T extends DisplayObject>(type: Constructor<T>, pred?: (dobj: T) => boolean ): T[];
  }
}

Container.prototype.removeChildType = function removeChildType<T extends DisplayObject>(type: Constructor<T>, pred = (dobj: T) => true ): T[] {
  const cont = this as Container;
  const rems = cont.children.filter((c: DisplayObject) => (c instanceof type) && pred(c)) as T[];
  cont.removeChild(...rems);
  return rems;
}

export function textBounds(t: Text | string, fs?: number, cons: Constructor<Text> = CenterText) {
    const txt = (t instanceof Text) ? t : new cons(t, fs ?? 30);
    const h = txt.getMeasuredHeight(), w = txt.getMeasuredWidth();
    const x = 0, y = 0
    return {x,y,w,h}
}
/** extreme form of JSON-minification */
export function json(obj: object): string {
  return JSON.stringify(obj).replace(/"/g, '')
}
