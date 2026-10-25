// The lockpicking extension's code: lockpicking reads a lock and who would pick it; lockpicking-pick makes an attempt, the player's roll asked with ask, a
// companion's in view, anyone else's behind the screen, the ones rerolled in the same call, and writes what it did to the lock; on the dashboard, the attempt
// of the party. The rules are in lock.ts.
import type { AskedRoll, ExtensionEntry, ExtensionKit, Game, GamePage, GameView, Track, Widget, WidgetText } from "rpg-engine";
import { canReroll, complexity, diceToRoll, failureOf, mostFailures, needsTools, onesIn, rerollsLeft, rogueReduction, roundedDc, timeOf } from "./lock.ts";

/**
 * An attempt in progress on a lock, by its page's name: who picks it, the dice it needs and those passed, the scene it began in, the words the player is asked in, whether the player was asked in words to go ahead, which the next call rolls, and the ones of a
 * roll that wait for a decision, with whether the player rolls their own dice.
 */
interface Attempt
{
    who: string;
    dice: number;
    passed: number;
    scene?: string;
    /** The name of its card on the dashboard, the same for each of its questions (D-507). */
    card?: string;
    question?: string;
    check?: string;
    asked?: boolean;
    pending?: { ones: number; rolled: number; physical?: boolean; };
}

/** What the extension keeps: the attempts in progress, and the last one that ended, for the dashboard while its scene lasts. */
interface State
{
    attempts?: Record<string, Attempt>;
    /** How many attempts began, which names the card of each on the dashboard without naming its lock. */
    begun?: number;
    last?: { lock: string; who: string; dice: number; passed: number; outcome: "open" | "failed"; scene?: string; card?: string; };
}

/** A lock as its page has it. */
interface Lock
{
    page: GamePage;
    dc: number;
    failures: number;
    worn: number;
    tampered: boolean;
    state?: string;
}

/** Who picks a lock: their page, when they have one, and whether they are the player's character. */
interface Picker
{
    name: string;
    page?: GamePage;
    pc: boolean;
}

/** An attempt as one call makes it, whether it begins with it, and the rerolls it spent. */
interface Pick
{
    game: Game;
    lock: Lock;
    picker: Picker;
    attempt: Attempt;
    question: string;
    check: string;
    fresh: boolean;
    spent: number;
}

/** What the call says of the ones: the faces given, a reroll asked or refused. */
interface Decision
{
    values?: number[];
    reroll?: boolean;
}

const rerollsField = "lockpicking-rerolls";
// The faces of physical dice, as the command line writes them: 3,5,6.
const faceList = (z: ExtensionKit["z"]) => z.preprocess((value) => (typeof value === "string" ? value.split(/[\s,;]+/).filter(Boolean).map(Number) : value), z.array(z.int().min(1).max(6)));

