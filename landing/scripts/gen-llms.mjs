// Generate llms.txt (a curated, agent-readable index) and llms-full.txt (the
// whole docs corpus as plain markdown) from the MDX pages in content/.
//
// Runs as a `prebuild` step, so the files regenerate from source on every build
// and never drift. Output lands in public/, which `next build` copies to out/,
// so the files are served at <site>/llms.txt and <site>/llms-full.txt.
//
// This is a build tool: keep it dependency-free (Node stdlib only).

import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'

const HERE = import.meta.dirname
const CONTENT = join(HERE, '..', 'content')
const PUBLIC = join(HERE, '..', 'public')
const BASE = 'https://sainathr19.github.io/wharfnet'

// `--check` verifies the index is consistent with the doc pages (used by CI) and
// writes nothing; without it, the files are (re)generated.
const CHECK = process.argv.includes('--check')

// Curated sections for the llms.txt index — routes without the leading slash.
// Any page not listed here still gets appended to llms-full.txt (see below), so
// a new page is never silently dropped; it just won't be indexed until added.
const SECTIONS = [
  { title: 'Documentation', routes: ['getting-started', 'concepts'] },
  {
    title: 'Chains',
    routes: [
      'chains/overview',
      'chains/evm',
      'chains/solana',
      'chains/starknet',
      'chains/bitcoin',
      'chains/litecoin',
      'chains/zksync'
    ]
  },
  {
    title: 'Reference',
    routes: ['reference/cli', 'reference/config', 'reference/manifest', 'reference/testkit']
  },
  { title: 'Examples & meta', routes: ['examples', 'changelog', 'contributing'] }
]

/** Recursively list every .mdx file under `dir`. */
function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.mdx')) out.push(full)
  }
  return out
}

/** content/reference/cli.mdx -> "reference/cli"; content/index.mdx -> "". */
function routeOf(file) {
  const rel = relative(CONTENT, file).replace(/\.mdx$/, '')
  return rel === 'index' ? '' : rel
}

/** A page's canonical URL (the site uses trailingSlash). */
function urlOf(route) {
  return route === '' ? `${BASE}/` : `${BASE}/${route}/`
}

