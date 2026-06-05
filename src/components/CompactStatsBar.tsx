import { BarChart3 } from 'lucide-react';

interface StatItem {
  value: string | number;
  label: string;
  color?: string;
}

export function CompactStatsBar({ items }: { items: StatItem[] }) {
  return (
    <div className="flex items-center gap-0 rounded-xl overflow-x-auto shrink-0"
      style={{
        background: 'linear-gradient(90deg,#031d49 0%,#0a2761 100%)',
        minHeight: 52,
        padding: '0 20px',
        boxShadow: '0 4px 16px -8px rgba(3,29,73,0.35)',
      }}>
      <div className="flex items-center gap-1.5 mr-4 shrink-0"
        style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.40)' }}>
        <BarChart3 size={11} color="#fbbf24" /> Métricas
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center shrink-0">
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.12)', margin: '0 16px', flexShrink: 0 }} />
          <div className="flex items-baseline gap-1.5">
            <span style={{ fontSize: 18, fontWeight: 800, color: item.color ?? '#ffffff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {item.value}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