const lockpicking: ExtensionEntry = ({ z }) => ({
    commands: [
        {
            name: "lockpicking",
            description: "A lock as lockpicking reads it, before or during an attempt: its complexity, the d6 who picks it rolls and the rounds they take, whether "
                + "thieves' tools are needed, its failures in a row and what they did, the attempt in progress and the rerolls of who picks it. Read-only. "
                + 'Example: lockpicking "Porta della cripta", who Bruna.',
            input: z.object({
                lock: z.string().min(1).describe("the page of the lock, a door, a chest or manacles"),
                who: z.string().optional().describe("who would pick it: who is picking it, else the player's character"),
            }),
            readOnly: true,
            positionals: ["lock"],
            run: (input, game) => {
                const lock = lockOf(game, input.lock);
                return lockText(game, lock, pickerOf(game, input.who ?? stateOf(game).attempts?.[lock.page.name]?.who));
            },
        },
        {
            name: "lockpicking-pick",
            description: "An attempt to pick a lock with d6, in place of the d20 check with thieves' tools: the player's character rolls through ask, a companion in view, "
                + "anyone else behind the screen. Outside a fight it rolls every die left; in a fight two, called again at each of their actions. A 1 resets the lock "
                + "unless rerolls cover every 1, which the player chooses in the same call. It writes the failures and the lock's state. "
                + "question and check in the player's language, never naming a secret lock. "
                + 'Example: lockpicking-pick "Porta della cripta", question "Forzare la serratura prima della ronda", check Scasso.',
            input: z.object({
                lock: z.string().min(1).describe("the page of the lock, with lock-dc written on it"),
                who: z.string().optional().describe("who is picking it, else the player's character"),
                question: z.string().optional().describe("for the player's roll, what is at stake, in their language, as ask's question; kept for the next calls"),
                check: z.string().optional().describe("the roll's name the player sees, in their language, such as Scasso; kept for the next calls"),
                values: faceList(z).optional().describe("the faces of physical dice, as the player tells them: of the dice, or of the rerolls when asked"),
                reroll: z.boolean().optional().describe("the decision on the ones, when the call asked for it: true to reroll them, false to take the failure"),
                stop: z.boolean().optional().describe("true to break off the attempt: the dice passed are lost, and it is no failure, but for a 1 waiting for its decision"),
            }),
            positionals: ["lock"],
            needsPlayer: true,
            run: (input, game) => attempt(game, input),
        },
    ],
    timePassed: (_passage, game) => {
        const state = stateOf(game);
        const dropped = Object.entries(state.attempts ?? {});

        // How an attempt ended stays on the dashboard while its scene lasts; outside a scene, until the time passes.
        const kept = { ...(state.begun === undefined ? {} : { begun: state.begun }), ...(state.last?.scene === undefined ? {} : { last: state.last }) };

        if (dropped.length === 0 && kept.last === state.last) {
            return [];
        }

        game.state.write(kept);
        return dropped.map(([lock, held]) => `${held.who}'s attempt on ${lock} is broken off as the time passed: the dice passed are lost, and it is no failure.`);
    },
    widgets: { lock: (game, card) => lockWidget(game, card?.key) },
});

export default lockpicking;

/** An attempt by its input: stopped, a decision on the ones, or the dice of this call. */
async function attempt(game: Game, input: { lock: string; who?: string; question?: string; check?: string; values?: number[]; reroll?: boolean; stop?: boolean; }): Promise<string>
{
    const lock = lockOf(game, input.lock);
    const held = stateOf(game).attempts?.[lock.page.name];

    if (input.stop === true && held?.pending === undefined) {
        return held === undefined ? `No one is picking ${lock.page.name}: there is nothing to stop.` : stopped(game, lock, held);
    }

    if (lock.state === "open" || lock.state === "jammed") {
        throw new Error(`${lock.page.name} is ${lock.state}: there is nothing to pick.${lock.state === "jammed" ? " It may still be forced or broken, by the system's rules." : ""}`);
    }

    const picker = pickerOf(game, input.who ?? held?.who);

    if (held !== undefined && held.who !== picker.name) {
        throw new Error(`${held.who} is picking ${lock.page.name}: go on with who ${held.who}, or break it off first with stop.`);
    }

    const begun: Attempt = held ?? { who: picker.name, dice: diceOf(lock, picker), passed: 0, card: newCard(game), ...sceneOf(game) };
    const question = wordsOr(input.question, begun.question ?? "Pick the lock: a 1 resets it");
    const check = wordsOr(input.check, begun.check ?? "Lockpicking");
    const pick: Pick = { game, lock, picker, attempt: { ...begun, question, check }, question, check, fresh: held === undefined, spent: 0 };
    const stranger = picker.page === undefined ? `\n${picker.name} names no page: rolled as a stranger's, without rerolls. If they are of the party, break it off with stop and give who as their page's name.` : "";

    // A 1 left waiting for its decision is a failure all the same.
    if (input.stop === true) {
        return failed(pick, `${onesText(held?.pending?.ones ?? 1)} waiting for the rerolls when it was broken off`);
    }

    if (pick.attempt.dice === 0) {
        return opened(pick, `${picker.name} opens ${lock.page.name} at once, with an action: no die to roll.`);
    }

    if (pick.attempt.pending !== undefined) {
        return `${await settle(pick, pick.attempt.pending.rolled, pick.attempt.pending.ones, { values: input.values, reroll: input.reroll })}${stranger}`;
    }

    if (input.reroll !== undefined) {
        throw new Error(`No ones of ${lock.page.name} wait for a decision: give reroll only when the call asks for it.`);
    }

    const rolled = Math.min(pick.attempt.dice - pick.attempt.passed, inFight(game) ? 2 : pick.attempt.dice);
    const faces = await rollOf(pick, rolled, input.values);
    return `${typeof faces === "string" ? faces : await settle(pick, rolled, onesIn(faces), {})}${stranger}`;
}

