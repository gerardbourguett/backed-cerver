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

# Sincronización inteligente basada en fases electorales
ENABLE_SMART_SYNC=true     # true para habilitar sincronización inteligente por fase
INSTALACION_START_HOUR=08:00  # Inicio de instalación de mesas
INSTALACION_END_HOUR=12:00    # Fin de instalación / inicio de votación
VOTACION_END_HOUR=18:00       # Fin de votación / inicio de conteo
INSTALACION_COMPLETE_THRESHOLD=99.5  # Porcentaje para considerar instalación completa
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
  "lastIteracionMesas": "20251115120000",
  "lastIteracionInstalacion": "20251115120000",
  "smartSync": {
    "enabled": true,
    "currentPhase": "conteo",
    "instalacionHours": "08:00-12:00",
    "votacionEndHour": "18:00",
    "instalacionCompleta": true,
    "instalacionCompletaThreshold": 99.5
  },
  "lastSync": "2025-11-15T12:00:00.000Z",
  "successCount": 10,
  "errorCount": 0,
  "lastError": null,
  "lastMesasSync": "2025-11-15T12:00:00.000Z",
  "lastInstalacionSync": "2025-11-15T12:00:00.000Z"
}
```

---

### Senadores (Sincronización Automática)

Los endpoints de senadores funcionan de manera idéntica a los presidenciales, pero para la elección de senadores (ID 5).

#### `GET /api/senadores/resultados`
Consulta resultados senatoriales desde la base de datos.

**Query params (opcionales):**
- `tipo`: Filtrar por tipo de votación (`"nacional"`, `"extranjero"`)

**Ejemplos:**
```bash
# Todos los resultados
GET /api/senadores/resultados

# Solo resultados nacionales
GET /api/senadores/resultados?tipo=nacional
```

**Respuesta:**
```json
{
  "count": 1,
  "data": [
    {
      "name": "Total Votación Nacional",
      "iteracion": "20251115000000",
      "id_eleccion": 5,
      "votosValidos": 4500000,
      "nulos": 45000,
      "blancos": 28000,
      "totalEscrutadas": 28000,
      "totalVotacion": 4573000,
      "totalMesas": 40473,
      "totalInstaladas": 35000,
      "porc": "69.15",
      "detalles": [
        {
          "name": "LISTA A",
          "candidatos": [
            {
              "id": 51900101,
              "candidato": "JUAN PEREZ",
              "sigla_partido": "PDC",
              "totalVotosCandidatos": 1500000
            }
          ]
        }
      ]
    }
  ]
}
```

#### `GET /api/senadores/circunscripciones`
Obtiene la lista de circunscripciones senatoriales disponibles.

**Respuesta:**
```json
{
  "count": 16,
  "data": [
    {
      "id_cirsen": 1,
      "glosacirsen": "Tarapacá y Antofagasta",
      "orden_cirsen": 1
    },
    {
      "id_cirsen": 2,
      "glosacirsen": "Atacama y Coquimbo",
      "orden_cirsen": 2
    }
  ]
}
```

#### `GET /api/senadores/resultados/circunscripcion/:id_cirsen`
Obtiene resultados detallados de senadores por circunscripción, incluyendo pactos, candidatos y método D'Hont.

**Parámetros de ruta:**
- `id_cirsen`: ID de la circunscripción senatorial

**Ejemplo:**
```bash
GET /api/senadores/resultados/circunscripcion/1
```

**Respuesta:**
```json
{
  "circunscripcion": {
    "id_cirsen": 1,
    "nombre": "Tarapacá y Antofagasta"
  },
  "escrutinio": {
    "total_mesas": 2500,
    "mesas_escrutadas": 2450,
    "porcentaje": "98.00"
  },
  "votacion": {
    "total_emitidos": 125000,
    "blancos": 1500,
    "nulos": 800,
    "validos": 122700
  },
  "pactos": [
    {
      "id_pacto": 1,
      "glosa_pacto": "Chile Vamos",
      "lista": "A",
      "partidos": ["UDI", "RN"],
      "total_votos": 45000,
      "porcentaje": "36.67",
      "electos": 2,
      "candidatos": [
        {
          "id": 51900101,
          "votos": 25000,
          "candidato": "JUAN PEREZ",
          "sigla_partido": "UDI",
          "id_partido": 101,
          "id_pacto": 1,
          "orden": 1,
          "electo": 1
        }
      ]
    }
  ],
  "total_candidatos": 15
}
```

#### `GET /api/senadores/candidatos`
Obtiene la lista de todos los candidatos senatoriales o filtrados por circunscripción.

**Query params (opcionales):**
- `id_cirsen`: ID de circunscripción senatorial para filtrar candidatos

**Ejemplos:**
```bash
# Todos los candidatos
GET /api/senadores/candidatos

