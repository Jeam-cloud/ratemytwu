import { useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import styles from "../../css/TutorialOverlay.module.css"

// ── Step definitions ──────────────────────────────────────────────────────────
// key: matches data-tutorial="..." on the target element (null = centered modal)
// placement: where the tooltip card appears relative to the spotlight
const PLANNER_STEPS = [
    {
        key: null,
        title: "Welcome to your degree planner",
        body: "Plan every semester from now until graduation. Let's take a quick 30-second tour.",
        placement: "center",
    },
    {
        key: "import-btn",
        title: "Import your transcript",
        body: "Already have TWU credits? Upload your unofficial transcript PDF and we'll auto-fill your completed courses.",
        placement: "bottom",
    },
    {
        key: "export-btn",
        title: "Export your plan",
        body: "Download your full degree plan as a PDF to share with an advisor or keep for your records.",
        placement: "bottom",
    },
    {
        key: "edit-planner-btn",
        title: "Edit planner settings",
        body: "Change when you started, how many years you're studying, and how many credits you need to graduate.",
        placement: "bottom",
    },
    {
        key: "courses-nav",
        title: "Find courses to add",
        body: "Go to the Courses tab to search all TWU courses. Hit the bookmark icon on any course to save it to your planner.",
        placement: "bottom",
    },
    {
        key: "bookmark-panel",
        title: "Your bookmarked courses",
        body: "Courses you've bookmarked show up here. Once they're in this panel, they're ready to drag into a semester.",
        placement: "right",
    },
    {
        key: "board",
        title: "Drag courses into a semester",
        body: "Drop a course from the left panel into any semester column — including Summer if you plan to take summer courses.",
        placement: "top",
    },
]

// Checklist tab tour — mirrors the planner tour's structure/tone but points at
// the degree-checklist-specific UI (major bar, tabs, core groups, unsorted pool).
export const CHECKLIST_STEPS = [
    {
        key: null,
        title: "Welcome to your degree checklist",
        body: "See exactly what's left to graduate, organized the same way TWU's official checklist is. Let's take a quick tour.",
        placement: "center",
    },
    {
        key: "select-major",
        title: "Select major",
        body: "Search for your major here to auto-sort your planned courses into Core, Major, Ancillary, and Electives.",
        placement: "bottom",
    },
    {
        key: "select-minor",
        title: "Select minor",
        body: "Have a minor? Select it here — its courses get their own tab instead of being buried in Electives.",
        placement: "bottom",
    },
    {
        key: "select-concentration",
        title: "Select concentration",
        body: "Adding a concentration or specialization? Select it here — every student can add one, whether or not your major requires it.",
        placement: "bottom",
    },
    {
        key: "checklist-import-btn",
        title: "Import your major's checklist",
        body: "Already have the official checklist PDF from your advisor? Upload it here to import all your requirements at once.",
        placement: "bottom",
    },
    {
        key: "checklist-tabs",
        title: "Switch between sections",
        body: "Core, Major, Ancillary, Minor, Concentration, and Electives each get their own tab — tap one to see what's filled in.",
        placement: "bottom",
    },
    {
        key: "checklist-core",
        title: "Core requirements",
        body: "Every TWU student needs these. Drag a course into a slot, or use the ⋯ menu to mark one satisfied if your major already covers it.",
        placement: "top",
    },
    {
        key: "checklist-pool",
        title: "Your unsorted courses",
        body: "Anything that doesn't automatically match a requirement lands here — drag it into whichever section it actually belongs in.",
        placement: "top",
    },
]

const TOOLTIP_W = 310
const GAP = 14
const PAD = 8   // spotlight padding around the element

// Find the DOM element for a given step key
function findEl(key) {
    if (!key) return null
    if (key === "courses-nav") {
        return (
            document.querySelector('[data-tutorial="courses-nav"]') ||
            document.querySelector('a[href="/course"]')
        )
    }
    return document.querySelector(`[data-tutorial="${key}"]`)
}

// Get spotlight rect (with padding) from a DOM element
function getSpotRect(el) {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
        top:     r.top    - PAD,
        left:    r.left   - PAD,
        width:   r.width  + PAD * 2,
        height:  r.height + PAD * 2,
        centerX: r.left   + r.width  / 2,
        centerY: r.top    + r.height / 2,
        bottom:  r.bottom + PAD,
        right:   r.right  + PAD,
    }
}

// Compute tooltip card position based on spotlight rect + placement
const CARD_H_EST = 190  // estimated card height in px