/**
 * The faces of this call's dice: given, asked of the player, or rolled by the engine, for who is not the player's character or for a player asked in words with
 * the engine's dice; a text for the master when nothing was rolled.
 */
async function rollOf(pick: Pick, dice: number, values: number[] | undefined): Promise<number[] | string>
{
    const { game, picker, lock } = pick;
    const notation = `${dice}d6`;
    const again = `call lockpicking-pick ${quoted(lock.page.name)} again`;

    if (values !== undefined && values.length !== dice) {
        throw new Error(`Give values the faces of the ${dice} dice of this call, one for each: ${values.length} were given. Nothing was rolled.`);
    }

    if (values !== undefined || !picker.pc || pick.attempt.asked === true) {
        pick.attempt = { ...pick.attempt, asked: undefined };
        return game.roll(notation, { who: picker.name, why: "lockpicking", check: pick.check, says: saysOf, tones: tonesOf, ...(values === undefined ? {} : { values }) }).faces;
    }

    // Kept before asking, so that the dashboard's card shows it while the player rolls.
    save(game, lock.page.name, pick.attempt);
    const asked = await game.ask({ who: picker.name, question: pick.question, check: pick.check, notation, decline: "Not now", ...cardOf(pick) });

    if ("rolled" in asked) {
        return asked.rolled.faces;
    }

    if ("declined" in asked || "said" in asked) {
        forget(pick);
    }

    if ("declined" in asked) {
        return "The player changed their mind: no die rolled, and the lock is as it was. Ask what they do instead.";
    }

    if ("said" in asked) {
        return `The player answered in their own words: «${asked.said}». Nothing was rolled: take it as what they do.`;
    }

    // Asked in words: the player's faces come with values; with the engine's dice, the next call rolls them.
    save(game, lock.page.name, { ...pick.attempt, ...(asked.physical ? {} : { asked: true }) });
    return asked.physical
        ? `Ask the player in words: ${asked.inWords}. Then ${again} with values, the faces they tell.`
        : `Ask the player in words: ${asked.inWords}; when they go ahead, ${again}: it rolls.`;
}

/** The ones of a roll: rerolled while the rerolls cover them all and who picks chooses to; then the dice pass, or it is a failure. */
async function settle(pick: Pick, rolled: number, ones: number, decision: Decision): Promise<string>
{
    let left = ones;
    let given = decision;

    while (left > 0) {
        const rerolls = rerollsOf(pick.picker);

        if (!canReroll(left, rerolls)) {
            const why = rerolls === 0 ? (emptyText(pick.picker) === "" ? "" : `, and no reroll is left${emptyText(pick.picker)}`) : `, and ${rerollsText(rerolls)} cannot cover ${left}, so none is spent`;
            return failed(pick, `${onesText(left)}${why}`);
        }

        if (given.reroll === false) {
            return failed(pick, `${onesText(left)}, and the rerolls were not spent`);
        }

        // Kept before asking: a call stopped meanwhile leaves the ones waiting, never forgotten.
        pick.attempt = { ...pick.attempt, pending: { ones: left, rolled } };
        save(pick.game, pick.lock.page.name, pick.attempt);
        const faces = await rerolled(pick, left, rerolls, given);
        given = {};

        if (faces === "declined") {
            return failed(pick, `${onesText(left)}, and the player kept their rerolls`);
        }

        if (typeof faces === "string") {
            return faces;
        }

        spendRerolls(pick, left);
        left = onesIn(faces);
    }

    return passed(pick, rolled);
}

