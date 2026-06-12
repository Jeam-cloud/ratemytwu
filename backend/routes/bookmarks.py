from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from database import db_dependency
from auth import get_current_user_id
from models import UserBookmarkCourse, Courses
from schema import BookmarksOut, CoursesOut

from typing import Annotated


router = APIRouter(prefix="/bookmark", tags=["bookmarks"])

current_user = Annotated[str, Depends(get_current_user_id)]

# creates a bookmark when user clicks button
@router.post("/{course_id}", response_model=BookmarksOut)
def create_bookmark(course_id: int, user_id: current_user, db: db_dependency):

    existing_bookmark = db.execute(
        select(UserBookmarkCourse).where(UserBookmarkCourse.course_id == course_id, UserBookmarkCourse.user_id == user_id)
    ).scalars().first()

    if existing_bookmark:
        raise HTTPException(status_code=409, detail="Bookmark already exists!")

    bookmark = UserBookmarkCourse(
        user_id = user_id,
        course_id = course_id
    )

    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)

    return bookmark

# gets all bookmarks for dashboard
@router.get("/", response_model=list[CoursesOut])
def get_bookmarks(user_id: current_user, db: db_dependency):
    bookmarks = db.execute(
        select(UserBookmarkCourse).where(UserBookmarkCourse.user_id == user_id)
    ).scalars().all()

    course_list = []

    # appends courses accessed through relationship()
    for c in bookmarks:
        course_list.append(c.courses)

    return course_list

# deletes bookmark
@router.delete("/{course_id}")
def delete_bookmark(user_id: current_user, course_id: int, db: db_dependency):
    specific_bookmark = db.execute(
        select(UserBookmarkCourse).where(UserBookmarkCourse.user_id == user_id, UserBookmarkCourse.course_id == course_id)
    ).scalars().first()

    if specific_bookmark is None:
        raise HTTPException(status_code=404, detail="bookmark not found")
    db.delete(specific_bookmark)
    db.commit()

    return None