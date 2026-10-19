"""Generate the CatatKod pitch slide plan PDF."""
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

OUT = sys.argv[1]
GREEN = colors.HexColor("#1F4D3A")
LIGHT = colors.HexColor("#EAF2EE")
AMBER = colors.HexColor("#FFF4D6")
AMBER_LINE = colors.HexColor("#D9A400")
GREY = colors.HexColor("#5B6460")
LINE = colors.HexColor("#C9D6CF")

base = dict(fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=colors.HexColor("#1B1F1D"))
S = {
    "title": ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=24, leading=28, textColor=GREEN),
    "sub": ParagraphStyle("sub", fontName="Helvetica", fontSize=11.5, leading=16, textColor=GREY),
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=GREEN, spaceBefore=4, spaceAfter=6),
    "slide": ParagraphStyle("slide", fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=colors.white),
    "label": ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=8, leading=11, textColor=GREEN),
    "body": ParagraphStyle("body", **base),
    "bullet": ParagraphStyle("bullet", **base, leftIndent=10, bulletIndent=0),
    "say": ParagraphStyle("say", **{**base, "fontName": "Helvetica-Oblique", "textColor": colors.HexColor("#2E3A34")}),
    "small": ParagraphStyle("small", **{**base, "fontSize": 8, "leading": 11, "textColor": GREY}),
    "cell": ParagraphStyle("cell", **{**base, "fontSize": 8.5, "leading": 11}),
    "cellb": ParagraphStyle("cellb", **{**base, "fontSize": 8.5, "leading": 11, "fontName": "Helvetica-Bold"}),
    "box": ParagraphStyle("box", **{**base, "fontSize": 8.5, "leading": 11, "alignment": TA_CENTER}),
}


def bullets(items):
    return [Paragraph(t, S["bullet"], bulletText="•") for t in items]


def slide(num, title, minutes, goal, show, say, note=None, extra=None):
    """One slide as a card: header bar, goal, what to put on it, what to say, optional warning note."""
    head = Table([[Paragraph(f"Slide {num} — {title}", S["slide"]), Paragraph(minutes, ParagraphStyle("m", parent=S["slide"], fontName="Helvetica", fontSize=9, alignment=2))]],
                 colWidths=[140 * mm, 34 * mm])
    head.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GREEN), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                              ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                              ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    rows = [[Paragraph("PURPOSE", S["label"]), Paragraph(goal, S["body"])],
            [Paragraph("ON THE SLIDE", S["label"]), bullets(show)]]
    if extra is not None:
        rows.append([Paragraph("", S["label"]), extra])
    rows.append([Paragraph("SAY", S["label"]), Paragraph(f"“{say}”", S["say"])])
    body = Table(rows, colWidths=[26 * mm, 148 * mm])
    body.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
                              ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                              ("LEFTPADDING", (0, 0), (-1, -1), 8), ("BOX", (0, 0), (-1, -1), 0.6, LINE)]))
    parts = [head, body]
    if note:
        warn = Table([[Paragraph(f"<b>Check before pitching:</b> {note}", S["small"])]], colWidths=[174 * mm])
        warn.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), AMBER), ("LINEBEFORE", (0, 0), (0, -1), 2.5, AMBER_LINE),
                                  ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 4),
                                  ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        parts.append(warn)
    return KeepTogether(parts + [Spacer(1, 9)])


def grid(data, widths, header=True, bold_row=None):
    t = Table([[Paragraph(str(c), S["cellb"] if (header and r == 0) or r == bold_row else S["cell"]) for c in row]
               for r, row in enumerate(data)], colWidths=widths)
    style = [("GRID", (0, 0), (-1, -1), 0.4, LINE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
             ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), LIGHT))
    if bold_row is not None:
        style.append(("BACKGROUND", (0, bold_row), (-1, bold_row), colors.HexColor("#DCEFE4")))
    t.setStyle(TableStyle(style))
    return t


def pipeline():
    boxes = ["<b>1. Nurse types</b><br/>colloquial note", "<b>2. Normalise</b><br/>shorthand + negation",
             "<b>3. Tier 1</b><br/>rules + trained model<br/>121 codes", "<b>4. Tier 2</b><br/>search all ~17k<br/>ICD-11 codes",
             "<b>5. Nurse confirms</b><br/>human in the loop"]
    cells, widths = [], []
    for i, b in enumerate(boxes):
        cells.append(Paragraph(b, S["box"]))
        widths.append(24 * mm)
        if i < len(boxes) - 1:
            cells.append(Paragraph("<b>&gt;</b>", S["box"]))
            widths.append(5 * mm)
    t = Table([cells], colWidths=widths)
    style = [("VALIGN", (0, 0), (-1, -1), "MIDDLE")]
    for i in range(0, len(cells), 2):
        style += [("BACKGROUND", (i, 0), (i, 0), LIGHT), ("BOX", (i, 0), (i, 0), 0.6, GREEN),
                  ("TOPPADDING", (i, 0), (i, 0), 6), ("BOTTOMPADDING", (i, 0), (i, 0), 6)]
    t.setStyle(TableStyle(style))
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GREY)
    canvas.drawString(18 * mm, 10 * mm, "CatatKod — CodeFest '26 Track 1 HealthTech — slide plan (internal)")
    canvas.drawRightString(192 * mm, 10 * mm, f"{doc.page}")
    canvas.restoreState()


