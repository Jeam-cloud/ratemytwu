from sqlalchemy import select, func, Numeric, cast
from fastapi import APIRouter, HTTPException

from models import Courses, ProfessorCourse, Professor, Reviews
from database import db_dependency
from schema import CoursesBase, CourseSearchOut, CourseProfessorOut, CourseDetailOut


router = APIRouter(prefix="/course", tags=["courses"])

# search up specific courses 
@router.get("/", response_model=list[CourseSearchOut])
def get_courses(search_course: str, db: db_dependency):

    query = search_course.strip()
    if len(query) < 2:
        return []
    
    courses = db.execute(
        select(
            Courses.id,
            Courses.code,
            Courses.department,
            func.count(ProfessorCourse.id).label("professor_count")
            )
            .outerjoin(ProfessorCourse, ProfessorCourse.course_id == Courses.id)
            .where(Courses.code.ilike(f"%{query}%"))
            .group_by(Courses.id, Courses.code, Courses.department)
    ).all()

    course_list = []

    for c in courses:
        course_list.append({
            "id": c.id,
            "code": c.code,
            "department": c.department,
            "professor_count": c.professor_count
        })

    return course_list


# each clickable course returns the course info plus all professors teaching it
@router.get("/{course_id}", response_model=CourseDetailOut)
def get_course_taught(course_id: int, db: db_dependency):

    course = db.execute(
        select(Courses).where(Courses.id == course_id)
    ).scalars().first()

    if not course:
        raise HTTPException(status_code=404, detail="courses not found")

    professor_course = db.execute(
        select(
            Professor.id,
            Professor.name,
            Professor.department,
            func.round(cast(func.avg(Reviews.rating), Numeric), 2).label("average_rating"),
            func.round(cast(func.avg(Reviews.difficulty), Numeric), 2).label("average_difficulty"),
            func.count(Reviews.id).label("review_count")
        )
        .join(ProfessorCourse, ProfessorCourse.professor_id == Professor.id)
        .outerjoin(Reviews, Reviews.professor_id == Professor.id)
        .where(ProfessorCourse.course_id == course_id)
        .group_by(Professor.id, Professor.name, Professor.department)
    ).all()

    course_to_professor_list = []

    for pc in professor_course:
        professor = {
            "id": pc.id,
            "name": pc.name,
            "department": pc.department,
            "average_rating": pc.average_rating,
            "average_difficulty": pc.average_difficulty,
            "review_count": pc.review_count
        }

        course_to_professor_list.append(professor)

    return {
        "code": course.code,
        "department": course.department,
        "professors": course_to_professor_list
    }

# add course manually for testing data - delete later
@router.post("/course")
def create_course(course: CoursesBase, db: db_dependency):
    new_course = Courses(code=course.code)
    db.add(new_course)
    db.commit()
    db.refresh(new_course)
    
    return new_course