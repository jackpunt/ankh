/** Hexagonal canonical directions */
export enum Dir { C, NE, E, SE, SW, W, NW }
export type HexDir = 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'N'
export type XYWH = { x: number, y: number, w: number, h: number } // like a Rectangle
export type EwDir = Exclude<HexDir, 'N' | 'S'>
export type NsDir = Exclude<HexDir, 'E' | 'W'>

// export type InfDir = EwDir; // for hexline & hextown
// export type HexAxis = Exclude<InfDir, 'SW' | 'W' | 'NW'>; // reduced to 3 visual axies

/** Hex things */
export namespace H {
  // export const axis: HexAxis[] = [NE, E, SE];           // minimal reference directions
  // export const infDirs: InfDir[] = dirs as InfDir[]     // until we extract from typeof InfDir
  // export const dnToAxis: { [key in InfDir]: HexAxis } = { NW: 'SE', W: 'E', SW: 'NE', NE: 'NE', E: 'E', SE: 'SE' }
  // export const dnToAxis2: { [key in InfDir]: InfDir } = { NW: 'NW', W: 'W', SW: 'SW', NE: 'NE', E: 'E', SE: 'SE' }

  export const degToRadians = Math.PI / 180;
  export const sqrt3 = Math.sqrt(3)  // 1.7320508075688772
  export const sqrt3_2 = H.sqrt3 / 2;
  export const infin = String.fromCodePoint(0x221E)
  export const C: 'C' = "C"; // not a HexDir, but identifies a Center
  export const N: HexDir = "N"
  export const S: HexDir = "S"
  export const E: HexDir = "E"
  export const W: HexDir = "W"
  export const NE: HexDir = "NE"
  export const SE: HexDir = "SE"
  export const SW: HexDir = "SW"
  export const NW: HexDir = "NW"

  /** EW topo dirs! */
  export const dirs: HexDir[] = [NE, E, SE, SW, W, NW]; // standard direction signifiers () ClockWise
  /** includes E,W, suitable for EwTopo */
  export const ewDirs: EwDir[] = [NE, E, SE, SW, W, NW]; // directions for EwTOPO
  /** includes N,W, suitable for NsTopo */
  export const nsDirs: NsDir[] = [NE, SE, S, SW, NW, N]; // directions for NsTOPO
  export const dirRot: {[key in HexDir] : number} = { N: 0, NE: 30, E: 90, SE: 150, S: 180, SW: 210, W: 270, NW: 330 }
  export const dirRev: {[key in HexDir] : HexDir} = { N: S, S: N, E: W, W: E, NE: SW, SE: NW, SW: NE, NW: SE }
  export const dirRevEW: {[key in EwDir] : EwDir} = { E: W, W: E, NE: SW, SE: NW, SW: NE, NW: SE }
  export const dirRevNS: {[key in NsDir] : NsDir} = { N: S, S: N, NE: SW, SE: NW, SW: NE, NW: SE }
  export const dirAngle: { [key in HexDir]: [number, number] } = {
     N: [330,  30],
    NE: [ 30,  90],
    SE: [ 90, 150],
     S: [150, 210],
    SW: [210, 270],
    NW: [270, 330],
     E: [ 60, 120],
     W: [240, 300],
  }

  export const capColor1:   string = "rgba(150,  0,   0, .8)"  // unplayable: captured last turn
  export const capColor2:   string = "rgba(128,  80, 80, .8)"  // protoMove would capture
  export const sacColor1:   string = "rgba(228,  80,  0, .8)"  // unplayable: sacrifice w/o capture
  export const sacColor2:   string = "rgba(228, 120,  0, .6)"  // isplayable: sacrifice w/ capture
  export const fjColor:     string = "rgba(228, 228,  0, .8)"  // ~unplayable: jeopardy w/o capture
}
