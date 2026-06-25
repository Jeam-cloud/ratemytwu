from database import Base, engine
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from routes import reviews, professors, courses, departments, bookmarks, users, cards, planner, flags

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
    "https://ratemytwu.com",
    "https://www.ratemytwu.com",
    "https://ratemytwu.pages.dev",
    ],
    allow_origin_regex=r"https://.*\.ratemytwu\.pages\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# router endpoints
app.include_router(reviews.router)
app.include_router(professors.router)
app.include_router(courses.router)
app.include_router(departments.router)
app.include_router(bookmarks.router)
app.include_router(users.router)
app.include_router(cards.router)
app.include_router(planner.router)
app.include_router(flags.router)

@app.get("/")
async def home():
    return {"hello": "world"}

@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok","db": "up"}
    except Exception:
        return {"status": "ok", "db": "down"}











