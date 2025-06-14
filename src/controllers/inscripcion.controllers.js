const catchError = require("../utils/catchError");
const sendEmail = require("../utils/sendEmail");
const Inscripcion = require("../models/Inscripcion");

const getAll = catchError(async (req, res) => {
  const results = await Inscripcion.findAll();
  return res.json(results);
});

const create = catchError(async (req, res) => {
  const result = await Inscripcion.create(req.body);
  const { email, nombres, apellidos } = req.body;


  await sendEmail({
    to: email,
    subject: "Inscripción confirmada - EDUKA",
    html: `
  <div style="font-family: Arial, sans-serif; background-color: #f0f8ff; padding: 20px; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); overflow: hidden;">
      
      <!-- Encabezado con logo -->
      <div style="text-align: center; background-color: #007BFF; padding: 20px;">
        <img src="https://res.cloudinary.com/desgmhmg4/image/upload/v1747890355/eduka_sf_gaus5o.png" alt="EDUKA" style="width: 150px;" />
      </div>

      <!-- Cuerpo del mensaje -->
      <div style="padding: 30px; text-align: center;">
        <h1 style="color: #007BFF;">¡Hola ${nombres} ${apellidos}!</h1>
        <h2 style="font-weight: normal;">Felicitaciones por inscribirte en nuestro curso</h2>
        <h2 style="color: #007BFF;">"ANÁLISIS EN CONDUCTA CRIMINAL Y VICTIMOLOGÍA"</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Estamos emocionados de que hayas elegido este curso para ampliar tus conocimientos. Próximamente recibirás en este correo las credenciales y detalles necesarios para acceder a la plataforma al inicio del curso.
        </p>
        <p style="font-size: 16px; line-height: 1.6;">
          Mantente atento/a a tu bandeja de entrada y, por favor, no dudes en contactarnos si tienes alguna pregunta.
        </p>

        <!-- Mensaje adicional -->
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          Si no realizaste esta inscripción, por favor comunícate con nosotros de inmediato.
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
  const result = await Inscripcion.findByPk(id);
  if (!result) return res.sendStatus(404);
  return res.json(result);
});

const remove = catchError(async (req, res) => {
  const { id } = req.params;
  await Inscripcion.destroy({ where: { id } });
  return res.sendStatus(204);
});

const update = catchError(async (req, res) => {
  const { id } = req.params;
  const result = await Inscripcion.update(req.body, {
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