/** Strip frontmatter, imports, and whole-line JSX component tags; keep prose. */
function clean(source) {
  let body = source
  // Frontmatter block.
  body = body.replace(/^---\n[\s\S]*?\n---\n/, '')
  const kept = []
  for (const line of body.split('\n')) {
    // `import { X } from '...'`
    if (/^\s*import\s.+from\s/.test(line)) continue
    // A line that is *only* a JSX component tag (open/close/self-closing) for a
    // Capitalized component, e.g. <Callout type="info">, </Steps>, <BootDemo />,
    // <Tabs.Tab>. Inline placeholders like `<CHAIN>` inside prose/code survive
    // because those lines carry other content and fail this full-line match.
    if (/^\s*<\/?[A-Z][A-Za-z0-9.]*(\s[^>]*?)?\/?>\s*$/.test(line)) continue
    kept.push(line)
  }
  // Collapse 3+ blank lines left by stripping into a single blank line.
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Frontmatter `title:`, falling back to the first `# ` heading or the route. */
function titleOf(source, route) {
  const fm = source.match(/^---\n([\s\S]*?)\n---/)
  const t = fm && fm[1].match(/^title:\s*(.+)$/m)
  if (t) return t[1].trim().replace(/^["']|["']$/g, '')
  const h1 = source.match(/^#\s+(.+)$/m)
  return h1 ? h1[1].trim() : route || 'Introduction'
}

/** First sentence of the first prose paragraph, for the index one-liner. */
function summaryOf(body) {
  const para = []
  for (const line of body.split('\n')) {
    const t = line.trim()
    const prose =
      t && !/^(#|\||```|-|>|\d+\.)/.test(t) // skip headings, tables, code, lists, quotes
    if (prose) para.push(t)
    else if (para.length) break // reached the end of the first paragraph
  }
  const joined = para
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [text](url) -> text
    .replace(/[`*]/g, '') // drop code ticks / emphasis
    .trim()
  const m = joined.match(/^(.+?[.?!])(\s|$)/)
  let s = (m ? m[1] : joined).trim()
  if (s.length > 160) s = s.slice(0, 157).trimEnd() + '…'
  return s
}

// ---- load every page ----
const pages = new Map() // route -> { title, url, body, summary }
for (const file of walk(CONTENT)) {
  const source = readFileSync(file, 'utf8')
  const route = routeOf(file)
  const body = clean(source)
  pages.set(route, {
    title: titleOf(source, route),
    url: urlOf(route),
    body,
    summary: summaryOf(body)
  })
}

// ---- consistency check ----
// The index in llms.txt must stay in sync with the pages: every indexed route
// must exist, and every doc page (except the JSX-heavy landing page) must be
// indexed. This catches the real drift — a page added, renamed, or removed
// without updating SECTIONS. Fatal under `--check` (CI); a warning otherwise.
{
  const indexed = new Set(SECTIONS.flatMap((s) => s.routes))
  const problems = []
  for (const route of indexed) {
    if (!pages.has(route)) {
      problems.push(`index references a missing page: "${route}" (fix SECTIONS in scripts/gen-llms.mjs)`)
    }
  }
  for (const route of pages.keys()) {
    if (route !== '' && !indexed.has(route)) {
      problems.push(`page "${route}" is not in the llms.txt index (add it to SECTIONS in scripts/gen-llms.mjs)`)
    }
  }
  if (CHECK) {
    if (problems.length) {
      console.error('gen-llms --check: the llms.txt index is out of sync with the docs:')
      for (const p of problems) console.error(`  - ${p}`)
      process.exit(1)
    }
    console.log(`gen-llms --check: OK — ${pages.size} pages, index consistent`)
    process.exit(0)
  }
  for (const p of problems) console.warn(`gen-llms: ${p}`)
}

const overview =
  'One-command localnet for EVM, Solana, Starknet, Bitcoin, Litecoin & zkSync — ' +
  'boot real dev nodes for every chain your app touches with a single command, ' +
  'with funded accounts, fixed-address test tokens, a unified faucet, chain-control ' +
  'cheats, forking, and a machine-readable manifest for tests and agents.'

// ---- llms.txt (curated index) ----
{
  const out = [`# wharfnet`, ``, `> ${overview}`, ``]
  for (const section of SECTIONS) {
    out.push(`## ${section.title}`, ``)
    for (const route of section.routes) {
      const p = pages.get(route)
      if (!p) continue // already reported by the consistency check above
      out.push(`- [${p.title}](${p.url})${p.summary ? `: ${p.summary}` : ''}`)
    }
    out.push(``)
  }
  out.push(`## Full text`, ``, `- [llms-full.txt](${BASE}/llms-full.txt): the complete documentation as one file.`, ``)
  mkdirSync(PUBLIC, { recursive: true })
  writeFileSync(join(PUBLIC, 'llms.txt'), out.join('\n'))
}

// ---- llms-full.txt (whole corpus) ----
{
  // Ordered routes: the curated ones first, then any remaining pages (except the
  // JSX-heavy landing page) so nothing new is silently dropped.
  const ordered = SECTIONS.flatMap((s) => s.routes)
  const rest = [...pages.keys()].filter((r) => r !== '' && !ordered.includes(r))
  const all = [...ordered.filter((r) => pages.has(r)), ...rest]

  const out = [
    `# wharfnet — full documentation`,
    ``,
    `> ${overview}`,
    ``,
    `Source: ${BASE}/`,
    ``,
    `---`,
    ``
  ]
  for (const route of all) {
    const p = pages.get(route)
    // Drop the page's own leading H1 — we emit the title as the section header.
    const body = p.body.replace(/^#\s+.+\n+/, '')
    out.push(`# ${p.title}`, ``, `Source: ${p.url}`, ``, body, ``, `---`, ``)
  }
  writeFileSync(join(PUBLIC, 'llms-full.txt'), out.join('\n'))
}

console.log(`gen-llms: wrote public/llms.txt and public/llms-full.txt (${pages.size} pages)`)
