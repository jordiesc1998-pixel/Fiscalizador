// ==========================================
// LÓGICA DE BASE DE DATOS
// ==========================================
const initDB = () => {
    if (!localStorage.getItem('usuarios')) {
        const usuarios = [
            { id: 1, email: 'inspector@gad.com', pass: '12345', nombre: 'Inspector Principal', rol: 'inspector' },
            { id: 2, email: 'tecnico@gad.com', pass: '12345', nombre: 'Juan Técnico', rol: 'tecnico' }
        ];
        localStorage.setItem('usuarios', JSON.stringify(usuarios));
    }
    if (!localStorage.getItem('establecimientos')) localStorage.setItem('establecimientos', '[]');
    if (!localStorage.getItem('estructuras')) localStorage.setItem('estructuras', '[]'); 
    if (!localStorage.getItem('actividades') ) localStorage.setItem('actividades', '[]');
    if (!localStorage.getItem('registros')) localStorage.setItem('registros', '[]');
};

const getDB = (key) => JSON.parse(localStorage.getItem(key));
const setDB = (key, data) => localStorage.setItem(key, JSON.stringify(data));

let currentUser = null;
let qrSession = null; 
let chartInstance = null;

// ==========================================
// SESIÓN
// ==========================================
const checkSession = () => {
    const user = localStorage.getItem('sessionUser');
    if (user) {
        currentUser = JSON.parse(user);
        renderUI();
    }
};

const login = (e) => {
    e.preventDefault();
    const user = getDB('usuarios').find(u => u.email === loginEmail.value && u.pass === loginPass.value);
    if (user) {
        currentUser = user;
        localStorage.setItem('sessionUser', JSON.stringify(user));
        renderUI();
    } else {
        loginError.textContent = "Credenciales incorrectas.";
        loginError.classList.remove('d-none');
    }
};

const logout = () => {
    localStorage.removeItem('sessionUser');
    localStorage.removeItem('qrSession');
    location.reload();
};

// ==========================================
// TÉCNICO - LÓGICA Y QR
// ==========================================

