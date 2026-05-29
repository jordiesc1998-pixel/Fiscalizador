// ==========================================
// LÓGICA DE BASE DE DATOS (LocalStorage)
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
    if (!localStorage.getItem('estructuras')) localStorage.setItem('estructuras', '[]'); // Nueva tabla
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

// 1. Crear Establecimiento (con Propietario y CI)
const crearEstablecimiento = (e) => {
    e.preventDefault();
    const ests = getDB('establecimientos');
    const newEst = {
        id: Date.now(),
        nombre: document.getElementById('estName').value,
        direccion: document.getElementById('estDir').value,
        propietario: document.getElementById('estOwner').value,
        ci_ruc: document.getElementById('estCi').value,
        usuario_id: currentUser.id,
        usuario_nombre: currentUser.nombre
    };
    ests.push(newEst);
    setDB('establecimientos', ests);
    alert('✅ Establecimiento creado.');
    e.target.reset();
    actualizarSelectsTecnico();
};

// 2. Crear Estructura Física (con Foto)
const crearEstructura = (e) => {
    e.preventDefault();
    const estId = parseInt(document.getElementById('structEstSelect').value);
    const nombre = document.getElementById('structName').value;
    const fotoInput = document.getElementById('structPhoto');
    const fotoName = fotoInput.files.length > 0 ? fotoInput.files[0].name : 'sin_foto.jpg';

    const estructuras = getDB('estructuras');
    estructuras.push({
        id: Date.now(),
        establecimiento_id: estId,
        nombre: nombre,
        foto: fotoName
    });
    setDB('estructuras', estructuras);
    alert(`✅ Estructura "${nombre}" agregada.`);
    e.target.reset();
    actualizarSelectsTecnico();
    renderListaEstructuras(); // Mostrar lista visual
};

// 3. Crear Actividad
const crearActividad = (e) => {
    e.preventDefault();
    const structId = parseInt(document.getElementById('actStructName').value); // Ahora es ID
    const structObj = getDB('estructuras').find(s => s.id === structId);
    
    const acts = getDB('actividades');
    acts.push({
        id: Date.now(),
        estructura_id: structId,
        estructura_nombre: structObj ? structObj.nombre : 'N/A',
        establecimiento_id: structObj ? structObj.establecimiento_id : null,
        nombre: document.getElementById('actName').value,
        frecuencia: document.getElementById('actFreq').value
    });
    setDB('actividades', acts);
    alert('✅ Actividad programada.');
    e.target.reset();
    generarRegistrosDelDia();
    renderTecnicoTareas();
};

// Actualizar todos los Selects
const actualizarSelectsTecnico = () => {
    const ests = getDB('establecimientos').filter(e => e.usuario_id === currentUser.id);
    
    // Select de "Agregar Estructura"
    const selectEstStruct = document.getElementById('structEstSelect');
    selectEstStruct.innerHTML = ests.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');

    // Select de "Crear Actividad - Establecimiento"
    const selectActEst = document.getElementById('actEst');
    selectActEst.innerHTML = ests.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    
    // Trigger para cargar estructuras cuando se cambia el establecimiento en el form de actividad
    selectActEst.onchange = () => cargarEstructurasDropdown(selectActEst.value);
    if(ests.length > 0) cargarEstructurasDropdown(ests[0].id); // Cargar el primero por defecto
};

// Llenar el Dropdown de Estructuras basado en el Establecimiento seleccionado
const cargarEstructurasDropdown = (estId) => {
    const estructuras = getDB('estructuras').filter(e => e.establecimiento_id == estId);
    const select = document.getElementById('actStructName');
    
    if (estructuras.length === 0) {
        select.innerHTML = '<option value="">-- No hay estructuras --</option>';
        return;
    }
    
    select.innerHTML = estructuras.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
};

// Mostrar lista visual de estructuras (Mini galería)
const renderListaEstructuras = () => {
    const container = document.getElementById('listaEstructuras');
    const estIdSelect = document.getElementById('structEstSelect').value;
    if(!estIdSelect) return;

    const estructuras = getDB('estructuras').filter(e => e.establecimiento_id == estIdSelect);
    if(estructuras.length === 0) { container.innerHTML = '<small class="text-muted">Sin estructuras añadidas.</small>'; return; }

    container.innerHTML = '<hr><h6>Estructuras añadidas:</h6>' + 
        estructuras.map(e => `
            <div class="d-flex align-items-center mb-1">
                <i class="bi bi-check-circle-fill text-success me-2"></i>
                <span>${e.nombre} <small class="text-muted">(${e.foto})</small></span>
            </div>
        `).join('');
};

const generarRegistrosDelDia = () => {
    const hoy = new Date().toISOString().split('T')[0];
    const acts = getDB('actividades');
    const regs = getDB('registros');
    acts.forEach(act => {
        if (!regs.find(r => r.actividad_id === act.id && r.fecha_programada === hoy)) {
            regs.push({ id: Date.now() + Math.random(), actividad_id: act.id, fecha_programada: hoy, estado: 'pendiente' });
        }
    });
    setDB('registros', regs);
};

