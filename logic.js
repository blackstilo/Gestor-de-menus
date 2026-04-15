import { initDB, set, STATE_STORE, IMAGES_STORE } from './db.js';

export const STORAGE_V2 = 'gestorMenus_v2_state';
export const STORAGE_V1 = {
  platos: 'gestorMenus_platos',
  calendario: 'gestorMenus_calendario',
  listaCompra: 'gestorMenus_listaCompra',
  periodo: 'gestorMenus_periodo'
};

const estadoProxy = new Proxy(
  {},
  {
    get(_, prop) {
      return window.estado ? window.estado[prop] : undefined;
    },
    set(_, prop, value) {
      if (window.estado) {
        window.estado[prop] = value;
      }
      return true;
    },
    has(_, prop) {
      return window.estado ? prop in window.estado : false;
    }
  }
);

export const estado = estadoProxy;

function proxyCall(name, ...args) {
  const fn = window[name];
  if (typeof fn === 'function') {
    return fn(...args);
  }
  console.warn(`Función ${name} no está disponible.`);
  return undefined;
}

export function escapeHTML(valor) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function platosOrdenados() {
  return proxyCall('platosOrdenados');
}

export function obtenerPlanActual() {
  return proxyCall('obtenerPlanActual');
}

export function obtenerIdsDesdeAsignacion(asignacion) {
  return proxyCall('obtenerIdsDesdeAsignacion', asignacion);
}

export function guardarEstado() {
  return proxyCall('guardarEstado');
}

export function crearId() {
  return proxyCall('crearId');
}

export function normalizarTexto(valor) {
  return proxyCall('normalizarTexto', valor);
}

export function obtenerLunesDeEstaSemana(fecha = new Date()) {
  const d = new Date(fecha);
  const dia = d.getDay();
  const diff = (dia === 0 ? -6 : 1) - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function optimizarImagenArchivo(...params) {
  return proxyCall('optimizarImagenArchivo', ...params);
}

export function formatearRangoPeriodo() {
  return proxyCall('formatearRangoPeriodo');
}

export function eliminarPlato(id) {
  return proxyCall('eliminarPlato', id);
}

export function generarListaCompraDesdePlanActual() {
  return proxyCall('generarListaCompraDesdePlanActual');
}

export function limpiarListaCompra() {
  return proxyCall('limpiarListaCompra');
}

export function obtenerTextoListaCompra() {
  return proxyCall('obtenerTextoListaCompra');
}

export function moverPlatoEnPlanificador(origenClave, destinoClave, platoId, nuevoIndice) {
  const plan = obtenerPlanActual();
  if (!plan.asignaciones) plan.asignaciones = {};

  if (plan.asignaciones[origenClave] && plan.asignaciones[origenClave].platos) {
    plan.asignaciones[origenClave].platos = plan.asignaciones[origenClave].platos.filter((id) => id !== platoId);
  }

  if (!plan.asignaciones[destinoClave]) plan.asignaciones[destinoClave] = { platos: [] };
  if (!plan.asignaciones[destinoClave].platos) plan.asignaciones[destinoClave].platos = [];

  plan.asignaciones[destinoClave].platos.splice(nuevoIndice, 0, platoId);

  guardarEstado();
}

function idsDesdeCeldaPlan(asignacion) {
  if (!asignacion) return [];
  if (Array.isArray(asignacion.platos)) return asignacion.platos.filter(Boolean);
  if (asignacion.idPlato) return [asignacion.idPlato];
  return [];
}

function extraerEstadoDePayloadBackup(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.estado && data.estado.platos && data.estado.platos.porId) return data.estado;
  if (data.platos && data.platos.porId) return data;
  return null;
}

