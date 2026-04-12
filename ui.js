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

function nombresPlatosPdf(plan, indiceDia, momento) {
  const clave = `${indiceDia}-${momento}`;
  const ids = obtenerIdsDesdeAsignacion(plan.asignaciones[clave]);
  return ids
    .map((id) => estado.platos.porId[id])
    .filter(Boolean)
    .map((plato) => plato.nombre);
}

function htmlNombresPlatosPdf(nombres) {
  if (!nombres.length) {
    return '<span class="pdf-sin-plato">—</span>';
  }
  return nombres
    .map((n) => `<div class="pdf-plato-nombre">${escaparHtmlPdf(n)}</div>`)
    .join('');
}

function construirHtmlPlanPdf({ logoDataUrl, mostrarListaCompra }) {
  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const momentos = ['Almuerzo', 'Comida', 'Cena'];
  const plan = obtenerPlanActual();
  const rango = formatearRangoPeriodo();
  const tituloDoc =
    estado.periodo.tipo === 'semana'
      ? 'PLANIFICACIÓN NUTRICIONAL SEMANAL'
      : 'PLANIFICACIÓN NUTRICIONAL QUINCENAL';
  const listaItems = (estado.listaCompra.items || []).map((it) => it.texto).filter(Boolean);

  const theadHtml = `
    <tr>
      <th scope="col" class="pdf-esquina"></th>
      ${dias.map((dia) => `<th scope="col">${escaparHtmlPdf(dia)}</th>`).join('')}
    </tr>`;

  const tbodyHtml = momentos
    .map(
      (momento) => `
    <tr class="evitar-corte">
      <th scope="row">${escaparHtmlPdf(momento)}</th>
      ${dias
        .map((_, indiceDia) => {
          const celdas = htmlNombresPlatosPdf(nombresPlatosPdf(plan, indiceDia, momento));
          return `<td>${celdas}</td>`;
        })
        .join('')}
    </tr>`
    )
    .join('');

  const tablaHtml = `
    <table class="pdf-tabla-plan">
      <thead>${theadHtml}</thead>
      <tbody>${tbodyHtml}</tbody>
    </table>
  `;

  const logoImg = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="" class="pdf-logo-img" width="44" height="44" />`
    : '<div class="pdf-logo-fallback" aria-hidden="true">M</div>';

  const listaHtml =
    mostrarListaCompra && listaItems.length
      ? `
      <section class="pdf-seccion-lista evitar-corte">
        <h2 class="pdf-lista-titulo">Lista de la Compra</h2>
        <div class="pdf-lista-multicolumna">
          ${listaItems
            .map(
              (texto) => `
            <div class="pdf-lista-item evitar-corte">
              <span class="pdf-chk-vacio" aria-hidden="true"></span>
              <span class="pdf-lista-texto">${escaparHtmlPdf(texto)}</span>
            </div>`
            )
            .join('')}
        </div>
      </section>
    `
      : '';

  return `
    <div class="pdf-root">
      <style>
        .evitar-corte { page-break-inside: avoid; }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        th,
        td {
          border: 1px solid #cbd5e1;
          padding: 8px;
          vertical-align: top;
          word-wrap: break-word;
        }
        th {
          background-color: #f8fafc;
          color: #475569;
          font-size: 0.8rem;
          text-transform: uppercase;
        }

        .pdf-root {
          font-family: "Inter", system-ui, -apple-system, sans-serif;
          color: #1e293b;
          box-sizing: border-box;
        }
        .pdf-root * { box-sizing: border-box; }
        .pdf-pagina {
          padding: 0;
          width: 100%;
        }
        .pdf-bloque-principal {
          margin-bottom: 8mm;
        }
        .pdf-header-fila {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .pdf-logo-img {
          width: 44px;
          height: 44px;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          display: block;
        }
        .pdf-logo-fallback {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #475569;
          font-weight: 700;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pdf-rango-fechas {
          font-size: 11px;
          color: #64748b;
          margin: 0;
          text-align: right;
          font-weight: 500;
        }
        .pdf-titulo-centrado {
          text-align: center;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #0f172a;
          margin: 0 0 14px 0;
          text-transform: uppercase;
        }
        .pdf-tabla-plan {
          font-size: 10px;
        }
        .pdf-tabla-plan thead th.pdf-esquina {
          width: 11%;
        }
        .pdf-tabla-plan tbody th {
          background-color: #f8fafc;
          color: #475569;
          font-size: 0.8rem;
          text-transform: uppercase;
          font-weight: 600;
        }
        .pdf-tabla-plan td {
          background: #fff;
        }
        .pdf-plato-nombre {
          color: #000000;
          font-weight: 600;
          line-height: 1.35;
          margin-bottom: 4px;
          font-size: 10px;
        }
        .pdf-plato-nombre:last-child { margin-bottom: 0; }
        .pdf-sin-plato {
          color: #94a3b8;
        }
        .pdf-seccion-lista {
          page-break-before: always;
          padding-top: 4mm;
        }
        .pdf-lista-titulo {
          color: #059669;
          border-bottom: 2px solid #059669;
          padding-bottom: 5px;
          margin: 0 0 12px 0;
          font-size: 13px;
          text-align: center;
          text-transform: none;
          background: transparent;
        }
        .pdf-lista-multicolumna {
          column-count: 4;
          column-gap: 18px;
        }
        .pdf-lista-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 8px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .pdf-chk-vacio {
          flex-shrink: 0;
          width: 11px;
          height: 11px;
          border: 1px solid #94a3b8;
          margin-top: 2px;
          background: #fff;
        }
        .pdf-lista-texto {
          font-size: 9px;
          color: #000000;
          line-height: 1.35;
        }
      </style>

      <div class="pdf-pagina">
        <div class="pdf-bloque-principal evitar-corte">
          <header>
            <div class="pdf-header-fila">
              <div class="pdf-header-logo">${logoImg}</div>
              <p class="pdf-rango-fechas">${escaparHtmlPdf(rango)}</p>
            </div>
            <h1 class="pdf-titulo-centrado">${escaparHtmlPdf(tituloDoc)}</h1>
          </header>
          ${tablaHtml}
        </div>
        ${listaHtml}
      </div>
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
  contenedor.style.color = '#1e293b';

  const contenedorTemporal = document.createElement('div');
  contenedorTemporal.style.position = 'fixed';
  contenedorTemporal.style.top = '-9999px';
  contenedorTemporal.style.left = '-9999px';
  contenedorTemporal.appendChild(contenedor);
  document.body.appendChild(contenedorTemporal);

  try {
    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: `plan_${estado.periodo.tipo}_${estado.periodo.inicioISO.slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' },
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
    btn.className = 'w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 text-left hover:bg-acento-50/60 focus:bg-acento-50/60 focus:outline-none transition border-b border-slate-100';

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
    btn.className = 'w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 text-left hover:bg-primario-50/60 focus:bg-primario-50/60 focus:outline-none transition border-b border-slate-100 last:border-b-0';

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
    b.classList.remove('ring-2', 'ring-primario-500/40', 'bg-emerald-100', 'text-emerald-700');
  });
  btnSeleccionado.classList.add('ring-2', 'ring-primario-500/40', 'bg-emerald-100', 'text-emerald-700');
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
