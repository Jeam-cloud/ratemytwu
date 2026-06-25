import { useState } from "react"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import SEO from "../../components/SEO"
import styles from "../../css/CompareProf.module.css"

function getInitials(name) {
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// one searchable slot: empty → live-search dropdown, filled → professor card
function CompareSlot({ side, prof, onPick, onClear }) {
    const [input, setInput] = useState("")
    const [results, setResults] = useState([])

    const handleChange = async (e) => {
        const value = e.target.value
        setInput(value)

        if (value.trim().length < 2) {
            setResults([])
            return
        }

        const response = await fetch(`${API_URL}/professor/?search_professor=${value.trim()}`)
        const data = await response.json()
        setResults(data)
    }

    const pick = (p) => {
        onPick(p)
        setInput("")
        setResults([])
    }

    if (prof) {
        return (
            <div className={styles.slotFilled}>
                <button className={styles.removeBtn} onClick={onClear} aria-label="Remove professor">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
                <div className={styles.bigAvatar}>{getInitials(prof.name)}</div>
                <p className={styles.slotName}>{prof.name}</p>
                <p className={styles.slotDept}>{prof.department}</p>
                <span className={styles.reviewsBadge}>
                    {prof.review_count} {prof.review_count === 1 ? "review" : "reviews"}
                </span>
            </div>
        )
    }

    return (
        <div className={styles.slotEmpty}>
            <span className={styles.slotSide}>{side}</span>
            <div className={styles.searchBar}>
                <svg width="16" height="16" fill="none" stroke="#877C70" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                    type="text"
                    placeholder="Search a professor name..."
                    value={input}
                    onChange={handleChange}
                />
            </div>

            {results.length > 0 && (
                <div className={styles.dropdown}>
                    {results.slice(0, 8).map((p) => (
                        <button key={p.id} className={styles.option} onClick={() => pick(p)}>
                            <span className={styles.optAvatar}>{getInitials(p.name)}</span>
                            <span className={styles.optText}>
                                <span className={styles.optName}>{p.name}</span>
                                <span className={styles.optDept}>{p.department}</span>
                            </span>
                            {p.average_rating != null && (
                                <span className={styles.optRating}>
                                    <span className={styles.star}>★</span> {p.average_rating}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
            <p className={styles.slotHint}>Choose a professor on each side to compare.</p>
        </div>
    )
}

export default function CompareProf() {

    const [firstProf, setFirstProf] = useState(null)
    const [secondProf, setSecondProf] = useState(null)

    // decides which side wins one stat row
    const getWinner = ({ firstValue, secondValue, higherWins }) => {
        // can't compare if either value is missing (prof has no reviews)
        if (firstValue === null || secondValue === null) {
            return "tie"
        }

        // equal values → nobody wins (e.g. difficulty 3.1 vs 3.1)
        if (firstValue === secondValue) {
            return "tie"
        }

        if (higherWins) {
            return firstValue > secondValue ? "first" : "second"
        } else {
            return firstValue < secondValue ? "first" : "second"
        }
    }

    // only build rows once both profs are loaded
    const bothLoaded = firstProf && secondProf

    const rows = bothLoaded ? [
        { label: "Overall rating", sub: null, type: "rating", firstValue: firstProf.average_rating, secondValue: secondProf.average_rating, higherWins: true },
        { label: "Difficulty", sub: "lower is easier", type: "outOf5", firstValue: firstProf.average_difficulty, secondValue: secondProf.average_difficulty, higherWins: false },
        { label: "Would take again", sub: null, type: "percent", firstValue: firstProf.average_take_again, secondValue: secondProf.average_take_again, higherWins: true },
        { label: "Reviews", sub: null, type: "count", firstValue: firstProf.review_count, secondValue: secondProf.review_count, higherWins: true },
    ] : []

    // tally wins for the banner
    let firstWins = 0
    let secondWins = 0

    for (const row of rows) {
        const winner = getWinner(row)
        if (winner === "first") firstWins++
        if (winner === "second") secondWins++
    }

    // format a stat value based on its type
    const renderValue = (row, value, isWinner) => {
        if (value === null || value === undefined) return <span className={styles.cellValue}>—</span>
        return (
            <span className={styles.cellValue}>
                {isWinner && row.type !== "rating" && <span className={styles.check}>✓ </span>}
                {row.type === "rating" && <span className={styles.star}>★ </span>}
                {row.type === "percent" ? Math.round(value * 100) : value}
                {row.type === "rating" && <span className={styles.unit}>/5</span>}
                {row.type === "outOf5" && <span className={styles.unit}>/5</span>}
                {row.type === "percent" && <span className={styles.unit}>%</span>}
                {isWinner && row.type === "rating" && <span className={styles.check}> ✓</span>}
            </span>
        )
    }

    const leader = firstWins > secondWins ? firstProf : secondWins > firstWins ? secondProf : null
    const leaderWins = Math.max(firstWins, secondWins)

    return (
        <Layout>
            <SEO title="Compare Professors" path="/compare" description="Compare TWU professors side by side. See ratings, difficulty, and take-again percentages to pick the best class." />
            <div className={styles.page}>
                <h1 className={styles.title}>Compare professors</h1>
                <p className={styles.subtitle}>
                    Put two professors side by side. The stronger number on each stat is highlighted in green.
                </p>

                {/* ── Slots ── */}
                <div className={styles.slots}>
                    <CompareSlot side="A" prof={firstProf} onPick={setFirstProf} onClear={() => setFirstProf(null)} />
                    <div className={styles.vs}>vs</div>
                    <CompareSlot side="B" prof={secondProf} onPick={setSecondProf} onClear={() => setSecondProf(null)} />
                </div>

                {bothLoaded && (
                    <>
                        {/* banner */}
                        <div className={styles.banner}>
                            <span className={styles.bannerCheck}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m5 12 5 5 9-11" />
                                </svg>
                            </span>
                            {leader
                                ? <span><strong>{leader.name}</strong> comes out ahead on {leaderWins} of {rows.length} stats</span>
                                : <span>Evenly matched across all {rows.length} stats</span>}
                        </div>

                        {/* comparison table */}
                        <div className={styles.table}>
                            {rows.map((row) => {
                                const winner = getWinner(row)
                                return (
                                    <div key={row.label} className={styles.tableRow}>
                                        <div className={`${styles.cell} ${winner === "first" ? styles.win : ""}`}>
                                            {renderValue(row, row.firstValue, winner === "first")}
                                        </div>
                                        <div className={styles.cellLabel}>
                                            <span className={styles.rowLabel}>{row.label}</span>
                                            {row.sub && <span className={styles.rowSub}>{row.sub}</span>}
                                        </div>
                                        <div className={`${styles.cell} ${winner === "second" ? styles.win : ""}`}>
                                            {renderValue(row, row.secondValue, winner === "second")}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>
        </Layout>
    )
}
