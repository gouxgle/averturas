/* Primitives — LogoMark, Watermark, IconTile, Pill, Card, Button, KpiTile.
   All globals on window so other JSX files can use them. */

// ── Brand mark — 2×2 rounded squares ───────────────────────────────
function LogoMark({ size = 32, variant = 'dark' /* dark | color */ }) {
  // 'dark' uses the navy-bg variant (white/red/translucent whites).
  // 'color' uses the brand-sheet colours (navy/red/white/black).
  const gap = Math.round(size * 0.083);
  const sq  = Math.round((size - gap * 3) / 2);
  const r   = Math.round(sq * 0.22);
  const fills = variant === 'color'
    ? ['#031d49', '#e31e24', '#fcfcfc', '#000000']
    : ['rgba(255,255,255,0.90)', '#e31e24', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.20)'];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
      <rect x={gap}        y={gap}        width={sq} height={sq} rx={r} fill={fills[0]} stroke={variant==='color'?'#d1d5db':'none'} strokeWidth={variant==='color'?1:0}/>
      <rect x={gap*2 + sq} y={gap}        width={sq} height={sq} rx={r} fill={fills[1]}/>
      <rect x={gap}        y={gap*2 + sq} width={sq} height={sq} rx={r} fill={fills[2]}/>
      <rect x={gap*2 + sq} y={gap*2 + sq} width={sq} height={sq} rx={r} fill={fills[3]}/>
    </svg>
  );
}

