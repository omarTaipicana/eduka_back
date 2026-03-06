const {
  getAll,
  getDashboardPagos,
  validatePago,
  create,
  getOne,
  remove,
  update,
} = require("../controllers/programaPagos.controllers");
const upload = require("../utils/multer")

const express = require("express");
const verifyJWT = require("../utils/verifyJWT");

const programaPagosRouter = express.Router();

programaPagosRouter.post("/programa-pagos/validate", verifyJWT, validatePago);

programaPagosRouter.get("/programa-pagos/dashboard", verifyJWT, getDashboardPagos);

programaPagosRouter.route("/programa-pagos")
  .get(verifyJWT, getAll)
  .post(upload.upload.single("imagePago"), upload.generateFileUrl, create);

programaPagosRouter.route("/programa-pagos/:id")
  .get(verifyJWT, getOne)
  .delete(verifyJWT, remove)
  .put(verifyJWT, update);

module.exports = programaPagosRouter;