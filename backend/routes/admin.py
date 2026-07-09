from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func, update, delete
from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated, Optional

from auth import get_current_admin_id, get_current_user_id, ADMIN_USER_IDS
from database import db_dependency
from models import ReviewFlag, Reviews, Professor, Courses, SiteReport, ProfessorCourse
from schema import (
    AdminFlagOut, ResolveFlagIn, AdminStatsOut,
    AdminSiteReportOut, ResolveSiteReportIn, AdminHiddenProfessorOut,
)

router = APIRouter(prefix="/admin", tags=["admin"])

current_admin = Annotated[str, Depends(get_current_admin_id)]
current_user = Annotated[str, Depends(get_current_user_id)]


# Unlike every other /admin/* route, this one is open to ANY signed-in user,
# not just admins - it never 403s. The frontend nav calls this once per
# session to decide whether to show the Admin link at all. Real access
# control still happens on every actual admin endpoint via get_current_admin_id;
# this just avoids showing a link that would immediately dead-end.
@router.get("/check-access")
def check_admin_access(user_id: current_user):
    return {"is_admin": str(user_id) in ADMIN_USER_IDS}


def _to_admin_flag_out(flag: ReviewFlag, review: Reviews | None, professor: Professor | None) -> dict:
    # review/professor are None when the review has since been permanently
    # deleted (professor takedown -> "Delete permanently") - fall back to
    # the snapshot captured on the flag at deletion time.
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
        "review_text": review.review if review else flag.review_text_snapshot,
        "review_is_hidden": review.is_hidden if review else True,
        "professor_id": professor.id if professor else None,
        "professor_name": professor.name if professor else flag.professor_name_snapshot,
        "course_code": review.course_code if review else flag.course_code_snapshot,
    }


