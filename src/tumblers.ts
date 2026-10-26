// What the cylinder of a lock draws (D-509, D-510), worked out from an attempt: a pin for each die, those lifted above the shear line, those of a roll held
// half way while a 1 waits for its reroll, where the 1s are, those the roll may lift, where the pick works, and how it ended. Its page code only draws it.

/** The cylinder's data, which the widget's hook gives the page code. */
export interface Tumblers
{
    /** The pins, one for each die of the attempt. */
    pins: number;
    /** Those lifted above the shear line, from the first. */
    up: number;
    /** After them, those of a roll held half way while its 1s wait for their rerolls. */
    held: number;
    /** The places of the pins of those 1s, from 0, after the held ones. */
    ones: number[];
    /** After them, those the roll asked may lift: two in a fight, else all those left. */
    coming: number;
    /** The place of the pin the pick works on; null once the lock is open, the pick out of the cylinder. */
    pick: number | null;
    /** How the attempt ended: open, or failed, the spring having taken every pin back. */
    outcome?: "open" | "failed";
}

/** An attempt as the cylinder reads it: its dice and those passed, the 1s of a roll waiting for their decision, whether it is a fight, how it ended. */
export interface TumblersOf
{
    dice: number;
    passed: number;
    pending?: { ones: number; rolled: number; };
    fight: boolean;
    outcome?: "open" | "failed";
}

/** The cylinder of an attempt, as its page code draws it. */
export function tumblersOf(attempt: TumblersOf): Tumblers
{
    const pins = Math.max(0, attempt.dice);

    if (attempt.outcome === "open") {
        return { pins, up: pins, held: 0, ones: [], coming: 0, pick: null, outcome: "open" };
    }

    if (attempt.outcome === "failed") {
        return { pins, up: 0, held: 0, ones: [], coming: 0, pick: 0, outcome: "failed" };
    }

    const up = Math.min(pins, attempt.passed);

    if (attempt.pending !== undefined) {
        const held = Math.max(0, Math.min(pins - up, attempt.pending.rolled - attempt.pending.ones));
        const count = Math.max(0, Math.min(pins - up - held, attempt.pending.ones));
        const ones = Array.from({ length: count }, (_, index) => up + held + index);
        return { pins, up, held, ones, coming: 0, pick: ones[0] ?? up + held };
    }

    const left = pins - up;
    return { pins, up, held: 0, ones: [], coming: attempt.fight ? Math.min(2, left) : left, pick: up };
}
