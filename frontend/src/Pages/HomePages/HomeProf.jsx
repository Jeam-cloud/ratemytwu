import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"

import SearchBarProf from "../../components/SearchBarProf"
import SearchBarCourse from "../../components/SearchBarCourse"
import Footer from "../../design-components/Footer"
import Layout from "../../components/Layout"
import SEO from "../../components/SEO"
import styles from "../../css/HomeProf.module.css"
import "../../css/landing-mocks.css"

/* ── On-brand product previews (decorative) ── */
function ProfMock() {
    return (
        <div className="lp-mock lp-mock-prof">
            <div className="pm-top">
                <span className="pm-avatar">ER</span>
                <div>
                    <div className="pm-name">Dr. Eleanor Reimer</div>
                    <div className="pm-meta"><span className="pm-badge">Biology</span> · 21 reviews</div>
                </div>
            </div>
            <div className="pm-metrics">
                <div className="pm-metric accent"><b>4.3</b><small>/5</small><span>Overall</span></div>
                <div className="pm-metric"><b>3.1</b><small>/5</small><span>Difficulty</span></div>
                <div className="pm-metric"><b>86</b><small>%</small><span>Take again</span></div>
            </div>
            <div className="pm-review">
                <div className="pm-review-top">
                    <span className="pm-stars">★★★★<span className="off">★</span></span>
                    <span className="pm-course">BIOL 113 · A−</span>
                </div>
                <p>"Clear lectures and genuinely fair exams. She answers email within a day. Tough, but you learn a ton."</p>
            </div>
            <div className="pm-chips"><i>BIOL 113</i><i>BIOL 213</i><i>BIOL 343</i></div>
        </div>
    )
}

