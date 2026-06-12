import { Link } from "react-router-dom"
import SearchBarCourse from "../../components/SearchBarCourse"
import Layout from "../../components/Layout"
import styles from "../../css/HomeCourse.module.css"

export default function HomeCourse() {
    return (
        <Layout noPadding>
            <section className={styles.hero}>
                <div className={styles.blob1} />
                <div className={styles.blob2} />
                <div className={styles.gridOverlay} />

                <div className={styles.heroInner}>
                    <div className={styles.eyebrow}>
                        <span className={styles.eyebrowDot} />
                        Trinity Western University
                    </div>

                    <h1 className={styles.heroTitle}>
                        Find a Course.<br />
                        <span className={styles.heroGold}>Plan your semester wisely.</span>
                    </h1>

                    <p className={styles.heroSub}>
                        Homemade reviews from the TWU student community.<br />
                        Search before you register.
                    </p>

                    <SearchBarCourse />

                    <Link to="/" className={styles.courseLink}>Search up a professor instead</Link>

                    <div className={styles.quickLinks}>
                        <span className={styles.qlLabel}>Popular:</span>
                        {["Computer Science", "Business", "Psychology", "Biology", "English"].map(dept => (
                            <button key={dept} className={styles.qlBtn}>{dept}</button>
                        ))}
                    </div>

                    <p className={styles.slogan}>Built by TWU students, for TWU students.</p>
                </div>
            </section>

            <div className={styles.stats}>
                {[
                    { num: "55", label: "Departments" },
                    { num: "180", label: "Professors rated" },
                    { num: "636", label: "Courses covered" },
                ].map((stat, i) => (
                    <div key={i} className={styles.stat}>
                        <div className={styles.statIcon}>
                            <svg width="18" height="18" fill="none" stroke="#C9A84C" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                            </svg>
                        </div>
                        <div>
                            <div className={styles.statNum}>
                                {stat.num}<span className={styles.statGold}>+</span>
                            </div>
                            <div className={styles.statLabel}>{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>
        </Layout>
    )
}