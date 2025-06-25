const catchError = require("../utils/catchError");
const path = require("path");
const fs = require("fs");
const Pagos = require("../models/Pagos");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../utils/cloudinary");

const getAll = catchError(async (req, res) => {
  const results = await Pagos.findAll();
  return res.json(results);
});

const create = catchError(async (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: "debes subir un archivo" });
  const {
    inscripcionId,
    curso,
    valorDepositado,
    confirmacion,
    verificado,
    distintivo,
    moneda,
  } = req.body;
  const url = req.fileUrl;

  const result = await Pagos.create({
    inscripcionId,
    curso,
    valorDepositado,
    confirmacion,
    verificado,
    distintivo,
    moneda,
    pagoUrl: url,
  });
  return res.status(201).json(result);
});

const getOne = catchError(async (req, res) => {
  const { id } = req.params;
  const result = await Pagos.findByPk(id);
  if (!result) return res.sendStatus(404);
  return res.json(result);
});

const remove = catchError(async (req, res) => {
  const { id } = req.params;
  const Pago = await Pagos.findByPk(id);
  if (!Pago) return res.status(400).json({ message: "No existe el ID" });

  if (Pago.pagoUrl) {
    const imagePath = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      "pagos",
      path.basename(Pago.pagoUrl)
    );

    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error("Error al eliminar el archivo:", err);
        return res
          .status(500)
          .json({ message: "Error al eliminar el archivo" });
      }
    });
  }
  await Pago.destroy();

  return res.sendStatus(204);
});

const update = catchError(async (req, res) => {
  const { id } = req.params;
  const result = await Pagos.update(req.body, {
    where: { id },
    returning: true,
  });
  if (result[0] === 0) return res.sendStatus(404);
  return res.json(result[1][0]);
});

module.exports = {
  getAll,
  create,
  getOne,
  remove,
  update,
};
