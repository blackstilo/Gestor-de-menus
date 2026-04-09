import {
  estado,
  platosOrdenados,
  obtenerPlanActual,
  obtenerIdsDesdeAsignacion,
  guardarEstado,
  crearId,
  normalizarTexto,
  escapeHTML,
  optimizarImagenArchivo,
  formatearRangoPeriodo,
  eliminarPlato,
  generarListaCompraDesdePlanActual,
  limpiarListaCompra,
  obtenerTextoListaCompra
} from './logic.js';

let ingredientesTemporales = [];
let fotoOptimizadaActual = null;
let platoEnEdicionId = null;
let selectorContexto = null;
let bibliotecaFiltro = '';

function getToastContainer() {
  let contenedor = document.getElementById('toasts');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'toasts';
    contenedor.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-3';
    document.body.appendChild(contenedor);
  }
  return contenedor;
}

export function mostrarToast(mensaje, tipo = 'success') {
  const contenedor = getToastContainer();
  const toast = document.createElement('div');
  const color = tipo === 'danger' ? 'bg-red-500 text-white' : tipo === 'warning' ? 'bg-amber-500 text-slate-900' : 'bg-emerald-500 text-white';
  toast.className = `rounded-2xl px-4 py-3 shadow-lg shadow-slate-900/10 ${color} animate-fade-in`;
  toast.setAttribute('role', 'status');
  toast.textContent = mensaje;
  contenedor.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'transition-opacity', 'duration-500');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

window.mostrarToast = mostrarToast;

export function activarVista(ruta) {
  document.querySelectorAll('[data-vista]').forEach((el) => {
    if (el.getAttribute('data-vista') === ruta) {
      el.classList.add('activa');
    } else {
      el.classList.remove('activa');
    }
  });

  document.querySelectorAll('.nav-link').forEach((a) => {
    const r = a.getAttribute('data-route');
    if (r === ruta) a.classList.add('activa');
    else a.classList.remove('activa');
  });
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

    const textoSpan = document.createElement('span');
    textoSpan.className = 'truncate max-w-[180px]';
    textoSpan.textContent = ing;

    const closeSpan = document.createElement('span');
    closeSpan.className = 'text-slate-400 hover:text-red-500 text-xs';
    closeSpan.textContent = '×';
    closeSpan.setAttribute('aria-label', `Quitar ingrediente ${ing}`);

    pill.appendChild(textoSpan);
    pill.appendChild(closeSpan);
    pill.addEventListener('click', () => {
      ingredientesTemporales.splice(indice, 1);
      renderIngredientes();
    });
    contenedor.appendChild(pill);
  });
}

export function agregarIngredienteDesdeCampo() {
  const input = document.getElementById('nuevoIngrediente');
  const valor = (input.value || '').trim();
  if (!valor) return;
  ingredientesTemporales.push(valor);
  input.value = '';
  renderIngredientes();
  input.focus();
}

export function resetearFormularioPlato() {
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
  document.getElementById('cancelarEdicionBtn').classList.add('hidden');
  document.getElementById('guardarPlatoBtn').textContent = 'Guardar plato';
}

export function cargarPlatoEnFormulario(plato) {
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

export async function manejarCambioFoto(evento) {
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
    mostrarToast('No se pudo procesar la imagen. Inténtalo con otro archivo.', 'warning');
    evento.target.value = '';
  }
}

export function guardarPlatoDesdeFormulario(evento) {
  evento.preventDefault();
  const nombre = (document.getElementById('nombrePlato').value || '').trim();
  if (!nombre) {
    mostrarToast('El nombre del plato es obligatorio.', 'warning');
    return;
  }

  if (platoEnEdicionId && estado.platos.porId[platoEnEdicionId]) {
    const p = estado.platos.porId[platoEnEdicionId];
    p.nombre = nombre;
    p.ingredientes = [...ingredientesTemporales];
    p.foto = fotoOptimizadaActual ? { ...fotoOptimizadaActual } : null;
    p.actualizadoEn = Date.now();
    mostrarToast('Plato actualizado correctamente.');
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
    mostrarToast('Plato guardado correctamente.');
  }

  guardarEstado();
  resetearFormularioPlato();
  renderPlatos();
  renderPlanificador();
}

