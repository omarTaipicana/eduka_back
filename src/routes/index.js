const express = require('express');
const userRouter = require('./user.router');
const senpladesRouter = require('./senplades.router');
const variablesRouter = require('./variables.router');
const router = express.Router();

// colocar las rutas aquí
router.use(userRouter)
router.use(senpladesRouter)
router.use(variablesRouter)

module.exports = router;