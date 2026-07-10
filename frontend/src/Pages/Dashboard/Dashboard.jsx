import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core"

import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"

import { useReview } from "../../hooks/useReview"
import { useBookMark } from "../../hooks/useBookMark"

import Layout from "../../components/Layout"
import BookMarkCard from "../../components/dashboard-components/BookMarkCard"
import DashBoardColumn from "../../components/dashboard-components/DashBoardColumn"
import TranscriptImportModal from "../../components/dashboard-components/TranscriptImportModal"
import ExportPDFModal from "../../components/dashboard-components/ExportPDFModal"
import TutorialOverlay from "../../components/dashboard-components/TutorialOverlay"
import ChecklistTab from "../../components/dashboard-components/ChecklistTab"
import ChecklistImportModal from "../../components/dashboard-components/ChecklistImportModal"
import { exportChecklistPDF } from "../../utils/checklistExport"
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

// Renders Fall → Spring → Summer for each academic year (Summer optional)
function YearTerms({ group, hasSummer, cards, startYear, onDelete, onUpdate, autoEditCardId, onAutoEditDone, onAddSummer, styles }) {
    const byTerm = (t) => group.columns.find(c => c.term === t)
    const fallCol   = byTerm("Fall")
    const springCol = byTerm("Spring")
    const summerCol = byTerm("Summer")

    const colProps = (col) => ({
        key: `${col.year}-${col.term}`,
        col,
        startYear,
        cards: cards.filter(c => c.year === col.year && c.term === col.term),
        onDelete,
        onUpdate,
        autoEditCardId,
        onAutoEditDone,
    })

    const numCols = (fallCol ? 1 : 0) + (springCol ? 1 : 0) + (hasSummer && summerCol ? 1 : 0)

    return (
        <div className={numCols >= 3 ? styles.termsThree : styles.termsTwo}>
            {fallCol   && <DashBoardColumn {...colProps(fallCol)} />}
            {springCol && <DashBoardColumn {...colProps(springCol)} />}
            {hasSummer && summerCol && <DashBoardColumn {...colProps(summerCol)} />}

            {/* Full-width "Add summer term" button after Fall + Spring */}
            {!hasSummer && (
                <button
                    className={styles.addSummerCard}
                    style={{ gridColumn: "1 / -1" }}
                    onClick={onAddSummer}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5v14" />
                    </svg>
                    Add summer term
                </button>
            )}
        </div>
    )
}

