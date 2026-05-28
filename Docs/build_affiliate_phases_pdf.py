"""
Generates Docs/Affiliate_Integration_Phases.pdf — a single-purpose handout
that walks through the 6 phases of wiring Amazon Associates (and Admitad)
into Chingiringi. Designed to be the doc the developer shares with the
client to coordinate sign-ups + key hand-offs.

Run:
    python3 Docs/build_affiliate_phases_pdf.py
"""

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, Spacer, SimpleDocTemplate, Table, TableStyle, KeepTogether,
)

OUT_PATH = "Docs/Affiliate_Integration_Phases.pdf"

# ── Styles ────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

H_TITLE = ParagraphStyle(
    'TitleX', parent=styles['Title'],
    fontSize=22, leading=26, spaceAfter=4, alignment=TA_LEFT,
    textColor=colors.HexColor('#0f172a'),
)
H_SUB = ParagraphStyle(
    'SubX', parent=styles['Normal'],
    fontSize=11, leading=15, spaceAfter=18,
    textColor=colors.HexColor('#64748b'),
)
H_PHASE = ParagraphStyle(
    'PhaseX', parent=styles['Heading2'],
    fontSize=14, leading=18, spaceBefore=14, spaceAfter=4,
    textColor=colors.HexColor('#1d4ed8'),
)
H_LABEL = ParagraphStyle(
    'LabelX', parent=styles['Normal'],
    fontSize=9, leading=12, spaceBefore=2, spaceAfter=2,
    textColor=colors.HexColor('#475569'),
    fontName='Helvetica-Bold',
)
H_BODY = ParagraphStyle(
    'BodyX', parent=styles['Normal'],
    fontSize=10, leading=14, spaceAfter=4,
    textColor=colors.HexColor('#1f2937'),
)
H_CODE = ParagraphStyle(
    'CodeX', parent=styles['Code'],
    fontSize=8.5, leading=11, spaceBefore=2, spaceAfter=6,
    leftIndent=8, rightIndent=8,
    textColor=colors.HexColor('#0f172a'),
    backColor=colors.HexColor('#f1f5f9'),
    borderColor=colors.HexColor('#e2e8f0'),
    borderWidth=0.5, borderPadding=6,
)
H_NOTE = ParagraphStyle(
    'NoteX', parent=styles['Normal'],
    fontSize=9, leading=13, spaceAfter=8,
    textColor=colors.HexColor('#92400e'),
    backColor=colors.HexColor('#fffbeb'),
    borderColor=colors.HexColor('#fde68a'),
    borderWidth=0.5, borderPadding=6,
    leftIndent=4, rightIndent=4,
)

# ── Build story ───────────────────────────────────────────────────────────
story = []

story.append(Paragraph("Chingiringi × Amazon Associates", H_TITLE))
story.append(Paragraph(
    "Integration phases — what the client signs up for, what the developer builds, "
    "and the order things have to happen in. Total dev time once approvals land: ~2 days.",
    H_SUB,
))

# ── Phase 1 ──────────────────────────────────────────────────────────────
story.append(Paragraph("Phase 1 — Sign up for Amazon Associates", H_PHASE))
story.append(Paragraph("Who: <b>Client</b> (business owner, not the developer)", H_LABEL))
story.append(Paragraph(
    "Amazon ties the affiliate account to the business entity for tax purposes. "
    "The developer cannot sign up on their behalf.",
    H_BODY,
))
story.append(Paragraph(
    "Steps: <br/>"
    "1. Go to affiliate-program.amazon.in<br/>"
    "2. Sign up with business email + Chingiringi&#39;s PAN/GST + bank account<br/>"
    "3. List <b>chingiringi.com</b> + Play Store / App Store URLs<br/>"
    "4. Amazon reviews in 24–72 hours<br/>"
    "5. On approval, copy the <b>Tracking ID</b> (e.g. <font face='Courier'>chingiringi-21</font>) and send it to the developer",
    H_BODY,
))

