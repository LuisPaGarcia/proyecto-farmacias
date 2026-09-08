import { useEffect, useMemo, useState } from "react";

const emptyOrderItem = {
  medicamento_id: "",
  lote_id: "",
  cantidad: "1",
  precio_unitario: "0",
  descuento: "0"
};

const emptyOrderForm = {
  sucursal_id: "",
  cliente_id: "",
  canal: "FARMACIA",
  estado: "CREADO",
  observacion: "",
  items: [{ ...emptyOrderItem }]
};

const channels = ["FARMACIA", "CALL_CENTER", "PORTAL"];
const states = ["CREADO", "RESERVADO", "PAGADO", "DESPACHADO", "ENTREGADO", "CANCELADO"];

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

function cloneEmptyForm() {
  return {
    ...emptyOrderForm,
    items: [{ ...emptyOrderItem }]
  };
}

function orderBadgeClass(state) {
  if (state === "ENTREGADO") return "text-bg-success";
  if (["RESERVADO", "PAGADO", "DESPACHADO"].includes(state)) return "text-bg-warning";
  if (state === "CANCELADO") return "text-bg-secondary";
  return "text-bg-info";
}

function medicamentoLabel(medicamento) {
  return `${medicamento.codigo} - ${medicamento.nombre} (${medicamento.presentacion})`;
}

function loteLabel(lote) {
  return `${lote.numero_lote} - vence ${lote.fecha_vencimiento}`;
}

async function readJson(response, fallbackMessage) {
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.message || fallbackMessage);
  }

  return result.data || [];
}

