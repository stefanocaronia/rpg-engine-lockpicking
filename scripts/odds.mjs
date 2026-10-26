// The odds of lockpicking by complexity (D-508), simulated with the rules of dist/lock.js, as built: for each profile and DC, how often the lock opens at the
// first attempt, and before it jams, trying again without a rest. `npm run odds` builds first.
import { complexity, diceToRoll, failureOf, failuresToJam, rerollsPerAttempt, rogueReduction, rolledAttempt } from "../dist/lock.js";

const tries = 100_000;
const dcs = [5, 10, 15, 20, 25, 30];

// Who picks: proficient or not, a rogue's Dexterity, expertise, and the proficiency bonus that gives the rerolls of a short rest.
const profiles = [
    { name: "Not proficient", proficient: false, dexterity: 0, rogue: false, expertise: false, bonus: 0 },
    ...[["1-4", 2], ["5-8", 3], ["13-16", 5]].map(([levels, bonus]) => ({ name: `Proficient, levels ${levels}`, proficient: true, dexterity: 0, rogue: false, expertise: false, bonus })),
    ...[["1-4", 2], ["5-8", 3], ["13-16", 5]].map(([levels, bonus]) => ({ name: `Rogue Dex +3, expertise, levels ${levels}`, proficient: true, dexterity: 3, rogue: true, expertise: true, bonus })),
];

/** Dice of their own seed, so that the table is the same at every run. */
function seeded(seed)
{
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
        return Math.floor((((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296) * 6) + 1;
    };
}

/** One lock tried until it opens or jams, the rerolls spent along the way never back: whether the first attempt opened it, and whether any did. */
function attempts(profile, dc, roll)
{
    let rerolls = profile.bonus;
    let worn = 0;

    for (let inRow = 1; ; inRow++) {
        const dice = diceToRoll(complexity(dc, worn), rogueReduction(profile.dexterity, profile.rogue), profile.proficient);
        const { opened, spent } = rolledAttempt(dice, Math.min(rerolls, rerollsPerAttempt(profile.proficient, profile.expertise)), roll);
        rerolls -= spent;

        if (opened) {
            return { first: inRow === 1, before: true };
        }

        const failure = failureOf(inRow, dc, profile.proficient);
        worn += failure.worn ? 1 : 0;

        if (failure.jammed || inRow >= failuresToJam(dc, profile.proficient)) {
            return { first: false, before: false };
        }
    }
}

const percent = (count) => `${Math.round((count / tries) * 100)}%`;
const rows = profiles.map((profile, index) => {
    const roll = seeded(index + 1);
    const cells = dcs.map((dc) => {
        let first = 0;
        let before = 0;

        for (let one = 0; one < tries; one++) {
            const outcome = attempts(profile, dc, roll);
            first += outcome.first ? 1 : 0;
            before += outcome.before ? 1 : 0;
        }

        return `${percent(first)} / ${percent(before)}`;
    });
    return `| ${profile.name} | ${cells.join(" | ")} |`;
});

console.log(`The lock opens at the first attempt / before it jams, trying again without a rest (${tries} locks each):\n`);
console.log(`| Who | ${dcs.map((dc) => `DC ${dc}`).join(" | ")} |`);
console.log(`|---|${dcs.map(() => "---").join("|")}|`);
console.log(rows.join("\n"));
