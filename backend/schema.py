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
    credits: Optional[int] = None
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


# Transcript import schemas
class ImportCardIn(BaseModel):
    course_code: str
    year: int
    term: str
    credits: Optional[int] = None
    status: Optional[str] = None
    grade: Optional[str] = None


# Review flag schemas
VALID_FLAG_REASONS = {"Inappropriate", "Fake review", "Personal attack", "Wrong info", "Other"}

class ReviewFlagIn(BaseModel):
    reason: str
    other_text: str | None = None

    @field_validator("reason")
    @classmethod
    def reason_valid(cls, v):
        if v not in VALID_FLAG_REASONS:
            raise ValueError(f"Invalid reason. Must be one of: {', '.join(sorted(VALID_FLAG_REASONS))}")
        return v

    @field_validator("other_text")
    @classmethod
    def other_text_valid(cls, v):
        if v is not None and len(v) > 30:
            raise ValueError("other_text must be 30 characters or fewer")
        return v or None

class ReviewFlagOut(BaseModel):
    id: int
    review_id: UUID
    reason: str
    other_text: str | None = None
    reported_at: datetime
    status: str

    model_config = {"from_attributes": True}


# Admin / moderation queue schemas

class AdminFlagOut(BaseModel):
    id: int
    # Nullable: a professor's reviews may have been permanently deleted
    # (takedown "Delete permanently"), which nulls review_id on any flags
    # that pointed at them. The flag row itself survives for the audit
    # trail - see review_text/professor_name/course_code below, which fall
    # back to a point-in-time snapshot taken right before deletion.
    review_id: UUID | None = None
    reason: str
    other_text: str | None = None
    reported_at: datetime
    status: str
    resolution: str | None = None
    resolution_note: str | None = None
    resolved_at: datetime | None = None

    # denormalized context so the operator doesn't need a second request
    # to see what's actually being reported - live values when the review
    # still exists, snapshot values when it's since been deleted
    review_text: str | None = None
    review_is_hidden: bool = True
    professor_id: int | None = None
    professor_name: str | None = None
    course_code: str | None = None

    model_config = {"from_attributes": True}


VALID_RESOLUTIONS = {"removed", "kept"}


class AdminStatsOut(BaseModel):
    pending_flags: int
    resolved_last_7_days: int
    removed_last_7_days: int
    hidden_reviews: int
    total_reviews: int
    total_professors: int
    total_courses: int
    oldest_pending_reported_at: Optional[datetime] = None
    pending_site_reports: int = 0
    pending_professor_takedowns: int = 0


class ResolveFlagIn(BaseModel):
    resolution: str
    note: str | None = None

    @field_validator("resolution")
    @classmethod
    def resolution_valid(cls, v):
        if v not in VALID_RESOLUTIONS:
            raise ValueError(f"resolution must be one of: {', '.join(sorted(VALID_RESOLUTIONS))}")
        return v

    @field_validator("note")
    @classmethod
    def note_length(cls, v):
        if v is not None and len(v) > 500:
            raise ValueError("note must be 500 characters or fewer")
        return v


# Site report schemas — the public Report page's three real categories.
# "Inappropriate review" is intentionally NOT here; that's the existing
# ReviewFlag flow on the review itself, kept fully separate.

VALID_REPORT_CATEGORIES = {"wrong_info", "professor_takedown", "bug"}
# "deleted" is only meaningful for professor_takedown - it permanently erases
# the professor and their reviews rather than just hiding them. Kept as its
# own resolution value (not a flag on "approved") so the audit trail records
# which of the two the operator actually chose.
VALID_REPORT_RESOLUTIONS = {"approved", "dismissed", "deleted"}


class SiteReportIn(BaseModel):
    category: str
    contact_email: str
    professor_id: int | None = None
    course_code: str | None = None
    description: str

    @field_validator("category")
    @classmethod
    def category_valid(cls, v):
        if v not in VALID_REPORT_CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(sorted(VALID_REPORT_CATEGORIES))}")
        return v

    @field_validator("contact_email")
    @classmethod
    def email_valid(cls, v):
        v = v.strip()
        if "@" not in v or "." not in v.split("@")[-1] or len(v) > 254:
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("description")
    @classmethod
    def description_valid(cls, v):
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Please provide a bit more detail (10+ characters)")
        if len(v) > 2000:
            raise ValueError("description must be 2000 characters or fewer")
        return v


# Hidden professors listing - the "restore" side of the takedown flow.
# Only professors with is_hidden=True show up here; nothing about a
# permanently deleted professor appears anywhere, since that's not reversible.
class AdminHiddenProfessorOut(BaseModel):
    id: int
    name: str
    department: str
    hidden_reason: str | None = None
    review_count: int

    model_config = {"from_attributes": True}


class SiteReportOut(BaseModel):
    id: int
    category: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminSiteReportOut(BaseModel):
    id: int
    category: str
    contact_email: str
    professor_id: int | None = None
    professor_name: str | None = None
    course_code: str | None = None
    description: str
    created_at: datetime
    status: str
    resolution: str | None = None
    resolution_note: str | None = None
    resolved_at: datetime | None = None

    model_config = {"from_attributes": True}


class ResolveSiteReportIn(BaseModel):
    resolution: str
    note: str | None = None

    @field_validator("resolution")
    @classmethod
    def resolution_valid(cls, v):
        if v not in VALID_REPORT_RESOLUTIONS:
            raise ValueError(f"resolution must be one of: {', '.join(sorted(VALID_REPORT_RESOLUTIONS))}")
        return v

    @field_validator("note")
    @classmethod
    def note_length(cls, v):
        if v is not None and len(v) > 500:
            raise ValueError("note must be 500 characters or fewer")
        return v
