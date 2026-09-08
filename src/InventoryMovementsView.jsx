import { useEffect, useMemo, useState } from "react";

const emptyMovementForm = {
  sucursal_id: "",
  lote_id: "",
  tipo_movimiento: "COMPRA",
  cantidad: "1",
  referencia: "",
  observacion: ""
};

const movementTypes = [
  { value: "COMPRA", label: "Compra" },
  { value: "VENTA", label: "Venta" },
  { value: "TRANSFERENCIA_SALIDA", label: "Transferencia salida" },
  { value: "TRANSFERENCIA_ENTRADA", label: "Transferencia entrada" },
  { value: "AJUSTE", label: "Ajuste" },
  { value: "DEVOLUCION", label: "Devolucion" },
  { value: "VENCIMIENTO", label: "Vencimiento" }
];

function formatCode(prefix, id) {
  return `${prefix}-${String(id || 0).padStart(3, "0")}`;
}

function loteLabel(lote) {
  return `${lote.numero_lote} - ${lote.medicamento_codigo} ${lote.medicamento_nombre}`;
}

function movementBadgeClass(type) {
  if (["COMPRA", "TRANSFERENCIA_ENTRADA", "DEVOLUCION"].includes(type)) return "text-bg-success";
  if (["VENTA", "TRANSFERENCIA_SALIDA", "VENCIMIENTO"].includes(type)) return "text-bg-warning";
  return "text-bg-secondary";
}

async function readJson(response, fallbackMessage) {
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.message || fallbackMessage);
  }

  return result.data || [];
}

