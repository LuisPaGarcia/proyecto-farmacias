import { useEffect, useMemo, useState } from "react";

const formularioCajaVacio = {
  sucursal_id: "",
  usuario_id: "",
  pedido_id: "",
  pago_id: "",
  planilla_id: "",
  entrega_id: "",
  tipo: "INGRESO",
  concepto: "VENTA",
  monto: "",
  metodo_pago: "EFECTIVO",
  referencia: "",
  observacion: ""
};

const tiposCaja = ["INGRESO", "EGRESO"];
const conceptosCaja = ["VENTA", "REEMBOLSO", "GASTO", "PLANILLA", "DEPOSITO", "RETIRO", "AJUSTE_CAJA"];
const metodosPago = ["", "EFECTIVO", "TARJETA", "TRANSFERENCIA", "OTRO"];

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

function claseBadgeTipo(tipo) {
  return tipo === "INGRESO" ? "text-bg-success" : "text-bg-warning";
}

async function leerJson(respuesta, mensajeAlterno) {
  const resultado = await respuesta.json();

  if (!respuesta.ok || !resultado.ok) {
    throw new Error(resultado.message || mensajeAlterno);
  }

  return resultado.data || [];
}

export default function VistaCaja() {
  const [vista, setVista] = useState("list");
  const [movimientos, setMovimientos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [flujo, setFlujo] = useState({ movimientos: [], ingresos: 0, egresos: 0, neto: 0 });
  const [filtrosFlujo, setFiltrosFlujo] = useState({ sucursal_id: "", fecha_inicio: "", fecha_fin: "" });
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [movimientoSeleccionadoId, setMovimientoSeleccionadoId] = useState(null);
  const [movimientoEditandoId, setMovimientoEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(formularioCajaVacio);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [erroresFormulario, setErroresFormulario] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");
  const [guardandoAccion, setGuardandoAccion] = useState("");

  const movimientoSeleccionado = useMemo(
    () => movimientos.find((movimiento) => movimiento.id_movimiento_caja === movimientoSeleccionadoId) || null,
    [movimientos, movimientoSeleccionadoId]
  );

  function rutaFlujo(siguientesFiltros = filtrosFlujo) {
    const parametros = new URLSearchParams();
    if (siguientesFiltros.sucursal_id) parametros.set("sucursal_id", siguientesFiltros.sucursal_id);
    if (siguientesFiltros.fecha_inicio) parametros.set("fecha_inicio", siguientesFiltros.fecha_inicio);
    if (siguientesFiltros.fecha_fin) parametros.set("fecha_fin", siguientesFiltros.fecha_fin);
    const query = parametros.toString();
    return query ? `/api/flujo-caja?${query}` : "/api/flujo-caja";
  }

  async function cargarDatos(siguientesFiltros = filtrosFlujo) {
    setCargando(true);
    setErrorCarga("");

    try {
      const [respuestaMovimientos, respuestaSucursales, respuestaFlujo] = await Promise.all([
        fetch("/api/movimientos-caja"),
        fetch("/api/sucursales"),
        fetch(rutaFlujo(siguientesFiltros))
      ]);
      const [datosMovimientos, datosSucursales, datosFlujo] = await Promise.all([
        leerJson(respuestaMovimientos, "No fue posible leer movimientos de caja."),
        leerJson(respuestaSucursales, "No fue posible leer sucursales."),
        leerJson(respuestaFlujo, "No fue posible leer flujo de caja.")
      ]);

      setMovimientos(datosMovimientos);
      setSucursales(datosSucursales);
      setFlujo(datosFlujo);
    } catch (error) {
      setErrorCarga(error.message || "No fue posible leer caja.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function limpiarFormulario() {
    setMovimientoEditandoId(null);
    setFormulario(formularioCajaVacio);
    setErrorFormulario("");
    setErroresFormulario([]);
  }

  function mostrarLista() {
    setVista("list");
    setMovimientoSeleccionadoId(null);
    setErrorAccion("");
    limpiarFormulario();
  }

  function mostrarFormularioNuevo() {
    setMovimientoSeleccionadoId(null);
    setErrorAccion("");
    limpiarFormulario();
    setVista("formulario");
  }

  function mostrarDetalle(movimiento) {
    setMovimientoSeleccionadoId(movimiento.id_movimiento_caja);
    setErrorAccion("");
    limpiarFormulario();
    setVista("detail");
  }

  function cancelarFormulario() {
    const siguienteVista = movimientoEditandoId && movimientoSeleccionado ? "detail" : "list";
    limpiarFormulario();
    setVista(siguienteVista);
  }

  function actualizarFormulario(campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor
    }));
  }

  function actualizarFiltro(campo, valor) {
    const siguientesFiltros = {
      ...filtrosFlujo,
      [campo]: valor
    };
    setFiltrosFlujo(siguientesFiltros);
    cargarDatos(siguientesFiltros);
  }

  function limpiarFiltros() {
    const siguientesFiltros = { sucursal_id: "", fecha_inicio: "", fecha_fin: "" };
    setFiltrosFlujo(siguientesFiltros);
    cargarDatos(siguientesFiltros);
  }

  function editarMovimiento(movimiento) {
    setMovimientoEditandoId(movimiento.id_movimiento_caja);
    setMovimientoSeleccionadoId(movimiento.id_movimiento_caja);
    setFormulario({
      sucursal_id: movimiento.sucursal_id || "",
      usuario_id: movimiento.usuario_id || "",
      pedido_id: movimiento.pedido_id || "",
      pago_id: movimiento.pago_id || "",
      planilla_id: movimiento.planilla_id || "",
      entrega_id: movimiento.entrega_id || "",
      tipo: movimiento.tipo || "INGRESO",
      concepto: movimiento.concepto || "VENTA",
      monto: String(movimiento.monto || ""),
      metodo_pago: movimiento.metodo_pago || "",
      referencia: movimiento.referencia || "",
      observacion: movimiento.observacion || ""
    });
    setErrorAccion("");
    setErrorFormulario("");
    setErroresFormulario([]);
    setVista("formulario");
  }

  async function guardarMovimiento(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario("");
    setErroresFormulario([]);

    const url = movimientoEditandoId ? `/api/movimientos-caja/${movimientoEditandoId}` : "/api/movimientos-caja";
    const metodo = movimientoEditandoId ? "PUT" : "POST";

    try {
      const respuesta = await fetch(url, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formulario)
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorFormulario(resultado.message || "No fue posible guardar el movimiento.");
        setErroresFormulario(resultado.errors || []);
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorFormulario(error.message || "No fue posible guardar el movimiento.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarMovimiento() {
    if (!movimientoSeleccionado) return;

    const confirmado = window.confirm(
      `Eliminar ${formatearCodigo("CAJ", movimientoSeleccionado.id_movimiento_caja)}? Esta accion no se puede deshacer.`
    );
    if (!confirmado) return;

    setGuardandoAccion("delete");
    setErrorAccion("");

    try {
      const respuesta = await fetch(`/api/movimientos-caja/${movimientoSeleccionado.id_movimiento_caja}`, {
        method: "DELETE"
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorAccion(resultado.message || "No fue posible eliminar el movimiento.");
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorAccion(error.message || "No fue posible eliminar el movimiento.");
    } finally {
      setGuardandoAccion("");
    }
  }

  return (
    <section id="caja">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-017 / Orden 38</p>
          <h2 className="display-6 fw-semibold mb-1">Caja</h2>
          <p className="text-secondary mb-0">Movimientos de efectivo y flujo por sucursal y periodo.</p>
        </div>
        <button className="btn btn-success align-self-start" type="button" onClick={mostrarFormularioNuevo}>
          Nuevo movimiento
        </button>
      </header>

      <div className={`row g-3 mb-3 ${vista === "list" ? "" : "d-none"}`}>
        <div className="col-12 col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">Ingresos</p>
              <p className="h4 mb-0 app-tabular">{formatearMoneda(flujo.ingresos)}</p>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <p className="small text-uppercase fw-semibold text-warning mb-1">Egresos</p>
              <p className="h4 mb-0 app-tabular">{formatearMoneda(flujo.egresos)}</p>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">Neto</p>
              <p className="h4 mb-0 app-tabular">{formatearMoneda(flujo.neto)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className={`col-12 ${vista === "list" ? "" : "d-none"}`}>
          <div className="card h-100">
            <div className="card-header bg-body">
              <div className="d-flex flex-column flex-xl-row justify-content-between gap-3">
                <div>
                  <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                  <h3 className="h5 mb-0">Movimientos de caja</h3>
                </div>
                {cargando ? (
                  <span className="spinner-border spinner-border-sm text-success align-self-start" role="status">
                    <span className="visually-hidden">Cargando caja</span>
                  </span>
                ) : null}
              </div>
              <div className="row g-2 mt-2">
                <div className="col-12 col-lg-4">
                  <select
                    className="form-select form-select-sm"
                    value={filtrosFlujo.sucursal_id}
                    onChange={(evento) => actualizarFiltro("sucursal_id", evento.target.value)}
                  >
                    <option value="">Todas las sucursales</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                        {formatearCodigo("SUC", sucursal.id_sucursal)} - {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-4 col-lg-3">
                  <input
                    className="form-control form-control-sm"
                    type="date"
                    value={filtrosFlujo.fecha_inicio}
                    onChange={(evento) => actualizarFiltro("fecha_inicio", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-md-4 col-lg-3">
                  <input
                    className="form-control form-control-sm"
                    type="date"
                    value={filtrosFlujo.fecha_fin}
                    onChange={(evento) => actualizarFiltro("fecha_fin", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-md-4 col-lg-2 d-grid">
                  <button className="btn btn-outline-secondary btn-sm" type="button" onClick={limpiarFiltros}>
                    Limpiar
                  </button>
                </div>
              </div>
            </div>

            {errorCarga ? (
              <div className="alert alert-warning m-3" role="alert">
                {errorCarga}
              </div>
            ) : null}

            {!cargando && movimientos.length === 0 && !errorCarga ? (
              <div className="card-body">
                <div className="alert alert-info mb-0" role="status">
                  No hay movimientos de caja registrados.
                </div>
              </div>
            ) : null}

            {movimientos.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Codigo</th>
                      <th scope="col">Fecha</th>
                      <th scope="col">Sucursal</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Concepto</th>
                      <th scope="col">Metodo</th>
                      <th className="text-end" scope="col">Monto</th>
                      <th className="text-end" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((movimiento) => (
                      <tr key={movimiento.id_movimiento_caja}>
                        <td className="app-tabular">{formatearCodigo("CAJ", movimiento.id_movimiento_caja)}</td>
                        <td className="app-tabular">{movimiento.fecha_hora}</td>
                        <td>{movimiento.sucursal_nombre}</td>
                        <td>
                          <span className={`badge ${claseBadgeTipo(movimiento.tipo)}`}>{movimiento.tipo}</span>
                        </td>
                        <td>{movimiento.concepto}</td>
                        <td>{movimiento.metodo_pago || "Sin metodo"}</td>
                        <td className="text-end app-tabular">{formatearMoneda(movimiento.monto)}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            type="button"
                            onClick={() => mostrarDetalle(movimiento)}
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
          <form className="card" onSubmit={guardarMovimiento}>
            <div className="card-header bg-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">
                {movimientoEditandoId ? "Editar" : "Crear"}
              </p>
              <h3 className="h5 mb-0">
                {movimientoEditandoId ? formatearCodigo("CAJ", movimientoEditandoId) : "Nuevo movimiento"}
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
                <div className="col-12 col-lg-4">
                  <label className="form-label" htmlFor="caja-sucursal">Sucursal</label>
                  <select
                    className="form-select"
                    id="caja-sucursal"
                    required
                    value={formulario.sucursal_id}
                    onChange={(evento) => actualizarFormulario("sucursal_id", evento.target.value)}
                  >
                    <option value="">Selecciona sucursal</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                        {formatearCodigo("SUC", sucursal.id_sucursal)} - {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-lg-2">
                  <label className="form-label" htmlFor="caja-tipo">Tipo</label>
                  <select
                    className="form-select"
                    id="caja-tipo"
                    required
                    value={formulario.tipo}
                    onChange={(evento) => actualizarFormulario("tipo", evento.target.value)}
                  >
                    {tiposCaja.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="caja-concepto">Concepto</label>
                  <select
                    className="form-select"
                    id="caja-concepto"
                    required
                    value={formulario.concepto}
                    onChange={(evento) => actualizarFormulario("concepto", evento.target.value)}
                  >
                    {conceptosCaja.map((concepto) => (
                      <option key={concepto} value={concepto}>{concepto}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="caja-monto">Monto</label>
                  <input
                    className="form-control text-end"
                    id="caja-monto"
                    min="0.01"
                    required
                    step="0.01"
                    type="number"
                    value={formulario.monto}
                    onChange={(evento) => actualizarFormulario("monto", evento.target.value)}
                  />
                </div>
              </div>

              <div className="row g-3 mt-0">
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="caja-metodo">Metodo pago</label>
                  <select
                    className="form-select"
                    id="caja-metodo"
                    value={formulario.metodo_pago}
                    onChange={(evento) => actualizarFormulario("metodo_pago", evento.target.value)}
                  >
                    {metodosPago.map((metodo) => (
                      <option key={metodo || "sin-metodo"} value={metodo}>
                        {metodo || "Sin metodo"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="caja-referencia">Referencia</label>
                  <input
                    className="form-control"
                    id="caja-referencia"
                    value={formulario.referencia}
                    onChange={(evento) => actualizarFormulario("referencia", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-6">
                  <label className="form-label" htmlFor="caja-observacion">Observacion</label>
                  <input
                    className="form-control"
                    id="caja-observacion"
                    value={formulario.observacion}
                    onChange={(evento) => actualizarFormulario("observacion", evento.target.value)}
                  />
                </div>
              </div>

              <div className="row g-3 mt-0">
                {["usuario_id", "pedido_id", "pago_id", "planilla_id", "entrega_id"].map((campo) => (
                  <div className="col-12 col-md" key={campo}>
                    <label className="form-label" htmlFor={`caja-${campo}`}>{campo}</label>
                    <input
                      className="form-control text-end"
                      id={`caja-${campo}`}
                      min="1"
                      step="1"
                      type="number"
                      value={formulario[campo]}
                      onChange={(evento) => actualizarFormulario(campo, evento.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="card-footer bg-body d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary" type="button" onClick={cancelarFormulario}>
                Cancelar
              </button>
              <button className="btn btn-success" type="submit" disabled={guardando}>
                {guardando ? "Guardando" : "Guardar"}
              </button>
            </div>
          </form>
        </div>

        <div className={`col-12 ${vista === "detail" ? "" : "d-none"}`}>
          <article className="card">
            <div className="card-header bg-body d-flex flex-column flex-lg-row justify-content-between gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Consulta</p>
                <h3 className="h5 mb-0">Detalle de movimiento</h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={mostrarLista}>
                  Volver a lista
                </button>
                {movimientoSeleccionado ? (
                  <>
                    <button className="btn btn-success btn-sm" type="button" onClick={() => editarMovimiento(movimientoSeleccionado)}>
                      Editar
                    </button>
                    <button className="btn btn-outline-danger btn-sm" disabled={Boolean(guardandoAccion)} type="button" onClick={eliminarMovimiento}>
                      {guardandoAccion === "delete" ? "Eliminando" : "Eliminar"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="card-body">
              {errorAccion ? <div className="alert alert-danger" role="alert">{errorAccion}</div> : null}
              {movimientoSeleccionado ? (
                <dl className="row mb-0">
                  <dt className="col-sm-5">Codigo</dt>
                  <dd className="col-sm-7 app-tabular">{formatearCodigo("CAJ", movimientoSeleccionado.id_movimiento_caja)}</dd>
                  <dt className="col-sm-5">Sucursal</dt>
                  <dd className="col-sm-7">{movimientoSeleccionado.sucursal_nombre}</dd>
                  <dt className="col-sm-5">Tipo</dt>
                  <dd className="col-sm-7"><span className={`badge ${claseBadgeTipo(movimientoSeleccionado.tipo)}`}>{movimientoSeleccionado.tipo}</span></dd>
                  <dt className="col-sm-5">Concepto</dt>
                  <dd className="col-sm-7">{movimientoSeleccionado.concepto}</dd>
                  <dt className="col-sm-5">Monto</dt>
                  <dd className="col-sm-7 app-tabular">{formatearMoneda(movimientoSeleccionado.monto)}</dd>
                  <dt className="col-sm-5">Metodo</dt>
                  <dd className="col-sm-7">{movimientoSeleccionado.metodo_pago || "Sin metodo"}</dd>
                  <dt className="col-sm-5">Referencia</dt>
                  <dd className="col-sm-7">{movimientoSeleccionado.referencia || "Sin referencia"}</dd>
                  <dt className="col-sm-5">Observacion</dt>
                  <dd className="col-sm-7">{movimientoSeleccionado.observacion || "Sin observacion"}</dd>
                  <dt className="col-sm-5">Fecha</dt>
                  <dd className="col-sm-7 app-tabular">{movimientoSeleccionado.fecha_hora}</dd>
                </dl>
              ) : (
                <div className="alert alert-info mb-0" role="status">Selecciona un movimiento para consultar su detalle.</div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
