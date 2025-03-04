const express = require('express');
const router = express.Router();
const express = require('express');
const connection = require('../db/connection');
const productController = require('../controllers/productController');

router.get('/', productController.getAllProducts);
router.post('/', productController.createProduct);

module.exports = router;


// Obtener promociones activas
router.get('/promotions', (req, res) => {
  const query = 'SELECT id, nombre, imagen_url FROM promociones WHERE activa = 1';
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener promociones:', err);
      return res.status(500).json({ error: 'Error al obtener promociones' });
    }
    res.json(results);
  });
});

module.exports = router;