function fusionarEstadoConBackup(actual, backupEstado) {
  if (!backupEstado || !backupEstado.platos || !backupEstado.platos.porId) return;

  const porId = { ...actual.platos.porId };
  const ordenActual = [...(actual.platos.orden || [])];
  const ordenBackup = Array.isArray(backupEstado.platos.orden) ? backupEstado.platos.orden : [];

  Object.keys(backupEstado.platos.porId).forEach((id) => {
    const p = backupEstado.platos.porId[id];
    if (p && typeof p === 'object') {
      porId[id] = JSON.parse(JSON.stringify(p));
    }
  });

  const nuevoOrden = [];
  ordenBackup.forEach((id) => {
    if (porId[id] && !nuevoOrden.includes(id)) nuevoOrden.push(id);
  });
  ordenActual.forEach((id) => {
    if (porId[id] && !nuevoOrden.includes(id)) nuevoOrden.push(id);
  });
  Object.keys(porId).forEach((id) => {
    if (!nuevoOrden.includes(id)) nuevoOrden.push(id);
  });

  actual.platos.porId = porId;
  actual.platos.orden = nuevoOrden;

  if (backupEstado.planes && typeof backupEstado.planes === 'object') {
    if (!actual.planes) actual.planes = {};
    Object.keys(backupEstado.planes).forEach((clavePeriodo) => {
      const planB = backupEstado.planes[clavePeriodo];
      if (!planB || !planB.asignaciones) return;
      if (!actual.planes[clavePeriodo]) actual.planes[clavePeriodo] = { asignaciones: {} };
      const dest = actual.planes[clavePeriodo].asignaciones;
      Object.keys(planB.asignaciones).forEach((cellKey) => {
        const a = idsDesdeCeldaPlan(dest[cellKey]);
        const b = idsDesdeCeldaPlan(planB.asignaciones[cellKey]);
        const union = [...new Set([...a, ...b].filter(Boolean))];
        if (union.length) dest[cellKey] = { platos: union };
      });
    });
  }

  if (!actual.listaCompra) actual.listaCompra = { items: [] };
  if (!Array.isArray(actual.listaCompra.items)) actual.listaCompra.items = [];
  const vistos = new Set(
    actual.listaCompra.items.map((it) => (it.texto || '').trim().toLowerCase()).filter(Boolean)
  );
  (backupEstado.listaCompra?.items || []).forEach((item) => {
    const t = (item.texto || '').trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (vistos.has(k)) return;
    vistos.add(k);
    actual.listaCompra.items.push({
      id: proxyCall('crearId'),
      texto: t,
      marcado: !!item.marcado
    });
  });
}