# Candidatos de una circunscripción específica
GET /api/senadores/candidatos?id_cirsen=1
```

**Respuesta:**
```json
{
  "count": 15,
  "id_cirsen": 1,
  "data": [
    {
      "id": 51900101,
      "orden": 1,
      "candidato": "JUAN PEREZ",
      "sigla_partido": "PDC",
      "id_partido": 101,
      "id_pacto": 1,
      "electo": 0
    }
  ]
}
```

#### `GET /api/senadores/mesas`
Obtiene resultados por mesa de senadores.

**Query params (opcionales):**
- `region`: ID de región
- `comuna`: ID de comuna
- `local`: ID de local
- `mesa`: ID de mesa
- `instalada`: Estado de instalación (0 o 1)

**Ejemplos:**
```bash
# Todas las mesas
GET /api/senadores/mesas

# Filtrar por región
GET /api/senadores/mesas?region=3015

# Mesas instaladas de una comuna
GET /api/senadores/mesas?comuna=2822&instalada=1
```

#### `POST /api/senadores/sync`
Sincroniza manualmente los datos de senadores desde SERVEL a MongoDB.

**Respuesta:**
```json
{
  "success": true,
  "message": "Sincronización de senadores iniciada en segundo plano"
}
```

#### `POST /api/senadores/sync/totales`
Sincroniza solo los totales de senadores (rápido).

#### `POST /api/senadores/sync/mesas`
Sincroniza solo las mesas de senadores (más lento, procesa muchos registros).

---

### Diputados (Sincronización Automática)

Los endpoints de diputados funcionan de manera idéntica a los presidenciales y senadores, pero para la elección de diputados (ID 6).

#### `GET /api/diputados/resultados`
Consulta resultados de diputados desde la base de datos.

**Query params (opcionales):**
- `tipo`: Filtrar por tipo de votación (`"nacional"`, `"extranjero"`)

**Ejemplos:**
```bash
# Todos los resultados
GET /api/diputados/resultados

# Solo resultados nacionales
GET /api/diputados/resultados?tipo=nacional
```

#### `GET /api/diputados/distritos`
Obtiene la lista de distritos disponibles.

**Respuesta:**
```json
{
  "count": 28,
  "data": [
    {
      "id_distrito": 1,
      "distrito": "Arica y Parinacota",
      "orden_distrito": 1
    },
    {
      "id_distrito": 2,
      "distrito": "Tarapacá",
      "orden_distrito": 2
    }
  ]
}
```

#### `GET /api/diputados/resultados/distrito/:id_distrito`
Obtiene resultados detallados de diputados por distrito, incluyendo pactos, candidatos y método D'Hont.

**Parámetros de ruta:**
- `id_distrito`: ID del distrito

**Ejemplo:**
```bash
GET /api/diputados/resultados/distrito/1
```

**Respuesta:**
```json
{
  "distrito": {
    "id_distrito": 1,
    "nombre": "Arica y Parinacota"
  },
  "escrutinio": {
    "total_mesas": 1200,
    "mesas_escrutadas": 1150,
    "porcentaje": "95.83"
  },
  "votacion": {
    "total_emitidos": 62000,
    "blancos": 800,
    "nulos": 450,
    "validos": 60750
  },
  "pactos": [
    {
      "id_pacto": 2,
      "glosa_pacto": "Apruebo Dignidad",
      "lista": "B",
      "partidos": ["PC", "FA"],
      "total_votos": 23000,
      "porcentaje": "37.86",
      "electos": 1,
      "candidatos": [
        {
          "id": 61900101,
          "votos": 14000,
          "candidato": "MARIA GONZALEZ",
          "sigla_partido": "PS",
          "id_partido": 102,
          "id_pacto": 2,
          "orden": 1,
          "electo": 1
        }
      ]
    }
  ],
  "total_candidatos": 25
}
```

#### `GET /api/diputados/candidatos`
Obtiene la lista de todos los candidatos de diputados o filtrados por distrito.

**Query params (opcionales):**
- `id_distrito`: ID de distrito para filtrar candidatos

**Ejemplos:**
```bash
# Todos los candidatos
GET /api/diputados/candidatos

