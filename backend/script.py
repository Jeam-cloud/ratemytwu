"""
script.py — RateMyTWU timetable scraper

Parses a TWU timetable PDF and inserts professors, courses, and
professor-course links into the database. Safe to re-run: no duplicates.

Usage:
    cd backend
    python script.py --pdf Fall2026_Timetable.pdf --semester FA2026
"""

import re
import argparse
import sys

# ── DB setup ──────────────────────────────────────────────────────────────────
sys.path.insert(0, ".")
from database import SessionLocal, engine, Base
from models import Professor, Courses, ProfessorCourse
Base.metadata.create_all(bind=engine)


# ── Regexes ───────────────────────────────────────────────────────────────────

COURSE_RE = re.compile(r"^([A-Z]{2,5})\s{1,4}(\d{3,4})\s*$")
SECTION_RE = re.compile(r"^Sec\.\s+(?:Lab\s+)?(\S+)")
DATE_RANGE_RE = re.compile(r"^\d{1,2}/\d{1,2}/\d{4}")
SEM_HR_RE = re.compile(r"^Sem\.\s*Hr\.\s*([\d.]+)")
DAYS_RE = re.compile(r"^[MTWRFS]{1,5}$")
TIME_RE = re.compile(r"^\d{1,2}:\d{2}\s*(AM|PM)$")

