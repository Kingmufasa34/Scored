# Zine Studio — print-ready 8-panel folding zine builder

A single, dependency-free HTML tool for laying out a **mini 8-page zine** on one
sheet of paper. Design it in the browser, then print single-sided, fold, and make
one cut to get a pocket booklet that reads pages **1 → 8** in order.

Open `zine/index.html` in any browser — phone or desktop, no build step and
nothing to install. When the [phone dashboard server](../README.md#phone-app-mobile-web-dashboard)
is running (`npm run serve`) the tool is also served at **`/zine/`**.

## How you edit it

The screen is a **live preview of the sheet** on top and a **tabbed editor**
below (side-by-side on a wide screen). Everything is tap-driven — no hover, so it
works the same on a phone as on a laptop.

- **Tap a panel** in the preview to select it; the *Page* tab then edits that
  panel. Or step through pages with the ‹ › arrows.
- **Page tab** — the selected panel's photo, heading, text, and colours.
  **📷 Add / change photo** opens your camera or gallery on mobile.
- **Style tab** — paper size (US Letter / A4), panel margin, visual style, page &
  ink colour, and the fold/guide/label toggles.
- **Colour tab** — drive colours from a photo (see below).
- **Help tab** — the fold-and-cut walkthrough and art aspect-ratio tips.

## What it produces

- **True-to-print sheet** — US Letter (8.5 × 11 in) or A4 (210 × 297 mm), landscape,
  sized in real physical units so it prints 1:1 at 300 DPI. The `@page` box is
  rewritten to match the paper you pick.
- **8-panel fold imposition** — a 4 × 2 grid with the top row flipped 180° so a
  folded, one-cut booklet reads in page order. Visible **fold guides** and a
  **centre cut line** are drawn on the sheet (toggle off before final print).
- **Themes** — DIY Punk (halftone), Cyberpunk (neon duotone), Botanical (earthy),
  Personal Journal (handwritten/paper). Each sets fonts, a background texture, and
  a starting page/ink colour you can override.
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

The *Page* tab also has **🎨 Colour from this photo**, which tints the selected
panel from the photo you added to it — so a page's colour can follow its own art.

Colour sampling runs entirely in the browser on a small canvas: the image is
scaled down, transparent pixels are ignored, the average is a straight mean, and
the palette comes from coarse per-channel quantisation ranked by frequency.

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
