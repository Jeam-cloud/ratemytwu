from database import Base
from sqlalchemy import Integer, String, Float, ForeignKey, func, DateTime, UniqueConstraint, Boolean
from sqlalchemy.orm import Mapped, relationship, mapped_column

from datetime import datetime
from sqlalchemy.dialects.postgresql import UUID
import uuid


class Professor(Base):
    __tablename__ = "professor"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[str] = mapped_column(String, nullable=False)

    # Set when a verified professor takedown request is approved. Hidden
    # professors (and their reviews) drop off every public list/detail page,
    # same pattern as Reviews.is_hidden.
    is_hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    hidden_reason: Mapped[str | None] = mapped_column(String, nullable=True)

    reviews = relationship("Reviews", back_populates="professor")
    courses = relationship("ProfessorCourse", back_populates="professor")


class Courses(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[str] = mapped_column(String, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=True)

    professors = relationship("ProfessorCourse", back_populates="course")



class Reviews(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4)
    course_code: Mapped[str] = mapped_column(String, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    take_again: Mapped[Float] = mapped_column(Float, nullable=False)
    review: Mapped[str] = mapped_column(String, nullable=False)

    # additional reviews
    extension_policy: Mapped[str] = mapped_column(String, nullable=False)
    group_work: Mapped[str] = mapped_column(String, nullable=False)
    attendance: Mapped[str] = mapped_column(String, nullable=False)
    exam_format: Mapped[str] = mapped_column(String, nullable=False)
    grading_fairness: Mapped[str] = mapped_column(String, nullable=False)
    niceness: Mapped[str] = mapped_column(String, nullable=False)
    experience: Mapped[str] = mapped_column(String, nullable=False)
    lecture_quality: Mapped[str] = mapped_column(String, nullable=False)
    textbook_required: Mapped[str] = mapped_column(String, nullable=False)
    grade_received: Mapped[str] = mapped_column(String, nullable=False)
    extra_credit: Mapped[str] = mapped_column(String, nullable=False)
    office_hours: Mapped[str] = mapped_column(String, nullable=False)
    tips: Mapped[str] = mapped_column(String, nullable=True)


    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Moderation: a review can be auto-hidden (pending admin review) or
    # removed following a report. Hidden reviews stay in the DB (for the
    # audit trail / ToS record-keeping) but are excluded from public reads.
    is_hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    hidden_reason: Mapped[str | None] = mapped_column(String, nullable=True)

    professor_id: Mapped[int] = mapped_column( ForeignKey("professor.id"), nullable=False, index=True)
    professor = relationship("Professor", back_populates="reviews")


class ProfessorCourse(Base):
    __tablename__ = "professor_course"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)

    professor_id: Mapped[int] = mapped_column(Integer, ForeignKey("professor.id"), nullable=False)
    course_id: Mapped[int] = mapped_column(Integer, ForeignKey("courses.id"), nullable=False)
    semester: Mapped[str] = mapped_column(String, nullable=False)



    professor = relationship("Professor", back_populates="courses")
    course = relationship("Courses", back_populates="professors")


class UserBookmarkCourse(Base):
    __tablename__ = "user_bookmarks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(Integer, ForeignKey("courses.id"), nullable=False)

    courses = relationship("Courses")


class UserPlannerSettings(Base):
    __tablename__ = "user_planner_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    years: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    start_year: Mapped[int] = mapped_column(Integer, nullable=False, default=2024)
    start_term: Mapped[str] = mapped_column(String, nullable=False, default="Fall")


class ReviewFlag(Base):
    __tablename__ = "review_flags"
    __table_args__ = (
        UniqueConstraint("review_id", "reporter_user_id", name="uq_flag_per_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)

    # Nullable on purpose: when a professor is permanently deleted (takedown
    # "Delete permanently"), their reviews are deleted too. Rather than
    # deleting flags on those reviews too (which would erase moderation
    # history), review_id gets nulled and the *_snapshot columns below
    # capture what the flag was actually about, so the audit trail survives
    # the review itself being gone.
    review_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("reviews.id"), nullable=True, index=True)
    reporter_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    other_text: Mapped[str | None] = mapped_column(String(30), nullable=True)
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Moderation queue state. "pending" until an operator makes a call;
    # this is the audit trail the ToS's report-response timelines depend on.
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending", server_default="pending")
    resolution: Mapped[str | None] = mapped_column(String, nullable=True)  # "removed" | "kept"
    resolution_note: Mapped[str | None] = mapped_column(String, nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Snapshot taken at the moment review_id is nulled out by a professor
    # deletion - only ever populated in that one case.
    review_text_snapshot: Mapped[str | None] = mapped_column(String, nullable=True)
    professor_name_snapshot: Mapped[str | None] = mapped_column(String, nullable=True)
    course_code_snapshot: Mapped[str | None] = mapped_column(String, nullable=True)


class SiteReport(Base):
    """
    General-purpose reports that AREN'T about a specific flagged review
    (that's ReviewFlag, kept separate on purpose - see ReportPage). Covers
    three categories submitted from the public Report page:
      - "wrong_info"          : a professor/course detail is inaccurate
      - "professor_takedown"  : a professor requesting their profile removed
      - "bug"                 : something on the site is broken
    "Inappropriate review" is NOT a category here - that's handled entirely
    by the existing review-flag button on the review itself.
    """
    __tablename__ = "site_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # who to follow up with - not a required site account, since a professor
    # filing a takedown request isn't necessarily a logged-in user
    contact_email: Mapped[str] = mapped_column(String, nullable=False)
    submitted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)

    # optional linkage so wrong_info / professor_takedown reports can point
    # at a specific professor without free-typing a name
    professor_id: Mapped[int | None] = mapped_column(ForeignKey("professor.id"), nullable=True, index=True)
    course_code: Mapped[str | None] = mapped_column(String, nullable=True)

    description: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # same pending -> resolved shape as ReviewFlag, kept in its own table so
    # the two queues never mix
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending", server_default="pending")
    resolution: Mapped[str | None] = mapped_column(String, nullable=True)  # "approved" | "dismissed"
    resolution_note: Mapped[str | None] = mapped_column(String, nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    professor = relationship("Professor")


class UserCourseCard(Base):
    __tablename__ = "course_cards"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(Integer, ForeignKey("courses.id"), nullable=False)

    year: Mapped[int] = mapped_column(Integer, nullable=False)
    term: Mapped[str] = mapped_column(String, nullable=False)
    credits: Mapped[int] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=True)
    grade: Mapped[str] = mapped_column(String, nullable=True)
    notes: Mapped[str] = mapped_column(String, nullable=True)

    course = relationship("Courses")


