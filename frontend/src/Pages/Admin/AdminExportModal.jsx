import { useState } from "react"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import styles from "../../css/ExportPDF.module.css"

// Same "let the browser's print dialog Save as PDF" approach as
// ExportPDFModal (planner export) and the old AdminAuditLog export - no new
// dependency, consistent with how the rest of the app produces PDFs.
// Unlike the planner export, this one pulls from four different tables
// (review flags, and the three site_report categories), so each section is
// fetched fresh at export time rather than built from data already on screen.
const SECTIONS = [
    { key: "review_flags", label: "Review flags", desc: "Reports resolved on the per-review flag queue (kept / removed).", endpoint: "/admin/flags?status=resolved" },
    { key: "professor_takedown", label: "Professor takedowns", desc: "Resolved takedown requests — hidden, deleted, or dismissed.", endpoint: "/admin/reports?category=professor_takedown&status=resolved" },
    { key: "wrong_info", label: "Wrong info reports", desc: "Resolved corrections to professor/course details.", endpoint: "/admin/reports?category=wrong_info&status=resolved" },
    { key: "bug", label: "Bug reports", desc: "Resolved bug/broken-feature reports.", endpoint: "/admin/reports?category=bug&status=resolved" },
]

function escapeHtml(str) {
    if (!str) return ""
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
}

function fmtDate(d) {
    return d ? new Date(d).toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—"
}

function buildFlagSection(entries) {
    if (entries.length === 0) return `<p class="empty">No resolved review flags.</p>`
    return entries.map(e => `
        <div class="entry">
            <div class="entry-top">
                <span class="tag ${e.resolution === "removed" ? "tag-removed" : "tag-kept"}">${escapeHtml(e.resolution)}</span>
                <span class="reason">${escapeHtml(e.reason)}</span>
                <span class="date">${fmtDate(e.resolved_at)}</span>
            </div>
            <div class="context"><strong>${escapeHtml(e.professor_name)}</strong> · ${escapeHtml(e.course_code)}</div>
            <p class="review">&ldquo;${escapeHtml(e.review_text)}&rdquo;</p>
            ${e.resolution_note ? `<p class="note">Note: ${escapeHtml(e.resolution_note)}</p>` : ""}
        </div>
    `).join("")
}

function buildReportSection(entries) {
    if (entries.length === 0) return `<p class="empty">No resolved reports in this category.</p>`
    return entries.map(e => `
        <div class="entry">
            <div class="entry-top">
                <span class="tag ${e.resolution === "deleted" ? "tag-removed" : e.resolution === "approved" ? "tag-approved" : "tag-kept"}">${escapeHtml(e.resolution)}</span>
                <span class="date">${fmtDate(e.resolved_at)}</span>
            </div>
            ${e.professor_name ? `<div class="context"><strong>${escapeHtml(e.professor_name)}</strong>${e.course_code ? ` · ${escapeHtml(e.course_code)}` : ""}</div>` : ""}
            <div class="context">${escapeHtml(e.contact_email)}</div>
            <p class="review">${escapeHtml(e.description)}</p>
            ${e.resolution_note ? `<p class="note">Note: ${escapeHtml(e.resolution_note)}</p>` : ""}
        </div>
    `).join("")
}

