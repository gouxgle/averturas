/* Recibos — cobros y compromisos de pago + columna lateral */

const RECIBOS_DATA = [
  { id:'REC-056', cliente:'Familia González',       concepto:'Saldo OP-0140',          monto:1250000, forma:'Transferencia', fecha:'04/06', estado:'cobrado'   },
  { id:'REC-055', cliente:'Edificio Las Tipas',     concepto:'Saldo OP-0120',          monto:1600000, forma:'Cheque',        fecha:'03/06', estado:'cobrado'   },
  { id:'REC-054', cliente:'Mariela Ojeda',          concepto:'Seña OP-0138 (50%)',     monto: 240000, forma:'Transferencia', fecha:'02/06', estado:'cobrado'   },
  { id:'REC-053', cliente:'Constructora del Norte', concepto:'Seña OP-0135 (50%)',     monto:1600000, forma:'Cheque 30d',    fecha:'01/06', estado:'pendiente' },
  { id:'REC-052', cliente:'Familia Britos',         concepto:'Saldo OP-0130',          monto:1820000, forma:'Transferencia', fecha:'31/05', estado:'cobrado'   },
  { id:'REC-051', cliente:'Ramírez S.A.',           concepto:'Anticipo OP-0133',       monto:2700000, forma:'Cheque 60d',    fecha:'28/05', estado:'pendiente' },
  { id:'REC-050', cliente:'Familia Acuña',          concepto:'Saldo OP-0118',          monto: 725000, forma:'Efectivo',      fecha:'25/05', estado:'cobrado'   },
  { id:'REC-049', cliente:'Hugo Rodríguez',         concepto:'Anticipo PR-0040',       monto:  47500, forma:'Transferencia', fecha:'24/05', estado:'vencido'   },
];

function Recibos() {
  const [query, setQuery] = React.useState('');
  const filtered = RECIBOS_DATA.filter(r=>query===''||r.cliente.toLowerCase().includes(query.toLowerCase())||r.id.includes(query.toUpperCase()));
  const cobradoMes = RECIBOS_DATA.filter(r=>r.estado==='cobrado').reduce((s,r)=>s+r.monto,0);
  const pendiente = RECIBOS_DATA.filter(r=>r.estado==='pendiente').reduce((s,r)=>s+r.monto,0);

  return (
    <React.Fragment>
      <SectionHero section="recibos" icon="Receipt"
        breadcrumb={['Comercial','Recibos']} title="Recibos"
        sub="Cobros realizados y compromisos de pago"
        actions={<button className="btn btn-section"><Icon name="Plus" size={14}/>Registrar cobro</button>}
      />
      <div className="app-page-inner" style={{display:'flex',flexDirection:'column',gap:14}}>
        <CompactStatsBar items={[
          {value:formatCurrency(cobradoMes),  label:'cobrado este mes',   color:'#34d399'},
          {value:formatCurrency(pendiente),   label:'pendiente cobro',    color:'#fbbf24'},
          {value:String(RECIBOS_DATA.filter(r=>r.estado==='vencido').length), label:'cheques vencidos', color:'#fb7185'},
          {value:String(RECIBOS_DATA.filter(r=>r.estado==='cobrado').length), label:'recibos emitidos', color:'#60a5fa'},
        ]}/>

        <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:12}}>
            <Card tight>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af',display:'flex'}}><Icon name="Search" size={14}/></span>
                <input className="input" placeholder="Buscar recibo o cliente…" value={query} onChange={e=>setQuery(e.target.value)} style={{paddingLeft:32}}/>
              </div>
            </Card>
            <Card style={{padding:0,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                    {['Número','Cliente','Concepto','Monto','Forma de pago','Fecha','Estado',''].map((h,i)=>(
                      <th key={i} style={{padding:'10px 14px',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.06em',textAlign:i===3?'right':'left'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r=>{
                    const tone = {cobrado:'emerald',pendiente:'amber',vencido:'red'}[r.estado]||'gray';
                    return (
                      <tr key={r.id} style={{borderBottom:'1px solid #f3f4f6',cursor:'pointer',transition:'background 150ms',
                        borderLeft:r.estado==='vencido'?'4px solid #ef4444':r.estado==='pendiente'?'4px solid #f59e0b':'4px solid #34d399'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                        onMouseLeave={e=>e.currentTarget.style.background='#fff'}
                      >
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}><span className="mono">{r.id}</span></td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',fontWeight:600,color:'#1f2937'}}>{r.cliente}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#6b7280',fontSize:12}}>{r.concepto}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',textAlign:'right'}}><span className="money">{formatCurrency(r.monto)}</span></td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#4b5563',fontSize:12}}>{r.forma}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle',color:'#9ca3af',fontSize:12}}>{r.fecha}</td>
                        <td style={{padding:'11px 14px',verticalAlign:'middle'}}><Pill tone={tone}>{r.estado.charAt(0).toUpperCase()+r.estado.slice(1)}</Pill></td>
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
              <CardHeader icon="Zap" iconTone="emerald" title="Acciones rápidas"/>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {[
                  {icon:'Plus',        label:'Registrar cobro',       bg:'#047857',fg:'#fff'},
                  {icon:'DollarSign',  label:'Cobrar saldo',          bg:'#d1fae5',fg:'#047857'},
                  {icon:'Filter',      label:'Exportar recibos',      bg:'#dbeafe',fg:'#1d4ed8'},
                  {icon:'AlertTriangle',label:'Ver cheques vencidos', bg:'#fee2e2',fg:'#b91c1c'},
                ].map(a=>(
                  <button key={a.label} className="qa-btn" style={{background:a.bg,color:a.fg}}>
                    <Icon name={a.icon} size={13}/>{a.label}
                  </button>
                ))}
              </div>
            </Card>
            <Card tight>
              <CardHeader icon="Clock" iconTone="amber" title="Cobros pendientes"/>
              {RECIBOS_DATA.filter(r=>r.estado!=='cobrado').map(r=>(
                <div key={r.id} style={{padding:'8px 0',borderBottom:'1px solid #f3f4f6'}}>
                  <div className="flex items-center justify-between">
                    <p style={{margin:0,fontSize:12,fontWeight:600,color:'#1f2937'}} className="truncate">{r.cliente}</p>
                    <span className="money" style={{fontSize:12,color:r.estado==='vencido'?'#b91c1c':'#b45309',flexShrink:0,marginLeft:8}}>{formatCurrency(r.monto)}</span>
                  </div>
                  <div className="flex items-center justify-between" style={{marginTop:2}}>
                    <p style={{margin:0,fontSize:10,color:'#9ca3af'}}>{r.forma} · {r.fecha}</p>
                    <Pill tone={r.estado==='vencido'?'red':'amber'} style={{fontSize:9}}>{r.estado}</Pill>
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
window.Recibos = Recibos;