# Candidatos de un distrito específico
GET /api/diputados/candidatos?id_distrito=1
```

**Respuesta:**
```json
{
  "count": 25,
  "id_distrito": 1,
  "data": [
    {
      "id": 61900101,
      "orden": 1,
      "candidato": "MARIA GONZALEZ",
      "sigla_partido": "PS",
      "id_partido": 102,
      "id_pacto": 2,
      "electo": 0
    }
  ]
}
```

#### `GET /api/diputados/mesas`
Obtiene resultados por mesa de diputados.

**Query params (opcionales):**
- `region`: ID de región
- `comuna`: ID de comuna
- `local`: ID de local
- `mesa`: ID de mesa
- `instalada`: Estado de instalación (0 o 1)

**Ejemplos:**
```bash
# Todas las mesas
GET /api/diputados/mesas

# Filtrar por región
GET /api/diputados/mesas?region=3015

# Mesas instaladas de una comuna
GET /api/diputados/mesas?comuna=2822&instalada=1
```

#### `POST /api/diputados/sync`
Sincroniza manualmente los datos de diputados desde SERVEL a MongoDB.

**Respuesta:**
```json
{
  "success": true,
  "message": "Sincronización de diputados iniciada en segundo plano"
}
```

#### `POST /api/diputados/sync/totales`
Sincroniza solo los totales de diputados (rápido).

#### `POST /api/diputados/sync/mesas`
Sincroniza solo las mesas de diputados (más lento, procesa muchos registros).

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

**2. Día de la elección - Iniciar sincronización manual (recomendado):**
```bash
# Iniciar sincronización manualmente (evita saturar el sistema)
curl -X POST http://localhost:3000/api/presidenciales/sync/start

# Configuración en .env
AUTO_START_SYNC=false  # false para control manual (recomendado)
SYNC_INTERVAL=30000  # 30 segundos para actualizaciones frecuentes
```

**3. Monitorear sincronización:**
```bash
# Ver estadísticas
curl http://localhost:3000/api/presidenciales/sync/stats

# Consultar resultados actualizados de presidenciales
curl http://localhost:3000/api/presidenciales/resultados?tipo=nacional

# Consultar resultados de senadores
curl http://localhost:3000/api/senadores/resultados?tipo=nacional

# Consultar resultados de diputados
curl http://localhost:3000/api/diputados/resultados?tipo=nacional
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
6. **Sincronización por fases**: Ajusta automáticamente qué sincronizar según la hora del día

### Sincronización Inteligente por Fases Electorales

Cuando `ENABLE_SMART_SYNC=true`, el sistema ajusta automáticamente qué datos sincronizar según la fase electoral:

#### Fases del Día Electoral

**📍 Fase de Instalación (08:00-12:00)**
- **Qué sincroniza**: Solo `instalacion.zip`
- **Por qué**: Las mesas se están instalando, los datos de votos aún no existen
- **Uso**: Monitorear el progreso de instalación de mesas en tiempo real

**🗳️ Fase de Votación (12:00-18:00)**
- **Qué sincroniza**: Solo `instalacion.zip`
- **Por qué**: Votación en curso, los resultados no se publican hasta el cierre
- **Uso**: Verificar estado de mesas instaladas

**📊 Fase de Conteo (18:00+)**
- **Qué sincroniza**: Todo (presidenciales, senadores y diputados)
  - `total_votacion_4.zip` (presidenciales totales)
  - `nomina_completa_4.zip` (presidenciales por mesa)
  - `total_votacion_5.zip` (senadores totales)
  - `nomina_completa_5.zip` (senadores por mesa)
  - `total_votacion_6.zip` (diputados totales)
  - `nomina_completa_6.zip` (diputados por mesa)
  - `instalacion.zip` (estado de mesas)