const marcarTarea = (idReg, tipo) => {
    const regs = getDB('registros');
    const reg = regs.find(r => r.id === idReg);
    reg.estado = 'completado';
    setDB('registros', regs);
    alert('✅ Tarea completada');
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

    // Filtrar tareas pendientes
    const tareas = regs.filter(r => r.fecha_programada === hoy && r.estado === 'pendiente')
        .map(r => {
            const act = acts.find(a => a.id === r.actividad_id);
            const est = ests.find(e => e.id === act.establecimiento_id);
            const struct = estructuras.find(s => s.id === act.estructura_id);
            return { ...r, actividad: act, establecimiento: est, estructura: struct };
        });
    
    const container = document.getElementById('listaTareasTecnico');
    if (tareas.length === 0) { container.innerHTML = '<div class="text-center text-muted py-5">¡Sin tareas pendientes!</div>'; document.getElementById('dateToday').textContent = new Date().toLocaleDateString(); return; }
    
    container.innerHTML = tareas.map(t => `
        <div class="card mb-2 shadow-sm border-start border-4 border-primary">
            <div class="card-body d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${t.actividad.nombre}</h6>
                    <small class="text-muted">
                        <b class="text-primary">${t.establecimiento ? t.establecimiento.nombre : 'N/A'}</b> 
                        > <b>${t.estructura ? t.estructura.nombre : 'N/A'}</b>
                    </small>
                </div>
                <div>
                    <button onclick="marcarTarea(${t.id}, 'check')" class="btn btn-success btn-sm"><i class="bi bi-check"></i> Listo</button>
                </div>
            </div>
        </div>
    `).join('');
    document.getElementById('dateToday').textContent = new Date().toLocaleDateString();
};

// ==========================================
// INSPECTOR
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
    const estructuras = getDB('estructuras');

    // KPIs
    const total = regs.length;
    const completadas = regs.filter(r => ['completado', 'validado'].includes(r.estado)).length;
    document.getElementById('kpiTotal').textContent = total;
    document.getElementById('kpiCumplimiento').textContent = total > 0 ? Math.round((completadas/total)*100) + '%' : '0%';
    document.getElementById('kpiPendientes').textContent = regs.filter(r => r.estado === 'pendiente').length;
    document.getElementById('kpiIncumplidas').textContent = regs.filter(r => r.estado === 'rechazado').length;

    // Filtros
    const searchVal = document.getElementById('filterSearch').value.toLowerCase();
    const statusVal = document.getElementById('filterStatus').value;

    let filteredData = regs.map(r => {
        const act = acts.find(a => a.id === r.actividad_id);
        const est = act ? ests.find(e => e.id === act.establecimiento_id) : null;
        return { ...r, actividad: act, establecimiento: est };
    }).filter(row => {
        if (statusVal !== 'all' && row.estado !== statusVal) return false;
        if (searchVal) {
            const matchEst = row.establecimiento && row.establecimiento.nombre.toLowerCase().includes(searchVal);
            const matchOwner = row.establecimiento && row.establecimiento.propietario && row.establecimiento.propietario.toLowerCase().includes(searchVal);
            if (!matchEst && !matchOwner) return false;
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
                <td><small>${row.establecimiento ? row.establecimiento.propietario : '-'}<br><span class="text-muted">CI: ${row.establecimiento ? row.establecimiento.ci_ruc : '-'}</span></small></td>
                <td><span class="badge ${badgeClass}">${row.estado.toUpperCase()}</span></td>
                <td>
                    ${row.estado === 'completado' ? `
                        <button onclick="validirTarea(${row.id}, 'validado')" class="btn btn-sm btn-success"><i class="bi bi-check"></i></button>
                        <button onclick="validarTarea(${row.id}, 'rechazado')" class="btn btn-sm btn-danger"><i class="bi bi-x"></i></button>
                    ` : '-'}
                </td>
            </tr>`;
    }).join('');
};

// PDF Generation
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const regs = getDB('registros');
    const acts = getDB('actividades');
    const ests = getDB('establecimientos');

    doc.setFontSize(20);
    doc.setTextColor(0, 74, 152);
    doc.text("Informe de Fiscalización - GAD", 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Fecha: " + new Date().toLocaleDateString(), 14, 30);

    const total = regs.length;
    const completadas = regs.filter(r => ['completado', 'validado'].includes(r.estado)).length;
    const porcentaje = total > 0 ? Math.round((completadas/total)*100) : 0;

    doc.setFontSize(12); doc.setTextColor(0);
    doc.text("Resumen: " + porcentaje + "% de cumplimiento (" + completadas + "/" + total + " tareas).", 14, 45);

    const tableData = [];
    regs.forEach(r => {
        const act = acts.find(a => a.id === r.actividad_id);
        const est = act ? ests.find(e => e.id === act.establecimiento_id) : null;
        tableData.push([
            r.fecha_programada,
            est ? est.nombre : '-',
            act ? act.estructura_nombre : '-',
            act ? act.nombre : '-',
            est ? est.propietario : '-',
            r.estado.toUpperCase()
        ]);
    });

    doc.autoTable({
        startY: 55,
        head: [['Fecha', 'Establecimiento', 'Estructura', 'Actividad', 'Propietario', 'Estado']],
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
        // Listeners forms
        document.getElementById('formEstablecimiento').addEventListener('submit', crearEstablecimiento);
        document.getElementById('formEstructura').addEventListener('submit', crearEstructura);
        document.getElementById('formActividad').addEventListener('submit', crearActividad);
        document.getElementById('structEstSelect').addEventListener('change', renderListaEstructuras);
        
        renderTecnicoTareas();
    } else {
        document.getElementById('inspectorPanel').classList.remove('d-none');
        document.getElementById('filterSearch').addEventListener('keyup', renderInspectorTable);
        document.getElementById('filterStatus').addEventListener('change', renderInspectorTable);
        renderInspectorTable();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initDB();
    checkSession();
    document.getElementById('loginForm').addEventListener('submit', login);
});
