from sqlalchemy import select, func, Numeric, cast
from fastapi import Depends, APIRouter, HTTPException, status

from models import Professor, Reviews, ProfessorCourse
from database import db_dependency
from auth import get_current_user_id
from schema import ProfessorBase, ProfessorsOut, ProfessorCoursesOut, ProfessorDetailOut

from datetime import datetime, timezone
from typing import Annotated

router = APIRouter(prefix="/professor", tags=["professor"])

current_user = Annotated[str, Depends(get_current_user_id)]


# search up specific professor
@router.get("/", response_model=list[ProfessorsOut])
def get_professor(search_professor: str, db: db_dependency):

    query =search_professor.strip()
    if len(query) < 2:
        return []
    
    professor = db.execute(
        select(
            Professor.id,
            Professor.name,
            Professor.department,
            func.round(cast(func.avg(Reviews.rating), Numeric), 2).label("average_rating"),
            func.round(cast(func.avg(Reviews.difficulty), Numeric), 2).label("average_difficulty"),
            func.count(Reviews.id).label("review_count")
            )
            .outerjoin(Reviews, Reviews.professor_id == Professor.id)
            .where(Professor.name.ilike(f"%{query}%"))
            .group_by(Professor.id, Professor.name, Professor.department)
    ).all()
    
    professor_list = []

    for p in professor:
        professor_list.append({
            "id": p.id,
            "name": p.name,
            "department": p.department,
            "average_rating": p.average_rating,
            "average_difficulty": p.average_difficulty,
            "review_count": p.review_count
        })
    return professor_list


# returns all ratings/reviews of professor in specific professor page
@router.get("/{professor_id}/everything", response_model=ProfessorDetailOut)
def get_everything(professor_id: int, db: db_dependency):

    professor = db.execute(
        select(Professor).where(Professor.id == professor_id)
    ).scalars().first()

    if not professor:
        raise HTTPException(status_code=404, detail="professor not found")

    average_reviews = db.execute(
        select(
            func.round(cast(func.avg(Reviews.rating), Numeric), 2),
            func.round(cast(func.avg(Reviews.difficulty), Numeric), 2),
            func.round(cast(func.avg(Reviews.take_again), Numeric), 2)
        ).where(Reviews.professor_id == professor_id)
    ).first()

    reviews = db.execute(
        select(Reviews).where(Reviews.professor_id == professor_id)
    ).scalars().all()


    review_list = []
    for r in reviews:
        review_list.append({
            "id": r.id,
            "user_id": r.user_id,
            "course_code": r.course_code,
            "rating": r.rating,
            "difficulty": r.difficulty,
            "take_again": r.take_again,
            "review": r.review,
            "created_at": r.created_at,
            "extension_policy": r.extension_policy,
            "group_work": r.group_work,
            "attendance": r.attendance,
            "exam_format": r.exam_format,
            "grading_fairness": r.grading_fairness,
            "lecture_quality": r.lecture_quality,
            "textbook_required": r.textbook_required,
            "grade_received": r.grade_received,
            "extra_credit": r.extra_credit,
            "office_hours": r.office_hours,
            "tips": r.tips,
        })

    return {
        "name": professor.name,
        "department": professor.department,
        "average_rating": average_reviews[0],
        "average_difficulty": average_reviews[1],
        "average_take_again": average_reviews[2],

        "reviews": review_list

    }

# return all current courses that this specific professor is teaching
@router.get("/{professor_id}/courses", response_model=list[ProfessorCoursesOut])
def get_professor_courses(professor_id: int, db: db_dependency):

    professor = db.execute(
        select(Professor).where(Professor.id == professor_id)
    ).scalars().first()
    if not professor:
        raise HTTPException(status_code=404, detail="professor not found")


    professor_to_course = db.execute(
        select(ProfessorCourse).where(ProfessorCourse.professor_id == professor_id)
    ).scalars().all()

    professor_to_course_list = []

    for pc in professor_to_course:
        course = {
            "id": pc.course.id,
            "code": pc.course.code,
            "department": pc.course.department
        }

        professor_to_course_list.append(course)
    
    return professor_to_course_list


# adds professor manually for testing data - delete later
@router.post("")
async def create_professor(professor: ProfessorBase, db: db_dependency):
    new_professor = Professor(
        name=professor.name.lower(),
        department=professor.department
    )

    db.add(new_professor)
    db.commit()
    db.refresh(new_professor)

    return new_professor

