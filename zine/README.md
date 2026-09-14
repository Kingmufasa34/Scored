# Zine Studio — visual mini-zine maker

Make an 8-page mini-zine on your phone: **upload photos, drag and resize** them
and text on each page, then **Save & Share a link** other people open and **flip
through**. When you want a physical copy, **Print** composes the 8 pages into a
single fold-and-cut sheet.

One self-contained HTML file — no build step. Open `zine/index.html` directly, or
(when the [dashboard server](../README.md#phone-app-mobile-web-dashboard) is
running, `npm run serve`) at **`/zine/`**. It is also published as a Claude
Artifact, which is what makes the shareable link work (see below).

## Make

- **Edit / Read** toggle at the top. In **Edit**:
  - **＋ Photo** — opens your camera / gallery (also drag-and-drop or paste an
    image). Photos auto-downscale to ~1100px so phone shots stay light.
  - **＋ Text** — adds a text box; tap it to type, pick a colour, cycle the font
    (Display / Body / Mono).
  - **Drag** anything to move it; **drag the pink corner handle** (or the text
    handle) to resize. Selecting an item reveals a bottom bar: Edit text, Copy,
    bring to Front, Delete.
  - **Page** colour swatch tints the current page.
  - The **1–8 strip** switches pages. Page 1 is the cover, page 8 the back.

## Share (flip-through link)

Hit **Share**. Running as a published Artifact, the page **saves a new version
with your zine baked in** and reports the link. Anyone who opens it lands in
**Read** mode and flips through with the ‹ › arrows, swipe, or the page dots — no
editing tools, just the booklet. Use the artifact's own Share menu (top-right of
the window) to send the link or make it public.

This uses the Artifact `artifact` (self-publish) runtime capability, chosen over
`db`/`assets` specifically because those force the page organization-internal,
whereas self-publish keeps it publicly shareable. Opened as a plain file (not the
published artifact), editing still works and is kept in local storage, but the
Share button explains that a link can only be produced from the published
artifact.

## Print (fold & cut)

**🖨** composes the 8 pages into a 4×2 imposition sheet — top row rotated 180° so
a folded, one-cut booklet reads 1→8 — at true physical size (US Letter or A4,
landscape). Print single-sided at **100% / actual size** with **background
graphics ON**, fold, cut the centre slit, and collapse into the booklet.

## Design & testing

The look is a risograph print-shop identity — warm paper, spot-colour inks,
halftone grain, condensed **Anton** display caps with **Archivo** (UI) and **Space
Mono** (labels), a diamond logo plate and a 4-colour registration bar — grounded
in established riso/zine convention. Fonts load from Google Fonts with system
fallbacks.

The maker is verified end-to-end with a headless-Chromium test: upload → a layer
appears; drag moves it; the handle resizes it; text edits and persists; Read mode
flips pages; and the **self-published document reproduces** — a fresh viewer opens
straight into Read mode showing the saved zine.
