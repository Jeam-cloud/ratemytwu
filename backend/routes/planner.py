from fastapi import APIRouter, Depends
from sqlalchemy import select
from typing import Annotated

from database import db_dependency
from models import UserPlannerSettings
from auth import get_current_user_id
from schema import PlannerSettingsOut, PlannerSettingsIn

router = APIRouter(prefix="/planner", tags=["planner"])

current_user = Annotated[str, Depends(get_current_user_id)]


@router.get("/settings", response_model=PlannerSettingsOut | None)
def get_settings(db: db_dependency, user_id: current_user):
    settings = db.execute(
        select(UserPlannerSettings).where(UserPlannerSettings.user_id == user_id)
    ).scalars().first()
    return settings


@router.patch("/settings", response_model=PlannerSettingsOut)
def save_settings(db: db_dependency, user_id: current_user, body: PlannerSettingsIn):
    settings = db.execute(
        select(UserPlannerSettings).where(UserPlannerSettings.user_id == user_id)
    ).scalars().first()

    if settings:
        settings.years = body.years
        settings.start_year = body.start_year
        settings.start_term = body.start_term
    else:
        settings = UserPlannerSettings(
            user_id=user_id,
            years=body.years,
            start_year=body.start_year,
            start_term=body.start_term,
        )
        db.add(settings)

    db.commit()
    db.refresh(settings)
    return settings
