import { useEffect, useMemo, useState } from "react";
import departamentos from "../constantes/departamentos.json";
import municipiosPorDepartamento from "../constantes/municipios.json";
import ClientsView from "./ClientsView";
import VistaActivosFijos from "./VistaActivosFijos";
import VistaAuditoria from "./VistaAuditoria";
import VistaCaja from "./VistaCaja";
import VistaEmpleados from "./VistaEmpleados";
import VistaEntregas from "./VistaEntregas";
import VistaLogin from "./VistaLogin";
import InventoryMovementsView from "./InventoryMovementsView";
import InventoryView from "./InventoryView";
import OrdersView from "./OrdersView";
import VistaPlanillas from "./VistaPlanillas";
import VistaPagos from "./VistaPagos";
import TraceabilityView from "./TraceabilityView";
import TransfersView from "./TransfersView";
import VistaUsuarios from "./VistaUsuarios";

const fallbackSummary = {
  sucursalesActivas: 0,
  medicamentosActivos: 0,
  inventarioDisponible: 0,
  entregasPendientes: 0,
  cajaNeta: 0
};

const emptySucursalForm = {
  nombre: "",
  tipo: "FARMACIA",
  direccion: "",
  departamento: "",
  municipio: "",
  telefono: "",
  centro_comercial_id: "",
  gasolinera_id: ""
};

const emptyMedicamentoForm = {
  nombre: "",
  presentacion: "",
  unidad: "UNIDAD",
  requiere_receta: false
};

const modules = [
  { view: "sucursales", label: "Sucursales", status: "Vista completa", detail: "Farmacias y stands" },
  { view: "medicamentos", label: "Medicamentos", status: "Vista completa", detail: "Catalogo maestro" },
  { view: "proveedores-lotes", label: "Proveedores y lotes", status: "Vista completa", detail: "Trazabilidad" },
  { view: "inventario", label: "Inventario", status: "Vista completa", detail: "Stock por lote" },
  { view: "movimientos-inventario", label: "Movimientos", status: "Vista completa", detail: "Auditoria de inventario" },
  { view: "transferencias", label: "Transferencias", status: "Vista completa", detail: "Traslados entre sucursales" },
  { view: "clientes", label: "Clientes", status: "Vista completa", detail: "Contacto y entregas" },
  { view: "pedidos", label: "Pedidos", status: "Vista completa", detail: "Ventas y call center" },
  { view: "pagos", label: "Pagos", status: "Vista completa", detail: "Cobros por pedido" },
  { view: "entregas", label: "Entregas", status: "Vista completa", detail: "Seguimiento de pedidos" },
  { view: "caja", label: "Caja", status: "Vista completa", detail: "Ingresos y egresos" },
  { view: "empleados", label: "Empleados", status: "Vista completa", detail: "Personal por sucursal" },
  { view: "planillas", label: "Planilla", status: "Vista completa", detail: "Periodos y pagos" },
  { view: "activos-fijos", label: "Activos fijos", status: "Vista completa", detail: "Activos por sucursal" },
  { view: "usuarios", label: "Usuarios", status: "Vista completa", detail: "Roles y permisos" },
  { view: "auditoria", label: "Auditoria", status: "Vista completa", detail: "Acciones criticas" }
];

const navegacionPrincipal = [
  { view: "dashboard", label: "Dashboard" },
  ...modules.map((modulo) => ({ view: modulo.view, label: modulo.label }))
];

const vistasPorRol = {
  ADMINISTRADOR: navegacionPrincipal.map((item) => item.view),
  AUDITOR: ["dashboard", "inventario", "movimientos-inventario", "caja", "activos-fijos", "auditoria"],
  CAJERO: ["dashboard", "clientes", "pedidos", "pagos", "entregas", "caja", "inventario"],
  CALL_CENTER: ["dashboard", "clientes", "pedidos", "entregas", "inventario"],
  INVENTARIO: ["dashboard", "medicamentos", "proveedores-lotes", "inventario", "movimientos-inventario", "transferencias"]
};

const claveSesion = "farmacias-alejandro-sesion";

const tasks = [
  "Registrar acciones criticas en auditoria",
  "Registrar movimientos de caja automaticos",
  "Registrar movimientos de inventario automaticos"
];

const sucursalTypes = [
  { value: "FARMACIA", label: "Farmacia" },
  { value: "STAND", label: "Stand" },
  { value: "GASOLINERA", label: "Gasolinera" }
];

const medicamentoUnits = [
  "UNIDAD",
  "CAJA",
  "BLISTER",
  "FRASCO",
  "TUBO",
  "SOBRE",
  "AMPOLLA"
];

function getHashView() {
  const hash = window.location.hash.replace("#", "");

  return [
    "sucursales",
    "medicamentos",
    "proveedores-lotes",
    "inventario",
    "movimientos-inventario",
    "transferencias",
    "clientes",
    "pedidos",
    "pagos",
    "entregas",
    "caja",
    "empleados",
    "planillas",
    "activos-fijos",
    "usuarios",
    "auditoria"
  ].includes(hash)
    ? hash
    : "dashboard";
}

