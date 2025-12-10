const { getAll, create, getOne, remove, update } = require('../controllers/reporteCertificados.controllers');
const express = require('express');

const reporteRouter = express.Router();

reporteRouter.route('/reporte')
    .get(getAll)
    .post(create);

reporteRouter.route('/reporte/:id')
    .get(getOne)
    .delete(remove)
    .put(update);

module.exports = reporteRouter;