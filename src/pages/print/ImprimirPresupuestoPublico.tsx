import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ProformaDocumento, type Empresa, type Operacion } from './ImprimirPresupuesto';

interface PubPresupuesto extends Operacion {
  empresa: Empresa;
  revision: { numero: number; enviada_at: string; es_ultima: boolean };
}

// Loader público: /p/:token/imprimir — PDF de la revisión exacta que ve ese
// link (nunca el estado vivo), sin sesión. Usa /pub/presupuesto/:token, que ya
// resuelve el token contra operacion_revisiones y trae `empresa` viva.
export function ImprimirPresupuestoPublico() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PubPresupuesto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/pub/presupuesto/${token}`)
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? 'Error')))
      .then(setData)
      .catch(e => setError(String(e)));
  }, [token]);

  if (error) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#aaa', fontFamily:'Arial' }}>
      {error}
    </div>
  );
  if (!data) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#aaa', fontFamily:'Arial' }}>
      Cargando...
    </div>
  );

  const { empresa, revision, ...op } = data;
  return (
    <ProformaDocumento
      op={op}
      empresa={empresa}
      revisionFijada={{ numero: revision.numero, enviada_at: revision.enviada_at }}
    />
  );
}
