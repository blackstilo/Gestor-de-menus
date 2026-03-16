/* Gestor de Menús Saludables
   Web App local (SPA) con LocalStorage.
   Todo el contenido y mensajes en español.
*/

// ============
// Persistencia
// ============
const STORAGE_V2 = 'gestorMenus_v2_state';
const STORAGE_V1 = {
  platos: 'gestorMenus_platos',
  calendario: 'gestorMenus_calendario',
  listaCompra: 'gestorMenus_listaCompra',
  periodo: 'gestorMenus_periodo'
};

function crearEstadoInicial() {
  const lunes = obtenerLunesDeEstaSemana(new Date());
  return {
    version: 2,
    periodo: { tipo: 'semana', inicioISO: lunes.toISOString() },
    platos: {
      porId: {},
      orden: []
    },
    planes: {
      // [clavePeriodo]: { asignaciones: { "0-Almuerzo": { platos: [idPlato1, idPlato2, ...] }, ... } }
    },
    listaCompra: {
      items: [] // {id,texto,marcado}
    }
  };
}

let estado = crearEstadoInicial();

function cargarEstado() {
  // V2
  const raw = localStorage.getItem(STORAGE_V2);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 2) {
        estado = parsed;
        asegurarEstructura();
        return;
      }
    } catch {
      // si falla, intentamos migración
    }
  }

  // Migración desde V1 (si existe)
  const hayV1 =
    localStorage.getItem(STORAGE_V1.platos) ||
    localStorage.getItem(STORAGE_V1.calendario) ||
    localStorage.getItem(STORAGE_V1.listaCompra) ||
    localStorage.getItem(STORAGE_V1.periodo);

  if (hayV1) {
    migrarDesdeV1();
    guardarEstado();
    return;
  }

  // Si no hay nada, queda el inicial
  guardarEstado();
}

function asegurarEstructura() {
  if (!estado || typeof estado !== 'object') estado = crearEstadoInicial();
  if (!estado.periodo) estado.periodo = crearEstadoInicial().periodo;
  if (!estado.platos) estado.platos = { porId: {}, orden: [] };
  if (!estado.platos.porId) estado.platos.porId = {};
  if (!Array.isArray(estado.platos.orden)) estado.platos.orden = [];
  if (!estado.planes) estado.planes = {};
  if (!estado.listaCompra) estado.listaCompra = { items: [] };
  if (!Array.isArray(estado.listaCompra.items)) estado.listaCompra.items = [];
}

function migrarDesdeV1() {
  const nuevo = crearEstadoInicial();

  // Periodo
  try {
    const rawPeriodo = localStorage.getItem(STORAGE_V1.periodo);
    if (rawPeriodo) {
      const p = JSON.parse(rawPeriodo);
      if (p && p.tipo && p.inicioISO) nuevo.periodo = p;
    }
  } catch { }

  // Platos
  let platosV1 = [];
  try {
    const rawPlatos = localStorage.getItem(STORAGE_V1.platos);
    platosV1 = rawPlatos ? JSON.parse(rawPlatos) : [];
  } catch { platosV1 = []; }

  platosV1.forEach((p) => {
    const id = p.id || crearId();
    nuevo.platos.porId[id] = {
      id,
      nombre: p.nombre || 'Plato sin nombre',
      ingredientes: Array.isArray(p.ingredientes) ? p.ingredientes : [],
      foto: p.foto && p.foto.dataUrl ? p.foto : null,
      actualizadoEn: Date.now()
    };
    nuevo.platos.orden.push(id);
  });

  // Calendario (asignaciones antiguas) -> plan del periodo actual (como arrays)
  let calendarioV1 = {};
  try {
    const rawCal = localStorage.getItem(STORAGE_V1.calendario);
    calendarioV1 = rawCal ? JSON.parse(rawCal) : {};
  } catch { calendarioV1 = {}; }

  const clave = clavePeriodoActual(nuevo.periodo);
  nuevo.planes[clave] = { asignaciones: {} };
  Object.keys(calendarioV1).forEach((k) => {
    const a = calendarioV1[k];
    if (a && a.idPlato) {
      nuevo.planes[clave].asignaciones[k] = { platos: [a.idPlato] };
    }
  });

  // Lista compra
  let listaV1 = [];
  try {
    const rawLista = localStorage.getItem(STORAGE_V1.listaCompra);
    listaV1 = rawLista ? JSON.parse(rawLista) : [];
  } catch { listaV1 = []; }
  nuevo.listaCompra.items = (Array.isArray(listaV1) ? listaV1 : []).map((it) => ({
    id: it.id || crearId(),
    texto: it.texto || '',
    marcado: !!it.marcado
  }));

  estado = nuevo;
}

