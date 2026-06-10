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

// ==========================================
// SESIÓN
// ==========================================
const checkSession = () => { const user = localStorage.getItem('sessionUser'); if (user) { currentUser = JSON.parse(user); renderUI(); } };
const login = (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const user = getDB('usuarios').find(u => u.email === email && u.pass === pass);
    if (user) { currentUser = user; localStorage.setItem('sessionUser', JSON.stringify(user)); renderUI(); }
    else { document.getElementById('loginError').textContent = "Credenciales incorrectas."; document.getElementById('loginError').classList.remove('d-none'); }
};
const logout = () => { localStorage.removeItem('sessionUser'); location.reload(); };

// ==========================================
// TÉCNICO - LÓGICA
// ==========================================
const crearEstablecimiento = (e) => {
    e.preventDefault();
    const ests = getDB('establecimientos');
    const pdfInput = document.getElementById('estPlanPdf');
    const pdfName = pdfInput.files.length > 0 ? pdfInput.files[0].name : 'Sin plan';
    const diasAtencion = [];
    document.querySelectorAll('.dia-check:checked').forEach(el => diasAtencion.push(parseInt(el.value)));

    if(diasAtencion.length === 0) { alert("Seleccione días de atención."); return; }

    ests.push({
        id: Date.now(),
        nombre: document.getElementById('estName').value,
        direccion: document.getElementById('estDir').value,
        propietario: document.getElementById('estOwner').value,
        ci_ruc: document.getElementById('estCi').value,
        plan_pdf: pdfName,
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
    const estId = parseInt(document.getElementById('structEstSelect').value);
    const nombre = document.getElementById('structName').value;
    const fotoInput = document.getElementById('structPhoto');
    const fotoName = fotoInput.files.length > 0 ? fotoInput.files[0].name : 'sin_foto.jpg';

    const estructuras = getDB('estructuras');
    estructuras.push({ id: Date.now(), establecimiento_id: estId, nombre: nombre, foto: fotoName });
    setDB('estructuras', estructuras);
    alert('✅ Estructura agregada.');
    e.target.reset();
    actualizarSelectsTecnico();
    renderListaEstructuras();
};

const crearActividad = (e) => {
    e.preventDefault();
    const structId = parseInt(document.getElementById('actStructName').value);
    const structObj = getDB('estructuras').find(s => s.id === structId);
    const freq = document.getElementById('actFreq').value;
    const mes = document.getElementById('actMes').value; // Capturar mes

    const acts = getDB('actividades');
    acts.push({
        id: Date.now(),
        estructura_id: structId,
        estructura_nombre: structObj ? structObj.nombre : 'N/A',
        establecimiento_id: structObj ? structObj.establecimiento_id : null,
        nombre: document.getElementById('actName').value,
        frecuencia: freq,
        mes_ejecucion: freq === 'semestral' || freq === 'anual' || freq === 'mensual' ? parseInt(mes) : null // Guardar mes si aplica
    });
    setDB('actividades', acts);
    alert('✅ Actividad programada.');
    e.target.reset();
    document.getElementById('mesField').classList.add('d-none'); // Ocultar campo mes
    generarRegistrosDelDia();
    renderTecnicoTareas();
};

const actualizarSelectsTecnico = () => {
    const ests = getDB('establecimientos').filter(e => e.usuario_id === currentUser.id);
    const selectEstStruct = document.getElementById('structEstSelect');
    selectEstStruct.innerHTML = ests.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    const selectActEst = document.getElementById('actEst');
    selectActEst.innerHTML = ests.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    
    selectActEst.onchange = () => cargarEstructurasDropdown(selectActEst.value);
    if(ests.length > 0) cargarEstructurasDropdown(ests[0].id);
};

const cargarEstructurasDropdown = (estId) => {
    const estructuras = getDB('estructuras').filter(e => e.establecimiento_id == estId);
    const select = document.getElementById('actStructName');
    if (estructuras.length === 0) { select.innerHTML = '<option value="">-- No hay estructuras --</option>'; return; }
    select.innerHTML = estructuras.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
};

const renderListaEstructuras = () => {
    const container = document.getElementById('listaEstructuras');
    const estIdSelect = document.getElementById('structEstSelect').value;
    if(!estIdSelect) return;
    const estructuras = getDB('estructuras').filter(e => e.establecimiento_id == estIdSelect);
    if(estructuras.length === 0) { container.innerHTML = '<small class="text-muted">Sin estructuras.</small>'; return; }
    container.innerHTML = '<hr><h6>Lista:</h6>' + estructuras.map(e => `<div class="d-flex align-items-center mb-1"><i class="bi bi-check-circle-fill text-success me-2"></i>${e.nombre}</div>`).join('');
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

        if (act.frecuencia === 'diaria' || act.frecuencia === 'semanal') {
            if (est && est.dias_atencion && est.dias_atencion.includes(diaSemana)) generar = true;
        } else {
            // Lógica para Mensual, Semestral, Anual
            // Para el demo, generamos si el mes actual coincide con el mes configurado
            // Si es semestral, podría haber lógica de 6 meses, pero simplificamos a "Mes de inicio" para el demo
            if (act.mes_ejecucion === mesActual) generar = true;
        }

        if (generar) {
            regs.push({ id: Date.now() + Math.random(), actividad_id: act.id, fecha_programada: hoyStr, estado: 'pendiente', evidencia: null });
        }
    });
    setDB('registros', regs);
};

