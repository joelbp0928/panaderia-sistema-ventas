const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: { rejectUnauthorized: false }  // 🔹 Importante para Azure
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Error al conectar con MySQL en Azure:', err);
    return;
  }
  console.log('✅ Conectado a la base de datos MySQL en Azure.');
});

module.exports = connection;