function guardarEstado() {
  asegurarEstructura();
  localStorage.setItem(STORAGE_V2, JSON.stringify(estado));
}

// ============
// Navegación SPA
// ============
const VISTAS = ['inicio', 'planificador', 'platos', 'lista'];

function obtenerRutaActual() {
  const hash = (location.hash || '#/inicio').toLowerCase();
  const match = hash.match(/^#\/([a-záéíóúñ-]+)/i);
  const ruta = match ? match[1] : 'inicio';
  return VISTAS.includes(ruta) ? ruta : 'inicio';
}

function activarVista(ruta) {
  VISTAS.forEach((v) => {
    const el = document.querySelector(`[data-vista="${v}"]`);
    if (!el) return;
    if (v === ruta) el.classList.add('activa');
    else el.classList.remove('activa');
  });

  document.querySelectorAll('.nav-link').forEach((a) => {
    const r = a.getAttribute('data-route');
    if (r === ruta) a.classList.add('activa');
    else a.classList.remove('activa');
  });
}

function navegarA(rutaHash) {
  location.hash = rutaHash;
}

// ============
// Utilidades
// ============
const MOMENTOS = ['Almuerzo', 'Comida', 'Cena'];
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function crearId() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 9)).toLowerCase();
}

function normalizarTexto(s) {
  return (s || '').trim().toLowerCase();
}

function obtenerLunesDeEstaSemana(fecha = new Date()) {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0 domingo
  const diff = (dia === 0 ? -6 : 1) - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function clavePeriodoActual(periodo = estado.periodo) {
  return `${periodo.tipo}:${periodo.inicioISO}`;
}

function obtenerPlanActual() {
  const clave = clavePeriodoActual();
  if (!estado.planes[clave]) estado.planes[clave] = { asignaciones: {} };
  if (!estado.planes[clave].asignaciones) estado.planes[clave].asignaciones = {};
  return estado.planes[clave];
}

// Normaliza asignaciones de una celda para devolver siempre un array de ids de platos
function obtenerIdsDesdeAsignacion(asignacion) {
  if (!asignacion) return [];
  if (Array.isArray(asignacion.platos)) {
    return asignacion.platos.filter(Boolean);
  }
  if (asignacion.idPlato) {
    // Compatibilidad con estado antiguo
    return [asignacion.idPlato];
  }
  return [];
}

function formatearRangoPeriodo() {
  const inicio = new Date(estado.periodo.inicioISO);
  const diasDuracion = estado.periodo.tipo === 'semana' ? 6 : 13;
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + diasDuracion);

  const opciones = { day: '2-digit', month: '2-digit' };
  const inicioTexto = inicio.toLocaleDateString('es-ES', opciones);
  const finTexto = fin.toLocaleDateString('es-ES', opciones);
  return `${inicioTexto} – ${finTexto}`;
}

function desplazarPeriodo(direccion) {
  const dias = estado.periodo.tipo === 'semana' ? 7 : 14;
  const inicio = new Date(estado.periodo.inicioISO);
  inicio.setDate(inicio.getDate() + (dias * direccion));
  estado.periodo.inicioISO = inicio.toISOString();
  guardarEstado();
  renderPlanificador();
}

function alternarTipoPeriodo() {
  estado.periodo.tipo = estado.periodo.tipo === 'semana' ? 'quincena' : 'semana';
  guardarEstado();
  renderPlanificador();
}

// ========================
// Optimización de imágenes
// ========================
async function optimizarImagenArchivo(archivo, maxAncho = 500, calidad = 0.72) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No se pudo preparar el canvas.'));

        const escala = maxAncho && img.width > maxAncho ? maxAncho / img.width : 1;
        const nuevoAncho = Math.round(img.width * escala);
        const nuevoAlto = Math.round(img.height * escala);

        canvas.width = nuevoAncho;
        canvas.height = nuevoAlto;
        ctx.drawImage(img, 0, 0, nuevoAncho, nuevoAlto);

        const soporteWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
        const formato = soporteWebP ? 'image/webp' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(formato, calidad);
        resolve({ dataUrl, formato });
      };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      img.src = lector.result;
    };
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });
}

// ==========================
// Sección: Mis Platos (CRUD)
// ==========================
let ingredientesTemporales = [];
let fotoOptimizadaActual = null;
let platoEnEdicionId = null;

function platosOrdenados() {
  return estado.platos.orden
    .map((id) => estado.platos.porId[id])
    .filter(Boolean);
}

