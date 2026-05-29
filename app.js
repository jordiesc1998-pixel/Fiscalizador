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

const crearEstablecimiento = (e) => {
    e.preventDefault();
    const ests = getDB('establecimientos');
    ests.push({ id: Date.now(), nombre: document.getElementById('estName').value, direccion: document.getElementById('estDir').value, estructuras: document.getElementById('estStruct').value, usuario_id: currentUser.id, usuario_nombre: currentUser.nombre });
    setDB('establecimientos', ests);
    alert('Establecimiento creado'); e.target.reset(); actualizarSelectEstablecimientos(); renderTecnicoTareas();
};

const crearActividad = (e) => {
    e.preventDefault();
    const acts = getDB('actividades');
    acts.push({ id: Date.now(), establecimiento_id: parseInt(document.getElementById('actEst').value), nombre: document.getElementById('actName').value, frecuencia: document.getElementById('actFreq').value });
    setDB('actividades', acts);
    alert('Actividad creada'); e.target.reset(); generarRegistrosDelDia(); renderTecnicoTareas();
};

const actualizarSelectEstablecimientos = () => {
    const ests = getDB('establecimientos').filter(e => e.usuario_id === currentUser.id);
    document.getElementById('actEst').innerHTML = ests.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
};

const generarRegistrosDelDia = () => {
    const hoy = new Date().toISOString().split('T')[0];
    const acts = getDB('actividades');
    const regs = getDB('registros');
    acts.forEach(act => { if (!regs.find(r => r.actividad_id === act.id && r.fecha_programada === hoy)) regs.push({ id: Date.now() + Math.random(), actividad_id: act.id, fecha_programada: hoy, estado: 'pendiente' }); });
    setDB('registros', regs);
};

const marcarTarea = (idReg, tipo) => {
    const regs = getDB('registros');
    const reg = regs.find(r => r.id === idReg);
    if (tipo === 'check') { reg.estado = 'completado'; alert('Hecho'); }
    else { reg.estado = 'completado'; alert('Evidencia Subida (Simulado)'); }
    setDB('registros', regs); renderTecnicoTareas(); renderInspectorTable();
};

const validarTarea = (idReg, estado) => {
    const regs = getDB('registros'); regs.find(r => r.id === idReg).estado = estado;
    setDB('registros', regs); renderInspectorTable();
};

const renderTecnicoTareas = () => {
    actualizarSelectEstablecimientos(); generarRegistrosDelDia();
    const regs = getDB('registros'); const acts = getDB('actividades'); const ests = getDB('establecimientos');
    const hoy = new Date().toISOString().split('T')[0];
    const misEstIds = ests.filter(e => e.usuario_id === currentUser.id).map(e => e.id);
    const misActs = acts.filter(a => misEstIds.includes(a.establecimiento_id));
    const tareas = regs.filter(r => r.fecha_programada === hoy && misActs.some(a => a.id === r.actividad_id) && r.estado === 'pendiente');
    const container = document.getElementById('listaTareasTecnico');
    
    if (tareas.length === 0) { container.innerHTML = '<div class="text-center text-muted py-5">¡Sin tareas pendientes!</div>'; return; }
    
    container.innerHTML = tareas.map(t => {
        const act = misActs.find(a => a.id === t.actividad_id);
        const est = ests.find(e => e.id === act.establecimiento_id);
        const requiereFoto = !['diaria', 'semanal'].includes(act.frecuencia);
        return `<div class="card mb-2 shadow-sm border-start border-4 border-primary"><div class="card-body d-flex justify-content-between align-items-center">
            <div><h6 class="mb-1">${act.nombre}</h6><small class="text-muted">${est.nombre}</small></div>
            <div>${requiereFoto ? `<button onclick="marcarTarea(${t.id}, 'foto')" class="btn btn-success btn-sm">Subir Foto</button>` : `<button onclick="marcarTarea(${t.id}, 'check')" class="btn btn-success btn-sm">✓ Marcar</button>`}</div>
        </div></div>`;
    }).join('');
    document.getElementById('dateToday').textContent = new Date().toLocaleDateString();
};

const renderInspectorTable = () => {
    const regs = getDB('registros'); const acts = getDB('actividades'); const ests = getDB('establecimientos');
    const total = regs.length; const completadas = regs.filter(r => ['completado', 'validado'].includes(r.estado)).length;
    document.getElementById('kpiTotal').textContent = total;
    document.getElementById('kpiCumplimiento').textContent = total > 0 ? Math.round((completadas/total)*100) + '%' : '0%';
    document.getElementById('kpiPendientes').textContent = regs.filter(r => r.estado === 'pendiente').length;
    document.getElementById('kpiIncumplidas').textContent = regs.filter(r => r.estado === 'rechazado').length;

    document.getElementById('tablaInspector').innerHTML = regs.map(r => {
        const act = acts.find(a => a.id === r.actividad_id); if(!act) return ''; const est = ests.find(e => e.id === act.establecimiento_id);
        let badge = r.estado === 'validado' ? 'badge-validado' : (r.estado === 'rechazado' ? 'badge-rechazado' : 'badge-pendiente');
        return `<tr><td>${r.fecha_programada}</td><td>${est ? est.nombre : ''}</td><td>${act.nombre}</td><td>${est ? est.usuario_nombre : ''}</td>
        <td><span class="badge ${badge}">${r.estado}</span></td>
        <td>${r.estado === 'completado' ? `<button onclick="validirTarea(${r.id}, 'validado')" class="btn btn-sm btn-success">Aprobar</button>` : '-'}</td></tr>`;
    }).join('');
};

const renderUI = () => {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('navContent').innerHTML = `<span class="text-white me-3">Hola, <b>${currentUser.nombre}</b></span><button onclick="logout()" class="btn btn-outline-light btn-sm">Salir</button>`;
    if (currentUser.rol === 'tecnico') { document.getElementById('tecnicoPanel').classList.remove('d-none'); renderTecnicoTareas(); }
    else { document.getElementById('inspectorPanel').classList.remove('d-none'); renderInspectorTable(); }
};

document.addEventListener('DOMContentLoaded', () => { initDB(); checkSession(); document.getElementById('loginForm').addEventListener('submit', login); document.getElementById('formEstablecimiento').addEventListener('submit', crearEstablecimiento); document.getElementById('formActividad').addEventListener('submit', crearActividad); });