export default function InventoryMovementsView() {
  const [view, setView] = useState("list");
  const [movements, setMovements] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedMovementId, setSelectedMovementId] = useState(null);
  const [editingMovementId, setEditingMovementId] = useState(null);
  const [form, setForm] = useState(emptyMovementForm);
  const [formError, setFormError] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSaving, setActionSaving] = useState("");

  const selectedMovement = useMemo(
    () => movements.find((movement) => movement.id_movimiento_inv === selectedMovementId) || null,
    [movements, selectedMovementId]
  );

  async function loadData() {
    setLoading(true);
    setLoadError("");

    try {
      const [movementsResponse, sucursalesResponse, lotesResponse] = await Promise.all([
        fetch("/api/movimientos-inventario"),
        fetch("/api/sucursales"),
        fetch("/api/lotes")
      ]);

      const [movementsData, sucursalesData, lotesData] = await Promise.all([
        readJson(movementsResponse, "No fue posible leer movimientos."),
        readJson(sucursalesResponse, "No fue posible leer sucursales."),
        readJson(lotesResponse, "No fue posible leer lotes.")
      ]);

      setMovements(movementsData);
      setSucursales(sucursalesData);
      setLotes(lotesData);
    } catch (error) {
      setLoadError(error.message || "No fue posible leer movimientos de inventario.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setEditingMovementId(null);
    setForm(emptyMovementForm);
    setFormError("");
    setFormErrors([]);
  }

  function showList() {
    setView("list");
    setSelectedMovementId(null);
    setActionError("");
    resetForm();
  }

  function showNewForm() {
    setSelectedMovementId(null);
    setActionError("");
    resetForm();
    setView("form");
  }

  function showDetail(movement) {
    setSelectedMovementId(movement.id_movimiento_inv);
    setActionError("");
    resetForm();
    setView("detail");
  }

  function cancelForm() {
    const nextView = editingMovementId && selectedMovement ? "detail" : "list";
    resetForm();
    setView(nextView);
  }

  function editMovement(movement) {
    setEditingMovementId(movement.id_movimiento_inv);
    setSelectedMovementId(movement.id_movimiento_inv);
    setForm({
      sucursal_id: movement.sucursal_id || "",
      lote_id: movement.lote_id || "",
      tipo_movimiento: movement.tipo_movimiento || "COMPRA",
      cantidad: String(movement.tipo_movimiento === "AJUSTE" ? movement.cantidad : Math.abs(movement.cantidad)),
      referencia: movement.referencia || "",
      observacion: movement.observacion || ""
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

  async function submitMovement(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFormErrors([]);

    const url = editingMovementId
      ? `/api/movimientos-inventario/${editingMovementId}`
      : "/api/movimientos-inventario";
    const method = editingMovementId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setFormError(result.message || "No fue posible guardar el movimiento.");
        setFormErrors(result.errors || []);
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setFormError(error.message || "No fue posible guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMovement() {
    if (!selectedMovement) return;

    const confirmed = window.confirm(
      `Eliminar ${formatCode("MOV", selectedMovement.id_movimiento_inv)}? Esta accion no se puede deshacer.`
    );

    if (!confirmed) return;

    setActionSaving("delete");
    setActionError("");

    try {
      const response = await fetch(`/api/movimientos-inventario/${selectedMovement.id_movimiento_inv}`, {
        method: "DELETE"
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setActionError(result.message || "No fue posible eliminar el movimiento.");
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setActionError(error.message || "No fue posible eliminar el movimiento.");
    } finally {
      setActionSaving("");
    }
  }

  return (
    <section id="movimientos-inventario">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-011 / Orden 19</p>
          <h2 className="display-6 fw-semibold mb-1">Movimientos de inventario</h2>
          <p className="text-secondary mb-0">
            Auditoria de entradas, salidas, ajustes, devoluciones y vencimientos por lote.
          </p>
        </div>
        <button className="btn btn-success align-self-start" type="button" onClick={showNewForm}>
          Nuevo movimiento
        </button>
      </header>

      <div className="row g-3">
        <div className={`col-12 ${view === "list" ? "" : "d-none"}`}>
          <div className="card h-100">
            <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                <h3 className="h5 mb-0">Kardex operativo</h3>
              </div>
              {loading ? (
                <span className="spinner-border spinner-border-sm text-success" role="status">
                  <span className="visually-hidden">Cargando movimientos</span>
                </span>
              ) : null}
            </div>

            {loadError ? (
              <div className="alert alert-warning m-3" role="alert">
                {loadError}
              </div>
            ) : null}

            {!loading && movements.length === 0 && !loadError ? (
              <div className="card-body">
                <div className="alert alert-info mb-0" role="status">
                  No hay movimientos registrados.
                </div>
              </div>
            ) : null}

            {movements.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Codigo</th>
                      <th scope="col">Fecha</th>
                      <th scope="col">Sucursal</th>
                      <th scope="col">Medicamento</th>
                      <th scope="col">Lote</th>
                      <th scope="col">Tipo</th>
                      <th className="text-end" scope="col">Cantidad</th>
                      <th className="text-end" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => (
                      <tr key={movement.id_movimiento_inv}>
                        <td className="app-tabular">{formatCode("MOV", movement.id_movimiento_inv)}</td>
                        <td className="app-tabular">{movement.fecha_hora}</td>
                        <td>{movement.sucursal_nombre}</td>
                        <td>
                          <span className="d-block">{movement.medicamento_nombre}</span>
                          <span className="small text-secondary app-tabular">{movement.medicamento_codigo}</span>
                        </td>
                        <td className="app-tabular">{movement.numero_lote}</td>
                        <td>
                          <span className={`badge ${movementBadgeClass(movement.tipo_movimiento)}`}>
                            {movement.tipo_movimiento}
                          </span>
                        </td>
                        <td className="text-end app-tabular">{Number(movement.cantidad || 0)}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            type="button"
                            onClick={() => showDetail(movement)}
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
          <form className="card" onSubmit={submitMovement}>
            <div className="card-header bg-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">
                {editingMovementId ? "Editar" : "Crear"}
              </p>
              <h3 className="h5 mb-0">
                {editingMovementId ? formatCode("MOV", editingMovementId) : "Nuevo movimiento"}
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
                  <label className="form-label" htmlFor="movimiento-sucursal">Sucursal</label>
                  <select
                    className="form-select"
                    id="movimiento-sucursal"
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
                  <label className="form-label" htmlFor="movimiento-lote">Lote</label>
                  <select
                    className="form-select"
                    id="movimiento-lote"
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
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="movimiento-tipo">Tipo</label>
                  <select
                    className="form-select"
                    id="movimiento-tipo"
                    required
                    value={form.tipo_movimiento}
                    onChange={(event) => updateForm("tipo_movimiento", event.target.value)}
                  >
                    {movementTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="movimiento-cantidad">Cantidad</label>
                  <input
                    className="form-control"
                    id="movimiento-cantidad"
                    required
                    step="1"
                    type="number"
                    value={form.cantidad}
                    onChange={(event) => updateForm("cantidad", event.target.value)}
                  />
                  <div className="form-text">
                    Ventas, salidas y vencimientos se guardan como cantidad negativa.
                  </div>
                </div>
              </div>

              <div className="row g-3 mt-0">
                <div className="col-12 col-md-5">
                  <label className="form-label" htmlFor="movimiento-referencia">Referencia</label>
                  <input
                    className="form-control"
                    id="movimiento-referencia"
                    value={form.referencia}
                    onChange={(event) => updateForm("referencia", event.target.value)}
                  />
                </div>
                <div className="col-12 col-md-7">
                  <label className="form-label" htmlFor="movimiento-observacion">Observacion</label>
                  <input
                    className="form-control"
                    id="movimiento-observacion"
                    value={form.observacion}
                    onChange={(event) => updateForm("observacion", event.target.value)}
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
                <h3 className="h5 mb-0">Detalle de movimiento</h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={showList}>
                  Volver a lista
                </button>
                {selectedMovement ? (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      type="button"
                      onClick={() => editMovement(selectedMovement)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      disabled={Boolean(actionSaving)}
                      type="button"
                      onClick={deleteMovement}
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

              {selectedMovement ? (
                <dl className="row mb-0">
                  <dt className="col-sm-5">Codigo</dt>
                  <dd className="col-sm-7 app-tabular">{formatCode("MOV", selectedMovement.id_movimiento_inv)}</dd>
                  <dt className="col-sm-5">Fecha</dt>
                  <dd className="col-sm-7 app-tabular">{selectedMovement.fecha_hora}</dd>
                  <dt className="col-sm-5">Sucursal</dt>
                  <dd className="col-sm-7">{selectedMovement.sucursal_nombre}</dd>
                  <dt className="col-sm-5">Medicamento</dt>
                  <dd className="col-sm-7">
                    {selectedMovement.medicamento_codigo} - {selectedMovement.medicamento_nombre}
                  </dd>
                  <dt className="col-sm-5">Lote</dt>
                  <dd className="col-sm-7 app-tabular">{selectedMovement.numero_lote}</dd>
                  <dt className="col-sm-5">Tipo</dt>
                  <dd className="col-sm-7">
                    <span className={`badge ${movementBadgeClass(selectedMovement.tipo_movimiento)}`}>
                      {selectedMovement.tipo_movimiento}
                    </span>
                  </dd>
                  <dt className="col-sm-5">Cantidad</dt>
                  <dd className="col-sm-7 app-tabular">{Number(selectedMovement.cantidad || 0)}</dd>
                  <dt className="col-sm-5">Referencia</dt>
                  <dd className="col-sm-7">{selectedMovement.referencia || "Sin referencia"}</dd>
                  <dt className="col-sm-5">Observacion</dt>
                  <dd className="col-sm-7">{selectedMovement.observacion || "Sin observacion"}</dd>
                </dl>
              ) : (
                <div className="alert alert-info mb-0" role="status">
                  Selecciona un movimiento del listado para consultar su detalle.
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
