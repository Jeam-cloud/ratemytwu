import Layout from "../../components/Layout"
import styles from "../../css/StaticPage.module.css"

function getInitials(name) {
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const team = [
    {
        name: "Your Name",
        role: "Co-founder",
        instagram: "https://instagram.com/placeholder",
        linkedin: "https://linkedin.com/in/placeholder",
        phone: "+1 (604) 000-0000",
    },
    {
        name: "Coworker Name",
        role: "Co-founder",
        instagram: "https://instagram.com/placeholder",
        linkedin: "https://linkedin.com/in/placeholder",
        phone: "+1 (604) 000-0000",
    },
]

export default function ContactPage() {
    return (
        <Layout>
            <div className={styles.page}>
                <div className={styles.hero}>
                    <p className={styles.kicker}>Contact</p>
                    <h1 className={styles.title}>Say hello.</h1>
                    <p className={styles.subtitle}>
                        We're TWU students too. Reach out directly — we actually read our messages.
                    </p>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>The team</h2>
                    <div className={styles.team}>
                        {team.map((person, i) => (
                            <div key={i} className={styles.teamCard}>
                                <div className={styles.teamAvatar}>{getInitials(person.name)}</div>
                                <p className={styles.teamName}>{person.name}</p>
                                <p className={styles.teamRole}>{person.role}</p>
                                <div className={styles.socials}>
                                    {person.instagram && (
                                        <a href={person.instagram} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                                                <circle cx="12" cy="12" r="4" />
                                                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
                                            </svg>
                                            Instagram
                                        </a>
                                    )}
                                    {person.linkedin && (
                                        <a href={person.linkedin} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                                                <rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
                                            </svg>
                                            LinkedIn
                                        </a>
                                    )}
                                    {person.phone && (
                                        <a href={`tel:${person.phone.replace(/\D/g, "")}`} className={styles.socialLink}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l.98-.98a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                                            </svg>
                                            {person.phone}
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Something to report?</h2>
                    <p className={styles.subtitle} style={{ marginBottom: 0 }}>
                        For bug reports, wrong info, or professor takedown requests, use the{" "}
                        <a href="/report" style={{ color: "var(--blue)", fontWeight: 600, textDecoration: "none" }}>Report page</a>{" "}
                        so we can track and action it properly.
                    </p>
                </div>
            </div>
        </Layout>
    )
}
