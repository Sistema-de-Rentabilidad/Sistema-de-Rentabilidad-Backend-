const empresaMiddleware = (req, res, next) => {
  // admin no necesita empresa
  if (req.user.rol === 'admin') {
    req.empresaId = null;
    return next();
  }

  if (!req.user.id_empresa) {
    return res.status(400).json({
      success: false,
      message: 'Usuario sin empresa',
    });
  }

  req.empresaId = req.user.id_empresa;
  
  next();
};

module.exports = empresaMiddleware;