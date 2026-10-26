// The rules of lockpicking by complexity, as numbers: the lock's DC rounded to 5, its complexity, the d6 to roll and the rounds they take, the failures in a
// row and what each does, the rerolls of the ones, for who is proficient with thieves' tools and who is not (D-508). The code that reads and writes the game
// is in index.ts; scripts/odds.mjs gives the odds of these rules.

/** The failures in a row after which a lock jams, for who is proficient with thieves' tools. */
export const mostFailures = 4;

/** The lowest DC the rounded one takes, at which tools are needed, and the seconds of a round. */
const lowestDc = 5;
const toolsDc = 15;
const roundSeconds = 6;

/** A lock's DC rounded to the nearest 5, 13 to 15 and 12 to 10, never below 5. */
export function roundedDc(dc: number): number
{
    return Math.max(lowestDc, Math.floor((dc + 2) / 5) * 5);
}

/** How complex a lock is: its rounded DC by 5, and one more for each time it was worn by a third failure; there is no ceiling. */
export function complexity(dc: number, worn: number): number
{
    return roundedDc(dc) / 5 + Math.max(0, Math.floor(worn));
}

/** The dice a rogue takes away with their Dexterity modifier, at most 2; no one else takes any, and a negative modifier adds none. */
export function rogueReduction(dexterity: number, rogue: boolean): number
{
    return rogue ? Math.min(2, Math.max(0, Math.floor(dexterity))) : 0;
}

/**
 * The d6 to roll (D-508): for who is proficient with thieves' tools two for each step of complexity, less what a rogue takes away; for anyone else four, with
 * a tool of theirs; at 0 the lock opens with an action, without a roll.
 */
export function diceToRoll(steps: number, reduction: number, proficient: boolean): number
{
    return Math.max(0, proficient ? steps * 2 - reduction : steps * 4);
}

/** The rerolls an attempt may spend, of those its picker has (D-508): one, two with expertise in thieves' tools; none without proficiency. */
export function rerollsPerAttempt(proficient: boolean, expertise: boolean): number
{
    return !proficient ? 0 : expertise ? 2 : 1;
}

/** The failures in a row that jam a lock (D-508): four for who is proficient, by the scale of failures; one for anyone else, two at DC 5. */
export function failuresToJam(dc: number, proficient: boolean): number
{
    return proficient ? mostFailures : roundedDc(dc) === lowestDc ? 2 : 1;
}

/** The rounds the dice take, two in each round, and the seconds of them outside a fight. */
export function timeOf(dice: number): { rounds: number; seconds: number; }
{
    const rounds = Math.ceil(dice / 2);
    return { rounds, seconds: rounds * roundSeconds };
}

/** Whether the lock asks for thieves' tools: from a rounded DC of 15, read on its original DC, whatever wore it since. */
export function needsTools(dc: number): boolean
{
    return roundedDc(dc) >= toolsDc;
}

/**
 * What a failure does to the lock, by how many there are in a row now, counting this one: for who is proficient a reset, then tampered, then worn, then
 * jammed; for anyone else a reset until it jams (D-508).
 */
export function failureOf(inRow: number, dc: number, proficient: boolean): { failures: number; tampered: boolean; worn: boolean; jammed: boolean; }
{
    const jams = failuresToJam(dc, proficient);
    const failures = Math.min(jams, Math.max(1, inRow));
    return { failures, tampered: proficient && failures === 2, worn: proficient && failures === 3, jammed: failures === jams };
}

/** The ones among the faces: each a reroll to spend, or a failure. */
export function onesIn(faces: number[]): number
{
    return faces.filter((face) => face === 1).length;
}

/** Whether these rerolls cover every one: one for each, or none at all is spent and it is a failure. */
export function canReroll(ones: number, rerolls: number): boolean
{
    return ones > 0 && rerolls >= ones;
}

/** The rerolls left after the ones: one spent for each when they cover them all, else none. */
export function rerollsLeft(ones: number, rerolls: number): number
{
    return canReroll(ones, rerolls) ? rerolls - ones : rerolls;
}

/**
 * An attempt rolled at once to its end, each 1 rerolled while the rerolls it may spend cover them all, as the player who spends them all would: whether the
 * lock opened, and the rerolls spent. The odds read the rules through it.
 */
export function rolledAttempt(dice: number, rerolls: number, roll: () => number): { opened: boolean; spent: number; }
{
    const faces = (count: number): number[] => Array.from({ length: count }, roll);
    let ones = onesIn(faces(dice));
    let spent = 0;

    while (ones > 0) {
        if (!canReroll(ones, rerolls - spent)) {
            return { opened: false, spent };
        }

        spent += ones;
        ones = onesIn(faces(ones));
    }

    return { opened: true, spent };
}
