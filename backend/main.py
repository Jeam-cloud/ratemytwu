from database import db_dependency, Base, engine
from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware

from routes import reviews, professors, courses, departments, bookmarks, users, cards

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://fastapi-postgresql-react-test-hye1s5kpb-my-twu-s-projects.vercel.app",
    "https://fastapi-postgresql-react-test.vercel.app"],
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

@app.get("/")
async def home():
    return {"hello": "world"}

 











