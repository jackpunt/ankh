import { GodFigure, Obelisk, Temple, Warrior } from "./ankh-figure";
import { Scenario } from "./scenario-parser";

// Rivers make first 3 Regions: West(1), East(2), Delta(3)

export class AnkhScenario {
  static readonly MiddleKingdom: Scenario[] = [
    // 2 Player:
    {
      ngods: 2,
      regions: [[4, 5, 1], [4, 6, 2], [3, 5, 3],],
      places: [
        [0, 3, 'Temple'],
        [2, 5, 'Pyramid'],
        [1, 8, 'Obelisk'],
        [5, 0, 'Obelisk', 1],
        [4, 1, 'Warrior', 1],
        [5, 1, 'GodFigure', 1],
        [8, 1, 'Pyramid'],
        [6, 5, 'Temple', 2],
        [6, 6, 'Warrior', 2],
        [7, 6, 'GodFigure', 2],
        [5, 8, 'Pyramid'],
      ],
    },
    // 3 player
    {
      ngods: 3,
      regions: [[4, 5, 1], [4, 6, 2], [3, 5, 3],],
      places: [
        [4, 3, 'GodFigure', 1],
        [4, 4, 'Warrior', 1],
        [5, 4, 'Temple', 1],
        [3, 0, 'Pyramid'],
        [7, 2, 'Obelisk'],

        [7, 6, 'GodFigure', 2],
        [6, 6, 'Warrior', 2],
        [6, 5, 'Obelisk', 2],
        [5, 9, 'Temple'],
        [3, 7, 'Pyramid'],

        [2, 5, 'GodFigure', 3],
        [3, 4, 'Warrior', 3],
        [2, 4, 'Pyramid', 3],
        [1, 8, 'Obelisk'],
        [3, 5, 'Temple'],
      ],
    },

    // 4 player
    {
      ngods: 4,
      regions: [[4, 5, 2], [3, 5, 3], [4, 6, 4],],
      splits: [
        [[4, 0, 'N', 'EN'], [4, 1, 'N', 'EN']],
      ],
      places: [
        [3, 1, 'GodFigure', 1],
        [3, 2, 'Warrior', 1],
        [4, 2, 'Temple', 1],
        [5, 5, 'Pyramid'],

        [7, 3, 'GodFigure', 2],
        [7, 4, 'Warrior', 2],
        [8, 4, 'Temple', 2],
        [7, 0, 'Pyramid'],
        [4, 1, 'Obelisk'],

        [2, 5, 'GodFigure', 3],
        [3, 4, 'Warrior', 3],
        [3, 5, 'Obelisk', 3],
        [1, 3, 'Temple'],
        [2, 8, 'Pyramid'],

        [4, 7, 'GodFigure', 4],
        [5, 6, 'Warrior', 4],
        [5, 7, 'Pyramid', 4],
        [3, 8, 'Obelisk'],
        [8, 6, 'Temple'],
      ],
    },
    // 5-player
    {
      ngods: 5,
      regions: [[4, 5, 1], [4, 6, 2], [3, 5, 4]],
      splits: [
        [[7, 5, 'N'], [7, 6, 'WN', 'N'], [6, 7, 'WN', 'N', 'EN']],
        [[4, 0, 'N', 'EN'], [4, 1, 'N', 'EN']],
      ],
      places: [
        [2, 1, 'Temple', 1],
        [3, 1, 'GodFigure', 1],
        [3, 2, 'Warrior', 1],
        [4, 5, 'Pyramid'],
        [4, 1, 'Obelisk'],
        [6, 1, 'GodFigure', 5],
        [7, 1, 'Pyramid', 5],
        [7, 2, 'Warrior', 5],
        [8, 4, 'Temple'],
        [7, 6, 'Obelisk'],
        [8, 7, 'Warrior', 3],
        [8, 8, 'GodFigure', 3],
        [8, 9, 'Temple', 3],

        [6, 6, 'Pyramid'],
        [4, 8, 'GodFigure', 2],
        [3, 8, 'Obelisk', 2],
        [3, 7, 'Warrior', 2],
        [1, 6, 'Temple'],
        [3, 4, 'GodFigure', 4],
        [2, 5, 'Warrior', 4],
        [3, 5, 'Pyramid', 4],
        [0, 2, 'Temple'],
      ],
    },
  ];
  static preBattle: Scenario = {
    ngods: 2,
    // godNames: ["Amun", "Osiris"],
    turn: 9,
    regions: [[4, 5, 1], [4, 6, 2], [3, 5, 3]],
    splits: [],
    guards: ["CatMum", "Apep", "Scorpion"],
    events: [0, 1, 0],
    actions: { "Move": [0, 1], "Summon": [0, 0, 0], "Gain": [1], "Ankh": [1, 0], "selected": [] },
    coins: [3, 1],
    scores: [0, 0.1],
    stable: [[], []],
    ankhs: [["Revered", "Omnipresent", "Pyramid", "Obelisk"], ["Revered", "Omnipresent", "Pyramid", "Obelisk"]],
    places: [[1, 8, "Obelisk", null], [5, 0, "Obelisk", 1], [2, 5, "Pyramid", 1], [8, 1, "Pyramid", 1], [5, 8, "Pyramid", 2], [0, 3, "Temple", null], [6, 5, "Temple", 2], [3, 4, "Warrior", 1], [4, 1, "Warrior", 1], [7, 1, "Warrior", 1], [1, 7, "Warrior", 1], [2, 4, "Warrior", 1], [3, 6, "Warrior", 2], [2, 6, "CatMum", 1], [0, 4, "Apep", 1], [8, 2, "GodFigure", 1], [4, 7, "GodFigure", 2]],
  };

