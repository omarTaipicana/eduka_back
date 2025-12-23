// utils/firmarPdfFirmaEc.ubuntu.js
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

// ✅ Usa el bin desde .env (venv recomendado) o cae al comando "pyhanko"
const PYHANKO_BIN = process.env.PYHANKO_BIN || "pyhanko";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || err.message).toString()));
      resolve({ stdout, stderr });
    });
  });
}

module.exports = async function firmarPdfFirmaEcUbuntu(pdfPath, opts = {}) {
  if (!fs.existsSync(pdfPath)) throw new Error("El PDF no existe: " + pdfPath);

  const p12Path = process.env.FIRMA_P12_PATH;
  const p12Pass = process.env.FIRMA_P12_PASSWORD;

  if (!p12Path || !fs.existsSync(p12Path)) {
    throw new Error("FIRMA_P12_PATH inválido o no existe.");
  }
  if (!p12Pass) throw new Error("FIRMA_P12_PASSWORD falta en .env");

  // ✅ Coordenadas de la firma (PDF origin abajo-izquierda)
  // page: 1 (o -1 para última)
  // rect: [x1, y1, x2, y2]
  const page = opts.page ?? 1;
  const rect = opts.rect ?? [560, 40, 810, 120]; // sugerido para tu tamaño 830.64 x 595.32 (abajo-derecha)
  const fieldName = opts.fieldName ?? "Signature1";

  const ext = path.extname(pdfPath);
  const withField = pdfPath.replace(ext, `_con_campo${ext}`);
  const signedPath = pdfPath.replace(ext, `_firmado${ext}`);

  // 1) Crear campo de firma con coordenadas
  const fieldArg = `${page}/${rect.join(",")}/${fieldName}`;
  await run(PYHANKO_BIN, ["sign", "addfields", "--field", fieldArg, pdfPath, withField]);

  // 2) Firmar el PDF usando el .p12
  await run(PYHANKO_BIN, [
    "sign",
    "addsig",
    "--field",
    fieldName,
    "--p12-file",
    p12Path,
    "--p12-pass",
    p12Pass,
    withField,
    signedPath,
  ]);

  if (!fs.existsSync(signedPath)) throw new Error("No se generó el PDF firmado: " + signedPath);

  return signedPath;
};
