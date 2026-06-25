import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import SEO from "../../components/SEO"
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
    const [editingReview, setEditingReview] = useState(null)
    const [editForm, setEditForm] = useState({})
    const [editSaveError, setEditSaveError] = useState("")

    const [flaggingReview, setFlaggingReview] = useState(null)
    const [flagReason, setFlagReason] = useState("Inappropriate")
    const [flagError, setFlagError] = useState("")
    const [flaggedIds, setFlaggedIds] = useState(new Set())

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

    const handleUpdate = async () => {
        const { data } = await supabase.auth.getSession()
        const token = data.session.access_token
        const payload = { ...editForm, grade_received: editForm.grade_received || null }

        const res = await fetch(`${API_URL}/professor/review/${editingReview.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload)
        })

        if (res.ok) {
            const updated = await res.json()
            setReviews(prev => prev.map(r => r.id === editingReview.id ? { ...r, ...updated } : r))
            setEditingReview(null)
        } else {
            const err = await res.json().catch(() => ({}))
            setEditSaveError(err.detail || `Error ${res.status}`)
        }
    }

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

    const handleFlag = async () => {
        const { data } = await supabase.auth.getSession()
        const token = data.session.access_token

        const res = await fetch(`${API_URL}/review/${flaggingReview.id}/flag`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ reason: flagReason }),
        })

        if (res.ok) {
            setFlaggedIds(prev => new Set(prev).add(flaggingReview.id))
            setFlaggingReview(null)
            setFlagReason("Inappropriate")
            setFlagError("")
        } else {
            const err = await res.json().catch(() => ({}))
            setFlagError(err.detail || `Error ${res.status}`)
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

    const profName = results?.name || ""
    const avgRating = results?.average_rating
    const reviewCount = reviews.length
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": profName,
        "jobTitle": "Professor",
        "worksFor": { "@type": "CollegeOrUniversity", "name": "Trinity Western University" },
        ...(avgRating && reviewCount > 0 ? {
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": avgRating,
                "bestRating": 5,
                "ratingCount": reviewCount
            }
        } : {})
    }

    return (
        <Layout>
            <SEO
                title={profName}
                path={`/professor/${id}`}
                description={`Read ${reviewCount} student review${reviewCount !== 1 ? "s" : ""} for ${profName} at Trinity Western University. Rating: ${avgRating ?? "N/A"}/5.`}
                type="profile"
                jsonLd={jsonLd}
            />
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
                    <button className={styles.profClaimBtn} onClick={() => navigate("/report")}>
                        Are you this professor?
                    </button>

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
                            { label: "Niceness", field: "niceness" },
                            { label: "Experience", field: "experience" },
                        ].map(({ label, field }) => {
                            const mode = mostCommon(reviews.map(r => r[field]))
                            if (!mode) return null
                            return (
                                <span key={field} className={styles.pillTag}>
                                    {label}: <strong>{mode}</strong>
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
                                {review.niceness && <span className={styles.chip}>{review.niceness}</span>}
                                {review.experience && <span className={styles.chip}>{review.experience}</span>}
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

                            {/* Owner-only edit + delete */}
                            {currentUserId === review.user_id && (
                                <div className={styles.reviewOwnerActions}>
                                    <button
                                        className={styles.editBtn}
                                        onClick={() => {
                                            setEditSaveError("")
                                            setEditingReview(review)
                                            setEditForm({
                                                rating: review.rating,
                                                difficulty: review.difficulty,
                                                grade_received: review.grade_received || "",
                                                review: review.review,
                                                tips: review.tips || "",
                                            })
                                        }}
                                    >
                                        Edit review
                                    </button>
                                    <button className={styles.deleteBtn} onClick={() => handleDelete(review.id)}>
                                        Delete review
                                    </button>
                                </div>
                            )}

                            {/* Flag button — logged-in non-owners only */}
                            {session && currentUserId !== review.user_id && (
                                <button
                                    className={`${styles.flagBtn} ${flaggedIds.has(review.id) ? styles.flagged : ""}`}
                                    onClick={() => {
                                        setFlagError("")
                                        setFlagReason("Inappropriate")
                                        setFlaggingReview(review)
                                    }}
                                    disabled={flaggedIds.has(review.id)}
                                    title={flaggedIds.has(review.id) ? "Flagged" : "Report this review"}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill={flaggedIds.has(review.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                                        <line x1="4" y1="22" x2="4" y2="15" />
                                    </svg>
                                    {flaggedIds.has(review.id) ? "Flagged" : "Report"}
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

            {/* ── Flag review modal ── */}
            {flaggingReview && (
                <div className={styles.overlay} onClick={() => setFlaggingReview(null)}>
                    <div className={styles.flagModal} onClick={(e) => e.stopPropagation()}>

                        <button className={styles.editModalClose} onClick={() => setFlaggingReview(null)} aria-label="Close">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                        </button>

                        <div className={styles.flagIcon}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                                <line x1="4" y1="22" x2="4" y2="15" />
                            </svg>
                        </div>

                        <h3 className={styles.flagTitle}>Report this review</h3>
                        <p className={styles.flagDesc}>
                            Help us keep RateMyTWU honest. What's wrong with this review?
                        </p>

                        <div className={styles.flagChecklist}>
                            {["Inappropriate", "Fake review", "Personal attack", "Wrong info", "Other"].map((reason) => (
                                <label key={reason} className={`${styles.flagOption} ${flagReason === reason ? styles.flagOptionSelected : ""}`}>
                                    <input
                                        type="radio"
                                        name="flagReason"
                                        value={reason}
                                        checked={flagReason === reason}
                                        onChange={() => setFlagReason(reason)}
                                        className={styles.flagRadio}
                                    />
                                    <span>{reason}</span>
                                </label>
                            ))}
                        </div>

                        <p className={styles.flagNote}>
                            Reviews that violate our guidelines will be removed. We review every report.
                        </p>

                        {flagError && <p className={styles.editError}>{flagError}</p>}

                        <div className={styles.flagModalFooter}>
                            <button className={styles.flagCancelBtn} onClick={() => setFlaggingReview(null)}>Cancel</button>
                            <button className={styles.flagSubmitBtn} onClick={handleFlag}>Submit report</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit review modal ── */}
            {editingReview && (
                <div className={styles.overlay} onClick={() => setEditingReview(null)}>
                    <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.editModalHead}>
                            <h3 className={styles.editModalTitle}>Edit review</h3>
                            <button className={styles.editModalClose} onClick={() => setEditingReview(null)} aria-label="Close">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className={styles.editModalBody}>
                            <div className={styles.editField}>
                                <label className={styles.editLabel}>Rating</label>
                                <div className={styles.editRow}>
                                    {[1,2,3,4,5].map(n => (
                                        <button key={n} type="button"
                                            className={n <= editForm.rating ? styles.starOn : styles.starOff}
                                            onClick={() => setEditForm(f => ({ ...f, rating: n }))}>★</button>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.editField}>
                                <label className={styles.editLabel}>Difficulty</label>
                                <div className={styles.editRow}>
                                    {[1,2,3,4,5].map(n => (
                                        <button key={n} type="button"
                                            className={n <= editForm.difficulty ? styles.diffOn : styles.diffOff}
                                            onClick={() => setEditForm(f => ({ ...f, difficulty: n }))}>{n}</button>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.editField}>
                                <label className={styles.editLabel}>Grade received</label>
                                <select className={styles.editSelect}
                                    value={editForm.grade_received}
                                    onChange={(e) => setEditForm(f => ({ ...f, grade_received: e.target.value }))}>
                                    <option value="">— none —</option>
                                    {["A+","A","A-","B+","B","B-","C+","C","C-","D+","D","D-","F"].map(g => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.editField}>
                                <label className={styles.editLabel}>Review</label>
                                <textarea className={styles.editTextarea} rows={4}
                                    value={editForm.review}
                                    onChange={(e) => setEditForm(f => ({ ...f, review: e.target.value }))} />
                            </div>

                            <div className={styles.editField}>
                                <label className={styles.editLabel}>Tips <span className={styles.editOptional}>(optional)</span></label>
                                <textarea className={styles.editTextarea} rows={2}
                                    value={editForm.tips}
                                    onChange={(e) => setEditForm(f => ({ ...f, tips: e.target.value }))} />
                            </div>
                        </div>

                        {editSaveError && (
                            <p className={styles.editError}>{editSaveError}</p>
                        )}

                        <div className={styles.editModalFooter}>
                            <button className={styles.editCancelBtn} onClick={() => setEditingReview(null)}>Cancel</button>
                            <button className={styles.editSaveBtn} onClick={handleUpdate}>Save changes</button>
                        </div>
                    </div>
                </div>
            )}
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
