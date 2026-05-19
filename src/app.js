const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();

const authRoutes = require("./modules/auth/auth.routes");
const empresaRoutes = require("./modules/empresa/empresa.routes");
const servicioRoutes = require("./modules/servicio/servicio.routes");
const usuarioRoutes = require("./modules/usuario/usuario.routes");
const historialRoutes = require("./modules/historial_sueldo/historial.routes");
const proyectoRoutes = require("./modules/proyecto/proyecto.routes");
const horasRoutes = require("./modules/registro_horas/horas.routes");
const marcajeRoutes = require("./modules/marcaje/marcaje.routes");
const faseRoutes = require("./modules/fase/fase.routes");
const notasRoutes = require("./modules/nota/nota.routes");

const errorHandler = require("./modules/middlewares/errorHandler");

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// prefijos API
app.use("/api/auth", authRoutes);
app.use("/api/empresas", empresaRoutes);
app.use("/api/servicios", servicioRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/historiales", historialRoutes);
app.use("/api/proyectos", proyectoRoutes);
app.use("/api/horas", horasRoutes);
app.use("/api/marcajes", marcajeRoutes);
app.use("/api", faseRoutes);
app.use("/api", notasRoutes);

// SIEMPRE AL FINAL
app.use(errorHandler);

module.exports = app;
