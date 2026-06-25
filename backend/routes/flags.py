from uuid import UUID
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated

from auth import get_current_user_id
from database import db_dependency
from models import ReviewFlag, Reviews
from schema import ReviewFlagIn, ReviewFlagOut

router = APIRouter(prefix="/review", tags=["flags"])

current_user = Annotated[str, Depends(get_current_user_id)]


@router.post("/{review_id}/flag", response_model=ReviewFlagOut, status_code=201)
def flag_review(review_id: UUID, body: ReviewFlagIn, db: db_dependency, user_id: current_user):

    # make sure the review exists
    review = db.execute(
        select(Reviews).where(Reviews.id == review_id)
    ).scalars().first()

    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    # prevent flagging your own review
    if str(review.user_id) == str(user_id):
        raise HTTPException(status_code=400, detail="You can't flag your own review")

    # prevent duplicate flags from the same user
    existing = db.execute(
        select(ReviewFlag).where(
            ReviewFlag.review_id == review_id,
            ReviewFlag.reporter_user_id == user_id,
        )
    ).scalars().first()

    if existing:
        raise HTTPException(status_code=409, detail="You've already flagged this review")

    flag = ReviewFlag(
        review_id=review_id,
        reporter_user_id=user_id,
        reason=body.reason,
    )

    db.add(flag)
    db.commit()
    db.refresh(flag)

    return flag