function createPlatoListItem(plato) {
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

  const nombreP = document.createElement('p');
  nombreP.className = 'text-sm font-semibold text-slate-800 truncate';
  nombreP.textContent = plato.nombre;

  const detalleP = document.createElement('p');
  detalleP.className = 'text-[12px] text-slate-500 truncate';
  const cantidad = (plato.ingredientes || []).length;
  detalleP.textContent = cantidad ? `${cantidad} ingrediente${cantidad !== 1 ? 's' : ''}` : 'Sin ingredientes';

  contenido.appendChild(nombreP);
  contenido.appendChild(detalleP);

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
  btnEliminar.addEventListener('click', () => {
    if (!confirm('¿Seguro que quieres eliminar este plato? Se quitará también del planificador.')) return;
    eliminarPlato(plato.id);
    renderPlatos();
    renderPlanificador();
    mostrarToast('Plato eliminado.');
  });

  acciones.appendChild(btnEditar);
  acciones.appendChild(btnEliminar);

  li.appendChild(mini);
  li.appendChild(contenido);
  li.appendChild(acciones);
  return li;
}

export function renderPlatos(filtro = bibliotecaFiltro) {
  const lista = document.getElementById('listaPlatosGuardados');
  const contador = document.getElementById('contadorPlatos');
  const vacio = document.getElementById('sinPlatosGuardados');
  const filtroTexto = normalizarTexto(filtro);

  lista.innerHTML = '';
  const todos = platosOrdenados();
  const arr = filtroTexto
    ? todos.filter((p) => normalizarTexto(p.nombre).includes(filtroTexto))
    : todos;

  contador.textContent = `${arr.length} plato${arr.length !== 1 ? 's' : ''}`;

  if (arr.length === 0) {
    vacio.classList.remove('hidden');
    lista.classList.add('hidden');
    vacio.textContent = filtroTexto
      ? 'No hay platos que coincidan con tu búsqueda.'
      : 'Aún no has guardado ningún plato. Empieza creando uno.';
    return;
  }

  vacio.classList.add('hidden');
  lista.classList.remove('hidden');

  arr.forEach((plato) => {
    lista.appendChild(createPlatoListItem(plato));
  });
}

export function actualizarSugerenciasPlatos(texto) {
  const contenedor = document.getElementById('sugerenciasPlatos');
  contenedor.innerHTML = '';

  const termino = normalizarTexto(texto);
  if (!termino) {
    contenedor.classList.add('hidden');
    return;
  }

  const arr = platosOrdenados()
    .filter((p) => normalizarTexto(p.nombre).includes(termino))
    .slice(0, 8);

  if (arr.length === 0) {
    contenedor.classList.add('hidden');
    return;
  }

  arr.forEach((plato) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-full cursor-pointer flex items-start gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none transition';

    const indicador = document.createElement('span');
    indicador.className = 'mt-0.5 h-1.5 w-1.5 rounded-full bg-primario-500 flex-shrink-0';

    const textoCont = document.createElement('span');
    textoCont.className = 'flex-1';

    const nombreSpan = document.createElement('span');
    nombreSpan.className = 'block font-semibold';
    nombreSpan.textContent = plato.nombre;

    const detalleSpan = document.createElement('span');
    detalleSpan.className = 'block text-[11px] text-slate-500 truncate';
    detalleSpan.textContent = (plato.ingredientes || []).join(', ') || 'Sin ingredientes registrados';

    textoCont.appendChild(nombreSpan);
    textoCont.appendChild(detalleSpan);
    btn.appendChild(indicador);
    btn.appendChild(textoCont);

    btn.addEventListener('click', () => {
      cargarPlatoEnFormulario(plato);
      contenedor.classList.add('hidden');
    });
    contenedor.appendChild(btn);
  });

  const primerResultado = contenedor.querySelector('button');
  if (primerResultado) {
    primerResultado.classList.add('bg-emerald-100', 'text-emerald-700');
  }

  contenedor.classList.remove('hidden');
}

