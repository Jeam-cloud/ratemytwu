// Applies a parsed checklist (from /user/parse-checklist) to the planner courses:
// classifies each course into core / major / ancillary / elective and writes the
// result to the same localStorage the checklist tab reads.

import { CORE_GROUPS } from "../data/coreChecklist"

const STORE_KEY = "rmtwu_checklist_v2"

// Every course the universal Core can absorb — these are left unplaced so the
// checklist tab's own Core auto-fill handles them.
const CORE_ELIGIBLE = new Set(
    CORE_GROUPS.flatMap(g => g.subgroups.flatMap(sg => sg.slots.flatMap(s => s.eligible)))
)

const levelOf = code => {
    const m = String(code || "").match(/(\d{3})/)
    return m ? Number(m[1]) : 0
}

// Returns "ancillary" | "major" | "electives", or null when the course belongs
// to Core (handled by auto-fill).
//
// Many real checklists have MORE THAN ONE section tagged "major" (e.g. a
// program with "Required Courses" + "Specialization Courses" + "Stream
// Courses" are all classified "major" by the backend parser since none of
// them say "ancillary"/"elective"/"core" in the title). Only checking the
// first major/ancillary section silently dropped everything after it, so
// this checks every section of each kind instead of just the first.
export function classifyCourse(code, template) {
    if (CORE_ELIGIBLE.has(code)) return null

    const majorSections = template.sections.filter(s => s.key === "major")
    const ancSections   = template.sections.filter(s => s.key === "ancillary")

    for (const anc of ancSections) {
        if (anc.required?.includes(code)) return "ancillary"
    }
    for (const major of majorSections) {
        if (major.required?.includes(code) || major.choose?.includes(code)) return "major"
        if (major.electivePrefix &&
            code.toUpperCase().startsWith(major.electivePrefix.toUpperCase()) &&
            levelOf(code) >= (major.electiveMinLevel || 130)) return "major"
    }
    return "electives"
}

// Counts how each planner course would sort — used for the import preview.
export function previewCounts(template, cards) {
    const seen = new Set()
    const counts = { core: 0, major: 0, ancillary: 0, electives: 0 }
    for (const c of cards) {
        if (!c.code || seen.has(c.code)) continue
        seen.add(c.code)
        const t = classifyCourse(c.code, template)
        counts[t || "core"] += 1
    }
    return counts
}

// Writes the auto-sorted placements + the parsed template to localStorage.
// Keeps any "satisfied" toggles the student already set.
export function applyChecklistImport(template, cards) {
    const seen = new Set()
    const placements = {}
    for (const c of cards) {
        if (!c.code || seen.has(c.code)) continue
        seen.add(c.code)
        const target = classifyCourse(c.code, template)
        if (target) placements[c.code] = target // null (core) → leave for auto-fill
    }

    let prev = {}
    try { prev = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") } catch (_) {}

    const next = { placements, satisfied: prev.satisfied || {}, template }
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
    return next
}
