const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);

  const status = err.status || 500;
  let message = err.message || 'Error interno del servidor';

  if (err.type === 'entity.parse.failed') {
    message = 'JSON invalido';
  } else if (status >= 500) {
    message = 'Error interno del servidor';
  }

  res.status(status).json({
    success: false,
    message
  });
};

module.exports = errorHandler;
