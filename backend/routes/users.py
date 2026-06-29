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
# Matches: DEPT NNN [Title...] GRADE S.Hrs. E.Hrs. QualPts
# Uses greedy .+ so it finds the LAST valid grade token before the numbers.
_GRADES = r'IP|A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|P|W'
_COURSE_RE = re.compile(
    rf'^([A-Z]{{2,5}}\s+\d{{3}}[A-Z]?)\s+.+\s+({_GRADES})\s+(\d+\.\d+)\s+\d+\.\d+\s+\d+\.\d+\s*$'
)
_TERM_RE = re.compile(r'(\d{4})\s+(Spring|Summer|Fall)')


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

    courses = []
    current_year = None
    current_term = None

    for page in reader.pages:
        text = page.extract_text() or ""
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue

            # Detect term header anywhere in the line (e.g. "2024 Spring")
            tm = _TERM_RE.search(line)
            if tm and len(line) < 30:
                current_year = int(tm.group(1))
                current_term = tm.group(2)
                continue

            # Only parse course lines while inside a known term
            if current_year is None or current_term is None:
                continue

            cm = _COURSE_RE.match(line)
            if not cm:
                continue

            raw_code = cm.group(1)
            grade_raw = cm.group(2)
            credits = float(cm.group(3))

            # Skip 0-credit entries (tutorials, SKLS pass/fail sections)
            if credits == 0.0:
                continue

            # Normalise code spacing: "CMPT  140" → "CMPT 140"
            course_code = re.sub(r'\s+', ' ', raw_code.strip())

            # Map grade → status
            if grade_raw == 'IP':
                status = 'In Progress'
                grade = None
            elif grade_raw == 'P':
                status = 'Completed'
                grade = None
            else:
                status = 'Completed'
                grade = grade_raw

            courses.append({
                'course_code': course_code,
                'calendar_year': current_year,
                'term': current_term,
                'grade': grade,
                'credits': int(credits),
                'status': status,
            })

    return courses
