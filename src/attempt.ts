// An attempt to pick a lock: the player's roll asked with ask, a companion's in view, anyone else's behind the screen, the ones rerolled in the same call, and
// what it did to the lock, written on its page; broken off by stop or by the time passing.
import type { AskedRoll, Game, GameView, WidgetText } from "rpg-engine";
import { canReroll, failureOf, failuresToJam, onesIn, rerollsLeft, rerollsPerAttempt, timeOf } from "./lock.ts";
import { type Attempt, diceOf, emptyText, inFight, type Lock, lockOf, onesText, type Picker, pickerNamed, pickerOf, quoted, readLock, rerollsField, rerollsOf, rerollsText, save, sceneOf, stateOf, toolOf, without } from "./pages.ts";

/** What the call wants of an attempt: who, the tool, the words of its question, the faces of physical dice, the decision on the ones, or to stop it. */
export interface AttemptInput
{
    lock: string;
    who?: string;
    tool?: string;
    question?: string;
    check?: string;
    values?: number[];
    reroll?: boolean;
    stop?: boolean;
}

/** An attempt as one call makes it, with the words it is asked in, whether it begins with it, and the rerolls it spent. */
interface Pick
{
    game: Game;
    lock: Lock;
    picker: Picker;
    attempt: Attempt & { question: string; check: string; };
    fresh: boolean;
    spent: number;
}

/** What the call says of the ones: the faces given, a reroll asked or refused. */
interface Decision
{
    values?: number[];
    reroll?: boolean;
}

// The words of a question the master gave none for, which the extension's words translate.
const defaultQuestion = "Pick the lock: a 1 resets it";
const defaultCheck = "Lockpicking";

/** An attempt by its input: stopped, a decision on the ones, or the dice of this call. */
export async function attempt(game: Game, input: AttemptInput): Promise<string>
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

    const tool = held === undefined ? toolOf(picker, input.tool) : held.tool;
    const begun: Attempt = held ?? { who: picker.name, dice: diceOf(lock, picker), passed: 0, card: newCard(game), ...sceneOf(game), ...(tool === undefined ? {} : { tool }) };
    const question = wordsOr(input.question, begun.question ?? defaultQuestion);
    const check = wordsOr(input.check, begun.check ?? defaultCheck);
    const pick: Pick = { game, lock, picker, attempt: { ...begun, question, check }, fresh: held === undefined, spent: 0 };
    const stranger = picker.page === undefined
        ? `\n${picker.name} names no page: rolled as a stranger's, without rerolls. If they are of the party, break it off with stop and give who as their page's name.`
        : "";

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

/** An attempt the time passing broke off: lost, and no failure, but for a 1 waiting for its decision, which is one, as when it is stopped. */
export function brokenOff(game: Game, lock: string, held: Attempt): string
{
    const page = game.page(lock);
    const fields = readLock(page);

    if (held.pending === undefined || page === undefined || fields.dc === undefined) {
        return `${held.who}'s attempt on ${lock} is broken off as the time passed: the dice passed are lost, and it is no failure.`;
    }

    const attempt = { ...held, question: held.question ?? defaultQuestion, check: held.check ?? defaultCheck };
    const pick: Pick = { game, lock: { ...fields, page, dc: fields.dc }, picker: pickerNamed(game, held.who), attempt, fresh: false, spent: 0 };
    return failed(pick, `${onesText(held.pending.ones)} waiting for the rerolls when the time passed`);
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
        return game.roll(notation, { who: picker.name, why: "lockpicking", check: pick.attempt.check, says: saysOf, tones: tonesOf, ...(values === undefined ? {} : { values }) }).faces;
    }

    // Kept before asking, so that the dashboard's card shows it while the player rolls.
    save(game, lock.page.name, pick.attempt);
    const asked = await game.ask({ who: picker.name, question: pick.attempt.question, check: pick.attempt.check, notation, decline: "Not now", ...cardOf(pick) });

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
        const rerolls = spendable(pick);
        // The 1s of this roll, kept for the cylinder of a failure as for a decision.
        pick.attempt = { ...pick.attempt, pending: { ones: left, rolled } };

        if (!canReroll(left, rerolls)) {
            return failed(pick, `${onesText(left)}${uncoveredText(pick, left, rerolls)}`);
        }

        if (given.reroll === false) {
            return failed(pick, `${onesText(left)}, and the rerolls were not spent`);
        }

        // Kept before asking: a call stopped meanwhile leaves the ones waiting, never forgotten.
        save(pick.game, pick.lock.page.name, pick.attempt);
        const faces = await rerolled(pick, left, rerollsOf(pick.picker), given);
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
    const by = { who: picker.name, why: "lockpicking, rerolls", check: pick.attempt.check, says: saysOf, tones: tonesOf };
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
        check: pick.attempt.check,
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
    return `${picker.name} passes ${rolled} of the ${attempt.dice} dice of ${lock.page.name} with their action${spentText(pick)}, ${left} left: `
        + "call lockpicking-pick again at their next action; with Fast Hands, twice in a round. If they leave the lock, fall or turn to fight, break it off with stop.";
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
    const failure = failureOf(lock.failures + 1, lock.dc, picker.proficient);
    const values = {
        "lock-failures": failure.failures,
        ...(failure.tampered ? { "lock-tampered": "yes" } : {}),
        ...(failure.worn ? { "lock-worn": lock.worn + 1 } : {}),
        ...(failure.jammed ? { "lock-state": "jammed" } : {}),
    };
    game.set(lock.page.name, values, `failed by ${picker.name}`);
    end(game, lock.page.name, attempt, "failed");
    return `${picker.name} fails ${lock.page.name}: ${why}${spentText(pick)}. Failure ${failure.failures} of ${failuresToJam(lock.dc, picker.proficient)} in a row: ${failureText(pick, failure)}.${timeText(game, attempt)}`;
}

