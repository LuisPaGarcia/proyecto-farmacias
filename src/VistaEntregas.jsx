import { useEffect, useMemo, useState } from "react";

const formularioEntregaVacio = {
  pedido_id: "",
  sucursal_id: "",
  fecha_programada: "",
  fecha_entrega: "",
  direccion_entrega: "",
  referencia_direccion: "",
  estado: "PENDIENTE",
  observacion: ""
};

const estadosEntrega = ["PENDIENTE", "EN_RUTA", "ENTREGADA", "FALLIDA", "CANCELADA"];

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

function claseBadgeEntrega(entrega) {
  if (Number(entrega?.retrasada || 0) === 1) return "text-bg-danger";
  if (entrega?.estado === "ENTREGADA") return "text-bg-success";
  if (["PENDIENTE", "EN_RUTA"].includes(entrega?.estado)) return "text-bg-warning";
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

export default function VistaEntregas() {
  const [vista, setVista] = useState("list");
  const [entregas, setEntregas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [entregaSeleccionadaId, setEntregaSeleccionadaId] = useState(null);
  const [entregaEditandoId, setEntregaEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(formularioEntregaVacio);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [erroresFormulario, setErroresFormulario] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");
  const [guardandoAccion, setGuardandoAccion] = useState("");

  const entregaSeleccionada = useMemo(
    () => entregas.find((entrega) => entrega.id_entrega === entregaSeleccionadaId) || null,
    [entregas, entregaSeleccionadaId]
  );

  const pedidoSeleccionado = useMemo(
    () => pedidos.find((pedido) => String(pedido.id_pedido) === String(formulario.pedido_id)) || null,
    [pedidos, formulario.pedido_id]
  );

  async function cargarDatos(siguienteSoloPendientes = soloPendientes) {
    setCargando(true);
    setErrorCarga("");

    try {
      const [respuestaEntregas, respuestaPedidos, respuestaClientes] = await Promise.all([
        fetch(siguienteSoloPendientes ? "/api/entregas-pendientes" : "/api/entregas"),
        fetch("/api/pedidos"),
        fetch("/api/clientes")
      ]);

      const [datosEntregas, datosPedidos, datosClientes] = await Promise.all([
        leerJson(respuestaEntregas, "No fue posible leer entregas."),
        leerJson(respuestaPedidos, "No fue posible leer pedidos."),
        leerJson(respuestaClientes, "No fue posible leer clientes.")
      ]);

      setEntregas(datosEntregas);
      setPedidos(datosPedidos);
      setClientes(datosClientes);
    } catch (error) {
      setEntregas([]);
      setEntregaSeleccionadaId(null);
      setErrorCarga(error.message || "No fue posible leer entregas.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function limpiarFormulario() {
    setEntregaEditandoId(null);
    setFormulario(formularioEntregaVacio);
    setErrorFormulario("");
    setErroresFormulario([]);
  }

  function mostrarLista() {
    setVista("list");
    setEntregaSeleccionadaId(null);
    setErrorAccion("");
    limpiarFormulario();
  }

  function mostrarFormularioNuevo() {
    setEntregaSeleccionadaId(null);
    setErrorAccion("");
    limpiarFormulario();
    setVista("formulario");
  }

  function mostrarDetalle(entrega) {
    setEntregaSeleccionadaId(entrega.id_entrega);
    setErrorAccion("");
    limpiarFormulario();
    setVista("detail");
  }

  function cancelarFormulario() {
    const siguienteVista = entregaEditandoId && entregaSeleccionada ? "detail" : "list";
    limpiarFormulario();
    setVista(siguienteVista);
  }

  function alternarSoloPendientes(valor) {
    setSoloPendientes(valor);
    cargarDatos(valor);
  }

  function actualizarPedido(idPedido) {
    const pedido = pedidos.find((registro) => String(registro.id_pedido) === String(idPedido));
    const cliente = clientes.find((registro) => String(registro.id_cliente) === String(pedido?.cliente_id));

    setFormulario((actual) => ({
      ...actual,
      pedido_id: idPedido,
      sucursal_id: pedido?.sucursal_id || "",
      direccion_entrega: actual.direccion_entrega || cliente?.direccion || "",
      referencia_direccion: actual.referencia_direccion || cliente?.referencia_direccion || ""
    }));
  }

  function actualizarFormulario(campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor
    }));
  }

  function editarEntrega(entrega) {
    setEntregaEditandoId(entrega.id_entrega);
    setEntregaSeleccionadaId(entrega.id_entrega);
    setFormulario({
      pedido_id: entrega.pedido_id || "",
      sucursal_id: entrega.sucursal_id || "",
      fecha_programada: entrega.fecha_programada || "",
      fecha_entrega: entrega.fecha_entrega || "",
      direccion_entrega: entrega.direccion_entrega || "",
      referencia_direccion: entrega.referencia_direccion || "",
      estado: entrega.estado || "PENDIENTE",
      observacion: entrega.observacion || ""
    });
    setErrorAccion("");
    setErrorFormulario("");
    setErroresFormulario([]);
    setVista("formulario");
  }

  async function guardarEntrega(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario("");
    setErroresFormulario([]);

    const url = entregaEditandoId ? `/api/entregas/${entregaEditandoId}` : "/api/entregas";
    const metodo = entregaEditandoId ? "PUT" : "POST";

    try {
      const respuesta = await fetch(url, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formulario)
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorFormulario(resultado.message || "No fue posible guardar la entrega.");
        setErroresFormulario(resultado.errors || []);
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorFormulario(error.message || "No fue posible guardar la entrega.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarEntrega() {
    if (!entregaSeleccionada) return;

    const confirmado = window.confirm(
      `Eliminar ${formatearCodigo("ENT", entregaSeleccionada.id_entrega)}? Esta accion no se puede deshacer.`
    );

    if (!confirmado) return;

    setGuardandoAccion("delete");
    setErrorAccion("");

    try {
      const respuesta = await fetch(`/api/entregas/${entregaSeleccionada.id_entrega}`, {
        method: "DELETE"
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorAccion(resultado.message || "No fue posible eliminar la entrega.");
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorAccion(error.message || "No fue posible eliminar la entrega.");
    } finally {
      setGuardandoAccion("");
    }
  }

  return (
    <section id="entregas">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-016 / Orden 35</p>
          <h2 className="display-6 fw-semibold mb-1">Entregas</h2>
          <p className="text-secondary mb-0">
            Programacion, seguimiento y cierre de entregas asociadas a pedidos.
          </p>
        </div>
        <button className="btn btn-success align-self-start" type="button" onClick={mostrarFormularioNuevo}>
          Nueva entrega
        </button>
      </header>

      <div className="row g-3">
        <div className={`col-12 ${vista === "list" ? "" : "d-none"}`}>
          <div className="card h-100">
            <div className="card-header bg-body d-flex flex-column flex-lg-row justify-content-between gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                <h3 className="h5 mb-0">Entregas registradas</h3>
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <div className="form-check form-switch mb-0">
                  <input
                    checked={soloPendientes}
                    className="form-check-input"
                    id="entregas-pendientes"
                    type="checkbox"
                    onChange={(evento) => alternarSoloPendientes(evento.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="entregas-pendientes">
                    Solo pendientes
                  </label>
                </div>
                {cargando ? (
                  <span className="spinner-border spinner-border-sm text-success" role="status">
                    <span className="visually-hidden">Cargando entregas</span>
                  </span>
                ) : null}
              </div>
            </div>

            {errorCarga ? (
              <div className="alert alert-warning m-3" role="alert">
                {errorCarga}
              </div>
            ) : null}

            {!cargando && entregas.length === 0 && !errorCarga ? (
              <div className="card-body">
                <div className="alert alert-info mb-0" role="status">
                  No hay entregas registradas.
                </div>
              </div>
            ) : null}

            {entregas.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Codigo</th>
                      <th scope="col">Pedido</th>
                      <th scope="col">Sucursal</th>
                      <th scope="col">Cliente</th>
                      <th scope="col">Programada</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Direccion</th>
                      <th className="text-end" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entregas.map((entrega) => (
                      <tr key={entrega.id_entrega}>
                        <td className="app-tabular">{formatearCodigo("ENT", entrega.id_entrega)}</td>
                        <td className="app-tabular">{formatearCodigo("PED", entrega.pedido_id)}</td>
                        <td>{entrega.sucursal_nombre}</td>
                        <td>
                          <span className="d-block">{entrega.cliente_nombre || "Consumidor final"}</span>
                          <span className="small text-secondary">{entrega.cliente_telefono || "Sin telefono"}</span>
                        </td>
                        <td className="app-tabular">{entrega.fecha_programada || "Sin fecha"}</td>
                        <td>
                          <span className={`badge ${claseBadgeEntrega(entrega)}`}>
                            {Number(entrega.retrasada || 0) === 1 ? "RETRASADA" : entrega.estado}
                          </span>
                        </td>
                        <td>{entrega.direccion_entrega}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            type="button"
                            onClick={() => mostrarDetalle(entrega)}
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
          <form className="card" onSubmit={guardarEntrega}>
            <div className="card-header bg-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">
                {entregaEditandoId ? "Editar" : "Crear"}
              </p>
              <h3 className="h5 mb-0">
                {entregaEditandoId ? formatearCodigo("ENT", entregaEditandoId) : "Nueva entrega"}
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
                  <label className="form-label" htmlFor="entrega-pedido">Pedido</label>
                  <select
                    className="form-select"
                    id="entrega-pedido"
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
                  <label className="form-label" htmlFor="entrega-programada">Fecha programada</label>
                  <input
                    className="form-control"
                    id="entrega-programada"
                    type="date"
                    value={formulario.fecha_programada}
                    onChange={(evento) => actualizarFormulario("fecha_programada", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="entrega-estado">Estado</label>
                  <select
                    className="form-select"
                    id="entrega-estado"
                    required
                    value={formulario.estado}
                    onChange={(evento) => actualizarFormulario("estado", evento.target.value)}
                  >
                    {estadosEntrega.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mt-0">
                <div className="col-12 col-lg-4">
                  <label className="form-label" htmlFor="entrega-real">Fecha entrega</label>
                  <input
                    className="form-control"
                    id="entrega-real"
                    type="date"
                    value={formulario.fecha_entrega}
                    onChange={(evento) => actualizarFormulario("fecha_entrega", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-8">
                  <label className="form-label" htmlFor="entrega-direccion">Direccion entrega</label>
                  <input
                    className="form-control"
                    id="entrega-direccion"
                    required
                    value={formulario.direccion_entrega}
                    onChange={(evento) => actualizarFormulario("direccion_entrega", evento.target.value)}
                  />
                </div>
              </div>

              <div className="row g-3 mt-0">
                <div className="col-12 col-lg-5">
                  <label className="form-label" htmlFor="entrega-referencia">Referencia direccion</label>
                  <input
                    className="form-control"
                    id="entrega-referencia"
                    value={formulario.referencia_direccion}
                    onChange={(evento) => actualizarFormulario("referencia_direccion", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-7">
                  <label className="form-label" htmlFor="entrega-observacion">Observacion</label>
                  <input
                    className="form-control"
                    id="entrega-observacion"
                    value={formulario.observacion}
                    onChange={(evento) => actualizarFormulario("observacion", evento.target.value)}
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
                <h3 className="h5 mb-0">Detalle de entrega</h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={mostrarLista}>
                  Volver a lista
                </button>
                {entregaSeleccionada ? (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      type="button"
                      onClick={() => editarEntrega(entregaSeleccionada)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      disabled={Boolean(guardandoAccion)}
                      type="button"
                      onClick={eliminarEntrega}
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

              {entregaSeleccionada ? (
                <dl className="row mb-0">
                  <dt className="col-sm-5">Codigo</dt>
                  <dd className="col-sm-7 app-tabular">{formatearCodigo("ENT", entregaSeleccionada.id_entrega)}</dd>
                  <dt className="col-sm-5">Pedido</dt>
                  <dd className="col-sm-7 app-tabular">{formatearCodigo("PED", entregaSeleccionada.pedido_id)}</dd>
                  <dt className="col-sm-5">Sucursal</dt>
                  <dd className="col-sm-7">{entregaSeleccionada.sucursal_nombre}</dd>
                  <dt className="col-sm-5">Cliente</dt>
                  <dd className="col-sm-7">{entregaSeleccionada.cliente_nombre || "Consumidor final"}</dd>
                  <dt className="col-sm-5">Telefono</dt>
                  <dd className="col-sm-7">{entregaSeleccionada.cliente_telefono || "Sin telefono"}</dd>
                  <dt className="col-sm-5">Estado</dt>
                  <dd className="col-sm-7">
                    <span className={`badge ${claseBadgeEntrega(entregaSeleccionada)}`}>
                      {Number(entregaSeleccionada.retrasada || 0) === 1 ? "RETRASADA" : entregaSeleccionada.estado}
                    </span>
                  </dd>
                  <dt className="col-sm-5">Fecha programada</dt>
                  <dd className="col-sm-7 app-tabular">{entregaSeleccionada.fecha_programada || "Sin fecha"}</dd>
                  <dt className="col-sm-5">Fecha entrega</dt>
                  <dd className="col-sm-7 app-tabular">{entregaSeleccionada.fecha_entrega || "Sin fecha"}</dd>
                  <dt className="col-sm-5">Direccion</dt>
                  <dd className="col-sm-7">{entregaSeleccionada.direccion_entrega}</dd>
                  <dt className="col-sm-5">Referencia</dt>
                  <dd className="col-sm-7">{entregaSeleccionada.referencia_direccion || "Sin referencia"}</dd>
                  <dt className="col-sm-5">Observacion</dt>
                  <dd className="col-sm-7">{entregaSeleccionada.observacion || "Sin observacion"}</dd>
                </dl>
              ) : (
                <div className="alert alert-info mb-0" role="status">
                  Selecciona una entrega del listado para consultar su detalle.
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