export default function Dashboard() {

    const { reviews, deleteReview, updateReview } = useReview()
    const [reviewsShown, setReviewsShown] = useState(3)
    const [editingReview, setEditingReview] = useState(null)
    const [editForm, setEditForm] = useState({})
    const [editSaveError, setEditSaveError] = useState("")
    const { bookmark, addBookmark } = useBookMark()
    const navigate = useNavigate()

    // PointerSensor for mouse; TouchSensor (press-and-hold) enables dragging on
    // mobile while normal swipes still scroll the page
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    )
    const [isGuest, setIsGuest] = useState(false)
    const [guestQuery, setGuestQuery] = useState("")
    const [guestResults, setGuestResults] = useState([])
    const [sidebarQuery, setSidebarQuery] = useState("")
    const [sidebarResults, setSidebarResults] = useState([])
    const [activeItem, setActiveItem] = useState(null)
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
    const [expandedYears, setExpandedYears] = useState(new Set([1]))
    const [summerYears, setSummerYears] = useState(new Set())
    const [showImport, setShowImport] = useState(false)
    const [view, setView] = useState("courses")   // "courses" (planner) | "checklist"
    const [showChecklistImport, setShowChecklistImport] = useState(false)
    const [checklistVersion, setChecklistVersion] = useState(0)   // bump to remount ChecklistTab after import
    const [showExport, setShowExport] = useState(false)

    // ── Tutorial ──────────────────────────────────────────────────────────────
    // Start at step 0 on first visit, null means hidden
    const [tutorialStep, setTutorialStep] = useState(() =>
        localStorage.getItem("plannerTutorialDone") ? null : 0
    )
    const startTutorial = () => setTutorialStep(0)
    const nextTutorialStep = () => {
        setTutorialStep(s => {
            if (s >= 6) { localStorage.setItem("plannerTutorialDone", "1"); return null }
            return s + 1
        })
    }
    const prevTutorialStep = () => setTutorialStep(s => Math.max(0, s - 1))
    const skipTutorial = () => {
        localStorage.setItem("plannerTutorialDone", "1")
        setTutorialStep(null)
    }
    const [exportEmail, setExportEmail] = useState("")
    const [creditGoal, setCreditGoal] = useState(() => {
        const saved = localStorage.getItem("plannerCreditGoal")
        return saved ? Number(saved) : 122
    })
    const [creditGoalDraft, setCreditGoalDraft] = useState(null)

    const toggleYear = (yearNum) => {
        setExpandedYears(prev => {
            const next = new Set(prev)
            next.has(yearNum) ? next.delete(yearNum) : next.add(yearNum)
            return next
        })
    }

    // GPA — 4.3 scale, derived from grades entered on board cards
    const GRADE_PTS = { 'A+':4.3,'A':4.0,'A-':3.7,'B+':3.3,'B':3.0,'B-':2.7,'C+':2.3,'C':2.0,'C-':1.7,'D+':1.3,'D':1.0,'D-':0.7,'F':0 }
    const gradedCards = cards.filter(c => c.grade && c.credits && GRADE_PTS[c.grade] !== undefined && (c.status === "Completed" || c.status === "In Progress"))
    const gpaPoints   = gradedCards.reduce((s, c) => s + GRADE_PTS[c.grade] * c.credits, 0)
    const gpaCredits  = gradedCards.reduce((s, c) => s + c.credits, 0)
    const gpa         = gpaCredits > 0 ? (gpaPoints / gpaCredits).toFixed(2) : null
    const gpaPct      = gpaCredits > 0 ? Math.round(gpaPoints / gpaCredits / 4.3 * 100) : 0

    // semester options: Spring and Fall for a generous window of years
    const thisYear = new Date().getFullYear()
    const startOptions = []
    for (let y = thisYear + 2; y >= thisYear - 10; y--) {
        startOptions.push({ year: y, term: "Fall",   label: `Fall ${y}` })
        startOptions.push({ year: y, term: "Spring", label: `Spring ${y}` })
    }

    const totalCredits = cards.filter(c => c.grade !== "F").reduce((sum, card) => sum + (card.credits || 0), 0)
    const percent = Math.min(Math.round((totalCredits / creditGoal) * 100), 100)

    // per-status credit breakdown for the segmented progress bar
    const completedCredits   = cards.filter(c => c.status === "Completed").reduce((s,c) => s + (c.credits||0), 0)
    const inProgressCredits  = cards.filter(c => c.status === "In Progress").reduce((s,c) => s + (c.credits||0), 0)
    const plannedCredits     = cards.filter(c => c.status === "Planned").reduce((s,c) => s + (c.credits||0), 0)
    const completedPct       = (completedCredits  / creditGoal) * 100
    const inProgressPct      = (inProgressCredits / creditGoal) * 100
    const plannedPct         = (plannedCredits    / creditGoal) * 100

    // highest year that still has a course — can't shrink below this without orphaning cards
    const maxUsedYear = cards.length ? Math.max(...cards.map(c => c.year)) : 0

    // loads planner settings and cards — guest mode uses localStorage only
    useEffect(() => {
        const loadAll = async () => {
            const { data } = await supabase.auth.getSession()
            const session = data.session

            if (!session) {
                // ── Guest mode ──
                setIsGuest(true)
                const ly = localStorage.getItem("plannerYears")
                const lsy = localStorage.getItem("plannerStartYear")
                const lst = localStorage.getItem("plannerStartTerm")
                const guestStartTerm = lst ?? "Fall"
                if (ly) {
                    const y = Number(ly), sy = lsy ? Number(lsy) : new Date().getFullYear()
                    setYears(y); setStartYear(sy); setStartTerm(guestStartTerm); setStartDraft(sy); setStartDraftTerm(guestStartTerm)
                }
                const saved = localStorage.getItem("guestPlannerCards")
                if (saved) {
                    let loaded = JSON.parse(saved)
                    // Spring-start migration: year=1 Fall → year=2 Fall
                    if (guestStartTerm === "Spring") {
                        const needsMigration = loaded.some(c => c.year === 1 && c.term === "Fall")
                        if (needsMigration) {
                            loaded = loaded.map(c => (c.year === 1 && c.term === "Fall") ? { ...c, year: 2 } : c)
                            localStorage.setItem("guestPlannerCards", JSON.stringify(loaded))
                        }
                    }
                    setCards(loaded)
                    setExpandedYears(prev => { const n = new Set(prev); loaded.forEach(c => n.add(c.year)); return n })
                    const ss = new Set(); loaded.forEach(c => { if (c.term === "Summer") ss.add(c.year) }); if (ss.size > 0) setSummerYears(ss)
                }
                return
            }

            // ── Logged-in mode ──
            setExportEmail(session.user?.email ?? "")
            const token = session.access_token
            const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }

            let resolvedStartTerm = "Fall"
            let settingsLoaded = false
            try {
                const settingsRes = await fetch(`${API_URL}/planner/settings`, { headers })
                if (settingsRes.ok) {
                    const settings = await settingsRes.json()
                    if (settings) {
                        setYears(settings.years); setStartYear(settings.start_year)
                        resolvedStartTerm = settings.start_term ?? "Fall"
                        setStartTerm(resolvedStartTerm); setStartDraft(settings.start_year)
                        setStartDraftTerm(resolvedStartTerm); settingsLoaded = true
                    }
                }
            } catch (_) {}

            if (!settingsLoaded) {
                const ly = localStorage.getItem("plannerYears"), lsy = localStorage.getItem("plannerStartYear"), lst = localStorage.getItem("plannerStartTerm")
                if (ly) {
                    resolvedStartTerm = lst ?? "Fall"
                    const y = Number(ly), sy = lsy ? Number(lsy) : new Date().getFullYear()
                    setYears(y); setStartYear(sy); setStartTerm(resolvedStartTerm); setStartDraft(sy); setStartDraftTerm(resolvedStartTerm)
                }
            }

            const cardsRes = await fetch(`${API_URL}/board/cards`, { headers })
            if (!cardsRes.ok) { setError("Failed to load cards"); return }
            let loaded = await cardsRes.json()

            // Spring-start migration v1: year=1 Fall cards belong to academic Year 2 (e.g. Fall 2024 → Year 2)
            if (resolvedStartTerm === "Spring") {
                const toMigrate = loaded.filter(c => c.year === 1 && c.term === "Fall")
                if (toMigrate.length > 0) {
                    await Promise.all(toMigrate.map(card =>
                        fetch(`${API_URL}/board/${card.id}`, {
                            method: "PATCH",
                            headers,
                            body: JSON.stringify({ year: 2, term: "Fall", credits: card.credits ?? null, status: card.status ?? "Planned", grade: card.grade ?? null, notes: card.notes ?? null }),
                        })
                    ))
                    // reload after migration
                    const reloadRes = await fetch(`${API_URL}/board/cards`, { headers })
                    if (reloadRes.ok) loaded = await reloadRes.json()
                }
            }

            // Spring-start migration v2 (one-time): fix Fall cards that were placed one year too early
            // by the old getPlannerYear bug (calYear - startYear + 1 instead of + 2 for Fall terms).
            // Specifically:
            //   year=2 Fall cards with codes known to be 2025 Fall → move to year=3 Fall
            //   year=3 Fall cards (all from 2026 Fall bad import)   → move to year=4 Fall
            if (resolvedStartTerm === "Spring" && !localStorage.getItem("spring_fall_v2_done")) {
                localStorage.setItem("spring_fall_v2_done", "1")
                const misplacedAt2 = ["CMPT 334", "CMPT 345", "ENGL 103", "HIST 107"]
                const v2ToMigrate = loaded.filter(c =>
                    (c.year === 2 && c.term === "Fall" && misplacedAt2.includes(c.code)) ||
                    (c.year === 3 && c.term === "Fall")
                )
                if (v2ToMigrate.length > 0) {
                    await Promise.all(v2ToMigrate.map(card => {
                        const newYear = (card.year === 2 && misplacedAt2.includes(card.code)) ? 3 : 4
                        return fetch(`${API_URL}/board/${card.id}`, {
                            method: "PATCH",
                            headers,
                            body: JSON.stringify({ year: newYear, term: "Fall", credits: card.credits ?? null, status: card.status ?? "Planned", grade: card.grade ?? null, notes: card.notes ?? null }),
                        })
                    }))
                    const reloadRes = await fetch(`${API_URL}/board/cards`, { headers })
                    if (reloadRes.ok) loaded = await reloadRes.json()
                }
            }

            setCards(loaded)
            if (loaded.length > 0) {
                setExpandedYears(prev => { const next = new Set(prev); loaded.forEach(c => next.add(c.year)); return next })
                const summerSet = new Set(); loaded.forEach(c => { if (c.term === "Summer") summerSet.add(c.year) }); if (summerSet.size > 0) setSummerYears(summerSet)
            }
        }

        loadAll()
    }, [])

    const savePlannerSettings = async (years, startYear, startTerm) => {
        localStorage.setItem("plannerYears", String(years))
        localStorage.setItem("plannerStartYear", String(startYear))
        localStorage.setItem("plannerStartTerm", startTerm)
        if (isGuest) return
        try {
            const { data } = await supabase.auth.getSession()
            const token = data.session?.access_token
            if (!token) return
            await fetch(`${API_URL}/planner/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ years, start_year: startYear, start_term: startTerm }),
            })
        } catch (_) {}
    }

    // updates year state and persists to backend
    const handleYear = (year) => {
        setYears(year)
        savePlannerSettings(year, startYear, startTerm)
    }

    const handleCreditGoal = (val) => {
        const n = Math.max(totalCredits, Math.min(Number(val) || 122, 300))
        setCreditGoal(n)
        setCreditGoalDraft(n)
        localStorage.setItem("plannerCreditGoal", String(n))
    }

    // persists the start semester to backend
    const handleStartSemester = (year, term) => {
        setStartYear(year)
        setStartTerm(term)
        setStartDraft(year)
        setStartDraftTerm(term)
        savePlannerSettings(years ?? 4, year, term)
    }

    // Spring-start (e.g. startYear=2024):
    //   Year 1 (2023-24): Spring 2024, Summer 2024  ← partial year, no Fall
    //   Year 2 (2024-25): Fall 2024, Spring 2025, Summer 2025
    //   Year 3 (2025-26): Fall 2025, Spring 2026, Summer 2026  ...
    // Fall-start (e.g. startYear=2024):
    //   Year 1 (2024-25): Fall 2024, Spring 2025, Summer 2025  ...
    const generateColumns = (numYears) => {
        const columns = []
        if (startTerm === "Spring") {
            // Year 1: Spring + Summer only (student started mid-academic-year)
            columns.push({term: "Spring", year: 1, label: `Spring ${startYear}`})
            columns.push({term: "Summer", year: 1, label: `Summer ${startYear}`})
            // Year 2+: full Fall → Spring → Summer
            for (let i = 1; i < numYears; i++) {
                columns.push({term: "Fall",   year: i+1, label: `Fall ${startYear + i - 1}`})
                columns.push({term: "Spring", year: i+1, label: `Spring ${startYear + i}`})
                columns.push({term: "Summer", year: i+1, label: `Summer ${startYear + i}`})
            }
        } else {
            for (let i = 0; i < numYears; i++) {
                columns.push({term: "Fall",   year: i+1, label: `Fall ${startYear + i}`})
                columns.push({term: "Spring", year: i+1, label: `Spring ${startYear + i + 1}`})
                columns.push({term: "Summer", year: i+1, label: `Summer ${startYear + i + 1}`})
            }
        }
        return columns
    }

    // group flat columns array into { year, span, columns[] }
    const getYearGroups = () => {
        const cols = generateColumns(years ?? 4)
        const map = {}
        cols.forEach(col => {
            if (!map[col.year]) {
                // Spring-start: Year 1 is academic year (startYear-1)–startYear, Year 2+ shifts by 1
                const calYear = startTerm === "Spring"
                    ? startYear - 1 + (col.year - 1)
                    : startYear + col.year - 1
                const span = `${calYear}–${String(calYear + 1).slice(-2)}`
                map[col.year] = { year: col.year, span, columns: [] }
            }
            map[col.year].columns.push(col)
        })
        return Object.values(map)
    }

    const handleDragStart = (event) => {
        setActiveItem(event.active.data.current)
    }

    // helper: persist guest cards to localStorage
    const saveGuestCards = (updated) => localStorage.setItem("guestPlannerCards", JSON.stringify(updated))

    // guest course search
    const handleGuestSearch = async (e) => {
        const q = e.target.value
        setGuestQuery(q)
        if (q.trim().length < 2) { setGuestResults([]); return }
        const res = await fetch(`${API_URL}/course/?search_course=${q.trim()}`)
        const data = await res.json()
        setGuestResults(data.slice(0, 8))
    }

    // infer Completed / In Progress / Planned from the column's calendar label vs today
    // col.label is always "[Term] [CalYear]", e.g. "Fall 2024", "Spring 2025"
    const inferStatus = (col) => {
        const parts = (col.label || "").split(" ")
        if (parts.length < 2) return "Planned"
        const term    = parts[0]
        const calYear = parseInt(parts[1], 10)
        if (!calYear) return "Planned"

        // semester date ranges (month is 1-based)
        const ranges = { Fall: [9, 12], Spring: [1, 4], Summer: [5, 8] }
        const range = ranges[term]
        if (!range) return "Planned"

        const now      = new Date()
        const semStart = new Date(calYear, range[0] - 1, 1)          // e.g. Sep 1 2024
        const semEnd   = new Date(calYear, range[1], 0, 23, 59, 59)  // e.g. Dec 31 2024

        if (now > semEnd)   return "Completed"
        if (now >= semStart) return "In Progress"
        return "Planned"
    }

    // shared helper — add a course to a planner column (used by drag-end and sidebar picker)
    const addCourseToCol = async (course, col) => {
        const status = inferStatus(col)

        if (isGuest) {
            if (cards.some(c => c.course_id === course.id)) return
            const newCard = {
                id: -Date.now(),
                course_id: course.id,
                year: col.year, term: col.term,
                code: course.code,
                credits: course.credits ?? null,
                status, grade: null, notes: null,
            }
            const updated = [...cards, newCard]
            setCards(updated)
            saveGuestCards(updated)
            setAutoEditCardId(newCard.id)
            return
        }

        const { data } = await supabase.auth.getSession()
        const token = data.session.access_token

        const response = await fetch(`${API_URL}/board/${course.id}`, {
            method: "POST",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`},
            body: JSON.stringify({ year: col.year, term: col.term, credits: course.credits ?? null, status, grade: null, notes: null })
        })

        if (!response.ok) { setError("Card not created"); return }
        const newCard = await response.json()
        setCards((prev) => [...prev, newCard])
        setAutoEditCardId(newCard.id)

        // Dragging a course straight from search onto the board used to skip
        // bookmarking entirely — the course would land on the planner but
        // never show up as "Bookmarked" back on the course list page, since
        // that only happened via the explicit Bookmark button. Bookmark it
        // here too so search-and-drag behaves like search-then-bookmark.
        addBookmark(course)
    }

    // sidebar course search (logged-in)
    // normalise "engl101" → "engl 101", "CMPT166" → "CMPT 166", etc.
    const normaliseCourseQuery = (raw) =>
        raw.replace(/([a-zA-Z]+)\s*(\d+)/, (_, letters, digits) => `${letters} ${digits}`)

    const handleSidebarSearch = async (e) => {
        const raw = e.target.value
        setSidebarQuery(raw)
        const q = normaliseCourseQuery(raw).trim()
        if (q.length < 2) { setSidebarResults([]); return }
        const res = await fetch(`${API_URL}/course/?search_course=${encodeURIComponent(q)}`)
        const data = await res.json()
        setSidebarResults(data.slice(0, 8))
    }

    // on drag logic of firing making a new card dragging from bookmarks/search to actual column
    const handleDragEnd = async (event) => {
        const { active, over } = event

        setActiveItem(null)

        if (!over) return

        const col = over.data.current.col
        const dragged = active.data.current

        // moving an existing board card → update its year/term
        if (dragged.card) {
            const card = dragged.card
            if (card.year === col.year && card.term === col.term) return
            handleUpdate(card.id, {
                year: col.year, term: col.term,
                credits: card.credits ?? null, status: card.status ?? "Planned",
                grade: card.grade ?? null, notes: card.notes ?? null,
            })
            return
        }

        // course being placed → create a new card
        await addCourseToCol(dragged.course, col)
    }

    const handleDelete = async (cardId) => {
        if (isGuest) {
            const updated = cards.filter(c => c.id !== cardId)
            setCards(updated)
            saveGuestCards(updated)
            return
        }
        const { data } = await supabase.auth.getSession()
        const token = data.session.access_token
        const response = await fetch(`${API_URL}/board/${cardId}`, {
            method: "DELETE",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`}
        })
        if (!response.ok) return
        setCards(prev => prev.filter(card => card.id !== cardId))
    }

    const handleUpdate = async (cardId, updatedFields) => {
        if (isGuest) {
            const updated = cards.map(c => c.id === cardId ? { ...c, ...updatedFields } : c)
            setCards(updated)
            saveGuestCards(updated)
            return
        }
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

    // Reload cards from the backend (called after transcript import)
    const reloadCards = async () => {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return
        const res = await fetch(`${API_URL}/board/cards`, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
        if (!res.ok) return
        const loaded = await res.json()
        setCards(loaded)
        if (loaded.length > 0) {
            setExpandedYears(prev => { const next = new Set(prev); loaded.forEach(c => next.add(c.year)); return next })
            const ss = new Set(); loaded.forEach(c => { if (c.term === "Summer") ss.add(c.year) }); if (ss.size > 0) setSummerYears(ss)
        }
    }

    // bookmarks not yet placed on the board
    const availableBookmarks = bookmark.filter(course => !cards.some(card => card.course_id === course.id))

    return (
        <>
        <Layout wide>
            <div className={styles.page}>

                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Your degree planner</h1>
                        <p className={styles.subtitle}>
                            Drag bookmarked courses into a term. Credits add up toward graduation.{" "}
                            <button className={styles.tourBtn} onClick={startTutorial}>Take a tour</button>
                        </p>
                    </div>
                    <div className={styles.headerActions}>
                        {view === "courses" ? (
                            <>
                                {cards.length > 0 && (
                                    <button data-tutorial="export-btn" className={styles.exportPdfBtn} onClick={() => setShowExport(true)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                        </svg>
                                        Export PDF
                                    </button>
                                )}
                                {!isGuest && (
                                    <button data-tutorial="import-btn" className={styles.importTranscriptBtn} onClick={() => setShowImport(true)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                                            <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" />
                                        </svg>
                                        Import transcript
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <button className={styles.exportPdfBtn} onClick={() => exportChecklistPDF(cards)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                    </svg>
                                    Export PDF
                                </button>
                                {!isGuest && (
                                    <button className={styles.importTranscriptBtn} onClick={() => setShowChecklistImport(true)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                                            <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" />
                                        </svg>
                                        Import major checklist
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ── View switch: planner vs degree checklist ── */}
                <div className={styles.viewTabs}>
                    <button
                        className={view === "courses" ? `${styles.viewTab} ${styles.viewTabOn}` : styles.viewTab}
                        onClick={() => setView("courses")}
                    >
                        My courses
                    </button>
                    <button
                        className={view === "checklist" ? `${styles.viewTab} ${styles.viewTabOn}` : styles.viewTab}
                        onClick={() => setView("checklist")}
                    >
                        My checklist
                    </button>
                </div>

                {/* ── Guest banner ── */}
                {isGuest && (
                    <div style={{ background: "var(--blue-tint)", border: "1px solid var(--blue)", borderRadius: "var(--radius-md)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                        <p style={{ margin: 0, fontSize: 14, color: "var(--blue)", fontFamily: "var(--font-sans)" }}>
                            <strong>You're planning as a guest.</strong> Your planner is saved in this browser only.{" "}
                            <a href="/login" style={{ color: "var(--blue)", fontWeight: 700 }}>Sign in</a> or{" "}
                            <a href="/signup" style={{ color: "var(--blue)", fontWeight: 700 }}>create an account</a> to save your courses and reviews.
                        </p>
                    </div>
                )}

                {/* ── Degree checklist view ── */}
                {view === "checklist" && (
                    <ChecklistTab key={checklistVersion} cards={cards} />
                )}

                {/* ── Planner view (default) ── */}
                {view === "courses" && (<>
                {/* ── Progress ── */}
                <div className={styles.progress}>
                    <div className={styles.progressMeta}>
                        <span className={styles.progressText}>
                            <strong>{totalCredits}</strong> / {creditGoal} credits planned · {percent}% to graduation
                        </span>
                        <div className={styles.progressMetaRight}>
                            <div className={styles.progressLegend}>
                                <span className={styles.legendItem}>
                                    <span className={`${styles.legendDot} ${styles.legendDotCompleted}`} />
                                    Completed {completedCredits}
                                </span>
                                <span className={styles.legendItem}>
                                    <span className={`${styles.legendDot} ${styles.legendDotProgress}`} />
                                    In progress {inProgressCredits}
                                </span>
                                <span className={styles.legendItem}>
                                    <span className={`${styles.legendDot} ${styles.legendDotPlanned}`} />
                                    Planned {plannedCredits}
                                </span>
                            </div>
                            <div className={styles.progressActions}>
                                {years !== null && (
                                    <button data-tutorial="edit-planner-btn" className={styles.progressIconBtn} onClick={() => { setEditingYears(true); setCreditGoalDraft(creditGoal) }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                        </svg>
                                        Edit planner
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className={styles.progressBarWrap}>
                        <div className={styles.progressTrack}>
                            <div className={styles.progressSegCompleted} style={{ width: `${Math.min(completedPct, 100)}%` }} />
                            <div className={styles.progressSegProgress}  style={{ width: `${Math.min(inProgressPct, 100 - completedPct)}%` }} />
                            <div className={styles.progressSegPlanned}   style={{ width: `${Math.min(plannedPct, 100 - completedPct - inProgressPct)}%` }} />
                        </div>
                        <div className={styles.progressTickRow}>
                            {[30, 60, 90].map(n => (
                                <span key={n} className={styles.progressTickMark} style={{ left: `${(n/creditGoal)*100}%` }}>{n}</span>
                            ))}
                            <span className={styles.progressTickMark} style={{ right: 0, left: "auto", transform: "none" }}>{creditGoal} · grad</span>
                        </div>
                    </div>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                {/* ── Board ── */}
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <div className={styles.board}>

                        {/* Left rail — bookmarks (logged in) or course search (guest) + GPA */}
                        <aside className={styles.sideRail}>
                            <div data-tutorial="bookmark-panel" className={styles.bookmarkPanel}>
                                {isGuest ? (
                                    <>
                                        <p className={styles.bookmarkKicker}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                                            </svg>
                                            Search courses
                                        </p>
                                        <input
                                            type="text"
                                            placeholder="e.g. CMPT 166"
                                            value={guestQuery}
                                            onChange={handleGuestSearch}
                                            style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-sans)", outline: "none", marginBottom: 8, boxSizing: "border-box" }}
                                        />
                                        {guestResults.length > 0 && guestQuery.length >= 2 && (
                                            guestResults.map(course => (
                                                <BookMarkCard key={course.id} course={course} />
                                            ))
                                        )}
                                        {guestResults.length === 0 && guestQuery.length >= 2 && (
                                            <p className={styles.bookmarkEmpty}>No courses found.</p>
                                        )}
                                        {guestQuery.length < 2 && (
                                            <p className={styles.bookmarkEmpty}>Type at least 2 characters to search.</p>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* ── Course search ── */}
                                        <div className={styles.sidebarSearchWrap}>
                                            <input
                                                type="text"
                                                className={styles.sidebarSearchInput}
                                                placeholder="Search courses…"
                                                value={sidebarQuery}
                                                onChange={handleSidebarSearch}
                                            />
                                        </div>

                                        {/* ── Results (draggable) or bookmarks ── */}
                                        {sidebarQuery.length >= 2 ? (
                                            sidebarResults.length === 0 ? (
                                                <p className={styles.bookmarkEmpty}>No courses found.</p>
                                            ) : (
                                                sidebarResults
                                                    .filter(course => !cards.some(c => c.course_id === course.id))
                                                    .map(course => (
                                                        <BookMarkCard key={course.id} course={course} />
                                                    ))
                                            )
                                        ) : (
                                            <>
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
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* GPA widget */}
                            <div className={styles.gpaWidget}>
                                <p className={styles.gpaKicker}>Cumulative GPA</p>
                                <div className={styles.gpaValueRow}>
                                    <span className={styles.gpaValue}>{gpa ?? "—"}</span>
                                    <span className={styles.gpaDenom}>/ 4.3</span>
                                    {gpa && <span className={styles.gpaPct}>· {gpaPct}%</span>}
                                </div>
                                <div className={styles.gpaTrack}>
                                    <div className={styles.gpaFill} style={{ width: `${Math.min(gpaPct, 100)}%` }} />
                                </div>
                                <p className={styles.gpaNote}>
                                    {gpaCredits > 0
                                        ? `Based on ${gpaCredits} graded credits. Planned courses don't count yet.`
                                        : "Enter grades on completed courses to track your GPA."}
                                </p>
                            </div>
                        </aside>

                        {/* Lifespan prompt OR year-grouped board */}
                        <div data-tutorial="board" className={styles.main}>
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
                                <div className={styles.yearList}>
                                    {getYearGroups().map(group => {
                                        const open = expandedYears.has(group.year)
                                        const yearCards = cards.filter(c => c.year === group.year)
                                        const yearCredits = yearCards.reduce((s, c) => s + (c.credits || 0), 0)

                                        return (
                                            <div key={group.year} className={styles.yearBlock}>
                                                {/* Year header — always visible */}
                                                <button
                                                    className={open ? styles.yearHeader : styles.yearHeaderCollapsed}
                                                    onClick={() => toggleYear(group.year)}
                                                >
                                                    <svg
                                                        className={`${styles.yearChevron} ${open ? styles.yearChevronOpen : ""}`}
                                                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                                                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                                    >
                                                        <path d="m9 18 6-6-6-6" />
                                                    </svg>
                                                    <span className={styles.yearTitle}>Year {group.year}</span>
                                                    <span className={styles.yearSpan}>{group.span}</span>
                                                    {open && <div className={styles.yearDivider} />}
                                                    {!open && yearCards.length === 0 && (
                                                        <span className={styles.yearEmptyHint}>Empty · click to plan</span>
                                                    )}
                                                    <span className={styles.yearCrBadge}>{yearCredits} cr</span>
                                                </button>

                                                {/* Term columns — only when expanded */}
                                                {open && <YearTerms
                                                    group={group}
                                                    hasSummer={summerYears.has(group.year)}
                                                    cards={cards}
                                                    startYear={startYear}
                                                    onDelete={handleDelete}
                                                    onUpdate={handleUpdate}
                                                    autoEditCardId={autoEditCardId}
                                                    onAutoEditDone={() => setAutoEditCardId(null)}
                                                    onAddSummer={() => setSummerYears(prev => new Set([...prev, group.year]))}
                                                    styles={styles}
                                                />}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    <DragOverlay dropAnimation={null}>
                        {activeItem?.card && (
                            <div style={{
                                background: "var(--white)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius)",
                                padding: "14px",
                                boxShadow: "0 12px 32px rgba(0,27,61,0.22)",
                                minWidth: 0,
                                opacity: 0.95,
                                cursor: "grabbing",
                                fontSize: "14px",
                                fontWeight: "700",
                                color: "var(--ink)",
                            }}>
                                {activeItem.card.code}
                                {activeItem.card.credits && <span style={{ fontWeight: 400, color: "var(--ink-3)", marginLeft: 8 }}>{activeItem.card.credits} cr</span>}
                            </div>
                        )}
                        {activeItem?.course && (
                            <div style={{
                                background: "var(--white)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius)",
                                padding: "14px",
                                boxShadow: "0 12px 32px rgba(0,27,61,0.22)",
                                opacity: 0.95,
                                cursor: "grabbing",
                                fontSize: "14px",
                                fontWeight: "700",
                                color: "var(--blue)",
                            }}>
                                {activeItem.course.code}
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>

                {/* ── Your reviews ── */}
                {reviews.length > 0 && (
                    <section className={styles.reviewsSection}>
                        <div className={styles.reviewsHead}>
                            <span className={styles.reviewsKicker}>Your reviews</span>
                            <span className={styles.reviewsCount}>{reviews.length}</span>
                        </div>

                        <div className={styles.reviewsList}>
                            {reviews.slice(0, reviewsShown).map((review) => (
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
                                    <div className={styles.reviewActions}>
                                        <button
                                            className={styles.reviewEdit}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setEditingReview(review)
                                                setEditSaveError("")
                                                setEditForm({
                                                    rating: review.rating,
                                                    difficulty: review.difficulty,
                                                    grade_received: review.grade_received || "",
                                                    review: review.review,
                                                    tips: review.tips || "",
                                                })
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className={styles.reviewDelete}
                                            onClick={(e) => { e.stopPropagation(); deleteReview(review.id) }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                    <svg className={styles.reviewChevron} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                </div>
                            ))}
                        </div>

                        {reviewsShown < reviews.length && (
                            <button
                                className={styles.seeMoreBtn}
                                onClick={() => setReviewsShown(prev => prev + 3)}
                            >
                                See more reviews ({reviews.length - reviewsShown} left)
                            </button>
                        )}
                    </section>
                )}
                </>)}

                {/* ── Edit review modal ── */}
                {editingReview && (
                    <div className={styles.overlay} onClick={() => setEditingReview(null)}>
                        <div className={styles.editReviewModal} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.editReviewHead}>
                                <h3 className={styles.editReviewTitle}>Edit review</h3>
                                <button className={styles.yearModalClose} onClick={() => setEditingReview(null)} aria-label="Close">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 6 6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className={styles.editReviewBody}>
                                {/* Rating */}
                                <div className={styles.editField}>
                                    <label className={styles.editLabel}>Rating</label>
                                    <div className={styles.editRatingRow}>
                                        {[1,2,3,4,5].map(n => (
                                            <button
                                                key={n}
                                                type="button"
                                                className={n <= editForm.rating ? styles.starOn : styles.starOff}
                                                onClick={() => setEditForm(f => ({ ...f, rating: n }))}
                                            >★</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Difficulty */}
                                <div className={styles.editField}>
                                    <label className={styles.editLabel}>Difficulty</label>
                                    <div className={styles.editRatingRow}>
                                        {[1,2,3,4,5].map(n => (
                                            <button
                                                key={n}
                                                type="button"
                                                className={n <= editForm.difficulty ? styles.diffOn : styles.diffOff}
                                                onClick={() => setEditForm(f => ({ ...f, difficulty: n }))}
                                            >{n}</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Grade */}
                                <div className={styles.editField}>
                                    <label className={styles.editLabel}>Grade received</label>
                                    <select
                                        className={styles.editSelect}
                                        value={editForm.grade_received}
                                        onChange={(e) => setEditForm(f => ({ ...f, grade_received: e.target.value }))}
                                    >
                                        <option value="">— none —</option>
                                        {["A+","A","A-","B+","B","B-","C+","C","C-","D+","D","D-","F"].map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Review text */}
                                <div className={styles.editField}>
                                    <label className={styles.editLabel}>Review</label>
                                    <textarea
                                        className={styles.editTextarea}
                                        value={editForm.review}
                                        onChange={(e) => setEditForm(f => ({ ...f, review: e.target.value }))}
                                        rows={4}
                                    />
                                </div>

                                {/* Tips */}
                                <div className={styles.editField}>
                                    <label className={styles.editLabel}>Tips <span className={styles.editOptional}>(optional)</span></label>
                                    <textarea
                                        className={styles.editTextarea}
                                        value={editForm.tips}
                                        onChange={(e) => setEditForm(f => ({ ...f, tips: e.target.value }))}
                                        rows={2}
                                    />
                                </div>
                            </div>

                            {editSaveError && (
                                <p style={{ margin: "0 24px 12px", fontSize: "13px", color: "var(--negative)" }}>
                                    {editSaveError}
                                </p>
                            )}
                            <div className={styles.editReviewFooter}>
                                <button className={styles.cancelBtn} onClick={() => setEditingReview(null)}>Cancel</button>
                                <button
                                    className={styles.saveBtn}
                                    onClick={async () => {
                                        setEditSaveError("")
                                        const payload = {
                                            ...editForm,
                                            grade_received: editForm.grade_received || null,
                                        }
                                        const result = await updateReview(editingReview.id, payload)
                                        if (result.ok) setEditingReview(null)
                                        else setEditSaveError(result.error || "Failed to save. Try again.")
                                    }}
                                >
                                    Save changes
                                </button>
                            </div>
                        </div>
                    </div>
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

                            <label className={styles.lifespanLabel}>Credit goal</label>
                            <div className={styles.creditGoalRow}>
                                <input
                                    type="number"
                                    className={styles.creditGoalInput}
                                    value={creditGoalDraft ?? creditGoal}
                                    min={totalCredits || 1}
                                    max={300}
                                    onChange={(e) => setCreditGoalDraft(e.target.value)}
                                    onBlur={() => handleCreditGoal(creditGoalDraft)}
                                    onKeyDown={(e) => e.key === "Enter" && handleCreditGoal(creditGoalDraft)}
                                />
                                <span className={styles.creditGoalUnit}>credits to graduate</span>
                            </div>
                            <p className={styles.yearNote} style={{ marginTop: 4 }}>
                                TWU typically requires 122 credits. Check your program requirements.
                            </p>
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

        {showImport && (
            <TranscriptImportModal
                startYear={startYear}
                startTerm={startTerm}
                onClose={() => setShowImport(false)}
                onImportDone={reloadCards}
            />
        )}

        {showChecklistImport && (
            <ChecklistImportModal
                cards={cards}
                onClose={() => setShowChecklistImport(false)}
                onImported={() => setChecklistVersion(v => v + 1)}
            />
        )}

        {showExport && (
            <ExportPDFModal
                cards={cards}
                startYear={startYear}
                startTerm={startTerm}
                creditGoal={creditGoal}
                email={exportEmail}
                onClose={() => setShowExport(false)}
            />
        )}

        {/* ── Tutorial overlay ── */}
        {tutorialStep !== null && (
            <TutorialOverlay
                step={tutorialStep}
                onNext={nextTutorialStep}
                onPrev={prevTutorialStep}
                onSkip={skipTutorial}
            />
        )}
        </>
    )
}