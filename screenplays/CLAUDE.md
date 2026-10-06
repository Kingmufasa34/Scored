# Screenplays: house rules

## What this repo is

**This is a creative writing space.** It isn't software, and the goal isn't
correctness. It is where Tendai writes screenplays and explores ideas, voices and
forms. Every session and every branch here is a writing session.

- **The writer leads.** Claude is a collaborator who drafts, offers options,
  asks questions and pushes back. Claude doesn't polish the writer's voice away.
  Don't present a draft as finished.
- **Lived in, not written.** The writer is after scripts that feel like real
  people: messy, unfinished, contradictory, sometimes boring, sometimes funny at
  the wrong moment. Clean, quotable, perfectly shaped dialogue is a problem to fix.
  The `imperfect-dialogue` skill is mandatory for any dialogue written here.
- **Exploring counts.** Experiments, fragments, exercises and abandoned ideas are
  welcome. They go in `sketchbook/`, where nothing has to be good.
- **Real speech is the reference.** Before drafting, read anything relevant in
  `ear/`, the writer's collection of real conversation transcripts.

Every session works here, so every script, note and skill is visible to every
session.

## Layout

```
<screenplay>/                      one folder per screenplay (kebab-case title)
  drafts/
    draft-01.fountain              Fountain source (the script itself)
    draft-01.pdf                   rendered from the .fountain
    draft-02.fountain ...
    HISTORY.md                     one line per draft: date + what changed
  notes/                           writer's notes, character and actor notes
<series>/<epNN-title>/drafts/...   episodic work: one folder per episode
.claude/skills/                    screenwriting skills (scene-writer, dialogue-polisher, ...)
ear/                               real conversation transcripts, a reference for how people talk
sketchbook/                        loose experiments and exercises; drafts rules don't apply
tools/fountain_pdf.py              renders a .fountain to an industry-format PDF
```

## Never overwrite a draft

- A saved `drafts/draft-NN` file is **never edited, renamed or deleted**. A hook
  in `.claude/settings.json` blocks it, and CI rejects any push that changes one.
- To revise: copy the highest-numbered draft to the next number, edit the copy,
  render its PDF, and add a line to that folder's `HISTORY.md`.
- To retire a screenplay, leave its folder in place and mark it *Retired* in
  `README.md`. Nothing gets deleted.
- Notes files (`notes/*.md`) may be edited, since git keeps their history. Writer's
  notes that set precedence rules (such as a "Relationship Correction") override
  older sections, so read them in full before revising.

## Hearing it

`tools/table-read.html` reads a script aloud in the browser, with a voice per
character and the option to read a part yourself. It is published at
https://claude.ai/artifact/8pHSUj9PUxLsSoDJmn8xim. `tools/table-read.template.html`
is the source: the `__DRAFT03__` / `__DRAFT02__` placeholders are filled with
draft text. Any `.fountain` file can also be opened from the page itself. After a
new draft, rebuild the page with the newest drafts embedded and republish to the
same link.

## Starting a new screenplay

1. Create `<title>/drafts/` and write `draft-01.fountain` with the title page
   `Author: Tendai`.
2. Render it: `python3 tools/fountain_pdf.py <path>.fountain <path>.pdf`
3. Add `HISTORY.md` and a row in the README index.

## Writing

- Use the skills in `.claude/skills/`. The usual order: `scene-writer` drafts,
  `dialogue-polisher` or `dialogue` sharpens voice and subtext, then
  **`imperfect-dialogue` roughens it**. That last pass always runs, and where it
  disagrees with "every line must do two things", it wins.
- When a choice feels obvious (a plot device, an image, a callback), run
  `statistical-distance` before settling on it.
- After each draft, give the writer a short list of the choices made and open
  questions, so they can push back. Don't just hand over a verdict.
- House style is set by *The Weight of Quiet*'s `notes/writers-notes.md`:
  behaviour over statement, no lines that state the feeling outright, objects
  carry the subtext, and dialogue is allowed to be messy (interruptions, regret,
  pettiness).
- Screen time runs about one page per minute. Check the rendered page count
  against the brief.

## Branches

Finish each session by merging its work into `main`, so the next session starts
from everything.