story = [
    Paragraph("CatatKod — Pitch Slide Plan", S["title"]), Spacer(1, 4),
    Paragraph("What goes on each slide, what to say, and which numbers to check first. "
              "Built from the CodeFest planning PDF and the project's measured results (19 Oct 2026).", S["sub"]),
    Spacer(1, 10),
]

overview = grid([
    ["#", "Slide", "Time", "#", "Slide", "Time"],
    ["1", "Title & hook", "0:15", "7", "Our own NLP", "0:30"],
    ["2", "The problem", "0:30", "8", "Results vs. baselines", "0:40"],
    ["3", "Who it affects", "0:20", "9", "Safety & privacy", "0:25"],
    ["4", "Why it's hard (worked example)", "0:25", "10", "Business model", "0:20"],
    ["5", "Live demo", "1:30", "11", "Roadmap", "0:20"],
    ["6", "How it works", "0:30", "12", "Close & ask", "0:15"],
], [8 * mm, 58 * mm, 14 * mm, 8 * mm, 72 * mm, 14 * mm])
story += [Paragraph("Overview (about 6 minutes; trim slides 3, 10, 11 if the limit is 5)", S["h1"]), overview, Spacer(1, 6),
          Paragraph("<b>Rule of thumb:</b> one idea per slide, at most ~25 words of text on screen, numbers large. "
                    "The demo is the centrepiece; everything before it sets up the problem, everything after proves it works.",
                    S["body"]), Spacer(1, 12)]

story.append(slide(1, "Title & hook", "0:15",
    "Name the product and the promise in one breath.",
    ["<b>CatatKod</b> + tagline, e.g. <i>“Tulis macam biasa. Kod ICD-11 siap.”</i> (Write as usual. ICD-11 codes ready.)",
     "Team name and members, Track 1: HealthTech",
     "One strong visual: a messy handwritten-style note turning into clean codes"],
    "Nurses shouldn't have to become medical coders. CatatKod reads notes the way Malaysian nurses actually write them, and suggests the codes for them to confirm."))

story.append(slide(2, "The problem", "0:30",
    "Show the digitisation push is real, funded, and is adding work for frontline staff.",
    ["KKM rolling out the Cloud-Based Clinic Management System (CCMS) to <b>2,489</b> primary-care facilities by 2028",
     "<b>RM650 million</b> national digitalisation initiative",
     "Only <b>160</b> clinics fully digitalised as of Oct 2025 — the rollout is early",
     "Quote: staff report working overtime to keep digital records accurate (Malay Mail, TPC-OHCIS)"],
    "Malaysia is spending RM650 million to put every clinic on a digital record. But the people doing the typing are nurses who are already stretched, and staff are already reporting overtime just to keep records up to date.",
    note="These figures come from the team's planning PDF. Re-open each source (KKM statement, Malay Mail, The Edge, NST) and put the citation in small text on the slide. Lead with official KKM numbers; only use ccmshub.my as 'early tracking data', clearly labelled as partial."))

story.append(slide(3, "Who it affects", "0:20",
    "Make it human: NCD patients generate the most complex notes.",
    ["~<b>15.6%</b> of adults live with diabetes, ~<b>29.2%</b> with hypertension (NHMS)",
     "<b>2.3 million</b> adults live with 3+ chronic conditions — dense notes, hardest to code by hand",
     "Optional: a nurse persona (“Nurse Aisyah, Klinik Kesihatan, 80 patients a day”)"],
    "Non-communicable diseases drive most clinic visits. A patient with diabetes, hypertension and kidney disease produces exactly the kind of note that's slowest to code.",
    note="Confirm which NHMS year these come from and cite it on the slide."))

story.append(slide(4, "Why it's hard — worked example", "0:25",
    "Prove this is a genuine Malay NLP problem, not just translation.",
    ["Left: the raw note <font face='Courier'>pt dtg komplen kencing berbuih, kaki bengkak 3 ari, hx kencing manis. takde demam</font>",
     "Right: <b>MF96.Z</b> Proteinuria • <b>MG29.01</b> Oedema of lower limbs • <b>5A11</b> Type 2 diabetes",
     "Call out the traps: shorthand (<i>pt, dtg, ari, hx</i>), colloquial terms (<i>kencing manis</i> = diabetes), "
     "and negation (<i>takde demam</i> must NOT be coded as fever)"],
    "This one line has abbreviations, a Malay folk term for diabetes, and a negation. A keyword search gets it wrong. A general AI model gets it wrong, as you'll see in our results."))

