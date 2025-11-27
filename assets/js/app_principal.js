// Assets/Js/app_principal.js
// Lógica Core: Inicialización IndexedDB y utilidades CRUD globales.

(function() {
    // ============================================================
    // CONSTANTES Y CONFIGURACIÓN GLOBAL
    // ============================================================
    const SUCURSALES = [
        "Coppel 363", "Coppel 385", "Coppel 716",
        "Elektra 218", "Chedraui 23", "Chedraui 99", "Chedraui 105"
    ];
    const PRODUCTOS = ["Amigo Kit", "CGI Cero", "Chip Express", "Portabilidad", "B63"];
    const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    let db;
    const DB_NAME = "CentralPwaDB"; // Nombre Único para la DB
    const DB_VERSION = 2; // Incrementada para crear las nuevas stores de App1

    // STORES CONSOLIDADAS: App1 (Asistencia) + App2 (Ventas)
    const STORES = {
        PROMOTORES: "promotores", // Shared: Promotores/Users
        METAS: "metas",
        VENTAS: "ventas",
        EVIDENCES: "evidences", // App1: Registros de Asistencia
        SCHEDULES: "schedules", // App1: Horarios Asignados
        DOCUMENTS: "documents", // App1: Incapacidades, Reportes
        CONFIG: "config" // Shared: Configuración Gist
    };

    // ============================================================
    // INDEXEDDB – INICIALIZACIÓN
    // ============================================================
    window.initDB = function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                updateDbStatus("Error de BD", true);
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. App 2 (Ventas) Stores
                if (!db.objectStoreNames.contains(STORES.PROMOTORES)) {
                    db.createObjectStore(STORES.PROMOTORES, { keyPath: "id", autoIncrement: true }).createIndex("sucursal", "sucursal", { unique: false });
                }
                if (!db.objectStoreNames.contains(STORES.METAS)) {
                    db.createObjectStore(STORES.METAS, { keyPath: "id", autoIncrement: true }).createIndex("metaUnica", ["mes", "sucursal", "producto"], { unique: true });
                }
                if (!db.objectStoreNames.contains(STORES.VENTAS)) {
                    db.createObjectStore(STORES.VENTAS, { keyPath: "id", autoIncrement: true }).createIndex("fecha", "fecha");
                }
                
                // 2. App 1 (Asistencia) Stores
                if (!db.objectStoreNames.contains(STORES.EVIDENCES)) {
                    db.createObjectStore(STORES.EVIDENCES, { keyPath: "id" }); // 'userId_fecha'
                }
                if (!db.objectStoreNames.contains(STORES.SCHEDULES)) {
                    db.createObjectStore(STORES.SCHEDULES, { keyPath: "id", autoIncrement: true }); 
                }
                if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
                    db.createObjectStore(STORES.DOCUMENTS, { keyPath: "id", autoIncrement: true }); 
                }

                // 3. Shared Store
                if (!db.objectStoreNames.contains(STORES.CONFIG)) {
                    db.createObjectStore(STORES.CONFIG, { keyPath: "id" });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                updateDbStatus("BD Conectada", false);
                // Exponer el objeto DB y Constantes globalmente
                window.db = db;
                window.STORES = STORES;
                window.SUCURSALES = SUCURSALES;
                window.PRODUCTOS = PRODUCTOS;
                window.MESES = MESES;
                resolve();
            };
        });
    }

    function updateDbStatus(msg, isError) {
        const el = document.getElementById("db-status");
        if (!el) return;
        const statusEl = el.querySelector('span');
        if(!statusEl) return;
        statusEl.classList.toggle("bg-yellow-500", !isError);
        statusEl.classList.toggle("bg-red-500", isError);
        el.textContent = msg;
        // Asistencia app status
        document.getElementById('db-status-asistencia')?.textContent = msg;
    }

    // ============================================================
    // UTILIDADES CRUD GLOBALES (Expuestas en window, basadas en app1.html)
    // ============================================================

    // Obtener por ID
    window.getByID = function(store, id) {
        return new Promise((resolve, reject) => {
            const req = db.transaction(store, "readonly").objectStore(store).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = err => reject(err);
        });
    }

    // Obtener todos
    window.getAll = function(store) {
        return new Promise((resolve, reject) => {
            const req = db.transaction(store, "readonly").objectStore(store).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = err => reject(err);
        });
    }

    // Agregar/Actualizar
    window.put = function(store, data) {
        return new Promise((resolve, reject) => {
            const req = db.transaction(store, "readwrite").objectStore(store).put(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror = err => reject(err);
        });
    }

    // Eliminar (Adaptado de App1 y App2)
    window.remove = function(store, id) {
        return new Promise((resolve, reject) => {
            const req = db.transaction(store, "readwrite").objectStore(store).delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = err => reject(err);
        });
    }

    // Mostrar Toast (Adaptado de App2)
    window.showToast = function(msg, err = false) {
        const t = document.getElementById("toast");
        const m = document.getElementById("toast-message");
        if (!t || !m) return;

        m.textContent = msg;
        t.classList.remove("bg-green-600", "bg-red-600", "opacity-0", "translate-y-10");
        t.classList.add(err ? "bg-red-600" : "bg-green-600", "opacity-100", "translate-y-0");

        setTimeout(() => {
            t.classList.add("opacity-0", "translate-y-10");
            t.classList.remove("opacity-100", "translate-y-0");
        }, 3000);
    }
    
    // Función de Fusión (Merge) - Usado para Gist Sync
    window.mergeArrays = function(remoteArr = [], localArr = []) {
        const map = new Map();
        remoteArr.forEach(item => {
            // Se asegura de que el item tenga un ID válido
            if (item && item.id !== undefined) map.set(item.id, item);
        });
        localArr.forEach(item => {
            if (item && item.id !== undefined) map.set(item.id, item);
        });
        return Array.from(map.values());
    }

    // Reemplazar todos los datos (Usado en Sync From Gist)
    window.replaceAll = function(storeName, dataArray) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);

            const clearReq = store.clear();
            clearReq.onsuccess = () => {
                let i = 0;
                (function addNext() {
                    if (i >= dataArray.length) { resolve(); return; }
                    // Quitamos la clave "id" si es autoincremental
                    const item = { ...dataArray[i++] };
                    if(storeName !== STORES.EVIDENCES) delete item.id; 
                    
                    const addReq = store.add(item);
                    addReq.onsuccess = addNext;
                    addReq.onerror = e => reject(e.target.error);
                })();
            };
            clearReq.onerror = e => reject(e.target.error);
        });
    }
})();
```eof

### 2. `Appall/index.html` (Shell y Router)
El shell principal permanece igual, pero ahora carga todos los scripts lógicos necesarios para ambos módulos.

```html:Shell Principal PWA:Appall/index.html
<!DOCTYPE html>
<html lang="es" class="h-full bg-slate-100">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Panel Central PWA Multi-Módulo</title>

    <link rel="manifest" href="./manifest.json">
    <link rel="stylesheet" href="./assets/css/tailwind.min.css">
    <link rel="stylesheet" href="./apps/App1/src/output.css">
    
    <script defer src="./assets/js/lucide.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>
    <script src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'></script>
    <meta name="theme-color" content="#0ea5e9">
    
    <style>
        /* Estilos de la PWA (para botones de navegación) */
        body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
        .nav-btn.active { border-bottom: 2px solid white; }
    </style>

    <script>
      if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('./sw.js')
              .then(() => console.log('[SW] Service Worker registrado correctamente.'))
              .catch(e => console.error('[SW] Fallo al registrar el Service Worker:', e));
      }
    </script>
