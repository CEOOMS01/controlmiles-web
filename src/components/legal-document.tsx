// Olympus Mont Systems LLC - ControlMiles
// src/components/legal-document.tsx
//
// Renders a plain-text legal document (numbered ALL-CAPS section headers,
// blank-line-separated paragraphs) as styled JSX. Parses the SAME raw text
// already drafted for the mobile app (lib/legal/legal_documents.dart) --
// ported verbatim, not rewritten, so the two platforms never say something
// different about the same policy.
//
// Strengthened 2026-09-09 (explicit user request): the draft/pending-
// legal-review notice that used to render in the `intro` box below is
// gone -- these are no longer shown to users as drafts. See the mobile
// source file's own header comment for the full disclosure of what
// changed and why (assembled against public competitor ToS/Privacy
// documents and general legal-drafting practice, not attorney-reviewed).

const SECTION_HEADER = /^\d+\.\s+[A-Z]/;

function parseSections(body: string): { heading: string; paragraphs: string[] }[] {
  const blocks = body.trim().split(/\n\n+/);
  const sections: { heading: string; paragraphs: string[] }[] = [];
  let current: { heading: string; paragraphs: string[] } | null = null;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (SECTION_HEADER.test(trimmed)) {
      current = { heading: trimmed, paragraphs: [] };
      sections.push(current);
    } else if (current) {
      current.paragraphs.push(trimmed);
    }
  }
  return sections;
}

export function LegalDocument({
  title,
  lastUpdated,
  body,
}: {
  title: string;
  lastUpdated: string;
  body: string;
}) {
  const sections = parseSections(body);

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
      <h1 className="display text-3xl font-bold tracking-wide sm:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-[var(--lg-ink-dim)]">Last updated: {lastUpdated}</p>
      <p className="text-sm text-[var(--lg-ink-dim)]">© 2026 ControlMiles. All rights reserved.</p>

      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="display text-lg font-semibold tracking-wide text-[var(--lg-ink)]">
              {section.heading}
            </h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-[var(--lg-ink-dim)]">
              {section.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
