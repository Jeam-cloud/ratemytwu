import styles from "./Features.module.css"

export default function Features() {
    return (
        <section className={styles.features}>
            <div className={styles.inner}>

                {/* Block 1 — text left, professor preview right */}
                <div className={styles.row}>
                    <div className={styles.text}>
                        <div className={styles.eyebrow}>Honest reviews</div>
                        <h2 className={styles.heading}>
                            Know before<br />
                            <span className={styles.gold}>you register.</span>
                        </h2>
                        <p className={styles.body}>
                            Read real reviews from fellow Spartans. See difficulty,
                            take-again rate, and course-specific feedback before you commit.
                        </p>
                    </div>

                    <div className={styles.profCard}>
                        <div className={styles.profName}>Dr. Sarah Moore</div>
                        <div className={styles.profDept}>Biology</div>

                        <div className={styles.profStats}>
                            <div>
                                <div className={styles.statNumGold}>4.6</div>
                                <div className={styles.statLabel}>Rating</div>
                            </div>
                            <div>
                                <div className={styles.statNum}>3.2</div>
                                <div className={styles.statLabel}>Difficulty</div>
                            </div>
                            <div>
                                <div className={styles.statNum}>87%</div>
                                <div className={styles.statLabel}>Take again</div>
                            </div>
                        </div>

                        <div className={styles.quote}>
                            "Engaging lectures, fair grading. Labs are tough but you actually learn anatomy."
                        </div>
                    </div>
                </div>

                {/* Block 2 — kanban preview left, text right */}
                <div className={styles.row}>
                    <div className={styles.kanban}>
                        <div className={styles.kanbanCol}>
                            <div className={styles.kanbanLabel}>Year 1</div>
                            <div className={styles.cardAccent}>CMPT 140</div>
                            <div className={styles.card}>MATH 123</div>
                        </div>
                        <div className={styles.kanbanCol}>
                            <div className={styles.kanbanLabel}>Year 2</div>
                            <div className={styles.card}>CMPT 166</div>
                            <div className={styles.card}>CMPT 275</div>
                        </div>
                        <div className={styles.kanbanCol}>
                            <div className={styles.kanbanLabel}>Year 3</div>
                            <div className={styles.cardAccent}>CMPT 330</div>
                        </div>
                    </div>

                    <div className={styles.text}>
                        <div className={styles.eyebrow}>Degree planner</div>
                        <h2 className={styles.heading}>
                            Plan your<br />
                            <span className={styles.gold}>whole journey.</span>
                        </h2>
                        <p className={styles.body}>
                            Drag and drop courses across a 5-year board.
                            No more spreadsheet chaos.
                        </p>
                    </div>
                </div>

            </div>
        </section>
    )
}