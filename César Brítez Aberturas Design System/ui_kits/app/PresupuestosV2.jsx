/* Presupuestos — métricas compactas + tabla PRINCIPAL + columna lateral */

const PRESUPUESTOS = [
  { id:'PR-0042', cliente:'Familia González',       item:'Ventana corrediza PVC 1.50×1.10', monto:1250000, estado:'aprobado',      pago:'pagado',   fecha:'04/06', online:true,  validez:'22/06' },
  { id:'PR-0041', cliente:'Mariela Ojeda',          item:'Puerta de entrada aluminio',      monto: 480000, estado:'aprobado',      pago:'señado',   fecha:'03/06', online:true,  validez:'21/06' },
  { id:'PR-0040', cliente:'Hugo Rodríguez',         item:'Mosquitero rebatible',            monto:  95000, estado:'enviado',       pago:'sin_pago', fecha:'02/06', online:false, validez:'20/06' },
  { id:'PR-0039', cliente:'Lorena Castro',          item:'Ventana balconera PVC',           monto: 420000, estado:'enviado',       pago:'sin_pago', fecha:'01/06', online:false, validez:'19/06' },
  { id:'PR-0038', cliente:'Estudio Britos & Asoc.', item:'Ventanas balconeras (×3)',        monto:2150000, estado:'enviado',       pago:'sin_pago', fecha:'31/05', online:false, validez:'18/06' },
  { id:'PR-0037', cliente:'Constructora del Norte', item:'Ventanal fijo 3m × 2.4m',        monto:3200000, estado:'en_produccion', pago:'señado',   fecha:'28/05', online:false, validez:'15/06' },
  { id:'PR-0036', cliente:'Daniel Mereles',         item:'Ventana hojas batientes',         monto: 290000, estado:'cancelado',     pago:'sin_pago', fecha:'27/05', online:false, validez:'14/06' },
  { id:'PR-0035', cliente:'Familia Britos',         item:'Puerta corredera + 2 ventanas',   monto:1820000, estado:'listo',         pago:'pagado',   fecha:'26/05', online:false, validez:'13/06' },
];

const SEGUIMIENTO_P = [
  { nombre:'Lorena Castro',     dias:3, monto: 420000, motivo:'PR-0039 sin respuesta', pref:'whatsapp' },
  { nombre:'Hugo Rodríguez',    dias:4, monto:  95000, motivo:'PR-0040 sin respuesta', pref:'whatsapp' },
  { nombre:'Estudio Britos',    dias:6, monto:2150000, motivo:'Vence en 12 días',      pref:'email'    },
  { nombre:'Carlos Méndez',     dias:9, monto: 340000, motivo:'No cotizó aún',         pref:'phone'    },
];

function PresBadge({ estado }) {
  const m = { presupuesto:'gray', enviado:'bluish', aprobado:'emerald', en_produccion:'amber', listo:'teal', entregado:'bluish', cancelado:'red' };
  const labels = { presupuesto:'Borrador', enviado:'Enviado', aprobado:'Aprobado', en_produccion:'En producción', listo:'Listo', entregado:'Entregado', cancelado:'Cancelado' };
  return <Pill tone={m[estado]||'gray'}>{labels[estado]||estado}</Pill>;
}
function PagoBadge({ pago }) {
  if (pago==='pagado') return <Pill tone="emerald">Pagado</Pill>;
  if (pago==='señado') return <Pill tone="amber">Señado</Pill>;
  return <Pill tone="red">Sin pago</Pill>;
}

