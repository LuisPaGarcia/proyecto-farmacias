import { useEffect, useMemo, useState } from "react";

const emptyInventoryForm = {
  sucursal_id: "",
  lote_id: "",
  stock_actual: "0",
  stock_reservado: "0"
};

function formatCode(prefix, id) {
  return `${prefix}-${String(id || 0).padStart(3, "0")}`;
}

function loteLabel(lote) {
  return `${lote.numero_lote} - ${lote.medicamento_codigo} ${lote.medicamento_nombre}`;
}

function stockBadgeClass(stock) {
  return Number(stock || 0) > 0 ? "text-bg-success" : "text-bg-warning";
}

async function readJson(response, fallbackMessage) {
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.message || fallbackMessage);
  }

  return result.data || [];
}

export default function InventoryView() {
  const [view, setView] = useState("list");
  const [inventario, setInventario] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedInventarioId, setSelectedInventarioId] = useState(null);
  const [editingInventarioId, setEditingInventarioId] = useState(null);
  const [form, setForm] = useState(emptyInventoryForm);
  const [formError, setFormError] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSaving, setActionSaving] = useState("");

  const selectedInventario = useMemo(
    () => inventario.find((item) => item.id_inventario === selectedInventarioId) || null,
    [inventario, selectedInventarioId]
  );

  const stockDisponible = Math.max(Number(form.stock_actual || 0) - Number(form.stock_reservado || 0), 0);

  async function loadData() {
    setLoading(true);
    setLoadError("");

    try {
      const [inventarioResponse, sucursalesResponse, lotesResponse] = await Promise.all([
        fetch("/api/inventario"),
        fetch("/api/sucursales"),
        fetch("/api/lotes")
      ]);

      const [inventarioData, sucursalesData, lotesData] = await Promise.all([
        readJson(inventarioResponse, "No fue posible leer inventario."),
        readJson(sucursalesResponse, "No fue posible leer sucursales."),
        readJson(lotesResponse, "No fue posible leer lotes.")
      ]);

      setInventario(inventarioData);
      setSucursales(sucursalesData);
      setLotes(lotesData);
    } catch (error) {
      setLoadError(error.message || "No fue posible leer inventario.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setEditingInventarioId(null);
    setForm(emptyInventoryForm);
    setFormError("");
    setFormErrors([]);
  }

  function showList() {
    setView("list");
    setSelectedInventarioId(null);
    setActionError("");
    resetForm();
  }

  function showNewForm() {
    setSelectedInventarioId(null);
    setActionError("");
    resetForm();
    setView("form");
  }

  function showDetail(item) {
    setSelectedInventarioId(item.id_inventario);
    setActionError("");
    resetForm();
    setView("detail");
  }

  function cancelForm() {
    const nextView = editingInventarioId && selectedInventario ? "detail" : "list";
    resetForm();
    setView(nextView);
  }

  function editInventario(item) {
    setEditingInventarioId(item.id_inventario);
    setSelectedInventarioId(item.id_inventario);
    setForm({
      sucursal_id: item.sucursal_id || "",
      lote_id: item.lote_id || "",
      stock_actual: String(item.stock_actual || 0),
      stock_reservado: String(item.stock_reservado || 0)
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

  async function submitInventario(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFormErrors([]);

    const url = editingInventarioId ? `/api/inventario/${editingInventarioId}` : "/api/inventario";
    const method = editingInventarioId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setFormError(result.message || "No fue posible guardar el inventario.");
        setFormErrors(result.errors || []);
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setFormError(error.message || "No fue posible guardar el inventario.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteInventario() {
    if (!selectedInventario) return;

    const confirmed = window.confirm(
      `Eliminar ${formatCode("INV", selectedInventario.id_inventario)}? Esta accion no se puede deshacer.`
    );

    if (!confirmed) return;

    setActionSaving("delete");
    setActionError("");

    try {
      const response = await fetch(`/api/inventario/${selectedInventario.id_inventario}`, {
        method: "DELETE"
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setActionError(result.message || "No fue posible eliminar el inventario.");
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setActionError(error.message || "No fue posible eliminar el inventario.");
    } finally {
      setActionSaving("");
    }
  }

  return (
    <section id="inventario">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-010 / Orden 16</p>
          <h2 className="display-6 fw-semibold mb-1">Inventario</h2>
          <p className="text-secondary mb-0">
            Control de existencias por sucursal, medicamento y lote.
          </p>
        </div>
        <button className="btn btn-success align-self-start" type="button" onClick={showNewForm}>
          Nuevo inventario
        </button>
      </header>

      <div className="row g-3">
        <div className={`col-12 ${view === "list" ? "" : "d-none"}`}>
          <div className="card h-100">
            <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                <h3 className="h5 mb-0">Existencias por lote</h3>
              </div>
              {loading ? (
                <span className="spinner-border spinner-border-sm text-success" role="status">
                  <span className="visually-hidden">Cargando inventario</span>
                </span>
              ) : null}
            </div>

            {loadError ? (
              <div className="alert alert-warning m-3" role="alert">
                {loadError}
              </div>
            ) : null}

            {!loading && inventario.length === 0 && !loadError ? (
              <div className="card-body">
                <div className="alert alert-info mb-0" role="status">
                  No hay inventario registrado. Crea una existencia por sucursal y lote.
                </div>
              </div>
            ) : null}

            {inventario.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Codigo</th>
                      <th scope="col">Sucursal</th>
                      <th scope="col">Medicamento</th>
                      <th scope="col">Lote</th>
                      <th className="text-end" scope="col">Actual</th>
                      <th className="text-end" scope="col">Reservado</th>
                      <th className="text-end" scope="col">Disponible</th>
                      <th className="text-end" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.map((item) => (
                      <tr key={item.id_inventario}>
                        <td className="app-tabular">{formatCode("INV", item.id_inventario)}</td>
                        <td>{item.sucursal_nombre}</td>
                        <td>
                          <span className="d-block">{item.medicamento_nombre}</span>
                          <span className="small text-secondary app-tabular">{item.medicamento_codigo}</span>
                        </td>
                        <td>
                          <span className="d-block app-tabular">{item.numero_lote}</span>
                          <span className="small text-secondary">Vence {item.fecha_vencimiento}</span>
                        </td>
                        <td className="text-end app-tabular">{Number(item.stock_actual || 0)}</td>
                        <td className="text-end app-tabular">{Number(item.stock_reservado || 0)}</td>
                        <td className="text-end">
                          <span className={`badge ${stockBadgeClass(item.stock_disponible)}`}>
                            {Number(item.stock_disponible || 0)}
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            type="button"
                            onClick={() => showDetail(item)}
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
          <form className="card" onSubmit={submitInventario}>
            <div className="card-header bg-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">
                {editingInventarioId ? "Editar" : "Crear"}
              </p>
              <h3 className="h5 mb-0">
                {editingInventarioId ? formatCode("INV", editingInventarioId) : "Nuevo inventario"}
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
                  <label className="form-label" htmlFor="inventario-sucursal">Sucursal</label>
                  <select
                    className="form-select"
                    id="inventario-sucursal"
                    required
                    value={form.sucursal_id}
                    onChange={(event) => updateForm("sucursal_id", event.target.value)}
                  >
                    <option value="">Selecciona sucursal</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                        {formatCode("SUC", sucursal.id_sucursal)} - {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-lg-7">
                  <label className="form-label" htmlFor="inventario-lote">Lote</label>
                  <select
                    className="form-select"
                    id="inventario-lote"
                    required
                    value={form.lote_id}
                    onChange={(event) => updateForm("lote_id", event.target.value)}
                  >
                    <option value="">Selecciona lote</option>
                    {lotes.map((lote) => (
                      <option key={lote.id_lote} value={lote.id_lote}>
                        {loteLabel(lote)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mt-0">
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="inventario-actual">Stock actual</label>
                  <input
                    className="form-control"
                    id="inventario-actual"
                    min="0"
                    required
                    type="number"
                    value={form.stock_actual}
                    onChange={(event) => updateForm("stock_actual", event.target.value)}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="inventario-reservado">Stock reservado</label>
                  <input
                    className="form-control"
                    id="inventario-reservado"
                    min="0"
                    required
                    type="number"
                    value={form.stock_reservado}
                    onChange={(event) => updateForm("stock_reservado", event.target.value)}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="inventario-disponible">Stock disponible</label>
                  <input
                    className="form-control"
                    id="inventario-disponible"
                    readOnly
                    value={stockDisponible}
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
                <h3 className="h5 mb-0">Detalle de inventario</h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={showList}>
                  Volver a lista
                </button>
                {selectedInventario ? (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      type="button"
                      onClick={() => editInventario(selectedInventario)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      disabled={Boolean(actionSaving)}
                      type="button"
                      onClick={deleteInventario}
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

              {selectedInventario ? (
                <dl className="row mb-0">
                  <dt className="col-sm-5">Codigo</dt>
                  <dd className="col-sm-7 app-tabular">{formatCode("INV", selectedInventario.id_inventario)}</dd>
                  <dt className="col-sm-5">Sucursal</dt>
                  <dd className="col-sm-7">{selectedInventario.sucursal_nombre}</dd>
                  <dt className="col-sm-5">Medicamento</dt>
                  <dd className="col-sm-7">
                    {selectedInventario.medicamento_codigo} - {selectedInventario.medicamento_nombre}
                  </dd>
                  <dt className="col-sm-5">Presentacion</dt>
                  <dd className="col-sm-7">{selectedInventario.medicamento_presentacion}</dd>
                  <dt className="col-sm-5">Lote</dt>
                  <dd className="col-sm-7 app-tabular">{selectedInventario.numero_lote}</dd>
                  <dt className="col-sm-5">Vencimiento</dt>
                  <dd className="col-sm-7 app-tabular">{selectedInventario.fecha_vencimiento}</dd>
                  <dt className="col-sm-5">Stock actual</dt>
                  <dd className="col-sm-7 app-tabular">{Number(selectedInventario.stock_actual || 0)}</dd>
                  <dt className="col-sm-5">Stock reservado</dt>
                  <dd className="col-sm-7 app-tabular">{Number(selectedInventario.stock_reservado || 0)}</dd>
                  <dt className="col-sm-5">Stock disponible</dt>
                  <dd className="col-sm-7">
                    <span className={`badge ${stockBadgeClass(selectedInventario.stock_disponible)}`}>
                      {Number(selectedInventario.stock_disponible || 0)}
                    </span>
                  </dd>
                  <dt className="col-sm-5">Ultima actualizacion</dt>
                  <dd className="col-sm-7 app-tabular">{selectedInventario.updated_at}</dd>
                </dl>
              ) : (
                <div className="alert alert-info mb-0" role="status">
                  Selecciona un registro del listado para consultar su detalle.
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
