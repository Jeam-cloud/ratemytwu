import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"

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

    if (!results) return <p>Loading...</p>

    return (
        <div className="page">

            <button onClick={() => navigate(-1)}>← Back to results</button>

            {/* ── Header ── */}
            <div className="header">
                <span className="departmentBadge">{results.department}</span>
                <h1 className="profName">{results.name}</h1>
                <p className="profMeta">Department of {results.department} · {reviews.length} {reviews.length === 1 ? "review" : "reviews"}</p>

                {/* Metric cards */}
                <div className="metricCards">
                    <div className="metricCard">
                        <p className="metricLabel">Overall rating</p>
                        <p className="metricValue">{results.average_rating ?? "—"}<span className="metricDenom">/5</span></p>
                    </div>
                    <div className="metricCard">
                        <p className="metricLabel">Difficulty</p>
                        <p className="metricValue">{results.average_difficulty ?? "—"}<span className="metricDenom">/5</span></p>
                    </div>
                    <div className="metricCard">
                        <p className="metricLabel">Would take again</p>
                        <p className="metricValue">{takeAgainPercent() ?? "—"}<span className="metricDenom">%</span></p>
                        <p className="metricSub">{reviews.filter(r => r.take_again === 1).length} of {reviews.length} students</p>
                    </div>
                </div>

                {/* Qualitative pill tags — most common value across reviews */}
                <div className="pillTags">
                    {[
                        { label: "Grading", field: "grading_fairness" },
                        { label: "Lectures", field: "lecture_quality" },
                        { label: "Office hours", field: "office_hours" },
                        { label: "Extensions", field: "extension_policy" },
                    ].map(({ label, field }) => {
                        const mode = mostCommon(reviews.map(r => r[field]))
                        if (!mode) return null
                        return (
                            <span key={field} className="pillTag">
                                {label} <strong>{mode}</strong>
                            </span>
                        )
                    })}
                </div>
            </div>

            {/* ── Courses taught ── */}
            <div className="coursesTaught">
                {courses.map(course => (
                    <span
                        key={course.id}
                        className="courseChip"
                        onClick={() => navigate(`/course/${course.id}`)}
                    >
                        {course.code}
                    </span>
                ))}
            </div>

            {/* ── Reviews ── */}
            <section className="reviewsSection">
                <p className="reviewsLabel">{reviews.length} student {reviews.length === 1 ? "review" : "reviews"}</p>

                {reviews.map(review => (
                    <div key={review.id} className="reviewCard">

                        {/* Card header */}
                        <div className="reviewCardHeader">
                            <div className="reviewCardHeaderLeft">
                                <span className="reviewCourseCode">{review.course_code}</span>
                                <span className="reviewGradePill">{review.grade_received}</span>
                            </div>
                            <div className="reviewCardHeaderRight">
                                <span className="reviewRating">★ {review.rating}/5</span>
                                <span className="reviewDate">{formatDate(review.created_at)}</span>
                            </div>
                        </div>

                        {/* Mini stats row */}
                        <div className="reviewMiniStats">
                            <span className="miniStat">Rating <strong>{review.rating}/5</strong></span>
                            <span className="miniStat">Difficulty <strong>{review.difficulty}/5</strong></span>
                            <span className="miniStat">Take again <strong>{formatTakeAgain(review.take_again)}</strong></span>
                        </div>

                        {/* Written review */}
                        <p className="reviewText">{review.review}</p>

                        {/* Course-specific chips */}
                        <div className="reviewChips">
                            {review.group_work && <span className="chip">{review.group_work}</span>}
                            {review.exam_format && <span className="chip">{review.exam_format}</span>}
                            {review.textbook_required && <span className="chip">{review.textbook_required === "yes" ? "Textbook required" : "No textbook"}</span>}
                            {review.attendance && <span className="chip">Attendance {review.attendance}</span>}
                            {review.extra_credit && <span className="chip">{review.extra_credit === "yes" ? "Extra credit" : "No extra credit"}</span>}
                        </div>

                        {/* Tips */}
                        {review.tips && (
                            <div className="reviewTips">
                                <p className="tipsLabel">Tips</p>
                                <p className="tipsText">{review.tips}</p>
                            </div>
                        )}

                        {/* Owner-only delete */}
                        {currentUserId === review.user_id && (
                            <button className="deleteBtn" onClick={() => handleDelete(review.id)}>
                                Delete review
                            </button>
                        )}
                    </div>
                ))}
            </section>

            {/* ── Actions ── */}
            <div className="actions">
                {error && <p className="errorMsg">{error}</p>}
                <button className="leaveReviewBtn" onClick={redirectReview}>Leave a review</button>
            </div>
        </div>
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