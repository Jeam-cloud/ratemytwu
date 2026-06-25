import Layout from "../../components/Layout"
import styles from "../../css/StaticPage.module.css"

export default function PrivacyPage() {
    return (
        <Layout>
            <div className={styles.page}>
                <div className={styles.hero}>
                    <p className={styles.kicker}>Privacy</p>
                    <h1 className={styles.title}>Privacy Policy</h1>
                    <p className={styles.subtitle}>
                        RateMyTWU is a student-run project. We keep things simple — we collect only
                        what we need and never sell your data.
                    </p>
                </div>

                <p className={styles.lastUpdated}>Last updated: June 2026</p>

                <div className={styles.prose}>

                    <div className={styles.proseSection}>
                        <p className={styles.proseSectionTitle}>What we collect</p>
                        <p className={styles.proseText}>
                            When you sign in with Google, Supabase Auth stores your email address and a unique user ID. We do not store your Google password or access your Google account beyond what's needed to verify your identity.
                        </p>
                        <p className={styles.proseText}>
                            Reviews you submit are stored in our database and linked to your user ID (not your name or email) so you can edit or delete them later.
                        </p>
                        <p className={styles.proseText}>
                            We do not collect analytics, tracking cookies, or any data beyond what you explicitly submit.
                        </p>
                    </div>

                    <hr className={styles.divider} />

                    <div className={styles.proseSection}>
                        <p className={styles.proseSectionTitle}>How we use it</p>
                        <p className={styles.proseText}>
                            Your email is used only to authenticate your account. It is never displayed publicly, shared with third parties, or used for marketing.
                        </p>
                        <p className={styles.proseText}>
                            Reviews are displayed publicly on professor pages without any identifying information attached.
                        </p>
                    </div>

                    <hr className={styles.divider} />

                    <div className={styles.proseSection}>
                        <p className={styles.proseSectionTitle}>Data storage</p>
                        <p className={styles.proseText}>
                            Your data is stored on Supabase, a hosted Postgres database. Authentication is managed by Supabase Auth. Both services are SOC 2 compliant. You can read Supabase's privacy policy at{" "}
                            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>supabase.com/privacy</a>.
                        </p>
                    </div>

                    <hr className={styles.divider} />

                    <div className={styles.proseSection}>
                        <p className={styles.proseSectionTitle}>Deleting your data</p>
                        <p className={styles.proseText}>
                            You can delete individual reviews at any time from your dashboard. To delete your account and all associated data, contact us via the{" "}
                            <a href="/report" style={{ color: "var(--blue)" }}>Report page</a>{" "}
                            and we'll remove everything within 5 business days.
                        </p>
                    </div>

                    <hr className={styles.divider} />

                    <div className={styles.proseSection}>
                        <p className={styles.proseSectionTitle}>Professor data</p>
                        <p className={styles.proseText}>
                            Professor names, departments, and course assignments are sourced from publicly available TWU timetables. If you are a professor and would like your profile removed, please submit a request via the{" "}
                            <a href="/report" style={{ color: "var(--blue)" }}>Report page</a>.
                        </p>
                    </div>

                    <hr className={styles.divider} />

                    <div className={styles.proseSection}>
                        <p className={styles.proseSectionTitle}>Changes to this policy</p>
                        <p className={styles.proseText}>
                            We may update this policy as the site evolves. The "last updated" date at the top will always reflect the most recent version.
                        </p>
                    </div>

                </div>
            </div>
        </Layout>
    )
}
