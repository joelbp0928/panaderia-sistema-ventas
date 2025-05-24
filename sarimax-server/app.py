from flask import Flask, request, jsonify
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX
from flask_cors import CORS
import requests
#import psycopg2
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
    
     # 1. Obtener categorías visibles
    url_categorias = f"{SUPABASE_URL}/rest/v1/categorias"
    params_cat = {
        "visible_cliente": "eq.true",
        "select": "id"
    }

    res_cat = requests.get(url_categorias, headers=headers, params=params_cat)
    if res_cat.status_code != 200:
        print("❌ Error al obtener categorías:", res_cat.text)
        return []

    categorias_visibles = {cat["id"] for cat in res_cat.json()}
    print("✅ Categorías visibles:", categorias_visibles)

    # 2. Obtener todos los productos
    url_productos = f"{SUPABASE_URL}/rest/v1/productos"
    params_prod = {
        "select": "id,nombre,descripcion,imagen_url,categoria_id"
    }

    res_prod = requests.get(url_productos, headers=headers, params=params_prod)
    if res_prod.status_code != 200:
        print("❌ Error al obtener productos:", res_prod.text)
        return []

    productos = res_prod.json()

    # 3. Filtrar productos por categoría visible
    productos_filtrados = [
        p for p in productos if p["categoria_id"] in categorias_visibles
    ]
    
    productos_ocultos = [
        p for p in productos if p["categoria_id"] not in categorias_visibles
    ]
    
    print("🚫 Productos ocultos al cliente:", productos_ocultos)

    return productos_filtrados
    
    
