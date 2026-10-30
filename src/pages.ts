// What lockpicking reads and keeps of the game: a lock and who picks it from their pages, the tool and the dice of an attempt, the rerolls, and the attempts
// in progress in the extension's state.
import type { Game, GamePage, GameView } from "rpg-engine";
import { complexity, diceToRoll, rogueReduction } from "./lock.ts";

/**
 * An attempt in progress on a lock, by its page's name: who picks it, the dice it needs and those passed, the scene it began in, the words the player is asked
 * in, whether the player was asked in words to go ahead, which the next call rolls, and the ones of a roll that wait for a decision, with whether the player
 * rolls their own dice.
 */
export interface Attempt
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
    /** The rerolls it spent so far, of the one or two it may (D-508). */
    rerolled?: number;
    /** The tool of who is not proficient with thieves' tools, from their inventory (D-508). */
    tool?: string;
}

/** What the extension keeps: the attempts in progress, and the last one that ended, for the dashboard while its scene lasts. */
export interface State
{
    attempts?: Record<string, Attempt>;
    /** How many attempts began, which names the card of each on the dashboard without naming its lock. */
    begun?: number;
    last?: { lock: string; who: string; dice: number; passed: number; outcome: "open" | "failed"; scene?: string; card?: string; pending?: { ones: number; rolled: number; }; };
}

/** What a lock's page says of it: its DC when it has one, its failures in a row, its wear, whether it shows tampering, and its state, in lower case. */
export interface LockFields
{
    dc?: number;
    failures: number;
    worn: number;
    tampered: boolean;
    state?: string;
}

/** A lock as its page has it, with its DC. */
export interface Lock extends LockFields
{
    page: GamePage;
    dc: number;
}

/** Who picks a lock: their page, when they have one, and whether they are the player's character. */
export interface Picker
{
    name: string;
    page?: GamePage;
    pc: boolean;
    /** Proficient with thieves' tools, as a stranger with no page is taken to be; with expertise in them (D-508). */
    proficient: boolean;
    expertise: boolean;
}

export const rerollsField = "lockpicking-rerolls";
// The most dice a roll of the engine takes.
const mostDice = 100;

/** What a lock's page says of it, whatever it lacks: nothing but zeros for no page. */
export function readLock(page: GamePage | undefined): LockFields
{
    const number = (field: string): number => (typeof page?.value(field) === "number" ? (page.value(field) as number) : 0);
    const text = (field: string): string | undefined => (typeof page?.value(field) === "string" ? String(page.value(field)).trim().toLowerCase() : undefined);
    const dc = page?.value("lock-dc");
    return {
        ...(typeof dc === "number" ? { dc } : {}),
        failures: number("lock-failures"),
        worn: number("lock-worn"),
        tampered: text("lock-tampered") !== undefined && text("lock-tampered") !== "no",
        ...(text("lock-state") === undefined ? {} : { state: text("lock-state") }),
    };
}

/** A lock by its page; refused without a page, without lock-dc, or with one that asks more dice than a roll takes, with how to write it. */
export function lockOf(game: GameView, name: string): Lock
{
    const page = game.page(name);

    if (page === undefined) {
        throw new Error(`No page alone is named ${name}: write the lock's page first, a door, a chest or manacles, with its lock-dc.`);
    }

    const fields = readLock(page);
    const typical = "the typical DCs (SRD 5.1 p. 77: 5 very easy, 10 easy, 15 medium, 20 hard, 25 very hard, 30 nearly impossible";

    if (fields.dc === undefined) {
        throw new Error(
            `${page.name} has no lock-dc: write it first from ${typical}; the Lock and the Manacles are picked at 15, and slipping out of manacles is another check), `
                + `as write ${quoted(page.name)} --set lock-dc=15.`,
        );
    }

    // Who is not proficient rolls the most dice, four a step.
    if (diceToRoll(complexity(fields.dc, fields.worn), 0, false) > mostDice) {
        throw new Error(`${page.name} has lock-dc ${fields.dc}, which asks more than ${mostDice} dice: write a DC between 5 and 30, from ${typical}), as write ${quoted(page.name)} --set lock-dc=30. Nothing was rolled.`);
    }

    return { ...fields, page, dc: fields.dc };
}

/**
 * Who picks: the one named, by their page when they have one, else as named, as a foe in the scene; the player's character when left out. A name that only
 * begins one of the party's, as Bruna for Bruna Sala, is refused with theirs.
 */
