# RateMyTWU

A course and professor guide for Trinity Western University students. Look up who's teaching what this semester, read reviews from other students, and plan your degree against your program checklist.

Live at [ratemytwu.com](https://ratemytwu.com).

**Not affiliated with, sponsored by, or endorsed by Trinity Western University.** This is an independent project built and run by students. Professor and course listings come from publicly published timetables; reviews are written by users and are opinions, not verified facts.

<img width="1886" height="1065" alt="image" src="https://github.com/user-attachments/assets/053217c6-a216-444b-8378-15be52d12c77" />
<img width="1902" height="1078" alt="image" src="https://github.com/user-attachments/assets/4eed9753-8462-4115-80e0-7735615e0be1" />
<img width="1903" height="1078" alt="image" src="https://github.com/user-attachments/assets/559959c8-8049-4bd3-ac54-d85f4a919bff" />


## What it does

- **Professor and course pages**: every course and instructor from the published timetables, including ones with no reviews yet
- **Reviews**: difficulty, workload, and what to expect, submitted by signed-in students
- **Compare**: two professors side by side
- **Degree planner**: drag courses into a multi-year plan, track credits, bookmark what you're interested in
- **Checklist tracking**: import your program's checklist PDF and see what's left to graduate
- **Transcript import**: upload an unofficial transcript to auto-fill courses you've already taken
- **Moderation**: reviews auto-hide once multiple users report them; professors can request removal of their profile, verified through their `@twu.ca` address

Uploaded PDFs are parsed in memory and the files are never stored — only the extracted course data is kept.

## Stack

| | |
|---|---|
| Frontend | React 19, Vite, CSS Modules, React Router |
| Backend | FastAPI, SQLAlchemy |
| Database | Postgres (Supabase) |
| Auth | Supabase Auth |
| PDF parsing | pypdf, PyMuPDF, pytesseract |

## Running it locally

You'll need Python 3.12+ and Node 20+.

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
fastapi dev main.py               # http://127.0.0.1:8000
```

Create `backend/.env`:

```bash
DB_HOST=your-project.pooler.supabase.com
DB_PASSWORD=...
DB_USER=postgres.your-project-ref
DB_NAME=postgres
DB_PORT=5432
SUPABASE_URL=https://your-project.supabase.co
ADMIN_USER_IDS=uuid1,uuid2        # optional — unlocks the admin routes
```

To skip Postgres entirely and run against a local SQLite file, set `TEST_DATABASE_URL=sqlite:///./test.db` instead. That takes priority over everything above.

### Frontend

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

Create `frontend/.env`:

```bash
VITE_API_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_PUBLISHABLE_KEY=...
```

Vite bakes these in at build time, so restart the dev server after changing them then redeploy after changing them in production.

## Loading course data

`script.py` reads a published TWU timetable PDF and inserts professors, courses, and the links between them:

```bash
cd backend
python script.py --pdf Fall2026_Timetable.pdf --semester Fall2026
```

It's safe to re-run because it doesn't duplicate professor name, course code, and the professor/course/semester link. Department detection uses "latest import wins," so import the current semester last if you're loading several.

To undo one:

```bash
python rollback.py --semester Fall2021
```

That removes the semester's links, then any professors and courses left orphaned with no reviews attached.

Which semesters show as current lives in `backend/config.py` as `ACTIVE_SEMESTERS`.

## Tests

```bash
cd backend
pytest
ruff check .
```

Tests run against SQLite.

## Deployment

Frontend builds to `dist` and deploys to Cloudflare Pages. Backend runs on Render. Database is Supabase Postgres.

- Render is IPv4-only and Supabase's direct host is IPv6-only, so the backend has to connect through Supabase's **session pooler** (`...pooler.supabase.com`, port 5432, user `postgres.<project-ref>`). Otherwise you get "Network is unreachable."
- The free Render tier sleeps after 15 minutes. An uptime pinger hits `/health` every 5 minutes to keep it awake, which means the first request after a real outage is still slow.

## Status

Currently being by [me](https://github.com/Jeam-cloud) and my co-founder [Vatsalya](https://github.com/Vatsalyarabari)

Known issues:

- Historical imports left some duplicate professors and courses that still need merging
- Schema changes are manual `ALTER TABLE` — Alembic isn't set up, and `create_all()` won't add columns to tables that already exist
- Planner summer-term state doesn't survive a refresh

## Contributing

Not set up for outside contributions right now. If you spot a bug or something wrong on the site, the [report page](https://ratemytwu.com/report) goes straight to us! Appreciate if you could provide some feedback.

## License

No open-source license — all rights reserved. The code is public to read, not to reuse.
