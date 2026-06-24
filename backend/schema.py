from pydantic import BaseModel, field_validator
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
    niceness: str
    experience: str
    grading_fairness: str
    lecture_quality: str
    textbook_required: str
    grade_received: str
    extra_credit: str
    office_hours: str
    tips: Optional[str] = None

class UpdateReviewIn(BaseModel):
    rating: Optional[int] = None
    difficulty: Optional[int] = None
    take_again: Optional[float] = None
    grade_received: Optional[str] = None
    review: Optional[str] = None
    tips: Optional[str] = None
    extension_policy: Optional[str] = None
    group_work: Optional[str] = None
    attendance: Optional[str] = None
    exam_format: Optional[str] = None
    niceness: Optional[str] = None
    experience: Optional[str] = None
    grading_fairness: Optional[str] = None
    lecture_quality: Optional[str] = None
    textbook_required: Optional[str] = None
    extra_credit: Optional[str] = None
    office_hours: Optional[str] = None

class CoursesBase(BaseModel):
    code: str



# professor output schemas

class ProfessorsOut(BaseModel):
    id: int
    name: str
    department: str
    average_rating: float | None
    average_difficulty: float | None
    average_take_again: float | None = None
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
    niceness: Optional[str] = None
    experience: Optional[str] = None
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
    niceness: Optional[str] = None
    experience: Optional[str] = None
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
    credits: Optional[int] = None
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
    average_difficulty: float | None
    review_count: int

    model_config = {"from_attributes": True}


class CourseDetailOut(BaseModel):
    code: str
    department: str
    professors: list[CourseProfessorOut]

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


# Planner settings schemas
class PlannerSettingsOut(BaseModel):
    years: int
    start_year: int
    start_term: str = "Fall"
    model_config = {"from_attributes": True}

class PlannerSettingsIn(BaseModel):
    years: int
    start_year: int
    start_term: str = "Fall"


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

VALID_CARD_GRADES = {"A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"}
VALID_CARD_TERMS = {"Fall", "Spring", "Summer"}
VALID_CARD_STATUSES = {"Planned", "In Progress", "Completed"}

class CreateCardsIn(BaseModel):
    year: int
    term: str
    credits: Optional[int] = None
    status: Optional[str] = None
    grade: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("credits")
    @classmethod
    def credits_range(cls, v):
        if v is not None and not (0 <= v <= 4):
            raise ValueError("Credits must be between 0 and 4")
        return v

    @field_validator("grade")
    @classmethod
    def grade_valid(cls, v):
        if v and v not in VALID_CARD_GRADES:
            raise ValueError(f"Invalid grade. Must be one of: {', '.join(sorted(VALID_CARD_GRADES))}")
        return v

    @field_validator("term")
    @classmethod
    def term_valid(cls, v):
        if v not in VALID_CARD_TERMS:
            raise ValueError("Term must be Fall, Spring, or Summer")
        return v

    @field_validator("status")
    @classmethod
    def status_valid(cls, v):
        if v and v not in VALID_CARD_STATUSES:
            raise ValueError("Status must be Planned, In Progress, or Completed")
        return v

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
