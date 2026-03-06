const catchError = require("../utils/catchError");
const sendEmail = require("../utils/sendEmail");
const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");

const ProgramaPagos = require("../models/ProgramaPagos");
const ProgramaInscripciones = require("../models/ProgramaInscripciones");
const ProgramasSuperiores = require("../models/ProgramasSuperiores");
const User = require("../models/User");

/*
====================================
UTIL
====================================
*/
function numeroOrdinal(n) {
  const mapa = {
    1: "primer",
    2: "segundo",
    3: "tercer",
    4: "cuarto",
    5: "quinto",
    6: "sexto",
    7: "séptimo",
    8: "octavo",
    9: "noveno",
    10: "décimo",
  };

  return mapa[n] || `${n}°`;
}

async function hydratePagos(pagos, { programaId, busqueda } = {}) {
  if (!pagos?.length) return [];

  const inscripcionIds = [
    ...new Set(pagos.map((p) => p.programaInscripcioneId).filter(Boolean)),
  ];

  const inscripciones = await ProgramaInscripciones.findAll({
    where: { id: { [Op.in]: inscripcionIds } },
    attributes: [
      "id",
      "programasSuperioreId",
      "userId",
      "registradoPor",
      "inscritoPor",
      "descuento",
      "totalAPagar",
      "estado",
      "createdAt",
      "updatedAt",
    ],
  });

  let inscripcionesFiltradas = inscripciones.map((i) => i.toJSON());

  if (programaId) {
    inscripcionesFiltradas = inscripcionesFiltradas.filter(
      (i) => String(i.programasSuperioreId) === String(programaId)
    );
  }

  const userIds = [
    ...new Set(inscripcionesFiltradas.map((i) => i.userId).filter(Boolean)),
  ];

  let users = [];
  if (userIds.length) {
    const userWhere = { id: { [Op.in]: userIds } };

    if (busqueda) {
      userWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${busqueda}%` } },
        { lastName: { [Op.iLike]: `%${busqueda}%` } },
        { cI: { [Op.iLike]: `%${busqueda}%` } },
        { email: { [Op.iLike]: `%${busqueda}%` } },
      ];
    }

    users = await User.findAll({
      where: userWhere,
      attributes: ["id", "firstName", "lastName", "cI", "cellular", "email", "grado"],
    });
  }

  const usersMap = new Map(users.map((u) => [String(u.id), u.toJSON()]));

  inscripcionesFiltradas = inscripcionesFiltradas.filter((i) =>
    usersMap.has(String(i.userId))
  );

  const programaIds = [
    ...new Set(inscripcionesFiltradas.map((i) => i.programasSuperioreId).filter(Boolean)),
  ];

  let programas = [];
  if (programaIds.length) {
    programas = await ProgramasSuperiores.findAll({
      where: { id: { [Op.in]: programaIds } },
      attributes: ["id", "nombre", "codigo"],
    });
  }

  const programasMap = new Map(programas.map((p) => [String(p.id), p.toJSON()]));
  const inscripcionesMap = new Map(
    inscripcionesFiltradas.map((i) => [
      String(i.id),
      {
        ...i,
        user: usersMap.get(String(i.userId)) || null,
        programasSuperiore: programasMap.get(String(i.programasSuperioreId)) || null,
      },
    ])
  );

  return pagos
    .map((p) => {
      const pago = p.toJSON();
      const inscripcion = inscripcionesMap.get(String(pago.programaInscripcioneId)) || null;
      if (!inscripcion) return null;

      return {
        ...pago,
        inscripcion,
      };
    })
    .filter(Boolean);
}

async function hydrateInscripcion(inscripcion) {
  if (!inscripcion) return null;

  const raw = inscripcion.toJSON();

  const [user, programa] = await Promise.all([
    raw.userId
      ? User.findByPk(raw.userId, {
          attributes: ["id", "firstName", "lastName", "cI", "cellular", "email", "grado"],
        })
      : null,
    raw.programasSuperioreId
      ? ProgramasSuperiores.findByPk(raw.programasSuperioreId, {
          attributes: ["id", "nombre", "codigo"],
        })
      : null,
  ]);

  return {
    ...raw,
    user: user ? user.toJSON() : null,
    programasSuperiore: programa ? programa.toJSON() : null,
  };
}

/*
====================================
OBTENER TODOS LOS PAGOS DE PROGRAMAS
====================================
*/
const getAll = catchError(async (req, res) => {
  const {
    verificado,
    busqueda,
    fechaInicio,
    fechaFin,
    programaId,
    contificoDocumentoId,
    contificoAutorizacion,
  } = req.query;

  const pagosWhere = {};

  if (verificado === "true") pagosWhere.verificado = true;
  if (verificado === "false") pagosWhere.verificado = false;

  if (contificoDocumentoId === "true") {
    pagosWhere.contificoDocumentoId = { [Op.ne]: null };
  }

  if (contificoAutorizacion === "true") {
    pagosWhere.contificoAutorizacion = { [Op.ne]: null };
  }

  if (fechaInicio || fechaFin) {
    pagosWhere.createdAt = {};
    if (fechaInicio) pagosWhere.createdAt[Op.gte] = new Date(fechaInicio);
    if (fechaFin) {
      const fin = new Date(fechaFin);
      fin.setDate(fin.getDate() + 1);
      pagosWhere.createdAt[Op.lt] = fin;
    }
  }

  const pagos = await ProgramaPagos.findAll({
    where: pagosWhere,
    order: [["createdAt", "DESC"]],
  });

  const results = await hydratePagos(pagos, { programaId, busqueda });

  return res.json(results);
});

/*
====================================
DASHBOARD DE PAGOS DE PROGRAMAS
====================================
*/
const getDashboardPagos = catchError(async (req, res) => {
  const { desde, hasta, programaId, verificado } = req.query;

  const where = {};

  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt[Op.gte] = new Date(desde);
    if (hasta) {
      const hastaDate = new Date(hasta);
      hastaDate.setDate(hastaDate.getDate() + 1);
      where.createdAt[Op.lt] = hastaDate;
    }
  }

  if (verificado === "verificados") where.verificado = true;
  if (verificado === "no_verificados") where.verificado = false;

  const pagosBase = await ProgramaPagos.findAll({
    where,
    order: [["createdAt", "ASC"]],
  });

  const pagos = await hydratePagos(pagosBase, { programaId });

  const totalPagosMonto = pagos.reduce(
    (acc, p) => acc + (Number(p.valorPagado) || 0),
    0
  );

  const totalPagosNum = pagos.length;
  const totalPagosVerificados = pagos.filter((p) => p.verificado).length;
  const totalPagosNoVerificados = pagos.filter((p) => !p.verificado).length;

  const pagosPorFechaMap = {};
  pagos.forEach((p) => {
    const fecha = new Date(p.createdAt);
    fecha.setHours(fecha.getHours() - 5);
    const fechaStr = fecha.toISOString().split("T")[0];
    pagosPorFechaMap[fechaStr] =
      (pagosPorFechaMap[fechaStr] || 0) + (Number(p.valorPagado) || 0);
  });

  const pagosPorFecha = Object.entries(pagosPorFechaMap)
    .map(([fecha, total]) => ({ fecha, total }))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const pagosPorProgramaCount = {};
  pagos.forEach((p) => {
    const nombre = p.inscripcion?.programasSuperiore?.nombre || "Sin programa";
    pagosPorProgramaCount[nombre] = (pagosPorProgramaCount[nombre] || 0) + 1;
  });

  const pagosPorPrograma = Object.entries(pagosPorProgramaCount).map(
    ([programa, cantidad]) => ({ programa, cantidad })
  );

  const pagosPorGradoCount = {};
  pagos.forEach((p) => {
    const grado = p.inscripcion?.user?.grado || "Sin grado";
    pagosPorGradoCount[grado] = (pagosPorGradoCount[grado] || 0) + 1;
  });

  const pagosPorGrado = Object.entries(pagosPorGradoCount).map(
    ([grado, cantidad]) => ({ grado, cantidad })
  );

  return res.json({
    totalPagosMonto,
    totalPagosNum,
    totalPagosVerificados,
    totalPagosNoVerificados,
    pagosPorFecha,
    pagosPorPrograma,
    pagosPorGrado,
  });
});

/*
====================================
VALIDAR INSCRIPCION PARA PAGO
====================================
*/
const validatePago = catchError(async (req, res) => {
  const { cedula, email, programaId } = req.body || {};

  if (!cedula && !email) {
    return res.status(400).json({
      error: "Debe enviar cédula o email",
    });
  }

  const user = await User.findOne({
    where: {
      [Op.or]: [
        cedula ? { cI: cedula } : null,
        email ? { email } : null,
      ].filter(Boolean),
    },
    attributes: ["id", "firstName", "lastName", "cI", "cellular", "email", "grado"],
  });

  if (!user) {
    return res.status(200).json({
      exists: false,
      pagos: [],
      inscripcion: null,
      message: "⚠️ No existe usuario con esa cédula o email",
    });
  }

  const whereInscripcion = { userId: user.id };
  if (programaId) whereInscripcion.programasSuperioreId = programaId;

  const inscripcionBase = await ProgramaInscripciones.findOne({
    where: whereInscripcion,
  });

  if (!inscripcionBase) {
    return res.status(200).json({
      exists: false,
      pagos: [],
      inscripcion: null,
      user: user.toJSON(),
      message: "⚠️ El usuario no está inscrito en ese programa",
    });
  }

  const inscripcion = await hydrateInscripcion(inscripcionBase);

  const pagosBase = await ProgramaPagos.findAll({
    where: { programaInscripcioneId: inscripcion.id },
    order: [["createdAt", "DESC"]],
  });

  const pagos = pagosBase.map((p) => p.toJSON());

  return res.status(200).json({
    exists: true,
    pagos,
    inscripcion,
    user: user.toJSON(),
    message:
      pagos.length > 0
        ? "✅ Inscripción encontrada con pagos registrados"
        : "✅ Inscripción encontrada, aún no tiene pagos",
  });
});

/*
====================================
CREAR PAGO DE PROGRAMA
====================================
*/
const create = catchError(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Debes subir un archivo" });
  }

  const {
    programaInscripcioneId,
    valorPagado,
    moneda,
    entidad,
    idDeposito,
    verificado,
    observacion,
    usuarioEdicion,
  } = req.body;

  if (!programaInscripcioneId) {
    return res.status(400).json({ message: "programaInscripcioneId es requerido" });
  }

  const url = req.fileUrl;

  const inscripcion = await ProgramaInscripciones.findByPk(programaInscripcioneId);

  if (!inscripcion) {
    return res.status(404).json({ message: "Inscripción no encontrada" });
  }

  const [user, programa] = await Promise.all([
    User.findByPk(inscripcion.userId, {
      attributes: ["id", "firstName", "lastName", "cI", "cellular", "email", "grado"],
    }),
    ProgramasSuperiores.findByPk(inscripcion.programasSuperioreId, {
      attributes: ["id", "nombre", "codigo"],
    }),
  ]);

  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado en la inscripción" });
  }

  if (
    entidad &&
    String(entidad).trim() !== "" &&
    idDeposito &&
    String(idDeposito).trim() !== ""
  ) {
    const existe = await ProgramaPagos.findOne({
      where: {
        entidad,
        idDeposito,
      },
    });

    if (existe) {
      return res.status(400).json({
        message:
          "Ya existe un pago registrado con ese ID de depósito para la entidad seleccionada.",
      });
    }
  }

  const result = await ProgramaPagos.create({
    programaInscripcioneId,
    valorPagado,
    moneda,
    entidad,
    idDeposito,
    pagoUrl: url,
    verificado,
    observacion,
    usuarioEdicion,
  });

  const totalPagosInscripcion = await ProgramaPagos.count({
    where: { programaInscripcioneId },
  });

  const ordinal = numeroOrdinal(totalPagosInscripcion);

  await sendEmail({
    to: user.email,
    subject: `✅ Confirmación de ${ordinal} pago registrado - EDUKA`,
    html: `
  <div style="font-family: Arial, sans-serif; background-color: #f0f8ff; padding: 20px; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); overflow: hidden;">
      
      <div style="text-align: center; background-color: #1B326B; padding: 20px;">
        <img src="https://res.cloudinary.com/desgmhmg4/image/upload/v1765358711/eduka_2026_kh3h9e.png" alt="EDUKA" style="width: 150px;" />
      </div>

      <div style="padding: 30px; text-align: center;">
        <h2 style="color: #1B326B;">¡Hola ${user.firstName} ${user.lastName}!</h2>

        <p style="font-size: 16px; line-height: 1.6;">
          Te confirmamos que tu <strong>${ordinal} pago</strong> ha sido registrado correctamente para el programa:
        </p>

        <p style="font-size: 18px; font-weight: bold; color: #1B326B;">
          ${programa?.nombre || "Programa Superior"}
        </p>

        <p style="font-size: 16px; line-height: 1.6;">
          <strong>Valor registrado:</strong> $${Number(valorPagado || 0).toFixed(2)}
        </p>

        <p style="font-size: 16px; line-height: 1.6;">
          Este pago ya fue validado por administración. Tu factura electrónica será enviada posteriormente a este mismo correo.
        </p>

        <div style="margin-top: 30px;">
          <a href="${url}" target="_blank" style="background-color: #1B326B; color: white; padding: 12px 20px; border-radius: 5px; text-decoration: none;">
            Ver comprobante registrado
          </a>
        </div>

        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          Si tienes alguna inquietud, comunícate con nuestro equipo de soporte.
        </p>
      </div>

      <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #999;">
        © ${new Date().getFullYear()} EDUKA. Todos los derechos reservados.
      </div>

    </div>
  </div>
    `,
  });

  const io = req.app.get("io");
  if (io) io.emit("programaPagoCreado", result);

  return res.status(201).json(result);
});

/*
====================================
OBTENER UN PAGO
====================================
*/
const getOne = catchError(async (req, res) => {
  const { id } = req.params;

  const pago = await ProgramaPagos.findByPk(id);

  if (!pago) return res.sendStatus(404);

  const hydrated = await hydratePagos([pago]);
  return res.json(hydrated[0] || pago);
});

/*
====================================
ELIMINAR PAGO
====================================
*/
const remove = catchError(async (req, res) => {
  const { id } = req.params;
  const pago = await ProgramaPagos.findByPk(id);

  if (!pago) {
    return res.status(400).json({ message: "No existe el ID" });
  }

  if (pago.pagoUrl) {
    const imagePath = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      "pagos",
      path.basename(pago.pagoUrl)
    );

    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error("Error al eliminar el archivo:", err);
      }
    });
  }

  await pago.destroy();

  return res.sendStatus(204);
});

/*
====================================
ACTUALIZAR PAGO
====================================
*/
const update = catchError(async (req, res) => {
  const { id } = req.params;

  const pagoOriginal = await ProgramaPagos.findByPk(id);

  if (!pagoOriginal) {
    return res.status(404).json({ message: "Pago no encontrado" });
  }

  const entidadFinal =
    req.body.entidad !== undefined ? req.body.entidad : pagoOriginal.entidad;

  const idDepositoFinal =
    req.body.idDeposito !== undefined
      ? req.body.idDeposito
      : pagoOriginal.idDeposito;

  if (
    entidadFinal !== undefined &&
    entidadFinal !== null &&
    String(entidadFinal).trim() !== "" &&
    idDepositoFinal !== undefined &&
    idDepositoFinal !== null &&
    String(idDepositoFinal).trim() !== ""
  ) {
    const existe = await ProgramaPagos.findOne({
      where: {
        entidad: entidadFinal,
        idDeposito: idDepositoFinal,
        id: { [Op.ne]: id },
      },
    });

    if (existe) {
      return res.status(400).json({
        message:
          "Ya existe un pago registrado con ese ID de depósito para la entidad seleccionada.",
      });
    }
  }

  let pagosActualizados;

  try {
    const [rowsUpdated, updated] = await ProgramaPagos.update(req.body, {
      where: { id },
      returning: true,
    });

    if (rowsUpdated === 0) {
      return res.status(404).json({ message: "Pago no encontrado" });
    }

    pagosActualizados = updated;
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        message:
          "Ya existe un pago registrado con ese ID de depósito para la entidad seleccionada.",
      });
    }
    throw error;
  }

  const pagoActualizado = pagosActualizados[0];

  const io = req.app.get("io");
  if (io) io.emit("programaPagoActualizado", pagoActualizado);

  return res.json(pagoActualizado);
});

module.exports = {
  getAll,
  getDashboardPagos,
  validatePago,
  create,
  getOne,
  remove,
  update,
};