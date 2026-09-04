import { useEffect, useMemo, useState } from "react";
import departamentos from "../constantes/departamentos.json";
import municipiosPorDepartamento from "../constantes/municipios.json";

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
  gasolinera_id: "",
  estado: "ACTIVA"
};

const modules = [
  { label: "Sucursales", status: "Vista lista", detail: "Farmacias y stands" },
  { label: "Inventario", status: "Base creada", detail: "Stock por lote" },
  { label: "Pedidos", status: "Siguiente", detail: "Ventas y call center" },
  { label: "Caja", status: "Siguiente", detail: "Ingresos y egresos" }
];

const tasks = [
  "Crear vista de medicamentos",
  "Crear endpoints REST para medicamentos",
  "Crear vista de proveedores y lotes",
  "Validar stock antes de reservar o transferir"
];

const sucursalTypes = [
  { value: "FARMACIA", label: "Farmacia" },
  { value: "STAND", label: "Stand" },
  { value: "GASOLINERA", label: "Gasolinera" }
];

const sucursalStates = [
  { value: "ACTIVA", label: "Activa" },
  { value: "INACTIVA", label: "Inactiva" }
];

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

function toNullableNumber(value) {
  return value ? Number(value) : null;
}

function statusBadgeClass(state) {
  return state === "ACTIVA" ? "text-bg-success" : "text-bg-secondary";
}

function App() {
  const [activeView, setActiveView] = useState(() =>
    window.location.hash === "#sucursales" ? "sucursales" : "dashboard"
  );
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

  const municipiosDisponibles = municipiosPorDepartamento[sucursalForm.departamento] || [];

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
      setSelectedSucursalId((currentId) => currentId || result.data?.[0]?.id_sucursal || null);
    } catch (error) {
      setSucursales([]);
      setSelectedSucursalId(null);
      setSucursalesError(error.message || "No fue posible leer sucursales.");
    } finally {
      setSucursalesLoading(false);
    }
  }

  useEffect(() => {
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

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function handleHashChange() {
      setActiveView(window.location.hash === "#sucursales" ? "sucursales" : "dashboard");
    }

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

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

  function navigateTo(view) {
    setActiveView(view);
    window.location.hash = view === "sucursales" ? "sucursales" : "dashboard";
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

  function editSucursal(sucursal) {
    setEditingSucursalId(sucursal.id_sucursal);
    setSelectedSucursalId(sucursal.id_sucursal);
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
      gasolinera_id: sucursal.gasolinera_id || "",
      estado: sucursal.estado || "ACTIVA"
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
      setSelectedSucursalId(result.data?.id_sucursal || editingSucursalId);
      setEditingSucursalId(null);
      setSucursalForm(emptySucursalForm);
      setFormMessage("Sucursal guardada correctamente.");
    } catch (error) {
      setFormError(error.message || "No fue posible guardar la sucursal.");
    } finally {
      setFormSaving(false);
    }
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

          <nav className="nav nav-pills flex-column gap-2">
            <a
              className={`nav-link app-nav-link text-start ${
                activeView === "dashboard" ? "active" : "text-white"
              }`}
              href="#dashboard"
              onClick={() => navigateTo("dashboard")}
            >
              Dashboard
            </a>
            <a
              className={`nav-link app-nav-link text-start ${
                activeView === "sucursales" ? "active" : "text-white"
              }`}
              href="#sucursales"
              onClick={() => navigateTo("sucursales")}
            >
              Sucursales
            </a>
            <a className="nav-link app-nav-link text-white text-start" href="#modulos">
              Modulos
            </a>
            <a className="nav-link app-nav-link text-white text-start" href="#tareas">
              Tareas
            </a>
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
          ) : (
            <section id="sucursales">
              <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
                <div>
                  <p className="small text-uppercase fw-semibold text-success mb-2">REQ-007 / Orden 08</p>
                  <h2 className="display-6 fw-semibold mb-1">Sucursales</h2>
                  <p className="text-secondary mb-0">
                    Listado, registro, edicion y consulta de farmacias, stands y puntos en gasolinera.
                  </p>
                </div>
                <button className="btn btn-success align-self-start" type="button" onClick={resetSucursalForm}>
                  Nueva sucursal
                </button>
              </header>

              <div className="row g-3">
                <div className="col-12 order-2">
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
                                    onClick={() => setSelectedSucursalId(sucursal.id_sucursal)}
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
                                      onClick={() => setSelectedSucursalId(sucursal.id_sucursal)}
                                    >
                                      Consultar
                                    </button>
                                    <button
                                      className="btn btn-outline-success"
                                      type="button"
                                      onClick={() => editSucursal(sucursal)}
                                    >
                                      Editar
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

                <div className="col-12 order-1">
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
                          <div className="col-12 col-md-6">
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
                          <div className="col-12 col-md-6">
                            <label className="form-label" htmlFor="sucursal-estado">
                              Estado
                            </label>
                            <select
                              className="form-select"
                              id="sucursal-estado"
                              name="estado"
                              required
                              value={sucursalForm.estado}
                              onChange={(event) => updateSucursalForm("estado", event.target.value)}
                            >
                              {sucursalStates.map((state) => (
                                <option key={state.value} value={state.value}>
                                  {state.label}
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
                        <button className="btn btn-outline-secondary" type="button" onClick={resetSucursalForm}>
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

                    <article className="card">
                      <div className="card-header bg-body">
                        <p className="small text-uppercase fw-semibold text-success mb-1">Consulta</p>
                        <h3 className="h5 mb-0">Detalle de sucursal</h3>
                      </div>
                      <div className="card-body">
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
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
