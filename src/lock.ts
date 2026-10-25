// The rules of lockpicking by complexity, as numbers: the lock's DC rounded to 5, its complexity, the d6 to roll and the rounds they take, the failures in a
// row and what each does, the rerolls of the ones. The code that reads and writes the game is in index.ts.

/** The failures in a row after which a lock jams. */
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

/** The d6 to roll: two for each step of complexity, less what a rogue takes away; at 0 the lock opens with an action, without a roll. */
export function diceToRoll(steps: number, reduction: number): number
{
    return Math.max(0, steps * 2 - reduction);
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

/** What a failure does to the lock, by how many there are in a row now, counting this one: a reset, then tampered, then worn, then jammed. */
export function failureOf(inRow: number): { failures: number; tampered: boolean; worn: boolean; jammed: boolean; }
{
    const failures = Math.min(mostFailures, Math.max(1, inRow));
    return { failures, tampered: failures === 2, worn: failures === 3, jammed: failures === mostFailures };
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
