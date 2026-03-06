const { getAll, create, getOne, remove, update } = require('../controllers/programaSuperior.controllers');
const express = require('express');

const programaSuperiorRouter = express.Router();

programaSuperiorRouter.route('/programa-superior')
    .get(getAll)
    .post(create);

programaSuperiorRouter.route('/programa-superior/:id')
    .get(getOne)
    .delete(remove)
    .put(update);

module.exports = programaSuperiorRouter;