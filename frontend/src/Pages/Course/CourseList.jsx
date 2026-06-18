import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"

import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import styles from "../../css/CourseList.module.css"

export default function CourseList() {

    const [results, setResults] = useState([])
    const [searchParam] = useSearchParams()
    const [error, setError] = useState("")
    const [bookmarked, setBookmarked] = useState(new Set())

    const query = searchParam.get("search_course")
    const [input, setInput] = useState(query ?? "")

    const navigate = useNavigate()


    useEffect(() => {
        const url = query
            ? `${API_URL}/course/?search_course=${query}`
            : `${API_URL}/course/`

        fetch(url).then(r => r.json()).then(setResults)
    }, [query])

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

    // lets users bookmark the course and delete when toggled
    const handleBookmark = async (e, courseId) => {
        e.stopPropagation()

        const { data } = await supabase.auth.getSession()
        if (!data.session) { setError("You must be logged in to bookmark a course"); return }

        const token = data.session.access_token
        const isBookmarked = bookmarked.has(courseId)

        const res = await fetch(`${API_URL}/bookmark/${courseId}`, {
            method: isBookmarked ? "DELETE" : "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })

        if (!res.ok) { setError("Something went wrong"); return }

        setBookmarked(prev => {
            const next = new Set(prev)
            isBookmarked ? next.delete(courseId) : next.add(courseId)
            return next
        })
    }

    const handleSearch = () => {
        const trimmed = input.trim()
        if (trimmed.length < 2) return
        navigate(`/course?search_course=${trimmed}`)
    }

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSearch()
    }

    return (
        <Layout>
            <div className={styles.page}>
                <span className={styles.kicker}>{query ? "Showing results for" : "All courses"}</span>

                <div className={styles.searchRow}>
                    <div className={styles.searchBar}>
                        <svg width="16" height="16" fill="none" stroke="#877C70" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search a course code..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <button className={styles.searchBtn} onClick={handleSearch}>Search</button>
                </div>

                <p className={styles.count}>
                    {results.length} {results.length === 1 ? "course" : "courses"}
                </p>

                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.list}>
                    {results.map((course) => {
                        const isBookmarked = bookmarked.has(course.id)
                        return (
                            <div
                                key={course.id}
                                className={styles.card}
                                onClick={() => navigate(`/course/${course.id}`)}
                            >
                                <div className={styles.left}>
                                    <h4 className={styles.code}>{course.code}</h4>
                                    <p className={styles.meta}>
                                        {course.department} · {course.professor_count} {course.professor_count === 1 ? "professor" : "professors"}
                                    </p>
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
            </div>
        </Layout>
    )
}
