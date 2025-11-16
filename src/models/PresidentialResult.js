import mongoose from "mongoose";

// Esquema principal de resultados presidenciales
// Usamos Mixed para detalles para aceptar cualquier estructura de SERVEL
const presidentialResultSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    iteracion: {
      type: String,
      required: true,
      index: true,
    },
    id_eleccion: {
      type: Number,
      required: true,
      index: true,
    },
    votosValidos: { type: Number, default: 0 },
    nulos: { type: Number, default: 0 },
    blancos: { type: Number, default: 0 },
    totalEscrutadas: { type: Number, default: 0, index: true },
    totalVotacion: { type: Number, default: 0 },
    totalMesas: { type: Number, default: 0 },
    totalInstaladas: { type: Number, default: 0 },
    porc: { type: String, default: "0.00" },
    totalCandidatos: { type: Number, default: 0 },
    totalNominados: { type: Number, default: 0 },
    // Usar Mixed para detalles: acepta cualquier estructura que venga de SERVEL
    detalles: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  {
    timestamps: true,
    collection: "presidential_results",
    strict: false, // Permite campos adicionales no definidos en el schema
  }
);

// Índice compuesto para buscar por elección y tipo de resultado
presidentialResultSchema.index({ id_eleccion: 1, name: 1 });

// Índice para ordenar por última actualización
presidentialResultSchema.index({ iteracion: -1 });

const PresidentialResult = mongoose.model(
  "PresidentialResult",
  presidentialResultSchema
);

export default PresidentialResult;
