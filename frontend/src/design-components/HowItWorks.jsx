import styles from "./HowItWorks.module.css"

export default function HowItWorks() {
    const steps = [
        {
            number: "01",
            title: "Search",
            body: "Find any TWU professor by name, course code, or department. No paywall, no signup required."
        },
        {
            number: "02",
            title: "Read",
            body: "Honest reviews from real Spartans — ratings for difficulty, take-again rate, and course-specific feedback."
        },
        {
            number: "03",
            title: "Plan",
            body: "Bookmark courses, drop them on your degree planner, and share your own review once you've finished a class."
        }
    ]

    return (
        <section className={styles.section}>
            <div className={styles.inner}>
                <div className={styles.header}>
                    <div className={styles.eyebrow}>How it works</div>
                    <h2 className={styles.heading}>
                        Three steps from <span className={styles.gold}>search to semester.</span>
                    </h2>
                </div>

                <div className={styles.grid}>
                    {steps.map(step => (
                        <div key={step.number} className={styles.step}>
                            <div className={styles.stepNum}>{step.number}</div>
                            <div className={styles.stepTitle}>{step.title}</div>
                            <div className={styles.stepBody}>{step.body}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}