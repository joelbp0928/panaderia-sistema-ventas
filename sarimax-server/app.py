from flask import Flask, request, jsonify
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX
from flask_cors import CORS

# 🔥 Crear la app Flask

app = Flask(__name__)
CORS(app)


# === Catálogo de panes inventado ===
catalogo_panes = {
    0: "Concha",
    1: "Cuerno",
    2: "Bolillo",
    3: "Dona",
    4: "Empanada",
    5: "Oreja",
    6: "Pan de Elote",
    7: "Pan Integral",
    8: "Pan de Nuez",
    9: "Mantecada"
}

# === Historial de compras inventado ===
historial_compras = [
    0, 0, 1, 2, 0, 1, 1, 0, 3, 3, 1, 0, 4, 0, 0, 1, 3, 0, 4, 3, 3, 1, 0
]

# Crear serie temporal inventada
fechas = pd.date_range(start='2025-03-01', periods=len(historial_compras), freq='D')
serie = pd.Series(historial_compras, index=fechas)

# === Ruta para obtener la sugerencia ===
@app.route('/', methods=['GET'])
def sugerencia():
    if len(serie) < 5:
        return jsonify({"sugerencia": "Aún no hay suficiente historial 🍞"})

    # Aplicar SARIMAX
    modelo = SARIMAX(serie, order=(1, 1, 0), seasonal_order=(0, 0, 0, 0))
    resultado = modelo.fit(disp=False)
    prediccion = round(resultado.forecast(steps=1)[0])
    prediccion = int(prediccion)

    # Buscar el nombre del pan sugerido
    nombre_pan = catalogo_panes.get(prediccion, "Pan sorpresa 🎁")
    return jsonify({"sugerencia": nombre_pan})

# 🔥 Correr el servidor Flask
if __name__ == '__main__':
    app.run(port=5000, debug=True)
