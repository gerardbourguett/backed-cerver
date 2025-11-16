# Test Nocturno de Sincronización (23:17 - 00:00+)

## Configuración del Test

**Horarios programados:**
- **23:00-23:50**: Fase de instalación → Sincroniza solo `instalacion.zip`
- **23:50-00:00**: Fase de votación → Sincroniza solo `instalacion.zip`
- **00:00+**: Fase de conteo → Sincroniza TODO (totales, mesas, instalación)

**Intervalo de sincronización:** 30 segundos (para ver cambios rápido)

## Cómo Iniciar el Test

### 1. Iniciar el servidor

```bash
npm start
```

Deberías ver:
```
🤖 Auto-inicio de sincronización habilitado
🚀 Iniciando sincronización automática cada 30s
Server is running on port 3000
```

### 2. Verificar que está en la fase correcta

En otra terminal:
```bash
curl http://localhost:3000/api/presidenciales/sync/stats
```

Deberías ver:
```json
{
  "isRunning": true,
  "syncInterval": 30000,
  "smartSync": {
    "enabled": true,
    "currentPhase": "instalacion",  // ← Debería ser "instalacion" ahora (23:17)
    "instalacionHours": "23:00-23:50",
    "votacionEndHour": "00:00",
    "instalacionCompleta": false
  }
}
```

## Qué Observar Durante el Test

### Durante la Fase de Instalación (23:17 - 23:50)

**En los logs del servidor verás:**
```
🔄 [2025-11-16T23:17:XX] Sincronizando datos presidenciales... (Fase: instalacion)
📍 Fase de instalación: sincronizando solo instalacion.zip
Procesando 40473 registros de instalación en lotes...
Procesando lote 1/41 (1000 registros)...
Lote 1/41 completado: 1000 actualizados
...
✅ Sincronización completada
```

**Cada 30 segundos** sincronizará `instalacion.zip` y actualizará la base de datos.

### Transición a Fase de Votación (23:50)

**Verás:**
```
🔄 [2025-11-16T23:50:XX] Sincronizando datos presidenciales... (Fase: votacion)
🗳️  Fase de votación: sincronizando solo instalacion.zip
```

### Transición a Fase de Conteo (00:00)

**¡Aquí es donde cambia todo!**
```
🔄 [2025-11-16T00:00:XX] Sincronizando datos presidenciales... (Fase: conteo)
📊 Fase de conteo: sincronizando todo (totales, mesas, instalación)
```

Ahora sincronizará:
1. `total_votacion_4.zip` (totales)
2. `nomina_completa_4.zip` (mesas - ~40K registros)
3. `instalacion.zip` (instalación)

## Monitoreo en Tiempo Real

### Ver estadísticas cada 10 segundos

```bash
watch -n 10 'curl -s http://localhost:3000/api/presidenciales/sync/stats | jq'
```

### Ver solo la fase actual

```bash
watch -n 5 'curl -s http://localhost:3000/api/presidenciales/sync/stats | jq ".smartSync.currentPhase"'
```

### Ver resultados en la base de datos

```bash
# Ver cuántas mesas se han actualizado
curl http://localhost:3000/api/presidenciales/mesas | jq '.count'

# Ver estado de instalación de mesas
curl 'http://localhost:3000/api/presidenciales/mesas?instalada=1' | jq '.count'
```

## Pruebas Específicas

### 1. Probar endpoint de instalación directo (sin BD)

```bash
curl http://localhost:3000/api/presidenciales/instalacion | jq '.[0]'
```

Verás:
```json
{
  "id_mesa": "700100294",
  "vocales": "3",
  "hora_instalacion": "08:30:00",
  "hora_actualizacion": "09:15:00",
  "instalada": 1,
  "porcentaje": "45.5",
  "iteracion": "20251116093000"
}
```

### 2. Probar endpoint de constitución (sin BD)

**NOTA:** Este endpoint NO está en la sincronización automática actualmente. Es solo de consulta directa.

```bash
curl http://localhost:3000/api/resultados/constitucion | jq '.[0]'
```

### 3. Ver mesas específicas en BD

```bash
# Ver una mesa específica
curl http://localhost:3000/api/presidenciales/mesas/700100294 | jq

# Ver mesas de una región
curl 'http://localhost:3000/api/presidenciales/mesas?region=3015' | jq '.count'
```

## Detener el Test

```bash
# Opción 1: Ctrl+C en la terminal del servidor

# Opción 2: Detener sincronización pero dejar servidor corriendo
curl -X POST http://localhost:3000/api/presidenciales/sync/stop
```

## Restaurar Configuración Original

Después del test, volver a configurar `.env` con horarios reales:

```env
AUTO_START_SYNC=false
SYNC_INTERVAL=60000
ENABLE_SMART_SYNC=true
INSTALACION_START_HOUR=08:00
INSTALACION_END_HOUR=12:00
VOTACION_END_HOUR=18:00
```

## Troubleshooting

**Si no sincroniza:**
1. Verificar que AUTO_START_SYNC=true en .env
2. Revisar logs del servidor para errores
3. Verificar conexión a MongoDB
4. Verificar conexión a https://elecciones.servel.cl

**Si dice "Sin cambios":**
- Es normal, solo actualiza cuando SERVEL publica nueva iteración
- Puedes forzar una sincronización: `curl -X POST http://localhost:3000/api/presidenciales/sync`

**Si hay errores de MongoDB:**
- Asegúrate de que MongoDB esté corriendo: `mongod`
- O usa MongoDB Atlas actualizando MONGODB_URI en .env
