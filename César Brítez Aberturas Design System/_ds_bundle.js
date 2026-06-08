/* @ds-bundle: {"format":3,"namespace":"CSarBrTezAberturasDesignSystem_f2fed3","components":[],"sourceHashes":{"ui_kits/app/CRM.jsx":"c6188618814a","ui_kits/app/CRMV2.jsx":"c6188618814a","ui_kits/app/Clientes.jsx":"99af49b2df16","ui_kits/app/ClientesV2.jsx":"99af49b2df16","ui_kits/app/Dashboard.jsx":"020fe986a8de","ui_kits/app/Login.jsx":"f2590f8b9217","ui_kits/app/Operaciones.jsx":"0788b23c78d2","ui_kits/app/Pedidos.jsx":"c651353d9367","ui_kits/app/PedidosV2.jsx":"c651353d9367","ui_kits/app/Placeholder.jsx":"bde33d55c35e","ui_kits/app/Presupuestos.jsx":"d320676ca7f8","ui_kits/app/PresupuestosV2.jsx":"d320676ca7f8","ui_kits/app/Recibos.jsx":"98fcc598d125","ui_kits/app/RecibosV2.jsx":"98fcc598d125","ui_kits/app/Remitos.jsx":"c86a72f6fa2f","ui_kits/app/RemitosV2.jsx":"c86a72f6fa2f","ui_kits/app/SectionHero.jsx":"63f60c65d130","ui_kits/app/SectionHeroV2.jsx":"29a64867d0a8","ui_kits/app/Sidebar.jsx":"65b5f10eff4f","ui_kits/app/SidebarV2.jsx":"65b5f10eff4f","ui_kits/app/TopBar.jsx":"3be3ab09b01d","ui_kits/app/app.jsx":"00753c7b2547","ui_kits/app/appV2.jsx":"00753c7b2547","ui_kits/app/icons.jsx":"79e5ca0814fd","ui_kits/app/primitives.jsx":"dcbdc4bfba07"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.CSarBrTezAberturasDesignSystem_f2fed3 = window.CSarBrTezAberturasDesignSystem_f2fed3 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/app/CRM.jsx
try { (() => {
/* CRM — pipeline de oportunidades con etapas + columna lateral */

