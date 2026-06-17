import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"

import SearchBarProf from "../../components/SearchBarProf"
import SearchBarCourse from "../../components/SearchBarCourse"
import Footer from "../../design-components/Footer"
import Layout from "../../components/Layout"
import styles from "../../css/HomeProf.module.css"

export default function HomeProf() {
    const [searchParam] = useSearchParams()
    const [mode, setMode] = useState(
        searchParam.get("mode") === "course" ? "course" : "professor"
    )
    const heroRef = useRef(null)
    const firstLoad = useRef(true)

    // keep the hero toggle in sync with the ?mode= param so the navbar
    // Professors/Courses links flip it live (instead of only on remount)
    useEffect(() => {
        const next = searchParam.get("mode") === "course" ? "course" : "professor"
        setMode(next)
        // on a navbar click while already here, nudge the user to the search
        if (!firstLoad.current && heroRef.current) {
            heroRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        firstLoad.current = false
    }, [searchParam])

    return (
        <>
            <Layout fullBleed>
                {/* ── Hero ── */}
                <section className={styles.hero} ref={heroRef}>
                    <div className={styles.heroPhoto} />
                    <div className={styles.heroScrim} />

                    <div className={styles.heroInner}>
                        <h1 className={styles.heroTitle}>
                            Rate professors. Find courses.
                            <br />
                            <span className={styles.heroAccent}>Plan your degree.</span>
                        </h1>

                        <p className={styles.heroSub}>
                            The course &amp; professor guide for Trinity Western. Read honest
                            reviews and plan your semester before you register.
                        </p>

                        {mode === "professor" ? <SearchBarProf /> : <SearchBarCourse />}

                        <div className={styles.segmented} role="tablist">
                            <button
                                role="tab"
                                aria-selected={mode === "professor"}
                                className={`${styles.segBtn} ${mode === "professor" ? styles.segActive : ""}`}
                                onClick={() => setMode("professor")}
                            >
                                Professors
                            </button>
                            <button
                                role="tab"
                                aria-selected={mode === "course"}
                                className={`${styles.segBtn} ${mode === "course" ? styles.segActive : ""}`}
                                onClick={() => setMode("course")}
                            >
                                Courses
                            </button>
                        </div>
                    </div>

                    <div className={styles.scrollCue}>
                        <span>SCROLL</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </div>
                </section>

                {/* ── Three pillars ── */}
                <section className={styles.pillars}>
                    <div className={styles.pillarsGrid}>
                        {[
                            {
                                title: "Rate professors",
                                body: "Honest ratings on difficulty, workload, and would-take-again — written by students who actually took the class.",
                                icon: (
                                    <path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
                                ),
                            },
                            {
                                title: "Find courses",
                                body: "Search any course to see who teaches it this semester and what students said about each section.",
                                icon: (
                                    <>
                                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z" />
                                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z" />
                                    </>
                                ),
                            },
                            {
                                title: "Plan your semester",
                                body: "Bookmark courses, drag them into a multi-year planner, and watch your credits add up toward graduation.",
                                icon: (
                                    <>
                                        <rect x="3" y="4" width="18" height="18" rx="2" />
                                        <path d="M16 2v4M8 2v4M3 10h18" />
                                    </>
                                ),
                            },
                        ].map((p) => (
                            <article key={p.title} className={styles.pillar}>
                                <div className={styles.pillarIcon}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        {p.icon}
                                    </svg>
                                </div>
                                <h3 className={styles.pillarTitle}>{p.title}</h3>
                                <p className={styles.pillarBody}>{p.body}</p>
                            </article>
                        ))}
                    </div>
                </section>

                {/* ── Feature band: Professors (navy) ── */}
                <section className={`${styles.band} ${styles.bandNavy}`}>
                    <div className={styles.bandInner}>
                        <div className={styles.bandText}>
                            <span className={styles.kicker}>Professors</span>
                            <h2 className={styles.bandTitle}>Know your prof before day one</h2>
                            <p className={styles.bandBody}>
                                Professor pages summarize real student reviews — overall rating,
                                difficulty, and would-take-again — plus the courses they teach this
                                semester.
                            </p>
                            <a className={styles.bandLink} href="/professor">Browse professors →</a>
                        </div>
                        <div className={`${styles.shot} ${styles.shotOnNavy}`}>
                            <span className={styles.shotLabel}>Professor detail page</span>
                            <span className={styles.shotMeta}>4 : 3 screenshot slot</span>
                        </div>
                    </div>
                </section>

                {/* ── Feature band: Courses (cream) ── */}
                <section className={`${styles.band} ${styles.bandCream}`}>
                    <div className={styles.bandInner}>
                        <div className={styles.shot}>
                            <span className={styles.shotLabel}>Course &amp; professors page</span>
                            <span className={styles.shotMeta}>4 : 3 screenshot slot</span>
                        </div>
                        <div className={styles.bandText}>
                            <span className={styles.kickerBlue}>Courses</span>
                            <h2 className={styles.bandTitleDark}>Search any course, see who's teaching</h2>
                            <p className={styles.bandBodyDark}>
                                Looking up a course shows every professor offering it this semester,
                                side by side, with their ratings — so you can pick the section that
                                fits you.
                            </p>
                            <a className={styles.bandLinkBlue} href="/course">Browse courses →</a>
                        </div>
                    </div>
                </section>

                {/* ── Planner spotlight (navy) ── */}
                <section className={`${styles.band} ${styles.bandNavy}`}>
                    <div className={styles.bandInner}>
                        <div className={styles.bandText}>
                            <span className={styles.kicker}>Planner</span>
                            <h2 className={styles.bandTitle}>
                                Plan your <em className={styles.titleAccent}>whole degree</em>
                            </h2>
                            <p className={styles.bandBody}>
                                Drag bookmarked courses into a multi-year planner and watch your
                                credits add up term by term — so you know exactly what's left before
                                graduation.
                            </p>
                            <a className={styles.bandLink} href="/dashboard">See the planner →</a>
                        </div>
                        <div className={`${styles.shot} ${styles.shotOnNavy}`}>
                            <span className={styles.shotLabel}>Dashboard planner</span>
                            <span className={styles.shotMeta}>4 : 3 screenshot slot</span>
                        </div>
                    </div>
                </section>

                {/* ── Trust / stats band (cream) ── */}
                <section className={styles.trust}>
                    <span className={styles.kickerBlue}>For Trinity Western</span>
                    <h2 className={styles.trustTitle}>Built for Trinity Western</h2>
                    <p className={styles.trustSub}>
                        Covering the courses and professors you'll actually register for.
                    </p>
                    <div className={styles.stats}>
                        {[
                            { num: "40+", label: "Departments" },
                            { num: "200+", label: "Professors" },
                            { num: "600+", label: "Courses" },
                        ].map((s) => (
                            <div key={s.label} className={styles.stat}>
                                <div className={styles.statNum}>{s.num}</div>
                                <div className={styles.statLabel}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Final CTA (navy-deep) ── */}
                <section className={styles.cta}>
                    <h2 className={styles.ctaTitle}>Find your next class the smart way</h2>
                    <p className={styles.ctaSub}>Free, made by students, and built only for TWU.</p>
                    <a className={styles.ctaBtn} href="/signup">Get started</a>
                </section>
            </Layout>
            <Footer />
        </>
    )
}
