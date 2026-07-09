from sqlalchemy import select
from fastapi import APIRouter, HTTPException

from database import db_dependency
from models import SiteReport, Professor
from schema import SiteReportIn, SiteReportOut

router = APIRouter(prefix="/reports", tags=["reports"])

# Deliberately no auth requirement here — a professor disputing their page,
# or a visitor reporting a bug, isn't necessarily a logged-in site user.
# contact_email is how we follow up; submitted_by_user_id stays null unless
# we later add a "attach my account" option for signed-in users.


@router.post("/", response_model=SiteReportOut, status_code=201)
def submit_report(body: SiteReportIn, db: db_dependency):
    if body.professor_id is not None:
        professor = db.execute(
            select(Professor).where(Professor.id == body.professor_id)
        ).scalars().first()
        if not professor:
            raise HTTPException(status_code=404, detail="Professor not found")

    report = SiteReport(
        category=body.category,
        contact_email=body.contact_email,
        professor_id=body.professor_id,
        course_code=body.course_code.strip().upper() if body.course_code else None,
        description=body.description,
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    return report
