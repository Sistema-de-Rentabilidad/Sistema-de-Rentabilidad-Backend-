const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { FRONTEND_ORIGIN, NODE_ENV } = require('./config/env');
const app = express();

/**
 * PERFORMANCE / QA CONFIG
 */
if (NODE_ENV === 'qa') {
  console.log = () => { };
}

const authRoutes = require('./modules/auth/auth.routes');
const empresaRoutes = require('./modules/empresa/empresa.routes');
const servicioRoutes = require('./modules/servicio/servicio.routes');
const usuarioRoutes = require('./modules/usuario/usuario.routes');
const historialRoutes = require('./modules/historial_sueldo/historial.routes');
const proyectoRoutes = require('./modules/proyecto/proyecto.routes');
const horasRoutes = require('./modules/registro_horas/horas.routes');
const marcajeRoutes = require('./modules/marcaje/marcaje.routes');
const faseRoutes = require('./modules/fase/fase.routes');
const notasRoutes = require('./modules/nota/nota.routes');

const csrfProtection = require('./modules/middlewares/csrfProtection');
const errorHandler = require('./modules/middlewares/errorHandler');
const pool = require('./config/db');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'none'"],
      "frame-ancestors": ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "no-referrer" },
}));

app.use(cors({
  origin(origin, callback) {
    // Permite si es el frontend O si no hay origen (como JMeter) Y es modo desarrollo/qa
    if (origin === FRONTEND_ORIGIN || !origin) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400,
  }));
}

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    return res.status(200).json({
      success: true,
      status: 'ok',
      database: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({
      success: false,
      status: 'degraded',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/test/error', (req, res) => {
    throw new Error('Error de prueba para recuperación');
});

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
if (NODE_ENV === 'production') {
  app.use('/api', csrfProtection);
}

// prefijos API
app.use('/api/auth', authRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/servicios', servicioRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/historiales', historialRoutes);
app.use('/api/proyectos', proyectoRoutes);
app.use('/api/horas', horasRoutes);
app.use('/api/marcajes', marcajeRoutes);
app.use('/api', faseRoutes);
app.use('/api', notasRoutes);

// SIEMPRE AL FINAL
app.use(errorHandler);

module.exports = app;
