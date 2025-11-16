import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    orden: { type: Number },
    electo: { type: Number },
    candidato: { type: String, required: true },
    sigla_partido: { type: String },
    filterName: { type: String },
  },
  {
    timestamps: true,
    collection: "candidates",
  }
);

const Candidate = mongoose.model("Candidate", candidateSchema);

export default Candidate;
