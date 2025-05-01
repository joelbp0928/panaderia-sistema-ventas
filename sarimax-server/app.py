from flask import Flask, request, jsonify
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX
from flask_cors import CORS
import requests
from config import SUPABASE_URL, SUPABASE_API_KEY

# Crear app Flask
app = Flask(__name__)
CORS(app)

# === Función para obtener productos desde Supabase ===
def obtener_productos():
    url = f"{SUPABASE_URL}/rest/v1/productos"
    headers = {
        "apikey": SUPABASE_API_KEY,
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
        "Content-Type": "application/json"
    }
    params = {
        "select": "id,nombre,descripcion,imagen_url"
    }



    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code == 200:
        productos = response.json()
        print("✅ Productos cargados:", productos)
        return productos
    else:
        print("❌ Error al obtener productos", response.text)
        return []

# === Historial de compras inventado (por ahora) ===
historial_compras = [
    0, 0, 1, 2, 0, 1, 1, 0, 3, 3, 1, 0, 4, 0, 0, 1, 3, 0, 4, 3, 1, 0,1, 3, 5, 4    
]
fechas = pd.date_range(start='2025-03-01', periods=len(historial_compras), freq='D')
serie = pd.Series(historial_compras, index=fechas)

# === Ruta de recomendación con SARIMAX usando productos reales ===
@app.route('/', methods=['GET'])
def sugerencia():
    if len(serie) < 5:
        return jsonify({"error": "Aún no hay suficiente historial 🍞"})

    # Predecir con SARIMAX
    modelo = SARIMAX(serie, order=(1, 1, 0), seasonal_order=(0, 0, 0, 0))
    resultado = modelo.fit(disp=False)
    prediccion = round(resultado.forecast(steps=1)[0])
    prediccion = int(prediccion)

    # Obtener productos reales
    productos = obtener_productos()

    if not productos:
        return jsonify({"error": "No se pudieron cargar los productos"})

    if prediccion >= len(productos):
        return jsonify({"error": "No hay producto con ese índice"})

    producto = productos[prediccion]

    return jsonify({
        "producto_id": producto.get("id"),
        "nombre": producto.get("nombre"),
        "descripcion": producto.get("descripcion") or "Sin descripción",
        "imagen_url": producto.get("imagen_url")
    })


# === Ruta para ver todos los productos directamente ===
@app.route('/productos', methods=['GET'])
def mostrar_productos():
    productos = obtener_productos()
    return jsonify(productos)

# === Correr servidor ===
if __name__ == '__main__':
    app.run(port=5000, debug=True)

