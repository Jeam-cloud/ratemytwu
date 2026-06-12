import { Link } from "react-router-dom"
import styles from "./Footer.module.css"

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.inner}>

                <div className={styles.brandCol}>
                    <div className={styles.logo}>
                        <span className={styles.logoRate}>Rate</span>
                        <span className={styles.logoMy}>My</span>
                        <span className={styles.logoTwu}>TWU</span>
                    </div>
                    <p className={styles.tagline}>
                        Built by Spartans, for Spartans. Not affiliated with Trinity Western University.
                    </p>
                </div>

                <div className={styles.linksCol}>
                    <div className={styles.linksTitle}>Explore</div>
                    <Link to="/" className={styles.link}>Professors</Link>
                    <Link to="/courses" className={styles.link}>Courses</Link>
                    <Link to="/departments" className={styles.link}>Departments</Link>
                    <Link to="/compare" className={styles.link}>Compare</Link>
                </div>

                <div className={styles.linksCol}>
                    <div className={styles.linksTitle}>Account</div>
                    <Link to="/signup" className={styles.link}>Sign up</Link>
                    <Link to="/login" className={styles.link}>Log in</Link>
                    <Link to="/dashboard" className={styles.link}>Dashboard</Link>
                </div>

            </div>

            <div className={styles.bottom}>
                <span>© 2026 RateMyTWU</span>
                <span>Made with care in Langley, BC</span>
            </div>
        </footer>
    )
}