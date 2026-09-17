"use client";

// Olympus Mont Systems LLC - ControlMiles
// src/components/counting-stat.tsx
//
// Conteo animado para los 3 números de la tarjeta "Today's Route" del hero
// (pedido explícito, 2026-09-18): entran contando hasta su valor real y se
// quedan estáticos, en vez de aparecer ya con el número final.
//
// Componente cliente mínimo, mismo criterio que Reveal: page.tsx sigue
// siendo Server Component, esto es solo la cáscara que necesita un efecto
// (requestAnimationFrame no existe en el servidor). El valor final llega
// como prop (`to`), así que el HTML servido ya es correcto para SEO/lectores
// de pantalla sin JS -- ver aria-label más abajo.
//
// requestAnimationFrame en vez de setInterval: un intervalo de duración fija
// no se adapta al refresh rate real de la pantalla y acumula deriva frame a
// frame; rAF corre exactamente una vez por frame compuesto, que es lo mismo
// que ya usa la animación SVG de la ruta en page.tsx.

import { useEffect, useRef, useState } from "react";

type CountingStatProps = {
  /** Valor de arranque del conteo (no el que se ve primero -- eso es
   *  `from` mismo, formateado). */
  from: number;
  /** Valor final, el que queda estático al terminar. */
  to: number;
  decimals?: number;
  prefix?: string;
  /** Milisegundos que dura el conteo en sí (sin contar `delay`). */
  duration?: number;
  /** Espera antes de arrancar -- para sincronizar con el resto de la
   *  entrada del hero (el trazo de la ruta, el resto de los stats). */
  delay?: number;
};

export function CountingStat({
  from,
  to,
  decimals = 0,
  prefix = "",
  duration = 1100,
  delay = 0,
}: CountingStatProps) {
  const [value, setValue] = useState(from);
  const format = (n: number) => `${prefix}${n.toFixed(decimals)}`;

  // Rama real de movimiento reducido (mismo criterio que Reveal/landing.css:
  // un estado final forzado, no una animación más lenta) -- se resuelve
  // dentro del propio efecto de conteo, así que solo existe una fuente de
  // verdad para "cuándo empieza" en vez de duplicar la lógica de timing.
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotionRef.current) {
      setValue(to);
      return;
    }

    let raf = 0;
    let startTs: number | null = null;

    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // cubic ease-out

    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      setValue(from + (to - from) * ease(progress));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setValue(to);
      }
    };

    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- from/to/duration/delay son props fijas de este stat concreto, no cambian entre renders reales.
  }, []);

  return (
    <span aria-label={format(to)}>
      <span aria-hidden="true">{format(value)}</span>
    </span>
  );
}
