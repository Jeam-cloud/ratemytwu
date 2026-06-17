import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"

import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import styles from "../../css/ProfessorList.module.css"


function getInitials(name) {
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function ProfessorList() {

    const [searchParam] = useSearchParams()
    const [results, setResults] = useState([])

    const navigate = useNavigate()

    const query = searchParam.get("search_professor")
    const [input, setInput] = useState(query ?? "")

    // fetches professors everytime user searches
    useEffect( () => {

        if (!query) {
            return
        }

        const fetchProfessors =  async () => {

            const response = await fetch(`${API_URL}/professor/?search_professor=${query}`)
            const data = await response.json()

            setResults(data)
        }

        fetchProfessors()

    }, [query])

    const handleSearch = () => {
        const trimmed = input.trim()
        if (trimmed.length < 2) {
            return
        }
        navigate(`/professor/?search_professor=${trimmed}`)
    }

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSearch()
    }

    return (
        <Layout>
            <div className={styles.page}>
                <span className={styles.kicker}>Showing results for</span>

                <div className={styles.searchRow}>
                    <div className={styles.searchBar}>
                        <svg width="16" height="16" fill="none" stroke="#877C70" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search a professor name..."
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <button className={styles.searchBtn} onClick={handleSearch}>Search</button>
                </div>

                <p className={styles.count}>
                    {results.length} {results.length === 1 ? "professor" : "professors"}
                </p>

                <div className={styles.list}>
                    {results.map((professor) => {
                        const initials = getInitials(professor.name)
                        const hasReviews = professor.review_count > 0

                        return (
                            <div
                                key={professor.id}
                                className={styles.card}
                                onClick={() => navigate(`/professor/${professor.id}/`)}
                            >
                                {/* Left: avatar + name + department */}
                                <div className={styles.left}>
                                    <div className={styles.avatar}>{initials}</div>
                                    <div>
                                        <p className={styles.name}>{professor.name}</p>
                                        <p className={styles.meta}>
                                            {professor.department}
                                            {hasReviews && (
                                                <> · {professor.review_count} {professor.review_count === 1 ? "review" : "reviews"}</>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Right: stats or empty state + chevron */}
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
