import mongoose from "mongoose";

const territorySchema = new mongoose.Schema(
  {
    // Identificadores únicos
    id_mesa: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Región
    id_region: { type: Number, required: true, index: true },
    region: { type: String, required: true },
    orden_region: { type: Number },

    // Circunscripción Senatorial
    id_cirsen: { type: Number, index: true },
    glosacirsen: { type: String },
    orden_cirsen: { type: Number },

    // Distrito
    id_distrito: { type: Number, index: true },
    distrito: { type: String },
    orden_distrito: { type: Number },

    // Provincia
    id_provincia: { type: Number, index: true },
    provincia: { type: String },
    orden_provincia: { type: Number },

    // Circunscripción Provincial
    id_circ_provincial: { type: Number },
    circ_provincial: { type: String },
    orden_circ_provincial: { type: Number },

    // Colegio Escrutador
    cod_colegio_escrutador: { type: Number },
    glosa_colegio_escrutador: { type: String },
    cod_colesc: { type: Number },
    sede_colegio_escrutador: { type: String },

    // Comuna
    id_comuna: { type: Number, required: true, index: true },
    comuna: { type: String, required: true },
    orden_comuna: { type: Number },

    // Circunscripción
    id_circuns: { type: Number },
    circuns: { type: String },
    orden_circuns: { type: Number },

    // Local
    id_local: { type: Number, index: true },
    local: { type: String },
    orden_local: { type: Number },

    // Mesa
    mesa: { type: String, required: true },

    // Cupos
    cupos_presidencial: { type: Number },
    cupos_diputados: { type: Number },
    cupos_senadores: { type: Number },

    // Elecciones
    eleccion_presidencial: { type: Boolean },
    eleccion_diputados: { type: Boolean },
    eleccion_senadores: { type: Boolean },
  },
  {
    timestamps: true, // Agrega createdAt y updatedAt
    collection: "territories",
  }
);

// Índices compuestos para consultas comunes
territorySchema.index({ id_region: 1, id_comuna: 1 });
territorySchema.index({ id_comuna: 1, id_local: 1 });
territorySchema.index({ id_local: 1, id_mesa: 1 });

const Territory = mongoose.model("Territory", territorySchema);

export default Territory;