# ── Phase 2 ──────────────────────────────────────────────────────────────
story.append(Paragraph("Phase 2 — Generate PA-API credentials", H_PHASE))
story.append(Paragraph("Who: <b>Client</b> (≈ 5 minutes inside the Associates dashboard)", H_LABEL))
story.append(Paragraph(
    "Inside Associates → <b>Tools → Product Advertising API → Join</b>. Amazon walks the "
    "client through creating (or linking) an AWS account. This AWS account is just a "
    "credentials wrapper — no servers, no hosting, free.",
    H_BODY,
))
story.append(Paragraph(
    "Output: an <font face='Courier'>AccessKey</font> + <font face='Courier'>SecretKey</font> "
    "pair. The secret is shown only once — copy immediately.",
    H_BODY,
))
story.append(Paragraph(
    "Heads-up — Amazon gives only <b>probationary</b> PA-API access until 3 qualifying sales "
    "happen within 180 days. Launch does not block on this. Manual product URLs work day one.",
    H_NOTE,
))

# ── Phase 3 ──────────────────────────────────────────────────────────────
story.append(Paragraph("Phase 3 — Wire credentials into the backend", H_PHASE))
story.append(Paragraph("Who: <b>Developer</b>", H_LABEL))
story.append(Paragraph(
    "Add to <font face='Courier'>backend/.env</font>:",
    H_BODY,
))
story.append(Paragraph(
    "AMAZON_ASSOC_TAG=chingiringi-21<br/>"
    "AMAZON_PAAPI_ACCESS_KEY=AKIA...<br/>"
    "AMAZON_PAAPI_SECRET_KEY=...<br/>"
    "AMAZON_PAAPI_HOST=webservices.amazon.in<br/>"
    "AMAZON_PAAPI_REGION=eu-west-1",
    H_CODE,
))

# ── Phase 4 ──────────────────────────────────────────────────────────────
story.append(Paragraph("Phase 4 — Click + redirect with tracking tag", H_PHASE))
story.append(Paragraph("Who: <b>Developer</b>", H_LABEL))
story.append(Paragraph(
    "Extend <font face='Courier'>POST /api/deals/:id/click</font> to: "
    "(a) generate a unique clickId, (b) persist a Click row, "
    "(c) return a tracking URL with the tag + subtag.",
    H_BODY,
))
story.append(Paragraph(
    "const clickId = nanoid(10);<br/>"
    "await Click.create({ clickId, userId, dealId });<br/>"
    "const trackingUrl = `${deal.affiliateUrl}` +<br/>"
    "&nbsp;&nbsp;`?tag=${process.env.AMAZON_ASSOC_TAG}` +<br/>"
    "&nbsp;&nbsp;`&amp;ascsubtag=${clickId}`;<br/>"
    "return { trackingUrl };",
    H_CODE,
))
story.append(Paragraph(
    "Frontend: <font face='Courier'>Linking.openURL(trackingUrl)</font> instead of the raw "
    "affiliate URL.",
    H_BODY,
))

# ── Phase 5 ──────────────────────────────────────────────────────────────
story.append(Paragraph("Phase 5 — Reconciliation", H_PHASE))
story.append(Paragraph("Who: <b>Developer</b>  (manual until PA-API is unlocked)", H_LABEL))
story.append(Paragraph(
    "Amazon does NOT push postbacks. Pull-based reconciliation, two paths:",
    H_BODY,
))

# Paragraph-wrap the cells so long strings wrap inside the column instead
# of overflowing horizontally. Column widths must sum to ≤ 174 mm (A4 width
# 210 − 18 mm left − 18 mm right margins).
_cell_h = ParagraphStyle(
    'CellH', parent=H_BODY, fontSize=9, leading=11,
    textColor=colors.white, fontName='Helvetica-Bold',
)
_cell = ParagraphStyle('Cell', parent=H_BODY, fontSize=8.5, leading=11, spaceAfter=0)

