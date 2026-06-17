import { useState } from "react"
import { useNavigate } from "react-router-dom"
import styles from "../css/SearchBarProf.module.css"

export default function SearchBarProf() {
    const [inputProfessor, setInputProfessor] = useState("")
    const navigate = useNavigate()

    const redirect = () => {

        const query = inputProfessor.trim()
        if (query.length < 2) {
            return
        }
        navigate(`/professor/?search_professor=${query}`)
    }

    const handleKeyDown = (e) => {
        if (e.key === "Enter") redirect()
    }

    return (
        <div className={styles.searchWrap}>
            <div className={styles.searchBar}>
                <svg width="16" height="16" fill="none" stroke="#877C70" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                    type="text"
                    placeholder="Search a professor name…"
                    value={inputProfessor}
                    onChange={(e) => setInputProfessor(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button className={styles.searchBtn} onClick={redirect}>Search</button>
            </div>
        </div>
    )
}