import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import { toTitleCase } from "../../utils/format"
import styles from "../../css/ProfessorList.module.css"

function getInitials(name) {
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function SearchResults() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const query = searchParams.get("q") ?? ""

    const [professors, setProfessors] = useState([])
    const [courses, setCourses] = useState([])
    const [bookmarked, setBookmarked] = useState(new Set())
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (query.length < 2) return
        setLoading(true)

        Promise.all([
            fetch(`${API_URL}/professor/?search_professor=${query}`).then(r => r.json()),
            fetch(`${API_URL}/course/?search_course=${query}`).then(r => r.json()),
        ]).then(([profs, crs]) => {
            setProfessors(profs)
            setCourses(crs)
            setLoading(false)
        })
    }, [query])

    useEffect(() => {
        const loadBookmarks = async () => {
            const { data } = await supabase.auth.getSession()
            if (!data.session) return
            const token = data.session.access_token
            const res = await fetch(`${API_URL}/bookmark/`, { headers: { "Authorization": `Bearer ${token}` } })
            if (!res.ok) return
            const data2 = await res.json()
            setBookmarked(new Set(data2.map(c => c.id)))
        }
        loadBookmarks()
    }, [])

    const handleBookmark = async (e, courseId) => {
        e.stopPropagation()
        const { data } = await supabase.auth.getSession()
        if (!data.session) return
        const token = data.session.access_token
        const isBookmarked = bookmarked.has(courseId)
        await fetch(`${API_URL}/bookmark/${courseId}`, {
            method: isBookmarked ? "DELETE" : "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })
        setBookmarked(prev => {
            const next = new Set(prev)
            isBookmarked ? next.delete(courseId) : next.add(courseId)
            return next
        })
    }

    const total = professors.length + courses.length

    return (
        <Layout>
            <div className={styles.page}>
                <span className={styles.kicker}>
                    {loading ? "Searching…" : `${total} result${total !== 1 ? "s" : ""} for "${query}"`}
                </span>

                {/* ── Professors ── */}
                {professors.length > 0 && (
                    <>
                        <p className={styles.count} style={{ marginTop: "1.5rem" }}>
                            Professors · {professors.length}
                        </p>
                        <div className={styles.list}>
                            {professors.map((professor) => {
                                const hasReviews = professor.review_count > 0
                                return (
                                    <div key={professor.id} className={styles.card} onClick={() => navigate(`/professor/${professor.id}/`)}>
                                        <div className={styles.left}>
                                            <div className={styles.avatar}>{getInitials(professor.name)}</div>
                                            <div>
                                                <p className={styles.name}>{toTitleCase(professor.name)}</p>
                                                <p className={styles.meta}>
                                                    {professor.department}
                                                    {hasReviews && <> · {professor.review_count} {professor.review_count === 1 ? "review" : "reviews"}</>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={styles.right}>
                                            {hasReviews ? (
                                                <>
                                                    <div className={styles.stat}>
                                                        <div className={styles.statValue}><span className={styles.star}>★</span> {professor.average_rating}</div>
                                                        <div className={styles.statLabel}>Rating</div>
                                                    </div>
                                                    <div className={styles.stat}>
                                                        <div className={`${styles.statValue} ${styles.difficulty}`}>{professor.average_difficulty}</div>
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
                    </>
                )}

                {/* ── Courses ── */}
                {courses.length > 0 && (
                    <>
                        <p className={styles.count} style={{ marginTop: "2rem" }}>
                            Courses · {courses.length}
                        </p>
                        <div className={styles.list}>
                            {courses.map((course) => {
                                const isBookmarked = bookmarked.has(course.id)
                                return (
                                    <div key={course.id} className={styles.card} onClick={() => navigate(`/course/${course.id}`)}>
                                        <div className={styles.left}>
                                            <div className={styles.avatar} style={{ background: "var(--surface-2, #e8e4df)", color: "var(--text-2, #6b6560)", fontSize: "0.7rem", fontWeight: 600 }}>
                                                {course.code.split(" ")[0]}
                                            </div>
                                            <div>
                                                <p className={styles.name}>{course.code}</p>
                                                <p className={styles.meta}>
                                                    {course.department} · {course.professor_count} {course.professor_count === 1 ? "professor" : "professors"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={styles.right}>
                                            <button
                                                className={`${styles.bookmarkBtn ?? ""}`}
                                                style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem", border: "1px solid currentColor", borderRadius: "6px", background: "none", cursor: "pointer", color: isBookmarked ? "var(--accent, #1a3a6b)" : "inherit" }}
                                                onClick={(e) => handleBookmark(e, course.id)}
                                            >
                                                {isBookmarked ? "Bookmarked" : "Bookmark"}
                                            </button>
                                            <svg className={styles.chevron} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="m9 18 6-6-6-6" />
                                            </svg>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

                {!loading && total === 0 && query.length >= 2 && (
                    <p className={styles.count} style={{ marginTop: "2rem", color: "var(--text-2, #6b6560)" }}>
                        No professors or courses found for "{query}".
                    </p>
                )}
            </div>
        </Layout>
    )
}
