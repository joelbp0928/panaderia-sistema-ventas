const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");

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

// 🔹 Configurar cliente Supabase con clave de servicio (SOLO EN BACKEND)
const supabaseAdmin = createClient(
  "https://kicwgxkkayxneguidsxe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpY3dneGtrYXl4bmVndWlkc3hlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTA2NzY0OCwiZXhwIjoyMDU2NjQzNjQ4fQ.P1KXNtc9LlADIUJhZHEoG0PR7iC3RVe64BDZTM5IZlA" // 📌 Usa la clave de servicio de Supabase
);

// Inicializar Express
const app = express();
app.use(cors({
  origin: ["https://gestor-panaderia.web.app", "http://127.0.0.1:5501"], // Agrega todos los orígenes permitidos
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json()); // Permite manejar JSON en las solicitudes

// 🔹 Endpoint para eliminar empleados completamente
app.delete("/eliminar-empleado/:id", async (req, res) => {
  const { id } = req.params;

  try {
    console.log(`🗑 Intentando eliminar empleado con ID: ${id}`);

    // 🔹 Eliminar primero de la tabla `empleados`
    let { error: errorEmpleado } = await pool.query(
      "DELETE FROM empleados WHERE usuario_id = $1",
      [id]
    );
    if (errorEmpleado) throw errorEmpleado;

    // 🔹 Luego eliminar de la tabla `usuarios`
    let { error: errorUsuario } = await pool.query(
      "DELETE FROM usuarios WHERE id = $1",
      [id]
    );
    if (errorUsuario) throw errorUsuario;

    // 🔹 Finalmente, eliminar de la autenticación de Supabase
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      console.warn(`⚠️ Advertencia: No se pudo eliminar el usuario de autenticación: ${authError.message}`);
    }

    res.status(200).json({ message: "Empleado eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar empleado:", error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener promociones activas desde la base de datos
app.get("/config/promociones", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM promociones WHERE activa = TRUE");
    console.log("se obtuvieron promocionesholiiii:");
    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo promociones:", error);
    res.status(500).json({ error: "Error obteniendo promociones" });
  }
});

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

// Exportar la API de Firebase Functions
exports.api = functions.https.onRequest(app);

// 🔹 Endpoint para eliminar clientes completamente
app.delete("/eliminar-cliente/:id", async (req, res) => {
  const { id } = req.params;

  try {
    console.log(`🗑 Intentando eliminar cliente con ID: ${id}`);

    // 🔹 Eliminar de la tabla `clientes`
    let { error: errorCliente } = await pool.query(
      "DELETE FROM clientes WHERE usuario_id = $1",
      [id]
    );
    if (errorCliente) throw errorCliente;

    // 🔹 Luego eliminar de la tabla `usuarios`
    let { error: errorUsuario } = await pool.query(
      "DELETE FROM usuarios WHERE id = $1",
      [id]
    );
    if (errorUsuario) throw errorUsuario;

    // 🔹 Finalmente, eliminar de la autenticación de Supabase
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      console.warn(`⚠️ Advertencia: No se pudo eliminar el usuario de autenticación: ${authError.message}`);
    }

    res.status(200).json({ message: "Cliente eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar cliente:", error);
    res.status(500).json({ error: error.message });
  }
});
