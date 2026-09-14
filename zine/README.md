# Zine Studio — print-ready 8-panel folding zine builder

A single, dependency-free HTML tool for laying out a **mini 8-page zine** on one
sheet of paper. Design it in the browser, then print single-sided, fold, and make
one cut to get a pocket booklet that reads pages **1 → 8** in order.

Open `zine/index.html` in any browser — there's no build step and nothing to
install. When the [phone dashboard server](../README.md#phone-app-mobile-web-dashboard)
is running (`npm run serve`) the tool is also served at **`/zine/`**.

## What it does

- **True-to-print sheet** — US Letter (8.5 × 11 in) or A4 (210 × 297 mm), landscape,
  sized in real physical units so it prints 1:1 at 300 DPI. The `@page` box is
  rewritten to match the paper you pick.
- **8-panel fold imposition** — a 4 × 2 grid with the top row flipped 180° so a
  folded, one-cut booklet reads in page order. Visible **fold guides** and a
  **centre cut line** are drawn on the sheet (toggle off before final print if you
  don't want them).
- **Per-panel editing** — click any panel to type a heading and body text, or use
  the hover toolbar (🖼) to drop in an image, tint the panel, or clear it.
- **Themes & palette** — DIY Punk (halftone), Cyberpunk (neon duotone), Botanical
  (earthy), Personal Journal (handwritten/paper). Each sets fonts, a background
  texture, and a starting page/ink colour you can override.
- **Print / Save as PDF** — prints background graphics with exact colours and hides
  all the editing UI.

## Page colour from an image

This is the headline control (the one requested for this branch): **drive the page
colour from an image instead of picking hex by hand.**

1. In the sidebar, **Page colour from image → Choose source image…** and pick any
   image.
2. The tool samples it and shows a strip of its **dominant colours** — click one to
   apply, or hit **Use average colour of image** for the overall tone.
3. Choose *where* the colour lands with **Apply picked colour to**: the whole page
   background, the ink (text), or every panel at once.
4. Leave **Auto-pick readable ink** on and the text colour flips to black or white
   automatically for legible contrast against whatever colour you chose (WCAG
   relative-luminance based).

Each panel also has its own **🎨 from image** button that sets that panel's
background from the image you dropped into it — so a page's colour can follow its
own artwork.

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
