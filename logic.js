import { initDB, get, set, clear, STATE_STORE, IMAGES_STORE } from './db.js';

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

export function descargarJson(data, nombre) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export async function exportarBackup() {
  mostrarToastMensaje('Generando copia de seguridad...');
  const backup = await crearBackupJson();
  descargarJson(backup, 'backup_menus_saludables.json');
}

export async function compartirPlato(plato) {
  if (!plato) return;
  mostrarToastMensaje('Preparando plato...');

  const payload = {
    tipo: 'plato',
    fecha: new Date().toISOString(),
    plato
  };

  const nombreArchivo = `plato_${String(plato.nombre || 'plato').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${plato.id || 'sin-id'}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const file = new File([blob], nombreArchivo, { type: 'application/json' });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'Compartir plato saludable',
        text: `Plato: ${plato.nombre}`,
        files: [file]
      });
      return;
    } catch (error) {
      console.warn('Web Share API falló, se usará descarga directa.', error);
    }
  }

  descargarJson(payload, nombreArchivo);
}

async function leerArchivoJson(archivo) {
  const texto = await archivo.text();
  return JSON.parse(texto);
}

export async function importarBackupOPlato(archivo) {
  try {
    const data = await leerArchivoJson(archivo);

    if (data && (data.tipo === 'backup' || data.estado)) {
      await importarBackup(data);
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

async function importarBackup(payload) {
  if (!window.confirm('Importar esta copia de seguridad reemplazará los datos actuales. ¿Continuar?')) {
    return;
  }

  if (!payload || !payload.estado) {
    throw new Error('Archivo de copia de seguridad inválido.');
  }

  window.estado = payload.estado;
  await set(STATE_STORE, 'appState', payload.estado);

  if (Array.isArray(payload.images)) {
    await clear(IMAGES_STORE);
    for (const item of payload.images) {
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
  }

  mostrarToastMensaje('Copia de seguridad restaurada.');
  window.location.reload();
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
window.importarBackupOPlato = importarBackupOPlato;
window.compartirPlato = compartirPlato;