const ETAPAS = ['Prospecto', 'Interesado', 'Cotizado', 'Negociando', 'Ganado', 'Perdido'];
const ETAPA_TONE = {
  Prospecto: 'gray',
  Interesado: 'blue',
  Cotizado: 'violet',
  Negociando: 'amber',
  Ganado: 'emerald',
  Perdido: 'red'
};
const OPS_CRM = [{
  id: 'OPP-012',
  nombre: 'Edificio Rio Grande',
  etapa: 'Negociando',
  monto: 8500000,
  contacto: 'Arq. Suárez',
  tel: '3704-111222',
  dias: 2
}, {
  id: 'OPP-011',
  nombre: 'Country Las Acacias',
  etapa: 'Cotizado',
  monto: 4200000,
  contacto: 'Ing. Morales',
  tel: '3704-222333',
  dias: 5
}, {
  id: 'OPP-010',
  nombre: 'Fraccionamiento Norte',
  etapa: 'Interesado',
  monto: 2800000,
  contacto: 'Carlos Vera',
  tel: '3704-333444',
  dias: 1
}, {
  id: 'OPP-009',
  nombre: 'Hotel Formosa Palace',
  etapa: 'Cotizado',
  monto: 6100000,
  contacto: 'Gte. Gimenez',
  tel: '3704-444555',
  dias: 8
}, {
  id: 'OPP-008',
  nombre: 'Municipalidad Clorinda',
  etapa: 'Ganado',
  monto: 3900000,
  contacto: 'Licitación',
  tel: '—',
  dias: 14
}, {
  id: 'OPP-007',
  nombre: 'Viviendas IPV Lote 12',
  etapa: 'Negociando',
  monto: 5700000,
  contacto: 'Arq. Ledesma',
  tel: '3704-555666',
  dias: 3
}, {
  id: 'OPP-006',
  nombre: 'Supermercado La Estrella',
  etapa: 'Interesado',
  monto: 1400000,
  contacto: 'Dueño Quiroga',
  tel: '3704-666777',
  dias: 6
}, {
  id: 'OPP-005',
  nombre: 'Clínica San Martín',
  etapa: 'Perdido',
  monto: 2200000,
  contacto: 'Adm. López',
  tel: '—',
  dias: 22
}];
function CRM() {
  const [filtroEtapa, setFiltroEtapa] = React.useState('todas');
  const filtered = filtroEtapa === 'todas' ? OPS_CRM : OPS_CRM.filter(o => o.etapa === filtroEtapa);
  const montoActivo = OPS_CRM.filter(o => o.etapa !== 'Ganado' && o.etapa !== 'Perdido').reduce((s, o) => s + o.monto, 0);
  const ganadas = OPS_CRM.filter(o => o.etapa === 'Ganado').length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "crm",
    icon: "GitBranch",
    breadcrumb: ['Comercial', 'CRM'],
    title: "CRM \u2014 Pipeline",
    sub: "Oportunidades comerciales por etapa",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Nueva oportunidad")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: String(OPS_CRM.filter(o => !['Ganado', 'Perdido'].includes(o.etapa)).length),
      label: 'oportunidades activas',
      color: '#fb7185'
    }, {
      value: formatCurrency(montoActivo),
      label: 'en pipeline',
      color: '#60a5fa'
    }, {
      value: String(ganadas),
      label: 'ganadas este mes',
      color: '#34d399'
    }, {
      value: Math.round(ganadas / OPS_CRM.length * 100) + '%',
      label: 'tasa de cierre',
      color: '#fbbf24'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2",
    style: {
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: '#6b7280'
    }
  }, "Etapa:"), ['todas', ...ETAPAS].map(e => /*#__PURE__*/React.createElement("button", {
    key: e,
    onClick: () => setFiltroEtapa(e),
    style: {
      padding: '5px 11px',
      borderRadius: 9999,
      fontSize: 11,
      fontWeight: 600,
      border: '1px solid ' + (filtroEtapa === e ? '#be123c' : '#e5e7eb'),
      background: filtroEtapa === e ? '#be123c' : '#fff',
      color: filtroEtapa === e ? '#fff' : '#4b5563',
      transition: 'all 150ms',
      textTransform: 'capitalize'
    }
  }, e === 'todas' ? 'Todas' : e)))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb'
    }
  }, ['Oportunidad', 'Contacto', 'Teléfono', 'Monto', 'Etapa', 'Días', ''].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      textAlign: i === 3 ? 'right' : 'left',
      padding: '10px 14px',
      fontSize: 10,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.06em'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(o => /*#__PURE__*/React.createElement("tr", {
    key: o.id,
    style: {
      borderBottom: '1px solid #f3f4f6',
      cursor: 'pointer',
      transition: 'background 150ms'
    },
    onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
    onMouseLeave: e => e.currentTarget.style.background = '#fff'
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontWeight: 700,
      color: '#1f2937'
    }
  }, o.nombre), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 10,
      color: '#9ca3af'
    }
  }, o.id)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle',
      fontSize: 12,
      color: '#4b5563'
    }
  }, o.contacto), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle',
      fontSize: 12,
      color: '#6b7280'
    }
  }, o.tel), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle',
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "money"
  }, formatCurrency(o.monto))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    tone: ETAPA_TONE[o.etapa] || 'gray'
  }, o.etapa)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    tone: o.dias > 14 ? 'red' : o.dias > 7 ? 'amber' : 'gray'
  }, "Hace ", o.dias, "d")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "ChevronRight",
    size: 14,
    color: "#9ca3af"
  })))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "rose",
    title: "Acciones r\xE1pidas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, [{
    icon: 'Plus',
    label: 'Nueva oportunidad',
    bg: '#be123c',
    fg: '#fff'
  }, {
    icon: 'Phone',
    label: 'Llamadas pendientes',
    bg: '#ffe4e6',
    fg: '#be123c'
  }, {
    icon: 'TrendingUp',
    label: 'Ver reporte pipeline',
    bg: '#dbeafe',
    fg: '#1d4ed8'
  }, {
    icon: 'Filter',
    label: 'Exportar CRM',
    bg: '#f3f4f6',
    fg: '#4b5563'
  }].map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    className: "qa-btn",
    style: {
      background: a.bg,
      color: a.fg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 13
  }), a.label)))), /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "BarChart3",
    iconTone: "rose",
    title: "Por etapa"
  }), ETAPAS.map(e => {
    const n = OPS_CRM.filter(o => o.etapa === e).length;
    const pct = Math.round(n / OPS_CRM.length * 100);
    return /*#__PURE__*/React.createElement("div", {
      key: e,
      className: "flex items-center gap-2",
      style: {
        padding: '6px 0'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      tone: ETAPA_TONE[e] || 'gray',
      style: {
        width: 90,
        justifyContent: 'center'
      }
    }, e), /*#__PURE__*/React.createElement("div", {
      className: "bar",
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "bar-fill",
      style: {
        width: pct + '%',
        background: iconToneFg(ETAPA_TONE[e] || 'gray')
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: '#1f2937',
        width: 20,
        textAlign: 'right'
      }
    }, n));
  }))))));
}
window.CRM = CRM;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/CRM.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/CRMV2.jsx
try { (() => {
/* CRM — pipeline de oportunidades con etapas + columna lateral */

const ETAPAS = ['Prospecto', 'Interesado', 'Cotizado', 'Negociando', 'Ganado', 'Perdido'];
const ETAPA_TONE = {
  Prospecto: 'gray',
  Interesado: 'blue',
  Cotizado: 'violet',
  Negociando: 'amber',
  Ganado: 'emerald',
  Perdido: 'red'
};
const OPS_CRM = [{
  id: 'OPP-012',
  nombre: 'Edificio Rio Grande',
  etapa: 'Negociando',
  monto: 8500000,
  contacto: 'Arq. Suárez',
  tel: '3704-111222',
  dias: 2
}, {
  id: 'OPP-011',
  nombre: 'Country Las Acacias',
  etapa: 'Cotizado',
  monto: 4200000,
  contacto: 'Ing. Morales',
  tel: '3704-222333',
  dias: 5
}, {
  id: 'OPP-010',
  nombre: 'Fraccionamiento Norte',
  etapa: 'Interesado',
  monto: 2800000,
  contacto: 'Carlos Vera',
  tel: '3704-333444',
  dias: 1
}, {
  id: 'OPP-009',
  nombre: 'Hotel Formosa Palace',
  etapa: 'Cotizado',
  monto: 6100000,
  contacto: 'Gte. Gimenez',
  tel: '3704-444555',
  dias: 8
}, {
  id: 'OPP-008',
  nombre: 'Municipalidad Clorinda',
  etapa: 'Ganado',
  monto: 3900000,
  contacto: 'Licitación',
  tel: '—',
  dias: 14
}, {
  id: 'OPP-007',
  nombre: 'Viviendas IPV Lote 12',
  etapa: 'Negociando',
  monto: 5700000,
  contacto: 'Arq. Ledesma',
  tel: '3704-555666',
  dias: 3
}, {
  id: 'OPP-006',
  nombre: 'Supermercado La Estrella',
  etapa: 'Interesado',
  monto: 1400000,
  contacto: 'Dueño Quiroga',
  tel: '3704-666777',
  dias: 6
}, {
  id: 'OPP-005',
  nombre: 'Clínica San Martín',
  etapa: 'Perdido',
  monto: 2200000,
  contacto: 'Adm. López',
  tel: '—',
  dias: 22
}];
function CRM() {
  const [filtroEtapa, setFiltroEtapa] = React.useState('todas');
  const filtered = filtroEtapa === 'todas' ? OPS_CRM : OPS_CRM.filter(o => o.etapa === filtroEtapa);
  const montoActivo = OPS_CRM.filter(o => o.etapa !== 'Ganado' && o.etapa !== 'Perdido').reduce((s, o) => s + o.monto, 0);
  const ganadas = OPS_CRM.filter(o => o.etapa === 'Ganado').length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "crm",
    icon: "GitBranch",
    breadcrumb: ['Comercial', 'CRM'],
    title: "CRM \u2014 Pipeline",
    sub: "Oportunidades comerciales por etapa",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Nueva oportunidad")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: String(OPS_CRM.filter(o => !['Ganado', 'Perdido'].includes(o.etapa)).length),
      label: 'oportunidades activas',
      color: '#fb7185'
    }, {
      value: formatCurrency(montoActivo),
      label: 'en pipeline',
      color: '#60a5fa'
    }, {
      value: String(ganadas),
      label: 'ganadas este mes',
      color: '#34d399'
    }, {
      value: Math.round(ganadas / OPS_CRM.length * 100) + '%',
      label: 'tasa de cierre',
      color: '#fbbf24'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2",
    style: {
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: '#6b7280'
    }
  }, "Etapa:"), ['todas', ...ETAPAS].map(e => /*#__PURE__*/React.createElement("button", {
    key: e,
    onClick: () => setFiltroEtapa(e),
    style: {
      padding: '5px 11px',
      borderRadius: 9999,
      fontSize: 11,
      fontWeight: 600,
      border: '1px solid ' + (filtroEtapa === e ? '#be123c' : '#e5e7eb'),
      background: filtroEtapa === e ? '#be123c' : '#fff',
      color: filtroEtapa === e ? '#fff' : '#4b5563',
      transition: 'all 150ms',
      textTransform: 'capitalize'
    }
  }, e === 'todas' ? 'Todas' : e)))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb'
    }
  }, ['Oportunidad', 'Contacto', 'Teléfono', 'Monto', 'Etapa', 'Días', ''].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      textAlign: i === 3 ? 'right' : 'left',
      padding: '10px 14px',
      fontSize: 10,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.06em'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(o => /*#__PURE__*/React.createElement("tr", {
    key: o.id,
    style: {
      borderBottom: '1px solid #f3f4f6',
      cursor: 'pointer',
      transition: 'background 150ms'
    },
    onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
    onMouseLeave: e => e.currentTarget.style.background = '#fff'
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontWeight: 700,
      color: '#1f2937'
    }
  }, o.nombre), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 10,
      color: '#9ca3af'
    }
  }, o.id)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle',
      fontSize: 12,
      color: '#4b5563'
    }
  }, o.contacto), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle',
      fontSize: 12,
      color: '#6b7280'
    }
  }, o.tel), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle',
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "money"
  }, formatCurrency(o.monto))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    tone: ETAPA_TONE[o.etapa] || 'gray'
  }, o.etapa)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    tone: o.dias > 14 ? 'red' : o.dias > 7 ? 'amber' : 'gray'
  }, "Hace ", o.dias, "d")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "ChevronRight",
    size: 14,
    color: "#9ca3af"
  })))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "rose",
    title: "Acciones r\xE1pidas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, [{
    icon: 'Plus',
    label: 'Nueva oportunidad',
    bg: '#be123c',
    fg: '#fff'
  }, {
    icon: 'Phone',
    label: 'Llamadas pendientes',
    bg: '#ffe4e6',
    fg: '#be123c'
  }, {
    icon: 'TrendingUp',
    label: 'Ver reporte pipeline',
    bg: '#dbeafe',
    fg: '#1d4ed8'
  }, {
    icon: 'Filter',
    label: 'Exportar CRM',
    bg: '#f3f4f6',
    fg: '#4b5563'
  }].map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    className: "qa-btn",
    style: {
      background: a.bg,
      color: a.fg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 13
  }), a.label)))), /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "BarChart3",
    iconTone: "rose",
    title: "Por etapa"
  }), ETAPAS.map(e => {
    const n = OPS_CRM.filter(o => o.etapa === e).length;
    const pct = Math.round(n / OPS_CRM.length * 100);
    return /*#__PURE__*/React.createElement("div", {
      key: e,
      className: "flex items-center gap-2",
      style: {
        padding: '6px 0'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      tone: ETAPA_TONE[e] || 'gray',
      style: {
        width: 90,
        justifyContent: 'center'
      }
    }, e), /*#__PURE__*/React.createElement("div", {
      className: "bar",
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "bar-fill",
      style: {
        width: pct + '%',
        background: iconToneFg(ETAPA_TONE[e] || 'gray')
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: '#1f2937',
        width: 20,
        textAlign: 'right'
      }
    }, n));
  }))))));
}
window.CRM = CRM;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/CRMV2.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Clientes.jsx
try { (() => {
/* Clientes — lista principal + columna lateral */

const CLIENTES_DATA = [{
  id: 'CLI-001',
  nombre: 'Familia González',
  tel: '3704-123456',
  localidad: 'Formosa Capital',
  ultimaOp: 'OP-0140',
  monto: 1250000,
  saldo: 0,
  contacto: '04/06',
  activo: true
}, {
  id: 'CLI-002',
  nombre: 'Mariela Ojeda',
  tel: '3704-234567',
  localidad: 'Formosa Capital',
  ultimaOp: 'OP-0138',
  monto: 480000,
  saldo: 240000,
  contacto: '03/06',
  activo: true
}, {
  id: 'CLI-003',
  nombre: 'Constructora del Norte',
  tel: '3704-345678',
  localidad: 'Clorinda',
  ultimaOp: 'OP-0135',
  monto: 3200000,
  saldo: 1600000,
  contacto: '28/05',
  activo: true
}, {
  id: 'CLI-004',
  nombre: 'Hugo Rodríguez',
  tel: '3704-456789',
  localidad: 'Formosa Capital',
  ultimaOp: 'PR-0040',
  monto: 95000,
  saldo: 95000,
  contacto: '02/06',
  activo: true
}, {
  id: 'CLI-005',
  nombre: 'Lorena Castro',
  tel: '3704-567890',
  localidad: 'Formosa Capital',
  ultimaOp: 'PR-0039',
  monto: 420000,
  saldo: 420000,
  contacto: '01/06',
  activo: true
}, {
  id: 'CLI-006',
  nombre: 'Estudio Britos & Asoc.',
  tel: '3704-678901',
  localidad: 'Formosa Capital',
  ultimaOp: 'PR-0038',
  monto: 2150000,
  saldo: 2150000,
  contacto: '31/05',
  activo: true
}, {
  id: 'CLI-007',
  nombre: 'Ramírez S.A.',
  tel: '3704-789012',
  localidad: 'Ingeniero Juárez',
  ultimaOp: 'OP-0133',
  monto: 5400000,
  saldo: 0,
  contacto: '15/05',
  activo: false
}, {
  id: 'CLI-008',
  nombre: 'Familia Acuña',
  tel: '3704-890123',
  localidad: 'Formosa Capital',
  ultimaOp: 'OP-0118',
  monto: 1450000,
  saldo: 0,
  contacto: '30/05',
  activo: true
}, {
  id: 'CLI-009',
  nombre: 'Daniel Mereles',
  tel: '3704-901234',
  localidad: 'El Colorado',
  ultimaOp: 'PR-0036',
  monto: 290000,
  saldo: 290000,
  contacto: '27/05',
  activo: false
}, {
  id: 'CLI-010',
  nombre: 'Edificio Las Tipas',
  tel: '3704-012345',
  localidad: 'Formosa Capital',
  ultimaOp: 'OP-0120',
  monto: 4900000,
  saldo: 0,
  contacto: '01/06',
  activo: true
}];
function Clientes() {
  const [query, setQuery] = React.useState('');
  const filtered = CLIENTES_DATA.filter(c => query === '' || c.nombre.toLowerCase().includes(query.toLowerCase()) || c.id.includes(query.toUpperCase()));
  const totalSaldo = CLIENTES_DATA.reduce((s, c) => s + c.saldo, 0);
  const sinContacto = CLIENTES_DATA.filter(c => {
    const [d, m] = c.contacto.split('/').map(Number);
    const dias = Math.floor((new Date() - new Date(2026, m - 1, d)) / 86400000);
    return dias > 14;
  }).length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "clientes",
    icon: "Users",
    breadcrumb: ['Comercial', 'Clientes'],
    title: "Clientes",
    sub: "Base de datos comercial y estado de cuenta",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Nuevo cliente")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: String(CLIENTES_DATA.filter(c => c.activo).length),
      label: 'clientes activos',
      color: '#22d3ee'
    }, {
      value: String(sinContacto),
      label: 'sin contacto +14 días',
      color: '#fbbf24'
    }, {
      value: formatCurrency(totalSaldo),
      label: 'saldo total pendiente',
      color: '#fb7185'
    }, {
      value: String(CLIENTES_DATA.filter(c => c.saldo === 0 && c.activo).length),
      label: 'al día',
      color: '#34d399'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Search",
    size: 14
  })), /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: "Buscar por nombre, ID o localidad\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    style: {
      paddingLeft: 32
    }
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb'
    }
  }, ['Cliente', 'Teléfono', 'Localidad', 'Última op.', 'Facturado', 'Saldo', 'Contacto', ''].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      textAlign: i >= 4 && i <= 5 ? 'right' : 'left',
      padding: '10px 14px',
      fontSize: 10,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.06em'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(c => {
    const [d, m] = c.contacto.split('/').map(Number);
    const dias = Math.floor((new Date() - new Date(2026, m - 1, d)) / 86400000);
    return /*#__PURE__*/React.createElement("tr", {
      key: c.id,
      style: {
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
        transition: 'background 150ms',
        borderLeft: c.saldo > 0 ? '4px solid #f59e0b' : '4px solid transparent'
      },
      onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
      onMouseLeave: e => e.currentTarget.style.background = '#fff'
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: 8,
        background: c.activo ? '#cffafe' : '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 800,
        color: c.activo ? '#0e7490' : '#6b7280'
      }
    }, c.nombre.slice(0, 2).toUpperCase())), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontWeight: 700,
        color: '#1f2937',
        fontSize: 13
      }
    }, c.nombre), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 10,
        color: '#9ca3af'
      }
    }, c.id)))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#4b5563',
        fontSize: 12
      }
    }, c.tel), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#6b7280',
        fontSize: 12
      }
    }, c.localidad), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 11
      }
    }, c.ultimaOp)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "money",
      style: {
        fontSize: 13
      }
    }, formatCurrency(c.monto))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        textAlign: 'right'
      }
    }, c.saldo > 0 ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: '#b91c1c',
        fontVariantNumeric: 'tabular-nums'
      }
    }, formatCurrency(c.saldo)) : /*#__PURE__*/React.createElement(Pill, {
      tone: "emerald"
    }, "Al d\xEDa")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      tone: dias > 14 ? 'red' : dias > 7 ? 'amber' : 'gray'
    }, "Hace ", dias, "d")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 14,
      color: "#9ca3af"
    })));
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "cyan",
    title: "Acciones r\xE1pidas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, [{
    icon: 'Plus',
    label: 'Nuevo cliente',
    bg: '#0e7490',
    fg: '#fff'
  }, {
    icon: 'Mail',
    label: 'Campaña de seguimiento',
    bg: '#cffafe',
    fg: '#0e7490'
  }, {
    icon: 'Filter',
    label: 'Exportar clientes',
    bg: '#dbeafe',
    fg: '#1d4ed8'
  }, {
    icon: 'BookOpen',
    label: 'Ver estado de cuenta',
    bg: '#e0e7ff',
    fg: '#4338ca'
  }].map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    className: "qa-btn",
    style: {
      background: a.bg,
      color: a.fg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 13
  }), a.label)))), /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "AlertTriangle",
    iconTone: "amber",
    title: "Con saldo pendiente"
  }), CLIENTES_DATA.filter(c => c.saldo > 0).slice(0, 4).map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    className: "flex items-center gap-2",
    style: {
      padding: '7px 0',
      borderBottom: '1px solid #f3f4f6'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: '#fef3c7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 800,
      color: '#b45309'
    }
  }, c.nombre.slice(0, 2).toUpperCase())), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 600,
      color: '#1f2937'
    },
    className: "truncate"
  }, c.nombre)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: '#b91c1c',
      fontVariantNumeric: 'tabular-nums',
      flexShrink: 0
    }
  }, formatCurrency(c.saldo)))))))));
}
window.Clientes = Clientes;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Clientes.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/ClientesV2.jsx
try { (() => {
/* Clientes — lista principal + columna lateral */

const CLIENTES_DATA = [{
  id: 'CLI-001',
  nombre: 'Familia González',
  tel: '3704-123456',
  localidad: 'Formosa Capital',
  ultimaOp: 'OP-0140',
  monto: 1250000,
  saldo: 0,
  contacto: '04/06',
  activo: true
}, {
  id: 'CLI-002',
  nombre: 'Mariela Ojeda',
  tel: '3704-234567',
  localidad: 'Formosa Capital',
  ultimaOp: 'OP-0138',
  monto: 480000,
  saldo: 240000,
  contacto: '03/06',
  activo: true
}, {
  id: 'CLI-003',
  nombre: 'Constructora del Norte',
  tel: '3704-345678',
  localidad: 'Clorinda',
  ultimaOp: 'OP-0135',
  monto: 3200000,
  saldo: 1600000,
  contacto: '28/05',
  activo: true
}, {
  id: 'CLI-004',
  nombre: 'Hugo Rodríguez',
  tel: '3704-456789',
  localidad: 'Formosa Capital',
  ultimaOp: 'PR-0040',
  monto: 95000,
  saldo: 95000,
  contacto: '02/06',
  activo: true
}, {
  id: 'CLI-005',
  nombre: 'Lorena Castro',
  tel: '3704-567890',
  localidad: 'Formosa Capital',
  ultimaOp: 'PR-0039',
  monto: 420000,
  saldo: 420000,
  contacto: '01/06',
  activo: true
}, {
  id: 'CLI-006',
  nombre: 'Estudio Britos & Asoc.',
  tel: '3704-678901',
  localidad: 'Formosa Capital',
  ultimaOp: 'PR-0038',
  monto: 2150000,
  saldo: 2150000,
  contacto: '31/05',
  activo: true
}, {
  id: 'CLI-007',
  nombre: 'Ramírez S.A.',
  tel: '3704-789012',
  localidad: 'Ingeniero Juárez',
  ultimaOp: 'OP-0133',
  monto: 5400000,
  saldo: 0,
  contacto: '15/05',
  activo: false
}, {
  id: 'CLI-008',
  nombre: 'Familia Acuña',
  tel: '3704-890123',
  localidad: 'Formosa Capital',
  ultimaOp: 'OP-0118',
  monto: 1450000,
  saldo: 0,
  contacto: '30/05',
  activo: true
}, {
  id: 'CLI-009',
  nombre: 'Daniel Mereles',
  tel: '3704-901234',
  localidad: 'El Colorado',
  ultimaOp: 'PR-0036',
  monto: 290000,
  saldo: 290000,
  contacto: '27/05',
  activo: false
}, {
  id: 'CLI-010',
  nombre: 'Edificio Las Tipas',
  tel: '3704-012345',
  localidad: 'Formosa Capital',
  ultimaOp: 'OP-0120',
  monto: 4900000,
  saldo: 0,
  contacto: '01/06',
  activo: true
}];
function Clientes() {
  const [query, setQuery] = React.useState('');
  const filtered = CLIENTES_DATA.filter(c => query === '' || c.nombre.toLowerCase().includes(query.toLowerCase()) || c.id.includes(query.toUpperCase()));
  const totalSaldo = CLIENTES_DATA.reduce((s, c) => s + c.saldo, 0);
  const sinContacto = CLIENTES_DATA.filter(c => {
    const [d, m] = c.contacto.split('/').map(Number);
    const dias = Math.floor((new Date() - new Date(2026, m - 1, d)) / 86400000);
    return dias > 14;
  }).length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "clientes",
    icon: "Users",
    breadcrumb: ['Comercial', 'Clientes'],
    title: "Clientes",
    sub: "Base de datos comercial y estado de cuenta",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Nuevo cliente")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: String(CLIENTES_DATA.filter(c => c.activo).length),
      label: 'clientes activos',
      color: '#22d3ee'
    }, {
      value: String(sinContacto),
      label: 'sin contacto +14 días',
      color: '#fbbf24'
    }, {
      value: formatCurrency(totalSaldo),
      label: 'saldo total pendiente',
      color: '#fb7185'
    }, {
      value: String(CLIENTES_DATA.filter(c => c.saldo === 0 && c.activo).length),
      label: 'al día',
      color: '#34d399'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Search",
    size: 14
  })), /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: "Buscar por nombre, ID o localidad\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    style: {
      paddingLeft: 32
    }
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb'
    }
  }, ['Cliente', 'Teléfono', 'Localidad', 'Última op.', 'Facturado', 'Saldo', 'Contacto', ''].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      textAlign: i >= 4 && i <= 5 ? 'right' : 'left',
      padding: '10px 14px',
      fontSize: 10,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.06em'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(c => {
    const [d, m] = c.contacto.split('/').map(Number);
    const dias = Math.floor((new Date() - new Date(2026, m - 1, d)) / 86400000);
    return /*#__PURE__*/React.createElement("tr", {
      key: c.id,
      style: {
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
        transition: 'background 150ms',
        borderLeft: c.saldo > 0 ? '4px solid #f59e0b' : '4px solid transparent'
      },
      onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
      onMouseLeave: e => e.currentTarget.style.background = '#fff'
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: 8,
        background: c.activo ? '#cffafe' : '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 800,
        color: c.activo ? '#0e7490' : '#6b7280'
      }
    }, c.nombre.slice(0, 2).toUpperCase())), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontWeight: 700,
        color: '#1f2937',
        fontSize: 13
      }
    }, c.nombre), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 10,
        color: '#9ca3af'
      }
    }, c.id)))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#4b5563',
        fontSize: 12
      }
    }, c.tel), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#6b7280',
        fontSize: 12
      }
    }, c.localidad), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 11
      }
    }, c.ultimaOp)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "money",
      style: {
        fontSize: 13
      }
    }, formatCurrency(c.monto))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        textAlign: 'right'
      }
    }, c.saldo > 0 ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 800,
        color: '#b91c1c',
        fontVariantNumeric: 'tabular-nums'
      }
    }, formatCurrency(c.saldo)) : /*#__PURE__*/React.createElement(Pill, {
      tone: "emerald"
    }, "Al d\xEDa")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      tone: dias > 14 ? 'red' : dias > 7 ? 'amber' : 'gray'
    }, "Hace ", dias, "d")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 14,
      color: "#9ca3af"
    })));
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "cyan",
    title: "Acciones r\xE1pidas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, [{
    icon: 'Plus',
    label: 'Nuevo cliente',
    bg: '#0e7490',
    fg: '#fff'
  }, {
    icon: 'Mail',
    label: 'Campaña de seguimiento',
    bg: '#cffafe',
    fg: '#0e7490'
  }, {
    icon: 'Filter',
    label: 'Exportar clientes',
    bg: '#dbeafe',
    fg: '#1d4ed8'
  }, {
    icon: 'BookOpen',
    label: 'Ver estado de cuenta',
    bg: '#e0e7ff',
    fg: '#4338ca'
  }].map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    className: "qa-btn",
    style: {
      background: a.bg,
      color: a.fg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 13
  }), a.label)))), /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "AlertTriangle",
    iconTone: "amber",
    title: "Con saldo pendiente"
  }), CLIENTES_DATA.filter(c => c.saldo > 0).slice(0, 4).map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    className: "flex items-center gap-2",
    style: {
      padding: '7px 0',
      borderBottom: '1px solid #f3f4f6'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: '#fef3c7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 800,
      color: '#b45309'
    }
  }, c.nombre.slice(0, 2).toUpperCase())), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 600,
      color: '#1f2937'
    },
    className: "truncate"
  }, c.nombre)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: '#b91c1c',
      fontVariantNumeric: 'tabular-nums',
      flexShrink: 0
    }
  }, formatCurrency(c.saldo)))))))));
}
window.Clientes = Clientes;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ClientesV2.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Dashboard.jsx
try { (() => {
/* Dashboard — landing page.
   New shape:
   - Section hero (gradient navy→red accent) with greeting
   - MetricsBand (dark navy block) for KPIs — walls off metrics
   - Operational cards on white below (priorities, riesgo, top productos)
   - Right column: sugerencias, problemas, actividad */

const PRIORIDADES = [{
  icon: 'Truck',
  tone: 'amber',
  title: '3 pedidos listos para entregar',
  sub: 'Coordiná la entrega hoy',
  count: 3
}, {
  icon: 'Phone',
  tone: 'blue',
  title: '5 clientes esperando confirmación',
  sub: 'Presupuestos enviados sin respuesta',
  count: 5
}, {
  icon: 'MessageCircle',
  tone: 'teal',
  title: '8 presupuestos para dar seguimiento',
  sub: 'Sin confirmar aún',
  count: 8
}, {
  icon: 'CalendarClock',
  tone: 'violet',
  title: '2 compromisos de pago próximos',
  sub: 'Vencen en los próximos 2 días',
  count: 2
}, {
  icon: 'AlertTriangle',
  tone: 'red',
  title: '1 pedido atrasado',
  sub: 'Superaron la fecha estimada',
  count: 1
}];
const VENTAS_RIESGO = [{
  id: 'PR-0042',
  cliente: 'Familia González',
  item: 'Ventana corrediza PVC 1.50×1.10',
  monto: 1250000,
  dias: 3
}, {
  id: 'PR-0039',
  cliente: 'Mariela Ojeda',
  item: 'Puerta de entrada aluminio',
  monto: 480000,
  dias: 6
}, {
  id: 'PR-0036',
  cliente: 'Estudio Britos & Asoc.',
  item: 'Ventanas balconeras (×3)',
  monto: 2150000,
  dias: 9
}, {
  id: 'PR-0033',
  cliente: 'Hugo Rodríguez',
  item: 'Mosquitero rebatible',
  monto: 95000,
  dias: 11
}];
const TOP_PRODS = [{
  n: 1,
  desc: 'Ventana corrediza PVC blanco',
  unidades: 24,
  monto: 4250000,
  tone: 'blue'
}, {
  n: 2,
  desc: 'Puerta entrada aluminio negro',
  unidades: 18,
  monto: 3120000,
  tone: 'teal'
}, {
  n: 3,
  desc: 'Balconera PVC símil madera',
  unidades: 12,
  monto: 2180000,
  tone: 'violet'
}, {
  n: 4,
  desc: 'Mosquitero rebatible',
  unidades: 31,
  monto: 640000,
  tone: 'amber'
}];
function Dashboard({
  user,
  onNavigate
}) {
  const now = new Date();
  const h = now.getHours();
  const saludo = h < 12 ? '¡Buenos días' : h < 19 ? '¡Buenas tardes' : '¡Buenas noches';
  const fechaHoy = now.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthPct = Math.round(dayOfMonth / daysInMonth * 100);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "dashboard",
    icon: "LayoutDashboard",
    breadcrumb: ['Inicio', 'Dashboard'],
    title: `${saludo}, ${user?.nombre ?? 'usuario'}`,
    sub: `${fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1)} · Acá tenés todo lo importante de tu negocio`,
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "card card-tight flex items-center gap-2",
      style: {
        padding: '8px 14px',
        fontSize: 13,
        color: '#4b5563'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "CalendarClock",
      size: 13,
      color: "#9ca3af"
    }), "Hoy, ", now.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long'
    })), /*#__PURE__*/React.createElement(Button, {
      variant: "gradient",
      icon: "Plus",
      onClick: () => onNavigate('presupuestos')
    }, "Nuevo presupuesto"))
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner"
  }, /*#__PURE__*/React.createElement(MetricsBand, {
    title: "M\xE9tricas del negocio",
    sub: `día ${dayOfMonth} / ${daysInMonth}`
  }, /*#__PURE__*/React.createElement(MetricTile, {
    label: "Ventas del d\xEDa",
    value: "$ 425.000",
    sub: "Promedio: $ 281.000/d\xEDa",
    icon: "DollarSign",
    progress: 42,
    progressColor: "#60a5fa"
  }), /*#__PURE__*/React.createElement(MetricTile, {
    label: "Ventas del mes",
    value: "$ 8.450.000",
    sub: `24 operaciones · ${monthPct}% del mes`,
    icon: "TrendingUp",
    progress: monthPct,
    progressColor: "#34d399"
  }), /*#__PURE__*/React.createElement(MetricTile, {
    label: "Presupuestos activos",
    value: "17",
    sub: "Sin confirmar a\xFAn",
    icon: "FileText",
    progress: 68,
    progressColor: "#a78bfa"
  }), /*#__PURE__*/React.createElement(MetricTile, {
    label: "% de cierre",
    value: "38%",
    sub: "9 cerrados de 24",
    icon: "Target",
    progress: 38,
    progressColor: "#34d399"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: 'flex',
      gap: 20,
      alignItems: 'flex-start',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Target",
    iconTone: "red",
    title: "Prioridades de hoy",
    sub: "Tu foco para hoy",
    action: /*#__PURE__*/React.createElement("a", {
      className: "btn-text",
      href: "#",
      style: {
        fontSize: 12
      }
    }, "Ver agenda completa ", /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 12
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12
    }
  }, PRIORIDADES.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.title,
    className: "card-lift",
    onClick: () => onNavigate('operaciones'),
    style: {
      display: 'flex',
      gap: 10,
      padding: 14,
      alignItems: 'flex-start',
      background: '#f9fafb',
      border: '1px solid #f3f4f6',
      borderRadius: 12,
      textAlign: 'left',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(IconTile, {
    name: p.icon,
    tone: p.tone,
    size: "lg"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 700,
      color: '#1f2937',
      lineHeight: 1.35
    }
  }, p.title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 11,
      color: '#6b7280',
      lineHeight: 1.25
    }
  }, p.sub)), p.count > 0 && /*#__PURE__*/React.createElement("span", {
    className: "chip-count"
  }, p.count))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '3fr 2fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "AlertTriangle",
    iconTone: "amber",
    title: "Ventas en riesgo",
    action: /*#__PURE__*/React.createElement("a", {
      className: "btn-text",
      href: "#",
      style: {
        fontSize: 12
      }
    }, "Ver todos ", /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 12
    }))
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: '#ef4444',
      margin: '0 0 8px'
    }
  }, "Presupuestos enviados sin respuesta"), /*#__PURE__*/React.createElement("div", null, VENTAS_RIESGO.map(op => /*#__PURE__*/React.createElement("button", {
    key: op.id,
    onClick: () => onNavigate('presupuestos'),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      padding: '10px 12px',
      borderRadius: 12,
      textAlign: 'left',
      transition: 'background 150ms'
    },
    onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      fontWeight: 600,
      color: '#1f2937'
    },
    className: "truncate"
  }, op.cliente), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 11,
      color: '#9ca3af'
    },
    className: "truncate"
  }, op.item)), /*#__PURE__*/React.createElement("p", {
    className: "money",
    style: {
      fontSize: 14
    }
  }, formatCurrency(op.monto)), /*#__PURE__*/React.createElement(Pill, {
    tone: op.dias > 7 ? 'red' : op.dias > 3 ? 'amber' : 'gray'
  }, "Hace ", op.dias, " d\xEDas"))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "MessageCircle",
    iconTone: "violet",
    title: "Seguimiento",
    action: /*#__PURE__*/React.createElement("a", {
      className: "btn-text",
      href: "#",
      style: {
        fontSize: 12
      }
    }, "Ver todos ", /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 12
    }))
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: '#9ca3af',
      margin: '0 0 8px'
    }
  }, "A qui\xE9n contactar hoy"), [{
    nombre: 'Carlos Britos',
    pref: 'whatsapp',
    dias: 14
  }, {
    nombre: 'Familia Rodríguez',
    pref: 'email',
    dias: 21
  }, {
    nombre: 'Lorena Castro',
    pref: 'whatsapp',
    dias: 8
  }, {
    nombre: 'Constructora Norte',
    pref: 'email',
    dias: 32
  }].map(c => /*#__PURE__*/React.createElement("div", {
    key: c.nombre,
    className: "flex items-center gap-2",
    style: {
      padding: '6px 0'
    }
  }, /*#__PURE__*/React.createElement(IconTile, {
    name: c.pref === 'email' ? 'Mail' : 'MessageCircle',
    tone: c.pref === 'email' ? 'blue' : 'emerald',
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 600,
      color: '#1f2937'
    },
    className: "truncate"
  }, c.nombre), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 10,
      color: '#9ca3af'
    }
  }, "Hace ", c.dias, " d\xEDas")), c.pref === 'whatsapp' ? /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm",
    style: {
      background: '#22c55e',
      color: '#fff',
      padding: '4px 10px',
      fontWeight: 700
    }
  }, "Contactar") : /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm",
    style: {
      background: '#ede9fe',
      color: '#6d28d9',
      padding: '4px 10px',
      fontWeight: 700
    }
  }, "Ver"))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "ShoppingBag",
    iconTone: "amber",
    title: "Productos m\xE1s vendidos",
    sub: "Este mes",
    action: /*#__PURE__*/React.createElement("a", {
      className: "btn-text",
      href: "#",
      style: {
        fontSize: 12
      }
    }, "Ver reporte completo ", /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 12
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12
    }
  }, TOP_PRODS.map(p => {
    const palettes = {
      blue: {
        num: '#2563eb',
        bar: '#eff6ff',
        border: '#dbeafe',
        price: '#1d4ed8'
      },
      teal: {
        num: '#0d9488',
        bar: '#f0fdfa',
        border: '#ccfbf1',
        price: '#0f766e'
      },
      violet: {
        num: '#7c3aed',
        bar: '#f5f3ff',
        border: '#ede9fe',
        price: '#6d28d9'
      },
      amber: {
        num: '#f59e0b',
        bar: '#fffbeb',
        border: '#fef3c7',
        price: '#b45309'
      }
    };
    const pal = palettes[p.tone];
    return /*#__PURE__*/React.createElement("div", {
      key: p.n,
      style: {
        background: pal.bar,
        border: `1px solid ${pal.border}`,
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: 8,
        background: pal.num,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 900,
        fontSize: 14
      }
    }, p.n), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        height: 44,
        borderRadius: 8,
        background: 'rgba(255,255,255,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Package",
      size: 22,
      color: "#d1d5db"
    }))), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 12,
        fontWeight: 700,
        color: '#1f2937',
        lineHeight: 1.3
      }
    }, p.desc), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 11,
        color: '#6b7280'
      }
    }, p.unidades, " unidades"), /*#__PURE__*/React.createElement("p", {
      className: "money",
      style: {
        fontSize: 14,
        color: pal.price
      }
    }, formatCurrency(p.monto)));
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 300,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Lightbulb",
    iconTone: "amber",
    title: "Sugerencias del sistema"
  }), [{
    ic: 'Users',
    tone: 'blue',
    txt: 'Hoy podés hacer seguimiento a 4 clientes clave que mostraron interés.'
  }, {
    ic: 'DollarSign',
    tone: 'emerald',
    txt: 'Tenés $ 4.215.000 en presupuestos sin cerrar.'
  }, {
    ic: 'ShoppingBag',
    tone: 'amber',
    txt: 'Las ventanas PVC se están vendiendo más esta semana.'
  }].map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    style: {
      display: 'flex',
      gap: 10,
      width: '100%',
      padding: '10px 12px',
      borderRadius: 12,
      textAlign: 'left',
      transition: 'background 150ms',
      alignItems: 'flex-start'
    },
    onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement(IconTile, {
    name: s.ic,
    tone: s.tone,
    size: "sm"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      flex: 1,
      fontSize: 12,
      color: '#4b5563',
      margin: 0,
      lineHeight: 1.4
    }
  }, s.txt), /*#__PURE__*/React.createElement(Icon, {
    name: "ChevronRight",
    size: 14,
    color: "#d1d5db"
  }))), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
      padding: '8px 12px',
      background: '#10b981',
      color: '#fff',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 700
    }
  }, "Ver oportunidades de venta")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "AlertTriangle",
    iconTone: "amber",
    title: "Problemas operativos",
    action: /*#__PURE__*/React.createElement("a", {
      className: "btn-text",
      href: "#",
      style: {
        fontSize: 11
      }
    }, "Ver todos ", /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 11
    }))
  }), [{
    ic: 'Package',
    tone: 'red',
    label: 'Stock crítico',
    sub: '3 productos',
    count: 3,
    badge: '#ef4444'
  }, {
    ic: 'Truck',
    tone: 'amber',
    label: 'Pedidos demorados',
    sub: '1 pedido',
    count: 1,
    badge: '#f59e0b'
  }, {
    ic: 'Clock',
    tone: 'orange',
    label: 'Entregas pendientes',
    sub: '5 entregas',
    count: 5,
    badge: '#fb923c'
  }].map(r => /*#__PURE__*/React.createElement("a", {
    key: r.label,
    href: "#",
    className: "flex items-center gap-3",
    style: {
      padding: '10px 8px',
      borderRadius: 12,
      transition: 'background 150ms'
    },
    onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement(IconTile, {
    name: r.ic,
    tone: r.tone,
    size: "lg"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 600,
      color: '#1f2937'
    }
  }, r.label), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 11,
      color: '#9ca3af'
    }
  }, r.sub)), /*#__PURE__*/React.createElement("span", {
    style: {
      background: r.badge,
      color: '#fff',
      fontSize: 11,
      fontWeight: 800,
      minWidth: 24,
      height: 20,
      padding: '0 6px',
      borderRadius: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, r.count)))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Activity",
    iconTone: "blue",
    title: "Actividad reciente"
  }), [{
    ic: 'CheckCircle2',
    tone: 'emerald',
    label: 'Familia González · Aprobado',
    monto: 1250000,
    when: 'Hace 12 min'
  }, {
    ic: 'FileText',
    tone: 'gray',
    label: 'Hugo Rodríguez · Nuevo borrador',
    monto: 95000,
    when: 'Hace 2 h'
  }, {
    ic: 'Truck',
    tone: 'green',
    label: 'Constructora Norte · Entregado',
    monto: 3200000,
    when: 'Hace 5 h'
  }, {
    ic: 'FileText',
    tone: 'amber',
    label: 'Lorena Castro · Enviado',
    monto: 420000,
    when: 'Hace 1 d'
  }].map((a, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      width: '100%',
      padding: '8px 8px',
      borderRadius: 12,
      textAlign: 'left',
      transition: 'background 150ms'
    },
    onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement(IconTile, {
    name: a.ic,
    tone: a.tone,
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 600,
      color: '#1f2937'
    },
    className: "truncate"
  }, a.label), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 11,
      color: '#9ca3af'
    },
    className: "truncate"
  }, formatCurrency(a.monto))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 10,
      color: '#9ca3af',
      whiteSpace: 'nowrap'
    }
  }, a.when))))))));
}
window.Dashboard = Dashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Login.jsx
try { (() => {
/* Login screen — split layout: navy panel left, form panel right.
   Mirrors src/pages/Login.tsx from the codebase. */

function Login({
  onSignIn
}) {
  const [email, setEmail] = React.useState('admin@aberturas.local');
  const [pwd, setPwd] = React.useState('Admin1234!');
  const [loading, setLoading] = React.useState(false);
  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSignIn({
        nombre: 'César',
        rol: 'admin'
      });
    }, 450);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      minHeight: '100vh',
      background: '#f0f2f5'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: 320,
      flexShrink: 0,
      background: '#031d49',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: 72,
    variant: "color"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 20,
      fontSize: 20,
      fontWeight: 800,
      color: '#fff',
      letterSpacing: '0.04em'
    }
  }, "C\xC9SAR BR\xCDTEZ"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#e31e24',
      marginTop: 4
    }
  }, "Aberturas"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      marginTop: 24,
      textAlign: 'center',
      padding: '0 24px',
      color: 'rgba(255,255,255,0.55)',
      fontStyle: 'italic'
    }
  }, "Aberturas bien pensadas.")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 380
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: 28,
      borderRadius: 16
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 18,
      fontWeight: 800,
      color: '#1f2937'
    }
  }, "Bienvenido"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 24px',
      fontSize: 13,
      color: '#6b7280'
    }
  }, "Ingres\xE1 tus credenciales para continuar"), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    className: "input",
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    required: true,
    autoFocus: true,
    placeholder: "tu@email.com"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "field-label"
  }, "Contrase\xF1a"), /*#__PURE__*/React.createElement("input", {
    className: "input",
    type: "password",
    value: pwd,
    onChange: e => setPwd(e.target.value),
    required: true,
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "brand",
    type: "submit",
    disabled: loading,
    style: {
      width: '100%',
      justifyContent: 'center',
      padding: '12px 16px',
      marginTop: 4
    }
  }, loading ? 'Ingresando...' : 'Ingresar'))), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      fontSize: 11,
      color: '#9ca3af',
      marginTop: 22
    }
  }, "C\xE9sar Br\xEDtez Aberturas \xB7 Formosa Capital"))));
}
window.Login = Login;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Operaciones.jsx
try { (() => {
/* Operaciones — Kanban tablero of 6 columns. Mirrors src/pages/Operaciones.tsx. */

const ESTADO_LABEL = {
  presupuesto: 'Borrador',
  enviado: 'Enviado',
  aprobado: 'Aprobado',
  en_produccion: 'En producción',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};
const COL_DEFS = [{
  key: 'sin_confirmar',
  title: 'Sin confirmar',
  tone: 'slate'
}, {
  key: 'confirmadas',
  title: 'Confirmadas',
  tone: 'emerald'
}, {
  key: 'con_pedido',
  title: 'Pedido al proveedor',
  tone: 'amber'
}, {
  key: 'listas_entregar',
  title: 'Listas p/ entregar',
  tone: 'teal'
}, {
  key: 'entregadas',
  title: 'Entregadas',
  tone: 'blue'
}, {
  key: 'canceladas',
  title: 'Canceladas',
  tone: 'red'
}];
const HEADER_TONE = {
  slate: {
    border: '#94a3b8',
    bg: '#f1f5f9',
    fg: '#334155',
    badge: '#64748b'
  },
  emerald: {
    border: '#34d399',
    bg: '#ecfdf5',
    fg: '#047857',
    badge: '#10b981'
  },
  amber: {
    border: '#fbbf24',
    bg: '#fffbeb',
    fg: '#b45309',
    badge: '#f59e0b'
  },
  teal: {
    border: '#2dd4bf',
    bg: '#f0fdfa',
    fg: '#0f766e',
    badge: '#14b8a6'
  },
  blue: {
    border: '#60a5fa',
    bg: '#eff6ff',
    fg: '#1d4ed8',
    badge: '#3b82f6'
  },
  red: {
    border: '#fca5a5',
    bg: '#fef2f2',
    fg: '#b91c1c',
    badge: '#f87171'
  }
};
const SAMPLE_OPS = {
  sin_confirmar: [{
    id: 'OP-0142',
    cliente: 'Hugo Rodríguez',
    item: 'Mosquitero rebatible',
    monto: 95000,
    estado: 'presupuesto',
    pago: 'sin_pago',
    fecha: '12/06'
  }, {
    id: 'OP-0143',
    cliente: 'Lorena Castro',
    item: 'Ventana balconera PVC',
    monto: 420000,
    estado: 'enviado',
    pago: 'sin_pago',
    fecha: '15/06'
  }, {
    id: 'OP-0144',
    cliente: 'Estudio Britos & Asoc.',
    item: 'Ventanas balconeras (×3)',
    monto: 2150000,
    estado: 'enviado',
    pago: 'sin_pago',
    fecha: '20/06'
  }],
  confirmadas: [{
    id: 'OP-0140',
    cliente: 'Familia González',
    item: 'Ventana corrediza PVC 1.50×1.10',
    monto: 1250000,
    estado: 'aprobado',
    pago: 'pagado',
    fecha: '08/06'
  }, {
    id: 'OP-0138',
    cliente: 'Mariela Ojeda',
    item: 'Puerta de entrada aluminio',
    monto: 480000,
    estado: 'aprobado',
    pago: 'señado',
    fecha: '10/06'
  }],
  con_pedido: [{
    id: 'OP-0135',
    cliente: 'Constructora del Norte',
    item: 'Ventanal fijo 3m × 2.4m',
    monto: 3200000,
    estado: 'en_produccion',
    pago: 'señado',
    fecha: '24/06'
  }, {
    id: 'OP-0133',
    cliente: 'Ramírez S.A.',
    item: 'Frente vidriado oficina',
    monto: 5400000,
    estado: 'en_produccion',
    pago: 'pagado',
    fecha: '28/06'
  }],
  listas_entregar: [{
    id: 'OP-0130',
    cliente: 'Familia Britos',
    item: 'Puerta corredera + 2 ventanas',
    monto: 1820000,
    estado: 'listo',
    pago: 'pagado',
    fecha: '06/06'
  }, {
    id: 'OP-0129',
    cliente: 'Pablo Sánchez',
    item: 'Ventana corrediza balcón',
    monto: 680000,
    estado: 'listo',
    pago: 'pagado',
    fecha: '07/06'
  }, {
    id: 'OP-0128',
    cliente: 'Andrea Méndez',
    item: 'Mampara de baño 80×190',
    monto: 340000,
    estado: 'listo',
    pago: 'pagado',
    fecha: '07/06'
  }],
  entregadas: [{
    id: 'OP-0120',
    cliente: 'Edificio Las Tipas',
    item: 'Ventanas piso 3 (×6)',
    monto: 4900000,
    estado: 'entregado',
    pago: 'pagado',
    fecha: '01/06'
  }, {
    id: 'OP-0118',
    cliente: 'Familia Acuña',
    item: 'Puerta principal + lateral',
    monto: 1450000,
    estado: 'entregado',
    pago: 'pagado',
    fecha: '30/05'
  }],
  canceladas: [{
    id: 'OP-0117',
    cliente: 'Daniel Mereles',
    item: 'Ventana hojas batientes',
    monto: 290000,
    estado: 'cancelado',
    pago: 'sin_pago',
    fecha: '28/05'
  }]
};
function PagoBadge({
  pago
}) {
  if (pago === 'pagado') return /*#__PURE__*/React.createElement(Pill, {
    tone: "emerald"
  }, "Pagado");
  if (pago === 'señado') return /*#__PURE__*/React.createElement(Pill, {
    tone: "amber"
  }, "Se\xF1ado");
  return /*#__PURE__*/React.createElement(Pill, {
    tone: "red"
  }, "Sin pago");
}
function EstadoBadge({
  estado
}) {
  const tone = {
    presupuesto: 'gray',
    enviado: 'bluish',
    aprobado: 'emerald',
    en_produccion: 'amber',
    listo: 'teal',
    entregado: 'bluish',
    cancelado: 'red'
  }[estado] || 'gray';
  return /*#__PURE__*/React.createElement(Pill, {
    tone: tone
  }, ESTADO_LABEL[estado] || estado);
}
function OpCard({
  op,
  col,
  onClick
}) {
  const showPago = col === 'sin_confirmar' || col === 'confirmadas';
  const showCta = col === 'confirmadas' || col === 'listas_entregar';
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    className: "card-lift",
    style: {
      width: '100%',
      textAlign: 'left',
      background: '#fff',
      border: '1px solid #f3f4f6',
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      cursor: 'pointer',
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between",
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 11
    }
  }, op.id), /*#__PURE__*/React.createElement(EstadoBadge, {
    estado: op.estado
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 700,
      color: '#1f2937'
    },
    className: "truncate"
  }, op.cliente), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 10,
      color: '#9ca3af'
    },
    className: "truncate"
  }, op.item), op.fecha && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 10,
      color: '#9ca3af'
    }
  }, "Entrega ", op.fecha), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between",
    style: {
      marginTop: 8,
      paddingTop: 8,
      borderTop: '1px solid #f3f4f6'
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "money",
    style: {
      fontSize: 13
    }
  }, formatCurrency(op.monto)), showPago && /*#__PURE__*/React.createElement(PagoBadge, {
    pago: op.pago
  }), col === 'canceladas' && /*#__PURE__*/React.createElement(Icon, {
    name: "XCircle",
    size: 14,
    color: "#f87171"
  }), col === 'entregadas' && /*#__PURE__*/React.createElement(Icon, {
    name: "CheckCircle2",
    size: 14,
    color: "#10b981"
  })), showCta && col === 'confirmadas' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      padding: '4px 8px',
      textAlign: 'center',
      background: '#fffbeb',
      border: '1px solid #fef3c7',
      color: '#b45309',
      borderRadius: 8,
      fontSize: 10,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "ShoppingCart",
    size: 10
  }), " Crear pedido \u2192"), showCta && col === 'listas_entregar' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      padding: '4px 8px',
      textAlign: 'center',
      background: '#f0fdfa',
      border: '1px solid #ccfbf1',
      color: '#0f766e',
      borderRadius: 8,
      fontSize: 10,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Truck",
    size: 10
  }), " Crear remito \u2192"));
}
function KanbanCol({
  col,
  title,
  tone,
  ops,
  onSelect
}) {
  const t = HEADER_TONE[tone];
  return /*#__PURE__*/React.createElement("div", {
    className: "kanban-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between",
    style: {
      padding: '8px 12px',
      marginBottom: 8,
      borderRadius: 10,
      borderLeft: `4px solid ${t.border}`,
      background: t.bg,
      color: t.fg
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 700
    },
    className: "truncate"
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      background: t.badge,
      color: '#fff',
      borderRadius: 9999,
      minWidth: 20,
      height: 18,
      padding: '0 6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 10,
      fontWeight: 800
    }
  }, ops.length)), ops.length === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      fontSize: 11,
      color: '#9ca3af',
      padding: '20px 0'
    }
  }, "Sin operaciones") : ops.map(op => /*#__PURE__*/React.createElement(OpCard, {
    key: op.id,
    op: op,
    col: col,
    onClick: () => onSelect && onSelect(op)
  })));
}
function Operaciones({
  onSelectOp
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "operaciones",
    icon: "Hammer",
    breadcrumb: ['Comercial', 'Operaciones'],
    title: "Tablero de Operaciones",
    sub: "Estado del flujo de trabajo \u2014 del presupuesto a la entrega",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section",
      type: "button"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Nueva operaci\xF3n")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: '13',
      label: 'activas · ' + formatCurrency(17400000),
      color: '#60a5fa'
    }, {
      value: '3',
      label: 'sin confirmar',
      color: '#a78bfa'
    }, {
      value: '3',
      label: 'listas p/ entregar',
      color: '#2dd4bf'
    }, {
      value: '2',
      label: 'entregadas esta semana',
      color: '#34d399'
    }]
  }), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "amber",
    title: "Tablero \u2014 flujo completo",
    sub: "6 estados"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      overflowX: 'auto',
      paddingBottom: 6
    }
  }, COL_DEFS.map(c => /*#__PURE__*/React.createElement(KanbanCol, {
    key: c.key,
    col: c.key,
    title: c.title,
    tone: c.tone,
    ops: SAMPLE_OPS[c.key] || [],
    onSelect: onSelectOp
  }))))));
}
window.Operaciones = Operaciones;
window.SAMPLE_OPS = SAMPLE_OPS;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Operaciones.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Pedidos.jsx
try { (() => {
/* Pedidos — órdenes a proveedores + columna lateral */

const PEDIDOS_DATA = [{
  id: 'PED-028',
  op: 'OP-0140',
  proveedor: 'Aluminios del Norte',
  item: 'Ventana corrediza PVC 1.50×1.10',
  monto: 625000,
  estado: 'recibido',
  fecha: '28/05',
  estimado: '04/06'
}, {
  id: 'PED-027',
  op: 'OP-0138',
  proveedor: 'Perfisa S.A.',
  item: 'Puerta aluminio negro',
  monto: 190000,
  estado: 'en_transito',
  fecha: '01/06',
  estimado: '08/06'
}, {
  id: 'PED-026',
  op: 'OP-0135',
  proveedor: 'Aluminios del Norte',
  item: 'Ventanal fijo 3m × 2.4m',
  monto: 1280000,
  estado: 'fabricando',
  fecha: '03/06',
  estimado: '20/06'
}, {
  id: 'PED-025',
  op: 'OP-0133',
  proveedor: 'Vidrios Formosa',
  item: 'Frente vidriado oficina',
  monto: 2160000,
  estado: 'fabricando',
  fecha: '28/05',
  estimado: '25/06'
}, {
  id: 'PED-024',
  op: 'OP-0130',
  proveedor: 'Perfisa S.A.',
  item: 'Puerta corredera + 2 ventanas',
  monto: 728000,
  estado: 'recibido',
  fecha: '26/05',
  estimado: '05/06'
}, {
  id: 'PED-023',
  op: 'OP-0129',
  proveedor: 'Mosquiteros & Co.',
  item: 'Ventana balcón c/mosquitero',
  monto: 272000,
  estado: 'atrasado',
  fecha: '20/05',
  estimado: '03/06'
}, {
  id: 'PED-022',
  op: 'OP-0128',
  proveedor: 'Vidrios Formosa',
  item: 'Mampara vidrio templado',
  monto: 136000,
  estado: 'recibido',
  fecha: '28/05',
  estimado: '06/06'
}];
const ESTADO_PED = {
  recibido: {
    tone: 'emerald',
    label: 'Recibido'
  },
  en_transito: {
    tone: 'blue',
    label: 'En tránsito'
  },
  fabricando: {
    tone: 'amber',
    label: 'Fabricando'
  },
  atrasado: {
    tone: 'red',
    label: 'Atrasado'
  }
};
function Pedidos() {
  const [query, setQuery] = React.useState('');
  const filtered = PEDIDOS_DATA.filter(p => query === '' || p.proveedor.toLowerCase().includes(query.toLowerCase()) || p.id.includes(query.toUpperCase()));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "pedidos",
    icon: "ShoppingCart",
    breadcrumb: ['Comercial', 'Pedidos'],
    title: "Pedidos",
    sub: "\xD3rdenes de compra a proveedores y su estado de fabricaci\xF3n",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Nuevo pedido")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: String(PEDIDOS_DATA.filter(p => p.estado === 'fabricando').length),
      label: 'en fabricación',
      color: '#fbbf24'
    }, {
      value: String(PEDIDOS_DATA.filter(p => p.estado === 'en_transito').length),
      label: 'en tránsito',
      color: '#60a5fa'
    }, {
      value: String(PEDIDOS_DATA.filter(p => p.estado === 'atrasado').length),
      label: 'atrasados ⚠',
      color: '#fb7185'
    }, {
      value: formatCurrency(PEDIDOS_DATA.filter(p => p.estado !== 'recibido').reduce((s, p) => s + p.monto, 0)),
      label: 'comprometido',
      color: '#a3e635'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Search",
    size: 14
  })), /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: "Buscar pedido o proveedor\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    style: {
      paddingLeft: 32
    }
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb'
    }
  }, ['Pedido', 'Op.', 'Proveedor', 'Material', 'Monto', 'Pedido', 'Estimado', 'Estado', ''].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      padding: '10px 14px',
      fontSize: 10,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      textAlign: 'left'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(p => {
    const es = ESTADO_PED[p.estado] || {
      tone: 'gray',
      label: p.estado
    };
    return /*#__PURE__*/React.createElement("tr", {
      key: p.id,
      style: {
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
        transition: 'background 150ms',
        borderLeft: p.estado === 'atrasado' ? '4px solid #ef4444' : p.estado === 'fabricando' ? '4px solid #fbbf24' : '4px solid #34d399'
      },
      onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
      onMouseLeave: e => e.currentTarget.style.background = '#fff'
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono"
    }, p.id)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 11,
        color: '#9ca3af'
      }
    }, p.op)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        fontWeight: 600,
        color: '#1f2937'
      }
    }, p.proveedor), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#6b7280',
        fontSize: 12,
        maxWidth: 130,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, p.item), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "money",
      style: {
        fontSize: 13
      }
    }, formatCurrency(p.monto))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#9ca3af',
        fontSize: 12
      }
    }, p.fecha), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#4b5563',
        fontSize: 12
      }
    }, p.estimado), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      tone: es.tone
    }, es.label)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 14,
      color: "#9ca3af"
    })));
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "lime",
    title: "Acciones r\xE1pidas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, [{
    icon: 'Plus',
    label: 'Nuevo pedido',
    bg: '#4d7c0f',
    fg: '#fff'
  }, {
    icon: 'CheckCircle2',
    label: 'Marcar recibido',
    bg: '#ecfccb',
    fg: '#4d7c0f'
  }, {
    icon: 'Phone',
    label: 'Contactar proveedor',
    bg: '#dbeafe',
    fg: '#1d4ed8'
  }, {
    icon: 'Filter',
    label: 'Exportar pedidos',
    bg: '#f3f4f6',
    fg: '#4b5563'
  }].map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    className: "qa-btn",
    style: {
      background: a.bg,
      color: a.fg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 13
  }), a.label)))), /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "AlertTriangle",
    iconTone: "amber",
    title: "Alertas de demora"
  }), PEDIDOS_DATA.filter(p => p.estado === 'atrasado' || p.estado === 'fabricando').map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      padding: '8px 0',
      borderBottom: '1px solid #f3f4f6'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 600,
      color: '#1f2937'
    },
    className: "truncate"
  }, p.proveedor), /*#__PURE__*/React.createElement(Pill, {
    tone: p.estado === 'atrasado' ? 'red' : 'amber',
    style: {
      fontSize: 9,
      flexShrink: 0,
      marginLeft: 6
    }
  }, p.estado === 'atrasado' ? 'Atrasado' : 'Fabricando')), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 10,
      color: '#9ca3af'
    }
  }, "Est. ", p.estimado, " \xB7 ", p.op))))))));
}
window.Pedidos = Pedidos;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Pedidos.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/PedidosV2.jsx
try { (() => {
/* Pedidos — órdenes a proveedores + columna lateral */

const PEDIDOS_DATA = [{
  id: 'PED-028',
  op: 'OP-0140',
  proveedor: 'Aluminios del Norte',
  item: 'Ventana corrediza PVC 1.50×1.10',
  monto: 625000,
  estado: 'recibido',
  fecha: '28/05',
  estimado: '04/06'
}, {
  id: 'PED-027',
  op: 'OP-0138',
  proveedor: 'Perfisa S.A.',
  item: 'Puerta aluminio negro',
  monto: 190000,
  estado: 'en_transito',
  fecha: '01/06',
  estimado: '08/06'
}, {
  id: 'PED-026',
  op: 'OP-0135',
  proveedor: 'Aluminios del Norte',
  item: 'Ventanal fijo 3m × 2.4m',
  monto: 1280000,
  estado: 'fabricando',
  fecha: '03/06',
  estimado: '20/06'
}, {
  id: 'PED-025',
  op: 'OP-0133',
  proveedor: 'Vidrios Formosa',
  item: 'Frente vidriado oficina',
  monto: 2160000,
  estado: 'fabricando',
  fecha: '28/05',
  estimado: '25/06'
}, {
  id: 'PED-024',
  op: 'OP-0130',
  proveedor: 'Perfisa S.A.',
  item: 'Puerta corredera + 2 ventanas',
  monto: 728000,
  estado: 'recibido',
  fecha: '26/05',
  estimado: '05/06'
}, {
  id: 'PED-023',
  op: 'OP-0129',
  proveedor: 'Mosquiteros & Co.',
  item: 'Ventana balcón c/mosquitero',
  monto: 272000,
  estado: 'atrasado',
  fecha: '20/05',
  estimado: '03/06'
}, {
  id: 'PED-022',
  op: 'OP-0128',
  proveedor: 'Vidrios Formosa',
  item: 'Mampara vidrio templado',
  monto: 136000,
  estado: 'recibido',
  fecha: '28/05',
  estimado: '06/06'
}];
const ESTADO_PED = {
  recibido: {
    tone: 'emerald',
    label: 'Recibido'
  },
  en_transito: {
    tone: 'blue',
    label: 'En tránsito'
  },
  fabricando: {
    tone: 'amber',
    label: 'Fabricando'
  },
  atrasado: {
    tone: 'red',
    label: 'Atrasado'
  }
};
function Pedidos() {
  const [query, setQuery] = React.useState('');
  const filtered = PEDIDOS_DATA.filter(p => query === '' || p.proveedor.toLowerCase().includes(query.toLowerCase()) || p.id.includes(query.toUpperCase()));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "pedidos",
    icon: "ShoppingCart",
    breadcrumb: ['Comercial', 'Pedidos'],
    title: "Pedidos",
    sub: "\xD3rdenes de compra a proveedores y su estado de fabricaci\xF3n",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Nuevo pedido")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: String(PEDIDOS_DATA.filter(p => p.estado === 'fabricando').length),
      label: 'en fabricación',
      color: '#fbbf24'
    }, {
      value: String(PEDIDOS_DATA.filter(p => p.estado === 'en_transito').length),
      label: 'en tránsito',
      color: '#60a5fa'
    }, {
      value: String(PEDIDOS_DATA.filter(p => p.estado === 'atrasado').length),
      label: 'atrasados ⚠',
      color: '#fb7185'
    }, {
      value: formatCurrency(PEDIDOS_DATA.filter(p => p.estado !== 'recibido').reduce((s, p) => s + p.monto, 0)),
      label: 'comprometido',
      color: '#a3e635'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Search",
    size: 14
  })), /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: "Buscar pedido o proveedor\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    style: {
      paddingLeft: 32
    }
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb'
    }
  }, ['Pedido', 'Op.', 'Proveedor', 'Material', 'Monto', 'Pedido', 'Estimado', 'Estado', ''].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      padding: '10px 14px',
      fontSize: 10,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      textAlign: 'left'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(p => {
    const es = ESTADO_PED[p.estado] || {
      tone: 'gray',
      label: p.estado
    };
    return /*#__PURE__*/React.createElement("tr", {
      key: p.id,
      style: {
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
        transition: 'background 150ms',
        borderLeft: p.estado === 'atrasado' ? '4px solid #ef4444' : p.estado === 'fabricando' ? '4px solid #fbbf24' : '4px solid #34d399'
      },
      onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
      onMouseLeave: e => e.currentTarget.style.background = '#fff'
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono"
    }, p.id)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 11,
        color: '#9ca3af'
      }
    }, p.op)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        fontWeight: 600,
        color: '#1f2937'
      }
    }, p.proveedor), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#6b7280',
        fontSize: 12,
        maxWidth: 130,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, p.item), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "money",
      style: {
        fontSize: 13
      }
    }, formatCurrency(p.monto))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#9ca3af',
        fontSize: 12
      }
    }, p.fecha), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#4b5563',
        fontSize: 12
      }
    }, p.estimado), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      tone: es.tone
    }, es.label)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 14,
      color: "#9ca3af"
    })));
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "lime",
    title: "Acciones r\xE1pidas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, [{
    icon: 'Plus',
    label: 'Nuevo pedido',
    bg: '#4d7c0f',
    fg: '#fff'
  }, {
    icon: 'CheckCircle2',
    label: 'Marcar recibido',
    bg: '#ecfccb',
    fg: '#4d7c0f'
  }, {
    icon: 'Phone',
    label: 'Contactar proveedor',
    bg: '#dbeafe',
    fg: '#1d4ed8'
  }, {
    icon: 'Filter',
    label: 'Exportar pedidos',
    bg: '#f3f4f6',
    fg: '#4b5563'
  }].map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    className: "qa-btn",
    style: {
      background: a.bg,
      color: a.fg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 13
  }), a.label)))), /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "AlertTriangle",
    iconTone: "amber",
    title: "Alertas de demora"
  }), PEDIDOS_DATA.filter(p => p.estado === 'atrasado' || p.estado === 'fabricando').map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      padding: '8px 0',
      borderBottom: '1px solid #f3f4f6'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 600,
      color: '#1f2937'
    },
    className: "truncate"
  }, p.proveedor), /*#__PURE__*/React.createElement(Pill, {
    tone: p.estado === 'atrasado' ? 'red' : 'amber',
    style: {
      fontSize: 9,
      flexShrink: 0,
      marginLeft: 6
    }
  }, p.estado === 'atrasado' ? 'Atrasado' : 'Fabricando')), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 10,
      color: '#9ca3af'
    }
  }, "Est. ", p.estimado, " \xB7 ", p.op))))))));
}
window.Pedidos = Pedidos;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/PedidosV2.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Placeholder.jsx
try { (() => {
/* Placeholder — for sidebar items we don't fully implement.
   Uses the SectionHero so wayfinding stays consistent. */

function Placeholder({
  section,
  icon,
  title,
  sub,
  breadcrumb
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: section,
    icon: icon,
    breadcrumb: breadcrumb || ['Sistema', title],
    title: title,
    sub: sub
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner"
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 56,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 72,
      height: 72,
      borderRadius: 18,
      background: 'rgba(0,0,0,0.04)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 32,
    color: sectionDeep(section)
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 16,
      fontSize: 16,
      fontWeight: 800,
      color: '#1f2937'
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 6,
      fontSize: 13,
      color: '#6b7280',
      maxWidth: 480,
      margin: '6px auto 0',
      lineHeight: 1.5
    }
  }, "Esta secci\xF3n est\xE1 disponible en el sistema en producci\xF3n. El UI kit cubre los patrones principales en Dashboard, Operaciones y Presupuestos \u2014 todas las secciones comparten esta misma estructura visual: hero coloreado, banda de m\xE9tricas y zona operativa."))));
}
window.Placeholder = Placeholder;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Placeholder.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Presupuestos.jsx
try { (() => {
/* Presupuestos — métricas compactas + tabla PRINCIPAL + columna lateral */

const PRESUPUESTOS = [{
  id: 'PR-0042',
  cliente: 'Familia González',
  item: 'Ventana corrediza PVC 1.50×1.10',
  monto: 1250000,
  estado: 'aprobado',
  pago: 'pagado',
  fecha: '04/06',
  online: true,
  validez: '22/06'
}, {
  id: 'PR-0041',
  cliente: 'Mariela Ojeda',
  item: 'Puerta de entrada aluminio',
  monto: 480000,
  estado: 'aprobado',
  pago: 'señado',
  fecha: '03/06',
  online: true,
  validez: '21/06'
}, {
  id: 'PR-0040',
  cliente: 'Hugo Rodríguez',
  item: 'Mosquitero rebatible',
  monto: 95000,
  estado: 'enviado',
  pago: 'sin_pago',
  fecha: '02/06',
  online: false,
  validez: '20/06'
}, {
  id: 'PR-0039',
  cliente: 'Lorena Castro',
  item: 'Ventana balconera PVC',
  monto: 420000,
  estado: 'enviado',
  pago: 'sin_pago',
  fecha: '01/06',
  online: false,
  validez: '19/06'
}, {
  id: 'PR-0038',
  cliente: 'Estudio Britos & Asoc.',
  item: 'Ventanas balconeras (×3)',
  monto: 2150000,
  estado: 'enviado',
  pago: 'sin_pago',
  fecha: '31/05',
  online: false,
  validez: '18/06'
}, {
  id: 'PR-0037',
  cliente: 'Constructora del Norte',
  item: 'Ventanal fijo 3m × 2.4m',
  monto: 3200000,
  estado: 'en_produccion',
  pago: 'señado',
  fecha: '28/05',
  online: false,
  validez: '15/06'
}, {
  id: 'PR-0036',
  cliente: 'Daniel Mereles',
  item: 'Ventana hojas batientes',
  monto: 290000,
  estado: 'cancelado',
  pago: 'sin_pago',
  fecha: '27/05',
  online: false,
  validez: '14/06'
}, {
  id: 'PR-0035',
  cliente: 'Familia Britos',
  item: 'Puerta corredera + 2 ventanas',
  monto: 1820000,
  estado: 'listo',
  pago: 'pagado',
  fecha: '26/05',
  online: false,
  validez: '13/06'
}];
const SEGUIMIENTO_P = [{
  nombre: 'Lorena Castro',
  dias: 3,
  monto: 420000,
  motivo: 'PR-0039 sin respuesta',
  pref: 'whatsapp'
}, {
  nombre: 'Hugo Rodríguez',
  dias: 4,
  monto: 95000,
  motivo: 'PR-0040 sin respuesta',
  pref: 'whatsapp'
}, {
  nombre: 'Estudio Britos',
  dias: 6,
  monto: 2150000,
  motivo: 'Vence en 12 días',
  pref: 'email'
}, {
  nombre: 'Carlos Méndez',
  dias: 9,
  monto: 340000,
  motivo: 'No cotizó aún',
  pref: 'phone'
}];
function PresBadge({
  estado
}) {
  const m = {
    presupuesto: 'gray',
    enviado: 'bluish',
    aprobado: 'emerald',
    en_produccion: 'amber',
    listo: 'teal',
    entregado: 'bluish',
    cancelado: 'red'
  };
  const labels = {
    presupuesto: 'Borrador',
    enviado: 'Enviado',
    aprobado: 'Aprobado',
    en_produccion: 'En producción',
    listo: 'Listo',
    entregado: 'Entregado',
    cancelado: 'Cancelado'
  };
  return /*#__PURE__*/React.createElement(Pill, {
    tone: m[estado] || 'gray'
  }, labels[estado] || estado);
}
function PagoBadge({
  pago
}) {
  if (pago === 'pagado') return /*#__PURE__*/React.createElement(Pill, {
    tone: "emerald"
  }, "Pagado");
  if (pago === 'señado') return /*#__PURE__*/React.createElement(Pill, {
    tone: "amber"
  }, "Se\xF1ado");
  return /*#__PURE__*/React.createElement(Pill, {
    tone: "red"
  }, "Sin pago");
}
function Presupuestos({
  onOpen
}) {
  const [filter, setFilter] = React.useState('todos');
  const [query, setQuery] = React.useState('');
  const filtered = PRESUPUESTOS.filter(p => (filter === 'todos' || p.estado === filter) && (query === '' || p.cliente.toLowerCase().includes(query.toLowerCase()) || p.id.includes(query.toUpperCase())));
  const enviados = PRESUPUESTOS.filter(p => p.estado === 'enviado').length;
  const aprobados = PRESUPUESTOS.filter(p => p.estado === 'aprobado').length;
  const enTraMonto = PRESUPUESTOS.filter(p => p.estado === 'enviado').reduce((s, p) => s + p.monto, 0);
  const conv = Math.round(aprobados / PRESUPUESTOS.length * 100);
  const FILTROS = [{
    k: 'todos',
    l: 'Todos'
  }, {
    k: 'enviado',
    l: 'Enviados'
  }, {
    k: 'aprobado',
    l: 'Aprobados'
  }, {
    k: 'en_produccion',
    l: 'En producción'
  }, {
    k: 'listo',
    l: 'Listos'
  }, {
    k: 'cancelado',
    l: 'Cancelados'
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "presupuestos",
    icon: "FileText",
    breadcrumb: ['Comercial', 'Presupuestos'],
    title: "Presupuestos",
    sub: "Cotizaciones activas y su estado de cobranza",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Nuevo presupuesto")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: String(enviados),
      label: 'enviados · pendientes',
      color: '#a78bfa'
    }, {
      value: String(aprobados),
      label: 'aprobados este mes',
      color: '#34d399'
    }, {
      value: formatCurrency(enTraMonto),
      label: 'en trámite',
      color: '#60a5fa'
    }, {
      value: conv + '%',
      label: 'tasa de conversión',
      color: '#fbbf24'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3",
    style: {
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 180,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Search",
    size: 14
  })), /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: "Buscar cliente o n\xFAmero\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    style: {
      paddingLeft: 32
    }
  })), FILTROS.map(f => /*#__PURE__*/React.createElement("button", {
    key: f.k,
    onClick: () => setFilter(f.k),
    style: {
      padding: '6px 12px',
      borderRadius: 9999,
      fontSize: 12,
      fontWeight: 600,
      border: '1px solid ' + (filter === f.k ? '#6d28d9' : '#e5e7eb'),
      background: filter === f.k ? '#6d28d9' : '#fff',
      color: filter === f.k ? '#fff' : '#4b5563',
      transition: 'all 150ms'
    }
  }, f.l)))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb'
    }
  }, ['Número', 'Cliente', 'Ítem', 'Monto', 'Estado', 'Pago', 'Fecha', ''].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      textAlign: i === 3 ? 'right' : 'left',
      padding: '10px 14px',
      fontSize: 10,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.06em'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.id,
    style: {
      borderBottom: '1px solid #f3f4f6',
      cursor: 'pointer',
      background: p.online ? 'rgba(209,250,229,0.30)' : '#fff',
      borderLeft: p.online ? '4px solid #34d399' : '4px solid transparent',
      transition: 'background 150ms'
    },
    onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
    onMouseLeave: e => e.currentTarget.style.background = p.online ? 'rgba(209,250,229,0.30)' : '#fff'
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, p.id)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontWeight: 600,
      color: '#1f2937'
    }
  }, p.cliente), p.online && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 10,
      color: '#047857',
      fontWeight: 700
    }
  }, "\u2713 Aprobado online")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle',
      color: '#6b7280',
      fontSize: 12,
      maxWidth: 150,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, p.item), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle',
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "money"
  }, formatCurrency(p.monto))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement(PresBadge, {
    estado: p.estado
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement(PagoBadge, {
    pago: p.pago
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle',
      color: '#9ca3af',
      fontSize: 12
    }
  }, p.fecha), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "ChevronRight",
    size: 14,
    color: "#9ca3af"
  })))))), filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: '#9ca3af'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "FileText",
    size: 32,
    color: "#d1d5db"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 8,
      fontSize: 12
    }
  }, "Sin presupuestos con esos filtros.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "violet",
    title: "Acciones r\xE1pidas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, [{
    icon: 'Plus',
    label: 'Nuevo presupuesto',
    bg: '#6d28d9',
    fg: '#fff'
  }, {
    icon: 'AlertTriangle',
    label: 'Ver vencidos',
    bg: '#fef3c7',
    fg: '#b45309'
  }, {
    icon: 'Share2',
    label: 'Compartir por WhatsApp',
    bg: '#d1fae5',
    fg: '#047857'
  }, {
    icon: 'Filter',
    label: 'Exportar listado',
    bg: '#dbeafe',
    fg: '#1d4ed8'
  }].map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    className: "qa-btn",
    style: {
      background: a.bg,
      color: a.fg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 13
  }), a.label)))), /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Phone",
    iconTone: "blue",
    title: "Seguimiento sugerido hoy"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, SEGUIMIENTO_P.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '8px 10px',
      borderRadius: 10,
      borderLeft: `3px solid ${c.dias > 7 ? '#ef4444' : c.dias > 4 ? '#f59e0b' : '#10b981'}`,
      background: c.dias > 7 ? '#fef2f2' : c.dias > 4 ? '#fffbeb' : '#f0fdf4'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2",
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(IconTile, {
    name: c.pref === 'email' ? 'Mail' : c.pref === 'phone' ? 'Phone' : 'MessageCircle',
    tone: c.pref === 'email' ? 'blue' : c.pref === 'phone' ? 'violet' : 'emerald',
    size: "sm"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 700,
      color: '#1f2937',
      flex: 1
    },
    className: "truncate"
  }, c.nombre), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: c.dias > 7 ? '#b91c1c' : '#6b7280'
    }
  }, "Hace ", c.dias, "d")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 11,
      color: '#6b7280'
    },
    className: "truncate"
  }, c.motivo), /*#__PURE__*/React.createElement("button", {
    style: {
      padding: '4px 8px',
      borderRadius: 7,
      fontSize: 10,
      fontWeight: 700,
      background: c.pref === 'whatsapp' ? '#22c55e' : c.pref === 'email' ? '#6d28d9' : '#3b82f6',
      color: '#fff',
      marginLeft: 6,
      flexShrink: 0
    }
  }, "Contactar"))))))))));
}
window.Presupuestos = Presupuestos;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Presupuestos.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/PresupuestosV2.jsx
try { (() => {
/* Presupuestos — métricas compactas + tabla PRINCIPAL + columna lateral */

const PRESUPUESTOS = [{
  id: 'PR-0042',
  cliente: 'Familia González',
  item: 'Ventana corrediza PVC 1.50×1.10',
  monto: 1250000,
  estado: 'aprobado',
  pago: 'pagado',
  fecha: '04/06',
  online: true,
  validez: '22/06'
}, {
  id: 'PR-0041',
  cliente: 'Mariela Ojeda',
  item: 'Puerta de entrada aluminio',
  monto: 480000,
  estado: 'aprobado',
  pago: 'señado',
  fecha: '03/06',
  online: true,
  validez: '21/06'
}, {
  id: 'PR-0040',
  cliente: 'Hugo Rodríguez',
  item: 'Mosquitero rebatible',
  monto: 95000,
  estado: 'enviado',
  pago: 'sin_pago',
  fecha: '02/06',
  online: false,
  validez: '20/06'
}, {
  id: 'PR-0039',
  cliente: 'Lorena Castro',
  item: 'Ventana balconera PVC',
  monto: 420000,
  estado: 'enviado',
  pago: 'sin_pago',
  fecha: '01/06',
  online: false,
  validez: '19/06'
}, {
  id: 'PR-0038',
  cliente: 'Estudio Britos & Asoc.',
  item: 'Ventanas balconeras (×3)',
  monto: 2150000,
  estado: 'enviado',
  pago: 'sin_pago',
  fecha: '31/05',
  online: false,
  validez: '18/06'
}, {
  id: 'PR-0037',
  cliente: 'Constructora del Norte',
  item: 'Ventanal fijo 3m × 2.4m',
  monto: 3200000,
  estado: 'en_produccion',
  pago: 'señado',
  fecha: '28/05',
  online: false,
  validez: '15/06'
}, {
  id: 'PR-0036',
  cliente: 'Daniel Mereles',
  item: 'Ventana hojas batientes',
  monto: 290000,
  estado: 'cancelado',
  pago: 'sin_pago',
  fecha: '27/05',
  online: false,
  validez: '14/06'
}, {
  id: 'PR-0035',
  cliente: 'Familia Britos',
  item: 'Puerta corredera + 2 ventanas',
  monto: 1820000,
  estado: 'listo',
  pago: 'pagado',
  fecha: '26/05',
  online: false,
  validez: '13/06'
}];
const SEGUIMIENTO_P = [{
  nombre: 'Lorena Castro',
  dias: 3,
  monto: 420000,
  motivo: 'PR-0039 sin respuesta',
  pref: 'whatsapp'
}, {
  nombre: 'Hugo Rodríguez',
  dias: 4,
  monto: 95000,
  motivo: 'PR-0040 sin respuesta',
  pref: 'whatsapp'
}, {
  nombre: 'Estudio Britos',
  dias: 6,
  monto: 2150000,
  motivo: 'Vence en 12 días',
  pref: 'email'
}, {
  nombre: 'Carlos Méndez',
  dias: 9,
  monto: 340000,
  motivo: 'No cotizó aún',
  pref: 'phone'
}];
function PresBadge({
  estado
}) {
  const m = {
    presupuesto: 'gray',
    enviado: 'bluish',
    aprobado: 'emerald',
    en_produccion: 'amber',
    listo: 'teal',
    entregado: 'bluish',
    cancelado: 'red'
  };
  const labels = {
    presupuesto: 'Borrador',
    enviado: 'Enviado',
    aprobado: 'Aprobado',
    en_produccion: 'En producción',
    listo: 'Listo',
    entregado: 'Entregado',
    cancelado: 'Cancelado'
  };
  return /*#__PURE__*/React.createElement(Pill, {
    tone: m[estado] || 'gray'
  }, labels[estado] || estado);
}
function PagoBadge({
  pago
}) {
  if (pago === 'pagado') return /*#__PURE__*/React.createElement(Pill, {
    tone: "emerald"
  }, "Pagado");
  if (pago === 'señado') return /*#__PURE__*/React.createElement(Pill, {
    tone: "amber"
  }, "Se\xF1ado");
  return /*#__PURE__*/React.createElement(Pill, {
    tone: "red"
  }, "Sin pago");
}
function Presupuestos({
  onOpen
}) {
  const [filter, setFilter] = React.useState('todos');
  const [query, setQuery] = React.useState('');
  const filtered = PRESUPUESTOS.filter(p => (filter === 'todos' || p.estado === filter) && (query === '' || p.cliente.toLowerCase().includes(query.toLowerCase()) || p.id.includes(query.toUpperCase())));
  const enviados = PRESUPUESTOS.filter(p => p.estado === 'enviado').length;
  const aprobados = PRESUPUESTOS.filter(p => p.estado === 'aprobado').length;
  const enTraMonto = PRESUPUESTOS.filter(p => p.estado === 'enviado').reduce((s, p) => s + p.monto, 0);
  const conv = Math.round(aprobados / PRESUPUESTOS.length * 100);
  const FILTROS = [{
    k: 'todos',
    l: 'Todos'
  }, {
    k: 'enviado',
    l: 'Enviados'
  }, {
    k: 'aprobado',
    l: 'Aprobados'
  }, {
    k: 'en_produccion',
    l: 'En producción'
  }, {
    k: 'listo',
    l: 'Listos'
  }, {
    k: 'cancelado',
    l: 'Cancelados'
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "presupuestos",
    icon: "FileText",
    breadcrumb: ['Comercial', 'Presupuestos'],
    title: "Presupuestos",
    sub: "Cotizaciones activas y su estado de cobranza",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Nuevo presupuesto")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: String(enviados),
      label: 'enviados · pendientes',
      color: '#a78bfa'
    }, {
      value: String(aprobados),
      label: 'aprobados este mes',
      color: '#34d399'
    }, {
      value: formatCurrency(enTraMonto),
      label: 'en trámite',
      color: '#60a5fa'
    }, {
      value: conv + '%',
      label: 'tasa de conversión',
      color: '#fbbf24'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3",
    style: {
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 180,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Search",
    size: 14
  })), /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: "Buscar cliente o n\xFAmero\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    style: {
      paddingLeft: 32
    }
  })), FILTROS.map(f => /*#__PURE__*/React.createElement("button", {
    key: f.k,
    onClick: () => setFilter(f.k),
    style: {
      padding: '6px 12px',
      borderRadius: 9999,
      fontSize: 12,
      fontWeight: 600,
      border: '1px solid ' + (filter === f.k ? '#6d28d9' : '#e5e7eb'),
      background: filter === f.k ? '#6d28d9' : '#fff',
      color: filter === f.k ? '#fff' : '#4b5563',
      transition: 'all 150ms'
    }
  }, f.l)))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb'
    }
  }, ['Número', 'Cliente', 'Ítem', 'Monto', 'Estado', 'Pago', 'Fecha', ''].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      textAlign: i === 3 ? 'right' : 'left',
      padding: '10px 14px',
      fontSize: 10,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.06em'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.id,
    style: {
      borderBottom: '1px solid #f3f4f6',
      cursor: 'pointer',
      background: p.online ? 'rgba(209,250,229,0.30)' : '#fff',
      borderLeft: p.online ? '4px solid #34d399' : '4px solid transparent',
      transition: 'background 150ms'
    },
    onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
    onMouseLeave: e => e.currentTarget.style.background = p.online ? 'rgba(209,250,229,0.30)' : '#fff'
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, p.id)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontWeight: 600,
      color: '#1f2937'
    }
  }, p.cliente), p.online && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 10,
      color: '#047857',
      fontWeight: 700
    }
  }, "\u2713 Aprobado online")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle',
      color: '#6b7280',
      fontSize: 12,
      maxWidth: 150,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, p.item), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle',
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "money"
  }, formatCurrency(p.monto))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement(PresBadge, {
    estado: p.estado
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement(PagoBadge, {
    pago: p.pago
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle',
      color: '#9ca3af',
      fontSize: 12
    }
  }, p.fecha), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '11px 14px',
      verticalAlign: 'middle'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "ChevronRight",
    size: 14,
    color: "#9ca3af"
  })))))), filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: '#9ca3af'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "FileText",
    size: 32,
    color: "#d1d5db"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 8,
      fontSize: 12
    }
  }, "Sin presupuestos con esos filtros.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "violet",
    title: "Acciones r\xE1pidas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, [{
    icon: 'Plus',
    label: 'Nuevo presupuesto',
    bg: '#6d28d9',
    fg: '#fff'
  }, {
    icon: 'AlertTriangle',
    label: 'Ver vencidos',
    bg: '#fef3c7',
    fg: '#b45309'
  }, {
    icon: 'Share2',
    label: 'Compartir por WhatsApp',
    bg: '#d1fae5',
    fg: '#047857'
  }, {
    icon: 'Filter',
    label: 'Exportar listado',
    bg: '#dbeafe',
    fg: '#1d4ed8'
  }].map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    className: "qa-btn",
    style: {
      background: a.bg,
      color: a.fg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 13
  }), a.label)))), /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Phone",
    iconTone: "blue",
    title: "Seguimiento sugerido hoy"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, SEGUIMIENTO_P.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '8px 10px',
      borderRadius: 10,
      borderLeft: `3px solid ${c.dias > 7 ? '#ef4444' : c.dias > 4 ? '#f59e0b' : '#10b981'}`,
      background: c.dias > 7 ? '#fef2f2' : c.dias > 4 ? '#fffbeb' : '#f0fdf4'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2",
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(IconTile, {
    name: c.pref === 'email' ? 'Mail' : c.pref === 'phone' ? 'Phone' : 'MessageCircle',
    tone: c.pref === 'email' ? 'blue' : c.pref === 'phone' ? 'violet' : 'emerald',
    size: "sm"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 700,
      color: '#1f2937',
      flex: 1
    },
    className: "truncate"
  }, c.nombre), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: c.dias > 7 ? '#b91c1c' : '#6b7280'
    }
  }, "Hace ", c.dias, "d")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 11,
      color: '#6b7280'
    },
    className: "truncate"
  }, c.motivo), /*#__PURE__*/React.createElement("button", {
    style: {
      padding: '4px 8px',
      borderRadius: 7,
      fontSize: 10,
      fontWeight: 700,
      background: c.pref === 'whatsapp' ? '#22c55e' : c.pref === 'email' ? '#6d28d9' : '#3b82f6',
      color: '#fff',
      marginLeft: 6,
      flexShrink: 0
    }
  }, "Contactar"))))))))));
}
window.Presupuestos = Presupuestos;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/PresupuestosV2.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Recibos.jsx
try { (() => {
/* Recibos — cobros y compromisos de pago + columna lateral */

const RECIBOS_DATA = [{
  id: 'REC-056',
  cliente: 'Familia González',
  concepto: 'Saldo OP-0140',
  monto: 1250000,
  forma: 'Transferencia',
  fecha: '04/06',
  estado: 'cobrado'
}, {
  id: 'REC-055',
  cliente: 'Edificio Las Tipas',
  concepto: 'Saldo OP-0120',
  monto: 1600000,
  forma: 'Cheque',
  fecha: '03/06',
  estado: 'cobrado'
}, {
  id: 'REC-054',
  cliente: 'Mariela Ojeda',
  concepto: 'Seña OP-0138 (50%)',
  monto: 240000,
  forma: 'Transferencia',
  fecha: '02/06',
  estado: 'cobrado'
}, {
  id: 'REC-053',
  cliente: 'Constructora del Norte',
  concepto: 'Seña OP-0135 (50%)',
  monto: 1600000,
  forma: 'Cheque 30d',
  fecha: '01/06',
  estado: 'pendiente'
}, {
  id: 'REC-052',
  cliente: 'Familia Britos',
  concepto: 'Saldo OP-0130',
  monto: 1820000,
  forma: 'Transferencia',
  fecha: '31/05',
  estado: 'cobrado'
}, {
  id: 'REC-051',
  cliente: 'Ramírez S.A.',
  concepto: 'Anticipo OP-0133',
  monto: 2700000,
  forma: 'Cheque 60d',
  fecha: '28/05',
  estado: 'pendiente'
}, {
  id: 'REC-050',
  cliente: 'Familia Acuña',
  concepto: 'Saldo OP-0118',
  monto: 725000,
  forma: 'Efectivo',
  fecha: '25/05',
  estado: 'cobrado'
}, {
  id: 'REC-049',
  cliente: 'Hugo Rodríguez',
  concepto: 'Anticipo PR-0040',
  monto: 47500,
  forma: 'Transferencia',
  fecha: '24/05',
  estado: 'vencido'
}];
function Recibos() {
  const [query, setQuery] = React.useState('');
  const filtered = RECIBOS_DATA.filter(r => query === '' || r.cliente.toLowerCase().includes(query.toLowerCase()) || r.id.includes(query.toUpperCase()));
  const cobradoMes = RECIBOS_DATA.filter(r => r.estado === 'cobrado').reduce((s, r) => s + r.monto, 0);
  const pendiente = RECIBOS_DATA.filter(r => r.estado === 'pendiente').reduce((s, r) => s + r.monto, 0);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "recibos",
    icon: "Receipt",
    breadcrumb: ['Comercial', 'Recibos'],
    title: "Recibos",
    sub: "Cobros realizados y compromisos de pago",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Registrar cobro")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: formatCurrency(cobradoMes),
      label: 'cobrado este mes',
      color: '#34d399'
    }, {
      value: formatCurrency(pendiente),
      label: 'pendiente cobro',
      color: '#fbbf24'
    }, {
      value: String(RECIBOS_DATA.filter(r => r.estado === 'vencido').length),
      label: 'cheques vencidos',
      color: '#fb7185'
    }, {
      value: String(RECIBOS_DATA.filter(r => r.estado === 'cobrado').length),
      label: 'recibos emitidos',
      color: '#60a5fa'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Search",
    size: 14
  })), /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: "Buscar recibo o cliente\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    style: {
      paddingLeft: 32
    }
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb'
    }
  }, ['Número', 'Cliente', 'Concepto', 'Monto', 'Forma de pago', 'Fecha', 'Estado', ''].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      padding: '10px 14px',
      fontSize: 10,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      textAlign: i === 3 ? 'right' : 'left'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(r => {
    const tone = {
      cobrado: 'emerald',
      pendiente: 'amber',
      vencido: 'red'
    }[r.estado] || 'gray';
    return /*#__PURE__*/React.createElement("tr", {
      key: r.id,
      style: {
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
        transition: 'background 150ms',
        borderLeft: r.estado === 'vencido' ? '4px solid #ef4444' : r.estado === 'pendiente' ? '4px solid #f59e0b' : '4px solid #34d399'
      },
      onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
      onMouseLeave: e => e.currentTarget.style.background = '#fff'
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono"
    }, r.id)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        fontWeight: 600,
        color: '#1f2937'
      }
    }, r.cliente), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#6b7280',
        fontSize: 12
      }
    }, r.concepto), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "money"
    }, formatCurrency(r.monto))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#4b5563',
        fontSize: 12
      }
    }, r.forma), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#9ca3af',
        fontSize: 12
      }
    }, r.fecha), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      tone: tone
    }, r.estado.charAt(0).toUpperCase() + r.estado.slice(1))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 14,
      color: "#9ca3af"
    })));
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "emerald",
    title: "Acciones r\xE1pidas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, [{
    icon: 'Plus',
    label: 'Registrar cobro',
    bg: '#047857',
    fg: '#fff'
  }, {
    icon: 'DollarSign',
    label: 'Cobrar saldo',
    bg: '#d1fae5',
    fg: '#047857'
  }, {
    icon: 'Filter',
    label: 'Exportar recibos',
    bg: '#dbeafe',
    fg: '#1d4ed8'
  }, {
    icon: 'AlertTriangle',
    label: 'Ver cheques vencidos',
    bg: '#fee2e2',
    fg: '#b91c1c'
  }].map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    className: "qa-btn",
    style: {
      background: a.bg,
      color: a.fg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 13
  }), a.label)))), /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Clock",
    iconTone: "amber",
    title: "Cobros pendientes"
  }), RECIBOS_DATA.filter(r => r.estado !== 'cobrado').map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    style: {
      padding: '8px 0',
      borderBottom: '1px solid #f3f4f6'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 600,
      color: '#1f2937'
    },
    className: "truncate"
  }, r.cliente), /*#__PURE__*/React.createElement("span", {
    className: "money",
    style: {
      fontSize: 12,
      color: r.estado === 'vencido' ? '#b91c1c' : '#b45309',
      flexShrink: 0,
      marginLeft: 8
    }
  }, formatCurrency(r.monto))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between",
    style: {
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 10,
      color: '#9ca3af'
    }
  }, r.forma, " \xB7 ", r.fecha), /*#__PURE__*/React.createElement(Pill, {
    tone: r.estado === 'vencido' ? 'red' : 'amber',
    style: {
      fontSize: 9
    }
  }, r.estado)))))))));
}
window.Recibos = Recibos;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Recibos.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/RecibosV2.jsx
try { (() => {
/* Recibos — cobros y compromisos de pago + columna lateral */

const RECIBOS_DATA = [{
  id: 'REC-056',
  cliente: 'Familia González',
  concepto: 'Saldo OP-0140',
  monto: 1250000,
  forma: 'Transferencia',
  fecha: '04/06',
  estado: 'cobrado'
}, {
  id: 'REC-055',
  cliente: 'Edificio Las Tipas',
  concepto: 'Saldo OP-0120',
  monto: 1600000,
  forma: 'Cheque',
  fecha: '03/06',
  estado: 'cobrado'
}, {
  id: 'REC-054',
  cliente: 'Mariela Ojeda',
  concepto: 'Seña OP-0138 (50%)',
  monto: 240000,
  forma: 'Transferencia',
  fecha: '02/06',
  estado: 'cobrado'
}, {
  id: 'REC-053',
  cliente: 'Constructora del Norte',
  concepto: 'Seña OP-0135 (50%)',
  monto: 1600000,
  forma: 'Cheque 30d',
  fecha: '01/06',
  estado: 'pendiente'
}, {
  id: 'REC-052',
  cliente: 'Familia Britos',
  concepto: 'Saldo OP-0130',
  monto: 1820000,
  forma: 'Transferencia',
  fecha: '31/05',
  estado: 'cobrado'
}, {
  id: 'REC-051',
  cliente: 'Ramírez S.A.',
  concepto: 'Anticipo OP-0133',
  monto: 2700000,
  forma: 'Cheque 60d',
  fecha: '28/05',
  estado: 'pendiente'
}, {
  id: 'REC-050',
  cliente: 'Familia Acuña',
  concepto: 'Saldo OP-0118',
  monto: 725000,
  forma: 'Efectivo',
  fecha: '25/05',
  estado: 'cobrado'
}, {
  id: 'REC-049',
  cliente: 'Hugo Rodríguez',
  concepto: 'Anticipo PR-0040',
  monto: 47500,
  forma: 'Transferencia',
  fecha: '24/05',
  estado: 'vencido'
}];
function Recibos() {
  const [query, setQuery] = React.useState('');
  const filtered = RECIBOS_DATA.filter(r => query === '' || r.cliente.toLowerCase().includes(query.toLowerCase()) || r.id.includes(query.toUpperCase()));
  const cobradoMes = RECIBOS_DATA.filter(r => r.estado === 'cobrado').reduce((s, r) => s + r.monto, 0);
  const pendiente = RECIBOS_DATA.filter(r => r.estado === 'pendiente').reduce((s, r) => s + r.monto, 0);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "recibos",
    icon: "Receipt",
    breadcrumb: ['Comercial', 'Recibos'],
    title: "Recibos",
    sub: "Cobros realizados y compromisos de pago",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Registrar cobro")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: formatCurrency(cobradoMes),
      label: 'cobrado este mes',
      color: '#34d399'
    }, {
      value: formatCurrency(pendiente),
      label: 'pendiente cobro',
      color: '#fbbf24'
    }, {
      value: String(RECIBOS_DATA.filter(r => r.estado === 'vencido').length),
      label: 'cheques vencidos',
      color: '#fb7185'
    }, {
      value: String(RECIBOS_DATA.filter(r => r.estado === 'cobrado').length),
      label: 'recibos emitidos',
      color: '#60a5fa'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Search",
    size: 14
  })), /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: "Buscar recibo o cliente\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    style: {
      paddingLeft: 32
    }
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb'
    }
  }, ['Número', 'Cliente', 'Concepto', 'Monto', 'Forma de pago', 'Fecha', 'Estado', ''].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      padding: '10px 14px',
      fontSize: 10,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      textAlign: i === 3 ? 'right' : 'left'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(r => {
    const tone = {
      cobrado: 'emerald',
      pendiente: 'amber',
      vencido: 'red'
    }[r.estado] || 'gray';
    return /*#__PURE__*/React.createElement("tr", {
      key: r.id,
      style: {
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
        transition: 'background 150ms',
        borderLeft: r.estado === 'vencido' ? '4px solid #ef4444' : r.estado === 'pendiente' ? '4px solid #f59e0b' : '4px solid #34d399'
      },
      onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
      onMouseLeave: e => e.currentTarget.style.background = '#fff'
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono"
    }, r.id)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        fontWeight: 600,
        color: '#1f2937'
      }
    }, r.cliente), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#6b7280',
        fontSize: 12
      }
    }, r.concepto), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "money"
    }, formatCurrency(r.monto))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#4b5563',
        fontSize: 12
      }
    }, r.forma), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#9ca3af',
        fontSize: 12
      }
    }, r.fecha), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      tone: tone
    }, r.estado.charAt(0).toUpperCase() + r.estado.slice(1))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 14,
      color: "#9ca3af"
    })));
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "emerald",
    title: "Acciones r\xE1pidas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, [{
    icon: 'Plus',
    label: 'Registrar cobro',
    bg: '#047857',
    fg: '#fff'
  }, {
    icon: 'DollarSign',
    label: 'Cobrar saldo',
    bg: '#d1fae5',
    fg: '#047857'
  }, {
    icon: 'Filter',
    label: 'Exportar recibos',
    bg: '#dbeafe',
    fg: '#1d4ed8'
  }, {
    icon: 'AlertTriangle',
    label: 'Ver cheques vencidos',
    bg: '#fee2e2',
    fg: '#b91c1c'
  }].map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    className: "qa-btn",
    style: {
      background: a.bg,
      color: a.fg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 13
  }), a.label)))), /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Clock",
    iconTone: "amber",
    title: "Cobros pendientes"
  }), RECIBOS_DATA.filter(r => r.estado !== 'cobrado').map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    style: {
      padding: '8px 0',
      borderBottom: '1px solid #f3f4f6'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 600,
      color: '#1f2937'
    },
    className: "truncate"
  }, r.cliente), /*#__PURE__*/React.createElement("span", {
    className: "money",
    style: {
      fontSize: 12,
      color: r.estado === 'vencido' ? '#b91c1c' : '#b45309',
      flexShrink: 0,
      marginLeft: 8
    }
  }, formatCurrency(r.monto))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between",
    style: {
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 10,
      color: '#9ca3af'
    }
  }, r.forma, " \xB7 ", r.fecha), /*#__PURE__*/React.createElement(Pill, {
    tone: r.estado === 'vencido' ? 'red' : 'amber',
    style: {
      fontSize: 9
    }
  }, r.estado)))))))));
}
window.Recibos = Recibos;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/RecibosV2.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Remitos.jsx
try { (() => {
/* Remitos — notas de entrega + columna lateral */

const REMITOS_DATA = [{
  id: 'REM-042',
  op: 'OP-0140',
  cliente: 'Familia González',
  item: 'Ventana corrediza PVC 1.50×1.10',
  fecha: '06/06',
  estado: 'pendiente',
  chofer: 'Juan P.',
  monto: 1250000
}, {
  id: 'REM-041',
  op: 'OP-0130',
  cliente: 'Familia Britos',
  item: 'Puerta corredera + 2 ventanas',
  fecha: '06/06',
  estado: 'pendiente',
  chofer: 'Juan P.',
  monto: 1820000
}, {
  id: 'REM-040',
  op: 'OP-0129',
  cliente: 'Pablo Sánchez',
  item: 'Ventana corrediza balcón',
  fecha: '07/06',
  estado: 'programado',
  chofer: 'Mario G.',
  monto: 680000
}, {
  id: 'REM-039',
  op: 'OP-0128',
  cliente: 'Andrea Méndez',
  item: 'Mampara de baño 80×190',
  fecha: '07/06',
  estado: 'programado',
  chofer: 'Mario G.',
  monto: 340000
}, {
  id: 'REM-038',
  op: 'OP-0120',
  cliente: 'Edificio Las Tipas',
  item: 'Ventanas piso 3 (×6)',
  fecha: '01/06',
  estado: 'entregado',
  chofer: 'Juan P.',
  monto: 4900000
}, {
  id: 'REM-037',
  op: 'OP-0118',
  cliente: 'Familia Acuña',
  item: 'Puerta principal + lateral',
  fecha: '30/05',
  estado: 'entregado',
  chofer: 'Rubén H.',
  monto: 1450000
}, {
  id: 'REM-036',
  op: 'OP-0115',
  cliente: 'Constructora del Norte',
  item: 'Ventanal fijo — avance',
  fecha: '25/05',
  estado: 'entregado',
  chofer: 'Rubén H.',
  monto: 1600000
}];
const ESTADO_REM = {
  pendiente: {
    tone: 'amber',
    label: 'Pendiente'
  },
  programado: {
    tone: 'blue',
    label: 'Programado'
  },
  entregado: {
    tone: 'emerald',
    label: 'Entregado'
  }
};
function Remitos() {
  const [query, setQuery] = React.useState('');
  const filtered = REMITOS_DATA.filter(r => query === '' || r.cliente.toLowerCase().includes(query.toLowerCase()) || r.id.includes(query.toUpperCase()));
  const hoy = REMITOS_DATA.filter(r => r.estado !== 'entregado').length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "remitos",
    icon: "Truck",
    breadcrumb: ['Comercial', 'Remitos'],
    title: "Remitos",
    sub: "Notas de entrega e historial de despacho",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Nuevo remito")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: String(REMITOS_DATA.filter(r => r.estado === 'pendiente').length),
      label: 'pendientes hoy',
      color: '#fbbf24'
    }, {
      value: String(REMITOS_DATA.filter(r => r.estado === 'programado').length),
      label: 'programados',
      color: '#60a5fa'
    }, {
      value: String(REMITOS_DATA.filter(r => r.estado === 'entregado').length),
      label: 'entregados (mes)',
      color: '#34d399'
    }, {
      value: formatCurrency(REMITOS_DATA.filter(r => r.estado !== 'entregado').reduce((s, r) => s + r.monto, 0)),
      label: 'en tránsito',
      color: '#2dd4bf'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Search",
    size: 14
  })), /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: "Buscar remito o cliente\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    style: {
      paddingLeft: 32
    }
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb'
    }
  }, ['Remito', 'Op.', 'Cliente', 'Material', 'Fecha', 'Chofer', 'Monto', 'Estado', ''].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      padding: '10px 14px',
      fontSize: 10,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      textAlign: 'left'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(r => {
    const es = ESTADO_REM[r.estado] || {
      tone: 'gray',
      label: r.estado
    };
    return /*#__PURE__*/React.createElement("tr", {
      key: r.id,
      style: {
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
        transition: 'background 150ms',
        borderLeft: r.estado === 'pendiente' ? '4px solid #fbbf24' : r.estado === 'programado' ? '4px solid #60a5fa' : '4px solid #34d399'
      },
      onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
      onMouseLeave: e => e.currentTarget.style.background = '#fff'
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono"
    }, r.id)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 11,
        color: '#9ca3af'
      }
    }, r.op)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        fontWeight: 600,
        color: '#1f2937'
      }
    }, r.cliente), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#6b7280',
        fontSize: 12,
        maxWidth: 130,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, r.item), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#6b7280',
        fontSize: 12
      }
    }, r.fecha), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#6b7280',
        fontSize: 12
      }
    }, r.chofer), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "money",
      style: {
        fontSize: 13
      }
    }, formatCurrency(r.monto))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      tone: es.tone
    }, es.label)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 14,
      color: "#9ca3af"
    })));
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "teal",
    title: "Acciones r\xE1pidas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, [{
    icon: 'Plus',
    label: 'Nuevo remito',
    bg: '#0f766e',
    fg: '#fff'
  }, {
    icon: 'Pencil',
    label: 'Registrar entrega',
    bg: '#ccfbf1',
    fg: '#0f766e'
  }, {
    icon: 'Filter',
    label: 'Imprimir hojas de ruta',
    bg: '#dbeafe',
    fg: '#1d4ed8'
  }, {
    icon: 'Activity',
    label: 'Ver historial',
    bg: '#f3f4f6',
    fg: '#4b5563'
  }].map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    className: "qa-btn",
    style: {
      background: a.bg,
      color: a.fg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 13
  }), a.label)))), /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Truck",
    iconTone: "teal",
    title: "Entregas de hoy"
  }), REMITOS_DATA.filter(r => r.estado !== 'entregado').map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    className: "flex items-center gap-2",
    style: {
      padding: '7px 0',
      borderBottom: '1px solid #f3f4f6'
    }
  }, /*#__PURE__*/React.createElement(IconTile, {
    name: "Truck",
    tone: r.estado === 'pendiente' ? 'amber' : 'blue',
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 600,
      color: '#1f2937'
    },
    className: "truncate"
  }, r.cliente), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 10,
      color: '#9ca3af'
    }
  }, r.chofer, " \xB7 ", r.fecha)))))))));
}
window.Remitos = Remitos;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Remitos.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/RemitosV2.jsx
try { (() => {
/* Remitos — notas de entrega + columna lateral */

const REMITOS_DATA = [{
  id: 'REM-042',
  op: 'OP-0140',
  cliente: 'Familia González',
  item: 'Ventana corrediza PVC 1.50×1.10',
  fecha: '06/06',
  estado: 'pendiente',
  chofer: 'Juan P.',
  monto: 1250000
}, {
  id: 'REM-041',
  op: 'OP-0130',
  cliente: 'Familia Britos',
  item: 'Puerta corredera + 2 ventanas',
  fecha: '06/06',
  estado: 'pendiente',
  chofer: 'Juan P.',
  monto: 1820000
}, {
  id: 'REM-040',
  op: 'OP-0129',
  cliente: 'Pablo Sánchez',
  item: 'Ventana corrediza balcón',
  fecha: '07/06',
  estado: 'programado',
  chofer: 'Mario G.',
  monto: 680000
}, {
  id: 'REM-039',
  op: 'OP-0128',
  cliente: 'Andrea Méndez',
  item: 'Mampara de baño 80×190',
  fecha: '07/06',
  estado: 'programado',
  chofer: 'Mario G.',
  monto: 340000
}, {
  id: 'REM-038',
  op: 'OP-0120',
  cliente: 'Edificio Las Tipas',
  item: 'Ventanas piso 3 (×6)',
  fecha: '01/06',
  estado: 'entregado',
  chofer: 'Juan P.',
  monto: 4900000
}, {
  id: 'REM-037',
  op: 'OP-0118',
  cliente: 'Familia Acuña',
  item: 'Puerta principal + lateral',
  fecha: '30/05',
  estado: 'entregado',
  chofer: 'Rubén H.',
  monto: 1450000
}, {
  id: 'REM-036',
  op: 'OP-0115',
  cliente: 'Constructora del Norte',
  item: 'Ventanal fijo — avance',
  fecha: '25/05',
  estado: 'entregado',
  chofer: 'Rubén H.',
  monto: 1600000
}];
const ESTADO_REM = {
  pendiente: {
    tone: 'amber',
    label: 'Pendiente'
  },
  programado: {
    tone: 'blue',
    label: 'Programado'
  },
  entregado: {
    tone: 'emerald',
    label: 'Entregado'
  }
};
function Remitos() {
  const [query, setQuery] = React.useState('');
  const filtered = REMITOS_DATA.filter(r => query === '' || r.cliente.toLowerCase().includes(query.toLowerCase()) || r.id.includes(query.toUpperCase()));
  const hoy = REMITOS_DATA.filter(r => r.estado !== 'entregado').length;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHero, {
    section: "remitos",
    icon: "Truck",
    breadcrumb: ['Comercial', 'Remitos'],
    title: "Remitos",
    sub: "Notas de entrega e historial de despacho",
    actions: /*#__PURE__*/React.createElement("button", {
      className: "btn btn-section"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "Plus",
      size: 14
    }), "Nuevo remito")
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-page-inner",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(CompactStatsBar, {
    items: [{
      value: String(REMITOS_DATA.filter(r => r.estado === 'pendiente').length),
      label: 'pendientes hoy',
      color: '#fbbf24'
    }, {
      value: String(REMITOS_DATA.filter(r => r.estado === 'programado').length),
      label: 'programados',
      color: '#60a5fa'
    }, {
      value: String(REMITOS_DATA.filter(r => r.estado === 'entregado').length),
      label: 'entregados (mes)',
      color: '#34d399'
    }, {
      value: formatCurrency(REMITOS_DATA.filter(r => r.estado !== 'entregado').reduce((s, r) => s + r.monto, 0)),
      label: 'en tránsito',
      color: '#2dd4bf'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Search",
    size: 14
  })), /*#__PURE__*/React.createElement("input", {
    className: "input",
    placeholder: "Buscar remito o cliente\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    style: {
      paddingLeft: 32
    }
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb'
    }
  }, ['Remito', 'Op.', 'Cliente', 'Material', 'Fecha', 'Chofer', 'Monto', 'Estado', ''].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      padding: '10px 14px',
      fontSize: 10,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      textAlign: 'left'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(r => {
    const es = ESTADO_REM[r.estado] || {
      tone: 'gray',
      label: r.estado
    };
    return /*#__PURE__*/React.createElement("tr", {
      key: r.id,
      style: {
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
        transition: 'background 150ms',
        borderLeft: r.estado === 'pendiente' ? '4px solid #fbbf24' : r.estado === 'programado' ? '4px solid #60a5fa' : '4px solid #34d399'
      },
      onMouseEnter: e => e.currentTarget.style.background = '#f9fafb',
      onMouseLeave: e => e.currentTarget.style.background = '#fff'
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono"
    }, r.id)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 11,
        color: '#9ca3af'
      }
    }, r.op)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        fontWeight: 600,
        color: '#1f2937'
      }
    }, r.cliente), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#6b7280',
        fontSize: 12,
        maxWidth: 130,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, r.item), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#6b7280',
        fontSize: 12
      }
    }, r.fecha), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle',
        color: '#6b7280',
        fontSize: 12
      }
    }, r.chofer), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "money",
      style: {
        fontSize: 13
      }
    }, formatCurrency(r.monto))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      tone: es.tone
    }, es.label)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '11px 14px',
        verticalAlign: 'middle'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 14,
      color: "#9ca3af"
    })));
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Zap",
    iconTone: "teal",
    title: "Acciones r\xE1pidas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, [{
    icon: 'Plus',
    label: 'Nuevo remito',
    bg: '#0f766e',
    fg: '#fff'
  }, {
    icon: 'Pencil',
    label: 'Registrar entrega',
    bg: '#ccfbf1',
    fg: '#0f766e'
  }, {
    icon: 'Filter',
    label: 'Imprimir hojas de ruta',
    bg: '#dbeafe',
    fg: '#1d4ed8'
  }, {
    icon: 'Activity',
    label: 'Ver historial',
    bg: '#f3f4f6',
    fg: '#4b5563'
  }].map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    className: "qa-btn",
    style: {
      background: a.bg,
      color: a.fg
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: a.icon,
    size: 13
  }), a.label)))), /*#__PURE__*/React.createElement(Card, {
    tight: true
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "Truck",
    iconTone: "teal",
    title: "Entregas de hoy"
  }), REMITOS_DATA.filter(r => r.estado !== 'entregado').map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    className: "flex items-center gap-2",
    style: {
      padding: '7px 0',
      borderBottom: '1px solid #f3f4f6'
    }
  }, /*#__PURE__*/React.createElement(IconTile, {
    name: "Truck",
    tone: r.estado === 'pendiente' ? 'amber' : 'blue',
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      fontWeight: 600,
      color: '#1f2937'
    },
    className: "truncate"
  }, r.cliente), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 10,
      color: '#9ca3af'
    }
  }, r.chofer, " \xB7 ", r.fecha)))))))));
}
window.Remitos = Remitos;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/RemitosV2.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/SectionHero.jsx
try { (() => {
/* SectionHero + MetricsBand — the two patterns that wall off sections.

   <SectionHero> sits at the top of every page. It renders a tinted strip
   in the section's accent colour, with breadcrumb · title · sub-title on
   the left and a primary CTA on the right. The page background also
   takes on a soft wash of the section accent — together these announce
   "you are HERE" before the user reads a word.

   <MetricsBand> wraps KPI tiles in a dark navy block, visually walling
   them off from the lighter operational areas below. */

function SectionHero({
  section,
  icon,
  title,
  sub,
  breadcrumb,
  actions
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "section-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-hero-inner"
  }, icon && /*#__PURE__*/React.createElement("div", {
    className: "section-hero-mark"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 28,
    color: sectionDeep(section)
  })), /*#__PURE__*/React.createElement("div", {
    className: "section-hero-text"
  }, breadcrumb && /*#__PURE__*/React.createElement("div", {
    className: "section-hero-crumb"
  }, breadcrumb.map((c, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "/"), /*#__PURE__*/React.createElement("span", {
    className: i === breadcrumb.length - 1 ? 'accent' : ''
  }, c)))), /*#__PURE__*/React.createElement("h1", {
    className: "section-hero-title"
  }, title), sub && /*#__PURE__*/React.createElement("p", {
    className: "section-hero-sub"
  }, sub)), actions && /*#__PURE__*/React.createElement("div", {
    className: "section-hero-actions"
  }, actions)));
}
function MetricsBand({
  title = 'Métricas del negocio',
  sub,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "metrics-band"
  }, /*#__PURE__*/React.createElement("div", {
    className: "metrics-band-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "BarChart3",
    size: 14,
    color: "#fbbf24"
  }), /*#__PURE__*/React.createElement("span", {
    className: "metrics-band-title"
  }, title), sub && /*#__PURE__*/React.createElement("span", {
    className: "metrics-band-sub"
  }, sub)), /*#__PURE__*/React.createElement("div", {
    className: "metrics-grid"
  }, children));
}
function MetricTile({
  label,
  value,
  sub,
  icon,
  progress,
  progressColor = '#fbbf24'
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "metrics-tile"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "metrics-tile-label"
  }, label), icon && /*#__PURE__*/React.createElement("div", {
    className: "metrics-tile-icon"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16
  }))), /*#__PURE__*/React.createElement("p", {
    className: "metrics-tile-value"
  }, value), progress != null && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-fill",
    style: {
      background: progressColor,
      width: `${Math.min(progress, 100)}%`
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      color: progressColor
    },
    className: "tabular"
  }, progress, "%")), sub && /*#__PURE__*/React.createElement("p", {
    className: "metrics-tile-sub"
  }, sub));
}
function sectionDeep(section) {
  return {
    dashboard: '#1d4ed8',
    crm: '#be123c',
    presupuestos: '#6d28d9',
    operaciones: '#b45309',
    remitos: '#0f766e',
    pedidos: '#4d7c0f',
    recibos: '#047857',
    clientes: '#0e7490',
    estado: '#4338ca',
    productos: '#0369a1',
    stock: '#c2410c',
    proveedores: '#b45309',
    reportes: '#7e22ce',
    config: '#475569'
  }[section] || '#031d49';
}

