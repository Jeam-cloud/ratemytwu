import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"

import { API_URL } from "../../config"
import { supabase } from "../../supabaseClient"
import Layout from "../../components/Layout"
import SEO from "../../components/SEO"
import styles from "../../css/CoursePage.module.css"

function getInitials(name) {
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function CoursePage() {
    const [course, setCourse] = useState(null)
    const [session, setSession] = useState(null)
    const [bookmarked, setBookmarked] = useState(false)
    const [bookmarkLoading, setBookmarkLoading] = useState(false)
    const { id } = useParams()
    const navigate = useNavigate()

    // Load course data
    useEffect(() => {
        fetch(`${API_URL}/course/${id}`)
            .then(r => r.json())
            .then(setCourse)
    }, [id])

    // Load session + check if already bookmarked
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session)
            if (!data.session) return
            const token = data.session.access_token
            fetch(`${API_URL}/bookmark/`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
                .then(r => r.json())
                .then(list => {
                    setBookmarked(list.some(c => String(c.id) === String(id)))
                })
                .catch(() => {})
        })
    }, [id])

    const toggleBookmark = useCallback(async (e) => {
        e.stopPropagation()
        if (!session) { navigate("/login"); return }
        if (bookmarkLoading) return
        setBookmarkLoading(true)
        const token = session.access_token
        try {
            if (bookmarked) {
                await fetch(`${API_URL}/bookmark/${id}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${token}` }
                })
                setBookmarked(false)
            } else {
                await fetch(`${API_URL}/bookmark/${id}`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}` }
                })
                setBookmarked(true)
            }
        } catch (_) {}
        setBookmarkLoading(false)
    }, [session, bookmarked, bookmarkLoading, id, navigate])

    // course detail now comes straight from the API: { code, department, professors }
    const professors = course?.professors ?? []
    const code = course?.code || "This course"
    const department = course?.department
    const blurbCode = course?.code || "this course"

    return (
        <Layout>
            <SEO
                title={course?.code ?? "Course"}
                path={`/course/${id}`}
                description={`See all professors teaching ${course?.code ?? "this course"} at Trinity Western University. Read student reviews and ratings.`}
            />
            <div className={styles.page}>

                <button className={styles.back} onClick={() => navigate(-1)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                    Course results
                </button>

                {/* ── Navy hero ── */}
                <div className={styles.hero}>
                    <div className={styles.heroTop}>
                        <h1 className={styles.code}>{code}</h1>
                        <button
                            className={`${styles.bookmarkBtn} ${bookmarked ? styles.bookmarkBtnActive : ""}`}
                            onClick={toggleBookmark}
                            disabled={bookmarkLoading}
                            aria-label={bookmarked ? "Remove bookmark" : "Bookmark this course"}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                            </svg>
                            {bookmarked ? "Bookmarked" : "Bookmark course"}
                        </button>
                    </div>
                    <p className={styles.heroMeta}>
                        {professors.length} {professors.length === 1 ? "professor" : "professors"} teaching this course
                        {department && <> · Department of {department}</>}
                    </p>
                    <p className={styles.blurb}>
                        See every professor teaching {blurbCode} side by side. Compare their ratings,
                        difficulty, and student reviews to pick the section that fits how you learn.
                    </p>
                    {!session && (
                        <p className={styles.bookmarkHint}>
                            <a href="/login" className={styles.bookmarkHintLink}>Log in</a> to bookmark this course and track it in your planner.
                        </p>
                    )}
                </div>

                {/* ── Professor list ── */}
                <p className={styles.kicker}>Who's teaching it</p>

                <div className={styles.list}>
                    {professors.map((professor) => {
                        const initials = getInitials(professor.name)
                        const hasReviews = professor.review_count > 0

                        return (
                            <div
                                key={professor.id}
                                className={styles.card}
                                onClick={() => navigate(`/professor/${professor.id}`)}
                            >
                                <div className={styles.left}>
                                    <div className={styles.avatar}>{initials}</div>
                                    <div>
                                        <p className={styles.name}>{professor.name}</p>
                                        <p className={styles.meta}>
                                            {hasReviews
                                                ? `${professor.review_count} ${professor.review_count === 1 ? "review" : "reviews"}`
                                                : professor.department}
                                        </p>
                                    </div>
                                </div>

                                <div className={styles.right}>
                                    {hasReviews ? (
                                        <>
                                            <div className={styles.stat}>
                                                <div className={styles.statValue}>
                                                    <span className={styles.star}>★</span> {professor.average_rating}
                                                </div>
                                                <div className={styles.statLabel}>Rating</div>
                                            </div>
                                            <div className={styles.stat}>
                                                <div className={`${styles.statValue} ${styles.difficulty}`}>
                                                    {professor.average_difficulty}
                                                </div>
                                                <div className={styles.statLabel}>Difficulty</div>
                                            </div>
                                        </>
                                    ) : (
                                        <span className={styles.empty}>No reviews yet</span>
                                    )}

                                    <svg className={styles.chevron} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </Layout>
    )
}
