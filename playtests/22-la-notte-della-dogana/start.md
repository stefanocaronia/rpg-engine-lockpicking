# 22 La notte della dogana: a night of locks

The first game with the lockpicking extension, `@rpgengine/lockpicking` (D-505), installed from npm as a player would install it. A 5e campaign already under way: Nives, a thief of 3rd level with expertise in thieves' tools, and Tecla, a cleric with no proficiency in them, break into a customs house by night to take the true register from the collector's chest and bring out Tecla's brother, chained in a cell, before the trial at dawn. Six locks between them and the boat: a gate anyone may try, a chest that wants the tools, an iron door already scratched by a prisoner, opened while the guards come, a door the player must not know the name of, and manacles with no DC on their page. The guard changes at three: two hours in a cellar nobody visits, time for a short rest. Giulia's scenario (25 October). A second start, [B](#start-b-at-the-cells-door), plays the same night from 03:25 at the cells' door, in one session from the dashboard, so that the failures in a row and the fight come for sure instead of being hoped for halfway through the night.

It tests:

1. **The roll of d6**: `lockpicking-pick` in place of the d20 check with thieves' tools, as the extension's play.md says; the player's roll through ask, a companion's in view; all the dice at once outside a fight, two per action in one.
2. **Who may try**: below DC 15 anyone, Tecla with her bent wire and no rerolls; from 15 only who has the tools in the inventory; the rerolls from proficiency, doubled by expertise: Nives has 4.
3. **The rerolls**: the player's choice in the same call, spent across the night and given back by a short rest; Guidance and the Help action give none (D-505 (5)).
4. **Failures in a row**: the cells' door starts at 2 of 4 with signs of tampering; a third failure wears it (8 dice instead of 6), a fourth jams it and asks the Dexterity check for the tools.
5. **In a fight**: the cells' door at DC 20 while Corporal Brando and his guards come, two dice per action, again with the bonus action by Fast Hands; an attempt broken off with `stop` is no failure.
6. **A secret lock**: the door behind the barrels, whose page the player does not know: never named in the question, in what the player sees, on the dashboard.
7. **A lock with no DC**: Pietro's manacles, refused until the master writes `lock-dc`, 15 from the Manacles' own text (SRD 5.1 p. 68), before the first roll.
8. **The page**: in session 2, the rolls clicked on the dashboard, the card «Serratura» beside them, and the rerolls on Nives's sheet.

Player: `players/chiara.md`, Chiara who plays a rogue and never leaves a lock closed, with [brief.md](brief.md), what she remembers. This file never goes into the campaign.

## The campaign

Every command below runs from the engine's repo, `rpg-engine`, beside this one: the runner, the player profiles and the questionnaire are there (its `playtests/README.md` says how to prepare a run). The results go to the maintainer's private notes, never into this repo.

Before session 1, in a new folder chosen as `README.md` says, from the repo at the commit under test (PowerShell), after `npm run build`. The extension comes from the npm registry, as for a user: it needs the network. To try a version not yet published, install its repo's folder instead, `rpg package install ..\rpg-engine-lockpicking` after `npm run build` there, and click yes in the window that asks.

```
$run = "<runs>\<date>\<n>"
$campaign = "$run\dogana"
rpg init $campaign --name "La notte della dogana" --system 5e --language it --difficulty normal --lethality dice
Copy-Item -Recurse -Force ..\rpg-engine-lockpickingplaytests\22-la-notte-della-dogana\world\* $campaign\world
Push-Location $campaign
rpg package install lockpicking
rpg package list
rpg config saves checkpoint; rpg config rigor rules; rpg config dice digital; rpg config units metric
rpg config companions "made by the master"; rpg config lines none; rpg config veils none; rpg config advancement milestones; rpg config mentor off
rpg config voices master; rpg config pictures none; rpg config master-rolls "behind the screen"
rpg config calendar-start "day 1"
rpg mode "session zero"; rpg mode play
rpg advance --to "day 1, 23:30" --why "La pianta della dogana sul tavolo di Salvo"
rpg lockpicking "Porta delle celle"
rpg validate; rpg status
Pop-Location
```

- `package install` installs `@rpgengine/lockpicking` from npm, verified, with no yes asked, and adds it to `campaign.yaml`; `package list` gives it with its version.
- `lockpicking "Porta delle celle"` reads the door without changing it: DC 20 (20), complexity 4, thieves' tools needed, failures in a row 2 of 4 with signs of tampering; Nives rolls 6d6 in 3 rounds (18 s) with 4 rerolls. Read-only, so `--prepared` accepts the campaign.
- The settings: rigor rules, lethality dice, saves checkpoint, so a fall in the fight can go back to the end of a scene; dice digital, so the player's rolls are buttons, clicked on the page in session 2; `voices master`, so that the run measures the locks and not the character agent.
- `world/`: 28 pages. `validate` finds no problems; `status` shows day 1, 23:30, Nives (hp 21, ac 14) and Tecla (hp 24, ac 16) in the Rimessa di Salvo with Salvo, the quest «Fuori dalla dogana» (deadline day 2, 06:00), and the events Il cambio della guardia (day 2, 03:00), La ronda di Brando (03:30) and L'alba del processo (06:00).
- The engine is not committed yet: every run command below has `--uncommitted`. The dice have no seed: compare the moments, not the outcomes.

## The sessions

First the check, which plays nothing; then the sessions, from the repo; then the counts and the questionnaire:

```
$run = "<runs>\<date>\<n>"
node playtests/run-playtest.mjs --campaign "$run\dogana" --profile playtests\players\chiara.md --out "$run\results" --prepared ..\rpg-engine-lockpickingplaytests\22-la-notte-della-dogana\brief.md --first "Ciao! Stanotte si entra in dogana, cominciamo?" --max 40 --uncommitted --check
node playtests/run-playtest.mjs --campaign "$run\dogana" --profile playtests\players\chiara.md --out "$run\results" --prepared ..\rpg-engine-lockpickingplaytests\22-la-notte-della-dogana\brief.md --first "Ciao! Stanotte si entra in dogana, cominciamo?" --max 40 --uncommitted
node playtests/run-playtest.mjs --campaign "$run\dogana" --profile playtests\players\chiara.md --out "$run\results" --session 2 --first "Ciao, riprendiamo?" --max 35 --dashboard --moments ..\rpg-engine-lockpickingplaytests\22-la-notte-della-dogana\moments.yaml --uncommitted
node playtests/count-playtest.mjs "$run\results" ..\rpg-engine-lockpickingplaytests\22-la-notte-della-dogana\world > "$run\numbers.md"
node playtests/run-playtest.mjs --profile playtests\players\chiara.md --out "$run\results" --questionnaire playtests\questionnaire.md
```

| Session | Hours | Where |
|---|---|---|
| 1: in | 23:30–03:00 | the plan at the boathouse; the garden's wall or gate; the office and the chest; the cellar, the door behind the barrels, the wait for the change of guard |
| 2: out, with the dashboard | 03:00–05:30 | the guardroom and Ugo; the cells' door in a fight with Brando and two guards; Pietro's manacles; the way out, the door behind the barrels or the garden, Salvo's boat |

A party faster than the table goes on: session 1 may reach the cells, and then session 2 is the fight and the way out. A party that skips the wait plays the cells with all four guards awake.

## The locks

Dice for Nives: the complexity times two, less 2 for her Dexterity (+3, at most 2). For Tecla, no reduction and no rerolls.

| Lock | Page | DC | Tools | Nives | Tecla | Why open it |
|---|---|---|---|---|---|---|
| The garden gate | Cancello dell'orto (item) | 10 | no | 2d6, 1 round | 4d6, 2 rounds | the way in for Tecla in scale mail, who cannot climb the wall quietly; she asks to try it herself (Tecla#Il ferretto) |
| The collector's chest | Forziere del gabelliere (item, `[[Chest]]`) | 15 | yes | 4d6, 2 rounds | cannot | the register, and 40 gp; forcing it with the crowbar is heard from the guardroom below |
| The door behind the barrels | Passaggio dei contrabbandieri (item, unknown to Nives) | 15 | yes | 4d6 | cannot | the way out by water, unseen from the quay; three ways to know it: Gaspare's secret, the cellar's draught and wet footprints (Cantina della Dogana#La porta d'acqua), the register's notes «per la porta d'acqua» |
| The cells' door | Porta delle celle | 20, failures 2, tampered | yes | 6d6, 3 rounds; in a fight 2 per action, 4 a round with Fast Hands; worn, 8d6 | cannot | Pietro and Gaspare behind it; in the lantern's light from the guardroom; Brando's round at 03:30 checks it; the key on Brando's belt is the other way |
| Pietro's manacles | Ceppi di Pietro (item, `[[Manacles]]`, no `lock-dc`) | the master writes 15 | yes | 4d6 | cannot | Pietro chained to the wall; the key is at the collector's house |

The rerolls: 4, spent across the night; the cellar from about 01:00 to 03:00 gives the short rest that brings them back. Guidance and the Help action give no reroll and no die less (D-505 (5)); Chiara asks Tecla's blessing before a hard lock, and the master says it does not help the d6.

## The story

- **The boathouse**: Salvo's charcoal plan and what he knows (Salvo#Cosa sa); his boat until 05:30.
- **The garden**: a three-metre wall with broken glass, easy for Nives (Second-Story Work), loud for Tecla in scale mail; the gate on the lane. The guardroom's window is lit until three.
- **The office**: the chest nailed to the floor, the shown register on the table, the guards' voices through the boards.
- **The cellar**: dark, nobody comes at night, the door behind the barrels (a secret).
- **The guardroom and the cells**: four guards awake until three (Brando, Ugo and two lads, all Guards of the SRD); after the change only Ugo, sleepy, who loses at dice; Brando's round at 03:30, 04:30 and 05:30, his finger on every lock, and the whistle at new scratches: the two sleepers arrive in two rounds. Gaspare tells the way out only to whoever promises to take him too, and shouts if left.
- **The dawn**: at 06:00 the podestà's men come for Pietro. Without the true register he goes to the oars.

## The fight

By the 2014 budget for two characters of 3rd level (easy 150, medium 300, hard 450): Brando and three guards, 100 XP, ×2 for four, 200, between easy and medium; the danger is the alarm and the time, not death. Ugo alone is a guard. The fight is likely, not forced: a party that silences Ugo, takes the key or comes between the rounds may never fight, and then the cells' door is played outside a fight. That is a choice of the player, not the master's finding; note it.

## What to watch

Every moment below, in `dialogue.md` and `turns/`, and in `numbers.md`. The extension's calls are `lockpicking` and `lockpicking-pick`; its writes on the locks' pages are `set` entries of the log, its lines entries of type `extension`.

| | Moment | What should happen |
|---|---|---|
| L1 | Every lock picked | `lockpicking-pick`, never a d20 check with thieves' tools; a trap would stay a d20. Count the attempts by lock and by who, and any d20 rolled to open a lock |
| L2 | The stake before the roll | The question says what a failure costs (time, noise, the round), in Italian, before the dice; a check named as the player sees it (Scasso). A lock with nothing at stake is opened without a roll, as play.md says |
| L3 | Tecla at the gate | The master lets her try below 15, without tools and without rerolls; her roll the engine's, in view; none of her tries at the chest, the passage, the door or the manacles |
| L4 | The tools | At DC 15 and over only who has Thieves' Tools in the inventory; said, and nothing rolled, if Tecla is asked to |
| L5 | The rerolls | 4 at the start, on the sheet as «Ritiri di scasso» 4/4; the player asked in the same call whether to spend them, never the master or the code choosing; the count right after each spend; a short rest gives them back (`counter-changed` in the log), a long one too |
| L6 | No advantage | Guidance or Help give no reroll and nothing is passed for them (D-505 (5)); asked for Tecla's blessing, the master says it does not help the d6. Guidance on a d20, such as the Dexterity check of a jammed lock, stays the system's |
| L7 | The cells' door | 6d6 at first; a third failure says the wear and gives 8d6 next; a fourth says jammed and asks Nives's Dexterity check against DC 20 through ask, the tools taken from the inventory if it fails; then forcing it, the key or another way, by the system's rules. The scratches from Gaspare told when someone looks at it |
| L8 | The fight | A scene of combat with a round; two dice per call; a second call in the same round only with Fast Hands, said as the bonus action; `stop` when Nives leaves the lock to fight or run, with no failure; the turns of the guards between her calls |
| L9 | The secret door | Before Nives knows it, no question, check, answer or dashboard text names «Passaggio dei contrabbandieri»: the question speaks of the little iron door behind the barrels. `reveal` only when the player learns its name (Gaspare, the register). A name leaked is a finding for the master, or for the engine if the master never wrote it |
| L10 | The manacles | `lockpicking-pick` refused for no `lock-dc`; then `write "Ceppi di Pietro" --set lock-dc=15`, from the Manacles' text, with a why, before the roll; never a DC chosen after seeing the dice |
| L11 | Failures in a row on the page | `lock-failures`, `lock-tampered`, `lock-worn`, `lock-state` on the locks' pages as the outputs say; at the next session `lockpicking` reads them again; Brando's round finds the new scratches and whistles, as his page says |
| L12 | How it is told | Pins giving way, the spring snapping back, the hand catching it, a grinding mechanism; never the DC, the complexity or the number of failures in the story; the dice the player rolls, as dice |
| L13 | The time | Outside a fight, «It took N s» advanced when anything waits on it (the round at 03:30, the boat at 05:30); `advance` that breaks off an attempt said to the player |
| L14 | The page, session 2 | The rolls clicked on the dashboard (`page/asked.jsonl`), the rerolls asked there too; the card «Serratura» beside the rolls while Nives picks, with Perni, Fallimenti di fila, Segni di scasso or Più dura, Ritiri, and how it ended until the scene changes; never the lock's name or its DC. Nives's sheet shows «Ritiri di scasso». Whether the World tab shows a known lock's «CD della serratura» to the player: material for the engine, not the master's finding |
| L15 | Sessions 2 | A new master starts from the files: the locks' state from their pages, the rerolls from the sheet, the hour and the events due |
| L16 | The player chooses | The gate or the wall, the wait or not, Gaspare freed or left, the passage or the garden: the risk said, the player choosing, the world holding (Brando's round, Gaspare shouting, the boat leaving at 05:30) |

## Start B: at the cells' door

The same night at 03:25, one session with `--dashboard`. The party came in by the gate, which Nives opened while Tecla wanted to try it; Nives picked the chest and spent three of her four rerolls on it; the register and the 40 gp are hers; the wait in the cellar was under an hour, so no short rest. At 03:00 the guard changed; at 03:15 Ugo fell asleep at the table. Now Nives and Tecla are at the cells' door, at 3 failures in a row, worn, with Gaspare's scratches (one more failure jams it), and Brando gets up from his bunk at 03:25: two rounds to the door, then the whistle, and the two sleepers two rounds after it. Nives has 1 reroll. Behind the door, Pietro's cage has a boat padlock below DC 15, for Tecla alone, and his manacles have no DC.

Player: `players/chiara.md`, with [brief-b.md](brief-b.md). `world-b/` changes six pages of `world/`: La ronda di Brando at 03:25, two rounds away; Ugo asleep; the cells with the padlock; the padlock, Lucchetto della gabbia, DC 10; the cells' door at 3 failures with `lock-worn` 1; Gaspare, who tried it three times.

### The campaign

As for start A, in a folder of its own:

```
$run = "<runs>\<date>\<n>"
$campaign = "$run\dogana-b"
rpg init $campaign --name "La notte della dogana" --system 5e --language it --difficulty normal --lethality dice
Copy-Item -Recurse -Force ..\rpg-engine-lockpickingplaytests\22-la-notte-della-dogana\world\* $campaign\world
Copy-Item -Recurse -Force ..\rpg-engine-lockpickingplaytests\22-la-notte-della-dogana\world-b\* $campaign\world
Push-Location $campaign
rpg package install lockpicking
rpg config saves checkpoint; rpg config rigor rules; rpg config dice digital; rpg config units metric
rpg config companions "made by the master"; rpg config lines none; rpg config veils none; rpg config advancement milestones; rpg config mentor off
rpg config voices master; rpg config pictures none; rpg config master-rolls "behind the screen"
rpg config calendar-start "day 1"
rpg mode "session zero"; rpg mode play
rpg advance --to "day 1, 23:30" --why "La pianta della dogana sul tavolo di Salvo"
rpg advance --to "day 2, 00:00" --why "Il vicolo dei cordai"
rpg write "Cancello dell'orto" --set lock-state=open --why "Aperto da Nives in un momento; Tecla col ferretto in mano voleva provare lei"
rpg move Nives --to "Orto della Dogana"; rpg move Tecla --to "Orto della Dogana"
rpg advance --to "day 2, 00:40" --why "Su per la scala di servizio fino all'ufficio"
rpg move Nives --to "Ufficio del gabelliere"; rpg move Tecla --to "Ufficio del gabelliere"
rpg change Nives lockpicking-rerolls --to 1 --why "Tre ritiri spesi sul forziere del gabelliere"
rpg write "Forziere del gabelliere" --set lock-state=open --text "Un forziere di quercia cerchiato di ferro, inchiodato alle assi, con una serratura di Ponente a tre leve. Vuoto, il coperchio abbassato senza la mandata. Forzarlo col piede di porco si può (Forza CD 15), ma lo sentono dal corpo di guardia, proprio sotto." --why "Aperto da Nives; il registro e la borsa della settimana presi"
rpg move "Registro della gabella" --to Nives
rpg change Nives money --by "+40 gp" --why "La borsa della settimana, dal forziere del gabelliere"
rpg advance --to "day 2, 02:15" --why "Il forziere, le voci delle guardie dalle assi, l'attesa per scendere"
rpg move Nives --to "Cantina della Dogana"; rpg move Tecla --to "Cantina della Dogana"
rpg reveal "Orto della Dogana" "Cancello dell'orto" "Ufficio del gabelliere" "Forziere del gabelliere" "Cantina della Dogana" "Corpo di guardia" "Corridoio delle celle" "Porta delle celle" --to Tecla
rpg advance --to "day 2, 03:00" --why "In cantina fra le balle, meno di un'ora: niente riposo"
rpg write "Il cambio della guardia" --set status=happened --why "Brando e i due ragazzi alle brande, Ugo solo alla lanterna"
rpg advance --to "day 2, 03:20" --why "Ugo si addormenta al tavolo alle tre e un quarto"
rpg move Nives --to "Corridoio delle celle"; rpg move Tecla --to "Corridoio delle celle"
rpg advance --to "day 2, 03:25" --why "Accanto a Ugo che dorme, fino alla porta delle celle"
rpg lockpicking "Porta delle celle"
rpg lockpicking "Lucchetto della gabbia" --who Tecla
rpg validate; rpg status
Pop-Location
Copy-Item -Recurse $campaign "$run\base-b"
```

- `lockpicking "Porta delle celle"`: «DC 20 (20), complexity 5, 1 of it from wear; thieves' tools needed. Failures in a row: 3 of 4; signs of tampering», and Nives 8d6 in 4 rounds (24 s), with 1 reroll. `lockpicking "Lucchetto della gabbia"`: DC 10 (10), complexity 2, no tools needed; Tecla 4d6 in 2 rounds, with 0 rerolls.
- `status`: day 2, 03:25, Nives and Tecla in the Corridoio delle celle, Nives with the register and 52 gp 6 sp, «Ritiri di scasso» 1/4; La ronda di Brando due now, L'alba del processo at 06:00. If `advance` to the event's own minute leaves it out of what is due, move its date to the minute after.
- `base-b` is the campaign before play, for the counts.

### The session

```
$run = "<runs>\<date>\<n>"
node playtests/run-playtest.mjs --campaign "$run\dogana-b" --profile playtests\players\chiara.md --out "$run\results-b" --prepared ..\rpg-engine-lockpickingplaytests\22-la-notte-della-dogana\brief-b.md --first "Ciao! Sono alla porta delle celle, riprendiamo?" --max 30 --dashboard --moments ..\rpg-engine-lockpickingplaytests\22-la-notte-della-dogana\moments-b.yaml --uncommitted --check
node playtests/run-playtest.mjs --campaign "$run\dogana-b" --profile playtests\players\chiara.md --out "$run\results-b" --prepared ..\rpg-engine-lockpickingplaytests\22-la-notte-della-dogana\brief-b.md --first "Ciao! Sono alla porta delle celle, riprendiamo?" --max 30 --dashboard --moments ..\rpg-engine-lockpickingplaytests\22-la-notte-della-dogana\moments-b.yaml --uncommitted
node playtests/count-playtest.mjs "$run\results-b" "$run\base-b\world" > "$run\numbers-b.md"
node playtests/run-playtest.mjs --profile playtests\players\chiara.md --out "$run\results-b" --questionnaire playtests\questionnaire.md
```

### The locks of B

| Lock | Page | DC | Tools | Who | Dice | At the start |
|---|---|---|---|---|---|---|
| The cells' door | Porta delle celle | 20 | yes | Nives | 8d6, worn; in the fight 2 a call, 4 a round with Fast Hands | failures 3 of 4, `lock-worn` 1, Gaspare's scratches; the next failure jams it |
| Pietro's cage | Lucchetto della gabbia (item, in Celle della Dogana) | 10 | no | Tecla, alone | 4d6, 2 rounds; in the fight 2 a call; no rerolls | closed; behind the cells' door, so it waits for it |
| Pietro's manacles | Ceppi di Pietro (no `lock-dc`) | the master writes 15 | yes | Nives | 4d6 | closed |
| The gate, the chest | Cancello dell'orto, Forziere del gabelliere | | | | | open |

Nives's rerolls: 1 of 4, and no rest before dawn but an hour the party chooses to take. The fight: Brando alone first, Ugo at the whistle, the two lads two rounds later; four Guards, 200 XP adjusted, as in start A. The corridor is a dead end in the lantern's light, with one column: hiding or talking is the player's choice, and the world holds (Brando finds who is at the door).

### What to watch in B

The moments of start A that the night reaches (L1, L2, L7, L8, L10, L12, L14, L16), and:

| | Moment | What should happen |
|---|---|---|
| B1 | Brando gets up | The event told at the first turn as what Nives hears; the two rounds said before she chooses: pick, hide, face him. A scene with a round before the first die, so that `lockpicking-pick` rolls 2 a call; never the whole 8d6 at once while Brando comes |
| B2 | Fast Hands | Two calls in Nives's turn, the second as her bonus action (`scene use` with Fast Hands), 4 dice a round; never a third. The guards' turns between her calls |
| B3 | The wear, already there | The door starts worn (3 failures, `lock-worn` 1): told as the mechanism grinding when Nives first works it, never as a number; 8d6; the card «Più dura» from the first call. The third failure as it happens is start A's (L7) |
| B4 | The fourth failure | Jammed: no more `lockpicking-pick`; Nives's Dexterity check against DC 20 through `ask`, never rolled by the master; the tools out of her inventory if it fails; then the key on Brando's belt, forcing it or another way, by the system's rules and the player's choice |
| B5 | The reroll asked | With 1 left, the question on the page and in the chat's form says what is at stake and how many rerolls she has; spent, 0 left and no more asked; two ones with one reroll a failure without a question. Count the questions and what each said |
| B6 | `stop` | When Nives leaves the lock to fight, hide or run: `stop`, no failure, the dice passed lost and said; the card no longer shows an attempt |
| B7 | Tecla at the padlock | Alone, with her wire, in view, no rerolls and never asked as the player's roll; her page's wish told; 2 dice a call in the fight. If the cells' door stays shut, she never reaches it: note it |
| B8 | No advantage | Chiara asks Tecla's blessing: no reroll and nothing passed for it (D-505 (5)); Guidance on the Dexterity check of B4 stays the system's |
| B9 | The page | The card «Serratura» at each call: Perni 2 at a time out of 8, Fallimenti 3 then 4 of 4, Segni di scasso, Più dura, Bloccata, Ritiri 1 then 0; the reroll's question with the rerolls left and «Lascia»; in Tiri, the pins, not a sum; Tecla's attempt on the card too, as one of the party; never a lock's name or DC; the two moments of `moments-b.yaml` |
