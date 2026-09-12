import { useEffect, useMemo, useState } from "react";

const formularioPagoVacio = {
  pedido_id: "",
  sucursal_id: "",
  monto: "",
  metodo_pago: "EFECTIVO",
  referencia: "",
  estado: "CONFIRMADO"
};

const metodosPago = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "OTRO"];
const estadosPago = ["PENDIENTE", "CONFIRMADO", "RECHAZADO", "REEMBOLSADO"];

function formatearCodigo(prefijo, id) {
  return `${prefijo}-${String(id || 0).padStart(3, "0")}`;
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    maximumFractionDigits: 2
  }).format(Number(valor || 0));
}

function claseBadgePago(estado) {
  if (estado === "CONFIRMADO") return "text-bg-success";
  if (estado === "PENDIENTE") return "text-bg-warning";
  return "text-bg-secondary";
}

function etiquetaPedido(pedido) {
  return `${formatearCodigo("PED", pedido.id_pedido)} - ${pedido.cliente_nombre || "Consumidor final"} - ${formatearMoneda(pedido.total)}`;
}

async function leerJson(respuesta, mensajeAlterno) {
  const resultado = await respuesta.json();

  if (!respuesta.ok || !resultado.ok) {
    throw new Error(resultado.message || mensajeAlterno);
  }

  return resultado.data || [];
}