# Dashboard summary - the numbers an operator wants at a glance without
# digging into the queue. Kept cheap (a handful of counts) so this can sit
# on a landing page that's checked often.
@router.get("/stats", response_model=AdminStatsOut)
def get_stats(db: db_dependency, admin_id: current_admin):
    pending_count = db.execute(
        select(func.count(ReviewFlag.id)).where(ReviewFlag.status == "pending")
    ).scalar() or 0

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    resolved_last_7_days = db.execute(
        select(func.count(ReviewFlag.id)).where(
            ReviewFlag.status == "resolved",
            ReviewFlag.resolved_at >= seven_days_ago,
        )
    ).scalar() or 0

    removed_last_7_days = db.execute(
        select(func.count(ReviewFlag.id)).where(
            ReviewFlag.status == "resolved",
            ReviewFlag.resolution == "removed",
            ReviewFlag.resolved_at >= seven_days_ago,
        )
    ).scalar() or 0

    # A review counts as hidden either because it was individually hidden
    # (Reviews.is_hidden) or because its professor was soft-hidden, which
    # pulls every one of their reviews off public pages without touching
    # each review's own is_hidden flag. Missing the second case understates
    # this number whenever a takedown resolves to "Hide profile".
    hidden_reviews = db.execute(
        select(func.count(Reviews.id))
        .join(Professor, Professor.id == Reviews.professor_id)
        .where((Reviews.is_hidden == True) | (Professor.is_hidden == True))  # noqa: E712
    ).scalar() or 0

    total_reviews = db.execute(select(func.count(Reviews.id))).scalar() or 0
    total_professors = db.execute(select(func.count(Professor.id))).scalar() or 0
    total_courses = db.execute(select(func.count(Courses.id))).scalar() or 0

    # oldest pending flag's age tells you how close you are to breaching
    # the ToS's 5-business-day resolution promise
    oldest_pending = db.execute(
        select(func.min(ReviewFlag.reported_at)).where(ReviewFlag.status == "pending")
    ).scalar()

    # Excludes professor_takedown - that gets its own dedicated stat/card
    # below, so the two numbers don't double-count the same reports.
    pending_reports = db.execute(
        select(func.count(SiteReport.id)).where(
            SiteReport.status == "pending",
            SiteReport.category != "professor_takedown",
        )
    ).scalar() or 0

    pending_takedowns = db.execute(
        select(func.count(SiteReport.id)).where(
            SiteReport.status == "pending",
            SiteReport.category == "professor_takedown",
        )
    ).scalar() or 0

    return {
        "pending_flags": pending_count,
        "resolved_last_7_days": resolved_last_7_days,
        "removed_last_7_days": removed_last_7_days,
        "hidden_reviews": hidden_reviews,
        "total_reviews": total_reviews,
        "total_professors": total_professors,
        "total_courses": total_courses,
        "oldest_pending_reported_at": oldest_pending,
        "pending_site_reports": pending_reports,
        "pending_professor_takedowns": pending_takedowns,
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
    # LEFT JOIN, not INNER - a flag on a permanently-deleted review has
    # review_id = NULL and would disappear entirely from a query that
    # required a match (falling back to the snapshot columns instead).
    query = select(ReviewFlag, Reviews, Professor).outerjoin(
        Reviews, Reviews.id == ReviewFlag.review_id
    ).outerjoin(
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
        .outerjoin(Reviews, Reviews.id == ReviewFlag.review_id)
        .outerjoin(Professor, Professor.id == Reviews.professor_id)
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

    db.add(review)
    db.commit()

    professor = db.execute(
        select(Professor).where(Professor.id == review.professor_id)
    ).scalars().first()

    return [_to_admin_flag_out(f, review, professor) for f in sibling_flags]


# ── Site reports (wrong info / professor takedown / bug) ──
# Kept as a fully separate queue from the review-flags one above, per how
# these categories are meant to stay distinct on the public Report page.

def _to_admin_report_out(report: SiteReport) -> dict:
    return {
        "id": report.id,
        "category": report.category,
        "contact_email": report.contact_email,
        "professor_id": report.professor_id,
        "professor_name": report.professor.name if report.professor else None,
        "course_code": report.course_code,
        "description": report.description,
        "created_at": report.created_at,
        "status": report.status,
        "resolution": report.resolution,
        "resolution_note": report.resolution_note,
        "resolved_at": report.resolved_at,
    }


@router.get("/reports", response_model=list[AdminSiteReportOut])
def list_reports(
    db: db_dependency,
    admin_id: current_admin,
    category: Optional[str] = None,
    status: Optional[str] = "pending",
):
    query = select(SiteReport)

    if category:
        query = query.where(SiteReport.category == category)
    if status:
        query = query.where(SiteReport.status == status)

    # professor_takedown requests get worked first within any given status,
    # matching the ToS's "high priority" language for that category
    query = query.order_by(
        (SiteReport.category != "professor_takedown"),
        SiteReport.created_at.asc(),
    )

    reports = db.execute(query).scalars().all()
    return [_to_admin_report_out(r) for r in reports]


@router.post("/reports/{report_id}/resolve", response_model=AdminSiteReportOut)
def resolve_report(
    report_id: int,
    body: ResolveSiteReportIn,
    db: db_dependency,
    admin_id: current_admin,
):
    report = db.execute(
        select(SiteReport).where(SiteReport.id == report_id)
    ).scalars().first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # "deleted" only means something for a professor_takedown - guard it
    # here rather than relying on the frontend never sending it, since the
    # schema-level validator has no idea which category a given report is.
    if body.resolution == "deleted" and report.category != "professor_takedown":
        raise HTTPException(
            status_code=400,
            detail='"deleted" is only a valid resolution for professor_takedown reports',
        )

    professor_id = report.professor_id

    report.status = "resolved"
    report.resolution = body.resolution
    report.resolution_note = body.note
    report.resolved_by = admin_id
    report.resolved_at = datetime.now(timezone.utc)
    db.add(report)

    # Two different outcomes for an approved professor_takedown, both
    # requested explicitly by the operator rather than inferred:
    #   "approved" -> soft hide. Professor + their reviews stay in the DB
    #                 (audit trail, and reversible via the restore endpoint)
    #                 but drop off every public page.
    #   "deleted"  -> permanent removal. Used when the professor asked for
    #                 their data gone entirely, not just hidden. Cannot be
    #                 undone - there is no restore path for this one.
    if report.category == "professor_takedown" and professor_id:
        if body.resolution == "approved":
            professor = db.execute(
                select(Professor).where(Professor.id == professor_id)
            ).scalars().first()
            if professor:
                professor.is_hidden = True
                professor.hidden_reason = f"removed following takedown request: {body.note or 'no note provided'}"
                db.add(professor)

        elif body.resolution == "deleted":
            # Null out every report pointing at this professor first (this
            # one included) - professor_id is a nullable FK precisely so the
            # report itself can survive the professor's deletion for the
            # audit trail, it just loses the link.
            db.execute(
                update(SiteReport)
                .where(SiteReport.professor_id == professor_id)
                .values(professor_id=None)
            )

            professor = db.execute(
                select(Professor).where(Professor.id == professor_id)
            ).scalars().first()
            professor_name = professor.name if professor else None

            reviews_to_delete = db.execute(
                select(Reviews).where(Reviews.professor_id == professor_id)
            ).scalars().all()
            review_ids = [r.id for r in reviews_to_delete]
            reviews_by_id = {r.id: r for r in reviews_to_delete}

            # Snapshot instead of delete - same reasoning as SiteReport above.
            # A flag's moderation decision (kept/removed, who resolved it,
            # when) should survive the review it was about being deleted.
            if review_ids:
                flags = db.execute(
                    select(ReviewFlag).where(ReviewFlag.review_id.in_(review_ids))
                ).scalars().all()
                for f in flags:
                    r = reviews_by_id.get(f.review_id)
                    f.review_text_snapshot = r.review if r else None
                    f.professor_name_snapshot = professor_name
                    f.course_code_snapshot = r.course_code if r else None
                    f.review_id = None
                    db.add(f)

            db.execute(delete(Reviews).where(Reviews.professor_id == professor_id))
            db.execute(delete(ProfessorCourse).where(ProfessorCourse.professor_id == professor_id))
            db.execute(delete(Professor).where(Professor.id == professor_id))

    db.commit()
    db.refresh(report)

    return _to_admin_report_out(report)


# ── Hidden professors: the restore side of the soft-hide path ──
# Only ever shows professors hidden via "approved" (is_hidden=True).
# Permanently deleted professors don't exist anymore, so there's nothing
# to list or restore for them.

@router.get("/professors/hidden", response_model=list[AdminHiddenProfessorOut])
def list_hidden_professors(db: db_dependency, admin_id: current_admin):
    rows = db.execute(
        select(
            Professor.id,
            Professor.name,
            Professor.department,
            Professor.hidden_reason,
            func.count(Reviews.id).label("review_count"),
        )
        .outerjoin(Reviews, Reviews.professor_id == Professor.id)
        .where(Professor.is_hidden == True)  # noqa: E712
        .group_by(Professor.id, Professor.name, Professor.department, Professor.hidden_reason)
        .order_by(Professor.name.asc())
    ).all()

    return [
        {
            "id": r.id,
            "name": r.name,
            "department": r.department,
            "hidden_reason": r.hidden_reason,
            "review_count": r.review_count,
        }
        for r in rows
    ]


@router.post("/professors/{professor_id}/restore", response_model=AdminHiddenProfessorOut)
def restore_professor(professor_id: int, db: db_dependency, admin_id: current_admin):
    professor = db.execute(
        select(Professor).where(Professor.id == professor_id)
    ).scalars().first()

    if not professor:
        raise HTTPException(status_code=404, detail="Professor not found")
    if not professor.is_hidden:
        raise HTTPException(status_code=400, detail="This professor isn't hidden")

    professor.is_hidden = False
    professor.hidden_reason = None
    db.add(professor)
    db.commit()

    review_count = db.execute(
        select(func.count(Reviews.id)).where(Reviews.professor_id == professor_id)
    ).scalar() or 0

    return {
        "id": professor.id,
        "name": professor.name,
        "department": professor.department,
        "hidden_reason": None,
        "review_count": review_count,
    }
