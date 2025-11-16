import axios from "axios";
import AdmZip from "adm-zip";
import PresidentialResult from "../models/PresidentialResult.js";
import Candidate from "../models/Candidate.js";
import MesaResult from "../models/MesaResult.js";

class SyncService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
    this.isRunning = false;
    this.intervalId = null;
    this.syncInterval = parseInt(process.env.SYNC_INTERVAL || "60000"); // Default: 60 segundos
    this.lastIteracion = null;
    this.lastIteracionMesas = null;
    this.syncStats = {
      lastSync: null,
      successCount: 0,
      errorCount: 0,
      lastError: null,
      lastMesasSync: null,
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

      // Sincronizar totales y mesas en paralelo
      const [totalesResult, mesasResult] = await Promise.allSettled([
        this.syncTotales(),
        this.syncMesas(),
      ]);

      const result = {
        totales: totalesResult.status === "fulfilled" ? totalesResult.value : { error: totalesResult.reason?.message },
        mesas: mesasResult.status === "fulfilled" ? mesasResult.value : { error: mesasResult.reason?.message },
      };

      this.syncStats.lastSync = new Date();

      const hasChanges =
        (totalesResult.status === "fulfilled" && totalesResult.value.changed) ||
        (mesasResult.status === "fulfilled" && mesasResult.value.changed);

      if (hasChanges) {
        this.syncStats.successCount++;
      }

      console.log(`✅ Sincronización completada`, result);

      return {
        success: true,
        message: hasChanges ? "Datos actualizados" : "Sin cambios",
        changed: hasChanges,
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

  // Sincronizar totales (total_votacion_4.zip)
  async syncTotales() {
    const data = await this.fetchPresidentialData();

    if (!data || data.length === 0) {
      return { success: false, message: "No hay datos disponibles", changed: false };
    }

    // Verificar si hay cambios usando iteracion
    const newIteracion = data[0]?.iteracion;
    if (newIteracion === this.lastIteracion) {
      return { success: true, message: "Sin cambios", changed: false, iteracion: newIteracion };
    }

    // Hay cambios, actualizar BD
    const result = await this.updateDatabase(data);

    this.lastIteracion = newIteracion;

    return {
      success: true,
      message: "Totales actualizados",
      changed: true,
      iteracion: newIteracion,
      ...result,
    };
  }

  // Sincronizar resultados por mesa (nomina_completa_4.zip)
  async syncMesas() {
    const data = await this.fetchMesasData();

    if (!data || data.length === 0) {
      return { success: false, message: "No hay datos de mesas disponibles", changed: false };
    }

    // Verificar si hay cambios usando iteracion
    const newIteracion = data[0]?.iteracion;
    if (newIteracion === this.lastIteracionMesas) {
      return { success: true, message: "Sin cambios en mesas", changed: false, iteracion: newIteracion };
    }

    // Hay cambios, actualizar BD
    const result = await this.updateMesasDatabase(data);

    this.lastIteracionMesas = newIteracion;
    this.syncStats.lastMesasSync = new Date();

    return {
      success: true,
      message: "Mesas actualizadas",
      changed: true,
      iteracion: newIteracion,
      ...result,
    };
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

  // Descargar datos de mesas de SERVEL
  async fetchMesasData() {
    const url = `${this.apiUrl}/nomina_completa_4.zip`;

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000, // Más tiempo porque es un archivo grande (40K+ registros)
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
      throw new Error("Archivo JSON no encontrado en nomina_completa_4.zip");
    }

    const jsonContent = zip.readAsText(jsonEntry, "utf8");
    return JSON.parse(jsonContent);
  }

  // Actualizar base de datos con resultados por mesa
  async updateMesasDatabase(data) {
    console.log(`Procesando ${data.length} registros de mesas en lotes...`);

    const BATCH_SIZE = 1000; // Procesar 1000 registros a la vez
    let totalInserted = 0;
    let totalModified = 0;

    // Dividir en lotes para evitar out of memory
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(data.length / BATCH_SIZE);

      console.log(`Procesando lote ${batchNumber}/${totalBatches} (${batch.length} registros)...`);

      const bulkOps = batch.map((mesa) => ({
        updateOne: {
          filter: { id_mesa: mesa.id_mesa },
          update: { $set: mesa },
          upsert: true,
        },
      }));

      try {
        const result = await MesaResult.bulkWrite(bulkOps, { ordered: false });
        totalInserted += result.upsertedCount;
        totalModified += result.modifiedCount;

        console.log(`Lote ${batchNumber}/${totalBatches} completado: ${result.upsertedCount} insertados, ${result.modifiedCount} actualizados`);
      } catch (error) {
        console.error(`Error en lote ${batchNumber}:`, error.message);
        // Continuar con el siguiente lote aunque este falle
      }
    }

    console.log("Resultados por mesa actualizados:", {
      insertados: totalInserted,
      actualizados: totalModified,
      total: data.length,
    });

    return {
      insertados: totalInserted,
      actualizados: totalModified,
      total: data.length,
    };
  }

  // Obtener estadísticas
  getStats() {
    return {
      isRunning: this.isRunning,
      syncInterval: this.syncInterval,
      lastIteracion: this.lastIteracion,
      lastIteracionMesas: this.lastIteracionMesas,
      ...this.syncStats,
    };
  }
}

export default SyncService;
