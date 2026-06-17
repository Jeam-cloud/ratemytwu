import { Link } from "react-router-dom"
import styles from "./Footer.module.css"

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.photo} />
            <div className={styles.scrim} />

            <div className={styles.inner}>
                <div className={styles.brandCol}>
                    <Link to="/" className={styles.logo}>
                        <img src="/ratemytwu-flame.svg" alt="" className={styles.flame} />
                        <span className={styles.wordmark}>
                            Rate<span className={styles.my}>My</span>TWU
                        </span>
                    </Link>
                    <p className={styles.tagline}>
                        The course &amp; professor guide for Trinity Western students. Read honest
                        reviews, find who's teaching, and plan your degree.
                    </p>
                </div>

                <div className={styles.linksCol}>
                    <div className={styles.linksTitle}>Explore</div>
                    <Link to="/professor" className={styles.link}>Professors</Link>
                    <Link to="/course" className={styles.link}>Courses</Link>
                    <Link to="/departments" className={styles.link}>Departments</Link>
                    <Link to="/compare" className={styles.link}>Compare</Link>
                </div>

                <div className={styles.linksCol}>
                    <div className={styles.linksTitle}>Account</div>
                    <Link to="/login" className={styles.link}>Log in</Link>
                    <Link to="/signup" className={styles.link}>Sign up</Link>
                    <Link to="/dashboard" className={styles.link}>My reviews</Link>
                    <Link to="/dashboard" className={styles.link}>Bookmarks</Link>
                </div>

                <div className={styles.linksCol}>
                    <div className={styles.linksTitle}>About</div>
                    <Link to="/" className={styles.link}>How it works</Link>
                    <Link to="/" className={styles.link}>Guidelines</Link>
                    <Link to="/" className={styles.link}>Contact</Link>
                    <Link to="/" className={styles.link}>Privacy</Link>
                </div>
            </div>

            <div className={styles.bottom}>
                <span>Trinity Western University</span>
                <span>Made by students.</span>
            </div>
        </footer>
    )
}
