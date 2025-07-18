const catchError = require("../utils/catchError");
const sendEmail = require("../utils/sendEmail");
const path = require("path");
const fs = require("fs");
const Pagos = require("../models/Pagos");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../utils/cloudinary");
const Inscripcion = require("../models/Inscripcion");
const Course = require("../models/Course");

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
    entregado,
    observacion,
    usuarioEdicion,
  } = req.body;
  const url = req.fileUrl;

  const inscrito = await Inscripcion.findByPk(inscripcionId);
  const cursoData = await Course.findByPk(inscrito.courseId);
  const result = await Pagos.create({
    inscripcionId,
    curso,
    valorDepositado,
    confirmacion,
    verificado,
    distintivo,
    moneda,
    entregado,
    observacion,
    usuarioEdicion,
    pagoUrl: url,
  });

  const incluyeMoneda =
    moneda === true || moneda === "true" || moneda === 1 || moneda === "1";
  const incluyeDistintivo =
    distintivo === true ||
    distintivo === "true" ||
    distintivo === 1 ||
    distintivo === "1";

  await sendEmail({
    to: inscrito.email,
    subject: "✅ Pago registrado - EDUKA",
    html: `
  <div style="font-family: Arial, sans-serif; background-color: #f0f8ff; padding: 20px; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); overflow: hidden;">
      
      <!-- Encabezado con logo -->
      <div style="text-align: center; background-color: #007BFF; padding: 20px;">
        <img src="https://res.cloudinary.com/desgmhmg4/image/upload/v1747890355/eduka_sf_gaus5o.png" alt="EDUKA" style="width: 150px;" />
      </div>

      <!-- Cuerpo del mensaje -->
      <div style="padding: 30px; text-align: center;">
        <h2 style="color: #007BFF;">¡Hola ${inscrito.nombres} ${
      inscrito.apellidos
    }!</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Hemos recibido tu comprobante de pago por el curso <strong>"${
            cursoData.nombre
          }"</strong>.
        </p>
        <p style="font-size: 16px; line-height: 1.6;">
          <strong>Valor depositado:</strong> $${valorDepositado}
        </p>
        ${
          incluyeMoneda || incluyeDistintivo
            ? `<p style="font-size: 16px; line-height: 1.6;">Incluye: ${[
                incluyeMoneda ? "🪙 Moneda conmemorativa" : "",
                incluyeDistintivo ? "🎖️ Distintivo" : "",
              ]
                .filter(Boolean)
                .join(" y ")}</p>`
            : ""
        }
        <p style="font-size: 16px; line-height: 1.6;">
          Una vez validado el pago, se emitirá tu certificado. En caso de haber solicitado reconocimientos físicos, recibirás otro correo cuando estén disponibles para su retiro.
        </p>

        <!-- Botón para ver comprobante -->
        <div style="margin-top: 30px;">
          <a href="${url}" target="_blank" style="background-color: #007BFF; color: white; padding: 12px 20px; border-radius: 5px; text-decoration: none;">
            Ver comprobante de pago
          </a>
        </div>

        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          Si no realizaste este registro de pago, por favor comunícate con nosotros.
        </p>
      </div>

      <!-- Pie -->
      <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #999;">
        © ${new Date().getFullYear()} EDUKA. Todos los derechos reservados.
      </div>

    </div>
  </div>
  `,
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
