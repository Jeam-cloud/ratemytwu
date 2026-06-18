import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { DndContext } from "@dnd-kit/core"

import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"

import { useReview } from "../../hooks/useReview"
import { useBookMark } from "../../hooks/useBookMark"

import Layout from "../../components/Layout"
import BookMarkCard from "../../components/dashboard-components/BookMarkCard"
import DashBoardColumn from "../../components/dashboard-components/DashBoardColumn"
import styles from "../../css/Dashboard.module.css"

function getInitials(name) {
    if (!name) return "?"
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDate(iso) {
    if (!iso) return ""
    return new Date(iso).toLocaleDateString("en-CA", { month: "short", year: "numeric" })
}

// difficulty 1-2 = easy (green), 3 = moderate (amber), 4-5 = tough (red)
function difficultyTone(d) {
    if (d <= 2) return styles.diffEasy
    if (d === 3) return styles.diffMod
    return styles.diffHard
}

export default function Dashboard() {

    const { reviews, deleteReview } = useReview()
    const { bookmark } = useBookMark()
    const navigate = useNavigate()
    const [years, setYears] = useState(null)
    const [error, setError] = useState(null)
    const [cards, setCards] = useState([])
    const [editingYears, setEditingYears] = useState(false)
    const [pendingYears, setPendingYears] = useState(null)
    // the calendar year the student began (Fall of this year = year 1)
    const [startYear, setStartYear] = useState(new Date().getFullYear())
    const [startTerm, setStartTerm] = useState("Fall")
    // draft values for the first-visit prompt's dropdowns
    const [startDraft, setStartDraft] = useState(new Date().getFullYear())
    const [startDraftTerm, setStartDraftTerm] = useState("Fall")
    const [autoEditCardId, setAutoEditCardId] = useState(null)

    // semester options: Spring and Fall for a generous window of years
    const thisYear = new Date().getFullYear()
    const startOptions = []
    for (let y = thisYear - 10; y <= thisYear + 2; y++) {
        startOptions.push({ year: y, term: "Spring", label: `Spring ${y}` })
        startOptions.push({ year: y, term: "Fall",   label: `Fall ${y}` })
    }

    const totalCredits = cards.reduce((sum, card) => sum + (card.credits || 0), 0)
    const percent = Math.round((totalCredits / 120) * 100)

    // highest year that still has a course — can't shrink below this without orphaning cards
    const maxUsedYear = cards.length ? Math.max(...cards.map(c => c.year)) : 0

    // loads planner settings and cards from the backend
    useEffect(() => {
        const loadAll = async () => {
            const { data } = await supabase.auth.getSession()
            const token = data.session.access_token
            const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }

            // load planner settings — try backend first, fall back to localStorage
            let settingsLoaded = false
            try {
                const settingsRes = await fetch(`${API_URL}/planner/settings`, { headers })
                if (settingsRes.ok) {
                    const settings = await settingsRes.json()
                    if (settings) {
                        setYears(settings.years)
                        setStartYear(settings.start_year)
                        setStartTerm(settings.start_term ?? "Fall")
                        setStartDraft(settings.start_year)
                        setStartDraftTerm(settings.start_term ?? "Fall")
                        settingsLoaded = true
                    }
                }
            } catch (_) { /* network error — fall through to localStorage */ }

            // fallback: restore from localStorage if backend had nothing
            if (!settingsLoaded) {
                const ly = localStorage.getItem("plannerYears")
                const lsy = localStorage.getItem("plannerStartYear")
                const lst = localStorage.getItem("plannerStartTerm")
                if (ly) {
                    const y = Number(ly)
                    const sy = lsy ? Number(lsy) : new Date().getFullYear()
                    const st = lst ?? "Fall"
                    setYears(y)
                    setStartYear(sy)
                    setStartTerm(st)
                    setStartDraft(sy)
                    setStartDraftTerm(st)
                }
            }

            // load cards
            const cardsRes = await fetch(`${API_URL}/board/cards`, { headers })
            if (!cardsRes.ok) {
                setError("Failed to load cards")
                return
            }
            setCards(await cardsRes.json())
        }

        loadAll()
    }, [])

    const savePlannerSettings = async (years, startYear, startTerm) => {
        // always cache locally so the board survives if the backend endpoint is unavailable
        localStorage.setItem("plannerYears", String(years))
        localStorage.setItem("plannerStartYear", String(startYear))
        localStorage.setItem("plannerStartTerm", startTerm)

        try {
            const { data } = await supabase.auth.getSession()
            const token = data.session.access_token
            await fetch(`${API_URL}/planner/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ years, start_year: startYear, start_term: startTerm }),
            })
        } catch (_) { /* backend unavailable — localStorage copy is the fallback */ }
    }

    // updates year state and persists to backend
    const handleYear = (year) => {
        setYears(year)
        savePlannerSettings(year, startYear, startTerm)
    }

    // persists the start semester to backend
    const handleStartSemester = (year, term) => {
        setStartYear(year)
        setStartTerm(term)
        setStartDraft(year)
        setStartDraftTerm(term)
        savePlannerSettings(years ?? 4, year, term)
    }

    // generates the labels of the columns and how many columns based on years
    const generateColumns = (years) => {
        const columns = []

        if (startTerm === "Spring") {
            for (let i = 0; i < years; i++) {
                columns.push({term: "Spring", year: i+1, label: `Spring ${startYear + i}`})
                columns.push({term: "Summer", year: i+1, label: `Summer ${startYear + i}`})
                columns.push({term: "Fall",   year: i+1, label: `Fall ${startYear + i}`})
            }
        } else {
            for (let i = 0; i < years; i++) {
                columns.push({term: "Fall",   year: i+1, label: `Fall ${startYear + i}`})
                columns.push({term: "Spring", year: i+1, label: `Spring ${startYear + i + 1}`})
                columns.push({term: "Summer", year: i+1, label: `Summer ${startYear + i + 1}`})
            }
        }

        return columns
    }

    // on drag logic of firing making a new card dragging from bookmarks column to actual column
    const handleDragEnd = async (event) => {
        const { active, over } = event

        if (!over) {
            return
        }

        const col = over.data.current.col
        const dragged = active.data.current

        // moving an existing board card → just update its year/term
        if (dragged.card) {
            const card = dragged.card
            // dropped back in the same term → nothing to do
            if (card.year === col.year && card.term === col.term) return

            handleUpdate(card.id, {
                year: col.year,
                term: col.term,
                credits: card.credits ?? null,      // ← fixed: was incorrectly `course.credits`
                status: card.status ?? "Planned",
                grade: card.grade ?? null,
                notes: card.notes ?? null,
            })
            return
        }

        // otherwise it's a bookmark being placed → create a new card
        const course = dragged.course

        const { data } = await supabase.auth.getSession()
        const token = data.session.access_token

        const response = await fetch(`${API_URL}/board/${course.id}`, {
            method: "POST",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`},
            body: JSON.stringify({
                year: col.year,
                term: col.term,
                credits: course.credits ?? null,    // ← fixed: now sends credits to backend
                status: "Planned",
                grade: null,
                notes: null,
            })
        })

        if (!response.ok) {
            setError("Card not created")
            return
        }
        const newCard = await response.json()
        setCards((prev) => [...prev, newCard])
        setAutoEditCardId(newCard.id)
    }

    const handleDelete = async (cardId) => {
        const { data } = await supabase.auth.getSession()
        const token = data.session.access_token

        const response = await fetch(`${API_URL}/board/${cardId}`, {
            method: "DELETE",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`}
        })

        if (!response.ok) {
            return
        }

        setCards(prev => prev.filter(card => card.id !== cardId))
    }

    const handleUpdate = async (cardId, updatedFields) => {
        const { data } = await supabase.auth.getSession()
        const token = data.session.access_token

        const response = await fetch(`${API_URL}/board/${cardId}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`},
            body: JSON.stringify(updatedFields)
        })

        if (!response.ok) {
            setError("card not updated successfully")
            return
        }

        const updated = await response.json()

        setCards(prev => prev.map(card => card.id === cardId ? updated : card))
    }

    // bookmarks not yet placed on the board
    const availableBookmarks = bookmark.filter(course => !cards.some(card => card.course_id === course.id))

    return (
        <Layout wide>
            <div className={styles.page}>

                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Your degree planner</h1>
                        <p className={styles.subtitle}>Drag bookmarked courses into a term. Credits add up toward graduation.</p>
                    </div>
                    {years !== null && (
                        <button className={styles.editBtn} onClick={() => setEditingYears(true)}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                            Edit planner
                        </button>
                    )}
                </div>

                {/* ── Progress ── */}
                <div className={styles.progress}>
                    <span className={styles.progressText}>
                        <strong>{totalCredits}</strong> / 120 credits planned
                    </span>
                    <div className={styles.progressTrack}>
                        <div className={styles.progressFill} style={{ width: `${Math.min(percent, 100)}%` }} />
                    </div>
                    <span className={styles.progressPercent}>{percent}% to graduation</span>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                {/* ── Board ── */}
                <DndContext onDragEnd={handleDragEnd}>
                    <div className={styles.board}>

                        {/* Bookmarked panel — sticky in its own column */}
                        <aside className={styles.bookmarkPanel}>
                            <p className={styles.bookmarkKicker}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" />
                                </svg>
                                Bookmarked
                            </p>
                            {availableBookmarks.length === 0 ? (
                                <p className={styles.bookmarkEmpty}>No bookmarks left to place.</p>
                            ) : (
                                availableBookmarks.map(course => (
                                    <BookMarkCard key={course.id} course={course} />
                                ))
                            )}
                        </aside>

                        {/* Lifespan prompt OR term columns */}
                        <div className={styles.main}>
                            {years === null ? (
                                <div className={styles.lifespan}>
                                    <p className={styles.lifespanTitle}>Set up your planner</p>
                                    <p className={styles.lifespanSub}>Pick the year you started at TWU, then how many years your degree spans.</p>

                                    <label className={styles.lifespanLabel}>I started in</label>
                                    <select
                                        className={styles.lifespanSelect}
                                        value={`${startDraftTerm}-${startDraft}`}
                                        onChange={(e) => {
                                            const [term, year] = e.target.value.split("-")
                                            setStartDraft(Number(year))
                                            setStartDraftTerm(term)
                                        }}
                                    >
                                        {startOptions.map((o) => (
                                            <option key={`${o.term}-${o.year}`} value={`${o.term}-${o.year}`}>{o.label}</option>
                                        ))}
                                    </select>

                                    <label className={styles.lifespanLabel}>Degree length</label>
                                    <div className={styles.lifespanBtns}>
                                        {[3, 4, 5, 6, 7, 8].map((y) => (
                                            <button
                                                key={y}
                                                className={styles.lifespanBtn}
                                                onClick={() => { handleStartSemester(startDraft, startDraftTerm); handleYear(y) }}
                                            >
                                                {y} years
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.terms}>
                                    {generateColumns(years).map((col) => (
                                        <DashBoardColumn
                                            key={`${col.year}-${col.term}`}
                                            col={col}
                                            startYear={startYear}
                                            cards={cards.filter(c => c.year === col.year && c.term === col.term)}
                                            onDelete={handleDelete}
                                            onUpdate={handleUpdate}
                                            autoEditCardId={autoEditCardId}
                                            onAutoEditDone={() => setAutoEditCardId(null)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </DndContext>

                {/* ── Your reviews ── */}
                {reviews.length > 0 && (
                    <section className={styles.reviewsSection}>
                        <div className={styles.reviewsHead}>
                            <span className={styles.reviewsKicker}>Your reviews</span>
                            <span className={styles.reviewsCount}>{reviews.length}</span>
                        </div>

                        <div className={styles.reviewsList}>
                            {reviews.map((review) => (
                                <div
                                    key={review.id}
                                    className={styles.reviewCard}
                                    onClick={() => navigate(`/professor/${review.professor_id}`)}
                                >
                                    <div className={styles.reviewAvatar}>
                                        {getInitials(review.professor_name || review.course_code)}
                                    </div>
                                    <div className={styles.reviewBody}>
                                        <div className={styles.reviewTop}>
                                            <span className={styles.reviewName}>
                                                {review.professor_name || review.course_code}
                                            </span>
                                            <span className={styles.reviewBadge}>{review.course_code}</span>
                                        </div>
                                        <p className={styles.reviewText}>{review.review}</p>
                                        <div className={styles.reviewMeta}>
                                            <span className={styles.ratingChip}>
                                                <span className={styles.star}>★</span> {review.rating}.0
                                            </span>
                                            <span className={`${styles.diffChip} ${difficultyTone(review.difficulty)}`}>
                                                Difficulty {review.difficulty}/5
                                            </span>
                                            {review.grade_received && (
                                                <span className={styles.gradeChip}>{review.grade_received}</span>
                                            )}
                                            <span className={styles.reviewDate}>{formatDate(review.created_at)}</span>
                                        </div>
                                    </div>
                                    <button
                                        className={styles.reviewDelete}
                                        onClick={(e) => { e.stopPropagation(); deleteReview(review.id) }}
                                    >
                                        Delete
                                    </button>
                                    <svg className={styles.reviewChevron} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Edit planner length modal ── */}
                {editingYears && (
                    <div className={styles.overlay} onClick={() => setEditingYears(false)}>
                        <div className={styles.yearModal} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.yearModalHead}>
                                <h3 className={styles.yearModalTitle}>Edit planner</h3>
                                <button className={styles.yearModalClose} onClick={() => setEditingYears(false)} aria-label="Close">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 6 6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <p className={styles.yearModalSub}>Adjust when you started and how long your degree spans.</p>

                            <label className={styles.lifespanLabel}>Starting semester</label>
                            <select
                                className={styles.lifespanSelect}
                                value={`${startTerm}-${startYear}`}
                                onChange={(e) => {
                                    const [term, year] = e.target.value.split("-")
                                    handleStartSemester(Number(year), term)
                                }}
                            >
                                {startOptions.map((o) => (
                                    <option key={`${o.term}-${o.year}`} value={`${o.term}-${o.year}`}>{o.label}</option>
                                ))}
                            </select>

                            <label className={styles.lifespanLabel}>Degree length</label>
                            <div className={styles.yearGrid}>
                                {[3, 4, 5, 6, 7, 8].map((y) => {
                                    const blocked = y < maxUsedYear
                                    return (
                                        <button
                                            key={y}
                                            className={`${styles.yearOption} ${y === years ? styles.yearActive : ""}`}
                                            disabled={blocked}
                                            onClick={() => { if (y !== years) setPendingYears(y) }}
                                        >
                                            {y} years
                                        </button>
                                    )
                                })}
                            </div>

                            {maxUsedYear > 3 && (
                                <p className={styles.yearNote}>
                                    You have courses scheduled through year {maxUsedYear}. Remove them
                                    from those terms before shrinking past it — your courses won't be
                                    deleted automatically.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Confirm year change ── */}
                {pendingYears !== null && (
                    <div className={styles.overlay} onClick={() => setPendingYears(null)}>
                        <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
                            <h3 className={styles.yearModalTitle}>
                                {pendingYears > years ? "Extend your planner?" : "Shrink your planner?"}
                            </h3>
                            <p className={styles.confirmText}>
                                {pendingYears > years
                                    ? `This adds terms through ${pendingYears} years. Your existing courses stay exactly where they are.`
                                    : `This trims your planner to ${pendingYears} years. Empty terms beyond that are removed — your placed courses aren't affected.`}
                            </p>
                            <div className={styles.confirmActions}>
                                <button className={styles.cancelBtn} onClick={() => setPendingYears(null)}>Cancel</button>
                                <button
                                    className={styles.confirmBtn}
                                    onClick={() => { handleYear(pendingYears); setPendingYears(null); setEditingYears(false) }}
                                >
                                    Yes, change it
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}