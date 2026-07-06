// Client-side "export checklist as PDF": rebuilds the checklist from the same
// localStorage state the tab uses, renders a print-friendly HTML doc, and opens
// the browser print dialog (mirrors ExportPDFModal for the planner).

import { CORE_GROUPS } from "../data/coreChecklist"

const STORE_KEY        = "rmtwu_checklist_v2"
const PROG_KEY          = "rmtwu_major_program"
const YEAR_KEY          = "rmtwu_major_calendar_year"
const MINOR_STORE_KEY   = "rmtwu_minor_checklist"
const ATTACH_STORE_KEY  = "rmtwu_attached_concentrations"
const CORE_SLOTS = CORE_GROUPS.flatMap(g =>
    g.subgroups.flatMap(sg => sg.slots.map(s => ({ ...s, groupId: g.id })))
)
const CORE_CREDITS_TARGET = 43 // University Core — fixed across all TWU programs

function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") } catch (_) { return {} }
}

function loadMinorTemplate() {
    try {
        const raw = localStorage.getItem(MINOR_STORE_KEY)
        return raw ? JSON.parse(raw) : null
    } catch (_) { return null }
}

// Mirrors ChecklistTab's concentrationTemplate: every checklist attached to
// the CURRENT major+year, combined into one synthetic template with a real
// totalCredits — same scoping key so this only picks up whatever's actually
// attached to the major that's currently active, not a stale one.
function loadConcentrationTemplate(template) {
    try {
        const store = JSON.parse(localStorage.getItem(ATTACH_STORE_KEY) || "{}")
        const savedMajorName     = localStorage.getItem(PROG_KEY) || ""
        const savedCalendarYear  = localStorage.getItem(YEAR_KEY) || ""
        const currentProgram     = savedMajorName || template?.program || ""
        const currentCalendarYear = savedCalendarYear || template?.calendarYear || ""
        const majorSignature = `${currentProgram}::${currentCalendarYear}`
        const attached = Object.values(store[majorSignature] || {})
        if (attached.length === 0) return null
        const totalCredits = attached.reduce((sum, p) => sum + (p?.totalCredits || 0), 0) || 30
        return { totalCredits }
    } catch (_) { return null }
}

// Resolve each course to a target the same way the tab does.
function resolve(cards, placements) {
    const seen = new Set(); const courses = []
    for (const c of cards) if (c.code && !seen.has(c.code)) { seen.add(c.code); courses.push(c) }

    const assignment = {}; const used = {}
    const bump = id => { used[id] = (used[id] || 0) + 1 }
    for (const c of courses) {
        const p = placements[c.code]
        if (p !== undefined) { assignment[c.code] = p; if (CORE_SLOTS.some(s => s.id === p)) bump(p) }
    }
    for (const c of courses) {
        if (assignment[c.code] !== undefined) continue
        const slot = CORE_SLOTS.find(s => s.eligible.includes(c.code) && (used[s.id] || 0) < s.capacity)
        if (slot) { assignment[c.code] = slot.id; bump(slot.id) }
        else assignment[c.code] = "pool"
    }
    return { courses, assignment }
}

function esc(s) {
    return String(s).replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]))
}

