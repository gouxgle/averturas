/* Clientes — lista principal + columna lateral */

const CLIENTES_DATA = [
  { id:'CLI-001', nombre:'Familia González',        tel:'3704-123456', localidad:'Formosa Capital', ultimaOp:'OP-0140', monto:1250000, saldo:0,       contacto:'04/06', activo:true  },
  { id:'CLI-002', nombre:'Mariela Ojeda',           tel:'3704-234567', localidad:'Formosa Capital', ultimaOp:'OP-0138', monto: 480000, saldo:240000,  contacto:'03/06', activo:true  },
  { id:'CLI-003', nombre:'Constructora del Norte',  tel:'3704-345678', localidad:'Clorinda',        ultimaOp:'OP-0135', monto:3200000, saldo:1600000, contacto:'28/05', activo:true  },
  { id:'CLI-004', nombre:'Hugo Rodríguez',          tel:'3704-456789', localidad:'Formosa Capital', ultimaOp:'PR-0040', monto:  95000, saldo: 95000,  contacto:'02/06', activo:true  },
  { id:'CLI-005', nombre:'Lorena Castro',           tel:'3704-567890', localidad:'Formosa Capital', ultimaOp:'PR-0039', monto: 420000, saldo:420000,  contacto:'01/06', activo:true  },
  { id:'CLI-006', nombre:'Estudio Britos & Asoc.',  tel:'3704-678901', localidad:'Formosa Capital', ultimaOp:'PR-0038', monto:2150000, saldo:2150000, contacto:'31/05', activo:true  },
  { id:'CLI-007', nombre:'Ramírez S.A.',            tel:'3704-789012', localidad:'Ingeniero Juárez',ultimaOp:'OP-0133', monto:5400000, saldo:0,       contacto:'15/05', activo:false },
  { id:'CLI-008', nombre:'Familia Acuña',           tel:'3704-890123', localidad:'Formosa Capital', ultimaOp:'OP-0118', monto:1450000, saldo:0,       contacto:'30/05', activo:true  },
  { id:'CLI-009', nombre:'Daniel Mereles',          tel:'3704-901234', localidad:'El Colorado',     ultimaOp:'PR-0036', monto: 290000, saldo: 290000, contacto:'27/05', activo:false },
  { id:'CLI-010', nombre:'Edificio Las Tipas',      tel:'3704-012345', localidad:'Formosa Capital', ultimaOp:'OP-0120', monto:4900000, saldo:0,       contacto:'01/06', activo:true  },
];

