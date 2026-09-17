// Olympus Mont Systems LLC - ControlMiles
// src/components/landing-chrome.tsx
//
// Shared Nav/Footer for the landing page AND any other page that uses the
// same warm/light landing.css aesthetic (legal pages) -- extracted out of
// page.tsx rather than duplicated, so the two never drift.
//
// i18n (2026-09-16): los enlaces usan el `Link` de @/i18n/routing, NO el de
// next/link. Es la diferencia entre que /es/pricing lleve a /es/privacy o
// te saque al inglés sin avisar; con next/link crudo el usuario pierde el
// idioma en el primer clic y no hay forma de que lo note nadie en revisión.

import type { CSSProperties } from "react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "./language-switcher";

// Delay escalonado de entrada de los 4 controles del nav (ver landing.css,
// .nav-action-in) -- tipado como CSSProperties porque --nav-delay es una
// custom property, no un nombre de propiedad CSS estándar que React
// reconozca de forma nativa.
const navDelay = (seconds: number): CSSProperties =>
  ({ "--nav-delay": `${seconds}s` }) as CSSProperties;

export async function LandingNav() {
  const t = await getTranslations("nav");

  return (
    <header className="flex w-full items-center justify-between px-6 py-7 sm:px-10 lg:px-16 xl:px-20">
      {/* CAMBIO (pedido explícito, 2026-09-16): el nav ya NO comparte el
          contenedor max-w-6xl con el resto de la página -- eso es lo que
          dejaba el logo y los botones lejos de los bordes reales en
          pantallas anchas (ambos quedaban pegados al mismo eje de 1152px
          centrado que el hero). Ahora el header ocupa el 100% del ancho:
          el logo queda pegado a la izquierda real de la página y los
          botones a la derecha real, con su propio padding que crece en
          pantallas grandes (px-6 -> sm:px-10 -> lg:px-16 -> xl:px-20) en
          vez de depender del centrado del contenido debajo. */}
      <Link href="/" className="flex items-center gap-2.5">
        <Image
          src="/logo_controlmiles.png"
          alt="ControlMiles"
          width={32}
          height={32}
          className="nav-mark-in rounded"
          priority
        />
        <span className="nav-word-in display text-xl font-semibold">
          Control<span style={{ color: "var(--lg-blue-deep)" }}>Miles</span>
        </span>
      </Link>
      <nav className="flex items-center gap-2.5 text-sm sm:gap-3.5">
        {/* Entrada escalonada + hover (pedido explícito, 2026-09-17): estos
            controles no tenían ningún efecto, a diferencia del logo
            (nav-mark-in/nav-word-in). nav-action-in reusa el mismo keyframe
            que el wordmark, con --nav-delay escalonado 0.05s por elemento
            para que entren en secuencia; nav-pill agrega el levantamiento
            sutil al pasar el mouse/foco.

            "Verify a report" (pedido explícito, 2026-09-17) salió de acá:
            es una acción de nicho (la usa un tercero verificando UN reporte
            puntual, no el visitante típico) que competía por atención con
            Sign in. Vive en su propia sección más abajo en la página (con
            contexto real, no un botón suelto) y ahora también en el footer
            -- así igual queda alcanzable para quien llega con un link
            directo sin tener que leer toda la página. */}
        <span className="nav-action-in" style={navDelay(0.35)}>
          <LanguageSwitcher label={t("languageLabel")} />
        </span>
        <Link
          href="/pricing"
          className="nav-action-in nav-pill hidden rounded-full border border-[var(--lg-line)] px-4 py-2 font-medium text-[var(--lg-ink-dim)] transition hover:border-[var(--lg-blue)] hover:text-[var(--lg-ink)] sm:inline"
          style={navDelay(0.4)}
        >
          {t("pricing")}
        </Link>
        <Link
          href="/login"
          className="nav-action-in nav-pill rounded-full border border-[var(--lg-ink)] bg-[var(--lg-ink)] px-4 py-2 font-medium text-[var(--lg-bg)] transition hover:border-[var(--lg-blue-deep)] hover:bg-[var(--lg-blue-deep)]"
          style={navDelay(0.45)}
        >
          {t("signIn")}
        </Link>
      </nav>
    </header>
  );
}

export async function LandingFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="border-t border-[var(--lg-line)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-xs text-[var(--lg-ink-dim)] sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <span className="display font-medium">ControlMiles</span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/portal/verify" className="transition hover:text-[var(--lg-ink)]">
            {t("verifyReport")}
          </Link>
          <Link href="/privacy" className="transition hover:text-[var(--lg-ink)]">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="transition hover:text-[var(--lg-ink)]">
            {t("terms")}
          </Link>
          <a href="mailto:support@controlmiles.com" className="transition hover:text-[var(--lg-ink)]">
            support@controlmiles.com
          </a>
          <a href="mailto:contact@controlmiles.com" className="transition hover:text-[var(--lg-ink)]">
            contact@controlmiles.com
          </a>
        </nav>
        <span>{t("rights")}</span>
      </div>
    </footer>
  );
}