export function pickerOf(game: GameView, given: string | undefined): Picker
{
    const members = game.party()?.members ?? [];
    const name = given === undefined || given.trim() === "" ? members.find((member) => member.pc)?.name : given.trim();

    if (name === undefined) {
        throw new Error("Give who picks the lock: the party has no player character to take.");
    }

    const begins = (member: string): boolean => member[name.length] === " " && game.sameName(member.slice(0, name.length), name);
    const meant = game.page(name) === undefined ? members.find((member) => begins(member.name)) : undefined;

    if (meant !== undefined) {
        throw new Error(`${name} names no page: give who as their page's name, ${meant.name}. Nothing was rolled.`);
    }

    return pickerNamed(game, name);
}

/** Who picks by their name, never refused: by their page, else as a stranger, taken to be proficient with thieves' tools. */
export function pickerNamed(game: GameView, name: string): Picker
{
    const page = game.page(name);

    if (page === undefined) {
        return { name, pc: false, proficient: true, expertise: false };
    }

    const has = (list: string): boolean => (page.formula(`has(${list}, thieves' tools)`) ?? 0) > 0;
    return { name: page.name, page, pc: page.pc, proficient: has("tool-proficiencies"), expertise: has("expertise") };
}

/**
 * The tool of who is not proficient with thieves' tools (D-508): one they carry, in their inventory or inside what they carry, which the master names; refused
 * without one, as the lock is then forced or broken. Who is proficient needs none named.
 */
export function toolOf(picker: Picker, given: string | undefined): string | undefined
{
    if (picker.proficient || picker.page === undefined) {
        return undefined;
    }

    if (given === undefined || given.trim() === "") {
        throw new Error(
            `${picker.name} is not proficient with thieves' tools: give tool, an item of their inventory to pick it with, as thieves' tools, a knife or a screwdriver, `
                + "as you allow. With none, no one picks it: it is forced or broken by the system's rules.",
        );
    }

    if (!picker.page.carries(given.trim())) {
        throw new Error(`${picker.name} carries no ${given.trim()}: give tool as an item of their inventory, or force or break the lock by the system's rules. Nothing was rolled.`);
    }

    return given.trim();
}

/** The d6 who picks this lock rolls: its complexity, worn included, less what a rogue's Dexterity takes away. */
export function diceOf(lock: Lock, picker: Picker): number
{
    const rogue = (picker.page?.formula("item(classes, Rogue)") ?? 0) > 0;
    return diceToRoll(complexity(lock.dc, lock.worn), rogueReduction(picker.page?.formula("dex-mod") ?? 0, rogue), picker.proficient);
}

/** The rerolls who picks has, never below 0. */
export function rerollsOf(picker: Picker): number
{
    return Math.max(0, picker.page?.counter(rerollsField)?.value ?? 0);
}

/** That rerolls spent to the last come back with a short rest; nothing while some are left, or for who has none to spend. */
export function emptyText(picker: Picker): string
{
    const counter = picker.page?.counter(rerollsField);
    return counter === undefined || counter.value > 0 || (counter.max ?? 0) === 0 ? "" : ", back with a short rest";
}

/** The extension's state, without the attempts written wrong by hand: each needs who picks, its dice and those passed. */
export function stateOf(game: GameView): State
{
    const state = game.state.read();

    if (typeof state !== "object" || state === null) {
        return {};
    }

    const { attempts, ...rest } = state as State;
    const valid = typeof attempts === "object" && attempts !== null && !Array.isArray(attempts) ? Object.entries(attempts).filter(([, held]) => isAttempt(held)) : [];
    return { ...rest, ...(attempts === undefined ? {} : { attempts: Object.fromEntries(valid) }) };
}

// What is undefined in it the state leaves out, as YAML writes it.
export function save(game: Game, lock: string, attempt: Attempt): void
{
    const state = stateOf(game);
    game.state.write({ ...state, attempts: { ...state.attempts, [lock]: attempt } });
}

/** The attempts but the one on this lock. */
export function without(attempts: Record<string, Attempt> | undefined, lock: string): Record<string, Attempt>
{
    return Object.fromEntries(Object.entries(attempts ?? {}).filter(([name]) => name !== lock));
}

/** The open scene, as the attempts remember it. */
export function sceneOf(game: GameView): { scene?: string; }
{
    const scene = game.scene();
    return scene === undefined ? {} : { scene: `${scene.title} · ${scene.opened ?? ""}` };
}

export function inFight(game: GameView): boolean
{
    return game.scene()?.round !== undefined;
}

export function onesText(ones: number): string
{
    return ones === 1 ? "a 1" : `${ones} ones`;
}

export function rerollsText(rerolls: number): string
{
    return `${rerolls} reroll${rerolls === 1 ? "" : "s"}`;
}

export function quoted(name: string): string
{
    return /\s/.test(name) ? `"${name}"` : name;
}

function isAttempt(held: unknown): held is Attempt
{
    const attempt = held as Partial<Attempt> | null;
    return typeof attempt === "object" && attempt !== null && typeof attempt.who === "string" && typeof attempt.dice === "number" && typeof attempt.passed === "number";
}