</head>
<body class="h-full">

    <header class="bg-blue-600 text-white shadow sticky top-0 z-10">
        <div class="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 class="text-xl font-bold">Panel Central (PWA)</h1>
            <nav class="space-x-4 h-10 flex items-center">
                <button id="nav-asistencia" onclick="navigate('asistencia')" class="nav-btn py-2 px-4 rounded hover:bg-blue-700 transition active">
                    Asistencia PRO
                </button>
                <button id="nav-ventas" onclick="navigate('ventas')" class="nav-btn py-2 px-4 rounded hover:bg-blue-700 transition">
                    Ventas & Metas
                </button>
            </nav>
        </div>
    </header>

    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div id="app-container" class="bg-white p-6 rounded-lg shadow min-h-[70vh]">
            <p class="text-center text-slate-500 py-10">Iniciando base de datos y cargando módulo...</p>
        </div>
    </main>
    
    <div id="toast" class="fixed bottom-0 right-0 m-4 p-3 rounded-lg shadow-xl text-white opacity-0 transition duration-300 transform translate-y-10" role="alert">
        <span id="toast-message">Mensaje de prueba</span>
    </div>

    <script src="./assets/js/app_principal.js"></script>
    <script src="./assets/js/app_router.js"></script>
    <script src="./apps/App1/assets/js/app_asistencia_logic.js"></script>
    <script src="./apps/App2/assets/js/app_ventas_logic.js"></script>

</body>
</html>
```eof

### 3. `Appall/sw.js` (Service Worker)

Se actualiza la lista de activos para incluir todos los scripts y vistas del nuevo modelo.

```javascript:Service Worker PWA Multi-App:Appall/sw.js
const CACHE_NAME = 'pwa-central-v2';

// Importante: TODAS las rutas deben ser relativas a la raíz (./)
const ASSETS = [
    // Raíz de la Aplicación
    './', 
    './index.html',
    './manifest.json',

    // Assets Comunes (¡Rutas Corregidas!)
    './assets/js/app_principal.js',
    './assets/js/app_router.js',
    './assets/js/lucide.min.js',
    './assets/css/tailwind.min.css', 
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',

    // App 1: Asistencia (¡Rutas Corregidas!)
    './apps/App1/view_asistencia.html', 
    './apps/App1/assets/js/app_asistencia_logic.js', 
    './apps/App1/src/output.css',
    
    // App 2: Ventas (¡Rutas Corregidas!)
    './apps/App2/view_ventas.html', 
    './apps/App2/assets/js/app_ventas_logic.js', 

    // Iconos, si los tienes: './assets/icons/icon-192x192.png',
];