function computeTooltipStyle(spot, placement) {
    if (placement === "center") return {}
    const vw = window.innerWidth
    const vh = window.innerHeight

    // No spot to anchor to (still measuring, or the skip-ahead above hasn't
    // committed its re-render yet) — fall back to a fixed, always-on-screen
    // position instead of returning {} and leaving top/left unset. An
    // unset position:fixed card falls back to its normal document-flow
    // position, which for a portaled element is often far below all page
    // content — invisible without scrolling, which is exactly what made the
    // tour look like it "just ends" with nothing to click.
    if (!spot) return { top: 90, left: Math.max(16, (vw - TOOLTIP_W) / 2) }

    let top, left

    switch (placement) {
        case "bottom":
            top  = spot.bottom + GAP
            left = Math.max(16, Math.min(spot.centerX - TOOLTIP_W / 2, vw - TOOLTIP_W - 16))
            // if card would overflow bottom, flip above
            if (top + CARD_H_EST > vh - 16) top = Math.max(16, spot.top - GAP - CARD_H_EST)
            break
        case "top":
            top  = spot.top - GAP - CARD_H_EST
            left = Math.max(16, Math.min(spot.centerX - TOOLTIP_W / 2, vw - TOOLTIP_W - 16))
            // if card would overflow top (navbar area), flip below instead
            if (top < 70) top = spot.bottom + GAP
            break
        case "right":
            top  = Math.max(80, Math.min(spot.top, vh - CARD_H_EST - 16))
            left = Math.min(spot.right + GAP, vw - TOOLTIP_W - 16)
            break
        case "left":
            top  = Math.max(80, Math.min(spot.top, vh - CARD_H_EST - 16))
            left = Math.max(16, spot.left - TOOLTIP_W - GAP)
            break
        default:
            top = 80; left = 80
    }

    return { top, left }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TutorialOverlay({ step, onNext, onPrev, onSkip, steps = PLANNER_STEPS }) {
    // Always keep a spot object — use `visible` flag to fade in/out
    // This way the div is never unmounted and CSS transitions always have
    // a "from" state to animate from (no snap-to-zero jitter)
    const [spot, setSpot] = useState({ top: 0, left: 0, width: 0, height: 0, visible: false })
    const current = steps[step]

    // useLayoutEffect runs synchronously after DOM mutations, before the browser
    // paints — eliminates the one-frame flash that useEffect would cause
    useLayoutEffect(() => {
        if (!current || current.placement === "center") {
            setSpot(s => ({ ...s, visible: false }))
            return
        }
        const el = findEl(current.key)
        if (!el) {
            // Target element doesn't exist — e.g. guest users never see the
            // Import/Export buttons at all, so those steps have nothing to
            // point at. Previously this just hid the spotlight while leaving
            // the full-page dimming backdrop up; the tooltip card (the only
            // way to advance/skip) also loses its computed position with no
            // spot to anchor to, so the whole tour silently soft-locked the
            // page for guests. Skip straight to the next step instead.
            onNext()
            return
        }

        const measure = () => {
            const r = el.getBoundingClientRect()
            // The element exists in the DOM but has zero size — e.g. it's
            // behind a `display: none` ancestor, or a step's key matched
            // something that hasn't actually laid out yet. A 0x0 spotlight
            // hole is invisible (the backdrop just looks like a flat dim
            // screen), and the tooltip card ends up with nothing valid to
            // anchor to, effectively soft-locking the tour the same way the
            // "element not found" case above already fixed. Treat it the
            // same way: skip straight to the next step.
            if (r.width === 0 && r.height === 0) { onNext(); return }
            setSpot({
                top:     r.top    - PAD,
                left:    r.left   - PAD,
                width:   r.width  + PAD * 2,
                height:  r.height + PAD * 2,
                centerX: r.left   + r.width  / 2,
                centerY: r.top    + r.height / 2,
                bottom:  r.bottom + PAD,
                right:   r.right  + PAD,
                visible: true,
            })
        }

        measure()

        // Only re-measure on resize (backdrop blocks scroll, so no scroll listener needed)
        window.addEventListener("resize", measure)
        return () => window.removeEventListener("resize", measure)
    }, [step, steps])

    if (step === null || step === undefined || !current) return null

    const isLast     = step === steps.length - 1
    const isCentered = current.placement === "center"
    const tipStyle   = isCentered ? {} : computeTooltipStyle(spot.visible ? spot : null, current.placement)

    return createPortal(
        <>
            {/* ── Dim backdrop (blocks all clicks on the page) ── */}
            <div className={styles.backdrop} onClick={(e) => e.stopPropagation()} />

            {/* ── Spotlight — always mounted so transitions have a "from" state ── */}
            <div
                className={styles.spotlight}
                style={{
                    top:     spot.top,
                    left:    spot.left,
                    width:   spot.width,
                    height:  spot.height,
                    opacity: spot.visible && !isCentered ? 1 : 0,
                }}
            />

            {/* ── Tooltip card ── */}
            <div
                className={`${styles.card} ${isCentered ? styles.cardCentered : ""}`}
                style={isCentered ? {} : { ...tipStyle, width: TOOLTIP_W }}
            >
                {/* Progress dots */}
                <div className={`${styles.dots} ${isCentered ? styles.dotsCentered : ""}`}>
                    {steps.map((_, i) => (
                        <span
                            key={i}
                            className={`${styles.dot} ${i === step ? styles.dotActive : i < step ? styles.dotDone : ""}`}
                        />
                    ))}
                </div>

                <h3 className={styles.cardTitle}>{current.title}</h3>
                <p  className={styles.cardBody}>{current.body}</p>

                <div className={styles.footer}>
                    <button className={styles.skipBtn} onClick={onSkip}>
                        Skip tour
                    </button>
                    <div className={styles.navBtns}>
                        {step > 0 && (
                            <button className={styles.prevBtn} onClick={onPrev}>
                                ← Back
                            </button>
                        )}
                        <button className={styles.nextBtn} onClick={onNext}>
                            {isLast ? "Get planning" : "Next →"}
                        </button>
                    </div>
                </div>
            </div>
        </>,
        document.body
    )
}
