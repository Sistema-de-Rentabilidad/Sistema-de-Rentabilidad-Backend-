require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'development'}`
});

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌎 Environment: ${process.env.NODE_ENV}`);
});