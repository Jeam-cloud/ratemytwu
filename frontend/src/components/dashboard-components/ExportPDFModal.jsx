import { useState, useMemo } from "react"
import styles from "../../css/ExportPDF.module.css"

/**
 * Compute the human-readable "Fall 2024" label for a planner card.
 * Mirrors the logic in generateColumns() in Dashboard.jsx.
 */
function termLabel(plannerYear, term, startYear, startTerm) {
    let calYear
    if (startTerm === "Fall") {
        calYear = term === "Fall" ? startYear + plannerYear - 1 : startYear + plannerYear
    } else {
        calYear = startYear + plannerYear - 1
    }
    return `${term} ${calYear}`
}

/** Order terms chronologically within a year */
const TERM_ORDER = { Fall: 0, Spring: 1, Summer: 2 }

function statusDot(status) {
    if (status === "Completed")   return "#2e7d55"
    if (status === "In Progress") return "#b8893c"
    return "#4d82d9"
}

/**
 * Build the full HTML document that opens in a new window for printing.
 */
function buildPrintHTML({ selectedCards, termMeta, email, totalCredits, creditGoal }) {
    const grouped = {}
    selectedCards.forEach(c => {
        const key = `${c.year}-${c.term}`
        if (!grouped[key]) grouped[key] = { label: termMeta[key] ?? key, cards: [] }
        grouped[key].cards.push(c)
    })

    // Sort groups chronologically by the termMeta label (year first, then Spring < Summer < Fall)
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const [ay, at] = a.split("-")
        const [by, bt] = b.split("-")
        if (ay !== by) return Number(ay) - Number(by)
        // within same year, order Fall(0) → Spring(1) → Summer(2) if Fall-start;
        // but we'll just use the label year embedded in the termMeta
        const la = termMeta[a] ?? ""
        const lb = termMeta[b] ?? ""
        return la.localeCompare(lb)
    })

    const termSections = sortedKeys.map(key => {
        const { label, cards } = grouped[key]
        const termCredits = cards.reduce((s, c) => s + (c.credits || 0), 0)
        const rows = cards.map(c => `
            <tr>
                <td style="font-weight:600;color:#1a1a2e;">${c.code}</td>
                <td>${c.credits ?? "—"} cr</td>
                <td>
                    <span style="display:inline-flex;align-items:center;gap:5px;">
                        <span style="width:7px;height:7px;border-radius:2px;background:${statusDot(c.status)};display:inline-block;flex:none;"></span>
                        ${c.status ?? "—"}
                    </span>
                </td>
                <td>${c.grade ?? "—"}</td>
            </tr>
        `).join("")

        return `
            <div class="term-block">
                <div class="term-head">
                    <span class="term-name">${label}</span>
                    <span class="term-cr">${termCredits} cr</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Course</th><th>Credits</th><th>Status</th><th>Grade</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `
    }).join("")

    const pct = Math.min(Math.round((totalCredits / creditGoal) * 100), 100)
    const exportDate = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>RateMyTWU — Degree Planner</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 32px 40px; font-size: 13px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; border-bottom: 2px solid #002856; padding-bottom: 16px; }
  .logo { font-size: 20px; font-weight: 700; color: #002856; letter-spacing: -0.02em; }
  .logo .my { color: #B89A54; }
  .meta { font-size: 11px; color: #666; text-align: right; line-height: 1.6; }
  .summary { background: #f5f4f1; border-radius: 8px; padding: 16px 20px; margin-bottom: 28px; display: flex; gap: 32px; align-items: center; }
  .summary-num { font-size: 26px; font-weight: 700; color: #002856; line-height: 1; }
  .summary-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-top: 4px; }
  .progress-bar-wrap { flex: 1; }
  .progress-bar { height: 8px; background: #e0ddd5; border-radius: 4px; overflow: hidden; margin-top: 8px; }
  .progress-fill { height: 100%; background: #2e7d55; border-radius: 4px; width: ${pct}%; }
  .progress-label { font-size: 11px; color: #555; margin-bottom: 4px; }
  .term-block { margin-bottom: 22px; break-inside: avoid; }
  .term-head { display: flex; justify-content: space-between; align-items: baseline; background: #002856; color: #fff; padding: 8px 14px; border-radius: 6px 6px 0 0; }
  .term-name { font-size: 14px; font-weight: 700; }
  .term-cr { font-size: 12px; opacity: 0.8; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f0eeea; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; padding: 7px 14px; font-weight: 600; }
  td { padding: 8px 14px; border-bottom: 1px solid #edecea; font-size: 13px; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:nth-child(even) { background: #fafaf8; }
  .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 10px; color: #999; text-align: center; }
  @media print {
    body { padding: 0; }
    .term-block { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page-header">
  <div class="logo">Rate<span class="my">My</span>TWU</div>
  <div class="meta">
    <div><strong>Degree Planner</strong></div>
    ${email ? `<div>${email}</div>` : ""}
    <div>Exported ${exportDate}</div>
  </div>
</div>

<div class="summary">
  <div>
    <div class="summary-num">${totalCredits}</div>
    <div class="summary-label">Credits planned</div>
  </div>
  <div>
    <div class="summary-num">${creditGoal}</div>
    <div class="summary-label">Credits to graduate</div>
  </div>
  <div class="progress-bar-wrap">
    <div class="progress-label">${pct}% to graduation</div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
  </div>
</div>

${termSections}

<div class="footer">Generated by RateMyTWU · ratemytwu.com</div>
</body>
</html>`
}

export default function ExportPDFModal({ cards, startYear, startTerm, creditGoal, email, onClose }) {
    // Build all available terms from the cards
    const allTerms = useMemo(() => {
        const seen = new Set()
        const terms = []
        cards.forEach(c => {
            const key = `${c.year}-${c.term}`
            if (!seen.has(key)) {
                seen.add(key)
                terms.push({ key, year: c.year, term: c.term, label: termLabel(c.year, c.term, startYear, startTerm) })
            }
        })
        // Sort: by year, then Fall(0) Spring(1) Summer(2) for Fall-start,
        // or Spring(0) Summer(1) Fall(2) for Spring-start
        const order = startTerm === "Fall"
            ? { Fall: 0, Spring: 1, Summer: 2 }
            : { Spring: 0, Summer: 1, Fall: 2 }
        return terms.sort((a, b) => a.year !== b.year ? a.year - b.year : (order[a.term] ?? 9) - (order[b.term] ?? 9))
    }, [cards, startYear, startTerm])

    const [selected, setSelected] = useState(new Set(allTerms.map(t => t.key)))

    const toggleTerm = (key) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(key) ? next.delete(key) : next.add(key)
            return next
        })
    }

    const toggleAll = () => {
        setSelected(selected.size === allTerms.length ? new Set() : new Set(allTerms.map(t => t.key)))
    }

    const handleExport = () => {
        const selectedCards = cards.filter(c => selected.has(`${c.year}-${c.term}`))
        const termMeta = Object.fromEntries(allTerms.map(t => [t.key, t.label]))
        const totalCredits = selectedCards.reduce((s, c) => s + (c.credits || 0), 0)

        const html = buildPrintHTML({ selectedCards, termMeta, email, totalCredits, creditGoal })
        const win = window.open("", "_blank", "width=860,height=700")
        if (!win) { alert("Please allow pop-ups to export PDF."); return }
        win.document.write(html)
        win.document.close()
        // Small delay so browser renders before print dialog opens
        setTimeout(() => { win.focus(); win.print() }, 300)
    }

    // Group terms by year for display
    const byYear = useMemo(() => {
        const map = {}
        allTerms.forEach(t => {
            if (!map[t.year]) map[t.year] = []
            map[t.year].push(t)
        })
        return Object.entries(map).map(([y, terms]) => ({ year: Number(y), terms }))
    }, [allTerms])

    return (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>
                <div className={styles.head}>
                    <h2 className={styles.title}>Export planner as PDF</h2>
                    <button className={styles.close} onClick={onClose} aria-label="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.body}>
                    <p className={styles.hint}>
                        Select the terms to include. A print dialog will open — choose <strong>Save as PDF</strong> to download.
                    </p>

                    <div className={styles.selectAllRow}>
                        <label className={styles.checkLabel}>
                            <input
                                type="checkbox"
                                checked={selected.size === allTerms.length}
                                onChange={toggleAll}
                            />
                            Select all terms
                        </label>
                        <span className={styles.countBadge}>{selected.size} of {allTerms.length} selected</span>
                    </div>

                    <div className={styles.termList}>
                        {byYear.map(({ year, terms }) => (
                            <div key={year} className={styles.yearGroup}>
                                <div className={styles.yearLabel}>Year {year}</div>
                                {terms.map(t => {
                                    const cardCount = cards.filter(c => c.year === t.year && c.term === t.term).length
                                    const credits = cards.filter(c => c.year === t.year && c.term === t.term).reduce((s, c) => s + (c.credits || 0), 0)
                                    return (
                                        <label key={t.key} className={`${styles.termRow} ${selected.has(t.key) ? styles.termRowSel : ""}`}>
                                            <input
                                                type="checkbox"
                                                checked={selected.has(t.key)}
                                                onChange={() => toggleTerm(t.key)}
                                            />
                                            <span className={styles.termName}>{t.label}</span>
                                            <span className={styles.termMeta}>{cardCount} course{cardCount !== 1 ? "s" : ""} · {credits} cr</span>
                                        </label>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    <button
                        className={styles.exportBtn}
                        onClick={handleExport}
                        disabled={selected.size === 0}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        Export {selected.size} term{selected.size !== 1 ? "s" : ""}
                    </button>
                </div>
            </div>
        </div>
    )
}