/** The faces of the rerolls of the ones: given, asked of the player, or rolled for who when the master said so; "declined", or a text when the decision stays open. */
async function rerolled(pick: Pick, ones: number, rerolls: number, given: Decision): Promise<number[] | string | "declined">
{
    const { game, picker, lock } = pick;
    const notation = `${ones}d6`;
    const by = { who: picker.name, why: "lockpicking, rerolls", check: pick.check, says: saysOf, tones: tonesOf };
    const again = `call lockpicking-pick ${quoted(lock.page.name)} again`;

    if (given.values !== undefined && given.values.length !== ones) {
        throw new Error(`Give values only the faces of the rerolls, ${ones}, one for each 1: ${given.values.length} were given. Nothing was rolled.`);
    }

    if (given.values !== undefined || given.reroll === true) {
        return game.roll(notation, { ...by, ...(given.values === undefined ? {} : { values: given.values }) }).faces;
    }

    if (!picker.pc) {
        return `${picker.name} rolled ${onesText(ones)} on ${lock.page.name} and has ${rerollsText(rerolls)}: decide for them, then ${again} with reroll true or false.`;
    }

    // The question says how many are left; its button that turns it down takes the failure.
    const question: WidgetText = { text: ones === 1 ? "A 1 came up: reroll? {left} left" : "{ones} ones came up: reroll them? {left} left", values: { ones, left: rerolls } };
    const asked = await game.ask({
        who: picker.name,
        question,
        check: pick.check,
        notation,
        roll: { label: "Reroll", note: { text: "{left} left", values: { left: rerolls } } },
        decline: { label: "Leave", note: "it resets" },
        ...cardOf(pick),
    });

    if ("rolled" in asked) {
        return asked.rolled.faces;
    }

    if ("declined" in asked) {
        return "declined";
    }

    if ("said" in asked) {
        return `The player answered in their own words: «${asked.said}». Nothing was rerolled: ${again} with reroll true to roll the rerolls, or false to take the failure.`;
    }

    const spend = `Ask the player in words whether they spend ${ones} of their ${rerollsText(rerolls)} on ${onesText(ones)}`;

    if (asked.physical) {
        save(game, lock.page.name, { ...pick.attempt, pending: { ones, rolled: pick.attempt.pending?.rolled ?? ones, physical: true } });
        return `${spend}: if so, they roll ${notation}; ${again} with values, their faces, or with reroll false.`;
    }

    return `${spend}: if so, ${again} with reroll true: it rolls; if not, with reroll false.`;
}

/** The dice of this call passed: the lock opens when they were the last, else the attempt goes on at the next action. */
function passed(pick: Pick, rolled: number): string
{
    const { picker, lock } = pick;
    const attempt = { ...pick.attempt, passed: pick.attempt.passed + rolled, pending: undefined };

    if (attempt.passed >= attempt.dice) {
        return opened({ ...pick, attempt }, `${picker.name} picks ${lock.page.name}: ${attempt.dice}d6 without a 1 left${spentText(pick)}.`);
    }

    save(pick.game, lock.page.name, attempt);
    const left = attempt.dice - attempt.passed;
    return `${picker.name} passes ${rolled} of the ${attempt.dice} dice of ${lock.page.name} with their action${
        spentText(pick)
    }, ${left} left: call lockpicking-pick again at their next action; with Fast Hands, twice in a round. If they leave the lock, fall or turn to fight, break it off with stop.`;
}

/** The lock opens: its failures back to 0, open, written on its page. */
function opened(pick: Pick, said: string): string
{
    const { game, lock, picker, attempt } = pick;
    game.set(lock.page.name, { "lock-failures": 0, "lock-state": "open" }, `picked by ${picker.name}`);
    end(game, lock.page.name, attempt, "open");
    return `${said} It is open (lock-state open; clear it when it is locked again).${attempt.dice === 0 ? "" : timeText(game, attempt)}`;
}

