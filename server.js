const express = require('express');
const path = require('path');
const connection = require('./db/connection');
const productRoutes = require('./routes/products');
const chalk = require('chalk');

const app = express();

const cors = require('cors');
app.use(cors());

require('dotenv').config();

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
    console.error('🔥 Error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  });
  

// Rutas
app.use('/api/products', productRoutes);

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/index.html'));
});

// Manejo de errores y rutas desconocidas
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware para manejar errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});


app.listen(3000, () => {
    console.log(chalk.green('Servidor corriendo en ') + chalk.blue('http://localhost:3000'));
});

