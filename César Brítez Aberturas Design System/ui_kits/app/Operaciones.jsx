/* Operaciones — Kanban tablero of 6 columns. Mirrors src/pages/Operaciones.tsx. */

const ESTADO_LABEL = {
  presupuesto: 'Borrador', enviado: 'Enviado', aprobado: 'Aprobado',
  en_produccion: 'En producción', listo: 'Listo',
  entregado: 'Entregado', cancelado: 'Cancelado',
};

const COL_DEFS = [
  { key: 'sin_confirmar',   title: 'Sin confirmar',         tone: 'slate'   },
  { key: 'confirmadas',     title: 'Confirmadas',           tone: 'emerald' },
  { key: 'con_pedido',      title: 'Pedido al proveedor',   tone: 'amber'   },
  { key: 'listas_entregar', title: 'Listas p/ entregar',    tone: 'teal'    },
  { key: 'entregadas',      title: 'Entregadas',            tone: 'blue'    },
  { key: 'canceladas',      title: 'Canceladas',            tone: 'red'     },
];

const HEADER_TONE = {
  slate:   { border:'#94a3b8', bg:'#f1f5f9', fg:'#334155', badge:'#64748b' },
  emerald: { border:'#34d399', bg:'#ecfdf5', fg:'#047857', badge:'#10b981' },
  amber:   { border:'#fbbf24', bg:'#fffbeb', fg:'#b45309', badge:'#f59e0b' },
  teal:    { border:'#2dd4bf', bg:'#f0fdfa', fg:'#0f766e', badge:'#14b8a6' },
  blue:    { border:'#60a5fa', bg:'#eff6ff', fg:'#1d4ed8', badge:'#3b82f6' },
  red:     { border:'#fca5a5', bg:'#fef2f2', fg:'#b91c1c', badge:'#f87171' },
};

const SAMPLE_OPS = {
  sin_confirmar: [
    { id: 'OP-0142', cliente: 'Hugo Rodríguez',          item: 'Mosquitero rebatible',                monto:   95000, estado: 'presupuesto', pago: 'sin_pago',   fecha: '12/06' },
    { id: 'OP-0143', cliente: 'Lorena Castro',           item: 'Ventana balconera PVC',                monto:  420000, estado: 'enviado',     pago: 'sin_pago',   fecha: '15/06' },
    { id: 'OP-0144', cliente: 'Estudio Britos & Asoc.',  item: 'Ventanas balconeras (×3)',             monto: 2150000, estado: 'enviado',     pago: 'sin_pago',   fecha: '20/06' },
  ],
  confirmadas: [
    { id: 'OP-0140', cliente: 'Familia González',        item: 'Ventana corrediza PVC 1.50×1.10',      monto: 1250000, estado: 'aprobado',    pago: 'pagado',     fecha: '08/06' },
    { id: 'OP-0138', cliente: 'Mariela Ojeda',           item: 'Puerta de entrada aluminio',           monto:  480000, estado: 'aprobado',    pago: 'señado',     fecha: '10/06' },
  ],
  con_pedido: [
    { id: 'OP-0135', cliente: 'Constructora del Norte',  item: 'Ventanal fijo 3m × 2.4m',              monto: 3200000, estado: 'en_produccion', pago: 'señado', fecha: '24/06' },
    { id: 'OP-0133', cliente: 'Ramírez S.A.',            item: 'Frente vidriado oficina',              monto: 5400000, estado: 'en_produccion', pago: 'pagado', fecha: '28/06' },
  ],
  listas_entregar: [
    { id: 'OP-0130', cliente: 'Familia Britos',          item: 'Puerta corredera + 2 ventanas',        monto: 1820000, estado: 'listo',       pago: 'pagado',     fecha: '06/06' },
    { id: 'OP-0129', cliente: 'Pablo Sánchez',           item: 'Ventana corrediza balcón',             monto:  680000, estado: 'listo',       pago: 'pagado',     fecha: '07/06' },
    { id: 'OP-0128', cliente: 'Andrea Méndez',           item: 'Mampara de baño 80×190',               monto:  340000, estado: 'listo',       pago: 'pagado',     fecha: '07/06' },
  ],
  entregadas: [
    { id: 'OP-0120', cliente: 'Edificio Las Tipas',      item: 'Ventanas piso 3 (×6)',                 monto: 4900000, estado: 'entregado',   pago: 'pagado',     fecha: '01/06' },
    { id: 'OP-0118', cliente: 'Familia Acuña',           item: 'Puerta principal + lateral',           monto: 1450000, estado: 'entregado',   pago: 'pagado',     fecha: '30/05' },
  ],
  canceladas: [
    { id: 'OP-0117', cliente: 'Daniel Mereles',          item: 'Ventana hojas batientes',              monto:  290000, estado: 'cancelado',   pago: 'sin_pago',   fecha: '28/05' },
  ],
};

