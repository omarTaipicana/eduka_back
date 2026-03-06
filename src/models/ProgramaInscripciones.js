const { DataTypes } = require("sequelize");
const sequelize = require("../utils/connection");

const ProgramaInscripciones = sequelize.define("programaInscripciones", {

  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  registradoPor: {
    type: DataTypes.UUID,
    allowNull: false,
  },

  inscritoPor: {
    type: DataTypes.ENUM("asociado", "eduka"),
    defaultValue: "eduka",
  },

  descuento: {
    type: DataTypes.DECIMAL(10,2),
    defaultValue: 0,
  },

  totalAPagar: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false,
  },

  estado: {
    type: DataTypes.ENUM("activo", "finalizado", "anulado"),
    defaultValue: "activo",
  },

});

module.exports = ProgramaInscripciones;