function renderIngredientes() {
  const contenedor = document.getElementById('listaIngredientes');
  contenedor.innerHTML = '';

  if (ingredientesTemporales.length === 0) {
    const span = document.createElement('span');
    span.className = 'text-[11px] text-slate-400';
    span.textContent = 'Sin ingredientes añadidos todavía.';
    contenedor.appendChild(span);
    return;
  }

  ingredientesTemporales.forEach((ing, indice) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'tag-pill inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-1 text-[11px] text-slate-700';
    pill.innerHTML = `<span class="truncate max-w-[180px]">${ing}</span><span class="text-slate-400 hover:text-red-500 text-xs">&times;</span>`;
    pill.addEventListener('click', () => {
      ingredientesTemporales.splice(indice, 1);
      renderIngredientes();
    });
    contenedor.appendChild(pill);
  });
}

function agregarIngredienteDesdeCampo() {
  const input = document.getElementById('nuevoIngrediente');
  const valor = (input.value || '').trim();
  if (!valor) return;
  ingredientesTemporales.push(valor);
  input.value = '';
  renderIngredientes();
  input.focus();
}

function resetearFormularioPlato() {
  const form = document.getElementById('formPlato');
  form.reset();
  ingredientesTemporales = [];
  fotoOptimizadaActual = null;
  platoEnEdicionId = null;
  renderIngredientes();

  const preview = document.getElementById('previewFoto');
  const previewTexto = document.getElementById('previewTexto');
  const tamanoFotoTexto = document.getElementById('tamanoFotoTexto');
  const formatoFotoTexto = document.getElementById('formatoFotoTexto');
  preview.src = '';
  preview.classList.add('hidden');
  previewTexto.classList.remove('hidden');
  tamanoFotoTexto.textContent = 'sin imagen';
  formatoFotoTexto.textContent = '';

  document.getElementById('badgeEdicionPlato').classList.add('hidden');
  const btnCancelar = document.getElementById('cancelarEdicionBtn');
  btnCancelar.classList.add('hidden');
  document.getElementById('guardarPlatoBtn').textContent = 'Guardar plato';
}

function cargarPlatoEnFormulario(plato) {
  document.getElementById('nombrePlato').value = plato.nombre || '';
  ingredientesTemporales = Array.isArray(plato.ingredientes) ? [...plato.ingredientes] : [];
  renderIngredientes();

  fotoOptimizadaActual = plato.foto && plato.foto.dataUrl ? { ...plato.foto } : null;
  const preview = document.getElementById('previewFoto');
  const previewTexto = document.getElementById('previewTexto');
  const tamanoFotoTexto = document.getElementById('tamanoFotoTexto');
  const formatoFotoTexto = document.getElementById('formatoFotoTexto');

  if (fotoOptimizadaActual) {
    preview.src = fotoOptimizadaActual.dataUrl;
    preview.classList.remove('hidden');
    previewTexto.classList.add('hidden');
    const bytes = Math.round((fotoOptimizadaActual.dataUrl.length * 3) / 4);
    tamanoFotoTexto.textContent = `${(bytes / 1024).toFixed(1)} KB aprox.`;
    formatoFotoTexto.textContent = fotoOptimizadaActual.formato === 'image/webp' ? 'Formato WebP optimizado' : 'Formato JPEG optimizado';
  } else {
    preview.src = '';
    preview.classList.add('hidden');
    previewTexto.classList.remove('hidden');
    tamanoFotoTexto.textContent = 'sin imagen';
    formatoFotoTexto.textContent = '';
  }

  platoEnEdicionId = plato.id;
  document.getElementById('badgeEdicionPlato').classList.remove('hidden');
  document.getElementById('cancelarEdicionBtn').classList.remove('hidden');
  document.getElementById('guardarPlatoBtn').textContent = 'Actualizar plato';
}

async function manejarCambioFoto(evento) {
  const archivo = evento.target.files && evento.target.files[0];
  const preview = document.getElementById('previewFoto');
  const previewTexto = document.getElementById('previewTexto');
  const tamanoFotoTexto = document.getElementById('tamanoFotoTexto');
  const formatoFotoTexto = document.getElementById('formatoFotoTexto');

  if (!archivo) {
    fotoOptimizadaActual = null;
    preview.src = '';
    preview.classList.add('hidden');
    previewTexto.classList.remove('hidden');
    tamanoFotoTexto.textContent = 'sin imagen';
    formatoFotoTexto.textContent = '';
    return;
  }

  try {
    const res = await optimizarImagenArchivo(archivo);
    fotoOptimizadaActual = res;
    preview.src = res.dataUrl;
    preview.classList.remove('hidden');
    previewTexto.classList.add('hidden');
    const bytes = Math.round((res.dataUrl.length * 3) / 4);
    tamanoFotoTexto.textContent = `${(bytes / 1024).toFixed(1)} KB aprox.`;
    formatoFotoTexto.textContent = res.formato === 'image/webp' ? 'Formato WebP optimizado' : 'Formato JPEG optimizado';
  } catch (e) {
    console.error(e);
    alert('No se pudo procesar la imagen. Inténtalo con otro archivo.');
    evento.target.value = '';
  }
}

