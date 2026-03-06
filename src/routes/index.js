const express = require("express");
const userRouter = require("./user.router");
const senpladesRouter = require("./senplades.router");
const variablesRouter = require("./variables.router");
const inscripcionRouter = require("./inscripcion.router");
const courseRouter = require("./course.router");
const contactanosRouter = require("./contactanos.router");
const pagosRouter = require("./pagos.router");
const certificadoRouter = require("./certificado.router");
const userMRouter = require('./userm.router');
const institutoRouter = require("./instituto.routes");
const reporteRouter = require("./reporteCertificados.router");
const contificoRouter = require("./contifico.router");
const programaSuperiorRouter = require("./programaSuperior.router");
const programaInscripcionesRouter = require("./programaInscripciones.routes");
const programaPagosRouter = require("./programaPagos.routes");

const router = express.Router();

// colocar las rutas aquí
router.use(userRouter);
router.use(senpladesRouter);
router.use(variablesRouter);
router.use(inscripcionRouter);
router.use(courseRouter);
router.use(contactanosRouter);
router.use(pagosRouter);
router.use(certificadoRouter);
router.use(userMRouter);
router.use(institutoRouter);
router.use(contificoRouter)
router.use(programaSuperiorRouter)
router.use(programaInscripcionesRouter)
router.use(programaPagosRouter);


module.exports = router;
