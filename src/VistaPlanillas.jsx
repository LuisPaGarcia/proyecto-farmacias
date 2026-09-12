import { useEffect, useMemo, useState } from "react";

const detallePlanillaVacio = {
  empleado_id: "",
  concepto: "SALARIO",
  monto: "0"
};

const formularioPlanillaVacio = {
  sucursal_id: "",
  periodo_inicio: "",
  periodo_fin: "",
  fecha_pago: "",
  estado: "ABIERTA",
  detalles: [{ ...detallePlanillaVacio }]
};

const estadosPlanilla = ["ABIERTA", "APROBADA", "PAGADA", "ANULADA"];

function crearFormularioVacio() {
  return {
    ...formularioPlanillaVacio,
    detalles: [{ ...detallePlanillaVacio }]
  };
}

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

function claseBadgePlanilla(estado) {
  if (estado === "PAGADA") return "text-bg-success";
  if (["ABIERTA", "APROBADA"].includes(estado)) return "text-bg-warning";
  return "text-bg-secondary";
}

function etiquetaEmpleado(empleado) {
  return `${formatearCodigo("EMP", empleado.id_empleado)} - ${empleado.nombre} (${empleado.cargo})`;
}

async function leerJson(respuesta, mensajeAlterno) {
  const resultado = await respuesta.json();

  if (!respuesta.ok || !resultado.ok) {
    throw new Error(resultado.message || mensajeAlterno);
  }

  return resultado.data || [];
}