/** A failure: the lock resets, the attempt's dice lost, and the failures in a row do what the rules say, written on its page. */
function failed(pick: Pick, why: string): string
{
    const { game, lock, picker, attempt } = pick;
    const failure = failureOf(lock.failures + 1);
    const values = {
        "lock-failures": failure.failures,
        ...(failure.tampered ? { "lock-tampered": "yes" } : {}),
        ...(failure.worn ? { "lock-worn": lock.worn + 1 } : {}),
        ...(failure.jammed ? { "lock-state": "jammed" } : {}),
    };
    game.set(lock.page.name, values, `failed by ${picker.name}`);
    end(game, lock.page.name, attempt, "failed");
    // The player's character makes the check for the tools as every roll of theirs, through ask (D-500).
    const checked = picker.pc ? `with ask, as Dexterity 1d20+dex-mod` : "with roll";
    const does = failure.jammed
        ? `it is jammed and no one picks it any more. Ask ${picker.name} for a Dexterity check against DC ${lock.dc} ${checked}: if it fails, the thieves' tools break; take them from the inventory. Then it is forced or broken by the system's rules, opened by Knock or mended by a smith, as you rule`
        : failure.worn
        ? "the mechanism is getting ruined: its complexity goes up by 1 (lock-worn)"
        : failure.tampered
        ? "it now shows signs of tampering, which whoever looks at it later notices (lock-tampered)"
        : "it resets, and the next attempt starts over";
    return `${picker.name} fails ${lock.page.name}: ${why}${spentText(pick)}. Failure ${failure.failures} of ${mostFailures} in a row: ${does}.${timeText(game, attempt)}`;
}

/** An attempt broken off: lost, and no failure. */
function stopped(game: Game, lock: Lock, held: Attempt): string
{
    const state = stateOf(game);
    game.state.write({ ...state, attempts: without(state.attempts, lock.page.name) });
    game.log(`lockpicking ${lock.page.name}: ${held.who} broke off`);
    return `${held.who} breaks off picking ${lock.page.name}: the ${held.passed} dice passed are lost, and it is no failure.`;
}

/** The attempt ended: out of the state, kept as the last for the dashboard, with a line only the master sees. */
function end(game: Game, lock: string, attempt: Attempt, outcome: "open" | "failed"): void
{
    const attempts = without(stateOf(game).attempts, lock);
    const last = {
        lock,
        who: attempt.who,
        dice: attempt.dice,
        passed: outcome === "open" ? attempt.dice : attempt.passed,
        outcome,
        ...(attempt.scene === undefined ? {} : { scene: attempt.scene }),
        ...(attempt.card === undefined ? {} : { card: attempt.card }),
    };
    game.state.write({ ...stateOf(game), attempts, last });
    game.log(`lockpicking ${lock}: ${attempt.who}, ${outcome}`);
}

/** Spends rerolls on the ones, one for each, from the character's. */
function spendRerolls(pick: Pick, ones: number): void
{
    const { picker } = pick;
    const left = rerollsLeft(ones, rerollsOf(picker));
    pick.spent += ones;

    if (picker.page !== undefined && left !== rerollsOf(picker)) {
        pick.game.set(picker.page.name, { [rerollsField]: left }, "lockpicking rerolls");
        picker.page = pick.game.page(picker.page.name) ?? picker.page;
    }
}

/** An attempt that began with a roll the player did not make: as if it never was. */
function forget(pick: Pick): void
{
    if (pick.fresh) {
        const state = stateOf(pick.game);
        pick.game.state.write({ ...state, attempts: without(state.attempts, pick.lock.page.name) });
    }
}

/** What every question of an attempt asks in: the card of the widget lock, its rule, and what its dice mean and how each turned out (D-507). */
function cardOf(pick: Pick): Partial<AskedRoll>
{
    return {
        card: { widget: "lock", key: pick.attempt.card ?? "attempt" },
        rule: "A 1 resets the lock · one reroll for each 1",
        says: saysOf,
        tones: tonesOf,
    };
}

