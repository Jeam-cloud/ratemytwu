import { Link } from "react-router-dom"
import styles from "./CTA.module.css"

export default function CTA() {
    return (
        <section className={styles.section}>
            <div className={styles.glow} />
            <div className={styles.inner}>
                <div className={styles.eyebrow}>Got something to say?</div>
                <h2 className={styles.heading}>
                    Help fellow Spartans <span className={styles.gold}>pick their classes.</span>
                </h2>
                <p className={styles.body}>
                    Sign up in 30 seconds and drop a review on a class you've finished.
                    Honest student feedback only — no spam, no email scraping.
                </p>
                <div className={styles.buttons}>
                    <Link to="/signup" className={styles.primaryBtn}>Sign up free</Link>
                    <Link to="/" className={styles.secondaryBtn}>Browse professors</Link>
                </div>
            </div>
        </section>
    )
}