function PagoBadge({ pago }) {
  if (pago === 'pagado') return <Pill tone="emerald">Pagado</Pill>;
  if (pago === 'señado') return <Pill tone="amber">Señado</Pill>;
  return <Pill tone="red">Sin pago</Pill>;
}

function EstadoBadge({ estado }) {
  const tone = {
    presupuesto:'gray', enviado:'bluish', aprobado:'emerald',
    en_produccion:'amber', listo:'teal', entregado:'bluish', cancelado:'red',
  }[estado] || 'gray';
  return <Pill tone={tone}>{ESTADO_LABEL[estado] || estado}</Pill>;
}

function OpCard({ op, col, onClick }) {
  const showPago = col === 'sin_confirmar' || col === 'confirmadas';
  const showCta = col === 'confirmadas' || col === 'listas_entregar';
  return (
    <button onClick={onClick} className="card-lift" style={{
      width: '100%', textAlign: 'left',
      background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12,
      padding: 12, marginBottom: 8, cursor: 'pointer', display: 'block',
    }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <span className="mono" style={{ fontSize: 11 }}>{op.id}</span>
        <EstadoBadge estado={op.estado} />
      </div>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1f2937' }} className="truncate">{op.cliente}</p>
      <p style={{ margin: '2px 0 0', fontSize: 10, color: '#9ca3af' }} className="truncate">{op.item}</p>
      {op.fecha && <p style={{ margin: '2px 0 0', fontSize: 10, color: '#9ca3af' }}>Entrega {op.fecha}</p>}
      <div className="flex items-center justify-between" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
        <p className="money" style={{ fontSize: 13 }}>{formatCurrency(op.monto)}</p>
        {showPago && <PagoBadge pago={op.pago} />}
        {col === 'canceladas'  && <Icon name="XCircle"      size={14} color="#f87171" />}
        {col === 'entregadas'  && <Icon name="CheckCircle2" size={14} color="#10b981" />}
      </div>
      {showCta && col === 'confirmadas' && (
        <div style={{
          marginTop: 8, padding: '4px 8px', textAlign: 'center',
          background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309',
          borderRadius: 8, fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}><Icon name="ShoppingCart" size={10} /> Crear pedido →</div>
      )}
      {showCta && col === 'listas_entregar' && (
        <div style={{
          marginTop: 8, padding: '4px 8px', textAlign: 'center',
          background: '#f0fdfa', border: '1px solid #ccfbf1', color: '#0f766e',
          borderRadius: 8, fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}><Icon name="Truck" size={10} /> Crear remito →</div>
      )}
    </button>
  );
}

function KanbanCol({ col, title, tone, ops, onSelect }) {
  const t = HEADER_TONE[tone];
  return (
    <div className="kanban-col">
      <div className="flex items-center justify-between" style={{
        padding: '8px 12px', marginBottom: 8, borderRadius: 10,
        borderLeft: `4px solid ${t.border}`, background: t.bg, color: t.fg,
      }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }} className="truncate">{title}</p>
        <span style={{
          background: t.badge, color: '#fff', borderRadius: 9999,
          minWidth: 20, height: 18, padding: '0 6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800,
        }}>{ops.length}</span>
      </div>
      {ops.length === 0
        ? <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', padding: '20px 0' }}>Sin operaciones</p>
        : ops.map(op => <OpCard key={op.id} op={op} col={col} onClick={() => onSelect && onSelect(op)} />)
      }
    </div>
  );
}

function Operaciones({ onSelectOp }) {
  return (
    <React.Fragment>
      <SectionHero
        section="operaciones"
        icon="Hammer"
        breadcrumb={['Comercial', 'Operaciones']}
        title="Tablero de Operaciones"
        sub="Estado del flujo de trabajo — del presupuesto a la entrega"
        actions={<button className="btn btn-section" type="button"><Icon name="Plus" size={14}/>Nueva operación</button>}
      />

      <div className="app-page-inner" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* MÉTRICAS — slim strip, keeps the kanban as the hero */}
        <CompactStatsBar items={[
          { value: '13',        label: 'activas · ' + formatCurrency(17400000), color: '#60a5fa' },
          { value: '3',         label: 'sin confirmar',            color: '#a78bfa' },
          { value: '3',         label: 'listas p/ entregar',       color: '#2dd4bf' },
          { value: '2',         label: 'entregadas esta semana',   color: '#34d399' },
        ]} />

        {/* Kanban */}
        <Card>
          <CardHeader icon="Zap" iconTone="amber" title="Tablero — flujo completo" sub="6 estados" />
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
            {COL_DEFS.map(c => (
              <KanbanCol
                key={c.key} col={c.key} title={c.title} tone={c.tone}
                ops={SAMPLE_OPS[c.key] || []}
                onSelect={onSelectOp}
              />
            ))}
          </div>
        </Card>
      </div>
    </React.Fragment>
  );
}

window.Operaciones = Operaciones;
window.SAMPLE_OPS = SAMPLE_OPS;
