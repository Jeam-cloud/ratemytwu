from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from uuid import UUID


# professor input schemas
class ProfessorBase(BaseModel):
    name : str
    department : str

class ReviewsBase(BaseModel):
    course_code: str
    rating: int
    difficulty: int
    take_again: float
    review: str
    extension_policy: str
    group_work: str
    attendance: str
    exam_format: str
    grading_fairness: str
    lecture_quality: str
    textbook_required: str
    grade_received: str
    extra_credit: str
    office_hours: str
    tips: Optional[str] = None

class CoursesBase(BaseModel):
    code: str



# professor output schemas

class ProfessorsOut(BaseModel):
    id: int
    name: str
    department: str
    average_rating: float | None
    average_difficulty: float | None
    review_count: int

    model_config = {"from_attributes": True}


class ReviewsOut(BaseModel):
    id: UUID
    user_id: UUID
    course_code: str
    rating: int
    difficulty: int
    take_again: float
    review: str
    created_at: datetime
    extension_policy: Optional[str] = None
    group_work: Optional[str] = None
    attendance: Optional[str] = None
    exam_format: Optional[str] = None
    grading_fairness: Optional[str] = None
    lecture_quality: Optional[str] = None
    textbook_required: Optional[str] = None
    grade_received: Optional[str] = None
    extra_credit: Optional[str] = None
    office_hours: Optional[str] = None
    tips: Optional[str] = None

class ProfessorDetailOut(BaseModel):
    name: str
    department: str
    average_rating: Optional[float]
    average_difficulty: Optional[float]
    average_take_again: Optional[float]

    reviews: list[ReviewsOut]


class ProfessorCoursesOut(BaseModel):
    id: int
    code: str
    department: str


# Reviews output schemas

class CreatedReviewsOut(BaseModel):
    id: UUID
    course_code: str
    rating: int
    difficulty: int
    take_again: float
    review: str
    created_at: datetime
    user_id: UUID
    professor_id: int
    extension_policy: Optional[str] = None
    group_work: Optional[str] = None
    attendance: Optional[str] = None
    exam_format: Optional[str] = None
    grading_fairness: Optional[str] = None
    lecture_quality: Optional[str] = None
    textbook_required: Optional[str] = None
    grade_received: Optional[str] = None
    extra_credit: Optional[str] = None
    office_hours: Optional[str] = None
    tips: Optional[str] = None

    model_config = {"from_attributes": True}

# Courses output schemas

class CoursesOut(BaseModel):
    id: int
    code: str
    department: str
    model_config = {"from_attributes": True}

class CourseSearchOut(BaseModel):
    id: int
    code: str
    department: str
    professor_count: int
    model_config = {"from_attributes": True}

class CourseProfessorOut(BaseModel):
    id: int
    name: str
    department: str
    average_rating: float | None
    review_count: int

    model_config = {"from_attributes": True}
    

# Department output schemas
class DepartmentsOut(BaseModel):
    department: str
    professor_count: int


# Bookmark output schemas
class BookmarksOut(BaseModel):
    id: int
    user_id: UUID
    course_id:  int

    model_config = {"from_attributes": True}


# Kanban output and input schemas
class CardsOut(BaseModel):
    id: int
    course_id: int
    year: int
    term: str
    code: str
    credits: Optional[int]
    status: Optional[str]
    grade: Optional[str]
    notes: Optional[str]

class CreateCardsIn(BaseModel):
    year: int
    term: str
    credits: Optional[int] = None
    status: Optional[str] = None
    grade: Optional[str] = None
    notes: Optional[str] = None

class CreateCardsOut(BaseModel):
    id: int
    course_id: int
    year: int
    term: str
    code: str
    credits: Optional[int]
    status: Optional[str]
    grade: Optional[str]
    notes: Optional[str]