/* ── CompactStatsBar — slim 52px navy strip for secondary metrics ──
   Use instead of MetricsBand when the real content below needs the
   majority of the viewport (e.g. Kanban, tables, forms). */
function CompactStatsBar({
  items
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "compact-stats-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "compact-stats-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "BarChart3",
    size: 11,
    color: "#fbbf24"
  }), "M\xE9tricas"), items.map((item, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "compact-stats-divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "compact-stats-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "compact-stats-value",
    style: item.color ? {
      color: item.color
    } : {}
  }, item.value), /*#__PURE__*/React.createElement("span", {
    className: "compact-stats-label"
  }, item.label)))));
}
Object.assign(window, {
  SectionHero,
  MetricsBand,
  MetricTile,
  CompactStatsBar,
  sectionDeep
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/SectionHero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/SectionHeroV2.jsx
try { (() => {
/* SectionHero + MetricsBand — the two patterns that wall off sections.

   <SectionHero> sits at the top of every page. It renders a tinted strip
   in the section's accent colour, with breadcrumb · title · sub-title on
   the left and a primary CTA on the right. The page background also
   takes on a soft wash of the section accent — together these announce
   "you are HERE" before the user reads a word.

   <MetricsBand> wraps KPI tiles in a dark navy block, visually walling
   them off from the lighter operational areas below. */

function SectionHero({
  section,
  icon,
  title,
  sub,
  breadcrumb,
  actions
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "section-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-hero-inner"
  }, icon && /*#__PURE__*/React.createElement("div", {
    className: "section-hero-mark"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 28,
    color: sectionDeep(section)
  })), /*#__PURE__*/React.createElement("div", {
    className: "section-hero-text"
  }, breadcrumb && /*#__PURE__*/React.createElement("div", {
    className: "section-hero-crumb"
  }, breadcrumb.map((c, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "/"), /*#__PURE__*/React.createElement("span", {
    className: i === breadcrumb.length - 1 ? 'accent' : ''
  }, c)))), /*#__PURE__*/React.createElement("h1", {
    className: "section-hero-title"
  }, title), sub && /*#__PURE__*/React.createElement("p", {
    className: "section-hero-sub"
  }, sub)), actions && /*#__PURE__*/React.createElement("div", {
    className: "section-hero-actions"
  }, actions)));
}
function MetricsBand({
  title = 'Métricas del negocio',
  sub,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "metrics-band"
  }, /*#__PURE__*/React.createElement("div", {
    className: "metrics-band-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "BarChart3",
    size: 14,
    color: "#fbbf24"
  }), /*#__PURE__*/React.createElement("span", {
    className: "metrics-band-title"
  }, title), sub && /*#__PURE__*/React.createElement("span", {
    className: "metrics-band-sub"
  }, sub)), /*#__PURE__*/React.createElement("div", {
    className: "metrics-grid"
  }, children));
}
function MetricTile({
  label,
  value,
  sub,
  icon,
  progress,
  progressColor = '#fbbf24'
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "metrics-tile"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "metrics-tile-label"
  }, label), icon && /*#__PURE__*/React.createElement("div", {
    className: "metrics-tile-icon"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16
  }))), /*#__PURE__*/React.createElement("p", {
    className: "metrics-tile-value"
  }, value), progress != null && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-fill",
    style: {
      background: progressColor,
      width: `${Math.min(progress, 100)}%`
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      color: progressColor
    },
    className: "tabular"
  }, progress, "%")), sub && /*#__PURE__*/React.createElement("p", {
    className: "metrics-tile-sub"
  }, sub));
}
function sectionDeep(section) {
  return {
    dashboard: '#1d4ed8',
    crm: '#be123c',
    presupuestos: '#6d28d9',
    operaciones: '#b45309',
    remitos: '#0f766e',
    pedidos: '#4d7c0f',
    recibos: '#047857',
    clientes: '#0e7490',
    estado: '#4338ca',
    productos: '#0369a1',
    stock: '#c2410c',
    proveedores: '#b45309',
    reportes: '#7e22ce',
    config: '#475569'
  }[section] || '#031d49';
}

