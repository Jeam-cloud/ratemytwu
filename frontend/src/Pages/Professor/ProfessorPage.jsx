import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import styles from "../../css/ProfessorPage.module.css"

// 5-star glyph row, filled up to the rounded rating
function Stars({ value }) {
    const full = Math.round(value || 0)
    return (
        <span className={styles.stars}>
            {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className={i <= full ? styles.starOn : styles.starOff}>★</span>
            ))}
        </span>
    )
}

export default function ProfessorPage() {
    const [results, setResults] = useState(null)
    const [reviews, setReviews] = useState([])
    const [courses, setCourses] = useState([])
    const [currentUserId, setCurrentUserId] = useState("")
    const [session, setSession] = useState(null)
    const [error, setError] = useState("")

    const { id } = useParams()
    const navigate = useNavigate()

    useEffect(() => {
        const loadData = async () => {
            const { data } = await supabase.auth.getSession()
            if (data.session) {
                setCurrentUserId(data.session.user.id)
                setSession(data.session)
            }

            const getProfessor = async () => {
                const response = await fetch(`${API_URL}/professor/${id}/everything`)
                const data = await response.json()
                setResults(data)
                setReviews(data.reviews)
            }

            const getCourses = async () => {
                const response = await fetch(`${API_URL}/professor/${id}/courses`)
                const data = await response.json()
                setCourses(data)
            }

            getProfessor()
            getCourses()
        }

        loadData()
    }, [id])

    const handleDelete = async (reviewId) => {
        const { data } = await supabase.auth.getSession()
        const token = data.session.access_token

        const res = await fetch(`${API_URL}/professor/review/${reviewId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })

        if (res.ok) {
            setReviews(prev => prev.filter(r => r.id !== reviewId))
        }
    }

    const redirectReview = () => {
        if (!session) {
            setError("Must be logged in to leave a review")
            return
        }
        navigate(`/professor/${id}/review`)
    }

    const formatTakeAgain = (val) => val === 1 ? "Yes" : "No"

    const formatDate = (isoString) => {
        return new Date(isoString).toLocaleDateString("en-CA", { month: "short", year: "numeric" })
    }

    const takeAgainPercent = () => {
        if (!reviews.length) return null
        const yes = reviews.filter(r => r.take_again === 1).length
        return Math.round((yes / reviews.length) * 100)
    }

    if (!results) return <Layout><p className={styles.loading}>Loading...</p></Layout>

    return (
        <Layout>
            <div className={styles.page}>

                <button className={styles.back} onClick={() => navigate(-1)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                    Back to results
                </button>

                {/* ── Header card ── */}
                <div className={styles.header}>
                    <span className={styles.departmentBadge}>{results.department}</span>
                    <h1 className={styles.profName}>{results.name}</h1>
                    <p className={styles.profMeta}>
                        Department of {results.department} · {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                    </p>

                    {/* Metric cards */}
                    <div className={styles.metricCards}>
                        <div className={styles.metricCard}>
                            <p className={styles.metricLabel}>Overall rating</p>
                            <p className={styles.metricValue}>
                                {results.average_rating ?? "—"}<span className={styles.metricDenom}>/5</span>
                            </p>
                        </div>
                        <div className={styles.metricCard}>
                            <p className={styles.metricLabel}>Difficulty</p>
                            <p className={styles.metricValue}>
                                {results.average_difficulty ?? "—"}<span className={styles.metricDenom}>/5</span>
                            </p>
                        </div>
                        <div className={styles.metricCard}>
                            <p className={styles.metricLabel}>Would take again</p>
                            <p className={styles.metricValue}>
                                {takeAgainPercent() ?? "—"}<span className={styles.metricDenom}>%</span>
                            </p>
                            <p className={styles.metricSub}>
                                {reviews.filter(r => r.take_again === 1).length} of {reviews.length} students
                            </p>
                        </div>
                    </div>

                    {/* Qualitative pill tags — most common value across reviews */}
                    <div className={styles.pillTags}>
                        {[
                            { label: "Grading", field: "grading_fairness" },
                            { label: "Lectures", field: "lecture_quality" },
                            { label: "Office hours", field: "office_hours" },
                            { label: "Extensions", field: "extension_policy" },
                        ].map(({ label, field }) => {
                            const mode = mostCommon(reviews.map(r => r[field]))
                            if (!mode) return null
                            return (
                                <span key={field} className={styles.pillTag}>
                                    {label} <strong>{mode}</strong>
                                </span>
                            )
                        })}
                    </div>
                </div>

                {/* ── Courses taught ── */}
                {courses.length > 0 && (
                    <section className={styles.coursesSection}>
                        <p className={styles.sectionKicker}>Courses taught this year</p>
                        <div className={styles.coursesTaught}>
                            {courses.map(course => (
                                <span
                                    key={course.id}
                                    className={styles.courseChip}
                                    onClick={() => navigate(`/course/${course.id}`)}
                                >
                                    {course.code}
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Reviews ── */}
                <section className={styles.reviewsSection}>
                    <p className={styles.sectionKicker}>
                        {reviews.length} student {reviews.length === 1 ? "review" : "reviews"}
                    </p>

                    {reviews.map(review => (
                        <div key={review.id} className={styles.reviewCard}>

                            {/* Card header */}
                            <div className={styles.reviewCardHeader}>
                                <div className={styles.reviewCardHeaderLeft}>
                                    <span className={styles.reviewCourseCode}>{review.course_code}</span>
                                    <span className={styles.reviewGradePill}>{review.grade_received}</span>
                                </div>
                                <div className={styles.reviewCardHeaderRight}>
                                    <Stars value={review.rating} />
                                    <span className={styles.reviewRatingNum}>{review.rating}.0</span>
                                    <span className={styles.reviewDate}>{formatDate(review.created_at)}</span>
                                </div>
                            </div>

                            {/* Mini stats row */}
                            <div className={styles.reviewMiniStats}>
                                <span className={styles.miniStat}>Rating <strong>{review.rating}/5</strong></span>
                                <span className={styles.miniStat}>Difficulty <strong>{review.difficulty}/5</strong></span>
                                <span className={styles.miniStat}>
                                    Take again{" "}
                                    <strong className={review.take_again === 1 ? styles.yes : styles.no}>
                                        {formatTakeAgain(review.take_again)}
                                    </strong>
                                </span>
                            </div>

                            {/* Written review */}
                            <p className={styles.reviewText}>{review.review}</p>

                            {/* Course-specific chips */}
                            <div className={styles.reviewChips}>
                                {review.group_work && <span className={styles.chip}>{review.group_work}</span>}
                                {review.exam_format && <span className={styles.chip}>{review.exam_format}</span>}
                                {review.textbook_required && <span className={styles.chip}>{review.textbook_required === "yes" ? "Textbook required" : "No textbook"}</span>}
                                {review.attendance && <span className={styles.chip}>Attendance {review.attendance}</span>}
                                {review.extra_credit && <span className={styles.chip}>{review.extra_credit === "yes" ? "Extra credit" : "No extra credit"}</span>}
                            </div>

                            {/* Tips */}
                            {review.tips && (
                                <div className={styles.reviewTips}>
                                    <p className={styles.tipsLabel}>Tips</p>
                                    <p className={styles.tipsText}>{review.tips}</p>
                                </div>
                            )}

                            {/* Owner-only delete */}
                            {currentUserId === review.user_id && (
                                <button className={styles.deleteBtn} onClick={() => handleDelete(review.id)}>
                                    Delete review
                                </button>
                            )}
                        </div>
                    ))}
                </section>

                {/* ── Actions ── */}
                <div className={styles.actions}>
                    {error && <p className={styles.errorMsg}>{error}</p>}
                    <button className={styles.leaveReviewBtn} onClick={redirectReview}>Leave a review</button>
                </div>
            </div>
        </Layout>
    )
}

// returns the most frequently occurring value in an array
function mostCommon(arr) {
    if (!arr.length) return null
    const freq = {}
    for (const val of arr) {
        if (val) freq[val] = (freq[val] || 0) + 1
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}
