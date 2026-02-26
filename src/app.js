const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const router = require('./routes');
const errorHandler = require('./utils/errorHandler');
require('dotenv').config();
require("./models")



// Esta es nuestra aplicación
const app = express();

// Middlewares 
// app.use(express.json());

app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      ok: false,
      error: "JSON inválido o body vacío (revisa Postman: no envíes raw JSON vacío)",
    });
  }
  next(err);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(cors());

// Servir la carpeta 'uploads' de forma pública
app.use('/uploads', express.static(path.join(__dirname, "..", "uploads")));

app.use(router);
app.get('/', (req, res) => {
    return res.send("Welcome to express!");
})

// middlewares después de las rutas
app.use(errorHandler)

module.exports = app;
