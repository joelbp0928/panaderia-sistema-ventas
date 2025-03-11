const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");


// Configurar conexión con Supabase (PostgreSQL)
const pool = new Pool({
  user: "postgres.kicwgxkkayxneguidsxe",
  host: "aws-0-us-west-1.pooler.supabase.com",
  database: "postgres",
 // postgresql://postgres.kicwgxkkayxneguidsxe:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
  password: "Lallamaperez55!",
  port: 6543,
  ssl: { rejectUnauthorized: false }
});


// Inicializar Express
const app = express();
app.use(cors({
  origin: ["https://gestor-panaderia.web.app", "http://127.0.0.1:5500"], // Agrega todos los orígenes permitidos
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json()); // Permite manejar JSON en las solicitudes

// Obtener promociones activas desde la base de datos
app.get("/config/promociones", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM promociones WHERE activa = TRUE");
    console.log("se obtuvieron promociones:");
    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo promociones:", error);
    res.status(500).json({ error: "Error obteniendo promociones" });
  }
});

// Exportar la API de Firebase Functions
exports.api = functions.https.onRequest(app);

const { createClient } = require("@supabase/supabase-js");

// Probar conexión obteniendo datos de una tabla de prueba
async function probarConexion() {
  try {
    const result = await pool.query("SELECT * FROM promociones WHERE activa = TRUE");
  //  console.log("✅ Conexión a Supabase exitosa. Datos obtenidos:", result.rows);
  } catch (error) {
    console.error("❌ Error conectando a Supabase:", error);
  }
}

// Ejecutar la prueba al iniciar el servidor
probarConexion();