function Clientes() {
  const [query, setQuery] = React.useState('');
  const filtered = CLIENTES_DATA.filter(c =>
    query==='' || c.nombre.toLowerCase().includes(query.toLowerCase()) || c.id.includes(query.toUpperCase())
  );
  const totalSaldo = CLIENTES_DATA.reduce((s,c)=>s+c.saldo,0);
  const sinContacto = CLIENTES_DATA.filter(c=>{
    const [d,m] = c.contacto.split('/').map(Number);
    const dias = Math.floor((new Date()-new Date(2026,m-1,d))/(86400000));
    return dias > 14;
  }).length;

  return (
    <React.Fragment>
      <SectionHero section="clientes" icon="Users"
        breadcrumb={['Comercial','Clientes']} title="Clientes"
        sub="Base de datos comercial y estado de cuenta"
        actions={<button className="btn btn-section"><Icon name="Plus" size={14}/>Nuevo cliente</button>}
      />
      <div className="app-page-inner" style={{display:'flex',flexDirection:'column',gap:14}}>
        <CompactStatsBar items={[
          {value:String(CLIENTES_DATA.filter(c=>c.activo).length), label:'clientes activos',      color:'#22d3ee'},
          {value:String(sinContacto),                               label:'sin contacto +14 días', color:'#fbbf24'},
          {value:formatCurrency(totalSaldo),                        label:'saldo total pendiente', color:'#fb7185'},
          {value:String(CLIENTES_DATA.filter(c=>c.saldo===0&&c.activo).length), label:'al día', color:'#34d399'},
        ]}/>

        <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:12}}>
            <Card tight>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af',display:'flex'}}><Icon name="Search" size={14}/></span>
                <input className="input" placeholder="Buscar por nombre, ID o localidad…" value={query} onChange={e=>setQuery(e.target.value)} style={{paddingLeft:32}}/>
              </div>
            </Card>
            <Card style={{padding:0,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                    {['Cliente','Teléfono','Localidad','Última op.','Facturado','Saldo','Contacto',''].map((h,i)=>(
                      <th key={i} style={{textAlign:i>=4&&i<=5?'right':'left',padding:'10px 14px',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c=>{
                    const [d,m] = c.contacto.split('/').map(Number);
                    const dias = Math.floor((new Date()-new Date(2026,m-1,d))/(86400000));
                    return (
                      <tr key={c.id} style={{borderBottom:'1px solid #f3f4f6',cursor:'pointer',transition:'background 150ms',
                        borderLeft: c.saldo>0?'4px solid #f59e0b':'4px solid transparent'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                        onMouseLeave={e=>e.currentTarget.style.background='#fff'}
                      >
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:28,height:28,borderRadius:8,background:c.activo?'#cffafe':'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              <span style={{fontSize:10,fontWeight:800,color:c.activo?'#0e7490':'#6b7280'}}>{c.nombre.slice(0,2).toUpperCase()}</span>
                            </div>
                            <div>
                              <p style={{margin:0,fontWeight:700,color:'#1f2937',fontSize:13}}>{c.nombre}</p>
                              <p style={{margin:0,fontSize:10,color:'#9ca3af'}}>{c.id}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#4b5563',fontSize:12}}>{c.tel}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#6b7280',fontSize:12}}>{c.localidad}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}><span className="mono" style={{fontSize:11}}>{c.ultimaOp}</span></td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',textAlign:'right'}}><span className="money" style={{fontSize:13}}>{formatCurrency(c.monto)}</span></td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',textAlign:'right'}}>
                          {c.saldo>0
                            ? <span style={{fontSize:12,fontWeight:800,color:'#b91c1c',fontVariantNumeric:'tabular-nums'}}>{formatCurrency(c.saldo)}</span>
                            : <Pill tone="emerald">Al día</Pill>}
                        </td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}>
                          <Pill tone={dias>14?'red':dias>7?'amber':'gray'}>Hace {dias}d</Pill>
                        </td>
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
              <CardHeader icon="Zap" iconTone="cyan" title="Acciones rápidas"/>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {[
                  {icon:'Plus',       label:'Nuevo cliente',         bg:'#0e7490',fg:'#fff'},
                  {icon:'Mail',       label:'Campaña de seguimiento', bg:'#cffafe',fg:'#0e7490'},
                  {icon:'Filter',     label:'Exportar clientes',      bg:'#dbeafe',fg:'#1d4ed8'},
                  {icon:'BookOpen',   label:'Ver estado de cuenta',   bg:'#e0e7ff',fg:'#4338ca'},
                ].map(a=>(
                  <button key={a.label} className="qa-btn" style={{background:a.bg,color:a.fg}}>
                    <Icon name={a.icon} size={13}/>{a.label}
                  </button>
                ))}
              </div>
            </Card>
            <Card tight>
              <CardHeader icon="AlertTriangle" iconTone="amber" title="Con saldo pendiente"/>
              {CLIENTES_DATA.filter(c=>c.saldo>0).slice(0,4).map(c=>(
                <div key={c.id} className="flex items-center gap-2" style={{padding:'7px 0',borderBottom:'1px solid #f3f4f6'}}>
                  <div style={{width:28,height:28,borderRadius:8,background:'#fef3c7',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:9,fontWeight:800,color:'#b45309'}}>{c.nombre.slice(0,2).toUpperCase()}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:12,fontWeight:600,color:'#1f2937'}} className="truncate">{c.nombre}</p>
                  </div>
                  <span style={{fontSize:12,fontWeight:800,color:'#b91c1c',fontVariantNumeric:'tabular-nums',flexShrink:0}}>{formatCurrency(c.saldo)}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}
window.Clientes = Clientes;
