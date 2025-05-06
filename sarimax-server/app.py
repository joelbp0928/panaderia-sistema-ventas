from flask import Flask, request, jsonify
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX
from flask_cors import CORS
import requests
from config import SUPABASE_URL, SUPABASE_API_KEY
from urllib.parse import urlencode


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
    
#obetenr el historial del cliente
    


def obtener_historial_cliente(cliente_id):
    url = f"{SUPABASE_URL}/rest/v1/historial_cliente"
    
    headers = {
        "apikey": SUPABASE_API_KEY,
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    params = {
        "select": "producto_id,fecha_compra",
        "cliente_id": f"eq.{cliente_id}",
        "order": "fecha_compra"
    }

    # Solo para depurar (puedes quitar después)
    print(f"📌 Cliente ID enviado a Supabase: {cliente_id}")
    query_string = urlencode(params)
    print(f"🌐 URL completa: {url}?{query_string}")

    response = requests.get(url, headers=headers, params=params)

    print("📦 Status:", response.status_code)
    print("📄 Respuesta cruda:", response.text)

    if response.status_code == 200:
        datos = response.json()
        print("✅ Historial obtenido:", datos)
        return datos
    else:
        print("❌ Error obteniendo historial:", response.text)
        return []





# === Historial de compras inventado (por ahora) ===
#historial_compras = [
#    0, 0, 1, 2, 0, 1, 1, 0, 3, 3, 1, 0, 4, 0, 0, 1, 3, 0, 4, 3, 1, 0,1, 3, 5, 4    
#]


#fechas = pd.date_range(start='2025-03-01', periods=len(historial_compras), freq='D')
#serie = pd.Series(historial_compras, index=fechas)

# === Ruta de recomendación con SARIMAX usando productos reales ===
@app.route('/', methods=['GET'])
def sugerencia():
    cliente_id = request.args.get('cliente_id')  # Se recibe como parámetro en la URL
    print(f"📌 Cliente ID recibido en backend: {cliente_id}")
    if not cliente_id:
        return jsonify({"error": "Falta el cliente_id"}), 400

    historial = obtener_historial_cliente(cliente_id)

    if len(historial) < 5:
        return jsonify({
        "estado": "sin_historial",
        "mensaje": "Sigue comprando para poder darte sugerencias personalizadas 🍞"
    })


    # Paso 1: Extrae fechas y producto_id (UUID)
    fechas = pd.to_datetime(
        [x['fecha_compra'] for x in historial],
        format="%H:%M:%S.%f%z",  # O ajusta este formato si cambia el tipo
        errors='coerce'
    )
    producto_ids = [x['producto_id'] for x in historial]

    # Paso 2: Mapeo UUID → número
    uuid_unicos = list(set(producto_ids))
    mapeo_producto = {uuid: i for i, uuid in enumerate(uuid_unicos)}
    producto_ids_numericos = [mapeo_producto[pid] for pid in producto_ids]
    
    print("📦 Mapeo de producto (UUID → número):")
    for k, v in mapeo_producto.items():
        print(f"{k} => {v}")

    # Paso 3: Serie con fechas como índice y producto como número
    serie = pd.Series(producto_ids_numericos, index=fechas)

    # SARIMAX con la serie
    modelo = SARIMAX(serie, order=(1, 1, 0), seasonal_order=(0, 0, 0, 0))
    resultado = modelo.fit(disp=False)
    prediccion = resultado.forecast(steps=1).iloc[0]
    predicho_redondeado = round(prediccion)

    # Paso 4: Inverso del mapeo (número → UUID)
    mapeo_inverso = {v: k for k, v in mapeo_producto.items()}
    producto_uuid_predicho = mapeo_inverso.get(predicho_redondeado)
    
    print("\n🔄 Mapeo inverso (número → UUID):")
    for k, v in mapeo_inverso.items():
        print(f"{k} => {v}")

    # Obtener todos los productos de Supabase para mostrar datos
    productos = obtener_productos()
    producto_sugerido = next((p for p in productos if p['id'] == producto_uuid_predicho), None)

    if producto_sugerido:
        return jsonify(producto_sugerido)
    else:
        return jsonify({"sugerencia": "Pan sorpresa 🎁"})



# === Ruta para ver todos los productos directamente ===
@app.route('/productos', methods=['GET'])
def mostrar_productos():
    productos = obtener_productos()
    return jsonify(productos)

# === Correr servidor ===
if __name__ == '__main__':
    app.run(port=5000, debug=True)