function guardarPlatoDesdeFormulario(evento) {
  evento.preventDefault();
  const nombre = (document.getElementById('nombrePlato').value || '').trim();
  if (!nombre) return alert('El nombre del plato es obligatorio.');

  if (platoEnEdicionId && estado.platos.porId[platoEnEdicionId]) {
    const p = estado.platos.porId[platoEnEdicionId];
    p.nombre = nombre;
    p.ingredientes = [...ingredientesTemporales];
    p.foto = fotoOptimizadaActual ? { ...fotoOptimizadaActual } : null;
    p.actualizadoEn = Date.now();
  } else {
    const id = crearId();
    estado.platos.porId[id] = {
      id,
      nombre,
      ingredientes: [...ingredientesTemporales],
      foto: fotoOptimizadaActual ? { ...fotoOptimizadaActual } : null,
      actualizadoEn: Date.now()
    };
    estado.platos.orden.unshift(id);
  }

  guardarEstado();
  resetearFormularioPlato();
  renderPlatos();
  renderPlanificador(); // nombres actualizados afectan celdas y selector
}

function eliminarPlato(id) {
  if (!confirm('¿Seguro que quieres eliminar este plato? Se quitará también del planificador.')) return;
  delete estado.platos.porId[id];
  estado.platos.orden = estado.platos.orden.filter((x) => x !== id);

  // limpiar asignaciones que usen este plato
  Object.values(estado.planes).forEach((plan) => {
    if (!plan || !plan.asignaciones) return;
    Object.keys(plan.asignaciones).forEach((k) => {
      const ids = obtenerIdsDesdeAsignacion(plan.asignaciones[k]);
      const nuevos = ids.filter((x) => x !== id);
      if (nuevos.length) {
        plan.asignaciones[k] = { platos: nuevos };
      } else {
        delete plan.asignaciones[k];
      }
    });
  });

  guardarEstado();
  renderPlatos();
  renderPlanificador();
}

function renderPlatos() {
  const lista = document.getElementById('listaPlatosGuardados');
  const contador = document.getElementById('contadorPlatos');
  const vacio = document.getElementById('sinPlatosGuardados');
  lista.innerHTML = '';

  const arr = platosOrdenados();
  contador.textContent = `${arr.length} plato${arr.length !== 1 ? 's' : ''}`;
  if (arr.length === 0) {
    vacio.classList.remove('hidden');
    return;
  }
  vacio.classList.add('hidden');

  arr.forEach((plato) => {
    const li = document.createElement('li');
    li.className = 'group rounded-2xl bg-white border border-slate-200 hover:border-primario-500/60 hover:bg-primario-50/40 px-3 py-3 flex gap-3 items-center transition';

    const mini = document.createElement('div');
    mini.className = 'h-12 w-12 rounded-2xl bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] text-slate-400 border border-slate-200';
    if (plato.foto && plato.foto.dataUrl) {
      const img = document.createElement('img');
      img.src = plato.foto.dataUrl;
      img.alt = plato.nombre;
      img.className = 'w-full h-full object-cover';
      mini.appendChild(img);
    } else {
      mini.textContent = 'Sin foto';
    }

    const contenido = document.createElement('div');
    contenido.className = 'flex-1 min-w-0';
    contenido.innerHTML = `
      <p class="text-sm font-semibold text-slate-800 truncate">${plato.nombre}</p>
      <p class="text-[12px] text-slate-500 truncate">${(plato.ingredientes || []).length ? `${plato.ingredientes.length} ingrediente${plato.ingredientes.length !== 1 ? 's' : ''}` : 'Sin ingredientes'}</p>
    `;

    const acciones = document.createElement('div');
    acciones.className = 'flex flex-col gap-1.5 items-end';

    const btnEditar = document.createElement('button');
    btnEditar.type = 'button';
    btnEditar.className = 'inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-[11px] px-2.5 py-1 hover:bg-slate-950 transition';
    btnEditar.textContent = 'Editar';
    btnEditar.addEventListener('click', () => cargarPlatoEnFormulario(plato));

    const btnEliminar = document.createElement('button');
    btnEliminar.type = 'button';
    btnEliminar.className = 'inline-flex items-center justify-center rounded-full border border-slate-200 text-[11px] px-2.5 py-1 text-slate-600 hover:border-red-300 hover:text-red-600 transition';
    btnEliminar.textContent = 'Eliminar';
    btnEliminar.addEventListener('click', () => eliminarPlato(plato.id));

    acciones.appendChild(btnEditar);
    acciones.appendChild(btnEliminar);

    li.appendChild(mini);
    li.appendChild(contenido);
    li.appendChild(acciones);
    lista.appendChild(li);
  });
}

