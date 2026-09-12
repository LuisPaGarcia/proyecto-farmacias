import { useEffect, useMemo, useState } from "react";

const formularioActivoVacio = {
  sucursal_id: "",
  descripcion: "",
  fecha_adquisicion: "",
  valor_adquisicion: "",
  estado: "ACTIVO"
};

const formularioEventoVacio = {
  tipo_evento: "MANTENIMIENTO",
  valor: "0",
  observacion: ""
};

const estadosActivo = ["ACTIVO", "EN_MANTENIMIENTO", "TRASLADADO", "BAJA"];
const tiposEvento = ["COMPRA", "DEPRECIACION", "MANTENIMIENTO", "REPARACION", "TRASLADO", "BAJA", "OTRO"];

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

function claseBadgeActivo(estado) {
  if (estado === "ACTIVO") return "text-bg-success";
  if (estado === "EN_MANTENIMIENTO") return "text-bg-warning";
  if (estado === "BAJA") return "text-bg-secondary";
  return "text-bg-info";
}

async function leerJson(respuesta, mensajeAlterno) {
  const resultado = await respuesta.json();

  if (!respuesta.ok || !resultado.ok) {
    throw new Error(resultado.message || mensajeAlterno);
  }

  return resultado.data || [];
}

export default function VistaActivosFijos() {
  const [vista, setVista] = useState("list");
  const [activos, setActivos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [valorActivos, setValorActivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [activoSeleccionado, setActivoSeleccionado] = useState(null);
  const [activoEditandoId, setActivoEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(formularioActivoVacio);
  const [formularioEvento, setFormularioEvento] = useState(formularioEventoVacio);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [erroresFormulario, setErroresFormulario] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");
  const [guardandoAccion, setGuardandoAccion] = useState("");

  const totalValor = useMemo(
    () => valorActivos.reduce((total, fila) => total + Number(fila.valor_adquisicion_total || 0), 0),
    [valorActivos]
  );

  async function cargarDatos() {
    setCargando(true);
    setErrorCarga("");

    try {
      const [respuestaActivos, respuestaSucursales, respuestaValor] = await Promise.all([
        fetch("/api/activos-fijos"),
        fetch("/api/sucursales"),
        fetch("/api/valor-activos")
      ]);
      const [datosActivos, datosSucursales, datosValor] = await Promise.all([
        leerJson(respuestaActivos, "No fue posible leer activos fijos."),
        leerJson(respuestaSucursales, "No fue posible leer sucursales."),
        leerJson(respuestaValor, "No fue posible leer valor de activos.")
      ]);

      setActivos(datosActivos);
      setSucursales(datosSucursales);
      setValorActivos(datosValor);
    } catch (error) {
      setActivos([]);
      setActivoSeleccionado(null);
      setErrorCarga(error.message || "No fue posible leer activos fijos.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function limpiarFormulario() {
    setActivoEditandoId(null);
    setFormulario(formularioActivoVacio);
    setErrorFormulario("");
    setErroresFormulario([]);
  }

  function mostrarLista() {
    setVista("list");
    setActivoSeleccionado(null);
    setErrorAccion("");
    setFormularioEvento(formularioEventoVacio);
    limpiarFormulario();
  }

  function mostrarFormularioNuevo() {
    setActivoSeleccionado(null);
    setErrorAccion("");
    limpiarFormulario();
    setVista("formulario");
  }

  async function mostrarDetalle(activo) {
    setActivoSeleccionado(activo);
    setErrorAccion("");
    limpiarFormulario();
    setVista("detail");
    setCargandoDetalle(true);

    try {
      const respuesta = await fetch(`/api/activos-fijos/${activo.id_activo_fijo}`);
      const datos = await leerJson(respuesta, "No fue posible consultar el activo fijo.");
      setActivoSeleccionado(datos);
    } catch (error) {
      setErrorAccion(error.message || "No fue posible consultar el activo fijo.");
    } finally {
      setCargandoDetalle(false);
    }
  }

  function cancelarFormulario() {
    const siguienteVista = activoEditandoId && activoSeleccionado ? "detail" : "list";
    limpiarFormulario();
    setVista(siguienteVista);
  }

  function actualizarFormulario(campo, valor) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  function actualizarFormularioEvento(campo, valor) {
    setFormularioEvento((actual) => ({ ...actual, [campo]: valor }));
  }

  function editarActivo(activo) {
    setActivoEditandoId(activo.id_activo_fijo);
    setActivoSeleccionado(activo);
    setFormulario({
      sucursal_id: activo.sucursal_id || "",
      descripcion: activo.descripcion || "",
      fecha_adquisicion: activo.fecha_adquisicion || "",
      valor_adquisicion: String(activo.valor_adquisicion || ""),
      estado: activo.estado || "ACTIVO"
    });
    setErrorAccion("");
    setErrorFormulario("");
    setErroresFormulario([]);
    setVista("formulario");
  }

  async function guardarActivo(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario("");
    setErroresFormulario([]);

    const url = activoEditandoId ? `/api/activos-fijos/${activoEditandoId}` : "/api/activos-fijos";
    const metodo = activoEditandoId ? "PUT" : "POST";

    try {
      const respuesta = await fetch(url, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formulario)
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorFormulario(resultado.message || "No fue posible guardar el activo fijo.");
        setErroresFormulario(resultado.errors || []);
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorFormulario(error.message || "No fue posible guardar el activo fijo.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEvento(evento) {
    evento.preventDefault();
    if (!activoSeleccionado) return;

    setGuardandoAccion("evento");
    setErrorAccion("");

    try {
      const respuesta = await fetch("/api/eventos-activo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...formularioEvento, activo_fijo_id: activoSeleccionado.id_activo_fijo })
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorAccion(resultado.message || "No fue posible agregar el evento.");
        return;
      }

      setFormularioEvento(formularioEventoVacio);
      await mostrarDetalle(activoSeleccionado);
    } catch (error) {
      setErrorAccion(error.message || "No fue posible agregar el evento.");
    } finally {
      setGuardandoAccion("");
    }
  }

  async function eliminarActivo() {
    if (!activoSeleccionado) return;

    const confirmado = window.confirm(
      `Eliminar ${activoSeleccionado.codigo_interno}? Esta accion no se puede deshacer.`
    );
    if (!confirmado) return;

    setGuardandoAccion("delete");
    setErrorAccion("");

    try {
      const respuesta = await fetch(`/api/activos-fijos/${activoSeleccionado.id_activo_fijo}`, {
        method: "DELETE"
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorAccion(resultado.message || "No fue posible eliminar el activo fijo.");
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorAccion(error.message || "No fue posible eliminar el activo fijo.");
    } finally {
      setGuardandoAccion("");
    }
  }

  return (
    <section id="activos-fijos">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-020 / Orden 46</p>
          <h2 className="display-6 fw-semibold mb-1">Activos fijos</h2>
          <p className="text-secondary mb-0">Activos por sucursal, valor de adquisicion y eventos operativos.</p>
        </div>
        <button className="btn btn-success align-self-start" type="button" onClick={mostrarFormularioNuevo}>
          Nuevo activo
        </button>
      </header>

      <div className={`row g-3 mb-3 ${vista === "list" ? "" : "d-none"}`}>
        <div className="col-12 col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">Valor total</p>
              <p className="h4 mb-0 app-tabular">{formatearMoneda(totalValor)}</p>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">Activos vigentes</p>
              <p className="h4 mb-0 app-tabular">{activos.filter((activo) => activo.estado !== "BAJA").length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className={`col-12 ${vista === "list" ? "" : "d-none"}`}>
          <div className="card h-100">
            <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                <h3 className="h5 mb-0">Activos registrados</h3>
              </div>
              {cargando ? (
                <span className="spinner-border spinner-border-sm text-success" role="status">
                  <span className="visually-hidden">Cargando activos</span>
                </span>
              ) : null}
            </div>

            {errorCarga ? <div className="alert alert-warning m-3" role="alert">{errorCarga}</div> : null}

            {!cargando && activos.length === 0 && !errorCarga ? (
              <div className="card-body">
                <div className="alert alert-info mb-0" role="status">No hay activos fijos registrados.</div>
              </div>
            ) : null}

            {activos.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Codigo</th>
                      <th scope="col">Descripcion</th>
                      <th scope="col">Sucursal</th>
                      <th scope="col">Adquisicion</th>
                      <th scope="col">Estado</th>
                      <th className="text-end" scope="col">Valor</th>
                      <th className="text-end" scope="col">Eventos</th>
                      <th className="text-end" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activos.map((activo) => (
                      <tr key={activo.id_activo_fijo}>
                        <td className="app-tabular">{activo.codigo_interno}</td>
                        <td>{activo.descripcion}</td>
                        <td>{activo.sucursal_nombre}</td>
                        <td className="app-tabular">{activo.fecha_adquisicion}</td>
                        <td><span className={`badge ${claseBadgeActivo(activo.estado)}`}>{activo.estado}</span></td>
                        <td className="text-end app-tabular">{formatearMoneda(activo.valor_adquisicion)}</td>
                        <td className="text-end app-tabular">{Number(activo.total_eventos || 0)}</td>
                        <td className="text-end">
                          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => mostrarDetalle(activo)}>
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
          <form className="card" onSubmit={guardarActivo}>
            <div className="card-header bg-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">{activoEditandoId ? "Editar" : "Crear"}</p>
              <h3 className="h5 mb-0">{activoEditandoId ? activoSeleccionado?.codigo_interno : "Nuevo activo"}</h3>
            </div>
            <div className="card-body">
              {errorFormulario ? (
                <div className="alert alert-danger" role="alert">
                  <strong className="d-block">{errorFormulario}</strong>
                  {erroresFormulario.length > 0 ? (
                    <ul className="mb-0 mt-2">{erroresFormulario.map((error) => <li key={error}>{error}</li>)}</ul>
                  ) : null}
                </div>
              ) : null}

              <div className="row g-3">
                <div className="col-12 col-lg-5">
                  <label className="form-label" htmlFor="activo-descripcion">Descripcion</label>
                  <input
                    className="form-control"
                    id="activo-descripcion"
                    required
                    value={formulario.descripcion}
                    onChange={(evento) => actualizarFormulario("descripcion", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="activo-sucursal">Sucursal</label>
                  <select
                    className="form-select"
                    id="activo-sucursal"
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
                  <label className="form-label" htmlFor="activo-fecha">Adquisicion</label>
                  <input
                    className="form-control"
                    id="activo-fecha"
                    required
                    type="date"
                    value={formulario.fecha_adquisicion}
                    onChange={(evento) => actualizarFormulario("fecha_adquisicion", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-2">
                  <label className="form-label" htmlFor="activo-valor">Valor</label>
                  <input
                    className="form-control text-end"
                    id="activo-valor"
                    min="0"
                    required
                    step="0.01"
                    type="number"
                    value={formulario.valor_adquisicion}
                    onChange={(evento) => actualizarFormulario("valor_adquisicion", evento.target.value)}
                  />
                </div>
              </div>

              <div className="row g-3 mt-0">
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="activo-estado">Estado</label>
                  <select
                    className="form-select"
                    id="activo-estado"
                    required
                    value={formulario.estado}
                    onChange={(evento) => actualizarFormulario("estado", evento.target.value)}
                  >
                    {estadosActivo.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
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
                <h3 className="h5 mb-0">Detalle de activo</h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={mostrarLista}>Volver a lista</button>
                {activoSeleccionado ? (
                  <>
                    <button className="btn btn-success btn-sm" disabled={cargandoDetalle} type="button" onClick={() => editarActivo(activoSeleccionado)}>Editar</button>
                    <button className="btn btn-outline-danger btn-sm" disabled={Boolean(guardandoAccion)} type="button" onClick={eliminarActivo}>
                      {guardandoAccion === "delete" ? "Eliminando" : "Eliminar"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="card-body">
              {errorAccion ? <div className="alert alert-danger" role="alert">{errorAccion}</div> : null}
              {cargandoDetalle ? <div className="alert alert-info" role="status">Cargando detalle de activo.</div> : null}
              {activoSeleccionado ? (
                <>
                  <dl className="row mb-4">
                    <dt className="col-sm-5">Codigo</dt>
                    <dd className="col-sm-7 app-tabular">{activoSeleccionado.codigo_interno}</dd>
                    <dt className="col-sm-5">Descripcion</dt>
                    <dd className="col-sm-7">{activoSeleccionado.descripcion}</dd>
                    <dt className="col-sm-5">Sucursal</dt>
                    <dd className="col-sm-7">{activoSeleccionado.sucursal_nombre}</dd>
                    <dt className="col-sm-5">Estado</dt>
                    <dd className="col-sm-7"><span className={`badge ${claseBadgeActivo(activoSeleccionado.estado)}`}>{activoSeleccionado.estado}</span></dd>
                    <dt className="col-sm-5">Fecha adquisicion</dt>
                    <dd className="col-sm-7 app-tabular">{activoSeleccionado.fecha_adquisicion}</dd>
                    <dt className="col-sm-5">Valor adquisicion</dt>
                    <dd className="col-sm-7 app-tabular">{formatearMoneda(activoSeleccionado.valor_adquisicion)}</dd>
                  </dl>

                  <form className="border rounded-2 p-3 mb-3" onSubmit={guardarEvento}>
                    <div className="row g-2 align-items-end">
                      <div className="col-12 col-lg-3">
                        <label className="form-label" htmlFor="evento-tipo">Evento</label>
                        <select
                          className="form-select form-select-sm"
                          id="evento-tipo"
                          value={formularioEvento.tipo_evento}
                          onChange={(evento) => actualizarFormularioEvento("tipo_evento", evento.target.value)}
                        >
                          {tiposEvento.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                        </select>
                      </div>
                      <div className="col-12 col-lg-2">
                        <label className="form-label" htmlFor="evento-valor">Valor</label>
                        <input
                          className="form-control form-control-sm text-end"
                          id="evento-valor"
                          min="0"
                          required
                          step="0.01"
                          type="number"
                          value={formularioEvento.valor}
                          onChange={(evento) => actualizarFormularioEvento("valor", evento.target.value)}
                        />
                      </div>
                      <div className="col-12 col-lg-5">
                        <label className="form-label" htmlFor="evento-observacion">Observacion</label>
                        <input
                          className="form-control form-control-sm"
                          id="evento-observacion"
                          value={formularioEvento.observacion}
                          onChange={(evento) => actualizarFormularioEvento("observacion", evento.target.value)}
                        />
                      </div>
                      <div className="col-12 col-lg-2 d-grid">
                        <button className="btn btn-outline-success btn-sm" disabled={guardandoAccion === "evento"} type="submit">
                          Agregar
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th scope="col">Fecha</th>
                          <th scope="col">Evento</th>
                          <th scope="col">Usuario</th>
                          <th scope="col">Observacion</th>
                          <th className="text-end" scope="col">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activoSeleccionado.eventos || []).map((evento) => (
                          <tr key={evento.id_evento_activo}>
                            <td className="app-tabular">{evento.fecha_evento}</td>
                            <td>{evento.tipo_evento}</td>
                            <td>{evento.nombre_usuario || "Sin usuario"}</td>
                            <td>{evento.observacion || "Sin observacion"}</td>
                            <td className="text-end app-tabular">{formatearMoneda(evento.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="alert alert-info mb-0" role="status">Selecciona un activo para consultar su detalle.</div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
