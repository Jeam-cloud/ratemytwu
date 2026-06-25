import { Helmet } from "react-helmet-async"

const SITE_NAME = "RateMyTWU"
const BASE_URL  = "https://ratemytwu.com"
const DEFAULT_DESC = "Rate and review Trinity Western University professors. Find honest reviews, difficulty ratings, and course insights from real TWU students."
const OG_IMAGE = `${BASE_URL}/ratemytwu-flame.svg`

export default function SEO({
    title,
    description = DEFAULT_DESC,
    path = "",
    type = "website",
    jsonLd = null,
}) {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
    const url = `${BASE_URL}${path}`

    return (
        <Helmet>
            {/* Primary */}
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={url} />

            {/* Open Graph */}
            <meta property="og:title"       content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:url"         content={url} />
            <meta property="og:type"        content={type} />
            <meta property="og:image"       content={OG_IMAGE} />
            <meta property="og:site_name"   content={SITE_NAME} />

            {/* Twitter */}
            <meta name="twitter:card"        content="summary" />
            <meta name="twitter:title"       content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image"       content={OG_IMAGE} />

            {/* JSON-LD structured data */}
            {jsonLd && (
                <script type="application/ld+json">
                    {JSON.stringify(jsonLd)}
                </script>
            )}
        </Helmet>
    )
}
