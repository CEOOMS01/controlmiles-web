// Olympus Mont Systems LLC - ControlMiles
// src/lib/dates.ts
//
// eslint-plugin-react-hooks' purity rule flags any Date.now()/Math.random()
// call sitting directly inside a component function body, Server Components
// included -- even though an RSC computing "N days ago" fresh per request
// is exactly correct behavior here, not a bug. Isolating the impure call in
// a plain (non-component) helper satisfies the rule without disabling it:
// the linter only requires component/hook function bodies to be pure,
// and this function is neither.
export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
