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
    this.lastIteracionInstalacion = null;

    // Tracking para senadores (ID 5)
    this.lastIteracionSenadores = null;
    this.lastIteracionMesasSenadores = null;

    // Tracking para diputados (ID 6)
    this.lastIteracionDiputados = null;
    this.lastIteracionMesasDiputados = null;

    this.syncStats = {
      lastSync: null,
      successCount: 0,
      errorCount: 0,
      lastError: null,
      lastMesasSync: null,
      lastInstalacionSync: null,
      lastSenadoresSync: null,
      lastMesasSenadoresSync: null,
      lastDiputadosSync: null,
      lastMesasDiputadosSync: null,
    };

    // Configuración de fases electorales (horarios en formato HH:MM, hora de Chile)
    this.instalacionStart = process.env.INSTALACION_START_HOUR || "08:00";
    this.instalacionEnd = process.env.INSTALACION_END_HOUR || "12:00";
    this.votacionEnd = process.env.VOTACION_END_HOUR || "18:00";
    this.enableSmartSync = process.env.ENABLE_SMART_SYNC === "true";

    // Flag para indicar si ya se alcanzó el 100% de instalación
    this.instalacionCompleta = false;
    this.instalacionCompletaThreshold = parseFloat(process.env.INSTALACION_COMPLETE_THRESHOLD || "99.5"); // 99.5% por defecto
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

  // Determinar fase electoral actual según hora de Chile
  getCurrentElectoralPhase() {
    if (!this.enableSmartSync) {
      return "all"; // Si smart sync está deshabilitado, sincronizar todo
    }

    // Obtener hora actual en Chile (UTC-3)
    const now = new Date();
    const chileTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));
    const currentHour = chileTime.getHours();
    const currentMinute = chileTime.getMinutes();
    const currentTimeStr = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;

    const [instStartHour, instStartMin] = this.instalacionStart.split(":").map(Number);
    const [instEndHour, instEndMin] = this.instalacionEnd.split(":").map(Number);
    const [votEndHour, votEndMin] = this.votacionEnd.split(":").map(Number);

    const currentMinutes = currentHour * 60 + currentMinute;
    const instStartMinutes = instStartHour * 60 + instStartMin;
    const instEndMinutes = instEndHour * 60 + instEndMin;
    const votEndMinutes = votEndHour * 60 + votEndMin;

    if (currentMinutes >= instStartMinutes && currentMinutes < instEndMinutes) {
      return "instalacion"; // 08:00-12:00: Solo instalación
    } else if (currentMinutes >= instEndMinutes && currentMinutes < votEndMinutes) {
      return "votacion"; // 12:00-18:00: Período de votación
    } else if (currentMinutes >= votEndMinutes) {
      return "conteo"; // 18:00+: Conteo de votos
    } else {
      return "none"; // Antes de las 08:00: Sin sincronización
    }
  }

  // Sincronizar ahora (manualmente)
  async syncNow() {
    try {
      const phase = this.getCurrentElectoralPhase();
      console.log(`🔄 [${new Date().toISOString()}] Sincronizando datos presidenciales... (Fase: ${phase})`);

      let syncPromises = [];
      let result = {};

      // Detectar si es primera sincronización (sin iteraciones previas)
      const isFirstSync = !this.lastIteracion && !this.lastIteracionSenadores && !this.lastIteracionDiputados;

      // Determinar qué sincronizar según la fase electoral
      switch (phase) {
        case "instalacion":
          // 08:00-12:00: Solo instalación (mesas se están instalando)
          if (this.instalacionCompleta) {
            console.log(`✅ Instalación completa (${this.instalacionCompletaThreshold}%), omitiendo sincronización`);
            return {
              success: true,
              message: "Instalación completa, sincronización no necesaria",
              changed: false,
              phase,
              instalacionCompleta: true,
            };
          }
          console.log("📍 Fase de instalación: sincronizando solo instalacion.zip");
          syncPromises = [this.syncInstalacion()];
          break;

        case "votacion":
          // 12:00-18:00: Solo instalación con baja frecuencia (votación en curso)
          if (this.instalacionCompleta) {
            console.log(`✅ Instalación completa (${this.instalacionCompletaThreshold}%), omitiendo sincronización`);
            return {
              success: true,
              message: "Instalación completa, sincronización no necesaria",
              changed: false,
              phase,
              instalacionCompleta: true,
            };
          }
          console.log("🗳️  Fase de votación: sincronizando solo instalacion.zip");
          syncPromises = [this.syncInstalacion()];
          break;

        case "conteo":
          // 18:00+: Todo (conteo de votos)
          if (isFirstSync) {
            // Primera sincronización: secuencial para evitar out of memory
            console.log("📊 Fase de conteo: primera sincronización (secuencial para evitar OOM)");
            return await this.syncSequential();
          } else {
            // Sincronizaciones subsecuentes: paralelo para velocidad
            console.log("📊 Fase de conteo: sincronizando todo (presidenciales, senadores, diputados, mesas, instalación)");
            syncPromises = [
              this.syncTotales(),
              this.syncMesas(),
              this.syncTotalesSenadores(),
              this.syncMesasSenadores(),
              this.syncTotalesDiputados(),
              this.syncMesasDiputados(),
              this.syncInstalacion(),
            ];
          }
          break;

        case "none":
          // Antes de las 08:00: No sincronizar
          console.log("⏸️  Fuera del horario electoral: sin sincronización");
          return {
            success: true,
            message: "Fuera del horario electoral",
            changed: false,
            phase,
          };

        case "all":
        default:
          // Smart sync deshabilitado: sincronizar todo
          if (isFirstSync) {
            // Primera sincronización: secuencial para evitar out of memory
            console.log("🔄 Smart sync deshabilitado: primera sincronización (secuencial para evitar OOM)");
            return await this.syncSequential();
          } else {
            // Sincronizaciones subsecuentes: paralelo para velocidad
            console.log("🔄 Smart sync deshabilitado: sincronizando todo");
            syncPromises = [
              this.syncTotales(),
              this.syncMesas(),
              this.syncTotalesSenadores(),
              this.syncMesasSenadores(),
              this.syncTotalesDiputados(),
              this.syncMesasDiputados(),
              this.syncInstalacion(),
            ];
          }
          break;
      }

      // Ejecutar sincronizaciones en paralelo
      const results = await Promise.allSettled(syncPromises);

      // Procesar resultados según la fase
      if (phase === "instalacion" || phase === "votacion") {
        result = {
          instalacion: results[0].status === "fulfilled" ? results[0].value : { error: results[0].reason?.message },
        };
      } else {
        result = {
          totales: results[0]?.status === "fulfilled" ? results[0].value : { error: results[0]?.reason?.message },
          mesas: results[1]?.status === "fulfilled" ? results[1].value : { error: results[1]?.reason?.message },
          senadoresTotales: results[2]?.status === "fulfilled" ? results[2].value : { error: results[2]?.reason?.message },
          senadoresMesas: results[3]?.status === "fulfilled" ? results[3].value : { error: results[3]?.reason?.message },
          diputadosTotales: results[4]?.status === "fulfilled" ? results[4].value : { error: results[4]?.reason?.message },
          diputadosMesas: results[5]?.status === "fulfilled" ? results[5].value : { error: results[5]?.reason?.message },
          instalacion: results[6]?.status === "fulfilled" ? results[6].value : { error: results[6]?.reason?.message },
        };
      }

      this.syncStats.lastSync = new Date();

      // Verificar si hubo cambios
      const hasChanges = results.some(
        (r) => r.status === "fulfilled" && r.value.changed
      );

      if (hasChanges) {
        this.syncStats.successCount++;
      }

      console.log(`✅ Sincronización completada`, result);

      return {
        success: true,
        message: hasChanges ? "Datos actualizados" : "Sin cambios",
        changed: hasChanges,
        phase,
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

  // Sincronizar de forma secuencial (para evitar OOM en primera sincronización)
  async syncSequential() {
    console.log("🔄 Iniciando sincronización secuencial...");
    const results = {};

    try {
      // 1. Totales presidenciales
      console.log("1/7 Sincronizando totales presidenciales...");
      results.totales = await this.syncTotales();

      // 2. Mesas presidenciales
      console.log("2/7 Sincronizando mesas presidenciales...");
      results.mesas = await this.syncMesas();

      // 3. Totales senadores
      console.log("3/7 Sincronizando totales senadores...");
      results.senadoresTotales = await this.syncTotalesSenadores();

      // 4. Mesas senadores
      console.log("4/7 Sincronizando mesas senadores...");
      results.senadoresMesas = await this.syncMesasSenadores();

      // 5. Totales diputados
      console.log("5/7 Sincronizando totales diputados...");
      results.diputadosTotales = await this.syncTotalesDiputados();

      // 6. Mesas diputados
      console.log("6/7 Sincronizando mesas diputados...");
      results.diputadosMesas = await this.syncMesasDiputados();

      // 7. Instalación
      console.log("7/7 Sincronizando instalación...");
      results.instalacion = await this.syncInstalacion();

      this.syncStats.lastSync = new Date();

      // Verificar si hubo cambios
      const hasChanges = Object.values(results).some(r => r && r.changed);

      if (hasChanges) {
        this.syncStats.successCount++;
      }

      console.log(`✅ Sincronización secuencial completada`);

      return {
        success: true,
        message: hasChanges ? "Datos actualizados (secuencial)" : "Sin cambios",
        changed: hasChanges,
        sequential: true,
        ...results,
      };
    } catch (error) {
      console.error(`❌ Error en sincronización secuencial:`, error.message);
      this.syncStats.errorCount++;
      this.syncStats.lastError = error.message;

      return {
        success: false,
        message: error.message,
        error: true,
        sequential: true,
        ...results,
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

  // Sincronizar estado de instalación (instalacion.zip)
  async syncInstalacion() {
    const data = await this.fetchInstalacionData();

    if (!data || data.length === 0) {
      return { success: false, message: "No hay datos de instalación disponibles", changed: false };
    }

    // Verificar si hay cambios usando iteracion
    const newIteracion = data[0]?.iteracion;
    if (newIteracion === this.lastIteracionInstalacion) {
      return { success: true, message: "Sin cambios en instalación", changed: false, iteracion: newIteracion };
    }

    // Verificar porcentaje de instalación
    const porcentaje = parseFloat(data[0]?.porcentaje || "0");
    if (porcentaje >= this.instalacionCompletaThreshold && !this.instalacionCompleta) {
      this.instalacionCompleta = true;
      console.log(`✅ ¡Instalación completa alcanzada! Porcentaje: ${porcentaje}%`);
    }

    // Hay cambios, actualizar BD
    const result = await this.updateInstalacionDatabase(data);

    this.lastIteracionInstalacion = newIteracion;
    this.syncStats.lastInstalacionSync = new Date();

    return {
      success: true,
      message: "Instalación actualizada",
      changed: true,
      iteracion: newIteracion,
      porcentajeInstalacion: porcentaje,
      instalacionCompleta: this.instalacionCompleta,
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
  async updateMesasDatabase(data, customBatchSize = null) {
    console.log(`Procesando ${data.length} registros de mesas en lotes...`);

    const BATCH_SIZE = customBatchSize || 1000; // Procesar 1000 registros por defecto, o el tamaño personalizado
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

  // Descargar datos de instalación de SERVEL
  async fetchInstalacionData() {
    const url = `${this.apiUrl}/instalacion.zip`;

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000,
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
      throw new Error("Archivo JSON no encontrado en instalacion.zip");
    }

    const jsonContent = zip.readAsText(jsonEntry, "utf8");
    return JSON.parse(jsonContent);
  }

  // Actualizar base de datos con datos de instalación
  async updateInstalacionDatabase(data) {
    console.log(`Procesando ${data.length} registros de instalación en lotes...`);

    const BATCH_SIZE = 1000;
    let totalUpdated = 0;
    let totalNotFound = 0;

    // Dividir en lotes
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(data.length / BATCH_SIZE);

      console.log(`Procesando lote ${batchNumber}/${totalBatches} (${batch.length} registros)...`);

      const bulkOps = batch.map((instalacion) => ({
        updateOne: {
          filter: { id_mesa: instalacion.id_mesa },
          update: {
            $set: {
              vocales: instalacion.vocales,
              hora_instalacion: instalacion.hora_instalacion,
              hora_actualizacion: instalacion.hora_actualizacion,
              iteracion: instalacion.iteracion,
              porcentaje: instalacion.porcentaje,
            },
          },
          upsert: false, // No crear si no existe (solo actualizar)
        },
      }));

      try {
        const result = await MesaResult.bulkWrite(bulkOps, { ordered: false });
        totalUpdated += result.modifiedCount;
        totalNotFound += batch.length - result.modifiedCount;

        console.log(`Lote ${batchNumber}/${totalBatches} completado: ${result.modifiedCount} actualizados`);
      } catch (error) {
        console.error(`Error en lote ${batchNumber}:`, error.message);
      }
    }

    console.log("Datos de instalación actualizados:", {
      actualizados: totalUpdated,
      no_encontrados: totalNotFound,
      total: data.length,
    });

    return {
      actualizados: totalUpdated,
      no_encontrados: totalNotFound,
      total: data.length,
    };
  }

  // ============= MÉTODOS PARA SENADORES (ID 5) =============

  // Sincronizar totales senadores (total_votacion_5.zip)
  async syncTotalesSenadores() {
    const data = await this.fetchElectionData(5); // ID 5 = Senadores

    if (!data || data.length === 0) {
      return { success: false, message: "No hay datos de senadores disponibles", changed: false };
    }

    // Verificar si hay cambios usando iteracion
    const newIteracion = data[0]?.iteracion;
    if (newIteracion === this.lastIteracionSenadores) {
      return { success: true, message: "Sin cambios en senadores", changed: false, iteracion: newIteracion };
    }

    // Hay cambios, actualizar BD
    const result = await this.updateDatabase(data);

    this.lastIteracionSenadores = newIteracion;

    return {
      success: true,
      message: "Totales de senadores actualizados",
      changed: true,
      iteracion: newIteracion,
      ...result,
    };
  }

  // Sincronizar resultados por mesa senadores (nomina_completa_5.zip)
  async syncMesasSenadores() {
    const data = await this.fetchMesasElectionData(5); // ID 5 = Senadores

    if (!data || data.length === 0) {
      return { success: false, message: "No hay datos de mesas de senadores disponibles", changed: false };
    }

    // Verificar si hay cambios usando iteracion
    const newIteracion = data[0]?.iteracion;
    if (newIteracion === this.lastIteracionMesasSenadores) {
      return { success: true, message: "Sin cambios en mesas de senadores", changed: false, iteracion: newIteracion };
    }

    // Hay cambios, actualizar BD
    const result = await this.updateMesasDatabase(data);

    this.lastIteracionMesasSenadores = newIteracion;
    this.syncStats.lastMesasSenadoresSync = new Date();

    return {
      success: true,
      message: "Mesas de senadores actualizadas",
      changed: true,
      iteracion: newIteracion,
      ...result,
    };
  }

  // ============= MÉTODOS PARA DIPUTADOS (ID 6) =============

  // Sincronizar totales diputados (total_votacion_6.zip)
  async syncTotalesDiputados() {
    const data = await this.fetchElectionData(6); // ID 6 = Diputados

    if (!data || data.length === 0) {
      return { success: false, message: "No hay datos de diputados disponibles", changed: false };
    }

    // Verificar si hay cambios usando iteracion
    const newIteracion = data[0]?.iteracion;
    if (newIteracion === this.lastIteracionDiputados) {
      return { success: true, message: "Sin cambios en diputados", changed: false, iteracion: newIteracion };
    }

    // Hay cambios, actualizar BD
    const result = await this.updateDatabase(data);

    this.lastIteracionDiputados = newIteracion;
    this.syncStats.lastDiputadosSync = new Date();

    return {
      success: true,
      message: "Totales de diputados actualizados",
      changed: true,
      iteracion: newIteracion,
      ...result,
    };
  }

  // Sincronizar resultados por mesa diputados (nomina_completa_6.zip)
  async syncMesasDiputados() {
    const data = await this.fetchMesasElectionData(6); // ID 6 = Diputados

    if (!data || data.length === 0) {
      return { success: false, message: "No hay datos de mesas de diputados disponibles", changed: false };
    }

    // Verificar si hay cambios usando iteracion
    const newIteracion = data[0]?.iteracion;
    if (newIteracion === this.lastIteracionMesasDiputados) {
      return { success: true, message: "Sin cambios en mesas de diputados", changed: false, iteracion: newIteracion };
    }

    // Hay cambios, actualizar BD con batch size menor (diputados tiene MUCHOS más datos - 40,473 mesas)
    const result = await this.updateMesasDatabase(data, 500); // Usar batch size de 500 en lugar de 1000

    this.lastIteracionMesasDiputados = newIteracion;
    this.syncStats.lastMesasDiputadosSync = new Date();

    return {
      success: true,
      message: "Mesas de diputados actualizadas",
      changed: true,
      iteracion: newIteracion,
      ...result,
    };
  }

  // Método genérico para descargar datos de cualquier elección
  async fetchElectionData(electionId) {
    const url = `${this.apiUrl}/total_votacion_${electionId}.zip`;

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
      throw new Error(`Archivo JSON no encontrado en total_votacion_${electionId}.zip`);
    }

    const jsonContent = zip.readAsText(jsonEntry, "utf8");
    return JSON.parse(jsonContent);
  }

  // Método genérico para descargar datos de mesas de cualquier elección
  async fetchMesasElectionData(electionId) {
    const url = `${this.apiUrl}/nomina_completa_${electionId}.zip`;

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000, // Más tiempo porque es un archivo grande
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
      throw new Error(`Archivo JSON no encontrado en nomina_completa_${electionId}.zip`);
    }

    const jsonContent = zip.readAsText(jsonEntry, "utf8");
    return JSON.parse(jsonContent);
  }

  // Obtener estadísticas
  getStats() {
    return {
      isRunning: this.isRunning,
      syncInterval: this.syncInterval,
      lastIteracion: this.lastIteracion,
      lastIteracionMesas: this.lastIteracionMesas,
      lastIteracionInstalacion: this.lastIteracionInstalacion,
      lastIteracionSenadores: this.lastIteracionSenadores,
      lastIteracionMesasSenadores: this.lastIteracionMesasSenadores,
      lastIteracionDiputados: this.lastIteracionDiputados,
      lastIteracionMesasDiputados: this.lastIteracionMesasDiputados,
      smartSync: {
        enabled: this.enableSmartSync,
        currentPhase: this.getCurrentElectoralPhase(),
        instalacionHours: `${this.instalacionStart}-${this.instalacionEnd}`,
        votacionEndHour: this.votacionEnd,
        instalacionCompleta: this.instalacionCompleta,
        instalacionCompletaThreshold: this.instalacionCompletaThreshold,
      },
      ...this.syncStats,
    };
  }
}

export default SyncService;
