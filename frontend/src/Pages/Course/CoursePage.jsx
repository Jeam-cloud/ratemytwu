import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"

import { API_URL } from "../../config"
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
    const { id } = useParams()
    const navigate = useNavigate()

    useEffect(() => {
        const getCourse = async () => {
            const response = await fetch(`${API_URL}/course/${id}`)
            const data = await response.json()

            setCourse(data)
        }

        getCourse()
    }, [id])

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
                    <h1 className={styles.code}>{code}</h1>
                    <p className={styles.heroMeta}>
                        {professors.length} {professors.length === 1 ? "professor" : "professors"} teaching this course
                        {department && <> · Department of {department}</>}
                    </p>
                    <p className={styles.blurb}>
                        See every professor teaching {blurbCode} side by side. Compare their ratings,
                        difficulty, and student reviews to pick the section that fits how you learn.
                    </p>
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