// Función separada para marcar tareas rápidas (Diaria/Semanal)
const marcarTareaRapida = (idReg) => {
    const regs = getDB('registros');
    const reg = regs.find(r => r.id === idReg);
    reg.estado = 'completado';
    setDB('registros', regs);
    alert('✅ ¡Tarea completada!');
    renderTecnicoTareas();
};

// Función para subir evidencia (Mensual/Semestral/Anual)
const subirEvidencia = (idReg) => {
    const fileInput = document.getElementById(`file-${idReg}`);
    if (!fileInput || fileInput.files.length === 0) {
        alert("⚠️ Debe seleccionar un archivo para marcar esta actividad como hecha.");
        return;
    }
    
    const fileName = fileInput.files[0].name;
    const regs = getDB('registros');
    const reg = regs.find(r => r.id === idReg);
    reg.estado = 'completado'; // En un caso real sería 'pendiente_validacion'
    reg.evidencia = fileName;
    setDB('registros', regs);
    alert(`✅ Evidencia "${fileName}" subida. Tarea completada.`);
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
    
    const container = document.getElementById('listaTareasTecnico');
    if (tareas.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-emoji-smile text-success fs-1"></i><h5 class="mt-3">¡Todo al día!</h5></div>'; 
        document.getElementById('dateToday').textContent = new Date().toLocaleDateString(); 
        return; 
    }
    
    // Renderizado condicional
    container.innerHTML = tareas.map(t => {
        // Determinar si requiere archivo (Mensual, Semestral, Anual)
        const requiereArchivo = ['mensual', 'semestral', 'anual'].includes(t.actividad.frecuencia);
        
        let actionHtml = '';
        if (requiereArchivo) {
            actionHtml = `
                <div class="d-flex align-items-center gap-2">
                    <input type="file" id="file-${t.id}" class="form-control form-control-sm" style="max-width: 180px;" required>
                    <button onclick="subirEvidencia(${t.id})" class="btn btn-success btn-sm"><i class="bi bi-upload"></i></button>
                </div>`;
        } else {
            actionHtml = `<button onclick="marcarTareaRapida(${t.id})" class="btn btn-success btn-sm"><i class="bi bi-check-lg"></i> Listo</button>`;
        }

        return `
        <div class="card mb-2 shadow-sm border-start border-4 ${requiereArchivo ? 'border-warning' : 'border-primary'}">
            <div class="card-body d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${t.actividad.nombre}</h6>
                    <small class="text-muted">
                        <b class="text-primary">${t.establecimiento.nombre}</b> > ${t.estructura ? t.estructura.nombre : 'General'}
                        <span class="badge bg-secondary ms-1">${t.actividad.frecuencia}</span>
                    </small>
                </div>
                <div>${actionHtml}</div>
            </div>
        </div>`;
    }).join('');
    
    document.getElementById('dateToday').textContent = new Date().toLocaleDateString();
};