#obetenr el historial del cliente
def obtener_historial_cliente(cliente_id):
    url = f"{SUPABASE_URL}/rest/v1/rpc/obtener_historial_cliente"  # ✅

    
    headers = {
        "apikey": SUPABASE_API_KEY,
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    #params = {
     #   "select": "producto_id,fecha_compra",
      #  "cliente_id": f"eq.{cliente_id}",
       # "order": "fecha_compra"
    #}
    payload = {
        "p_cliente_id": cliente_id
    }

    # Solo para depurar (puedes quitar después)
    print(f"📌 Cliente ID enviado a Supabase: {cliente_id}")
    #query_string = urlencode(params)
    #print(f"🌐 URL completa: {url}?{query_string}")

    #response = requests.get(url, headers=headers, params=params)
    response = requests.post(url, headers=headers, json=payload)


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
    
    productos = obtener_productos()

    mapeo_producto_global = {p["id"]: i for i, p in enumerate(productos)}
    mapeo_inverso_global = {i: p["id"] for i, p in enumerate(productos)}

    historial = obtener_historial_cliente(cliente_id)

    if len(historial) < 5:
        return jsonify({
        "estado": "sin_historial",
        "mensaje": "Sigue comprando para poder darte sugerencias personalizadas 🍞"
    })


    # Paso 1: Extrae fechas y producto_id (UUID)
    fechas = pd.to_datetime(
        [x['fecha'] for x in historial],
        format="%H:%M:%S.%f%z",  # O ajusta este formato si cambia el tipo
        errors='coerce'
    )
    producto_ids = [x['producto_id'] for x in historial]

    # Paso 2: Mapeo UUID → número
    
    
    producto_ids_numericos = [
        mapeo_producto_global[pid] for pid in producto_ids if pid in mapeo_producto_global
    ]

    
    print("📦 Mapeo de producto (UUID → número):")
    for k, v in mapeo_producto_global.items():
        print(f"{k} => {v}")

    # Paso 3: Serie con fechas como índice y producto como número
    serie = pd.Series(producto_ids_numericos, index=fechas)
    print("Serie: ", serie)

    # SARIMAX con la serie
    modelo = SARIMAX(serie, order=(1, 1, 0), seasonal_order=(0, 0, 0, 0))
    resultado = modelo.fit(disp=False)
    
    predicciones = resultado.forecast(steps=3).round().astype(int).tolist()
    #predicho_redondeado = round(prediccion)

    # Paso 4: Inverso del mapeo (número → UUID)
    producto_uuids_predichos = [
        mapeo_inverso_global.get(p) for p in predicciones if p in mapeo_inverso_global
]

    
    print("\n🔄 Mapeo inverso (número → UUID):")
    for k, v in mapeo_inverso_global.items():
        print(f"{k} => {v}")
    
    print("🎯 Predicciones UUIDs:", producto_uuids_predichos)

    # Obtener todos los productos de Supabase para mostrar datos
    #productos = obtener_productos()
    
    # Filtrar productos seguros
    sugerencias_seguras = []
    for uuid in producto_uuids_predichos:
        if pan_es_seguro(uuid, cliente_id):
            sugerido = next((p for p in productos if p['id'] == uuid), None)
            if sugerido:
                sugerencias_seguras.append(sugerido)
            
            
    sugerencias_seguras_unicas = []
    uuids_agregados = set()
       
    if len(sugerencias_seguras_unicas) < 3:
        for producto in productos:
            if producto["id"] in uuids_agregados:
                continue  # ya lo tienes
            if not pan_es_seguro(producto["id"], cliente_id):
                continue  # no es seguro
            sugerencias_seguras_unicas.append(producto)
            uuids_agregados.add(producto["id"])
            if len(sugerencias_seguras_unicas) >= 3:
             break

    # Enviar solo los primeros 3 únicos y seguros
    print("🔍 Sugerencias después del filtrado:", sugerencias_seguras_unicas)        
            

    if sugerencias_seguras:
        return jsonify({"sugerencias": sugerencias_seguras})
        
    else:
        return jsonify({
            "sugerencias": [],
            "mensaje": "No se encontraron productos seguros según tus preferencias."
        })
        
    

    
    #producto_sugerido = next((p for p in productos if p['id'] == producto_uuid_predicho), None)

    #if producto_sugerido:
    #    return jsonify(producto_sugerido)
    #else:
     #   return jsonify({"sugerencia": "Pan sorpresa 🎁"})
    
def pan_es_seguro(producto_id, cliente_id):
    # Headers base para la API
    headers = {
        "apikey": SUPABASE_API_KEY,
        "Authorization": f"Bearer {SUPABASE_API_KEY}",
        "Content-Type": "application/json"
    }

    # 1. Obtener ingredientes del producto
    url_ingredientes = f"{SUPABASE_URL}/rest/v1/productos_ingredientes"
    params_ing = {
        "producto_id": f"eq.{producto_id}",
        "select": "ingrediente_id"
    }
    res_ing = requests.get(url_ingredientes, headers=headers, params=params_ing)
    ingredientes_producto = [r['ingrediente_id'] for r in res_ing.json()]

    # 2. Obtener alergias del cliente
    url_alergias = f"{SUPABASE_URL}/rest/v1/alergias"
    params_al = {
        "cliente_id": f"eq.{cliente_id}",
        "select": "ingrediente_id"
    }
    res_al = requests.get(url_alergias, headers=headers, params=params_al)
    ingredientes_alergicos = [r['ingrediente_id'] for r in res_al.json()]

    # 3. Comparar
    return not set(ingredientes_producto) & set(ingredientes_alergicos)

@app.route('/productos_visibles', methods=['GET'])
def productos_visibles():
    productos = obtener_productos()  # Esta ya los filtra correctamente
    return jsonify(productos)

# === Ruta para ver todos los productos directamente ===
@app.route('/productos', methods=['GET'])
def mostrar_productos():
    productos = obtener_productos()
    return jsonify(productos)


@app.route('/predicciones_diarias', methods=['GET'])
def predicciones_diarias():
    try:
        # 1. Obtener datos reales desde Supabase
        url = f"{SUPABASE_URL}/rest/v1/ventas_diarias"
        headers = {
            "apikey": SUPABASE_API_KEY,
            "Authorization": f"Bearer {SUPABASE_API_KEY}",
            "Content-Type": "application/json"
        }
        params = { "select": "fecha,ventas_totales" }

        response = requests.get(url, headers=headers, params=params)
        data = response.json()

        df = pd.DataFrame(data)
        df['fecha'] = pd.to_datetime(df['fecha'])
        df = df.sort_values('fecha')
        df.set_index('fecha', inplace=True)

        # 2. Modelo SARIMAX
        model = SARIMAX(df['ventas_totales'], order=(1, 1, 1), seasonal_order=(1, 1, 1, 7))
        results = model.fit(disp=False)

        # 3. Generar fechas futuras manualmente
        last_date = df.index[-1]
        forecast_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=7, freq='D')

        # 4. Crear DataFrame con fechas + predicciones
        pred = results.get_forecast(steps=7)
        pred_df = pd.DataFrame({
            'fecha': forecast_dates,
            'prediccion': pred.predicted_mean.values
        })

        # 5. Formatear fechas para el frontend
        pred_df['fecha'] = pred_df['fecha'].dt.strftime('%Y-%m-%d')

        return jsonify(pred_df.to_dict(orient='records'))

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predicciones_semanales', methods=['GET'])
def predicciones_semanales():
    try:
        # 1. Obtener datos semanales desde Supabase
        url = f"{SUPABASE_URL}/rest/v1/ventas_semanales"
        headers = {
            "apikey": SUPABASE_API_KEY,
            "Authorization": f"Bearer {SUPABASE_API_KEY}",
            "Content-Type": "application/json"
        }
        params = { "select": "semana,año,ventas_totales" }

        response = requests.get(url, headers=headers, params=params)
        data = response.json()

        df = pd.DataFrame(data)

        # 2. Construir fecha desde semana y año (lunes de cada semana)
        df['fecha'] = pd.to_datetime(df['año'].astype(str) + df['semana'].astype(str) + '1', format='%G%V%u')
        df = df.sort_values('fecha')
        df.set_index('fecha', inplace=True)

        # 3. Modelo SARIMAX
        model = SARIMAX(df['ventas_totales'], order=(1, 1, 1), seasonal_order=(1, 1, 1, 52))
        results = model.fit(disp=False)

        # 4. Fechas de predicción semanales (cada lunes)
        last_date = df.index[-1]
        forecast_dates = pd.date_range(start=last_date + pd.Timedelta(weeks=1), periods=7, freq='W-MON')

        # 5. Crear DataFrame con resultados
        pred = results.get_forecast(steps=7)
        pred_df = pd.DataFrame({
            'fecha': forecast_dates,
            'prediccion': pred.predicted_mean.values
        })

        # 6. Formatear fechas para el frontend
        pred_df['fecha'] = pred_df['fecha'].dt.strftime('%Y-%m-%d')

        return jsonify(pred_df.to_dict(orient='records'))

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predicciones_mensuales', methods=['GET'])
def predicciones_mensuales():
    try:
        # 1. Obtener datos desde Supabase
        url = f"{SUPABASE_URL}/rest/v1/ventas_mensuales"
        headers = {
            "apikey": SUPABASE_API_KEY,
            "Authorization": f"Bearer {SUPABASE_API_KEY}",
            "Content-Type": "application/json"
        }
        params = { "select": "mes,año,ventas_totales" }

        response = requests.get(url, headers=headers, params=params)
        data = response.json()

        # 2. Convertir a DataFrame y construir la fecha
        df = pd.DataFrame(data)
        df['fecha'] = pd.to_datetime(df['año'].astype(str) + '-' + df['mes'].astype(str) + '-01')
        df = df.sort_values('fecha')
        df.set_index('fecha', inplace=True)

        # 3. Aplicar modelo SARIMAX
        model = SARIMAX(df['ventas_totales'], order=(1, 1, 1), seasonal_order=(1, 1, 1, 12))
        results = model.fit(disp=False)

        # 4. Generar fechas futuras mensuales
        last_date = df.index[-1]
        forecast_dates = pd.date_range(start=last_date + pd.DateOffset(months=1), periods=6, freq='MS')

        pred = results.get_forecast(steps=6)
        pred_df = pd.DataFrame({
            'fecha': forecast_dates,
            'prediccion': pred.predicted_mean.values
        })

        pred_df['fecha'] = pred_df['fecha'].dt.strftime('%Y-%m-%d')

        return jsonify(pred_df.to_dict(orient='records'))

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# === Correr servidor ===
if __name__ == '__main__':
    app.run(port=5000, debug=True)