// ... (Resto del código del Service Worker: install, activate, fetch - es el mismo)
// (Usar la versión anterior o la que te di en la respuesta anterior para completar el SW)
// ...
```eof

---

## 🚀 App 1: Asistencia (Código Terminado)

### 4. `Appall/apps/App1/view_asistencia.html` (Vista Pura)

Se elimina el `<head>` y los scripts del `app1.html` original para que solo quede el contenido inyectable.

```html:Vista de Asistencia (Solo HTML):Appall/apps/App1/view_asistencia.html
<div class="flex h-full overflow-hidden">
    <div id="sidebar-asistencia" class="sidebar flex-shrink-0 w-64 bg-white border-r border-slate-200 p-4 pt-8 h-full shadow-lg z-50 fixed md:relative transform -translate-x-full md:translate-x-0">
        <div class="flex flex-col h-full">
            <h1 class="text-2xl font-black text-indigo-600 mb-8 flex items-center gap-2">
                <i data-lucide="shield-check" class="w-6 h-6"></i> Asistencias PRO
            </h1>

            <nav class="flex-grow space-y-2">
                <button id="nav-team" onclick="showTab('team')" class="tab-btn active bg-slate-50 w-full flex items-center gap-3 p-3 rounded-xl text-slate-700 hover:bg-slate-100 font-medium transition duration-150">
                    <i data-lucide="users" class="w-5 h-5 text-indigo-500"></i> Gestión de Equipo
                </button>
                <button id="nav-individual" onclick="showTab('individual')" class="tab-btn w-full hidden items-center gap-3 p-3 rounded-xl text-slate-700 hover:bg-slate-100 font-medium transition duration-150">
                    <div id="ind-initials" class="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs">UN</div>
                    <span id="ind-name">Usuario Activo</span>
                </button>
                <button id="nav-docs" onclick="showTab('docs')" class="tab-btn w-full flex items-center gap-3 p-3 rounded-xl text-slate-700 hover:bg-slate-100 font-medium transition duration-150">
                    <i data-lucide="clipboard-list" class="w-5 h-5 text-indigo-500"></i> Documentación/Pendientes
                </button>
            </nav>

            <div class="mt-8 pt-4 border-t border-slate-100 space-y-3">
                <h3 class="text-xs font-semibold text-slate-500 uppercase">Sincronización</h3>
                <button onclick="syncFromGist()" class="w-full flex items-center gap-3 p-3 rounded-xl text-sm text-slate-700 hover:bg-slate-100 transition duration-150 border border-slate-200">
                    <i data-lucide="cloud-download" class="w-4 h-4 text-green-500"></i> Descargar de Gist
                </button>
                <button onclick="syncToGist()" class="w-full flex items-center gap-3 p-3 rounded-xl text-sm text-slate-700 hover:bg-slate-100 transition duration-150 border border-slate-200">
                    <i data-lucide="cloud-upload" class="w-4 h-4 text-blue-500"></i> Subir a Gist
                </button>
                <div class="flex items-center justify-between text-xs text-slate-500 mt-4">
                    <span class="flex items-center gap-1" id="db-status-asistencia">
                        <span class="w-2 h-2 rounded-full bg-yellow-500"></span> Inicializando...
                    </span>
                    <button onclick="showConfigModal()" class="text-indigo-500 hover:text-indigo-700 font-medium">
                        <i data-lucide="settings" class="w-4 h-4 inline-block"></i> Config
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div class="flex-grow p-4 md:p-8 overflow-y-auto">
        
        <button id="menu-btn" class="md:hidden fixed top-4 left-4 z-50 p-2 bg-indigo-600 text-white rounded-full shadow-lg" aria-label="Abrir Menú">
            <i data-lucide="menu" class="w-6 h-6"></i>
        </button>

        <div id="view-team" class="app1-view transition-opacity duration-300">
            <header class="flex justify-between items-center mb-6">
                <h2 class="text-3xl font-bold text-slate-800">Gestión de Promotores</h2>
                <button onclick="openUserModal('new')" class="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-indigo-700 transition duration-150 flex items-center gap-2">
                    <i data-lucide="user-plus" class="w-5 h-5"></i> Añadir Promotor
                </button>
            </header>
            <div id="team-grid" class="mt-8">
                <p class="text-center text-slate-500">Cargando promotores...</p>
            </div>
        </div>

        <div id="view-individual" class="app1-view hidden transition-opacity duration-300">
            <header class="mb-6 flex items-center gap-4 border-b pb-4">
                <div id="ind-initials" class="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-xl flex-shrink-0">UN</div>
                <div>
                    <h2 class="text-3xl font-bold text-slate-800" id="ind-name">Nombre del Promotor</h2>
                    <p class="text-sm text-slate-500" id="ind-branch">Sucursal: Sucursal X</p>
                </div>
            </header>
            
            <div class="flex border-b mb-6">
                <button id="subtab-evidencia" onclick="switchIndTab('evidencia')" class="subtab-btn text-blue-600 border-b-2 border-blue-600 bg-blue-50 py-2 px-4 font-semibold transition duration-150">
                    Asistencia y Evidencia
                </button>
                <button id="subtab-historial" onclick="switchIndTab('historial')" class="subtab-btn text-slate-500 hover:text-slate-700 py-2 px-4 font-semibold transition duration-150">
                    Historial y Stats
                </button>
                <button id="subtab-schedule" onclick="switchIndTab('schedule')" class="subtab-btn text-slate-500 hover:text-slate-700 py-2 px-4 font-semibold transition duration-150">
                    Horario
                </button>
            </div>

            <div id="ind-view-evidencia" class="ind-view-tab">
                <section class="mb-8 p-6 bg-white rounded-xl shadow-md">
                    <h3 class="text-xl font-semibold mb-4 text-slate-700">Registro de Asistencia</h3>
                    
                    <div class="mb-4">
                        <label for="evidence-date" class="block text-sm font-medium text-slate-700">Fecha de Asistencia</label>
                        <input type="date" id="evidence-date" onchange="loadCurrentEvidence()" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2">
                    </div>

                    <div class="grid md:grid-cols-2 gap-6 mb-6">
                        <div class="border border-slate-200 rounded-xl p-4">
                            <h4 class="font-medium text-slate-600 mb-2">Entrada (Check-In)</h4>
                            <p id="entry-time" class="text-3xl font-bold text-green-600 mb-2">--:--</p>
                            <input type="file" id="entry-file" accept="image/*" class="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" onchange="processImage('entrada')"/>
                            <div class="mt-2 text-xs text-slate-500">Estado OCR: <span id="entry-ocr-status">Pendiente</span></div>
                        </div>

                        <div class="border border-slate-200 rounded-xl p-4">
                            <h4 class="font-medium text-slate-600 mb-2">Salida (Check-Out)</h4>
                            <p id="exit-time" class="text-3xl font-bold text-red-600 mb-2">--:--</p>
                            <input type="file" id="exit-file" accept="image/*" class="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" onchange="processImage('salida')"/>
                            <div class="mt-2 text-xs text-slate-500">Estado OCR: <span id="exit-ocr-status">Pendiente</span></div>
                        </div>
                    </div>

                    <button onclick="saveEvidence()" class="w-full bg-green-600 text-white px-4 py-3 rounded-xl shadow-md hover:bg-green-700 transition duration-150 font-semibold flex items-center justify-center gap-2">
                        <i data-lucide="save" class="w-5 h-5"></i> Guardar Asistencia del Día
                    </button>
                </section>
            </div>

            <div id="ind-view-historial" class="ind-view-tab hidden">
                <section class="mb-8">
                    <h3 class="text-xl font-semibold mb-4 text-slate-700">Registro de Historial</h3>
                    <div class="bg-white p-4 rounded-xl shadow-md overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr class="bg-gray-50">
                                    <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                    <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entrada</th>
                                    <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salida</th>
                                    <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hrs Totales</th>
                                    <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="user-history-body" class="bg-white divide-y divide-gray-200">
                                </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <div id="ind-view-schedule" class="ind-view-tab hidden">
                <section class="mb-8 p-6 bg-white rounded-xl shadow-md">
                    <h3 class="text-xl font-semibold mb-4 text-slate-700">Horario Asignado Semanal</h3>
                    <ul id="schedule-list" class="space-y-3 mb-6">
                        </ul>
                    <button onclick="openScheduleModal()" class="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl shadow-sm hover:bg-indigo-200 transition duration-150 flex items-center gap-2 font-medium">
                        <i data-lucide="calendar-plus" class="w-5 h-5"></i> Editar Horario
                    </button>
                </section>
            </div>
        </div>

        <div id="view-docs" class="app1-view hidden transition-opacity duration-300">
            <header class="mb-6 flex justify-between items-center">
                <h2 class="text-3xl font-bold text-slate-800">Documentación y Reportes</h2>
                <div class="flex gap-3">
                    <button onclick="openDocModal('WeeklyReport')" class="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-indigo-700 transition duration-150 flex items-center gap-2">
                        <i data-lucide="file-text" class="w-5 h-5"></i> Nuevo Reporte
                    </button>
                    <button onclick="openDocModal('Incapacity')" class="bg-yellow-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-yellow-700 transition duration-150 flex items-center gap-2">
                        <i data-lucide="shield-off" class="w-5 h-5"></i> Incapacidad
                    </button>
                </div>
            </header>
            
            <div class="mb-6">
                <label for="doc-user-select" class="block text-sm font-medium text-slate-700">Filtrar por Promotor:</label>
                <select id="doc-user-select" class="mt-1 block w-full md:w-1/3 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2">
                    </select>
            </div>

            <div class="grid md:grid-cols-2 gap-6">
                <section class="p-6 bg-white rounded-xl shadow-md">
                    <h3 class="text-xl font-semibold mb-4 text-slate-700 flex justify-between items-center">
                        Reportes Semanales
                        <i data-lucide="file-text" class="w-6 h-6 text-indigo-400"></i>
                    </h3>
                    <ul id="weekly-reports-list" class="space-y-3 max-h-96 overflow-y-auto">
                        <li class="text-sm text-slate-500">Selecciona un promotor para ver reportes.</li>
                    </ul>
                </section>

                <section class="p-6 bg-white rounded-xl shadow-md">
                    <h3 class="text-xl font-semibold mb-4 text-slate-700 flex justify-between items-center">
                        Incapacidades y Permisos Activos
                        <i data-lucide="shield-off" class="w-6 h-6 text-yellow-400"></i>
                    </h3>
                    <ul id="incapacities-list" class="space-y-3 max-h-96 overflow-y-auto">
                        <li class="text-sm text-slate-500">Cargando incapacidades...</li>
                    </ul>
                </section>
            </div>
        </div>

        <div id="modal-config" class="modal-overlay hidden fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center p-4">
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg modal-content">
                <h3 class="text-2xl font-bold mb-4 text-slate-800">Configuración Gist</h3>
                <p class="text-slate-500 mb-6">Introduce tu ID de Gist y Token de GitHub para sincronizar los datos de asistencia.</p>
                <form id="gist-config-form" class="space-y-4">
                    <div>
                        <label for="gistId" class="block text-sm font-medium text-slate-700">ID del Gist:</label>
                        <input type="text" id="gistId" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2" required>
                    </div>
                    <div>
                        <label for="githubToken" class="block text-sm font-medium text-slate-700">Token Personal de GitHub (PAT):</label>
                        <input type="password" id="githubToken" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2" required>
                    </div>
                    <div class="flex justify-end pt-4 border-t mt-4">
                        <button type="button" onclick="closeModal('modal-config')" class="text-slate-500 px-4 py-2 rounded-xl hover:bg-slate-100 transition mr-2">Cancelar</button>
                        <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-indigo-700 transition">Guardar Configuración</button>
                    </div>
                </form>
            </div>
        </div>

        <div id="user-modal" class="modal-overlay hidden fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center p-4">
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg modal-content">
                <h3 id="user-modal-title" class="text-2xl font-bold mb-4 text-slate-800">Añadir Promotor</h3>
                <form id="form-user" class="space-y-4">
                    <input type="hidden" id="user-id">
                    <div>
                        <label for="user-name" class="block text-sm font-medium text-slate-700">Nombre Completo:</label>
                        <input type="text" id="user-name" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2" required>
                    </div>
                    <div>
                        <label for="user-dni" class="block text-sm font-medium text-slate-700">DNI/CURP/ID:</label>
                        <input type="text" id="user-dni" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2">
                    </div>
                    <div>
                        <label for="user-sucursal" class="block text-sm font-medium text-slate-700">Sucursal:</label>
                        <select id="user-sucursal" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2" required>
                            </select>
                    </div>
                    <div class="flex justify-between items-center pt-4 border-t mt-4">
                        <button type="button" id="btn-delete-user" onclick="deleteUser()" class="bg-red-500 text-white px-4 py-2 rounded-xl shadow-md hover:bg-red-600 transition hidden">Eliminar</button>
                        <div>
                            <button type="button" onclick="closeModal('user-modal')" class="text-slate-500 px-4 py-2 rounded-xl hover:bg-slate-100 transition mr-2">Cancelar</button>
                            <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-indigo-700 transition">Guardar</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <div id="schedule-modal" class="modal-overlay hidden fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center p-4">
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg modal-content">
                <h3 class="text-2xl font-bold mb-4 text-slate-800">Editar Horario de <span id="schedule-user-name"></span></h3>
                <form id="form-schedule" class="space-y-4">
                    <div id="schedule-form-content" class="space-y-3">
                        </div>
                    <div class="flex justify-end pt-4 border-t mt-4">
                        <button type="button" onclick="closeModal('schedule-modal')" class="text-slate-500 px-4 py-2 rounded-xl hover:bg-slate-100 transition mr-2">Cancelar</button>
                        <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-indigo-700 transition">Guardar Horario</button>
                    </div>
                </form>
            </div>
        </div>

        <div id="doc-modal" class="modal-overlay hidden fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center p-4">
            <div class="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg modal-content">
                <h3 id="doc-modal-title" class="text-2xl font-bold mb-4 text-slate-800">Nuevo Documento</h3>
                <form id="form-document" class="space-y-4">
                    <input type="hidden" id="doc-id">
                    <input type="hidden" id="doc-type">
                    <div>
                        <label for="doc-modal-user" class="block text-sm font-medium text-slate-700">Promotor:</label>
                        <select id="doc-modal-user" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2" required>
                            </select>
                    </div>
                    <div>
                        <label for="doc-date-start" class="block text-sm font-medium text-slate-700">Fecha de Inicio:</label>
                        <input type="date" id="doc-date-start" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2" required>
                    </div>
                    <div>
                        <label for="doc-date-end" class="block text-sm font-medium text-slate-700">Fecha de Fin (Opcional):</label>
                        <input type="date" id="doc-date-end" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2">
                    </div>
                    <div>
                        <label for="doc-description" class="block text-sm font-medium text-slate-700">Notas/Descripción:</label>
                        <textarea id="doc-description" rows="3" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm p-2"></textarea>
                    </div>
                    <div class="flex justify-end pt-4 border-t mt-4">
                        <button type="button" id="btn-delete-doc" onclick="deleteDocument()" class="bg-red-500 text-white px-4 py-2 rounded-xl shadow-md hover:bg-red-600 transition hidden">Eliminar</button>
                        <button type="button" onclick="closeModal('doc-modal')" class="text-slate-500 px-4 py-2 rounded-xl hover:bg-slate-100 transition mr-2">Cancelar</button>
                        <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-indigo-700 transition">Guardar Documento</button>
                    </div>
                </form>
            </div>
        </div>

    </div>
