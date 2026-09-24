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
let qrSession = null; // Guardará { structId, structName, expira }
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

// Verificar si accedió por QR (URL: ?qr=ID_ESTRUCTURA)
const verificarSesionQR = () => {
    const params = new URLSearchParams(window.location.search);
    const qrId = params.get('qr');
    if (qrId) {
        const struct = getDB('estructuras').find(s => s.id == qrId);
        if (struct) {
            const expira = Date.now() + (60 * 60 * 1000); // 1 hora
            qrSession = { structId: struct.id, structName: struct.nombre, expira: expira };
            localStorage.setItem('qrSession', JSON.stringify(qrSession));
            // Limpiar URL
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
    
    // Iniciar temporizador visual
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
        foto: structPhoto.files[0] ? structPhoto.files[0].name : 'sin_foto.jpg'
    };
    estructuras.push(newStruct);
    setDB('estructuras', estructuras);
    
    // Mostrar QR generado
    const qrUrl = `${window.location.origin}${window.location.pathname}?qr=${newStruct.id}`;
    alert(`✅ Estructura agregada.\n\nURL del QR para imprimir:\n${qrUrl}\n\n(Copie este enlace y genere un QR en google para imprimirlo)`);
    
    e.target.reset();
    actualizarSelectsTecnico();
    renderListaEstructuras();
};

const crearActividad = (e) => {
    e.preventDefault();
    const structId = parseInt(actStructName.value);
    const structObj = getDB('estructuras').find(s => s.id === structId);
    const freq = actFreq.value;
    
    const acts = getDB('actividades');
    acts.push({
        id: Date.now(),
        estructura_id: structId,
        estructura_nombre: structObj ? structObj.nombre : 'N/A',
        establecimiento_id: structObj ? structObj.establecimiento_id : null,
        nombre: actName.value,
        frecuencia: freq,
        mes_ejecucion: ['mensual', 'semestral', 'anual'].includes(freq) ? parseInt(actMes.value) : null
    });
    setDB('actividades', acts);
    alert('✅ Actividad programada.');
    e.target.reset();
    mesField.classList.add('d-none');
    generarRegistrosDelDia();
    renderTecnicoTareas();
};

const actualizarSelectsTecnico = () => {
    const ests = getDB('establecimientos').filter(e => e.usuario_id === currentUser.id);
    const opts = ests.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    structEstSelect.innerHTML = opts;
    actEst.innerHTML = opts;
    actEst.onchange = () => cargarEstructurasDropdown(actEst.value);
    if(ests.length > 0) cargarEstructurasDropdown(ests[0].id);
};

const cargarEstructurasDropdown = (estId) => {
    const estructuras = getDB('estructuras').filter(e => e.establecimiento_id == estId);
    actStructName.innerHTML = estructuras.length === 0 ? '<option value="">-- No hay --</option>' : estructuras.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
};

const renderListaEstructuras = () => {
    const estId = structEstSelect.value;
    if(!estId) return;
    const estructuras = getDB('estructuras').filter(e => e.establecimiento_id == estId);
    listaEstructuras.innerHTML = estructuras.length === 0 ? '<small class="text-muted">Sin estructuras.</small>' : '<hr><h6>Lista:</h6>' + estructuras.map(e => `<div class="d-flex align-items-center mb-1"><i class="bi bi-check-circle-fill text-success me-2"></i>${e.nombre}</div>`).join('');
};

const generarRegistrosDelDia = () => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    const diaSemana = hoy.getDay();
    const mesActual = hoy.getMonth();

    const acts = getDB('actividades');
    const regs = getDB('registros');
    const ests = getDB('establecimientos');

    acts.forEach(act => {
        if (regs.find(r => r.actividad_id === act.id && r.fecha_programada === hoyStr)) return;
        const est = ests.find(e => e.id === act.establecimiento_id);
        let generar = false;

        if (['diaria', 'semanal'].includes(act.frecuencia)) {
            if (est && est.dias_atencion && est.dias_atencion.includes(diaSemana)) generar = true;
        } else {
            if (act.mes_ejecucion === mesActual) generar = true;
        }

        if (generar) regs.push({ id: Date.now() + Math.random(), actividad_id: act.id, fecha_programada: hoyStr, estado: 'pendiente', evidencia: null, obs_inspector: '' });
    });
    setDB('registros', regs);
};

const marcarTareaRapida = (idReg) => {
    const regs = getDB('registros');
    regs.find(r => r.id === idReg).estado = 'completado';
    setDB('registros', regs);
    renderTecnicoTareas();
};

