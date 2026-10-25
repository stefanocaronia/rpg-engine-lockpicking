// The lockpicking extension (D-257, D-505): the rules of complexity, failures and rerolls, and the extension in a campaign of the fifth edition, through the
// engine's commands, with the dice given and the player's clicks faked.
import fc from "fast-check";
import { fileURLToPath } from "node:url";
import { type Context, type Rows, type TestCampaign, testCampaign } from "rpg-engine/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canReroll, complexity, diceToRoll, failureOf, needsTools, onesIn, rerollsLeft, rogueReduction, roundedDc, timeOf } from "../src/lock.ts";

/** Dice that show these faces in turn. */
function faces(...values: number[]): () => number
{
    const left = [...values];

    return () => {
        const next = left.shift();

        if (next === undefined) {
            throw new Error("the test ran out of dice");
        }

        return next;
    };
}

describe("the rules of lockpicking by complexity", () => {
    it("round the DC to the nearest 5, never below 5, and read the complexity from it, worn locks one more each time, without a ceiling", () => {
        expect([1, 4, 5, 7, 8, 12, 13, 17, 18, 30, 32, 33].map(roundedDc)).toEqual([5, 5, 5, 5, 10, 10, 15, 15, 20, 30, 30, 35]);
        expect([complexity(15, 0), complexity(15, 1), complexity(30, 1), complexity(33, 0), complexity(3, 0)]).toEqual([3, 4, 7, 7, 1]);
        expect([needsTools(12), needsTools(13), needsTools(15), needsTools(30)]).toEqual([false, true, true, true]);
    });

    it("roll two d6 by step, a rogue taking away up to 2 with Dexterity and no one else any; two in a round", () => {
        // DC, rogue, Dexterity modifier, worn: the dice.
        const cases: [number, boolean, number, number, number][] = [
            [15, true, 3, 0, 4],
            [15, false, 3, 0, 6],
            [15, true, 1, 0, 5],
            [5, true, 2, 0, 0],
            [5, true, -1, 0, 2],
            [10, true, 5, 0, 2],
            [10, true, 3, 1, 4],
            [30, false, 0, 0, 12],
            [33, false, 0, 0, 14],
        ];

        for (const [dc, rogue, dexterity, worn, dice] of cases) {
            expect(diceToRoll(complexity(dc, worn), rogueReduction(dexterity, rogue)), `DC ${dc} ${rogue ? "rogue" : "other"} ${dexterity} worn ${worn}`).toBe(dice);
        }

        expect([timeOf(0), timeOf(4), timeOf(5), timeOf(12)]).toEqual([{ rounds: 0, seconds: 0 }, { rounds: 2, seconds: 12 }, { rounds: 3, seconds: 18 }, { rounds: 6, seconds: 36 }]);
    });

    it("make each failure in a row worse: reset, tampered, worn, jammed at the fourth, never past it", () => {
        expect([1, 2, 3, 4, 5].map(failureOf)).toEqual([
            { failures: 1, tampered: false, worn: false, jammed: false },
            { failures: 2, tampered: true, worn: false, jammed: false },
            { failures: 3, tampered: false, worn: true, jammed: false },
            { failures: 4, tampered: false, worn: false, jammed: true },
            { failures: 4, tampered: false, worn: false, jammed: true },
        ]);
    });

    it("keep the failures from 0 to 4, wear the lock only at the third and never unjam it, over any run of attempts", () => {
        fc.assert(fc.property(fc.array(fc.boolean(), { maxLength: 30 }), (outcomes) => {
            let lock = { failures: 0, worn: 0, jammed: false };

            for (const opens of outcomes) {
                if (lock.jammed) {
                    break;
                }

                const failure = failureOf(lock.failures + 1);
                lock = opens ? { ...lock, failures: 0 } : { failures: failure.failures, worn: lock.worn + (failure.worn ? 1 : 0), jammed: failure.jammed };
                expect(lock.failures).toBeGreaterThanOrEqual(0);
                expect(lock.failures).toBeLessThanOrEqual(4);
                expect(failure.worn).toBe(failure.failures === 3);
            }

            expect(lock.jammed).toBe(lock.failures === 4);
        }));
    });

    it("spend a reroll for each 1 only when they cover them all, never below 0 and never in part; many ones are one failure", () => {
        expect([canReroll(0, 3), canReroll(1, 1), canReroll(2, 1), canReroll(2, 2)]).toEqual([false, true, false, true]);
        expect([rerollsLeft(2, 3), rerollsLeft(2, 1)]).toEqual([1, 1]);
        expect(onesIn([1, 1, 4, 6])).toBe(2);

        fc.assert(fc.property(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 0, max: 12 }), (ones, rerolls) => {
            const left = rerollsLeft(ones, rerolls);
            expect(left).toBeGreaterThanOrEqual(0);
            expect(left).toBe(canReroll(ones, rerolls) ? rerolls - ones : rerolls);
        }));
    });
});

