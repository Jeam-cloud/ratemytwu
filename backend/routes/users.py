from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy import select
import re
import io

from models import Reviews
from auth import get_current_user_id
from database import db_dependency
from schema import CreatedReviewsOut
from typing import Annotated, List


router = APIRouter(prefix="/user", tags=["users"])

current_user = Annotated[str, Depends(get_current_user_id)]

# Reject uploads bigger than this before doing any parsing/OCR work.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def _check_size(content: bytes):
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")


@router.get("/reviews", response_model=List[CreatedReviewsOut])
def get_user_reviews(db: db_dependency, user_id: current_user):
    user_reviews = db.execute(
        select(Reviews).where(Reviews.user_id == user_id)
    ).scalars().all()

    return user_reviews


# ── Transcript PDF parser ──────────────────────────────────────────────────
_GRADES = r'IP|A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|P|W'

# Term header: e.g. "2024 Spring" or "Term: 2024 Fall" — year+term anywhere in line
_TERM_RE = re.compile(r'\b(\d{4})\s+(Spring|Summer|Fall)\b')

# Course code at the START of a line (allow leading whitespace)
_CODE_START_RE = re.compile(r'^\s*([A-Z]{2,5})\s+(\d{3}[A-Z]?)\b')

# Grade immediately followed by the three credit columns at END of line.
# Handles both "A 3.00 3.00 12.00" and tighter "A3.003.0012.00" layouts.
_TAIL_RE = re.compile(
    rf'\b({_GRADES})\s*(\d+\.\d{{2}})\s*\d+\.\d{{2}}\s*\d+\.\d{{2}}\s*$'
)


def _extract_pages(reader) -> list[str]:
    """Return per-page text, preferring layout mode for table PDFs (transcripts)."""
    lines = []
    for page in reader.pages:
        text = ""
        try:
            text = page.extract_text(extraction_mode="layout") or ""
        except Exception:
            pass
        if not text.strip():
            text = page.extract_text() or ""
        lines.extend(text.splitlines())
    return lines


def _extract_checklist_pages(reader, raw_bytes: bytes = b"") -> list[str]:
    """
    For checklist PDFs, default extraction is more reliable than layout mode.
    If pypdf finds no text (vector-only PDFs like many TWU 2023-24 checklists
    that render all text as Bezier paths), falls back to OCR via pytesseract.
    Pass raw_bytes so the OCR path can render pages without re-opening the file.
    """
    def pages_text(mode=None):
        lines = []
        for page in reader.pages:
            try:
                text = (page.extract_text(extraction_mode=mode) if mode
                        else page.extract_text()) or ""
            except Exception:
                text = ""
            lines.extend(text.splitlines())
        return lines

    # Try default mode first
    default_lines = pages_text()
    if len(_CK_CODE.findall("\n".join(default_lines))) >= 3:
        return default_lines

    # Try layout mode
    layout_lines = pages_text("layout")
    if len(_CK_CODE.findall("\n".join(layout_lines))) >= 3:
        return layout_lines

    # ── OCR fallback for vector-only PDFs ────────────────────────────────
    # Uses pymupdf (pure Python wheel, no system poppler needed) to render
    # pages as images, then pytesseract to read the text.
    if raw_bytes:
        try:
            import fitz           # pymupdf
            from PIL import Image
            import pytesseract

            doc = fitz.open(stream=raw_bytes, filetype="pdf")
            ocr_lines = []
            for page in doc:
                mat = fitz.Matrix(2.0, 2.0)   # 2× = ~144 DPI, good for OCR
                pix = page.get_pixmap(matrix=mat)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                ocr_lines.extend(pytesseract.image_to_string(img).splitlines())
            if len(_CK_CODE.findall("\n".join(ocr_lines))) >= 1:
                return ocr_lines
        except Exception:
            pass  # OCR unavailable — fall through

    return default_lines