export function setBibliotecaFiltro(valor) {
  bibliotecaFiltro = valor;
  renderPlatos(valor);
}

function createPlannerCell(diaClave, momentoClave, indiceDia, plan) {
  const td = document.createElement('td');
  td.className = 'px-1 sm:px-2 align-top';

  const cont = document.createElement('div');
  cont.className = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 sm:px-3 sm:py-3 transition min-h-[72px] flex flex-col gap-1.5 relative';

  const claveAsignacion = `${indiceDia}-${momentoClave}`;
  const asignacion = plan.asignaciones[claveAsignacion];
  const ids = obtenerIdsDesdeAsignacion(asignacion);
  const platosAsignados = ids.map((id) => estado.platos.porId[id]).filter(Boolean);

  const cabecera = document.createElement('div');
  cabecera.className = 'flex items-center justify-between gap-2';

  const diaSpan = document.createElement('span');
  diaSpan.className = 'text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wide';
  diaSpan.textContent = diaClave;

  const contadorSpan = document.createElement('span');
  contadorSpan.className = 'text-[10px] text-slate-400';
  contadorSpan.textContent = platosAsignados.length ? `${platosAsignados.length} plato${platosAsignados.length !== 1 ? 's' : ''}` : 'Vacío';

  cabecera.appendChild(diaSpan);
  cabecera.appendChild(contadorSpan);
  cont.appendChild(cabecera);

  const lista = document.createElement('ul');
  lista.className = 'space-y-1 text-[11px] sm:text-xs text-slate-700 max-h-24 overflow-y-auto scroll-sutil pr-1';

  if (platosAsignados.length === 0) {
    const li = document.createElement('li');
    li.className = 'text-slate-400';
    li.textContent = 'Haz clic en "+" para añadir platos.';
    lista.appendChild(li);
  } else {
    platosAsignados.forEach((plato, idx) => {
      const li = document.createElement('li');
      li.className = 'flex items-center gap-1 rounded-full bg-white px-2 py-1 border border-slate-200';

      const nombreSpan = document.createElement('span');
      nombreSpan.className = 'flex-1 truncate';
      nombreSpan.textContent = plato.nombre;

      const btnBorrar = document.createElement('button');
      btnBorrar.type = 'button';
      btnBorrar.className = 'text-[10px] text-slate-400 hover:text-red-500 px-1';
      btnBorrar.textContent = '×';
      btnBorrar.title = `Quitar ${plato.nombre}`;
      btnBorrar.setAttribute('aria-label', `Quitar ${plato.nombre}`);
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

  const btnMas = document.createElement('button');
  btnMas.type = 'button';
  btnMas.className = 'absolute bottom-1.5 right-1.5 h-6 w-6 rounded-full bg-primario-500 text-white text-xs flex items-center justify-center shadow-sm hover:bg-primario-600 focus:outline-none focus:ring-2 focus:ring-primario-500/60';
  btnMas.textContent = '+';
  btnMas.title = 'Añadir plato';
  btnMas.setAttribute('aria-label', 'Añadir plato');
  btnMas.addEventListener('click', (e) => {
    e.stopPropagation();
    abrirSelectorParaCelda(indiceDia, momentoClave);
  });

  cont.appendChild(btnMas);
  cont.addEventListener('click', () => abrirSelectorParaCelda(indiceDia, momentoClave));

  td.appendChild(cont);
  return td;
}

export function renderPlanificador() {
  document.getElementById('textoTipoPeriodo').textContent = estado.periodo.tipo === 'semana' ? 'Semana' : 'Quincena';
  document.getElementById('textoRangoPeriodo').textContent = formatearRangoPeriodo();

  const tbody = document.getElementById('tablaPlanificadorBody');
  tbody.innerHTML = '';
  const plan = obtenerPlanActual();
  let hayAsignaciones = false;

  ['Almuerzo', 'Comida', 'Cena'].forEach((momentoClave) => {
    const tr = document.createElement('tr');

    const th = document.createElement('th');
    th.className = 'align-top text-left text-[11px] sm:text-xs font-medium text-slate-500 pr-2';
    th.textContent = momentoClave;
    tr.appendChild(th);

    ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach((diaClave, indiceDia) => {
      const celda = createPlannerCell(diaClave, momentoClave, indiceDia, plan);
      if (celda.querySelector('li:not(.text-slate-400)')) hayAsignaciones = true;
      tr.appendChild(celda);
    });

    tbody.appendChild(tr);
  });

  const aviso = document.getElementById('planificadorVacio');
  if (aviso) {
    aviso.classList.toggle('hidden', hayAsignaciones);
  }
}

function escaparHtmlPdf(valor) {
  return escapeHTML(valor || '');
}

function obtenerFilasPlanParaPdf() {
  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const momentos = ['Almuerzo', 'Comida', 'Cena'];
  const plan = obtenerPlanActual();

  return momentos.map((momento) => {
    const celdas = dias.map((_, indiceDia) => {
      const clave = `${indiceDia}-${momento}`;
      const ids = obtenerIdsDesdeAsignacion(plan.asignaciones[clave]);
      const nombres = ids
        .map((id) => estado.platos.porId[id])
        .filter(Boolean)
        .map((plato) => plato.nombre);
      return nombres.length ? nombres : ['—'];
    });
    return { momento, celdas };
  });
}

function construirHtmlPlanPdf({ logoDataUrl, mostrarListaCompra }) {
  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const filas = obtenerFilasPlanParaPdf();
  const rango = formatearRangoPeriodo();
  const tipo = estado.periodo.tipo === 'semana' ? 'Plan semanal' : 'Plan quincenal';
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const listaItems = (estado.listaCompra.items || []).map((it) => it.texto).filter(Boolean);

  const tablaHtml = `
    <table class="tabla-plan">
      <thead>
        <tr>
          <th>Momento</th>
          ${dias.map((dia) => `<th>${escaparHtmlPdf(dia)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${filas.map((fila) => `
          <tr>
            <td class="momento">${escaparHtmlPdf(fila.momento)}</td>
            ${fila.celdas.map((c) => `<td>${c.map((n) => `<div class="plato">${escaparHtmlPdf(n)}</div>`).join('')}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const listaHtml = mostrarListaCompra && listaItems.length
    ? `
      <section class="pagina salto">
        <header class="cabecera">
          <div class="marca">
            ${logoDataUrl
              ? `<img src="${logoDataUrl}" alt="Logo" class="logo" />`
              : '<div class="logo-fallback">GM</div>'}
            <div>
              <h2>Lista de la compra</h2>
              <p>${escaparHtmlPdf(rango)}</p>
            </div>
          </div>
          <p class="fecha">Generado el ${escaparHtmlPdf(hoy)}</p>
        </header>
        <ol class="lista-compra-pdf">
          ${listaItems.map((texto) => `<li>${escaparHtmlPdf(texto)}</li>`).join('')}
        </ol>
      </section>
    `
    : '';

  return `
    <div class="pdf-root">
      <style>
        .pdf-root { font-family: "Inter", Arial, sans-serif; color: #0f172a; }
        .pagina { width: 100%; min-height: 180mm; box-sizing: border-box; padding: 8mm 6mm; }
        .salto { page-break-before: always; }
        .cabecera { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
        .marca { display: flex; align-items: center; gap: 10px; }
        .logo { width: 38px; height: 38px; border-radius: 10px; object-fit: cover; border: 1px solid #d1d5db; }
        .logo-fallback { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; color: #065f46; font-weight: 700; background: #d1fae5; border: 1px solid #6ee7b7; }
        h1, h2 { margin: 0; font-size: 18px; color: #064e3b; }
        p { margin: 2px 0 0; color: #475569; font-size: 11px; }
        .fecha { font-size: 10px; color: #64748b; }
        .tabla-plan { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; font-size: 10px; }
        .tabla-plan thead th { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 8px 6px; font-weight: 700; }
        .tabla-plan thead th:first-child { border-top-left-radius: 8px; }
        .tabla-plan thead th:last-child { border-top-right-radius: 8px; }
        .tabla-plan td { vertical-align: top; border: 1px solid #e2e8f0; padding: 6px; background: #ffffff; min-height: 54px; }
        .tabla-plan td.momento { background: #f8fafc; color: #334155; font-weight: 600; width: 11%; }
        .plato { background: #f8fafc; border: 1px solid #e2e8f0; color: #1e293b; border-radius: 999px; padding: 2px 7px; margin-bottom: 4px; line-height: 1.3; white-space: normal; overflow-wrap: anywhere; }
        .lista-compra-pdf { margin: 0; padding-left: 18px; column-count: 2; column-gap: 20px; }
        .lista-compra-pdf li { break-inside: avoid; margin-bottom: 6px; font-size: 11px; color: #1e293b; }
      </style>

      <section class="pagina">
        <header class="cabecera">
          <div class="marca">
            ${logoDataUrl
              ? `<img src="${logoDataUrl}" alt="Logo" class="logo" />`
              : '<div class="logo-fallback">GM</div>'}
            <div>
              <h1>${escaparHtmlPdf(tipo)}</h1>
              <p>${escaparHtmlPdf(rango)}</p>
            </div>
          </div>
          <p class="fecha">Generado el ${escaparHtmlPdf(hoy)}</p>
        </header>
        ${tablaHtml}
      </section>
      ${listaHtml}
    </div>
  `;
}

async function obtenerLogoDataUrlPdf() {
  try {
    const res = await fetch('./icono.png');
    if (!res.ok) return '';
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    return '';
  }
}

export async function exportarPlanAPDF() {
  if (typeof html2pdf === 'undefined') {
    mostrarToast('La librería para PDF no está disponible.', 'danger');
    return;
  }

  mostrarToast('Generando PDF...');
  const logoDataUrl = await obtenerLogoDataUrlPdf();
  const incluirLista = (estado.listaCompra.items || []).length > 0;
  const html = construirHtmlPlanPdf({ logoDataUrl, mostrarListaCompra: incluirLista });
  const contenedor = document.createElement('div');
  contenedor.innerHTML = html;
  contenedor.style.width = '297mm';
  contenedor.style.background = '#ffffff';
  contenedor.style.color = '#0f172a';

  const contenedorTemporal = document.createElement('div');
  contenedorTemporal.style.position = 'fixed';
  contenedorTemporal.style.top = '-9999px';
  contenedorTemporal.style.left = '-9999px';
  contenedorTemporal.appendChild(contenedor);
  document.body.appendChild(contenedorTemporal);

  try {
    await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        filename: `plan_${estado.periodo.tipo}_${estado.periodo.inicioISO.slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      })
      .from(contenedor)
      .save();
    mostrarToast('PDF generado correctamente.');
  } catch (error) {
    console.error(error);
    mostrarToast('Error al generar el PDF.', 'danger');
  } finally {
    contenedorTemporal.remove();
  }
}

window.exportarPlanAPDF = exportarPlanAPDF;
window.exportarPlanificadorAPdf = exportarPlanAPDF;

export function abrirModalSelector() {
  document.getElementById('modalSelector').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

export function cerrarModalSelector() {
  document.getElementById('modalSelector').classList.add('hidden');
  document.body.style.overflow = '';
  selectorContexto = null;
}

export function abrirSelectorParaCelda(diaIndex, momento) {
  selectorContexto = { diaIndex, momento, seleccionId: null, seleccionNombreLibre: '' };
  document.getElementById('modalTitulo').textContent = `${momento} · ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][diaIndex]}`;

  const input = document.getElementById('selectorBusqueda');
  input.value = '';
  renderResultadosSelector('');
  abrirModalSelector();
  requestAnimationFrame(() => input.focus());
}

export function renderResultadosSelector(texto) {
  const contenedor = document.getElementById('selectorResultados');
  contenedor.innerHTML = '';
  const termino = normalizarTexto(texto);
  const arr = platosOrdenados();
  const filtrados = termino ? arr.filter((p) => normalizarTexto(p.nombre).includes(termino)) : arr.slice(0, 12);
  const itemCrear = termino && !arr.some((p) => normalizarTexto(p.nombre) === termino) ? texto.trim() : null;

  if (itemCrear) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-acento-50/60 transition border-b border-slate-100';

    const icono = document.createElement('span');
    icono.className = 'h-8 w-8 rounded-2xl bg-acento-50 border border-acento-100 flex items-center justify-center font-bold text-acento-500';
    icono.textContent = '+';

    const textoCont = document.createElement('span');
    textoCont.className = 'flex-1';
    const titulo = document.createElement('span');
    titulo.className = 'block text-sm font-semibold text-slate-800';
    titulo.textContent = `Crear "${itemCrear}"`;
    const subtitulo = document.createElement('span');
    subtitulo.className = 'block text-[11px] text-slate-500';
    subtitulo.textContent = 'Se guardará como plato nuevo (puedes completarlo luego).';

    textoCont.appendChild(titulo);
    textoCont.appendChild(subtitulo);
    btn.appendChild(icono);
    btn.appendChild(textoCont);
    btn.addEventListener('click', () => {
      selectorContexto.seleccionId = null;
      selectorContexto.seleccionNombreLibre = itemCrear;
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

    if (plato.foto && plato.foto.dataUrl) {
      const img = document.createElement('img');
      img.src = plato.foto.dataUrl;
      img.alt = plato.nombre;
      img.className = 'h-8 w-8 rounded-2xl object-cover border border-slate-200';
      btn.appendChild(img);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'h-8 w-8 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400';
      placeholder.textContent = 'Sin foto';
      btn.appendChild(placeholder);
    }

    const textoCont = document.createElement('span');
    textoCont.className = 'flex-1 min-w-0';
    const nombreSpan = document.createElement('span');
    nombreSpan.className = 'block text-sm font-semibold text-slate-800 truncate';
    nombreSpan.textContent = plato.nombre;
    const ingredientesSpan = document.createElement('span');
    ingredientesSpan.className = 'block text-[11px] text-slate-500 truncate';
    ingredientesSpan.textContent = (plato.ingredientes || []).join(', ') || 'Sin ingredientes';

    textoCont.appendChild(nombreSpan);
    textoCont.appendChild(ingredientesSpan);
    btn.appendChild(textoCont);

    btn.addEventListener('click', () => {
      selectorContexto.seleccionId = plato.id;
      selectorContexto.seleccionNombreLibre = '';
      marcarSeleccionVisual(btn);
    });
    contenedor.appendChild(btn);
  });
}

function marcarSeleccionVisual(btnSeleccionado) {
  const contenedor = document.getElementById('selectorResultados');
  contenedor.querySelectorAll('button').forEach((b) => {
    b.classList.remove('ring-2', 'ring-primario-500/40');
  });
  btnSeleccionado.classList.add('ring-2', 'ring-primario-500/40');
}

export function confirmarSelector() {
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
      mostrarToast('Elige un plato o escribe un nombre para crearlo.', 'warning');
      return;
    }
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
  mostrarToast('Plato asignado al plan.');
}

export function limpiarCeldaSelector() {
  if (!selectorContexto) return;
  const plan = obtenerPlanActual();
  const clave = `${selectorContexto.diaIndex}-${selectorContexto.momento}`;
  delete plan.asignaciones[clave];
  guardarEstado();
  cerrarModalSelector();
  renderPlanificador();
  mostrarToast('Celda limpiada.');
}

function createListaCompraItem(item) {
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
    const nuevoTexto = (input.value || '').trim();
    if (nuevoTexto) {
      item.texto = nuevoTexto;
      guardarEstado();
    } else {
      estado.listaCompra.items = estado.listaCompra.items.filter((x) => x.id !== item.id);
      guardarEstado();
      renderListaCompra();
    }
  });

  const btnEliminar = document.createElement('button');
  btnEliminar.type = 'button';
  btnEliminar.className = 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 text-xs transition px-2';
  btnEliminar.textContent = 'Eliminar';
  btnEliminar.setAttribute('aria-label', `Eliminar ${item.texto}`);
  btnEliminar.addEventListener('click', () => {
    estado.listaCompra.items = estado.listaCompra.items.filter((x) => x.id !== item.id);
    guardarEstado();
    renderListaCompra();
  });

  li.appendChild(checkbox);
  li.appendChild(input);
  li.appendChild(btnEliminar);
  return li;
}

export function renderListaCompra() {
  const ul = document.getElementById('listaCompra');
  const vacio = document.getElementById('listaCompraVacia');
  ul.innerHTML = '';

  const items = estado.listaCompra.items || [];
  if (items.length === 0) {
    vacio.classList.remove('hidden');
    ul.classList.add('hidden');
    return;
  }
  vacio.classList.add('hidden');
  ul.classList.remove('hidden');

  items.forEach((item) => {
    ul.appendChild(createListaCompraItem(item));
  });
}

export function renderTodo() {
  activarVista(location.hash.replace('#/', '') || 'inicio');
  renderIngredientes();
  renderPlatos();
  renderPlanificador();
  renderListaCompra();
}

/**
 * Genera el QR de transferencia: contenedor vacío y tamaño fijo.
 * @param {string} datos Cadena Base64
 * @param {{ sinFotos?: boolean }} [opciones]
 */
export function mostrarModalQR(datos, opciones = {}) {
  const modal = document.getElementById('modalTransferencia');
  const container = document.getElementById('qrcode');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  if (!container) return;
  container.innerHTML = '';
  const info = document.getElementById('textoTransferenciaInfo');
  const sinFotos = !!opciones.sinFotos;

  if (!datos || datos.length > 2000) {
    container.innerHTML = '';
    container.textContent = '';
    if (info) {
      info.textContent = "Datos demasiado grandes para QR. Usa el botón 'Copiar Código'";
    }
    return;
  }

  if (!window.QRCode) {
    console.error('QRCode no está disponible en window.QRCode.');
    container.textContent = 'Librería QR no disponible.';
    return;
  }

  if (info) {
    info.textContent = sinFotos
      ? 'Se generó versión ligera sin imágenes para mantener un QR legible.'
      : 'Escanea este QR desde otro dispositivo o copia el código.';
  }

  try {
    new window.QRCode(container, { text: datos, width: 256, height: 256 });
  } catch (error) {
    console.error('Error al generar QR:', error);
    container.innerHTML = '';
    if (info) {
      info.textContent = "Datos demasiado grandes para QR. Usa el botón 'Copiar Código'";
    }
  }
}

function conectarEventosTransferenciaUI() {
  const lista = document.getElementById('listaPlatosGuardados');
  if (lista) {
    lista.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-qr');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-plato-id');
      if (id && typeof window.abrirModalTransferencia === 'function') {
        window.abrirModalTransferencia('uno', [id]);
      }
    });
  }

  const btnCopiar = document.getElementById('btnCopiarCodigoTransferencia');
  if (btnCopiar && !btnCopiar.dataset.boundUi) {
    btnCopiar.dataset.boundUi = '1';
    btnCopiar.addEventListener('click', async () => {
      const cadena =
        (typeof window.codigoTransferenciaActual === 'string' && window.codigoTransferenciaActual) ||
        (document.getElementById('transferenciaCodigoTexto') &&
          document.getElementById('transferenciaCodigoTexto').value) ||
        '';
      if (!cadena) return;
      try {
        await navigator.clipboard.writeText(cadena);
        mostrarToast('Código copiado. Puedes enviarlo por mensaje');
      } catch {
        const ta = document.getElementById('transferenciaCodigoTexto');
        if (ta) {
          ta.focus();
          ta.select();
          document.execCommand('copy');
          mostrarToast('Código copiado. Puedes enviarlo por mensaje');
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  conectarEventosTransferenciaUI();
});

window.mostrarModalQR = mostrarModalQR;
