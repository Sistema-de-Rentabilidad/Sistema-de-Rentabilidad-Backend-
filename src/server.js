require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'development'}`
});

const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`🌎 Environment: ${process.env.NODE_ENV}`);
});