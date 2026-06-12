from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Annotated
from fastapi import Depends
import os
from dotenv import load_dotenv
from urllib.parse import quote_plus



load_dotenv()


test_url = os.getenv("TEST_DATABASE_URL")

if test_url:
    DATABASE_URL = test_url
    engine = create_engine(test_url, connect_args={"check_same_thread": False})
else:
    password = quote_plus(os.getenv("DB_PASSWORD"))
    host = os.getenv("DB_HOST")
    user = os.getenv("DB_USER", "postgres")

    DATABASE_URL = f"postgresql+psycopg2://{user}:{password}@{host}/postgres"

    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]