story.append(slide(5, "Live demo", "1:30",
    "The moment judges remember. Type a messy note, codes appear, nurse confirms.",
    ["Open the CatatKod note page for a synthetic patient",
     "Type the worked-example note; click <b>Cari kod</b>; point at the highlighted evidence and the struck-through negation",
     "Show <b>Kod lain yang mungkin</b>: a code outside the trained set (try <i>bisul kat punggung</i> → Furuncle, or <i>panau</i> → Pityriasis versicolor)",
     "Untick one code, click <b>Sahkan</b> — the nurse stays in control"],
    "I'll type exactly what a nurse would type... and here are the codes, each one linked to the words it came from. 'Takde demam' is recognised as a denial, so fever is not coded. The nurse reviews, unticks anything wrong, and confirms.",
    note="Rehearse 5+ times. Record a backup video of a clean run in case the laptop or Wi-Fi fails. Start the API and web app before you walk on stage."))

story.append(slide(6, "How it works", "0:30",
    "Show there's real engineering, in one diagram.",
    ["The 5-step pipeline below, as a single left-to-right diagram",
     "Highlight that Tier 1 and Tier 2 together cover <b>any</b> ICD-11 code, not just a short list"],
    "First we clean up the shorthand and mark anything that's denied. Then our trained model and Malay phrase rules suggest codes from 121 common primary-care conditions. For anything rarer, we search the whole WHO ICD-11 catalogue. And the nurse always has the final say.",
    extra=pipeline()))

story.append(slide(7, "Our own NLP (not just an API call)", "0:30",
    "Earn the 'we built our own NLP' credit.",
    ["<b>Malay clinical lexicon:</b> 121 ICD-11 codes, 1,168 Malay, English and Manglish phrases (58 symptoms, 36 chronic conditions, 27 acute diagnoses), every code validated against the WHO ICD-11 catalogue",
     "<b>Normaliser:</b> expands shorthand (pt, hx, dtg, ari, smlm), splits <i>sikit2</i>, scopes negation and uncertainty (<i>takde, no, nafi, ?denggi, r/o</i>)",
     "<b>Trained classifier:</b> word + character n-gram model, trained on 3,000+ synthetic notes plus 295 hand-labelled and independently written notes; works on Malay, English and mixed notes",
     "<b>Full-catalogue search:</b> Malay-English clinical glossary over ~17,000 ICD-11 diagnosis codes"],
    "Everything in this pipeline is ours: the Malay lexicon, the shorthand normaliser, the negation handling and the trained model. It runs in milliseconds on a laptop and doesn't need to send patient notes to an external AI."))

results = grid([
    ["System (rows 1-4: our test notes; rows 5-7: independent notes)", "F1", "Notes fully correct"],
    ["CatatKod (rules + trained model)", "0.95", "84%"],
    ["Keyword matching", "0.89", "71%"],
    ["SEA-LION 120B, given our 121-code list", "0.73", "53%"],
    ["SEA-LION 120B, asked for ICD-11 codes directly", "0.03", "2%"],
    ["CatatKod on independent Malay notes (written by a different AI)", "0.80", "55%"],
    ["CatatKod on independent English-only notes", "0.78", "37%"],
    ["Keyword matching on the independent Malay notes", "0.61", "23%"],
], [88 * mm, 18 * mm, 32 * mm], bold_row=1)
story.append(slide(8, "Results vs. baselines", "0:40",
    "The key evaluation stat: our system vs. a large AI model built for Southeast Asian languages.",
    ["One bar chart or the table below. Make <b>0.95 vs 0.03</b> the biggest thing on the slide",
     "One line explaining F1: <i>“How many codes it gets right, balancing wrong suggestions and missed codes. 1.0 = perfect.”</i>",
     "Footnote: test notes held out from training; synthetic data; not clinically validated"],
    "We benchmarked against SEA-LION, the largest model built specifically for Southeast Asian languages. Asked for ICD-11 codes directly, it scores 0.03 — most of its codes are wrong, and 54 don't even exist. Even when we hand it the list of codes, it reaches 0.73. CatatKod scores 0.95, and about 0.80 on notes written independently by a different AI, in Malay or English, which is our honest real-world estimate.",
    note="Lead with 0.95 vs 0.03, but be ready to say ~0.80 on independent notes (0.80 Malay, 0.78 English). The 0.95 test set was written by the same person who built the lexicon, so it is optimistic; ~0.80 is the honest figure, and it still beats keywords (0.61) and SEA-LION with the code list (0.73).",
    extra=results))