NOISE_PREFIXES = (
    "please note:", "crosslisted:", "instruction method:",
    "ol -", "f2f -",
    "page ", "trinity western university", "fee: $",
    "fa 2026", "su 2026", "sp 2027", "fa 2027", "su 2027",
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def is_noise(line: str) -> bool:
    low = line.lower().strip()
    if not low:
        return True
    for prefix in NOISE_PREFIXES:
        if low.startswith(prefix):
            return True
    return False


def is_ignorable(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if is_noise(s):
        return True
    if DAYS_RE.match(s):
        return True
    if TIME_RE.match(s):
        return True
    if s == "-":
        return True
    return False


def is_name(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if stripped.lower() in ("tba", "-"):
        return False
    if not stripped[0].isupper():
        return False
    if any(ch.isdigit() for ch in stripped):
        return False
    if is_noise(stripped):
        return False
    if SECTION_RE.match(stripped):
        return False
    if COURSE_RE.match(stripped):
        return False
    if SEM_HR_RE.match(stripped):
        return False
    if DATE_RANGE_RE.match(stripped):
        return False
    if DAYS_RE.match(stripped):
        return False
    if TIME_RE.match(stripped):
        return False
    return True


def next_meaningful(lines: list[str], start: int) -> tuple[int, str]:
    """Return (index, stripped_line) of the next non-ignorable, non-header line."""
    j = start
    while j < len(lines):
        s = lines[j].strip()
        if s and not is_ignorable(s) and s.lower() != "trinity western university":
            return j, s
        j += 1
    return j, ""


# ── PDF reader ────────────────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_path: str) -> list[str]:
    from pypdf import PdfReader
    reader = PdfReader(pdf_path)
    lines = []
    for page in reader.pages:
        text = page.extract_text() or ""
        for line in text.splitlines():
            lines.append(line)
    return lines


# ── Parser ────────────────────────────────────────────────────────────────────

def parse_timetable(lines: list[str]) -> list[tuple[str, str, str, int | None]]:
    """
    Parse timetable lines into (course_code, department, professor_name, credits) tuples.

    Handles the multi-line-per-field format used in FA2026 PDFs where:
    - Each field (course code, name, time, date) is on its own line
    - Professor names may be split across two lines with a trailing space or hyphen
    """
    results: list[tuple[str, str, str, int | None]] = []
    seen: set[tuple[str, str]] = set()

    current_dept = "Unknown"
    current_course_code: str | None = None
    current_credits: int | None = None
    in_lab_section = False

    i = 0
    while i < len(lines):
        stripped = lines[i].strip()

        # skip blank, noise, day tokens, time tokens, page headers
        if is_ignorable(stripped) or stripped.lower() == "trinity western university":
            i += 1
            continue

        # ── Course header: "ANTH  101  " ────────────────────────────────────
        m = COURSE_RE.match(stripped)
        if m:
            current_course_code = f"{m.group(1)} {m.group(2)}"
            current_credits = None
            in_lab_section = False
            i += 1
            continue

        # ── Sem. Hr. line — capture credits ──────────────────────────────────
        m_hr = SEM_HR_RE.match(stripped)
        if m_hr:
            try:
                current_credits = int(float(m_hr.group(1)))
            except (ValueError, TypeError):
                current_credits = None
            i += 1
            continue

        # ── Section line ─────────────────────────────────────────────────────
        if SECTION_RE.match(stripped):
            in_lab_section = bool(re.match(r"^Sec\.\s+Lab\b", stripped))
            i += 1
            continue

        # ── Date range — professor name follows ──────────────────────────────
        if DATE_RANGE_RE.match(stripped):
            if stripped.endswith("-") or stripped.endswith("- "):
                # end date wrapped to next line — skip it
                i += 1
                while i < len(lines) and not lines[i].strip():
                    i += 1
                i += 1  # skip the end date line
            else:
                i += 1

            # advance to name line
            while i < len(lines) and not lines[i].strip():
                i += 1

            if i < len(lines):
                name_raw = lines[i]  # keep raw to detect trailing space/hyphen
                name_candidate = name_raw.strip()
                name_candidate = re.sub(r"\s+Fee:\s*\$.*", "", name_candidate).strip()

                # Split name detection:
                # "Elizabeth " → trailing space means name continues on next line
                # "Lydia Forssander-" → trailing hyphen means name continues
                if name_raw.endswith(' ') or name_raw.rstrip('\n\r').endswith('-'):
                    j = i + 1
                    while j < len(lines) and not lines[j].strip():
                        j += 1
                    if j < len(lines):
                        continuation = lines[j].strip()
                        continuation = re.sub(r"\s+Fee:\s*\$.*", "", continuation).strip()
                        if continuation and continuation[0].isupper() and not any(ch.isdigit() for ch in continuation):
                            if name_raw.rstrip('\n\r').endswith('-'):
                                name_candidate = name_candidate + continuation
                            else:
                                name_candidate = name_candidate + " " + continuation
                            i = j  # consume continuation line

                if is_name(name_candidate) and not in_lab_section and current_course_code:
                    key = (current_course_code, name_candidate.lower())
                    if key not in seen:
                        seen.add(key)
                        results.append((current_course_code, current_dept, name_candidate, current_credits))

            i += 1
            continue

        # ── Department heading ───────────────────────────────────────────────
        # Only treat as department if the very next meaningful line is a course code.
        # This prevents surname fragments (e.g. "Zwamborn") from being mistaken
        # for department headings when they happen to precede a course line.
        _, next_line = next_meaningful(lines, i + 1)
        if COURSE_RE.match(next_line):
            current_dept = stripped
            i += 1
            continue

        # anything else — skip
        i += 1

    return results


# ── Database upsert ───────────────────────────────────────────────────────────

def upsert(pdf_path: str, semester: str) -> None:
    print(f"Parsing {pdf_path}...")
    lines = extract_text_from_pdf(pdf_path)
    rows = parse_timetable(lines)
    print(f"Found {len(rows)} (course, professor) pairs. Writing to DB...")

    db = SessionLocal()
    try:
        prof_count = course_count = link_count = 0

        for course_code, department, prof_name, credits in rows:
            norm_name = prof_name.lower().strip()

            prof = db.query(Professor).filter(Professor.name == norm_name).first()
            if not prof:
                prof = Professor(name=norm_name, department=department)
                db.add(prof)
                db.flush()
                prof_count += 1

            course = db.query(Courses).filter(Courses.code == course_code).first()
            if not course:
                course = Courses(code=course_code, department=department, credits=credits)
                db.add(course)
                db.flush()
                course_count += 1
            elif credits is not None and course.credits is None:
                course.credits = credits

            link = db.query(ProfessorCourse).filter(
                ProfessorCourse.professor_id == prof.id,
                ProfessorCourse.course_id == course.id,
                ProfessorCourse.semester == semester,
            ).first()
            if not link:
                link = ProfessorCourse(
                    professor_id=prof.id,
                    course_id=course.id,
                    semester=semester,
                )
                db.add(link)
                link_count += 1

        db.commit()
        print(
            f"\n✓ Done — {prof_count} new professors, "
            f"{course_count} new courses, "
            f"{link_count} new links  (semester={semester})"
        )

    except Exception as e:
        db.rollback()
        print(f"✗ Error: {e}")
        raise
    finally:
        db.close()


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Import a TWU timetable PDF into the RateMyTWU database"
    )
    parser.add_argument("--pdf", required=True, help="Path to timetable PDF")
    parser.add_argument("--semester", required=True, help="Semester label e.g. FA2026")
    args = parser.parse_args()
    upsert(args.pdf, args.semester)