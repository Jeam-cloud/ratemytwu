"""
rollback.py — RateMyTWU semester rollback

Removes all ProfessorCourse links for a given semester, then cleans up
any professors (with no reviews) and courses that have no remaining links.

Usage:
    cd backend
    python rollback.py --semester SP2027
"""

import argparse
import sys

sys.path.insert(0, ".")
from database import SessionLocal
from models import Professor, Courses, ProfessorCourse, Reviews


def rollback(semester: str) -> None:
    db = SessionLocal()
    try:
        # 1. Find all links for this semester
        links = db.query(ProfessorCourse).filter(
            ProfessorCourse.semester == semester
        ).all()

        if not links:
            print(f"No records found for semester '{semester}'. Nothing to do.")
            return

        print(f"Found {len(links)} ProfessorCourse links for {semester}.")

        # Collect professor and course IDs before deleting
        prof_ids = {link.professor_id for link in links}
        course_ids = {link.course_id for link in links}

        # 2. Delete all links for this semester
        deleted_links = db.query(ProfessorCourse).filter(
            ProfessorCourse.semester == semester
        ).delete()
        db.flush()
        print(f"Deleted {deleted_links} ProfessorCourse links.")

        # 3. Remove orphaned professors (no remaining links, no reviews)
        deleted_profs = 0
        for prof_id in prof_ids:
            remaining_links = db.query(ProfessorCourse).filter(
                ProfessorCourse.professor_id == prof_id
            ).count()
            has_reviews = db.query(Reviews).filter(
                Reviews.professor_id == prof_id
            ).count()
            if remaining_links == 0 and has_reviews == 0:
                db.query(Professor).filter(Professor.id == prof_id).delete()
                deleted_profs += 1
        db.flush()
        print(f"Deleted {deleted_profs} orphaned professors (no links, no reviews).")

        # 4. Remove orphaned courses (no remaining links)
        deleted_courses = 0
        for course_id in course_ids:
            remaining_links = db.query(ProfessorCourse).filter(
                ProfessorCourse.course_id == course_id
            ).count()
            if remaining_links == 0:
                db.query(Courses).filter(Courses.id == course_id).delete()
                deleted_courses += 1
        db.flush()
        print(f"Deleted {deleted_courses} orphaned courses (no links).")

        db.commit()
        print(f"\n✓ Rollback complete for semester={semester}")

    except Exception as e:
        db.rollback()
        print(f"✗ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Roll back a semester import")
    parser.add_argument("--semester", required=True, help="Semester label e.g. SP2027")
    args = parser.parse_args()

    confirm = input(f"This will delete all data for '{args.semester}'. Type YES to confirm: ")
    if confirm.strip() != "YES":
        print("Aborted.")
        sys.exit(0)

    rollback(args.semester)
