// db.js - Un módulo simple para interactuar con IndexedDB

const DB_NAME = 'gestorMenusDB';
const DB_VERSION = 1;
const STATE_STORE = 'estadoApp';
const IMAGES_STORE = 'imagenesPlatos';

let db;

/**
 * Inicializa la conexión con la base de datos IndexedDB.
 * Crea los almacenes de objetos si no existen.
 * @returns {Promise<IDBDatabase>} Una promesa que se resuelve con la instancia de la base de datos.
 */
function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Error al abrir IndexedDB:', event.target.error);
      reject('Error al abrir la base de datos.');
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains(STATE_STORE)) {
        dbInstance.createObjectStore(STATE_STORE);
      }
      if (!dbInstance.objectStoreNames.contains(IMAGES_STORE)) {
        dbInstance.createObjectStore(IMAGES_STORE);
      }
    };
  });
}

/**
 * Obtiene un valor de un almacén de objetos.
 * @param {string} storeName El nombre del almacén.
 * @param {IDBValidKey} key La clave a obtener.
 * @returns {Promise<any>} Una promesa que se resuelve con el valor.
 */
async function get(storeName, key) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(`Error al obtener ${key}: ${event.target.error}`);
  });
}

/**
 * Guarda o actualiza un valor en un almacén de objetos.
 * @param {string} storeName El nombre del almacén.
 * @param {IDBValidKey} key La clave a guardar.
 * @param {any} value El valor a guardar.
 * @returns {Promise<void>} Una promesa que se resuelve cuando la operación termina.
 */
async function set(storeName, key, value) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(`Error al guardar ${key}: ${event.target.error}`);
  });
}

/**
 * Elimina un valor de un almacén de objetos.
 * @param {string} storeName El nombre del almacén.
 * @param {IDBValidKey} key La clave a eliminar.
 * @returns {Promise<void>} Una promesa que se resuelve cuando la operación termina.
 */
async function del(storeName, key) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(`Error al eliminar ${key}: ${event.target.error}`);
  });
}

/**
 * Limpia todo un almacén de objetos.
 * @param {string} storeName El nombre del almacén.
 * @returns {Promise<void>} Una promesa que se resuelve cuando la operación termina.
 */
async function clear(storeName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(`Error al limpiar ${storeName}: ${event.target.error}`);
  });
}

// Exportamos las funciones para poder usarlas en app.js
window.db = {
  initDB,
  get,
  set,
  del,
  clear,
  STATE_STORE,
  IMAGES_STORE,
};
