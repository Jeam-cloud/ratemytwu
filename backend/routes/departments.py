from sqlalchemy import select, func, Numeric, cast
from fastapi import APIRouter

from models import Professor, Courses, Reviews, ProfessorCourse
from database import db_dependency

def format_name(name: str) -> str:
    if not name:
        return ""
    return " ".join(word.capitalize() for word in name.strip().split())
from schema import DepartmentsOut, ProfessorsOut, CourseSearchOut


router = APIRouter(prefix="/department", tags=["department"])

# returns the department and count for professors
@router.get("", response_model=list[DepartmentsOut])
def get_departments(db: db_dependency):

    department_by_professor = db.execute(
        select(Professor.department, func.count(Professor.id)).group_by(Professor.department)
    ).all()

    professor_department_list = []

    for dept, count in department_by_professor:
        professor_department_list.append(
            {"department": dept, "professor_count": count}
        )
    
    return professor_department_list

# return all professors in that specific department
@router.get("/{department_name}/professors", response_model=list[ProfessorsOut])
def get_department_professors(department_name: str, db: db_dependency):
 
    professors = db.execute(
        select(
            Professor.id,
            Professor.name,
            Professor.department,
            func.round(cast(func.avg(Reviews.rating), Numeric), 2).label("average_rating"),
            func.round(cast(func.avg(Reviews.difficulty), Numeric), 2).label("average_difficulty"),
            func.round(cast(func.avg(Reviews.take_again), Numeric), 2).label("average_take_again"),
            func.count(Reviews.id).label("review_count")
        )
        .outerjoin(Reviews, Reviews.professor_id == Professor.id)
        .where(Professor.department.contains(department_name))
        .group_by(Professor.id, Professor.name, Professor.department)
    ).all()

    professor_list = []

    for p in professors:
        professor_list.append({
            "id": p.id,
            "name": format_name(p.name),
            "department": p.department,
            "average_rating": p.average_rating,
            "average_difficulty": p.average_difficulty,
            "average_take_again": p.average_take_again,
            "review_count": p.review_count
        })

    return professor_list

# return all courses in that specific department, with a professor count per course
@router.get("/{department_name}/courses", response_model=list[CourseSearchOut])
def get_department_courses(department_name: str, db:db_dependency):

    courses = db.execute(
        select(
            Courses.id,
            Courses.code,
            Courses.department,
            func.count(ProfessorCourse.id).label("professor_count")
        )
        .outerjoin(ProfessorCourse, ProfessorCourse.course_id == Courses.id)
        .where(Courses.department.contains(department_name))
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