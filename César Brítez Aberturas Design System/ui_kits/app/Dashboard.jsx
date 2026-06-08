/* Dashboard — landing page.
   New shape:
   - Section hero (gradient navy→red accent) with greeting
   - MetricsBand (dark navy block) for KPIs — walls off metrics
   - Operational cards on white below (priorities, riesgo, top productos)
   - Right column: sugerencias, problemas, actividad */

const PRIORIDADES = [
  { icon: 'Truck',          tone: 'amber',   title: '3 pedidos listos para entregar',     sub: 'Coordiná la entrega hoy',            count: 3 },
  { icon: 'Phone',          tone: 'blue',    title: '5 clientes esperando confirmación',  sub: 'Presupuestos enviados sin respuesta', count: 5 },
  { icon: 'MessageCircle',  tone: 'teal',    title: '8 presupuestos para dar seguimiento', sub: 'Sin confirmar aún',                  count: 8 },
  { icon: 'CalendarClock',  tone: 'violet',  title: '2 compromisos de pago próximos',     sub: 'Vencen en los próximos 2 días',      count: 2 },
  { icon: 'AlertTriangle',  tone: 'red',     title: '1 pedido atrasado',                  sub: 'Superaron la fecha estimada',         count: 1 },
];

const VENTAS_RIESGO = [
  { id: 'PR-0042', cliente: 'Familia González',          item: 'Ventana corrediza PVC 1.50×1.10', monto: 1250000, dias: 3 },
  { id: 'PR-0039', cliente: 'Mariela Ojeda',             item: 'Puerta de entrada aluminio',      monto:  480000, dias: 6 },
  { id: 'PR-0036', cliente: 'Estudio Britos & Asoc.',    item: 'Ventanas balconeras (×3)',         monto: 2150000, dias: 9 },
  { id: 'PR-0033', cliente: 'Hugo Rodríguez',            item: 'Mosquitero rebatible',             monto:   95000, dias:11 },
];

const TOP_PRODS = [
  { n: 1, desc: 'Ventana corrediza PVC blanco',  unidades: 24, monto: 4250000, tone: 'blue'   },
  { n: 2, desc: 'Puerta entrada aluminio negro', unidades: 18, monto: 3120000, tone: 'teal'   },
  { n: 3, desc: 'Balconera PVC símil madera',    unidades: 12, monto: 2180000, tone: 'violet' },
  { n: 4, desc: 'Mosquitero rebatible',          unidades: 31, monto:  640000, tone: 'amber'  },
];