/** How each die turned out: a 1 is bad, any other face lifts a pin. */
function tonesOf(faces: number[]): ("good" | "bad")[]
{
    return faces.map((face) => (face === 1 ? "bad" : "good"));
}

/** The name of a new attempt's card: never its lock's, which may be a secret. */
function newCard(game: Game): string
{
    const state = stateOf(game);
    const begun = (state.begun ?? 0) + 1;
    game.state.write({ ...state, begun });
    return `attempt-${begun}`;
}

/** What the faces of a roll mean, which the player sees in place of their sum: the pins, or the ones. */
function saysOf(faces: number[]): WidgetText
{
    const ones = onesIn(faces);

    if (ones > 0) {
        return ones === 1 ? "A 1" : { text: "{ones} ones", values: { ones } };
    }

    return faces.length === 1 ? "One pin, no 1" : { text: "{pins} pins, no 1", values: { pins: faces.length } };
}

/** ", 1 reroll spent (1 left)": what this call spent, said with how it ends. */
function spentText(pick: Pick): string
{
    return pick.spent === 0 ? "" : `, ${rerollsText(pick.spent)} spent (${rerollsOf(pick.picker)} left${emptyText(pick.picker)})`;
}

/** The time the whole attempt took, outside a fight: rounds in it are the turns'. */
function timeText(game: GameView, attempt: Attempt): string
{
    return inFight(game) ? "" : ` It took ${timeOf(attempt.dice).seconds} s: advance them if anything waits on it.`;
}

// What is undefined in it the state leaves out, as YAML writes it.
function save(game: Game, lock: string, attempt: Attempt): void
{
    const state = stateOf(game);
    game.state.write({ ...state, attempts: { ...state.attempts, [lock]: attempt } });
}

/** A lock by its page; refused without a page, or without lock-dc, with how to write it. */
function lockOf(game: GameView, name: string): Lock
{
    const page = game.page(name);

    if (page === undefined) {
        throw new Error(`No page alone is named ${name}: write the lock's page first, a door, a chest or manacles, with its lock-dc.`);
    }

    const dc = page.value("lock-dc");

    if (typeof dc !== "number") {
        throw new Error(
            `${page.name} has no lock-dc: write it first from the typical DCs (SRD 5.1 p. 77: 5 very easy, 10 easy, 15 medium, 20 hard, 25 very hard, 30 nearly impossible; the Lock and the Manacles are picked at 15, and slipping out of manacles is another check), as write ${
                quoted(page.name)
            } --set lock-dc=15.`,
        );
    }

    const number = (field: string): number => (typeof page.value(field) === "number" ? (page.value(field) as number) : 0);
    const text = (field: string): string | undefined => (typeof page.value(field) === "string" ? String(page.value(field)).trim().toLowerCase() : undefined);
    return { page, dc, failures: number("lock-failures"), worn: number("lock-worn"), tampered: text("lock-tampered") !== undefined && text("lock-tampered") !== "no", state: text("lock-state") };
}

/**
 * Who picks: the one named, by their page when they have one, else as named, as a foe in the scene; the player's character when left out. A name that only
 * begins one of the party's, as Bruna for Bruna Sala, is refused with theirs.
 */
function pickerOf(game: GameView, given: string | undefined): Picker
{
    const members = game.party()?.members ?? [];
    const name = given === undefined || given.trim() === "" ? members.find((member) => member.pc)?.name : given.trim();

    if (name === undefined) {
        throw new Error("Give who picks the lock: the party has no player character to take.");
    }

    const page = game.page(name);
    const plain = (text: string): string => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const meant = page === undefined ? members.find((member) => plain(member.name).startsWith(`${plain(name)} `)) : undefined;

    if (meant !== undefined) {
        throw new Error(`${name} names no page: give who as their page's name, ${meant.name}. Nothing was rolled.`);
    }

    return page === undefined ? { name, pc: false } : { name: page.name, page, pc: page.pc };
}

