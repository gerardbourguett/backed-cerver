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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
