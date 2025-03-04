const connection = require('../db/connection');

exports.getAllProducts = (req, res) => {
  connection.query('SELECT * FROM productos', (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener productos' });
    }
    res.json(results);
  });
};

exports.createProduct = (req, res) => {
  const { name, price, stock } = req.body;
  connection.query('INSERT INTO productos (name, price, stock) VALUES (?, ?, ?)', 
  [name, price, stock], 
  (err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al crear producto' });
    }
    res.status(201).send('Producto creado');
  });
};
