from uuid import UUID
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, status, Response

from auth import get_current_user_id
from database import db_dependency
from models import Reviews
from schema import ReviewsBase, CreatedReviewsOut

from typing import Annotated

router = APIRouter(prefix="/professor", tags=["review"])

current_user = Annotated[str, Depends(get_current_user_id)]


# creates a review
@router.post("/{professor_id}/review", response_model=CreatedReviewsOut, status_code=201)
async def create_review(professor_id: int, db: db_dependency, user_id: current_user, reviews: ReviewsBase):
    new_review = Reviews(
        # identifiers
        user_id=user_id,
        professor_id=professor_id,
        course_code=reviews.course_code,
        
        # professor-specific
        rating=reviews.rating,
        difficulty=reviews.difficulty,
        take_again=reviews.take_again,
        grading_fairness=reviews.grading_fairness,
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
        grade_received=reviews.grade_received,
        tips=reviews.tips,


    )

    db.add(new_review)
    db.commit()
    db.refresh(new_review)

    return new_review


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