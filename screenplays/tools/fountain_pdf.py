"""Minimal Fountain -> industry-format screenplay PDF (Courier 12, 1.5"/1" margins)."""
import re
import sys
from xml.sax.saxutils import escape

from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, PageBreak,
                                PageTemplate, Paragraph, Spacer)

base = ParagraphStyle("base", fontName="Courier", fontSize=12, leading=12)
STY = {
    "scene": ParagraphStyle("scene", parent=base, spaceBefore=24),
    "action": ParagraphStyle("action", parent=base, spaceBefore=12),
    "char": ParagraphStyle("char", parent=base, leftIndent=2.2 * inch, spaceBefore=12),
    "paren": ParagraphStyle("paren", parent=base, leftIndent=1.6 * inch, rightIndent=2.0 * inch,
                            firstLineIndent=-0.1 * inch),
    "dial": ParagraphStyle("dial", parent=base, leftIndent=1.0 * inch, rightIndent=1.5 * inch),
    "trans": ParagraphStyle("trans", parent=base, alignment=TA_RIGHT, spaceBefore=12),
    "center": ParagraphStyle("center", parent=base, alignment=TA_CENTER, spaceBefore=24),
}
SCENE_RE = re.compile(r"^(INT|EXT|INT\./EXT|I/E)[. ]")
TRANS_RE = re.compile(r"^(FADE IN:|FADE OUT\.|CUT TO BLACK\.|[A-Z ]+ TO:)$")


def esc(t):
    return escape(t)


def parse(src):
    head, _, body = src.partition("\n====\n")
    meta = dict(l.split(":", 1) for l in head.strip().splitlines() if ":" in l)
    meta = {k.strip(): v.strip() for k, v in meta.items()}
    blocks = [b.strip("\n") for b in re.split(r"\n\s*\n", body.strip())]
    out = []
    for b in blocks:
        lines = b.splitlines()
        first = lines[0].strip()
        if first.startswith(">") and first.endswith("<"):
            out.append([("center", first[1:-1].strip())])
        elif SCENE_RE.match(first):
            out.append([("scene", first)])
        elif TRANS_RE.match(first):
            out.append([("trans", first)])
        elif (len(lines) > 1 and first.rstrip("^ ") == first.rstrip("^ ").upper() and re.search(r"[A-Z]", first)
              and not first.startswith("INSERT")):
            if first.endswith("^"):  # Fountain dual dialogue: speaks over the previous character
                blk = [("char", first[:-1].strip()), ("paren", "(overlapping)")]
            else:
                blk = [("char", first)]
            for l in lines[1:]:
                l = l.strip()
                blk.append(("paren" if l.startswith("(") else "dial", l))
            out.append(blk)
        else:
            out.append([("action", " ".join(l.strip() for l in lines))])
    return meta, out


def build(src_path, out_path):
    meta, blocks = parse(open(src_path, encoding="utf-8").read())
    title = ParagraphStyle("t", parent=base, alignment=TA_CENTER)
    story = [Spacer(1, 3.0 * inch), Paragraph(esc(meta.get("Title", "")), title), Spacer(1, 24)]
    if "Credit" in meta:
        story += [Paragraph(esc(meta["Credit"]), title), Spacer(1, 24)]
    story += [Paragraph("Written by", title), Spacer(1, 12),
              Paragraph(esc(meta.get("Author", "")), title), Spacer(1, 3.2 * inch)]
    for k in ("Notes", "Draft date"):
        if k in meta:
            story.append(Paragraph(esc(meta[k]), base))
    story.append(PageBreak())

    first_flow = True
    for i, blk in enumerate(blocks):
        paras = [Paragraph(esc(t), STY[k]) for k, t in blk]
        if first_flow:
            paras[0].style = ParagraphStyle("first", parent=paras[0].style, spaceBefore=0)
            first_flow = False
        # keep scene headings with the following action block
        if blk[0][0] == "scene" and i + 1 < len(blocks) and blocks[i + 1][0][0] == "action":
            blocks[i + 1] = blk + blocks[i + 1]
            continue
        story.append(KeepTogether(paras))

    def on_page(c, doc):
        n = doc.page - 1
        if n >= 2:
            c.setFont("Courier", 12)
            c.drawRightString(letter[0] - 1 * inch, letter[1] - 0.5 * inch, f"{n}.")

    doc = BaseDocTemplate(out_path, pagesize=letter, title=meta.get("Title", ""),
                          author=meta.get("Author", ""))
    frame = Frame(1.5 * inch, 1 * inch, 6 * inch, 9 * inch, 0, 0, 0, 0)
    doc.addPageTemplates([PageTemplate(frames=[frame], onPage=on_page)])
    doc.build(story)


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
