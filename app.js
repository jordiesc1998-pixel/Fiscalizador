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
    ests.push({
        id: Date.now(),
        nombre: document.getElementById('estName').value,
        direccion: document.getElementById('estDir').value,
        estructuras: document.getElementById('estStruct').value,
        foto: document.getElementById('estPhoto').files[0] ? document.getElementById('estPhoto').files[0].name : 'sin_foto',
        usuario_id: currentUser.id,
        usuario_nombre: currentUser.nombre
    });
    setDB('establecimientos', ests);
    alert('✅ Establecimiento guardado');
    e.target.reset();
    actualizarSelectEstablecimientos();
    renderTecnicoTareas();
};

const crearActividad = (e) => {
    e.preventDefault();
    const acts = getDB('actividades');
    acts.push({
        id: Date.now(),
        establecimiento_id: parseInt(document.getElementById('actEst').value),
        estructura: document.getElementById('actStructName').value,
        nombre: document.getElementById('actName').value,
        frecuencia: document.getElementById('actFreq').value
    });
    setDB('actividades', acts);
    alert('✅ Actividad programada');
    e.target.reset();
    generarRegistrosDelDia();
    renderTecnicoTareas();
};

const actualizarSelectEstablecimientos = () => {
    const ests = getDB('establecimientos').filter(e => e.usuario_id === currentUser.id);
    document.getElementById('actEst').innerHTML = ests.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
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
    if (tipo === 'check') { reg.estado = 'completado'; alert('✔️ Hecho'); }
    else { reg.estado = 'completado'; alert('📷 Evidencia Subida'); }
    setDB('registros', regs);
    renderTecnicoTareas();
};

const renderTecnicoTareas = () => {
    actualizarSelectEstablecimientos();
    generarRegistrosDelDia();
    const regs = getDB('registros');
    const acts = getDB('actividades');
    const ests = getDB('establecimientos');
    const hoy = new Date().toISOString().split('T')[0];
    const misEstIds = ests.filter(e => e.usuario_id === currentUser.id).map(e => e.id);
    const misActs = acts.filter(a => misEstIds.includes(a.establecimiento_id));
    const tareas = regs.filter(r => r.fecha_programada === hoy && misActs.some(a => a.id === r.actividad_id) && r.estado === 'pendiente');
    
    const container = document.getElementById('listaTareasTecnico');
    if (tareas.length === 0) { container.innerHTML = '<div class="text-center text-muted py-5">¡Sin tareas pendientes!</div>'; return; }
    
    container.innerHTML = tareas.map(t => {
        const act = misActs.find(a => a.id === t.actividad_id);
        const est = ests.find(e => e.id === act.establecimiento_id);
        return `
            <div class="card mb-2 shadow-sm border-start border-4 border-primary">
                <div class="card-body d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${act.nombre}</h6>
                        <small class="text-muted"><b>${est.nombre}</b> > ${act.estructura}</small>
                    </div>
                    <div>
                        <button onclick="marcarTarea(${t.id}, 'check')" class="btn btn-success btn-sm"><i class="bi bi-check"></i></button>
                    </div>
                </div>
            </div>`;
    }).join('');
    document.getElementById('dateToday').textContent = new Date().toLocaleDateString();
};

// ==========================================
// INSPECTOR - LÓGICA Y PDF
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
            const matchAct = row.actividad && row.actividad.nombre.toLowerCase().includes(searchVal);
            if (!matchEst && !matchAct) return false;
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
                <td>${row.actividad.estructura}</td>
                <td>${row.actividad.nombre}</td>
                <td>${row.establecimiento ? row.establecimiento.usuario_nombre : 'N/A'}</td>
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

// ==========================================
// FUNCIÓN GENERAR PDF
// ==========================================

function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const regs = getDB('registros');
    const acts = getDB('actividades');
    const ests = getDB('establecimientos');

    // Título
    doc.setFontSize(20);
    doc.setTextColor(0, 74, 152); // Azul GAD
    doc.text("Informe de Mantenimiento - GAD", 14, 22);
    
    // Fecha
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Fecha de generación: " + new Date().toLocaleDateString(), 14, 30);

    // Resumen (KPIs)
    const total = regs.length;
    const completadas = regs.filter(r => ['completado', 'validado'].includes(r.estado)).length;
    const porcentaje = total > 0 ? Math.round((completadas/total)*100) : 0;

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Resumen General:", 14, 45);
    doc.setFontSize(10);
    doc.text("Total de Tareas: " + total, 14, 52);
    doc.text("Cumplimiento: " + porcentaje + "%", 14, 58);

    // Preparar datos para la tabla
    const tableData = [];
    regs.forEach(r => {
        const act = acts.find(a => a.id === r.actividad_id);
        if (!act) return;
        const est = ests.find(e => e.id === act.establecimiento_id);
        
        tableData.push([
            r.fecha_programada,
            est ? est.nombre : 'N/A',
            act.estructura,
            act.nombre,
            est ? est.usuario_nombre : 'N/A',
            r.estado.toUpperCase()
        ]);
    });

    // Generar Tabla con AutoTable
    doc.autoTable({
        startY: 65,
        head: [['Fecha', 'Establecimiento', 'Estructura', 'Actividad', 'Técnico', 'Estado']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [0, 74, 152] }, // Azul institucional
        styles: { fontSize: 8 }
    });

    // Guardar
    doc.save('Informe_Mantenimiento_GAD.pdf');
}

// ==========================================
// RENDERIZADO PRINCIPAL
// ==========================================
const renderUI = () => {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('navContent').innerHTML = `<span class="text-white me-3">Hola, <b>${currentUser.nombre}</b></span><button onclick="logout()" class="btn btn-outline-light btn-sm">Salir</button>`;

    if (currentUser.rol === 'tecnico') {
        document.getElementById('tecnicoPanel').classList.remove('d-none');
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
    document.getElementById('formEstablecimiento').addEventListener('submit', crearEstablecimiento);
    document.getElementById('formActividad').addEventListener('submit', crearActividad);
});