/* ── CompactStatsBar — slim navy strip with value + label per metric ── */
function CompactStatsBar({
  items
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'linear-gradient(90deg, #031d49 0%, #0a2761 100%)',
      borderRadius: 12,
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      height: 52,
      gap: 0,
      overflowX: 'auto',
      boxShadow: '0 4px 16px -8px rgba(3,29,73,0.35)',
      flexWrap: 'nowrap',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginRight: 16,
      flexShrink: 0,
      fontSize: 10,
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: '0.14em',
      color: 'rgba(255,255,255,0.40)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "BarChart3",
    size: 11,
    color: "#fbbf24"
  }), "M\xE9tricas"), items.map((item, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 28,
      background: 'rgba(255,255,255,0.12)',
      margin: '0 16px',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      color: item.color || '#ffffff',
      fontVariantNumeric: 'tabular-nums',
      lineHeight: 1,
      letterSpacing: '-0.02em'
    }
  }, item.value), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.55)',
      fontWeight: 500,
      whiteSpace: 'nowrap'
    }
  }, item.label)))));
}
Object.assign(window, {
  SectionHero,
  MetricsBand,
  MetricTile,
  CompactStatsBar,
  sectionDeep
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/SectionHeroV2.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Sidebar.jsx
try { (() => {
/* Sidebar — navy icon rail with section accents.
   Active item: vertical accent bar on the left + tinted bg + colored icon.
   Hover (idle): icon scales 1.10 with accent backing. */

const NAV_GROUPS = [{
  items: [{
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    tone: 'blue'
  }]
}, {
  label: 'Comercial',
  items: [{
    id: 'crm',
    label: 'CRM',
    icon: 'GitBranch',
    tone: 'rose'
  }, {
    id: 'presupuestos',
    label: 'Presupuestos',
    icon: 'FileText',
    tone: 'violet'
  }, {
    id: 'operaciones',
    label: 'Operaciones',
    icon: 'Hammer',
    tone: 'amber'
  }, {
    id: 'remitos',
    label: 'Remitos',
    icon: 'Truck',
    tone: 'teal'
  }, {
    id: 'pedidos',
    label: 'Pedidos',
    icon: 'ShoppingCart',
    tone: 'lime'
  }, {
    id: 'recibos',
    label: 'Recibos',
    icon: 'Receipt',
    tone: 'emerald'
  }, {
    id: 'clientes',
    label: 'Clientes',
    icon: 'Users',
    tone: 'cyan'
  }, {
    id: 'estado',
    label: 'Estado de Cuenta',
    icon: 'BookOpen',
    tone: 'indigo'
  }]
}, {
  label: 'Catálogo',
  items: [{
    id: 'productos',
    label: 'Productos',
    icon: 'Layers',
    tone: 'sky'
  }, {
    id: 'stock',
    label: 'Existencias',
    icon: 'Boxes',
    tone: 'orange'
  }, {
    id: 'proveedores',
    label: 'Proveedores',
    icon: 'Factory',
    tone: 'amber'
  }]
}, {
  label: 'Sistema',
  items: [{
    id: 'reportes',
    label: 'Reportes',
    icon: 'TrendingUp',
    tone: 'purple'
  }, {
    id: 'config',
    label: 'Configuración',
    icon: 'SlidersHorizontal',
    tone: 'slate'
  }]
}];
const TONE_ACCENT = {
  blue: '#60a5fa',
  rose: '#fb7185',
  violet: '#a78bfa',
  amber: '#fbbf24',
  teal: '#2dd4bf',
  lime: '#a3e635',
  emerald: '#34d399',
  cyan: '#22d3ee',
  indigo: '#818cf8',
  sky: '#38bdf8',
  orange: '#fb923c',
  purple: '#c084fc',
  slate: '#cbd5e1'
};
const TONE_BG = {
  blue: 'rgba(96,165,250,0.10)',
  rose: 'rgba(251,113,133,0.10)',
  violet: 'rgba(167,139,250,0.10)',
  amber: 'rgba(251,191,36,0.10)',
  teal: 'rgba(45,212,191,0.10)',
  lime: 'rgba(163,230,53,0.10)',
  emerald: 'rgba(52,211,153,0.10)',
  cyan: 'rgba(34,211,238,0.10)',
  indigo: 'rgba(129,140,248,0.10)',
  sky: 'rgba(56,189,248,0.10)',
  orange: 'rgba(251,146,60,0.10)',
  purple: 'rgba(192,132,252,0.10)',
  slate: 'rgba(148,163,184,0.10)'
};
function SidebarItem({
  item,
  active,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  const [tipY, setTipY] = React.useState(0);
  const btnRef = React.useRef(null);
  const accent = TONE_ACCENT[item.tone] || '#fff';
  const accentBg = TONE_BG[item.tone] || 'rgba(255,255,255,0.05)';
  function handleEnter() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setTipY(r.top + r.height / 2);
    }
    setHover(true);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      padding: '0 6px',
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("button", {
    ref: btnRef,
    onClick: onClick,
    onMouseEnter: handleEnter,
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: 40,
      position: 'relative',
      borderRadius: 12,
      background: active ? accentBg : hover ? 'rgba(255,255,255,0.05)' : 'transparent',
      color: active ? accent : hover ? accent : 'rgba(255,255,255,0.45)',
      transition: 'all 150ms'
    }
  }, active && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: -6,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 2,
      height: 18,
      background: accent,
      borderRadius: '0 4px 4px 0'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active ? 'rgba(255,255,255,0.10)' : hover ? accentBg : 'transparent',
      color: 'inherit',
      transform: !active && hover ? 'scale(1.10)' : 'none',
      transition: 'transform 150ms'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: item.icon,
    size: 20
  }))), hover && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left: 62,
      top: tipY,
      transform: 'translateY(-50%)',
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      zIndex: 9999
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      borderWidth: 5,
      borderStyle: 'solid',
      borderColor: 'transparent',
      borderRightColor: '#1a2744'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      background: '#1a2744',
      color: accent,
      fontSize: 11,
      fontWeight: 700,
      padding: '7px 12px',
      borderRadius: 9,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      letterSpacing: '0.01em'
    }
  }, item.label)));
}
function Sidebar({
  active,
  onNavigate,
  user,
  onSignOut
}) {
  const initials = user?.nombre ? user.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'CB';
  const [logoutHover, setLogoutHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("aside", {
    className: "sidebar-rail",
    style: {
      width: 56,
      minHeight: '100vh',
      background: '#031d49',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      position: 'relative',
      zIndex: 30,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: 30,
    variant: "dark"
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      padding: '8px 0',
      overflowY: 'auto',
      scrollbarWidth: 'none'
    }
  }, NAV_GROUPS.map((group, gi) => /*#__PURE__*/React.createElement("div", {
    key: gi,
    style: {
      marginTop: gi > 0 ? 4 : 0
    }
  }, group.label && /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'rgba(255,255,255,0.10)',
      margin: '8px 8px 6px'
    }
  }), group.items.map(item => /*#__PURE__*/React.createElement(SidebarItem, {
    key: item.id,
    item: item,
    active: item.id === active,
    onClick: () => onNavigate(item.id)
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 6,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      borderTop: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      background: '#e31e24',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: 11,
      fontWeight: 800
    }
  }, initials), /*#__PURE__*/React.createElement("button", {
    onClick: onSignOut,
    onMouseEnter: () => setLogoutHover(true),
    onMouseLeave: () => setLogoutHover(false),
    title: "Cerrar sesi\xF3n",
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: logoutHover ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
      background: logoutHover ? 'rgba(255,255,255,0.08)' : 'transparent',
      transition: 'all 150ms'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "LogOut",
    size: 18
  }))));
}
window.Sidebar = Sidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/SidebarV2.jsx
try { (() => {
/* Sidebar — navy icon rail with section accents.
   Active item: vertical accent bar on the left + tinted bg + colored icon.
   Hover (idle): icon scales 1.10 with accent backing. */

const NAV_GROUPS = [{
  items: [{
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    tone: 'blue'
  }]
}, {
  label: 'Comercial',
  items: [{
    id: 'crm',
    label: 'CRM',
    icon: 'GitBranch',
    tone: 'rose'
  }, {
    id: 'presupuestos',
    label: 'Presupuestos',
    icon: 'FileText',
    tone: 'violet'
  }, {
    id: 'operaciones',
    label: 'Operaciones',
    icon: 'Hammer',
    tone: 'amber'
  }, {
    id: 'remitos',
    label: 'Remitos',
    icon: 'Truck',
    tone: 'teal'
  }, {
    id: 'pedidos',
    label: 'Pedidos',
    icon: 'ShoppingCart',
    tone: 'lime'
  }, {
    id: 'recibos',
    label: 'Recibos',
    icon: 'Receipt',
    tone: 'emerald'
  }, {
    id: 'clientes',
    label: 'Clientes',
    icon: 'Users',
    tone: 'cyan'
  }, {
    id: 'estado',
    label: 'Estado de Cuenta',
    icon: 'BookOpen',
    tone: 'indigo'
  }]
}, {
  label: 'Catálogo',
  items: [{
    id: 'productos',
    label: 'Productos',
    icon: 'Layers',
    tone: 'sky'
  }, {
    id: 'stock',
    label: 'Existencias',
    icon: 'Boxes',
    tone: 'orange'
  }, {
    id: 'proveedores',
    label: 'Proveedores',
    icon: 'Factory',
    tone: 'amber'
  }]
}, {
  label: 'Sistema',
  items: [{
    id: 'reportes',
    label: 'Reportes',
    icon: 'TrendingUp',
    tone: 'purple'
  }, {
    id: 'config',
    label: 'Configuración',
    icon: 'SlidersHorizontal',
    tone: 'slate'
  }]
}];
const TONE_ACCENT = {
  blue: '#60a5fa',
  rose: '#fb7185',
  violet: '#a78bfa',
  amber: '#fbbf24',
  teal: '#2dd4bf',
  lime: '#a3e635',
  emerald: '#34d399',
  cyan: '#22d3ee',
  indigo: '#818cf8',
  sky: '#38bdf8',
  orange: '#fb923c',
  purple: '#c084fc',
  slate: '#cbd5e1'
};
const TONE_BG = {
  blue: 'rgba(96,165,250,0.10)',
  rose: 'rgba(251,113,133,0.10)',
  violet: 'rgba(167,139,250,0.10)',
  amber: 'rgba(251,191,36,0.10)',
  teal: 'rgba(45,212,191,0.10)',
  lime: 'rgba(163,230,53,0.10)',
  emerald: 'rgba(52,211,153,0.10)',
  cyan: 'rgba(34,211,238,0.10)',
  indigo: 'rgba(129,140,248,0.10)',
  sky: 'rgba(56,189,248,0.10)',
  orange: 'rgba(251,146,60,0.10)',
  purple: 'rgba(192,132,252,0.10)',
  slate: 'rgba(148,163,184,0.10)'
};
function SidebarItem({
  item,
  active,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  const [tipY, setTipY] = React.useState(0);
  const btnRef = React.useRef(null);
  const accent = TONE_ACCENT[item.tone] || '#fff';
  const accentBg = TONE_BG[item.tone] || 'rgba(255,255,255,0.05)';
  function handleEnter() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setTipY(r.top + r.height / 2);
    }
    setHover(true);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      padding: '0 6px',
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("button", {
    ref: btnRef,
    onClick: onClick,
    onMouseEnter: handleEnter,
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: 40,
      position: 'relative',
      borderRadius: 12,
      background: active ? accentBg : hover ? 'rgba(255,255,255,0.05)' : 'transparent',
      color: active ? accent : hover ? accent : 'rgba(255,255,255,0.45)',
      transition: 'all 150ms'
    }
  }, active && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: -6,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 2,
      height: 18,
      background: accent,
      borderRadius: '0 4px 4px 0'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active ? 'rgba(255,255,255,0.10)' : hover ? accentBg : 'transparent',
      color: 'inherit',
      transform: !active && hover ? 'scale(1.10)' : 'none',
      transition: 'transform 150ms'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: item.icon,
    size: 20
  }))), hover && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left: 62,
      top: tipY,
      transform: 'translateY(-50%)',
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      zIndex: 9999
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      borderWidth: 5,
      borderStyle: 'solid',
      borderColor: 'transparent',
      borderRightColor: '#1a2744'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      background: '#1a2744',
      color: accent,
      fontSize: 11,
      fontWeight: 700,
      padding: '7px 12px',
      borderRadius: 9,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      letterSpacing: '0.01em'
    }
  }, item.label)));
}
function Sidebar({
  active,
  onNavigate,
  user,
  onSignOut
}) {
  const initials = user?.nombre ? user.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'CB';
  const [logoutHover, setLogoutHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("aside", {
    className: "sidebar-rail",
    style: {
      width: 56,
      minHeight: '100vh',
      background: '#031d49',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      position: 'relative',
      zIndex: 30,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: 30,
    variant: "dark"
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      padding: '8px 0',
      overflowY: 'auto',
      scrollbarWidth: 'none'
    }
  }, NAV_GROUPS.map((group, gi) => /*#__PURE__*/React.createElement("div", {
    key: gi,
    style: {
      marginTop: gi > 0 ? 4 : 0
    }
  }, group.label && /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'rgba(255,255,255,0.10)',
      margin: '8px 8px 6px'
    }
  }), group.items.map(item => /*#__PURE__*/React.createElement(SidebarItem, {
    key: item.id,
    item: item,
    active: item.id === active,
    onClick: () => onNavigate(item.id)
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 6,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      borderTop: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      background: '#e31e24',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: 11,
      fontWeight: 800
    }
  }, initials), /*#__PURE__*/React.createElement("button", {
    onClick: onSignOut,
    onMouseEnter: () => setLogoutHover(true),
    onMouseLeave: () => setLogoutHover(false),
    title: "Cerrar sesi\xF3n",
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: logoutHover ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
      background: logoutHover ? 'rgba(255,255,255,0.08)' : 'transparent',
      transition: 'all 150ms'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "LogOut",
    size: 18
  }))));
}
window.Sidebar = Sidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/SidebarV2.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/TopBar.jsx
try { (() => {
/* Top bar — navy header with prominent brand identity.
   Shows a hamburger button on mobile (hidden on desktop via CSS). */

function TopBar({
  notifCount = 0,
  onBellClick,
  bellOpen,
  onMenuClick
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      height: 72,
      background: '#031d49',
      display: 'flex',
      alignItems: 'center',
      padding: '0 22px',
      gap: 14,
      boxShadow: '0 2px 14px rgba(3,29,73,0.30)',
      position: 'relative',
      zIndex: 20,
      borderBottom: '1px solid rgba(255,255,255,0.06)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "mob-hamburger",
    onClick: onMenuClick,
    style: {
      display: 'none',
      /* CSS .mob-hamburger overrides to flex on mobile */
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      color: 'rgba(255,255,255,0.75)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Menu",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 12,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.10)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: 28,
    variant: "dark"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      lineHeight: 1.1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 800,
      color: '#fff',
      letterSpacing: '0.06em',
      textTransform: 'uppercase'
    }
  }, "C\xC9SAR BR\xCDTEZ"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: '#e31e24',
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      marginTop: 2
    }
  }, "Aberturas"))), /*#__PURE__*/React.createElement("div", {
    className: "topbar-slogan",
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      minWidth: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      height: 32,
      width: 1,
      background: 'rgba(255,255,255,0.12)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.65)',
      fontStyle: 'italic',
      fontWeight: 300,
      letterSpacing: '0.02em',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, "Aberturas bien pensadas.")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    },
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onBellClick,
    title: "Notificaciones",
    style: {
      width: 40,
      height: 40,
      borderRadius: 12,
      position: 'relative',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: notifCount > 0 ? '#fbbf24' : 'rgba(255,255,255,0.55)',
      background: bellOpen ? 'rgba(255,255,255,0.10)' : 'transparent',
      transition: 'all 150ms'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(255,255,255,0.10)',
    onMouseLeave: e => e.currentTarget.style.background = bellOpen ? 'rgba(255,255,255,0.10)' : 'transparent'
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Bell",
    size: 20
  }), notifCount > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 6,
      right: 6,
      minWidth: 16,
      height: 16,
      padding: '0 4px',
      background: '#e31e24',
      color: '#fff',
      fontSize: 9,
      fontWeight: 800,
      borderRadius: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid #031d49'
    }
  }, notifCount > 9 ? '9+' : notifCount)));
}
function NotificationPanel({
  notifs,
  onClose,
  onSelect,
  onMarkRead
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 14,
      top: 72,
      marginTop: 6,
      zIndex: 100,
      width: 320,
      background: '#0a2761',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 8px 32px -8px rgba(0,0,0,0.30)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      color: '#fff',
      fontSize: 12,
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "Bell",
    size: 14,
    color: "#fbbf24"
  }), "Notificaciones", notifs.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      color: '#fcd34d',
      background: 'rgba(251,191,36,0.10)',
      padding: '2px 7px',
      borderRadius: 9999
    }
  }, notifs.length, " nueva", notifs.length !== 1 ? 's' : '')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, notifs.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: onMarkRead,
    style: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.50)',
      padding: '4px 8px',
      borderRadius: 8
    }
  }, "Marcar le\xEDdas"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      padding: 4,
      borderRadius: 6,
      color: 'rgba(255,255,255,0.40)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "X",
    size: 13
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 320,
      overflowY: 'auto'
    }
  }, notifs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px 16px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "CheckCircle2",
    size: 24,
    color: "rgba(16,185,129,0.60)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'rgba(255,255,255,0.40)',
      fontSize: 11,
      marginTop: 8
    }
  }, "Sin notificaciones pendientes")) : notifs.map(n => /*#__PURE__*/React.createElement("button", {
    key: n.id,
    onClick: () => onSelect && onSelect(n),
    style: {
      width: '100%',
      display: 'flex',
      gap: 10,
      padding: '12px 16px',
      textAlign: 'left',
      transition: 'background 150ms',
      borderBottom: '1px solid rgba(255,255,255,0.05)'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 10,
      flexShrink: 0,
      background: 'rgba(34,197,94,0.15)',
      color: '#34d399',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "CheckCircle2",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: '#fff',
      fontSize: 12,
      fontWeight: 600
    }
  }, n.cliente), /*#__PURE__*/React.createElement("small", {
    style: {
      display: 'block',
      color: 'rgba(255,255,255,0.50)',
      fontSize: 11,
      marginTop: 2
    }
  }, "Aprob\xF3 el presupuesto ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'monospace',
      color: '#34d399',
      fontWeight: 700
    }
  }, n.numero)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#34d399',
      fontSize: 11,
      fontWeight: 800,
      fontVariantNumeric: 'tabular-nums'
    }
  }, formatCurrency(n.monto)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'rgba(255,255,255,0.30)',
      fontSize: 10
    }
  }, n.when)))))));
}
Object.assign(window, {
  TopBar,
  NotificationPanel
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/TopBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/app.jsx
try { (() => {
/* App shell — router + mobile nav + drawer. */

const MOB_NAV = [{
  id: 'dashboard',
  icon: 'LayoutDashboard',
  label: 'Inicio'
}, {
  id: 'operaciones',
  icon: 'Hammer',
  label: 'Ops'
}, {
  id: 'presupuestos',
  icon: 'FileText',
  label: 'Presup.'
}, {
  id: 'clientes',
  icon: 'Users',
  label: 'Clientes'
}, {
  id: 'menu',
  icon: 'Menu',
  label: 'Más'
}];
function MobileDrawer({
  active,
  onNavigate,
  user,
  onSignOut,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "mob-drawer-overlay open",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "mob-drawer-panel",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 16px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: 32,
    variant: "dark"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: '#fff',
      fontSize: 13,
      fontWeight: 800,
      letterSpacing: '0.04em'
    }
  }, "C\xC9SAR BR\xCDTEZ"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: '#e31e24',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.18em',
      textTransform: 'uppercase'
    }
  }, "Aberturas"))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: 'rgba(255,255,255,0.50)',
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "X",
    size: 18
  })))), /*#__PURE__*/React.createElement("nav", {
    style: {
      padding: '8px 8px',
      overflowY: 'auto'
    }
  }, [{
    label: null,
    items: [{
      id: 'dashboard',
      icon: 'LayoutDashboard',
      label: 'Dashboard',
      tone: 'blue'
    }]
  }, {
    label: 'Comercial',
    items: [{
      id: 'crm',
      icon: 'GitBranch',
      label: 'CRM',
      tone: 'rose'
    }, {
      id: 'presupuestos',
      icon: 'FileText',
      label: 'Presupuestos',
      tone: 'violet'
    }, {
      id: 'operaciones',
      icon: 'Hammer',
      label: 'Operaciones',
      tone: 'amber'
    }, {
      id: 'remitos',
      icon: 'Truck',
      label: 'Remitos',
      tone: 'teal'
    }, {
      id: 'pedidos',
      icon: 'ShoppingCart',
      label: 'Pedidos',
      tone: 'lime'
    }, {
      id: 'recibos',
      icon: 'Receipt',
      label: 'Recibos',
      tone: 'emerald'
    }, {
      id: 'clientes',
      icon: 'Users',
      label: 'Clientes',
      tone: 'cyan'
    }, {
      id: 'estado',
      icon: 'BookOpen',
      label: 'Estado de Cuenta',
      tone: 'indigo'
    }]
  }, {
    label: 'Catálogo',
    items: [{
      id: 'productos',
      icon: 'Layers',
      label: 'Productos',
      tone: 'sky'
    }, {
      id: 'stock',
      icon: 'Boxes',
      label: 'Existencias',
      tone: 'orange'
    }, {
      id: 'proveedores',
      icon: 'Factory',
      label: 'Proveedores',
      tone: 'amber'
    }]
  }, {
    label: 'Sistema',
    items: [{
      id: 'reportes',
      icon: 'TrendingUp',
      label: 'Reportes',
      tone: 'purple'
    }, {
      id: 'config',
      icon: 'SlidersHorizontal',
      label: 'Configuración',
      tone: 'slate'
    }]
  }].map((group, gi) => /*#__PURE__*/React.createElement("div", {
    key: gi,
    style: {
      marginTop: gi > 0 ? 4 : 0
    }
  }, group.label && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '10px 8px 4px',
      fontSize: 9,
      fontWeight: 800,
      color: 'rgba(255,255,255,0.30)',
      textTransform: 'uppercase',
      letterSpacing: '0.14em'
    }
  }, group.label), group.items.map(item => {
    const isActive = item.id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: item.id,
      onClick: () => {
        onNavigate(item.id);
        onClose();
      },
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '9px 10px',
        borderRadius: 10,
        color: isActive ? '#fff' : 'rgba(255,255,255,0.60)',
        background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
        fontWeight: isActive ? 700 : 500,
        fontSize: 13,
        transition: 'all 150ms'
      }
    }, /*#__PURE__*/React.createElement(IconTile, {
      name: item.icon,
      tone: item.tone,
      size: "sm"
    }), item.label, isActive && /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 12,
      style: {
        marginLeft: 'auto',
        opacity: 0.5
      }
    }));
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: '#e31e24',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: 11,
      fontWeight: 800
    }
  }, user?.nombre?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CB'), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: '#fff',
      fontSize: 12,
      fontWeight: 600
    }
  }, user?.nombre || 'Usuario'), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'rgba(255,255,255,0.40)',
      fontSize: 11
    }
  }, user?.rol || 'admin')), /*#__PURE__*/React.createElement("button", {
    onClick: onSignOut,
    style: {
      color: 'rgba(255,255,255,0.40)',
      padding: 4
    },
    title: "Cerrar sesi\xF3n"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "LogOut",
    size: 16
  })))));
}
function MobileBottomNav({
  active,
  onNavigate,
  notifCount,
  onBellClick
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "mob-bottom-nav"
  }, MOB_NAV.map(item => {
    const isActive = item.id !== 'menu' && item.id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: item.id,
      className: 'mob-nav-item' + (isActive ? ' active' : ''),
      onClick: () => item.id === 'menu' ? onBellClick() : onNavigate(item.id)
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: item.id === 'menu' ? notifCount > 0 ? 'Bell' : 'Menu' : item.icon,
      size: 20
    }), item.id === 'menu' && notifCount > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: -3,
        right: -5,
        width: 8,
        height: 8,
        background: '#e31e24',
        borderRadius: '50%',
        border: '1.5px solid #031d49'
      }
    })), /*#__PURE__*/React.createElement("span", null, item.label));
  }));
}
function App() {
  const [user, setUser] = React.useState(null);
  const [active, setActive] = React.useState('dashboard');
  const [bellOpen, setBellOpen] = React.useState(false);
  const [drawerOpen, setDrawer] = React.useState(false);
  const [notifs, setNotifs] = React.useState([{
    id: 'n1',
    cliente: 'Familia González',
    numero: 'PR-0042',
    monto: 1250000,
    when: 'Hace 12 min'
  }, {
    id: 'n2',
    cliente: 'Mariela Ojeda',
    numero: 'PR-0039',
    monto: 480000,
    when: 'Hace 2 h'
  }]);
  if (!user) return /*#__PURE__*/React.createElement(Login, {
    onSignIn: setUser
  });
  function navigate(id) {
    setActive(id);
    setBellOpen(false);
    setDrawer(false);
  }
  function signOut() {
    setUser(null);
    setActive('dashboard');
  }
  function markRead() {
    setNotifs([]);
  }
  let screen;
  switch (active) {
    case 'dashboard':
      screen = /*#__PURE__*/React.createElement(Dashboard, {
        user: user,
        onNavigate: navigate
      });
      break;
    case 'operaciones':
      screen = /*#__PURE__*/React.createElement(Operaciones, {
        onSelectOp: () => navigate('presupuestos')
      });
      break;
    case 'presupuestos':
      screen = /*#__PURE__*/React.createElement(Presupuestos, {
        onOpen: () => {}
      });
      break;
    case 'crm':
      screen = /*#__PURE__*/React.createElement(CRM, null);
      break;
    case 'remitos':
      screen = /*#__PURE__*/React.createElement(Remitos, null);
      break;
    case 'pedidos':
      screen = /*#__PURE__*/React.createElement(Pedidos, null);
      break;
    case 'recibos':
      screen = /*#__PURE__*/React.createElement(Recibos, null);
      break;
    case 'clientes':
      screen = /*#__PURE__*/React.createElement(Clientes, null);
      break;
    case 'estado':
      screen = /*#__PURE__*/React.createElement(Placeholder, {
        section: "estado",
        icon: "BookOpen",
        title: "Estado de Cuenta",
        sub: "Cuenta corriente por cliente",
        breadcrumb: ['Comercial', 'Estado de Cuenta']
      });
      break;
    case 'productos':
      screen = /*#__PURE__*/React.createElement(Placeholder, {
        section: "productos",
        icon: "Layers",
        title: "Productos",
        sub: "Cat\xE1logo de aberturas",
        breadcrumb: ['Catálogo', 'Productos']
      });
      break;
    case 'stock':
      screen = /*#__PURE__*/React.createElement(Placeholder, {
        section: "stock",
        icon: "Boxes",
        title: "Existencias",
        sub: "Inventario y movimientos de stock",
        breadcrumb: ['Catálogo', 'Existencias']
      });
      break;
    case 'proveedores':
      screen = /*#__PURE__*/React.createElement(Placeholder, {
        section: "proveedores",
        icon: "Factory",
        title: "Proveedores",
        sub: "Fabricantes y revendedores",
        breadcrumb: ['Catálogo', 'Proveedores']
      });
      break;
    case 'reportes':
      screen = /*#__PURE__*/React.createElement(Placeholder, {
        section: "reportes",
        icon: "TrendingUp",
        title: "Reportes",
        sub: "Ventas, conversi\xF3n, productos",
        breadcrumb: ['Sistema', 'Reportes']
      });
      break;
    case 'config':
      screen = /*#__PURE__*/React.createElement(Placeholder, {
        section: "config",
        icon: "SlidersHorizontal",
        title: "Configuraci\xF3n",
        sub: "Empresa, usuarios y cat\xE1logos",
        breadcrumb: ['Sistema', 'Configuración']
      });
      break;
    default:
      screen = null;
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "app-shell"
  }, /*#__PURE__*/React.createElement(Watermark, null), /*#__PURE__*/React.createElement(Sidebar, {
    active: active,
    onNavigate: navigate,
    user: user,
    onSignOut: signOut
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-main"
  }, /*#__PURE__*/React.createElement(TopBar, {
    notifCount: notifs.length,
    onBellClick: () => setBellOpen(v => !v),
    bellOpen: bellOpen,
    onMenuClick: () => setDrawer(true)
  }), bellOpen && /*#__PURE__*/React.createElement(NotificationPanel, {
    notifs: notifs,
    onClose: () => setBellOpen(false),
    onSelect: () => {
      setBellOpen(false);
      navigate('presupuestos');
    },
    onMarkRead: markRead
  }), /*#__PURE__*/React.createElement("main", {
    className: "app-page",
    "data-section": active
  }, screen), /*#__PURE__*/React.createElement(MobileBottomNav, {
    active: active,
    onNavigate: navigate,
    notifCount: notifs.length,
    onBellClick: () => setBellOpen(v => !v)
  })), drawerOpen && /*#__PURE__*/React.createElement(MobileDrawer, {
    active: active,
    onNavigate: navigate,
    user: user,
    onSignOut: signOut,
    onClose: () => setDrawer(false)
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/appV2.jsx
try { (() => {
/* App shell — router + mobile nav + drawer. */

const MOB_NAV = [{
  id: 'dashboard',
  icon: 'LayoutDashboard',
  label: 'Inicio'
}, {
  id: 'operaciones',
  icon: 'Hammer',
  label: 'Ops'
}, {
  id: 'presupuestos',
  icon: 'FileText',
  label: 'Presup.'
}, {
  id: 'clientes',
  icon: 'Users',
  label: 'Clientes'
}, {
  id: 'menu',
  icon: 'Menu',
  label: 'Más'
}];
function MobileDrawer({
  active,
  onNavigate,
  user,
  onSignOut,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "mob-drawer-overlay open",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "mob-drawer-panel",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 16px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: 32,
    variant: "dark"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: '#fff',
      fontSize: 13,
      fontWeight: 800,
      letterSpacing: '0.04em'
    }
  }, "C\xC9SAR BR\xCDTEZ"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: '#e31e24',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.18em',
      textTransform: 'uppercase'
    }
  }, "Aberturas"))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: 'rgba(255,255,255,0.50)',
      padding: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "X",
    size: 18
  })))), /*#__PURE__*/React.createElement("nav", {
    style: {
      padding: '8px 8px',
      overflowY: 'auto'
    }
  }, [{
    label: null,
    items: [{
      id: 'dashboard',
      icon: 'LayoutDashboard',
      label: 'Dashboard',
      tone: 'blue'
    }]
  }, {
    label: 'Comercial',
    items: [{
      id: 'crm',
      icon: 'GitBranch',
      label: 'CRM',
      tone: 'rose'
    }, {
      id: 'presupuestos',
      icon: 'FileText',
      label: 'Presupuestos',
      tone: 'violet'
    }, {
      id: 'operaciones',
      icon: 'Hammer',
      label: 'Operaciones',
      tone: 'amber'
    }, {
      id: 'remitos',
      icon: 'Truck',
      label: 'Remitos',
      tone: 'teal'
    }, {
      id: 'pedidos',
      icon: 'ShoppingCart',
      label: 'Pedidos',
      tone: 'lime'
    }, {
      id: 'recibos',
      icon: 'Receipt',
      label: 'Recibos',
      tone: 'emerald'
    }, {
      id: 'clientes',
      icon: 'Users',
      label: 'Clientes',
      tone: 'cyan'
    }, {
      id: 'estado',
      icon: 'BookOpen',
      label: 'Estado de Cuenta',
      tone: 'indigo'
    }]
  }, {
    label: 'Catálogo',
    items: [{
      id: 'productos',
      icon: 'Layers',
      label: 'Productos',
      tone: 'sky'
    }, {
      id: 'stock',
      icon: 'Boxes',
      label: 'Existencias',
      tone: 'orange'
    }, {
      id: 'proveedores',
      icon: 'Factory',
      label: 'Proveedores',
      tone: 'amber'
    }]
  }, {
    label: 'Sistema',
    items: [{
      id: 'reportes',
      icon: 'TrendingUp',
      label: 'Reportes',
      tone: 'purple'
    }, {
      id: 'config',
      icon: 'SlidersHorizontal',
      label: 'Configuración',
      tone: 'slate'
    }]
  }].map((group, gi) => /*#__PURE__*/React.createElement("div", {
    key: gi,
    style: {
      marginTop: gi > 0 ? 4 : 0
    }
  }, group.label && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '10px 8px 4px',
      fontSize: 9,
      fontWeight: 800,
      color: 'rgba(255,255,255,0.30)',
      textTransform: 'uppercase',
      letterSpacing: '0.14em'
    }
  }, group.label), group.items.map(item => {
    const isActive = item.id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: item.id,
      onClick: () => {
        onNavigate(item.id);
        onClose();
      },
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '9px 10px',
        borderRadius: 10,
        color: isActive ? '#fff' : 'rgba(255,255,255,0.60)',
        background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
        fontWeight: isActive ? 700 : 500,
        fontSize: 13,
        transition: 'all 150ms'
      }
    }, /*#__PURE__*/React.createElement(IconTile, {
      name: item.icon,
      tone: item.tone,
      size: "sm"
    }), item.label, isActive && /*#__PURE__*/React.createElement(Icon, {
      name: "ChevronRight",
      size: 12,
      style: {
        marginLeft: 'auto',
        opacity: 0.5
      }
    }));
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: '#e31e24',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: 11,
      fontWeight: 800
    }
  }, user?.nombre?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CB'), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: '#fff',
      fontSize: 12,
      fontWeight: 600
    }
  }, user?.nombre || 'Usuario'), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'rgba(255,255,255,0.40)',
      fontSize: 11
    }
  }, user?.rol || 'admin')), /*#__PURE__*/React.createElement("button", {
    onClick: onSignOut,
    style: {
      color: 'rgba(255,255,255,0.40)',
      padding: 4
    },
    title: "Cerrar sesi\xF3n"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "LogOut",
    size: 16
  })))));
}
function MobileBottomNav({
  active,
  onNavigate,
  notifCount,
  onBellClick
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "mob-bottom-nav"
  }, MOB_NAV.map(item => {
    const isActive = item.id !== 'menu' && item.id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: item.id,
      className: 'mob-nav-item' + (isActive ? ' active' : ''),
      onClick: () => item.id === 'menu' ? onBellClick() : onNavigate(item.id)
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: item.id === 'menu' ? notifCount > 0 ? 'Bell' : 'Menu' : item.icon,
      size: 20
    }), item.id === 'menu' && notifCount > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: -3,
        right: -5,
        width: 8,
        height: 8,
        background: '#e31e24',
        borderRadius: '50%',
        border: '1.5px solid #031d49'
      }
    })), /*#__PURE__*/React.createElement("span", null, item.label));
  }));
}
function App() {
  const [user, setUser] = React.useState(null);
  const [active, setActive] = React.useState('dashboard');
  const [bellOpen, setBellOpen] = React.useState(false);
  const [drawerOpen, setDrawer] = React.useState(false);
  const [notifs, setNotifs] = React.useState([{
    id: 'n1',
    cliente: 'Familia González',
    numero: 'PR-0042',
    monto: 1250000,
    when: 'Hace 12 min'
  }, {
    id: 'n2',
    cliente: 'Mariela Ojeda',
    numero: 'PR-0039',
    monto: 480000,
    when: 'Hace 2 h'
  }]);
  if (!user) return /*#__PURE__*/React.createElement(Login, {
    onSignIn: setUser
  });
  function navigate(id) {
    setActive(id);
    setBellOpen(false);
    setDrawer(false);
  }
  function signOut() {
    setUser(null);
    setActive('dashboard');
  }
  function markRead() {
    setNotifs([]);
  }
  let screen;
  switch (active) {
    case 'dashboard':
      screen = /*#__PURE__*/React.createElement(Dashboard, {
        user: user,
        onNavigate: navigate
      });
      break;
    case 'operaciones':
      screen = /*#__PURE__*/React.createElement(Operaciones, {
        onSelectOp: () => navigate('presupuestos')
      });
      break;
    case 'presupuestos':
      screen = /*#__PURE__*/React.createElement(Presupuestos, {
        onOpen: () => {}
      });
      break;
    case 'crm':
      screen = /*#__PURE__*/React.createElement(CRM, null);
      break;
    case 'remitos':
      screen = /*#__PURE__*/React.createElement(Remitos, null);
      break;
    case 'pedidos':
      screen = /*#__PURE__*/React.createElement(Pedidos, null);
      break;
    case 'recibos':
      screen = /*#__PURE__*/React.createElement(Recibos, null);
      break;
    case 'clientes':
      screen = /*#__PURE__*/React.createElement(Clientes, null);
      break;
    case 'estado':
      screen = /*#__PURE__*/React.createElement(Placeholder, {
        section: "estado",
        icon: "BookOpen",
        title: "Estado de Cuenta",
        sub: "Cuenta corriente por cliente",
        breadcrumb: ['Comercial', 'Estado de Cuenta']
      });
      break;
    case 'productos':
      screen = /*#__PURE__*/React.createElement(Placeholder, {
        section: "productos",
        icon: "Layers",
        title: "Productos",
        sub: "Cat\xE1logo de aberturas",
        breadcrumb: ['Catálogo', 'Productos']
      });
      break;
    case 'stock':
      screen = /*#__PURE__*/React.createElement(Placeholder, {
        section: "stock",
        icon: "Boxes",
        title: "Existencias",
        sub: "Inventario y movimientos de stock",
        breadcrumb: ['Catálogo', 'Existencias']
      });
      break;
    case 'proveedores':
      screen = /*#__PURE__*/React.createElement(Placeholder, {
        section: "proveedores",
        icon: "Factory",
        title: "Proveedores",
        sub: "Fabricantes y revendedores",
        breadcrumb: ['Catálogo', 'Proveedores']
      });
      break;
    case 'reportes':
      screen = /*#__PURE__*/React.createElement(Placeholder, {
        section: "reportes",
        icon: "TrendingUp",
        title: "Reportes",
        sub: "Ventas, conversi\xF3n, productos",
        breadcrumb: ['Sistema', 'Reportes']
      });
      break;
    case 'config':
      screen = /*#__PURE__*/React.createElement(Placeholder, {
        section: "config",
        icon: "SlidersHorizontal",
        title: "Configuraci\xF3n",
        sub: "Empresa, usuarios y cat\xE1logos",
        breadcrumb: ['Sistema', 'Configuración']
      });
      break;
    default:
      screen = null;
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "app-shell"
  }, /*#__PURE__*/React.createElement(Watermark, null), /*#__PURE__*/React.createElement(Sidebar, {
    active: active,
    onNavigate: navigate,
    user: user,
    onSignOut: signOut
  }), /*#__PURE__*/React.createElement("div", {
    className: "app-main"
  }, /*#__PURE__*/React.createElement(TopBar, {
    notifCount: notifs.length,
    onBellClick: () => setBellOpen(v => !v),
    bellOpen: bellOpen,
    onMenuClick: () => setDrawer(true)
  }), bellOpen && /*#__PURE__*/React.createElement(NotificationPanel, {
    notifs: notifs,
    onClose: () => setBellOpen(false),
    onSelect: () => {
      setBellOpen(false);
      navigate('presupuestos');
    },
    onMarkRead: markRead
  }), /*#__PURE__*/React.createElement("main", {
    className: "app-page",
    "data-section": active
  }, screen), /*#__PURE__*/React.createElement(MobileBottomNav, {
    active: active,
    onNavigate: navigate,
    notifCount: notifs.length,
    onBellClick: () => setBellOpen(v => !v)
  })), drawerOpen && /*#__PURE__*/React.createElement(MobileDrawer, {
    active: active,
    onNavigate: navigate,
    user: user,
    onSignOut: signOut,
    onClose: () => setDrawer(false)
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/appV2.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/icons.jsx
try { (() => {
/* Lucide icon registry — inline SVG paths from lucide-static.
   Stroke 2, fill none. Add new icons as needed; keep names matching
   the Lucide React component PascalCase name. */

const ICON_PATHS = {
  LayoutDashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  GitBranch: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  FileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  Hammer: '<path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>',
  Truck: '<rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  ShoppingCart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  Receipt: '<path d="M2 17h2.5a2 2 0 0 0 1.4-.6L7 16h10l1.1 1.4a2 2 0 0 0 1.4.6H22"/><path d="M2 8v9M22 8v9M5 8h14"/><path d="M8 12h8M8 5h8"/>',
  Users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  BookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  Layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  Boxes: '<path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5l-5.03-3.04a2 2 0 0 0-2.06 0z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 13V8.5a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8A2 2 0 0 0 2 8.5v3.24"/><path d="M21.03 12.92A2 2 0 0 1 22 14.63v3.24a2 2 0 0 1-.97 1.71l-3 1.8a2 2 0 0 1-2.06 0L12 19v-5l5.03-3.04a2 2 0 0 1 2.06 0z"/><path d="m17 16.5 4.74-2.85"/><path d="m17 16.5-5-3"/><path d="M17 16.5v5.17"/>',
  Factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>',
  TrendingUp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  SlidersHorizontal: '<line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/>',
  Bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  CheckCircle2: '<circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>',
  AlertTriangle: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  XCircle: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  X: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  Plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  ChevronRight: '<polyline points="9 18 15 12 9 6"/>',
  ChevronDown: '<polyline points="6 9 12 15 18 9"/>',
  Phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  Mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  MessageCircle: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  CalendarClock: '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4M8 2v4M3 10h5"/><circle cx="17" cy="17" r="5"/><path d="M17 14v3h2"/>',
  Clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  DollarSign: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  Package: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  Target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  BarChart3: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  Activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  Lightbulb: '<path d="M9 21h6"/><path d="M12 17v4"/><path d="M12 3a6 6 0 0 0-4 10.5c.6.5 1 1.3 1 2.5h6c0-1.2.4-2 1-2.5A6 6 0 0 0 12 3z"/>',
  Sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>',
  LogOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  Search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  Menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  Eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  Share2: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  Pencil: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  Filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  Zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  ClipboardCheck: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  ShoppingBag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>'
};
function Icon({
  name,
  size = 16,
  color,
  className = '',
  style = {},
  strokeWidth = 2
}) {
  const body = ICON_PATHS[name];
  if (!body) return null;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color || 'currentColor',
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className,
    style: style,
    dangerouslySetInnerHTML: {
      __html: body
    }
  });
}
window.Icon = Icon;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/icons.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/primitives.jsx
try { (() => {
/* Primitives — LogoMark, Watermark, IconTile, Pill, Card, Button, KpiTile.
   All globals on window so other JSX files can use them. */

// ── Brand mark — 2×2 rounded squares ───────────────────────────────
function LogoMark({
  size = 32,
  variant = 'dark' /* dark | color */
}) {
  // 'dark' uses the navy-bg variant (white/red/translucent whites).
  // 'color' uses the brand-sheet colours (navy/red/white/black).
  const gap = Math.round(size * 0.083);
  const sq = Math.round((size - gap * 3) / 2);
  const r = Math.round(sq * 0.22);
  const fills = variant === 'color' ? ['#031d49', '#e31e24', '#fcfcfc', '#000000'] : ['rgba(255,255,255,0.90)', '#e31e24', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.20)'];
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    fill: "none",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("rect", {
    x: gap,
    y: gap,
    width: sq,
    height: sq,
    rx: r,
    fill: fills[0],
    stroke: variant === 'color' ? '#d1d5db' : 'none',
    strokeWidth: variant === 'color' ? 1 : 0
  }), /*#__PURE__*/React.createElement("rect", {
    x: gap * 2 + sq,
    y: gap,
    width: sq,
    height: sq,
    rx: r,
    fill: fills[1]
  }), /*#__PURE__*/React.createElement("rect", {
    x: gap,
    y: gap * 2 + sq,
    width: sq,
    height: sq,
    rx: r,
    fill: fills[2]
  }), /*#__PURE__*/React.createElement("rect", {
    x: gap * 2 + sq,
    y: gap * 2 + sq,
    width: sq,
    height: sq,
    rx: r,
    fill: fills[3]
  }));
}

// ── Watermark — fixed full-bleed brand layer for the app shell ─────
function Watermark() {
  return /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      backgroundImage: `
            repeating-linear-gradient(90deg, transparent 0, transparent 149px, rgba(3,29,73,0.038) 149px, rgba(3,29,73,0.038) 150px),
            repeating-linear-gradient( 0deg, transparent 0, transparent 149px, rgba(3,29,73,0.038) 149px, rgba(3,29,73,0.038) 150px)
          `
    }
  }), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 200 200",
    fill: "none",
    style: {
      position: 'absolute',
      right: '6%',
      bottom: '8%',
      width: 340,
      height: 340,
      opacity: 0.072,
      filter: 'blur(0.5px)'
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "8",
    y: "8",
    width: "84",
    height: "84",
    rx: "14",
    fill: "#031d49"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "108",
    y: "8",
    width: "84",
    height: "84",
    rx: "14",
    fill: "#031d49"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "8",
    y: "108",
    width: "84",
    height: "84",
    rx: "14",
    fill: "#031d49"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "108",
    y: "108",
    width: "84",
    height: "84",
    rx: "14",
    fill: "#031d49"
  })), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 200 200",
    fill: "none",
    style: {
      position: 'absolute',
      left: '20%',
      top: '12%',
      width: 140,
      height: 140,
      opacity: 0.038,
      filter: 'blur(0.4px)'
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "8",
    y: "8",
    width: "84",
    height: "84",
    rx: "14",
    fill: "#031d49"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "108",
    y: "8",
    width: "84",
    height: "84",
    rx: "14",
    fill: "#031d49"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "8",
    y: "108",
    width: "84",
    height: "84",
    rx: "14",
    fill: "#031d49"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "108",
    y: "108",
    width: "84",
    height: "84",
    rx: "14",
    fill: "#031d49"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: '3%',
      bottom: '5%',
      width: 420,
      height: 420,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(227,30,36,0.055) 0%, transparent 65%)'
    }
  }));
}

