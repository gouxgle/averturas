/* CRM — pipeline de oportunidades con etapas + columna lateral */

const ETAPAS = ['Prospecto','Interesado','Cotizado','Negociando','Ganado','Perdido'];
const ETAPA_TONE = { Prospecto:'gray', Interesado:'blue', Cotizado:'violet', Negociando:'amber', Ganado:'emerald', Perdido:'red' };

const OPS_CRM = [
  { id:'OPP-012', nombre:'Edificio Rio Grande',      etapa:'Negociando', monto:8500000, contacto:'Arq. Suárez',   tel:'3704-111222', dias:2  },
  { id:'OPP-011', nombre:'Country Las Acacias',       etapa:'Cotizado',   monto:4200000, contacto:'Ing. Morales',  tel:'3704-222333', dias:5  },
  { id:'OPP-010', nombre:'Fraccionamiento Norte',     etapa:'Interesado', monto:2800000, contacto:'Carlos Vera',   tel:'3704-333444', dias:1  },
  { id:'OPP-009', nombre:'Hotel Formosa Palace',      etapa:'Cotizado',   monto:6100000, contacto:'Gte. Gimenez',  tel:'3704-444555', dias:8  },
  { id:'OPP-008', nombre:'Municipalidad Clorinda',    etapa:'Ganado',     monto:3900000, contacto:'Licitación',    tel:'—',           dias:14 },
  { id:'OPP-007', nombre:'Viviendas IPV Lote 12',     etapa:'Negociando', monto:5700000, contacto:'Arq. Ledesma',  tel:'3704-555666', dias:3  },
  { id:'OPP-006', nombre:'Supermercado La Estrella',  etapa:'Interesado', monto:1400000, contacto:'Dueño Quiroga', tel:'3704-666777', dias:6  },
  { id:'OPP-005', nombre:'Clínica San Martín',        etapa:'Perdido',    monto:2200000, contacto:'Adm. López',    tel:'—',           dias:22 },
];

function CRM() {
  const [filtroEtapa, setFiltroEtapa] = React.useState('todas');
  const filtered = filtroEtapa==='todas' ? OPS_CRM : OPS_CRM.filter(o=>o.etapa===filtroEtapa);
  const montoActivo = OPS_CRM.filter(o=>o.etapa!=='Ganado'&&o.etapa!=='Perdido').reduce((s,o)=>s+o.monto,0);
  const ganadas = OPS_CRM.filter(o=>o.etapa==='Ganado').length;

  return (
    <React.Fragment>
      <SectionHero section="crm" icon="GitBranch"
        breadcrumb={['Comercial','CRM']} title="CRM — Pipeline"
        sub="Oportunidades comerciales por etapa"
        actions={<button className="btn btn-section"><Icon name="Plus" size={14}/>Nueva oportunidad</button>}
      />
      <div className="app-page-inner" style={{display:'flex',flexDirection:'column',gap:14}}>
        <CompactStatsBar items={[
          {value:String(OPS_CRM.filter(o=>!['Ganado','Perdido'].includes(o.etapa)).length), label:'oportunidades activas', color:'#fb7185'},
          {value:formatCurrency(montoActivo), label:'en pipeline', color:'#60a5fa'},
          {value:String(ganadas), label:'ganadas este mes', color:'#34d399'},
          {value:Math.round((ganadas/OPS_CRM.length)*100)+'%', label:'tasa de cierre', color:'#fbbf24'},
        ]}/>

        <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:12}}>
            {/* Filtro por etapa */}
            <Card tight>
              <div className="flex items-center gap-2" style={{flexWrap:'wrap'}}>
                <span style={{fontSize:11,fontWeight:600,color:'#6b7280'}}>Etapa:</span>
                {['todas',...ETAPAS].map(e=>(
                  <button key={e} onClick={()=>setFiltroEtapa(e)} style={{
                    padding:'5px 11px',borderRadius:9999,fontSize:11,fontWeight:600,
                    border:'1px solid '+(filtroEtapa===e?'#be123c':'#e5e7eb'),
                    background:filtroEtapa===e?'#be123c':'#fff',
                    color:filtroEtapa===e?'#fff':'#4b5563',transition:'all 150ms',
                    textTransform:'capitalize',
                  }}>{e==='todas'?'Todas':e}</button>
                ))}
              </div>
            </Card>

            <Card style={{padding:0,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                    {['Oportunidad','Contacto','Teléfono','Monto','Etapa','Días',''].map((h,i)=>(
                      <th key={i} style={{textAlign:i===3?'right':'left',padding:'10px 14px',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o=>(
                    <tr key={o.id} style={{borderBottom:'1px solid #f3f4f6',cursor:'pointer',transition:'background 150ms'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                      onMouseLeave={e=>e.currentTarget.style.background='#fff'}
                    >
                      <td style={{padding:'11px 14px',verticalAlign:'middle'}}>
                        <p style={{margin:0,fontWeight:700,color:'#1f2937'}}>{o.nombre}</p>
                        <p style={{margin:0,fontSize:10,color:'#9ca3af'}}>{o.id}</p>
                      </td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle',fontSize:12,color:'#4b5563'}}>{o.contacto}</td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle',fontSize:12,color:'#6b7280'}}>{o.tel}</td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle',textAlign:'right'}}><span className="money">{formatCurrency(o.monto)}</span></td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle'}}>
                        <Pill tone={ETAPA_TONE[o.etapa]||'gray'}>{o.etapa}</Pill>
                      </td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle'}}>
                        <Pill tone={o.dias>14?'red':o.dias>7?'amber':'gray'}>Hace {o.dias}d</Pill>
                      </td>
                      <td style={{padding:'11px 14px',verticalAlign:'middle'}}><Icon name="ChevronRight" size={14} color="#9ca3af"/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <div style={{width:280,flexShrink:0,display:"flex",flexDirection:"column",gap:12}}>
            <Card tight>
              <CardHeader icon="Zap" iconTone="rose" title="Acciones rápidas"/>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {[
                  {icon:'Plus',         label:'Nueva oportunidad',    bg:'#be123c',fg:'#fff'},
                  {icon:'Phone',        label:'Llamadas pendientes',   bg:'#ffe4e6',fg:'#be123c'},
                  {icon:'TrendingUp',   label:'Ver reporte pipeline',  bg:'#dbeafe',fg:'#1d4ed8'},
                  {icon:'Filter',       label:'Exportar CRM',          bg:'#f3f4f6',fg:'#4b5563'},
                ].map(a=>(
                  <button key={a.label} className="qa-btn" style={{background:a.bg,color:a.fg}}>
                    <Icon name={a.icon} size={13}/>{a.label}
                  </button>
                ))}
              </div>
            </Card>
            <Card tight>
              <CardHeader icon="BarChart3" iconTone="rose" title="Por etapa"/>
              {ETAPAS.map(e=>{
                const n = OPS_CRM.filter(o=>o.etapa===e).length;
                const pct = Math.round((n/OPS_CRM.length)*100);
                return (
                  <div key={e} className="flex items-center gap-2" style={{padding:'6px 0'}}>
                    <Pill tone={ETAPA_TONE[e]||'gray'} style={{width:90,justifyContent:'center'}}>{e}</Pill>
                    <div className="bar" style={{flex:1}}><div className="bar-fill" style={{width:pct+'%',background:iconToneFg(ETAPA_TONE[e]||'gray')}}/></div>
                    <span style={{fontSize:11,fontWeight:700,color:'#1f2937',width:20,textAlign:'right'}}>{n}</span>
                  </div>
                );
              })}
            </Card>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}
window.CRM = CRM;
