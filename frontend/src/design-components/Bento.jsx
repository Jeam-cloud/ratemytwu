import styles from "./Bento.module.css"

export default function Bento() {
    return (
        <section className={styles.section}>
            <div className={styles.inner}>
                <div className={styles.header}>
                    <div className={styles.eyebrow}>Built for Spartans</div>
                    <h2 className={styles.heading}>
                        Smarter ways to <span className={styles.gold}>pick your classes.</span>
                    </h2>
                </div>

                <div className={styles.grid}>

                    {/* Big card — Compare */}
                    <div className={styles.bigCard}>
                        <div>
                            <div className={styles.cardEyebrow}>Compare</div>
                            <div className={styles.bigTitle}>Two profs, side by side.</div>
                            <div className={styles.cardBody}>
                                Stuck between two sections of the same course?
                                Stack ratings, difficulty, and take-again rate against each other.
                            </div>
                        </div>

                        <div className={styles.compareMock}>
                            <div className={styles.compareCol}>
                                <div className={styles.compareName}>Moore</div>
                                <div className={styles.compareNumGold}>4.6</div>
                                <div className={styles.compareLabel}>Rating</div>
                            </div>
                            <div className={styles.compareVs}>vs</div>
                            <div className={styles.compareCol}>
                                <div className={styles.compareName}>Smith</div>
                                <div className={styles.compareNum}>3.8</div>
                                <div className={styles.compareLabel}>Rating</div>
                            </div>
                        </div>
                    </div>

                    {/* Top right — Departments */}
                    <div className={styles.smallCard}>
                        <div className={styles.cardEyebrow}>55 departments</div>
                        <div className={styles.smallTitle}>Every program at TWU.</div>
                        <div className={styles.deptTags}>
                            <span className={styles.tag}>CMPT</span>
                            <span className={styles.tag}>BIOL</span>
                            <span className={styles.tag}>BUSI</span>
                            <span className={styles.tag}>PSYC</span>
                            <span className={styles.tagGold}>+51 more</span>
                        </div>
                    </div>

                    {/* Bottom right — Bookmarks */}
                    <div className={styles.smallCard}>
                        <div className={styles.cardEyebrow}>Bookmarks</div>
                        <div className={styles.smallTitle}>Save & revisit later.</div>
                        <div className={styles.cardBody}>
                            Tag courses you're considering and come back when registration opens.
                        </div>
                    </div>

                </div>
            </div>
        </section>
    )
}