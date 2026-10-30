// The attempt of the party on the dashboard (D-507, D-509): who picks, the pins as steps, the failures in a row and the rerolls, and how it ended while its
// scene lasts; never the lock's name nor its DC.
import type { GameView, Track, Widget, WidgetText } from "rpg-engine";
import { failuresToJam } from "./lock.ts";
import { type Attempt, inFight, pickerNamed, readLock, rerollsField, sceneOf, stateOf } from "./pages.ts";
import { tumblersOf } from "./tumblers.ts";

/** An attempt as the card shows it: going on, or how it ended. */
type Shown = { dice: number; passed: number; pending?: Attempt["pending"]; outcome?: "open" | "failed"; };

/** The attempt of the party on the dashboard, or how it ended while its scene lasts: never the lock's name nor its DC. */
export function lockWidget(game: GameView, card?: string): Widget | undefined
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

    const lock = readLock(game.page(shown.lock));
    const facts = [lock.tampered ? "Signs of tampering" : undefined, lock.worn > 0 ? "Harder" : undefined, lock.state === "jammed" ? "Jammed" : undefined].filter((fact) => fact !== undefined);
    const rerolls = game.page(shown.who)?.counter(rerollsField);
    const rerollsMax = Math.min(100, rerolls?.max ?? 0);
    // Who picks it, always (D-509); once it ended, how it went; the failures until it opens.
    const lead = shown.outcome === "open" ? "Open" : "Failed";
    // Who is not proficient with thieves' tools jams it sooner (D-508); a stranger with no page is taken to be proficient.
    const jamsAt = failuresToJam(lock.dc ?? 15, pickerNamed(game, shown.who).proficient);
    const tone = shown.outcome === undefined ? {} : { tone: shown.outcome === "open" ? ("good" as const) : ("bad" as const) };
    return {
        // The cylinder its page code draws from these, never the lock's name nor its DC (D-509, D-510).
        data: tumblersOf({
            dice: shown.dice,
            passed: shown.passed,
            ...("pending" in shown && shown.pending !== undefined ? { pending: shown.pending } : {}),
            fight: inFight(game),
            ...(shown.outcome === undefined ? {} : { outcome: shown.outcome }),
        }),
        parts: [
            ...(shown.outcome === undefined ? [] : [{ lead, icon: shown.outcome === "open" ? "lock-open" : "lock", ...tone }]),
            { who: shown.who, does: "picks" },
            ...(shown.dice === 0 ? [] : [{ track: { ...pinsOf(game, shown), figure: "tumblers" } }]),
            ...(shown.outcome === "open" ? [] : [{ track: { label: "Failures", value: lock.failures, max: jamsAt, look: "pips" as const, stage: "end" as const, tone: "bad" as const } }]),
            ...(facts.length === 0 ? [] : [{ facts }]),
            ...leftText(shown),
            ...(rerolls === undefined || rerollsMax === 0
                ? []
                : [{ track: { label: "Rerolls", value: Math.min(rerolls.value, rerollsMax), max: rerollsMax, look: "pips" as const, stage: "start" as const, tone: "good" as const } }]),
        ],
    };
}

/** What an attempt left half way still needs, as its card says it once the call ends: "2 to go". */
function leftText(shown: Shown): { text: WidgetText; }[]
{
    const left = shown.dice - shown.passed;
    return shown.outcome !== undefined || shown.pending !== undefined || shown.passed === 0 || left <= 0 ? [] : [{ text: { text: "{left} to go", values: { left } } }];
}

/**
 * The pins as steps, in the middle of the card (D-507): those passed; while a 1 waits for its reroll, the pins of that roll that held and the 1s marked after
 * them; while the attempt waits for its dice, those its next roll may lift. At 0 once it failed: the spring took them all back.
 */
function pinsOf(game: GameView, shown: Shown): Track
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
