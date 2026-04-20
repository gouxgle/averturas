export type TipoOperacion = 'estandar' | 'a_medida_proveedor' | 'fabricacion_propia';
export type EstadoOperacion =
  | 'presupuesto'
  | 'enviado'
  | 'aprobado'
  | 'en_produccion'
  | 'listo'
  | 'instalado'
  | 'entregado'
  | 'cancelado';

export type AppRole = 'admin' | 'vendedor' | 'consulta';

export interface Profile {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  role: AppRole;
  activo: boolean;
  created_at: string;
}

export interface CategoriaCliente {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
}

export type EstadoCliente = 'prospecto' | 'activo' | 'recurrente' | 'inactivo' | 'perdido';
export type TipoInteraccion = 'nota' | 'llamada' | 'visita' | 'whatsapp' | 'email' | 'presupuesto_enviado' | 'operacion_completada' | 'reclamo' | 'garantia';
export type PrioridadTarea = 'alta' | 'normal' | 'baja';

export interface Cliente {
  id: string;
  tipo_persona: 'fisica' | 'juridica';
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  documento_nro: string | null;
  telefono: string | null;
  telefono_fijo: string | null;
  email: string | null;
  direccion: string | null;
  localidad: string | null;
  categoria_id: string | null;
  categoria?: CategoriaCliente;
  estado: EstadoCliente;
  origen: string | null;
  fecha_nacimiento: string | null;
  genero: 'masculino' | 'femenino' | 'otro' | null;
  preferencia_contacto: 'whatsapp' | 'llamada' | 'email' | 'visita' | null;
  acepta_marketing: boolean;
  referido_por_id: string | null;
  referido_por?: { id: string; apellido: string | null; nombre: string | null; razon_social: string | null; tipo_persona: string } | null;
  notas: string | null;
  ultima_interaccion: string | null;
  dias_sin_contacto: number | null;
  valor_total_historico: number;
  operaciones_count?: number;
  activo: boolean;
  created_at: string;
}

export interface Interaccion {
  id: string;
  cliente_id: string;
  tipo: TipoInteraccion;
  descripcion: string;
  created_at: string;
  created_by_usuario?: { nombre: string } | null;
}

export interface Tarea {
  id: string;
  cliente_id: string;
  descripcion: string;
  vencimiento: string | null;
  prioridad: PrioridadTarea;
  completada: boolean;
  completada_at: string | null;
  created_at: string;
  created_by_usuario?: { nombre: string } | null;
  cliente?: { id: string; nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
}

export interface TipoAbertura {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  activo: boolean;
}

export interface Sistema {
  id: string;
  nombre: string;
  material: string | null;
  proveedor_id: string | null;
  proveedor?: Proveedor;
  descripcion: string | null;
  activo: boolean;
}

export interface Proveedor {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  notas: string | null;
  activo: boolean;
}

export interface OperacionItem {
  id: string;
  operacion_id: string;
  orden: number;
  tipo_abertura_id: string | null;
  tipo_abertura?: TipoAbertura;
  sistema_id: string | null;
  sistema?: Sistema;
  descripcion: string;
  medida_ancho: number | null;
  medida_alto: number | null;
  ancho: number | null;
  alto: number | null;
  cantidad: number;
  costo_unitario: number;
  precio_unitario: number;
  precio_total: number;
  incluye_instalacion: boolean;
  notas: string | null;
}

export interface Operacion {
  id: string;
  numero: string;
  tipo: TipoOperacion;
  estado: EstadoOperacion;
  cliente_id: string;
  cliente?: Cliente;
  vendedor_id: string | null;
  vendedor?: Profile;
  items?: OperacionItem[];
  proveedor_id: string | null;
  proveedor?: Proveedor;
  costo_total: number;
  precio_total: number;
  margen: number;
  incluye_instalacion: boolean;
  fecha_validez: string | null;
  fecha_entrega_estimada: string | null;
  notas: string | null;
  notas_internas: string | null;
  created_at: string;
  updated_at: string;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoOperacion;
  tipo_abertura_id: string | null;
  tipo_abertura?: TipoAbertura;
  sistema_id: string | null;
  sistema?: Sistema;
  ancho: number | null;
  alto: number | null;
  costo_base: number;
  precio_base: number;
  precio_por_m2: boolean;
  activo: boolean;
  created_at: string;
}

export interface DashboardStats {
  presupuestos_hoy: number;
  ventas_mes: number;
  monto_mes: number;
  conversion_rate: number;
  presupuestos_pendientes: number;
}
