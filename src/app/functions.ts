import { Constructor } from "@thegraid/common-lib";
import { CenterText } from "./shapes";
import { BitmapText, DisplayObject, Text } from "@thegraid/easeljs-module";

export function selectN<T>(bag: T[], n = 1, remove = true) {
  const rv: T[] = [];
  for (let i = 0; i < n; i++) {
    const index = Math.floor(Math.random() * bag.length);
    rv.push(remove ? bag.splice(index, 1)[0] : bag[index]);
  }
  return rv;
}

export function permute(stack: any[]) {
  for (let i = 0, len = stack.length; i < len; i++) {
    let ndx: number = Math.floor(Math.random() * (len - i)) + i
    let tmp = stack[i];
    stack[i] = stack[ndx]
    stack[ndx] = tmp;
  }
  return stack;
}
export function removeChildType<T>(type: Constructor<T>, pred = (dobj: T) => true ): T[] {
  const rems = this.children.filter((c: DisplayObject) => (c instanceof type) && pred(c));
  this.removeChild(...rems);
  return rems;
}
export function textBounds(t: Text | string, fs?: number, cons: Constructor<Text> = CenterText) {
    const txt = (t instanceof Text) ? t : new cons(t, fs ?? 30);
    const h = txt.getMeasuredHeight(), w = txt.getMeasuredWidth();
    const x = 0, y = 0
    return {x,y,w,h}
}
