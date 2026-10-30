// The lockpicking extension's code: lockpicking reads a lock and who would pick it; lockpicking-pick makes an attempt (attempt.ts); on the dashboard, the
// attempt of the party (widget.ts). The rules are in lock.ts, what it reads and keeps of the game in pages.ts.
import type { GameView, PackageEntry, PackageKit } from "rpg-engine";
import { attempt, brokenOff } from "./attempt.ts";
import { complexity, failuresToJam, needsTools, rerollsPerAttempt, roundedDc, timeOf } from "./lock.ts";
import { diceOf, emptyText, type Lock, lockOf, onesText, type Picker, pickerOf, quoted, rerollsOf, rerollsText, stateOf } from "./pages.ts";
import { lockWidget } from "./widget.ts";

// The faces of physical dice, as the command line writes them: 3,5,6.
const faceList = (z: PackageKit["z"]) => z.preprocess((value) => (typeof value === "string" ? value.split(/[\s,;]+/).filter(Boolean).map(Number) : value), z.array(z.int().min(1).max(6)));

const lockpicking: PackageEntry = ({ z }) => ({
    commands: [
        {
            name: "lockpicking",
            description: "A lock as lockpicking reads it, before or during an attempt: its complexity, the d6 who picks it rolls and the rounds they take, whether "
                + "a tool is needed, its failures in a row and what they did, the attempt in progress and the rerolls of who picks it. Read-only. "
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
                + "unless rerolls cover every 1, which the player chooses in the same call. Who is not proficient with thieves' tools rolls four dice a step, "
                + "without rerolls, with a tool of their inventory you allow, given as tool. It writes the failures and the lock's state. "
                + "question and check in the player's language, never naming a secret lock. "
                + 'Example: lockpicking-pick "Porta della cripta", question "Forzare la serratura prima della ronda", check Scasso.',
            input: z.object({
                lock: z.string().min(1).describe("the page of the lock, with lock-dc written on it"),
                who: z.string().optional().describe("who is picking it, else the player's character"),
                tool: z.string().optional().describe("for who is not proficient with thieves' tools, the item of their inventory they pick it with, as a knife or a screwdriver"),
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
        // A 1 waiting for its decision is a failure, as when the attempt is stopped; any other attempt is lost.
        const lines = Object.entries(stateOf(game).attempts ?? {}).map(([lock, held]) => brokenOff(game, lock, held));
        const state = stateOf(game);

        // How an attempt ended stays on the dashboard while its scene lasts; outside a scene, until the time passes.
        const kept = { ...(state.begun === undefined ? {} : { begun: state.begun }), ...(state.last?.scene === undefined ? {} : { last: state.last }) };

        if (lines.length === 0 && kept.last === state.last) {
            return [];
        }

        game.state.write(kept);
        return lines;
    },
    widgets: { lock: (game, card) => lockWidget(game, card?.key) },
});

export default lockpicking;

/** What the master reads of a lock and who would pick it. */
function lockText(game: GameView, lock: Lock, picker: Picker): string
{
    const held = stateOf(game).attempts?.[lock.page.name];
    const steps = complexity(lock.dc, lock.worn);
    const dice = held?.dice ?? diceOf(lock, picker);
    const { rounds, seconds } = timeOf(dice);
    const worn = lock.worn > 0 ? `, ${lock.worn} of it from wear` : "";
    const jamsAt = failuresToJam(lock.dc, false) === 1 ? "first failure" : "second failure in a row";
    const tools = !picker.proficient
        ? `${picker.name}, not proficient with thieves' tools, needs a tool of their inventory, rolls 4 dice a step without rerolls, and jams it at the ${jamsAt}`
        : needsTools(lock.dc)
        ? "thieves' tools needed"
        : "no tools needed";
    const done = [lock.tampered ? "signs of tampering" : undefined, lock.state].filter((fact) => fact !== undefined);
    const most = picker.proficient ? `, ${rerollsPerAttempt(true, picker.expertise)} an attempt at most` : "";
    const lines = [
        `${lock.page.name}: DC ${lock.dc} (${roundedDc(lock.dc)}), complexity ${steps}${worn}; ${tools}. Failures in a row: ${lock.failures} of ${failuresToJam(lock.dc, picker.proficient)}`
        + `${done.length === 0 ? "" : `; ${done.join(", ")}`}.`,
        dice === 0
            ? `${picker.name} opens it with an action, without a roll.`
            : `${picker.name} rolls ${dice}d6, in ${rounds} round${rounds === 1 ? "" : "s"} (${seconds} s), with ${rerollsText(rerollsOf(picker))}${emptyText(picker)}${most}.`,
    ];

    if (held !== undefined) {
        const waiting = held.pending === undefined ? "" : `, ${onesText(held.pending.ones)} waiting for ${held.pending.physical === true ? "the rerolls' values, or reroll false" : "reroll true or false"}`;
        lines.push(`${held.who} is picking it: ${held.passed} of ${held.dice} dice passed${waiting}.`);
    }

    return [...lines, lock.state === "open" || lock.state === "jammed" ? "Nothing to pick." : `Next: lockpicking-pick ${quoted(lock.page.name)}${picker.pc ? "" : `, who ${quoted(picker.name)}`}.`].join("\n");
}
