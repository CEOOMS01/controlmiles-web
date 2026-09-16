"use client";

// Olympus Mont Systems LLC - ControlMiles
// src/components/reveal.tsx
//
// Revelado al entrar en viewport, para las páginas públicas.
//
// Por qué un componente cliente y no CSS puro: landing/pricing/privacy/
// terms son Server Components, y el revelado al hacer scroll necesita
// IntersectionObserver, que solo existe en el navegador. Esto es la
// cáscara mínima de cliente ("use client" sobre un div) -- el contenido
// que envuelve sigue renderizándose en el servidor, así que no engorda el
// bundle ni rompe el SEO: el HTML llega completo, solo la clase cambia.
//
// Por qué IntersectionObserver y no un listener de scroll: el observer
// solo despierta cuando se cruza el umbral y no cuesta nada entre medias;
// un handler de scroll corre en cada frame aunque no haya nada que hacer.
//
// Por qué se deja de observar tras revelar: esto es una entrada, no un
// efecto reversible. Volver a ocultar al salir del viewport haría que la
// página "respire" al hacer scroll hacia arriba, que es exactamente la
// clase de movimiento que molesta en vez de ayudar.
//
// El estado inicial (.reveal) lo pinta el servidor, así que no hay frame
// con el contenido ya visible antes de que hidrate.

import { useEffect, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Escalonado dentro de una fila de tarjetas. Índice, no milisegundos:
   *  el paso lo decide --motion-stagger en landing.css, para que cambiarlo
   *  sea una sola edición y no una cacería por todas las páginas. */
  index?: number;
  /** Tope del escalonado. Con muchas tarjetas, dejar crecer el retraso
   *  linealmente hace que la última llegue tardísimo; a partir de aquí
   *  todas comparten el mismo retraso. */
  maxStagger?: number;
  as?: ElementType;
  className?: string;
  /** Estilos propios del elemento envuelto. Se fusionan con la variable
   *  --reveal-delay que este componente inyecta, para que envolver una
   *  tarjeta no obligue a añadir un div intermedio solo por el style. */
  style?: React.CSSProperties;
};

export function Reveal({
  children,
  index = 0,
  maxStagger = 6,
  as: Tag = "div",
  className = "",
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Rama real de movimiento reducido: ni se crea el observer, y NO se
    // toca el estado de React. El bloque @media (prefers-reduced-motion:
    // reduce) de landing.css ya fuerza opacity:1 / transform:none sobre
    // .reveal, así que la clase `is-visible` es irrelevante ahí: llamar a
    // setVisible aquí no cambiaba nada visible y además disparaba el lint
    // react-hooks/set-state-in-effect (renders en cascada), el mismo que
    // este repo ya se encontró una vez en add-vehicle-form.tsx.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Si ya está en pantalla al cargar (todo lo que cae above the fold),
    // el observer dispara en su primer callback igualmente, así que no hay
    // caso especial que escribir.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        // Se revela un poco ANTES de que el borde superior entre: si se
        // espera al cruce exacto, la animación empieza cuando la tarjeta
        // ya está a la vista y se percibe tarde.
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.05,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const steps = Math.min(index, maxStagger);

  return (
    <Tag
      ref={ref}
      className={`reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`}
      style={{
        ...style,
        "--reveal-delay": `calc(${steps} * var(--motion-stagger))`,
      } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