function buildHTML(cards) {
    const { placements = {}, satisfied = {}, template } = loadState()
    const { courses, assignment } = resolve(cards, placements)
    const creditOf = code => courses.find(c => c.code === code)?.credits || 0
    const inTarget = t => courses.filter(c => assignment[c.code] === t)

    const minorTemplate = loadMinorTemplate()
    const concentrationTemplate = loadConcentrationTemplate(template)

    // Major/Ancillary targets used to be hardcoded to 42/9 regardless of
    // which major was active — same bug fixed in ChecklistTab.jsx. Sum the
    // real per-major credit totals from the parsed template instead.
    const majorCredits = (template?.sections || [])
        .filter(s => s.key === "major").reduce((a, s) => a + (s.credits || 0), 0) || 42
    const ancillaryCredits = (template?.sections || [])
        .filter(s => s.key === "ancillary").reduce((a, s) => a + (s.credits || 0), 0) || 9
    const electivesRemaining = template?.totalCredits
        ? template.totalCredits - CORE_CREDITS_TARGET - majorCredits - ancillaryCredits
        : 0
    const electivesCredits = electivesRemaining > 0 ? electivesRemaining : 28
    const SECTION_TARGET = {
        core: CORE_CREDITS_TARGET,
        major: majorCredits,
        ancillary: ancillaryCredits,
        minor: minorTemplate?.totalCredits || 24,
        concentration: concentrationTemplate?.totalCredits || 30,
        electives: electivesCredits,
    }

    // ── Core groups ──
    const coreHTML = CORE_GROUPS.map(g => {
        const rows = g.subgroups.map(sg => {
            const slotRows = sg.slots.map(slot => {
                const placed = inTarget(slot.id).map(c => c.code)
                const isSat = !!satisfied[slot.id]
                const mark = isSat || placed.length >= slot.capacity ? "✓" : placed.length ? "•" : "○"
                const fill = isSat ? "<em>satisfied</em>" : placed.length ? esc(placed.join(", ")) : "<span style='color:#aaa'>—</span>"
                return `<tr><td class="ck">${mark}</td><td>${esc(slot.label || sg.title)}</td><td>${fill}</td><td class="sh">${slot.credits || ""}</td></tr>`
            }).join("")
            return slotRows
        }).join("")
        return `<div class="block"><div class="bhead">${esc(g.title)}</div>
            <table><tbody>${rows}</tbody></table></div>`
    }).join("")

    // ── Bucket sections ──
    const bucket = (key, label) => {
        const list = inTarget(key)
        const sh = list.reduce((a, c) => a + (c.credits || 0), 0)
        const rows = list.length
            ? list.map(c => `<tr><td>${esc(c.code)}</td><td class="sh">${c.credits ?? ""}</td></tr>`).join("")
            : `<tr><td colspan="2" style="color:#aaa">—</td></tr>`
        return `<div class="block"><div class="bhead">${esc(label)} <span class="bcr">${sh} / ${SECTION_TARGET[key]} s.h.</span></div>
            <table><tbody>${rows}</tbody></table></div>`
    }

    const totalPlaced = courses.filter(c => assignment[c.code] !== "pool").reduce((a, c) => a + (c.credits || 0), 0)
    const date = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
    const prog = template?.program ? esc(template.program) : "Degree checklist"

    return `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>RateMyTWU — Checklist</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Helvetica Neue",Arial,sans-serif;color:#1a1a2e;padding:32px 40px;font-size:12.5px}
  .ph{display:flex;justify-content:space-between;border-bottom:2px solid #002856;padding-bottom:14px;margin-bottom:20px}
  .logo{font-size:20px;font-weight:700;color:#002856}.logo .my{color:#B89A54}
  .meta{font-size:11px;color:#666;text-align:right;line-height:1.6}
  .block{margin-bottom:16px;break-inside:avoid}
  .bhead{background:#002856;color:#fff;padding:7px 12px;font-weight:700;border-radius:5px 5px 0 0;display:flex;justify-content:space-between}
  .bcr{font-weight:400;opacity:.85}
  table{width:100%;border-collapse:collapse}
  td{padding:6px 12px;border-bottom:1px solid #edecea}
  tr:last-child td{border-bottom:none}
  .ck{width:26px;text-align:center;color:#2e7d55;font-weight:700}
  .sh{width:48px;text-align:right;color:#666;font-weight:700}
  .footer{margin-top:24px;border-top:1px solid #ddd;padding-top:10px;font-size:10px;color:#999;text-align:center}
  @media print{body{padding:0}.block{break-inside:avoid}}
</style></head><body>
<div class="ph"><div class="logo">Rate<span class="my">My</span>TWU</div>
  <div class="meta"><div><strong>${prog}</strong></div><div>${totalPlaced} / 122 s.h. placed</div><div>Exported ${date}</div></div></div>
${coreHTML}
${bucket("major", "Major")}
${bucket("ancillary", "Ancillary")}
${minorTemplate ? bucket("minor", "Minor") : ""}
${concentrationTemplate ? bucket("concentration", "Concentration") : ""}
${bucket("electives", "Electives")}
<div class="footer">Generated by RateMyTWU · ratemytwu.com</div>
</body></html>`
}

export function exportChecklistPDF(cards = []) {
    const html = buildHTML(cards)
    const win = window.open("", "_blank", "width=860,height=700")
    if (!win) { alert("Please allow pop-ups to export the checklist."); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
}
