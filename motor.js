function initializeFiltrosYVistasCustom() {
// ==========================================================================
// CONFIGURACIÓN PRO: ENLACE EN VIVO DE TU GOOGLE SHEET (FORMATO DATOS CSV)
// ==========================================================================
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkVKm6lOMbZvAxVV_t0SXpXbln6AC67ebiTEc9how0g4ccKvhcZdbZtDoO7eIdla98b1bkYj6reDDo/pub?output=csv";

// Banderas oficiales por País
const BANDERAS_PAISES = {
    "ARGENTINA": "https://flagcdn.com/w40/ar.png",
    "BRASIL": "https://flagcdn.com/w40/br.png",
    "BRAZIL": "https://flagcdn.com/w40/br.png",
    "CHILE": "https://flagcdn.com/w40/cl.png",
    "COLOMBIA": "https://flagcdn.com/w40/co.png",
    "EMIRATOS ARABES": "https://flagcdn.com/w40/ae.png",
    "EMIRATOS ÁRABES": "https://flagcdn.com/w40/ae.png",
    "EMIRATOS ARABES UNIDOS": "https://flagcdn.com/w40/ae.png",
    "UAE": "https://flagcdn.com/w40/ae.png",
    "ESPAÑA": "https://flagcdn.com/w40/es.png",
    "ESPANA": "https://flagcdn.com/w40/es.png",
    "SPAIN": "https://flagcdn.com/w40/es.png",
    "ESTADOS UNIDOS": "https://flagcdn.com/w40/us.png",
    "USA": "https://flagcdn.com/w40/us.png",
    "MEXICO": "https://flagcdn.com/w40/mx.png",
    "MÉXICO": "https://flagcdn.com/w40/mx.png",
    "PARAGUAY": "https://flagcdn.com/w40/py.png",
    "PERU": "https://flagcdn.com/w40/pe.png",
    "PERÚ": "https://flagcdn.com/w40/pe.png",
    "PORTUGAL": "https://flagcdn.com/w40/pt.png",
    "PUERTO RICO": "https://flagcdn.com/w40/pr.png",
    "REP. DOMINICANA": "https://flagcdn.com/w40/do.png",
    "REPUBLICA DOMINICANA": "https://flagcdn.com/w40/do.png",
    "URUGUAY": "https://flagcdn.com/w40/uy.png",
    "ECUADOR": "https://flagcdn.com/w40/ec.png",
    "PANAMA": "https://flagcdn.com/w40/pa.png",
    "PANAMÁ": "https://flagcdn.com/w40/pa.png",
    "COSTA RICA": "https://flagcdn.com/w40/cr.png",
    "GUATEMALA": "https://flagcdn.com/w40/gt.png",
    "CHINA": "https://flagcdn.com/w40/cn.png"
};

let contenedoresGlobales = [];
let filtroEstadoVentaActual = "Todos"; 
let loteSeleccionadoLlave = null; 

// Valores de filtros activos
let filtroPaisVal = "Todos los Países";
let filtroLocacionVal = "Todas las Locaciones";
let filtroTamanoVal = "Todos los Tamaños";
let filtroEtapaVal = "Todas las Etapas";
let filtroPrioridadVal = "Todas las Prioridades";

function dividirLineaCSV(linea) {
    let resultado = [];
    let dentroDeComillas = false;
    let celdaActual = "";
    for (let i = 0; i < linea.length; i++) {
        let char = linea[i];
        if (char === '"') dentroDeComillas = !dentroDeComillas;
        else if (char === ',' && !dentroDeComillas) {
            resultado.push(celdaActual.trim());
            celdaActual = "";
        } else {
            celdaActual += char;
        }
    }
    resultado.push(celdaActual.trim());
    return resultado;
}

function parsearFechaExcel(textoFecha) {
    if(!textoFecha || textoFecha === "--" || textoFecha.trim() === "") return null;
    let limpia = textoFecha.replace(/\//g, "-").trim();
    let partes = limpia.split("-");
    if (partes.length === 3 && partes[0].length <= 2) {
        return new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
    }
    let timestamp = Date.parse(textoFecha);
    return !isNaN(timestamp) ? new Date(timestamp) : null;
}

function formatearFechaCorta(fechaObj) {
    if (!fechaObj || isNaN(fechaObj.getTime())) return "--";
    const dia = String(fechaObj.getDate()).padStart(2, '0');
    const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const anio = fechaObj.getFullYear();
    return `${dia}/${mes}/${anio}`;
}

function obtenerNivelPrioridadContenedor(c, fechaHoy) {
    if (c.estadoVenta !== "Sin Vender") return "ninguna";
    if (c.etapaFisicaExacta.toUpperCase().includes("INCORRECTO")) return "ninguna";

    let proximoArribo = false;
    if (c.eta && c.eta !== "--") {
        const fechaEtaObj = parsearFechaExcel(c.eta);
        if (fechaEtaObj) {
            const dif = fechaEtaObj.getTime() - fechaHoy.getTime();
            const dias = Math.ceil(dif / (1000 * 60 * 60 * 24));
            if (dias <= 5) proximoArribo = true;
        }
    }

    if (c.clasificacionFisicaMapa === "DESTINO") return "alta";
    if (c.clasificacionFisicaMapa === "MAR" || proximoArribo) return "media";
    return "ninguna";
}

async function cargarDatosDesdeGoogleSheets() {
    try {
        const respuesta = await fetch(GOOGLE_SHEET_CSV_URL);
        if (!respuesta.ok) throw new Error("Fallo al descargar archivo CSV.");
        
        const textoCSV = await respuesta.text();
        const lineas = textoCSV.split("\n");
        if (lineas.length < 2) return;

        let idxOpLeasing = 0;
        let idxOpGateBuy = 1;
        let idxSerial = 2;
        let idxTipo = 4;
        let idxColor = 5;
        let idxOrigen = 7;
        let idxPais = 8;
        let idxLocalizacion = 9;
        let idxConfirmacion = 10;
        let idxEta = 18;
        let idxEstadoActual = 23;
        let idxCicloTotal = 30;
        let idxEtapa = 32;

        const listaProcesada = [];
        
        for (let i = 1; i < lineas.length; i++) {
            if (!lineas[i].trim()) continue;
            
            const lineaLimpia = lineas[i].replace(/\r/g, "").trim();
            const celdas = dividirLineaCSV(lineaLimpia).map(val => val.replace(/["']/g, "").trim());
            
            if (celdas.length < 4) continue;

            const opLeasing = celdas[idxOpLeasing] || "";
            const opGateBuy = celdas[idxOpGateBuy] || "";         
            const serialContenedor = celdas[idxSerial] ? celdas[idxSerial].replace(/\s+/g, '') : ""; 

            if (serialContenedor === "" || opLeasing.trim() === "" || serialContenedor.toUpperCase().includes("SERIAL") || serialContenedor.toUpperCase().includes("CONTENEDOR")) {
                continue; 
            }

            const tipo = celdas[idxTipo] || "40HC";           
            const color = celdas[idxColor] || "No Especificado"; 
            const origen = celdas[idxOrigen] || "CHINA";        
            let paisRaw = celdas[idxPais] ? celdas[idxPais].toUpperCase().trim() : "NO ESP.";
            
            const localizacion = celdas[idxLocalizacion] || "Destino";
            const confirmacion = celdas[idxConfirmacion] || "";      
            const eta = celdas[idxEta] || "--";            
            const estadoActualRaw = (celdas[idxEstadoActual] || "").toUpperCase().trim(); 
            const cicloTotalDias = parseFloat(celdas[idxCicloTotal]) || 0;             
            
            let etapaExacta = celdas[idxEtapa] ? celdas[idxEtapa].trim() : "Origen";       
            if (etapaExacta.toUpperCase().includes("DEPOSITO") || etapaExacta.toUpperCase().includes("DEPÓSITO")) {
                etapaExacta = "Espera Depósito Origen";
            }

            let estadoVenta = "Sin Vender";
            if (opGateBuy.trim() !== "" && !opGateBuy.toUpperCase().includes("PENDIEN") && !opGateBuy.toUpperCase().includes("NO")) {
                estadoVenta = "Vendido";
            } else if (estadoActualRaw === "RESERVADO" || estadoActualRaw === "ENTREGADO") {
                estadoVenta = "Vendido";
            }

            let clasificacionFisicaMapa = "DESTINO"; 
            const estatusNormalizado = etapaExacta.toUpperCase();

            if (estatusNormalizado.includes("MAR") || estatusNormalizado.includes("TRA")) {
                clasificacionFisicaMapa = "MAR";
            } else if (estatusNormalizado.includes("ORIGEN") || estatusNormalizado.includes("ESPERA")) {
                clasificacionFisicaMapa = "ORIGEN";
            } else if (estatusNormalizado.includes("DESTINO") || estatusNormalizado.includes("COMPLETADO")) {
                clasificacionFisicaMapa = "DESTINO";
            }

            listaProcesada.push({
                serial: serialContenedor, tipo, opLeasing, opGateBuy, origen, pais: paisRaw, localizacion, confirmacion, eta, color,
                estadoVenta, etapaFisicaExacta: etapaExacta, clasificacionFisicaMapa, cicloTotalDias
            });
        }

        contenedoresGlobales = listaProcesada;
        inicializarFiltrosYVistas();

    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

// ==========================================================================
// COMPONENTE CUSTOM SEARCHABLE SELECT
// ==========================================================================
function crearCustomSelect(wrapperId, opcionesArray, opcionDefecto, onSelectCallback) {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    const trigger = wrapper.querySelector(".custom-select-trigger");
    const label = wrapper.querySelector(".custom-select-label");
    const optionsContainer = wrapper.querySelector(".custom-select-options");
    const searchInput = wrapper.querySelector(".search-input");

    function poblarOpciones(lista) {
        optionsContainer.innerHTML = "";
        
        const divDefault = document.createElement("div");
        divDefault.className = `custom-option ${label.innerText === opcionDefecto ? 'selected' : ''}`;
        divDefault.innerText = opcionDefecto;
        divDefault.addEventListener("click", (e) => {
            e.stopPropagation();
            label.innerText = opcionDefecto;
            wrapper.classList.remove("open");
            onSelectCallback(opcionDefecto);
        });
        optionsContainer.appendChild(divDefault);

        if (lista.length === 0) {
            const noRes = document.createElement("div");
            noRes.className = "custom-option no-result";
            noRes.innerText = "Sin resultados";
            optionsContainer.appendChild(noRes);
            return;
        }

        lista.forEach(op => {
            const divOp = document.createElement("div");
            divOp.className = `custom-option ${label.innerText === op ? 'selected' : ''}`;
            divOp.innerText = op;
            divOp.addEventListener("click", (e) => {
                e.stopPropagation();
                label.innerText = op;
                wrapper.classList.remove("open");
                onSelectCallback(op);
            });
            optionsContainer.appendChild(divOp);
        });
    }

    poblarOpciones(opcionesArray);

    trigger.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll(".custom-select-wrapper").forEach(w => {
            if (w !== wrapper) w.classList.remove("open");
        });
        
        const estaAbierto = wrapper.classList.toggle("open");
        if (estaAbierto) {
            searchInput.value = "";
            poblarOpciones(opcionesArray);
            setTimeout(() => searchInput.focus(), 50);
        }
    };

    searchInput.oninput = (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtradas = opcionesArray.filter(op => op.toLowerCase().includes(term));
        poblarOpciones(filtradas);
    };
}

document.addEventListener("click", () => {
    document.querySelectorAll(".custom-select-wrapper").forEach(w => w.classList.remove("open"));
});

// ==========================================================================
// 🔥 RENDERIZADO DINÁMICO Y REACTIVO DE LAS TARJETAS DE PAÍS
// ==========================================================================
function renderizarTarjetasPaises(listaFiltradaSegunAtributos) {
    const contenedor = document.getElementById("contenedor-tarjetas-paises");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    // 1. Obtener la lista completa de todos los países existentes en la BD global
    const todosLosPaisesSet = new Set();
    contenedoresGlobales.forEach(c => {
        const p = c.pais && c.pais !== "NO ESP." ? c.pais : "OTROS";
        todosLosPaisesSet.add(p);
    });

    // 2. Agrupar conteos únicamente con los elementos que pasan los filtros actuales
    const resumenPaisesFiltrado = {};
    todosLosPaisesSet.forEach(p => {
        resumenPaisesFiltrado[p] = { total: 0, libres: 0, vendidos: 0 };
    });

    listaFiltradaSegunAtributos.forEach(c => {
        const p = c.pais && c.pais !== "NO ESP." ? c.pais : "OTROS";
        if (resumenPaisesFiltrado[p]) {
            resumenPaisesFiltrado[p].total++;
            if (c.estadoVenta === "Sin Vender") resumenPaisesFiltrado[p].libres++;
            else resumenPaisesFiltrado[p].vendidos++;
        }
    });

    const paisUpper = filtroPaisVal.toUpperCase();

    const tituloSeccion = document.getElementById("titulo-lotes-seccion");
    if (tituloSeccion) {
        tituloSeccion.innerText = (paisUpper !== "TODOS LOS PAÍSES" && paisUpper !== "TODOS") 
            ? `📦 LOTES FILTRADOS EN ${paisUpper}`
            : `📦 TODOS LOS LOTES REGIONALES`;
    }

    Object.entries(resumenPaisesFiltrado).sort().forEach(([paisNombre, stats]) => {
        const card = document.createElement("div");
        card.className = "tarjeta-pais-card";

        // Marcado de foco por selección activa de país
        if (paisUpper !== "TODOS LOS PAÍSES" && paisUpper !== "TODOS") {
            if (paisNombre.toUpperCase().includes(paisUpper)) {
                card.classList.add("pais-seleccionado-activo");
            } else {
                card.classList.add("pais-opaco");
            }
        }

        // Si el país no tiene ninguna unidad disponible bajo el filtro actual, atenuarlo visualmente
        if (stats.total === 0) {
            card.classList.add("pais-opaco");
        }

        const urlBandera = BANDERAS_PAISES[paisNombre] || "https://flagcdn.com/w40/un.png";

        card.innerHTML = `
            <div class="cabecera-pais-card">
                <div class="info-pais-flex">
                    <img src="${urlBandera}" alt="${paisNombre}" class="bandera-pais-img" onerror="this.src='https://flagcdn.com/w40/un.png'">
                    <span class="nombre-pais-card">${paisNombre}</span>
                </div>
                <span class="badge-total-pais">${stats.total} U.</span>
            </div>
            <div class="metricas-pais-card">
                <div class="sub-metrica-pais">
                    <span class="num-libres">${stats.libres}</span>
                    <small>DISPONIBLES</small>
                </div>
                <div class="sub-metrica-pais">
                    <span class="num-vendidos">${stats.vendidos}</span>
                    <small>RESERVADOS</small>
                </div>
            </div>
        `;

        card.addEventListener("click", () => {
            const wrapper = document.getElementById("custom-select-pais");
            const label = wrapper.querySelector(".custom-select-label");

            if (filtroPaisVal.toUpperCase() === paisNombre) {
                filtroPaisVal = "Todos los Países";
                label.innerText = "Todos los Países";
            } else {
                filtroPaisVal = paisNombre;
                label.innerText = paisNombre;
            }
            filtrarInventario('pais');
        });

        contenedor.appendChild(card);
    });
}

function filtrarInventario(origenCambio) {
    const textoBusqueda = document.getElementById("buscar-operacion").value.toLowerCase().trim();
    const fechaHoy = new Date("2026-07-08");
    
    let paisVal = filtroPaisVal.toLowerCase().trim();
    let locacionVal = filtroLocacionVal.toLowerCase().trim();
    let tamanoVal = filtroTamanoVal.toLowerCase().trim();
    let etapaVal = filtroEtapaVal.toLowerCase().trim();
    let prioridadVal = filtroPrioridadVal.toLowerCase().trim();

    if (origenCambio !== 'clickLote' && origenCambio !== 'inicio') {
        loteSeleccionadoLlave = null;
    }

    if (origenCambio === 'pais') {
        filtroLocacionVal = "Todas las Locaciones";
        const wrapperLoc = document.getElementById("custom-select-locacion");
        if (wrapperLoc) wrapperLoc.querySelector(".custom-select-label").innerText = "Todas las Locaciones";
    }

    // 🔥 1. Filtrar lista por los atributos secundarios (Texto, Locación, Tamaño, Etapa, Prioridad, Estado Venta)
    // omitiendo el filtro de país estricto para recalcular las tarjetas de país
    const listaFiltradaSinPais = contenedoresGlobales.filter(c => {
        const coincideTexto = c.serial.toLowerCase().includes(textoBusqueda) || 
                              c.opGateBuy.toLowerCase().includes(textoBusqueda);
        
        const coincideLocacion = (locacionVal.includes("todas las loc") || c.localizacion.toLowerCase().includes(locacionVal) || c.confirmacion.toLowerCase().includes(locacionVal));
        const coincideTamano = (tamanoVal.includes("todos los tama") || c.tipo.toLowerCase().includes(tamanoVal));
        const coincideEtapa = (etapaVal.includes("todas las eta") || c.etapaFisicaExacta.toLowerCase().includes(etapaVal));
        
        let coincideOportunidad = true;
        if (filtroEstadoVentaActual === "Sin Vender") coincideOportunidad = (c.estadoVenta === "Sin Vender");
        if (filtroEstadoVentaActual === "Vendido") coincideOportunidad = (c.estadoVenta === "Vendido");

        let coincidePrioridad = true;
        const nivelP = obtenerNivelPrioridadContenedor(c, fechaHoy);
        
        if (prioridadVal.includes("alta") || prioridadVal.includes("destino")) {
            coincidePrioridad = (nivelP === "alta");
        } else if (prioridadVal.includes("media") || prioridadVal.includes("arribo")) {
            coincidePrioridad = (nivelP === "media");
        }

        return coincideTexto && coincideLocacion && coincideTamano && coincideEtapa && coincideOportunidad && coincidePrioridad;
    });

    // 🔥 2. Renderizar Tarjetas de País con la lista reactiva
    renderizarTarjetasPaises(listaFiltradaSinPais); 

    // 🔥 3. Aplicar el filtro de País estricto para Lotes y Tabla Maestra
    const filtradosFinales = listaFiltradaSinPais.filter(c => {
        const coincidePais = (paisVal.includes("todos los pa") || c.pais.toLowerCase().includes(paisVal));
        if (loteSeleccionadoLlave && c.opLeasing !== loteSeleccionadoLlave) {
            return false;
        }
        return coincidePais;
    });

    if (origenCambio !== 'clickLote') {
        coordinarYRepoblarSelects(filtradosFinales);
        renderizarTarjetasDeLotesComerciales(filtradosFinales);
    }

    renderizarTabla(filtradosFinales);
    actualizarKPIs(filtradosFinales);
}

function coordinarYRepoblarSelects(listaFiltradaActual) {
    const paisesVivos = Array.from(new Set(listaFiltradaActual.map(c => c.pais))).sort();
    const locacionesVivas = Array.from(new Set(listaFiltradaActual.flatMap(c => [c.localizacion, c.confirmacion]))).filter(Boolean).sort();
    const tamanosVivos = Array.from(new Set(listaFiltradaActual.map(c => c.tipo))).sort();
    const etapasVivas = Array.from(new Set(listaFiltradaActual.map(c => c.etapaFisicaExacta))).sort();
    const prioridadesVivas = ["🚨 Prioridad Alta (En Destino)", "⏳ Prioridad Media (En Arribo)"];

    crearCustomSelect("custom-select-pais", paisesVivos, "Todos los Países", (val) => { filtroPaisVal = val; filtrarInventario('pais'); });
    crearCustomSelect("custom-select-locacion", locacionesVivas, "Todas las Locaciones", (val) => { filtroLocacionVal = val; filtrarInventario('locacion'); });
    crearCustomSelect("custom-select-tamano", tamanosVivos, "Todos los Tamaños", (val) => { filtroTamanoVal = val; filtrarInventario('tamano'); });
    crearCustomSelect("custom-select-etapa", etapasVivas, "Todas las Etapas", (val) => { filtroEtapaVal = val; filtrarInventario('etapa'); });
    crearCustomSelect("custom-select-prioridad", prioridadesVivas, "Todas las Prioridades", (val) => { filtroPrioridadVal = val; filtrarInventario('prioridad'); });
}

function renderizarTarjetasDeLotesComerciales(listaFiltrada) {
    const contenedor = document.getElementById("contenedor-tarjetas-comerciales");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const fechaHoy = new Date("2026-07-08"); 
    const lotesPorOpLeasing = {};

    listaFiltrada.forEach(c => {
        const llave = c.opLeasing;
        if (!lotesPorOpLeasing[llave]) {
            lotesPorOpLeasing[llave] = {
                opLeasingOculta: llave,
                destinosSet: new Set(),
                etapasSet: new Set(),
                tamanosSet: new Set(),
                fechasEtaObjetos: [],
                total: 0,
                libres: 0,
                coloresMap: {},
                etapaFisicaLoteDominante: "",
                proximoArribar: false,
                ubicacionFisicaActualReal: c.localizacion 
            };
        }
        const lote = lotesPorOpLeasing[llave];
        lote.total++;
        
        if (c.eta && c.eta !== "--") {
            const fObj = parsearFechaExcel(c.eta);
            if (fObj) lote.fechasEtaObjetos.push(fObj);
        }

        if (c.estadoVenta === "Sin Vender") {
            lote.libres++;
            if (c.eta && c.eta !== "--") {
                const fechaEtaObj = parsearFechaExcel(c.eta);
                if (fechaEtaObj) {
                    const diferenciaTiempo = fechaEtaObj.getTime() - fechaHoy.getTime();
                    const diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));
                    if (diasRestantes <= 5) lote.proximoArribar = true;
                }
            }
        }
        
        const ubicacionTexto = c.confirmacion || c.localizacion || c.pais;
        if(ubicacionTexto) lote.destinosSet.add(ubicacionTexto);
        if(c.etapaFisicaExacta) lote.etapasSet.add(c.etapaFisicaExacta.trim());
        if(c.tipo) lote.tamanosSet.add(c.tipo);
        if (c.clasificacionFisicaMapa) lote.etapaFisicaLoteDominante = c.clasificacionFisicaMapa;

        const colorNm = c.color.trim();
        lote.coloresMap[colorNm] = (lote.coloresMap[colorNm] || 0) + 1;
    });

    const arrLotes = Object.values(lotesPorOpLeasing);
    if(arrLotes.length === 0) {
        contenedor.innerHTML = `<p style="color:#64748b; font-size:13px; padding:20px;">No se encontraron lotes activos.</p>`;
        return;
    }

    arrLotes.forEach(lote => {
        let txtColores = Object.entries(lote.coloresMap).map(([col, cant]) => `${cant} ${col}`).join(", ");
        const listaDestinos = Array.from(lote.destinosSet);
        const destinoVisual = listaDestinos.length > 1 ? `${listaDestinos[0]} y otros` : (listaDestinos[0] || "Destino en asignación");
        const listaEtapas = Array.from(lote.etapasSet);
        const etapaVisualRaw = listaEtapas.length > 1 ? "Múltiples Estatus" : (listaEtapas[0] || "Origen");
        const listaTamanos = Array.from(lote.tamanosSet);
        const tamanoVisual = listaTamanos.length > 0 ? listaTamanos.join(", ") : "40HC";

        let etaVisual = "Por Definir / En Destino";
        if (lote.fechasEtaObjetos.length > 0) {
            lote.fechasEtaObjetos.sort((a, b) => a - b);
            const minFecha = lote.fechasEtaObjetos[0];
            const maxFecha = lote.fechasEtaObjetos[lote.fechasEtaObjetos.length - 1];

            if (minFecha.getTime() === maxFecha.getTime()) {
                etaVisual = formatearFechaCorta(minFecha);
            } else {
                etaVisual = `${formatearFechaCorta(minFecha)} a ${formatearFechaCorta(maxFecha)}`;
            }
        }

        const esEstatusIncorrecto = etapaVisualRaw.toUpperCase().includes("INCORRECTO");
        let etapaVisual = etapaVisualRaw;
        if (esEstatusIncorrecto) {
            etapaVisual = `Destino Incorrecto - ${lote.ubicacionFisicaActualReal.toUpperCase()}`;
        }

        let colorBorde = esEstatusIncorrecto ? "#b45309" : (lote.libres > 0 ? "#0284c7" : "#0047FF");
        const esActiva = lote.opLeasingOculta === loteSeleccionadoLlave;
        let estiloFondo = esActiva ? "background:#f0f5ff; border:1px solid #0047FF;" : "background:#ffffff;";
        let opacidadNoActiva = (loteSeleccionadoLlave && !esActiva) ? "opacity:0.4;" : "opacity:1;";

        const tarjeta = document.createElement("div");
        tarjeta.style = `${estiloFondo} ${opacidadNoActiva} border-radius:12px; border-left:5px solid ${colorBorde}; padding:16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display:flex; flex-direction:column; gap:6px; cursor:pointer; transition:all 0.2s ease; border-top:1px solid #e2e8f0; border-right:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0;`;
        
        let txtBadgeAlerta = "";
        if (lote.libres > 0 && !esEstatusIncorrecto) {
            if (lote.etapaFisicaLoteDominante === "DESTINO") {
                txtBadgeAlerta = `<span class="badge-prioridad-alta">🚨 ALTA: EN DESTINO</span>`;
            } else if (lote.etapaFisicaLoteDominante === "MAR" || lote.proximoArribar) {
                txtBadgeAlerta = `<span class="badge-prioridad-media">⏳ MEDIA: EN ARRIBO</span>`;
            }
        }

        tarjeta.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; pointer-events:none;">
                <strong style="color:#0f172a; font-size:14px; letter-spacing:0.5px;">DESTINO: ${destinoVisual}</strong>
                <span style="background:rgba(0,71,255,0.08); color:#0047FF; font-size:11px; padding:3px 8px; border-radius:6px; font-weight:700;">${tamanoVisual}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; pointer-events:none; margin-top:2px;">
                <span style="font-size:12px; color:#b45309; font-weight:700;">Estatus: ${etapaVisual}</span>
                ${txtBadgeAlerta}
            </div>
            <hr style="border:0; height:1px; background:#e2e8f0; margin:6px 0; pointer-events:none;">
            <div style="font-size:13px; color:#475569; line-height:1.5; pointer-events:none; font-weight:600;">
                • Volumen Total Lote: <strong style="color:#0f172a;">${lote.total} u.</strong><br>
                • Disponibles Venta: <strong style="color:#0284c7; font-size:13px;">${lote.libres} Libres</strong><br>
                • ETA Lote (Min - Max): <strong style="color:#0047FF;">${etaVisual}</strong><br>
                • Stock de Colores: <small style="color:#64748b;">${txtColores}</small>
            </div>
        `;

        tarjeta.addEventListener("click", () => {
            loteSeleccionadoLlave = (loteSeleccionadoLlave === lote.opLeasingOculta) ? null : lote.opLeasingOculta;
            filtrarInventario('clickLote');
            renderizarTarjetasDeLotesComerciales(listaFiltrada);
        });

        contenedor.appendChild(tarjeta);
    });
}

function renderizarTabla(lista) {
    const elTabla = document.getElementById("cuerpo-tabla-contenedores");
    if (!elTabla) return; elTabla.innerHTML = "";
    lista.forEach(c => {
        const fila = document.createElement("tr");
        const badge = c.estadoVenta === "Vendido" ? "vendido" : "disponible";
        
        fila.innerHTML = `
            <td><strong style="color:#0f172a;">${c.serial}</strong></td>
            <td>${c.tipo}</td>
            <td>${c.color}</td>
            <td><strong style="color:#0047FF;">${c.opGateBuy || 'Pendiente Venta'}</strong></td>
            <td>${c.localizacion}</td>
            <td><strong style="color:#0047FF;">${c.eta || '--'}</strong></td>
            <td><strong style="color:#b45309;">${c.etapaFisicaExacta}</strong></td>
            <td><span class="badge-venta ${badge}">${c.estadoVenta === "Vendido" ? "RESERVADO" : "DISPONIBLE"}</span></td>
        `;
        elTabla.appendChild(fila);
    });
}

function actualizarKPIs(lista) {
    const total = lista.length;
    const vendidos = lista.filter(c => c.estadoVenta === "Vendido").length;
    const disponibles = lista.filter(c => c.estadoVenta === "Sin Vender").length;
    
    const filasConCiclo = lista.filter(c => c.cicloTotalDias > 0);
    const sumaCiclo = filasConCiclo.reduce((acc, c) => acc + c.cicloTotalDias, 0);
    const promedio = filasConCiclo.length > 0 ? (sumaCiclo / filasConCiclo.length).toFixed(1) : "0.0";

    if(document.getElementById("kpi-ciclo")) document.getElementById("kpi-ciclo").innerText = `${promedio} Días`;
    if(document.getElementById("kpi-unidades")) document.getElementById("kpi-unidades").innerText = `${total} Unidades`;
    if(document.getElementById("kpi-disponibles")) document.getElementById("kpi-disponibles").innerText = `${disponibles} Libres`;
    if(document.getElementById("kpi-vendidos")) document.getElementById("kpi-vendidos").innerText = `${vendidos} Vendidas`;
}

function ejecutarLimpiezaGlobalDeFiltros() {
    loteSeleccionadoLlave = null; 
    filtroEstadoVentaActual = "Todos";

    filtroPaisVal = "Todos los Países";
    filtroLocacionVal = "Todas las Locaciones";
    filtroTamanoVal = "Todos los Tamaños";
    filtroEtapaVal = "Todas las Etapas";
    filtroPrioridadVal = "Todas las Prioridades";

    document.getElementById("buscar-operacion").value = "";
    
    // Resetear etiquetas visuales de los desplegables
    const pLabel = document.querySelector("#custom-select-pais .custom-select-label");
    const lLabel = document.querySelector("#custom-select-locacion .custom-select-label");
    const tLabel = document.querySelector("#custom-select-tamano .custom-select-label");
    const eLabel = document.querySelector("#custom-select-etapa .custom-select-label");
    const prLabel = document.querySelector("#custom-select-prioridad .custom-select-label");

    if (pLabel) pLabel.innerText = "Todos los Países";
    if (lLabel) lLabel.innerText = "Todas las Locaciones";
    if (tLabel) tLabel.innerText = "Todos los Tamaños";
    if (eLabel) eLabel.innerText = "Todas las Etapas";
    if (prLabel) prLabel.innerText = "Todas las Prioridades";

    const btns = document.querySelectorAll(".btn-filtro-premium");
    btns.forEach(btn => btn.classList.remove("activo"));
    
    const btnTodos = document.getElementById("btn-filtro-todos");
    if(btnTodos) btnTodos.classList.add("activo");

    filtrarInventario('inicio');
}

function initializeFiltrosYVistasCustom() {
    if(document.getElementById("buscar-operacion")) document.getElementById("buscar-operacion").addEventListener("input", () => filtrarInventario('texto'));

    const btnReset = document.getElementById("btn-reset-filtros");
    if(btnReset) btnReset.addEventListener("click", ejecutarLimpiezaGlobalDeFiltros);

    const btnTodos = document.getElementById("btn-filtro-todos");
    const btnDisponibles = document.getElementById("btn-filtro-disponibles");
    const btnVendidos = document.getElementById("btn-filtro-vendidos");

    function resetBotones() {
        if(btnTodos) btnTodos.classList.remove("activo"); 
        if(btnDisponibles) btnDisponibles.classList.remove("activo"); 
        if(btnVendidos) btnVendidos.classList.remove("activo");
    }

    if(btnTodos) {
        btnTodos.addEventListener("click", () => { resetBotones(); btnTodos.classList.add("activo"); filtroEstadoVentaActual = "Todos"; filtrarInventario('comercial'); });
    }
    if(btnDisponibles) {
        btnDisponibles.addEventListener("click", () => { resetBotones(); btnDisponibles.classList.add("activo"); filtroEstadoVentaActual = "Sin Vender"; filtrarInventario('comercial'); });
    }
    if(btnVendidos) {
        btnVendidos.addEventListener("click", () => { resetBotones(); btnVendidos.classList.add("activo"); filtroEstadoVentaActual = "Vendido"; filtrarInventario('comercial'); });
    }
}

function inicializarFiltrosYVistas() {
    initializeFiltrosYVistasCustom();
    filtrarInventario('inicio'); 
}

window.addEventListener("DOMContentLoaded", cargarDatosDesdeGoogleSheets);
