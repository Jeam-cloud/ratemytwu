import { useState, useEffect, useRef } from "react"
import Layout from "../../components/Layout"
import { API_URL } from "../../config"
import staticStyles from "../../css/StaticPage.module.css"
import styles from "../../css/ReportForm.module.css"

// Four distinct report paths, kept deliberately separate rather than funneled
// into one generic form:
//   - wrong_info / professor_takedown / bug  -> real forms below, POST /reports
//   - "inappropriate review"                 -> NOT a form here at all; that's
//     the existing per-review Report button (ReviewFlag), so this card just
//     explains where to find it instead of duplicating the flow.
const categories = [
    {
        key: "wrong_info",
        heading: "Wrong or outdated info",
        text: "A professor's department is wrong, a course code is off, or something else looks inaccurate.",
        cta: "Report wrong info",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
        ),
    },
    {
        key: "inappropriate_review",
        heading: "Inappropriate review",
        text: "A review contains personal attacks, identifying information, or content that violates our community standards.",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        ),
        // no form — handled separately
    },
    {
        key: "professor_takedown",
        heading: "Professor takedown request",
        text: "You're a professor and want your profile removed from RateMyTWU. We'll process your request within 5 business days.",
        cta: "Request takedown",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
        ),
    },
    {
        key: "bug",
        heading: "Bug or broken feature",
        text: "Something on the site isn't working right — a page that won't load, a form that errors, or anything else that seems broken.",
        cta: "Report a bug",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <path d="M12 12v4" /><path d="M10 14h4" />
            </svg>
        ),
    },
]

