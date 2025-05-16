from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_API_KEY
import requests

app = Flask(__name__)
CORS(app)  # permite peticiones desde frontend en otro puerto

@app.route('/')
def index():
    return "¡La app está viva!"

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




if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))  # Azure usa su propio puerto
    app.run(host='0.0.0.0', port=port)