const verificarSesionQR = () => {
    const params = new URLSearchParams(window.location.search);
    const qrId = params.get('qr');
    if (qrId) {
        const struct = getDB('estructuras').find(s => s.id == qrId);
        if (struct) {
            const expira = Date.now() + (60 * 60 * 1000); // 1 hora
            qrSession = { structId: struct.id, structName: struct.nombre, expira: expira };
            localStorage.setItem('qrSession', JSON.stringify(qrSession));
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } else {
        const savedSession = localStorage.getItem('qrSession');
        if (savedSession) {
            qrSession = JSON.parse(savedSession);
            if (Date.now() > qrSession.expira) {
                alert("⏳ Tiempo de sesión agotado. Vuelva a escanear el QR.");
                localStorage.removeItem('qrSession');
                qrSession = null;
            }
        }
    }
    
    if (qrSession) {
        document.getElementById('qrSessionAlert').classList.remove('d-none');
        document.getElementById('qrSessionName').textContent = qrSession.structName;
        actualizarTemporizador();
        setInterval(actualizarTemporizador, 1000);
    }
};

const actualizarTemporizador = () => {
    if (!qrSession) return;
    const restante = qrSession.expira - Date.now();
    if (restante <= 0) {
        document.getElementById('qrTimer').textContent = "00:00";
        localStorage.removeItem('qrSession');
        qrSession = null;
        document.getElementById('qrSessionAlert').classList.add('d-none');
        alert("⏳ Tiempo agotado. Las tareas se han bloqueado.");
        renderTecnicoTareas();
        return;
    }
    const mins = Math.floor(restante / 60000);
    const secs = Math.floor((restante % 60000) / 1000);
    document.getElementById('qrTimer').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const crearEstablecimiento = (e) => {
    e.preventDefault();
    const ests = getDB('establecimientos');
    const diasAtencion = [];
    document.querySelectorAll('.dia-check:checked').forEach(el => diasAtencion.push(parseInt(el.value)));
    if(diasAtencion.length === 0) { alert("Seleccione días de atención."); return; }

    ests.push({
        id: Date.now(),
        nombre: estName.value,
        direccion: estDir.value,
        propietario: estOwner.value,
        ci_ruc: estCi.value,
        dias_atencion: diasAtencion,
        usuario_id: currentUser.id,
        usuario_nombre: currentUser.nombre
    });
    setDB('establecimientos', ests);
    alert('✅ Establecimiento guardado.');
    e.target.reset();
    actualizarSelectsTecnico();
};

const crearEstructura = (e) => {
    e.preventDefault();
    const estId = parseInt(structEstSelect.value);
    const estructuras = getDB('estructuras');
    const newStruct = {
        id: Date.now(),
        establecimiento_id: estId,
        nombre: structName.value,
        foto: 'sin_foto.jpg' // Simulado
    };
    estructuras.push(newStruct);
    setDB('estructuras', estructuras);
    alert('✅ Estructura agregada. El enlace QR está disponible en la lista de abajo.');
    e.target.reset();
    actualizarSelectsTecnico();
    renderListaEstructuras();
};

// NUEVO: Crear Actividad con Plantilla
const crearActividad = (e) => {
    e.preventDefault();
    const estId = parseInt(actEst.value);
    const freq = actFreq.value;
    
    // Capturar estructuras seleccionadas
    const estructurasSel = Array.from(document.querySelectorAll('.struct-check:checked')).map(el => el.value);
    if(estructurasSel.length === 0) { alert("Seleccione al menos una estructura."); return; }

    const acts = getDB('actividades');
    acts.push({
        id: Date.now(),
        establecimiento_id: estId,
        nombre: actName.value,
        operacion: actOperacion.value,
        referencia: actReferencia.value,
        aplica_a: estructurasSel, // Array de IDs o ['todos']
        frecuencia: freq,
        mes_aplicacion: ['mensual', 'trimestral', 'semestral', 'anual'].includes(freq) ? parseInt(actMes.value) : null
    });
    setDB('actividades', acts);
    alert('✅ Actividad programada.');
    e.target.reset();
    mesField.classList.add('d-none');
    renderChecklistEstructuras(estId); // Actualizar checklist
    generarRegistrosDelDia();
    renderTecnicoTareas();
};

const actualizarSelectsTecnico = () => {
    const ests = getDB('establecimientos').filter(e => e.usuario_id === currentUser.id);
    const opts = ests.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    structEstSelect.innerHTML = opts;
    actEst.innerHTML = opts;
    actEst.onchange = () => {
        cargarEstructurasChecklist(actEst.value);
        renderListaEstructuras();
    };
    if(ests.length > 0) {
        cargarEstructurasChecklist(ests[0].id);
        renderListaEstructuras();
    }
};

// NUEVO: Renderizar Checklist en formulario
const cargarEstructurasChecklist = (estId) => {
    const estructuras = getDB('estructuras').filter(e => e.establecimiento_id == estId);
    const container = document.getElementById('checklistEstructuras');
    if(estructuras.length === 0) {
        container.innerHTML = '<small class="text-muted">No hay estructuras. Cree una en la sección 2.</small>';
        return;
    }
    container.innerHTML = `
        <div class="form-check">
            <input class="form-check-input struct-check" type="checkbox" value="todos" id="check_todos" onchange="toggleTodos(this)">
            <label class="form-check-label" for="check_todos"><b>Todos</b></label>
        </div>
        <hr class="my-1">
    ` + estructuras.map(e => `
        <div class="form-check">
            <input class="form-check-input struct-check" type="checkbox" value="${e.id}" id="check_${e.id}">
            <label class="form-check-label" for="check_${e.id}">${e.nombre}</label>
        </div>
    `).join('');
};

const toggleTodos = (el) => {
    document.querySelectorAll('.struct-check').forEach(check => {
        if(check.value !== 'todos') check.disabled = el.checked;
    });
};

const copiarUrl = (idInput) => {
    const input = document.getElementById(idInput);
    input.select();
    input.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(input.value).then(() => {
        alert('✅ Enlace copiado al portapapeles.');
    }).catch(() => {
        alert('No se pudo copiar automáticamente. Presiona Ctrl+C.');
    });
};

const renderListaEstructuras = () => {
    const estId = structEstSelect.value;
    if(!estId) return;
    const estructuras = getDB('estructuras').filter(e => e.establecimiento_id == estId);
    
    if(estructuras.length === 0) {
        listaEstructuras.innerHTML = '<small class="text-muted">Sin estructuras.</small>';
        return;
    }
    
    listaEstructuras.innerHTML = '<hr><h6>Lista de Estructuras:</h6>' + estructuras.map(e => {
        const qrUrl = `${window.location.origin}${window.location.pathname}?qr=${e.id}`;
        return `
            <div class="mb-3 p-2 border rounded bg-light">
                <div class="d-flex align-items-center mb-2">
                    <i class="bi bi-check-circle-fill text-success me-2"></i>
                    <strong>${e.nombre}</strong>
                </div>
                <label class="form-label small text-muted mb-1">Enlace QR:</label>
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control" value="${qrUrl}" readonly id="qr-url-${e.id}">
                    <button class="btn btn-outline-primary" type="button" onclick="copiarUrl('qr-url-${e.id}')">
                        <i class="bi bi-clipboard"></i> Copiar
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

// LÓGICA MEJORADA: Generación de Registros
const generarRegistrosDelDia = () => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    const diaSemana = hoy.getDay();
    const mesActual = hoy.getMonth();
    const diaDelMes = hoy.getDate();
    const semanaDelMes = Math.ceil(diaDelMes / 7); // 1 a 5

    const acts = getDB('actividades');
    const regs = getDB('registros');
    const ests = getDB('establecimientos');
    const estructurasDB = getDB('estructuras');

    acts.forEach(act => {
        const est = ests.find(e => e.id === act.establecimiento_id);
        let generar = false;

        // 1. Validar Frecuencia
        if (['diaria', 'semanal'].includes(act.frecuencia)) {
            if (est && est.dias_atencion && est.dias_atencion.includes(diaSemana)) generar = true;
        } else if (act.frecuencia === 'quincenal') {
            // Semana 1 y 3
            if (semanaDelMes === 1 || semanaDelMes === 3) generar = true;
        } else if (act.frecuencia === 'mensual') {
            if (act.mes_aplicacion === mesActual) generar = true;
        } else if (act.frecuencia === 'trimestral') {
            // Cada 3 meses desde el mes de aplicación
            if (((mesActual - act.mes_aplicacion + 12) % 3) === 0) generar = true;
        } else if (['semestral', 'anual'].includes(act.frecuencia)) {
            if (act.mes_aplicacion === mesActual) generar = true;
        }

        // 2. Si toca hoy, generar por estructura
        if (generar) {
            let targets = [];
            if (act.aplica_a.includes('todos')) {
                targets = estructurasDB.filter(e => e.establecimiento_id == act.establecimiento_id).map(e => e.id);
            } else {
                targets = act.aplica_a;
            }

            targets.forEach(structId => {
                // Verificar si ya existe para no duplicar
                if (!regs.find(r => r.actividad_id === act.id && r.estructura_id === structId && r.fecha_programada === hoyStr)) {
                    regs.push({
                        id: Date.now() + Math.random(),
                        actividad_id: act.id,
                        estructura_id: structId,
                        fecha_programada: hoyStr,
                        estado: 'pendiente',
                        evidencia: null,
                        obs_inspector: '',
                        valor_medido: ''
                    });
                }
            });
        }
    });
    setDB('registros', regs);
};

const marcarTareaRapida = (idReg) => {
    const valInput = document.getElementById(`val-${idReg}`);
    const valor = valInput ? valInput.value : '';
    
    const regs = getDB('registros');
    const reg = regs.find(r => r.id === idReg);
    reg.estado = 'completado';
    reg.valor_medido = valor;
    setDB('registros', regs);
    renderTecnicoTareas();
};

const subirEvidencia = (idReg) => {
    const fileInput = document.getElementById(`file-${idReg}`);
    if (!fileInput || fileInput.files.length === 0) { alert("⚠️ Debe seleccionar un archivo."); return; }
    
    const valInput = document.getElementById(`val-${idReg}`);
    const valor = valInput ? valInput.value : '';
    
    const regs = getDB('registros');
    const reg = regs.find(r => r.id === idReg);
    reg.estado = 'completado';
    reg.evidencia = fileInput.files[0].name;
    reg.valor_medido = valor;
    setDB('registros', regs);
    alert('✅ Evidencia subida.');
    renderTecnicoTareas();
};

const renderTecnicoTareas = () => {
    actualizarSelectsTecnico();
    generarRegistrosDelDia();
    
    const regs = getDB('registros');
    const acts = getDB('actividades');
    const ests = getDB('establecimientos');
    const estructuras = getDB('estructuras');
    const hoy = new Date().toISOString().split('T')[0];

    let tareas = regs.filter(r => r.fecha_programada === hoy && r.estado === 'pendiente')
        .map(r => {
            const act = acts.find(a => a.id === r.actividad_id);
            const est = act ? ests.find(e => e.id === act.establecimiento_id && e.usuario_id === currentUser.id) : null;
            if(!est) return null;
            const struct = estructuras.find(s => s.id === r.estructura_id);
            return { ...r, actividad: act, establecimiento: est, estructura: struct };
        }).filter(t => t !== null);
    
    // FILTRO QR: Si hay sesión QR, mostrar SOLO las de esa estructura
    if (qrSession) {
        tareas = tareas.filter(t => t.estructura && t.estructura.id === qrSession.structId);
    }
    
    if (tareas.length === 0) {
        listaTareasTecnico.innerHTML = `<div class="text-center text-muted py-5"><i class="bi bi-emoji-smile text-success fs-1"></i><h5 class="mt-3">¡Todo al día!</h5>${qrSession ? '<p>Visita otra estructura para ver más tareas.</p>' : ''}</div>`; 
        dateToday.textContent = new Date().toLocaleDateString(); 
        return; 
    }
    
    listaTareasTecnico.innerHTML = tareas.map(t => {
        const requiereArchivo = ['mensual', 'trimestral', 'semestral', 'anual'].includes(t.actividad.frecuencia);
        const requiereQR = ['diaria', 'semanal', 'quincenal'].includes(t.actividad.frecuencia);
        
        let bloqueado = false;
        if (requiereQR && (!qrSession || qrSession.structId !== t.estructura.id)) {
            bloqueado = true;
        }

        // Buscar último valor medido (Historial)
        const historicoRegs = regs.filter(r => r.actividad_id === t.actividad.id && r.estructura_id === t.estructura.id && r.valor_medido && r.estado === 'completado')
            .sort((a,b) => b.fecha_programada.localeCompare(a.fecha_programada));
        const ultimoValor = historicoRegs.length > 0 ? historicoRegs[0].valor_medido : null;

        let actionHtml = '';
        if (bloqueado) {
            actionHtml = `<button class="btn btn-secondary btn-sm" disabled><i class="bi bi-lock-fill"></i> Escanear QR aquí</button>`;
        } else if (requiereArchivo) {
            actionHtml = `
                <div class="d-flex flex-column gap-1" style="min-width: 180px;">
                    <input type="text" id="val-${t.id}" class="form-control form-control-sm" placeholder="Valor medido (opcional)">
                    <div class="d-flex gap-1">
                        <input type="file" id="file-${t.id}" class="form-control form-control-sm" required>
                        <button onclick="subirEvidencia(${t.id})" class="btn btn-success btn-sm"><i class="bi bi-upload"></i></button>
                    </div>
                </div>`;
        } else {
            actionHtml = `
                <div class="d-flex align-items-center gap-1">
                    <input type="text" id="val-${t.id}" class="form-control form-control-sm" placeholder="Valor medido" style="max-width: 120px;">
                    <button onclick="marcarTareaRapida(${t.id})" class="btn btn-success btn-sm"><i class="bi bi-check-lg"></i></button>
                </div>`;
        }

        return `
        <div class="card mb-2 shadow-sm border-start border-4 ${requiereArchivo ? 'border-warning' : 'border-primary'}">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="me-2">
                        <h6 class="mb-1 ${bloqueado ? 'text-muted' : ''}">${bloqueado ? '<i class="bi bi-lock-fill"></i> ' : ''}${t.actividad.nombre}</h6>
                        <small class="text-muted">
                            <b class="text-primary">${t.establecimiento.nombre}</b> > ${t.estructura ? t.estructura.nombre : 'General'} 
                            <span class="badge bg-secondary ms-1">${t.actividad.frecuencia}</span>
                        </small>
                        ${t.actividad.operacion ? `<p class="small mb-0 mt-1"><b>Operación:</b> ${t.actividad.operacion}</p>` : ''}
                        ${t.actividad.referencia ? `<p class="small mb-0"><b>Referencia:</b> ${t.actividad.referencia} ${ultimoValor ? `<span class="text-muted">(Último: ${ultimoValor})</span>` : ''}</p>` : ''}
                    </div>
                    <div>${actionHtml}</div>
                </div>
            </div>
        </div>`;
    }).join('');
    
    dateToday.textContent = new Date().toLocaleDateString();
};

// ==========================================
// INSPECTOR
// ==========================================
let rejectModalInstance = null;

const validarTarea = (idReg, nuevoEstado) => {
    if (nuevoEstado === 'rechazado') {
        document.getElementById('rejectRegId').value = idReg;
        rejectModalInstance = new bootstrap.Modal(document.getElementById('rejectModal'));
        rejectModalInstance.show();
    } else {
        const regs = getDB('registros');
        regs.find(r => r.id === idReg).estado = nuevoEstado;
        setDB('registros', regs);
        renderInspectorTable();
    }
};

const confirmarRechazo = () => {
    const idReg = parseFloat(document.getElementById('rejectRegId').value);
    const reason = document.getElementById('rejectReason').value.trim();
    if (!reason) { alert("El motivo es obligatorio."); return; }
    
    const regs = getDB('registros');
    const reg = regs.find(r => r.id === idReg);
    reg.estado = 'rechazado';
    reg.obs_inspector = reason;
    setDB('registros', regs);
    
    rejectModalInstance.hide();
    document.getElementById('rejectReason').value = '';
    renderInspectorTable();
};

const renderInspectorTable = () => {
    const regs = getDB('registros');
    const acts = getDB('actividades');
    const ests = getDB('establecimientos');

    const total = regs.length;
    const completadas = regs.filter(r => ['completado', 'validado'].includes(r.estado)).length;
    const pendientes = regs.filter(r => r.estado === 'pendiente').length;
    const rechazadas = regs.filter(r => r.estado === 'rechazado').length;
    
    kpiTotal.textContent = total;
    kpiCumplimiento.textContent = total > 0 ? Math.round((completadas/total)*100) + '%' : '0%';
    kpiPendientes.textContent = pendientes;
    kpiIncumplidas.textContent = rechazadas;

    const ctx = document.getElementById('statusChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completadas', 'Pendientes', 'Rechazadas'],
            datasets: [{
                data: [completadas, pendientes, rechazadas],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545']
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    const searchVal = filterSearch.value.toLowerCase();
    const statusVal = filterStatus.value;
    const freqVal = filterFreq.value;

    let filteredData = regs.map(r => {
        const act = acts.find(a => a.id === r.actividad_id);
        const est = act ? ests.find(e => e.id === act.establecimiento_id) : null;
        return { ...r, actividad: act, establecimiento: est };
    }).filter(row => {
        if (statusVal !== 'all' && row.estado !== statusVal) return false;
        if (freqVal !== 'all' && row.actividad && row.actividad.frecuencia !== freqVal) return false;
        if (searchVal) {
            const matchEst = row.establecimiento && row.establecimiento.nombre.toLowerCase().includes(searchVal);
            if (!matchEst) return false;
        }
        return true;
    });

    tablaInspector.innerHTML = filteredData.map(row => {
        if(!row.actividad) return '';
        let badgeClass = 'badge-pendiente';
        if(row.estado === 'validado') badgeClass = 'badge-validado';
        if(row.estado === 'rechazado') badgeClass = 'badge-rechazado';

        return `
            <tr>
                <td>${row.fecha_programada}</td>
                <td>${row.establecimiento ? row.establecimiento.nombre : 'N/A'}</td>
                <td>${row.actividad.nombre}<br><small class="text-muted">Ref: ${row.actividad.referencia || '-'}</small></td>
                <td><small>${row.valor_medido || '-'}</small></td>
                <td><span class="badge ${badgeClass}">${row.estado.toUpperCase()}</span></td>
                <td><small class="text-danger">${row.obs_inspector || '-'}</small></td>
                <td>
                    ${row.estado === 'completado' ? `
                        <button onclick="validarTarea(${row.id}, 'validado')" class="btn btn-sm btn-success"><i class="bi bi-check"></i></button>
                        <button onclick="validarTarea(${row.id}, 'rechazado')" class="btn btn-sm btn-danger"><i class="bi bi-x"></i></button>
                    ` : '-'}
                </td>
            </tr>`;
    }).join('');
};

function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const regs = getDB('registros');
    const acts = getDB('actividades');
    const ests = getDB('establecimientos');

    doc.setFontSize(20);
    doc.setTextColor(0, 74, 152);
    doc.text("Informe de Fiscalización - GAD", 14, 22);
    
    const tableData = [];
    regs.forEach(r => {
        const act = acts.find(a => a.id === r.actividad_id);
        const est = act ? ests.find(e => e.id === act.establecimiento_id) : null;
        tableData.push([
            r.fecha_programada,
            est ? est.nombre : '-',
            act ? act.nombre : '-',
            r.valor_medido || '-',
            r.estado.toUpperCase(),
            r.obs_inspector || '-'
        ]);
    });

    doc.autoTable({
        startY: 30,
        head: [['Fecha', 'Lugar', 'Actividad', 'Medido', 'Estado', 'Observaciones']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [0, 74, 152] }
    });

    doc.save('Informe_GAD.pdf');
}

// ==========================================
// RENDER PRINCIPAL
// ==========================================
const renderUI = () => {
    loginScreen.classList.add('d-none');
    navContent.innerHTML = `<span class="text-white me-3">Hola, <b>${currentUser.nombre}</b></span><button onclick="logout()" class="btn btn-outline-light btn-sm">Salir</button>`;

    if (currentUser.rol === 'tecnico') {
        tecnicoPanel.classList.remove('d-none');
        formEstablecimiento.addEventListener('submit', crearEstablecimiento);
        formEstructura.addEventListener('submit', crearEstructura);
        formActividad.addEventListener('submit', crearActividad);
        structEstSelect.addEventListener('change', renderListaEstructuras);
        
        actFreq.addEventListener('change', (e) => {
            mesField.classList.toggle('d-none', !['mensual', 'trimestral', 'semestral', 'anual'].includes(e.target.value));
        });

        verificarSesionQR(); 
        renderTecnicoTareas();
    } else {
        inspectorPanel.classList.remove('d-none');
        filterSearch.addEventListener('keyup', renderInspectorTable);
        filterStatus.addEventListener('change', renderInspectorTable);
        filterFreq.addEventListener('change', renderInspectorTable);
        renderInspectorTable();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initDB();
    checkSession();
    loginForm.addEventListener('submit', login);
});
