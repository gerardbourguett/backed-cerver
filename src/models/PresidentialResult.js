import mongoose from "mongoose";

// Sub-esquema para candidatos dentro de detalles
const candidatoDetalleSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    orden: { type: Number },
    electo: { type: Number },
    candidato: { type: String },
    filterName: { type: String },
    sigla_partido: { type: String },
    totalVotosCandidatos: { type: Number },
  },
  { _id: false }
);

// Sub-esquema para detalles (pactos/listas)
const detalleSchema = new mongoose.Schema(
  {
    name: { type: String },
    lista: { type: String },
    partidos: [{ type: String }],
    candidatos: [candidatoDetalleSchema],
    filterName: { type: String },
    porc_votos: { type: String },
    glosa_pacto: { type: String },
    totalNominados: { type: Number },
    totalCandidatos: { type: Number },
    totalVotosLista: { type: Number },
  },
  { _id: false }
);

// Esquema principal de resultados presidenciales
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
    detalles: [detalleSchema],
  },
  {
    timestamps: true,
    collection: "presidential_results",
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
