import { useState } from "react";

const usuariosDemo = [
  "vendedor / vendedor123",
  "vendedor-call-center / callcenter123",
  "admin / admin123",
  "auditor / auditor123"
];

function VistaLogin({ alIniciarSesion }) {
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviarFormulario(evento) {
    evento.preventDefault();
    setError("");
    setCargando(true);

    try {
      const respuesta = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre_usuario: nombreUsuario, clave })
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado.ok) {
        setError(resultado.message || "No fue posible iniciar sesion.");
        return;
      }

      alIniciarSesion(resultado.data);
    } catch (err) {
      setError(err.message || "No fue posible iniciar sesion.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="container-fluid bg-body-tertiary min-vh-100 d-flex align-items-center py-5">
      <section className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-7 col-lg-5 col-xl-4">
            <form className="card border-success" onSubmit={enviarFormulario}>
              <div className="card-header bg-success text-white">
                <p className="small text-uppercase fw-semibold text-warning mb-1">Farmacias Alejandro</p>
                <h1 className="h4 mb-0">Acceso operativo</h1>
              </div>
              <div className="card-body">
                {error ? (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                ) : null}

                <div className="mb-3">
                  <label className="form-label" htmlFor="login-usuario">
                    Usuario
                  </label>
                  <input
                    autoComplete="username"
                    autoFocus
                    className="form-control"
                    id="login-usuario"
                    required
                    value={nombreUsuario}
                    onChange={(evento) => setNombreUsuario(evento.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="login-clave">
                    Clave
                  </label>
                  <input
                    autoComplete="current-password"
                    className="form-control"
                    id="login-clave"
                    required
                    type="password"
                    value={clave}
                    onChange={(evento) => setClave(evento.target.value)}
                  />
                </div>

                <div className="alert alert-info mb-0" role="status">
                  <strong className="d-block">Usuarios de prueba</strong>
                  <span className="small">{usuariosDemo.join(", ")}</span>
                </div>
              </div>
              <div className="card-footer bg-body d-grid">
                <button className="btn btn-success" disabled={cargando} type="submit">
                  {cargando ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                      Entrando
                    </>
                  ) : (
                    "Entrar"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

export default VistaLogin;
