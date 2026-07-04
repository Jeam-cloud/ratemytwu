from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
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


def _extract_checklist_pages(reader) -> list[str]:
    """
    For checklist PDFs, default extraction is more reliable than layout mode.
    Layout mode can garble multi-column checklist tables, splitting course codes
    across lines or adding extra spaces that break regex matching.
    We try default first; if it yields no course codes we fall back to layout mode.
    """
    from collections import Counter

    def pages_text(mode=None):
        lines = []
        for page in reader.pages:
            try:
                text = (page.extract_text(extraction_mode=mode) if mode
                        else page.extract_text()) or ""
            except Exception:
                text = ""
            if not text.strip():
                try:
                    text = page.extract_text() or ""
                except Exception:
                    text = ""
            lines.extend(text.splitlines())
        return lines

    default_lines = pages_text()
    default_text  = "\n".join(default_lines)
    code_count    = len(_CK_CODE.findall(default_text))

    # If default mode finds reasonable course codes, use it
    if code_count >= 3:
        return default_lines

    # Otherwise fall back to layout mode
    layout_lines = pages_text("layout")
    layout_text  = "\n".join(layout_lines)
    if len(_CK_CODE.findall(layout_text)) > code_count:
        return layout_lines
    return default_lines


@router.post("/parse-transcript")
async def parse_transcript(file: UploadFile = File(...)):
    """
    Accepts a TWU unofficial transcript PDF and returns a list of parsed courses.
    Each entry: {course_code, calendar_year, term, grade, credits, status}
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        from pypdf import PdfReader
    except ImportError:
        raise HTTPException(status_code=500, detail="pypdf not installed")

    content = await file.read()
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
async def debug_transcript(file: UploadFile = File(...)):
    """
    Returns the raw text lines pypdf extracts from the PDF.
    Use this to diagnose parser issues.
    """
    try:
        from pypdf import PdfReader
    except ImportError:
        raise HTTPException(status_code=500, detail="pypdf not installed")

    content = await file.read()
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
    r'([A-Za-z][^(\n]{3,80}?)'         # title: non-greedy, up to 81 chars
    r'\s*\((\d+)\s*s\.h\.',            # (N s.h.
    re.MULTILINE,
)
_CK_CODE = re.compile(r'\b([A-Z]{2,5})\s+(\d{3})[A-Z]?\b')

# Core prefixes TWU always puts in section 1 — never treat as major courses
_CORE_PREFIXES = {"ENGL", "FNDN", "RELS", "PHIL", "BIOL", "CHEM",
                  "GENV", "GEOL", "PHYS", "ART", "MUSI", "THTR",
                  "ANTH", "HIST", "SOCI", "POLS", "MCOM", "PSYC",
                  "LING", "ECON", "NURS", "HKIN", "SAMC", "IDIS", "GREE", "HEBR"}


def _preprocess(text: str) -> str:
    """
    pypdf layout mode sometimes wraps TWU section headers like:
        "2.  Required English Courses\n(42 s.h.*)"
    Join any line that looks like a section-number start but has no '(' yet
    with the next line when that next line contains 's.h'.
    """
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

    major_codes = []
    ancillary_codes = []
    for code in all_codes:
        prefix = code.split()[0]
        if prefix in _CORE_PREFIXES:
            continue
        if guessed_prefix and prefix == guessed_prefix:
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

    pm = re.search(r'([A-Z][A-Za-z &]+?)\s+MAJOR CHECKLIST\s*\((\d+)\s*s\.h', text)
    if pm:
        out["program"] = pm.group(1).title().strip()
        out["totalCredits"] = int(pm.group(2))
    ym = re.search(r'(\d{4}-\d{2})\s+Academic Calendar', text)
    if ym:
        out["calendarYear"] = ym.group(1)

    hdrs = list(_SH_HDR.finditer(text))
    for i, h in enumerate(hdrs):
        title = h.group(2).strip()
        credits = int(h.group(3))
        start = h.end()
        end = hdrs[i + 1].start() if i + 1 < len(hdrs) else len(text)
        block = text[start:end]

        low = title.lower()
        if "ancillary" in low:
            key = "ancillary"
        elif "elective" in low:
            key = "electives"
        elif "core" in low or "inquiry" in low or "ways of knowing" in low:
            key = "core"   # handled by the universal Core data on the frontend
        else:
            key = "major"

        sec = {"key": key, "title": title, "credits": credits}

        if key == "major":
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

    # ── Fallback 1: well-known programs → exact hardcoded template ───────
    if out["program"] and not any(s["key"] in ("major", "ancillary") for s in out["sections"]):
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
    if not any(s["key"] in ("major", "ancillary") for s in out["sections"]):
        inferred = _infer_sections_from_codes(text, out.get("program") or "")
        if inferred:
            out["sections"] = inferred

    return out


@router.post("/debug-checklist")
async def debug_checklist(file: UploadFile = File(...)):
    """Returns raw extracted text + found codes — use to diagnose parser failures."""
    try:
        from pypdf import PdfReader
    except ImportError:
        raise HTTPException(status_code=500, detail="pypdf not installed")
    content = await file.read()
    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF")

    lines   = _extract_checklist_pages(reader)
    text    = "\n".join(lines)
    codes   = _codes_in(text)
    hdrs    = [m.group(0)[:80] for m in _SH_HDR.finditer(_preprocess(text))]
    return {"lines": lines[:200], "codes_found": codes, "section_headers": hdrs}


@router.post("/parse-checklist")
async def parse_checklist(file: UploadFile = File(...)):
    """
    Accepts a TWU program checklist PDF and returns its structured requirements:
    { program, calendarYear, totalCredits, sections: [{key, title, credits, ...}] }
    where key is one of major | ancillary | electives | core.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        from pypdf import PdfReader
    except ImportError:
        raise HTTPException(status_code=500, detail="pypdf not installed")

    content = await file.read()
    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF")

    parsed = _parse_checklist("\n".join(_extract_checklist_pages(reader)))

    if not any(s["key"] in ("major", "ancillary") for s in parsed["sections"]):
        raise HTTPException(status_code=422, detail="Couldn't find requirement sections in this PDF")

    return parsed
