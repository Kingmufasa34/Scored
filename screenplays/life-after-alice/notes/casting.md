# Casting: voices for the table read

Decisions the writer has made by ear. Newest first.

## Current cast (take 4): designed voices
Designed with ElevenLabs Voice Design from each character's actor notes (`notes/actor-notes/`). Tendai picked option 1 for every part.
- **Alice** `JFtJnxBOe89fLv5pCzXE`: Dublin, early 30s, quick, dry, deadpan.
- **Daniel** `R1aNutsexOJElpbwaj7K`: South London, early 30s, deep, grounded, slightly rough.
- **Ruth** `7ps0Ffe9dauim9jtawua`: English, 60s, warm, slightly flustered.
- **Director** `PwJ4cBV49of7bZDw99vG`: calm, plain table-read voice.
Plays dry by default (Room: "Dry"). Tendai prefers the voices crisp, without the room effect.

## Alice
- **Shauna** (ElevenLabs voice library, voice id `VB4JW7V2WFSp1tEyWbj5`): Irish, middle-aged, "warm and engaging".
  Chosen by Tendai after auditioning Irish voices in ElevenReader.
- Rejected: **Clare** (`3Q0HiHNecynsdqicntLT`). Too breathy / "a bit too sexual" for Alice.

## Daniel
- **Uzi** (ElevenLabs voice library, voice id `eXmAcXLnEWP4OWensAKS`): Black London male, "south London semi slang".
  Recast after take 1: Tendai wanted Daniel tougher. Used in ElevenLabs take 2.
  Alternates if he's not right: **Prince** (`nstAjY74EkciBLEg9uvD`, young Black London guy),
  **Sam** (`5PttsE2PUVbfukCdqPQ4`, London-born, 30s-40s).
- Previously **Yowz** (ElevenLabs voice library, voice id `Oe8Lhg3t63j9BsrTQBjx`): deep, South London / Surrey, conversational.
  Chosen by Tendai from the casting page.
- Also auditioned: James (North London, used in the corridor test), Hymzy, Simon.

## Ruth
- **Beatrice** (`kkPJzQOWz2Oz9cUaEaQd`): mature female.

## Director
- **Jase** (`kTSNDDkx34wKsrujmdm1`): rough, intense British. Reads every scene heading, action line and parenthetical in take 2.

## Notes
- Take 1 (Shauna, Yowz, Beatrice; free Director): "sub par" expressiveness. Take 2 re-recorded all 140 lines
  with eleven_v4 and stacked emotion tags (crying, voice cracking, sobbing, whispers), Director included.
  Both takes are in the table-read app's Performance menu.
- The corridor test player: https://claude.ai/artifact/8GiPa5Nm7e3YkETX8KUSLQ
- Casting page with voice samples: https://claude.ai/artifact/BsMxydV3ha43Crh798riZG

## How we prompt ElevenLabs (learned the hard way)
From ElevenLabs' v3 prompting guide and its audio-tag docs, tested on take 3:
- One tag where the delivery changes, not on every line. Tags last until the next tag. Stacking clashing tags
  (`[softly] [crying] [tenderly]`) makes delivery jump around. That was the problem with take 2.
- Use plain, listed tags that describe how the line is spoken: `[sarcastic]`, `[whispers]`, `[crying]`, `[laughs]`,
  `[jumping in]`, `[pause]`. Use punctuation, ellipses and the odd CAPITAL for emphasis.
- Short single lines come out unstable. The model sets the mood from the surrounding text, and longer passages
  (250+ characters) are more consistent. So take 3 records each character's whole scene in one pass, with
  `[long pause]` between lines. ElevenLabs' transcriber returns word timings, which tell us where to cut it back into lines.
- The Director reads each scene in one pass with no emotion tags: steady and even.
- Stability "Natural" is recommended, but this connector doesn't expose it.
- Alice and Daniel are a young couple in their 30s, not long married, so play the waiting room as banter, not weariness.
  (The draft's action lines still say "forties".)

