// utils/firmarPdfFirmaEc.js

const fs = require("fs");
const path = require("path");
const axios = require("axios"); // npm install axios

// URL del servicio de FirmaEC o tu servicio de firma intermedio
const FIRMA_EC_ENDPOINT = process.env.FIRMA_EC_ENDPOINT; // ponlo en .env

// Datos de tu certificado .p12 (estos NO se hardcodean, siempre por .env)
const P12_ALIAS = process.env.FIRMA_EC_P12_ALIAS;      // si la API usa alias
const P12_PASSWORD = process.env.FIRMA_EC_P12_PASSWORD; // clave del .p12
// Si necesitas enviar el p12 como archivo, mejor tenerlo en disco y leerlo aquí, o tenerlo registrado en el servidor de firma.

module.exports = async function firmarPdfFirmaEc(pdfPath, dataCertificado) {
  console.log("🔏 Iniciando firma del PDF:", pdfPath);

  if (!FIRMA_EC_ENDPOINT) {
    throw new Error("FIRMA_EC_ENDPOINT no está configurado en .env");
  }

  if (!fs.existsSync(pdfPath)) {
    throw new Error("El archivo PDF a firmar no existe: " + pdfPath);
  }

  // 1. Leer PDF generado
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString("base64");

  // 2. Armar payload para la API de FirmaEC
  // ⚠️ IMPORTANTE:
  // La estructura real depende de la documentación de la API que te den.
  // Esto es un EJEMPLO genérico.
  const payload = {
    documento: pdfBase64,
    nombreArchivo: path.basename(pdfPath),
    // Datos de firma (adaptar a lo que soporte FirmaEC):
    alias: P12_ALIAS,
    password: P12_PASSWORD,
    // Puedes pasar datos extra si la API lo permite (para auditoría):
    metadata: {
      cedula: dataCertificado.cedula,
      nombres: dataCertificado.nombresCompletos,
      curso: dataCertificado.cursoNombre,
    },
  };

  // 3. Llamar a la API de FirmaEC / servicio de firma
  const response = await axios.post(FIRMA_EC_ENDPOINT, payload, {
    timeout: 30000, // 30s, ajusta si quieres
  });

  // Aquí también depende del formato real de la respuesta
  // Supongamos que devuelve { pdfFirmado: "<base64>", ... }
  const respuesta = response.data;

  if (!respuesta || !respuesta.pdfFirmado) {
    console.error("Respuesta de firma:", respuesta);
    throw new Error("La API de firma no devolvió 'pdfFirmado'");
  }

  const pdfFirmadoBase64 = respuesta.pdfFirmado;
  const pdfFirmadoBuffer = Buffer.from(pdfFirmadoBase64, "base64");

  // 4. Guardar el PDF firmado (puedes sobrescribir o crear otro archivo)
  const ext = path.extname(pdfPath);
  const signedPath = pdfPath.replace(ext, `_firmado${ext}`);

  fs.writeFileSync(signedPath, pdfFirmadoBuffer);

  console.log("🔐 PDF firmado guardado en:", signedPath);

  // Si quieres, podrías borrar el sin firmar:
  // fs.unlinkSync(pdfPath);

  return signedPath;
};
