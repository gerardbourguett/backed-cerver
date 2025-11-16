import mongoose from "mongoose";

// Sub-esquema para candidatos en cada mesa
const candidatoMesaSchema = new mongoose.Schema(
  {
    id_candidato: { type: Number, required: true },
    id_partido: { type: Number },
    id_pacto: { type: Number },
    id_subpacto: { type: Number },
    votos: { type: Number },
    orden_voto: { type: Number },
    electo: { type: Number },
  },
  { _id: false }
);

// Esquema para resultados por mesa
const mesaResultSchema = new mongoose.Schema(
  {
    cod_eleccion: { type: Number, required: true, index: true },
    iteracion: { type: String, required: true, index: true },
    porcentaje: { type: String },

    // Identificadores geográficos (para relacionar con territorios)
    id_region: { type: Number, index: true },
    id_cirsen: { type: Number },
    id_distrito: { type: Number },
    id_provincia: { type: Number },
    id_circ_provincial: { type: Number },
    id_comuna: { type: Number, index: true },
    orden_comuna: { type: Number },
    id_colegio: { type: Number },
    id_mesa: { type: String, required: true, unique: true, index: true },
    mesa: { type: Number },
    id_local: { type: Number, index: true },
    orden_local: { type: Number },

    // Estado de la mesa
    envio: { type: String },
    instalada: { type: Number, index: true }, // 0 = no, 1 = sí

    // Resultados
    blancos: { type: Number },
    nulos: { type: Number },
    total_emitidos: { type: Number },
    total_general: { type: Number },
    electores: { type: Number },
    path_s3: { type: String },

    // Candidatos con sus votos en esta mesa
    candidatos: [candidatoMesaSchema],
  },
  {
    timestamps: true,
    collection: "mesa_results",
  }
);

// Índices compuestos para consultas comunes
mesaResultSchema.index({ cod_eleccion: 1, id_mesa: 1 });
mesaResultSchema.index({ id_region: 1, id_comuna: 1 });
mesaResultSchema.index({ id_comuna: 1, id_local: 1 });
mesaResultSchema.index({ instalada: 1, iteracion: -1 });

const MesaResult = mongoose.model("MesaResult", mesaResultSchema);

export default MesaResult;
