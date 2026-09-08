import { useEffect, useState } from "react";

const emptyTransferItem = {
  lote_id: "",
  cantidad_enviada: "1",
  cantidad_recibida: "0"
};

const emptyTransferForm = {
  sucursal_origen_id: "",
  sucursal_destino_id: "",
  fecha_envio: "",
  fecha_recepcion: "",
  estado: "CREADA",
  observacion: "",
  items: [{ ...emptyTransferItem }]
};

const transferStates = ["CREADA", "APROBADA", "ENVIADA", "RECIBIDA", "CANCELADA"];

function formatCode(prefix, id) {
  return `${prefix}-${String(id || 0).padStart(3, "0")}`;
}

function cloneEmptyForm() {
  return {
    ...emptyTransferForm,
    items: [{ ...emptyTransferItem }]
  };
}

function loteLabel(lote) {
  return `${lote.numero_lote} - ${lote.medicamento_codigo} ${lote.medicamento_nombre}`;
}

function transferBadgeClass(state) {
  if (state === "RECIBIDA") return "text-bg-success";
  if (["APROBADA", "ENVIADA"].includes(state)) return "text-bg-warning";
  if (state === "CANCELADA") return "text-bg-secondary";
  return "text-bg-info";
}

async function readJson(response, fallbackMessage) {
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.message || fallbackMessage);
  }

  return result.data ?? [];
}

