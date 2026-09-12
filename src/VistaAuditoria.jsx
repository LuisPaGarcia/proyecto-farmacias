import { useEffect, useState } from "react";

const filtrosVacios = {
  usuario_id: "",
  entidad: "",
  fecha_inicio: "",
  fecha_fin: ""
};

function formatearCodigo(prefijo, id) {
  return `${prefijo}-${String(id || 0).padStart(3, "0")}`;
}

async function leerJson(respuesta, mensajeAlterno) {
  const resultado = await respuesta.json();

  if (!respuesta.ok || !resultado.ok) {
    throw new Error(resultado.message || mensajeAlterno);
  }

  return resultado.data || [];
}

export default function VistaAuditoria() {
  const [registros, setRegistros] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [filtros, setFiltros] = useState(filtrosVacios);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  function rutaAuditoria(siguientesFiltros = filtros) {
    const parametros = new URLSearchParams();
    if (siguientesFiltros.usuario_id) parametros.set("usuario_id", siguientesFiltros.usuario_id);
    if (siguientesFiltros.entidad) parametros.set("entidad", siguientesFiltros.entidad);
    if (siguientesFiltros.fecha_inicio) parametros.set("fecha_inicio", siguientesFiltros.fecha_inicio);
    if (siguientesFiltros.fecha_fin) parametros.set("fecha_fin", siguientesFiltros.fecha_fin);
    const query = parametros.toString();
    return query ? `/api/auditoria?${query}` : "/api/auditoria";
  }

  async function cargarDatos(siguientesFiltros = filtros) {
    setCargando(true);
    setErrorCarga("");

    try {
      const [respuestaAuditoria, respuestaUsuarios] = await Promise.all([
        fetch(rutaAuditoria(siguientesFiltros)),
        fetch("/api/usuarios")
      ]);
      const [datosAuditoria, datosUsuarios] = await Promise.all([
        leerJson(respuestaAuditoria, "No fue posible consultar auditoria."),
        leerJson(respuestaUsuarios, "No fue posible leer usuarios.")
      ]);

      setRegistros(datosAuditoria);
      setUsuarios(datosUsuarios);
    } catch (error) {
      setRegistros([]);
      setErrorCarga(error.message || "No fue posible consultar auditoria.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function actualizarFiltro(campo, valor) {
    const siguientesFiltros = { ...filtros, [campo]: valor };
    setFiltros(siguientesFiltros);
    cargarDatos(siguientesFiltros);
  }

  function limpiarFiltros() {
    setFiltros(filtrosVacios);
    cargarDatos(filtrosVacios);
  }

  return (
    <section id="auditoria">
      <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-4">
        <div>
          <p className="small text-uppercase fw-semibold text-success mb-2">REQ-022 / Orden 52</p>
          <h2 className="display-6 fw-semibold mb-1">Auditoria</h2>
          <p className="text-secondary mb-0">Consulta de acciones criticas por usuario, entidad y fecha.</p>
        </div>
      </header>

      <div className="card">
        <div className="card-header bg-body">
          <div className="d-flex flex-column flex-xl-row justify-content-between gap-3">
            <div>
              <p className="small text-uppercase fw-semibold text-success mb-1">Consulta</p>
              <h3 className="h5 mb-0">Registros de auditoria</h3>
            </div>
            {cargando ? (
              <span className="spinner-border spinner-border-sm text-success align-self-start" role="status">
                <span className="visually-hidden">Cargando auditoria</span>
              </span>
            ) : null}
          </div>
          <div className="row g-2 mt-2">
            <div className="col-12 col-lg-3">
              <select
                className="form-select form-select-sm"
                value={filtros.usuario_id}
                onChange={(evento) => actualizarFiltro("usuario_id", evento.target.value)}
              >
                <option value="">Todos los usuarios</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id_usuario} value={usuario.id_usuario}>
                    {formatearCodigo("USR", usuario.id_usuario)} - {usuario.nombre_usuario}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-lg-3">
              <input
                className="form-control form-control-sm"
                placeholder="Entidad"
                value={filtros.entidad}
                onChange={(evento) => actualizarFiltro("entidad", evento.target.value)}
              />
            </div>
            <div className="col-12 col-md-4 col-lg-2">
              <input
                className="form-control form-control-sm"
                type="date"
                value={filtros.fecha_inicio}
                onChange={(evento) => actualizarFiltro("fecha_inicio", evento.target.value)}
              />
            </div>
            <div className="col-12 col-md-4 col-lg-2">
              <input
                className="form-control form-control-sm"
                type="date"
                value={filtros.fecha_fin}
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

        {errorCarga ? <div className="alert alert-warning m-3" role="alert">{errorCarga}</div> : null}

        {!cargando && registros.length === 0 && !errorCarga ? (
          <div className="card-body">
            <div className="alert alert-info mb-0" role="status">No hay registros de auditoria.</div>
          </div>
        ) : null}

        {registros.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Codigo</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Usuario</th>
                  <th scope="col">Sucursal</th>
                  <th scope="col">Accion</th>
                  <th scope="col">Entidad</th>
                  <th scope="col">Detalle</th>
                  <th scope="col">IP</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((registro) => (
                  <tr key={registro.id_auditoria}>
                    <td className="app-tabular">{formatearCodigo("AUD", registro.id_auditoria)}</td>
                    <td className="app-tabular">{registro.fecha_hora}</td>
                    <td>{registro.nombre_usuario || "Sin usuario"}</td>
                    <td>{registro.sucursal_nombre || "Sin sucursal"}</td>
                    <td>{registro.accion}</td>
                    <td>
                      <span className="d-block">{registro.entidad}</span>
                      <span className="small text-secondary app-tabular">{registro.entidad_id || "Sin id"}</span>
                    </td>
                    <td>{registro.detalle || "Sin detalle"}</td>
                    <td className="app-tabular">{registro.ip_origen || "Sin IP"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
