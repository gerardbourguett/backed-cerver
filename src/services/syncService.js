import axios from "axios";
import AdmZip from "adm-zip";
import PresidentialResult from "../models/PresidentialResult.js";
import Candidate from "../models/Candidate.js";

class SyncService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
    this.isRunning = false;
    this.intervalId = null;
    this.syncInterval = parseInt(process.env.SYNC_INTERVAL || "60000"); // Default: 60 segundos
    this.lastIteracion = null;
    this.syncStats = {
      lastSync: null,
      successCount: 0,
      errorCount: 0,
      lastError: null,
    };
  }

  // Iniciar sincronización automática
  start() {
    if (this.isRunning) {
      console.log("⚠️  El servicio de sincronización ya está ejecutándose");
      return false;
    }

    console.log(`🚀 Iniciando sincronización automática cada ${this.syncInterval / 1000}s`);
    this.isRunning = true;

    // Ejecutar inmediatamente
    this.syncNow();

    // Luego ejecutar periódicamente
    this.intervalId = setInterval(() => {
      this.syncNow();
    }, this.syncInterval);

    return true;
  }

  // Detener sincronización automática
  stop() {
    if (!this.isRunning) {
      console.log("⚠️  El servicio de sincronización no está ejecutándose");
      return false;
    }

    console.log("🛑 Deteniendo sincronización automática");
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    return true;
  }

  // Sincronizar ahora (manualmente)
  async syncNow() {
    try {
      console.log(`🔄 [${new Date().toISOString()}] Sincronizando datos presidenciales...`);

      const data = await this.fetchPresidentialData();

      if (!data || data.length === 0) {
        console.log("⚠️  No se obtuvieron datos de la API");
        return { success: false, message: "No hay datos disponibles" };
      }

      // Verificar si hay cambios usando iteracion
      const newIteracion = data[0]?.iteracion;
      if (newIteracion === this.lastIteracion) {
        console.log(`✅ Sin cambios (iteración: ${newIteracion})`);
        return { success: true, message: "Sin cambios", changed: false };
      }

      // Hay cambios, actualizar BD
      const result = await this.updateDatabase(data);

      this.lastIteracion = newIteracion;
      this.syncStats.lastSync = new Date();
      this.syncStats.successCount++;

      console.log(`✅ Sincronización exitosa (iteración: ${newIteracion})`, result);

      return {
        success: true,
        message: "Datos actualizados",
        changed: true,
        iteracion: newIteracion,
        ...result,
      };
    } catch (error) {
      console.error(`❌ Error en sincronización:`, error.message);
      this.syncStats.errorCount++;
      this.syncStats.lastError = error.message;

      return {
        success: false,
        message: error.message,
        error: true,
      };
    }
  }

  // Descargar datos de SERVEL
  async fetchPresidentialData() {
    const url = `${this.apiUrl}/total_votacion_4.zip`;

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

    const jsonEntry = zipEntries.find((entry) => entry.entryName.endsWith(".json"));

    if (!jsonEntry) {
      throw new Error("Archivo JSON no encontrado en el ZIP");
    }

    const jsonContent = zip.readAsText(jsonEntry, "utf8");
    return JSON.parse(jsonContent);
  }

  // Actualizar base de datos
  async updateDatabase(data) {
    const bulkOps = [];
    const candidatesSet = new Set();

    for (const resultado of data) {
      // Extraer candidatos únicos
      if (resultado.detalles) {
        for (const detalle of resultado.detalles) {
          if (detalle.candidatos) {
            for (const candidato of detalle.candidatos) {
              candidatesSet.add(JSON.stringify({
                id: candidato.id,
                orden: candidato.orden,
                electo: candidato.electo,
                candidato: candidato.candidato,
                sigla_partido: candidato.sigla_partido,
                filterName: candidato.filterName,
              }));
            }
          }
        }
      }

      // Preparar operación de actualización
      bulkOps.push({
        updateOne: {
          filter: {
            id_eleccion: resultado.id_eleccion,
            name: resultado.name,
          },
          update: { $set: resultado },
          upsert: true,
        },
      });
    }

    // Actualizar resultados
    const resultsUpdate = bulkOps.length > 0
      ? await PresidentialResult.bulkWrite(bulkOps)
      : { upsertedCount: 0, modifiedCount: 0 };

    // Actualizar candidatos
    const uniqueCandidates = Array.from(candidatesSet).map((c) => JSON.parse(c));
    const candidatesOps = uniqueCandidates.map((candidato) => ({
      updateOne: {
        filter: { id: candidato.id },
        update: { $set: candidato },
        upsert: true,
      },
    }));

    const candidatesUpdate = candidatesOps.length > 0
      ? await Candidate.bulkWrite(candidatesOps)
      : { upsertedCount: 0, modifiedCount: 0 };

    return {
      resultados: {
        insertados: resultsUpdate.upsertedCount,
        actualizados: resultsUpdate.modifiedCount,
        total: bulkOps.length,
      },
      candidatos: {
        insertados: candidatesUpdate.upsertedCount,
        actualizados: candidatesUpdate.modifiedCount,
        total: candidatesOps.length,
      },
    };
  }

  // Obtener estadísticas
  getStats() {
    return {
      isRunning: this.isRunning,
      syncInterval: this.syncInterval,
      lastIteracion: this.lastIteracion,
      ...this.syncStats,
    };
  }
}

export default SyncService;