  static preSplit: Scenario = {
    ngods: 2,
    // godNames: ["Amun", "Osiris"],
    turn: 10,
    regions: [[4, 5, 1], [4, 6, 2], [3, 5, 3]],
    splits: [],
    guards: ["CatMum", "Apep", "Scorpion"],
    events: [0, 1, 0, 1],
    actions: { "Move": [0, 1], "Summon": [0, 0, 0], "Gain": [1, 1], "Ankh": [1, 0], "selected": [] },
    coins: [4, 1],
    scores: [4, 2],
    stable: [[], []],
    ankhs: [["Revered", "Omnipresent", "Pyramid", "Temple"], ["Revered", "Omnipresent", "Pyramid", "Temple", "Bountiful"]],
    places: [[2, 6, "CatMum", 1], [0, 4, "Apep", 1], [1, 8, "Obelisk", null], [5, 0, "Obelisk", 1], [2, 5, "Pyramid", 1], [8, 1, "Pyramid", 1], [5, 8, "Pyramid", 2], [2, 3, "Pyramid", 1], [2, 7, "Pyramid", 2], [0, 3, "Temple", null], [6, 5, "Temple", 2], [3, 4, "Warrior", 1], [1, 7, "Warrior", 1], [4, 1, "Warrior", 1], [7, 1, "Warrior", 1], [2, 4, "Warrior", 1], [8, 2, "GodFigure", 1], [4, 7, "GodFigure", 2]],
  };
  static preClaim = {
    ngods: 2,
    // godNames: ["Amun","Anubis"],
    turn: 13,
    regions: [[6, 7, 1], [7, 7, 2], [0, 1, 3], [4, 5, 4]],
    splits: [[[6, 6, 4, false], [6, 7, "S"], [7, 6, "EN"], [6, 7, "WN"], [6, 6, "EN"], [6, 6, "N"]]],
    guards: ["CatMum", "Apep", "Scorpion"],
    events: [0, 1, 0, 1, 1, 0],
    actions: { "Move": [0, 1], "Summon": [], "Gain": [1, 1, 0], "Ankh": [0], "selected": [] },
    coins: [8, 1],
    scores: [4, 2],
    stable: [[], [, , "Scorpion"]],
    ankhs: [["Revered", "Omnipresent", "Pyramid", "Temple", "Bountiful"], ["Revered", "Omnipresent", "Pyramid", "Temple", "Bountiful"]],
    places: [[4, 7, "CatMum", 1], [1, 3, "Apep", 1], [1, 8, "Obelisk", null], [5, 0, "Obelisk", 1], [2, 5, "Pyramid", 1], [8, 1, "Pyramid", 1], [5, 8, "Pyramid", 2], [2, 3, "Pyramid", 1], [2, 7, "Pyramid", 2], [0, 3, "Temple", 1], [6, 5, "Temple", 2], [5, 6, "Warrior", 1], [1, 7, "Warrior", 1], [4, 1, "Warrior", 1], [8, 2, "Warrior", 1], [3, 5, "Warrior", 1], [6, 6, "Warrior", 2], [3, 6, "Warrior", 2], [5, 7, "Warrior", 2], [7, 5, "GodFigure", 1], [2, 8, "GodFigure", 2]],
  };
  static battle4 = {
    ngods: 4,
    godNames: ["Set", "Amun", "Hathor", "Isis"],
    turn: 15,
    regions: [[4, 0, 1], [3, 0, 2], [0, 1, 3], [4, 6, 4]],
    splits: [[[3, 0, 1], [4, 0, "N", "EN"], [4, 1, "N", "EN"]]],
    guards: ["CatMum", "Apep", "Scorpion"],
    events: [0, 1, 2],
    actions: { "Move": [0, 1, 2, 3], "Summon": [1, 0], "Gain": [2, 3, 1, 2], "Ankh": [3, 0, 1, 2], "selected": [] },
    coins: [1, 5, 2, 2],
    scores: [0, 0.1, 0.2, 0.3],
    stable: [["Apep"], [], ["CatMum", "Apep"], []],
    ankhs: [["Revered", "Omnipresent", "Pyramid", "Temple"], ["Revered", "Omnipresent", "Pyramid"], ["Revered", "Omnipresent", "Pyramid", "Temple"], ["Revered", "Omnipresent", "Pyramid"]],
    places: [[4, 1, "Obelisk", null], [3, 5, "Obelisk", 3], [3, 8, "Obelisk", null], [5, 5, "Pyramid", 2], [7, 0, "Pyramid", 1], [2, 8, "Pyramid", 3], [5, 7, "Pyramid", 4], [4, 2, "Temple", 1], [8, 4, "Temple", 2], [1, 3, "Temple", null], [8, 6, "Temple", null], [2, 4, "Warrior", 1], [3, 3, "Warrior", 1], [5, 4, "Warrior", 2], [4, 5, "Warrior", 3], [7, 5, "Warrior", 4], [6, 0, "CatMum", 1], [7, 4, "CatMum", 2], [6, 1, "GodFigure", 1], [7, 1, "GodFigure", 2], [2, 7, "GodFigure", 3], [1, 7, "GodFigure", 4]],
  };
  static withPortal = {
    ngods: 2,
    godNames: ["Anubis", "Osiris"],
    turn: 13,
    regions: [[1, 5, 1], [4, 6, 2], [4, 5, 3], [1, 6, 4]],
    splits: [[[3, 5, 4, false], [1, 5, "EN"], [2, 6, "WN"], [2, 6, "WS"], [3, 6, "WN"], [2, 5, "S"], [3, 5, "WN"]]],
    guards: ["CatMum", "Apep", "Scorpion"],
    events: [0, 1, 0, 1, 1, 0],
    actions: { "Move": [0, 1], "Summon": [0], "Gain": [1, 1, 0], "Ankh": [0], "selected": [] },
    coins: [14, 2],
    scores: [5, 7],
    stable: [[], []],
    ankhs: [["Revered", "Omnipresent", "Pyramid", "Obelisk", "Bountiful"], ["Revered", "Omnipresent", "Pyramid", "Obelisk", "Bountiful"]],
    places: [[2, 6, "CatMum", 1], [1, 8, "Obelisk", null], [5, 0, "Obelisk", 1], [2, 5, "Pyramid", 1], [8, 1, "Pyramid", 1], [5, 8, "Pyramid", 2], [0, 3, "Temple", 1], [6, 5, "Temple", 2], [3, 4, "Warrior", 1], [1, 7, "Warrior", 1], [4, 1, "Warrior", 1], [1, 3, "Warrior", 1], [7, 1, "Warrior", 1], [2, 4, "Warrior", 1], [1, 4, "Warrior", 2], [1, 5, "Portal", 2], [0, 4, "Apep", 1], [1, 5, "Scorpion", 2], [8, 2, "GodFigure", 1], [4, 7, "GodFigure", 2]],
  };
  static big15 = {
    ngods: 4,
    godNames: ["Horus", "Ra", "Anubis", "Osiris"],
    turn: 6,
    regions: [[4, 0, 1], [3, 0, 2], [0, 1, 3], [4, 6, 4]],
    splits: [[[3, 0, 1], [4, 0, "N", "EN"], [4, 1, "N", "EN"]]],
    guards: ["CatMum", "Apep", "Androsphinx"],
    events: [0],
    actions: { "Move": [0, 1, 2, 3], "Summon": [], "Gain": [0, 1], "Ankh": [1], "selected": [] },
    coins: [2, 1, 0, 0],
    scores: [0, 0.1, 0.2, 0.3],
    stable: [["CatMum"], ["CatMum"], [], []],
    ankhs: [["Revered", "Omnipresent"], ["Revered", "Omnipresent"], ["Revered"], ["Revered"]],
    places: [[4, 1, "Obelisk", null], [3, 5, "Obelisk", 3], [3, 8, "Obelisk", null], [5, 5, "Pyramid", null], [7, 0, "Pyramid", 1], [2, 8, "Pyramid", null], [5, 7, "Pyramid", 4], [4, 2, "Temple", 1], [8, 4, "Temple", 2], [1, 3, "Temple", null], [8, 6, "Temple", null], [2, 4, "Warrior", 1], [7, 6, "Warrior", 2], [4, 5, "Warrior", 3], [5, 4, "Warrior", 4], [6, 1, "GodFigure", 1], [7, 1, "GodFigure", 2], [2, 7, "GodFigure", 3], [1, 7, "GodFigure", 4]],
  };
  static big16 = {
    ngods: 4,
    godNames: ["Horus", "Ra", "Anubis", "Osiris"],
    turn: 16,
    regions: [[4, 0, 1], [3, 0, 2], [0, 1, 3], [4, 6, 4]],
    splits: [[[3, 0, 1], [4, 0, "N", "EN"], [4, 1, "N", "EN"]]],
    guards: ["CatMum", "Apep", "Androsphinx"],
    events: [0, 1, 0, 3],
    actions: { "Move": [0, 1, 2, 3], "Summon": [0, 2, 3, 0], "Gain": [1, 2, 3], "Ankh": [2, 3, 1, 2], "selected": [] },
    coins: [2, 0, 0, 3],
    scores: [4, 3, 2, 1],
    stable: [[], ["Apep"], ["CatMum", "Apep"], ["CatMum"]],
    ankhs: [["Revered", "Omnipresent", "Pyramid"], ["Revered", "Omnipresent", "Pyramid", "Temple"], ["Revered", "Omnipresent", "Pyramid", "Obelisk"], ["Revered", "Omnipresent", "Pyramid", "Temple"]],
    places: [[4, 1, "Obelisk", null], [3, 5, "Obelisk", 3], [3, 8, "Obelisk", null], [5, 5, "Pyramid", null], [7, 0, "Pyramid", 1], [2, 8, "Pyramid", null], [5, 7, "Pyramid", 4], [8, 2, "Pyramid", 1], [1, 5, "Pyramid", 1], [5, 0, "Pyramid", 2], [3, 2, "Pyramid", 3], [3, 3, "Pyramid", 4], [4, 2, "Temple", 1], [8, 4, "Temple", 2], [1, 3, "Temple", 1], [8, 6, "Temple", 2], [7, 6, "Warrior", 2], [2, 5, "Warrior", 3], [6, 6, "Warrior", 4], [4, 3, "Portal", 4], [4, 8, "Portal", 4], [2, 4, "Portal", 4], [3, 4, "CatMum", 3], [6, 1, "GodFigure", 1], [7, 1, "GodFigure", 2], [2, 7, "GodFigure", 3], [1, 7, "GodFigure", 4]],
  };
  static big21 = {
    ngods: 4,
    godNames: ["Horus", "Ra", "Anubis", "Osiris"],
    turn: 21,
    regions: [[7, 2, 1], [3, 0, 2], [6, 1, 3], [4, 6, 4], [0, 1, 5]],
    splits: [[[3, 0, 1], [4, 0, "N", "EN"], [4, 1, "N", "EN"]], [[8, 1, 5, false], [6, 1, "ES"], [7, 1, "EN"], [8, 2, "WN"], [7, 1, "S"], [8, 1, "WN"]]],
    guards: ["CatMum", "Apep", "Androsphinx"],
    events: [0, 1, 0, 3, 0, 1, 2],
    actions: { "Move": [], "Summon": [], "Gain": [1, 2, 3, 3, 0], "Ankh": [3, 0], "selected": [] },
    coins: [3, 0, 0, 2],
    scores: [4, 4.1, 2, 1],
    stable: [["Androsphinx"], [], ["Apep"], ["CatMum", "Androsphinx"]],
    ankhs: [["Revered", "Omnipresent", "Pyramid", "Temple", "Bountiful"], ["Revered", "Omnipresent", "Pyramid", "Temple"], ["Revered", "Omnipresent", "Pyramid", "Obelisk"], ["Revered", "Omnipresent", "Pyramid", "Temple", "Bountiful"]],
    places: [[4, 4, "CatMum", 3], [6, 4, "Apep", 2, 'Ra'], [4, 1, "Obelisk", null], [3, 5, "Obelisk", 3], [3, 8, "Obelisk", null], [5, 5, "Pyramid", 2], [7, 0, "Pyramid", 1], [2, 8, "Pyramid", 3], [5, 7, "Pyramid", 4], [8, 2, "Pyramid", 1], [1, 5, "Pyramid", 1], [5, 0, "Pyramid", 2], [3, 2, "Pyramid", 3], [3, 3, "Pyramid", 4], [4, 2, "Temple", 1], [8, 4, "Temple", 2], [1, 3, "Temple", 1], [8, 6, "Temple", 2], [6, 0, "Warrior", 1], [3, 1, "Warrior", 1], [7, 3, "Warrior", 1], [1, 4, "Warrior", 1], [5, 6, "Warrior", 2], [5, 1, "Warrior", 2, 'Ra'], [3, 7, "Warrior", 3], [6, 6, "Warrior", 4], [4, 3, "Portal", 4], [4, 8, "Portal", 4], [2, 4, "Portal", 4], [6, 1, "GodFigure", 1], [8, 3, "GodFigure", 2], [2, 7, "GodFigure", 3], [1, 7, "GodFigure", 4]],
  };
  static big28 = {
    ngods: 4,
    godNames: ["Horus", "Ra", "Anubis", "Osiris"],
    turn: 28,
    regions: [[0, 3, 1], [3, 0, 2], [6, 1, 3], [4, 6, 4], [1, 4, 5], [7, 2, 6]],
    splits: [[[3, 0, 1], [4, 0, "N", "EN"], [4, 1, "N", "EN"]], [[8, 1, 5, false], [6, 1, "ES"], [7, 1, "EN"], [8, 2, "WN"], [7, 1, "S"], [8, 1, "WN"]], [[2, 3, 6, false], [1, 4, "WN"], [1, 3, "N"], [1, 2, "ES"], [2, 2, "EN"], [2, 3, "WN"]]],
    guards: ["CatMum", "Apep", "Androsphinx"],
    events: [0, 1, 0, 3, 0, 1, 2, 1, 3],
    actions: { "Move": [], "Summon": [1, 2, 3, 0, 1], "Gain": [2, 3, 0, 2, 3], "Ankh": [3, 0, 1, 2], "selected": [] },
    coins: [12, 8, 4, 7],
    scores: [14, 13, 4, 3],
    cards: [[2, 2, 0, 0, 0, 0, 0], [2, 2, 0, 0, 2, 0, 0], [2, 0, 0, 2, 2, 2, 0], [2, 2, 0, 2, 2, 0, 0]],
    stable: [[], [], [], []],
    ankhs: [["Revered", "Omnipresent", "Pyramid", "Temple", "Bountiful"], ["Revered", "Omnipresent", "Pyramid", "Temple", "Bountiful"], ["Revered", "Omnipresent", "Pyramid", "Obelisk", "Bountiful"], ["Revered", "Omnipresent", "Pyramid", "Temple", "Bountiful", "Worshipful"]],
    places: [[4, 7, "CatMum", 4], [4, 4, "CatMum", 3], [6, 2, "Apep", 2, "Ra"], [6, 4, "Apep", 3], [4, 3, "Androsphinx", 4], [7, 3, "Androsphinx", 1], [4, 1, "Obelisk", null], [3, 5, "Obelisk", 3], [3, 8, "Obelisk", null], [5, 5, "Pyramid", 2], [7, 0, "Pyramid", 1], [2, 8, "Pyramid", 3], [5, 7, "Pyramid", 4], [8, 2, "Pyramid", 1], [1, 5, "Pyramid", 1], [5, 0, "Pyramid", 2], [3, 2, "Pyramid", 3], [3, 3, "Pyramid", 4], [2, 1, "Pyramid", 1], [4, 2, "Temple", 1], [8, 4, "Temple", 2], [1, 3, "Temple", 1], [8, 6, "Temple", 2], [1, 2, "Temple", 4], [2, 6, "Temple", 3], [6, 0, "Warrior", 1], [3, 1, "Warrior", 1], [1, 4, "Warrior", 1], [7, 1, "Warrior", 1], [2, 0, "Warrior", 1], [5, 6, "Warrior", 2], [7, 7, "Warrior", 2, "Ra"], [4, 5, "Warrior", 2], [4, 0, "Warrior", 2], [1, 8, "Warrior", 3], [5, 4, "Warrior", 3], [6, 6, "Warrior", 4], [2, 2, "Warrior", 4], [4, 3, "Portal", 4], [4, 8, "Portal", 4], [2, 4, "Portal", 4], [6, 1, "GodFigure", 1], [8, 3, "GodFigure", 2], [2, 7, "GodFigure", 3], [1, 7, "GodFigure", 4]]
  };

