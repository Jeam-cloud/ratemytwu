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
    """Return per-page text, preferring layout mode for table PDFs."""
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
_SH_HDR = re.compile(r'(?m)^\s*(\d)\.\s+([A-Za-z &/]+?)\s*\((\d+)\s*s\.h\.')
_CK_CODE = re.compile(r'\b([A-Z]{2,4})\s+(\d{3})[A-Z]?\b')


def _codes_in(s: str) -> list[str]:
    # de-duped, order preserved
    return list(dict.fromkeys(f"{m.group(1)} {m.group(2)}" for m in _CK_CODE.finditer(s)))


def _parse_checklist(text: str) -> dict:
    out = {"program": None, "calendarYear": None, "totalCredits": None, "sections": []}

    pm = re.search(r'([A-Z][A-Za-z ]+?)\s+MAJOR CHECKLIST\s*\((\d+)\s*s\.h', text)
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

    return out


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

    parsed = _parse_checklist("\n".join(_extract_pages(reader)))

    if not any(s["key"] in ("major", "ancillary") for s in parsed["sections"]):
        raise HTTPException(status_code=422, detail="Couldn't find requirement sections in this PDF")

    return parsed
