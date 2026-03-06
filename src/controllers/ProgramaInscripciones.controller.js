const catchError = require("../utils/catchError");
const { Op, fn, col } = require("sequelize");

const ProgramaInscripciones = require("../models/ProgramaInscripciones");
const ProgramasSuperiores = require("../models/ProgramasSuperiores");
const ProgramaPagos = require("../models/ProgramaPagos");
const User = require("../models/User");


/*
====================================
OBTENER TODAS LAS INSCRIPCIONES
====================================
*/
const getAll = catchError(async (req, res) => {

  const results = await ProgramaInscripciones.findAll({

    include: [
      {
        model: User,
        attributes: ["firstName", "lastName", "cI", "grado", "email"],
      },
      {
        model: ProgramasSuperiores,
        attributes: ["nombre", "codigo"],
      },
      {
        model: ProgramaPagos,
        attributes: ["valorPagado", "verificado"],
      }
    ],

    order: [["createdAt", "DESC"]]

  });

  return res.json(results);

});


const validateOrCreateUser = catchError(async (req, res) => {

  const {
    cedula,
    email,
    nombres,
    apellidos,
    celular
  } = req.body;

  if (!cedula && !email) {
    return res.status(400).json({
      message: "Debe enviar cédula o email"
    });
  }

  let user = await User.findOne({
    where: {
      [Op.or]: [
        { email },
        { cI: cedula }
      ]
    }
  });

  // SI EXISTE USUARIO
  if (user) {

    return res.json({
      exists: true,
      user
    });

  }

  // SI NO EXISTE -> CREAR
  user = await User.create({

    cI: cedula,
    email,
    firstName: nombres,
    lastName: apellidos,
    cellular: celular

  });

  return res.json({
    exists: false,
    user
  });

});


/*
====================================
CREAR INSCRIPCION A PROGRAMA
====================================
*/
const create = catchError(async (req, res) => {

  const {
    userId,
    programasSuperioreId,
    registradoPor,
    inscritoPor,
    descuento,
    totalAPagar
  } = req.body;

  const inscripcion = await ProgramaInscripciones.create({

    userId,
    programasSuperioreId,
    registradoPor,
    inscritoPor,
    descuento,
    totalAPagar

  });

  const io = req.app.get("io");

  if (io) {
    io.emit("programaInscripcionCreada", inscripcion);
  }

  return res.status(201).json(inscripcion);

});


/*
====================================
OBTENER UNA INSCRIPCION
====================================
*/
const getOne = catchError(async (req, res) => {

  const { id } = req.params;

  const result = await ProgramaInscripciones.findByPk(id, {

    include: [
      {
        model: User,
        attributes: ["firstName", "lastName", "email"],
      },
      {
        model: ProgramasSuperiores,
        attributes: ["nombre", "codigo"],
      },
      {
        model: ProgramaPagos,
      }
    ]

  });

  if (!result) return res.sendStatus(404);

  return res.json(result);

});


/*
====================================
ACTUALIZAR INSCRIPCION
====================================
*/
const update = catchError(async (req, res) => {

  const { id } = req.params;

  const result = await ProgramaInscripciones.update(req.body, {
    where: { id },
    returning: true
  });

  if (result[0] === 0)
    return res.status(404).json({ message: "Inscripción no encontrada" });

  const updated = result[1][0];

  const io = req.app.get("io");

  if (io) io.emit("programaInscripcionActualizada", updated);

  return res.json(updated);

});


/*
====================================
ELIMINAR INSCRIPCION
====================================
*/
const remove = catchError(async (req, res) => {

  const { id } = req.params;

  await ProgramaInscripciones.destroy({
    where: { id }
  });

  return res.sendStatus(204);

});


/*
====================================
MINI DASHBOARD PROGRAMAS
====================================
*/
const getDashboard = catchError(async (req, res) => {

  const totalInscritos = await ProgramaInscripciones.count();

  const activos = await ProgramaInscripciones.count({
    where: { estado: "activo" }
  });

  const finalizados = await ProgramaInscripciones.count({
    where: { estado: "finalizado" }
  });

  const totalPagado = await ProgramaPagos.sum("valorPagado", {
    where: { verificado: true }
  });

  const pagosPendientes = await ProgramaPagos.count({
    where: { verificado: false }
  });

  return res.json({

    totalInscritos,
    activos,
    finalizados,
    totalPagado: totalPagado || 0,
    pagosPendientes

  });

});


module.exports = {

  getAll,
  create,
  getOne,
  update,
  remove,
  getDashboard,
  validateOrCreateUser

};