// Typeahead against the same GET /professor search endpoint the main search
// bar uses. Takedown requests MUST resolve to a real professor_id - a
// professor reporting themselves always knows who they are, so there's no
// legitimate case for letting this fall back to unlinked free text (that's
// exactly the bug that let two takedown requests resolve to "approved"
// without ever hiding a profile).
function ProfessorPicker({ selected, onSelect, onClear }) {
    const [query, setQuery] = useState("")
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [open, setOpen] = useState(false)
    const debounceRef = useRef(null)

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (query.trim().length < 2) {
            setResults([])
            return
        }
        debounceRef.current = setTimeout(async () => {
            setSearching(true)
            try {
                const res = await fetch(`${API_URL}/professor/?search_professor=${encodeURIComponent(query.trim())}`)
                if (res.ok) setResults(await res.json())
            } catch {
                // silent - typeahead, not a form submission
            } finally {
                setSearching(false)
            }
        }, 300)
        return () => clearTimeout(debounceRef.current)
    }, [query])

    if (selected) {
        return (
            <div className={styles.pickerSelected}>
                <span>{selected.name}</span>
                <button type="button" className={styles.pickerClear} onClick={onClear}>Change</button>
            </div>
        )
    }

    return (
        <div className={styles.pickerWrap}>
            <input
                className={styles.input}
                type="text"
                placeholder="Start typing your name…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
            {open && query.trim().length >= 2 && (
                <div className={styles.pickerDropdown}>
                    {searching ? (
                        <p className={styles.pickerEmpty}>Searching…</p>
                    ) : results.length === 0 ? (
                        <p className={styles.pickerEmpty}>No matching professor found. Check the spelling of your name as listed on the site.</p>
                    ) : (
                        results.map((p) => (
                            <button
                                type="button"
                                key={p.id}
                                className={styles.pickerOption}
                                onMouseDown={() => { onSelect(p); setQuery(""); setResults([]) }}
                            >
                                <span className={styles.pickerOptionName}>{p.name}</span>
                                <span className={styles.pickerOptionDept}>{p.department}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

// Matches the two outcomes an operator can actually choose from the admin
// takedown queue ("Hide profile" vs "Delete permanently") - collected up
// front here instead of making the operator infer it from free text, and
// what the Privacy Policy's "Professor data" section promises we'll ask for.
const TAKEDOWN_ACTIONS = [
    { key: "hide", label: "Hide my profile", desc: "Removed from every public page immediately. Reversible — we keep the underlying records internally for moderation and legal record-keeping." },
    { key: "delete", label: "Delete everything permanently", desc: "My profile and every review on it are erased from the database entirely. Cannot be undone." },
]

function ReportModal({ category, onClose }) {
    const [email, setEmail] = useState("")
    const [selectedProfessor, setSelectedProfessor] = useState(null)
    const [courseCode, setCourseCode] = useState("")
    const [description, setDescription] = useState("")
    const [takedownAction, setTakedownAction] = useState("hide")
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const isTakedown = category.key === "professor_takedown"
    const isWrongInfo = category.key === "wrong_info"

    const submit = async () => {
        if (submitting) return
        setError("")

        if (!email.trim() || !email.includes("@")) {
            setError("Enter a valid email so we can follow up."); return
        }
        if (isTakedown && !email.trim().toLowerCase().endsWith("@twu.ca")) {
            setError("Takedown requests must be submitted from your @twu.ca email address so we can verify you're the professor in question."); return
        }
        if (isTakedown && !selectedProfessor) {
            setError("Select your name from the dropdown so we can find the right profile."); return
        }
        if (description.trim().length < 10) {
            setError("Please add a bit more detail (10+ characters)."); return
        }

        // Requested action isn't its own column on site_reports - folded into
        // the description as a clearly-labeled first line so the operator sees
        // it immediately in the admin queue without a schema change.
        const finalDescription = isTakedown
            ? `Requested action: ${takedownAction === "delete" ? "Delete everything permanently" : "Hide profile (reversible)"}\n\n${description.trim()}`
            : description.trim()

        setSubmitting(true)
        try {
            const res = await fetch(`${API_URL}/reports/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category: category.key,
                    contact_email: email.trim(),
                    professor_id: selectedProfessor?.id ?? null,
                    course_code: courseCode.trim() || null,
                    description: finalDescription,
                }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                setError(body.detail || "Something went wrong submitting your report.")
                return
            }
            setSubmitted(true)
        } catch (e) {
            setError("Something went wrong submitting your report.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className={styles.overlay} onClick={() => !submitting && onClose()}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.close} onClick={onClose} aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>

                {submitted ? (
                    <div className={styles.success}>
                        <div className={styles.successCheck}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m5 12 5 5 9-11" />
                            </svg>
                        </div>
                        <h3 className={styles.successTitle}>Report submitted</h3>
                        <p className={styles.successText}>
                            {isTakedown
                                ? "We'll verify and process your takedown request within 5 business days."
                                : "Thanks — we'll take a look and follow up by email if needed."}
                        </p>
                        <button className={styles.submitBtn} onClick={onClose}>Close</button>
                    </div>
                ) : (
                    <>
                        <h3 className={styles.title}>{category.heading}</h3>
                        <p className={styles.subtitle}>{category.text}</p>

                        {error && <p className={styles.error}>{error}</p>}

                        <div className={styles.field}>
                            <label className={styles.label}>
                                Your email {isTakedown && <span className={styles.hint}>(must be @twu.ca)</span>}
                            </label>
                            <input
                                className={styles.input}
                                type="email"
                                placeholder={isTakedown ? "you@twu.ca" : "you@example.com"}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        {isTakedown && (
                            <div className={styles.field}>
                                <label className={styles.label}>Your name, as listed on your profile</label>
                                <ProfessorPicker
                                    selected={selectedProfessor}
                                    onSelect={setSelectedProfessor}
                                    onClear={() => setSelectedProfessor(null)}
                                />
                                <p className={styles.pickerHint}>
                                    Can't find yourself? Your profile may not exist yet — reach out via the contact page instead.
                                </p>
                            </div>
                        )}

                        {isTakedown && (
                            <div className={styles.field}>
                                <label className={styles.label}>What would you like us to do?</label>
                                <div className={styles.radioGroup}>
                                    {TAKEDOWN_ACTIONS.map(a => (
                                        <label
                                            key={a.key}
                                            className={`${styles.radioOption} ${takedownAction === a.key ? styles.radioOptionSel : ""}`}
                                        >
                                            <input
                                                type="radio"
                                                name="takedownAction"
                                                checked={takedownAction === a.key}
                                                onChange={() => setTakedownAction(a.key)}
                                            />
                                            <span>
                                                <span className={styles.radioLabel}>{a.label}</span>
                                                <span className={styles.radioDesc}>{a.desc}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isWrongInfo && (
                            <div className={styles.field}>
                                <label className={styles.label}>
                                    Course code <span className={styles.hint}>(optional)</span>
                                </label>
                                <input
                                    className={styles.input}
                                    type="text"
                                    placeholder="e.g. CMPT 166"
                                    value={courseCode}
                                    onChange={(e) => setCourseCode(e.target.value)}
                                />
                            </div>
                        )}

                        <div className={styles.field}>
                            <label className={styles.label}>
                                {isTakedown ? "Anything else we should know" : "Details"}
                            </label>
                            <textarea
                                className={styles.textarea}
                                rows={4}
                                placeholder={
                                    isTakedown
                                        ? "Optional — let us know if there's anything specific you'd like us to be aware of."
                                        : isWrongInfo
                                            ? "What's wrong, and what should it say instead?"
                                            : "What happened, and what page were you on?"
                                }
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <button
                            className={styles.submitBtn}
                            onClick={submit}
                            disabled={submitting || (isTakedown && !selectedProfessor)}
                        >
                            {submitting ? "Submitting…" : "Submit report"}
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

export default function ReportPage() {
    const [openCategory, setOpenCategory] = useState(null)

    return (
        <Layout>
            <div className={staticStyles.page}>
                <div className={staticStyles.hero}>
                    <p className={staticStyles.kicker}>Report</p>
                    <h1 className={staticStyles.title}>Something look off?</h1>
                    <p className={staticStyles.subtitle}>
                        Help us keep RateMyTWU accurate and respectful. Pick the category below that
                        matches what you need — each goes to the right place.
                    </p>
                </div>

                <div className={staticStyles.section}>
                    <h2 className={staticStyles.sectionTitle}>What can I report?</h2>
                    <div className={staticStyles.grid}>
                        {categories.map((cat) => (
                            <div key={cat.key} className={staticStyles.infoCard}>
                                <div className={staticStyles.infoIcon}>{cat.icon}</div>
                                <p className={staticStyles.infoHeading}>{cat.heading}</p>
                                <p className={staticStyles.infoText}>{cat.text}</p>

                                {cat.key === "inappropriate_review" ? (
                                    <p className={styles.inlineHint}>
                                        Found a review like this? Open the professor's page and use the
                                        <strong> Report</strong> button under that review — it goes straight
                                        into our moderation queue.
                                    </p>
                                ) : (
                                    <button className={styles.cardBtn} onClick={() => setOpenCategory(cat)}>
                                        {cat.cta}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {openCategory && (
                <ReportModal category={openCategory} onClose={() => setOpenCategory(null)} />
            )}
        </Layout>
    )
}