// Autocompletado (Mis Platos)
function actualizarSugerenciasPlatos(texto) {
  const contenedor = document.getElementById('sugerenciasPlatos');
  contenedor.innerHTML = '';

  const termino = normalizarTexto(texto);
  if (!termino) return contenedor.classList.add('hidden');

  const arr = platosOrdenados()
    .filter((p) => normalizarTexto(p.nombre).includes(termino))
    .slice(0, 8);

  if (arr.length === 0) return contenedor.classList.add('hidden');

  arr.forEach((plato) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-full flex items-start gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-primario-50/60';
    btn.innerHTML = `
      <span class="mt-0.5 h-1.5 w-1.5 rounded-full bg-primario-500 flex-shrink-0"></span>
      <span class="flex-1">
        <span class="block font-semibold">${plato.nombre}</span>
        <span class="block text-[11px] text-slate-500 truncate">${(plato.ingredientes || []).join(', ') || 'Sin ingredientes registrados'}</span>
      </span>
    `;
    btn.addEventListener('click', () => {
      cargarPlatoEnFormulario(plato);
      contenedor.classList.add('hidden');
    });
    contenedor.appendChild(btn);
  });

  contenedor.classList.remove('hidden');
}

// ===================
// Sección: Planificador
// ===================
function renderPlanificador() {
  // Cabecera periodo
  document.getElementById('textoTipoPeriodo').textContent = estado.periodo.tipo === 'semana' ? 'Semana' : 'Quincena';
  document.getElementById('textoRangoPeriodo').textContent = formatearRangoPeriodo();

  const tbody = document.getElementById('tablaPlanificadorBody');
  tbody.innerHTML = '';
  const plan = obtenerPlanActual();

  MOMENTOS.forEach((momentoClave) => {
    const tr = document.createElement('tr');

    const th = document.createElement('th');
    th.className = 'align-top text-left text-[11px] sm:text-xs font-medium text-slate-500 pr-2';
    th.textContent = momentoClave;
    tr.appendChild(th);

    DIAS.forEach((diaClave, indiceDia) => {
      const td = document.createElement('td');
      td.className = 'px-1 sm:px-2 align-top';

      const cont = document.createElement('div');
      cont.className =
        'w-full rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 sm:px-3 sm:py-3 transition min-h-[72px] flex flex-col gap-1.5 relative';

      const claveAsignacion = `${indiceDia}-${momentoClave}`;
      const asignacion = plan.asignaciones[claveAsignacion];
      const ids = obtenerIdsDesdeAsignacion(asignacion);
      const platosAsignados = ids
        .map((id) => estado.platos.porId[id])
        .filter(Boolean);

      // cabecera pequeña con día y recuento
      const cabecera = document.createElement('div');
      cabecera.className = 'flex items-center justify-between gap-2';
      cabecera.innerHTML = `
        <span class="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wide">${diaClave}</span>
        <span class="text-[10px] text-slate-400">
          ${platosAsignados.length ? `${platosAsignados.length} plato${platosAsignados.length !== 1 ? 's' : ''}` : 'Vacío'}
        </span>
      `;
      cont.appendChild(cabecera);

      // lista de platos dentro de la celda
      const lista = document.createElement('ul');
      lista.className =
        'space-y-1 text-[11px] sm:text-xs text-slate-700 max-h-24 overflow-y-auto scroll-sutil pr-1';

      if (platosAsignados.length === 0) {
        const li = document.createElement('li');
        li.className = 'text-slate-400';
        li.textContent = 'Haz clic en "+" para añadir platos.';
        lista.appendChild(li);
      } else {
        platosAsignados.forEach((plato, idx) => {
          const li = document.createElement('li');
          li.className =
            'flex items-center gap-1 rounded-full bg-white px-2 py-1 border border-slate-200';

          const nombreSpan = document.createElement('span');
          nombreSpan.className = 'flex-1 truncate';
          nombreSpan.textContent = plato.nombre;

          const btnBorrar = document.createElement('button');
          btnBorrar.type = 'button';
          btnBorrar.className =
            'text-[10px] text-slate-400 hover:text-red-500 px-1';
          btnBorrar.textContent = '×';
          btnBorrar.title = 'Quitar este plato';
          btnBorrar.addEventListener('click', (e) => {
            e.stopPropagation();
            const actuales = obtenerIdsDesdeAsignacion(plan.asignaciones[claveAsignacion]);
            const nuevosIds = actuales.filter((_, i) => i !== idx);
            if (nuevosIds.length) {
              plan.asignaciones[claveAsignacion] = { platos: nuevosIds };
            } else {
              delete plan.asignaciones[claveAsignacion];
            }
            guardarEstado();
            renderPlanificador();
          });

          li.appendChild(nombreSpan);
          li.appendChild(btnBorrar);
          lista.appendChild(li);
        });
      }
      cont.appendChild(lista);

      // botón "+" siempre visible
      const btnMas = document.createElement('button');
      btnMas.type = 'button';
      btnMas.className =
        'absolute bottom-1.5 right-1.5 h-6 w-6 rounded-full bg-primario-500 text-white text-xs flex items-center justify-center shadow-sm hover:bg-primario-600 focus:outline-none focus:ring-2 focus:ring-primario-500/60';
      btnMas.textContent = '+';
      btnMas.title = 'Añadir plato';
      btnMas.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirSelectorParaCelda(indiceDia, momentoClave);
      });
      cont.appendChild(btnMas);

      // clic en el contenedor también abre el selector
      cont.addEventListener('click', () => abrirSelectorParaCelda(indiceDia, momentoClave));

      td.appendChild(cont);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// =========================
// Selector inteligente (Modal)
// =========================
let selectorContexto = null; // {diaIndex,momento,seleccionId,seleccionNombreLibre}

function abrirModalSelector() {
  document.getElementById('modalSelector').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function cerrarModalSelector() {
  document.getElementById('modalSelector').classList.add('hidden');
  document.body.style.overflow = '';
  selectorContexto = null;
}

function abrirSelectorParaCelda(diaIndex, momento) {
  selectorContexto = { diaIndex, momento, seleccionId: null, seleccionNombreLibre: '' };
  document.getElementById('modalTitulo').textContent = `${momento} · ${DIAS[diaIndex]}`;

  const input = document.getElementById('selectorBusqueda');
  input.value = '';
  renderResultadosSelector('');
  abrirModalSelector();
  setTimeout(() => input.focus(), 50);
}

function renderResultadosSelector(texto) {
  const contenedor = document.getElementById('selectorResultados');
  contenedor.innerHTML = '';
  const termino = normalizarTexto(texto);

  const arr = platosOrdenados();
  const filtrados = termino
    ? arr.filter((p) => normalizarTexto(p.nombre).includes(termino))
    : arr.slice(0, 12);

  const itemCrear = termino
    ? (arr.some((p) => normalizarTexto(p.nombre) === termino) ? null : texto.trim())
    : null;

  if (itemCrear) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-acento-50/60 transition border-b border-slate-100';
    btn.innerHTML = `
      <span class="h-8 w-8 rounded-2xl bg-acento-50 border border-acento-100 flex items-center justify-center font-bold text-acento-500">+</span>
      <span class="flex-1">
        <span class="block text-sm font-semibold text-slate-800">Crear "${itemCrear}"</span>
        <span class="block text-[11px] text-slate-500">Se guardará como plato nuevo (puedes completarlo luego).</span>
      </span>
    `;
    btn.addEventListener('click', () => {
      selectorContexto.seleccionId = null;
      selectorContexto.seleccionNombreLibre = itemCrear;
      // feedback visual: colocamos el texto en el input y dejamos listo para "Asignar"
      document.getElementById('selectorBusqueda').value = itemCrear;
      marcarSeleccionVisual(btn);
    });
    contenedor.appendChild(btn);
  }

  if (filtrados.length === 0 && !itemCrear) {
    const p = document.createElement('p');
    p.className = 'px-3 py-3 text-xs text-slate-500';
    p.textContent = 'No hay platos que coincidan. Escribe un nombre para crearlo.';
    contenedor.appendChild(p);
    return;
  }

  filtrados.forEach((plato) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-primario-50/60 transition border-b border-slate-100 last:border-b-0';

    const mini = plato.foto && plato.foto.dataUrl
      ? `<img src="${plato.foto.dataUrl}" alt="${plato.nombre}" class="h-8 w-8 rounded-2xl object-cover border border-slate-200" />`
      : `<span class="h-8 w-8 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">Sin foto</span>`;

    btn.innerHTML = `
      ${mini}
      <span class="flex-1 min-w-0">
        <span class="block text-sm font-semibold text-slate-800 truncate">${plato.nombre}</span>
        <span class="block text-[11px] text-slate-500 truncate">${(plato.ingredientes || []).join(', ') || 'Sin ingredientes'}</span>
      </span>
    `;
    btn.addEventListener('click', () => {
      selectorContexto.seleccionId = plato.id;
      selectorContexto.seleccionNombreLibre = '';
      marcarSeleccionVisual(btn);
    });
    contenedor.appendChild(btn);
  });
}

function marcarSeleccionVisual(btnSeleccionado) {
  // Muy simple: resaltamos el botón seleccionado y limpiamos el resto.
  const contenedor = document.getElementById('selectorResultados');
  contenedor.querySelectorAll('button').forEach((b) => {
    b.classList.remove('ring-2', 'ring-primario-500/40');
  });
  btnSeleccionado.classList.add('ring-2', 'ring-primario-500/40');
}

function confirmarSelector() {
  if (!selectorContexto) return;
  const plan = obtenerPlanActual();
  const clave = `${selectorContexto.diaIndex}-${selectorContexto.momento}`;

  const idsActuales = obtenerIdsDesdeAsignacion(plan.asignaciones[clave]);
  const ids = [...idsActuales];

  if (selectorContexto.seleccionId) {
    ids.push(selectorContexto.seleccionId);
  } else {
    const nombreLibre = (selectorContexto.seleccionNombreLibre || document.getElementById('selectorBusqueda').value || '').trim();
    if (!nombreLibre) {
      alert('Elige un plato o escribe un nombre para crearlo.');
      return;
    }

    // Crear plato nuevo mínimo (sin ingredientes), para que nutra el planificador
    const id = crearId();
    estado.platos.porId[id] = { id, nombre: nombreLibre, ingredientes: [], foto: null, actualizadoEn: Date.now() };
    estado.platos.orden.unshift(id);
    ids.push(id);
  }

  plan.asignaciones[clave] = { platos: ids };
  guardarEstado();
  cerrarModalSelector();
  renderPlatos();
  renderPlanificador();
}

function limpiarCeldaSelector() {
  if (!selectorContexto) return;
  const plan = obtenerPlanActual();
  const clave = `${selectorContexto.diaIndex}-${selectorContexto.momento}`;
  delete plan.asignaciones[clave];
  guardarEstado();
  cerrarModalSelector();
  renderPlanificador();
}

// ======================
// Sección: Lista de compra
// ======================
function generarListaCompraDesdePlanActual() {
  const plan = obtenerPlanActual();
  const ingredientesAcumulados = {};

  Object.keys(plan.asignaciones).forEach((clave) => {
    const asignacion = plan.asignaciones[clave];
    const ids = obtenerIdsDesdeAsignacion(asignacion);
    ids.forEach((idPlato) => {
      const plato = estado.platos.porId[idPlato];
      if (!plato) return;
      (plato.ingredientes || []).forEach((ing) => {
        const key = normalizarTexto(ing);
        if (!key) return;
        if (!ingredientesAcumulados[key]) ingredientesAcumulados[key] = ing.trim();
      });
    });
  });

  estado.listaCompra.items = Object.values(ingredientesAcumulados).map((texto) => ({
    id: crearId(),
    texto,
    marcado: false
  }));

  guardarEstado();
  renderListaCompra();
}

function renderListaCompra() {
  const ul = document.getElementById('listaCompra');
  const vacio = document.getElementById('listaCompraVacia');
  ul.innerHTML = '';

  const items = estado.listaCompra.items || [];
  if (items.length === 0) {
    vacio.classList.remove('hidden');
    return;
  }
  vacio.classList.add('hidden');

  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'group flex items-center gap-2 rounded-2xl px-2 py-2 hover:bg-white transition border border-transparent hover:border-slate-200';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'h-4 w-4 rounded border-slate-300 text-primario-500';
    checkbox.checked = !!item.marcado;
    checkbox.addEventListener('change', () => {
      item.marcado = checkbox.checked;
      guardarEstado();
    });

    const input = document.createElement('input');
    input.type = 'text';
    input.value = item.texto || '';
    input.className = 'flex-1 bg-transparent text-sm text-slate-700 focus:outline-none';
    input.addEventListener('change', () => {
      item.texto = (input.value || '').trim();
      guardarEstado();
    });

    const btnEliminar = document.createElement('button');
    btnEliminar.type = 'button';
    btnEliminar.className = 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 text-xs transition px-2';
    btnEliminar.textContent = 'Eliminar';
    btnEliminar.addEventListener('click', () => {
      estado.listaCompra.items = estado.listaCompra.items.filter((x) => x.id !== item.id);
      guardarEstado();
      renderListaCompra();
    });

    li.appendChild(checkbox);
    li.appendChild(input);
    li.appendChild(btnEliminar);
    ul.appendChild(li);
  });
}

