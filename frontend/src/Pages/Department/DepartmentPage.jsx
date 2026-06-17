import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import styles from "../../css/DepartmentPage.module.css"

import { supabase } from "../../supabaseClient"


function getInitials(name) {
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function DepartmentPage() {
    const [profs, setProfs] = useState([])
    const [courses, setCourses] = useState([])
    const { department_name } = useParams()
    const [bookmarked, setBookmarked] = useState(new Set())

    const [error, setError] = useState("")
    // how many cards are visible in each section (grows by 10 on "See more")
    const [profsShown, setProfsShown] = useState(10)
    const [coursesShown, setCoursesShown] = useState(10)
    const navigate = useNavigate()

    useEffect(() => {

        const getProfessor = async () => {
            const response = await fetch(`${API_URL}/department/${department_name}/professors`)
            const data = await response.json()

            setProfs(data)
        }

        const getCourse = async () => {
            const response = await fetch(`${API_URL}/department/${department_name}/courses`)
            const data = await response.json()

            setCourses(data)
        }

        getProfessor()
        getCourse()
        // reset paging when switching departments
        setProfsShown(10)
        setCoursesShown(10)
    }, [department_name])


    useEffect(() => {
    const loadBookmarks = async () => {
        const { data } = await supabase.auth.getSession()
        if (!data.session) return
        const token = data.session.access_token
        const res = await fetch(`${API_URL}/bookmark/`, {
            headers: { "Authorization": `Bearer ${token}` }
        })
        if (!res.ok) return
        const data2 = await res.json()
        setBookmarked(new Set(data2.map(c => c.id)))
    }
    loadBookmarks()
    }, [])

    // bookmark for courses
    const handleBookmark = async (e, courseId) => {
        e.stopPropagation()

        const { data } = await supabase.auth.getSession()

        if (!data.session) {
            setError("You must be logged in to bookmark a course")
            return
        }

        const token = data.session.access_token

        const isBookmarked = bookmarked.has(courseId)

        const response = await fetch(`${API_URL}/bookmark/${courseId}`, {
            method: isBookmarked ? "DELETE" : "POST",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`}
        })

        if (!response.ok) {
            const error = await response.json()
            setError(error.detail || "something went wrong")
            return
        }

        setBookmarked(prev => {
            const next = new Set(prev)
            isBookmarked ? next.delete(courseId) : next.add(courseId)
            return next
        })

    }

    return(
        <Layout>
            <div className={styles.page}>

                <button className={styles.back} onClick={() => navigate("/departments")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                    All departments
                </button>

                <h1 className={styles.title}>{department_name}</h1>
                <p className={styles.subtitle}>{profs.length} professors · {courses.length} courses</p>

                {error && <p className={styles.error}>{error}</p>}

                {/* ── Professors ── */}
                <div className={styles.sectionHead}>
                    <h2 className={styles.sectionTitle}>Professors</h2>
                    <span className={styles.sectionCount}>{profs.length}</span>
                </div>

                <div className={styles.list}>
                    {profs.slice(0, profsShown).map((professor) => {
                        const initials = getInitials(professor.name)
                        const hasReviews = professor.review_count > 0

                        return (
                            <div key={professor.id} className={styles.card} onClick={() => navigate(`/professor/${professor.id}`)}>
                                <div className={styles.left}>
                                    <div className={styles.avatar}>{initials}</div>
                                    <div>
                                        <p className={styles.name}>{professor.name}</p>
                                        <p className={styles.meta}>{professor.department}</p>
                                    </div>
                                </div>
                                <div className={styles.right}>
                                    {hasReviews ? (
                                        <div className={styles.stat}>
                                            <div className={styles.statValue}>
                                                <span className={styles.star}>★</span> {professor.average_rating}
                                            </div>
                                            <div className={styles.statSub}>
                                                {professor.review_count} {professor.review_count === 1 ? "review" : "reviews"}
                                            </div>
                                        </div>
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

                {profsShown < profs.length && (
                    <button className={styles.seeMore} onClick={() => setProfsShown(n => n + 10)}>
                        See more professors
                    </button>
                )}

                {/* ── Courses ── */}
                <div className={styles.sectionHead}>
                    <h2 className={styles.sectionTitle}>Courses</h2>
                    <span className={styles.sectionCount}>{courses.length}</span>
                </div>

                <div className={styles.list}>
                    {courses.slice(0, coursesShown).map((course) => {
                        const isBookmarked = bookmarked.has(course.id)
                        return (
                            <div key={course.id} className={styles.card} onClick={() => navigate(`/course/${course.id}`)}>
                                <div className={styles.left}>
                                    <div className={styles.courseIcon}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z" />
                                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className={styles.code}>{course.code}</p>
                                        <p className={styles.meta}>{course.professor_count} {course.professor_count === 1 ? "professor" : "professors"}</p>
                                    </div>
                                </div>
                                <div className={styles.right}>
                                    <button
                                        className={`${styles.bookmarkBtn} ${isBookmarked ? styles.bookmarked : ""}`}
                                        onClick={(e) => handleBookmark(e, course.id)}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" />
                                        </svg>
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

                {coursesShown < courses.length && (
                    <button className={styles.seeMore} onClick={() => setCoursesShown(n => n + 10)}>
                        See more courses
                    </button>
                )}
            </div>
        </Layout>
    )
}