/** The d6 who picks this lock rolls: its complexity, worn included, less what a rogue's Dexterity takes away. */
function diceOf(lock: Lock, picker: Picker): number
{
    const rogue = (picker.page?.formula("item(classes, Rogue)") ?? 0) > 0;
    return diceToRoll(complexity(lock.dc, lock.worn), rogueReduction(picker.page?.formula("dex-mod") ?? 0, rogue));
}

/** That rerolls spent to the last come back with a short rest; nothing while some are left, or for who has none to spend. */
function emptyText(picker: Picker): string
{
    const counter = picker.page?.counter(rerollsField);
    return counter === undefined || counter.value > 0 || (counter.max ?? 0) === 0 ? "" : ", back with a short rest";
}

function rerollsOf(picker: Picker): number
{
    return Math.max(0, picker.page?.counter(rerollsField)?.value ?? 0);
}

/** What the master reads of a lock and who would pick it. */
function lockText(game: GameView, lock: Lock, picker: Picker): string
{
    const held = stateOf(game).attempts?.[lock.page.name];
    const steps = complexity(lock.dc, lock.worn);
    const dice = held?.dice ?? diceOf(lock, picker);
    const { rounds, seconds } = timeOf(dice);
    const worn = lock.worn > 0 ? `, ${lock.worn} of it from wear` : "";
    const tools = needsTools(lock.dc) ? "thieves' tools needed" : "no tools needed";
    const done = [lock.tampered ? "signs of tampering" : undefined, lock.state].filter((fact) => fact !== undefined);
    const lines = [
        `${lock.page.name}: DC ${lock.dc} (${roundedDc(lock.dc)}), complexity ${steps}${worn}; ${tools}. Failures in a row: ${lock.failures} of ${mostFailures}${done.length === 0 ? "" : `; ${done.join(", ")}`}.`,
        dice === 0 ? `${picker.name} opens it with an action, without a roll.` : `${picker.name} rolls ${dice}d6, in ${rounds} round${rounds === 1 ? "" : "s"} (${seconds} s), with ${rerollsText(rerollsOf(picker))}${emptyText(picker)}.`,
    ];

    if (held !== undefined) {
        const waiting = held.pending === undefined ? "" : `, ${onesText(held.pending.ones)} waiting for ${held.pending.physical === true ? "the rerolls' values, or reroll false" : "reroll true or false"}`;
        lines.push(`${held.who} is picking it: ${held.passed} of ${held.dice} dice passed${waiting}.`);
    }

    return [...lines, lock.state === "open" || lock.state === "jammed" ? "Nothing to pick." : `Next: lockpicking-pick ${quoted(lock.page.name)}${picker.pc ? "" : `, who ${picker.name}`}.`].join("\n");
}

/** The pins up in an attempt: those passed, and while a 1 waits for its decision, the dice of that roll that held. */
/** What an attempt left half way still needs, as its card says it once the call ends: "2 to go". */
function leftText(shown: { dice: number; passed: number; pending?: Attempt["pending"]; outcome?: "open" | "failed"; }): { text: WidgetText; }[]
{
    const left = shown.dice - shown.passed;
    return shown.outcome !== undefined || shown.pending !== undefined || shown.passed === 0 || left <= 0 ? [] : [{ text: { text: "{left} to go", values: { left } } }];
}

/**
 * The pins as steps, in the middle of the card (D-507): those passed; while a 1 waits for its reroll, the pins of that roll that held and the 1s marked after
 * them; while the attempt waits for its dice, those its next roll may lift. At 0 once it failed: the spring took them all back.
 */
function pinsOf(game: GameView, shown: { dice: number; passed: number; pending?: Attempt["pending"]; outcome?: "open" | "failed"; }): Track
{
    const pins = { label: "Pins", max: Math.min(100, shown.dice), look: "steps" as const, stage: "center" as const };

    if (shown.outcome !== undefined) {
        return { ...pins, value: shown.outcome === "open" ? shown.dice : 0 };
    }

    if (shown.pending !== undefined) {
        return { ...pins, value: shown.passed, held: shown.pending.rolled - shown.pending.ones, marked: shown.pending.ones };
    }

    const left = shown.dice - shown.passed;
    return { ...pins, value: shown.passed, coming: inFight(game) ? Math.min(2, left) : left };
}

