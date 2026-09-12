import { useEffect, useMemo, useState } from "react";

const formularioUsuarioVacio = {
  nombre_usuario: "",
  password_hash: "",
  empleado_id: "",
  estado: "ACTIVO",
  roles: []
};

const estadosUsuario = ["ACTIVO", "INACTIVO", "BLOQUEADO"];

function formatearCodigo(prefijo, id) {
  return `${prefijo}-${String(id || 0).padStart(3, "0")}`;
}

function claseBadgeUsuario(estado) {
  if (estado === "ACTIVO") return "text-bg-success";
  if (estado === "BLOQUEADO") return "text-bg-danger";
  return "text-bg-secondary";
}

async function leerJson(respuesta, mensajeAlterno) {
  const resultado = await respuesta.json();

  if (!respuesta.ok || !resultado.ok) {
    throw new Error(resultado.message || mensajeAlterno);
  }

  return resultado.data || [];
}

export default function VistaUsuarios() {
  const [vista, setVista] = useState("list");
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [usuarioEditandoId, setUsuarioEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(formularioUsuarioVacio);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [erroresFormulario, setErroresFormulario] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");
  const [guardandoAccion, setGuardandoAccion] = useState("");

  const rolesSeleccionados = useMemo(
    () => new Set((usuarioSeleccionado?.roles || []).map((rol) => rol.id_rol)),
    [usuarioSeleccionado]
  );

  async function cargarDatos() {
    setCargando(true);
    setErrorCarga("");

    try {
      const [respuestaUsuarios, respuestaRoles, respuestaEmpleados] = await Promise.all([
        fetch("/api/usuarios"),
        fetch("/api/roles"),
        fetch("/api/empleados")
      ]);
      const [datosUsuarios, datosRoles, datosEmpleados] = await Promise.all([
        leerJson(respuestaUsuarios, "No fue posible leer usuarios."),
        leerJson(respuestaRoles, "No fue posible leer roles."),
        leerJson(respuestaEmpleados, "No fue posible leer empleados.")
      ]);

      setUsuarios(datosUsuarios);
      setRoles(datosRoles);
      setEmpleados(datosEmpleados);
    } catch (error) {
      setUsuarios([]);
      setUsuarioSeleccionado(null);
      setErrorCarga(error.message || "No fue posible leer usuarios.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function limpiarFormulario() {
    setUsuarioEditandoId(null);
    setFormulario(formularioUsuarioVacio);
    setErrorFormulario("");
    setErroresFormulario([]);
  }

  function mostrarLista() {
    setVista("list");
    setUsuarioSeleccionado(null);
    setErrorAccion("");
    limpiarFormulario();
  }

  function mostrarFormularioNuevo() {
    setUsuarioSeleccionado(null);
    setErrorAccion("");
    limpiarFormulario();
    setVista("formulario");
  }

  async function mostrarDetalle(usuario) {
    setUsuarioSeleccionado(usuario);
    setErrorAccion("");
    limpiarFormulario();
    setVista("detail");
    setCargandoDetalle(true);

    try {
      const respuesta = await fetch(`/api/usuarios/${usuario.id_usuario}`);
      const datos = await leerJson(respuesta, "No fue posible consultar el usuario.");
      setUsuarioSeleccionado(datos);
    } catch (error) {
      setErrorAccion(error.message || "No fue posible consultar el usuario.");
    } finally {
      setCargandoDetalle(false);
    }
  }

  function cancelarFormulario() {
    const siguienteVista = usuarioEditandoId && usuarioSeleccionado ? "detail" : "list";
    limpiarFormulario();
    setVista(siguienteVista);
  }

  function actualizarFormulario(campo, valor) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  function alternarRol(idRol) {
    setFormulario((actual) => ({
      ...actual,
      roles: actual.roles.includes(idRol)
        ? actual.roles.filter((rol) => rol !== idRol)
        : [...actual.roles, idRol]
    }));
  }

  function editarUsuario(usuario) {
    setUsuarioEditandoId(usuario.id_usuario);
    setUsuarioSeleccionado(usuario);
    setFormulario({
      nombre_usuario: usuario.nombre_usuario || "",
      password_hash: "",
      empleado_id: usuario.empleado_id || "",
      estado: usuario.estado || "ACTIVO",
      roles: (usuario.roles || []).map((rol) => rol.id_rol)
    });
    setErrorAccion("");
    setErrorFormulario("");
    setErroresFormulario([]);
    setVista("formulario");
  }

  async function guardarUsuario(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorFormulario("");
    setErroresFormulario([]);

    const url = usuarioEditandoId ? `/api/usuarios/${usuarioEditandoId}` : "/api/usuarios";
    const metodo = usuarioEditandoId ? "PUT" : "POST";

    try {
      const respuesta = await fetch(url, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formulario)
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorFormulario(resultado.message || "No fue posible guardar el usuario.");
        setErroresFormulario(resultado.errors || []);
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorFormulario(error.message || "No fue posible guardar el usuario.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarUsuario() {
    if (!usuarioSeleccionado) return;

    const confirmado = window.confirm(`Eliminar ${usuarioSeleccionado.nombre_usuario}? Esta accion no se puede deshacer.`);
    if (!confirmado) return;

    setGuardandoAccion("delete");
    setErrorAccion("");

    try {
      const respuesta = await fetch(`/api/usuarios/${usuarioSeleccionado.id_usuario}`, {
        method: "DELETE"
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setErrorAccion(resultado.message || "No fue posible eliminar el usuario.");
        return;
      }

      await cargarDatos();
      mostrarLista();
    } catch (error) {
      setErrorAccion(error.message || "No fue posible eliminar el usuario.");
    } finally {
      setGuardandoAccion("");
    }
  }

  return (
    <section id="usuarios">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-021 / Orden 49</p>
          <h2 className="display-6 fw-semibold mb-1">Usuarios y roles</h2>
          <p className="text-secondary mb-0">Usuarios operativos, empleado asociado y roles asignados.</p>
        </div>
        <button className="btn btn-success align-self-start" type="button" onClick={mostrarFormularioNuevo}>
          Nuevo usuario
        </button>
      </header>

      <div className="row g-3">
        <div className={`col-12 ${vista === "list" ? "" : "d-none"}`}>
          <div className="card h-100">
            <div className="card-header bg-body d-flex justify-content-between align-items-center gap-3">
              <div>
                <p className="small text-uppercase fw-semibold text-success mb-1">Listado</p>
                <h3 className="h5 mb-0">Usuarios registrados</h3>
              </div>
              {cargando ? (
                <span className="spinner-border spinner-border-sm text-success" role="status">
                  <span className="visually-hidden">Cargando usuarios</span>
                </span>
              ) : null}
            </div>

            {errorCarga ? <div className="alert alert-warning m-3" role="alert">{errorCarga}</div> : null}

            {!cargando && usuarios.length === 0 && !errorCarga ? (
              <div className="card-body">
                <div className="alert alert-info mb-0" role="status">No hay usuarios registrados.</div>
              </div>
            ) : null}

            {usuarios.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Codigo</th>
                      <th scope="col">Usuario</th>
                      <th scope="col">Empleado</th>
                      <th scope="col">Estado</th>
                      <th className="text-end" scope="col">Roles</th>
                      <th className="text-end" scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((usuario) => (
                      <tr key={usuario.id_usuario}>
                        <td className="app-tabular">{formatearCodigo("USR", usuario.id_usuario)}</td>
                        <td>{usuario.nombre_usuario}</td>
                        <td>{usuario.empleado_nombre || "Sin empleado"}</td>
                        <td><span className={`badge ${claseBadgeUsuario(usuario.estado)}`}>{usuario.estado}</span></td>
                        <td className="text-end app-tabular">{Number(usuario.total_roles || 0)}</td>
                        <td className="text-end">
                          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => mostrarDetalle(usuario)}>
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
          <form className="card" onSubmit={guardarUsuario}>
            <div className="card-header bg-body">
              <p className="small text-uppercase fw-semibold text-success mb-1">{usuarioEditandoId ? "Editar" : "Crear"}</p>
              <h3 className="h5 mb-0">{usuarioEditandoId ? formatearCodigo("USR", usuarioEditandoId) : "Nuevo usuario"}</h3>
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
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="usuario-nombre">Usuario</label>
                  <input
                    className="form-control"
                    id="usuario-nombre"
                    required
                    value={formulario.nombre_usuario}
                    onChange={(evento) => actualizarFormulario("nombre_usuario", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="usuario-clave">Clave temporal</label>
                  <input
                    className="form-control"
                    id="usuario-clave"
                    required={!usuarioEditandoId}
                    type="password"
                    value={formulario.password_hash}
                    onChange={(evento) => actualizarFormulario("password_hash", evento.target.value)}
                  />
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="usuario-empleado">Empleado</label>
                  <select
                    className="form-select"
                    id="usuario-empleado"
                    value={formulario.empleado_id}
                    onChange={(evento) => actualizarFormulario("empleado_id", evento.target.value)}
                  >
                    <option value="">Sin empleado</option>
                    {empleados.map((empleado) => (
                      <option key={empleado.id_empleado} value={empleado.id_empleado}>
                        {formatearCodigo("EMP", empleado.id_empleado)} - {empleado.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="usuario-estado">Estado</label>
                  <select
                    className="form-select"
                    id="usuario-estado"
                    required
                    value={formulario.estado}
                    onChange={(evento) => actualizarFormulario("estado", evento.target.value)}
                  >
                    {estadosUsuario.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
                </div>
              </div>

              <div className="border rounded-2 mt-4">
                <div className="p-3 border-bottom">
                  <p className="small text-uppercase fw-semibold text-success mb-1">Roles</p>
                  <h4 className="h6 mb-0">Asignacion de roles</h4>
                </div>
                <div className="list-group list-group-flush">
                  {roles.map((rol) => (
                    <label className="list-group-item d-flex justify-content-between gap-3" key={rol.id_rol}>
                      <span>
                        <span className="d-block fw-semibold">{rol.nombre_rol}</span>
                        <span className="small text-secondary">{rol.descripcion || "Sin descripcion"}</span>
                      </span>
                      <input
                        checked={formulario.roles.includes(rol.id_rol)}
                        className="form-check-input flex-shrink-0"
                        type="checkbox"
                        onChange={() => alternarRol(rol.id_rol)}
                      />
                    </label>
                  ))}
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
                <h3 className="h5 mb-0">Detalle de usuario</h3>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={mostrarLista}>Volver a lista</button>
                {usuarioSeleccionado ? (
                  <>
                    <button className="btn btn-success btn-sm" disabled={cargandoDetalle} type="button" onClick={() => editarUsuario(usuarioSeleccionado)}>Editar</button>
                    <button className="btn btn-outline-danger btn-sm" disabled={Boolean(guardandoAccion)} type="button" onClick={eliminarUsuario}>
                      {guardandoAccion === "delete" ? "Eliminando" : "Eliminar"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="card-body">
              {errorAccion ? <div className="alert alert-danger" role="alert">{errorAccion}</div> : null}
              {cargandoDetalle ? <div className="alert alert-info" role="status">Cargando detalle de usuario.</div> : null}
              {usuarioSeleccionado ? (
                <>
                  <dl className="row mb-4">
                    <dt className="col-sm-5">Codigo</dt>
                    <dd className="col-sm-7 app-tabular">{formatearCodigo("USR", usuarioSeleccionado.id_usuario)}</dd>
                    <dt className="col-sm-5">Usuario</dt>
                    <dd className="col-sm-7">{usuarioSeleccionado.nombre_usuario}</dd>
                    <dt className="col-sm-5">Empleado</dt>
                    <dd className="col-sm-7">{usuarioSeleccionado.empleado_nombre || "Sin empleado"}</dd>
                    <dt className="col-sm-5">Estado</dt>
                    <dd className="col-sm-7"><span className={`badge ${claseBadgeUsuario(usuarioSeleccionado.estado)}`}>{usuarioSeleccionado.estado}</span></dd>
                    <dt className="col-sm-5">Ultimo acceso</dt>
                    <dd className="col-sm-7 app-tabular">{usuarioSeleccionado.ultimo_acceso_at || "Sin acceso"}</dd>
                  </dl>
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th scope="col">Rol</th>
                          <th scope="col">Descripcion</th>
                          <th className="text-end" scope="col">Asignado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roles.map((rol) => (
                          <tr key={rol.id_rol}>
                            <td>{rol.nombre_rol}</td>
                            <td>{rol.descripcion || "Sin descripcion"}</td>
                            <td className="text-end">{rolesSeleccionados.has(rol.id_rol) ? "Si" : "No"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="alert alert-info mb-0" role="status">Selecciona un usuario para consultar su detalle.</div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
