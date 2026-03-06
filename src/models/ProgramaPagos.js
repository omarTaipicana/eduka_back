const { DataTypes } = require("sequelize");
const sequelize = require("../utils/connection");

const ProgramaPagos = sequelize.define("programaPagos", {

  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  valorPagado: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false,
  },

  moneda: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  entidad: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  idDeposito: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  pagoUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  verificado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  observacion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  usuarioEdicion: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  /*
  ==========================
  CONTIFICO
  ==========================
  */

  contificoDocumentoId: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  contificoDocumentoNumero: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  contificoEstado: {
    type: DataTypes.STRING,
    allowNull: true
  },

  contificoFirmado: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },

  contificoAutorizacion: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  contificoUrlRide: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  contificoUrlXml: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  contificoEmailEnviado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  contificoEmailEnviadoAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

});

module.exports = ProgramaPagos;