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
