---
name: cesar-britez-design
description: Use this skill to generate well-branded interfaces and assets for César Brítez Aberturas, a premium windows-and-doors (aberturas) business in Formosa, Argentina. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the company's CRM/ERP system.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

Key things to know before designing:
- The system uses **Inter** (Google Fonts) exclusively — weights 300–800
- Brand colours: navy `#031d49` + red `#e31e24` — defined in `colors_and_type.css`
- Every sidebar section owns a distinct accent colour that tints the page background AND the primary CTA — see `colors_and_type.css` for `--accent-{section}-*` tokens
- The app speaks **Argentine Spanish (voseo)** — "Ingresá", "tenés", "hacé", not "ingrese", "tienes"
- Currency is always `Intl.NumberFormat('es-AR', { currency: 'ARS' })` → `$ 1.250.000`
- Lucide React is the ONLY icon library — see `README.md` ICONOGRAPHY section for the canonical map
- KPI metrics live in a dark navy `MetricsBand` (Dashboard) or a compact `CompactStatsBar` (Operaciones) — always visually separated from operational content
- Cards are `rounded-2xl` (16px), buttons are `rounded-xl` (12px), inputs are `rounded-lg` (8px)
- The app must work at 1366×768 (common in Argentina) and on mobile — see `ui_kits/app/styles.css` for breakpoints

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
