# Screenwriting Skills

A screenplay-writing skill set covering the full pipeline from concept to
packaging. Each skill is a self-contained `SKILL.md` that Claude Code (and
compatible assistants) can load on demand.

## Skills

| Stage | Skill | What it does |
|-------|-------|--------------|
| Development | [`logline-writer`](logline-writer/SKILL.md) | A precise one-sentence logline (protagonist, inciting incident, conflict, stakes) in under 40 words. |
| Development | [`treatment-writer`](treatment-writer/SKILL.md) | A 5–10 page professional treatment: premise, tone, characters, three-act breakdown, theme. |
| Development | [`beat-sheet-builder`](beat-sheet-builder/SKILL.md) | A complete 15-beat story map across a three-act framework. |
| Development | [`character-profile-writer`](character-profile-writer/SKILL.md) | A dramatic character profile: psychology, backstory, want, need, flaw, wound, voice. |
| Scripting | [`scene-writer`](scene-writer/SKILL.md) | A scene in industry-standard format (slugline, action, dialogue) from a brief. |
| Scripting | [`dialogue-polisher`](dialogue-polisher/SKILL.md) | Sharpens dialogue for subtext, distinct voices, and no on-the-nose lines. |
| Scripting | [`dialogue`](dialogue/SKILL.md) | Diagnoses flat dialogue: same-voice characters, wooden lines, exposition dumps, missing subtext. |
| Scripting | [`imperfect-dialogue`](imperfect-dialogue/SKILL.md) | **Written for this repo.** Makes dialogue sound like people talking: overlaps, false starts, mishearing, dodged questions, dead lines. Runs last and overrides "every line does two things". |
| Development | [`statistical-distance`](statistical-distance/SKILL.md) | Spots when a choice is the predictable one and pushes it somewhere less expected. |
| Revision | [`script-notes-writer`](script-notes-writer/SKILL.md) | Editorial script notes: structural, character, and scene-level fixes for a draft. |
| Revision | [`coverage-report-writer`](coverage-report-writer/SKILL.md) | Industry-standard script coverage: logline, synopsis, scores, evaluation. |
| Production | [`one-pager-writer`](one-pager-writer/SKILL.md) | A one-page sales document: logline, synopsis, tone references, writer positioning. |

## A typical flow

```
logline-writer → treatment-writer → beat-sheet-builder → character-profile-writer
      → scene-writer → dialogue-polisher / dialogue → imperfect-dialogue → script-notes-writer / coverage-report-writer
      → one-pager-writer (packaging / pitch)
```

Each skill's own "Related Skills" section links to the natural next steps.

## Usage

These live under `.claude/skills/`, so Claude Code discovers them automatically
in this repository. Invoke a skill by name (e.g. `/scene-writer`) or just
describe the task and let Claude select the matching skill.

## Attribution

The original nine skills are vendored, unmodified except for adjusted internal cross-links,
from the [`autopunk-media-skills`](https://github.com/ur-grue/autopunk-media-skills)
project by ur-grue (`skills/screenwriting/`), which is MIT licensed. The original
category folders (`development/`, `scripting/`, `revision/`, `production/`) were
flattened into the standard `.claude/skills/<name>/` layout so the skills load
directly; relative links between skills were updated to match. The full upstream
license is retained in [`LICENSE-autopunk-media-skills`](LICENSE-autopunk-media-skills).

`dialogue` (including its `scripts/`) and `statistical-distance` are vendored
unmodified from [`jwynia/agent-skills`](https://github.com/jwynia/agent-skills)
at commit `e02ec7e` (`skills/creative/fiction/character/`). Both are MIT licensed,
as declared in their frontmatter, by jwynia.

`imperfect-dialogue` was written for this repo.
