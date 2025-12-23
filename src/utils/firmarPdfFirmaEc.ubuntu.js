const fs = require("fs");
const QRCode = require("qrcode");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

// Dibuja QR + texto (angosto, sin marco) en el PDF
module.exports = async function estamparQrTexto(pdfPath, outPath, opts = {}) {
  const {
    page = 1,              // 1 o -1 (última)
    x = 20,
    y = 40,                // súbelo aumentando este valor
    qrSize = 85,           // tamaño del QR
    gap = 12,              // separación QR-texto
    nombre = "ROMEL EFREN DELGADO ARGOTI",

    // Textos visibles
    texto1 = "Firmado electrónicamente por:",
    texto2 = "Validar únicamente con FirmaEC",

    // Fecha/hora (si no la mandas, toma la del servidor)
    fechaHora = new Date(),

    // Si tienes una URL de verificación, pásala aquí (mejor que solo texto)
    // Ej: https://eduka-educ.com/validar/ABC123
    urlVerificacion = null,
  } = opts;

  // ✅ Formato fecha/hora (Guayaquil normalmente -05:00). Aquí usamos ISO simple.
  const d = fechaHora instanceof Date ? fechaHora : new Date(fechaHora);
  const fechaHoraStr = d.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  // ✅ Contenido del QR (lo que “indica”)
  // Si tienes URL de validación, lo ideal es codificarla + datos.
  const payload = {
    firmado_por: (nombre || "").trim(),
    fecha_hora: fechaHoraStr,
    validar: urlVerificacion || "FirmaEC",
  };

  // Si hay URL, codifica URL con query params; si no, codifica JSON.
  const qrData = urlVerificacion
    ? `${urlVerificacion}?firmado_por=${encodeURIComponent(payload.firmado_por)}&fecha_hora=${encodeURIComponent(
        payload.fecha_hora
      )}`
    : JSON.stringify(payload);

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const pages = pdfDoc.getPages();
  const pageIndex = page === -1 ? pages.length - 1 : Math.max(0, page - 1);
  const p = pages[pageIndex];

  // QR en PNG (buffer)
  const qrPng = await QRCode.toBuffer(qrData, {
    errorCorrectionLevel: "M",
    margin: 0,
    scale: 6,
  });

  const qrImg = await pdfDoc.embedPng(qrPng);

  // Fuentes
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Dibujar QR
  p.drawImage(qrImg, { x, y, width: qrSize, height: qrSize });

  // Texto a la derecha del QR
  const tx = x + qrSize + gap;
  const tyTop = y + qrSize - 10;

  p.drawText(texto1, {
    x: tx,
    y: tyTop,
    size: 8,
    font,
    color: rgb(0, 0, 0),
  });

  // Nombre en 2 líneas si es largo (angosto)
  const maxChars = 18;
  const nombreUp = (nombre || "").toUpperCase().trim();
  const line1 = nombreUp.slice(0, maxChars);
  const line2 = nombreUp.slice(maxChars).trim();

  p.drawText(line1, {
    x: tx,
    y: tyTop - 16,
    size: 11,
    font: bold,
    color: rgb(0, 0, 0),
  });

  if (line2) {
    p.drawText(line2, {
      x: tx,
      y: tyTop - 30,
      size: 11,
      font: bold,
      color: rgb(0, 0, 0),
    });
  }

  // ✅ Fecha y hora visible
  p.drawText(`Fecha y hora: ${fechaHoraStr}`, {
    x: tx,
    y: tyTop - (line2 ? 44 : 30),
    size: 7,
    font,
    color: rgb(0, 0, 0),
  });

  // Texto final
  p.drawText(texto2, {
    x: tx,
    y: y + 4,
    size: 7,
    font,
    color: rgb(0, 0, 0),
  });

  const outBytes = await pdfDoc.save();
  fs.writeFileSync(outPath, outBytes);
  return outPath;
};
