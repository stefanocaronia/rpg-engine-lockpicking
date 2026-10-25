# Lockpicking by complexity

An extension for [RPG Engine](https://github.com/stefanocaronia/rpg-engine), compatible with fifth edition: in place of the d20 check with thieves' tools, a lock is opened with d6 by its complexity, from its DC rounded to 5. A 1 resets the lock; failures in a row leave signs of tampering, make it harder, then jam it. A rogue takes dice away with their Dexterity; proficiency with thieves' tools gives rerolls, as many as the proficiency bonus, twice with expertise, back with a short rest. In a fight two dice a round, outside one all at once. The engine rolls, asks the player for their rolls and keeps the attempt; the master tells the pins giving way. On the dashboard, the attempt of the party is a card beside the rolls, never the lock's name nor its DC.

Install it from a campaign of the fifth edition with RPG Engine: `rpg package install lockpicking`. A lock needs its DC on its page first: `rpg write "Crypt door" --set lock-dc=15`.

Lockpicking by complexity, by Stefano Caronia, CC BY 4.0; its code is under MIT: see [LICENSE.md](LICENSE.md). This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document, licensed under CC BY 4.0.
