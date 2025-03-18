import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-storage.js";

// 🔹 Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB-8scrUCyFBE4xyQkE-onaGiRXhyC5c1w",
    authDomain: "gestor-panaderia.firebaseapp.com",
    projectId: "gestor-panaderia",
    storageBucket: "gestor-panaderia.firebasestorage.app", // // 🔥 CORREGIDO: `.firebasestorage.app` estaba mal
    messagingSenderId: "586199774506",
    appId: "1:586199774506:web:8d615ec44e655d511ada53",
    measurementId: "G-MG29GGQZQZ"
};

// 🔹 Inicializar Firebase
const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

export { storage, ref, uploadBytes, getDownloadURL };
