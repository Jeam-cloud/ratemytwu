import Layout from "../../components/Layout"
import styles from "../../css/StaticPage.module.css"
import { useNavigate } from "react-router-dom"

const steps = [
    {
        heading: "Search for a professor or course",
        text: "Use the search bar or browse by department. Every professor and course offered at TWU is listed — even ones with no reviews yet.",
    },
    {
        heading: "Read what students say",
        text: "Each professor page shows ratings for overall quality, difficulty, and how many students would take them again. Dive into individual reviews for the full picture — grading style, attendance policy, exam format, and more.",
    },
    {
        heading: "Compare your options",
        text: "Teaching the same course? Use the Compare tool to put two professors side by side and see how their ratings stack up before you pick your section.",
    },
    {
        heading: "Leave a review",
        text: "Took a class? Help the next student out. Sign in with your TWU email and leave an honest review. It takes about two minutes and makes a real difference.",
    },
    {
        heading: "Bookmark courses you're interested in",
        text: "Hit the bookmark icon on any course to save it for later. Bookmarked courses show up in your dashboard so you can keep track of what you're considering without losing it mid-registration.",
    },
    {
        heading: "Build your degree plan",
        text: "My Courses gives you a full semester-by-semester planner. Drag courses into Fall, Spring, or Summer columns across your years. Mark courses as Planned, In Progress, or Completed, and log your grade when you're done. A live credit counter tracks how many credits you've completed, have in progress, and have planned — so you always know where you stand. A cumulative GPA calculator on the side updates in real time as you enter grades, giving you a running picture of your academic standing at a glance.",
    },
]

export default function HowItWorksPage() {
    const navigate = useNavigate()

    return (
        <Layout>
            <div className={styles.page}>
                <div className={styles.hero}>
                    <p className={styles.kicker}>How it works</p>
                    <h1 className={styles.title}>Built for TWU students,<br />by TWU students.</h1>
                    <p className={styles.subtitle}>
                        RateMyTWU is a free tool to help you make smarter course decisions —
                        find the right professor, avoid the wrong section, and plan a degree that works for you.
                    </p>
                </div>

                <div className={styles.section}>
                    <div className={styles.steps}>
                        {steps.map((step, i) => (
                            <div key={i} className={styles.stepCard}>
                                <div className={styles.stepNum}>{i + 1}</div>
                                <div className={styles.stepBody}>
                                    <p className={styles.stepHeading}>{step.heading}</p>
                                    <p className={styles.stepText}>{step.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <button className={styles.cta} onClick={() => navigate("/professor")}>
                    Browse professors
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 18 6-6-6-6" />
                    </svg>
                </button>
            </div>
        </Layout>
    )
}