// ── Icon tile (rounded coloured backing for a Lucide icon) ─────────
function IconTile({
  name,
  size = 'lg',
  tone = 'navy',
  iconSize,
  className = '',
  style = {}
}) {
  // tones map to the section accent system. Each is a {bg, fg} pair
  // following Tailwind's 100/600 (or 100/700 for high contrast).
  const TONES = {
    navy: {
      bg: '#e0e7ef',
      fg: '#031d49'
    },
    blue: {
      bg: '#dbeafe',
      fg: '#1d4ed8'
    },
    rose: {
      bg: '#ffe4e6',
      fg: '#be123c'
    },
    violet: {
      bg: '#ede9fe',
      fg: '#6d28d9'
    },
    amber: {
      bg: '#fef3c7',
      fg: '#b45309'
    },
    teal: {
      bg: '#ccfbf1',
      fg: '#0f766e'
    },
    lime: {
      bg: '#ecfccb',
      fg: '#4d7c0f'
    },
    emerald: {
      bg: '#d1fae5',
      fg: '#047857'
    },
    cyan: {
      bg: '#cffafe',
      fg: '#0e7490'
    },
    indigo: {
      bg: '#e0e7ff',
      fg: '#4338ca'
    },
    sky: {
      bg: '#e0f2fe',
      fg: '#0369a1'
    },
    orange: {
      bg: '#ffedd5',
      fg: '#c2410c'
    },
    purple: {
      bg: '#f3e8ff',
      fg: '#7e22ce'
    },
    slate: {
      bg: '#f1f5f9',
      fg: '#475569'
    },
    gray: {
      bg: '#f3f4f6',
      fg: '#4b5563'
    },
    red: {
      bg: '#fee2e2',
      fg: '#b91c1c'
    },
    green: {
      bg: '#dcfce7',
      fg: '#15803d'
    }
  };
  const t = TONES[tone] || TONES.gray;
  const sz = {
    sm: 28,
    md: 32,
    lg: 40,
    xl: 48
  }[size] ?? 40;
  const isz = iconSize ?? (size === 'sm' ? 13 : size === 'md' ? 15 : size === 'xl' ? 22 : 18);
  const r = size === 'sm' ? 8 : size === 'xl' ? 14 : 10;
  return /*#__PURE__*/React.createElement("div", {
    className: 'ic-tile ' + className,
    style: {
      width: sz,
      height: sz,
      borderRadius: r,
      background: t.bg,
      color: t.fg,
      ...style
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: name,
    size: isz
  }));
}