- **Por qué**: Comienza el escrutinio, los resultados se actualizan constantemente
- **Uso**: Obtener resultados en tiempo real a medida que se cuentan los votos

**⏸️ Fuera de Horario (antes de 08:00)**
- **Qué sincroniza**: Nada
- **Por qué**: No hay actividad electoral
- **Uso**: Conservar recursos

#### Ventajas de Smart Sync

- ✅ **Eficiencia**: No descarga datos innecesarios (ej: resultados antes de las 18:00)
- ✅ **Precisión**: Sincroniza lo relevante para cada momento del día electoral
- ✅ **Recursos**: Reduce carga en servidor y bandwidth
- ✅ **Flexibilidad**: Horarios configurables vía variables de entorno
- ✅ **Optimización de instalación**: Deja de sincronizar instalacion.zip cuando alcanza 99.5% (configurable)

### Características clave

- ✅ **Sin duplicados**: Detecta cambios antes de actualizar
- ✅ **Eficiente**: No consume recursos innecesariamente
- ✅ **Resiliente**: Registra errores sin detener el servicio
- ✅ **Configurable**: Intervalo ajustable según necesidades
- ✅ **Control manual**: Iniciar/detener en cualquier momento
- ✅ **Estadísticas**: Monitoreo en tiempo real
- ✅ **Optimizado para memoria**: Primera sincronización es secuencial para evitar OOM, sincronizaciones subsecuentes son paralelas para velocidad

### Configuración recomendada

**Para desarrollo/testing:**
```env
AUTO_START_SYNC=false
SYNC_INTERVAL=60000  # 1 minuto
ENABLE_SMART_SYNC=false  # Sincronizar todo siempre
```

**Para día de elección (RECOMENDADO):**
```env
AUTO_START_SYNC=false  # Iniciar manualmente para evitar saturar el sistema
SYNC_INTERVAL=30000  # 30 segundos
ENABLE_SMART_SYNC=true  # Activar sincronización por fases
INSTALACION_START_HOUR=08:00
INSTALACION_END_HOUR=12:00
VOTACION_END_HOUR=18:00
```
*Iniciar con: `POST /api/presidenciales/sync/start`*

**Para después de la elección (modo archivo):**
```env
AUTO_START_SYNC=false
SYNC_INTERVAL=300000  # 5 minutos
ENABLE_SMART_SYNC=false  # Sincronizar todo
```
*Iniciar manualmente si se necesitan actualizaciones*

**Para pruebas de resultados (simular fase de conteo):**
```env
AUTO_START_SYNC=false  # Control manual recomendado
SYNC_INTERVAL=30000  # 30 segundos
ENABLE_SMART_SYNC=false  # Sincronizar todo sin restricciones horarias
```
*Iniciar con: `POST /api/presidenciales/sync/start`*

---

## Colecciones de MongoDB

### `territories`
Almacena datos de territorios electorales (regiones, comunas, locales, mesas).

### `presidential_results`
Almacena resultados agregados de todas las elecciones:
- Presidenciales (id_eleccion: 4)
- Senadores (id_eleccion: 5)
- Diputados (id_eleccion: 6)

### `candidates`
Almacena información de candidatos presidenciales.

### `mesa_results`
Almacena resultados desagregados por mesa de todas las elecciones:
- Presidenciales (cod_eleccion: 4)
- Senadores (cod_eleccion: 5)
- Diputados (cod_eleccion: 6)

---

---

## Automatización de Actualizaciones en Producción (Railway)

### Configuración de Variables de Entorno en Railway

1. **Ir al dashboard de Railway**: https://railway.app/dashboard
2. **Seleccionar tu proyecto**: `backed-cerver`
3. **Ir a Variables**: Hacer click en la pestaña "Variables"
4. **Agregar las siguientes variables**:

```env
PORT=3000
API_URL=https://elecciones.servel.cl
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/servel

# Sincronización manual (evita saturar el sistema)
AUTO_START_SYNC=false
SYNC_INTERVAL=30000

# Sincronización inteligente
ENABLE_SMART_SYNC=true
INSTALACION_START_HOUR=08:00
INSTALACION_END_HOUR=12:00
VOTACION_END_HOUR=18:00
INSTALACION_COMPLETE_THRESHOLD=99.5
```

**Nota:** Iniciar sincronización manualmente con `POST /api/presidenciales/sync/start` cuando sea necesario.

### Auto-Deploy desde GitHub

Railway se actualiza automáticamente cuando haces push a la rama principal:

```bash
# 1. Hacer cambios en el código
# 2. Commit
git add .
git commit -m "feat: Mejoras en sincronización"

# 3. Push a la rama principal (Railway detecta el cambio y redeploys)
git push origin main
```

**¿Qué pasa cuando haces push?**
1. Railway detecta el nuevo commit en GitHub
2. Descarga el código actualizado
3. Ejecuta `npm install` (si package.json cambió)
4. Reinicia el servidor con el nuevo código
5. La sincronización está configurada como manual (AUTO_START_SYNC=false) para evitar saturar el sistema

### Sincronización Manual

Después del deploy, puedes iniciar la sincronización manualmente cuando lo necesites:

```bash
# Iniciar sincronización automática
curl -X POST https://tu-app.railway.app/api/presidenciales/sync/start

# Ver estadísticas de sincronización
curl https://tu-app.railway.app/api/presidenciales/sync/stats

# Si está corriendo, deberías ver:
{
  "isRunning": true,
  "smartSync": {
    "enabled": true,
    "currentPhase": "instalacion",  // o "votacion", "conteo"
    "instalacionCompleta": false
  }
}

# Detener sincronización cuando no sea necesaria
curl -X POST https://tu-app.railway.app/api/presidenciales/sync/stop
```

### Monitoreo en Tiempo Real

**Logs de Railway**:
1. Ir a tu proyecto en Railway
2. Click en "Deployments"
3. Click en el deployment activo
4. Ver logs en tiempo real

Verás mensajes como:
```
🚀 Iniciando sincronización automática cada 30s
🔄 [2025-11-16T08:30:00.000Z] Sincronizando datos presidenciales... (Fase: instalacion)
📍 Fase de instalación: sincronizando solo instalacion.zip
✅ Sincronización completada
```

### Optimización Automática de Instalación

El sistema detecta automáticamente cuando la instalación alcanza el threshold (default: 99.5%):

```
🔄 [2025-11-16T13:00:00.000Z] Sincronizando datos presidenciales... (Fase: votacion)
✅ ¡Instalación completa alcanzada! Porcentaje: 99.8%
✅ Instalación completa (99.5%), omitiendo sincronización
```

A partir de ese momento, **deja de sincronizar instalacion.zip** durante las fases de instalación y votación, ahorrando recursos y bandwidth.

### Troubleshooting

**Para iniciar la sincronización manualmente:**
1. Usar el endpoint `POST /api/presidenciales/sync/start`
2. Verificar con `GET /api/presidenciales/sync/stats` que isRunning=true
3. Detener con `POST /api/presidenciales/sync/stop` cuando no sea necesaria

**Si hay errores al sincronizar:**
1. Revisar logs para errores de conexión a MongoDB
2. Verificar que `MONGODB_URI` es correcta

**Si hay errores de MongoDB:**
1. Asegúrate de usar MongoDB Atlas (no local)
2. Verifica que la IP de Railway está en la whitelist de MongoDB Atlas (o usa "Allow from anywhere: 0.0.0.0/0")
3. Verifica credenciales en `MONGODB_URI`

**Para forzar re-deploy:**
```bash
# Opción 1: Hacer un commit vacío
git commit --allow-empty -m "chore: Force redeploy"
git push origin main

# Opción 2: Desde Railway dashboard
# Click en "Deployments" > "Redeploy"
```

---

## Próximas mejoras

- [ ] WebSockets para notificaciones en tiempo real al frontend
- [ ] Endpoints para resultados desagregados por mesa
- [ ] Historial de cambios (tracking de actualizaciones)
- [ ] Dashboard de monitoreo de sincronización
- [ ] Alertas cuando hay cambios significativos