function CourseMock() {
    const rows = [
        { s: "4.6", name: "Dr. Priya Anand", sub: "9 reviews · 92% again", term: "Spring", top: true },
        { s: "4.3", name: "Dr. Eleanor Reimer", sub: "21 reviews · 86% again", term: "Fall" },
        { s: "3.8", name: "Dr. Marcus Lindqvist", sub: "14 reviews · 71% again", term: "Fall" },
    ]
    return (
        <div className="lp-mock lp-mock-course">
            <div className="cm-head">
                <span className="cm-badge">3 credits</span>
                <div className="cm-code">BIOL 113</div>
                <div className="cm-title">Introductory Biology I · 3 professors teaching</div>
            </div>
            <div className="cm-rows">
                {rows.map((r) => (
                    <div className={"cm-row" + (r.top ? " top" : "")} key={r.name}>
                        <span className="cm-score">{r.s}<small>/5</small></span>
                        <div className="cm-main">
                            <div className="cm-name">{r.name}{r.top && <em>Top rated</em>}</div>
                            <div className="cm-sub">{r.sub}</div>
                        </div>
                        <span className="cm-term">{r.term}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function PlannerMock() {
    const terms = [
        { name: "Fall 2026", cr: "9 cr", courses: [["BIOL 113", "done"], ["ENGL 103", "done"], ["MATH 101", "ip"]] },
        { name: "Spring 2027", cr: "6 cr", courses: [["BIOL 123", "plan"], ["RELS 101", "plan"]] },
    ]
    return (
        <div className="lp-mock lp-mock-planner">
            <div className="plm-progress">
                <div className="plm-progress-top"><b>84</b> / 120 credits planned <span>70% to graduation</span></div>
                <div className="plm-track"><i className="done" style={{ width: "30%" }}></i><i className="ip" style={{ width: "12%" }}></i><i className="plan" style={{ width: "28%" }}></i></div>
            </div>
            <div className="plm-terms">
                {terms.map((t) => (
                    <div className="plm-term" key={t.name}>
                        <div className="plm-term-head"><span>{t.name}</span><em>{t.cr}</em></div>
                        {t.courses.map(([code, st]) => (
                            <div className={"plm-course " + st} key={code}><i></i>{code}<small>3 cr</small></div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function HomeProf() {
    const [searchParam] = useSearchParams()
    const [mode, setMode] = useState(
        searchParam.get("mode") === "course" ? "course" : "professor"
    )
    const heroRef = useRef(null)
    const firstLoad = useRef(true)

    // keep the hero toggle in sync with the ?mode= param
    useEffect(() => {
        const next = searchParam.get("mode") === "course" ? "course" : "professor"
        setMode(next)
        if (!firstLoad.current && heroRef.current) {
            heroRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        firstLoad.current = false
    }, [searchParam])

    // scroll-reveal: fade sections up as they enter the viewport
    useEffect(() => {
        const els = document.querySelectorAll(".reveal")
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target) }
            })
        }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" })
        els.forEach((el) => io.observe(el))
        return () => io.disconnect()
    }, [])

    return (
        <>
            <SEO
                path="/"
                description="Rate and review Trinity Western University professors. Find honest course reviews, difficulty ratings, and GPA tools from real TWU students."
                jsonLd={{
                    "@context": "https://schema.org",
                    "@type": "WebSite",
                    "name": "RateMyTWU",
                    "url": "https://ratemytwu.com",
                    "description": "Rate and review TWU professors and courses",
                    "potentialAction": {
                        "@type": "SearchAction",
                        "target": "https://ratemytwu.com/search?q={search_term_string}",
                        "query-input": "required name=search_term_string"
                    }
                }}
            />
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
                    <div className={styles.pillarsInner}>
                        <div className={`${styles.pillarsHead} reveal`}>
                            <span className={styles.kickerBlue}>Everything in one place</span>
                           </div>
                        <div className={styles.pillarsGrid}>
                            {[
                                {
                                    num: "01",
                                    title: "Rate professors",
                                    body: "Honest ratings on difficulty, workload, and would-take-again — written by students who actually took the class.",
                                    icon: (
                                        <path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
                                    ),
                                },
                                {
                                    num: "02",
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
                                    num: "03",
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
                                <article key={p.title} className={`${styles.pillar} reveal`}>
                                    <div className={styles.pillarTop}>
                                        <div className={styles.pillarIcon}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                {p.icon}
                                            </svg>
                                        </div>
                                    </div>
                                    <h3 className={styles.pillarTitle}>{p.title}</h3>
                                    <p className={styles.pillarBody}>{p.body}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Feature band: Professors (white) ── */}
                <section className={`${styles.band} ${styles.bandWhite}`}>
                    <div className={`${styles.bandInner} reveal`}>
                        <div className={styles.bandText}>
                            <span className={styles.kickerBlue}>Professors</span>
                            <h2 className={styles.bandTitleDark}>Know your prof before day one</h2>
                            <p className={styles.bandBodyDark}>
                                Professor pages summarize real student reviews — overall rating,
                                difficulty, and would-take-again — plus the courses they teach this
                                semester.
                            </p>
                            <a className={styles.bandLinkBlue} href="/professor">Browse professors →</a>
                        </div>
                        <div className="lp-feature-media"><ProfMock /></div>
                    </div>
                </section>

                {/* ── Feature band: Courses (cream) ── */}
                <section className={`${styles.band} ${styles.bandCream}`}>
                    <div className={`${styles.bandInner} reveal`}>
                        <div className="lp-feature-media"><CourseMock /></div>
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
                    <div className={`${styles.bandInner} reveal`}>
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
                        <div className="lp-feature-media"><PlannerMock /></div>
                    </div>
                </section>

                {/* ── Trust / stats band (cream) ── */}
                <section className={styles.trust}>
                    <div className="reveal">
                        <span className={styles.kickerBlue}>For Trinity Western</span>
                        <h2 className={styles.trustTitle}>Built for Trinity Western</h2>
                        <p className={styles.trustSub}>
                            Covering the courses and professors you'll actually register for.
                        </p>
                    </div>
                    <div className={`${styles.stats} reveal`}>
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

                {/* ── Final CTA (navy) ── */}
                <section className={styles.cta}>
                    <div className="reveal">
                        <h2 className={styles.ctaTitle}>Find your next class the smart way</h2>
                        <p className={styles.ctaSub}>Free, made by students, and built only for TWU.</p>
                        <a className={styles.ctaBtn} href="/signup">Get started</a>
                    </div>
                </section>
            </Layout>
            <Footer />
        </>
    )
}