export default function TransfersView() {
  const [view, setView] = useState("list");
  const [transfers, setTransfers] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [editingTransferId, setEditingTransferId] = useState(null);
  const [form, setForm] = useState(cloneEmptyForm);
  const [formError, setFormError] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSaving, setActionSaving] = useState("");

  async function loadData() {
    setLoading(true);
    setLoadError("");

    try {
      const [transfersResponse, sucursalesResponse, lotesResponse] = await Promise.all([
        fetch("/api/transferencias"),
        fetch("/api/sucursales"),
        fetch("/api/lotes")
      ]);

      const [transfersData, sucursalesData, lotesData] = await Promise.all([
        readJson(transfersResponse, "No fue posible leer transferencias."),
        readJson(sucursalesResponse, "No fue posible leer sucursales."),
        readJson(lotesResponse, "No fue posible leer lotes.")
      ]);

      setTransfers(transfersData);
      setSucursales(sucursalesData);
      setLotes(lotesData);
    } catch (error) {
      setLoadError(error.message || "No fue posible leer transferencias.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setEditingTransferId(null);
    setForm(cloneEmptyForm());
    setFormError("");
    setFormErrors([]);
  }

  function showList() {
    setView("list");
    setSelectedTransfer(null);
    setActionError("");
    resetForm();
  }

  function showNewForm() {
    setSelectedTransfer(null);
    setActionError("");
    resetForm();
    setView("form");
  }

  async function showDetail(transfer) {
    setSelectedTransfer(transfer);
    setActionError("");
    resetForm();
    setView("detail");
    setDetailLoading(true);

    try {
      const response = await fetch(`/api/transferencias/${transfer.id_transferencia}`);
      const data = await readJson(response, "No fue posible consultar la transferencia.");
      setSelectedTransfer(data);
    } catch (error) {
      setActionError(error.message || "No fue posible consultar la transferencia.");
    } finally {
      setDetailLoading(false);
    }
  }

  function cancelForm() {
    const nextView = editingTransferId && selectedTransfer ? "detail" : "list";
    resetForm();
    setView(nextView);
  }

  function editTransfer(transfer) {
    setEditingTransferId(transfer.id_transferencia);
    setSelectedTransfer(transfer);
    setForm({
      sucursal_origen_id: transfer.sucursal_origen_id || "",
      sucursal_destino_id: transfer.sucursal_destino_id || "",
      fecha_envio: transfer.fecha_envio || "",
      fecha_recepcion: transfer.fecha_recepcion || "",
      estado: transfer.estado || "CREADA",
      observacion: transfer.observacion || "",
      items:
        transfer.items?.length > 0
          ? transfer.items.map((item) => ({
              lote_id: item.lote_id || "",
              cantidad_enviada: String(item.cantidad_enviada || 1),
              cantidad_recibida: String(item.cantidad_recibida || 0)
            }))
          : [{ ...emptyTransferItem }]
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

  function updateOrigin(value) {
    setForm((current) => ({
      ...current,
      sucursal_origen_id: value,
      sucursal_destino_id:
        String(current.sucursal_destino_id) === String(value) ? "" : current.sucursal_destino_id
    }));
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, { ...emptyTransferItem }]
    }));
  }

  function removeItem(index) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((item, itemIndex) => itemIndex !== index)
    }));
  }

  async function submitTransfer(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFormErrors([]);

    const url = editingTransferId ? `/api/transferencias/${editingTransferId}` : "/api/transferencias";
    const method = editingTransferId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setFormError(result.message || "No fue posible guardar la transferencia.");
        setFormErrors(result.errors || []);
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setFormError(error.message || "No fue posible guardar la transferencia.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransfer() {
    if (!selectedTransfer) return;

    const confirmed = window.confirm(
      `Eliminar ${formatCode("TRA", selectedTransfer.id_transferencia)}? Esta accion no se puede deshacer.`
    );

    if (!confirmed) return;

    setActionSaving("delete");
    setActionError("");

    try {
      const response = await fetch(`/api/transferencias/${selectedTransfer.id_transferencia}`, {
        method: "DELETE"
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setActionError(result.message || "No fue posible eliminar la transferencia.");
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setActionError(error.message || "No fue posible eliminar la transferencia.");
    } finally {
      setActionSaving("");
    }
  }

  return (
    <section id="transferencias">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-012 / Orden 23</p>
          <h2 className="display-6 fw-semibold mb-1">Transferencias</h2>
          <p className="text-secondary mb-0">
            Traslados entre sucursales con estado, origen, destino y detalle de items.
          </p>
        </div>
        <button className="btn btn-success align-self-start" type="button" onClick={showNewForm}>
          Nueva transferencia
        </button>
      </header>

      <div className="row g-3">
        <div className={`col-12 ${view === "list" ? "" : "d-none"}`}>
          <div className="card h-100">
            <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                <h3 className="h5 mb-0">Traslados registrados</h3>
              </div>
              {loading ? (
                <span className="spinner-border spinner-border-sm text-success" role="status">
                  <span className="visually-hidden">Cargando transferencias</span>
                </span>
              ) : null}
            </div>

            {loadError ? (
              <div className="alert alert-warning m-3" role="alert">
                {loadError}
              </div>
            ) : null}

            {!loading && transfers.length === 0 && !loadError ? (
              <div className="card-body">
                <div className="alert alert-info mb-0" role="status">
                  No hay transferencias registradas.
                </div>
              </div>
            ) : null}

            {transfers.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Codigo</th>
                      <th scope="col">Fecha</th>
                      <th scope="col">Origen</th>
                      <th scope="col">Destino</th>
                      <th scope="col">Estado</th>
                      <th className="text-end" scope="col">Items</th>
                      <th className="text-end" scope="col">Enviado</th>
                      <th className="text-end" scope="col">Recibido</th>
                      <th className="text-end" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((transfer) => (
                      <tr key={transfer.id_transferencia}>
                        <td className="app-tabular">{formatCode("TRA", transfer.id_transferencia)}</td>
                        <td className="app-tabular">{transfer.fecha_hora}</td>
                        <td>{transfer.sucursal_origen_nombre}</td>
                        <td>{transfer.sucursal_destino_nombre}</td>
                        <td>
                          <span className={`badge ${transferBadgeClass(transfer.estado)}`}>
                            {transfer.estado}
                          </span>
                        </td>
                        <td className="text-end app-tabular">{Number(transfer.total_items || 0)}</td>
                        <td className="text-end app-tabular">{Number(transfer.total_enviado || 0)}</td>
                        <td className="text-end app-tabular">{Number(transfer.total_recibido || 0)}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            type="button"
                            onClick={() => showDetail(transfer)}
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
          <form className="card" onSubmit={submitTransfer}>
            <div className="card-header bg-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">
                {editingTransferId ? "Editar" : "Crear"}
              </p>
              <h3 className="h5 mb-0">
                {editingTransferId ? formatCode("TRA", editingTransferId) : "Nueva transferencia"}
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
                <div className="col-12 col-lg-4">
                  <label className="form-label" htmlFor="transfer-origen">Sucursal origen</label>
                  <select
                    className="form-select"
                    id="transfer-origen"
                    required
                    value={form.sucursal_origen_id}
                    onChange={(event) => updateOrigin(event.target.value)}
                  >
                    <option value="">Selecciona origen</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                        {formatCode("SUC", sucursal.id_sucursal)} - {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-lg-4">
                  <label className="form-label" htmlFor="transfer-destino">Sucursal destino</label>
                  <select
                    className="form-select"
                    id="transfer-destino"
                    required
                    value={form.sucursal_destino_id}
                    onChange={(event) => updateForm("sucursal_destino_id", event.target.value)}
                  >
                    <option value="">Selecciona destino</option>
                    {sucursales.map((sucursal) => (
                      <option
                        disabled={String(sucursal.id_sucursal) === String(form.sucursal_origen_id)}
                        key={sucursal.id_sucursal}
                        value={sucursal.id_sucursal}
                      >
                        {formatCode("SUC", sucursal.id_sucursal)} - {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-lg-4">
                  <label className="form-label" htmlFor="transfer-estado">Estado</label>
                  <select
                    className="form-select"
                    id="transfer-estado"
                    required
                    value={form.estado}
                    onChange={(event) => updateForm("estado", event.target.value)}
                  >
                    {transferStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mt-0">
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="transfer-envio">Fecha envio</label>
                  <input
                    className="form-control"
                    id="transfer-envio"
                    type="date"
                    value={form.fecha_envio}
                    onChange={(event) => updateForm("fecha_envio", event.target.value)}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="transfer-recepcion">Fecha recepcion</label>
                  <input
                    className="form-control"
                    id="transfer-recepcion"
                    type="date"
                    value={form.fecha_recepcion}
                    onChange={(event) => updateForm("fecha_recepcion", event.target.value)}
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label" htmlFor="transfer-observacion">Observacion</label>
                <textarea
                  className="form-control"
                  id="transfer-observacion"
                  rows="2"
                  value={form.observacion}
                  onChange={(event) => updateForm("observacion", event.target.value)}
                />
              </div>

              <div className="border rounded-2 mt-4">
                <div className="d-flex justify-content-between align-items-center gap-3 p-3 border-bottom">
                  <div>
                    <p className="small text-uppercase fw-semibold text-success mb-1">Items</p>
                    <h4 className="h6 mb-0">Lotes a transferir</h4>
                  </div>
                  <button className="btn btn-outline-success btn-sm" type="button" onClick={addItem}>
                    Agregar item
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">Lote</th>
                        <th className="text-end" scope="col">Enviada</th>
                        <th className="text-end" scope="col">Recibida</th>
                        <th className="text-end" scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item, index) => (
                        <tr key={`${index}-${item.lote_id}`}>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              required
                              value={item.lote_id}
                              onChange={(event) => updateItem(index, "lote_id", event.target.value)}
                            >
                              <option value="">Selecciona lote</option>
                              {lotes.map((lote) => (
                                <option key={lote.id_lote} value={lote.id_lote}>
                                  {loteLabel(lote)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm text-end"
                              min="1"
                              required
                              step="1"
                              type="number"
                              value={item.cantidad_enviada}
                              onChange={(event) => updateItem(index, "cantidad_enviada", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm text-end"
                              min="0"
                              required
                              step="1"
                              type="number"
                              value={item.cantidad_recibida}
                              onChange={(event) => updateItem(index, "cantidad_recibida", event.target.value)}
                            />
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-outline-danger btn-sm"
                              disabled={form.items.length === 1}
                              type="button"
                              onClick={() => removeItem(index)}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                <h3 className="h5 mb-0">Detalle de transferencia</h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={showList}>
                  Volver a lista
                </button>
                {selectedTransfer ? (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      disabled={detailLoading}
                      type="button"
                      onClick={() => editTransfer(selectedTransfer)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      disabled={Boolean(actionSaving)}
                      type="button"
                      onClick={deleteTransfer}
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

              {detailLoading ? (
                <div className="alert alert-info" role="status">
                  Cargando detalle de transferencia.
                </div>
              ) : null}

              {selectedTransfer ? (
                <>
                  <dl className="row mb-4">
                    <dt className="col-sm-5">Codigo</dt>
                    <dd className="col-sm-7 app-tabular">{formatCode("TRA", selectedTransfer.id_transferencia)}</dd>
                    <dt className="col-sm-5">Origen</dt>
                    <dd className="col-sm-7">{selectedTransfer.sucursal_origen_nombre}</dd>
                    <dt className="col-sm-5">Destino</dt>
                    <dd className="col-sm-7">{selectedTransfer.sucursal_destino_nombre}</dd>
                    <dt className="col-sm-5">Estado</dt>
                    <dd className="col-sm-7">
                      <span className={`badge ${transferBadgeClass(selectedTransfer.estado)}`}>
                        {selectedTransfer.estado}
                      </span>
                    </dd>
                    <dt className="col-sm-5">Fecha creacion</dt>
                    <dd className="col-sm-7 app-tabular">{selectedTransfer.fecha_hora}</dd>
                    <dt className="col-sm-5">Fecha envio</dt>
                    <dd className="col-sm-7 app-tabular">{selectedTransfer.fecha_envio || "Sin fecha"}</dd>
                    <dt className="col-sm-5">Fecha recepcion</dt>
                    <dd className="col-sm-7 app-tabular">{selectedTransfer.fecha_recepcion || "Sin fecha"}</dd>
                    <dt className="col-sm-5">Observacion</dt>
                    <dd className="col-sm-7">{selectedTransfer.observacion || "Sin observacion"}</dd>
                  </dl>

                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th scope="col">Medicamento</th>
                          <th scope="col">Lote</th>
                          <th className="text-end" scope="col">Enviada</th>
                          <th className="text-end" scope="col">Recibida</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedTransfer.items || []).map((item) => (
                          <tr key={item.id_item_transferencia}>
                            <td>
                              <span className="d-block">{item.medicamento_nombre}</span>
                              <span className="small text-secondary app-tabular">{item.medicamento_codigo}</span>
                            </td>
                            <td className="app-tabular">{item.numero_lote}</td>
                            <td className="text-end app-tabular">{Number(item.cantidad_enviada || 0)}</td>
                            <td className="text-end app-tabular">{Number(item.cantidad_recibida || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="alert alert-info mb-0" role="status">
                  Selecciona una transferencia del listado para consultar su detalle.
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
