/* Remitos — notas de entrega + columna lateral */

const REMITOS_DATA = [
  { id:'REM-042', op:'OP-0140', cliente:'Familia González',       item:'Ventana corrediza PVC 1.50×1.10', fecha:'06/06', estado:'pendiente',  chofer:'Juan P.',    monto:1250000 },
  { id:'REM-041', op:'OP-0130', cliente:'Familia Britos',         item:'Puerta corredera + 2 ventanas',   fecha:'06/06', estado:'pendiente',  chofer:'Juan P.',    monto:1820000 },
  { id:'REM-040', op:'OP-0129', cliente:'Pablo Sánchez',          item:'Ventana corrediza balcón',        fecha:'07/06', estado:'programado', chofer:'Mario G.',   monto: 680000 },
  { id:'REM-039', op:'OP-0128', cliente:'Andrea Méndez',          item:'Mampara de baño 80×190',          fecha:'07/06', estado:'programado', chofer:'Mario G.',   monto: 340000 },
  { id:'REM-038', op:'OP-0120', cliente:'Edificio Las Tipas',     item:'Ventanas piso 3 (×6)',            fecha:'01/06', estado:'entregado',  chofer:'Juan P.',    monto:4900000 },
  { id:'REM-037', op:'OP-0118', cliente:'Familia Acuña',          item:'Puerta principal + lateral',      fecha:'30/05', estado:'entregado',  chofer:'Rubén H.',   monto:1450000 },
  { id:'REM-036', op:'OP-0115', cliente:'Constructora del Norte', item:'Ventanal fijo — avance',         fecha:'25/05', estado:'entregado',  chofer:'Rubén H.',   monto:1600000 },
];

const ESTADO_REM = { pendiente:{tone:'amber',label:'Pendiente'}, programado:{tone:'blue',label:'Programado'}, entregado:{tone:'emerald',label:'Entregado'} };

function Remitos() {
  const [query, setQuery] = React.useState('');
  const filtered = REMITOS_DATA.filter(r=>query===''||r.cliente.toLowerCase().includes(query.toLowerCase())||r.id.includes(query.toUpperCase()));
  const hoy = REMITOS_DATA.filter(r=>r.estado!=='entregado').length;

  return (
    <React.Fragment>
      <SectionHero section="remitos" icon="Truck"
        breadcrumb={['Comercial','Remitos']} title="Remitos"
        sub="Notas de entrega e historial de despacho"
        actions={<button className="btn btn-section"><Icon name="Plus" size={14}/>Nuevo remito</button>}
      />
      <div className="app-page-inner" style={{display:'flex',flexDirection:'column',gap:14}}>
        <CompactStatsBar items={[
          {value:String(REMITOS_DATA.filter(r=>r.estado==='pendiente').length), label:'pendientes hoy',  color:'#fbbf24'},
          {value:String(REMITOS_DATA.filter(r=>r.estado==='programado').length),label:'programados',     color:'#60a5fa'},
          {value:String(REMITOS_DATA.filter(r=>r.estado==='entregado').length), label:'entregados (mes)',color:'#34d399'},
          {value:formatCurrency(REMITOS_DATA.filter(r=>r.estado!=='entregado').reduce((s,r)=>s+r.monto,0)), label:'en tránsito', color:'#2dd4bf'},
        ]}/>

        <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:12}}>
            <Card tight>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af',display:'flex'}}><Icon name="Search" size={14}/></span>
                <input className="input" placeholder="Buscar remito o cliente…" value={query} onChange={e=>setQuery(e.target.value)} style={{paddingLeft:32}}/>
              </div>
            </Card>
            <Card style={{padding:0,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                    {['Remito','Op.','Cliente','Material','Fecha','Chofer','Monto','Estado',''].map((h,i)=>(
                      <th key={i} style={{padding:'10px 14px',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.06em',textAlign:'left'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r=>{
                    const es = ESTADO_REM[r.estado]||{tone:'gray',label:r.estado};
                    return (
                      <tr key={r.id} style={{borderBottom:'1px solid #f3f4f6',cursor:'pointer',transition:'background 150ms',
                        borderLeft:r.estado==='pendiente'?'4px solid #fbbf24':r.estado==='programado'?'4px solid #60a5fa':'4px solid #34d399'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                        onMouseLeave={e=>e.currentTarget.style.background='#fff'}
                      >
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}><span className="mono">{r.id}</span></td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}><span className="mono" style={{fontSize:11,color:'#9ca3af'}}>{r.op}</span></td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',fontWeight:600,color:'#1f2937'}}>{r.cliente}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#6b7280',fontSize:12,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.item}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#6b7280',fontSize:12}}>{r.fecha}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#6b7280',fontSize:12}}>{r.chofer}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}><span className="money" style={{fontSize:13}}>{formatCurrency(r.monto)}</span></td>
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
              <CardHeader icon="Zap" iconTone="teal" title="Acciones rápidas"/>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {[
                  {icon:'Plus',          label:'Nuevo remito',          bg:'#0f766e',fg:'#fff'},
                  {icon:'Pencil',        label:'Registrar entrega',      bg:'#ccfbf1',fg:'#0f766e'},
                  {icon:'Filter',        label:'Imprimir hojas de ruta', bg:'#dbeafe',fg:'#1d4ed8'},
                  {icon:'Activity',      label:'Ver historial',          bg:'#f3f4f6',fg:'#4b5563'},
                ].map(a=>(
                  <button key={a.label} className="qa-btn" style={{background:a.bg,color:a.fg}}>
                    <Icon name={a.icon} size={13}/>{a.label}
                  </button>
                ))}
              </div>
            </Card>
            <Card tight>
              <CardHeader icon="Truck" iconTone="teal" title="Entregas de hoy"/>
              {REMITOS_DATA.filter(r=>r.estado!=='entregado').map(r=>(
                <div key={r.id} className="flex items-center gap-2" style={{padding:'7px 0',borderBottom:'1px solid #f3f4f6'}}>
                  <IconTile name="Truck" tone={r.estado==='pendiente'?'amber':'blue'} size="sm"/>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:12,fontWeight:600,color:'#1f2937'}} className="truncate">{r.cliente}</p>
                    <p style={{margin:0,fontSize:10,color:'#9ca3af'}}>{r.chofer} · {r.fecha}</p>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}
window.Remitos = Remitos;