// ── Watermark — fixed full-bleed brand layer for the app shell ─────
function Watermark() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        pointerEvents: 'none', zIndex: 0,
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            repeating-linear-gradient(90deg, transparent 0, transparent 149px, rgba(3,29,73,0.038) 149px, rgba(3,29,73,0.038) 150px),
            repeating-linear-gradient( 0deg, transparent 0, transparent 149px, rgba(3,29,73,0.038) 149px, rgba(3,29,73,0.038) 150px)
          `,
        }}
      />
      <svg viewBox="0 0 200 200" fill="none"
        style={{ position:'absolute', right:'6%', bottom:'8%', width:340, height:340, opacity:0.072, filter:'blur(0.5px)' }}>
        <rect x="8"   y="8"   width="84" height="84" rx="14" fill="#031d49" />
        <rect x="108" y="8"   width="84" height="84" rx="14" fill="#031d49" />
        <rect x="8"   y="108" width="84" height="84" rx="14" fill="#031d49" />
        <rect x="108" y="108" width="84" height="84" rx="14" fill="#031d49" />
      </svg>
      <svg viewBox="0 0 200 200" fill="none"
        style={{ position:'absolute', left:'20%', top:'12%', width:140, height:140, opacity:0.038, filter:'blur(0.4px)' }}>
        <rect x="8"   y="8"   width="84" height="84" rx="14" fill="#031d49" />
        <rect x="108" y="8"   width="84" height="84" rx="14" fill="#031d49" />
        <rect x="8"   y="108" width="84" height="84" rx="14" fill="#031d49" />
        <rect x="108" y="108" width="84" height="84" rx="14" fill="#031d49" />
      </svg>
      <div style={{
        position:'absolute', right:'3%', bottom:'5%', width:420, height:420, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(227,30,36,0.055) 0%, transparent 65%)',
      }}/>
    </div>
  );
}

// ── Icon tile (rounded coloured backing for a Lucide icon) ─────────
function IconTile({ name, size = 'lg', tone = 'navy', iconSize, className = '', style = {} }) {
  // tones map to the section accent system. Each is a {bg, fg} pair
  // following Tailwind's 100/600 (or 100/700 for high contrast).
  const TONES = {
    navy:     { bg: '#e0e7ef', fg: '#031d49' },
    blue:     { bg: '#dbeafe', fg: '#1d4ed8' },
    rose:     { bg: '#ffe4e6', fg: '#be123c' },
    violet:   { bg: '#ede9fe', fg: '#6d28d9' },
    amber:    { bg: '#fef3c7', fg: '#b45309' },
    teal:     { bg: '#ccfbf1', fg: '#0f766e' },
    lime:     { bg: '#ecfccb', fg: '#4d7c0f' },
    emerald:  { bg: '#d1fae5', fg: '#047857' },
    cyan:     { bg: '#cffafe', fg: '#0e7490' },
    indigo:   { bg: '#e0e7ff', fg: '#4338ca' },
    sky:      { bg: '#e0f2fe', fg: '#0369a1' },
    orange:   { bg: '#ffedd5', fg: '#c2410c' },
    purple:   { bg: '#f3e8ff', fg: '#7e22ce' },
    slate:    { bg: '#f1f5f9', fg: '#475569' },
    gray:     { bg: '#f3f4f6', fg: '#4b5563' },
    red:      { bg: '#fee2e2', fg: '#b91c1c' },
    green:    { bg: '#dcfce7', fg: '#15803d' },
  };
  const t = TONES[tone] || TONES.gray;
  const sz = { sm: 28, md: 32, lg: 40, xl: 48 }[size] ?? 40;
  const isz = iconSize ?? (size === 'sm' ? 13 : size === 'md' ? 15 : size === 'xl' ? 22 : 18);
  const r = size === 'sm' ? 8 : size === 'xl' ? 14 : 10;
  return (
    <div
      className={'ic-tile ' + className}
      style={{ width: sz, height: sz, borderRadius: r, background: t.bg, color: t.fg, ...style }}
    >
      <Icon name={name} size={isz} />
    </div>
  );
}

// ── Pill ────────────────────────────────────────────────────────────
function Pill({ tone = 'gray', dot = false, children, style = {} }) {
  const TONES = {
    gray:    { bg: '#f3f4f6', fg: '#4b5563' },
    blue:    { bg: '#dbeafe', fg: '#1d4ed8' },
    emerald: { bg: '#d1fae5', fg: '#047857' },
    amber:   { bg: '#fef3c7', fg: '#b45309' },
    teal:    { bg: '#ccfbf1', fg: '#0f766e' },
    bluish:  { bg: '#bfdbfe', fg: '#1e3a8a' },
    red:     { bg: '#fee2e2', fg: '#b91c1c' },
    violet:  { bg: '#ede9fe', fg: '#6d28d9' },
    rose:    { bg: '#ffe4e6', fg: '#be123c' },
  };
  const t = TONES[tone] || TONES.gray;
  return (
    <span className={'pill' + (dot ? ' pill-dot' : '')} style={{ background: t.bg, color: t.fg, ...style }}>
      {children}
    </span>
  );
}

// ── Card primitives ─────────────────────────────────────────────────
function Card({ children, className = '', tight = false, style = {} }) {
  return <div className={'card ' + (tight ? 'card-tight ' : '') + className} style={style}>{children}</div>;
}

function CardHeader({ icon, iconTone = 'navy', title, sub, action }) {
  return (
    <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
      {icon && <Icon name={icon} size={15} style={{ color: iconToneFg(iconTone), flexShrink: 0 }} />}
      <h2 className="h-section">{title}</h2>
      {sub && <span className="meta" style={{ marginLeft: 4 }}>{sub}</span>}
      {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
    </div>
  );
}

function iconToneFg(t) {
  return {
    navy:'#031d49', red:'#e31e24', amber:'#f59e0b', blue:'#3b82f6',
    emerald:'#10b981', rose:'#fb7185', violet:'#8b5cf6', teal:'#14b8a6',
    purple:'#a855f7', orange:'#fb923c', slate:'#94a3b8', gray:'#6b7280',
    cyan:'#06b6d4', sky:'#0ea5e9', lime:'#84cc16', indigo:'#6366f1',
    green:'#22c55e',
  }[t] || '#6b7280';
}

// ── Button ──────────────────────────────────────────────────────────
function Button({ variant = 'brand', size = 'md', icon, iconAfter, children, onClick, type = 'button', disabled, style = {} }) {
  const cls = `btn ${size === 'sm' ? 'btn-sm ' : ''}btn-${variant}`;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} style={{ opacity: disabled ? 0.6 : 1, ...style }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
      {children}
      {iconAfter && <Icon name={iconAfter} size={size === 'sm' ? 12 : 14} />}
    </button>
  );
}

// ── KPI tile ────────────────────────────────────────────────────────
function KpiTile({ label, value, sub, icon, tone = 'blue', progress, progressColor }) {
  return (
    <div className="card card-tight" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex items-center justify-between">
        <p className="meta" style={{ fontWeight: 500, color: '#6b7280', lineHeight: 1.3 }}>{label}</p>
        {icon && <IconTile name={icon} size="md" tone={tone} />}
      </div>
      <p className="money" style={{ fontSize: 22, lineHeight: 1, letterSpacing: '-0.01em' }}>{value}</p>
      {progress != null && (
        <div className="flex items-center gap-2">
          <div className="bar">
            <div className="bar-fill" style={{ background: progressColor || iconToneFg(tone), width: `${Math.min(progress, 100)}%` }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, color: progressColor || iconToneFg(tone) }} className="tabular">{progress}%</span>
        </div>
      )}
      {sub && <p className="meta">{sub}</p>}
    </div>
  );
}

// ── Format helpers ──────────────────────────────────────────────────
function formatCurrency(v) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(v);
}
function fmtRel(ms) {
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1)  return 'Ahora mismo';
  if (min < 60) return `Hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24)  return `Hace ${hs} h`;
  return `Hace ${Math.floor(hs / 24)} d`;
}

Object.assign(window, { LogoMark, Watermark, IconTile, Pill, Card, CardHeader, Button, KpiTile, iconToneFg, formatCurrency, fmtRel });
