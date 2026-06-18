"""
migrate_add_credits.py — one-time migration to add credits column to courses table.

Run once from the backend directory:
    cd backend
    python migrate_add_credits.py

After running this, re-run script.py to populate credit values from the PDF:
    python script.py --pdf Fall2026_Timetable.pdf --semester FA2026
"""

import sys
sys.path.insert(0, ".")

from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE courses ADD COLUMN credits INTEGER"))
        conn.commit()
        print("✓ Added 'credits' column to courses table.")
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
            print("Column 'credits' already exists — nothing to do.")
        else:
            raise
