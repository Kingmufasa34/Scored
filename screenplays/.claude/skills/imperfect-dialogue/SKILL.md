---
name: imperfect-dialogue
description: "Writes and roughens screenplay dialogue so it sounds like real people talking rather than written lines: false starts, overlaps, mishearing, filler, dodged questions, lost threads, dead lines, wrong words, laughter in the wrong place. Use when drafting any dialogue in this repo, when a scene reads too clean, too quotable or too finished, or as the last pass after dialogue-polisher. Also turns real transcripts in ear/ into a voice reference."
---
# Imperfect Dialogue

## Why this exists

Written dialogue, and AI-written dialogue above all, tends to come out *finished*:
every line lands, every speech is complete, people answer the question they were
asked, the subtext is neatly buried, and each exchange ends on a button. Real
conversation does none of that. People talk over each other, lose the word, say
the wrong thing and fix it, repeat themselves, mishear, laugh at bad moments,
answer the question before last, and fill silence with nothing.

The goal is not chaos. It is the texture of people who are tired, distracted,
scared, half-listening, and doing their best. The writer here wants scripts that
feel **lived in, not written**.

**This skill overrides "every line must do two things."** (`dialogue-polisher` and
`dialogue` both teach that rule.) Some lines should do nothing at all. A
conversation where every line earns its place is a conversation nobody has ever had.

## What real conversation does

These come from conversation analysis, the study of recorded everyday talk.
They're the raw material.

### Turn-taking breaks down
- **Overlap.** Two people start at once, or one starts before the other has
  finished (Sacks, Schegloff & Jefferson, 1974). Usually somebody drops out.
- **Interruption that doesn't win.** A character tries to cut in and fails, and
  the first speaker just keeps going.
- **Latching.** One turn follows another with no gap at all, especially in a
  fight or a joke.
- **Collaborative finishing.** One person finishes the other's sentence, sometimes
  wrongly, and the first person has to accept or correct it.

### People repair their own speech
- **Self-correction mid-line** (Schegloff, Jefferson & Sacks, 1977): "She was on
  the, the Tuesday. Wednesday. No, Tuesday."
- **Restarting a sentence** because the first version was going somewhere they
  didn't want to go: "I just think you could have... look, it doesn't matter."
- **Wrong word, then the right one**, or the wrong one left standing because
  nobody can be bothered to fix it.
- **Other-initiated repair**: "What?" "Sorry?" "Which one?" Somebody didn't hear,
  or did hear and is buying time.

### Hesitation means something
- "Uh" and "um" aren't random. Speakers use them to signal a delay is coming, and
  "um" tends to come before longer delays than "uh" (Clark & Fox Tree, 2002).
  Put them where a character is reaching for something hard, not sprinkled
  for flavour.
- **Saying no is slow.** Agreement comes fast. Disagreement and refusal come late,
  padded and hedged: "Yeah, no, I mean... yeah" (Pomerantz, 1984). A flat, instant
  "No" therefore reads as a slap.

### People don't answer what they're asked
- Answering the question before last.
- Answering a different, easier question.
- Answering with a question.
- Not answering, and the other person letting it go, which is often worse.

### Talk is full of things that aren't the point
- **Phatic talk:** "You alright?" "Yeah, you?" It means "we're still okay" and
  carries no information.
- **Backchannels:** "Mm." "Yeah." "Right." A listener proving they're listening,
  or failing to.
- **Repetition:** people repeat their own phrases and each other's (Tannen, 1989).
  Repeating someone's exact words back can be agreement, mockery or shock.
- **Logistics in the middle of feeling:** parking, the kettle, whose turn it is to
  ring someone. Grief and admin share the same breath.

### Feeling leaks out sideways
- **Laughing at the wrong moment.** In troubles-talk, the person telling the
  trouble often laughs and the listener often doesn't join in (Jefferson, 1984).
  A laugh can be the most painful line on the page.
- **Getting angry about the wrong thing.** The fight is about a mug.
- **Trailing off** because finishing the sentence would make it true.
- **Saying the cruel thing too fast**, then trying to talk over it.

### People mishear, misremember and contradict themselves
- Getting a date, a name or a story wrong, and being corrected or not.
- Two versions of the same memory, with neither person backing down.
- Saying "I'm fine" and then, three lines later, proving they're not.

## What this looks like on a screenplay page