const subirEvidencia = (idReg) => {
    const fileInput = document.getElementById(`file-${idReg}`);
    if (!fileInput || fileInput.files.length === 0) { alert("⚠️ Debe seleccionar un archivo."); return; }
    const regs = getDB('registros');
    const reg = regs.find(r => r.id === idReg);
    reg.estado = 'completado';
    reg.evidencia = fileInput.files[0].name;
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

    const tareas = regs.filter(r => r.fecha_programada === hoy && r.estado === 'pendiente')
        .map(r => {
            const act = acts.find(a => a.id === r.actividad_id);
            const est = act ? ests.find(e => e.id === act.establecimiento_id && e.usuario_id === currentUser.id) : null;
            if(!est) return null;
            const struct = act ? estructuras.find(s => s.id === act.estructura_id) : null;
            return { ...r, actividad: act, establecimiento: est, estructura: struct };
        }).filter(t => t !== null);
    
    if (tareas.length === 0) {
        listaTareasTecnico.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-emoji-smile text-success fs-1"></i><h5 class="mt-3">¡Todo al día!</h5></div>'; 
        dateToday.textContent = new Date().toLocaleDateString(); 
        return; 
    }
    
    listaTareasTecnico.innerHTML = tareas.map(t => {
        const requiereArchivo = ['mensual', 'semestral', 'anual'].includes(t.actividad.frecuencia);
        const requiereQR = ['diaria', 'semanal'].includes(t.actividad.frecuencia);
        
        // Lógica de Bloqueo QR
        let bloqueado = false;
        if (requiereQR && (!qrSession || qrSession.structId !== t.estructura.id)) {
            bloqueado = true;
        }

        let actionHtml = '';
        if (bloqueado) {
            actionHtml = `<button class="btn btn-secondary btn-sm" disabled><i class="bi bi-lock-fill"></i> Escanear QR</button>`;
        } else if (requiereArchivo) {
            actionHtml = `<div class="d-flex align-items-center gap-2"><input type="file" id="file-${t.id}" class="form-control form-control-sm" style="max-width: 150px;" required><button onclick="subirEvidencia(${t.id})" class="btn btn-success btn-sm"><i class="bi bi-upload"></i></button></div>`;
        } else {
            actionHtml = `<button onclick="marcarTareaRapida(${t.id})" class="btn btn-success btn-sm"><i class="bi bi-check-lg"></i> Listo</button>`;
        }

        return `
        <div class="card mb-2 shadow-sm border-start border-4 ${requiereArchivo ? 'border-warning' : 'border-primary'}">
            <div class="card-body d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1 ${bloqueado ? 'text-muted' : ''}">${bloqueado ? '<i class="bi bi-lock-fill"></i> ' : ''}${t.actividad.nombre}</h6>
                    <small class="text-muted"><b class="text-primary">${t.establecimiento.nombre}</b> > ${t.estructura ? t.estructura.nombre : 'General'} <span class="badge bg-secondary ms-1">${t.actividad.frecuencia}</span></small>
                </div>
                <div>${actionHtml}</div>
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

    // KPIs
    const total = regs.length;
    const completadas = regs.filter(r => ['completado', 'validado'].includes(r.estado)).length;
    const pendientes = regs.filter(r => r.estado === 'pendiente').length;
    const rechazadas = regs.filter(r => r.estado === 'rechazado').length;
    
    kpiTotal.textContent = total;
    kpiCumplimiento.textContent = total > 0 ? Math.round((completadas/total)*100) + '%' : '0%';
    kpiPendientes.textContent = pendientes;
    kpiIncumplidas.textContent = rechazadas;

    // Actualizar Gráfico
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

    // Filtros
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
                <td>${row.actividad.nombre}</td>
                <td><span class="badge bg-info text-dark">${row.actividad.frecuencia}</span></td>
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

// PDF
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
            act ? act.frecuencia : '-',
            r.estado.toUpperCase(),
            r.obs_inspector || '-' // Incluir observaciones en PDF
        ]);
    });

    doc.autoTable({
        startY: 30,
        head: [['Fecha', 'Lugar', 'Actividad', 'Frec.', 'Estado', 'Observaciones']],
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
            mesField.classList.toggle('d-none', !['mensual', 'semestral', 'anual'].includes(e.target.value));
        });

        verificarSesionQR(); // Verifica si hay sesión QR activa
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
