// 📌 Importar Supabase y crear la conexión
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 📌 Configurar Supabase con las credenciales del proyecto
const SUPABASE_URL = "https://kicwgxkkayxneguidsxe.supabase.co";  // 🔹 Reemplaza con tu URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpY3dneGtrYXl4bmVndWlkc3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwNjc2NDgsImV4cCI6MjA1NjY0MzY0OH0.0d-ON6kBYU3Wx3L7-jP-n0wcLYD9Uj0GcxAYULqsDRg";  // 🔹 Reemplaza con tu clave pública

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
