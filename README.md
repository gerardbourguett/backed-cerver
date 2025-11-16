# Backend SERVEL - API de Territorios y Resultados Electorales

API para consultar y almacenar datos de territorios electorales de Chile desde SERVEL.

## Tecnologías

- Node.js + Express
- MongoDB + Mongoose
- Axios
- AdmZip

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno en `.env`:
```env
PORT=3000
API_URL=https://elecciones.servel.cl
MONGODB_URI=mongodb://localhost:27017/servel

# Sincronización automática (opcional)
AUTO_START_SYNC=false      # true para iniciar sync automáticamente al arrancar
SYNC_INTERVAL=60000        # Intervalo en milisegundos (60000 = 1 minuto)
```

3. Asegurarse de tener MongoDB ejecutándose localmente o usar MongoDB Atlas:
```bash
# MongoDB local
mongod

# O usar MongoDB Atlas (actualizar MONGODB_URI en .env)
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/servel
```

4. Iniciar el servidor:
```bash
npm start
# o en modo desarrollo
npm run dev
```

## Endpoints

### Territorios

#### `POST /api/territorios/nacional/cargar`
Descarga los territorios desde la API de SERVEL y los guarda en la base de datos.

**Respuesta:**
```json
{
  "message": "Territorios cargados exitosamente",
  "insertados": 45000,
  "actualizados": 0,
  "total": 45000
}
```

#### `GET /api/territorios/nacional`
Consulta territorios desde la base de datos. Soporta filtros opcionales.

**Query params (opcionales):**
- `region`: ID de región (ej: `3015`)
- `comuna`: ID de comuna (ej: `2822`)
- `local`: ID de local (ej: `10272811`)
- `mesa`: ID de mesa (ej: `700100294`)

**Ejemplos:**
```bash
# Obtener todos los territorios
GET /api/territorios/nacional

# Filtrar por región
GET /api/territorios/nacional?region=3015

# Filtrar por comuna
GET /api/territorios/nacional?comuna=2822

# Filtrar por local
GET /api/territorios/nacional?local=10272811

# Filtrar por mesa específica
GET /api/territorios/nacional?mesa=700100294

# Combinar filtros
GET /api/territorios/nacional?region=3015&comuna=2822
```

**Respuesta:**
```json
{
  "count": 1,
  "data": [
    {
      "id_mesa": "700100294",
      "id_region": 3015,
      "region": "DE ARICA Y PARINACOTA",
      "id_comuna": 2822,
      "comuna": "ARICA",
      "id_local": 10272811,
      "local": "AZAPA VALLEY SCHOOL",
      "mesa": "Mesa 294",
      "eleccion_presidencial": true,
      "eleccion_diputados": true,
      "eleccion_senadores": true,
      // ... más campos
    }
  ]
}
```

#### `GET /api/territorios/nacional/directo`
Obtiene territorios directamente desde la API de SERVEL sin guardar en BD (modo legacy).

### Resultados

#### `GET /api/resultados/constitucion`
Obtiene la constitución de mesas desde la API de SERVEL.

---

### Presidenciales (Sincronización Automática)

#### `GET /api/presidenciales/resultados`
Consulta resultados presidenciales desde la base de datos.

**Query params (opcionales):**
- `tipo`: Filtrar por tipo de votación (`"nacional"`, `"extranjero"`)

**Ejemplos:**
```bash
# Todos los resultados
GET /api/presidenciales/resultados

# Solo resultados nacionales
GET /api/presidenciales/resultados?tipo=nacional

# Solo resultados del extranjero
GET /api/presidenciales/resultados?tipo=extranjero
```

**Respuesta:**
```json
{
  "count": 3,
  "data": [
    {
      "name": "Total Votación Nacional",
      "iteracion": "20251115000000",
      "id_eleccion": 4,
      "votosValidos": 5000000,
      "nulos": 50000,
      "blancos": 30000,
      "totalEscrutadas": 30000,
      "totalVotacion": 5080000,
      "totalMesas": 40473,
      "totalInstaladas": 35000,
      "porc": "74.20",
      "detalles": [
        {
          "name": "CANDIDATURAS INDEPENDIENTES",
          "candidatos": [
            {
              "id": 41900107,
              "candidato": "EVELYN MATTHEI FORNET",
              "sigla_partido": "UDI",
              "totalVotosCandidatos": 2000000
            }
            // ... más candidatos
          ]
        }
      ]
    }
  ]
}
```

#### `GET /api/presidenciales/candidatos`
Obtiene la lista de todos los candidatos presidenciales.

**Respuesta:**
```json
{
  "count": 8,
  "data": [
    {
      "id": 41900101,
      "orden": 1,
      "candidato": "FRANCO PARISI FERNANDEZ",
      "sigla_partido": "PDG"
    }
    // ... más candidatos
  ]
}
```

#### `POST /api/presidenciales/sync`
Sincroniza manualmente los datos presidenciales desde SERVEL a MongoDB.

**Respuesta:**
```json
{
  "success": true,
  "message": "Datos actualizados",
  "changed": true,
  "iteracion": "20251115120000",
  "resultados": {
    "insertados": 0,
    "actualizados": 3,
    "total": 3
  },
  "candidatos": {
    "insertados": 0,
    "actualizados": 8,
    "total": 8
  }
}
```

#### `POST /api/presidenciales/sync/start`
Inicia la sincronización automática periódica.

**Respuesta:**
```json
{
  "success": true,
  "message": "Sincronización automática iniciada",
  "stats": {
    "isRunning": true,
    "syncInterval": 60000,
    "lastIteracion": "20251115120000",
    "lastSync": "2025-11-15T12:00:00.000Z",
    "successCount": 5,
    "errorCount": 0
  }
}
```

