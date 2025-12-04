// utils/firmarPdfFirmaEc.ubuntu.js
// ⚠️ POR AHORA: hace lo mismo que el MOCK (copia).
// 🧩 FUTURO: aquí se implementa la firma REAL en Ubuntu (OpenSSL, node-signpdf, API, etc.)

const fs = require("fs");
const path = require("path");

module.exports = async function firmarPdfFirmaEcUbuntu(pdfPath, dataCertificado) {
  console.log("🔏 [UBUNTU] Simulando firma REAL (placeholder):", pdfPath);

  if (!fs.existsSync(pdfPath)) {
    throw new Error("El archivo PDF a firmar no existe: " + pdfPath);
  }

  const buffer = fs.readFileSync(pdfPath);
  const ext = path.extname(pdfPath);
  const signedPath = pdfPath.replace(ext, `_firmado${ext}`);

  fs.writeFileSync(signedPath, buffer);

  console.log("🔐 [UBUNTU] PDF 'firmado' guardado en:", signedPath);

  return signedPath;
};