// ==========================================
// INSPECTOR (Sin cambios relevantes, incluir igual que antes)
// ==========================================
const validarTarea = (idReg, nuevoEstado) => {
    const regs = getDB('registros');
    regs.find(r => r.id === idReg).estado = nuevoEstado;
    setDB('registros', regs);
    renderInspectorTable();
};

const renderInspectorTable = () => {
    const regs = getDB('registros');
    const acts = getDB('actividades');
    const ests = getDB('establecimientos');

    const total = regs.length;
    const completadas = regs.filter(r => ['completado', 'validado'].includes(r.estado)).length;
    document.getElementById('kpiTotal').textContent = total;
    document.getElementById('kpiCumplimiento').textContent = total > 0 ? Math.round((completadas/total)*100) + '%' : '0%';
    document.getElementById('kpiPendientes').textContent = regs.filter(r => r.estado === 'pendiente').length;
    document.getElementById('kpiIncumplidas').textContent = regs.filter(r => r.estado === 'rechazado').length;

    const searchVal = document.getElementById('filterSearch').value.toLowerCase();
    const statusVal = document.getElementById('filterStatus').value;
    const freqVal = document.getElementById('filterFreq').value;

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

    const tbody = document.getElementById('tablaInspector');
    tbody.innerHTML = filteredData.map(row => {
        if(!row.actividad) return '';
        let badgeClass = 'badge-pendiente';
        if(row.estado === 'validado') badgeClass = 'badge-validado';
        if(row.estado === 'rechazado') badgeClass = 'badge-rechazado';

        return `
            <tr>
                <td>${row.fecha_programada}</td>
                <td>${row.establecimiento ? row.establecimiento.nombre : 'N/A'}</td>
                <td>${row.actividad.estructura_nombre}</td>
                <td>${row.actividad.nombre}</td>
                <td><span class="badge bg-info text-dark">${row.actividad.frecuencia}</span></td>
                <td><small>${row.establecimiento ? row.establecimiento.propietario : '-'}</small></td>
                <td><span class="badge ${badgeClass}">${row.estado.toUpperCase()}</span></td>
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
            r.estado.toUpperCase()
        ]);
    });

    doc.autoTable({
        startY: 30,
        head: [['Fecha', 'Lugar', 'Actividad', 'Frec.', 'Estado']],
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
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('navContent').innerHTML = `<span class="text-white me-3">Hola, <b>${currentUser.nombre}</b></span><button onclick="logout()" class="btn btn-outline-light btn-sm">Salir</button>`;

    if (currentUser.rol === 'tecnico') {
        document.getElementById('tecnicoPanel').classList.remove('d-none');
        document.getElementById('formEstablecimiento').addEventListener('submit', crearEstablecimiento);
        document.getElementById('formEstructura').addEventListener('submit', crearEstructura);
        document.getElementById('formActividad').addEventListener('submit', crearActividad);
        document.getElementById('structEstSelect').addEventListener('change', renderListaEstructuras);
        
        // Listener para mostrar/ocultar campo MES
        document.getElementById('actFreq').addEventListener('change', (e) => {
            const freq = e.target.value;
            const mesField = document.getElementById('mesField');
            if (['mensual', 'semestral', 'anual'].includes(freq)) {
                mesField.classList.remove('d-none');
            } else {
                mesField.classList.add('d-none');
            }
        });

        renderTecnicoTareas();
    } else {
        document.getElementById('inspectorPanel').classList.remove('d-none');
        document.getElementById('filterSearch').addEventListener('keyup', renderInspectorTable);
        document.getElementById('filterStatus').addEventListener('change', renderInspectorTable);
        document.getElementById('filterFreq').addEventListener('change', renderInspectorTable);
        renderInspectorTable();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initDB();
    checkSession();
    document.getElementById('loginForm').addEventListener('submit', login);
});
