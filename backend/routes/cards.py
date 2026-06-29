from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from database import db_dependency
from models import UserCourseCard, Courses
from auth import get_current_user_id
from schema import CardsOut, CreateCardsIn, CreateCardsOut, ImportCardIn

from typing import Annotated, List

router = APIRouter(prefix="/board", tags=["kanban"])

current_user = Annotated[str, Depends(get_current_user_id)]

# gets all course cards to be filtered in the frontend
@router.get("/cards", response_model=list[CardsOut])
def get_course_cards(db: db_dependency, user_id: current_user):
    course_cards = db.execute(
        select(UserCourseCard).where(UserCourseCard.user_id == user_id)
    ).scalars().all()

    cards = []

    for c in course_cards:
        cards.append({
            "id": c.id,
            "course_id": c.course_id,
            "year": c.year,
            "term": c.term,
            "code": c.course.code,

            "credits": c.credits,
            "status": c.status,
            "grade": c.grade,
            "notes": c.notes
        })
    return cards

# when user drags into kanban convert to a post
@router.post("/{course_id}", response_model=CreateCardsOut)
def create_course_card(db: db_dependency, user_id: current_user, course_id: int, course_info: CreateCardsIn):
    
    existing_course_card = db.execute(
        select(UserCourseCard).where(
            UserCourseCard.user_id == user_id,
            UserCourseCard.course_id == course_id
        )
    ).scalars().first()

    if existing_course_card:
        raise HTTPException(status_code=409, detail="course already exists on the board")
    
    new_course_card = UserCourseCard(
        user_id = user_id,
        course_id = course_id,

        year = course_info.year,
        term = course_info.term,
        credits = course_info.credits,
        status = course_info.status,
        grade = course_info.grade,
        notes = course_info.notes
    )

    db.add(new_course_card)
    db.commit()
    db.refresh(new_course_card)

    return {
        "id": new_course_card.id,
        "course_id": new_course_card.course_id,
        "year": new_course_card.year,
        "term": new_course_card.term,
        "code": new_course_card.course.code,
        "credits": new_course_card.credits,
        "status": new_course_card.status,
        "grade": new_course_card.grade,
        "notes": new_course_card.notes
    }

# updates each course card when dragged into different columns
@router.patch("/{card_id}", response_model=CardsOut)
def update_card(db: db_dependency, user_id: current_user, card_id: int, course_info: CreateCardsIn):
    card = db.execute(
        select(UserCourseCard).where(UserCourseCard.id == card_id, UserCourseCard.user_id == user_id)
    ).scalars().first()

    if not card:
        raise HTTPException(status_code=404, detail="card doesn't exist")

    card.term = course_info.term
    card.year = course_info.year
    card.credits = course_info.credits
    card.status = course_info.status
    card.grade =  course_info.grade
    card.notes = course_info.notes

    db.commit()
    db.refresh(card)

    return {
        "id": card.id,
        "course_id": card.course_id,
        "year": card.year,
        "term": card.term,
        "code": card.course.code,
        "credits": card.credits,
        "status": card.status,
        "grade": card.grade,
        "notes": card.notes
    }

# deletes course card
@router.delete("/{card_id}")
def delete_card(db: db_dependency, user_id: current_user, card_id: int):
    existing_card = db.execute(
        select(UserCourseCard).where(UserCourseCard.id == card_id, UserCourseCard.user_id == user_id)
    ).scalars().first()

    if not existing_card:
        raise HTTPException(status_code=404, detail="Card does not exist")

    db.delete(existing_card)
    db.commit()

    return None


# bulk import from transcript
@router.post("/import")
def bulk_import_cards(db: db_dependency, user_id: current_user, cards: List[ImportCardIn]):
    """
    Accepts a list of cards parsed from a transcript and creates planner cards.
    Courses not in the DB are skipped. Existing cards for the same course are skipped.
    Returns counts of imported, not_found, and duplicate codes.
    """
    imported = []
    not_found = []
    duplicates = []

    for card in cards:
        # Look up course by code (exact match)
        course = db.execute(
            select(Courses).where(Courses.code == card.course_code)
        ).scalars().first()

        if not course:
            not_found.append(card.course_code)
            continue

        # Skip if user already has this course on their board
        existing = db.execute(
            select(UserCourseCard).where(
                UserCourseCard.user_id == user_id,
                UserCourseCard.course_id == course.id,
            )
        ).scalars().first()

        if existing:
            duplicates.append(card.course_code)
            continue

        new_card = UserCourseCard(
            user_id=user_id,
            course_id=course.id,
            year=card.year,
            term=card.term,
            credits=card.credits,
            status=card.status,
            grade=card.grade,
        )
        db.add(new_card)
        imported.append(card.course_code)

    db.commit()
    return {"imported": imported, "not_found": not_found, "duplicates": duplicates}