story.append(slide(9, "Safety & privacy", "0:25",
    "Pre-empt 'what if it's wrong?' and 'what about PDPA?'.",
    ["<b>Human in the loop:</b> suggestions only; the nurse must confirm every code. Each code shows the exact words it came from",
     "<b>No raw notes stored:</b> the API logs only a fingerprint, note length, and timing",
     "<b>Runs locally:</b> core model needs no external AI, so patient text never leaves the clinic",
     "<b>Synthetic data only</b> in this prototype; a real deployment needs PDPA review and clinician validation"],
    "CatatKod never codes on its own. It suggests, shows its evidence, and the nurse decides. And because our model runs locally, patient notes don't have to be sent to any outside AI service."))

story.append(slide(10, "Business model", "0:20",
    "Show who pays and why now.",
    ["<b>B2G:</b> licence to KKM / state health departments as part of the funded CCMS rollout",
     "<b>Vendor add-on:</b> a coding module for existing CCMS implementation partners",
     "Impact: nurse time saved per visit; better national disease data for planning and outbreak response"],
    "The budget for clinic digitalisation already exists. CatatKod is a module that makes that investment work for the people using it."))

story.append(slide(11, "Roadmap", "0:20",
    "Show what this becomes, without overpromising.",
    ["<b>Next:</b> validate on real de-identified notes with a partner clinic; clinician review of labels",
     "<b>Expand:</b> grow the trained set beyond 121 codes; ICD-10 crosswalk for current systems",
     "<b>Later (mock-ups only):</b> voice-to-note scribing, one-page referral summaries"],
    "Next we validate with real clinicians and real notes. After that, the same engine can draft referral letters and transcribe consultations."))

story.append(slide(12, "Close & ask", "0:15",
    "End on the promise and a clear ask.",
    ["Repeat the tagline and the one stat: <b>0.95 vs 0.03</b>",
     "The ask: a pilot clinic / mentorship / introduction to a CCMS partner",
     "Team photo + contact"],
    "Nurses write the way they've always written. CatatKod does the coding. Thank you."))

story += [PageBreak(), Paragraph("Judge Q&amp;A — prepared answers", S["h1"])]
qa = grid([
    ["Likely question", "Answer"],
    ["What if it suggests the wrong code?", "It never codes by itself. Every suggestion shows the exact words it came from, and the nurse confirms or unticks each one."],
    ["Where did your data come from?", "Synthetic notes only (no real patients). We wrote labelled notes by hand, generated 3,000 training notes from our lexicon, and had a separate AI (SEA-LION) write independent test notes our system had never seen."],
    ["Isn't the 0.95 inflated?", "Partly — that test set shares vocabulary with our lexicon. So we also had a different AI (SEA-LION) write 100 notes we never looked at: CatatKod scores 0.80 there (0.78 on English-only notes), vs 0.61 for keyword matching. Real validation with clinicians is our next step."],
    ["Why not just use ChatGPT / Gemini / SEA-LION?", "We tested it. Asked for ICD-11 codes directly, SEA-LION scored 0.03 and invented codes that don't exist. Ours runs locally, so patient notes never leave the clinic."],
    ["Why ICD-11 and not ICD-10?", "ICD-11 is WHO's current classification (in effect since 2022). Building on it now avoids a migration later; an ICD-10 crosswalk is on the roadmap for systems still on ICD-10."],
    ["Does it work for English notes?", "Yes, and for mixed Malay-English. Every code has both Malay and English phrases. On 60 independent English-only notes it scores 0.78, vs 0.62 for keyword matching."],
    ["How many codes do you support?", "121 trained codes covering common primary-care symptoms, NCDs and infections, plus search across ~17,000 ICD-11 diagnosis codes for anything else."],
    ["PDPA?", "Prototype uses synthetic data. The API stores no note text, only a fingerprint and timing. A real deployment would need a privacy review and run inside KKM infrastructure."],
    ["How long does it take per note?", "Milliseconds for our model on a laptop (measure the live demo and quote it)."],
], [52 * mm, 122 * mm])
story += [qa, Spacer(1, 14), Paragraph("Before the pitch — checklist", S["h1"])]
story += bullets([
    "Know both numbers cold: 0.95 (our test set) and ~0.80 (independent notes) \u2014 and why they differ.",
    "Re-verify every statistic on slides 2–3 against its original source and add small citations.",
    "Record a backup demo video; rehearse the 90-second demo until it's under time.",
    "Start the API and web app before going on stage; test the exact demo note once more.",
    "Confirm ICD-11 code labels on screen match the WHO browser (icd.who.int) for the demo codes.",
    "Keep the line 'prototype, synthetic data, not clinically validated' visible on the results slide.",
])

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                        title="CatatKod pitch slide plan", author="CatatKod team")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("wrote", OUT)
