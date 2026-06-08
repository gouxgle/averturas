/* SectionHero + MetricsBand — the two patterns that wall off sections.

   <SectionHero> sits at the top of every page. It renders a tinted strip
   in the section's accent colour, with breadcrumb · title · sub-title on
   the left and a primary CTA on the right. The page background also
   takes on a soft wash of the section accent — together these announce
   "you are HERE" before the user reads a word.

   <MetricsBand> wraps KPI tiles in a dark navy block, visually walling
   them off from the lighter operational areas below. */

function SectionHero({ section, icon, title, sub, breadcrumb, actions }) {
  return (
    <div className="section-hero">
      <div className="section-hero-inner">
        {icon && (
          <div className="section-hero-mark">
            <Icon name={icon} size={28} color={sectionDeep(section)} />
          </div>
        )}
        <div className="section-hero-text">
          {breadcrumb && (
            <div className="section-hero-crumb">
              {breadcrumb.map((c, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="sep">/</span>}
                  <span className={i === breadcrumb.length - 1 ? 'accent' : ''}>{c}</span>
                </React.Fragment>
              ))}
            </div>
          )}
          <h1 className="section-hero-title">{title}</h1>
          {sub && <p className="section-hero-sub">{sub}</p>}
        </div>
        {actions && <div className="section-hero-actions">{actions}</div>}
      </div>
    </div>
  );
}

function MetricsBand({ title = 'Métricas del negocio', sub, children }) {
  return (
    <div className="metrics-band">
      <div className="metrics-band-head">
        <Icon name="BarChart3" size={14} color="#fbbf24" />
        <span className="metrics-band-title">{title}</span>
        {sub && <span className="metrics-band-sub">{sub}</span>}
      </div>
      <div className="metrics-grid">{children}</div>
    </div>
  );
}

function MetricTile({ label, value, sub, icon, progress, progressColor = '#fbbf24' }) {
  return (
    <div className="metrics-tile">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <p className="metrics-tile-label">{label}</p>
        {icon && (
          <div className="metrics-tile-icon">
            <Icon name={icon} size={16} />
          </div>
        )}
      </div>
      <p className="metrics-tile-value">{value}</p>
      {progress != null && (
        <div className="flex items-center gap-2">
          <div className="bar">
            <div className="bar-fill" style={{ background: progressColor, width: `${Math.min(progress, 100)}%` }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, color: progressColor }} className="tabular">{progress}%</span>
        </div>
      )}
      {sub && <p className="metrics-tile-sub">{sub}</p>}
    </div>
  );
}

function sectionDeep(section) {
  return {
    dashboard: '#1d4ed8', crm: '#be123c', presupuestos: '#6d28d9',
    operaciones: '#b45309', remitos: '#0f766e', pedidos: '#4d7c0f',
    recibos: '#047857', clientes: '#0e7490', estado: '#4338ca',
    productos: '#0369a1', stock: '#c2410c', proveedores: '#b45309',
    reportes: '#7e22ce', config: '#475569',
  }[section] || '#031d49';
}

/* ── CompactStatsBar — slim navy strip with value + label per metric ── */
function CompactStatsBar({ items }) {
  return (
    <div style={{
      background: 'linear-gradient(90deg, #031d49 0%, #0a2761 100%)',
      borderRadius: 12,
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      height: 52,
      gap: 0,
      overflowX: 'auto',
      boxShadow: '0 4px 16px -8px rgba(3,29,73,0.35)',
      flexWrap: 'nowrap',
      flexShrink: 0,
    }}>
      {/* "Métricas" header label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginRight: 16, flexShrink: 0,
        fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.14em', color: 'rgba(255,255,255,0.40)',
      }}>
        <Icon name="BarChart3" size={11} color="#fbbf24" />
        Métricas
      </div>

      {items.map((item, i) => (
        <React.Fragment key={i}>
          {/* Vertical divider */}
          <div style={{
            width: 1, height: 28,
            background: 'rgba(255,255,255,0.12)',
            margin: '0 16px', flexShrink: 0,
          }} />
          {/* Metric item: value + label */}
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 6,
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 18, fontWeight: 800,
              color: item.color || '#ffffff',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}>{item.value}</span>
            <span style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.55)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>{item.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

Object.assign(window, { SectionHero, MetricsBand, MetricTile, CompactStatsBar, sectionDeep });