/** What a failure did to the lock, as the master tells it: jammed, with the check for the tools; worn; tampered; or only reset. */
function failureText(pick: Pick, failure: ReturnType<typeof failureOf>): string
{
    const { lock, picker, attempt } = pick;

    if (failure.jammed) {
        // The player's character makes the check for the tools as every roll of theirs, through ask (D-500).
        const checked = picker.pc ? `with ask, as Dexterity 1d20+dex-mod` : "with roll";
        const broken = attempt.tool === undefined ? "the thieves' tools break; take them" : `the ${attempt.tool} breaks; take it`;
        return `it is jammed and no one picks it any more. Ask ${picker.name} for a Dexterity check against DC ${lock.dc} ${checked}: if it fails, ${broken} from the inventory. `
            + "Then it is forced or broken by the system's rules, opened by Knock or mended by a smith, as you rule";
    }

    if (failure.worn) {
        return "the mechanism is getting ruined: its complexity goes up by 1 (lock-worn)";
    }

    return failure.tampered ? "it now shows signs of tampering, which whoever looks at it later notices (lock-tampered)" : "it resets, and the next attempt starts over";
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
        // The 1s that failed it, for its cylinder to mark where they fell.
        ...(outcome === "failed" && attempt.pending !== undefined ? { pending: { ones: attempt.pending.ones, rolled: attempt.pending.rolled } } : {}),
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
    pick.attempt = { ...pick.attempt, rerolled: (pick.attempt.rerolled ?? 0) + ones };

    if (picker.page !== undefined && left !== rerollsOf(picker)) {
        // A counter the rules watch is changed, never just written (API 5).
        pick.game.change(picker.page.name, rerollsField, { to: left }, "lockpicking rerolls");
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

/** The rerolls this attempt may still spend: of the character's, one in all, two with expertise, none without proficiency (D-508). */
function spendable(pick: Pick): number
{
    const most = rerollsPerAttempt(pick.picker.proficient, pick.picker.expertise);
    return Math.max(0, Math.min(rerollsOf(pick.picker), most - (pick.attempt.rerolled ?? 0)));
}

/** Why the rerolls cover not the ones: none left to the character, none more this attempt may spend, or too few for them all. */
function uncoveredText(pick: Pick, ones: number, rerolls: number): string
{
    if (rerolls > 0) {
        return `, and ${rerollsText(rerolls)} cannot cover ${ones}, so none is spent`;
    }

    if (!pick.picker.proficient) {
        return "";
    }

    return rerollsOf(pick.picker) > 0 ? ", and this attempt has spent the rerolls it may" : emptyText(pick.picker) === "" ? "" : `, and no reroll is left${emptyText(pick.picker)}`;
}

/** Words the master gave, or these when they gave none. */
function wordsOr(given: string | undefined, otherwise: string): string
{
    return given === undefined || given.trim() === "" ? otherwise : given.trim();
}