@router.post("/parse-transcript")
async def parse_transcript(user_id: current_user, file: UploadFile = File(...)):
    """
    Accepts a TWU unofficial transcript PDF and returns a list of parsed courses.
    Each entry: {course_code, calendar_year, term, grade, credits, status}
    Requires auth so anonymous callers can't hammer the (OCR-capable) parser.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        from pypdf import PdfReader
    except ImportError:
        raise HTTPException(status_code=500, detail="pypdf not installed")

    content = await file.read()
    _check_size(content)
    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF")

    all_lines = _extract_pages(reader)

    courses = []
    current_year = None
    current_term = None
    seen = set()   # de-dupe (code, year, term)

    for line in all_lines:
        stripped = line.strip()
        if not stripped:
            continue

        # ── Term header ──────────────────────────────────────────────────
        # Accept it as long as the line doesn't START with a course code
        # (so "CMPT 211 Intro to... Spring 2024..." isn't treated as a header)
        if not _CODE_START_RE.match(stripped):
            tm = _TERM_RE.search(stripped)
            if tm:
                current_year = int(tm.group(1))
                current_term = tm.group(2)
                continue

        if current_year is None or current_term is None:
            continue

        # ── Course line ──────────────────────────────────────────────────
        code_m = _CODE_START_RE.match(stripped)
        if not code_m:
            continue

        tail_m = _TAIL_RE.search(stripped)
        if not tail_m:
            continue

        course_code = f"{code_m.group(1)} {code_m.group(2)}"
        grade_raw   = tail_m.group(1)
        credits     = float(tail_m.group(2))

        # Skip 0-credit rows (tutorials, SKLS pass sections)
        if credits == 0.0:
            continue

        key = (course_code, current_year, current_term)
        if key in seen:
            continue
        seen.add(key)

        if grade_raw == 'IP':
            status = 'In Progress'
            grade  = None
        elif grade_raw == 'P':
            status = 'Completed'
            grade  = None
        else:
            status = 'Completed'
            grade  = grade_raw

        courses.append({
            'course_code':   course_code,
            'calendar_year': current_year,
            'term':          current_term,
            'grade':         grade,
            'credits':       int(credits),
            'status':        status,
        })

    return courses


@router.post("/debug-transcript")
async def debug_transcript(user_id: current_user, file: UploadFile = File(...)):
    """
    Returns the raw text lines pypdf extracts from the PDF.
    Use this to diagnose parser issues.
    """
    try:
        from pypdf import PdfReader
    except ImportError:
        raise HTTPException(status_code=500, detail="pypdf not installed")

    content = await file.read()
    _check_size(content)
    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF")

    lines = _extract_pages(reader)
    return {"lines": lines, "total": len(lines)}


# ── Checklist PDF parser ───────────────────────────────────────────────────
# Turns a TWU program checklist into structured requirements. Context-aware so
# codes inside a "Choose from: …" clause land in `choose`, not `required`.
#
# TWU checklist PDFs use a 2-column table layout. pypdf's layout-mode
# extraction sometimes:
#   (a) wraps a section header across two lines, splitting the title from "(N s.h.*)"
#   (b) adds inconsistent whitespace after the section number dot
# _preprocess() fixes (a) before the regex runs.

_SH_HDR = re.compile(
    r'(?:^|\n)\s{0,8}(\d)\s*[.]\s+'   # digit + dot + any whitespace
    r'([A-Za-z][^\n]{3,80}?)'          # title: non-greedy, up to 81 chars
                                        # (allows an embedded "(B.A.)"-style
                                        # designation — non-greedy backtracks
                                        # past it to find the real credit paren)
    # (N s.h. OR (N - M s.h. — numbers allow a stray internal space
    # (e.g. "(4 5 s.h.)") since pypdf sometimes splits multi-digit
    # numbers across a kerning gap in justified table layouts.
    r'\s*\((\d(?:\s?\d)*)(?:\s*[-–—]\s*(\d(?:\s?\d)*))?\s*s\.h\.',
    re.MULTILINE,
)
_CK_CODE = re.compile(r'\b([A-Z]{2,5})\s+(\d{3})[A-Z]?\b')

# A handful of programs (Biology, BHKIN, Computing Science, Media Comm) split
# their major requirement into multiple named streams and the section header
# has NO credit total at all — e.g. "2. Stream Courses – Choose your stream
# below." — so _SH_HDR never matches it and the program's entire major course
# list was silently dropped. Narrowly scoped to lines containing "Stream" with
# no parenthetical on the line, so it can't accidentally swallow unrelated text.
_SH_HDR_BARE_STREAM = re.compile(
    r'(?:^|\n)\s{0,8}(\d)\s*[.]\s+(?=[^\n(]*[Ss]tream)([A-Za-z][^\n(]{1,60}?)\s*[-–—*]*\s*(?=\n)',
    re.MULTILINE,
)

# Some programs (Education's Teachable Specializations, Humanities/Natural
# Sciences' "Minors and Concentrations", double-major concentrations, etc.)
# don't list courses at all — they're a blank fill-in box pointing the
# student at a SEPARATE checklist PDF they need to attach. There's no course
# code to extract here, ever; the honest answer is to flag it, not guess.
_SH_HDR_BARE_ATTACH = re.compile(
    r'(?:^|\n)\s{0,8}(\d)\s*[.]\s+'
    r'(?=[^\n(]*(?:[Cc]oncentration|[Ss]pecialization|[Mm]inor))'
    r'([A-Za-z][^\n(]{1,60}?)\s*[-–—*:]*\s*(?=\n)',
    re.MULTILINE,
)
_ATTACH_CREDITS = re.compile(r'\(\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*s\.h')

# Stream-based majors (Chemistry, Computing Science, Game Development,
# Mathematics) nest an "Ancillary Requirements (N s.h.)" sub-header INSIDE
# each stream's own block, with no leading section number at all — so it
# never became its own top-level section, and its courses (e.g. Computing
# Science's MATH 123/124, NATS 483) were silently absorbed into the parent
# Stream's "major" required list instead of Ancillary. Some majors repeat
# this sub-header once per stream (different streams can need slightly
# different ancillary courses) — codes from every occurrence are merged.
_ANCILLARY_SUBHDR = re.compile(
    r'\n[ \t]+Ancillary Requirements\s*\(\s*(\d+)\s*s\.h\.\)',
    re.IGNORECASE,
)

# ── Minor / Concentration checklist parser ──────────────────────────────────
# Minor and Concentration checklists NEVER use the numbered section headers
# (_SH_HDR) major checklists always do — confirmed against all 40 real
# 2026-27 minor/concentration PDFs, every one of which returned zero sections
# from the major-checklist parser. Instead they use bare "Minor" /
# "Concentration" tier labels, and many bundle BOTH tiers in the same PDF
# (e.g. "Computing Science Minor/Concentration Checklist (24/30 s.h.)" has a
# full Minor course list AND a separate, larger Concentration course list).
# This title regex also lets the upload endpoint detect a MISMATCH — e.g.
# someone uploading a Major checklist into the Minor/Concentration slot, or
# vice versa — instead of silently mis-parsing it.
_KIND_ALT = r'MAJOR|MINOR\s*/\s*CONCENTRATION|CONCENTRATION\s*/\s*MINOR|MINOR|CONCENTRATION'
_DOC_TITLE = re.compile(
    r'(?P<prog>[A-Z][A-Za-z &+]+?)\s*(?:/[A-Za-z ]+)?\s+'
    # Negative lookbehind excludes "DOUBLE CONCENTRATION" — that's a MAJOR's
    # own title (e.g. "Arts, Media + Culture Double Concentration Checklist"),
    # not a document of kind "concentration"; without this it would falsely
    # reject a legitimate Major upload as the wrong document type.
    r'(?<!DOUBLE )(?P<kind>' + _KIND_ALT + r')\s+CHECKLIST\s*[-–—]?\s*'
    # Credits: single ("24"), slash-range ("24/30" — dual doc), or
    # hyphen-range ("24-26" — one tier with a flexible target).
    r'\((?P<c1>\d+)(?:\s*[/-]\s*(?P<c2>\d+))?\s*s\.h',
)
# A handful of titles put the credit total BEFORE "CHECKLIST" instead of
# after (e.g. "EDUCATION MINOR / CONCENTRATION (24/30 s.h.) CHECKLIST").
_DOC_TITLE_ALT = re.compile(
    r'(?P<prog>[A-Z][A-Za-z &+]+?)\s+'
    r'(?<!DOUBLE )(?P<kind>' + _KIND_ALT + r')\s*'
    r'\((?P<c1>\d+)(?:\s*[/-]\s*(?P<c2>\d+))?\s*s\.h\.?\)\s*CHECKLIST',
)
_DOC_KIND_MAP = {
    "MAJOR": "major",
    "MINOR/CONCENTRATION": "dual",
    "CONCENTRATION/MINOR": "dual",
    "MINOR": "minor",
    "CONCENTRATION": "concentration",
}

# A bare tier label on its own line — "Minor", "Minor (24 s.h.)", "Minor for
# B.B.A. or B.A. Business Students", "Concentration (30 s.h.)", etc. Some
# documents (Accounting) repeat the SAME tier twice as alternate paths
# ("Minor for B.B.A. ..." / "Minor for Non-Business Students") — both get
# grouped under the one "minor" tier since either path satisfies it.
_TIER_HDR = re.compile(
    r'(?:^|\n)[ \t]*(Minor|Concentration)\b[^\n]{0,70}(?=\n)',
    re.MULTILINE,
)

# Same idea as _ANCILLARY_SUBHDR above but for the bare (unnumbered) minor/
# concentration document style.
_BARE_ANCILLARY = re.compile(
    r'\n[ \t]*Ancillary Requirements\s*\(\s*(\d+)\s*s\.h\.\)',
    re.IGNORECASE,
)


def _detect_doc_title(text: str) -> dict | None:
    """
    Lightweight title-only check used to catch upload-type mismatches (e.g. a
    Major checklist uploaded into the Minor/Concentration slot) before
    parsing. Returns {"kind": "major"|"dual"|"minor"|"concentration", ...} or
    None if the title line doesn't match any known checklist format at all.
    """
    m = _DOC_TITLE.search(text) or _DOC_TITLE_ALT.search(text)
    if not m:
        return None
    kind_norm = re.sub(r'\s*/\s*', '/', m.group("kind").strip())
    return {
        "kind": _DOC_KIND_MAP[kind_norm],
        "program": m.group("prog").title().strip(),
        "c1": int(m.group("c1")),
        "c2": int(m.group("c2")) if m.group("c2") else None,
    }


def _choose_codes(clause: str) -> list[str]:
    """
    Parses "Choose from: PHIL 303, 304, 305; RELS 225, 365, 366." style
    clauses where a prefix is only written once per run and the bare numbers
    that follow belong to that same prefix until a new one appears — unlike
    a plain _codes_in() scan, which would miss every number not immediately
    preceded by its own prefix.
    """
    codes = []
    current_prefix = None
    for tok in re.findall(r'[A-Z]{2,4}(?=\s*\d)|\d{3}', clause):
        if re.match(r'^[A-Z]{2,4}$', tok):
            current_prefix = tok
        elif current_prefix:
            codes.append(f"{current_prefix} {tok}")
    return list(dict.fromkeys(codes))


def _parse_tiered_checklist(text: str, requested_type: str) -> dict:
    """
    Parser for Minor/Concentration checklists (requested_type is "minor" or
    "concentration"). When a document bundles both tiers together, this pulls
    out only the tier matching requested_type — so uploading the same PDF as
    Minor vs Concentration returns the right half, not both merged or the
    wrong one.
    """
    text = _preprocess(text)
    out = {"program": None, "calendarYear": None, "totalCredits": None, "sections": [], "docKind": None}

    tm = _detect_doc_title(text)
    if tm:
        out["program"] = tm["program"]
        # Tells the frontend whether this same PDF also has the OTHER tier —
        # so uploading it once (say, into the Minor slot) can also seed the
        # Concentration community-pool entry from the same file, instead of
        # only being searchable under whichever slot it happened to be
        # uploaded into.
        out["docKind"] = tm["kind"]
        c1 = tm["c1"]
        c2 = tm["c2"]
        if c2 is not None:
            # Concentration always requires MORE credits than Minor when a
            # document lists both (e.g. "24/30 s.h." = 24 for Minor, 30 for
            # Concentration) — pick the smaller/larger number accordingly
            # rather than assuming a fixed left/right position.
            out["totalCredits"] = min(c1, c2) if requested_type == "minor" else max(c1, c2)
        else:
            out["totalCredits"] = c1
    ym = re.search(r'(\d{4}-\d{2})\s+Academic Calendar', text)
    if ym:
        out["calendarYear"] = ym.group(1)

    tier_hdrs = list(_TIER_HDR.finditer(text))
    if tier_hdrs:
        tiers: dict[str, list[str]] = {}
        for i, m in enumerate(tier_hdrs):
            tier = m.group(1).lower()
            start = m.end()
            end = tier_hdrs[i + 1].start() if i + 1 < len(tier_hdrs) else len(text)
            tiers.setdefault(tier, []).append(text[start:end])
        if requested_type not in tiers:
            # Document has tier headers but not the one requested (e.g. a
            # Minor-only doc with no "Concentration" tier at all) — nothing
            # to extract. The endpoint surfaces this as a clear error instead
            # of silently returning an empty template.
            return out
        block = "\n".join(tiers[requested_type])
    else:
        # No bare tier headers at all (e.g. Catholic Studies Minor, Gender
        # Studies Minor) — the whole body IS the one tier this document is.
        block = text

    anc_credits, anc_codes = 0, []
    am = _BARE_ANCILLARY.search(block)
    if am:
        anc_credits = int(am.group(1))
        anc_codes = _codes_in(block[am.end():])
        block = block[:am.start()]

    choose = []
    for ch in re.findall(r'Choose (?:from|one of):\s*([A-Z0-9, .;]+?)[.\n]', block):
        choose += _choose_codes(ch)
    block_nc = re.sub(r'Choose (?:from|one of):[^.\n]*[.\n]', '', block)
    required = _codes_in(block_nc)
    prefixes = [c.split()[0] for c in required]
    prefix = max(set(prefixes), key=prefixes.count) if prefixes else None

    # Some minors/concentrations (e.g. Philosophy) don't list any real course
    # codes at all — every slot is a blank fill-in box like "PHIL _________"
    # meaning "any course in this prefix" rather than a fixed list. Without
    # this, `required` and `prefix` both come back empty and the section gets
    # dropped entirely even though the requirement is real.
    if not required and not choose:
        blank_prefixes = re.findall(r'\b([A-Z]{2,5})\s+_{2,}', block)
        if blank_prefixes:
            prefix = max(set(blank_prefixes), key=blank_prefixes.count)

    if required or choose or prefix:
        out["sections"].append({
            "key": "major",
            "title": f"{requested_type.title()} Requirements",
            "credits": out["totalCredits"] or 0,
            "required": required,
            "choose": choose,
            "electivePrefix": prefix,
            "electiveMinLevel": 130,
        })
    if anc_codes:
        out["sections"].append({
            "key": "ancillary",
            "title": "Ancillary Requirements",
            "credits": anc_credits,
            "required": anc_codes,
        })

    return out


# Core prefixes TWU always puts in section 1 — never treat as major courses
_CORE_PREFIXES = {"ENGL", "FNDN", "RELS", "PHIL", "BIOL", "CHEM",
                  "GENV", "GEOL", "PHYS", "ART", "MUSI", "THTR",
                  "ANTH", "HIST", "SOCI", "POLS", "MCOM", "PSYC",
                  "LING", "ECON", "NURS", "HKIN", "SAMC", "IDIS", "GREE", "HEBR"}


_YEAR_PLAN_CUT = re.compile(
    # Negative lookbehind excludes "...there is no specific 4-year plan" —
    # flexible-structure programs (Humanities, Natural Sciences, General
    # Studies) say this in prose, and it used to false-match here, truncating
    # away everything after it (including their real "Minors and
    # Concentrations" attachment section).
    r'\n[^\n]*(?<!no specific )(?:\d[- ]?Year Plan|Sample Plan|Degree Plan|FOR OFFICE USE)[^\n]*\n'
    r'|\n\s*✓\s+s\.h\.[ \t]+(?:Fall|Spring|Summer)\b'
    r'|\n[ \t]{2,}YEAR[ \t]{2,}\d\b',
    re.IGNORECASE,
)


def _preprocess(text: str) -> str:
    """
    1. Strip appended year-plan / degree-plan pages that repeat every course
       code and would contaminate the last section's block.
    2. pypdf layout mode sometimes wraps TWU section headers like:
           "2.  Required English Courses\n(42 s.h.*)"
       Join any line that looks like a section-number start but has no '(' yet
       with the next line when that next line contains 's.h'.
    """
    # Truncate at year-plan content so it does not contaminate the last section
    cut = _YEAR_PLAN_CUT.search(text)
    if cut:
        text = text[:cut.start()]

    lines = text.splitlines()
    out = []
    i = 0
    while i < len(lines):
        cur = lines[i]
        if (re.match(r'^\s{0,8}\d\s*[.]\s', cur)
                and 's.h' not in cur
                and '(' not in cur
                and i + 1 < len(lines)
                and 's.h' in lines[i + 1]):
            out.append(cur.rstrip() + ' ' + lines[i + 1].strip())
            i += 2
        else:
            out.append(cur)
            i += 1
    return '\n'.join(out)


def _codes_in(s: str) -> list[str]:
    # de-duped, order preserved
    return list(dict.fromkeys(f"{m.group(1)} {m.group(2)}" for m in _CK_CODE.finditer(s)))


def _infer_sections_from_codes(text: str, program: str) -> list[dict]:
    """
    Last-resort fallback: if the section-header regex finds nothing, scan the
    full PDF text for course codes and infer sections from their prefixes.
    Courses whose prefix matches the likely major prefix go to 'major';
    everything else (that isn't a known core course) goes to 'electives'.
    """
    all_codes = _codes_in(text)
    if not all_codes:
        return []

    # Guess major prefix from program name (e.g. "English" → "ENGL")
    # Try 4-letter abbreviation first, then 3-letter, then 2-letter
    prog_words = (program or "").upper().split()
    guessed_prefix = None
    for word in prog_words:
        for length in (4, 3, 2):
            candidate = word[:length]
            if any(c.startswith(candidate) for c in all_codes) and candidate not in _CORE_PREFIXES:
                guessed_prefix = candidate
                break
        if guessed_prefix:
            break

    # Fallback: when name-guessing fails (e.g. "Computing Science" → "CMPT" can't
    # be guessed from "COMP"), use the most common non-core prefix in the document.
    if guessed_prefix is None:
        from collections import Counter
        non_core_prefixes = [c.split()[0] for c in all_codes
                             if c.split()[0] not in _CORE_PREFIXES]
        if non_core_prefixes:
            freq = Counter(non_core_prefixes)
            top_prefix, top_count = freq.most_common(1)[0]
            # Only treat it as "major" if it accounts for ≥40% of non-core codes
            # (avoids false positives when codes are evenly spread across prefixes)
            if top_count / len(non_core_prefixes) >= 0.40:
                guessed_prefix = top_prefix

    # Second fallback: for subject minors (e.g. Psychology Minor) where the
    # dominant prefix is normally treated as "core" (e.g. PSYC), use the most
    # common prefix across ALL codes — including core ones — when it dominates.
    if guessed_prefix is None:
        from collections import Counter
        all_prefixes = [c.split()[0] for c in all_codes]
        if all_prefixes:
            freq = Counter(all_prefixes)
            top_prefix, top_count = freq.most_common(1)[0]
            if top_count / len(all_prefixes) >= 0.60:
                guessed_prefix = top_prefix

    major_codes = []
    ancillary_codes = []
    for code in all_codes:
        prefix = code.split()[0]
        # Skip core-only prefixes — BUT if this prefix IS the guessed major prefix
        # (e.g. ENGL for an English major), include it rather than discarding it.
        if prefix in _CORE_PREFIXES and not (guessed_prefix and prefix.startswith(guessed_prefix)):
            continue
        if guessed_prefix and prefix.startswith(guessed_prefix):
            major_codes.append(code)
        else:
            ancillary_codes.append(code)

    sections = []
    if major_codes:
        sections.append({
            "key": "major",
            "title": f"Required {program or 'Major'} Courses",
            "credits": len(major_codes) * 3,
            "required": major_codes,
            "choose": [],
            "electivePrefix": guessed_prefix,
            "electiveMinLevel": 130,
            "blankSlots": 0,
            "_inferred": True,
        })
    if ancillary_codes:
        sections.append({
            "key": "ancillary",
            "title": "Ancillary Requirements",
            "credits": len(ancillary_codes) * 3,
            "required": ancillary_codes,
        })
    return sections


def _parse_checklist(text: str) -> dict:
    text = _preprocess(text)   # fix wrapped section headers before any regex

    out = {"program": None, "calendarYear": None, "totalCredits": None, "sections": []}

    pm = re.search(
        r'(?:B\.[A-Za-z.]+\s+)?([A-Z][A-Za-z &]+?)\s*(?:\/[A-Za-z ]+)?\s+(?:MAJOR\s+)?CHECKLIST\s*[-\u2013\u2014]?\s*\((\d+)(?:\/\d+)?\s*s\.h',
        text,
    )
    if pm:
        out["program"] = pm.group(1).title().strip()
        out["totalCredits"] = int(pm.group(2))
    ym = re.search(r'(\d{4}-\d{2})\s+Academic Calendar', text)
    if ym:
        out["calendarYear"] = ym.group(1)

    hdrs = list(_SH_HDR.finditer(text))

    # Merge in bare "Stream Courses" headers that have no credit total, as
    # long as they don't overlap a header already found above.
    covered = [(h.start(), h.end()) for h in hdrs]
    bare_stream = [b for b in _SH_HDR_BARE_STREAM.finditer(text)
                   if not any(s <= b.start() < e for s, e in covered)]
    covered += [(b.start(), b.end()) for b in bare_stream]

    # Candidate "attach a separate checklist" headers — confirmed below by
    # checking the block actually looks like a blank fill-in box, not a real
    # course list (some programs DO list real concentration courses inline).
    attach_candidates = [b for b in _SH_HDR_BARE_ATTACH.finditer(text)
                         if not any(s <= b.start() < e for s, e in covered)]

    entries = sorted(
        [(h.start(), h, "real") for h in hdrs]
        + [(b.start(), b, "stream") for b in bare_stream]
        + [(b.start(), b, "attach") for b in attach_candidates],
        key=lambda t: t[0],
    )

    for i, (_, h, kind) in enumerate(entries):
        title = h.group(2).strip()
        start = h.end()
        end = entries[i + 1][1].start() if i + 1 < len(entries) else len(text)
        block = text[start:end]

        if kind == "stream":
            credits = 0  # unknown — real total lives on the stream's own sub-headers
        elif kind == "attach":
            am = _ATTACH_CREDITS.search(block)
            credits = int(am.group(2) or am.group(1)) if am else 0
        else:
            # A range like "(29 - 35 s.h.)" reports the upper bound as the
            # credit target — group(4) is only set when a range was matched.
            # Strip any stray internal space from split numbers ("4 5" -> "45").
            credits = int((h.group(4) or h.group(3)).replace(" ", ""))

        low = title.lower()
        # The blank box itself is drawn differently across PDFs — sometimes a
        # run of underscores (Humanities), sometimes just wide whitespace
        # before the credit total (EDUC) — so the real signal is "this
        # section's block has zero actual course codes in it at all."
        looks_like_attachment = (
            re.search(r'concentration|specialization|teachable|\bminor\b', low)
            and not _codes_in(block)
        )
        if looks_like_attachment:
            # Blank fill-in box pointing at a SEPARATE checklist (concentration,
            # specialization, teachable, etc.) — no course code ever lives here,
            # whether or not this header happened to have a credit number on
            # its own line (some do, e.g. EDUC's "First Academic (Teachable)
            # Specialization: ___ (24-30 s.h.)").
            key = "attachment"
        elif "ancillary" in low:
            key = "ancillary"
        elif "elective" in low:
            key = "electives"
        elif "core" in low or "inquiry" in low or "ways of knowing" in low:
            key = "core"   # handled by the universal Core data on the frontend
        elif kind == "attach":
            # Looked like a concentration/specialization header but the block
            # actually has real course codes — treat it as a normal major
            # section instead of forcing the attachment flow on it.
            key = "major"
        else:
            key = "major"

        sec = {"key": key, "title": title, "credits": credits}

        if key == "attachment":
            sec["note"] = ("This program requires attaching a separate "
                            "concentration/specialization checklist.")
        elif key == "major":
            choose = []
            for ch in re.findall(r'Choose from:\s*([A-Z0-9, ]+?)\.', block):
                nums = re.findall(r'\d{3}', ch)
                pre = re.search(r'[A-Z]{2,4}', ch)
                if pre:
                    choose += [f"{pre.group(0)} {n}" for n in nums]
            block_nc = re.sub(r'Choose from:[^.]*\.', '', block)  # strip so they don't leak into required
            req = _codes_in(block_nc)
            prefixes = [c.split()[0] for c in req]
            prefix = max(set(prefixes), key=prefixes.count) if prefixes else None
            sec.update({
                "required": req,
                "choose": choose,
                "electivePrefix": prefix,
                "electiveMinLevel": 130,
                "blankSlots": len(re.findall(r'[A-Z]{2,4}\s+_{2,}', block)),
            })
        elif key == "ancillary":
            sec["required"] = _codes_in(block)

        out["sections"].append(sec)

    # Pull out a nested, unnumbered "Ancillary Requirements (N s.h.)" sub-header
    # (see _ANCILLARY_SUBHDR above) that got buried inside a Stream Courses
    # block instead of becoming its own section. Different streams can list
    # slightly different ancillary requirements, and reliably telling exactly
    # where one stream's short ancillary list ends and the next stream's own
    # course table begins is unreliable — pypdf's linear text extraction
    # bleeds the two-column layout together past a certain distance. Rather
    # than merge every occurrence (which was pulling in the NEXT stream's
    # major courses as false "ancillary" codes — worse than not fixing this
    # at all, since ancillary is checked before major during classification),
    # only take the first occurrence with a tight window: one stream's clean,
    # uncontaminated ancillary set beats a merged, contaminated one.
    ancillary_subhdr_codes = []
    m = _ANCILLARY_SUBHDR.search(text)
    if m:
        ancillary_subhdr_codes = _codes_in(text[m.end():m.end() + 200])
    if ancillary_subhdr_codes:
        # Only add if there's no genuine top-level ancillary section already
        # covering this (avoids a redundant duplicate section).
        if not any(s["key"] == "ancillary" for s in out["sections"]):
            out["sections"].append({
                "key": "ancillary",
                "title": "Ancillary Requirements",
                "credits": 0,
                "required": list(dict.fromkeys(ancillary_subhdr_codes)),
            })

    # A program whose ENTIRE major requirement is an "attachment" (e.g.
    # Humanities' "Minors and Concentrations") has nothing left to guess —
    # that's the correct, honest result. Don't let the blind fallbacks below
    # stomp on it with a fabricated course list; only fall back when we
    # genuinely found nothing usable at all.
    has_attachment = any(s["key"] == "attachment" for s in out["sections"])

    # ── Fallback 1: well-known programs → exact hardcoded template ───────
    if (out["program"] and not has_attachment
            and not any(s["key"] in ("major", "ancillary") for s in out["sections"])):
        prog = out["program"].lower()
        if "computing science" in prog or "computer science" in prog:
            out["sections"] = [
                {
                    "key": "major",
                    "title": "Required Computing Science Courses",
                    "credits": 42,
                    "required": ["CMPT 140", "CMPT 150", "CMPT 166", "CMPT 231"],
                    "choose": ["CMPT 211", "CMPT 242", "CMPT 385"],
                    "electivePrefix": "CMPT",
                    "electiveMinLevel": 130,
                    "blankSlots": 10,
                },
                {
                    "key": "ancillary",
                    "title": "Ancillary Requirements",
                    "credits": 9,
                    "required": ["MATH 123", "MATH 124", "NATS 483"],
                },
            ]

    # ── Fallback 2: any other program → infer from course codes in the PDF ─
    if not has_attachment and not any(s["key"] in ("major", "ancillary") for s in out["sections"]):
        inferred = _infer_sections_from_codes(text, out.get("program") or "")
        if inferred:
            out["sections"] = inferred

    return out


@router.post("/debug-checklist")
async def debug_checklist(user_id: current_user, file: UploadFile = File(...)):
    """Returns raw extracted text + found codes — use to diagnose parser failures."""
    try:
        from pypdf import PdfReader
    except ImportError:
        raise HTTPException(status_code=500, detail="pypdf not installed")
    content = await file.read()
    _check_size(content)
    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF")

    lines   = _extract_checklist_pages(reader, content)
    text    = "\n".join(lines)
    codes   = _codes_in(text)
    hdrs    = [m.group(0)[:80] for m in _SH_HDR.finditer(_preprocess(text))]
    return {"lines": lines[:200], "codes_found": codes, "section_headers": hdrs}


@router.post("/parse-checklist")
async def parse_checklist(
    user_id: current_user,
    file: UploadFile = File(...),
    doc_type: str = Form("major"),
):
    """
    Accepts a TWU program checklist PDF and returns its structured requirements:
    { program, calendarYear, totalCredits, sections: [{key, title, credits, ...}] }
    where key is one of major | ancillary | electives | core.

    `doc_type` ("major" | "minor" | "concentration") tells the parser which
    kind of document to expect AND which parser to use — Major checklists use
    numbered section headers; Minor/Concentration checklists never do, and
    often bundle both tiers in one PDF (see _parse_tiered_checklist). It's
    also cross-checked against the PDF's own title line so uploading, say, a
    Major checklist into the Minor/Concentration slot (or vice versa) is
    rejected with a clear reason instead of silently mis-parsing.

    Requires auth — this endpoint also feeds the shared community checklist
    pool, so anonymous/unbounded access isn't allowed.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    if doc_type not in ("major", "minor", "concentration"):
        raise HTTPException(status_code=400, detail="Invalid doc_type")

    try:
        from pypdf import PdfReader
    except ImportError:
        raise HTTPException(status_code=500, detail="pypdf not installed")

    content = await file.read()
    _check_size(content)
    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF")

    text = "\n".join(_extract_checklist_pages(reader, content))
    title = _detect_doc_title(text)
    detected_kind = title["kind"] if title else None

    if doc_type == "major":
        if detected_kind in ("minor", "concentration", "dual"):
            raise HTTPException(
                status_code=422,
                detail=f"This looks like a {detected_kind.title()} checklist, not a Major checklist. "
                       f"Upload it under Minor or Concentration instead.",
            )
        parsed = _parse_checklist(text)
    else:
        if detected_kind == "major":
            raise HTTPException(
                status_code=422,
                detail="This looks like a Major checklist, not a Minor/Concentration checklist.",
            )
        if detected_kind not in (None, "dual", doc_type):
            # e.g. doc_type == "concentration" but this document is a
            # Minor-only checklist with no Concentration tier at all.
            raise HTTPException(
                status_code=422,
                detail=f"This document doesn't appear to have a {doc_type.title()} tier — "
                       f"it looks like a {detected_kind.title()}-only checklist.",
            )
        parsed = _parse_tiered_checklist(text, doc_type)

    # A program can be legitimately "attachment-only" (its whole major
    # requirement is "attach a concentration/specialization checklist" — e.g.
    # Humanities) — that's a valid, honest result, not a parse failure.
    if not any(s["key"] in ("major", "ancillary", "attachment") for s in parsed["sections"]):
        raise HTTPException(status_code=422, detail="Couldn't find requirement sections in this PDF")

    return parsed
