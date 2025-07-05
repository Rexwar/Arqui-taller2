const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'billing_db',
  process.env.DB_USER || 'billing_user',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    port: process.env.DB_PORT || 3307,
    logging: false, // Disable logging for production
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a MariaDB para facturación...');
  } catch (error) {
    console.error('❌ No se pudo conectar a MariaDB:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