  static preMerge = {
    ngods: 5,
    godNames: ["Set","Isis","Amun","Osiris","Anubis"],
    turn: 46,
    time: "09-04 18:54:22.634",
    regions: [[9,6,1],[8,5,2],[4,9,3],[0,1,4],[5,9,5],[6,0,6],[5,0,7]],
    splits: [[[7,7,1],[6,6,"WS","S"],[6,7,"WS","S"]],[[6,0,2],[6,0,"N"],[5,1,"WN","N"]],[[8,8,6,false],[9,6,"WN"],[9,6,"N"],[8,6,"ES"],[8,7,"N"],[8,8,"WN"]],[[3,7,7,false],[5,9,"N"],[4,9,"WS"],[5,8,"N"],[4,8,"WS"],[4,7,"N"],[3,7,"WS"]]],
    guards: ["CatMum","Apep","Scorpion"],
    events: [0,1,2,3,3,4,0,3,3,4,2,3],
    actions: {"Move":[4,0],"Summon":[1,2,4,1,4,0],"Gain":[0,1],"Ankh":[],"selected":[]},
    coins: [2,5,0,1,0],
    scores: [15,17,26,29,25],
    cards: [[2,2,2,0,2,0,0],[0,0,0,2,0,0,0],[0,0,0,0,2,0,0],[2,2,0,2,2,0,0],[0,2,0,2,2,2,0]],
    godStates: {"Anubis":{"trapped":[0,3,3]}},
    stable: [["CatMum"],[],["CatMum","Scorpion"],[],[]],
    ankhs: [["Revered","Omnipresent","Temple","Pyramid","Bountiful","Worshipful"],["Revered","Omnipresent","Temple","Pyramid","Bountiful","Worshipful"],["Revered","Omnipresent","Pyramid","Temple","Bountiful","Worshipful"],["Revered","Omnipresent","Pyramid","Temple","Bountiful","Worshipful"],["Revered","Omnipresent","Pyramid","Temple","Bountiful","Worshipful"]],
    places: [[6,1,"CatMum",2],[4,7,"Apep",3],[6,4,"Apep",1],[4,1,"Scorpion",1,"NW"],[6,0,"Obelisk",2],[1,4,"Obelisk",4],[5,9,"Obelisk",5],[8,5,"Obelisk",1],[8,7,"Pyramid",4],[2,2,"Pyramid",2],[2,7,"Pyramid",5],[4,8,"Pyramid",4],[7,5,"Pyramid",4],[5,7,"Pyramid",3],[6,7,"Pyramid",5],[0,1,"Temple",2],[1,7,"Temple",5],[2,9,"Temple",3],[5,6,"Temple",3],[8,9,"Temple",5],[7,7,"Temple",5],[4,0,"Temple",3],[7,2,"Temple",2],[6,5,"Warrior",1],[1,3,"Warrior",2],[2,3,"Warrior",2],[7,1,"Warrior",2],[8,1,"Warrior",2],[3,7,"Warrior",4],[8,6,"Portal",4],[3,8,"Portal",4],[9,8,"Portal",4],[9,6,"Warrior",5],[2,8,"Warrior",5],[8,8,"Warrior",5],[3,6,"Warrior",5],[2,6,"Warrior",5],[6,6,"Warrior",5],[1,2,"GodFigure",2],[8,2,"GodFigure",1],[3,10,"GodFigure",3],[7,9,"GodFigure",4],[6,8,"GodFigure",5]]
  }

