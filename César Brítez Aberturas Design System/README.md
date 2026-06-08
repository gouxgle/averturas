# César Brítez Aberturas — Design System

A design system for **César Brítez Aberturas**, a windows-and-doors (*aberturas*) retail and installation business based in **Formosa, Argentina**. The visual brand and the in-house CRM/ERP that runs the business are designed as one — this system covers both.

> **Tagline / brand promise:** *"Aberturas bien pensadas."* — Well-thought-out windows.

---

## Product context

César Brítez is a single, vertically-integrated business. There is one product surface to design for:

- **Sistema de gestión (CRM / ERP)** — internal web app used by the owner and a small team (admin / vendedor / consulta roles) to manage the entire commercial cycle: presupuesto (quote) → operación → pedido → remito (delivery note) → recibo (receipt). It also includes CRM, catalogue, stock, suppliers, and reports. Spanish-language, desktop-first with a mobile drawer fallback.

There is **one public-facing screen** inside the app — `/p/:token` — a no-auth approval link a customer opens from a WhatsApp message to approve their quote. Other than that, the system has no marketing site, app, or docs site in this codebase.

## Sources

- **Codebase:** `gouxgle/averturas` on GitHub — <https://github.com/gouxgle/averturas>. Stack: React 19 + TypeScript + Vite + Tailwind 3 + Lucide icons + React Router v7 + TanStack Query + Sonner toasts + Recharts.
- Read [`gouxgle/averturas/CLAUDE.md`](https://github.com/gouxgle/averturas/blob/main/CLAUDE.md) for the full business / data model brief and [`README.md`](https://github.com/gouxgle/averturas/blob/main/README.md) for setup.
- Brand colours documented inline at the top of `assets/logo-completo.jpeg` (a brand sheet that ships in the repo root).

If you need to do deeper work, fetching `src/pages/Dashboard.tsx`, `src/components/Layout/{Sidebar,AppLayout}.tsx`, `src/index.css`, and `tailwind.config.js` from the repo will give you 80% of the visual contract.

---

## Index — what's in this folder

```
README.md                ← you are here
SKILL.md                 ← portable Claude Skill manifest
colors_and_type.css      ← all design tokens as CSS vars

assets/                  ← logos, brand imagery, screenshots
preview/                 ← Design System tab cards (open Design System tab to browse)
ui_kits/
  app/                   ← The CRM/ERP UI kit (sidebar, dashboard, login, components)
    index.html           ← clickable end-to-end demo
    *.jsx                ← per-component sources
```

---

## CONTENT FUNDAMENTALS

The whole product speaks **Argentine Spanish (voseo)**, addresses the user as *tú/vos* casually, and treats the screen as a working surface for a small-business owner — not a marketing canvas.

### Voice & tone

- **Voseo, second person, warm.** Dashboard greets `¡Buenos días, {nombre}! 👋` and follows with `Acá tenés todo lo importante de tu negocio.` Notice `tenés`, not `tienes`. Login subhead is `Ingresá tus credenciales para continuar.`
- **First-person plural for the brand**, when the brand speaks to the customer (e.g. the WhatsApp template: `te contactamos desde César Brítez Aberturas.`)
- **Direct, never corporate.** Action buttons are verbs in vos imperative: `Ingresar`, `Aprobar`, `Compartir`, `Cobrar saldo`, `Registrar cobro`, `Crear pedido →`, `Crear remito →`. No "Submit", no "Confirm", no "Click here".
- **Tiny, actionable copy under titles.** Card headers always have a `text-xs text-gray-400` subline that explains what to do, e.g. `Tu foco para hoy`, `A quién contactar hoy`, `Vencen en los próximos 2 días`.

### Casing

- **Sentence case** for page titles, card titles, button labels: *"Tablero de Operaciones"*, *"Nuevo presupuesto"*, *"Cobrar saldo"*.
- **UPPERCASE + widest tracking** for section headers inside cards: *"PRIORIDADES DE HOY"*, *"NÚMEROS CLAVE DEL NEGOCIO"*, *"PRODUCTOS MÁS VENDIDOS"*. These are `text-sm font-bold uppercase tracking-wider`.
- **UPPERCASE** for the brand mark whenever the wordmark appears: `CÉSAR BRÍTEZ` (always with the accent, always extrabold, always tracked).
- **UPPERCASE small labels** for form-field labels: `EMAIL`, `CONTRASEÑA` — `text-xs font-semibold uppercase tracking-wider text-gray-500`.

### Pluralization

The code carefully pluralizes Spanish counts inline. Always do this:

```
{n} pedido{n !== 1 ? 's' : ''} listo{n !== 1 ? 's' : ''} para entregar
Hace {dias} día{dias !== 1 ? 's' : ''}
```

Never write `pedido(s)` or `1 pedidos`. The system is meticulous about this.

### Numbers, money, dates

- **Currency** is always `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })`. Output looks like `$ 1.250.000`. Render with `tabular-nums` so columns of money line up.
- **Dates**: `dd/mm/aaaa` (`Intl.DateTimeFormat('es-AR')`). Casual references — `Hoy, 4 de junio`, `Hace 3 días`, `Vencen en los próximos 2 días`.
- **Percentages**: integers, no decimal — `38%`, never `38.0%`.

### Emoji

**Used VERY sparingly, and only in greetings.** The only emoji in the entire codebase is `👋` on the Dashboard greeting. Don't introduce more. **No emoji icons in lists, badges, buttons, or empty states** — those are all Lucide.

### Specific phrases worth lifting verbatim

```
Aberturas bien pensadas.            ← tagline
Ingresá tus credenciales            ← form helper
Tu foco para hoy                    ← micro-headline
Acá tenés todo lo importante        ← Dashboard subhead
Sin presupuestos enviados en espera ← empty state
Todos los clientes con contacto reciente ← empty state
¡Todo bajo control!                 ← celebratory empty state
Sin notificaciones pendientes
Marcar leídas
Hace X días / Hace X min / Ahora mismo
```

---

## VISUAL FOUNDATIONS

The look is **dense, professional, very rounded, blue-tinted neutral, with bursts of red as the brand accent and one accent colour per section of the app.** It feels like a serious business tool that's been polished — not a startup splash page.

### Brand colours (from `assets/logo-completo.jpeg`)

| Token        | Hex       | Where it lives                                                                 |
|--------------|-----------|--------------------------------------------------------------------------------|
| `--brand-navy`  | `#031d49` | Sidebar, top bar, primary CTAs, headings, logo top-left square             |
| `--brand-red`   | `#e31e24` | Logo top-right square, destructive CTAs, alert dots, accent details         |
| `--brand-white` | `#fcfcfc` | Logo bottom-left square                                                     |
| `--brand-black` | `#000000` | Logo bottom-right square (rarely surfaces outside the mark)                 |

The full mark = a 2×2 grid of rounded squares (one per colour). The four-square arrangement is the **isologotipo** and shows up at every scale — sidebar `30×30`, login `72×72`, watermark `340×340`.

### App background — the "tinted neutral" trick

The app does NOT sit on white. It sits on `#f0f4fb` — a faint blue-grey. White cards float on top, which gives the whole interface a calmer, more architectural feel than the typical SaaS white-on-white. **Always render mock screens on `--app-bg`, not on `#fff`.**

Behind the content sits a `<Watermark>` overlay (see `AppLayout.tsx`):

1. A 150 × 150px grid of 0.038-opacity navy lines — "marco de ventana" (window-frame) pattern.
2. The 2×2 logo mark at 7.2% opacity, 340×340, bottom-right, with a 0.5px blur.
3. A smaller (140×140, 3.8% opacity) secondary mark top-left.
4. A 420×420 `radial-gradient(circle, rgba(227,30,36,0.055) 0%, transparent 65%)` red mist behind the main mark.

This watermark is **fixed** (`position: fixed`), `pointer-events: none`, and lives under content (`z-index: 0`). Reproduce it on any full-page mock to anchor the brand.

### Type

- **One family: Inter.** Loaded from Google Fonts with weights `300, 400, 500, 600, 700, 800`. No serifs, no monospace (except occasional `font-mono` on document numbers like `PR-0042`).
- **Heavy use of 800 (extrabold)** for *anything numerical or hierarchical*: KPI values, money, page titles, badges. Body text is 400/500.
- **Tiny labels are deliberate.** A standard dashboard card has `text-[11px] font-bold uppercase tracking-widest` headers and `text-[10px]–[12px]` body. 10–11px reads cleanly because Inter is hinted, and densityis a feature. Don't "fix" this by scaling up.

### Spacing & layout

- **Tight, gap-based.** Sections use `gap-3` to `gap-5` (12–20px). Card padding is `p-4` (16px) by default, `p-3` for dense rows.
- **Max content width: ~1340–1440px**, centered with `mx-auto`. Two-column dashboards: a flexible main + a `xl:w-[280px]–[300px]` sidebar.
- **Grid hierarchy:** 5-up KPI tiles on `xl`, collapsing to 2 on mobile (`grid-cols-2 sm:grid-cols-3 xl:grid-cols-5`).
- **Sidebar is a 56px icon-only rail** on desktop (`lg:w-14`), expands to a 256px (`w-64`) drawer on mobile. **Never** show labels inline on desktop — they appear as floating tooltips on hover.

### Radii

The system commits to large radii:

- `rounded-lg` (8px) — icon tiles, inputs, small badges, tooltips
- `rounded-xl` (12px) — buttons, table rows, list items, KPI inner tiles
- `rounded-2xl` (16px) — **cards** (the workhorse — every container is `rounded-2xl`)
- `rounded-full` — avatars, status badges, count chips

A button is `rounded-xl`. A card is `rounded-2xl`. A toast is `borderRadius: 14px`. Sharp corners are reserved for tables inside printed PDFs.

### Borders

- Default card border: `border border-gray-100` — very pale, almost invisible. The shadow does the lifting.
- Stronger separation: `border-gray-200`.
- **Status emphasis uses a left-border accent**: `border-l-4 border-emerald-400` on Kanban column headers, `border-l-emerald-500` on dashboard rows that need to scream "approved online". Use sparingly — this is a high-attention motif.
- Dividers on navy backgrounds: `1px solid rgba(255,255,255,0.08)`.

### Shadows

Subtle by default, lifted on hover.

| Token            | Value                                                                                  | Use                          |
|------------------|----------------------------------------------------------------------------------------|------------------------------|
| `--shadow-card`  | `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)`                                 | Default for every card       |
| `--shadow-soft`  | `0 2px 15px -3px rgba(0,0,0,.07), 0 10px 20px -2px rgba(0,0,0,.04)`                    | Modals, dropdowns            |
| `--shadow-lift`  | `0 10px 32px -6px rgba(3,29,73,0.13), 0 4px 12px -2px rgba(3,29,73,0.07)`              | `.card-lift:hover`           |
| `--shadow-top`   | `0 2px 12px rgba(3,29,73,0.25)`                                                        | Top nav bar (navy background)|
| `--shadow-btn`   | `0 4px 16px rgba(3,29,73,0.25)`                                                        | `.btn-brand:hover`           |

Shadow colours that hit navy backgrounds use `rgba(3,29,73,...)` — the brand-navy tinted black, not plain black.

### Backgrounds & imagery

- **No full-bleed photography in the app itself.** The only real photograph in the brand is the storefront render (`assets/portada-fachada.png`) — used for marketing, not UI.
- **No gradients except one:** the dashboard's primary "Nuevo presupuesto" button uses `linear-gradient(135deg, #0d3a8a 0%, #e31e24 100%)`. There's also a text gradient `linear-gradient(135deg, #031d49 0%, #1a4fa0 100%)` for the occasional hero number.
- **No mesh, no glassmorphism.** A `.glass-card` class exists in `index.css` but is *not used*; treat it as available-but-unused.
- The window-frame watermark grid (above) is the only repeating texture.

### Hover & press states

- **Idle → hover on nav items:** `bg-white/5` overlay, then scale icon `1.10` (sidebar). On cards: `card-lift` lifts `-3px` with a navy-tinted shadow.
- **Press:** `active:scale-[0.98]` on brand and red buttons.
- **Link hover** on light bg: text shifts from `text-blue-600 → text-blue-700` (one step darker).
- **Row hover** in lists: `hover:bg-gray-50` — never a fill darker than `bg-gray-100`.
- **Cards hover** with `transition-all` over 220ms, ease `cubic-bezier(.22,.68,0,1.1)` (a slight overshoot).

### Animations

Page entrance + stagger is signature. Defined in `index.css`:

```css
@keyframes fadeInUp { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }
.fade-in   { animation: fadeInUp 0.38s cubic-bezier(.22,.68,0,1.1) both; }
.d1{animation-delay:.05s} .d2{.10s} .d3{.15s} .d4{.20s} .d5{.26s} .d6{.32s}
```

- **Page enter:** `.page-enter` (fade-up 350ms).
- **Card enter:** stagger via `.fade-in .d1`, `.d2`, ... — apply to direct children of the page wrapper.
- **Notification dot pulse:** `@keyframes pulseDot` (opacity + scale, 1.8s infinite). Only on live-status dots.
- **Loading shimmer:** `@keyframes shimmer` (200% bg-position sweep, 1.6s) on `.skeleton` placeholders.
- **No bouncy springs, no parallax, no autoplay videos.** This is a working tool.

### Transparency & blur

- Used only for: the navy sidebar's text tiers (`rgba(255,255,255, 0.55/0.45/0.35/0.10)`), tooltips, the watermark blur (0.4–0.5px), and the notif dropdown's white-on-navy hierarchy.
- `backdrop-filter: blur(12px)` is defined but unused in production UI.

### Status / state vocabulary

Status is communicated three ways, in this order of preference:

1. **A pastel pill:** `bg-{color}-100 text-{color}-700 text-[10px] font-bold rounded-full px-1.5 py-0.5`. Examples: `Aprobado`, `Pagado`, `Señado`, `Sin pago`.
2. **A coloured dot in a pill:** `dot-pulse` class — 6px circle, `currentColor`, pulsing.
3. **A coloured left-border on the whole row** — only when something needs urgent surfacing (e.g. just-approved-online presupuestos get `border-l-4 border-emerald-500 bg-emerald-50/50`).

### Section colour assignment

This is the most important rule. **Every section of the sidebar owns a colour**, and that colour propagates through icons, badges, and accents on screens that belong to that section:

| Section                | Tailwind          | Hex (--accent-*)         |
|------------------------|-------------------|--------------------------|
| Dashboard              | `blue-400`        | `#60a5fa`                |
| CRM                    | `rose-400`        | `#fb7185`                |
| Presupuestos           | `violet-400`      | `#a78bfa`                |
| Operaciones            | `amber-400`       | `#fbbf24`                |
| Remitos                | `teal-400`        | `#2dd4bf`                |
| Pedidos                | `lime-400`        | `#a3e635`                |
| Recibos                | `emerald-400`     | `#34d399`                |
| Clientes               | `cyan-400`        | `#22d3ee`                |
| Estado de Cuenta       | `indigo-400`      | `#818cf8`                |
| Productos              | `sky-400`         | `#38bdf8`                |
| Existencias / Stock    | `orange-400`      | `#fb923c`                |
| Proveedores            | `amber-400`       | `#fbbf24`                |
| Reportes               | `purple-400`      | `#c084fc`                |
| Configuración          | `slate-300`       | `#cbd5e1`                |

When you design a new page for, say, Recibos — the page header icon tile is `bg-emerald-100 text-emerald-600`, the primary CTA stays brand-navy, but the active-row borders and ribbon details are emerald.

---

## ICONOGRAPHY

**The system uses Lucide React exclusively** (`lucide-react@^1.8.0`). No emoji-as-icons, no Material, no Heroicons, no custom SVG sprites in the codebase. Stroke icons, default stroke width (2), no fills.

### Sizing

- Sidebar nav: `size={20}`
- Card headers: `size={14}` or `size={15}` next to a `text-sm` title
- KPI tiles: `size={16}` inside a `w-8 h-8` icon tile, or `size={22}` inside `w-12 h-12`
- Inline (in a row of text): `size={13}` to `size={14}`
- Chevrons: `size={12}` (small ChevronRight after "Ver todos")

### Icon tile pattern

This is everywhere. An icon never floats unaccompanied — it sits in a rounded coloured tile that picks up the section's accent:

```jsx
<div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
  <CheckCircle2 size={16} className="text-emerald-600" />
</div>
```

The tile is `rounded-lg` (8px) for small icons, `rounded-xl` (12px) for larger ones, and the bg/fg pair is the `100`/`600` tailwind tone of whichever accent applies. **Every section in the app reuses this exact pattern with its own colour.**

### Canonical Lucide icon map

These are the in-use mappings from `Sidebar.tsx` + the major pages. Stick to them; don't substitute:

| Concept                  | Icon              |
|--------------------------|-------------------|
| Dashboard                | `LayoutDashboard` |
| CRM / pipeline           | `GitBranch`       |
| Presupuestos (quotes)    | `FileText`        |
| Operaciones              | `Hammer`          |
| Remitos (delivery notes) | `Truck`           |
| Pedidos                  | `ShoppingCart`    |
| Recibos                  | `Receipt`         |
| Clientes                 | `Users`           |
| Estado de Cuenta         | `BookOpen`        |
| Productos                | `Layers`          |
| Stock / Existencias      | `Boxes`           |
| Proveedores              | `Factory`         |
| Reportes                 | `TrendingUp`      |
| Configuración            | `SlidersHorizontal`|
| Notifications            | `Bell`            |
| Logout                   | `LogOut`          |
| Approve / success        | `CheckCircle2`    |
| Warning / risk           | `AlertTriangle`   |
| Delete / cancel          | `XCircle` / `X`   |
| Money / sales            | `DollarSign`      |
| Time / calendar          | `CalendarClock`, `Clock` |
| Communication            | `Phone`, `Mail`, `MessageCircle` |
| Add                      | `Plus`            |
| Forward (link)           | `ChevronRight`    |

In HTML mocks where Lucide React isn't available, use the **Lucide static SVG CDN** (`https://unpkg.com/lucide-static@latest/icons/<name>.svg`) or load `lucide.min.js` and call `lucide.createIcons()`. Both give pixel-identical output. **Never** substitute Material/Heroicons stylistically — Lucide's stroke is the brand.

### Logos

Three logo variants ship in `assets/`:

- `assets/logo-completo.jpeg` — the brand sheet (wordmark + brand swatches; reference, not for production use)
- `assets/logo-isotipo-navy.png` — the isologotipo on navy with white wordmark (boxed)
- The **drawn 2×2 SVG mark** in `Sidebar.tsx` (the in-code logo) — preferred for any UI use because it scales crisply. See `ui_kits/app/LogoMark.jsx` for the portable component.

### Imagery

No icon-style illustrations, no spot illustrations, no stock photos in the UI. The only photographic asset is `assets/portada-fachada.png` (a rendered storefront for marketing).

---

## Caveats

- **Inter via Google Fonts CDN only** — no `.ttf` / `.woff2` ships in the repo. If you're deploying offline, host Inter yourself. We did not bundle font files; flag this to the team if it matters.
- **Lucide via JSX in app, via CDN in mocks** — the design system cards in `preview/` use `https://unpkg.com/lucide-static/...`. If you need pixel-identical icons in slides, snapshot from the live app.
- **One product, one UI kit.** This system covers the CRM/ERP. There is no marketing site, no native mobile app, no docs site — those would be separate work.