t = Table(
    [
        [Paragraph('Option', _cell_h), Paragraph('When', _cell_h), Paragraph('How', _cell_h)],
        [
            Paragraph('A. PA-API report sync (daily cron)', _cell),
            Paragraph('After 3 qualifying sales + PA-API approval', _cell),
            Paragraph(
                'Fetch orders report, match ascsubtag → Click → User, '
                'insert Transaction, credit Wallet.pendingCashback',
                _cell,
            ),
        ],
        [
            Paragraph('B. Manual CSV import (admin screen)', _cell),
            Paragraph('Day one, before PA-API approval', _cell),
            Paragraph(
                'Client downloads weekly Earnings CSV from Associates dashboard, '
                'uploads via POST /api/admin/imports/amazon-csv, same matching logic',
                _cell,
            ),
        ],
    ],
    colWidths=[50 * mm, 42 * mm, 82 * mm],
)
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1d4ed8')),
    ('TEXTCOLOR',  (0, 0), (-1, 0), colors.white),
    ('FONTNAME',   (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE',   (0, 0), (-1, -1), 8.5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('TOPPADDING',    (0, 0), (-1, -1), 5),
    ('LEFTPADDING',   (0, 0), (-1, -1), 6),
    ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
    ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1),
     [colors.white, colors.HexColor('#f8fafc')]),
]))
story.append(t)
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Launch with B, switch to A once unlocked.",
    H_BODY,
))

# ── Phase 6 ──────────────────────────────────────────────────────────────
story.append(Paragraph("Phase 6 — Payout to user", H_PHASE))
story.append(Paragraph("Who: <b>Amazon → Chingiringi → User</b>", H_LABEL))
story.append(Paragraph(
    "Amazon pays Chingiringi monthly (≈ 60-day lock so returns can settle). When Chingiringi "
    "receives the bank deposit, the daily cron flips matching Transactions from "
    "<b>pending</b> → <b>confirmed</b>. User can then withdraw confirmedCashback via "
    "Razorpay X (separate Phase 2 build).",
    H_BODY,
))

# ── Effort table ─────────────────────────────────────────────────────────
story.append(Paragraph("Developer effort summary", H_PHASE))
def _row(*cells, header=False, total=False):
    style = _cell_h if header else _cell
    return [Paragraph(c, style) for c in cells]

effort = Table(
    [
        _row('Step', 'Owner', 'Time', header=True),
        _row('One-page sign-up doc for client', 'Dev', '30 min'),
        _row('Amazon approval', 'Client (wait)', '1–3 days'),
        _row('Env wiring + URL builder', 'Dev', '1 hr'),
        _row('Update /click endpoint', 'Dev', '1 hr'),
        _row('CSV import admin screen (Option B)', 'Dev', '4 hr'),
        _row('Daily reconciliation cron (Option A)', 'Dev', '4 hr'),
        _row('Wallet credit + Transaction lifecycle', 'Dev', '4 hr'),
        _row('<b>Total dev work (excl. waiting)</b>', '', '<b>≈ 14.5 hr (~2 days)</b>'),
    ],
    colWidths=[104 * mm, 35 * mm, 35 * mm],
)
effort.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1d4ed8')),
    ('TEXTCOLOR',  (0, 0), (-1, 0), colors.white),
    ('FONTNAME',   (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE',   (0, 0), (-1, -1), 9),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('TOPPADDING',    (0, 0), (-1, -1), 5),
    ('LEFTPADDING',   (0, 0), (-1, -1), 6),
    ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
    ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
    ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#eff6ff')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -2),
     [colors.white, colors.HexColor('#f8fafc')]),
]))
story.append(effort)

# ── Closing note ─────────────────────────────────────────────────────────
story.append(Spacer(1, 10))
story.append(Paragraph(
    "Multi-merchant note — Amazon Associates only covers Amazon. For Flipkart / Myntra / "
    "Nykaa / etc., either repeat this flow per merchant or sign up with an affiliate network "
    "(Admitad, CueLinks) and integrate once. Most cashback apps run both: direct contracts "
    "with the top 3–5 merchants for better rates, plus a network for the long tail.",
    H_BODY,
))

# ── Build ────────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUT_PATH,
    pagesize=A4,
    leftMargin=18 * mm, rightMargin=18 * mm,
    topMargin=18 * mm,  bottomMargin=18 * mm,
    title="Chingiringi × Amazon Associates — Integration Phases",
    author="Chingiringi engineering",
)
doc.build(story)
print(f"Wrote {OUT_PATH}")
