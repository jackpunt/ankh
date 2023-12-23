
/** extreme form of JSON-minification */
export function json(obj: object): string {
  return JSON.stringify(obj).replace(/"/g, '')
}