function descargarArchivoFile(file) {
  const url = URL.createObjectURL(file);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = file.name;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

// --- Ingredientes: parseo y lista de la compra (lógica pura, sin depender del estado) ---

const RE_INGREDIENTE_INICIO = /^(\d+(?:[.,]\d+)?)\s*([a-zA-ZáéíóúÁÉÍÓÚ]+)?\s*(.*)$/;

const UNIDAD_A_CANON = {
  g: 'g',
  gr: 'g',
  gramo: 'g',
  gramos: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  ml: 'ml',
  l: 'l',
  lt: 'l',
  litro: 'l',
  litros: 'l',
  bote: 'bote',
  botes: 'bote',
  ud: 'unidad',
  uds: 'unidad',
  u: 'unidad',
  unidad: 'unidad',
  unidades: 'unidades'
};

function normalizarPalabraClave(palabra) {
  return (palabra || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizarNombreAgrupacion(texto) {
  return (texto || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function esUnidadConocida(palabra) {
  const k = normalizarPalabraClave(palabra);
  return k && Object.prototype.hasOwnProperty.call(UNIDAD_A_CANON, k);
}

function canonUnidad(palabra) {
  const k = normalizarPalabraClave(palabra);
  return UNIDAD_A_CANON[k] || '';
}

function limpiarConectoresNombre(resto) {
  let t = (resto || '').trim();
  for (let i = 0; i < 12; i += 1) {
    const siguiente = t
      .replace(/^(de\s+los|de|del|la|el|los|las)\s+/i, '')
      .trim();
    if (siguiente === t) break;
    t = siguiente;
  }
  return t;
}

function quitarNumeroDuplicadoAlInicio(nombre) {
  return (nombre || '').replace(/^(\d+(?:[.,]\d+)?)\s+/, '').trim();
}

/**
 * Parsea un ingrediente según regex inicial de cantidad y unidad opcional.
 * @returns {{ cantidad: number, unidad: string, nombreLimpio: string, nombreNormalizado: string }}
 */
export function parsearIngrediente(texto) {
  const original = (texto || '').toString().replace(/\s+/g, ' ').trim();
  if (!original) {
    return null;
  }

  if (!/^\d/.test(original)) {
    const nombreLimpio = limpiarConectoresNombre(original);
    const nombreNormalizado = normalizarNombreAgrupacion(nombreLimpio);
    if (!nombreNormalizado) return null;
    return {
      cantidad: 1,
      unidad: 'generico',
      nombreLimpio,
      nombreNormalizado
    };
  }

  const m = original.match(RE_INGREDIENTE_INICIO);
  if (!m) {
    const nombreLimpio = limpiarConectoresNombre(original);
    return {
      cantidad: 1,
      unidad: 'generico',
      nombreLimpio,
      nombreNormalizado: normalizarNombreAgrupacion(nombreLimpio)
    };
  }

  const n = parseFloat((m[1] || '').replace(',', '.'));
  const cantidad = !Number.isFinite(n) || n <= 0 ? 1 : n;
  const palabra2 = (m[2] || '').trim();
  const restoBruto = (m[3] || '').trim();

  let nombreParte;
  let unidad;

  if (palabra2 && esUnidadConocida(palabra2)) {
    unidad = canonUnidad(palabra2);
    nombreParte = limpiarConectoresNombre(restoBruto);
    nombreParte = quitarNumeroDuplicadoAlInicio(nombreParte);
  } else {
    unidad = 'unidades';
    nombreParte = [palabra2, restoBruto].filter(Boolean).join(' ').trim();
    nombreParte = limpiarConectoresNombre(nombreParte);
    nombreParte = quitarNumeroDuplicadoAlInicio(nombreParte);
  }

  if (!nombreParte) {
    nombreParte = original;
  }

  const nombreNormalizado = normalizarNombreAgrupacion(nombreParte);
  if (!nombreNormalizado) return null;

  return {
    cantidad,
    unidad,
    nombreLimpio: nombreParte,
    nombreNormalizado
  };
}

function numeroLegibleLista(valor) {
  const redondeado = Math.round(valor * 100) / 100;
  return Number.isInteger(redondeado) ? String(redondeado) : redondeado.toFixed(2).replace(/\.?0+$/, '');
}

function convertirAUnidadBase(cantidad, unidadCanon) {
  if (unidadCanon === 'kg') return { cantidadBase: cantidad * 1000, unidadBase: 'g' };
  if (unidadCanon === 'l') return { cantidadBase: cantidad * 1000, unidadBase: 'ml' };
  return { cantidadBase: cantidad, unidadBase: unidadCanon };
}

function obtenerGrupoUnidad(unidadCanon) {
  if (unidadCanon === 'g' || unidadCanon === 'kg') return 'masa';
  if (unidadCanon === 'ml' || unidadCanon === 'l') return 'volumen';
  return 'otros';
}

/**
 * Devuelve estructura para acumulación en la lista de la compra (compatible con app.js).
 */
export function extraerIngredienteParaListaCompra(texto) {
  const parsed = parsearIngrediente(texto);
  if (!parsed || !parsed.nombreNormalizado) return null;

  let unidadCanon = parsed.unidad;
  if (unidadCanon === 'generico' || unidadCanon === 'unidades') {
    unidadCanon = 'unidad';
  }

  const grupo = obtenerGrupoUnidad(unidadCanon === 'unidad' ? 'unidad' : unidadCanon);
  const conv =
    grupo === 'masa' || grupo === 'volumen'
      ? convertirAUnidadBase(parsed.cantidad, unidadCanon)
      : { cantidadBase: parsed.cantidad, unidadBase: unidadCanon };

  const claveUnidad =
    grupo === 'otros' ? unidadCanon : conv.unidadBase;

  return {
    cantidad: conv.cantidadBase,
    unidad: claveUnidad || 'unidad',
    productoOriginal: parsed.nombreNormalizado,
    productoNormalizado: parsed.nombreNormalizado
  };
}

/**
 * Formatea una línea de lista ya agrupada.
 */
export function formatearLineaListaCompra(cantidadTotal, nombreNormalizado, unidadBase) {
  let unidadSalida = unidadBase;
  let cantidadSalida = cantidadTotal;

  if (unidadBase === 'g' && cantidadTotal >= 1000) {
    unidadSalida = 'kg';
    cantidadSalida = cantidadTotal / 1000;
  } else if (unidadBase === 'ml' && cantidadTotal >= 1000) {
    unidadSalida = 'l';
    cantidadSalida = cantidadTotal / 1000;
  }

  if (unidadSalida === 'unidad' || unidadSalida === 'unidades' || unidadSalida === 'generico') {
    return `${numeroLegibleLista(cantidadSalida)} ${nombreNormalizado}`.trim();
  }

  return `${numeroLegibleLista(cantidadSalida)} ${unidadSalida} de ${nombreNormalizado}`.trim();
}

if (typeof window !== 'undefined') {
  window.parsearIngrediente = parsearIngrediente;
  window.extraerIngredienteParaListaCompra = extraerIngredienteParaListaCompra;
  window.formatearLineaListaCompra = formatearLineaListaCompra;
}

function mostrarToastMensaje(mensaje, tipo = 'success') {
  if (typeof window.mostrarToast === 'function') {
    window.mostrarToast(mensaje, tipo);
  }
}

function blobADataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(data);
  const len = binary.length;
  const buffer = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    buffer[i] = binary.charCodeAt(i);
  }
  return new Blob([buffer], { type: mime });
}

export async function obtenerTodasImagenesIndexadas() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGES_STORE, 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.openCursor();
    const resultados = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) {
        resolve(resultados);
        return;
      }

      const value = cursor.value;
      if (value instanceof Blob) {
        blobADataURL(value)
          .then((dataUrl) => {
            resultados.push({ key: cursor.key, value: dataUrl });
            cursor.continue();
          })
          .catch(reject);
      } else {
        resultados.push({ key: cursor.key, value });
        cursor.continue();
      }
    };

    request.onerror = (event) => reject(event.target.error);
  });
}

