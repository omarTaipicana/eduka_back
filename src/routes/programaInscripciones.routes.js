const {
  getAll,
  create,
  getOne,
  remove,
  update,
  getDashboard,
  validateOrCreateUser
} = require("../controllers/ProgramaInscripciones.controller");

const express = require("express");
const verifyJWT = require("../utils/verifyJWT");

const programaInscripcionesRouter = express.Router();

/*
==============================
VALIDAR O CREAR USUARIO
==============================
*/
programaInscripcionesRouter.post(
  "/programa-inscripciones/validate-user",
  verifyJWT,
  validateOrCreateUser
);

/*
==============================
DASHBOARD
==============================
*/
programaInscripcionesRouter.get(
  "/programa-inscripciones/dashboard",
  verifyJWT,
  getDashboard
);

/*
==============================
CRUD
==============================
*/

programaInscripcionesRouter.route("/programa-inscripciones")
  .get(verifyJWT, getAll)
  .post(verifyJWT, create);

programaInscripcionesRouter.route("/programa-inscripciones/:id")
  .get(verifyJWT, getOne)
  .delete(verifyJWT, remove)
  .put(verifyJWT, update);

module.exports = programaInscripcionesRouter;