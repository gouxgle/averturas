import { describe, it, expect } from 'vitest';
import { combinarNombre, separarNombre } from '@/pages/NuevoCliente';

// El formulario de cliente muestra un solo campo "nombre completo" y lo parte en
// apellido + nombre al guardar. Lo que importa es que ese viaje de ida y vuelta no
// pierda nada: durante un tiempo combinarNombre unía con espacio y separarNombre
// partía en la primera palabra, así que editar y guardar un cliente con apellido
// compuesto le rompía el apellido sin que nadie lo tocara.
describe('nombre de cliente — ida y vuelta', () => {
  const casos: [string, string][] = [
    ['Garcia', 'Juan Jose'],
    ['Ruiz Diaz', 'Ana Liz'],       // apellido compuesto: el caso que se rompía
    ['De la Fuente', 'Maria'],
    ['Lopez', 'Diego'],
    ['Perez', ''],                  // sin nombre
  ];

  it.each(casos)('apellido="%s" nombre="%s" sobrevive a editar y guardar', (apellido, nombre) => {
    const completo = combinarNombre(apellido, nombre || null);
    expect(separarNombre(completo)).toEqual({ apellido, nombre });
  });

  it('lo que se muestra usa la coma, igual que el resto del sistema', () => {
    expect(combinarNombre('Garcia', 'Juan Jose')).toBe('Garcia, Juan Jose');
  });

  it('sin coma sigue partiendo en la primera palabra (alta escribiendo a mano)', () => {
    expect(separarNombre('Lopez Diego')).toEqual({ apellido: 'Lopez', nombre: 'Diego' });
  });
});