function Dashboard({ user, onNavigate }) {
  const now = new Date();
  const h = now.getHours();
  const saludo = h < 12 ? '¡Buenos días' : h < 19 ? '¡Buenas tardes' : '¡Buenas noches';
  const fechaHoy = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthPct = Math.round((dayOfMonth / daysInMonth) * 100);

  return (
    <React.Fragment>
      <SectionHero
        section="dashboard"
        icon="LayoutDashboard"
        breadcrumb={['Inicio', 'Dashboard']}
        title={`${saludo}, ${user?.nombre ?? 'usuario'}`}
        sub={`${fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1)} · Acá tenés todo lo importante de tu negocio`}
        actions={
          <React.Fragment>
            <div className="card card-tight flex items-center gap-2" style={{ padding: '8px 14px', fontSize: 13, color: '#4b5563' }}>
              <Icon name="CalendarClock" size={13} color="#9ca3af" />
              Hoy, {now.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
            </div>
            <Button variant="gradient" icon="Plus" onClick={() => onNavigate('presupuestos')}>
              Nuevo presupuesto
            </Button>
          </React.Fragment>
        }
      />

      <div className="app-page-inner">

        {/* METRICS BAND — dark navy block walls off KPIs from the lighter operational area */}
        <MetricsBand title="Métricas del negocio" sub={`día ${dayOfMonth} / ${daysInMonth}`}>
          <MetricTile label="Ventas del día"        value="$ 425.000"   sub="Promedio: $ 281.000/día"           icon="DollarSign" progress={42} progressColor="#60a5fa" />
          <MetricTile label="Ventas del mes"        value="$ 8.450.000" sub={`24 operaciones · ${monthPct}% del mes`} icon="TrendingUp" progress={monthPct} progressColor="#34d399" />
          <MetricTile label="Presupuestos activos"  value="17"          sub="Sin confirmar aún"                 icon="FileText" progress={68} progressColor="#a78bfa" />
          <MetricTile label="% de cierre"           value="38%"         sub="9 cerrados de 24"                  icon="Target" progress={38} progressColor="#34d399" />
        </MetricsBand>

        <div style={{ marginTop: 20, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* PRIORIDADES */}
            <Card>
              <CardHeader
                icon="Target" iconTone="red"
                title="Prioridades de hoy"
                sub="Tu foco para hoy"
                action={<a className="btn-text" href="#" style={{ fontSize: 12 }}>Ver agenda completa <Icon name="ChevronRight" size={12}/></a>}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {PRIORIDADES.map(p => (
                  <button key={p.title} className="card-lift"
                    onClick={() => onNavigate('operaciones')}
                    style={{
                      display: 'flex', gap: 10, padding: 14, alignItems: 'flex-start',
                      background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 12,
                      textAlign: 'left', cursor: 'pointer',
                    }}>
                    <IconTile name={p.icon} tone={p.tone} size="lg" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1f2937', lineHeight: 1.35 }}>{p.title}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280', lineHeight: 1.25 }}>{p.sub}</p>
                    </div>
                    {p.count > 0 && <span className="chip-count">{p.count}</span>}
                  </button>
                ))}
              </div>
            </Card>

            {/* RIESGO + SEGUIMIENTO */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
              <Card>
                <CardHeader
                  icon="AlertTriangle" iconTone="amber"
                  title="Ventas en riesgo"
                  action={<a className="btn-text" href="#" style={{ fontSize: 12 }}>Ver todos <Icon name="ChevronRight" size={12}/></a>}
                />
                <p style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', margin: '0 0 8px' }}>
                  Presupuestos enviados sin respuesta
                </p>
                <div>
                  {VENTAS_RIESGO.map(op => (
                    <button key={op.id}
                      onClick={() => onNavigate('presupuestos')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                        padding: '10px 12px', borderRadius: 12, textAlign: 'left',
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1f2937' }} className="truncate">{op.cliente}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }} className="truncate">{op.item}</p>
                      </div>
                      <p className="money" style={{ fontSize: 14 }}>{formatCurrency(op.monto)}</p>
                      <Pill tone={op.dias > 7 ? 'red' : op.dias > 3 ? 'amber' : 'gray'}>
                        Hace {op.dias} días
                      </Pill>
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader
                  icon="MessageCircle" iconTone="violet"
                  title="Seguimiento"
                  action={<a className="btn-text" href="#" style={{ fontSize: 12 }}>Ver todos <Icon name="ChevronRight" size={12}/></a>}
                />
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 8px' }}>A quién contactar hoy</p>
                {[
                  { nombre: 'Carlos Britos',       pref: 'whatsapp', dias: 14 },
                  { nombre: 'Familia Rodríguez',   pref: 'email',    dias: 21 },
                  { nombre: 'Lorena Castro',       pref: 'whatsapp', dias: 8 },
                  { nombre: 'Constructora Norte',  pref: 'email',    dias: 32 },
                ].map(c => (
                  <div key={c.nombre} className="flex items-center gap-2" style={{ padding: '6px 0' }}>
                    <IconTile
                      name={c.pref === 'email' ? 'Mail' : 'MessageCircle'}
                      tone={c.pref === 'email' ? 'blue' : 'emerald'}
                      size="sm"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1f2937' }} className="truncate">{c.nombre}</p>
                      <p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>Hace {c.dias} días</p>
                    </div>
                    {c.pref === 'whatsapp'
                      ? <button className="btn btn-sm" style={{ background: '#22c55e', color: '#fff', padding: '4px 10px', fontWeight: 700 }}>Contactar</button>
                      : <button className="btn btn-sm" style={{ background: '#ede9fe', color: '#6d28d9', padding: '4px 10px', fontWeight: 700 }}>Ver</button>}
                  </div>
                ))}
              </Card>
            </div>

            {/* TOP PRODUCTOS */}
            <Card>
              <CardHeader
                icon="ShoppingBag" iconTone="amber"
                title="Productos más vendidos"
                sub="Este mes"
                action={<a className="btn-text" href="#" style={{ fontSize: 12 }}>Ver reporte completo <Icon name="ChevronRight" size={12}/></a>}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {TOP_PRODS.map(p => {
                  const palettes = {
                    blue:   { num: '#2563eb', bar: '#eff6ff', border: '#dbeafe', price: '#1d4ed8' },
                    teal:   { num: '#0d9488', bar: '#f0fdfa', border: '#ccfbf1', price: '#0f766e' },
                    violet: { num: '#7c3aed', bar: '#f5f3ff', border: '#ede9fe', price: '#6d28d9' },
                    amber:  { num: '#f59e0b', bar: '#fffbeb', border: '#fef3c7', price: '#b45309' },
                  };
                  const pal = palettes[p.tone];
                  return (
                    <div key={p.n} style={{
                      background: pal.bar, border: `1px solid ${pal.border}`, borderRadius: 12,
                      padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <div className="flex items-center gap-2">
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: pal.num,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 900, fontSize: 14 }}>{p.n}</div>
                        <div style={{
                          flex: 1, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon name="Package" size={22} color="#d1d5db" />
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1f2937', lineHeight: 1.3 }}>{p.desc}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{p.unidades} unidades</p>
                      <p className="money" style={{ fontSize: 14, color: pal.price }}>{formatCurrency(p.monto)}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <CardHeader icon="Lightbulb" iconTone="amber" title="Sugerencias del sistema" />
              {[
                { ic: 'Users',       tone: 'blue',    txt: 'Hoy podés hacer seguimiento a 4 clientes clave que mostraron interés.' },
                { ic: 'DollarSign',  tone: 'emerald', txt: 'Tenés $ 4.215.000 en presupuestos sin cerrar.' },
                { ic: 'ShoppingBag', tone: 'amber',   txt: 'Las ventanas PVC se están vendiendo más esta semana.' },
              ].map((s, i) => (
                <button key={i} style={{
                  display: 'flex', gap: 10, width: '100%', padding: '10px 12px',
                  borderRadius: 12, textAlign: 'left', transition: 'background 150ms', alignItems: 'flex-start',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <IconTile name={s.ic} tone={s.tone} size="sm" />
                  <p style={{ flex: 1, fontSize: 12, color: '#4b5563', margin: 0, lineHeight: 1.4 }}>{s.txt}</p>
                  <Icon name="ChevronRight" size={14} color="#d1d5db" />
                </button>
              ))}
              <a href="#" style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 8,
                padding: '8px 12px', background: '#10b981', color: '#fff', borderRadius: 12,
                fontSize: 12, fontWeight: 700,
              }}>Ver oportunidades de venta</a>
            </Card>

            <Card>
              <CardHeader icon="AlertTriangle" iconTone="amber" title="Problemas operativos"
                action={<a className="btn-text" href="#" style={{ fontSize: 11 }}>Ver todos <Icon name="ChevronRight" size={11}/></a>} />
              {[
                { ic: 'Package', tone: 'red',    label: 'Stock crítico',       sub: '3 productos',  count: 3, badge: '#ef4444' },
                { ic: 'Truck',   tone: 'amber',  label: 'Pedidos demorados',   sub: '1 pedido',     count: 1, badge: '#f59e0b' },
                { ic: 'Clock',   tone: 'orange', label: 'Entregas pendientes', sub: '5 entregas',   count: 5, badge: '#fb923c' },
              ].map(r => (
                <a key={r.label} href="#" className="flex items-center gap-3" style={{
                  padding: '10px 8px', borderRadius: 12, transition: 'background 150ms',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <IconTile name={r.ic} tone={r.tone} size="lg" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1f2937' }}>{r.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{r.sub}</p>
                  </div>
                  <span style={{
                    background: r.badge, color: '#fff', fontSize: 11, fontWeight: 800,
                    minWidth: 24, height: 20, padding: '0 6px', borderRadius: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{r.count}</span>
                </a>
              ))}
            </Card>

            <Card>
              <CardHeader icon="Activity" iconTone="blue" title="Actividad reciente" />
              {[
                { ic:'CheckCircle2', tone:'emerald', label: 'Familia González · Aprobado',     monto: 1250000, when: 'Hace 12 min' },
                { ic:'FileText',     tone:'gray',    label: 'Hugo Rodríguez · Nuevo borrador', monto:   95000, when: 'Hace 2 h'   },
                { ic:'Truck',        tone:'green',   label: 'Constructora Norte · Entregado',  monto: 3200000, when: 'Hace 5 h'   },
                { ic:'FileText',     tone:'amber',   label: 'Lorena Castro · Enviado',         monto:  420000, when: 'Hace 1 d'   },
              ].map((a, i) => (
                <button key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%',
                  padding: '8px 8px', borderRadius: 12, textAlign: 'left', transition: 'background 150ms',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <IconTile name={a.ic} tone={a.tone} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1f2937' }} className="truncate">{a.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }} className="truncate">{formatCurrency(a.monto)}</p>
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' }}>{a.when}</p>
                </button>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

window.Dashboard = Dashboard;
