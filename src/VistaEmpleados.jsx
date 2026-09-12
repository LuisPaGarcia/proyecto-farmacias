import { useEffect, useMemo, useState } from "react";

const formularioEmpleadoVacio = {
  sucursal_id: "",
  nombre: "",
  cargo: "",
  telefono: "",
  email: "",
  fecha_ingreso: "",
  estado: "ACTIVO"
};

const estadosEmpleado = ["ACTIVO", "INACTIVO"];

function formatearCodigo(prefijo, id) {
  return `${prefijo}-${String(id || 0).padStart(3, "0")}`;
}

function claseBadgeEstado(estado) {
  return estado === "ACTIVO" ? "text-bg-success" : "text-bg-secondary";
}

async function leerJson(respuesta, mensajeAlterno) {
  const resultado = await respuesta.json();

  if (!respuesta.ok || !resultado.ok) {
    throw new Error(resultado.message || mensajeAlterno);
  }

  return resultado.data || [];
}

export default function VistaEmpleados() {
  const [vista, setVista] = useState("list");
  const [empleados, setEmpleados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [empleadoSeleccionadoId, setEmpleadoSeleccionadoId] = useState(null);
  const [empleadoEditandoId, setEmpleadoEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(formularioEmpleadoVacio);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [erroresFormulario, setErroresFormulario] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");
  const [guardandoAccion, setGuardandoAccion] = useState("");

  const empleadoSeleccionado = useMemo(
    () => empleados.find((empleado) => empleado.id_empleado === empleadoSeleccionadoId) || null,
    [empleados, empleadoSeleccionadoId]
  );

  async function cargarDatos() {
    setCargando(true);
    setErrorCarga("");

    try {
      const [respuestaEmpleados, respuestaSucursales] = await Promise.all([
        fetch("/api/empleados"),
        fetch("/api/sucursales")
      ]);
      const [datosEmpleados, datosSucursales] = await Promise.all([
        leerJson(respuestaEmpleados, "No fue posible leer empleados."),
        leerJson(respuestaSucursales, "No fue posible leer sucursales.")
      ]);

      setEmpleados(datosEmpleados);
      setSucursales(datosSucursales);
    } catch (error) {
      setEmpleados([]);
      setEmpleadoSeleccionadoId(null);
      setErrorCarga(error.message || "No fue posible leer empleados.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function limpiarFormulario() {
    setEmpleadoEditandoId(null);
    setFormulario(formularioEmpleadoVacio);
    setErrorFormulario("");
    setErroresFormulario([]);
  }

  function mostrarLista() {
    setVista("list");
    setEmpleadoSeleccionadoId(null);
    setErrorAccion("");
    limpiarFormulario();
  }

  function mostrarFormularioNuevo() {
    setEmpleadoSeleccionadoId(null);
    setErrorAccion("");
    limpiarFormulario();
    setVista("formulario");
  }

  function mostrarDetalle(empleado) {
    setEmpleadoSeleccionadoId(empleado.id_empleado);
    setErrorAccion("");
    limpiarFormulario();
    setVista("detail");
  }

  function cancelarFormulario() {
    const siguienteVista = empleadoEditandoId && empleadoSeleccionado ? "detail" : "list";
    limpiarFormulario();
    setVista(siguienteVista);
  }

  function actualizarFormulario(campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor
    }));
  }

  function editarEmpleado(empleado) {
    setEmpleadoEditandoId(empleado.id_empleado);
    setEmpleadoSeleccionadoId(empleado.id_empleado);
    setFormulario({
      sucursal_id: empleado.sucursal_id || "",
      nombre: empleado.nombre || "",
      cargo: empleado.cargo || "",
      telefono: empleado.telefono || "",
      email: empleado.email || "",
      fecha_ingreso: empleado.fecha_ingreso || "",
      estado: empleado.estado || "ACTIVO"
    });
    setErrorAccion("");
    setErrorFormulario("");
    setErroresFormulario([]);
    setVista("formulario");
  }

  async function guardarEmpleado(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario("");
    setErroresFormulario([]);

    const url = empleadoEditandoId ? `/api/empleados/${empleadoEditandoId}` : "/api/empleados";
    const metodo = empleadoEditandoId ? "PUT" : "POST";

    try {
      const respuesta = await fetch(url, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formulario)
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorFormulario(resultado.message || "No fue posible guardar el empleado.");
        setErroresFormulario(resultado.errors || []);
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorFormulario(error.message || "No fue posible guardar el empleado.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarEmpleado() {
    if (!empleadoSeleccionado) return;

    const confirmado = window.confirm(`Eliminar ${empleadoSeleccionado.nombre}? Esta accion no se puede deshacer.`);
    if (!confirmado) return;

    setGuardandoAccion("delete");
    setErrorAccion("");

    try {
      const respuesta = await fetch(`/api/empleados/${empleadoSeleccionado.id_empleado}`, {
        method: "DELETE"
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorAccion(resultado.message || "No fue posible eliminar el empleado.");
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorAccion(error.message || "No fue posible eliminar el empleado.");
    } finally {
      setGuardandoAccion("");
    }
  }

  return (
    <section id="empleados">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-018 / Orden 40</p>
          <h2 className="display-6 fw-semibold mb-1">Empleados</h2>
          <p className="text-secondary mb-0">Personal por sucursal con cargo, fecha de ingreso y estado.</p>
        </div>
        <button className="btn btn-success align-self-start" type="button" onClick={mostrarFormularioNuevo}>
          Nuevo empleado
        </button>
      </header>

      <div className="row g-3">
        <div className={`col-12 ${vista === "list" ? "" : "d-none"}`}>
          <div className="card h-100">
            <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                <h3 className="h5 mb-0">Empleados registrados</h3>
              </div>
              {cargando ? (
                <span className="spinner-border spinner-border-sm text-success" role="status">
                  <span className="visually-hidden">Cargando empleados</span>
                </span>
              ) : null}
            </div>

            {errorCarga ? <div className="alert alert-warning m-3" role="alert">{errorCarga}</div> : null}

            {!cargando && empleados.length === 0 && !errorCarga ? (
              <div className="card-body">
                <div className="alert alert-info mb-0" role="status">No hay empleados registrados.</div>
              </div>
            ) : null}

            {empleados.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Codigo</th>
                      <th scope="col">Nombre</th>
                      <th scope="col">Sucursal</th>
                      <th scope="col">Cargo</th>
                      <th scope="col">Ingreso</th>
                      <th scope="col">Estado</th>
                      <th className="text-end" scope="col">Planillas</th>
                      <th className="text-end" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empleados.map((empleado) => (
                      <tr key={empleado.id_empleado}>
                        <td className="app-tabular">{formatearCodigo("EMP", empleado.id_empleado)}</td>
                        <td>{empleado.nombre}</td>
                        <td>{empleado.sucursal_nombre || "Sin sucursal"}</td>
                        <td>{empleado.cargo}</td>
                        <td className="app-tabular">{empleado.fecha_ingreso}</td>
                        <td><span className={`badge ${claseBadgeEstado(empleado.estado)}`}>{empleado.estado}</span></td>
                        <td className="text-end app-tabular">{Number(empleado.total_planillas || 0)}</td>
                        <td className="text-end">
                          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => mostrarDetalle(empleado)}>
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
          <form className="card" onSubmit={guardarEmpleado}>
            <div className="card-header bg-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">{empleadoEditandoId ? "Editar" : "Crear"}</p>
              <h3 className="h5 mb-0">{empleadoEditandoId ? formatearCodigo("EMP", empleadoEditandoId) : "Nuevo empleado"}</h3>
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
                <div className="col-12 col-lg-5">
                  <label className="form-label" htmlFor="empleado-nombre">Nombre</label>
                  <input
                    className="form-control"
                    id="empleado-nombre"
                    required
                    value={formulario.nombre}
                    onChange={(evento) => actualizarFormulario("nombre", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="empleado-cargo">Cargo</label>
                  <input
                    className="form-control"
                    id="empleado-cargo"
                    required
                    value={formulario.cargo}
                    onChange={(evento) => actualizarFormulario("cargo", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-4">
                  <label className="form-label" htmlFor="empleado-sucursal">Sucursal</label>
                  <select
                    className="form-select"
                    id="empleado-sucursal"
                    value={formulario.sucursal_id}
                    onChange={(evento) => actualizarFormulario("sucursal_id", evento.target.value)}
                  >
                    <option value="">Sin sucursal</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                        {formatearCodigo("SUC", sucursal.id_sucursal)} - {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mt-0">
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="empleado-ingreso">Fecha ingreso</label>
                  <input
                    className="form-control"
                    id="empleado-ingreso"
                    required
                    type="date"
                    value={formulario.fecha_ingreso}
                    onChange={(evento) => actualizarFormulario("fecha_ingreso", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="empleado-estado">Estado</label>
                  <select
                    className="form-select"
                    id="empleado-estado"
                    required
                    value={formulario.estado}
                    onChange={(evento) => actualizarFormulario("estado", evento.target.value)}
                  >
                    {estadosEmpleado.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="empleado-telefono">Telefono</label>
                  <input
                    className="form-control"
                    id="empleado-telefono"
                    value={formulario.telefono}
                    onChange={(evento) => actualizarFormulario("telefono", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="empleado-email">Email</label>
                  <input
                    className="form-control"
                    id="empleado-email"
                    type="email"
                    value={formulario.email}
                    onChange={(evento) => actualizarFormulario("email", evento.target.value)}
                  />
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
                <h3 className="h5 mb-0">Detalle de empleado</h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={mostrarLista}>Volver a lista</button>
                {empleadoSeleccionado ? (
                  <>
                    <button className="btn btn-success btn-sm" type="button" onClick={() => editarEmpleado(empleadoSeleccionado)}>Editar</button>
                    <button className="btn btn-outline-danger btn-sm" disabled={Boolean(guardandoAccion)} type="button" onClick={eliminarEmpleado}>
                      {guardandoAccion === "delete" ? "Eliminando" : "Eliminar"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="card-body">
              {errorAccion ? <div className="alert alert-danger" role="alert">{errorAccion}</div> : null}
              {empleadoSeleccionado ? (
                <dl className="row mb-0">
                  <dt className="col-sm-5">Codigo</dt>
                  <dd className="col-sm-7 app-tabular">{formatearCodigo("EMP", empleadoSeleccionado.id_empleado)}</dd>
                  <dt className="col-sm-5">Nombre</dt>
                  <dd className="col-sm-7">{empleadoSeleccionado.nombre}</dd>
                  <dt className="col-sm-5">Sucursal</dt>
                  <dd className="col-sm-7">{empleadoSeleccionado.sucursal_nombre || "Sin sucursal"}</dd>
                  <dt className="col-sm-5">Cargo</dt>
                  <dd className="col-sm-7">{empleadoSeleccionado.cargo}</dd>
                  <dt className="col-sm-5">Estado</dt>
                  <dd className="col-sm-7"><span className={`badge ${claseBadgeEstado(empleadoSeleccionado.estado)}`}>{empleadoSeleccionado.estado}</span></dd>
                  <dt className="col-sm-5">Fecha ingreso</dt>
                  <dd className="col-sm-7 app-tabular">{empleadoSeleccionado.fecha_ingreso}</dd>
                  <dt className="col-sm-5">Telefono</dt>
                  <dd className="col-sm-7">{empleadoSeleccionado.telefono || "Sin telefono"}</dd>
                  <dt className="col-sm-5">Email</dt>
                  <dd className="col-sm-7">{empleadoSeleccionado.email || "Sin email"}</dd>
                  <dt className="col-sm-5">Planillas</dt>
                  <dd className="col-sm-7 app-tabular">{Number(empleadoSeleccionado.total_planillas || 0)}</dd>
                </dl>
              ) : (
                <div className="alert alert-info mb-0" role="status">Selecciona un empleado para consultar su detalle.</div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