export default function VistaPagos() {
  const [vista, setVista] = useState("list");
  const [pagos, setPagos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [pagoSeleccionadoId, setPagoSeleccionadoId] = useState(null);
  const [pagoEditandoId, setPagoEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(formularioPagoVacio);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [erroresFormulario, setErroresFormulario] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");
  const [guardandoAccion, setGuardandoAccion] = useState("");

  const pagoSeleccionado = useMemo(
    () => pagos.find((pago) => pago.id_pago === pagoSeleccionadoId) || null,
    [pagos, pagoSeleccionadoId]
  );

  const pedidoSeleccionado = useMemo(
    () => pedidos.find((pedido) => String(pedido.id_pedido) === String(formulario.pedido_id)) || null,
    [pedidos, formulario.pedido_id]
  );

  async function cargarDatos() {
    setCargando(true);
    setErrorCarga("");

    try {
      const [respuestaPagos, respuestaPedidos] = await Promise.all([
        fetch("/api/pagos"),
        fetch("/api/pedidos")
      ]);

      const [datosPagos, datosPedidos] = await Promise.all([
        leerJson(respuestaPagos, "No fue posible leer pagos."),
        leerJson(respuestaPedidos, "No fue posible leer pedidos.")
      ]);

      setPagos(datosPagos);
      setPedidos(datosPedidos);
    } catch (error) {
      setPagos([]);
      setPagoSeleccionadoId(null);
      setErrorCarga(error.message || "No fue posible leer pagos.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function limpiarFormulario() {
    setPagoEditandoId(null);
    setFormulario(formularioPagoVacio);
    setErrorFormulario("");
    setErroresFormulario([]);
  }

  function mostrarLista() {
    setVista("list");
    setPagoSeleccionadoId(null);
    setErrorAccion("");
    limpiarFormulario();
  }

  function mostrarFormularioNuevo() {
    setPagoSeleccionadoId(null);
    setErrorAccion("");
    limpiarFormulario();
    setVista("formulario");
  }

  function mostrarDetalle(pago) {
    setPagoSeleccionadoId(pago.id_pago);
    setErrorAccion("");
    limpiarFormulario();
    setVista("detail");
  }

  function cancelarFormulario() {
    const siguienteVista = pagoEditandoId && pagoSeleccionado ? "detail" : "list";
    limpiarFormulario();
    setVista(siguienteVista);
  }

  function actualizarPedido(idPedido) {
    const pedido = pedidos.find((registro) => String(registro.id_pedido) === String(idPedido));

    setFormulario((actual) => ({
      ...actual,
      pedido_id: idPedido,
      sucursal_id: pedido?.sucursal_id || "",
      monto: actual.monto || (pedido ? String(pedido.total || "") : "")
    }));
  }

  function actualizarFormulario(campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor
    }));
  }

  function editarPago(pago) {
    setPagoEditandoId(pago.id_pago);
    setPagoSeleccionadoId(pago.id_pago);
    setFormulario({
      pedido_id: pago.pedido_id || "",
      sucursal_id: pago.sucursal_id || "",
      monto: String(pago.monto || ""),
      metodo_pago: pago.metodo_pago || "EFECTIVO",
      referencia: pago.referencia || "",
      estado: pago.estado || "CONFIRMADO"
    });
    setErrorAccion("");
    setErrorFormulario("");
    setErroresFormulario([]);
    setVista("formulario");
  }

  async function guardarPago(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario("");
    setErroresFormulario([]);

    const url = pagoEditandoId ? `/api/pagos/${pagoEditandoId}` : "/api/pagos";
    const metodo = pagoEditandoId ? "PUT" : "POST";

    try {
      const respuesta = await fetch(url, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formulario)
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorFormulario(resultado.message || "No fue posible guardar el pago.");
        setErroresFormulario(resultado.errors || []);
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorFormulario(error.message || "No fue posible guardar el pago.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarPago() {
    if (!pagoSeleccionado) return;

    const confirmado = window.confirm(
      `Eliminar ${formatearCodigo("PAG", pagoSeleccionado.id_pago)}? Esta accion no se puede deshacer.`
    );

    if (!confirmado) return;

    setGuardandoAccion("delete");
    setErrorAccion("");

    try {
      const respuesta = await fetch(`/api/pagos/${pagoSeleccionado.id_pago}`, {
        method: "DELETE"
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorAccion(resultado.message || "No fue posible eliminar el pago.");
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorAccion(error.message || "No fue posible eliminar el pago.");
    } finally {
      setGuardandoAccion("");
    }
  }

  return (
    <section id="pagos">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-015 / Orden 32</p>
          <h2 className="display-6 fw-semibold mb-1">Pagos</h2>
          <p className="text-secondary mb-0">Pagos asociados a pedidos por metodo, estado y referencia.</p>
        </div>
        <button className="btn btn-success align-self-start" type="button" onClick={mostrarFormularioNuevo}>
          Nuevo pago
        </button>
      </header>

      <div className="row g-3">
        <div className={`col-12 ${vista === "list" ? "" : "d-none"}`}>
          <div className="card h-100">
            <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                <h3 className="h5 mb-0">Pagos registrados</h3>
              </div>
              {cargando ? (
                <span className="spinner-border spinner-border-sm text-success" role="status">
                  <span className="visually-hidden">Cargando pagos</span>
                </span>
              ) : null}
            </div>

            {errorCarga ? (
              <div className="alert alert-warning m-3" role="alert">
                {errorCarga}
              </div>
            ) : null}

            {!cargando && pagos.length === 0 && !errorCarga ? (
              <div className="card-body">
                <div className="alert alert-info mb-0" role="status">
                  No hay pagos registrados.
                </div>
              </div>
            ) : null}

            {pagos.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Codigo</th>
                      <th scope="col">Fecha</th>
                      <th scope="col">Pedido</th>
                      <th scope="col">Cliente</th>
                      <th scope="col">Metodo</th>
                      <th scope="col">Estado</th>
                      <th className="text-end" scope="col">Monto</th>
                      <th className="text-end" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map((pago) => (
                      <tr key={pago.id_pago}>
                        <td className="app-tabular">{formatearCodigo("PAG", pago.id_pago)}</td>
                        <td className="app-tabular">{pago.fecha_hora}</td>
                        <td className="app-tabular">{formatearCodigo("PED", pago.pedido_id)}</td>
                        <td>{pago.cliente_nombre || "Consumidor final"}</td>
                        <td>{pago.metodo_pago}</td>
                        <td>
                          <span className={`badge ${claseBadgePago(pago.estado)}`}>
                            {pago.estado}
                          </span>
                        </td>
                        <td className="text-end app-tabular">{formatearMoneda(pago.monto)}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            type="button"
                            onClick={() => mostrarDetalle(pago)}
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

        <div className={`col-12 ${vista === "formulario" ? "" : "d-none"}`}>
          <form className="card" onSubmit={guardarPago}>
            <div className="card-header bg-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">
                {pagoEditandoId ? "Editar" : "Crear"}
              </p>
              <h3 className="h5 mb-0">
                {pagoEditandoId ? formatearCodigo("PAG", pagoEditandoId) : "Nuevo pago"}
              </h3>
            </div>
            <div className="card-body">
              {errorFormulario ? (
                <div className="alert alert-danger" role="alert">
                  <strong className="d-block">{errorFormulario}</strong>
                  {erroresFormulario.length > 0 ? (
                    <ul className="mb-0 mt-2">
                      {erroresFormulario.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className="row g-3">
                <div className="col-12 col-lg-6">
                  <label className="form-label" htmlFor="pago-pedido">Pedido</label>
                  <select
                    className="form-select"
                    id="pago-pedido"
                    required
                    value={formulario.pedido_id}
                    onChange={(evento) => actualizarPedido(evento.target.value)}
                  >
                    <option value="">Selecciona pedido</option>
                    {pedidos.map((pedido) => (
                      <option key={pedido.id_pedido} value={pedido.id_pedido}>
                        {etiquetaPedido(pedido)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="pago-monto">Monto</label>
                  <input
                    className="form-control text-end"
                    id="pago-monto"
                    min="0.01"
                    required
                    step="0.01"
                    type="number"
                    value={formulario.monto}
                    onChange={(evento) => actualizarFormulario("monto", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="pago-metodo">Metodo</label>
                  <select
                    className="form-select"
                    id="pago-metodo"
                    required
                    value={formulario.metodo_pago}
                    onChange={(evento) => actualizarFormulario("metodo_pago", evento.target.value)}
                  >
                    {metodosPago.map((metodo) => (
                      <option key={metodo} value={metodo}>
                        {metodo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mt-0">
                <div className="col-12 col-lg-4">
                  <label className="form-label" htmlFor="pago-estado">Estado</label>
                  <select
                    className="form-select"
                    id="pago-estado"
                    required
                    value={formulario.estado}
                    onChange={(evento) => actualizarFormulario("estado", evento.target.value)}
                  >
                    {estadosPago.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-lg-8">
                  <label className="form-label" htmlFor="pago-referencia">Referencia</label>
                  <input
                    className="form-control"
                    id="pago-referencia"
                    value={formulario.referencia}
                    onChange={(evento) => actualizarFormulario("referencia", evento.target.value)}
                  />
                </div>
              </div>

              {pedidoSeleccionado ? (
                <div className="alert alert-info mt-3 mb-0" role="status">
                  Pedido en {pedidoSeleccionado.sucursal_nombre}. Total del pedido: {formatearMoneda(pedidoSeleccionado.total)}.
                </div>
              ) : null}
            </div>
            <div className="card-footer bg-body d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary" type="button" onClick={cancelarFormulario}>
                Cancelar
              </button>
              <button className="btn btn-success" type="submit" disabled={guardando}>
                {guardando ? (
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

        <div className={`col-12 ${vista === "detail" ? "" : "d-none"}`}>
          <article className="card">
            <div className="card-header bg-body d-flex flex-column flex-lg-row justify-content-between gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Consulta</p>
                <h3 className="h5 mb-0">Detalle de pago</h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={mostrarLista}>
                  Volver a lista
                </button>
                {pagoSeleccionado ? (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      type="button"
                      onClick={() => editarPago(pagoSeleccionado)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      disabled={Boolean(guardandoAccion)}
                      type="button"
                      onClick={eliminarPago}
                    >
                      {guardandoAccion === "delete" ? "Eliminando" : "Eliminar"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="card-body">
              {errorAccion ? (
                <div className="alert alert-danger" role="alert">
                  {errorAccion}
                </div>
              ) : null}

              {pagoSeleccionado ? (
                <dl className="row mb-0">
                  <dt className="col-sm-5">Codigo</dt>
                  <dd className="col-sm-7 app-tabular">{formatearCodigo("PAG", pagoSeleccionado.id_pago)}</dd>
                  <dt className="col-sm-5">Pedido</dt>
                  <dd className="col-sm-7 app-tabular">{formatearCodigo("PED", pagoSeleccionado.pedido_id)}</dd>
                  <dt className="col-sm-5">Sucursal</dt>
                  <dd className="col-sm-7">{pagoSeleccionado.sucursal_nombre}</dd>
                  <dt className="col-sm-5">Cliente</dt>
                  <dd className="col-sm-7">{pagoSeleccionado.cliente_nombre || "Consumidor final"}</dd>
                  <dt className="col-sm-5">Monto</dt>
                  <dd className="col-sm-7 app-tabular">{formatearMoneda(pagoSeleccionado.monto)}</dd>
                  <dt className="col-sm-5">Metodo</dt>
                  <dd className="col-sm-7">{pagoSeleccionado.metodo_pago}</dd>
                  <dt className="col-sm-5">Estado</dt>
                  <dd className="col-sm-7">
                    <span className={`badge ${claseBadgePago(pagoSeleccionado.estado)}`}>
                      {pagoSeleccionado.estado}
                    </span>
                  </dd>
                  <dt className="col-sm-5">Referencia</dt>
                  <dd className="col-sm-7">{pagoSeleccionado.referencia || "Sin referencia"}</dd>
                  <dt className="col-sm-5">Fecha</dt>
                  <dd className="col-sm-7 app-tabular">{pagoSeleccionado.fecha_hora}</dd>
                </dl>
              ) : (
                <div className="alert alert-info mb-0" role="status">
                  Selecciona un pago del listado para consultar su detalle.
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
