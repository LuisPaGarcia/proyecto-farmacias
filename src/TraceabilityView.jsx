import { useEffect, useMemo, useState } from "react";

const emptyProveedorForm = {
  nombre: "",
  nit: "",
  telefono: "",
  direccion: ""
};

const emptyLoteForm = {
  medicamento_id: "",
  proveedor_id: "",
  numero_lote: "",
  fecha_fabricacion: "",
  fecha_vencimiento: ""
};

function formatCode(prefix, id) {
  return `${prefix}-${String(id || 0).padStart(3, "0")}`;
}

function activeStatusBadgeClass(state) {
  return state === "ACTIVO" ? "text-bg-success" : "text-bg-secondary";
}

function loteStatusBadgeClass(state) {
  if (state === "VENCIDO" || state === "RETIRADO") return "text-bg-danger";
  return state === "ACTIVO" ? "text-bg-success" : "text-bg-secondary";
}

function medicamentoLabel(medicamento) {
  return `${medicamento.codigo} - ${medicamento.nombre} (${medicamento.presentacion})`;
}

function loteLabel(lote) {
  return `${lote.numero_lote} - ${lote.medicamento_codigo} ${lote.medicamento_nombre}`;
}

async function readJson(response, fallbackMessage) {
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.message || fallbackMessage);
  }

  return result.data || [];
}

