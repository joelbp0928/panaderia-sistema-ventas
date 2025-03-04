const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());



// Ruta de prueba
app.get("/api/hello", (req, res) => {
    res.json({ message: "Hola desde Node.js y Express en Firebase!" });
});


// Conectar con Supabase
const supabase = createClient(
  "https://kicwgxkkayxneguidsxe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpY3dneGtrYXl4bmVndWlkc3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwNjc2NDgsImV4cCI6MjA1NjY0MzY0OH0.0d-ON6kBYU3Wx3L7-jP-n0wcLYD9Uj0GcxAYULqsDRg" // Usa la clave secreta en lugar de la pública
);

// Ruta para obtener productos desde Supabase
app.get("/api/productos", async (req, res) => {
    const { data, error } = await supabase.from("productos").select("*");
  
    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      res.json(data);
    }
  });

// Exportar la API como función de Firebase
exports.api = functions.https.onRequest(app);
