import { useState, useEffect } from 'react';

interface MontoInputProps {
  value: string;
  onChange: (raw: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Input de monto con separador de miles en tiempo real (formato es-AR).
 * value/onChange operan con string numérico puro ("1000000.50").
 * Display: "1.000.000,50"
 */
export function MontoInput({ value, onChange, className, placeholder = '0,00', disabled }: MontoInputProps) {
  function toDisplay(raw: string) {
    if (!raw) return '';
    const [int, dec] = raw.replace(',', '.').split('.');
    const intFmt = (int || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return dec !== undefined ? `${intFmt},${dec}` : intFmt;
  }

  const [display, setDisplay] = useState(() => toDisplay(value));

  // Sync cuando el padre actualiza value externamente (ej: preload desde API)
  useEffect(() => { setDisplay(toDisplay(value)); }, [value]); // eslint-disable-line

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const stripped = e.target.value.replace(/\./g, '').replace(',', '.');
    const digits   = stripped.replace(/[^\d.]/g, '');
    const [int, dec] = digits.split('.');
    const intFmt   = (int || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setDisplay(dec !== undefined ? `${intFmt},${dec}` : intFmt);
    onChange(digits || '');
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
