/* Pedidos — órdenes a proveedores + columna lateral */

const PEDIDOS_DATA = [
  { id:'PED-028', op:'OP-0140', proveedor:'Aluminios del Norte',   item:'Ventana corrediza PVC 1.50×1.10', monto: 625000, estado:'recibido',    fecha:'28/05', estimado:'04/06' },
  { id:'PED-027', op:'OP-0138', proveedor:'Perfisa S.A.',          item:'Puerta aluminio negro',           monto: 190000, estado:'en_transito', fecha:'01/06', estimado:'08/06' },
  { id:'PED-026', op:'OP-0135', proveedor:'Aluminios del Norte',   item:'Ventanal fijo 3m × 2.4m',        monto:1280000, estado:'fabricando',   fecha:'03/06', estimado:'20/06' },
  { id:'PED-025', op:'OP-0133', proveedor:'Vidrios Formosa',       item:'Frente vidriado oficina',         monto:2160000, estado:'fabricando',   fecha:'28/05', estimado:'25/06' },
  { id:'PED-024', op:'OP-0130', proveedor:'Perfisa S.A.',          item:'Puerta corredera + 2 ventanas',  monto: 728000, estado:'recibido',     fecha:'26/05', estimado:'05/06' },
  { id:'PED-023', op:'OP-0129', proveedor:'Mosquiteros & Co.',     item:'Ventana balcón c/mosquitero',    monto: 272000, estado:'atrasado',     fecha:'20/05', estimado:'03/06' },
  { id:'PED-022', op:'OP-0128', proveedor:'Vidrios Formosa',       item:'Mampara vidrio templado',        monto: 136000, estado:'recibido',     fecha:'28/05', estimado:'06/06' },
];

const ESTADO_PED = { recibido:{tone:'emerald',label:'Recibido'}, en_transito:{tone:'blue',label:'En tránsito'}, fabricando:{tone:'amber',label:'Fabricando'}, atrasado:{tone:'red',label:'Atrasado'} };

function Pedidos() {
  const [query, setQuery] = React.useState('');
  const filtered = PEDIDOS_DATA.filter(p=>query===''||p.proveedor.toLowerCase().includes(query.toLowerCase())||p.id.includes(query.toUpperCase()));

  return (
    <React.Fragment>
      <SectionHero section="pedidos" icon="ShoppingCart"
        breadcrumb={['Comercial','Pedidos']} title="Pedidos"
        sub="Órdenes de compra a proveedores y su estado de fabricación"
        actions={<button className="btn btn-section"><Icon name="Plus" size={14}/>Nuevo pedido</button>}
      />
      <div className="app-page-inner" style={{display:'flex',flexDirection:'column',gap:14}}>
        <CompactStatsBar items={[
          {value:String(PEDIDOS_DATA.filter(p=>p.estado==='fabricando').length),   label:'en fabricación',   color:'#fbbf24'},
          {value:String(PEDIDOS_DATA.filter(p=>p.estado==='en_transito').length),  label:'en tránsito',      color:'#60a5fa'},
          {value:String(PEDIDOS_DATA.filter(p=>p.estado==='atrasado').length),     label:'atrasados ⚠',     color:'#fb7185'},
          {value:formatCurrency(PEDIDOS_DATA.filter(p=>p.estado!=='recibido').reduce((s,p)=>s+p.monto,0)), label:'comprometido', color:'#a3e635'},
        ]}/>

        <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:12}}>
            <Card tight>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af',display:'flex'}}><Icon name="Search" size={14}/></span>
                <input className="input" placeholder="Buscar pedido o proveedor…" value={query} onChange={e=>setQuery(e.target.value)} style={{paddingLeft:32}}/>
              </div>
            </Card>
            <Card style={{padding:0,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                    {['Pedido','Op.','Proveedor','Material','Monto','Pedido','Estimado','Estado',''].map((h,i)=>(
                      <th key={i} style={{padding:'10px 14px',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.06em',textAlign:'left'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p=>{
                    const es = ESTADO_PED[p.estado]||{tone:'gray',label:p.estado};
                    return (
                      <tr key={p.id} style={{borderBottom:'1px solid #f3f4f6',cursor:'pointer',transition:'background 150ms',
                        borderLeft:p.estado==='atrasado'?'4px solid #ef4444':p.estado==='fabricando'?'4px solid #fbbf24':'4px solid #34d399'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                        onMouseLeave={e=>e.currentTarget.style.background='#fff'}
                      >
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}><span className="mono">{p.id}</span></td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}><span className="mono" style={{fontSize:11,color:'#9ca3af'}}>{p.op}</span></td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',fontWeight:600,color:'#1f2937'}}>{p.proveedor}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#6b7280',fontSize:12,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.item}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}><span className="money" style={{fontSize:13}}>{formatCurrency(p.monto)}</span></td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#9ca3af',fontSize:12}}>{p.fecha}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#4b5563',fontSize:12}}>{p.estimado}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}><Pill tone={es.tone}>{es.label}</Pill></td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}><Icon name="ChevronRight" size={14} color="#9ca3af"/></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>

          <div style={{width:280,flexShrink:0,display:"flex",flexDirection:"column",gap:12}}>
            <Card tight>
              <CardHeader icon="Zap" iconTone="lime" title="Acciones rápidas"/>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {[
                  {icon:'Plus',          label:'Nuevo pedido',           bg:'#4d7c0f',fg:'#fff'},
                  {icon:'CheckCircle2',  label:'Marcar recibido',        bg:'#ecfccb',fg:'#4d7c0f'},
                  {icon:'Phone',         label:'Contactar proveedor',    bg:'#dbeafe',fg:'#1d4ed8'},
                  {icon:'Filter',        label:'Exportar pedidos',       bg:'#f3f4f6',fg:'#4b5563'},
                ].map(a=>(
                  <button key={a.label} className="qa-btn" style={{background:a.bg,color:a.fg}}>
                    <Icon name={a.icon} size={13}/>{a.label}
                  </button>
                ))}
              </div>
            </Card>
            <Card tight>
              <CardHeader icon="AlertTriangle" iconTone="amber" title="Alertas de demora"/>
              {PEDIDOS_DATA.filter(p=>p.estado==='atrasado'||p.estado==='fabricando').map(p=>(
                <div key={p.id} style={{padding:'8px 0',borderBottom:'1px solid #f3f4f6'}}>
                  <div className="flex items-center justify-between">
                    <p style={{margin:0,fontSize:12,fontWeight:600,color:'#1f2937'}} className="truncate">{p.proveedor}</p>
                    <Pill tone={p.estado==='atrasado'?'red':'amber'} style={{fontSize:9,flexShrink:0,marginLeft:6}}>{p.estado==='atrasado'?'Atrasado':'Fabricando'}</Pill>
                  </div>
                  <p style={{margin:'2px 0 0',fontSize:10,color:'#9ca3af'}}>Est. {p.estimado} · {p.op}</p>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}
window.Pedidos = Pedidos;
