const express = require("express");
const userRouter = require("./user.router");
const senpladesRouter = require("./senplades.router");
const variablesRouter = require("./variables.router");
const inscripcionRouter = require("./inscripcion.router");
const courseRouter = require("./course.router");
const contactanosRouter = require("./contactanos.router");
const router = express.Router();

// colocar las rutas aquí
router.use(userRouter);
router.use(senpladesRouter);
router.use(variablesRouter);
router.use(inscripcionRouter);
router.use(courseRouter);
router.use(contactanosRouter);

module.exports = router;
