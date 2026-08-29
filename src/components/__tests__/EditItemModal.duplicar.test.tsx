import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { EditItemModal, type EditableItemSpec } from '@/components/EditItemModal';

// Reproduce el mismo patrón de estado que usa NuevoPresupuesto.tsx: items en un array,
// updateItem por _key, duplicarItem inserta una copia y abre el modal sobre ella.
function Harness({ itemInicial }: { itemInicial: EditableItemSpec }) {
  const [items, setItems] = useState<EditableItemSpec[]>([itemInicial]);
  const [editKey, setEditKey] = useState<string | null>(itemInicial._key);

  function onChange(key: string, field: keyof EditableItemSpec, value: unknown) {
    setItems(prev => prev.map(it => it._key === key ? { ...it, [field]: value } : it));
  }

  function duplicarItem(key: string) {
    const original = items.find(it => it._key === key);
    if (!original) return;
    const copia: EditableItemSpec = {
      ...original,
      _key: 'copia-key',
      medida_ancho: '', medida_alto: '',
      costo_unitario: 0, precio_unitario: 0,
      calculo_url: '',
      accesorios: [...original.accesorios],
      _atribAbrev: { ...original._atribAbrev },
    };
    setItems(prev => [...prev, copia]);
    setEditKey(copia._key);
  }

  const item = items.find(it => it._key === editKey);
  if (!item) return null;

  return (
    <EditItemModal
      item={item}
      tiposAbertura={[{ id: 'tipo-ventana', nombre: 'Ventana' } as any]}
      sistemas={[{ id: 'sist-modena', nombre: 'Módena' } as any]}
      coloresDB={[{ id: 'c1', nombre: 'Blanco' }]}
      onChange={onChange}
      onClose={() => {}}
      onDuplicar={duplicarItem}
    />
  );
}

function itemCompleto(): EditableItemSpec {
  return {
    _key: 'orig-key',
    tipo_item: 'a_medida',
    tipo_abertura_id: 'tipo-ventana',
    sistema_id: 'sist-modena',
    descripcion: 'Ventana aluminio blanco',
    color: 'Blanco',
    vidrio: 'DVH',
    premarco: false,
    accesorios: ['Herrajes completos'],
    calculo_url: '/uploads/calculo-original.webp',
    _atribAbrev: {},
    cantidad: 1,
    costo_unitario: 85000,
    precio_unitario: 145000,
    incluye_instalacion: true,
    precio_instalacion: 5000,
    medida_ancho: '1.2',
    medida_alto: '2.05',
  };
}

describe('Duplicar ítem — EditItemModal', () => {
  it('el ítem original se ve con sus datos cargados', () => {
    render(<Harness itemInicial={itemCompleto()} />);
    expect(screen.getByDisplayValue('Ventana aluminio blanco')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2.05')).toBeInTheDocument();
  });

  it('al duplicar, hereda tipo/sistema/descripción/color/vidrio/instalación y limpia solo medida+precio+cálculo', () => {
    render(<Harness itemInicial={itemCompleto()} />);

    fireEvent.click(screen.getByText('Duplicar ítem'));

    // Heredado — debe seguir viéndose en el modal de la copia
    expect(screen.getByDisplayValue('Ventana aluminio blanco')).toBeInTheDocument();
    // Orden real de los <select> en EspecificacionesAbertura: Tipo abertura, Sistema,
    // Instalación, Color, Vidrio (Premarco no aparece: hay categoriaItem detectado).
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const [selTipo, selSistema, selInstalacion, selColor, selVidrio] = selects;
    expect(selTipo.value).toBe('tipo-ventana');
    expect(selSistema.value).toBe('sist-modena');
    expect(selInstalacion.value).toBe('si');
    expect(selColor.value).toBe('Blanco');
    expect(selVidrio.value).toBe('DVH');
    expect(screen.getByRole('checkbox', { name: /Herrajes completos/i })).toBeChecked();

    // Limpiado a propósito — medida y precio, para completar aparte
    const ancho = screen.getByPlaceholderText('1.20') as HTMLInputElement;
    const alto  = screen.getByPlaceholderText('2.05') as HTMLInputElement;
    expect(ancho.value).toBe('');
    expect(alto.value).toBe('');
    expect(screen.queryByDisplayValue('85.000')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('145.000')).not.toBeInTheDocument();
    expect(screen.queryByText('Imagen adjuntada')).not.toBeInTheDocument();
  });
});