  static readonly OldKingdom: Scenario[] = [
    {
      ngods: 2,
      regions: [[1, 5, 3], [4, 6, 2], [4, 4, 1]],
      places: [
        [5, 0, Obelisk, 1], [5, 1, Warrior, 1], [4, 1, GodFigure, 2],
        [5, 4, Temple], [2, 5, Temple], [2, 9, Temple],
        [5, 7, GodFigure, 1], [6, 7, Warrior, 2], [6, 8, Obelisk, 2],
        [8, 2, Temple], [8, 6, Temple],
      ]
    },
    {
      ngods: 3,
      regions: [[1, 5, 1], [4, 6, 2], [4, 4, 3]],
      places: [
        [5, 0, Obelisk, 3], [5, 1, Warrior, 3], [4, 1, GodFigure, 2],
        [7, 1, Temple], [5, 4, Temple],
        [1, 2, Temple], [1, 5, Temple], [1, 7, GodFigure, 3], [1, 8, Obelisk, 1], [2, 8, Warrior, 1],
        [2, 9, Temple], [5, 6, Temple],
        [7, 5, GodFigure, 1], [8, 6, Warrior, 2], [8, 5, Obelisk, 2],
      ]
    },
    {
      ngods: 4,
      regions: [[1, 5, 3], [6, 6, 4], [4, 4, 2], [7, 7, 1]],
      splits: [[[6, 6, 'WS', 'S'], [6, 7, 'WS', 'S']]],
      places: [
        [5,0,Obelisk,2],[5,1,Warrior,2],[4,1,GodFigure,1],
        [7,2,Temple], [5,4,Temple],
        [0, 1, Temple], [1, 4, Obelisk, 3], [2, 4, GodFigure, 2], [1, 5, Warrior, 3], [1, 7, Temple],
        [2, 9, Temple], [5, 6, Temple],
        [5, 8, Warrior, 4], [4, 9, GodFigure, 3], [5, 9, Obelisk, 4],
        [7,5,GodFigure,4], [8,5,Obelisk,1],[8,6,Warrior,1],[8,9, Temple],
      ]
    },
    {
      ngods: 5,
      regions: [[1, 5, 4], [4, 6, 1], [4, 4, 3], [7, 7, 1], [6, 0, 2]],
      splits: [[[6, 6, 'WS', 'S'], [6, 7, 'WS', 'S']],
        [[6, 0, 'N'], [5, 1, 'WN', 'N']]],
      places: [
        [4, 1, Obelisk, 3], [3, 1, GodFigure, 2], [4, 2, Warrior, 3], [4, 4, Temple],
        [6, 0, Obelisk, 2], [5, 1, Warrior,2], [6, 1, GodFigure, 1],
        [0, 1, Temple], [1, 4, Obelisk, 4], [2, 4, GodFigure, 3], [1, 5, Warrior, 4], [1, 7, Temple],
        [2, 9, Temple], [5, 6, Temple], [8, 4, Temple],
        [5, 8, Warrior, 5], [4, 9, GodFigure, 4], [5, 9, Obelisk, 5],
        [7, 5, GodFigure, 5], [8, 5, Obelisk, 1], [8, 6, Warrior, 1], [8, 9, Temple],
      ]
    },
  ]
}
