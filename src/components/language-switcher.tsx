"use client";

// Olympus Mont Systems LLC - ControlMiles
// src/components/language-switcher.tsx
//
// Cambio de idioma conservando la página actual: quien está leyendo
// /pricing en inglés aterriza en /es/pricing, no en la portada. Mandarlo a
// la raíz es el fallo más común de estos selectores y es el que hace que
// la gente deje de usarlos.
//
// Es un <select> nativo a propósito, no un desplegable a medida: con dos
// idiomas, el control del sistema ya es accesible por teclado, se anuncia
// solo en lectores de pantalla y en móvil abre la rueda nativa. Un
// componente propio aquí solo añadiría superficie que mantener.

import { useTransition } from "react";
import { usePathname } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";

const LANGUAGES: { code: Locale; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
];

export function LanguageSwitcher({ label }: { label: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Navegación DURA a propósito, no router.replace().
  //
  // El atributo lang de <html> lo escribe el layout raíz, que queda por
  // ENCIMA del segmento [locale] y por tanto no se vuelve a renderizar en
  // una transición de cliente: medido en el navegador, tras cambiar a
  // español la página mostraba contenido en español con lang="en" colgado.
  // Un lector de pantalla lo habría leído con pronunciación inglesa.
  // Cambiar de idioma es una acción rara; pagar una recarga completa a
  // cambio de que lang, hreflang y canonical queden coherentes es el
  // intercambio correcto.
  function switchTo(next: Locale) {
    const target =
      next === routing.defaultLocale ? pathname : `/${next}${pathname === "/" ? "" : pathname}`;
    window.location.assign(target || "/");
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        id="language-switcher"
        value={locale}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value as Locale;
          // usePathname de next-intl devuelve la ruta SIN prefijo de idioma,
          // así que basta con anteponer el nuevo (o ninguno, si es el idioma
          // por defecto) para conservar la página en la que está el usuario.
          startTransition(() => switchTo(next));
        }}
        className="mono cursor-pointer rounded-full border border-[var(--lg-line)] bg-transparent px-3 py-2 text-xs font-medium text-[var(--lg-ink-dim)] transition hover:border-[var(--lg-blue)] hover:text-[var(--lg-ink)] disabled:opacity-60"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