export default function TraceabilityView() {
  const [view, setView] = useState("list");
  const [entity, setEntity] = useState("proveedor");
  const [proveedores, setProveedores] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedProveedorId, setSelectedProveedorId] = useState(null);
  const [selectedLoteId, setSelectedLoteId] = useState(null);
  const [editingProveedorId, setEditingProveedorId] = useState(null);
  const [editingLoteId, setEditingLoteId] = useState(null);
  const [proveedorForm, setProveedorForm] = useState(emptyProveedorForm);
  const [loteForm, setLoteForm] = useState(emptyLoteForm);
  const [formError, setFormError] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSaving, setActionSaving] = useState("");

  const selectedProveedor = useMemo(
    () => proveedores.find((proveedor) => proveedor.id_proveedor === selectedProveedorId) || null,
    [proveedores, selectedProveedorId]
  );
  const selectedLote = useMemo(
    () => lotes.find((lote) => lote.id_lote === selectedLoteId) || null,
    [lotes, selectedLoteId]
  );

  async function loadData() {
    setLoading(true);
    setLoadError("");

    try {
      const [proveedoresResponse, lotesResponse, medicamentosResponse] = await Promise.all([
        fetch("/api/proveedores"),
        fetch("/api/lotes"),
        fetch("/api/medicamentos")
      ]);

      const [proveedoresData, lotesData, medicamentosData] = await Promise.all([
        readJson(proveedoresResponse, "No fue posible leer proveedores."),
        readJson(lotesResponse, "No fue posible leer lotes."),
        readJson(medicamentosResponse, "No fue posible leer medicamentos.")
      ]);

      setProveedores(proveedoresData);
      setLotes(lotesData);
      setMedicamentos(medicamentosData);
    } catch (error) {
      setLoadError(error.message || "No fue posible leer trazabilidad.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForms() {
    setEditingProveedorId(null);
    setEditingLoteId(null);
    setProveedorForm(emptyProveedorForm);
    setLoteForm(emptyLoteForm);
    setFormError("");
    setFormErrors([]);
  }

  function showList() {
    setView("list");
    setSelectedProveedorId(null);
    setSelectedLoteId(null);
    setActionError("");
    resetForms();
  }

  function showNewProveedorForm() {
    resetForms();
    setEntity("proveedor");
    setSelectedProveedorId(null);
    setSelectedLoteId(null);
    setView("form");
  }

  function showNewLoteForm() {
    resetForms();
    setEntity("lote");
    setSelectedProveedorId(null);
    setSelectedLoteId(null);
    setView("form");
  }

  function showProveedorDetail(proveedor) {
    resetForms();
    setEntity("proveedor");
    setSelectedProveedorId(proveedor.id_proveedor);
    setSelectedLoteId(null);
    setActionError("");
    setView("detail");
  }

  function showLoteDetail(lote) {
    resetForms();
    setEntity("lote");
    setSelectedLoteId(lote.id_lote);
    setSelectedProveedorId(null);
    setActionError("");
    setView("detail");
  }

  function cancelForm() {
    const hasDetail =
      (entity === "proveedor" && editingProveedorId && selectedProveedor) ||
      (entity === "lote" && editingLoteId && selectedLote);

    resetForms();
    setView(hasDetail ? "detail" : "list");
  }

  function editProveedor(proveedor) {
    setEntity("proveedor");
    setSelectedProveedorId(proveedor.id_proveedor);
    setEditingProveedorId(proveedor.id_proveedor);
    setProveedorForm({
      nombre: proveedor.nombre || "",
      nit: proveedor.nit || "",
      telefono: proveedor.telefono || "",
      direccion: proveedor.direccion || ""
    });
    setFormError("");
    setFormErrors([]);
    setActionError("");
    setView("form");
  }

  function editLote(lote) {
    setEntity("lote");
    setSelectedLoteId(lote.id_lote);
    setEditingLoteId(lote.id_lote);
    setLoteForm({
      medicamento_id: lote.medicamento_id || "",
      proveedor_id: lote.proveedor_id || "",
      numero_lote: lote.numero_lote || "",
      fecha_fabricacion: lote.fecha_fabricacion || "",
      fecha_vencimiento: lote.fecha_vencimiento || ""
    });
    setFormError("");
    setFormErrors([]);
    setActionError("");
    setView("form");
  }

  async function submitProveedor(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFormErrors([]);

    const url = editingProveedorId ? `/api/proveedores/${editingProveedorId}` : "/api/proveedores";
    const method = editingProveedorId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(proveedorForm)
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setFormError(result.message || "No fue posible guardar el proveedor.");
        setFormErrors(result.errors || []);
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setFormError(error.message || "No fue posible guardar el proveedor.");
    } finally {
      setSaving(false);
    }
  }

  async function submitLote(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFormErrors([]);

    const url = editingLoteId ? `/api/lotes/${editingLoteId}` : "/api/lotes";
    const method = editingLoteId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(loteForm)
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setFormError(result.message || "No fue posible guardar el lote.");
        setFormErrors(result.errors || []);
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setFormError(error.message || "No fue posible guardar el lote.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    const isProveedor = entity === "proveedor";
    const selected = isProveedor ? selectedProveedor : selectedLote;
    if (!selected) return;

    const label = isProveedor ? selected.nombre : selected.numero_lote;
    const confirmed = window.confirm(`Eliminar ${label}? Esta accion no se puede deshacer.`);

    if (!confirmed) return;

    setActionSaving("delete");
    setActionError("");

    try {
      const url = isProveedor
        ? `/api/proveedores/${selected.id_proveedor}`
        : `/api/lotes/${selected.id_lote}`;
      const response = await fetch(url, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setActionError(result.message || "No fue posible eliminar el registro.");
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setActionError(error.message || "No fue posible eliminar el registro.");
    } finally {
      setActionSaving("");
    }
  }

  return (
    <section id="proveedores-lotes">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-009 / Orden 13</p>
          <h2 className="display-6 fw-semibold mb-1">Proveedores y lotes</h2>
          <p className="text-secondary mb-0">
            Trazabilidad comercial y sanitaria para medicamentos, proveedores y vencimientos.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2 align-self-start">
          <button className="btn btn-outline-success" type="button" onClick={showNewProveedorForm}>
            Nuevo proveedor
          </button>
          <button className="btn btn-success" type="button" onClick={showNewLoteForm}>
            Nuevo lote
          </button>
        </div>
      </header>

      <div className="row g-3">
        <div className={`col-12 ${view === "list" ? "" : "d-none"}`}>
          {loadError ? (
            <div className="alert alert-warning" role="alert">
              {loadError}
            </div>
          ) : null}

          <div className="row g-3">
            <div className="col-12 col-xl-5">
              <div className="card h-100">
                <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
                  <div>
                    <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                    <h3 className="h5 mb-0">Proveedores</h3>
                  </div>
                  {loading ? (
                    <span className="spinner-border spinner-border-sm text-success" role="status">
                      <span className="visually-hidden">Cargando proveedores</span>
                    </span>
                  ) : null}
                </div>

                {!loading && proveedores.length === 0 && !loadError ? (
                  <div className="card-body">
                    <div className="alert alert-info mb-0" role="status">
                      No hay proveedores registrados.
                    </div>
                  </div>
                ) : null}

                {proveedores.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th scope="col">Codigo</th>
                          <th scope="col">Nombre</th>
                          <th scope="col">NIT</th>
                          <th className="text-end" scope="col">Lotes</th>
                          <th scope="col">Estado</th>
                          <th className="text-end" scope="col">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proveedores.map((proveedor) => (
                          <tr key={proveedor.id_proveedor}>
                            <td className="app-tabular">{formatCode("PRO", proveedor.id_proveedor)}</td>
                            <td>
                              <button
                                className="btn btn-link btn-sm p-0 text-start"
                                type="button"
                                onClick={() => showProveedorDetail(proveedor)}
                              >
                                {proveedor.nombre}
                              </button>
                            </td>
                            <td>{proveedor.nit || "Sin NIT"}</td>
                            <td className="text-end app-tabular">{Number(proveedor.total_lotes || 0)}</td>
                            <td>
                              <span className={`badge ${activeStatusBadgeClass(proveedor.estado)}`}>
                                {proveedor.estado}
                              </span>
                            </td>
                            <td className="text-end">
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                type="button"
                                onClick={() => showProveedorDetail(proveedor)}
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

            <div className="col-12 col-xl-7">
              <div className="card h-100">
                <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
                  <div>
                    <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                    <h3 className="h5 mb-0">Lotes</h3>
                  </div>
                  {loading ? (
                    <span className="spinner-border spinner-border-sm text-success" role="status">
                      <span className="visually-hidden">Cargando lotes</span>
                    </span>
                  ) : null}
                </div>

                {!loading && lotes.length === 0 && !loadError ? (
                  <div className="card-body">
                    <div className="alert alert-info mb-0" role="status">
                      No hay lotes registrados.
                    </div>
                  </div>
                ) : null}

                {lotes.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th scope="col">Codigo</th>
                          <th scope="col">Medicamento</th>
                          <th scope="col">Proveedor</th>
                          <th scope="col">Vence</th>
                          <th className="text-end" scope="col">Stock</th>
                          <th scope="col">Estado</th>
                          <th className="text-end" scope="col">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lotes.map((lote) => (
                          <tr key={lote.id_lote}>
                            <td>
                              <button
                                className="btn btn-link btn-sm p-0 text-start app-tabular"
                                type="button"
                                onClick={() => showLoteDetail(lote)}
                              >
                                {lote.numero_lote}
                              </button>
                            </td>
                            <td>
                              <span className="d-block">{lote.medicamento_nombre}</span>
                              <span className="small text-secondary app-tabular">{lote.medicamento_codigo}</span>
                            </td>
                            <td>{lote.proveedor_nombre || "Sin proveedor"}</td>
                            <td className="app-tabular">{lote.fecha_vencimiento}</td>
                            <td className="text-end app-tabular">{Number(lote.stock_disponible || 0)}</td>
                            <td>
                              <span className={`badge ${loteStatusBadgeClass(lote.estado)}`}>
                                {lote.estado}
                              </span>
                            </td>
                            <td className="text-end">
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                type="button"
                                onClick={() => showLoteDetail(lote)}
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
          </div>
        </div>

        <div className={`col-12 ${view === "form" ? "" : "d-none"}`}>
          <form className="card" onSubmit={entity === "proveedor" ? submitProveedor : submitLote}>
            <div className="card-header bg-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">
                {entity === "proveedor" ? "Proveedor" : "Lote"}
              </p>
              <h3 className="h5 mb-0">
                {entity === "proveedor"
                  ? editingProveedorId ? formatCode("PRO", editingProveedorId) : "Nuevo proveedor"
                  : editingLoteId ? selectedLote?.numero_lote || formatCode("LOT", editingLoteId) : "Nuevo lote"}
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

              {entity === "proveedor" ? (
                <>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="proveedor-nombre">Nombre</label>
                    <input
                      className="form-control"
                      id="proveedor-nombre"
                      required
                      value={proveedorForm.nombre}
                      onChange={(event) =>
                        setProveedorForm((current) => ({ ...current, nombre: event.target.value }))
                      }
                    />
                  </div>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label" htmlFor="proveedor-nit">NIT</label>
                      <input
                        className="form-control"
                        id="proveedor-nit"
                        value={proveedorForm.nit}
                        onChange={(event) =>
                          setProveedorForm((current) => ({ ...current, nit: event.target.value }))
                        }
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label" htmlFor="proveedor-telefono">Telefono</label>
                      <input
                        className="form-control"
                        id="proveedor-telefono"
                        type="tel"
                        value={proveedorForm.telefono}
                        onChange={(event) =>
                          setProveedorForm((current) => ({ ...current, telefono: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="form-label" htmlFor="proveedor-direccion">Direccion</label>
                    <textarea
                      className="form-control"
                      id="proveedor-direccion"
                      rows="2"
                      value={proveedorForm.direccion}
                      onChange={(event) =>
                        setProveedorForm((current) => ({ ...current, direccion: event.target.value }))
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="row g-3">
                    <div className="col-12 col-lg-7">
                      <label className="form-label" htmlFor="lote-medicamento">Medicamento</label>
                      <select
                        className="form-select"
                        id="lote-medicamento"
                        required
                        value={loteForm.medicamento_id}
                        onChange={(event) =>
                          setLoteForm((current) => ({ ...current, medicamento_id: event.target.value }))
                        }
                      >
                        <option value="">Selecciona medicamento</option>
                        {medicamentos.map((medicamento) => (
                          <option key={medicamento.id_medicamento} value={medicamento.id_medicamento}>
                            {medicamentoLabel(medicamento)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-lg-5">
                      <label className="form-label" htmlFor="lote-proveedor">Proveedor</label>
                      <select
                        className="form-select"
                        id="lote-proveedor"
                        value={loteForm.proveedor_id}
                        onChange={(event) =>
                          setLoteForm((current) => ({ ...current, proveedor_id: event.target.value }))
                        }
                      >
                        <option value="">Sin proveedor</option>
                        {proveedores.map((proveedor) => (
                          <option key={proveedor.id_proveedor} value={proveedor.id_proveedor}>
                            {proveedor.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="row g-3 mt-0">
                    <div className="col-12 col-md-4">
                      <label className="form-label" htmlFor="lote-numero">Numero de lote</label>
                      <input
                        className="form-control text-uppercase"
                        id="lote-numero"
                        required
                        value={loteForm.numero_lote}
                        onChange={(event) =>
                          setLoteForm((current) => ({ ...current, numero_lote: event.target.value }))
                        }
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label" htmlFor="lote-fabricacion">Fabricacion</label>
                      <input
                        className="form-control"
                        id="lote-fabricacion"
                        type="date"
                        value={loteForm.fecha_fabricacion}
                        onChange={(event) =>
                          setLoteForm((current) => ({ ...current, fecha_fabricacion: event.target.value }))
                        }
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label" htmlFor="lote-vencimiento">Vencimiento</label>
                      <input
                        className="form-control"
                        id="lote-vencimiento"
                        required
                        type="date"
                        value={loteForm.fecha_vencimiento}
                        onChange={(event) =>
                          setLoteForm((current) => ({ ...current, fecha_vencimiento: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                </>
              )}
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
                <h3 className="h5 mb-0">
                  {entity === "proveedor" ? "Detalle de proveedor" : "Detalle de lote"}
                </h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={showList}>
                  Volver a lista
                </button>
                {entity === "proveedor" && selectedProveedor ? (
                  <button className="btn btn-success btn-sm" type="button" onClick={() => editProveedor(selectedProveedor)}>
                    Editar
                  </button>
                ) : null}
                {entity === "lote" && selectedLote ? (
                  <button className="btn btn-success btn-sm" type="button" onClick={() => editLote(selectedLote)}>
                    Editar
                  </button>
                ) : null}
                {(selectedProveedor || selectedLote) ? (
                  <button
                    className="btn btn-outline-danger btn-sm"
                    disabled={Boolean(actionSaving)}
                    type="button"
                    onClick={deleteSelected}
                  >
                    {actionSaving === "delete" ? "Eliminando" : "Eliminar"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="card-body">
              {actionError ? (
                <div className="alert alert-danger" role="alert">
                  {actionError}
                </div>
              ) : null}

              {entity === "proveedor" && selectedProveedor ? (
                <dl className="row mb-0">
                  <dt className="col-sm-5">Codigo</dt>
                  <dd className="col-sm-7 app-tabular">{formatCode("PRO", selectedProveedor.id_proveedor)}</dd>
                  <dt className="col-sm-5">Nombre</dt>
                  <dd className="col-sm-7">{selectedProveedor.nombre}</dd>
                  <dt className="col-sm-5">NIT</dt>
                  <dd className="col-sm-7">{selectedProveedor.nit || "Sin NIT"}</dd>
                  <dt className="col-sm-5">Telefono</dt>
                  <dd className="col-sm-7">{selectedProveedor.telefono || "Sin telefono"}</dd>
                  <dt className="col-sm-5">Direccion</dt>
                  <dd className="col-sm-7">{selectedProveedor.direccion || "Sin direccion"}</dd>
                  <dt className="col-sm-5">Estado</dt>
                  <dd className="col-sm-7">
                    <span className={`badge ${activeStatusBadgeClass(selectedProveedor.estado)}`}>
                      {selectedProveedor.estado}
                    </span>
                  </dd>
                  <dt className="col-sm-5">Lotes asociados</dt>
                  <dd className="col-sm-7 app-tabular">{Number(selectedProveedor.total_lotes || 0)}</dd>
                </dl>
              ) : null}

              {entity === "lote" && selectedLote ? (
                <dl className="row mb-0">
                  <dt className="col-sm-5">Lote</dt>
                  <dd className="col-sm-7 app-tabular">{selectedLote.numero_lote}</dd>
                  <dt className="col-sm-5">Medicamento</dt>
                  <dd className="col-sm-7">{loteLabel(selectedLote)}</dd>
                  <dt className="col-sm-5">Proveedor</dt>
                  <dd className="col-sm-7">{selectedLote.proveedor_nombre || "Sin proveedor"}</dd>
                  <dt className="col-sm-5">Fabricacion</dt>
                  <dd className="col-sm-7 app-tabular">{selectedLote.fecha_fabricacion || "Sin fecha"}</dd>
                  <dt className="col-sm-5">Vencimiento</dt>
                  <dd className="col-sm-7 app-tabular">{selectedLote.fecha_vencimiento}</dd>
                  <dt className="col-sm-5">Stock disponible</dt>
                  <dd className="col-sm-7 app-tabular">{Number(selectedLote.stock_disponible || 0)}</dd>
                  <dt className="col-sm-5">Estado</dt>
                  <dd className="col-sm-7">
                    <span className={`badge ${loteStatusBadgeClass(selectedLote.estado)}`}>
                      {selectedLote.estado}
                    </span>
                  </dd>
                </dl>
              ) : null}

              {!selectedProveedor && !selectedLote ? (
                <div className="alert alert-info mb-0" role="status">
                  Selecciona un proveedor o lote del listado para consultar su detalle.
                </div>
              ) : null}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
