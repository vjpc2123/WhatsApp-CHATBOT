# Agente WhatsApp

Bot de WhatsApp con IA conectado vía Baileys (WhatsApp Web), con dashboard local para gestionar conversaciones.

## Requisitos

- Node.js 20+
- Cuenta de OpenRouter (https://openrouter.ai)

## Configuración

1. Copia `.env.example` a `.env.local` y rellena tus claves:

```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

> **Nota sobre modelos:** Los modelos `:free` de OpenRouter tienen un límite de ~50 requests/día. Para uso real se recomienda `openai/gpt-4o-mini` (~$0.15 por millón de tokens).

2. Instala dependencias:

```bash
npm install
```

## Uso en desarrollo

**Terminal 1 — proceso bot:**
```bash
npm run start:bot
```

**Terminal 2 — dashboard:**
```bash
npm run dev
```

Abre http://localhost:3000 y escanea el QR con tu teléfono.

## Uso en producción (local)

```bash
npm run build
npm run start:all
```

## Personalizar el system prompt

Edita `src/lib/system-prompt.ts` para cambiar la personalidad del bot:

```typescript
export const SYSTEM_PROMPT = `
Eres el asistente de [Tu Negocio]. Responde en español...
`.trim();
```

## Estructura de la app

- **Bot (proceso separado):** `scripts/start-bot.ts` — gestiona la conexión Baileys, recibe mensajes, llama al LLM, envía respuestas.
- **Dashboard (Next.js):** `src/app/` — interfaz web para gestionar conversaciones.
- **Base de datos:** SQLite en `data/messages.db` (creada automáticamente).
- **Sesión WhatsApp:** guardada en `auth/` (no se pide QR en reinicios mientras la sesión siga activa).

## Cómo funciona el toggle AI/HUMAN

- **Modo IA (default):** el bot responde automáticamente con el LLM.
- **Modo Humano:** el bot no responde. Desde el dashboard puedes escribir manualmente y el mensaje llega al cliente vía WhatsApp firmado como el número del agente.

## Deploy en EasyPanel / Railway

1. Configura las variables de entorno `OPENROUTER_API_KEY` y `OPENROUTER_MODEL` en el panel.
2. **Volúmenes persistentes obligatorios:** monta `/app/data` y `/app/auth` en almacenamiento persistente. Sin esto, cada redespliegue pierde las conversaciones y obliga a re-escanear el QR.
3. El proyecto incluye `nixpacks.toml` y `Procfile` listos para usar.

## ⚠️ Seguridad

El dashboard **no tiene autenticación**. Si lo expones a internet:

- Configura basic auth a nivel de proxy (EasyPanel, Caddy, Nginx) o usa Cloudflare Access.
- Sin protección, cualquier persona con la URL puede leer todas las conversaciones de WhatsApp y enviar mensajes como si fuera el dueño del número.

**No despliegues sin protección en producción.**

## Solución de problemas

| Síntoma | Causa | Solución |
|---|---|---|
| El QR no aparece | El bot no está corriendo | Ejecuta `npm run start:bot` |
| Error 405 al conectar | Versión Baileys desactualizada | Ya manejado automáticamente con `fetchLatestBaileysVersion()` |
| Loop de reconexión (code 440) | Browser fingerprint | Ya manejado con `Browsers.macOS('Desktop')`. Si persiste, borra dispositivos viejos en tu teléfono (Configuración → Dispositivos vinculados) |
| Error 429 del LLM | Cuota del modelo `:free` agotada | Cambia a `openai/gpt-4o-mini` en `OPENROUTER_MODEL` |
| Proceso zombie en Windows | tsx no termina correctamente | Usa `tasklist \| findstr tsx` + `taskkill /F /PID <pid>` |

## Mejoras pendientes (v2)

- Soporte de imágenes salientes (enviar PNG de productos al cliente)
- Function calling con `tools` de OpenRouter para acciones reales (consultar stock, etc.)
- Auto-toggle a modo HUMAN cuando el bot detecta una frase específica (ej. "hablar con un asesor")
- WebSocket en lugar de polling para updates en tiempo real
- Autenticación básica integrada en Next.js (middleware)
- Soporte de grupos (actualmente ignorados)
- Exportar conversaciones a CSV
