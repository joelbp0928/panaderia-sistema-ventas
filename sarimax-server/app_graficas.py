from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX

app = Flask(__name__)
CORS(app)  # permite peticiones desde frontend en otro puerto

# Función de prueba con datos ficticios
def obtener_df_ventas():
    datos = {
        'fecha': pd.date_range(start='2024-04-01', periods=14, freq='D'),
        'ventas': [150, 120, 130, 180, 170, 200, 160, 155, 140, 185, 190, 210, 205, 220]
    }
    return pd.DataFrame(datos)

@app.route('/predicciones', methods=['GET'])
def predicciones():
    try:
        df = obtener_df_ventas()
        df['fecha'] = pd.to_datetime(df['fecha'])
        df.set_index('fecha', inplace=True)

        model = SARIMAX(df['ventas'], order=(1, 0, 0), seasonal_order=(0, 1, 1, 7))

        results = model.fit(disp=False)

        pred = results.get_forecast(steps=7)
        pred_df = pred.predicted_mean.reset_index()
        pred_df.columns = ['fecha', 'prediccion']

        return jsonify(pred_df.to_dict(orient='records'))
    except Exception as e:
        print("Error:", e)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Servidor de gráficas corriendo en http://localhost:5050")
    app.run(port=5050, debug=True)
