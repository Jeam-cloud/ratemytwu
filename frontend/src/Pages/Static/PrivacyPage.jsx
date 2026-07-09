import { useState } from "react"
import Layout from "../../components/Layout"
import styles from "../../css/StaticPage.module.css"

// Terms of Service and Privacy Policy are legally distinct documents (ToS
// covers usage rules + our liability protections, Privacy covers data
// handling under BC's PIPA) but live on one page as two clearly separated
// sections, per how the site is currently laid out - a jump-tab pair at the
// top switches between them without a second route.
export default function PrivacyPage() {
    const [tab, setTab] = useState("terms")

    return (
        <Layout>
            <div className={styles.page}>
                <div className={styles.hero}>
                    <p className={styles.kicker}>Legal</p>
                    <h1 className={styles.title}>Terms &amp; Privacy</h1>
                    <p className={styles.subtitle}>
                        RateMyTWU is an independent, student-run project — not affiliated with or
                        endorsed by Trinity Western University. Below are the terms for using the
                        site and how we handle your data.
                    </p>
                </div>

                <div className={styles.legalTabs}>
                    <button
                        className={tab === "terms" ? `${styles.legalTab} ${styles.legalTabOn}` : styles.legalTab}
                        onClick={() => setTab("terms")}
                    >
                        Terms of Service
                    </button>
                    <button
                        className={tab === "privacy" ? `${styles.legalTab} ${styles.legalTabOn}` : styles.legalTab}
                        onClick={() => setTab("privacy")}
                    >
                        Privacy Policy
                    </button>
                </div>

                {tab === "terms" ? (
                    <>
                        <p className={styles.lastUpdated}>Last updated: July 2026</p>

                        <div className={styles.prose}>

                            <div className={styles.proseSection}>
                                <p className={styles.proseSectionTitle}>1. What RateMyTWU is</p>
                                <p className={styles.proseText}>
                                    RateMyTWU is an independent website built and operated by students, for
                                    students. It is not affiliated with, sponsored by, or endorsed by Trinity
                                    Western University or the TWU Student Association. Course and professor
                                    listings are sourced from publicly available TWU timetables; reviews and
                                    ratings are submitted entirely by users.
                                </p>
                            </div>

                            <hr className={styles.divider} />

                            <div className={styles.proseSection}>
                                <p className={styles.proseSectionTitle}>2. Who can use it</p>
                                <p className={styles.proseText}>
                                    You must sign in to submit a review or use planning features. Browsing
                                    professor and course pages doesn't require an account. By creating an
                                    account, you confirm the information you provide is accurate and that
                                    you're using the site in a personal, non-commercial capacity.
                                </p>
                            </div>

                            <hr className={styles.divider} />

                            <div className={styles.proseSection}>
                                <p className={styles.proseSectionTitle}>3. Your content</p>
                                <p className={styles.proseText}>
                                    You own what you write. By submitting a review, you grant RateMyTWU a
                                    non-exclusive, royalty-free license to display it publicly on the site.
                                    Reviews are shown without your name or email attached — see the Privacy
                                    Policy for how that anonymity works in practice.
                                </p>
                                <p className={styles.proseText}>
                                    You're responsible for what you post. Reviews must reflect your genuine
                                    experience and may not contain personal attacks, identifying information
                                    about a professor or another student, harassment, defamatory statements,
                                    or anything that violates TWU's Student Code of Conduct or applicable
                                    Canadian law. We can remove content or suspend accounts that violate this.
                                </p>
                            </div>

                            <hr className={styles.divider} />

                            <div className={styles.proseSection}>
                                <p className={styles.proseSectionTitle}>4. Moderation &amp; reports</p>
                                <p className={styles.proseText}>
                                    Reviews can be reported by other users and are automatically hidden from
                                    public view pending operator review once they receive multiple reports.
                                    Separately, anyone can report wrong information, a bug, or request a
                                    professor profile takedown through the{" "}
                                    <a href="/report" style={{ color: "var(--blue)" }}>Report page</a>. We aim
                                    to acknowledge reports within 2 business days and resolve them within 5.
                                </p>
                                <p className={styles.proseText}>
                                    A verified professor takedown request can result in either the profile
                                    being hidden (reversible, records kept internally) or permanently deleted
                                    (irreversible) — the requester chooses which. See the Privacy Policy's
                                    "Professor data" section for details.
                                </p>
                            </div>

                            <hr className={styles.divider} />

                            <div className={styles.proseSection}>
                                <p className={styles.proseSectionTitle}>5. No warranty</p>
                                <p className={styles.proseText}>
                                    RateMyTWU is provided "as is." Reviews reflect individual student opinions,
                                    not verified facts, and we make no guarantee about their accuracy,
                                    completeness, or reliability. Course and professor listings may contain
                                    errors or become outdated. Use the site as one input among others when
                                    making academic decisions, not as the sole basis for them.
                                </p>
                            </div>

                            <hr className={styles.divider} />

                            <div className={styles.proseSection}>
                                <p className={styles.proseSectionTitle}>6. Limitation of liability</p>
                                <p className={styles.proseText}>
                                    To the fullest extent permitted by law, RateMyTWU and its operators are
                                    not liable for any indirect, incidental, or consequential damages arising
                                    from your use of the site, including damages related to content posted by
                                    other users. Where liability cannot be excluded, our total liability to
                                    you is limited to $100 CAD.
                                </p>
                            </div>

                            <hr className={styles.divider} />

                            <div className={styles.proseSection}>
                                <p className={styles.proseSectionTitle}>7. Indemnification</p>
                                <p className={styles.proseText}>
                                    You agree to indemnify and hold RateMyTWU's operators harmless from any
                                    claim, damage, or expense (including reasonable legal fees) arising from
                                    content you submit, your violation of these terms, or your violation of
                                    any law or third party's rights.
                                </p>
                            </div>

                            <hr className={styles.divider} />

                            <div className={styles.proseSection}>
                                <p className={styles.proseSectionTitle}>8. Governing law</p>
                                <p className={styles.proseText}>
                                    These terms are governed by the laws of British Columbia and the federal
                                    laws of Canada applicable within it, without regard to conflict of law
                                    principles.
                                </p>
                            </div>

                            <hr className={styles.divider} />

                            <div className={styles.proseSection}>
                                <p className={styles.proseSectionTitle}>9. Changes to these terms</p>
                                <p className={styles.proseText}>
                                    We may update these terms as the site evolves. The "last updated" date at
                                    the top will always reflect the most recent version. Continued use of the
                                    site after a change means you accept the updated terms.
                                </p>
                            </div>

                            <hr className={styles.divider} />

                            <div className={styles.proseSection}>
                                <p className={styles.proseSectionTitle}>10. Contact</p>
                                <p className={styles.proseText}>
                                    Questions about these terms can be sent via the{" "}
                                    <a href="/contact" style={{ color: "var(--blue)" }}>Contact page</a>.
                                </p>
                            </div>

                        </div>
                    </>
                ) : (
                    <>
                        <p className={styles.lastUpdated}>Last updated: July 2026</p>

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
                                    <a href="/report" style={{ color: "var(--blue)" }}>Report page</a>{" "}
                                    using your @twu.ca email, and we'll process it within 5 business days.
                                </p>
                                <p className={styles.proseText}>
                                    We offer two levels of removal, and you can request either: <strong>hiding</strong> your profile takes it and its reviews off every public page immediately while keeping the underlying records internally (for our own moderation and legal record-keeping — see the Report page for more on why); <strong>permanent deletion</strong> erases your profile and every review on it from our database entirely, which cannot be undone. If your request doesn't specify which, we'll ask before proceeding.
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
                    </>
                )}
            </div>
        </Layout>
    )
}