function limpiarListaCompra() {
  estado.listaCompra.items = [];
  guardarEstado();
  renderListaCompra();
}

function obtenerTextoListaCompra() {
  const items = estado.listaCompra.items || [];
  if (items.length === 0) return 'Lista de la compra vacía.';
  const lineas = items.map((it, i) => `${it.marcado ? '[x]' : '[ ]'} ${i + 1}. ${it.texto}`);
  return `Lista de la compra (${formatearRangoPeriodo()}):\n\n` + lineas.join('\n');
}

function compartirWhatsapp() {
  const texto = encodeURIComponent(obtenerTextoListaCompra());
  window.open(`https://wa.me/?text=${texto}`, '_blank');
}

function compartirEmail() {
  const asunto = encodeURIComponent('Lista de la compra');
  const cuerpo = encodeURIComponent(obtenerTextoListaCompra());
  window.location.href = `mailto:?subject=${asunto}&body=${cuerpo}`;
}

// ============
// Acciones globales
// ============
function limpiarTodo() {
  if (!confirm('¿Seguro que quieres borrar TODOS los datos (platos, planificador y lista de la compra)?')) return;
  estado = crearEstadoInicial();
  guardarEstado();
  resetearFormularioPlato();
  renderPlatos();
  renderPlanificador();
  renderListaCompra();
  navegarA('#/inicio');
}

