from fastapi import APIRouter, Depends
from sqlalchemy import select

from models import Reviews
from auth import get_current_user_id
from database import db_dependency
from schema import CreatedReviewsOut
from typing import Annotated, List


router = APIRouter(prefix="/user", tags=["users"])

current_user = Annotated[str, Depends(get_current_user_id)]

@router.get("/reviews", response_model=List[CreatedReviewsOut])
def get_user_reviews(db: db_dependency, user_id: current_user):
    user_reviews = db.execute(
        select(Reviews).where(Reviews.user_id == user_id)
    ).scalars().all()

    return user_reviews

