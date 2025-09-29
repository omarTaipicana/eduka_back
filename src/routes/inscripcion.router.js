const { getAll, getDashboardInscripciones, validateUser, create, getOne, remove, update } = require('../controllers/inscripcion.controllers');
const express = require('express');

const inscripcionRouter = express.Router();

inscripcionRouter.route('/inscripcion')
    .get(getAll)
    .post(create);

inscripcionRouter.route('/inscripcion_dashboard')
    .get(getDashboardInscripciones)

inscripcionRouter.route('/validate')
    .post(validateUser);

inscripcionRouter.route('/inscripcion/:id')
    .get(getOne)
    .delete(remove)
    .put(update);

module.exports = inscripcionRouter;