// ── Pill ────────────────────────────────────────────────────────────
function Pill({
  tone = 'gray',
  dot = false,
  children,
  style = {}
}) {
  const TONES = {
    gray: {
      bg: '#f3f4f6',
      fg: '#4b5563'
    },
    blue: {
      bg: '#dbeafe',
      fg: '#1d4ed8'
    },
    emerald: {
      bg: '#d1fae5',
      fg: '#047857'
    },
    amber: {
      bg: '#fef3c7',
      fg: '#b45309'
    },
    teal: {
      bg: '#ccfbf1',
      fg: '#0f766e'
    },
    bluish: {
      bg: '#bfdbfe',
      fg: '#1e3a8a'
    },
    red: {
      bg: '#fee2e2',
      fg: '#b91c1c'
    },
    violet: {
      bg: '#ede9fe',
      fg: '#6d28d9'
    },
    rose: {
      bg: '#ffe4e6',
      fg: '#be123c'
    }
  };
  const t = TONES[tone] || TONES.gray;
  return /*#__PURE__*/React.createElement("span", {
    className: 'pill' + (dot ? ' pill-dot' : ''),
    style: {
      background: t.bg,
      color: t.fg,
      ...style
    }
  }, children);
}

// ── Card primitives ─────────────────────────────────────────────────
function Card({
  children,
  className = '',
  tight = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: 'card ' + (tight ? 'card-tight ' : '') + className,
    style: style
  }, children);
}
function CardHeader({
  icon,
  iconTone = 'navy',
  title,
  sub,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2",
    style: {
      marginBottom: 12
    }
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 15,
    style: {
      color: iconToneFg(iconTone),
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("h2", {
    className: "h-section"
  }, title), sub && /*#__PURE__*/React.createElement("span", {
    className: "meta",
    style: {
      marginLeft: 4
    }
  }, sub), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto'
    }
  }, action));
}
function iconToneFg(t) {
  return {
    navy: '#031d49',
    red: '#e31e24',
    amber: '#f59e0b',
    blue: '#3b82f6',
    emerald: '#10b981',
    rose: '#fb7185',
    violet: '#8b5cf6',
    teal: '#14b8a6',
    purple: '#a855f7',
    orange: '#fb923c',
    slate: '#94a3b8',
    gray: '#6b7280',
    cyan: '#06b6d4',
    sky: '#0ea5e9',
    lime: '#84cc16',
    indigo: '#6366f1',
    green: '#22c55e'
  }[t] || '#6b7280';
}

