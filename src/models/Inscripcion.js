const { DataTypes } = require("sequelize");
const sequelize = require("../utils/connection");

const Inscripcion = sequelize.define("inscripcion", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  grado: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  nombres: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  apellidos: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cedula: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  celular: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subsistema: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  aceptacion: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  curso: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  observacion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  usuarioEdicion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Inscripcion;