/** The attempt of the party on the dashboard, or how it ended while its scene lasts: never the lock's name nor its DC. */
function lockWidget(game: GameView, card?: string): Widget | undefined
{
    const state = stateOf(game);
    const members = game.party()?.members ?? [];
    const ofParty = (who: string): boolean => members.some((member) => member.name === who);
    // As a question's card, the attempt of its key; in the column, the party's first.
    const going = Object.entries(state.attempts ?? {}).find(([, held]) => (card === undefined ? ofParty(held.who) : held.card === card));
    const ended = card === undefined ? state.last !== undefined && ofParty(state.last.who) && state.last.scene === sceneOf(game).scene : state.last?.card === card;
    const last = ended ? state.last : undefined;
    const shown = going === undefined ? last : { lock: going[0], ...going[1], outcome: undefined };

    if (shown === undefined) {
        return undefined;
    }

    const lock = game.page(shown.lock);
    const failures = typeof lock?.value("lock-failures") === "number" ? (lock.value("lock-failures") as number) : 0;
    const tampered = lock?.value("lock-tampered");
    const facts = [
        typeof tampered === "string" && tampered.trim().toLowerCase() !== "no" ? "Signs of tampering" : undefined,
        typeof lock?.value("lock-worn") === "number" && (lock.value("lock-worn") as number) > 0 ? "Harder" : undefined,
        lock?.value("lock-state") === "jammed" ? "Jammed" : undefined,
    ].filter((fact) => fact !== undefined);
    const rerolls = game.page(shown.who)?.counter(rerollsField);
    const rerollsMax = Math.min(100, rerolls?.max ?? 0);
    // Under the card's title, Lock: who picks it while they do, then how it went; the failures until it opens.
    const lead = shown.outcome === undefined ? shown.who : shown.outcome === "open" ? "Open" : "Failed";
    const tone = shown.outcome === undefined ? {} : { tone: shown.outcome === "open" ? ("good" as const) : ("bad" as const) };
    return {
        parts: [
            { lead, icon: shown.outcome === "open" ? "lock-open" : "lock", ...tone },
            ...(shown.dice === 0 ? [] : [{ track: pinsOf(game, shown) }]),
            ...(shown.outcome === "open" ? [] : [{ track: { label: "Failures", value: failures, max: mostFailures, look: "pips" as const, stage: "end" as const, tone: "bad" as const } }]),
            ...(facts.length === 0 ? [] : [{ facts }]),
            ...leftText(shown),
            ...(rerolls === undefined || rerollsMax === 0
                ? []
                : [{ track: { label: "Rerolls", value: Math.min(rerolls.value, rerollsMax), max: rerollsMax, look: "pips" as const, stage: "start" as const, tone: "good" as const } }]),
        ],
    };
}

/** The open scene, as the attempts remember it. */
function sceneOf(game: GameView): { scene?: string; }
{
    const scene = game.scene();
    return scene === undefined ? {} : { scene: `${scene.title} · ${scene.opened ?? ""}` };
}

function inFight(game: GameView): boolean
{
    return game.scene()?.round !== undefined;
}

/** The attempts but the one on this lock. */
function without(attempts: Record<string, Attempt> | undefined, lock: string): Record<string, Attempt>
{
    return Object.fromEntries(Object.entries(attempts ?? {}).filter(([name]) => name !== lock));
}

/** Words the master gave, or these when they gave none. */
function wordsOr(given: string | undefined, otherwise: string): string
{
    return given === undefined || given.trim() === "" ? otherwise : given.trim();
}

function stateOf(game: GameView): State
{
    const state = game.state.read();
    return typeof state === "object" && state !== null ? (state as State) : {};
}

function onesText(ones: number): string
{
    return ones === 1 ? "a 1" : `${ones} ones`;
}

function rerollsText(rerolls: number): string
{
    return `${rerolls} reroll${rerolls === 1 ? "" : "s"}`;
}

function quoted(name: string): string
{
    return /\s/.test(name) ? `"${name}"` : name;
}
