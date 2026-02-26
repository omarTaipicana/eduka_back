import axios from "axios";

const contifico = axios.create({
    baseURL: "https://api.contifico.com/sistema/api/v1",
    headers: {
        Authorization: process.env.CONTIFICO_API_KEY,
    },
    timeout: 20000,
});

// helper: fecha dd/mm/yyyy (Contífico suele usar ese formato)
function formatDateDMY(date = new Date()) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}



export async function contificoPing() {
    const { data } = await contifico.get("/persona/");
    return data;
}

// ✅ buscar persona por identificación (RUC o cédula)
export async function contificoBuscarPersonaPorIdentificacion(identificacion) {
    const { data } = await contifico.get("/persona/", {
        params: { identificacion }, // Contífico filtra por identificacion
    });
    return data; // normalmente devuelve array
}

// ✅ crear persona cliente
export async function contificoCrearPersonaCliente({
    cedula,
    email,
    firstName,
    lastName,
    telefonos = "",
    direccion = "",
}) {
    const payload = {
        tipo: "N",
        razon_social: `${firstName} ${lastName}`.trim(),
        nombre_comercial: null,
        telefonos,
        ruc: "",
        cedula,
        direccion,
        email,
        es_extranjero: false,
        es_cliente: true,
        es_proveedor: false,
        es_empleado: false,
        es_vendedor: false,
        aplicar_cupo: false,
        porcentaje_descuento: null,
        id: null,
    };

    const { data } = await contifico.post("/persona/", payload, {
        params: { pos: process.env.CONTIFICO_POS_TOKEN },
    });

    return data;
}

export async function contificoBuscarOCrearPersona({
    cedula,
    email,
    firstName,
    lastName,
    telefonos = "",
    direccion = "",
}) {
    // 1) buscar por cédula
    const encontrados = await contificoBuscarPersonaPorIdentificacion(cedula);

    if (Array.isArray(encontrados) && encontrados.length > 0 && encontrados[0]?.id) {
        return encontrados[0]; // ya existe
    }

    // 2) si no existe, crear
    const creada = await contificoCrearPersonaCliente({
        cedula,
        email,
        firstName,
        lastName,
        telefonos,
        direccion,
    });

    return creada;
}


// listar productos
export async function contificoBuscarProductoPorCodigo(codigo) {
    const { data } = await contifico.get("/producto/", {
        params: { filtro: codigo }, // filtra por nombre o código
    });
    return data;
}

export async function contificoListarProductos() {
    const { data } = await contifico.get("/producto/", {
        params: {
            page: 1,
            limit: 50,
        },
        timeout: 60000, // aumentar tiempo solo aquí
    });
    return data;
}



// ✅ crear factura (documento) IVA 0%
export async function contificoCrearFacturaIva0({
  documento,
  personaId,
  cedula,
  email,
  razon_social,
  direccion = "",
  telefonos = "",
  total,
  descripcionItem,
}) {
  const totalNum = Number(total);

  const payload = {
    pos: process.env.CONTIFICO_POS_TOKEN,
    fecha_emision: formatDateDMY(new Date()),
    tipo_documento: "FAC",
    tipo_registro: "CLI",
    documento,
    autorizacion: "",        // vacío para electrónicos
    electronico: true,

    // ✅ TOTALES OBLIGATORIOS DEL DOCUMENTO (IVA 0%)
    subtotal_0: totalNum,
    subtotal_12: 0,
    iva: 0,
    ice: 0,
    total: totalNum,

    cliente: {
      id: personaId,
      cedula,
      email,
      razon_social,
      direccion,
      telefonos,
      tipo: "N",
      es_cliente: true,
    },

    detalles: [
      {
        producto_id: process.env.CONTIFICO_PRODUCTO_ID,
        cantidad: 1,
        precio: totalNum,
        porcentaje_descuento: 0,

        // IVA 0% => base_cero
        base_cero: totalNum,
        base_gravable: 0,
        base_no_gravable: 0,

        // opcionales/otros
        valor_ice: 0,
        ice: 0,

        descripcion: descripcionItem || "Pago Eduka",
      },
    ],
  };

  const { data } = await contifico.post("/documento/", payload);
  return data;
}

// ✅ listar documentos (FAC/CLI) usando endpoint de registro
export async function contificoListarDocumentos({ tipo = "FAC", tipo_registro = "CLI", result_size = 50, result_page = 1, fecha_inicial, fecha_final } = {}) {
  const params = { tipo, tipo_registro, result_size, result_page };
  if (fecha_inicial) params.fecha_inicial = fecha_inicial; // dd/mm/yyyy
  if (fecha_final) params.fecha_final = fecha_final;       // dd/mm/yyyy

  const { data } = await contifico.get("/registro/documento/", { params });
  return data; // array de documentos
}




export async function contificoGetDocumentoById(id) {
  const { data } = await contifico.get(`/documento/${id}/`);
  return data;
}





 export function contificoExtraerSecuencial(documento) {
  // 001-001-990000133 → 990000133
  const parts = documento?.split("-");
  return Number(parts?.[2]);
}

export function contificoFormatearDocumento(numero, estab = "001", pto = "001") {
  return `${estab}-${pto}-${String(numero).padStart(9, "0")}`;
}

/* -----------------------------
   NUEVA FUNCIÓN
------------------------------ */

export async function contificoGetSiguienteDocumento() {
  const { data } = await contifico.get("/registro/documento/", {
    params: {
      tipo: "FAC",
      tipo_registro: "CLI",
      result_size: 50,
      result_page: 1,
    },
  });

  const docs = data?.results || data || [];

  const secuenciales = docs
    .map((d) => contificoExtraerSecuencial(d.documento))
    .filter((n) => Number.isFinite(n));

  const max = secuenciales.length ? Math.max(...secuenciales) : 0;
  const siguiente = max + 1;

  return {
    documento: contificoFormatearDocumento(siguiente),
  };
}


export async function contificoEnviarDocumentoAlSRI(documentoId) {
  const { data } = await contifico.put(`/documento/${documentoId}/sri/`);
  return data;
}