// ── Button ──────────────────────────────────────────────────────────
function Button({
  variant = 'brand',
  size = 'md',
  icon,
  iconAfter,
  children,
  onClick,
  type = 'button',
  disabled,
  style = {}
}) {
  const cls = `btn ${size === 'sm' ? 'btn-sm ' : ''}btn-${variant}`;
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    onClick: onClick,
    disabled: disabled,
    className: cls,
    style: {
      opacity: disabled ? 0.6 : 1,
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: size === 'sm' ? 12 : 14
  }), children, iconAfter && /*#__PURE__*/React.createElement(Icon, {
    name: iconAfter,
    size: size === 'sm' ? 12 : 14
  }));
}

// ── KPI tile ────────────────────────────────────────────────────────
function KpiTile({
  label,
  value,
  sub,
  icon,
  tone = 'blue',
  progress,
  progressColor
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "card card-tight",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("p", {
    className: "meta",
    style: {
      fontWeight: 500,
      color: '#6b7280',
      lineHeight: 1.3
    }
  }, label), icon && /*#__PURE__*/React.createElement(IconTile, {
    name: icon,
    size: "md",
    tone: tone
  })), /*#__PURE__*/React.createElement("p", {
    className: "money",
    style: {
      fontSize: 22,
      lineHeight: 1,
      letterSpacing: '-0.01em'
    }
  }, value), progress != null && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-fill",
    style: {
      background: progressColor || iconToneFg(tone),
      width: `${Math.min(progress, 100)}%`
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      color: progressColor || iconToneFg(tone)
    },
    className: "tabular"
  }, progress, "%")), sub && /*#__PURE__*/React.createElement("p", {
    className: "meta"
  }, sub));
}

// ── Format helpers ──────────────────────────────────────────────────
function formatCurrency(v) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0
  }).format(v);
}
function fmtRel(ms) {
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return 'Ahora mismo';
  if (min < 60) return `Hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24) return `Hace ${hs} h`;
  return `Hace ${Math.floor(hs / 24)} d`;
}
Object.assign(window, {
  LogoMark,
  Watermark,
  IconTile,
  Pill,
  Card,
  CardHeader,
  Button,
  KpiTile,
  iconToneFg,
  formatCurrency,
  fmtRel
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/primitives.jsx", error: String((e && e.message) || e) }); }

})();