describe("lockpicking in a campaign", () => {
    // The extension's own folder, installed in each test campaign as the player's own.
    const extension = fileURLToPath(new URL("..", import.meta.url));
    let testing: TestCampaign;
    let folder: string;
    let context: Context;
    // The buttons the player clicks, in turn: 0 rolls, 1 changes their mind.
    let clicks: number[];
    // The questions the page showed, in turn, and the buttons of each.
    let shown: string[];
    let buttons: string[][];
    // The campaign's commands and widgets, with the context as each test changes it.
    const rpg = (...args: string[]) => ((testing.context = context), testing.run(...args));
    const widgets = () => ((testing.context = context), testing.widgets());
    const door = "Porta della cripta";

    const ok = async (...args: string[]): Promise<string> => {
        const result = await rpg(...args);
        expect(result.exitCode, result.output).toBe(0);
        return result.output;
    };

    const pick = (...args: string[]) => ok("lockpicking-pick", door, "--question", "Forzare la serratura prima della ronda", "--check", "Scasso", ...args);

    /** A campaign of the fifth edition with lockpicking; Bruna, a rogue proficient with thieves' tools, and Lena, her companion; a door of this DC; these faces in turn. */
    async function campaign(dc: number, ...rolled: number[]): Promise<void>
    {
        await ok("write", "Bruna", "--type", "character", "--set", "role=pc", "--set", "classes=[[Rogue]] 3", "--set", "dex=16", "--add", "tool-proficiencies=thieves' tools");
        await ok("write", "Lena", "--type", "character", "--set", "role=companion", "--set", "classes=[[Fighter]] 1", "--set", "dex=10");
        await ok("write", door, "--type", "item", "--set", `lock-dc=${dc}`);
        context.random = faces(...rolled);
    }

    /** What the door's page holds of lockpicking. */
    const lock = async (): Promise<string[]> => (await ok("show", door)).split("\n").filter((line) => line.startsWith("lock-"));

    beforeEach(async () => {
        testing = await testCampaign({ system: "5e", extensions: [extension] });
        folder = testing.folder;
        clicks = [];
        shown = [];
        buttons = [];
        context = { ...testing.context, page: { choose: async (question, _title, labels) => (shown.push(question), buttons.push(labels), clicks.shift()) } };
    });

    afterEach(() => testing.close());

    it("rolls every die at once outside a fight, as the player's roll asked with buttons, and opens the lock", async () => {
        await campaign(15, 3, 4, 5, 6);
        expect(await ok("lockpicking", door)).toBe(
            `${door}: DC 15 (15), complexity 3; thieves' tools needed. Failures in a row: 0 of 4.\nBruna rolls 4d6, in 2 rounds (12 s), with 2 rerolls.\nNext: lockpicking-pick "${door}".`,
        );
        clicks = [0];
        expect(await pick()).toBe(`Bruna picks ${door}: 4d6 without a 1 left. It is open (lock-state open; clear it when it is locked again). It took 12 s: advance them if anything waits on it.`);
        expect(await lock()).toEqual(["lock-dc: 15", "lock-failures: 0", "lock-state: open"]);
        expect(testing.log().find((entry) => entry.type === "roll")).toMatchObject({ by: "player", visibility: "public", data: { who: "Bruna", check: "Scasso", total: 18, says: "4 pins, no 1" } });
        expect(JSON.parse(await ok("view", "--json")).rolls[0]).toMatchObject({ check: "Scasso", total: 18, says: "4 pins, no 1" });
        expect(testing.log().at(-1)).toMatchObject({ type: "extension", visibility: "hidden", data: { text: `lockpicking ${door}: Bruna, open` } });
        expect((await rpg("lockpicking-pick", door)).output).toBe(`${door} is open: there is nothing to pick.`);
    });

    it("asks to reroll the ones in the same call while the rerolls cover them all; else, or turned down, one failure, with none spent", async () => {
        await campaign(15, 1, 4, 5, 6, 5, 1, 1, 5, 6, 2, 3, 4, 1);
        clicks = [0, 0];
        expect(await pick()).toBe(`Bruna picks ${door}: 4d6 without a 1 left, 1 reroll spent (1 left). It is open (lock-state open; clear it when it is locked again). It took 12 s: advance them if anything waits on it.`);
        expect(testing.log().filter((entry) => entry.type === "counter-changed" && entry.data.field === "lockpicking-rerolls")).toMatchObject([
            { visibility: "public", data: { page: "Bruna", before: "2/2", after: "1/2" } },
        ]);

        await ok("write", door, "--unset", "lock-state");
        clicks = [0];
        expect(await pick()).toBe(`Bruna fails ${door}: 2 ones, and 1 reroll cannot cover 2, so none is spent. Failure 1 of 4 in a row: it resets, and the next attempt starts over. It took 12 s: advance them if anything waits on it.`);
        clicks = [0, 1];
        await ok("config", "language", "it");
        const asked = shown.length;
        expect(await pick()).toBe(
            `Bruna fails ${door}: a 1, and the player kept their rerolls. Failure 2 of 4 in a row: it now shows signs of tampering, which whoever looks at it later notices (lock-tampered). It took 12 s: advance them if anything waits on it.`,
        );
        expect(await lock()).toEqual(["lock-dc: 15", "lock-failures: 2", "lock-tampered: yes"]);
        expect(shown.slice(asked)).toEqual(["Forzare la serratura prima della ronda", "È uscito un 1: lo ritiri? Ritiri rimasti: 1"]);
        expect(buttons.at(-1)).toEqual(["Tiro: Scasso (1d6)", "Lascia"]);
        expect(buttons.at(-2)).toEqual(["Tiro: Scasso (4d6)", "Non ora"]);
        expect(testing.log().filter((entry) => entry.type === "roll").map((entry) => entry.data.says).slice(-2)).toEqual(["2 ones", "Un 1"]);
        expect(await ok("lockpicking", door)).toContain("Bruna rolls 4d6, in 2 rounds (12 s), with 1 reroll.");
        expect(await ok("change", "Bruna", "--recipe", "short rest")).toContain("lockpicking-rerolls 1/2 → 2/2");
    });

    it("rolls two dice an action in a fight, keeps the attempt between them, and shows it to the party on the dashboard, never the lock's name", async () => {
        await campaign(15, 4, 5, 6, 6);
        await ok("scene", "open", "--title", "Ronda", "--type", "combat", "--with", "Bruna");
        await ok("scene", "order", "--order", "Bruna");
        clicks = [0];
        expect(await pick()).toBe(
            `Bruna passes 2 of the 4 dice of ${door} with their action, 2 left: call lockpicking-pick again at their next action; with Fast Hands, twice in a round. If they leave the lock, fall or turn to fight, break it off with stop.`,
        );
        const [card] = await widgets();
        expect(card).toMatchObject({ id: "lockpicking.lock", place: "side", title: "Lock" });
        expect(card.shows?.parts).toEqual([
            { lead: "Bruna", icon: expect.stringMatching(/^M7 11V8a5 5 0 0 1 10 0/) },
            { track: { label: "Pins", value: 2, max: 4, look: "steps", stage: "center", coming: 2 } },
            { track: { label: "Failures", value: 0, max: 4, look: "pips", stage: "end", tone: "bad" } },
            { text: { text: "{left} to go", values: { left: 2 } } },
            { track: { label: "Rerolls", value: 2, max: 2, look: "pips", stage: "start", tone: "good" } },
        ]);
        expect(JSON.stringify(card)).not.toContain(door);

        clicks = [0];
        expect(await pick()).toBe(`Bruna picks ${door}: 4d6 without a 1 left. It is open (lock-state open; clear it when it is locked again).`);
        expect((await widgets())[0].shows?.parts?.[0]).toEqual({ lead: "Open", icon: expect.stringMatching(/^M7 11V8a5 5 0 0 1 9.6-2/), tone: "good" });
        await ok("config", "language", "it");
        expect((await widgets())[0]).toMatchObject({
            title: "Serratura",
            shows: { parts: [{ lead: "Aperta" }, { track: { label: "Perni", value: 4, max: 4 } }, { track: { label: "Ritiri" } }] },
        });
        await ok("scene", "close", "--summary", "The door gave way.");
        expect((await widgets())[0].shows).toBeUndefined();
    });

    it("shows how a failed attempt went while its scene lasts: the failures in a row and what they did, the pins the lock took back at 0 (D-507)", async () => {
        await campaign(15, 1, 4, 6, 1);
        await ok("scene", "open", "--title", "Ronda", "--type", "combat", "--with", "Bruna", "--with", "Lena");
        await ok("scene", "order", "--order", "Lena", "--order", "Bruna");
        await ok("lockpicking-pick", door, "--who", "Lena");
        await ok("lockpicking-pick", door, "--who", "Lena");
        expect((await widgets())[0].shows?.parts).toEqual([
            { lead: "Failed", icon: expect.stringMatching(/^M7 11V8a5 5 0 0 1 10 0/), tone: "bad" },
            { track: { label: "Pins", value: 0, max: 6, look: "steps", stage: "center" } },
            { track: { label: "Failures", value: 2, max: 4, look: "pips", stage: "end", tone: "bad" } },
            { facts: ["Signs of tampering"] },
        ]);
    });

    it("asks physical dice in words, and leaves the decision on the ones open until the next call gives the faces", async () => {
        await campaign(15);
        await ok("config", "dice", "physical");
        expect(await pick()).toBe(
            `Ask the player in words: Forzare la serratura prima della ronda (the checks: Scasso 4d6). Then call lockpicking-pick "${door}" again with values, the faces they tell.`,
        );
        expect(await pick("--values", "1,3,4,5")).toBe(
            `Ask the player in words whether they spend 1 of their 2 rerolls on a 1: if so, they roll 1d6; call lockpicking-pick "${door}" again with values, their faces, or with reroll false.`,
        );
        expect(await ok("lockpicking", door)).toContain("Bruna is picking it: 0 of 4 dice passed, a 1 waiting for the rerolls' values, or reroll false.");
        expect(await pick("--values", "6")).toContain("Bruna picks");
        expect(testing.log().filter((entry) => entry.type === "roll").map((entry) => [entry.visibility, entry.data.physical, entry.data.result])).toEqual([
            ["public", true, "4d6 = 13 [1, 3, 4, 5]"],
            ["public", true, "1d6 = 6 [6]"],
        ]);
    });

    it("rolls a companion's dice in view and anyone else's behind the screen, the master deciding on their ones; no advantage gives a reroll", async () => {
        await campaign(10, 2, 3, 4, 5, 1, 3, 4, 5, 6);
        expect(await ok("lockpicking-pick", door, "--who", "Lena")).toContain("Lena picks");
        expect(testing.log().filter((entry) => entry.type === "roll").at(-1)).toMatchObject({ visibility: "public", data: { who: "Lena", physical: false } });

        await ok("write", door, "--unset", "lock-state");
        await ok("write", "Ombra", "--type", "character", "--set", "classes=[[Fighter]] 1", "--set", "dex=10", "--add", "tool-proficiencies=thieves' tools", "--set", "lockpicking-rerolls=2");
        expect((await rpg("lockpicking-pick", door, "--who", "Ombra", "--advantage")).output).toContain("Unknown option '--advantage'");
        expect(await ok("lockpicking-pick", door, "--who", "Ombra")).toBe(
            `Ombra rolled a 1 on ${door} and has 2 rerolls: decide for them, then call lockpicking-pick "${door}" again with reroll true or false.`,
        );
        expect(testing.log().filter((entry) => entry.type === "roll").at(-1)).toMatchObject({ visibility: "hidden", data: { who: "Ombra", fingerprint: expect.any(String) } });
        // Behind the screen, the dashboard shows nothing of it: only how Lena's went, until the time passes.
        expect(JSON.stringify((await widgets())[0].shows)).not.toContain("Ombra");
        expect((await rpg("lockpicking-pick", door, "--who", "Lena")).output).toBe(`Ombra is picking ${door}: go on with who Ombra, or break it off first with stop.`);
        expect(await ok("lockpicking-pick", door, "--reroll")).toContain("Ombra picks");
        expect(testing.log().filter((entry) => entry.type === "roll").at(-1)).toMatchObject({ visibility: "hidden", data: { result: "1d6 = 6 [6]" } });
    });

    it("wears the lock at the third failure in a row and jams it at the fourth, asking for the Dexterity check for the tools", async () => {
        await campaign(5, 1, 2, 1, 2, 1, 2, 1, 2, 3, 4);
        const fail = () => ok("lockpicking-pick", door, "--who", "Lena");
        await fail();
        await fail();
        expect(await fail()).toContain("Failure 3 of 4 in a row: the mechanism is getting ruined: its complexity goes up by 1 (lock-worn).");
        expect(await ok("lockpicking", door, "--who", "Lena")).toContain("complexity 2, 1 of it from wear; no tools needed. Failures in a row: 3 of 4; signs of tampering.\nLena rolls 4d6");
        expect(await fail()).toBe(
            `Lena fails ${door}: a 1. Failure 4 of 4 in a row: it is jammed and no one picks it any more. Ask Lena for a Dexterity check against DC 5 with roll: if it fails, the thieves' tools break; take them from the inventory. Then it is forced or broken by the system's rules, opened by Knock or mended by a smith, as you rule. It took 12 s: advance them if anything waits on it.`,
        );
        expect(await lock()).toEqual(["lock-dc: 5", "lock-failures: 4", "lock-tampered: yes", "lock-worn: 1", "lock-state: jammed"]);
        expect((await rpg("lockpicking-pick", door, "--who", "Lena")).output).toBe(`${door} is jammed: there is nothing to pick. It may still be forced or broken, by the system's rules.`);
    });

    it("never names a secret door in the public log or on the dashboard", async () => {
        await campaign(15, 4, 5, 1, 6, 6, 3, 4);
        const secret = "Passaggio dietro l'arazzo";
        await ok("write", secret, "--type", "item", "--set", "lock-dc=15");
        await ok("scene", "open", "--title", "Ronda", "--type", "combat", "--with", "Bruna");
        await ok("scene", "order", "--order", "Bruna");
        clicks = [0, 0, 0];
        await ok("lockpicking-pick", secret, "--question", "Forzare la serratura", "--check", "Scasso");
        await ok("lockpicking-pick", secret, "--question", "Forzare la serratura", "--check", "Scasso");
        // A companion's roll is the engine's, in view.
        await ok("write", secret, "--unset", "lock-state");
        await ok("lockpicking-pick", secret, "--who", "Lena");
        expect(testing.log().some((entry) => entry.visibility === "hidden" && JSON.stringify(entry).includes(secret))).toBe(true);
        expect(testing.log().filter((entry) => entry.visibility === "public").map((entry) => JSON.stringify(entry)).join("\n")).not.toContain(secret);
        expect(JSON.stringify(await widgets())).not.toContain(secret);
        expect((await ok("view")).includes(secret)).toBe(false);
    });

    it("refuses a lock without its DC, with how to write it, and lets the time passing or stop break off an attempt, which is no failure", async () => {
        await campaign(15, 4, 5);
        await ok("write", "Forziere", "--type", "item");
        expect((await rpg("lockpicking", "Forziere")).output).toContain("Forziere has no lock-dc: write it first from the typical DCs (SRD 5.1 p. 77:");
        expect((await rpg("lockpicking", "Forziere")).output).toContain("the Lock and the Manacles are picked at 15, and slipping out of manacles is another check)");
        expect((await rpg("lockpicking", "Forziere")).output).toContain("as write Forziere --set lock-dc=15.");

        await ok("scene", "open", "--title", "Ronda", "--type", "combat", "--with", "Bruna");
        await ok("scene", "order", "--order", "Bruna");
        clicks = [0];
        await pick();
        expect(await pick("--stop")).toBe(`Bruna breaks off picking ${door}: the 2 dice passed are lost, and it is no failure.`);
        expect(await lock()).toEqual(["lock-dc: 15"]);

        context.random = faces(4, 5);
        clicks = [0];
        await pick();
        await ok("scene", "close", "--summary", "They ran.");
        expect(await ok("advance", "--to", "day 1, 10:00")).toContain(`Bruna's attempt on ${door} is broken off as the time passed: the dice passed are lost, and it is no failure.`);
        expect(await ok("lockpicking", door)).not.toContain("is picking it");
    });

    it("names its fields in the campaign's language beside the system's, on the dashboard's sheet too (D-505)", async () => {
        await campaign(15);
        await ok("config", "language", "it");
        const overview = JSON.parse(await ok("view", "--json"));
        expect(overview.words.fields).toMatchObject({ "lockpicking-rerolls": "Ritiri di scasso", "lock-dc": "CD della serratura", str: expect.any(String) });
        expect(overview.words.fields).toMatchObject({ "lockpicking-rerolls": "Ritiri di scasso", "lock-state": "Stato della serratura" });
        await ok("config", "language", "fr");
        expect(JSON.parse(await ok("view", "--json")).words?.fields?.["lockpicking-rerolls"]).toBe("Relances de crochetage");
    });

    it("rolls with the engine's dice where no buttons show, once the player asked in words goes ahead, and keeps the words of the question for the next actions", async () => {
        await campaign(15, 4, 5, 6, 6);
        const page = context.page;
        context = { ...context, page: undefined };
        expect(await pick()).toBe(
            `Ask the player in words: Forzare la serratura prima della ronda (the checks: Scasso 4d6); when they go ahead, call lockpicking-pick "${door}" again: it rolls.`,
        );
        expect(testing.log().filter((entry) => entry.type === "roll")).toEqual([]);
        expect(await ok("lockpicking-pick", door)).toContain("Bruna picks");
        expect(testing.log().find((entry) => entry.type === "roll")).toMatchObject({ visibility: "public", data: { who: "Bruna", check: "Scasso", result: "4d6 = 21 [4, 5, 6, 6]" } });

        // In a fight, the next action asks the player in the words the first gave.
        context = { ...context, page };
        context.random = faces(4, 5, 6, 6);
        await ok("write", door, "--unset", "lock-state");
        await ok("scene", "open", "--title", "Ronda", "--type", "combat", "--with", "Bruna");
        await ok("scene", "order", "--order", "Bruna");
        clicks = [0, 0];
        await pick();
        expect(await ok("lockpicking-pick", door)).toContain("Bruna picks");
        expect(shown).toEqual(["Forzare la serratura prima della ronda", "Forzare la serratura prima della ronda"]);
    });

    it("keeps a 1 waiting when the call is stopped while the player is asked to reroll it, and counts it a failure when the attempt is broken off", async () => {
        await campaign(15, 1, 4, 5, 6, 6);
        const midway = new AbortController();
        context = {
            ...context,
            signal: midway.signal,
            page: {
                choose: (_question, _title, _labels, signal) => {
                    shown.push("asked");

                    if (shown.length === 1) {
                        return Promise.resolve(0);
                    }

                    setTimeout(() => midway.abort(), 10);
                    return new Promise((done) => signal?.addEventListener("abort", () => done(undefined)));
                },
            },
        };
        await rpg("lockpicking-pick", door, "--question", "Forzare", "--check", "Scasso");
        expect(await ok("lockpicking", door)).toContain("Bruna is picking it: 0 of 4 dice passed, a 1 waiting for reroll true or false.");

        context = { ...context, signal: undefined, page: { choose: async () => 0 } };
        expect(await ok("lockpicking-pick", door)).toBe(
            `Bruna picks ${door}: 4d6 without a 1 left, 1 reroll spent (1 left). It is open (lock-state open; clear it when it is locked again). It took 12 s: advance them if anything waits on it.`,
        );

        await ok("write", door, "--unset", "lock-state");
        context = { ...context, page: undefined };
        context.random = faces(1, 2, 3, 4);
        // Asked in words, then rolled: the 1 waits for the player's word on the rerolls.
        await pick();
        expect(await pick()).toContain("Ask the player in words whether they spend 1 of their 1 reroll on a 1: if so,");
        expect(await pick("--stop")).toBe(
            `Bruna fails ${door}: a 1 waiting for the rerolls when it was broken off. Failure 1 of 4 in a row: it resets, and the next attempt starts over. It took 12 s: advance them if anything waits on it.`,
        );
    });

    it("refuses a name that only begins one of the party's, with theirs, and says when who names no page", async () => {
        await campaign(10, 2, 3, 4, 5);
        await ok("write", "Ugo Ferri", "--type", "character", "--set", "role=companion");
        expect((await rpg("lockpicking-pick", door, "--who", "Ugo")).output).toBe("Ugo names no page: give who as their page's name, Ugo Ferri. Nothing was rolled.");
        expect(await ok("lockpicking-pick", door, "--who", "Guardia")).toContain(
            "\nGuardia names no page: rolled as a stranger's, without rerolls. If they are of the party, break it off with stop and give who as their page's name.",
        );
    });

    it("asks the player's character the check for the tools through ask when the lock jams", async () => {
        await campaign(15, 1, 2, 3, 4);
        await ok("write", door, "--set", "lock-failures=3");
        clicks = [0, 1];
        expect(await pick()).toContain("Ask Bruna for a Dexterity check against DC 15 with ask, as Dexterity 1d20+dex-mod: if it fails, the thieves' tools break;");
    });

    it("shows the card while the player is asked to roll, outside a scene too, and how it went until the time passes", async () => {
        await campaign(15, 3, 4, 5, 6);
        const seen: unknown[] = [];
        context = { ...context, page: { choose: async () => (seen.push((await widgets())[0].shows?.parts?.[0]), 0) } };
        await pick();
        expect(seen).toEqual([{ lead: "Bruna", icon: expect.any(String) }]);
        expect((await widgets())[0].shows?.parts?.[0]).toMatchObject({ lead: "Open" });
        await ok("advance", "--to", "day 1, 10:00");
        expect((await widgets())[0].shows).toBeUndefined();

        // A roll the player turns down leaves no card behind.
        await ok("write", door, "--unset", "lock-state");
        context = { ...context, page: { choose: async () => 1 } };
        await pick();
        expect((await widgets())[0].shows).toBeUndefined();
    });

    it("shows the pins of a roll that held while its 1 waits for the reroll, and how a scene's attempt ended after the time passes in it", async () => {
        await campaign(15, 1, 4, 5, 6, 6);
        await ok("scene", "open", "--title", "Dogana", "--type", "social", "--with", "Bruna");
        const seen: unknown[] = [];
        context = { ...context, page: { choose: async () => (seen.push((await widgets())[0].shows?.parts?.[1]), 0) } };
        await pick();
        const pins = { label: "Pins", max: 4, look: "steps", stage: "center" };
        expect(seen).toEqual([{ track: { ...pins, value: 0, coming: 4 } }, { track: { ...pins, value: 0, held: 3, marked: 1 } }]);
        await ok("advance", "--to", "day 1, 10:00");
        expect((await widgets())[0].shows?.parts?.[0]).toMatchObject({ lead: "Open" });
    });

    it("asks the roll and its reroll in one card of the widget lock, before and after the dice, never with the lock's name or DC; a stranger's dice keep their tones behind the screen (D-507)", async () => {
        await campaign(15, 1, 4, 5, 6, 6, 1, 2, 3, 4, 5, 6);
        const asked: { labels: string[]; rows?: Rows; before?: unknown; }[] = [];
        const ended: { key: string; shows: unknown; }[] = [];
        context = {
            ...context,
            page: {
                choose: async (_question, _title, labels, _signal, rows) => (asked.push({ labels, rows, before: await rows?.card?.shows() }), 0),
                cardEnded: (card) => void card.shows().then((shows) => ended.push({ key: card.key, shows })),
            },
        };
        await ok("config", "language", "it");
        await pick();
        const [roll, reroll] = asked;
        expect([roll.rows?.card?.widget, roll.rows?.card?.key, reroll.rows?.card?.key]).toEqual(["lockpicking.lock", "attempt-1", "attempt-1"]);
        expect(roll.rows?.rule).toBe("Un 1 rimette la serratura a zero · un ritiro per ogni 1");
        expect(reroll.labels).toEqual(["Tiro: Scasso (1d6)", "Lascia"]);
        expect(reroll.rows?.buttons).toEqual([{ name: "Ritira", note: "ne hai 2" }, { name: "Lascia", note: "si richiude" }]);
        expect(JSON.stringify(roll.before)).toContain('"coming":4');
        expect(JSON.stringify(reroll.before)).toContain('"held":3,"marked":1');
        await vi.waitFor(() => expect(ended).toHaveLength(1));
        expect(JSON.stringify(ended[0].shows)).toContain('"lead":"Aperta"');
        expect(testing.log().filter((entry) => entry.type === "roll").map((entry) => entry.data.tones)).toEqual([["bad", "good", "good", "good"], ["good"]]);

        // A stranger's dice behind the screen keep their tones in the hidden line alone.
        await ok("write", door, "--unset", "lock-state");
        await ok("write", "Ombra", "--type", "character", "--set", "dex=10");
        await ok("lockpicking-pick", door, "--who", "Ombra");
        expect(testing.log().filter((entry) => entry.type === "roll").at(-1)).toMatchObject({ visibility: "hidden", data: { tones: ["bad", "good", "good", "good", "good", "good"] } });
        const told = JSON.stringify([...asked, ...ended]);
        expect(told).not.toContain(door);
        expect(told).not.toMatch(/\b15\b/);
    });

    it("gives the page its card with the question, once the widget answers, and as the call left it after the last dice (D-507)", async () => {
        await campaign(15, 3, 4, 5, 6);
        const dashboard = await testing.dashboard();
        context = { ...context, page: dashboard.player };
        const picking = rpg("lockpicking-pick", door, "--question", "Forzare", "--check", "Scasso");
        const asked = await vi.waitFor(async () => {
            const now = await dashboard.get("/api/asked");
            expect(now.asked?.card?.shows).toBeDefined();
            return now.asked;
        }, { timeout: 5000 });
        expect(asked).toMatchObject({ rule: "A 1 resets the lock · one reroll for each 1", card: { widget: "lockpicking.lock", key: "attempt-1" } });
        await dashboard.post("/api/answer", { asked: asked.id, choice: 0 });
        expect((await picking).output).toContain("Bruna picks");
        const left = await vi.waitFor(async () => {
            const now = await dashboard.get("/api/asked");
            expect(now.card?.ended).toBe(true);
            return now.card;
        }, { timeout: 5000 });
        expect(left).toMatchObject({ widget: "lockpicking.lock", key: "attempt-1" });
        expect(left.shows.parts[0]).toMatchObject({ lead: "Open", tone: "good" });
    });

    it("shows in a question's card the attempt of its key, not another of the party's, and names a new attempt anew after the time passes (D-507)", async () => {
        await campaign(15, 4, 5, 4, 5, 6, 6, 4, 5, 6, 6);
        await ok("write", "Forziere", "--type", "item", "--set", "lock-dc=15");
        await ok("scene", "open", "--title", "Ronda", "--type", "combat", "--with", "Bruna", "--with", "Lena");
        await ok("scene", "order", "--order", "Lena", "--order", "Bruna");
        await ok("lockpicking-pick", "Forziere", "--who", "Lena");
        const before: unknown[] = [];
        const keys: (string | undefined)[] = [];
        context = { ...context, page: { choose: async (_question, _title, _labels, _signal, rows) => (keys.push(rows?.card?.key), before.push(await rows?.card?.shows()), 0) } };
        await pick();
        expect(JSON.stringify(before[0])).toContain('"lead":"Bruna"');
        expect(JSON.stringify(before[0])).not.toContain("Lena");

        await ok("lockpicking-pick", door);
        await ok("advance", "--to", "day 1, 10:00");
        await ok("write", door, "--unset", "lock-state");
        await pick();
        expect(keys).toEqual(["attempt-2", "attempt-2", "attempt-3"]);
    });

    it("doubles the rerolls with expertise in thieves' tools, gives none without proficiency, and opens at once a lock with no die left to roll", async () => {
        await campaign(15);
        await ok("write", "Bruna", "--add", "expertise=Thieves' Tools");
        expect(await ok("lockpicking", door)).toContain("Bruna rolls 4d6, in 2 rounds (12 s), with 4 rerolls.");
        expect(await ok("lockpicking", door, "--who", "Lena")).toContain("Lena rolls 6d6, in 3 rounds (18 s), with 0 rerolls.");
        await ok("change", "Bruna", "lockpicking-rerolls", "--to=0");
        expect(await ok("lockpicking", door)).toContain("Bruna rolls 4d6, in 2 rounds (12 s), with 0 rerolls, back with a short rest.");
        await ok("write", "Dispensa", "--type", "item", "--set", "lock-dc=5");
        expect(await ok("lockpicking-pick", "Dispensa")).toBe("Bruna opens Dispensa at once, with an action: no die to roll. It is open (lock-state open; clear it when it is locked again).");
    });
});