function Presupuestos({ onOpen }) {
  const [filter, setFilter] = React.useState('todos');
  const [query,  setQuery]  = React.useState('');

  const filtered = PRESUPUESTOS.filter(p =>
    (filter==='todos' || p.estado===filter) &&
    (query==='' || p.cliente.toLowerCase().includes(query.toLowerCase()) || p.id.includes(query.toUpperCase()))
  );

  const enviados   = PRESUPUESTOS.filter(p=>p.estado==='enviado').length;
  const aprobados  = PRESUPUESTOS.filter(p=>p.estado==='aprobado').length;
  const enTraMonto = PRESUPUESTOS.filter(p=>p.estado==='enviado').reduce((s,p)=>s+p.monto,0);
  const conv       = Math.round((aprobados/PRESUPUESTOS.length)*100);

  const FILTROS = [
    {k:'todos',l:'Todos'},{k:'enviado',l:'Enviados'},{k:'aprobado',l:'Aprobados'},
    {k:'en_produccion',l:'En producción'},{k:'listo',l:'Listos'},{k:'cancelado',l:'Cancelados'},
  ];

  return (
    <React.Fragment>
      <SectionHero section="presupuestos" icon="FileText"
        breadcrumb={['Comercial','Presupuestos']} title="Presupuestos"
        sub="Cotizaciones activas y su estado de cobranza"
        actions={<button className="btn btn-section"><Icon name="Plus" size={14}/>Nuevo presupuesto</button>}
      />
      <div className="app-page-inner" style={{display:'flex',flexDirection:'column',gap:14}}>

        <CompactStatsBar items={[
          {value:String(enviados),          label:'enviados · pendientes',  color:'#a78bfa'},
          {value:String(aprobados),         label:'aprobados este mes',     color:'#34d399'},
          {value:formatCurrency(enTraMonto),label:'en trámite',             color:'#60a5fa'},
          {value:conv+'%',                  label:'tasa de conversión',     color:'#fbbf24'},
        ]}/>

        <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>

          {/* ── MAIN: buscador + tabla ── */}
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:12}}>
            {/* Filter bar */}
            <Card tight>
              <div className="flex items-center gap-3" style={{flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:180,position:'relative'}}>
                  <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af',display:'flex'}}><Icon name="Search" size={14}/></span>
                  <input className="input" placeholder="Buscar cliente o número…" value={query} onChange={e=>setQuery(e.target.value)} style={{paddingLeft:32}}/>
                </div>
                {FILTROS.map(f=>(
                  <button key={f.k} onClick={()=>setFilter(f.k)} style={{
                    padding:'6px 12px',borderRadius:9999,fontSize:12,fontWeight:600,
                    border:'1px solid '+(filter===f.k?'#6d28d9':'#e5e7eb'),
                    background:filter===f.k?'#6d28d9':'#fff',
                    color:filter===f.k?'#fff':'#4b5563',transition:'all 150ms',
                  }}>{f.l}</button>
                ))}
              </div>
            </Card>

            {/* Table */}
            <Card style={{padding:0,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                    {['Número','Cliente','Ítem','Monto','Estado','Pago','Fecha',''].map((h,i)=>(
                      <th key={i} style={{textAlign:i===3?'right':'left',padding:'10px 14px',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p=>(
                    <tr key={p.id} style={{borderBottom:'1px solid #f3f4f6',cursor:'pointer',
                      background:p.online?'rgba(209,250,229,0.30)':'#fff',
                      borderLeft:p.online?'4px solid #34d399':'4px solid transparent',transition:'background 150ms'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                      onMouseLeave={e=>e.currentTarget.style.background=p.online?'rgba(209,250,229,0.30)':'#fff'}
                    >
                      <td style={{padding:'11px 14px',verticalAlign:'middle'}}><span className="mono">{p.id}</span></td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle'}}>
                        <p style={{margin:0,fontWeight:600,color:'#1f2937'}}>{p.cliente}</p>
                        {p.online&&<p style={{margin:0,fontSize:10,color:'#047857',fontWeight:700}}>✓ Aprobado online</p>}
                      </td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#6b7280',fontSize:12,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.item}</td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle',textAlign:'right'}}><span className="money">{formatCurrency(p.monto)}</span></td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle'}}><PresBadge estado={p.estado}/></td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle'}}><PagoBadge pago={p.pago}/></td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#9ca3af',fontSize:12}}>{p.fecha}</td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle'}}><Icon name="ChevronRight" size={14} color="#9ca3af"/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length===0&&(
                <div style={{padding:40,textAlign:'center',color:'#9ca3af'}}>
                  <Icon name="FileText" size={32} color="#d1d5db"/>
                  <p style={{marginTop:8,fontSize:12}}>Sin presupuestos con esos filtros.</p>
                </div>
              )}
            </Card>
          </div>

          {/* ── RIGHT COL: acciones secundarias ── */}
          <div style={{width:280,flexShrink:0,display:"flex",flexDirection:"column",gap:12}}>
            <Card tight>
              <CardHeader icon="Zap" iconTone="violet" title="Acciones rápidas"/>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {[
                  {icon:'Plus',          label:'Nuevo presupuesto',       bg:'#6d28d9',fg:'#fff'},
                  {icon:'AlertTriangle', label:'Ver vencidos',             bg:'#fef3c7',fg:'#b45309'},
                  {icon:'Share2',        label:'Compartir por WhatsApp',   bg:'#d1fae5',fg:'#047857'},
                  {icon:'Filter',        label:'Exportar listado',         bg:'#dbeafe',fg:'#1d4ed8'},
                ].map(a=>(
                  <button key={a.label} className="qa-btn" style={{background:a.bg,color:a.fg}}>
                    <Icon name={a.icon} size={13}/>{a.label}
                  </button>
                ))}
              </div>
            </Card>

            <Card tight>
              <CardHeader icon="Phone" iconTone="blue" title="Seguimiento sugerido hoy"/>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {SEGUIMIENTO_P.map((c,i)=>(
                  <div key={i} style={{
                    padding:'8px 10px',borderRadius:10,
                    borderLeft:`3px solid ${c.dias>7?'#ef4444':c.dias>4?'#f59e0b':'#10b981'}`,
                    background:c.dias>7?'#fef2f2':c.dias>4?'#fffbeb':'#f0fdf4',
                  }}>
                    <div className="flex items-center gap-2" style={{marginBottom:4}}>
                      <IconTile name={c.pref==='email'?'Mail':c.pref==='phone'?'Phone':'MessageCircle'} tone={c.pref==='email'?'blue':c.pref==='phone'?'violet':'emerald'} size="sm"/>
                      <p style={{margin:0,fontSize:12,fontWeight:700,color:'#1f2937',flex:1}} className="truncate">{c.nombre}</p>
                      <span style={{fontSize:10,fontWeight:700,color:c.dias>7?'#b91c1c':'#6b7280'}}>Hace {c.dias}d</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p style={{margin:0,fontSize:11,color:'#6b7280'}} className="truncate">{c.motivo}</p>
                      <button style={{padding:'4px 8px',borderRadius:7,fontSize:10,fontWeight:700,background:c.pref==='whatsapp'?'#22c55e':c.pref==='email'?'#6d28d9':'#3b82f6',color:'#fff',marginLeft:6,flexShrink:0}}>
                        Contactar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

        </div>
      </div>
    </React.Fragment>
  );
}

window.Presupuestos = Presupuestos;
