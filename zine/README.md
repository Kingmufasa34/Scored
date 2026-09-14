# Riso Zine Studio — print-ready 8-panel folding zine maker

A single, dependency-free HTML tool for laying out a **mini 8-page zine** on one
sheet of paper, dressed in a **risograph print-shop** aesthetic — warm paper,
spot-colour inks, halftone grain, Anton display caps, and a 4-colour registration
bar. Design it in the browser, then print single-sided, fold, and make one cut to
get a pocket booklet that reads pages **1 → 8** in order.

## Adding photos (three ways)

The *Content* tab has a photo drop zone that works on any device:

- **Tap it** (or **Choose photo**) to open your camera / gallery,
- **drag & drop** an image onto it, or
- **paste** an image from your clipboard (⌘/Ctrl-V).

Photos are auto-downscaled to ~1400px on the long edge so big phone shots stay
snappy and drafts still fit in local storage. The upload path is verified with a
headless-browser test (see below).

Open `zine/index.html` in any browser — phone or desktop, no build step and
nothing to install. When the [phone dashboard server](../README.md#phone-app-mobile-web-dashboard)
is running (`npm run serve`) the tool is also served at **`/zine/`**.

## How you edit it

The screen is a **live preview of the sheet** on top and a **tabbed editor**
below (side-by-side on a wide screen). Everything is tap-driven — no hover — so it
works the same on a phone as on a laptop, with 48px tap targets throughout.

- **Tap a panel** in the preview to select it; the *Content* tab then edits that
  panel. Or step through pages with the ‹ › arrows.
- **Content tab** — the selected panel's photo (drop zone above), heading, text,
  and per-panel colours.
- **Design tab** — paper size (US Letter / A4), panel margin, visual style, and the
  page & ink colour.
- **Colour tab** — drive colours from a photo (see below).
- **Fold tab** — the fold/guide/label toggles plus the fold-and-cut walkthrough.

## What it produces

- **True-to-print sheet** — US Letter (8.5 × 11 in) or A4 (210 × 297 mm), landscape,
  sized in real physical units so it prints 1:1 at 300 DPI. The `@page` box is
  rewritten to match the paper you pick.
- **8-panel fold imposition** — a 4 × 2 grid with the top row flipped 180° so a
  folded, one-cut booklet reads in page order. Visible **fold guides** and a
  **centre cut line** are drawn on the sheet (toggle off before final print).
- **Themes** — Riso (spot-colour halftone), DIY Punk, Cyberpunk (neon duotone),
  Botanical (earthy), Personal Journal (handwritten). Each sets fonts, a background
  texture, and a starting page/ink colour you can override.
- **Print / Save as PDF** — prints background graphics with exact colours and hides
  all the editing UI.

## Page colour from a photo

The headline control for this branch: **drive the colour from a photo instead of
picking hex by hand.**

1. **Colour tab → 📷 Choose source photo** and pick any image (camera or gallery
   on mobile).
2. The tool samples it and shows a strip of its **dominant colours** — tap one to
   apply, or **Use the photo's average colour** for the overall tone.
3. Choose *where* it lands with **Apply to**: the whole page background, the ink
   (text) colour, every panel, or just the selected panel.
4. Leave **Auto-pick readable text colour** on and the text flips to black or white
   for legible contrast against whatever colour you chose (WCAG relative-luminance).

The *Content* tab also has **🎨 Colour from this photo**, which tints the selected
panel from the photo you added to it — so a page's colour can follow its own art.

Colour sampling runs entirely in the browser on a small canvas: the image is
scaled down, transparent pixels are ignored, the average is a straight mean, and
the palette comes from coarse per-channel quantisation ranked by frequency.

## Design & testing notes

The look follows well-established risograph/print-zine conventions — a limited
spot-colour ink palette, halftone grain, condensed **Anton** display type paired
with **Archivo** (UI) and **Space Mono** (technical labels), and a 4-colour
registration bar — with the accent spent on riso pink and everything else kept
quiet.

The photo-upload and colour-sampling paths are checked with a headless-browser
smoke test (Playwright driving the bundled Chromium) that uploads an image and
asserts it renders in both the drop zone and the panel. Fonts load from Google
Fonts with system fallbacks, so the tool still works offline.

## Printing checklist

- Landscape, **single-sided**, scale **Actual size / 100%** (not "fit to page").
- Turn **Background graphics ON** or the page/panel colours won't print.
- Fold in half three times to crease the grid, unfold, **cut the centre slit**
  (marked ✂), then collapse into the booklet.

## Prompt-generated artwork

If you're generating panel art with an image model, match the sheet's aspect ratio
so it drops in without cropping:

- US Letter landscape → `--ar 11:8.5`
- A4 landscape → `--ar 1.41:1`

Drafts are kept in your browser's local storage via **Save draft**; **Reset**
clears everything.
