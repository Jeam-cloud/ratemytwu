from database import Base
from sqlalchemy import Integer, String, Float, ForeignKey, func, DateTime
from sqlalchemy.orm import Mapped, relationship, mapped_column

from datetime import datetime
from sqlalchemy.dialects.postgresql import UUID
import uuid


class Professor(Base):
    __tablename__ = "professor"
 
    id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[str] = mapped_column(String, nullable=False)

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
    lecture_quality: Mapped[str] = mapped_column(String, nullable=False)
    textbook_required: Mapped[str] = mapped_column(String, nullable=False)
    grade_received: Mapped[str] = mapped_column(String, nullable=False)
    extra_credit: Mapped[str] = mapped_column(String, nullable=False)
    office_hours: Mapped[str] = mapped_column(String, nullable=False)
    tips: Mapped[str] = mapped_column(String, nullable=True)


    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

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