| Effect | How to write it |
|---|---|
| Cut off by someone else | `I just think--` (two hyphens), next speaker starts immediately |
| Trailing off | `I just think...` |
| Self-interruption or restart | `I just -- no. Look.` |
| Simultaneous speech | Fountain dual dialogue: put `^` after the second character's name. Use sparingly and only when both lines matter |
| Speaking over, where only one line matters | Action line: `She talks over him.` Then her line |
| Inaudible or unimportant | `(mumbles)` or an action line. Don't write out words the audience won't hear |
| Silence | `Nothing.` / `A beat.` / `He doesn't answer.` Silence is a line. (Pinter's scripts distinguish a *pause* from a *silence*, and the difference is playable.) |
| Filler | Write it phonetically and only where a real person would use it: `I mean`, `like`, `sort of`, `yeah, no`, `um` |

Read Caryl Churchill (*Top Girls*), Pinter (*Betrayal*), Mamet (*Glengarry Glen
Ross*), Altman's overlapping dialogue, verbatim theatre such as Alecky Blythe's
*London Road*, and Mike Leigh's improvised work. All of them get on the page the
kind of talk that most screenplays tidy away.

## Signs a scene is too perfect

Check every scene for these. Each one isn't wrong on its own, but several together
make a scene feel written.

- [ ] **Quotable lines.** If a line would work on a poster, it probably sounds
      written. Keep at most one per scene, and consider roughening that one too.
- [ ] **Everyone is articulate.** Under stress, people get *worse* at speaking,
      not better.
- [ ] **Every question gets answered.**
- [ ] **Every speech is a complete sentence.**
- [ ] **Exchanges are balanced:** equal lengths, clean back-and-forth tennis.
- [ ] **Callbacks land perfectly.** Real people don't remember the satsuma from
      page one at exactly the right moment.
- [ ] **The theme is named aloud.**
- [ ] **Emotional beats arrive on cue.** Real feeling arrives late, early, or at
      the wrong person.
- [ ] **Each scene ends on a button:** a final line that lands. Let some scenes
      just stop.
- [ ] **Rule of three and tidy symmetry** in speeches.
- [ ] **Nobody says anything boring.** At least a few lines per scene should be
      dead air: logistics, repetition, "what?"

## The roughening pass

Run this on a draft *after* the scene works dramatically. Never on someone's
saved draft: copy it to the next draft number first (see CLAUDE.md).

1. **Mark the quotable lines.** For each one, decide: keep it, break it (a false
   start, interrupted before the end), bury it (said while doing something else,
   under someone else's line), or give it to the wrong moment.
2. **Find one place where someone mishears or misunderstands**, and let it cost
   them a few lines.
3. **Find one question that should go unanswered**, or be answered later, or
   sideways.
4. **Add the dead lines:** logistics, phatic talk, repetition. Not many, two or
   three per page, but they make the live lines feel live.
5. **Make the most articulate character less articulate at their worst moment.**
6. **Check who's listening.** In every exchange, is at least one person not fully
   there?
7. **Read it aloud, at speed, with someone else if you can.** Anything you trip over
   because it's *too written* gets cut. Anything you trip over because it's
   *messy in a real way* stays.
8. **Don't overdo it.** If every line has an "um" and a "--", it's a different
   kind of fake. Imperfection should be uneven: dense when people are upset,
   cleaner when they're comfortable or performing.

## Using real speech as a reference (`ear/`)

The fastest way to stop dialogue sounding written is to hold it against the real
thing. The `ear/` folder at the repo root is for transcripts the writer collects:
voice-note transcripts, verbatim interviews, overheard snatches, their own
recorded conversations (with the other people's consent).

When `ear/` has material:
1. Read the relevant files before drafting. Notice the rhythms, how often people
   restart, what they repeat, how they say no.
2. Match the texture, **not the content**. Never lift private details, names or
   identifiable stories about real people into a script.
3. When roughening, compare a scene against an `ear/` transcript of similar
   emotional temperature and ask: "Would anyone in that transcript say this line?"

## Output

When drafting or roughening, write the scene in screenplay format, then add a
short note (3–5 bullets) of *which imperfections you chose and why*, so the writer
can push back. The writer's voice leads. Offer roughness as a choice, not a
correction.

## Related skills

- `dialogue-polisher` and `dialogue`: for voice and subtext. Run this skill
  after them, so it can undo some of their tidiness.
- `statistical-distance`: for when a whole choice (not just a line) is the
  predictable one.
- `scene-writer`: for first drafts.