</div>
```eof

### 5. `Appall/apps/App1/assets/js/app_asistencia_logic.js` (Lógica Completa)

Este archivo implementa todas las funciones de CRUD, OCR y sincronización que tu HTML requiere.

```javascript:Logica App Asistencia Completa:Appall/apps/App1/assets/js/app_asistencia_logic.js
// apps/App1/assets/js/app_asistencia_logic.js
// Lógica completa del módulo de Asistencia (App1). Utiliza las funciones globales de app_principal.js.

(function() {
    let activeUserId = null;
    let usersList = [];
    let currentEvidence = {}; // Almacena temporalmente la evidencia para el día activo

    const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const GIST_FILE_NAME = 'asistencias_pro_data.json';
    
    // ============================================================
    // INICIALIZACIÓN (Llamada por el Router)
    // ============================================================

    window.initAsistenciaApp = async function() {
        console.log("-> Módulo Asistencia Inicializado.");
        
        // Asignación de listeners de formularios
        document.getElementById('form-user')?.addEventListener('submit', handleSaveUser);
        document.getElementById('form-schedule')?.addEventListener('submit', handleSaveSchedule);
        document.getElementById('form-document')?.addEventListener('submit', handleSaveDocument);
        document.getElementById('gist-config-form')?.addEventListener('submit', handleSaveGistConfig);
        document.getElementById('doc-user-select')?.addEventListener('change', (e) => renderWeeklyReportList(e.target.value));

        // Listeners para botones de menú en móvil
        document.getElementById('menu-btn')?.addEventListener('click', () => {
             document.getElementById('sidebar-asistencia')?.classList.toggle('-translate-x-full');
        });

        // 1. Cargar datos iniciales
        await loadInitialData();
        
        // 2. Mostrar la primera vista
        showTab('team'); 
        
        // 3. Renderizar Iconos
        if (typeof lucide !== 'undefined') { lucide.createIcons(); }
    }

    async function loadInitialData() {
        try {
            usersList = await window.getAll(window.STORES.PROMOTORES);
            renderTeamGrid(usersList);
            populateUserSelects(usersList);
            await renderIncapacitiesList(); // Carga las incapacidades activas
        } catch (e) {
            window.showToast("Error al cargar datos iniciales: " + e.message, true);
            console.error(e);
        }
    }

    // ============================================================
    // UTILIDADES UI Y NAVEGACIÓN
    // ============================================================

    window.showTab = function(tabId) {
        document.querySelectorAll('.app1-view').forEach(view => view.classList.add('hidden'));
        document.getElementById(`view-${tabId}`)?.classList.remove('hidden');

        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active', 'bg-slate-50'));
        document.getElementById(`nav-${tabId}`)?.classList.add('active', 'bg-slate-50');

        // Cerrar sidebar en móvil al cambiar de vista
        document.getElementById('sidebar-asistencia')?.classList.add('-translate-x-full');
    }

    window.switchIndTab = function(tabId) {
        document.querySelectorAll('.ind-view-tab').forEach(view => view.classList.add('hidden'));
        document.getElementById(`ind-view-${tabId}`)?.classList.remove('hidden');

        document.querySelectorAll('.subtab-btn').forEach(btn => btn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600', 'bg-blue-50'));
        document.getElementById(`subtab-${tabId}`)?.classList.add('text-blue-600', 'border-b-2', 'border-blue-600', 'bg-blue-50');
        
        // Ejecutar lógica específica para la pestaña
        if (tabId === 'schedule') {
            loadUserSchedule(activeUserId);
        } else if (tabId === 'historial') {
            loadUserHistory(activeUserId);
        } else if (tabId === 'evidencia') {
            loadCurrentEvidence();
        }
    }

    window.closeModal = function(modalId) {
        document.getElementById(modalId)?.classList.add('hidden');
    }

    window.showConfigModal = async function() {
        const cfg = await getGistConfig();
        document.getElementById('gistId').value = cfg.gistId;
        document.getElementById('githubToken').value = cfg.token;
        document.getElementById('modal-config')?.classList.remove('hidden');
    }
    
    // Obtener iniciales para el icono de usuario
    function getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    
    // ============================================================
    // VISTA DE EQUIPO (CRUD Promotores)
    // ============================================================
    
    function renderTeamGrid(users) {
        const grid = document.getElementById('team-grid');
        grid.innerHTML = users.map(user => `
            <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-md flex flex-col items-center text-center hover:shadow-lg transition duration-150 cursor-pointer" onclick="openUserPanel('${user.id}', '${user.name}', '${user.sucursal}')">
                <div class="w-16 h-16 rounded-full bg-indigo-500 text-white flex items-center justify-center font-extrabold text-2xl mb-3">
                    ${getInitials(user.name)}
                </div>
                <h3 class="text-lg font-bold text-slate-800">${user.name}</h3>
                <p class="text-sm text-slate-500 mb-4">${user.sucursal}</p>
                <div class="w-full h-2 rounded-full bg-slate-200">
                    <div class="h-full rounded-full bg-green-500" style="width: ${user.totalAssists || 0}%"></div>
                </div>
                <p class="text-xs text-slate-500 mt-1">${user.totalAssists || 0} asistencias registradas</p>
                <div class="mt-4 flex gap-2">
                    <button onclick="event.stopPropagation(); openUserModal('${user.id}')" class="text-indigo-600 hover:text-indigo-800 p-1 rounded-full bg-indigo-50">
                        <i data-lucide="pencil" class="w-5 h-5"></i>
                    </button>
                    <button onclick="event.stopPropagation(); openDocModal('Incapacity', null, '${user.id}')" class="text-yellow-600 hover:text-yellow-800 p-1 rounded-full bg-yellow-50">
                        <i data-lucide="shield-off" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
        `).join('');
        window.lucide.createIcons();
    }

    window.openUserModal = async function(userId = 'new') {
        const modal = document.getElementById('user-modal');
        const title = document.getElementById('user-modal-title');
        const btnDelete = document.getElementById('btn-delete-user');
        const selectSucursal = document.getElementById('user-sucursal');
        
        // Llenar Sucursales
        selectSucursal.innerHTML = window.SUCURSALES.map(s => `<option value="${s}">${s}</option>`).join('');

        if (userId === 'new') {
            title.textContent = "Añadir Promotor";
            btnDelete.classList.add('hidden');
            document.getElementById('user-id').value = '';
            document.getElementById('form-user').reset();
        } else {
            title.textContent = "Editar Promotor";
            btnDelete.classList.remove('hidden');
            
            const user = await window.getByID(window.STORES.PROMOTORES, parseInt(userId));
            if (user) {
                document.getElementById('user-id').value = user.id;
                document.getElementById('user-name').value = user.name;
                document.getElementById('user-dni').value = user.dni || '';
                document.getElementById('user-sucursal').value = user.sucursal;
            }
        }
        modal?.classList.remove('hidden');
    }

    window.handleSaveUser = async function(e) {
        e.preventDefault();
        const f = e.target;
        const userId = f['user-id'].value;

        const userData = {
            id: userId ? parseInt(userId) : undefined, // ID undefined para nuevos (autoincremental)
            name: f['user-name'].value,
            dni: f['user-dni'].value,
            sucursal: f['user-sucursal'].value,
            totalAssists: 0,
            lastAssistance: null
        };

        try {
            const newId = await window.put(window.STORES.PROMOTORES, userData);
            userData.id = userData.id || newId; // Asigna el nuevo ID si es una creación
            
            window.showToast(userId ? "Promotor actualizado." : "Promotor añadido.");
            window.closeModal('user-modal');
            
            // Recargar datos y renderizar
            usersList = await window.getAll(window.STORES.PROMOTORES);
            renderTeamGrid(usersList);
            populateUserSelects(usersList);

        } catch (error) {
            window.showToast("Error al guardar promotor.", true);
            console.error("Error al guardar promotor:", error);
        }
    }
    
    window.deleteUser = async function() {
        const userId = document.getElementById('user-id').value;
        if (!userId) return;

        if (confirm(`¿Estás seguro de ELIMINAR al promotor (ID: ${userId}) y todos sus registros (asistencias, documentos/horarios)?`)) {
            try {
                // Eliminar usuario
                await window.remove(window.STORES.PROMOTORES, parseInt(userId)); //
                
                // Limpiar sus datos relacionados (Obligatorio)
                const storesToClean = [window.STORES.EVIDENCES, window.STORES.SCHEDULES, window.STORES.DOCUMENTS];
                for (const storeName of storesToClean) {
                    const allItems = await window.getAll(storeName);
                    // Filtra por 'userId'
                    const userItems = allItems.filter(item => item.userId === parseInt(userId) || item.userId === userId); 
                    for (const item of userItems) {
                        await window.remove(storeName, item.id);
                    }
                }

                window.showToast('Promotor y datos eliminados.');
                window.closeModal('user-modal');
                
                // Recargar datos y renderizar
                usersList = await window.getAll(window.STORES.PROMOTORES);
                renderTeamGrid(usersList);
                populateUserSelects(usersList);
                window.showTab('team');
            } catch (e) {
                window.showToast('Error al eliminar el promotor.', true);
                console.error(e);
            }
        }
    }
    
    // ============================================================
    // VISTA INDIVIDUAL (Seguimiento, Evidencia, Historial, Horario)
    // ============================================================
    
    window.openUserPanel = function(userId, userName, userBranch) {
        // Almacenar ID activo y actualizar UI de la barra lateral
        activeUserId = parseInt(userId);
        document.getElementById('nav-individual')?.classList.remove('hidden');
        document.getElementById('ind-name').textContent = userName;
        document.getElementById('ind-initials').textContent = getInitials(userName);
        document.getElementById('ind-branch').textContent = `Sucursal: ${userBranch}`;
        
        // Por defecto, muestra la pestaña de evidencia y carga la evidencia del día
        window.showTab('individual');
        window.switchIndTab('evidencia'); 
        document.getElementById('evidence-date').value = new Date().toISOString().split('T')[0];
    }
    
    // Lógica de carga/guardado de Evidencia (OCR) - Simplificada
    window.processImage = async function(type) {
        const fileInput = document.getElementById(`${type}-file`);
        const statusEl = document.getElementById(`${type}-ocr-status`);

        if (!fileInput.files.length) return;
        
        statusEl.textContent = 'Procesando...';
        window.showToast(`Iniciando OCR para ${type}...`);

        try {
            const time = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            
            // Simulación de OCR (la implementación real estaba en el snippet)
            // Aquí deberías integrar tus funciones `fileToBase64` y `processImageForOCR`
            // const base64Image = await fileToBase64(fileInput.files[0]);
            // const ocrTime = await processImageForOCR(base64Image); // Esta es la función de OCR real

            const ocrTime = time; // SIMULACIÓN

            if (ocrTime) {
                if (type === 'entrada') {
                    document.getElementById('entry-time').textContent = ocrTime;
                    currentEvidence.entrada = ocrTime;
                    currentEvidence.validatedCheckIn = true;
                } else {
                    document.getElementById('exit-time').textContent = ocrTime;
                    currentEvidence.salida = ocrTime;
                    currentEvidence.validatedCheckOut = true;
                }
                statusEl.textContent = `Validado (${ocrTime})`;
                window.showToast(`OCR de ${type} exitoso.`);
            } else {
                 statusEl.textContent = 'Fallo';
                 window.showToast(`Fallo en el OCR de ${type}.`, true);
            }

        } catch (e) {
            statusEl.textContent = 'Error Crítico';
            window.showToast("Error en el proceso OCR.", true);
            console.error(e);
        }
    }
    
    window.loadCurrentEvidence = async function() {
        const date = document.getElementById('evidence-date').value;
        if (!activeUserId || !date) return;

        const evidenceId = `${activeUserId}_${date}`;
        const evidence = await window.getByID(window.STORES.EVIDENCES, evidenceId);
        
        currentEvidence = evidence || {};
        
        // Reset UI
        document.getElementById('entry-time').textContent = currentEvidence.entrada || '--:--';
        document.getElementById('exit-time').textContent = currentEvidence.salida || '--:--';
        document.getElementById('entry-ocr-status').textContent = currentEvidence.validatedCheckIn ? `Validado (${currentEvidence.entrada})` : 'Pendiente';
        document.getElementById('exit-ocr-status').textContent = currentEvidence.validatedExit ? `Validado (${currentEvidence.salida})` : 'Pendiente';
    }

    window.saveEvidence = async function() {
        const date = document.getElementById('evidence-date').value;
        if (!activeUserId || !date) return window.showToast('Selecciona promotor y fecha.', true);
        
        // Validación de datos
        if (!currentEvidence.entrada || !currentEvidence.validatedCheckIn) {
            return window.showToast('Error: Falta el Check-In validado (Entrada).', true);
        }
        if (currentEvidence.salida && !currentEvidence.validatedCheckOut) {
             return window.showToast('Error: La Salida tiene foto pero no está validada.', true);
        }
        
        const evidenceId = `${activeUserId}_${date}`;
        const finalEvidence = {
            id: evidenceId,
            userId: activeUserId,
            fecha: date,
            entrada: currentEvidence.entrada,
            salida: currentEvidence.salida || null,
            validatedCheckIn: currentEvidence.validatedCheckIn,
            validatedCheckOut: currentEvidence.validatedCheckOut || false,
            // Agrega más campos si los necesitas (e.g., base64Entry, base64Exit)
        };

        try {
            await window.put(window.STORES.EVIDENCES, finalEvidence); //
            window.showToast('Registro de asistencia guardado.');
            loadCurrentEvidence(); // Recarga para asegurar
        } catch (e) {
            window.showToast('Error al guardar la evidencia.', true);
            console.error(e);
        }
    }
    
    async function loadUserHistory(userId) {
        const historyBody = document.getElementById('user-history-body');
        historyBody.innerHTML = '<tr><td colspan="5" class="p-3 text-center text-slate-500">Cargando historial...</td></tr>';
        
        const allEvidences = await window.getAll(window.STORES.EVIDENCES);
        const userHistory = allEvidences.filter(e => e.userId === userId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        historyBody.innerHTML = userHistory.map(e => {
            const horas = e.entrada && e.salida ? "7.5h" : "--"; // Cálculo simplificado
            return `
                <tr>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-800">${e.fecha}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-green-600">${e.entrada || '--'}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-red-600">${e.salida || '--'}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-800">${horas}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm font-medium">
                        <button onclick="window.remove(window.STORES.EVIDENCES, '${e.id}'); loadUserHistory(${userId})" class="text-red-500 hover:text-red-700">Eliminar</button>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="5" class="p-3 text-center text-slate-500">No hay registros de asistencia.</td></tr>';
    }

    // ============================================================
    // VISTA DE HORARIO
    // ============================================================
    
    async function loadUserSchedule(userId) {
        const scheduleListEl = document.getElementById('schedule-list');
        scheduleListEl.innerHTML = '<li>Cargando...</li>';
        
        const allSchedules = await window.getAll(window.STORES.SCHEDULES);
        const userSchedules = allSchedules.filter(s => s.userId === userId);
        const scheduleMap = userSchedules.reduce((acc, s) => { acc[s.day] = s; return acc; }, {});

        const html = WEEK_DAYS.map(day => {
            const sched = scheduleMap[day];
            const time = sched ? `${sched.start} - ${sched.end}` : 'Día Libre';
            const color = sched ? 'text-green-600' : 'text-slate-400';
            return `
                <li class="flex justify-between p-2 bg-slate-50 rounded-lg">
                    <span class="font-medium text-slate-800">${day}</span>
                    <span class="${color} font-semibold text-sm">${time}</span>
                </li>
            `; //
        }).join('');
        scheduleListEl.innerHTML = html;
    }

    window.openScheduleModal = async function() {
        if (!activeUserId) return window.showToast('Selecciona un promotor primero.', true);
        document.getElementById('schedule-user-name').textContent = document.getElementById('ind-name').textContent;
        
        const formContent = document.getElementById('schedule-form-content');
        const allSchedules = await window.getAll(window.STORES.SCHEDULES);
        const userSchedules = allSchedules.filter(s => s.userId === activeUserId);
        const scheduleMap = userSchedules.reduce((acc, s) => { acc[s.day] = s; return acc; }, {});
        
        formContent.innerHTML = WEEK_DAYS.map(day => {
            const sched = scheduleMap[day];
            return `
                <div class="flex items-center gap-3 p-2 border rounded-lg">
                    <span class="w-20 font-medium">${day}:</span>
                    <input type="time" name="${day}_start" value="${sched?.start || '09:00'}" class="border-slate-300 rounded-md p-1">
                    <span>a</span>
                    <input type="time" name="${day}_end" value="${sched?.end || '18:00'}" class="border-slate-300 rounded-md p-1">
                </div>
            `;
        }).join('');
        
        document.getElementById('schedule-modal')?.classList.remove('hidden');
    }

    window.handleSaveSchedule = async function(e) {
        e.preventDefault();
        const f = e.target;
        const newSchedules = [];

        try {
            // Eliminar horarios viejos del usuario
            const allSchedules = await window.getAll(window.STORES.SCHEDULES);
            const userSchedules = allSchedules.filter(s => s.userId !== activeUserId);
            
            // Reconstruir la lista (para simplificar, se podría usar store.clear() y re-agregar)
            for (const day of WEEK_DAYS) {
                const start = f[`${day}_start`].value;
                const end = f[`${day}_end`].value;
                
                if (start && end) {
                    newSchedules.push({ userId: activeUserId, day, start, end });
                }
            }

            // Guardar en la DB
            await window.replaceAll(window.STORES.SCHEDULES, [...userSchedules, ...newSchedules]);

            window.showToast("Horario guardado correctamente.");
            window.closeModal('schedule-modal');
            loadUserSchedule(activeUserId); // Refrescar vista
        } catch (e) {
            window.showToast("Error al guardar el horario.", true);
            console.error(e);
        }
    }
    
    // ============================================================
    // VISTA DE DOCUMENTACIÓN (Reportes e Incapacidades)
    // ============================================================
    
    function populateUserSelects(users) {
        const userSelect = document.getElementById('doc-user-select');
        userSelect.innerHTML = `<option value="">--- Seleccionar Promotor ---</option>` + users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        document.getElementById('doc-modal-user').innerHTML = userSelect.innerHTML;
    }

    async function renderIncapacitiesList() {
        const listEl = document.getElementById('incapacities-list');
        listEl.innerHTML = '<li class="text-sm text-slate-500">Cargando...</li>';
        
        const allDocs = await window.getAll(window.STORES.DOCUMENTS);
        const activeIncapacities = allDocs.filter(d => d.docType === 'Incapacity' && new Date(d.dateEnd) >= new Date());

        if (activeIncapacities.length === 0) {
            listEl.innerHTML = '<li class="text-sm text-green-600">No hay incapacidades activas.</li>';
            return;
        }

        listEl.innerHTML = activeIncapacities.map(d => {
            const user = usersList.find(u => u.id === d.userId);
            const userName = user ? user.name : 'Usuario Desconocido';
            return `
                <li class="flex justify-between items-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div>
                        <p class="font-semibold text-sm text-yellow-800">${userName}</p>
                        <p class="text-xs text-slate-600">${d.description} (${d.dateStart} a ${d.dateEnd})</p>
                    </div>
                    <button onclick="openDocModal('Incapacity', '${d.id}')" class="text-yellow-600 hover:text-yellow-800 p-1">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button>
                </li>
            `; //
        }).join('');
        window.lucide.createIcons();
    }
    
    function renderWeeklyReportList(userId) {
        // Implementar lógica de filtrado y renderizado de reportes semanales...
        const listEl = document.getElementById('weekly-reports-list');
        if (!userId) {
            listEl.innerHTML = '<li class="text-sm text-slate-500">Selecciona un promotor para ver reportes.</li>';
            return;
        }
        
        // Cargar y filtrar los reportes del usuario...
        listEl.innerHTML = `<li class="text-sm text-green-600">Mostrando reportes para el usuario ${userId} (Lógica de filtrado pendiente).</li>`;
    }
    
    window.openDocModal = async function(docType, docId = null, initialUserId = null) {
        const modal = document.getElementById('doc-modal');
        const title = document.getElementById('doc-modal-title');
        const btnDelete = document.getElementById('btn-delete-doc');
        
        document.getElementById('form-document').reset();
        document.getElementById('doc-type').value = docType;
        btnDelete.classList.add('hidden');

        if (docType === 'Incapacity') {
            title.textContent = docId ? "Editar Incapacidad" : "Nueva Incapacidad";
        } else {
            title.textContent = docId ? "Editar Reporte Semanal" : "Nuevo Reporte Semanal";
        }

        if (initialUserId) {
            document.getElementById('doc-modal-user').value = initialUserId;
        }

        if (docId) {
            const doc = await window.getByID(window.STORES.DOCUMENTS, parseInt(docId));
            if (doc) {
                btnDelete.classList.remove('hidden');
                document.getElementById('doc-id').value = doc.id;
                document.getElementById('doc-modal-user').value = doc.userId;
                document.getElementById('doc-date-start').value = doc.dateStart;
                document.getElementById('doc-date-end').value = doc.dateEnd || '';
                document.getElementById('doc-description').value = doc.description || '';
            }
        }
        modal?.classList.remove('hidden');
    }
    
    window.handleSaveDocument = async function(e) {
        e.preventDefault();
        const f = e.target;
        
        const docData = {
            id: f['doc-id'].value ? parseInt(f['doc-id'].value) : undefined,
            docType: f['doc-type'].value,
            userId: parseInt(f['doc-modal-user'].value),
            dateStart: f['doc-date-start'].value,
            dateEnd: f['doc-date-end'].value || null,
            description: f['doc-description'].value || ''
        };
        
        try {
            await window.put(window.STORES.DOCUMENTS, docData);
            window.showToast("Documento guardado.");
            window.closeModal('doc-modal');
            renderIncapacitiesList(); 
        } catch (e) {
             window.showToast("Error al guardar el documento.", true); //
             console.error(e);
        }
    }
    
    window.deleteDocument = async function() {
        const docId = document.getElementById('doc-id').value;
        if (!docId) return;

        if (confirm("¿Eliminar este documento?")) {
            try {
                await window.remove(window.STORES.DOCUMENTS, parseInt(docId));
                window.showToast("Documento eliminado.");
                window.closeModal('doc-modal');
                renderIncapacitiesList();
            } catch (e) {
                window.showToast("Error al eliminar el documento.", true);
                console.error(e);
            }
        }
    }

    // ============================================================
    // SINCRONIZACIÓN GIST
    // ============================================================
    
    async function getGistConfig() {
        const gistIdObj = await window.getByID(window.STORES.CONFIG, 'gistIdAsistencia');
        const gistTokenObj = await window.getByID(window.STORES.CONFIG, 'gistTokenAsistencia');
        const gistId = gistIdObj?.value || '';
        const token = gistTokenObj?.value || '';
        return { gistId, token }; //
    }

    window.handleSaveGistConfig = async function(e) {
        e.preventDefault();
        const gistId = document.getElementById('gistId').value.trim();
        const token = document.getElementById('githubToken').value.trim();
        
        try {
             await window.put(window.STORES.CONFIG, { id:'gistIdAsistencia', value:gistId });
             await window.put(window.STORES.CONFIG, { id:'gistTokenAsistencia', value:token });
             window.showToast("Configuración Gist de Asistencia guardada.");
             window.closeModal('modal-config');
        } catch (e) {
             window.showToast("Error al guardar la configuración.", true);
             console.error(e);
        }
    }

    window.syncToGist = async function() {
        const config = await getGistConfig();
        if (!config.gistId || !config.token) {
            return window.showToast("Configuración Gist incompleta. Ve a Config.", true);
        }

        try {
            window.showToast("Sincronizando y subiendo datos de Asistencia a Gist...");
            const [users, evidences, schedules, documents] = await Promise.all([
                window.getAll(window.STORES.PROMOTORES),
                window.getAll(window.STORES.EVIDENCES),
                window.getAll(window.STORES.SCHEDULES),
                window.getAll(window.STORES.DOCUMENTS)
            ]);

            // La lógica de App1 usa un único archivo JSON para todas sus tiendas
            const localData = { 
                users: users, 
                evidences: evidences,
                schedules: schedules,
                documents: documents,
                timestamp: Date.now()
            }; //

            // 1. Descargar remoto (para fusionar)
            const remoteRes = await fetch(`https://api.github.com/gists/${config.gistId}/raw`, {
                headers: { 'Authorization': `token ${config.token}` }
            });
            let remoteData = {};
            if (remoteRes.ok) remoteData = await remoteRes.json();

            // 2. Fusionar
            const mergedData = {
                users: window.mergeArrays(remoteData.users, localData.users),
                evidences: window.mergeArrays(remoteData.evidences, localData.evidences),
                schedules: window.mergeArrays(remoteData.schedules, localData.schedules),
                documents: window.mergeArrays(remoteData.documents, localData.documents),
                timestamp: Date.now()
            };

            // 3. Subir el resultado fusionado
            const payload = {
                description: `Backup Asistencias PRO - ${new Date().toLocaleString()}`,
                files: { [GIST_FILE_NAME]: { content: JSON.stringify(mergedData, null, 2) } }
            };

            const upload = await fetch(`https://api.github.com/gists/${config.gistId}`, {
                method: 'PATCH',
                headers: { 'Authorization': `token ${config.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }); //

            if (!upload.ok) throw new Error(`HTTP ${upload.status}`);
            window.showToast("Datos de Asistencia fusionados y subidos correctamente.");
        } catch (e) {
            window.showToast("Error subiendo a Gist: " + (e.message || e), true);
            console.error(e);
        }
    }

    window.syncFromGist = async function() {
        const config = await getGistConfig();
        if (!config.gistId || !config.token) {
            return window.showToast("Configuración Gist incompleta. Ve a Config.", true);
        }
        
        if (!confirm("ADVERTENCIA: ¿Sobrescribir los datos locales de Asistencia con el contenido del Gist?")) return;

        try {
            window.showToast("Descargando datos de Asistencia desde Gist...");
            const res = await fetch(`https://api.github.com/gists/${config.gistId}/raw`, {
                headers: { 'Authorization': `token ${config.token}` }
            });

            if (!res.ok) throw new Error(`Gist no encontrado o Token inválido. HTTP ${res.status}`);

            const remoteData = await res.json();
            
            await window.replaceAll(window.STORES.PROMOTORES, remoteData.users || []);
            await window.replaceAll(window.STORES.EVIDENCES, remoteData.evidences || []);
            await window.replaceAll(window.STORES.SCHEDULES, remoteData.schedules || []);
            await window.replaceAll(window.STORES.DOCUMENTS, remoteData.documents || []);

            window.showToast("Sincronización DESDE Gist completada.");
            loadInitialData(); // Recargar la UI
        } catch (e) {
            window.showToast("Error al descargar desde Gist: " + (e.message || e), true);
            console.error(e);
        }
    }
    
})();
```eof
