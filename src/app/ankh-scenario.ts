
// TODO: namespace or object for GameState names

import { GodFigure, Obelisk, Pyramid, Temple, Warrior } from "./ankh-figure"


// Rivers make first 3 Regions: West(1), East(2), Delta(3)
export const MiddleKingdom = [
  // 2 Player:
  [
    { init: [[4, 5, 1], [4, 6, 2], [3, 5, 3],] },
    {
      move: [
        [0, 3, Temple],
        [2, 5, Pyramid],
        [1, 8, Obelisk],
        [5, 0, Obelisk, 1],
        [4, 1, Warrior, 1],
        [5, 1, GodFigure, 1],
        [8, 1, Pyramid],
        [6, 5, Temple, 2],
        [6, 6, Warrior, 2],
        [7, 6, GodFigure, 2],
        [5, 8, Pyramid],
      ]
    }
  ],
  // 3 player
  [
    { init: [[4, 5, 1], [4, 6, 2], [3, 5, 3],] },
    {
      move: [
        [4, 3, GodFigure, 1],
        [4, 4, Warrior, 1],
        [5, 4, Temple, 1],
        [3, 0, Pyramid],
        [7, 2, Obelisk],

        [7, 6, GodFigure, 2],
        [6, 6, Warrior, 2],
        [6, 5, Obelisk, 2],
        [5, 9, Temple],
        [3, 7, Pyramid],

        [2, 5, GodFigure, 3],
        [3, 4, Warrior, 3],
        [2, 4, Pyramid, 3],
        [1, 8, Obelisk],
        [3, 5, Temple],
      ]
    }
  ],
  // 4 player
  [
    { init: [[4, 5, 1], [4, 6, 2], [3, 5, 3],] },
    { split: [[4, 0, 4], [4, 0, 'N', 'NE'], [4, 1, 'N', 'NE']] },
    {
      move: [
        [3, 1, GodFigure, 1],
        [3, 2, Warrior, 1],
        [4, 2, Temple, 1],
        [5, 5, Pyramid],

        [7, 3, GodFigure, 2],
        [7, 4, Warrior, 2],
        [8, 4, Temple, 2],
        [7, 0, Pyramid],
        [3, 2, Obelisk],

        [2, 5, GodFigure, 3],
        [3, 4, Warrior, 3],
        [3, 5, Obelisk, 3],
        [1, 3, Temple],
        [2, 8, Pyramid],

        [4, 7, GodFigure, 4],
        [5, 6, Warrior, 4],
        [5, 7, Pyramid, 4],
        [3, 9, Obelisk],
        [8, 6, Temple],
      ]
    }],
  // 5-player
  [
    { init: [[4, 5, 1], [4, 6, 2], [3, 5, 4]] },
    { split: [[6, 7, 3], [7, 5, 'N'], [7, 6, 'NW', 'N'], [6, 7, 'NW', 'N', 'NE']] },
    { split: [[4, 0, 5], [4, 0, 'N', 'NE'], [4, 1, 'N', 'NE']] },
    {
      move: [
        [2, 1, Temple, 1],
        [3, 1, GodFigure, 1],
        [3, 2, Warrior, 1],
        [4, 5, Pyramid],
        [4, 1, Obelisk],
        [6, 1, GodFigure, 5],
        [7, 1, Pyramid, 5],
        [7, 2, Warrior, 5],
        [8, 4, Temple],
        [7, 6, Obelisk],
        [8, 7, Warrior, 4],
        [8, 8, GodFigure, 4],
        [8, 9, Temple, 4],

        [6, 6, Pyramid],
        [4, 8, GodFigure, 2],
        [3, 8, Obelisk, 2],
        [3, 7, Warrior, 2],
        [1, 6, Temple],
        [3, 4, GodFigure, 4],
        [2, 5, Warrior, 4],
        [3, 5, Pyramid, 4],
        [0, 2, Temple],
      ]
    }
  ],
];