#### `POST /api/presidenciales/sync/stop`
Detiene la sincronización automática.

**Respuesta:**
```json
{
  "success": true,
  "message": "Sincronización automática detenida",
  "stats": { /* estadísticas */ }
}
```

#### `GET /api/presidenciales/sync/stats`
Obtiene estadísticas del servicio de sincronización.

**Respuesta:**
```json
{
  "isRunning": true,
  "syncInterval": 60000,
  "lastIteracion": "20251115120000",
  "lastSync": "2025-11-15T12:00:00.000Z",
  "successCount": 10,
  "errorCount": 0,
  "lastError": null
}
```

---

## Uso típico

1. **Primera vez**: Cargar territorios en la base de datos
```bash
curl -X POST http://localhost:3000/api/territorios/nacional/cargar
```

2. **Consultar territorios**: Usar el endpoint GET con filtros
```bash
curl http://localhost:3000/api/territorios/nacional?comuna=2822
```

3. **Relacionar con resultados**: Los datos de territorios ahora están en BD y pueden ser relacionados con resultados electorales mediante los IDs (id_mesa, id_comuna, id_region, etc.)

### Flujo para el día de la elección

**1. Preparación (antes del día de la elección):**
```bash
# Cargar datos de territorios
curl -X POST http://localhost:3000/api/territorios/nacional/cargar
```

**2. Día de la elección - Iniciar sincronización automática:**
```bash
# Opción A: Configurar auto-inicio en .env
AUTO_START_SYNC=true
SYNC_INTERVAL=30000  # 30 segundos para actualizaciones más frecuentes

# Opción B: Iniciar manualmente
curl -X POST http://localhost:3000/api/presidenciales/sync/start
```

**3. Monitorear sincronización:**
```bash
# Ver estadísticas
curl http://localhost:3000/api/presidenciales/sync/stats

# Consultar resultados actualizados
curl http://localhost:3000/api/presidenciales/resultados?tipo=nacional
```

**4. Detener sincronización (después de la elección):**
```bash
curl -X POST http://localhost:3000/api/presidenciales/sync/stop
```

## Estructura de datos de Territorio

Cada registro de territorio contiene:

- **Región**: id_region, region, orden_region
- **Circunscripción Senatorial**: id_cirsen, glosacirsen, orden_cirsen
- **Distrito**: id_distrito, distrito, orden_distrito
- **Provincia**: id_provincia, provincia, orden_provincia
- **Comuna**: id_comuna, comuna, orden_comuna
- **Local**: id_local, local, orden_local
- **Mesa**: id_mesa, mesa
- **Elecciones**: eleccion_presidencial, eleccion_diputados, eleccion_senadores
- **Cupos**: cupos_presidencial, cupos_diputados, cupos_senadores
- **Timestamps**: createdAt, updatedAt

## Índices creados

Para optimizar las consultas, se crearon índices en:
- `id_mesa` (único)
- `id_region`
- `id_cirsen`
- `id_distrito`
- `id_provincia`
- `id_comuna`
- `id_local`
- Índices compuestos: `{id_region, id_comuna}`, `{id_comuna, id_local}`, `{id_local, id_mesa}`

## Ventajas de usar la BD

1. **Performance**: Consultas mucho más rápidas que descargar el ZIP cada vez
2. **Filtrado**: Puedes filtrar por región, comuna, local, mesa
3. **Relaciones**: Fácil de relacionar con datos de resultados usando los IDs
4. **Actualización**: El endpoint POST permite actualizar los datos cuando cambian
5. **Disponibilidad**: No dependes de que la API de SERVEL esté disponible

---

## Sistema de Sincronización Inteligente

### ¿Cómo funciona?

El servicio de sincronización automática:

1. **Polling periódico**: Descarga los datos de SERVEL cada X segundos (configurable)
2. **Detección de cambios**: Compara el campo `iteracion` (timestamp de SERVEL) con la última versión guardada
3. **Actualización incremental**: Solo actualiza MongoDB si detecta cambios reales
4. **Optimización**: Usa `bulkWrite` para máxima eficiencia
5. **Monitoreo**: Registra estadísticas de sincronización (éxitos, errores, última actualización)

### Características clave

- ✅ **Sin duplicados**: Detecta cambios antes de actualizar
- ✅ **Eficiente**: No consume recursos innecesariamente
- ✅ **Resiliente**: Registra errores sin detener el servicio
- ✅ **Configurable**: Intervalo ajustable según necesidades
- ✅ **Control manual**: Iniciar/detener en cualquier momento
- ✅ **Estadísticas**: Monitoreo en tiempo real

### Configuración recomendada

**Para desarrollo/testing:**
```env
AUTO_START_SYNC=false
SYNC_INTERVAL=60000  # 1 minuto
```

**Para día de elección:**
```env
AUTO_START_SYNC=true
SYNC_INTERVAL=30000  # 30 segundos
```

**Para después de la elección (modo archivo):**
```env
AUTO_START_SYNC=false
SYNC_INTERVAL=300000  # 5 minutos
```

---

## Colecciones de MongoDB

### `territories`
Almacena datos de territorios electorales (regiones, comunas, locales, mesas).

### `presidential_results`
Almacena resultados agregados de votación presidencial (nacional, extranjero).

### `candidates`
Almacena información de candidatos presidenciales.

---

## Próximas mejoras

- [ ] WebSockets para notificaciones en tiempo real al frontend
- [ ] Endpoints para resultados desagregados por mesa
- [ ] Historial de cambios (tracking de actualizaciones)
- [ ] Dashboard de monitoreo de sincronización
- [ ] Alertas cuando hay cambios significativos
