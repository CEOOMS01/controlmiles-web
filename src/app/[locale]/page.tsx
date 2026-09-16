import { getTranslations, setRequestLocale } from "next-intl/server";
import { alternatesFor } from "@/i18n/metadata";
import { Link } from "@/i18n/routing";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import { Reveal } from "@/components/reveal";
import "./landing.css";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const body = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-plex",
});

const ROUTE_D = "M 8 210 C 120 210, 140 60, 260 60 S 420 210, 520 150 S 640 40, 740 90";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/", locale),
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Sin esto la página se renderiza por request en vez de generarse
  // estáticamente por idioma.
  setRequestLocale(locale);

  return (
    <main
      className={`landing ${display.variable} ${body.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />
      <Hero />
      <StatsStrip />
      <Features />
      <HowItWorks />
      <PortalCta />
      <LandingFooter />
    </main>
  );
}

async function Hero() {
  const t = await getTranslations("home");
  return (
    <section // md:items-start, no items-center: con la tarjeta (284px) mucho más
      // baja que la columna de texto (383px), centrarla la dejaba flotando a
      // 50px por debajo del inicio del texto y 50px por encima de su final
      // -- medido. Leído como desalineación, no como composición. Compartir
      // el borde superior es lo que hace que un texto y su apoyo visual se
      // lean como una sola unidad.
      className="mx-auto grid max-w-6xl gap-16 px-6 pb-24 pt-12 sm:px-10 md:grid-cols-[1.1fr_0.9fr] md:items-start md:gap-20 md:pt-24">
      <div>
        <p
          className="rise mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]"
          style={{ animationDelay: "0.05s" }}
        >
          {t("eyebrow")}
        </p>
        <h1
          className="display rise mt-7 text-5xl leading-[1.02] font-semibold sm:text-6xl md:text-[4.2rem]"
          style={{ animationDelay: "0.15s" }}
        >
          {t("titleLine1")}
          <br />
          <span className="italic" style={{ color: "var(--lg-blue-deep)" }}>
            {t("titleLine2")}
          </span>
        </h1>
        <p
          className="rise mt-7 max-w-md text-base leading-relaxed text-[var(--lg-ink-dim)]"
          style={{ animationDelay: "0.3s" }}
        >
          {t("subtitle")}
        </p>
        <div className="rise mt-10 flex flex-wrap gap-3" style={{ animationDelay: "0.42s" }}>
          <Link
            href="/login"
            className="rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(44,108,153,0.55)] transition hover:opacity-90"
            style={{ background: "var(--lg-blue-deep)" }}
          >
            {t("ctaSignIn")}
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-[var(--lg-line)] bg-white px-6 py-3 text-sm font-semibold text-[var(--lg-ink)] transition hover:border-[var(--lg-blue)]"
          >
            {t("ctaPricing")}
          </Link>
        </div>
      </div>

      <div className="rise" style={{ animationDelay: "0.2s" }}>
        <div className="rounded-2xl border border-[var(--lg-line)] bg-white p-6 shadow-[0_20px_50px_-24px_rgba(33,28,20,0.25)]">
          <p className="mono text-[11px] font-medium tracking-[0.15em] text-[var(--lg-ink-dim)]">
            {t("todaysRoute")}
          </p>
          <svg viewBox="0 0 760 240" className="mt-4 w-full" role="img" aria-label={t("routeAlt")}>
            <path d={ROUTE_D} fill="none" stroke="var(--lg-line)" strokeWidth="2" />
            <path
              className="route-path"
              d={ROUTE_D}
              fill="none"
              stroke="var(--lg-ink)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle className="route-dot" r="6" fill="var(--lg-blue-deep)" />
            <circle className="route-pin-glow" cx="740" cy="90" r="15" fill="var(--lg-blue-deep)" />
            <image className="route-pin" href="/logo_controlmiles.png" x="723" y="73" width="34" height="34" />
          </svg>
          <div
            className="rise mt-2 grid grid-cols-3 divide-x divide-[var(--lg-line)] border-t border-[var(--lg-line)] pt-4"
            style={{ animationDelay: "2.4s" }}
          >
            <div>
              <p className="display text-2xl font-semibold">18.4</p>
              <p className="text-xs text-[var(--lg-ink-dim)]">{t("miles")}</p>
            </div>
            <div className="pl-4">
              <p className="display text-2xl font-semibold">3</p>
              <p className="text-xs text-[var(--lg-ink-dim)]">{t("trips")}</p>
            </div>
            <div className="pl-4">
              <p className="display text-2xl font-semibold">$0</p>
              <p className="text-xs text-[var(--lg-ink-dim)]">{t("guesswork")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

async function StatsStrip() {
  const t = await getTranslations("home.stats");
  const stats = [
    { value: "10", unit: t("languagesUnit"), label: t("languagesLabel") },
    { value: "51", unit: t("statesUnit"), label: t("statesLabel") },
    { value: "0", unit: t("guessworkUnit"), label: t("guessworkLabel") },
  ];
  return (
    <section className="border-y border-[var(--lg-line)] bg-white/60">
      <div className="mx-auto grid max-w-6xl divide-y divide-[var(--lg-line)] px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-10">
        {stats.map((s, i) => (
          <Reveal
            key={s.label}
            index={i}
            // El padding interno de las celdas empujaba el PRIMER número 32px
            // hacia dentro respecto al resto de la página (medido: 266 frente
            // a 234). Esta franja no es una tarjeta -- no tiene borde ni fondo
            // propio que justifique esa sangría, así que el ojo solo veía el
            // contenido desalineado. Primera y última celda se pegan al eje;
            // las de en medio conservan su aire para separar los divisores.
            className="py-8 sm:px-8 sm:first:pl-0 sm:last:pr-0"
          >
            <div className="flex items-baseline gap-2">
              <p className="mono display text-4xl leading-none font-semibold" style={{ color: "var(--lg-blue-deep)" }}>
                {s.value}
              </p>
              <p className="text-sm leading-tight text-[var(--lg-ink-dim)]">{s.unit}</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

async function Features() {
  const t = await getTranslations("home.features");
  const FEATURES = [
    { title: t("detectionTitle"), body: t("detectionBody") },
    { title: t("odometerTitle"), body: t("odometerBody") },
    { title: t("recordTitle"), body: t("recordBody") },
    { title: t("fleetTitle"), body: t("fleetBody") },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
      <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">
        {t("eyebrow")}
      </p>
      <h2 className="display mt-3 max-w-lg text-4xl font-semibold leading-[1.05] sm:text-5xl">
        {t("title")}
      </h2>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {FEATURES.map((f, i) => (
          <Reveal
            key={f.title}
            index={i}
            className="lift rounded-xl border border-[var(--lg-line)] bg-white p-7 shadow-[0_10px_30px_-20px_rgba(33,28,20,0.3)]"
          >
            <h3 className="display text-xl font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">{f.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

async function HowItWorks() {
  const t = await getTranslations("home.how");
  const STEPS = [
    { n: "01", title: t("driveTitle"), body: t("driveBody") },
    { n: "02", title: t("reviewTitle"), body: t("reviewBody") },
    { n: "03", title: t("proveTitle"), body: t("proveBody") },
  ];
  return (
    <section className="border-y border-[var(--lg-line)] bg-white/60">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
        <h2 className="display text-3xl font-semibold sm:text-4xl">{t("title")}</h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} index={i}>
              <p className="mono text-3xl font-medium" style={{ color: "var(--lg-blue-deep)" }}>
                {s.n}
              </p>
              <h3 className="display mt-2 text-2xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

async function PortalCta() {
  const t = await getTranslations("portalCta");
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
      <Reveal className="lift grid gap-8 rounded-2xl border border-[var(--lg-line)] bg-white p-8 shadow-[0_20px_50px_-30px_rgba(33,28,20,0.35)] sm:grid-cols-2 sm:p-12">
        <div>
          <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">
            {t("eyebrow")}
          </p>
          <h2 className="display mt-3 text-3xl font-semibold leading-[1.05] sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--lg-ink-dim)]">
            {t("body")}
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <Link
            href="/portal/verify"
            className="rounded-full px-6 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--lg-amber)" }}
          >
            {t("cta")}
          </Link>
          <p className="text-center text-xs text-[var(--lg-ink-dim)]">
            {t("note")}
          </p>
        </div>
      </Reveal>
    </section>
  );
}
