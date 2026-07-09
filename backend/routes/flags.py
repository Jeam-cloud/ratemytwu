from uuid import UUID
from sqlalchemy import select, func
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
        other_text=body.other_text if body.reason == "Other" else None,
    )

    db.add(flag)
    db.commit()

    # Auto-hide: once a review has 2+ open flags, pull it from public view
    # pending a manual decision, rather than leaving it live while it sits
    # in the queue. This does not delete anything - an operator still makes
    # the final call via /admin/flags/{id}/resolve, and the review is
    # restored automatically if the flags are dismissed.
    open_flag_count = db.execute(
        select(func.count(ReviewFlag.id)).where(
            ReviewFlag.review_id == review_id,
            ReviewFlag.status == "pending",
        )
    ).scalar()

    if open_flag_count is not None and open_flag_count >= 2 and not review.is_hidden:
        review.is_hidden = True
        review.hidden_reason = "auto-hidden: multiple reports pending review"
        db.add(review)
        db.commit()

    db.refresh(flag)

    return flag
