// utils/generarCertificado.js

const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const Pagos = require("../models/Pagos");
const Inscripcion = require("../models/Inscripcion");
const User = require("../models/User");
const Course = require("../models/Course");
const Certificado = require("../models/Certificado");

const firmarPdfFirmaEc = require("./firmarPdfFirmaEc");

module.exports = async function generarCertificado(pagoId) {
  console.log("🔥 generarCertificado llamado para pagoId:", pagoId);

  // 1. Traer el pago con sus relaciones
  const pago = await Pagos.findByPk(pagoId, {
    include: [
      {
        model: Inscripcion,
        include: [
          { model: User },
          { model: Course },
        ],
      },
    ],
  });

  if (!pago) throw new Error("Pago no encontrado en generarCertificado");

  const inscripcion = pago.inscripcion || pago.Inscripcion;
  if (!inscripcion) throw new Error("Inscripción no encontrada para este pago");

  const user = inscripcion.user || inscripcion.User;
  if (!user) throw new Error("Usuario no encontrado para esta inscripción");

  const course = inscripcion.course || inscripcion.Course || null;

  // 👇 aquí tomamos en cuenta course.sigla
  const cursoSigla = course?.sigla || "cdp"; // o "general" si quieres un default distinto

  const dataCertificado = {
    pagoId: pago.id,
    inscripcionId: inscripcion.id,
    userId: user.id,
    nombresCompletos: `${user.firstName} ${user.lastName}`,
    cedula: user.cI,
    grado: user.grado,
    cursoCodigo: inscripcion.curso || pago.curso || cursoSigla,
    cursoNombre: course ? course.nombre : (inscripcion.curso || pago.curso || cursoSigla),
    cursoSigla,
    fechaPago: pago.createdAt,
    valorDepositado: pago.valorDepositado,
  };

  console.log("✅ Datos para certificado:", dataCertificado);

  // 2. Ruta de la plantilla según sigla
  // Desde /utils → ../../uploads/templates/template_<sigla>.pdf
// 2. Ruta de plantilla según sigla y grupo (por defecto grupo 1)
const templatesDir = path.join(__dirname, "..", "..", "uploads", "templates");

// 1) Intentar template con grupo 1
const templateGrupo1 = `template_${cursoSigla}_1.pdf`;
let templatePath = path.join(templatesDir, templateGrupo1);

if (fs.existsSync(templatePath)) {
  console.log("🟢 Usando template de grupo 1:", templateGrupo1);
} else {
  // 2) Intentar el template normal sin grupo
  const templateBase = `template_${cursoSigla}.pdf`;
  templatePath = path.join(templatesDir, templateBase);

  if (fs.existsSync(templatePath)) {
    console.log("🟡 Usando template base:", templateBase);
  } else {
    // 3) Último fallback: plantilla genérica
    console.warn("⚠️ No existen plantillas específicas, usando template_general.pdf");
    templatePath = path.join(templatesDir, "template_general.pdf");

    if (!fs.existsSync(templatePath)) {
      throw new Error("❌ No se encontró ninguna plantilla disponible.");
    }
  }
}


  // 3. Leer la plantilla
  const existingPdfBytes = fs.readFileSync(templatePath);

  // 4. Cargar el PDF en pdf-lib
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width, height } = firstPage.getSize();
  console.log("Tamaño página:", width, height);

  // 5. Escribir datos (ajusta coordenadas según tu template_cdp)
  // ======== NOMBRES Y APELLIDOS CENTRADOS EN DOS LÍNEAS ========

  // 1. Separar nombres y apellidos
  const nombres = user.firstName;        // ej: "Juan Fernando"
  const apellidos = user.lastName;       // ej: "Velasco Ibarra"

  // 2. Configuración de tamaños
  const fontSizeNombre = 44;
  const fontSizeApellido = 44;

  // 3. Calcular ancho de cada texto para centrarlo
  const nombreWidth = font.widthOfTextAtSize(nombres, fontSizeNombre);
  const apellidoWidth = font.widthOfTextAtSize(apellidos, fontSizeApellido);

  // 4. Coordenadas Y (ajústalas según tu plantilla)
  const yNombre = 250;
  const yApellido = 200;

  // 5. Calcular posición centrada
  const xNombre = (width - nombreWidth) / 2;
  const xApellido = (width - apellidoWidth) / 2;

  // 6. Dibujar nombres y apellidos centrados

const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  firstPage.drawText(nombres, {
    x: xNombre,
    y: yNombre,
    size: fontSizeNombre,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  firstPage.drawText(apellidos, {
    x: xApellido,
    y: yApellido,
    size: fontSizeApellido,
    font: fontBold,
    color: rgb(0, 0, 0),
  });


  // 6. Guardar el nuevo PDF en bytes
  const pdfBytes = await pdfDoc.save();

  // 7. Carpeta de salida por curso (ej: uploads/certificados/cdp)
  const outputDir = path.join(
    __dirname,
    "..",
    "..",
    "uploads",
    "certificados",
    dataCertificado.cursoSigla
  );

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `${dataCertificado.cedula}_${dataCertificado.cursoSigla}.pdf`;
  const outputPath = path.join(outputDir, fileName);

  fs.writeFileSync(outputPath, pdfBytes);

  console.log("📄 Certificado generado (sin firma) en:", outputPath);

  // 8. Firmar el PDF con tu .p12 usando FirmaEC / servicio de firma
  let signedPath;
  try {
    signedPath = await firmarPdfFirmaEc(outputPath, dataCertificado);
    console.log("✅ Certificado firmado en:", signedPath);
  } catch (err) {
    console.error("❌ Error firmando el certificado:", err);
    // aquí decides: lanzar error o dejarlo sin firma
    // throw err;
    signedPath = outputPath; // por ahora, si falla la firma, al menos existe el PDF
  }

  // Borrar el PDF sin firmar
try {
  if (fs.existsSync(outputPath) && outputPath !== signedPath) {
    fs.unlinkSync(outputPath);
    console.log("🗑️ Archivo sin firma eliminado:", outputPath);
  }
} catch (err) {
  console.error("⚠️ No se pudo eliminar el PDF sin firma:", err);
}




  return { outputPath: signedPath, fileName, dataCertificado };
};