export default function OrdersView() {
  const [view, setView] = useState("list");
  const [orders, setOrders] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [clients, setClients] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [filters, setFilters] = useState({ estado: "", canal: "", sucursal_id: "" });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [form, setForm] = useState(cloneEmptyForm);
  const [formError, setFormError] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSaving, setActionSaving] = useState("");

  const formTotals = useMemo(() => {
    const subtotal = form.items.reduce(
      (total, item) => total + Number(item.cantidad || 0) * Number(item.precio_unitario || 0),
      0
    );
    const discount = form.items.reduce((total, item) => total + Number(item.descuento || 0), 0);

    return {
      subtotal,
      discount,
      total: Math.max(subtotal - discount, 0)
    };
  }, [form.items]);

  function orderListPath(nextFilters = filters) {
    const params = new URLSearchParams();
    if (nextFilters.estado) params.set("estado", nextFilters.estado);
    if (nextFilters.canal) params.set("canal", nextFilters.canal);
    if (nextFilters.sucursal_id) params.set("sucursal_id", nextFilters.sucursal_id);
    const query = params.toString();

    return query ? `/api/pedidos?${query}` : "/api/pedidos";
  }

  async function loadData(nextFilters = filters) {
    setLoading(true);
    setLoadError("");

    try {
      const [ordersResponse, sucursalesResponse, clientsResponse, medsResponse, lotesResponse] =
        await Promise.all([
          fetch(orderListPath(nextFilters)),
          fetch("/api/sucursales"),
          fetch("/api/clientes"),
          fetch("/api/medicamentos"),
          fetch("/api/lotes")
        ]);

      const [ordersData, sucursalesData, clientsData, medsData, lotesData] = await Promise.all([
        readJson(ordersResponse, "No fue posible leer pedidos."),
        readJson(sucursalesResponse, "No fue posible leer sucursales."),
        readJson(clientsResponse, "No fue posible leer clientes."),
        readJson(medsResponse, "No fue posible leer medicamentos."),
        readJson(lotesResponse, "No fue posible leer lotes.")
      ]);

      setOrders(ordersData);
      setSucursales(sucursalesData);
      setClients(clientsData);
      setMedicamentos(medsData);
      setLotes(lotesData);
    } catch (error) {
      setLoadError(error.message || "No fue posible leer pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setEditingOrderId(null);
    setForm(cloneEmptyForm());
    setFormError("");
    setFormErrors([]);
  }

  function showList() {
    setView("list");
    setSelectedOrder(null);
    setActionError("");
    resetForm();
  }

  function showNewForm() {
    setSelectedOrder(null);
    setActionError("");
    resetForm();
    setView("form");
  }

  async function showDetail(order) {
    setSelectedOrder(order);
    setActionError("");
    resetForm();
    setView("detail");
    setDetailLoading(true);

    try {
      const response = await fetch(`/api/pedidos/${order.id_pedido}`);
      const data = await readJson(response, "No fue posible consultar el pedido.");
      setSelectedOrder(data);
    } catch (error) {
      setActionError(error.message || "No fue posible consultar el pedido.");
    } finally {
      setDetailLoading(false);
    }
  }

  function cancelForm() {
    const nextView = editingOrderId && selectedOrder ? "detail" : "list";
    resetForm();
    setView(nextView);
  }

  function editOrder(order) {
    setEditingOrderId(order.id_pedido);
    setSelectedOrder(order);
    setForm({
      sucursal_id: order.sucursal_id || "",
      cliente_id: order.cliente_id || "",
      canal: order.canal || "FARMACIA",
      estado: order.estado || "CREADO",
      observacion: order.observacion || "",
      items:
        order.items?.length > 0
          ? order.items.map((item) => ({
              medicamento_id: item.medicamento_id || "",
              lote_id: item.lote_id || "",
              cantidad: String(item.cantidad || 1),
              precio_unitario: String(item.precio_unitario || 0),
              descuento: String(item.descuento || 0)
            }))
          : [{ ...emptyOrderItem }]
    });
    setActionError("");
    setFormError("");
    setFormErrors([]);
    setView("form");
  }

  function updateFilter(field, value) {
    const nextFilters = {
      ...filters,
      [field]: value
    };
    setFilters(nextFilters);
    loadData(nextFilters);
  }

  function clearFilters() {
    const nextFilters = { estado: "", canal: "", sucursal_id: "" };
    setFilters(nextFilters);
    loadData(nextFilters);
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (field === "medicamento_id") {
          return {
            ...item,
            medicamento_id: value,
            lote_id: ""
          };
        }

        return {
          ...item,
          [field]: value
        };
      })
    }));
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, { ...emptyOrderItem }]
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

  function lotesForItem(item) {
    return lotes.filter((lote) => String(lote.medicamento_id) === String(item.medicamento_id));
  }

  async function submitOrder(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFormErrors([]);

    const url = editingOrderId ? `/api/pedidos/${editingOrderId}` : "/api/pedidos";
    const method = editingOrderId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setFormError(result.message || "No fue posible guardar el pedido.");
        setFormErrors(result.errors || []);
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setFormError(error.message || "No fue posible guardar el pedido.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder() {
    if (!selectedOrder) return;

    const confirmed = window.confirm(
      `Eliminar ${formatCode("PED", selectedOrder.id_pedido)}? Esta accion no se puede deshacer.`
    );

    if (!confirmed) return;

    setActionSaving("delete");
    setActionError("");

    try {
      const response = await fetch(`/api/pedidos/${selectedOrder.id_pedido}`, {
        method: "DELETE"
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setActionError(result.message || "No fue posible eliminar el pedido.");
        return;
      }

      await loadData();
      showList();
    } catch (error) {
      setActionError(error.message || "No fue posible eliminar el pedido.");
    } finally {
      setActionSaving("");
    }
  }

  return (
    <section id="pedidos">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-014 / Orden 29</p>
          <h2 className="display-6 fw-semibold mb-1">Pedidos</h2>
          <p className="text-secondary mb-0">
            Ventas presenciales, call center y portal con items, estado y totales calculados.
          </p>
        </div>
        <button className="btn btn-success align-self-start" type="button" onClick={showNewForm}>
          Nuevo pedido
        </button>
      </header>

      <div className="row g-3">
        <div className={`col-12 ${view === "list" ? "" : "d-none"}`}>
          <div className="card h-100">
            <div className="card-header bg-body">
              <div className="d-flex flex-column flex-xl-row justify-content-between gap-3">
                <div>
                  <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                  <h3 className="h5 mb-0">Pedidos registrados</h3>
                </div>
                {loading ? (
                  <span className="spinner-border spinner-border-sm text-success align-self-start" role="status">
                    <span className="visually-hidden">Cargando pedidos</span>
                  </span>
                ) : null}
              </div>

              <div className="row g-2 mt-3">
                <div className="col-12 col-md-4">
                  <label className="form-label small" htmlFor="pedido-filtro-sucursal">Sucursal</label>
                  <select
                    className="form-select form-select-sm"
                    id="pedido-filtro-sucursal"
                    value={filters.sucursal_id}
                    onChange={(event) => updateFilter("sucursal_id", event.target.value)}
                  >
                    <option value="">Todas</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                        {formatCode("SUC", sucursal.id_sucursal)} - {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small" htmlFor="pedido-filtro-canal">Canal</label>
                  <select
                    className="form-select form-select-sm"
                    id="pedido-filtro-canal"
                    value={filters.canal}
                    onChange={(event) => updateFilter("canal", event.target.value)}
                  >
                    <option value="">Todos</option>
                    {channels.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small" htmlFor="pedido-filtro-estado">Estado</label>
                  <select
                    className="form-select form-select-sm"
                    id="pedido-filtro-estado"
                    value={filters.estado}
                    onChange={(event) => updateFilter("estado", event.target.value)}
                  >
                    <option value="">Todos</option>
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-2 d-flex align-items-end">
                  <button className="btn btn-outline-secondary btn-sm w-100" type="button" onClick={clearFilters}>
                    Limpiar
                  </button>
                </div>
              </div>
            </div>

            {loadError ? (
              <div className="alert alert-warning m-3" role="alert">
                {loadError}
              </div>
            ) : null}

            {!loading && orders.length === 0 && !loadError ? (
              <div className="card-body">
                <div className="alert alert-info mb-0" role="status">
                  No hay pedidos registrados para los filtros actuales.
                </div>
              </div>
            ) : null}

            {orders.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Codigo</th>
                      <th scope="col">Fecha</th>
                      <th scope="col">Sucursal</th>
                      <th scope="col">Cliente</th>
                      <th scope="col">Canal</th>
                      <th scope="col">Estado</th>
                      <th className="text-end" scope="col">Items</th>
                      <th className="text-end" scope="col">Total</th>
                      <th className="text-end" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id_pedido}>
                        <td className="app-tabular">{formatCode("PED", order.id_pedido)}</td>
                        <td className="app-tabular">{order.fecha_hora}</td>
                        <td>{order.sucursal_nombre}</td>
                        <td>
                          <span className="d-block">{order.cliente_nombre || "Consumidor final"}</span>
                          <span className="small text-secondary">{order.cliente_telefono || "Sin telefono"}</span>
                        </td>
                        <td>{order.canal}</td>
                        <td>
                          <span className={`badge ${orderBadgeClass(order.estado)}`}>
                            {order.estado}
                          </span>
                        </td>
                        <td className="text-end app-tabular">{Number(order.total_items || 0)}</td>
                        <td className="text-end app-tabular">{formatCurrency(order.total)}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            type="button"
                            onClick={() => showDetail(order)}
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
          <form className="card" onSubmit={submitOrder}>
            <div className="card-header bg-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">
                {editingOrderId ? "Editar" : "Crear"}
              </p>
              <h3 className="h5 mb-0">
                {editingOrderId ? formatCode("PED", editingOrderId) : "Nuevo pedido"}
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
                  <label className="form-label" htmlFor="pedido-sucursal">Sucursal</label>
                  <select
                    className="form-select"
                    id="pedido-sucursal"
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
                <div className="col-12 col-lg-4">
                  <label className="form-label" htmlFor="pedido-cliente">Cliente</label>
                  <select
                    className="form-select"
                    id="pedido-cliente"
                    value={form.cliente_id}
                    onChange={(event) => updateForm("cliente_id", event.target.value)}
                  >
                    <option value="">Consumidor final</option>
                    {clients.map((client) => (
                      <option key={client.id_cliente} value={client.id_cliente}>
                        {formatCode("CLI", client.id_cliente)} - {client.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-sm-6 col-lg-2">
                  <label className="form-label" htmlFor="pedido-canal">Canal</label>
                  <select
                    className="form-select"
                    id="pedido-canal"
                    required
                    value={form.canal}
                    onChange={(event) => updateForm("canal", event.target.value)}
                  >
                    {channels.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-sm-6 col-lg-2">
                  <label className="form-label" htmlFor="pedido-estado">Estado</label>
                  <select
                    className="form-select"
                    id="pedido-estado"
                    required
                    value={form.estado}
                    onChange={(event) => updateForm("estado", event.target.value)}
                  >
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label" htmlFor="pedido-observacion">Observacion</label>
                <textarea
                  className="form-control"
                  id="pedido-observacion"
                  rows="2"
                  value={form.observacion}
                  onChange={(event) => updateForm("observacion", event.target.value)}
                />
              </div>

              <div className="border rounded-2 mt-4">
                <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 p-3 border-bottom">
                  <div>
                    <p className="small text-uppercase fw-semibold text-success mb-1">Items</p>
                    <h4 className="h6 mb-0">Medicamentos del pedido</h4>
                  </div>
                  <div className="d-flex flex-wrap justify-content-lg-end gap-2">
                    <span className="badge text-bg-light border app-tabular">
                      Subtotal {formatCurrency(formTotals.subtotal)}
                    </span>
                    <span className="badge text-bg-light border app-tabular">
                      Descuento {formatCurrency(formTotals.discount)}
                    </span>
                    <span className="badge text-bg-success app-tabular">
                      Total {formatCurrency(formTotals.total)}
                    </span>
                    <button className="btn btn-outline-success btn-sm" type="button" onClick={addItem}>
                      Agregar item
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">Medicamento</th>
                        <th scope="col">Lote</th>
                        <th className="text-end" scope="col">Cantidad</th>
                        <th className="text-end" scope="col">Precio</th>
                        <th className="text-end" scope="col">Descuento</th>
                        <th className="text-end" scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item, index) => (
                        <tr key={`${index}-${item.medicamento_id}-${item.lote_id}`}>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              required
                              value={item.medicamento_id}
                              onChange={(event) => updateItem(index, "medicamento_id", event.target.value)}
                            >
                              <option value="">Selecciona medicamento</option>
                              {medicamentos.map((medicamento) => (
                                <option key={medicamento.id_medicamento} value={medicamento.id_medicamento}>
                                  {medicamentoLabel(medicamento)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              disabled={!item.medicamento_id}
                              value={item.lote_id}
                              onChange={(event) => updateItem(index, "lote_id", event.target.value)}
                            >
                              <option value="">
                                {item.medicamento_id ? "Sin lote" : "Elige medicamento"}
                              </option>
                              {lotesForItem(item).map((lote) => (
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
                              value={item.cantidad}
                              onChange={(event) => updateItem(index, "cantidad", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm text-end"
                              min="0"
                              required
                              step="0.01"
                              type="number"
                              value={item.precio_unitario}
                              onChange={(event) => updateItem(index, "precio_unitario", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm text-end"
                              min="0"
                              required
                              step="0.01"
                              type="number"
                              value={item.descuento}
                              onChange={(event) => updateItem(index, "descuento", event.target.value)}
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
                <h3 className="h5 mb-0">Detalle de pedido</h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={showList}>
                  Volver a lista
                </button>
                {selectedOrder ? (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      disabled={detailLoading}
                      type="button"
                      onClick={() => editOrder(selectedOrder)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      disabled={Boolean(actionSaving)}
                      type="button"
                      onClick={deleteOrder}
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
                  Cargando detalle de pedido.
                </div>
              ) : null}

              {selectedOrder ? (
                <>
                  <dl className="row mb-4">
                    <dt className="col-sm-5">Codigo</dt>
                    <dd className="col-sm-7 app-tabular">{formatCode("PED", selectedOrder.id_pedido)}</dd>
                    <dt className="col-sm-5">Sucursal</dt>
                    <dd className="col-sm-7">{selectedOrder.sucursal_nombre}</dd>
                    <dt className="col-sm-5">Cliente</dt>
                    <dd className="col-sm-7">{selectedOrder.cliente_nombre || "Consumidor final"}</dd>
                    <dt className="col-sm-5">Canal</dt>
                    <dd className="col-sm-7">{selectedOrder.canal}</dd>
                    <dt className="col-sm-5">Estado</dt>
                    <dd className="col-sm-7">
                      <span className={`badge ${orderBadgeClass(selectedOrder.estado)}`}>
                        {selectedOrder.estado}
                      </span>
                    </dd>
                    <dt className="col-sm-5">Fecha</dt>
                    <dd className="col-sm-7 app-tabular">{selectedOrder.fecha_hora}</dd>
                    <dt className="col-sm-5">Subtotal</dt>
                    <dd className="col-sm-7 app-tabular">{formatCurrency(selectedOrder.subtotal)}</dd>
                    <dt className="col-sm-5">Descuento</dt>
                    <dd className="col-sm-7 app-tabular">{formatCurrency(selectedOrder.descuento_total)}</dd>
                    <dt className="col-sm-5">Total</dt>
                    <dd className="col-sm-7 app-tabular">{formatCurrency(selectedOrder.total)}</dd>
                    <dt className="col-sm-5">Observacion</dt>
                    <dd className="col-sm-7">{selectedOrder.observacion || "Sin observacion"}</dd>
                  </dl>

                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th scope="col">Medicamento</th>
                          <th scope="col">Lote</th>
                          <th className="text-end" scope="col">Cantidad</th>
                          <th className="text-end" scope="col">Precio</th>
                          <th className="text-end" scope="col">Descuento</th>
                          <th className="text-end" scope="col">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedOrder.items || []).map((item) => (
                          <tr key={item.id_item_pedido}>
                            <td>
                              <span className="d-block">{item.medicamento_nombre}</span>
                              <span className="small text-secondary app-tabular">{item.medicamento_codigo}</span>
                            </td>
                            <td className="app-tabular">{item.numero_lote || "Sin lote"}</td>
                            <td className="text-end app-tabular">{Number(item.cantidad || 0)}</td>
                            <td className="text-end app-tabular">{formatCurrency(item.precio_unitario)}</td>
                            <td className="text-end app-tabular">{formatCurrency(item.descuento)}</td>
                            <td className="text-end app-tabular">{formatCurrency(item.sub_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="alert alert-info mb-0" role="status">
                  Selecciona un pedido del listado para consultar su detalle.
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
