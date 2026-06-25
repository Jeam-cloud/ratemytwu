import Layout from "../../components/Layout"
import styles from "../../css/StaticPage.module.css"

const FORM_URL = "https://forms.google.com/PLACEHOLDER"

const categories = [
    {
        heading: "Wrong or outdated info",
        text: "A professor's department is wrong, a course code is off, or something else looks inaccurate.",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
        ),
    },
    {
        heading: "Inappropriate review",
        text: "A review contains personal attacks, identifying information, or content that violates our community standards.",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        ),
    },
    {
        heading: "Professor takedown request",
        text: "You're a professor and want your profile removed from RateMyTWU. We'll process your request within 5 business days.",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
        ),
    },
    {
        heading: "Bug or broken feature",
        text: "Something on the site isn't working right — a page that won't load, a form that errors, or anything else that seems broken.",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <path d="M12 12v4" /><path d="M10 14h4" />
            </svg>
        ),
    },
]

export default function ReportPage() {
    return (
        <Layout>
            <div className={styles.page}>
                <div className={styles.hero}>
                    <p className={styles.kicker}>Report</p>
                    <h1 className={styles.title}>Something look off?</h1>
                    <p className={styles.subtitle}>
                        Help us keep RateMyTWU accurate and respectful. Use the form below to flag
                        anything that needs attention — wrong info, bad reviews, or a takedown request.
                    </p>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>What can I report?</h2>
                    <div className={styles.grid}>
                        {categories.map((cat, i) => (
                            <div key={i} className={styles.infoCard}>
                                <div className={styles.infoIcon}>{cat.icon}</div>
                                <p className={styles.infoHeading}>{cat.heading}</p>
                                <p className={styles.infoText}>{cat.text}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <a href={FORM_URL} target="_blank" rel="noopener noreferrer" className={styles.cta}>
                    Open the report form
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                </a>
            </div>
        </Layout>
    )
}
