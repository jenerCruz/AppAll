window.AppVentas = (function() {
    // --- Contenido original encapsulado ---
    /* ============================================================
   APP VENTAS - Lógica Encapsulada
   ============================================================ */
window.iniciarAppVentas = function() {
    console.log("Iniciando App Ventas...");

    // --- VARIABLES LOCALES (Ya no chocan con Asistencias) ---
    const SUCURSALES = [
        "Coppel 363", "Coppel 385", "Coppel 716",
        "Elektra 218", "Chedraui 23", "Chedraui 99", "Chedraui 105"
    ];
    const PRODUCTOS = [
        "Amigo Kit", "CGI Cero", "Chip Express", "Portabilidad", "B63"
    ];
    const MESES = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    let db; // Esta db es exclusiva de Ventas
    const DB_NAME = "VentasAppDB";
    const DB_VERSION = 1;
    const STORES = {
        PROMOTORES: "promotores",
        METAS: "metas",
        VENTAS: "ventas",
        CONFIG: "config"
    };
    let promotoresCache = [];
    let barChartInstance;
    let donutChartInstance;

    // --- INICIO MANUAL (Reemplaza window.onload) ---
    function init() {
        initDB();
        setTodayDate();
        setupTabListeners();
        setupFormListeners();
    }

    /* ============================================================
       INDEXEDDB
       ============================================================ */
    function initDB() {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => {
            updateDbStatus("Error de BD", true);
            console.error("IndexedDB error:", event.target.error);
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            updateDbStatus("BD Conectada", false);
            startApp();
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // PROMOTORES
            if (!db.objectStoreNames.contains(STORES.PROMOTORES)) {
                const store = db.createObjectStore(STORES.PROMOTORES, { keyPath: "id", autoIncrement: true });
                store.createIndex("sucursal", "sucursal", { unique: false });
            }
            // METAS
            if (!db.objectStoreNames.contains(STORES.METAS)) {
                const store = db.createObjectStore(STORES.METAS, { keyPath: "id", autoIncrement: true });
                store.createIndex("metaUnica", ["mes", "sucursal", "producto"], { unique: true });
            }
            // VENTAS
            if (!db.objectStoreNames.contains(STORES.VENTAS)) {
                const store = db.createObjectStore(STORES.VENTAS, { keyPath: "id", autoIncrement: true });
                store.createIndex("fecha", "fecha");
                store.createIndex("sucursal", "sucursal");
            }
            // CONFIG
            if (!db.objectStoreNames.contains(STORES.CONFIG)) {
                db.createObjectStore(STORES.CONFIG, { keyPath: "id" });
            }
        };
    }

    function updateDbStatus(msg, isError) {
        const el = document.getElementById("db-status");
        if(el) {
            el.textContent = msg;
            el.classList.toggle("text-green-400", !isError);
            el.classList.toggle("text-red-400", isError);
        }
    }

    function startApp() {
        populateAllSelects();
        loadPromotores();
        loadMetas();
        loadDashboardData();
    }

    function setTodayDate() {
        const el = document.getElementById("venta-fecha");
        if(el) {
            const today = new Date().toISOString().split("T")[0];
            el.value = today;
        }
    }

    /* ============================================================
       PESTAÑAS
       ============================================================ */
    function setupTabListeners() {
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.id.replace("tab-btn-", "");
                showTab(id);
            });
        });
    }

    function showTab(tabId) {
        document.querySelectorAll(".tab-content").forEach(sec => sec.classList.add("hidden"));
        document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));

        const tab = document.getElementById(tabId);
        const btn = document.getElementById("tab-btn-" + tabId);
        
        if(tab) tab.classList.remove("hidden");
        if(btn) btn.classList.add("active");
        if (tabId === "dashboard") loadDashboardData();
    }

    /* ============================================================
       FORMULARIOS
       ============================================================ */
    function setupFormListeners() {
        const fMetas = document.getElementById("form-metas");
        const fPromos = document.getElementById("form-promotores");
        const fVentas = document.getElementById("form-ventas");

        if(fMetas) fMetas.addEventListener("submit", handleAddMeta);
        if(fPromos) fPromos.addEventListener("submit", handleAddPromotor);
        if(fVentas) fVentas.addEventListener("submit", handleAddVenta);
    }

    /* ============================================================
       SELECTS
       ============================================================ */
    function populateAllSelects() {
        // MESES
        const selMes = document.getElementById("meta-mes");
        if(selMes) {
            selMes.innerHTML = "";
            MESES.forEach((mes, i) => selMes.add(new Option(mes, i + 1)));
            selMes.value = new Date().getMonth() + 1;
        }
        
        // SUCURSALES
        const sucursales = [
            document.getElementById("meta-sucursal"),
            document.getElementById("venta-sucursal")
        ];
        sucursales.forEach(sel => {
            if(sel) {
                sel.innerHTML = "";
                sel.add(new Option("Seleccione sucursal...", ""));
                SUCURSALES.forEach(s => sel.add(new Option(s, s)));
            }
        });

        // PRODUCTOS
        const productos = [
            document.getElementById("meta-producto"),
            document.getElementById("venta-producto")
        ];
        productos.forEach(sel => {
            if(sel) {
                sel.innerHTML = "";
                sel.add(new Option("Seleccione producto...", ""));
                PRODUCTOS.forEach(p => sel.add(new Option(p, p)));
            }
        });

        // FILTRO DINÁMICO
        const ventaSuc = document.getElementById("venta-sucursal");
        if(ventaSuc) {
            ventaSuc.addEventListener("change", e => {
                populatePromotoresForSucursal(e.target.value);
            });
        }
    }

    /* ============================================================
       LÓGICA DE NEGOCIO (Promotores, Metas, Ventas)
       ============================================================ */
    function handleAddPromotor(e) {
        e.preventDefault();
        const nombre = document.getElementById("promotor-nombre").value.trim();
        const sucursal = document.getElementById("venta-sucursal").value;

        if (!nombre) return showToast("Ingrese nombre", true);

        const store = db.transaction(STORES.PROMOTORES, "readwrite").objectStore(STORES.PROMOTORES);
        store.add({ nombre, sucursal });
        showToast("Promotor agregado");
        document.getElementById("promotor-nombre").value = "";
        loadPromotores();
    }

    async function loadPromotores() {
        const promos = promotoresCache = await getAllFromDB(STORES.PROMOTORES);
        const lista = document.getElementById("lista-promotores");
        const select = document.getElementById("venta-promotor");

        if(!lista || !select) return;

        lista.innerHTML = "";
        select.innerHTML = '<option value="">Seleccione promotor...</option>';
        if (promos.length === 0) {
            lista.innerHTML = "<p class='text-slate-500'>No hay promotores</p>";
            return;
        }

        promos.forEach(p => {
            const el = document.createElement("div");
            el.className = "bg-white p-2 rounded-lg border flex justify-between";
            
            // Nota: Modificamos el onclick para no usar funciones globales en el string HTML
            // Usamos un listener o pasamos el ID de otra forma, pero para mantener estructura:
            // Asignaremos la función global temporalmente o usamos addEventListener en el elemento creado.
            // Para simplificar migración, definiremos deleteItemVentas en window temporalmente solo para onclicks.
            
            el.innerHTML = `
                <span>${p.nombre} <small class="text-slate-500">(${p.sucursal})</small></span>
                <button class="text-red-600 btn-delete-promo" data-id="${p.id}">Eliminar</button>
            `;
            lista.appendChild(el);
            select.add(new Option(`${p.nombre} – ${p.sucursal}`, p.id));
        });

        // Listeners para botones eliminar dinámicos
        document.querySelectorAll('.btn-delete-promo').forEach(b => {
            b.onclick = () => deleteItem(STORES.PROMOTORES, parseInt(b.dataset.id), loadPromotores);
        });
    }

    function populatePromotoresForSucursal(sucursal) {
        const select = document.getElementById("venta-promotor");
        if(!select) return;
        select.innerHTML = '<option value="">Seleccione promotor...</option>';
        promotoresCache
            .filter(p => p.sucursal === sucursal)
            .forEach(p => select.add(new Option(p.nombre, p.id)));
    }

    function handleAddMeta(e) {
        e.preventDefault();
        const f = e.target;
        const obj = {
            mes: parseInt(f.mes.value),
            sucursal: f.sucursal.value,
            producto: f.producto.value,
            meta: parseInt(f.meta.value)
        };
        if (!obj.mes || !obj.sucursal || !obj.producto || obj.meta <= 0)
            return showToast("Complete campos", true);

        const store = db.transaction(STORES.METAS, "readwrite").objectStore(STORES.METAS);
        const req = store.add(obj);

        req.onsuccess = () => {
            showToast("Meta guardada");
            f.reset();
            f.mes.value = new Date().getMonth() + 1;
            loadMetas();
            loadDashboardData();
        };
        req.onerror = e => {
            if (e.target.error.name === "ConstraintError")
                showToast("Meta duplicada", true);
            else
                showToast("Error guardando meta", true);
        };
    }

    async function loadMetas() {
        const metas = await getAllFromDB(STORES.METAS);
        const tbody = document.getElementById("lista-metas");
        if(!tbody) return;
        tbody.innerHTML = "";
        if (metas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No hay metas</td></tr>`;
            return;
        }

        metas.forEach(m => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${MESES[m.mes - 1]}</td>
                <td>${m.sucursal}</td>
                <td>${m.producto}</td>
                <td>${m.meta}</td>
                <td>
                    <button class="text-red-600 btn-delete-meta" data-id="${m.id}">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        document.querySelectorAll('.btn-delete-meta').forEach(b => {
            b.onclick = () => deleteItem(STORES.METAS, parseInt(b.dataset.id), loadMetas);
        });
    }

    function handleAddVenta(e) {
        e.preventDefault();
        const f = e.target;
        const obj = {
            fecha: f.fecha.value,
            sucursal: f.sucursal.value,
            producto: f.producto.value,
            promotorId: parseInt(f.promotor.value),
            cantidad: parseInt(f.cantidad.value)
        };
        if (!obj.fecha || !obj.sucursal || !obj.producto || !obj.promotorId || obj.cantidad <= 0)
            return showToast("Complete todos los campos", true);

        const store = db.transaction(STORES.VENTAS, "readwrite").objectStore(STORES.VENTAS);
        store.add(obj);

        showToast("Venta registrada");
        f.producto.value = "";
        f.promotor.value = "";
        f.cantidad.value = "";

        loadVentas();
        loadDashboardData();
    }

    async function loadVentas() {
        const ventas = await getAllFromDB(STORES.VENTAS);
        const tbody = document.getElementById("lista-ventas");
        if(!tbody) return;
        tbody.innerHTML = "";
        if (ventas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No hay ventas</td></tr>`;
            return;
        }

        ventas.sort((a, b) => b.fecha.localeCompare(a.fecha));
        const map = new Map(promotoresCache.map(p => [p.id, p.nombre]));
        ventas.forEach(v => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${v.fecha}</td>
                <td>${v.sucursal}</td>
                <td>${v.producto}</td>
                <td>${v.cantidad}</td>
                <td>${map.get(v.promotorId) || "?"}</td>
                <td>
                     <button class="text-red-600 btn-delete-venta" data-id="${v.id}">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        document.querySelectorAll('.btn-delete-venta').forEach(b => {
            b.onclick = () => deleteItem(STORES.VENTAS, parseInt(b.dataset.id), loadVentas);
        });
    }

    /* ============================================================
       DASHBOARD
       ============================================================ */
    async function loadDashboardData() {
        if(!document.getElementById("barChart")) return; // Si no estamos en dashboard

        const metas = await getAllFromDB(STORES.METAS);
        const ventas = await getAllFromDB(STORES.VENTAS);
        const mesActual = new Date().getMonth() + 1;
        const año = new Date().getFullYear();

        const metasMes = metas.filter(m => m.mes === mesActual);
        const ventasMes = ventas.filter(v => {
            const d = new Date(v.fecha);
            return d.getMonth() + 1 === mesActual && d.getFullYear() === año;
        });
        const dataProd = {};
        PRODUCTOS.forEach(p => dataProd[p] = { meta: 0, venta: 0 });

        metasMes.forEach(m => dataProd[m.producto].meta += m.meta);
        ventasMes.forEach(v => dataProd[v.producto].venta += v.cantidad);

        renderBarChart(dataProd);

        const totalMeta = metasMes.reduce((s, m) => s + m.meta, 0);
        const totalVenta = ventasMes.reduce((s, v) => s + v.cantidad, 0);

        renderDonutChart(totalVenta, totalMeta);
        renderSucursalCards(agruparPorSucursal(metasMes, ventasMes));
    }

    function agruparPorSucursal(metas, ventas) {
        const out = {};
        SUCURSALES.forEach(s => out[s] = { meta: 0, venta: 0 });
        metas.forEach(m => out[m.sucursal].meta += m.meta);
        ventas.forEach(v => out[v.sucursal].venta += v.cantidad);
        return out;
    }

    function renderBarChart(data) {
        const ctx = document.getElementById("barChart").getContext("2d");
        if (barChartInstance) barChartInstance.destroy();
        barChartInstance = new Chart(ctx, {
            type: "bar",
            data: {
                labels: Object.keys(data),
                datasets: [
                    {
                        label: "Meta",
                        data: Object.values(data).map(d => d.meta),
                        backgroundColor: "rgba(203, 213, 225, 1)"
                    },
                    {
                        label: "Venta",
                        data: Object.values(data).map(d => d.venta),
                        backgroundColor: "rgba(37, 99, 235, 1)"
                    }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function renderDonutChart(venta, meta) {
        const ctx = document.getElementById("donutChart").getContext("2d");
        const pct = meta === 0 ? 0 : Math.round(venta / meta * 100);

        if (donutChartInstance) donutChartInstance.destroy();
        donutChartInstance = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ["Venta", "Restante"],
                datasets: [{
                    data: [venta, Math.max(0, meta - venta)],
                    backgroundColor: ["#2563eb", "#e2e8f0"]
                }]
            },
            options: { cutout: "70%" }
        });
        document.getElementById("donut-percentage").textContent = pct + "%";
    }

    function renderSucursalCards(data) {
        const c = document.getElementById("sucursal-cards-container");
        c.innerHTML = "";
        for (const suc in data) {
            const d = data[suc];
            const pct = d.meta === 0 ? 0 : Math.round(d.venta / d.meta * 100);
            const col = pct >= 100 ? "bg-green-500" : "bg-blue-500";
            c.innerHTML += `
                <div class="bg-white p-4 rounded-lg border shadow">
                    <h4 class="font-semibold">${suc}</h4>
                    <p class="text-xs">${d.venta} / ${d.meta} piezas</p>
                    <div class="w-full bg-slate-200 h-2 rounded">
                        <div class="${col} h-2 rounded" style="width:${Math.min(pct, 100)}%"></div>
                    </div>
                    <p class="text-right font-medium mt-1">${pct}%</p>
                </div>
            `;
        }
    }

    /* ============================================================
       UTILIDADES
       ============================================================ */
    function getAllFromDB(store) {
        return new Promise((resolve, reject) => {
            const req = db.transaction(store, "readonly").objectStore(store).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = err => reject(err);
        });
    }

    function deleteItem(store, id, cb) {
        if (!confirm("¿Eliminar registro?")) return;
        const req = db.transaction(store, "readwrite").objectStore(store).delete(id);
        req.onsuccess = () => {
            showToast("Eliminado");
            if (cb) cb();
            loadDashboardData();
        };
    }

    function showToast(msg, err = false) {
        const t = document.getElementById("toast");
        const m = document.getElementById("toast-message");
        if(!t || !m) return;

        m.textContent = msg;
        t.classList.toggle("bg-red-600", err);
        t.classList.toggle("bg-gray-800", !err);
        t.classList.add("opacity-100", "translate-y-0");
        t.classList.remove("opacity-0", "translate-y-10");
        setTimeout(() => {
            t.classList.remove("opacity-100", "translate-y-0");
            t.classList.add("opacity-0", "translate-y-10");
        }, 2000);
    }

    // --- INVOCAR INICIO ---
    init();
};

    // --- Fin del contenido original ---
    return {
        // Funciones públicas aquí (puedes agregarlas según lo que necesites exponer)
    };
})();