export default function VistaPlanillas() {
  const [vista, setVista] = useState("list");
  const [planillas, setPlanillas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [planillaSeleccionada, setPlanillaSeleccionada] = useState(null);
  const [planillaEditandoId, setPlanillaEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(crearFormularioVacio);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [erroresFormulario, setErroresFormulario] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");
  const [guardandoAccion, setGuardandoAccion] = useState("");

  const totalFormulario = useMemo(
    () => formulario.detalles.reduce((total, detalle) => total + Number(detalle.monto || 0), 0),
    [formulario.detalles]
  );

  async function cargarDatos() {
    setCargando(true);
    setErrorCarga("");

    try {
      const [respuestaPlanillas, respuestaSucursales, respuestaEmpleados] = await Promise.all([
        fetch("/api/planillas"),
        fetch("/api/sucursales"),
        fetch("/api/empleados")
      ]);
      const [datosPlanillas, datosSucursales, datosEmpleados] = await Promise.all([
        leerJson(respuestaPlanillas, "No fue posible leer planillas."),
        leerJson(respuestaSucursales, "No fue posible leer sucursales."),
        leerJson(respuestaEmpleados, "No fue posible leer empleados.")
      ]);

      setPlanillas(datosPlanillas);
      setSucursales(datosSucursales);
      setEmpleados(datosEmpleados);
    } catch (error) {
      setPlanillas([]);
      setPlanillaSeleccionada(null);
      setErrorCarga(error.message || "No fue posible leer planillas.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function limpiarFormulario() {
    setPlanillaEditandoId(null);
    setFormulario(crearFormularioVacio());
    setErrorFormulario("");
    setErroresFormulario([]);
  }

  function mostrarLista() {
    setVista("list");
    setPlanillaSeleccionada(null);
    setErrorAccion("");
    limpiarFormulario();
  }

  function mostrarFormularioNuevo() {
    setPlanillaSeleccionada(null);
    setErrorAccion("");
    limpiarFormulario();
    setVista("formulario");
  }

  async function mostrarDetalle(planilla) {
    setPlanillaSeleccionada(planilla);
    setErrorAccion("");
    limpiarFormulario();
    setVista("detail");
    setCargandoDetalle(true);

    try {
      const respuesta = await fetch(`/api/planillas/${planilla.id_planilla}`);
      const datos = await leerJson(respuesta, "No fue posible consultar la planilla.");
      setPlanillaSeleccionada(datos);
    } catch (error) {
      setErrorAccion(error.message || "No fue posible consultar la planilla.");
    } finally {
      setCargandoDetalle(false);
    }
  }

  function cancelarFormulario() {
    const siguienteVista = planillaEditandoId && planillaSeleccionada ? "detail" : "list";
    limpiarFormulario();
    setVista(siguienteVista);
  }

  function actualizarFormulario(campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
      detalles: campo === "sucursal_id" ? [{ ...detallePlanillaVacio }] : actual.detalles
    }));
  }

  function actualizarDetalle(indice, campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      detalles: actual.detalles.map((detalle, indiceDetalle) =>
        indiceDetalle === indice ? { ...detalle, [campo]: valor } : detalle
      )
    }));
  }

  function agregarDetalle() {
    setFormulario((actual) => ({
      ...actual,
      detalles: [...actual.detalles, { ...detallePlanillaVacio }]
    }));
  }

  function quitarDetalle(indice) {
    setFormulario((actual) => ({
      ...actual,
      detalles: actual.detalles.length === 1
        ? actual.detalles
        : actual.detalles.filter((detalle, indiceDetalle) => indiceDetalle !== indice)
    }));
  }

  function empleadosFormulario() {
    return formulario.sucursal_id
      ? empleados.filter((empleado) => String(empleado.sucursal_id) === String(formulario.sucursal_id))
      : empleados;
  }

  function editarPlanilla(planilla) {
    setPlanillaEditandoId(planilla.id_planilla);
    setPlanillaSeleccionada(planilla);
    setFormulario({
      sucursal_id: planilla.sucursal_id || "",
      periodo_inicio: planilla.periodo_inicio || "",
      periodo_fin: planilla.periodo_fin || "",
      fecha_pago: planilla.fecha_pago || "",
      estado: planilla.estado || "ABIERTA",
      detalles: planilla.detalles?.length > 0
        ? planilla.detalles.map((detalle) => ({
            empleado_id: detalle.empleado_id || "",
            concepto: detalle.concepto || "SALARIO",
            monto: String(detalle.monto || 0)
          }))
        : [{ ...detallePlanillaVacio }]
    });
    setErrorAccion("");
    setErrorFormulario("");
    setErroresFormulario([]);
    setVista("formulario");
  }

  async function guardarPlanilla(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario("");
    setErroresFormulario([]);

    const url = planillaEditandoId ? `/api/planillas/${planillaEditandoId}` : "/api/planillas";
    const metodo = planillaEditandoId ? "PUT" : "POST";

    try {
      const respuesta = await fetch(url, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formulario)
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorFormulario(resultado.message || "No fue posible guardar la planilla.");
        setErroresFormulario(resultado.errors || []);
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorFormulario(error.message || "No fue posible guardar la planilla.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarPlanilla() {
    if (!planillaSeleccionada) return;

    const confirmado = window.confirm(
      `Eliminar ${formatearCodigo("PLA", planillaSeleccionada.id_planilla)}? Esta accion no se puede deshacer.`
    );
    if (!confirmado) return;

    setGuardandoAccion("delete");
    setErrorAccion("");

    try {
      const respuesta = await fetch(`/api/planillas/${planillaSeleccionada.id_planilla}`, {
        method: "DELETE"
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorAccion(resultado.message || "No fue posible eliminar la planilla.");
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorAccion(error.message || "No fue posible eliminar la planilla.");
    } finally {
      setGuardandoAccion("");
    }
  }

  return (
    <section id="planillas">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-019 / Orden 43</p>
          <h2 className="display-6 fw-semibold mb-1">Planilla</h2>
          <p className="text-secondary mb-0">Periodos de pago, aprobacion y detalle por empleado.</p>
        </div>
        <button className="btn btn-success align-self-start" type="button" onClick={mostrarFormularioNuevo}>
          Nueva planilla
        </button>
      </header>

      <div className="row g-3">
        <div className={`col-12 ${vista === "list" ? "" : "d-none"}`}>
          <div className="card h-100">
            <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                <h3 className="h5 mb-0">Planillas registradas</h3>
              </div>
              {cargando ? (
                <span className="spinner-border spinner-border-sm text-success" role="status">
                  <span className="visually-hidden">Cargando planillas</span>
                </span>
              ) : null}
            </div>

            {errorCarga ? <div className="alert alert-warning m-3" role="alert">{errorCarga}</div> : null}

            {!cargando && planillas.length === 0 && !errorCarga ? (
              <div className="card-body">
                <div className="alert alert-info mb-0" role="status">No hay planillas registradas.</div>
              </div>
            ) : null}

            {planillas.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Codigo</th>
                      <th scope="col">Sucursal</th>
                      <th scope="col">Periodo</th>
                      <th scope="col">Pago</th>
                      <th scope="col">Estado</th>
                      <th className="text-end" scope="col">Detalles</th>
                      <th className="text-end" scope="col">Total</th>
                      <th className="text-end" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planillas.map((planilla) => (
                      <tr key={planilla.id_planilla}>
                        <td className="app-tabular">{formatearCodigo("PLA", planilla.id_planilla)}</td>
                        <td>{planilla.sucursal_nombre}</td>
                        <td className="app-tabular">{planilla.periodo_inicio} / {planilla.periodo_fin}</td>
                        <td className="app-tabular">{planilla.fecha_pago || "Sin fecha"}</td>
                        <td><span className={`badge ${claseBadgePlanilla(planilla.estado)}`}>{planilla.estado}</span></td>
                        <td className="text-end app-tabular">{Number(planilla.total_detalles || 0)}</td>
                        <td className="text-end app-tabular">{formatearMoneda(planilla.total)}</td>
                        <td className="text-end">
                          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => mostrarDetalle(planilla)}>
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
          <form className="card" onSubmit={guardarPlanilla}>
            <div className="card-header bg-body d-flex flex-column flex-lg-row justify-content-between gap-2">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">{planillaEditandoId ? "Editar" : "Crear"}</p>
                <h3 className="h5 mb-0">{planillaEditandoId ? formatearCodigo("PLA", planillaEditandoId) : "Nueva planilla"}</h3>
              </div>
              <p className="h5 mb-0 app-tabular align-self-lg-center">{formatearMoneda(totalFormulario)}</p>
            </div>
            <div className="card-body">
              {errorFormulario ? (
                <div className="alert alert-danger" role="alert">
                  <strong className="d-block">{errorFormulario}</strong>
                  {erroresFormulario.length > 0 ? (
                    <ul className="mb-0 mt-2">
                      {erroresFormulario.map((error) => <li key={error}>{error}</li>)}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className="row g-3">
                <div className="col-12 col-lg-4">
                  <label className="form-label" htmlFor="planilla-sucursal">Sucursal</label>
                  <select
                    className="form-select"
                    id="planilla-sucursal"
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
                <div className="col-12 col-md-4 col-lg-2">
                  <label className="form-label" htmlFor="planilla-inicio">Inicio</label>
                  <input
                    className="form-control"
                    id="planilla-inicio"
                    required
                    type="date"
                    value={formulario.periodo_inicio}
                    onChange={(evento) => actualizarFormulario("periodo_inicio", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-md-4 col-lg-2">
                  <label className="form-label" htmlFor="planilla-fin">Fin</label>
                  <input
                    className="form-control"
                    id="planilla-fin"
                    required
                    type="date"
                    value={formulario.periodo_fin}
                    onChange={(evento) => actualizarFormulario("periodo_fin", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-md-4 col-lg-2">
                  <label className="form-label" htmlFor="planilla-pago">Fecha pago</label>
                  <input
                    className="form-control"
                    id="planilla-pago"
                    type="date"
                    value={formulario.fecha_pago}
                    onChange={(evento) => actualizarFormulario("fecha_pago", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-2">
                  <label className="form-label" htmlFor="planilla-estado">Estado</label>
                  <select
                    className="form-select"
                    id="planilla-estado"
                    required
                    value={formulario.estado}
                    onChange={(evento) => actualizarFormulario("estado", evento.target.value)}
                  >
                    {estadosPlanilla.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
                </div>
              </div>

              <div className="border rounded-2 mt-4">
                <div className="d-flex justify-content-between align-items-center gap-3 p-3 border-bottom">
                  <div>
                    <p className="small text-uppercase fw-semibold text-success mb-1">Detalle</p>
                    <h4 className="h6 mb-0">Pagos por empleado</h4>
                  </div>
                  <button className="btn btn-outline-success btn-sm" type="button" onClick={agregarDetalle}>
                    Agregar detalle
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">Empleado</th>
                        <th scope="col">Concepto</th>
                        <th className="text-end" scope="col">Monto</th>
                        <th className="text-end" scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formulario.detalles.map((detalle, indice) => (
                        <tr key={`${indice}-${detalle.empleado_id}`}>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              required
                              value={detalle.empleado_id}
                              onChange={(evento) => actualizarDetalle(indice, "empleado_id", evento.target.value)}
                            >
                              <option value="">Selecciona empleado</option>
                              {empleadosFormulario().map((empleado) => (
                                <option key={empleado.id_empleado} value={empleado.id_empleado}>
                                  {etiquetaEmpleado(empleado)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm"
                              required
                              value={detalle.concepto}
                              onChange={(evento) => actualizarDetalle(indice, "concepto", evento.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm text-end"
                              min="0"
                              required
                              step="0.01"
                              type="number"
                              value={detalle.monto}
                              onChange={(evento) => actualizarDetalle(indice, "monto", evento.target.value)}
                            />
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-outline-danger btn-sm"
                              disabled={formulario.detalles.length === 1}
                              type="button"
                              onClick={() => quitarDetalle(indice)}
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
              <button className="btn btn-outline-secondary" type="button" onClick={cancelarFormulario}>Cancelar</button>
              <button className="btn btn-success" type="submit" disabled={guardando}>{guardando ? "Guardando" : "Guardar"}</button>
            </div>
          </form>
        </div>

        <div className={`col-12 ${vista === "detail" ? "" : "d-none"}`}>
          <article className="card">
            <div className="card-header bg-body d-flex flex-column flex-lg-row justify-content-between gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Consulta</p>
                <h3 className="h5 mb-0">Detalle de planilla</h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={mostrarLista}>Volver a lista</button>
                {planillaSeleccionada ? (
                  <>
                    <button className="btn btn-success btn-sm" disabled={cargandoDetalle} type="button" onClick={() => editarPlanilla(planillaSeleccionada)}>
                      Editar
                    </button>
                    <button className="btn btn-outline-danger btn-sm" disabled={Boolean(guardandoAccion)} type="button" onClick={eliminarPlanilla}>
                      {guardandoAccion === "delete" ? "Eliminando" : "Eliminar"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="card-body">
              {errorAccion ? <div className="alert alert-danger" role="alert">{errorAccion}</div> : null}
              {cargandoDetalle ? <div className="alert alert-info" role="status">Cargando detalle de planilla.</div> : null}
              {planillaSeleccionada ? (
                <>
                  <dl className="row mb-4">
                    <dt className="col-sm-5">Codigo</dt>
                    <dd className="col-sm-7 app-tabular">{formatearCodigo("PLA", planillaSeleccionada.id_planilla)}</dd>
                    <dt className="col-sm-5">Sucursal</dt>
                    <dd className="col-sm-7">{planillaSeleccionada.sucursal_nombre}</dd>
                    <dt className="col-sm-5">Periodo</dt>
                    <dd className="col-sm-7 app-tabular">{planillaSeleccionada.periodo_inicio} / {planillaSeleccionada.periodo_fin}</dd>
                    <dt className="col-sm-5">Fecha pago</dt>
                    <dd className="col-sm-7 app-tabular">{planillaSeleccionada.fecha_pago || "Sin fecha"}</dd>
                    <dt className="col-sm-5">Estado</dt>
                    <dd className="col-sm-7"><span className={`badge ${claseBadgePlanilla(planillaSeleccionada.estado)}`}>{planillaSeleccionada.estado}</span></dd>
                    <dt className="col-sm-5">Total</dt>
                    <dd className="col-sm-7 app-tabular">{formatearMoneda(planillaSeleccionada.total)}</dd>
                  </dl>

                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th scope="col">Empleado</th>
                          <th scope="col">Cargo</th>
                          <th scope="col">Concepto</th>
                          <th className="text-end" scope="col">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(planillaSeleccionada.detalles || []).map((detalle) => (
                          <tr key={detalle.id_detalle_planilla}>
                            <td>{detalle.empleado_nombre}</td>
                            <td>{detalle.empleado_cargo}</td>
                            <td>{detalle.concepto}</td>
                            <td className="text-end app-tabular">{formatearMoneda(detalle.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="alert alert-info mb-0" role="status">Selecciona una planilla para consultar su detalle.</div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
