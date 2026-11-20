import sys
import math
from datetime import datetime, timezone

from cryptography.hazmat.primitives.serialization import pkcs12, Encoding, PrivateFormat, NoEncryption
from asn1crypto import x509 as asn1x509, keys as asn1keys

from pyhanko.sign import signers, fields
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko_certvalidator.registry import SimpleCertificateStore

from pyhanko.stamp import TextStampStyle
from pyhanko.pdf_utils.text import TextBoxStyle


def to_asn1_cert(crypto_cert):
    return asn1x509.Certificate.load(crypto_cert.public_bytes(Encoding.DER))


def to_asn1_key(crypto_key):
    return asn1keys.PrivateKeyInfo.load(
        crypto_key.private_bytes(Encoding.DER, PrivateFormat.PKCS8, NoEncryption())
    )


def get_page_size(reader, page_ix):
    page = reader.root["/Pages"]["/Kids"][page_ix].get_object()
    mb = page["/MediaBox"]
    return float(mb[2]), float(mb[3])


def main():
    pdf_in = sys.argv[1]
    pdf_out = sys.argv[2]
    p12_path = sys.argv[3]
    p12_pass = sys.argv[4]
    page = int(sys.argv[5])   # 1 o -1
    coords = sys.argv[6] if len(sys.argv) > 6 else ""

    field_name = "Signature1"

    # Cargar P12
    with open(p12_path, "rb") as f:
        p12 = f.read()

    key, cert, extra = pkcs12.load_key_and_certificates(
        p12, p12_pass.encode()
    )
    if key is None or cert is None:
        raise RuntimeError("El P12 no contiene clave privada o certificado.")

    signing_key = to_asn1_key(key)
    signing_cert = to_asn1_cert(cert)

    store = SimpleCertificateStore()
    store.register(signing_cert)

    signer = signers.SimpleSigner(
        signing_cert=signing_cert,
        signing_key=signing_key,
        cert_registry=store
    )

    signer_name = signing_cert.subject.native.get("common_name") or "ROMEL EFREN DELGADO ARGOTI"
    signed_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    with open(pdf_in, "rb") as inf:
        reader = PdfFileReader(inf)
        pages = int(reader.root["/Pages"]["/Count"])
        page_ix = pages - 1 if page == -1 else max(0, page - 1)

        page_w, page_h = get_page_size(reader, page_ix)

        # ===== POSICIÓN: encima de "Ing. Romel Delgado" (abajo derecha) =====
        CM = 72 / 2.54

        margin_bottom = 2.2 * CM   # sube/baja para mover arriba/abajo
        margin_right = 1 * CM    # sube/baja para mover izq/der

        box_w = 260
        box_h = 80

        left = page_w - margin_right - box_w
        bottom = margin_bottom
        sig_box = (left, bottom, left + box_w, bottom + box_h)

        # El adaptador Ubuntu anterior usa este rectángulo como valor por defecto.
        # Mantener la ubicación histórica para los cursos sin rectángulo explícito.
        if coords.strip():
            try:
                rect = tuple(float(v.strip()) for v in coords.split(","))
            except ValueError as exc:
                raise ValueError("Coordenadas de firma inválidas") from exc
            if len(rect) != 4 or not all(math.isfinite(v) for v in rect):
                raise ValueError("Se requieren cuatro coordenadas finitas")
            if rect != (10, 240, 12, 242):
                x1, y1, x2, y2 = rect
                if not (0 <= x1 < x2 <= page_w and 0 <= y1 < y2 <= page_h):
                    raise ValueError("Rectángulo de firma fuera de la página")
                sig_box = rect


        inf.seek(0)
        writer = IncrementalPdfFileWriter(inf)

        meta = signers.PdfSignatureMetadata(field_name=field_name)

        sigfield = fields.SigFieldSpec(
            sig_field_name=field_name,
            box=sig_box,
            on_page=page_ix
        )

        # ===== TEXTO: limpio, sin sello, sin borde =====
        stamp_text = (
            "Digitally signed by\n"
            f"{signer_name}\n"
            f"{signed_at}"
        )

        style = TextStampStyle(
            stamp_text=stamp_text,
            border_width=0,      # sin borde
            background=None,     # sin imagen/fondo
            text_box_style=TextBoxStyle(
                font_size=12     # letras (sube a 13-14 si quieres)
            )
        )

        pdf_signer = signers.PdfSigner(
            meta,
            signer,
            new_field_spec=sigfield,
            stamp_style=style
        )

        with open(pdf_out, "wb") as outf:
            pdf_signer.sign_pdf(writer, output=outf)


if __name__ == "__main__":
    main()
