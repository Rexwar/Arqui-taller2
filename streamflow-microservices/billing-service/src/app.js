const express = require('express');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuración de MariaDB
const dbConfig = {
  host: process.env.DB_HOST || 'mariadb-billing',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'billing_db'
};

// Crear tabla de facturas si no existe
async function createTable() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        due_date DATE NOT NULL,
        paid BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabla de facturas verificada/creada.');
  } catch (error) {
    console.error('Error al crear la tabla de facturas:', error);
  } finally {
    if (connection) await connection.end();
  }
}

// Endpoints de Facturación
app.post('/', async (req, res) => {
  let connection;
  try {
    const { userId, amount, dueDate } = req.body;
    if (!userId || !amount || !dueDate) {
      return res.status(400).json({ error: 'userId, amount, y dueDate son requeridos' });
    }
    connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO invoices (user_id, amount, due_date) VALUES (?, ?, ?)',
      [userId, amount, dueDate]
    );
    res.status(201).json({ id: result.insertId, userId, amount, dueDate });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (connection) await connection.end();
  }
});

app.get('/user/:userId', async (req, res) => {
  let connection;
  try {
    const { userId } = req.params;
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM invoices WHERE user_id = ?', [userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (connection) await connection.end();
  }
});

// Endpoint de salud para Docker
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  createTable();
  console.log(`Servicio de facturación ejecutándose en puerto ${PORT}`);
});
