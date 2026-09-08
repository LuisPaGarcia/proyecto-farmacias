import { useEffect, useMemo, useState } from "react";

const emptyClientForm = {
  nombre: "",
  telefono: "",
  email: "",
  direccion: "",
  referencia_direccion: "",
  latitud: "",
  longitud: ""
};

function formatCode(prefix, id) {
  return `${prefix}-${String(id || 0).padStart(3, "0")}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

async function readJson(response, fallbackMessage) {
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.message || fallbackMessage);
  }

  return result.data || [];
}

export default function ClientsView() {
  const [view, setView] = useState("list");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);
  const [form, setForm] = useState(emptyClientForm);
  const [formError, setFormError] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSaving, setActionSaving] = useState("");

  const selectedClient = useMemo(
    () => clients.find((client) => client.id_cliente === selectedClientId) || null,
    [clients, selectedClientId]
  );

  async function loadData() {
    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/clientes");
      const data = await readJson(response, "No fue posible leer clientes.");
      setClients(data);
    } catch (error) {
      setClients([]);
      setSelectedClientId(null);
      setLoadError(error.message || "No fue posible leer clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setEditingClientId(null);
    setForm(emptyClientForm);
    setFormError("");
    setFormErrors([]);
  }

  function showList() {
    setView("list");
    setSelectedClientId(null);
    setActionError("");
    resetForm();
  }

  function showNewForm() {
    setSelectedClientId(null);
    setActionError("");
    resetForm();
    setView("form");
  }

  function showDetail(client) {
    setSelectedClientId(client.id_cliente);
    setActionError("");
    resetForm();
    setView("detail");
  }

  function cancelForm() {
    const nextView = editingClientId && selectedClient ? "detail" : "list";
    resetForm();
    setView(nextView);
  }

  function editClient(client) {
    setEditingClientId(client.id_cliente);
    setSelectedClientId(client.id_cliente);
    setForm({
      nombre: client.nombre || "",
      telefono: client.telefono || "",
      email: client.email || "",
      direccion: client.direccion || "",
      referencia_direccion: client.referencia_direccion || "",
      latitud: client.latitud ?? "",
      longitud: client.longitud ?? ""
    });
    setActionError("");
    setFormError("");
    setFormErrors([]);
    setView("form");
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function submitClient(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFormErrors([]);

    const url = editingClientId ? `/api/clientes/${editingClientId}` : "/api/clientes";
    const method = editingClientId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setFormError(result.message || "No fue posible guardar el cliente.");
        setFormErrors(result.errors || []);
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setFormError(error.message || "No fue posible guardar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient() {
    if (!selectedClient) return;

    const confirmed = window.confirm(`Eliminar ${selectedClient.nombre}? Esta accion no se puede deshacer.`);

    if (!confirmed) return;

    setActionSaving("delete");
    setActionError("");

    try {
      const response = await fetch(`/api/clientes/${selectedClient.id_cliente}`, {
        method: "DELETE"
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setActionError(result.message || "No fue posible eliminar el cliente.");
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setActionError(error.message || "No fue posible eliminar el cliente.");
    } finally {
      setActionSaving("");
    }
  }

  return (
    <section id="clientes">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-013 / Orden 25</p>
          <h2 className="display-6 fw-semibold mb-1">Clientes</h2>
          <p className="text-secondary mb-0">
            Contacto y direccion de entrega para pedidos de farmacia y call center.
          </p>
        </div>
        <button className="btn btn-success align-self-start" type="button" onClick={showNewForm}>
          Nuevo cliente
        </button>
      </header>

      <div className="row g-3">
        <div className={`col-12 ${view === "list" ? "" : "d-none"}`}>
          <div className="card h-100">
            <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                <h3 className="h5 mb-0">Directorio de clientes</h3>
              </div>
              {loading ? (
                <span className="spinner-border spinner-border-sm text-success" role="status">
                  <span className="visually-hidden">Cargando clientes</span>
                </span>
              ) : null}
            </div>

            {loadError ? (
              <div className="alert alert-warning m-3" role="alert">
                {loadError}
              </div>
            ) : null}

            {!loading && clients.length === 0 && !loadError ? (
              <div className="card-body">
                <div className="alert alert-info mb-0" role="status">
                  No hay clientes registrados.
                </div>
              </div>
            ) : null}

            {clients.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Codigo</th>
                      <th scope="col">Nombre</th>
                      <th scope="col">Telefono</th>
                      <th scope="col">Email</th>
                      <th scope="col">Direccion</th>
                      <th className="text-end" scope="col">Pedidos</th>
                      <th className="text-end" scope="col">Compras</th>
                      <th className="text-end" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id_cliente}>
                        <td className="app-tabular">{formatCode("CLI", client.id_cliente)}</td>
                        <td>
                          <button
                            className="btn btn-link btn-sm p-0 text-start"
                            type="button"
                            onClick={() => showDetail(client)}
                          >
                            {client.nombre}
                          </button>
                        </td>
                        <td>{client.telefono || "Sin telefono"}</td>
                        <td>{client.email || "Sin email"}</td>
                        <td>{client.direccion || "Sin direccion"}</td>
                        <td className="text-end app-tabular">{Number(client.total_pedidos || 0)}</td>
                        <td className="text-end app-tabular">{formatCurrency(client.total_compras)}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            type="button"
                            onClick={() => showDetail(client)}
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

        <div className={`col-12 ${view === "form" ? "" : "d-none"}`}>
          <form className="card" onSubmit={submitClient}>
            <div className="card-header bg-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">
                {editingClientId ? "Editar" : "Crear"}
              </p>
              <h3 className="h5 mb-0">
                {editingClientId ? formatCode("CLI", editingClientId) : "Nuevo cliente"}
              </h3>
            </div>
            <div className="card-body">
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

              <div className="row g-3">
                <div className="col-12 col-lg-5">
                  <label className="form-label" htmlFor="cliente-nombre">Nombre</label>
                  <input
                    className="form-control"
                    id="cliente-nombre"
                    required
                    value={form.nombre}
                    onChange={(event) => updateForm("nombre", event.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="cliente-telefono">Telefono</label>
                  <input
                    className="form-control"
                    id="cliente-telefono"
                    type="tel"
                    value={form.telefono}
                    onChange={(event) => updateForm("telefono", event.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-4">
                  <label className="form-label" htmlFor="cliente-email">Email</label>
                  <input
                    className="form-control"
                    id="cliente-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label" htmlFor="cliente-direccion">Direccion</label>
                <textarea
                  className="form-control"
                  id="cliente-direccion"
                  rows="2"
                  value={form.direccion}
                  onChange={(event) => updateForm("direccion", event.target.value)}
                />
              </div>

              <div className="mt-3">
                <label className="form-label" htmlFor="cliente-referencia">Referencia direccion</label>
                <input
                  className="form-control"
                  id="cliente-referencia"
                  value={form.referencia_direccion}
                  onChange={(event) => updateForm("referencia_direccion", event.target.value)}
                />
              </div>

              <div className="row g-3 mt-0">
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="cliente-latitud">Latitud</label>
                  <input
                    className="form-control"
                    id="cliente-latitud"
                    step="any"
                    type="number"
                    value={form.latitud}
                    onChange={(event) => updateForm("latitud", event.target.value)}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="cliente-longitud">Longitud</label>
                  <input
                    className="form-control"
                    id="cliente-longitud"
                    step="any"
                    type="number"
                    value={form.longitud}
                    onChange={(event) => updateForm("longitud", event.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="card-footer bg-body d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary" type="button" onClick={cancelForm}>
                Cancelar
              </button>
              <button className="btn btn-success" type="submit" disabled={saving}>
                {saving ? (
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

        <div className={`col-12 ${view === "detail" ? "" : "d-none"}`}>
          <article className="card">
            <div className="card-header bg-body d-flex flex-column flex-lg-row justify-content-between gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Consulta</p>
                <h3 className="h5 mb-0">Detalle de cliente</h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={showList}>
                  Volver a lista
                </button>
                {selectedClient ? (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      type="button"
                      onClick={() => editClient(selectedClient)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      disabled={Boolean(actionSaving)}
                      type="button"
                      onClick={deleteClient}
                    >
                      {actionSaving === "delete" ? "Eliminando" : "Eliminar"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="card-body">
              {actionError ? (
                <div className="alert alert-danger" role="alert">
                  {actionError}
                </div>
              ) : null}

              {selectedClient ? (
                <dl className="row mb-0">
                  <dt className="col-sm-5">Codigo</dt>
                  <dd className="col-sm-7 app-tabular">{formatCode("CLI", selectedClient.id_cliente)}</dd>
                  <dt className="col-sm-5">Nombre</dt>
                  <dd className="col-sm-7">{selectedClient.nombre}</dd>
                  <dt className="col-sm-5">Telefono</dt>
                  <dd className="col-sm-7">{selectedClient.telefono || "Sin telefono"}</dd>
                  <dt className="col-sm-5">Email</dt>
                  <dd className="col-sm-7">{selectedClient.email || "Sin email"}</dd>
                  <dt className="col-sm-5">Direccion</dt>
                  <dd className="col-sm-7">{selectedClient.direccion || "Sin direccion"}</dd>
                  <dt className="col-sm-5">Referencia</dt>
                  <dd className="col-sm-7">{selectedClient.referencia_direccion || "Sin referencia"}</dd>
                  <dt className="col-sm-5">Coordenadas</dt>
                  <dd className="col-sm-7 app-tabular">
                    {selectedClient.latitud != null && selectedClient.longitud != null
                      ? `${selectedClient.latitud}, ${selectedClient.longitud}`
                      : "Sin coordenadas"}
                  </dd>
                  <dt className="col-sm-5">Pedidos</dt>
                  <dd className="col-sm-7 app-tabular">{Number(selectedClient.total_pedidos || 0)}</dd>
                  <dt className="col-sm-5">Compras</dt>
                  <dd className="col-sm-7 app-tabular">{formatCurrency(selectedClient.total_compras)}</dd>
                </dl>
              ) : (
                <div className="alert alert-info mb-0" role="status">
                  Selecciona un cliente del listado para consultar su detalle.
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