// ============
// Inicialización
// ============
function conectarEventos() {
  window.addEventListener('hashchange', () => {
    const ruta = obtenerRutaActual();
    activarVista(ruta);
  });

  document.getElementById('navLogo').addEventListener('click', () => navegarA('#/inicio'));
  document.getElementById('btnEmpezar').addEventListener('click', () => navegarA('#/planificador'));
  document.getElementById('btnIrPlatos').addEventListener('click', () => navegarA('#/platos'));
  document.querySelectorAll('[data-ir]').forEach((btn) => {
    btn.addEventListener('click', () => navegarA(btn.getAttribute('data-ir')));
  });

  document.getElementById('btnLimpiarTodo').addEventListener('click', limpiarTodo);

  // Planificador
  document.getElementById('btnTipoPeriodo').addEventListener('click', alternarTipoPeriodo);
  document.getElementById('btnPeriodoAnterior').addEventListener('click', () => desplazarPeriodo(-1));
  document.getElementById('btnPeriodoSiguiente').addEventListener('click', () => desplazarPeriodo(1));
  document.getElementById('btnGenerarLista').addEventListener('click', () => {
    generarListaCompraDesdePlanActual();
    navegarA('#/lista');
  });

  // Modal selector
  document.getElementById('selectorBusqueda').addEventListener('input', (e) => {
    if (!selectorContexto) return;
    const valor = e.target.value || '';
    selectorContexto.seleccionNombreLibre = valor.trim();
    selectorContexto.seleccionId = null;
    renderResultadosSelector(valor);
  });
  document.getElementById('btnConfirmarSelector').addEventListener('click', confirmarSelector);
  document.getElementById('btnLimpiarCelda').addEventListener('click', limpiarCeldaSelector);
  document.querySelectorAll('[data-cerrar-modal="1"]').forEach((el) => el.addEventListener('click', cerrarModalSelector));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModalSelector();
  });

  // Mis platos
  document.getElementById('agregarIngredienteBtn').addEventListener('click', agregarIngredienteDesdeCampo);
  document.getElementById('nuevoIngrediente').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarIngredienteDesdeCampo();
    }
  });
  document.getElementById('fotoPlato').addEventListener('change', manejarCambioFoto);
  document.getElementById('formPlato').addEventListener('submit', guardarPlatoDesdeFormulario);
  document.getElementById('resetFormularioBtn').addEventListener('click', resetearFormularioPlato);
  document.getElementById('cancelarEdicionBtn').addEventListener('click', resetearFormularioPlato);

  const nombre = document.getElementById('nombrePlato');
  nombre.addEventListener('input', (e) => actualizarSugerenciasPlatos(e.target.value));
  nombre.addEventListener('blur', () => setTimeout(() => document.getElementById('sugerenciasPlatos').classList.add('hidden'), 150));

  // Lista
  document.getElementById('btnRegenerarLista').addEventListener('click', generarListaCompraDesdePlanActual);
  document.getElementById('btnLimpiarLista').addEventListener('click', limpiarListaCompra);
  document.getElementById('btnCompartirWhatsapp').addEventListener('click', compartirWhatsapp);
  document.getElementById('btnCompartirEmail').addEventListener('click', compartirEmail);
}

function renderTodo() {
  activarVista(obtenerRutaActual());
  renderIngredientes();
  renderPlatos();
  renderPlanificador();
  renderListaCompra();
}

document.addEventListener('DOMContentLoaded', () => {
  cargarEstado();
  conectarEventos();
  renderTodo();
});

