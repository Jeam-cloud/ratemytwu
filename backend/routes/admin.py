from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated, Optional

from auth import get_current_admin_id
from database import db_dependency
from models import ReviewFlag, Reviews, Professor
from schema import AdminFlagOut, ResolveFlagIn

router = APIRouter(prefix="/admin", tags=["admin"])

current_admin = Annotated[str, Depends(get_current_admin_id)]


def _to_admin_flag_out(flag: ReviewFlag, review: Reviews, professor: Professor) -> dict:
    return {
        "id": flag.id,
        "review_id": flag.review_id,
        "reason": flag.reason,
        "other_text": flag.other_text,
        "reported_at": flag.reported_at,
        "status": flag.status,
        "resolution": flag.resolution,
        "resolution_note": flag.resolution_note,
        "resolved_at": flag.resolved_at,
        "review_text": review.review,
        "review_is_hidden": review.is_hidden,
        "professor_id": professor.id,
        "professor_name": professor.name,
        "course_code": review.course_code,
    }


# The report queue. Defaults to open (pending) reports so the operator's
# view matches the ToS's "acknowledge within 2 business days / resolve
# within 5" commitment - this is the list you work top-to-bottom.
@router.get("/flags", response_model=list[AdminFlagOut])
def list_flags(
    db: db_dependency,
    admin_id: current_admin,
    status: Optional[str] = "pending",
):
    query = select(ReviewFlag, Reviews, Professor).join(
        Reviews, Reviews.id == ReviewFlag.review_id
    ).join(
        Professor, Professor.id == Reviews.professor_id
    )

    if status:
        query = query.where(ReviewFlag.status == status)

    query = query.order_by(ReviewFlag.reported_at.asc())

    rows = db.execute(query).all()

    return [_to_admin_flag_out(flag, review, professor) for flag, review, professor in rows]


@router.get("/flags/{flag_id}", response_model=AdminFlagOut)
def get_flag(flag_id: int, db: db_dependency, admin_id: current_admin):
    row = db.execute(
        select(ReviewFlag, Reviews, Professor)
        .join(Reviews, Reviews.id == ReviewFlag.review_id)
        .join(Professor, Professor.id == Reviews.professor_id)
        .where(ReviewFlag.id == flag_id)
    ).first()

    if not row:
        raise HTTPException(status_code=404, detail="Flag not found")

    flag, review, professor = row
    return _to_admin_flag_out(flag, review, professor)


# Resolving a flag resolves EVERY open flag on that review at once, since
# the decision (remove / keep / edit) applies to the review as a whole,
# not to each individual reporter. This keeps the audit trail honest:
# every reporter's flag ends up with the same resolution and timestamp.
@router.post("/flags/{flag_id}/resolve", response_model=list[AdminFlagOut])
def resolve_flag(
    flag_id: int,
    body: ResolveFlagIn,
    db: db_dependency,
    admin_id: current_admin,
):
    flag = db.execute(
        select(ReviewFlag).where(ReviewFlag.id == flag_id)
    ).scalars().first()

    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    review = db.execute(
        select(Reviews).where(Reviews.id == flag.review_id)
    ).scalars().first()

    if not review:
        raise HTTPException(status_code=404, detail="Underlying review not found")

    sibling_flags = db.execute(
        select(ReviewFlag).where(
            ReviewFlag.review_id == flag.review_id,
            ReviewFlag.status == "pending",
        )
    ).scalars().all()

    now = datetime.now(timezone.utc)

    for f in sibling_flags:
        f.status = "resolved"
        f.resolution = body.resolution
        f.resolution_note = body.note
        f.resolved_by = admin_id
        f.resolved_at = now
        db.add(f)

    if body.resolution == "removed":
        review.is_hidden = True
        review.hidden_reason = f"removed following report: {body.note or 'no note provided'}"
    elif body.resolution == "kept":
        # Reports dismissed - restore visibility if it was auto-hidden.
        review.is_hidden = False
        review.hidden_reason = None
    # "edited" leaves is_hidden as-is; the operator edits the review content
    # separately via the existing review update path, then this just closes
    # out the report with a record of what changed and why.

    db.add(review)
    db.commit()

    professor = db.execute(
        select(Professor).where(Professor.id == review.professor_id)
    ).scalars().first()

    return [_to_admin_flag_out(f, review, professor) for f in sibling_flags]
