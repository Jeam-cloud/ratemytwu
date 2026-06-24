import re
from uuid import UUID
from sqlalchemy import select, func
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user_id
from database import db_dependency
from models import Reviews, Courses
from schema import ReviewsBase, CreatedReviewsOut, UpdateReviewIn

from typing import Annotated

router = APIRouter(prefix="/professor", tags=["review"])

current_user = Annotated[str, Depends(get_current_user_id)]

# accepted letter grades (F through A+)
VALID_GRADES = {"A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"}
COURSE_CODE_RE = re.compile(r"^([A-Z]{2,4})\s*(\d{3}[A-Z]?)$")


# creates a review
@router.post("/{professor_id}/review", response_model=CreatedReviewsOut, status_code=201)
async def create_review(professor_id: int, db: db_dependency, user_id: current_user, reviews: ReviewsBase):

    # ── validate course code: correct format + must be a real course ──
    code = (reviews.course_code or "").strip().upper()
    match = COURSE_CODE_RE.match(code)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid course code. Use a format like CMPT 166.")
    code = f"{match.group(1)} {match.group(2)}"  # normalize spacing

    course = db.execute(
        select(Courses).where(func.replace(Courses.code, " ", "") == code.replace(" ", ""))
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail=f"Course {code} doesn't exist.")

    # ── validate grade (if provided) ──
    grade = (reviews.grade_received or "").strip().upper()
    if grade and grade not in VALID_GRADES:
        raise HTTPException(status_code=400, detail="Invalid grade. Use F through A+.")

    new_review = Reviews(
        # identifiers
        user_id=user_id,
        professor_id=professor_id,
        course_code=code,
        
        # professor-specific
        rating=reviews.rating,
        difficulty=reviews.difficulty,
        take_again=reviews.take_again,
        grading_fairness=reviews.grading_fairness,
        niceness=reviews.niceness,
        experience=reviews.experience,
        lecture_quality=reviews.lecture_quality,
        office_hours=reviews.office_hours,
        extension_policy=reviews.extension_policy,

        #course-specifi
        group_work=reviews.group_work,
        attendance=reviews.attendance,
        exam_format=reviews.exam_format,
        textbook_required=reviews.textbook_required,
        extra_credit=reviews.extra_credit,

        # written by user
        review=reviews.review,
        grade_received=grade or None,
        tips=reviews.tips,


    )

    db.add(new_review)
    db.commit()
    db.refresh(new_review)

    return new_review


# updates a review
@router.patch("/review/{review_id}", response_model=CreatedReviewsOut)
async def update_review(review_id: UUID, db: db_dependency, user_id: current_user, body: UpdateReviewIn):
    review = db.execute(
        select(Reviews).where(Reviews.id == review_id, Reviews.user_id == user_id)
    ).scalars().first()

    if review is None:
        raise HTTPException(status_code=404, detail="review not found")

    if body.grade_received is not None:
        grade = body.grade_received.strip().upper()
        if grade and grade not in VALID_GRADES:
            raise HTTPException(status_code=400, detail="Invalid grade.")
        review.grade_received = grade or None

    for field in ["rating", "difficulty", "take_again", "review", "tips",
                  "extension_policy", "group_work", "attendance", "exam_format",
                  "niceness", "experience", "grading_fairness", "lecture_quality",
                  "textbook_required", "extra_credit", "office_hours"]:
        val = getattr(body, field)
        if val is not None:
            setattr(review, field, val)

    db.commit()
    db.refresh(review)
    return review


# deletes a review
@router.delete("/review/{review_id}")
async def delete_review(review_id: UUID, db: db_dependency, user_id: current_user):
    specific_review = db.execute(
        select(Reviews).where(Reviews.id == review_id, Reviews.user_id == user_id)
    ).scalars().first()
    
    if specific_review is None:
        raise HTTPException(status_code=404, detail="review not found")
    db.delete(specific_review)
    db.commit()

    return None