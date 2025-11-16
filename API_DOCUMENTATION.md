# Documentación Completa de API - Electoral Backend

Base URL: `https://backed-cerver-production.up.railway.app`

## Índice

- [Territorios](#territorios)
- [Presidenciales](#presidenciales)
- [Senadores](#senadores)
- [Diputados](#diputados)
- [Sincronización](#sincronización)

---

## Territorios

### GET /api/territorios/nacional
Obtiene territorios desde la base de datos con filtros opcionales.

**Query Parameters:**
- `region` (opcional): ID de región
- `comuna` (opcional): ID de comuna
- `local` (opcional): ID de local
- `mesa` (opcional): ID de mesa

**Ejemplo:**
```bash
GET /api/territorios/nacional?region=3015&comuna=2822
```

**Respuesta:**
```json
{
  "count": 150,
  "data": [
    {
      "id_mesa": "4-3015-2822-0001-1",
      "id_region": 3015,
      "region": "Región Metropolitana",
      "id_comuna": 2822,
      "comuna": "Santiago",
      "id_cirsen": 7,
      "glosacirsen": "Región Metropolitana",
      "id_distrito": 10,
      "distrito": "Distrito 10"
    }
  ]
}
```

### POST /api/territorios/nacional/cargar
Carga territorios desde la API de SERVEL.

**Respuesta:**
```json
{
  "message": "Territorios cargados exitosamente",
  "insertados": 45000,
  "actualizados": 0,
  "total": 45000
}
```

---

## Presidenciales

### GET /api/presidenciales/resultados
Obtiene resultados presidenciales.

**Query Parameters:**
- `tipo` (opcional): "nacional" o "extranjero"

**Ejemplo:**
```bash
GET /api/presidenciales/resultados?tipo=nacional
```

### GET /api/presidenciales/candidatos
Obtiene lista de candidatos presidenciales.

**Respuesta:**
```json
{
  "count": 8,
  "data": [
    {
      "id": 41900101,
      "orden": 1,
      "electo": 0,
      "candidato": "JOSÉ ANTONIO KAST",
      "sigla_partido": "REP"
    }
  ]
}
```

### GET /api/presidenciales/mesas
Obtiene resultados por mesa.

**Query Parameters:**
- `region`: ID de región
- `comuna`: ID de comuna
- `local`: ID de local
- `mesa`: ID de mesa
- `instalada`: 0 o 1

**Ejemplo:**
```bash
GET /api/presidenciales/mesas?region=3015&instalada=1
```

### GET /api/presidenciales/instalacion
Obtiene datos de instalación de mesas.

---

## Senadores

### GET /api/senadores/circunscripciones
Lista todas las circunscripciones senatoriales.

**Respuesta:**
```json
{
  "count": 16,
  "data": [
    {
      "id_cirsen": 1,
      "glosacirsen": "Tarapacá y Antofagasta",
      "orden_cirsen": 1
    }
  ]
}
```

### GET /api/senadores/resultados
Obtiene resultados generales de senadores.

**Query Parameters:**
- `tipo` (opcional): "nacional" o "extranjero"

### GET /api/senadores/resultados/circunscripcion/:id_cirsen
Obtiene resultados detallados por circunscripción con pactos y método D'Hont.

**Parámetros de ruta:**
- `id_cirsen`: ID de circunscripción senatorial

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

### GET /api/senadores/electos/circunscripcion/:id_cirsen
Obtiene SOLO los candidatos electos de una circunscripción.

**Parámetros de ruta:**
- `id_cirsen`: ID de circunscripción senatorial

**Ejemplo:**
```bash
GET /api/senadores/electos/circunscripcion/1
```

**Respuesta:**
```json
{
  "circunscripcion": {
    "id_cirsen": 1,
    "nombre": "Tarapacá y Antofagasta"
  },
  "total_electos": 2,
  "electos": [
    {
      "id": 51900101,
      "candidato": "JUAN PEREZ",
      "sigla_partido": "UDI",
      "id_partido": 101,
      "id_pacto": 1,
      "orden": 1,
      "electo": 1
    },
    {
      "id": 51900102,
      "candidato": "MARIA GONZALEZ",
      "sigla_partido": "RN",
      "id_partido": 102,
      "id_pacto": 1,
      "orden": 2,
      "electo": 1
    }
  ]
}
```

### GET /api/senadores/candidatos
Obtiene candidatos senatoriales.

**Query Parameters:**
- `id_cirsen` (opcional): Filtrar por circunscripción

**Ejemplo:**
```bash
GET /api/senadores/candidatos?id_cirsen=1
```

### GET /api/senadores/mesas
Obtiene resultados por mesa de senadores.

**Query Parameters:**
- `region`, `comuna`, `local`, `mesa`, `instalada`

---

## Diputados

### GET /api/diputados/distritos
Lista todos los distritos.

**Respuesta:**
```json
{
  "count": 28,
  "data": [
    {
      "id_distrito": 1,
      "distrito": "Arica y Parinacota",
      "orden_distrito": 1
    }
  ]
}
```

### GET /api/diputados/resultados
Obtiene resultados generales de diputados.

**Query Parameters:**
- `tipo` (opcional): "nacional" o "extranjero"

### GET /api/diputados/resultados/distrito/:id_distrito
Obtiene resultados detallados por distrito con pactos y método D'Hont.

**Parámetros de ruta:**
- `id_distrito`: ID del distrito

**Ejemplo:**
```bash
GET /api/diputados/resultados/distrito/1
```

**Respuesta:** Similar a senadores pero por distrito.

### GET /api/diputados/electos/distrito/:id_distrito
Obtiene SOLO los candidatos electos de un distrito.

**Parámetros de ruta:**
- `id_distrito`: ID del distrito

**Ejemplo:**
```bash
GET /api/diputados/electos/distrito/1
```

**Respuesta:**
```json
{
  "distrito": {
    "id_distrito": 1,
    "nombre": "Arica y Parinacota"
  },
  "total_electos": 3,
  "electos": [
    {
      "id": 61900101,
      "candidato": "PEDRO SANCHEZ",
      "sigla_partido": "PS",
      "id_partido": 102,
      "id_pacto": 2,
      "orden": 1,
      "electo": 1
    }
  ]
}
```

### GET /api/diputados/candidatos
Obtiene candidatos de diputados.

**Query Parameters:**
- `id_distrito` (opcional): Filtrar por distrito

### GET /api/diputados/mesas
Obtiene resultados por mesa de diputados.

**Query Parameters:**
- `region`, `comuna`, `local`, `mesa`, `instalada`

---

## Sincronización

### GET /api/presidenciales/sync/stats
Obtiene estadísticas de sincronización.

**Respuesta:**
```json
{
  "isRunning": false,
  "syncInterval": 30000,
  "lastIteracion": "20251116000000",
  "lastIteracionMesas": "20251116000000",
  "lastIteracionInstalacion": null,
  "lastIteracionSenadores": null,
  "lastIteracionMesasSenadores": null,
  "lastIteracionDiputados": null,
  "lastIteracionMesasDiputados": null,
  "smartSync": {
    "enabled": true,
    "currentPhase": "conteo",
    "instalacionHours": "23:00-23:50",
    "votacionEndHour": "00:00",
    "instalacionCompleta": false
  },
  "lastSync": "2025-11-16T20:11:57.225Z",
  "successCount": 5,
  "errorCount": 1,
  "lastError": null
}
```

### POST /api/presidenciales/sync/start
Inicia sincronización automática.

**Respuesta:**
```json
{
  "success": true,
  "message": "Sincronización automática iniciada"
}
```

### POST /api/presidenciales/sync/stop
Detiene sincronización automática.

**Respuesta:**
```json
{
  "success": true,
  "message": "Sincronización automática detenida"
}
```

### POST /api/presidenciales/sync
Ejecuta sincronización manual única.

### POST /api/presidenciales/sync/totales
Sincroniza solo totales presidenciales (rápido).

### POST /api/presidenciales/sync/mesas
Sincroniza solo mesas presidenciales (lento).

### POST /api/presidenciales/sync/instalacion
Sincroniza solo instalación de mesas.

### POST /api/senadores/sync
Sincroniza datos de senadores (totales + mesas).

### POST /api/senadores/sync/totales
Sincroniza solo totales de senadores.

### POST /api/senadores/sync/mesas
Sincroniza solo mesas de senadores.

### POST /api/diputados/sync
Sincroniza datos de diputados (totales + mesas).

### POST /api/diputados/sync/totales
Sincroniza solo totales de diputados.

### POST /api/diputados/sync/mesas
Sincroniza solo mesas de diputados (usa batch size optimizado de 500 registros).

---

## Notas Técnicas

### Método D'Hont
Los endpoints de resultados por circunscripción/distrito muestran candidatos electos según el campo `electo` que viene de SERVEL, calculado usando el método D'Hont oficial.

### Optimización de Memoria
- Diputados usa batch size de 500 (vs 1000) para evitar OOM
- Primera sincronización es secuencial
- Sincronizaciones subsecuentes son paralelas

### Fases Electorales (Smart Sync)
- **Instalación** (08:00-12:00): Solo sincroniza instalacion.zip
- **Votación** (12:00-18:00): Solo sincroniza instalacion.zip
- **Conteo** (18:00+): Sincroniza todo (7 archivos)

### Estructura de Datos
- **Presidenciales**: ID elección 4
- **Senadores**: ID elección 5
- **Diputados**: ID elección 6

### Colecciones MongoDB
- `territories`: Datos de territorios (regiones, comunas, locales, mesas)
- `presidential_results`: Resultados totales (todas las elecciones)
- `mesa_results`: Resultados por mesa (todas las elecciones)
- `candidates`: Candidatos únicos

---

## Ejemplos de Uso

### Obtener electos de todas las circunscripciones
```bash
# Primero obtener lista de circunscripciones
curl https://backed-cerver-production.up.railway.app/api/senadores/circunscripciones

# Luego iterar por cada una
for i in {1..16}; do
  curl https://backed-cerver-production.up.railway.app/api/senadores/electos/circunscripcion/$i
done
```

### Obtener electos de todos los distritos
```bash
# Primero obtener lista de distritos
curl https://backed-cerver-production.up.railway.app/api/diputados/distritos

# Luego iterar por cada uno
for i in {1..28}; do
  curl https://backed-cerver-production.up.railway.app/api/diputados/electos/distrito/$i
done
```

### Sincronización Manual
```bash
# Iniciar sincronización
curl -X POST https://backed-cerver-production.up.railway.app/api/presidenciales/sync/start

# Esperar un momento y verificar estado
curl https://backed-cerver-production.up.railway.app/api/presidenciales/sync/stats

# Detener cuando termine
curl -X POST https://backed-cerver-production.up.railway.app/api/presidenciales/sync/stop
```