export async function crearBackupJson() {
  const payload = {
    tipo: 'backup',
    fecha: new Date().toISOString(),
    estado: window.estado || null,
    images: await obtenerTodasImagenesIndexadas()
  };
  return payload;
}

export async function generarArchivoBackup() {
  const payload = await crearBackupJson();
  const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const nombre = `menus_backup_${fecha}.json`;
  return new File([JSON.stringify(payload, null, 2)], nombre, { type: 'application/json' });
}

export async function descargarCopiaSeguridad() {
  mostrarToastMensaje('Generando copia de seguridad...');
  const file = await generarArchivoBackup();
  descargarArchivoFile(file);
}

export async function importarCopiaSeguridad(file) {
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    mostrarToastMensaje('El archivo no es un JSON válido.', 'danger');
    return;
  }

  const estadoBackup = extraerEstadoDePayloadBackup(data);
  if (!estadoBackup) {
    mostrarToastMensaje('No es una copia de seguridad reconocible.', 'danger');
    return;
  }

  if (
    !window.confirm(
      '¿Fusionar esta copia con tus datos actuales? Se integrarán platos, planes e ítems de lista sin borrar por completo lo que ya tienes.'
    )
  ) {
    return;
  }

  if (!window.estado) {
    mostrarToastMensaje('La aplicación no está lista. Recarga la página e inténtalo de nuevo.', 'danger');
    return;
  }

  fusionarEstadoConBackup(window.estado, estadoBackup);

  if (Array.isArray(data.images)) {
    for (const item of data.images) {
      if (!item || item.key === undefined) continue;
      let value = item.value;
      if (typeof value === 'string' && value.startsWith('data:')) {
        value = dataURLToBlob(value);
      }
      await set(IMAGES_STORE, item.key, value);
    }
  }

  if (typeof window.guardarEstado === 'function') {
    await window.guardarEstado();
  } else {
    await set(STATE_STORE, 'appState', window.estado);
  }

  mostrarToastMensaje('Copia importada. Recargando…');
  window.location.reload();
}

export async function exportarBackup() {
  return descargarCopiaSeguridad();
}

async function leerArchivoJson(archivo) {
  const texto = await archivo.text();
  return JSON.parse(texto);
}

export async function importarBackupOPlato(archivo) {
  try {
    const data = await leerArchivoJson(archivo);

    if (data && (data.tipo === 'backup' || data.estado)) {
      await importarCopiaSeguridad(archivo);
      return;
    }

    if (data && (data.tipo === 'plato' || data.plato || (data.id && data.nombre))) {
      await importarPlato(data);
      return;
    }

    throw new Error('Formato de archivo no reconocido.');
  } catch (error) {
    console.error(error);
    mostrarToastMensaje('No se pudo importar el archivo. Asegúrate de que sea un JSON válido.', 'danger');
  }
}

async function importarPlato(data) {
  const plato = data.plato || data;
  if (!plato || !plato.nombre) {
    throw new Error('Archivo de plato inválido.');
  }

  const idOriginal = plato.id || crearId();
  const existe = window.estado && window.estado.platos && window.estado.platos.porId && window.estado.platos.porId[idOriginal];
  let idFinal = idOriginal;

  if (existe) {
    const sobrescribir = window.confirm('Ya existe un plato con el mismo ID. ¿Quieres sobrescribirlo?');
    if (!sobrescribir) {
      idFinal = crearId();
    }
  }

  plato.id = idFinal;

  if (!window.estado.platos.porId[idFinal]) {
    window.estado.platos.orden.unshift(idFinal);
  }

  window.estado.platos.porId[idFinal] = plato;

  if (typeof window.guardarEstado === 'function') {
    await window.guardarEstado();
  }
  if (typeof window.renderPlatos === 'function') {
    window.renderPlatos();
  }
  if (typeof window.renderPlanificador === 'function') {
    window.renderPlanificador();
  }

  mostrarToastMensaje('Plato importado correctamente.');
}

window.exportarBackup = exportarBackup;
window.descargarCopiaSeguridad = descargarCopiaSeguridad;
window.importarCopiaSeguridad = importarCopiaSeguridad;
window.importarBackupOPlato = importarBackupOPlato;
