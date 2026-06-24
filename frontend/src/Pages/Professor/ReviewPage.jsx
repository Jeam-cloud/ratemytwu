import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"

import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import RadioOption from "../../components/RadioOption"
import Layout from "../../components/Layout"
import styles from "../../css/ReviewPage.module.css"

// gold star picker for the overall rating
function StarPicker({ value, onChange }) {
    const [hover, setHover] = useState(0)
    const active = hover || value || 0
    return (
        <div className={styles.starPicker} onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map(i => (
                <button
                    key={i}
                    type="button"
                    aria-label={`${i} star${i > 1 ? "s" : ""}`}
                    className={i <= active ? styles.starOn : styles.starOff}
                    onMouseEnter={() => setHover(i)}
                    onClick={() => onChange(String(i))}
                >
                    ★
                </button>
            ))}
        </div>
    )
}

export default function ReviewPage() {
    const [courseCode, setCourseCode] = useState("")
    const [rating, setRating] = useState(null)
    const [difficulty, setDifficulty] = useState(null)
    const [takeAgain, setTakeAgain] = useState(null)
    const [gradingFairness, setGradingFairness] = useState("")
    const [niceness, setNiceness] = useState("")
    const [experience, setExperience] = useState("")
    const [lectureQuality, setLectureQuality] = useState("")
    const [officeHours, setOfficeHours] = useState("")
    const [extensionPolicy, setExtensionPolicy] = useState("")

    const [groupWork, setGroupWork] = useState("")
    const [attendance, setAttendance] = useState("")
    const [examFormat, setExamFormat] = useState("")
    const [textBookRequired, setTextBookRequired] = useState("")
    const [extraCredit, setExtraCredit] = useState("")

    const [review, setReview] = useState("")
    const [gradeReceived, setGradeReceived] = useState("")
    const [tips, setTips] = useState("")


    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [profName, setProfName] = useState("")
    const [department, setDepartment] = useState("")
    const [profCourses, setProfCourses] = useState([])
    const [courseOther, setCourseOther] = useState(false)

    const { id } = useParams()
    const navigate = useNavigate()

    useEffect(() => {
        const loadProf = async() => {
            const [profRes, coursesRes] = await Promise.all([
                fetch(`${API_URL}/professor/${id}/everything`),
                fetch(`${API_URL}/professor/${id}/courses`)
            ])
            const profData = await profRes.json()
            const coursesData = await coursesRes.json()

            setProfName(profData.name)
            setDepartment(profData.department)
            setProfCourses(coursesData)
        }
        loadProf()
    }, [id])


    // validates the form, then opens the honesty gut-check modal
    const handleSubmit = () => {

        // guards for review double clicks
        if (submitting) {
            return
        }

        // checks to see if user selected anything
        if (!courseCode.trim()) { setError("Valid course code required"); return }
        if (!/^[A-Z]{2,5} \d{3}$/.test(courseCode.trim().toUpperCase())) {
            setError("Enter a valid course code, e.g. CMPT 166"); return
        }
        if (!rating) { setError("Please select a rating"); return}
        if (!difficulty) { setError("Please select a difficulty"); return}
        if (takeAgain === null) { setError("Please answer if you would take again"); return }
        if (!gradingFairness) { setError("Please select grading fairness"); return }
        if (!niceness) { setError("Please select niceness"); return }
        if (!experience) { setError("Please select experience"); return }
        if (!lectureQuality) { setError("Please select lecture quality"); return }
        if (!officeHours) { setError("Please select office hours"); return }
        if (!extensionPolicy) { setError("Please select extension policy"); return }
        if (!groupWork)  { setError("Please select group works"); return }
        if (!attendance) { setError("Please select attendance"); return }
        if (!examFormat) { setError("Please select exam format"); return }
        if (!textBookRequired) { setError("Please select text book required"); return }
        if (!extraCredit) { setError("Please select extra credit"); return }
        if (!gradeReceived) { setError("Please fill out grade received"); return }
        if (!["A+","A","A-","B+","B","B-","C+","C","C-","D+","D","D-","F"].includes(gradeReceived.trim().toUpperCase())) {
            setError("Enter a valid grade (F to A+)"); return
        }
        if (review.trim().length < 10) { setError("Please leave a review that is more than 10 characters"); return }

        setError("")
        setShowConfirm(true)
    }

    // actually posts the review — called when the user confirms in the modal
    const postReview = async () => {
        if (submitting) {
            return
        }

        setSubmitting(true)
        setError("")

        const { data } = await supabase.auth.getSession()

        if (!data.session) {
            setError("You must be logged in for a review")
            setSubmitting(false)
            setShowConfirm(false)
            return
        }
        const token = data.session.access_token

        const newReview = {
            "course_code": courseCode.trim().toUpperCase(),
            "rating": Number(rating),
            "difficulty": Number(difficulty),
            "take_again": takeAgain === "Yes" ? 1.0 : 0.0,
            "review": review,
            "grading_fairness": gradingFairness,
            "niceness": niceness,
            "experience": experience,
            "lecture_quality": lectureQuality,
            "office_hours": officeHours,
            "extension_policy": extensionPolicy,

            "group_work": groupWork,
            "attendance": attendance,
            "exam_format": examFormat,
            "textbook_required": textBookRequired,
            "extra_credit": extraCredit,

            "grade_received": gradeReceived.trim(),
            "tips": tips.trim() || null
        }

        const res = await fetch(`${API_URL}/professor/${id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(newReview)
        })

        if (!res.ok) {
            const error = await res.json()
            setError(error.detail || "something went wrong")
            setSubmitting(false)
            setShowConfirm(false)
            return
        }

        setSubmitted(true)
    }

    return (
        <Layout>
            <div className={styles.page}>

                <button className={styles.back} onClick={() => navigate(`/professor/${id}`)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                    Back to {profName}
                </button>

                <span className={styles.kicker}>Leave a review</span>
                <h1 className={styles.profName}>{profName}</h1>
                <p className={styles.meta}>
                    {department && <>Department of {department} · </>}Your review is posted anonymously
                </p>

                {error && <p className={styles.error}>{error}</p>}

                {/* ── Card 1: Professor ratings ── */}
                <div className={styles.card}>
                    <div className={styles.cardHead}>
                        <h2 className={styles.cardTitle}>Professor ratings</h2>
                        <span className={styles.step}>1 of 3</span>
                    </div>

                    <div className={styles.field}>
                        <p className={styles.fieldLabel}>Overall rating</p>
                        <StarPicker value={rating} onChange={setRating} />
                    </div>

                    <div className={styles.field}>
                        <p className={styles.fieldLabel}>Difficulty</p>
                        <div className={styles.inlineRow}>
                            <RadioOption value={difficulty} name="difficulty" options={[1, 2, 3, 4, 5]} setFunction={setDifficulty} />
                            <span className={styles.hint}>1 = easy · 5 = hard</span>
                        </div>
                    </div>

                    <div className={styles.field}>
                        <p className={styles.fieldLabel}>Would you take this professor again?</p>
                        <RadioOption value={takeAgain} name="takeAgain" options={["Yes", "No"]} setFunction={setTakeAgain} />
                    </div>

                    <div className={styles.field}>
                        <p className={styles.fieldLabel}>Grading fairness</p>
                        <RadioOption value={gradingFairness} name="gradingFairness" options={["Lenient Grader", "Moderate Grader", "Tough Grader"]} setFunction={setGradingFairness} />
                    </div>

                    <div className={styles.field}>
                        <p className={styles.fieldLabel}>Niceness</p>
                        <RadioOption value={niceness} name="niceness" options={["Very Distant", "Distant", "Neutral", "Friendly", "Very Friendly"]} setFunction={setNiceness} />
                    </div>

                    <div className={styles.field}>
                        <p className={styles.fieldLabel}>Experience</p>
                        <RadioOption value={experience} name="experience" options={["New", "Somewhat Experienced", "Experienced", "Highly Experienced"]} setFunction={setExperience} />
                    </div>

                    <div className={styles.field}>
                        <p className={styles.fieldLabel}>Lecture quality</p>
                        <RadioOption value={lectureQuality} name="lectureQuality" options={["Needs Improvement", "Fair", "Average", "Good", "Excellent"]} setFunction={setLectureQuality} />
                    </div>

                    <div className={styles.field}>
                        <p className={styles.fieldLabel}>Office hours</p>
                        <RadioOption value={officeHours} name="officeHours" options={["Helpful", "Not Helpful", "Never Went"]} setFunction={setOfficeHours} />
                    </div>

                    <div className={styles.field}>
                        <p className={styles.fieldLabel}>Extension policy</p>
                        <RadioOption value={extensionPolicy} name="extensionPolicy" options={["Lenient", "Moderate", "Unforgiving"]} setFunction={setExtensionPolicy} />
                    </div>
                </div>

                {/* ── Card 2: Course details ── */}
                <div className={styles.card}>
                    <div className={styles.cardHead}>
                        <h2 className={styles.cardTitle}>Course details</h2>
                        <span className={styles.step}>2 of 3</span>
                    </div>

                    <div className={styles.field}>
                        <div className={styles.labelRow}>
                            <p className={styles.fieldLabel}>Course code</p>
                        </div>
                        {profCourses.length > 0 && !courseOther ? (
                            <>
                                <select
                                    className={styles.input}
                                    value={courseCode}
                                    onChange={(e) => {
                                        if (e.target.value === "__other__") {
                                            setCourseOther(true)
                                            setCourseCode("")
                                        } else {
                                            setCourseCode(e.target.value)
                                        }
                                    }}
                                >
                                    <option value="">Select a course…</option>
                                    {profCourses.map(c => (
                                        <option key={c.id} value={c.code}>{c.code}</option>
                                    ))}
                                    <option value="__other__">Other course…</option>
                                </select>
                            </>
                        ) : (
                            <div className={styles.courseInputWrap}>
                                <input
                                    className={styles.input}
                                    type="text"
                                    placeholder="BIOL 113"
                                    value={courseCode}
                                    onChange={(e) => {
                                        // strip non-alphanumeric, uppercase
                                        let raw = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, "")
                                        // auto-insert space after 2-5 letters when user types a digit
                                        const lettersOnly = raw.replace(/[^A-Z]/g, "")
                                        const digitsOnly  = raw.replace(/[^0-9]/g, "")
                                        if (lettersOnly.length >= 2 && digitsOnly.length > 0) {
                                            raw = lettersOnly.slice(0, 5) + " " + digitsOnly.slice(0, 3)
                                        } else {
                                            raw = lettersOnly.slice(0, 5)
                                        }
                                        setCourseCode(raw)
                                    }}
                                    maxLength={9}
                                />
                                {profCourses.length > 0 && (
                                    <button
                                        type="button"
                                        className={styles.courseBackLink}
                                        onClick={() => { setCourseOther(false); setCourseCode("") }}
                                    >
                                        ← Back to course list
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={styles.field}>
                        <p className={styles.fieldLabel}>Group work</p>
                        <RadioOption value={groupWork} name="groupWork" options={["All individual", "Occasional Group Work", "Heavy Group Work"]} setFunction={setGroupWork} />
                    </div>

                    <div className={styles.field}>
                        <p className={styles.fieldLabel}>Attendance</p>
                        <RadioOption value={attendance} name="attendance" options={["Graded", "Optional", "Recorded But Not Graded"]} setFunction={setAttendance} />
                    </div>

                    <div className={styles.field}>
                        <p className={styles.fieldLabel}>Exam format</p>
                        <RadioOption value={examFormat} name="examFormat" options={["Multiple Choice", "Written", "Mixed", "Take-home/Online", "Other"]} setFunction={setExamFormat} />
                    </div>

                    <div className={styles.splitRow}>
                        <div className={styles.field}>
                            <p className={styles.fieldLabel}>Textbook required?</p>
                            <RadioOption value={textBookRequired} name="textBookRequired" options={["Yes", "No"]} setFunction={setTextBookRequired} />
                        </div>
                        <div className={styles.field}>
                            <p className={styles.fieldLabel}>Extra credit offered?</p>
                            <RadioOption value={extraCredit} name="extraCredit" options={["Yes", "No"]} setFunction={setExtraCredit} />
                        </div>
                    </div>
                </div>

                {/* ── Card 3: Your review ── */}
                <div className={styles.card}>
                    <div className={styles.cardHead}>
                        <h2 className={styles.cardTitle}>Your review</h2>
                        <span className={styles.step}>3 of 3</span>
                    </div>

                    <div className={styles.field}>
                        <div className={styles.labelRow}>
                            <p className={styles.fieldLabel}>Grade received</p>
                            <span className={styles.optional}>Optional</span>
                        </div>
                        <input
                            className={styles.input}
                            type="text"
                            placeholder="A-"
                            value={gradeReceived}
                            onChange={(e) => {
                                const value = e.target.value.toUpperCase();

                                if (/^(|A|A\+|A-|B|B\+|B-|C|C\+|C-|D|D\+|D-|F)$/.test(value)) {
                                    setGradeReceived(value);
                                }
                            }}
                            maxLength={2}
                        />
                    </div>

                    <div className={styles.field}>
                        <div className={styles.labelRow}>
                            <p className={styles.fieldLabel}>Your honest review</p>
                            <span className={styles.optional}>{review.length} / 500</span>
                        </div>
                        <textarea
                            className={styles.textarea}
                            placeholder="What were the lectures, exams, and workload actually like? What should the next student know?"
                            value={review}
                            maxLength={500}
                            onChange={(e) => setReview(e.target.value)}
                        />
                    </div>

                    <div className={styles.field}>
                        <div className={styles.labelRow}>
                            <p className={styles.fieldLabel}>Tips &amp; tricks</p>
                            <span className={styles.optional}>Optional</span>
                        </div>
                        <textarea
                            className={styles.textarea}
                            placeholder="Do the weekly practice sets — the midterms pull straight from them."
                            value={tips}
                            maxLength={500}
                            onChange={(e) => setTips(e.target.value)}
                        />
                    </div>
                </div>

                {/* ── Footer actions ── */}
                <div className={styles.actions}>
                    <button className={styles.cancelBtn} onClick={() => navigate(`/professor/${id}`)}>Cancel</button>
                    <button className={styles.submitBtn} onClick={handleSubmit} disabled={submitting}>
                        {submitting ? "Submitting…" : "Submit review"}
                    </button>
                </div>
            </div>

            {/* ── Success confirmation modal ── */}
            {submitted && (
                <div className={styles.overlay}>
                    <div className={`${styles.modal} ${styles.successModal}`}>
                        <div className={styles.successCheck}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m5 12 5 5 9-11" />
                            </svg>
                        </div>
                        <h2 className={styles.successTitle}>Review posted — thank you</h2>
                        <p className={styles.successText}>Your honest take helps the next student choose well.</p>
                        <button className={`${styles.submitBtn} ${styles.successBtn}`} onClick={() => navigate(`/professor/${id}`)}>
                            Back to {profName}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Honesty gut-check modal ── */}
            {showConfirm && !submitted && (
                <div className={styles.overlay} onClick={() => !submitting && setShowConfirm(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalIcon}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
                            </svg>
                        </div>
                        <h2 className={styles.modalTitle}>One last look before you post</h2>
                        <p className={styles.modalText}>
                            Were you completely honest in your review? Your words help the next
                            student.
                        </p>
                        < p className={styles.modalText}>
                            Also please keep in mind that <strong>{profName}</strong> is a real person who may read
                            the comments you just posted. Professors are humans too just like you and I, please be thoughful of what you say.
                        </p>

                        <ul className={styles.checklist}>
                            {[
                                "Honest and specific: what was the course and teaching actually like?",
                                "Fair, not personal: critique the class, not the person.",
                                "Nothing you wouldn't say to their face. No insults or name-calling.",
                            ].map((item, i) => (
                                <li key={i} className={styles.checkItem}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--blue)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="11" stroke="none" />
                                        <path d="m8 12 3 3 5-6" fill="none" />
                                    </svg>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>

                        <p className={styles.modalFine}>
                            Posted without showing your name. Reviews that attack a person rather than the course
                            may and will be removed.
                        </p>

                        <div className={styles.modalActions}>
                            <button className={styles.keepEditingBtn} onClick={() => setShowConfirm(false)} disabled={submitting}>
                                Keep editing
                            </button>
                            <button className={styles.submitBtn} onClick={postReview} disabled={submitting}>
                                {submitting ? "Posting…" : "Yes, post my review"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
