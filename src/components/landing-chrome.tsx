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

import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "./language-switcher";

export async function LandingNav() {
  const t = await getTranslations("nav");

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7 sm:px-10">
      {/* Sin desplazamiento: el logo comparte exactamente el mismo eje
          izquierdo que todo el contenido de la página (medido: 234, igual
          que el hero, las secciones y el footer).
          Hubo dos intentos de "corrección óptica" aquí que se revirtieron:
          ambos partían de medir el logo con getBoundingClientRect mientras
          su animación de entrada (nav-in-left, translateX(-10px)) seguía
          corriendo, así que devolvía la posición de vuelo y no la de reposo.
          Si alguna vez hace falta un ajuste óptico real, medir con las
          animaciones ya terminadas. */}
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
        <LanguageSwitcher label={t("languageLabel")} />
        <Link
          href="/pricing"
          className="hidden rounded-full border border-[var(--lg-line)] px-4 py-2 font-medium text-[var(--lg-ink-dim)] transition hover:border-[var(--lg-blue)] hover:text-[var(--lg-ink)] sm:inline"
        >
          {t("pricing")}
        </Link>
        <Link
          href="/portal/verify"
          className="hidden rounded-full border border-[var(--lg-line)] px-4 py-2 font-medium text-[var(--lg-ink-dim)] transition hover:border-[var(--lg-blue)] hover:text-[var(--lg-ink)] sm:inline"
        >
          {t("verifyReport")}
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-[var(--lg-ink)] bg-[var(--lg-ink)] px-4 py-2 font-medium text-[var(--lg-bg)] transition hover:border-[var(--lg-blue-deep)] hover:bg-[var(--lg-blue-deep)]"
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