export default function AdminExportModal({ onClose }) {
    const [selected, setSelected] = useState(new Set(SECTIONS.map(s => s.key)))
    const [exporting, setExporting] = useState(false)
    const [error, setError] = useState("")

    const toggle = (key) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(key) ? next.delete(key) : next.add(key)
            return next
        })
    }

    const toggleAll = () => {
        setSelected(selected.size === SECTIONS.length ? new Set() : new Set(SECTIONS.map(s => s.key)))
    }

    const handleExport = async () => {
        if (selected.size === 0 || exporting) return
        setExporting(true)
        setError("")
        try {
            const { data } = await supabase.auth.getSession()
            const token = data.session?.access_token
            if (!token) throw new Error("Not signed in")
            const headers = { "Authorization": `Bearer ${token}` }

            const chosen = SECTIONS.filter(s => selected.has(s.key))
            const results = await Promise.all(
                chosen.map(async (s) => {
                    const res = await fetch(`${API_URL}${s.endpoint}`, { headers })
                    if (!res.ok) throw new Error(`Couldn't load "${s.label}"`)
                    return { section: s, entries: await res.json() }
                })
            )

            const exportDate = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
            const totalCount = results.reduce((sum, r) => sum + r.entries.length, 0)

            const sectionsHtml = results.map(({ section, entries }) => `
                <div class="section-block">
                    <div class="section-head">
                        <span class="section-name">${escapeHtml(section.label)}</span>
                        <span class="section-count">${entries.length} entr${entries.length === 1 ? "y" : "ies"}</span>
                    </div>
                    ${section.key === "review_flags" ? buildFlagSection(entries) : buildReportSection(entries)}
                </div>
            `).join("")

            const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>RateMyTWU — Admin Audit Export</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 32px 40px; font-size: 12px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #002856; padding-bottom: 16px; }
  .logo { font-size: 20px; font-weight: 700; color: #002856; letter-spacing: -0.02em; }
  .logo .my { color: #B89A54; }
  .meta { font-size: 11px; color: #666; text-align: right; line-height: 1.6; }
  .summary { font-size: 11px; color: #555; margin-bottom: 24px; }
  .section-block { margin-bottom: 26px; break-inside: avoid; }
  .section-head { display: flex; justify-content: space-between; align-items: baseline; background: #002856; color: #fff; padding: 8px 14px; border-radius: 6px 6px 0 0; margin-bottom: 8px; }
  .section-name { font-size: 13px; font-weight: 700; }
  .section-count { font-size: 11px; opacity: 0.8; }
  .empty { font-size: 12px; color: #888; padding: 10px 4px; font-style: italic; }
  .entry { border: 1px solid #e0ddd5; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; break-inside: avoid; }
  .entry-top { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
  .tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; border-radius: 4px; padding: 2px 7px; }
  .tag-removed { background: #c0392b; color: #fff; }
  .tag-kept { background: #f0eeea; color: #1a1a2e; }
  .tag-approved { background: #92400e; color: #fff; }
  .reason { font-size: 11px; color: #777; }
  .date { font-size: 11px; color: #777; margin-left: auto; }
  .context { font-size: 12px; color: #333; margin-bottom: 4px; }
  .review { font-size: 12px; color: #444; font-style: italic; line-height: 1.5; margin-bottom: 4px; }
  .note { font-size: 12px; color: #1a1a2e; }
  .footer { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 10px; color: #999; text-align: center; }
  @media print { body { padding: 0; } .entry, .section-block { break-inside: avoid; } }
</style>
</head>
<body>
<div class="page-header">
  <div class="logo">Rate<span class="my">My</span>TWU</div>
  <div class="meta">
    <div><strong>Admin Audit Export</strong></div>
    <div>Exported ${exportDate}</div>
  </div>
</div>
<div class="summary">${results.length} section${results.length === 1 ? "" : "s"} · ${totalCount} total entr${totalCount === 1 ? "y" : "ies"}</div>
${sectionsHtml}
<div class="footer">Generated by RateMyTWU · ratemytwu.com</div>
</body>
</html>`

            const win = window.open("", "_blank", "width=860,height=700")
            if (!win) { setError("Please allow pop-ups to export as a PDF."); return }
            win.document.write(html)
            win.document.close()
            setTimeout(() => { win.focus(); win.print() }, 300)
            onClose()
        } catch (e) {
            setError(e.message || "Something went wrong building the export.")
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && !exporting && onClose()}>
            <div className={styles.modal}>
                <div className={styles.head}>
                    <h2 className={styles.title}>Export audit log as PDF</h2>
                    <button className={styles.close} onClick={onClose} aria-label="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.body}>
                    <p className={styles.hint}>
                        Choose which sections to include. Each is pulled fresh from the resolved queue —
                        a print dialog will open when ready, choose <strong>Save as PDF</strong> to download.
                    </p>

                    {error && <p className={styles.hint} style={{ color: "var(--negative)" }}>{error}</p>}

                    <div className={styles.selectAllRow}>
                        <label className={styles.checkLabel}>
                            <input
                                type="checkbox"
                                checked={selected.size === SECTIONS.length}
                                onChange={toggleAll}
                            />
                            Select all sections
                        </label>
                        <span className={styles.countBadge}>{selected.size} of {SECTIONS.length} selected</span>
                    </div>

                    <div className={styles.termList}>
                        {SECTIONS.map(s => (
                            <label key={s.key} className={`${styles.sectionRow} ${selected.has(s.key) ? styles.sectionRowSel : ""}`}>
                                <input
                                    type="checkbox"
                                    checked={selected.has(s.key)}
                                    onChange={() => toggle(s.key)}
                                />
                                <span className={styles.sectionRowBody}>
                                    <span className={styles.sectionRowName}>{s.label}</span>
                                    <span className={styles.sectionRowDesc}>{s.desc}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose} disabled={exporting}>Cancel</button>
                    <button
                        className={styles.exportBtn}
                        onClick={handleExport}
                        disabled={selected.size === 0 || exporting}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        {exporting ? "Preparing…" : `Export ${selected.size} section${selected.size !== 1 ? "s" : ""}`}
                    </button>
                </div>
            </div>
        </div>
    )
}
