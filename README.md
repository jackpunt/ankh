# Ankh

Play the game a Ankh (Gods of Egypt) 

2 -- 5 players (for now, hot-seat/shared screen)

Configure the Gods for each player (Anubis, Amun, Bastet, Hathor, Horus, Isis, Osiris, Set, Ra) or get a random selection or permutation.

Configure the Guardians (Satet, Cat-Mummy, Apep, Mummy, Androsphinx, Giant Scorpion) or get a random selection.

Play proceed clockwise from the upper-left panel.

Select your Action(s); Drag-and-Drop to Summon or Move Figures, click to select Ankh powers.

Claim monuments, split regions (and reassign the battle order), and run Battles in each region during Conflict events.

Select battle cards, build monuments, bid for Plague-of-Locusts, all the features are implemented.

The game generates a transcript/log of the game including status objects before each turn and each battle. You can reload back to any previous state.

(copy the state object into the SetState text field, and click SetState)


Run as web app or use Electron.

### details

http query: n= number of gods, gods= names of selected Gods, guards= names of Guardians, scene= MiddleKingdom or OldKingdom

The same parameters can be set via the drop-down selectors; after selecting press Ctrl-c key to start the game.

To split a region, click on the initial vertex, each next vertex, and double click the final vertex.

After spliting a new region, drag the black region markers as allowed by the rules.

The game automatically computes Followers from Gain and Sacrifice; Strength and Devotion from Conflict Dominance and Battles. (and ask confirmation if to sacrifice for Worshipful)

While holding the Shift key, you can 'cheat'; reposition things on the board to fix a silly Summon or Move.

Anubis: you can Summon a warrior from Anubis if you have a follower to sacrifice.

Amun: if you select 2 battle cards, the "Two Cards" token will flip to face down.

Bastet: Deploy - drag the Bastet Cat marker to a Monument; Disarm - drag the Cat marker to an adjacent Figure.

Horus: At the beginning of Conflict drag the (darkred) region markers to regions where you want to impose constraints on the cards to be played.

Osirs: drag the Portal to a hex in the region where you lost a battle.

Ra: drag a Radiance marker onto your Figure after Summoning.

------

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 14.1.1.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
