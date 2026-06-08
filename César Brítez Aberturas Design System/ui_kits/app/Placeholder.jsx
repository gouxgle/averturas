/* Placeholder — for sidebar items we don't fully implement.
   Uses the SectionHero so wayfinding stays consistent. */

function Placeholder({ section, icon, title, sub, breadcrumb }) {
  return (
    <React.Fragment>
      <SectionHero
        section={section}
        icon={icon}
        breadcrumb={breadcrumb || ['Sistema', title]}
        title={title}
        sub={sub}
      />
      <div className="app-page-inner">
        <Card style={{ padding: 56, textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: 'rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
          }}>
            <Icon name={icon} size={32} color={sectionDeep(section)} />
          </div>
          <p style={{ marginTop: 16, fontSize: 16, fontWeight: 800, color: '#1f2937' }}>{title}</p>
          <p style={{ marginTop: 6, fontSize: 13, color: '#6b7280', maxWidth: 480, margin: '6px auto 0', lineHeight: 1.5 }}>
            Esta sección está disponible en el sistema en producción. El UI kit cubre los patrones
            principales en Dashboard, Operaciones y Presupuestos — todas las secciones comparten esta
            misma estructura visual: hero coloreado, banda de métricas y zona operativa.
          </p>
        </Card>
      </div>
    </React.Fragment>
  );
}

window.Placeholder = Placeholder;
