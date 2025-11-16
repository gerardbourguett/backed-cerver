import express from "express";
import axios from "axios";
import AdmZip from "adm-zip";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/database.js";
import Territory from "./models/Territory.js";
import PresidentialResult from "./models/PresidentialResult.js";
import Candidate from "./models/Candidate.js";
import MesaResult from "./models/MesaResult.js";
import SyncService from "./services/syncService.js";

dotenv.config();
const apiUrl = (process.env.API_URL || "https://elecciones.servel.cl")
  .trim()
  .replace(/`/g, "");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Conectar a MongoDB
connectDB();

// Inicializar servicio de sincronización
const syncService = new SyncService(apiUrl);

// Auto-iniciar sincronización si está configurado
if (process.env.AUTO_START_SYNC === "true") {
  console.log("🤖 Auto-inicio de sincronización habilitado");
  syncService.start();
}

// GET - Consultar territorios desde la base de datos
app.get("/api/territorios/nacional", async (req, res) => {
  try {
    const { region, comuna, local, mesa } = req.query;

    // Construir filtro dinámico
    const filter = {};
    if (region) filter.id_region = parseInt(region);
    if (comuna) filter.id_comuna = parseInt(comuna);
    if (local) filter.id_local = parseInt(local);
    if (mesa) filter.id_mesa = mesa;

    const territories = await Territory.find(filter).lean();

    if (territories.length === 0) {
      return res.status(404).json({
        message: "No se encontraron territorios en la base de datos. Use POST /api/territorios/nacional/cargar para cargarlos desde la API.",
        count: 0,
      });
    }

    res.json({
      count: territories.length,
      data: territories,
    });
  } catch (error) {
    console.error("Error al consultar territorios desde la BD:", error);
    res.status(500).json({
      error: "Error al consultar territorios desde la base de datos",
    });
  }
});

// POST - Cargar territorios desde la API de SERVEL a la base de datos
app.post("/api/territorios/nacional/cargar", async (req, res) => {
  try {
    const url = `${apiUrl}/territorios.zip`;
    console.log(`Descargando datos desde ${url}...`);

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        Accept: "application/zip,application/octet-stream;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://elecciones.servel.cl/",
        Origin: "https://elecciones.servel.cl",
      },
    });

    const buffer = Buffer.from(response.data);
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    const territoriosEntry = zipEntries.find(
      (entry) => entry.entryName === "territorios.json"
    );

    if (!territoriosEntry) {
      return res.status(404).json({
        error: "Archivo territorios.json no encontrado en el zip",
      });
    }

    const territoriosContent = zip.readAsText(territoriosEntry, "utf8");
    const data = JSON.parse(territoriosContent);

    console.log(`Procesando ${data.length} registros de territorios...`);

    // Usar bulkWrite para mejor rendimiento
    const bulkOps = data.map((territory) => ({
      updateOne: {
        filter: { id_mesa: territory.id_mesa },
        update: { $set: territory },
        upsert: true,
      },
    }));

    const result = await Territory.bulkWrite(bulkOps);

    console.log("Territorios cargados exitosamente:", {
      insertados: result.upsertedCount,
      actualizados: result.modifiedCount,
      total: data.length,
    });

    res.json({
      message: "Territorios cargados exitosamente",
      insertados: result.upsertedCount,
      actualizados: result.modifiedCount,
      total: data.length,
    });
  } catch (error) {
    console.error("Error al cargar territorios:", error);
    res.status(500).json({
      error: "Error al cargar territorios desde la API",
      details: error.message,
    });
  }
});

// GET - Obtener territorios directamente desde la API (sin guardar en BD)
app.get("/api/territorios/nacional/directo", async (req, res) => {
  try {
    const url = `${apiUrl}/territorios.zip`;
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        Accept: "application/zip,application/octet-stream;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://elecciones.servel.cl/",
        Origin: "https://elecciones.servel.cl",
      },
    });
    console.log(`Fetching data from ${url}`);

    const buffer = Buffer.from(response.data);
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    const territorios = zipEntries.find(
      (entry) => entry.entryName === "territorios.json"
    );
    if (!territorios) {
      return res.status(404).json({
        error: "Archivo territorios.json no encontrado en el zip",
      });
    }
    const territoriosContent = zip.readAsText(territorios, "utf8");
    const data = JSON.parse(territoriosContent);
    res.json(data);
  } catch (error) {
    console.error(
      `Error al obtener territorios directamente desde ${apiUrl}:`,
      error
    );
    res.status(500).json({
      error: `Error al obtener territorios desde ${apiUrl}`,
    });
  }
});

// Constitucion de Mesas a Nivel Nacional
app.get("/api/resultados/constitucion", async (req, res) => {
  try {
    //https://elecciones.servel.cl/constitucion.zip?v=0.36849739389744063
    const url = `${apiUrl}/constitucion.zip`;
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        Accept: "application/zip,application/octet-stream;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://elecciones.servel.cl/",
        Origin: "https://elecciones.servel.cl",
      },
    });
    console.log(`Fetching data from ${url}`);

    const buffer = Buffer.from(response.data);
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    const constitucion = zipEntries.find(
      (entry) => entry.entryName === "constitucion.json"
    );
    if (!constitucion) {
      return res.status(404).json({
        error: "Archivo constitucion.json no encontrado en el zip",
      });
    }
    const constitucionContent = zip.readAsText(constitucion, "utf8");
    const data = JSON.parse(constitucionContent);
    res.json(data);
  } catch (error) {
    console.error(
      `Error al obtener la constitucion de mesas a nivel nacional desde ${apiUrl}:`,
      error
    );
    res.status(500).json({
      error: `Error al obtener la constitucion de mesas a nivel nacional desde ${apiUrl}`,
    });
  }
});

// ============= PRESIDENCIALES =============

// GET - Obtener nómina completa de candidatos
app.get("/api/presidenciales/nomina", async (req, res) => {
  try {
    const url = `${apiUrl}/nomina_completa_4.zip`;
    console.log(`Descargando nómina desde ${url}...`);

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        Accept: "application/zip,application/octet-stream;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://elecciones.servel.cl/",
        Origin: "https://elecciones.servel.cl",
      },
    });

    const buffer = Buffer.from(response.data);
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    // Buscar archivo JSON
    const jsonEntry = zipEntries.find((entry) => entry.entryName.endsWith(".json"));

    if (!jsonEntry) {
      return res.status(404).json({
        error: "Archivo JSON no encontrado en el ZIP",
        archivos: zipEntries.map((entry) => entry.entryName),
      });
    }

    const jsonContent = zip.readAsText(jsonEntry, "utf8");
    const data = JSON.parse(jsonContent);

    res.json(data);
  } catch (error) {
    console.error("Error al obtener nómina:", error);
    res.status(500).json({
      error: "Error al obtener nómina completa",
      details: error.message,
    });
  }
});

// GET - Obtener estado de instalación de mesas
app.get("/api/presidenciales/instalacion", async (req, res) => {
  try {
    const url = `${apiUrl}/instalacion.zip`;
    console.log(`Descargando instalación desde ${url}...`);

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        Accept: "application/zip,application/octet-stream;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://elecciones.servel.cl/",
        Origin: "https://elecciones.servel.cl",
      },
    });

    const buffer = Buffer.from(response.data);
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    // Buscar archivo JSON
    const jsonEntry = zipEntries.find((entry) => entry.entryName.endsWith(".json"));

    if (!jsonEntry) {
      return res.status(404).json({
        error: "Archivo JSON no encontrado en el ZIP",
        archivos: zipEntries.map((entry) => entry.entryName),
      });
    }

    const jsonContent = zip.readAsText(jsonEntry, "utf8");
    const data = JSON.parse(jsonContent);

    res.json(data);
  } catch (error) {
    console.error("Error al obtener instalación:", error);
    res.status(500).json({
      error: "Error al obtener datos de instalación",
      details: error.message,
    });
  }
});

// GET - Obtener resultados presidenciales desde BD
app.get("/api/presidenciales/resultados", async (req, res) => {
  try {
    const { tipo } = req.query; // "nacional", "extranjero", o vacío para todos

    const filter = {};
    if (tipo) {
      filter.name = new RegExp(tipo, "i");
    }

    const resultados = await PresidentialResult.find(filter)
      .sort({ iteracion: -1 })
      .lean();

    if (resultados.length === 0) {
      return res.status(404).json({
        message: "No se encontraron resultados. Use POST /api/presidenciales/sync para cargar datos.",
        count: 0,
      });
    }

    res.json({
      count: resultados.length,
      data: resultados,
    });
  } catch (error) {
    console.error("Error al consultar resultados:", error);
    res.status(500).json({
      error: "Error al consultar resultados presidenciales",
    });
  }
});

// GET - Obtener candidatos
app.get("/api/presidenciales/candidatos", async (req, res) => {
  try {
    const candidatos = await Candidate.find().sort({ orden: 1 }).lean();

    if (candidatos.length === 0) {
      return res.status(404).json({
        message: "No se encontraron candidatos. Use POST /api/presidenciales/sync para cargar datos.",
        count: 0,
      });
    }

    res.json({
      count: candidatos.length,
      data: candidatos,
    });
  } catch (error) {
    console.error("Error al consultar candidatos:", error);
    res.status(500).json({
      error: "Error al consultar candidatos",
    });
  }
});

// GET - Obtener resultados por mesa
app.get("/api/presidenciales/mesas", async (req, res) => {
  try {
    const { region, comuna, local, mesa, instalada } = req.query;

    // Construir filtro dinámico
    const filter = {};
    if (region) filter.id_region = parseInt(region);
    if (comuna) filter.id_comuna = parseInt(comuna);
    if (local) filter.id_local = parseInt(local);
    if (mesa) filter.id_mesa = mesa;
    if (instalada !== undefined) filter.instalada = parseInt(instalada);

    const mesas = await MesaResult.find(filter).lean();

    if (mesas.length === 0) {
      return res.status(404).json({
        message: "No se encontraron resultados por mesa. Use POST /api/presidenciales/sync para cargar datos.",
        count: 0,
      });
    }

    res.json({
      count: mesas.length,
      data: mesas,
    });
  } catch (error) {
    console.error("Error al consultar mesas:", error);
    res.status(500).json({
      error: "Error al consultar resultados por mesa",
    });
  }
});

// GET - Obtener estadísticas de una mesa específica con info de territorio
app.get("/api/presidenciales/mesas/:id_mesa", async (req, res) => {
  try {
    const { id_mesa } = req.params;

    const mesa = await MesaResult.findOne({ id_mesa }).lean();

    if (!mesa) {
      return res.status(404).json({
        error: "Mesa no encontrada",
      });
    }

    // Obtener información del territorio
    const territorio = await Territory.findOne({ id_mesa }).lean();

    res.json({
      mesa,
      territorio,
    });
  } catch (error) {
    console.error("Error al consultar mesa:", error);
    res.status(500).json({
      error: "Error al consultar mesa",
    });
  }
});

// POST - Sincronizar manualmente (totales y mesas en paralelo)
app.post("/api/presidenciales/sync", async (req, res) => {
  try {
    // Iniciar sincronización pero no esperar a que termine
    syncService.syncNow().catch((error) => {
      console.error("Error en sincronización asíncrona:", error);
    });

    res.json({
      success: true,
      message: "Sincronización iniciada en segundo plano. Use GET /api/presidenciales/sync/stats para ver el progreso.",
    });
  } catch (error) {
    console.error("Error al iniciar sincronización:", error);
    res.status(500).json({
      error: "Error al iniciar sincronización",
      details: error.message,
    });
  }
});

// POST - Sincronizar solo totales (rápido)
app.post("/api/presidenciales/sync/totales", async (req, res) => {
  try {
    const result = await syncService.syncTotales();
    res.json(result);
  } catch (error) {
    console.error("Error en sincronización de totales:", error);
    res.status(500).json({
      error: "Error en sincronización de totales",
      details: error.message,
    });
  }
});

// POST - Sincronizar solo mesas (lento, ~40K registros)
app.post("/api/presidenciales/sync/mesas", async (req, res) => {
  try {
    // Iniciar sincronización en segundo plano
    syncService.syncMesas().catch((error) => {
      console.error("Error en sincronización de mesas:", error);
    });

    res.json({
      success: true,
      message: "Sincronización de mesas iniciada en segundo plano. Use GET /api/presidenciales/sync/stats para ver el progreso.",
    });
  } catch (error) {
    console.error("Error al iniciar sincronización de mesas:", error);
    res.status(500).json({
      error: "Error al iniciar sincronización de mesas",
      details: error.message,
    });
  }
});

// POST - Sincronizar solo instalación (~40K registros, rápido porque solo actualiza)
app.post("/api/presidenciales/sync/instalacion", async (req, res) => {
  try {
    // Iniciar sincronización en segundo plano
    syncService.syncInstalacion().catch((error) => {
      console.error("Error en sincronización de instalación:", error);
    });

    res.json({
      success: true,
      message: "Sincronización de instalación iniciada en segundo plano. Use GET /api/presidenciales/sync/stats para ver el progreso.",
    });
  } catch (error) {
    console.error("Error al iniciar sincronización de instalación:", error);
    res.status(500).json({
      error: "Error al iniciar sincronización de instalación",
      details: error.message,
    });
  }
});

// POST - Iniciar sincronización automática
app.post("/api/presidenciales/sync/start", async (req, res) => {
  try {
    const started = syncService.start();
    res.json({
      success: started,
      message: started
        ? "Sincronización automática iniciada"
        : "La sincronización ya estaba activa",
      stats: syncService.getStats(),
    });
  } catch (error) {
    console.error("Error al iniciar sincronización:", error);
    res.status(500).json({
      error: "Error al iniciar sincronización",
      details: error.message,
    });
  }
});

// POST - Detener sincronización automática
app.post("/api/presidenciales/sync/stop", async (req, res) => {
  try {
    const stopped = syncService.stop();
    res.json({
      success: stopped,
      message: stopped
        ? "Sincronización automática detenida"
        : "La sincronización no estaba activa",
      stats: syncService.getStats(),
    });
  } catch (error) {
    console.error("Error al detener sincronización:", error);
    res.status(500).json({
      error: "Error al detener sincronización",
      details: error.message,
    });
  }
});

// GET - Ver estadísticas de sincronización
app.get("/api/presidenciales/sync/stats", async (req, res) => {
  try {
    const stats = syncService.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({
      error: "Error al obtener estadísticas",
      details: error.message,
    });
  }
});

// ============= SENADORES =============

// GET - Obtener resultados senatoriales desde BD
app.get("/api/senadores/resultados", async (req, res) => {
  try {
    const { tipo } = req.query; // "nacional", "extranjero", o vacío para todos

    const filter = { id_eleccion: 5 }; // ID 5 = Senadores
    if (tipo) {
      filter.name = new RegExp(tipo, "i");
    }

    const resultados = await PresidentialResult.find(filter)
      .sort({ iteracion: -1 })
      .lean();

    if (resultados.length === 0) {
      return res.status(404).json({
        message: "No se encontraron resultados de senadores. Use POST /api/senadores/sync para cargar datos.",
        count: 0,
      });
    }

    res.json({
      count: resultados.length,
      data: resultados,
    });
  } catch (error) {
    console.error("Error al consultar resultados de senadores:", error);
    res.status(500).json({
      error: "Error al consultar resultados de senadores",
    });
  }
});

// GET - Obtener circunscripciones senatoriales disponibles
app.get("/api/senadores/circunscripciones", async (req, res) => {
  try {
    // Obtener circunscripciones únicas desde territorios
    const circunscripciones = await Territory.aggregate([
      {
        $match: {
          id_cirsen: { $ne: null },
          glosacirsen: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$id_cirsen",
          id_cirsen: { $first: "$id_cirsen" },
          glosacirsen: { $first: "$glosacirsen" },
          orden_cirsen: { $first: "$orden_cirsen" },
        },
      },
      {
        $sort: { orden_cirsen: 1 },
      },
      {
        $project: {
          _id: 0,
          id_cirsen: 1,
          glosacirsen: 1,
          orden_cirsen: 1,
        },
      },
    ]);

    res.json({
      count: circunscripciones.length,
      data: circunscripciones,
    });
  } catch (error) {
    console.error("Error al consultar circunscripciones:", error);
    res.status(500).json({
      error: "Error al consultar circunscripciones senatoriales",
    });
  }
});

// GET - Obtener resultados de senadores por circunscripción (método D'Hont)
app.get("/api/senadores/resultados/circunscripcion/:id_cirsen", async (req, res) => {
  try {
    const { id_cirsen } = req.params;
    const cirsenId = parseInt(id_cirsen);

    // Obtener información de la circunscripción
    const circunscripcion = await Territory.findOne({ id_cirsen: cirsenId })
      .select("id_cirsen glosacirsen")
      .lean();

    if (!circunscripcion) {
      return res.status(404).json({
        error: `Circunscripción ${id_cirsen} no encontrada`,
      });
    }

    // Obtener mesas de esta circunscripción para calcular escrutinio
    const mesas = await MesaResult.find({
      cod_eleccion: 5,
      id_cirsen: cirsenId,
    })
      .select("id_mesa instalada candidatos total_emitidos blancos nulos")
      .lean();

    if (mesas.length === 0) {
      return res.status(404).json({
        error: `No hay datos de mesas para la circunscripción ${id_cirsen}`,
        circunscripcion: circunscripcion.glosacirsen,
      });
    }

    // Calcular totales por candidato
    const votosMap = new Map();
    const pactoMap = new Map();
    let totalMesas = mesas.length;
    let mesasEscrutadas = 0;
    let totalVotosEmitidos = 0;
    let totalBlancos = 0;
    let totalNulos = 0;

    for (const mesa of mesas) {
      if (mesa.total_emitidos > 0) {
        mesasEscrutadas++;
        totalVotosEmitidos += mesa.total_emitidos || 0;
        totalBlancos += mesa.blancos || 0;
        totalNulos += mesa.nulos || 0;
      }

      if (mesa.candidatos) {
        for (const candidato of mesa.candidatos) {
          const id = candidato.id_candidato;
          if (!votosMap.has(id)) {
            votosMap.set(id, {
              id: id,
              votos: 0,
              id_partido: candidato.id_partido,
              id_pacto: candidato.id_pacto,
              id_subpacto: candidato.id_subpacto,
              orden: candidato.orden_voto,
              electo: candidato.electo,
            });
          }
          const current = votosMap.get(id);
          current.votos += candidato.votos || 0;

          // Acumular votos por pacto
          if (candidato.id_pacto) {
            if (!pactoMap.has(candidato.id_pacto)) {
              pactoMap.set(candidato.id_pacto, 0);
            }
            pactoMap.set(candidato.id_pacto, pactoMap.get(candidato.id_pacto) + (candidato.votos || 0));
          }
        }
      }
    }

    // Obtener información de candidatos desde resultados totales
    const resultados = await PresidentialResult.find({ id_eleccion: 5 }).lean();
    const candidatosInfo = new Map();
    const pactosInfo = new Map();

    for (const resultado of resultados) {
      if (resultado.detalles) {
        for (const detalle of resultado.detalles) {
          // Guardar info de pactos
          if (detalle.glosa_pacto) {
            const pactoId = detalle.candidatos?.[0]?.id_pacto;
            if (pactoId && !pactosInfo.has(pactoId)) {
              pactosInfo.set(pactoId, {
                id_pacto: pactoId,
                glosa_pacto: detalle.glosa_pacto,
                lista: detalle.lista,
                partidos: detalle.partidos,
              });
            }
          }

          // Guardar info de candidatos
          if (detalle.candidatos) {
            for (const cand of detalle.candidatos) {
              if (!candidatosInfo.has(cand.id)) {
                candidatosInfo.set(cand.id, {
                  candidato: cand.candidato,
                  sigla_partido: cand.sigla_partido,
                  filterName: cand.filterName,
                });
              }
            }
          }
        }
      }
    }

    // Combinar datos de candidatos
    const candidatos = Array.from(votosMap.values())
      .map((c) => ({
        ...c,
        ...(candidatosInfo.get(c.id) || {}),
      }))
      .sort((a, b) => b.votos - a.votos);

    // Agrupar candidatos por pacto
    const pactos = [];
    for (const [pactoId, totalVotos] of pactoMap.entries()) {
      const pactoInfo = pactosInfo.get(pactoId) || {};
      const candidatosPacto = candidatos.filter((c) => c.id_pacto === pactoId);

      pactos.push({
        id_pacto: pactoId,
        glosa_pacto: pactoInfo.glosa_pacto || `Pacto ${pactoId}`,
        lista: pactoInfo.lista,
        partidos: pactoInfo.partidos || [],
        total_votos: totalVotos,
        porcentaje: mesasEscrutadas > 0 ? ((totalVotos / (totalVotosEmitidos - totalBlancos - totalNulos)) * 100).toFixed(2) : "0.00",
        candidatos: candidatosPacto,
        electos: candidatosPacto.filter((c) => c.electo === 1).length,
      });
    }

    // Ordenar pactos por votos
    pactos.sort((a, b) => b.total_votos - a.total_votos);

    // Calcular porcentaje de escrutinio
    const porcentajeEscrutinio = totalMesas > 0 ? ((mesasEscrutadas / totalMesas) * 100).toFixed(2) : "0.00";

    res.json({
      circunscripcion: {
        id_cirsen: cirsenId,
        nombre: circunscripcion.glosacirsen,
      },
      escrutinio: {
        total_mesas: totalMesas,
        mesas_escrutadas: mesasEscrutadas,
        porcentaje: porcentajeEscrutinio,
      },
      votacion: {
        total_emitidos: totalVotosEmitidos,
        blancos: totalBlancos,
        nulos: totalNulos,
        validos: totalVotosEmitidos - totalBlancos - totalNulos,
      },
      pactos: pactos,
      total_candidatos: candidatos.length,
    });
  } catch (error) {
    console.error("Error al consultar resultados por circunscripción:", error);
    res.status(500).json({
      error: "Error al consultar resultados de senadores por circunscripción",
    });
  }
});

// GET - Obtener SOLO candidatos electos por circunscripción (método D'Hont)
app.get("/api/senadores/electos/circunscripcion/:id_cirsen", async (req, res) => {
  try {
    const { id_cirsen } = req.params;
    const cirsenId = parseInt(id_cirsen);

    // Obtener información de la circunscripción
    const circunscripcion = await Territory.findOne({ id_cirsen: cirsenId })
      .select("id_cirsen glosacirsen")
      .lean();

    if (!circunscripcion) {
      return res.status(404).json({
        error: `Circunscripción ${id_cirsen} no encontrada`,
      });
    }

    // Obtener mesas con candidatos electos
    const mesas = await MesaResult.find({
      cod_eleccion: 5,
      id_cirsen: cirsenId,
      "candidatos.electo": 1, // Solo mesas que tienen al menos un electo
    })
      .select("candidatos")
      .lean();

    // Extraer candidatos electos únicos
    const electosMap = new Map();
    for (const mesa of mesas) {
      if (mesa.candidatos) {
        for (const candidato of mesa.candidatos) {
          if (candidato.electo === 1 && !electosMap.has(candidato.id_candidato)) {
            electosMap.set(candidato.id_candidato, {
              id: candidato.id_candidato,
              id_partido: candidato.id_partido,
              id_pacto: candidato.id_pacto,
              orden: candidato.orden_voto,
            });
          }
        }
      }
    }

    // Enriquecer con información desde resultados totales
    const resultados = await PresidentialResult.find({ id_eleccion: 5 }).lean();
    const candidatosInfo = new Map();

    for (const resultado of resultados) {
      if (resultado.detalles) {
        for (const detalle of resultado.detalles) {
          if (detalle.candidatos) {
            for (const cand of detalle.candidatos) {
              if (!candidatosInfo.has(cand.id)) {
                candidatosInfo.set(cand.id, {
                  candidato: cand.candidato,
                  sigla_partido: cand.sigla_partido,
                  filterName: cand.filterName,
                });
              }
            }
          }
        }
      }
    }

    // Combinar datos
    const electos = Array.from(electosMap.values())
      .map((c) => ({
        ...c,
        electo: 1,
        ...(candidatosInfo.get(c.id) || {}),
      }))
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    res.json({
      circunscripcion: {
        id_cirsen: cirsenId,
        nombre: circunscripcion.glosacirsen,
      },
      total_electos: electos.length,
      electos: electos,
    });
  } catch (error) {
    console.error("Error al consultar electos por circunscripción:", error);
    res.status(500).json({
      error: "Error al consultar senadores electos",
    });
  }
});

// GET - Obtener candidatos senatoriales (opcionalmente filtrados por circunscripción)
app.get("/api/senadores/candidatos", async (req, res) => {
  try {
    const { id_cirsen, circunscripcion } = req.query;

    let candidatos;

    if (id_cirsen || circunscripcion) {
      // Filtrar candidatos por circunscripción usando datos de mesas
      const cirsenId = id_cirsen ? parseInt(id_cirsen) : null;

      // Construir filtro
      const mesaFilter = { cod_eleccion: 5 };
      if (cirsenId) {
        mesaFilter.id_cirsen = cirsenId;
      }

      // Obtener candidatos únicos de las mesas de esta circunscripción
      const mesas = await MesaResult.find(mesaFilter).select("candidatos").lean();

      if (mesas.length === 0) {
        return res.status(404).json({
          message: `No se encontraron candidatos para la circunscripción ${cirsenId || circunscripcion}`,
          count: 0,
        });
      }

      // Extraer candidatos únicos
      const candidatosMap = new Map();
      for (const mesa of mesas) {
        if (mesa.candidatos) {
          for (const candidato of mesa.candidatos) {
            if (!candidatosMap.has(candidato.id_candidato)) {
              candidatosMap.set(candidato.id_candidato, {
                id: candidato.id_candidato,
                id_partido: candidato.id_partido,
                id_pacto: candidato.id_pacto,
                orden: candidato.orden_voto,
                electo: candidato.electo,
              });
            }
          }
        }
      }

      candidatos = Array.from(candidatosMap.values()).sort((a, b) => (a.orden || 0) - (b.orden || 0));

      // Enriquecer con información de nombre desde los resultados totales
      const resultados = await PresidentialResult.find({ id_eleccion: 5 }).lean();
      const candidatosInfo = new Map();

      for (const resultado of resultados) {
        if (resultado.detalles) {
          for (const detalle of resultado.detalles) {
            if (detalle.candidatos) {
              for (const cand of detalle.candidatos) {
                if (!candidatosInfo.has(cand.id)) {
                  candidatosInfo.set(cand.id, {
                    candidato: cand.candidato,
                    sigla_partido: cand.sigla_partido,
                    filterName: cand.filterName,
                  });
                }
              }
            }
          }
        }
      }

      // Combinar datos
      candidatos = candidatos.map((c) => ({
        ...c,
        ...(candidatosInfo.get(c.id) || {}),
      }));
    } else {
      // Obtener todos los candidatos de senadores
      const resultados = await PresidentialResult.find({ id_eleccion: 5 }).lean();

      if (resultados.length === 0) {
        return res.status(404).json({
          message: "No se encontraron candidatos de senadores. Use POST /api/senadores/sync para cargar datos.",
          count: 0,
        });
      }

      // Extraer candidatos únicos de los detalles
      const candidatosMap = new Map();
      for (const resultado of resultados) {
        if (resultado.detalles) {
          for (const detalle of resultado.detalles) {
            if (detalle.candidatos) {
              for (const candidato of detalle.candidatos) {
                if (!candidatosMap.has(candidato.id)) {
                  candidatosMap.set(candidato.id, candidato);
                }
              }
            }
          }
        }
      }

      candidatos = Array.from(candidatosMap.values()).sort((a, b) => (a.orden || 0) - (b.orden || 0));
    }

    res.json({
      count: candidatos.length,
      data: candidatos,
      ...(id_cirsen && { id_cirsen: parseInt(id_cirsen) }),
    });
  } catch (error) {
    console.error("Error al consultar candidatos de senadores:", error);
    res.status(500).json({
      error: "Error al consultar candidatos de senadores",
    });
  }
});

// GET - Obtener resultados por mesa de senadores
app.get("/api/senadores/mesas", async (req, res) => {
  try {
    const { region, comuna, local, mesa, instalada } = req.query;

    // Construir filtro dinámico
    const filter = { cod_eleccion: 5 }; // ID 5 = Senadores
    if (region) filter.id_region = parseInt(region);
    if (comuna) filter.id_comuna = parseInt(comuna);
    if (local) filter.id_local = parseInt(local);
    if (mesa) filter.id_mesa = mesa;
    if (instalada !== undefined) filter.instalada = parseInt(instalada);

    const mesas = await MesaResult.find(filter).lean();

    if (mesas.length === 0) {
      return res.status(404).json({
        message: "No se encontraron resultados por mesa de senadores. Use POST /api/senadores/sync para cargar datos.",
        count: 0,
      });
    }

    res.json({
      count: mesas.length,
      data: mesas,
    });
  } catch (error) {
    console.error("Error al consultar mesas de senadores:", error);
    res.status(500).json({
      error: "Error al consultar resultados por mesa de senadores",
    });
  }
});

// POST - Sincronizar senadores manualmente
app.post("/api/senadores/sync", async (req, res) => {
  try {
    // Iniciar sincronización pero no esperar a que termine
    Promise.all([
      syncService.syncTotalesSenadores(),
      syncService.syncMesasSenadores()
    ]).catch((error) => {
      console.error("Error en sincronización de senadores:", error);
    });

    res.json({
      success: true,
      message: "Sincronización de senadores iniciada en segundo plano. Use GET /api/presidenciales/sync/stats para ver el progreso.",
    });
  } catch (error) {
    console.error("Error al iniciar sincronización de senadores:", error);
    res.status(500).json({
      error: "Error al iniciar sincronización de senadores",
      details: error.message,
    });
  }
});

// POST - Sincronizar solo totales senadores
app.post("/api/senadores/sync/totales", async (req, res) => {
  try {
    const result = await syncService.syncTotalesSenadores();
    res.json(result);
  } catch (error) {
    console.error("Error en sincronización de totales de senadores:", error);
    res.status(500).json({
      error: "Error en sincronización de totales de senadores",
      details: error.message,
    });
  }
});

// POST - Sincronizar solo mesas senadores
app.post("/api/senadores/sync/mesas", async (req, res) => {
  try {
    // Iniciar sincronización en segundo plano
    syncService.syncMesasSenadores().catch((error) => {
      console.error("Error en sincronización de mesas de senadores:", error);
    });

    res.json({
      success: true,
      message: "Sincronización de mesas de senadores iniciada en segundo plano. Use GET /api/presidenciales/sync/stats para ver el progreso.",
    });
  } catch (error) {
    console.error("Error al iniciar sincronización de mesas de senadores:", error);
    res.status(500).json({
      error: "Error al iniciar sincronización de mesas de senadores",
      details: error.message,
    });
  }
});

// ============= DIPUTADOS =============

// GET - Obtener resultados de diputados desde BD
app.get("/api/diputados/resultados", async (req, res) => {
  try {
    const { tipo } = req.query; // "nacional", "extranjero", o vacío para todos

    const filter = { id_eleccion: 6 }; // ID 6 = Diputados
    if (tipo) {
      filter.name = new RegExp(tipo, "i");
    }

    const resultados = await PresidentialResult.find(filter)
      .sort({ iteracion: -1 })
      .lean();

    if (resultados.length === 0) {
      return res.status(404).json({
        message: "No se encontraron resultados de diputados. Use POST /api/diputados/sync para cargar datos.",
        count: 0,
      });
    }

    res.json({
      count: resultados.length,
      data: resultados,
    });
  } catch (error) {
    console.error("Error al consultar resultados de diputados:", error);
    res.status(500).json({
      error: "Error al consultar resultados de diputados",
    });
  }
});

// GET - Obtener distritos disponibles
app.get("/api/diputados/distritos", async (req, res) => {
  try {
    // Obtener distritos únicos desde territorios
    const distritos = await Territory.aggregate([
      {
        $match: {
          id_distrito: { $ne: null },
          distrito: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$id_distrito",
          id_distrito: { $first: "$id_distrito" },
          distrito: { $first: "$distrito" },
          orden_distrito: { $first: "$orden_distrito" },
        },
      },
      {
        $sort: { orden_distrito: 1 },
      },
      {
        $project: {
          _id: 0,
          id_distrito: 1,
          distrito: 1,
          orden_distrito: 1,
        },
      },
    ]);

    res.json({
      count: distritos.length,
      data: distritos,
    });
  } catch (error) {
    console.error("Error al consultar distritos:", error);
    res.status(500).json({
      error: "Error al consultar distritos",
    });
  }
});

// GET - Obtener resultados de diputados por distrito (método D'Hont)
app.get("/api/diputados/resultados/distrito/:id_distrito", async (req, res) => {
  try {
    const { id_distrito } = req.params;
    const distritoId = parseInt(id_distrito);

    // Obtener información del distrito
    const distrito = await Territory.findOne({ id_distrito: distritoId })
      .select("id_distrito distrito")
      .lean();

    if (!distrito) {
      return res.status(404).json({
        error: `Distrito ${id_distrito} no encontrado`,
      });
    }

    // Obtener mesas de este distrito para calcular escrutinio
    const mesas = await MesaResult.find({
      cod_eleccion: 6,
      id_distrito: distritoId,
    })
      .select("id_mesa instalada candidatos total_emitidos blancos nulos")
      .lean();

    if (mesas.length === 0) {
      return res.status(404).json({
        error: `No hay datos de mesas para el distrito ${id_distrito}`,
        distrito: distrito.distrito,
      });
    }

    // Calcular totales por candidato
    const votosMap = new Map();
    const pactoMap = new Map();
    let totalMesas = mesas.length;
    let mesasEscrutadas = 0;
    let totalVotosEmitidos = 0;
    let totalBlancos = 0;
    let totalNulos = 0;

    for (const mesa of mesas) {
      if (mesa.total_emitidos > 0) {
        mesasEscrutadas++;
        totalVotosEmitidos += mesa.total_emitidos || 0;
        totalBlancos += mesa.blancos || 0;
        totalNulos += mesa.nulos || 0;
      }

      if (mesa.candidatos) {
        for (const candidato of mesa.candidatos) {
          const id = candidato.id_candidato;
          if (!votosMap.has(id)) {
            votosMap.set(id, {
              id: id,
              votos: 0,
              id_partido: candidato.id_partido,
              id_pacto: candidato.id_pacto,
              id_subpacto: candidato.id_subpacto,
              orden: candidato.orden_voto,
              electo: candidato.electo,
            });
          }
          const current = votosMap.get(id);
          current.votos += candidato.votos || 0;

          // Acumular votos por pacto
          if (candidato.id_pacto) {
            if (!pactoMap.has(candidato.id_pacto)) {
              pactoMap.set(candidato.id_pacto, 0);
            }
            pactoMap.set(candidato.id_pacto, pactoMap.get(candidato.id_pacto) + (candidato.votos || 0));
          }
        }
      }
    }

    // Obtener información de candidatos desde resultados totales
    const resultados = await PresidentialResult.find({ id_eleccion: 6 }).lean();
    const candidatosInfo = new Map();
    const pactosInfo = new Map();

    for (const resultado of resultados) {
      if (resultado.detalles) {
        for (const detalle of resultado.detalles) {
          // Guardar info de pactos
          if (detalle.glosa_pacto) {
            const pactoId = detalle.candidatos?.[0]?.id_pacto;
            if (pactoId && !pactosInfo.has(pactoId)) {
              pactosInfo.set(pactoId, {
                id_pacto: pactoId,
                glosa_pacto: detalle.glosa_pacto,
                lista: detalle.lista,
                partidos: detalle.partidos,
              });
            }
          }

          // Guardar info de candidatos
          if (detalle.candidatos) {
            for (const cand of detalle.candidatos) {
              if (!candidatosInfo.has(cand.id)) {
                candidatosInfo.set(cand.id, {
                  candidato: cand.candidato,
                  sigla_partido: cand.sigla_partido,
                  filterName: cand.filterName,
                });
              }
            }
          }
        }
      }
    }

    // Combinar datos de candidatos
    const candidatos = Array.from(votosMap.values())
      .map((c) => ({
        ...c,
        ...(candidatosInfo.get(c.id) || {}),
      }))
      .sort((a, b) => b.votos - a.votos);

    // Agrupar candidatos por pacto
    const pactos = [];
    for (const [pactoId, totalVotos] of pactoMap.entries()) {
      const pactoInfo = pactosInfo.get(pactoId) || {};
      const candidatosPacto = candidatos.filter((c) => c.id_pacto === pactoId);

      pactos.push({
        id_pacto: pactoId,
        glosa_pacto: pactoInfo.glosa_pacto || `Pacto ${pactoId}`,
        lista: pactoInfo.lista,
        partidos: pactoInfo.partidos || [],
        total_votos: totalVotos,
        porcentaje: mesasEscrutadas > 0 ? ((totalVotos / (totalVotosEmitidos - totalBlancos - totalNulos)) * 100).toFixed(2) : "0.00",
        candidatos: candidatosPacto,
        electos: candidatosPacto.filter((c) => c.electo === 1).length,
      });
    }

    // Ordenar pactos por votos
    pactos.sort((a, b) => b.total_votos - a.total_votos);

    // Calcular porcentaje de escrutinio
    const porcentajeEscrutinio = totalMesas > 0 ? ((mesasEscrutadas / totalMesas) * 100).toFixed(2) : "0.00";

    res.json({
      distrito: {
        id_distrito: distritoId,
        nombre: distrito.distrito,
      },
      escrutinio: {
        total_mesas: totalMesas,
        mesas_escrutadas: mesasEscrutadas,
        porcentaje: porcentajeEscrutinio,
      },
      votacion: {
        total_emitidos: totalVotosEmitidos,
        blancos: totalBlancos,
        nulos: totalNulos,
        validos: totalVotosEmitidos - totalBlancos - totalNulos,
      },
      pactos: pactos,
      total_candidatos: candidatos.length,
    });
  } catch (error) {
    console.error("Error al consultar resultados por distrito:", error);
    res.status(500).json({
      error: "Error al consultar resultados de diputados por distrito",
    });
  }
});

// GET - Obtener SOLO candidatos electos por distrito (método D'Hont)
app.get("/api/diputados/electos/distrito/:id_distrito", async (req, res) => {
  try {
    const { id_distrito } = req.params;
    const distritoId = parseInt(id_distrito);

    // Obtener información del distrito
    const distrito = await Territory.findOne({ id_distrito: distritoId })
      .select("id_distrito distrito")
      .lean();

    if (!distrito) {
      return res.status(404).json({
        error: `Distrito ${id_distrito} no encontrado`,
      });
    }

    // Obtener mesas con candidatos electos
    const mesas = await MesaResult.find({
      cod_eleccion: 6,
      id_distrito: distritoId,
      "candidatos.electo": 1, // Solo mesas que tienen al menos un electo
    })
      .select("candidatos")
      .lean();

    // Extraer candidatos electos únicos
    const electosMap = new Map();
    for (const mesa of mesas) {
      if (mesa.candidatos) {
        for (const candidato of mesa.candidatos) {
          if (candidato.electo === 1 && !electosMap.has(candidato.id_candidato)) {
            electosMap.set(candidato.id_candidato, {
              id: candidato.id_candidato,
              id_partido: candidato.id_partido,
              id_pacto: candidato.id_pacto,
              orden: candidato.orden_voto,
            });
          }
        }
      }
    }

    // Enriquecer con información desde resultados totales
    const resultados = await PresidentialResult.find({ id_eleccion: 6 }).lean();
    const candidatosInfo = new Map();

    for (const resultado of resultados) {
      if (resultado.detalles) {
        for (const detalle of resultado.detalles) {
          if (detalle.candidatos) {
            for (const cand of detalle.candidatos) {
              if (!candidatosInfo.has(cand.id)) {
                candidatosInfo.set(cand.id, {
                  candidato: cand.candidato,
                  sigla_partido: cand.sigla_partido,
                  filterName: cand.filterName,
                });
              }
            }
          }
        }
      }
    }

    // Combinar datos
    const electos = Array.from(electosMap.values())
      .map((c) => ({
        ...c,
        electo: 1,
        ...(candidatosInfo.get(c.id) || {}),
      }))
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    res.json({
      distrito: {
        id_distrito: distritoId,
        nombre: distrito.distrito,
      },
      total_electos: electos.length,
      electos: electos,
    });
  } catch (error) {
    console.error("Error al consultar electos por distrito:", error);
    res.status(500).json({
      error: "Error al consultar diputados electos",
    });
  }
});

// GET - Obtener candidatos de diputados (opcionalmente filtrados por distrito)
app.get("/api/diputados/candidatos", async (req, res) => {
  try {
    const { id_distrito, distrito } = req.query;

    let candidatos;

    if (id_distrito || distrito) {
      // Filtrar candidatos por distrito usando datos de mesas
      const distritoId = id_distrito ? parseInt(id_distrito) : null;

      // Construir filtro
      const mesaFilter = { cod_eleccion: 6 };
      if (distritoId) {
        mesaFilter.id_distrito = distritoId;
      }

      // Obtener candidatos únicos de las mesas de este distrito
      const mesas = await MesaResult.find(mesaFilter).select("candidatos").lean();

      if (mesas.length === 0) {
        return res.status(404).json({
          message: `No se encontraron candidatos para el distrito ${distritoId || distrito}`,
          count: 0,
        });
      }

      // Extraer candidatos únicos
      const candidatosMap = new Map();
      for (const mesa of mesas) {
        if (mesa.candidatos) {
          for (const candidato of mesa.candidatos) {
            if (!candidatosMap.has(candidato.id_candidato)) {
              candidatosMap.set(candidato.id_candidato, {
                id: candidato.id_candidato,
                id_partido: candidato.id_partido,
                id_pacto: candidato.id_pacto,
                orden: candidato.orden_voto,
                electo: candidato.electo,
              });
            }
          }
        }
      }

      candidatos = Array.from(candidatosMap.values()).sort((a, b) => (a.orden || 0) - (b.orden || 0));

      // Enriquecer con información de nombre desde los resultados totales
      const resultados = await PresidentialResult.find({ id_eleccion: 6 }).lean();
      const candidatosInfo = new Map();

      for (const resultado of resultados) {
        if (resultado.detalles) {
          for (const detalle of resultado.detalles) {
            if (detalle.candidatos) {
              for (const cand of detalle.candidatos) {
                if (!candidatosInfo.has(cand.id)) {
                  candidatosInfo.set(cand.id, {
                    candidato: cand.candidato,
                    sigla_partido: cand.sigla_partido,
                    filterName: cand.filterName,
                  });
                }
              }
            }
          }
        }
      }

      // Combinar datos
      candidatos = candidatos.map((c) => ({
        ...c,
        ...(candidatosInfo.get(c.id) || {}),
      }));
    } else {
      // Obtener todos los candidatos de diputados
      const resultados = await PresidentialResult.find({ id_eleccion: 6 }).lean();

      if (resultados.length === 0) {
        return res.status(404).json({
          message: "No se encontraron candidatos de diputados. Use POST /api/diputados/sync para cargar datos.",
          count: 0,
        });
      }

      // Extraer candidatos únicos de los detalles
      const candidatosMap = new Map();
      for (const resultado of resultados) {
        if (resultado.detalles) {
          for (const detalle of resultado.detalles) {
            if (detalle.candidatos) {
              for (const candidato of detalle.candidatos) {
                if (!candidatosMap.has(candidato.id)) {
                  candidatosMap.set(candidato.id, candidato);
                }
              }
            }
          }
        }
      }

      candidatos = Array.from(candidatosMap.values()).sort((a, b) => (a.orden || 0) - (b.orden || 0));
    }

    res.json({
      count: candidatos.length,
      data: candidatos,
      ...(id_distrito && { id_distrito: parseInt(id_distrito) }),
    });
  } catch (error) {
    console.error("Error al consultar candidatos de diputados:", error);
    res.status(500).json({
      error: "Error al consultar candidatos de diputados",
    });
  }
});

// GET - Obtener resultados por mesa de diputados
app.get("/api/diputados/mesas", async (req, res) => {
  try {
    const { region, comuna, local, mesa, instalada } = req.query;

    // Construir filtro dinámico
    const filter = { cod_eleccion: 6 }; // ID 6 = Diputados
    if (region) filter.id_region = parseInt(region);
    if (comuna) filter.id_comuna = parseInt(comuna);
    if (local) filter.id_local = parseInt(local);
    if (mesa) filter.id_mesa = mesa;
    if (instalada !== undefined) filter.instalada = parseInt(instalada);

    const mesas = await MesaResult.find(filter).lean();

    if (mesas.length === 0) {
      return res.status(404).json({
        message: "No se encontraron resultados por mesa de diputados. Use POST /api/diputados/sync para cargar datos.",
        count: 0,
      });
    }

    res.json({
      count: mesas.length,
      data: mesas,
    });
  } catch (error) {
    console.error("Error al consultar mesas de diputados:", error);
    res.status(500).json({
      error: "Error al consultar resultados por mesa de diputados",
    });
  }
});

// POST - Sincronizar diputados manualmente
app.post("/api/diputados/sync", async (req, res) => {
  try {
    // Iniciar sincronización pero no esperar a que termine
    Promise.all([
      syncService.syncTotalesDiputados(),
      syncService.syncMesasDiputados()
    ]).catch((error) => {
      console.error("Error en sincronización de diputados:", error);
    });

    res.json({
      success: true,
      message: "Sincronización de diputados iniciada en segundo plano. Use GET /api/presidenciales/sync/stats para ver el progreso.",
    });
  } catch (error) {
    console.error("Error al iniciar sincronización de diputados:", error);
    res.status(500).json({
      error: "Error al iniciar sincronización de diputados",
      details: error.message,
    });
  }
});

// POST - Sincronizar solo totales diputados
app.post("/api/diputados/sync/totales", async (req, res) => {
  try {
    const result = await syncService.syncTotalesDiputados();
    res.json(result);
  } catch (error) {
    console.error("Error en sincronización de totales de diputados:", error);
    res.status(500).json({
      error: "Error en sincronización de totales de diputados",
      details: error.message,
    });
  }
});

// POST - Sincronizar solo mesas diputados
app.post("/api/diputados/sync/mesas", async (req, res) => {
  try {
    // Iniciar sincronización en segundo plano
    syncService.syncMesasDiputados().catch((error) => {
      console.error("Error en sincronización de mesas de diputados:", error);
    });

    res.json({
      success: true,
      message: "Sincronización de mesas de diputados iniciada en segundo plano. Use GET /api/presidenciales/sync/stats para ver el progreso.",
    });
  } catch (error) {
    console.error("Error al iniciar sincronización de mesas de diputados:", error);
    res.status(500).json({
      error: "Error al iniciar sincronización de mesas de diputados",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
