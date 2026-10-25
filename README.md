# Lockpicking by complexity

An extension for [RPG Engine](https://github.com/stefanocaronia/rpg-engine), compatible with fifth edition: in place of the d20 check with thieves' tools, a lock is opened with d6 by its complexity, from its DC rounded to 5. A 1 resets the lock; failures in a row leave signs of tampering, make it harder, then jam it. A rogue takes dice away with their Dexterity; proficiency with thieves' tools gives rerolls, as many as the proficiency bonus, twice with expertise, back with a short rest. In a fight two dice a round, outside one all at once. The engine rolls, asks the player for their rolls and keeps the attempt; the master tells the pins giving way. On the dashboard, the attempt of the party is a card beside the rolls, never the lock's name nor its DC.

This package works only inside [RPG Engine](https://github.com/stefanocaronia/rpg-engine): it is an extension the engine installs into a campaign, not a library of its own.

## Install

From a campaign, with RPG Engine 0.5.0 or later: `rpg package install lockpicking`, or ask the master to install it. It needs a campaign of the fifth edition (the engine's `5e` system), and each lock its DC on its page first: `rpg write "Crypt door" --set lock-dc=15`.

## Develop and test

You need Node 22.4 or later, and the engine for its test kit, `rpg-engine/testing`:

```sh
npm install
npm test
```

`npm test` builds `dist/` first: the kit runs the extension as the engine installs it. To test against an engine you are changing, link it: `npm link` in the engine's folder, then `npm link rpg-engine` here; or keep the engine beside this repository and run `npm run test:downstream` from it, which builds the engine and runs these tests against it. `npm run lint` checks the types.

## Publish

Raise `version` in `package.json`, commit, and push a tag `v<version>`: the workflow `publish.yml` checks, builds, tests and publishes to npm with Trusted Publishing, from the environment `release`.

## Licence

Lockpicking by complexity, by Stefano Caronia, CC BY 4.0; its code is under MIT: see [LICENSE.md](LICENSE.md). Compatible with fifth edition.

It names pages of the System Reference Document 5.1, such as the typical DCs and the Lock, without copying their text. This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.
