const User = require("./User");
const EmailCode = require("./EmailCode");
const Inscripcion = require("./Inscripcion");
const Course = require("./Course");
const Pagos = require("./Pagos");
const Certificado = require('../models/Certificado');
const ProgramaInscripciones = require("./ProgramaInscripciones");
const ProgramasSuperiores = require("./ProgramasSuperiores");
const ProgramaPagos = require("./ProgramaPagos");
const Seguimiento = require("./Seguimiento");


EmailCode.belongsTo(User);
User.hasOne(EmailCode);

Inscripcion.belongsTo(Course);
Course.hasOne(Inscripcion);

Pagos.belongsTo(Inscripcion);
Inscripcion.hasOne(Pagos);

Inscripcion.belongsTo(User);
User.hasOne(Inscripcion);

// user.model.js
// Certificado.belongsTo(User, { foreignKey: "cedula", targetKey: "cI" });
// User.hasMany(Certificado, { foreignKey: "cedula", sourceKey: "cI" });

Certificado.belongsTo(Inscripcion);
Inscripcion.hasMany(Certificado);


ProgramaInscripciones.belongsTo(ProgramasSuperiores);
ProgramasSuperiores.hasOne(ProgramaInscripciones);

ProgramaPagos.belongsTo(ProgramaInscripciones);
ProgramaInscripciones.hasOne(ProgramaPagos);

ProgramaInscripciones.belongsTo(User);
User.hasOne(ProgramaInscripciones);


Inscripcion.hasMany(Seguimiento, {
  foreignKey: "inscripcionId",
  as: "seguimientos",
  onDelete: "CASCADE",
});

Seguimiento.belongsTo(Inscripcion, {
  foreignKey: "inscripcionId",
  as: "inscripcion",
});