function leerSesionGuardada() {
  try {
    return JSON.parse(localStorage.getItem(claveSesion)) || null;
  } catch (error) {
    localStorage.removeItem(claveSesion);
    return null;
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatSucursalId(id) {
  return `SUC-${String(id || 0).padStart(3, "0")}`;
}

function formatMedicamentoId(id) {
  return `MED-${String(id || 0).padStart(3, "0")}`;
}

function toNullableNumber(value) {
  return value ? Number(value) : null;
}

function statusBadgeClass(state) {
  return state === "ACTIVA" ? "text-bg-success" : "text-bg-secondary";
}

function activeStatusBadgeClass(state) {
  return state === "ACTIVO" ? "text-bg-success" : "text-bg-secondary";
}

function App() {
  const [usuarioActual, setUsuarioActual] = useState(leerSesionGuardada);
  const [activeView, setActiveView] = useState(getHashView);
  const [routeResetKey, setRouteResetKey] = useState(0);
  const [sucursalView, setSucursalView] = useState("list");
  const [medicamentoView, setMedicamentoView] = useState("list");
  const [summary, setSummary] = useState(fallbackSummary);
  const [apiState, setApiState] = useState("Cargando API");
  const [apiDetail, setApiDetail] = useState("Conectando con /api/health");
  const [apiOk, setApiOk] = useState(false);
  const [sucursales, setSucursales] = useState([]);
  const [sucursalesLoading, setSucursalesLoading] = useState(true);
  const [sucursalesError, setSucursalesError] = useState("");
  const [selectedSucursalId, setSelectedSucursalId] = useState(null);
  const [editingSucursalId, setEditingSucursalId] = useState(null);
  const [sucursalForm, setSucursalForm] = useState(emptySucursalForm);
  const [formError, setFormError] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [formMessage, setFormMessage] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [sucursalActionError, setSucursalActionError] = useState("");
  const [sucursalActionSaving, setSucursalActionSaving] = useState("");
  const [medicamentos, setMedicamentos] = useState([]);
  const [medicamentosLoading, setMedicamentosLoading] = useState(true);
  const [medicamentosError, setMedicamentosError] = useState("");
  const [selectedMedicamentoId, setSelectedMedicamentoId] = useState(null);
  const [editingMedicamentoId, setEditingMedicamentoId] = useState(null);
  const [medicamentoForm, setMedicamentoForm] = useState(emptyMedicamentoForm);
  const [medicamentoFormError, setMedicamentoFormError] = useState("");
  const [medicamentoFormErrors, setMedicamentoFormErrors] = useState([]);
  const [medicamentoFormSaving, setMedicamentoFormSaving] = useState(false);
  const [medicamentoActionError, setMedicamentoActionError] = useState("");
  const [medicamentoActionSaving, setMedicamentoActionSaving] = useState("");

  const municipiosDisponibles = municipiosPorDepartamento[sucursalForm.departamento] || [];

  const vistasPermitidas = useMemo(() => {
    const permitidas = new Set(["dashboard"]);

    (usuarioActual?.roles || []).forEach((rol) => {
      (vistasPorRol[rol.nombre_rol] || []).forEach((vista) => permitidas.add(vista));
    });

    return permitidas;
  }, [usuarioActual]);

  const vistaActual = vistasPermitidas.has(activeView) ? activeView : "dashboard";

  function puedeVerVista(vista) {
    return vistasPermitidas.has(vista);
  }

  async function loadSucursales() {
    setSucursalesLoading(true);
    setSucursalesError("");

    try {
      const response = await fetch("/api/sucursales");
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "No fue posible leer sucursales.");
      }

      setSucursales(result.data || []);
    } catch (error) {
      setSucursales([]);
      setSelectedSucursalId(null);
      setSucursalesError(error.message || "No fue posible leer sucursales.");
    } finally {
      setSucursalesLoading(false);
    }
  }

  async function loadMedicamentos() {
    setMedicamentosLoading(true);
    setMedicamentosError("");

    try {
      const response = await fetch("/api/medicamentos");
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "No fue posible leer medicamentos.");
      }

      setMedicamentos(result.data || []);
    } catch (error) {
      setMedicamentos([]);
      setSelectedMedicamentoId(null);
      setMedicamentosError(error.message || "No fue posible leer medicamentos.");
    } finally {
      setMedicamentosLoading(false);
    }
  }

  useEffect(() => {
    if (!usuarioActual) return undefined;

    let isMounted = true;

    async function loadDashboard() {
      try {
        const [healthResponse, summaryResponse] = await Promise.all([
          fetch("/api/health"),
          fetch("/api/dashboard")
        ]);

        const health = await healthResponse.json();
        const dashboard = await summaryResponse.json();

        if (!isMounted) return;

        setApiOk(Boolean(health.ok));
        setApiState(health.ok ? "API conectada" : "API con advertencias");
        setApiDetail(health.database || health.message || "Worker activo");
        setSummary({ ...fallbackSummary, ...dashboard.data });
      } catch (error) {
        if (!isMounted) return;
        setApiOk(false);
        setApiState("Modo sin conexion");
        setApiDetail("El frontend funciona; inicia wrangler dev para la API.");
      }
    }

    loadDashboard();
    loadSucursales();
    loadMedicamentos();

    return () => {
      isMounted = false;
    };
  }, [usuarioActual]);

  useEffect(() => {
    function handleHashChange() {
      const nextView = getHashView();
      const permittedView = puedeVerVista(nextView) ? nextView : "dashboard";
      setActiveView(permittedView);

      if (permittedView === "sucursales") {
        setSucursalView("list");
      }

      if (permittedView === "medicamentos") {
        setMedicamentoView("list");
      }
    }

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [vistasPermitidas]);

  const metrics = useMemo(
    () => [
      {
        label: "Sucursales activas",
        value: summary.sucursalesActivas,
        note: "Puntos operativos"
      },
      {
        label: "Medicamentos activos",
        value: summary.medicamentosActivos,
        note: "Catalogo disponible"
      },
      {
        label: "Unidades disponibles",
        value: summary.inventarioDisponible,
        note: "Stock no reservado"
      },
      {
        label: "Entregas pendientes",
        value: summary.entregasPendientes,
        note: "Por coordinar"
      },
      {
        label: "Caja neta",
        value: formatCurrency(summary.cajaNeta),
        note: "Ingresos menos egresos"
      }
    ],
    [summary]
  );

  const sucursalStats = useMemo(
    () => ({
      total: sucursales.length,
      activas: sucursales.filter((sucursal) => sucursal.estado === "ACTIVA").length,
      farmacias: sucursales.filter((sucursal) => sucursal.tipo === "FARMACIA").length,
      stands: sucursales.filter((sucursal) => sucursal.tipo !== "FARMACIA").length
    }),
    [sucursales]
  );

  const selectedSucursal = useMemo(
    () => sucursales.find((sucursal) => sucursal.id_sucursal === selectedSucursalId) || null,
    [selectedSucursalId, sucursales]
  );

  const selectedMedicamento = useMemo(
    () =>
      medicamentos.find((medicamento) => medicamento.id_medicamento === selectedMedicamentoId) ||
      null,
    [selectedMedicamentoId, medicamentos]
  );

  function navigateTo(view) {
    if (!puedeVerVista(view)) return;

    setActiveView(view);
    window.location.hash = view === "dashboard" ? "dashboard" : view;
    setRouteResetKey((currentKey) => currentKey + 1);

    if (view === "sucursales") {
      setSucursalView("list");
      setSelectedSucursalId(null);
      resetSucursalForm();
    }

    if (view === "medicamentos") {
      setMedicamentoView("list");
      setSelectedMedicamentoId(null);
      resetMedicamentoForm();
    }
  }

  function iniciarSesion(usuario) {
    localStorage.setItem(claveSesion, JSON.stringify(usuario));
    setUsuarioActual(usuario);
    setActiveView("dashboard");
    window.location.hash = "dashboard";
  }

  function cerrarSesion() {
    localStorage.removeItem(claveSesion);
    setUsuarioActual(null);
    setActiveView("dashboard");
    window.location.hash = "dashboard";
  }

  function updateSucursalForm(field, value) {
    setSucursalForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
    setFormMessage("");
  }

  function updateDepartamento(value) {
    setSucursalForm((currentForm) => ({
      ...currentForm,
      departamento: value,
      municipio: ""
    }));
    setFormMessage("");
  }

  function resetSucursalForm() {
    setEditingSucursalId(null);
    setSucursalForm(emptySucursalForm);
    setFormError("");
    setFormErrors([]);
    setFormMessage("");
  }

  function showSucursalList() {
    setSucursalView("list");
    setSelectedSucursalId(null);
    setSucursalActionError("");
    resetSucursalForm();
  }

  function showNewSucursalForm() {
    setSelectedSucursalId(null);
    setSucursalActionError("");
    resetSucursalForm();
    setSucursalView("form");
  }

  function showSucursalDetail(sucursal) {
    setSelectedSucursalId(sucursal.id_sucursal);
    setSucursalActionError("");
    resetSucursalForm();
    setSucursalView("detail");
  }

  function cancelSucursalForm() {
    const nextView = editingSucursalId && selectedSucursal ? "detail" : "list";
    resetSucursalForm();
    setSucursalView(nextView);
  }

  function editSucursal(sucursal) {
    setEditingSucursalId(sucursal.id_sucursal);
    setSelectedSucursalId(sucursal.id_sucursal);
    setSucursalView("form");
    setSucursalActionError("");
    setFormError("");
    setFormErrors([]);
    setFormMessage("");
    setSucursalForm({
      nombre: sucursal.nombre || "",
      tipo: sucursal.tipo || "FARMACIA",
      direccion: sucursal.direccion || "",
      departamento: sucursal.departamento || "",
      municipio: sucursal.municipio || "",
      telefono: sucursal.telefono || "",
      centro_comercial_id: sucursal.centro_comercial_id || "",
      gasolinera_id: sucursal.gasolinera_id || ""
    });
  }

  async function submitSucursal(event) {
    event.preventDefault();
    setFormSaving(true);
    setFormError("");
    setFormErrors([]);
    setFormMessage("");

    const payload = {
      ...sucursalForm,
      centro_comercial_id: toNullableNumber(sucursalForm.centro_comercial_id),
      gasolinera_id: toNullableNumber(sucursalForm.gasolinera_id)
    };

    const url = editingSucursalId ? `/api/sucursales/${editingSucursalId}` : "/api/sucursales";
    const method = editingSucursalId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setFormError(result.message || "No fue posible guardar la sucursal.");
        setFormErrors(result.errors || []);
        return;
      }

      await loadSucursales();
      setSelectedSucursalId(null);
      setSucursalView("list");
      setEditingSucursalId(null);
      setSucursalForm(emptySucursalForm);
      setFormMessage("");
    } catch (error) {
      setFormError(error.message || "No fue posible guardar la sucursal.");
    } finally {
      setFormSaving(false);
    }
  }

  async function deleteSucursal() {
    if (!selectedSucursal) return;

    const confirmed = window.confirm(`Eliminar ${selectedSucursal.nombre}? Esta accion no se puede deshacer.`);

    if (!confirmed) return;

    setSucursalActionSaving("delete");
    setSucursalActionError("");

    try {
      const response = await fetch(`/api/sucursales/${selectedSucursal.id_sucursal}`, {
        method: "DELETE"
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setSucursalActionError(result.message || "No fue posible eliminar la sucursal.");
        return;
      }

      await loadSucursales();
      showSucursalList();
    } catch (error) {
      setSucursalActionError(error.message || "No fue posible eliminar la sucursal.");
    } finally {
      setSucursalActionSaving("");
    }
  }

  function updateMedicamentoForm(field, value) {
    setMedicamentoForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function resetMedicamentoForm() {
    setEditingMedicamentoId(null);
    setMedicamentoForm(emptyMedicamentoForm);
    setMedicamentoFormError("");
    setMedicamentoFormErrors([]);
  }

  function showMedicamentoList() {
    setMedicamentoView("list");
    setSelectedMedicamentoId(null);
    setMedicamentoActionError("");
    resetMedicamentoForm();
  }

  function showNewMedicamentoForm() {
    setSelectedMedicamentoId(null);
    setMedicamentoActionError("");
    resetMedicamentoForm();
    setMedicamentoView("form");
  }

  function showMedicamentoDetail(medicamento) {
    setSelectedMedicamentoId(medicamento.id_medicamento);
    setMedicamentoActionError("");
    resetMedicamentoForm();
    setMedicamentoView("detail");
  }

  function cancelMedicamentoForm() {
    const nextView = editingMedicamentoId && selectedMedicamento ? "detail" : "list";
    resetMedicamentoForm();
    setMedicamentoView(nextView);
  }

  function editMedicamento(medicamento) {
    setEditingMedicamentoId(medicamento.id_medicamento);
    setSelectedMedicamentoId(medicamento.id_medicamento);
    setMedicamentoView("form");
    setMedicamentoActionError("");
    setMedicamentoFormError("");
    setMedicamentoFormErrors([]);
    setMedicamentoForm({
      nombre: medicamento.nombre || "",
      presentacion: medicamento.presentacion || "",
      unidad: medicamento.unidad || "UNIDAD",
      requiere_receta: Number(medicamento.requiere_receta) === 1
    });
  }

  async function submitMedicamento(event) {
    event.preventDefault();
    setMedicamentoFormSaving(true);
    setMedicamentoFormError("");
    setMedicamentoFormErrors([]);

    const url = editingMedicamentoId
      ? `/api/medicamentos/${editingMedicamentoId}`
      : "/api/medicamentos";
    const method = editingMedicamentoId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(medicamentoForm)
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setMedicamentoFormError(result.message || "No fue posible guardar el medicamento.");
        setMedicamentoFormErrors(result.errors || []);
        return;
      }

      await loadMedicamentos();
      setSelectedMedicamentoId(null);
      setMedicamentoView("list");
      setEditingMedicamentoId(null);
      setMedicamentoForm(emptyMedicamentoForm);
    } catch (error) {
      setMedicamentoFormError(error.message || "No fue posible guardar el medicamento.");
    } finally {
      setMedicamentoFormSaving(false);
    }
  }

  async function deleteMedicamento() {
    if (!selectedMedicamento) return;

    const confirmed = window.confirm(
      `Eliminar ${selectedMedicamento.nombre}? Esta accion no se puede deshacer.`
    );

    if (!confirmed) return;

    setMedicamentoActionSaving("delete");
    setMedicamentoActionError("");

    try {
      const response = await fetch(`/api/medicamentos/${selectedMedicamento.id_medicamento}`, {
        method: "DELETE"
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setMedicamentoActionError(result.message || "No fue posible eliminar el medicamento.");
        return;
      }

      await loadMedicamentos();
      showMedicamentoList();
    } catch (error) {
      setMedicamentoActionError(error.message || "No fue posible eliminar el medicamento.");
    } finally {
      setMedicamentoActionSaving("");
    }
  }

  if (!usuarioActual) {
    return <VistaLogin alIniciarSesion={iniciarSesion} />;
  }

  return (
    <main className="container-fluid bg-body-tertiary">
      <div className="row app-shell">
        <aside
          className="col-12 col-lg-3 col-xl-2 app-sidebar text-bg-success p-4"
          aria-label="Navegacion principal"
        >
          <div className="mb-4">
            <p className="small text-uppercase fw-semibold text-warning mb-2">Farmacias Alejandro</p>
            <h1 className="h3 mb-0">Control operativo</h1>
          </div>

          <div className="border border-light-subtle rounded-2 p-3 mb-4">
            <span className="small text-warning d-block">Usuario</span>
            <strong className="d-block">{usuarioActual.nombre_usuario}</strong>
            <span className="small d-block mb-2">
              {(usuarioActual.roles || []).map((rol) => rol.nombre_rol).join(", ")}
            </span>
            <button className="btn btn-sm btn-outline-light" type="button" onClick={cerrarSesion}>
              Salir
            </button>
          </div>

          <nav className="nav nav-pills flex-column gap-2">
            {navegacionPrincipal.filter((item) => puedeVerVista(item.view)).map((item) => (
              <a
                className={`nav-link app-nav-link text-start ${
                  vistaActual === item.view ? "active" : "text-white"
                }`}
                href={`#${item.view}`}
                key={item.view}
                onClick={() => navigateTo(item.view)}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <section className="col-12 col-lg-9 col-xl-10 p-4 p-xl-5">
          {activeView === "dashboard" ? (
            <>
              <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4" id="dashboard">
                <div>
                  <p className="small text-uppercase fw-semibold text-success mb-2">Primer deploy Cloudflare</p>
                  <h2 className="display-6 fw-semibold mb-0">Dashboard base</h2>
                </div>
                <div
                  className={`alert ${apiOk ? "alert-success" : "alert-warning"} border mb-0 d-flex align-items-start gap-3`}
                  role="status"
                  aria-live="polite"
                >
                  <span className={`badge ${apiOk ? "text-bg-success" : "text-bg-warning"} mt-1`}>
                    {apiOk ? "OK" : "Aviso"}
                  </span>
                  <div>
                    <strong className="d-block">{apiState}</strong>
                    <span className="small">{apiDetail}</span>
                  </div>
                </div>
              </header>

              <section className="row g-3 mb-4" aria-label="Resumen operativo">
                {metrics.map((metric) => (
                  <div className="col-12 col-sm-6 col-xl" key={metric.label}>
                    <article className="card app-metric-card h-100">
                      <div className="card-body">
                        <span className="small text-secondary">{metric.label}</span>
                        <strong className="display-6 fw-semibold app-tabular d-block my-2">
                          {metric.value}
                        </strong>
                        <p className="small text-secondary mb-0">{metric.note}</p>
                      </div>
                    </article>
                  </div>
                ))}
              </section>

              <section className="row g-3" id="modulos">
                <div className="col-12 col-xl-7">
                  <div className="card h-100">
                    <div className="card-header bg-body">
                      <p className="small text-uppercase fw-semibold text-success mb-1">Modulos iniciales</p>
                      <h3 className="h5 mb-0">Base para crecer sin cambiar stack</h3>
                    </div>
                    <div className="list-group list-group-flush">
                      {modules.map((module) => (
                        <article
                          className="list-group-item d-flex justify-content-between align-items-center gap-3"
                          key={module.label}
                        >
                          <div>
                            <strong className="d-block">{module.label}</strong>
                            <span className="small text-secondary">{module.detail}</span>
                          </div>
                          <span className="badge text-bg-secondary">{module.status}</span>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="col-12 col-xl-5" id="tareas">
                  <div className="card h-100 border-warning">
                    <div className="card-header bg-warning-subtle">
                      <p className="small text-uppercase fw-semibold text-success mb-1">Siguientes pasos</p>
                      <h3 className="h5 mb-0">Checklist tecnico</h3>
                    </div>
                    <ol className="list-group list-group-numbered list-group-flush">
                      {tasks.map((task) => (
                        <li className="list-group-item" key={task}>
                          {task}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </section>
            </>
          ) : activeView === "sucursales" ? (
            <section id="sucursales">
              <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
                <div>
                  <p className="small text-uppercase fw-semibold text-success mb-2">REQ-007 / Orden 08</p>
                  <h2 className="display-6 fw-semibold mb-1">Sucursales</h2>
                  <p className="text-secondary mb-0">
                    Listado, registro, edicion y consulta de farmacias, stands y puntos en gasolinera.
                  </p>
                </div>
                <button className="btn btn-success align-self-start" type="button" onClick={showNewSucursalForm}>
                  Nueva sucursal
                </button>
              </header>

              <div className="row g-3">
                <div className={`col-12 ${sucursalView === "list" ? "" : "d-none"}`}>
                  <div className="card h-100">
                    <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
                      <div>
                        <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                        <h3 className="h5 mb-0">Puntos de operacion</h3>
                      </div>
                      {sucursalesLoading ? (
                        <span className="spinner-border spinner-border-sm text-success" role="status">
                          <span className="visually-hidden">Cargando sucursales</span>
                        </span>
                      ) : null}
                    </div>

                    {sucursalesError ? (
                      <div className="alert alert-warning m-3" role="alert">
                        {sucursalesError}
                      </div>
                    ) : null}

                    {!sucursalesLoading && sucursales.length === 0 && !sucursalesError ? (
                      <div className="card-body">
                        <div className="alert alert-info mb-0" role="status">
                          No hay sucursales registradas. Crea la primera para iniciar el control operativo.
                        </div>
                      </div>
                    ) : null}

                    {sucursales.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover align-middle mb-0">
                          <thead>
                            <tr>
                              <th scope="col">Codigo</th>
                              <th scope="col">Nombre</th>
                              <th scope="col">Tipo</th>
                              <th scope="col">Ubicacion</th>
                              <th scope="col">Telefono</th>
                              <th scope="col">Estado</th>
                              <th className="text-end" scope="col">
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sucursales.map((sucursal) => (
                              <tr
                                className={selectedSucursalId === sucursal.id_sucursal ? "table-success" : ""}
                                key={sucursal.id_sucursal}
                              >
                                <td className="app-tabular">
                                  {formatSucursalId(sucursal.id_sucursal)}
                                </td>
                                <td>
                                  <button
                                    className="btn btn-link btn-sm p-0 text-start"
                                    type="button"
                                    onClick={() => showSucursalDetail(sucursal)}
                                  >
                                    {sucursal.nombre}
                                  </button>
                                </td>
                                <td>{sucursal.tipo}</td>
                                <td>
                                  <span className="d-block">{sucursal.municipio}</span>
                                  <span className="small text-secondary">{sucursal.departamento}</span>
                                </td>
                                <td>{sucursal.telefono || "Sin telefono"}</td>
                                <td>
                                  <span className={`badge ${statusBadgeClass(sucursal.estado)}`}>
                                    {sucursal.estado}
                                  </span>
                                </td>
                                <td className="text-end">
                                  <div className="btn-group btn-group-sm" role="group" aria-label="Acciones">
                                    <button
                                      className="btn btn-outline-secondary"
                                      type="button"
                                      onClick={() => showSucursalDetail(sucursal)}
                                    >
                                      Ver detalle
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={`col-12 ${sucursalView === "form" ? "" : "d-none"}`}>
                  <div className="d-grid gap-3">
                    <form className="card" onSubmit={submitSucursal}>
                      <div className="card-header bg-body">
                        <p className="small text-uppercase fw-semibold text-success mb-1">
                          {editingSucursalId ? "Editar" : "Crear"}
                        </p>
                        <h3 className="h5 mb-0">
                          {editingSucursalId ? formatSucursalId(editingSucursalId) : "Nueva sucursal"}
                        </h3>
                      </div>
                      <div className="card-body">
                        {formMessage ? (
                          <div className="alert alert-success" role="status">
                            {formMessage}
                          </div>
                        ) : null}

                        {formError ? (
                          <div className="alert alert-danger" role="alert">
                            <strong className="d-block">{formError}</strong>
                            {formErrors.length > 0 ? (
                              <ul className="mb-0 mt-2">
                                {formErrors.map((error) => (
                                  <li key={error}>{error}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mb-3">
                          <label className="form-label" htmlFor="sucursal-nombre">
                            Nombre
                          </label>
                          <input
                            className="form-control"
                            id="sucursal-nombre"
                            name="nombre"
                            required
                            value={sucursalForm.nombre}
                            onChange={(event) => updateSucursalForm("nombre", event.target.value)}
                          />
                        </div>

                        <div className="row g-3">
                          <div className="col-12">
                            <label className="form-label" htmlFor="sucursal-tipo">
                              Tipo
                            </label>
                            <select
                              className="form-select"
                              id="sucursal-tipo"
                              name="tipo"
                              required
                              value={sucursalForm.tipo}
                              onChange={(event) => updateSucursalForm("tipo", event.target.value)}
                            >
                              {sucursalTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className="form-label" htmlFor="sucursal-direccion">
                            Direccion
                          </label>
                          <textarea
                            className="form-control"
                            id="sucursal-direccion"
                            name="direccion"
                            required
                            rows="2"
                            value={sucursalForm.direccion}
                            onChange={(event) => updateSucursalForm("direccion", event.target.value)}
                          />
                        </div>

                        <div className="row g-3 mt-0">
                          <div className="col-12 col-md-6">
                            <label className="form-label" htmlFor="sucursal-departamento">
                              Departamento
                            </label>
                            <select
                              className="form-select"
                              id="sucursal-departamento"
                              name="departamento"
                              required
                              value={sucursalForm.departamento}
                              onChange={(event) => updateDepartamento(event.target.value)}
                            >
                              <option value="">Selecciona departamento</option>
                              {departamentos.map((departamento) => (
                                <option key={departamento} value={departamento}>
                                  {departamento}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-12 col-md-6">
                            <label className="form-label" htmlFor="sucursal-municipio">
                              Municipio
                            </label>
                            <select
                              className="form-select"
                              disabled={!sucursalForm.departamento}
                              id="sucursal-municipio"
                              name="municipio"
                              required
                              value={sucursalForm.municipio}
                              onChange={(event) => updateSucursalForm("municipio", event.target.value)}
                            >
                              <option value="">
                                {sucursalForm.departamento ? "Selecciona municipio" : "Elige departamento primero"}
                              </option>
                              {municipiosDisponibles.map((municipio) => (
                                <option key={municipio} value={municipio}>
                                  {municipio}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className="form-label" htmlFor="sucursal-telefono">
                            Telefono
                          </label>
                          <input
                            className="form-control"
                            id="sucursal-telefono"
                            name="telefono"
                            type="tel"
                            value={sucursalForm.telefono}
                            onChange={(event) => updateSucursalForm("telefono", event.target.value)}
                          />
                        </div>

                        {sucursalForm.tipo === "FARMACIA" ? (
                          <div className="mt-3">
                            <label className="form-label" htmlFor="sucursal-centro">
                              ID centro comercial
                            </label>
                            <input
                              className="form-control"
                              id="sucursal-centro"
                              inputMode="numeric"
                              min="1"
                              name="centro_comercial_id"
                              type="number"
                              value={sucursalForm.centro_comercial_id}
                              onChange={(event) => updateSucursalForm("centro_comercial_id", event.target.value)}
                            />
                            <div className="form-text">Opcional para farmacias ubicadas en centro comercial.</div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <label className="form-label" htmlFor="sucursal-gasolinera">
                              ID gasolinera
                            </label>
                            <input
                              className="form-control"
                              id="sucursal-gasolinera"
                              inputMode="numeric"
                              min="1"
                              name="gasolinera_id"
                              required
                              type="number"
                              value={sucursalForm.gasolinera_id}
                              onChange={(event) => updateSucursalForm("gasolinera_id", event.target.value)}
                            />
                            <div className="form-text">Requerido por el modelo de datos para stands y gasolineras.</div>
                          </div>
                        )}
                      </div>
                      <div className="card-footer bg-body d-flex justify-content-end gap-2">
                        <button className="btn btn-outline-secondary" type="button" onClick={cancelSucursalForm}>
                          Cancelar
                        </button>
                        <button className="btn btn-success" type="submit" disabled={formSaving}>
                          {formSaving ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                              Guardando
                            </>
                          ) : (
                            "Guardar"
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className={`col-12 ${sucursalView === "detail" ? "" : "d-none"}`}>
                  <div className="d-grid gap-3">
                    <article className="card">
                      <div className="card-header bg-body d-flex flex-column flex-lg-row justify-content-between gap-3">
                        <div>
                          <p className="small text-uppercase fw-semibold text-success mb-1">Consulta</p>
                          <h3 className="h5 mb-0">Detalle de sucursal</h3>
                        </div>
                        <div className="d-flex gap-2">
                          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={showSucursalList}>
                            Volver a lista
                          </button>
                          {selectedSucursal ? (
                            <>
                              <button
                                className="btn btn-success btn-sm"
                                type="button"
                                onClick={() => editSucursal(selectedSucursal)}
                              >
                                Editar
                              </button>
                              <button
                                className="btn btn-outline-danger btn-sm"
                                disabled={Boolean(sucursalActionSaving)}
                                type="button"
                                onClick={deleteSucursal}
                              >
                                {sucursalActionSaving === "delete" ? "Eliminando" : "Eliminar"}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="card-body">
                        {sucursalActionError ? (
                          <div className="alert alert-danger" role="alert">
                            {sucursalActionError}
                          </div>
                        ) : null}
                        {selectedSucursal ? (
                          <dl className="row mb-0">
                            <dt className="col-sm-5">Codigo</dt>
                            <dd className="col-sm-7 app-tabular">
                              {formatSucursalId(selectedSucursal.id_sucursal)}
                            </dd>
                            <dt className="col-sm-5">Nombre</dt>
                            <dd className="col-sm-7">{selectedSucursal.nombre}</dd>
                            <dt className="col-sm-5">Tipo</dt>
                            <dd className="col-sm-7">{selectedSucursal.tipo}</dd>
                            <dt className="col-sm-5">Direccion</dt>
                            <dd className="col-sm-7">{selectedSucursal.direccion}</dd>
                            <dt className="col-sm-5">Departamento</dt>
                            <dd className="col-sm-7">{selectedSucursal.departamento}</dd>
                            <dt className="col-sm-5">Municipio</dt>
                            <dd className="col-sm-7">{selectedSucursal.municipio}</dd>
                            <dt className="col-sm-5">Telefono</dt>
                            <dd className="col-sm-7">{selectedSucursal.telefono || "Sin telefono"}</dd>
                            <dt className="col-sm-5">Estado</dt>
                            <dd className="col-sm-7">
                              <span className={`badge ${statusBadgeClass(selectedSucursal.estado)}`}>
                                {selectedSucursal.estado}
                              </span>
                            </dd>
                          </dl>
                        ) : (
                          <div className="alert alert-info mb-0" role="status">
                            Selecciona una sucursal del listado para consultar su detalle.
                          </div>
                        )}
                      </div>
                    </article>
                  </div>
                </div>
              </div>
            </section>
          ) : activeView === "medicamentos" ? (
            <section id="medicamentos">
              <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
                <div>
                  <p className="small text-uppercase fw-semibold text-success mb-2">REQ-008 / REQ-024</p>
                  <h2 className="display-6 fw-semibold mb-1">Medicamentos</h2>
                  <p className="text-secondary mb-0">
                    Catalogo maestro para presentaciones, unidades y control de receta.
                  </p>
                </div>
                <button className="btn btn-success align-self-start" type="button" onClick={showNewMedicamentoForm}>
                  Nuevo medicamento
                </button>
              </header>

              <div className="row g-3">
                <div className={`col-12 ${medicamentoView === "list" ? "" : "d-none"}`}>
                  <div className="card h-100">
                    <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
                      <div>
                        <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                        <h3 className="h5 mb-0">Catalogo maestro</h3>
                      </div>
                      {medicamentosLoading ? (
                        <span className="spinner-border spinner-border-sm text-success" role="status">
                          <span className="visually-hidden">Cargando medicamentos</span>
                        </span>
                      ) : null}
                    </div>

                    {medicamentosError ? (
                      <div className="alert alert-warning m-3" role="alert">
                        {medicamentosError}
                      </div>
                    ) : null}

                    {!medicamentosLoading && medicamentos.length === 0 && !medicamentosError ? (
                      <div className="card-body">
                        <div className="alert alert-info mb-0" role="status">
                          No hay medicamentos registrados. Crea el primer item del catalogo maestro.
                        </div>
                      </div>
                    ) : null}

                    {medicamentos.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover align-middle mb-0">
                          <thead>
                            <tr>
                              <th scope="col">Codigo</th>
                              <th scope="col">Nombre</th>
                              <th scope="col">Presentacion</th>
                              <th scope="col">Unidad</th>
                              <th className="text-end" scope="col">Stock</th>
                              <th className="text-end" scope="col">Lotes</th>
                              <th scope="col">Receta</th>
                              <th scope="col">Estado</th>
                              <th className="text-end" scope="col">
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {medicamentos.map((medicamento) => (
                              <tr
                                className={
                                  selectedMedicamentoId === medicamento.id_medicamento ? "table-success" : ""
                                }
                                key={medicamento.id_medicamento}
                              >
                                <td className="app-tabular">{medicamento.codigo}</td>
                                <td>
                                  <button
                                    className="btn btn-link btn-sm p-0 text-start"
                                    type="button"
                                    onClick={() => showMedicamentoDetail(medicamento)}
                                  >
                                    {medicamento.nombre}
                                  </button>
                                </td>
                                <td>{medicamento.presentacion}</td>
                                <td>{medicamento.unidad}</td>
                                <td className="text-end app-tabular">
                                  {Number(medicamento.stock_disponible || 0)}
                                </td>
                                <td className="text-end app-tabular">
                                  {Number(medicamento.total_lotes || 0)}
                                </td>
                                <td>
                                  <span
                                    className={`badge ${
                                      Number(medicamento.requiere_receta) === 1
                                        ? "text-bg-warning"
                                        : "text-bg-secondary"
                                    }`}
                                  >
                                    {Number(medicamento.requiere_receta) === 1 ? "Requiere" : "No requiere"}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${activeStatusBadgeClass(medicamento.estado)}`}>
                                    {medicamento.estado}
                                  </span>
                                </td>
                                <td className="text-end">
                                  <button
                                    className="btn btn-outline-secondary btn-sm"
                                    type="button"
                                    onClick={() => showMedicamentoDetail(medicamento)}
                                  >
                                    Ver detalle
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={`col-12 ${medicamentoView === "form" ? "" : "d-none"}`}>
                  <form className="card" onSubmit={submitMedicamento}>
                    <div className="card-header bg-body">
                      <p className="small text-uppercase fw-semibold text-success mb-1">
                        {editingMedicamentoId ? "Editar" : "Crear"}
                      </p>
                      <h3 className="h5 mb-0">
                        {editingMedicamentoId
                          ? selectedMedicamento?.codigo || formatMedicamentoId(editingMedicamentoId)
                          : "Nuevo medicamento"}
                      </h3>
                    </div>
                    <div className="card-body">
                      {medicamentoFormError ? (
                        <div className="alert alert-danger" role="alert">
                          <strong className="d-block">{medicamentoFormError}</strong>
                          {medicamentoFormErrors.length > 0 ? (
                            <ul className="mb-0 mt-2">
                              {medicamentoFormErrors.map((error) => (
                                <li key={error}>{error}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="row g-3">
                        <div className="col-12">
                          <label className="form-label" htmlFor="medicamento-nombre">
                            Nombre
                          </label>
                          <input
                            className="form-control"
                            id="medicamento-nombre"
                            name="nombre"
                            required
                            value={medicamentoForm.nombre}
                            onChange={(event) => updateMedicamentoForm("nombre", event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="row g-3 mt-0">
                        <div className="col-12 col-md-7">
                          <label className="form-label" htmlFor="medicamento-presentacion">
                            Presentacion
                          </label>
                          <input
                            className="form-control"
                            id="medicamento-presentacion"
                            name="presentacion"
                            placeholder="Ej. Tableta 500 mg"
                            required
                            value={medicamentoForm.presentacion}
                            onChange={(event) => updateMedicamentoForm("presentacion", event.target.value)}
                          />
                        </div>
                        <div className="col-12 col-md-5">
                          <label className="form-label" htmlFor="medicamento-unidad">
                            Unidad
                          </label>
                          <select
                            className="form-select"
                            id="medicamento-unidad"
                            name="unidad"
                            required
                            value={medicamentoForm.unidad}
                            onChange={(event) => updateMedicamentoForm("unidad", event.target.value)}
                          >
                            {medicamentoUnits.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-check mt-3">
                        <input
                          className="form-check-input"
                          checked={medicamentoForm.requiere_receta}
                          id="medicamento-receta"
                          name="requiere_receta"
                          type="checkbox"
                          onChange={(event) => updateMedicamentoForm("requiere_receta", event.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="medicamento-receta">
                          Requiere receta
                        </label>
                      </div>
                    </div>
                    <div className="card-footer bg-body d-flex justify-content-end gap-2">
                      <button className="btn btn-outline-secondary" type="button" onClick={cancelMedicamentoForm}>
                        Cancelar
                      </button>
                      <button className="btn btn-success" type="submit" disabled={medicamentoFormSaving}>
                        {medicamentoFormSaving ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                            Guardando
                          </>
                        ) : (
                          "Guardar"
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                <div className={`col-12 ${medicamentoView === "detail" ? "" : "d-none"}`}>
                  <article className="card">
                    <div className="card-header bg-body d-flex flex-column flex-lg-row justify-content-between gap-3">
                      <div>
                        <p className="small text-uppercase fw-semibold text-success mb-1">Consulta</p>
                        <h3 className="h5 mb-0">Detalle de medicamento</h3>
                      </div>
                      <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm" type="button" onClick={showMedicamentoList}>
                          Volver a lista
                        </button>
                        {selectedMedicamento ? (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              type="button"
                              onClick={() => editMedicamento(selectedMedicamento)}
                            >
                              Editar
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              disabled={Boolean(medicamentoActionSaving)}
                              type="button"
                              onClick={deleteMedicamento}
                            >
                              {medicamentoActionSaving === "delete" ? "Eliminando" : "Eliminar"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="card-body">
                      {medicamentoActionError ? (
                        <div className="alert alert-danger" role="alert">
                          {medicamentoActionError}
                        </div>
                      ) : null}

                      {selectedMedicamento ? (
                        <dl className="row mb-0">
                          <dt className="col-sm-5">Codigo</dt>
                          <dd className="col-sm-7 app-tabular">{selectedMedicamento.codigo}</dd>
                          <dt className="col-sm-5">Nombre</dt>
                          <dd className="col-sm-7">{selectedMedicamento.nombre}</dd>
                          <dt className="col-sm-5">Presentacion</dt>
                          <dd className="col-sm-7">{selectedMedicamento.presentacion}</dd>
                          <dt className="col-sm-5">Unidad</dt>
                          <dd className="col-sm-7">{selectedMedicamento.unidad}</dd>
                          <dt className="col-sm-5">Receta</dt>
                          <dd className="col-sm-7">
                            {Number(selectedMedicamento.requiere_receta) === 1 ? "Requiere receta" : "No requiere receta"}
                          </dd>
                          <dt className="col-sm-5">Estado</dt>
                          <dd className="col-sm-7">
                            <span className={`badge ${activeStatusBadgeClass(selectedMedicamento.estado)}`}>
                              {selectedMedicamento.estado}
                            </span>
                          </dd>
                          <dt className="col-sm-5">Lotes asociados</dt>
                          <dd className="col-sm-7 app-tabular">{Number(selectedMedicamento.total_lotes || 0)}</dd>
                          <dt className="col-sm-5">Stock disponible</dt>
                          <dd className="col-sm-7 app-tabular">{Number(selectedMedicamento.stock_disponible || 0)}</dd>
                        </dl>
                      ) : (
                        <div className="alert alert-info mb-0" role="status">
                          Selecciona un medicamento del listado para consultar su detalle.
                        </div>
                      )}
                    </div>
                  </article>
                </div>
              </div>
            </section>
          ) : activeView === "proveedores-lotes" ? (
            <TraceabilityView key={`traceability-${routeResetKey}`} />
          ) : activeView === "inventario" ? (
            <InventoryView key={`inventory-${routeResetKey}`} />
          ) : activeView === "movimientos-inventario" ? (
            <InventoryMovementsView key={`movements-${routeResetKey}`} />
          ) : activeView === "transferencias" ? (
            <TransfersView key={`transfers-${routeResetKey}`} />
          ) : activeView === "clientes" ? (
            <ClientsView key={`clients-${routeResetKey}`} />
          ) : activeView === "pedidos" ? (
            <OrdersView key={`orders-${routeResetKey}`} />
          ) : activeView === "pagos" ? (
            <VistaPagos key={`pagos-${routeResetKey}`} />
          ) : activeView === "entregas" ? (
            <VistaEntregas key={`entregas-${routeResetKey}`} />
          ) : activeView === "caja" ? (
            <VistaCaja key={`caja-${routeResetKey}`} />
          ) : activeView === "empleados" ? (
            <VistaEmpleados key={`empleados-${routeResetKey}`} />
          ) : activeView === "planillas" ? (
            <VistaPlanillas key={`planillas-${routeResetKey}`} />
          ) : activeView === "activos-fijos" ? (
            <VistaActivosFijos key={`activos-${routeResetKey}`} />
          ) : activeView === "usuarios" ? (
            <VistaUsuarios key={`usuarios-${routeResetKey}`} />
          ) : (
            <VistaAuditoria key={`auditoria-${routeResetKey}`} />
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
