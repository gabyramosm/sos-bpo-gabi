# 🚀 Guía de Deploy — SOS BPO · Gabi en Vercel

## Qué vas a lograr
Una URL pública (`https://sos-bpo-gabi.vercel.app`) con Gabi respondiendo con IA real
de IBM watsonx.ai Lite, conectada a GitHub para deploy automático ante cada push.

---

## PASO 1 — Obtener las credenciales de IBM watsonx

### 1.1 Crear una API Key de IBM Cloud
1. Ir a **https://cloud.ibm.com/iam/apikeys**
2. Clic en **"Create an IBM Cloud API key"**
3. Nombre: `gabi-demo` → **Create**
4. ⚠️ **Copiar el API Key inmediatamente** — no se muestra de nuevo
5. Guardarlo como: `WATSONX_API_KEY=<el valor copiado>`

### 1.2 Obtener el Project ID de watsonx.ai
1. Ir a **https://dataplatform.cloud.ibm.com**
2. Abrir el proyecto que contiene el modelo Granite
   - Si no existe ninguno: **New project → Create an empty project** → nombre `gabi-demo`
3. Ir a la pestaña **Manage → General**
4. Copiar el valor de **Project ID** (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
5. Guardarlo como: `WATSONX_PROJECT_ID=<el valor copiado>`

### 1.3 Verificar acceso al modelo
1. Dentro del proyecto, ir a **Assets → New asset → Work with models**
2. Confirmar que el modelo **ibm/granite-3-8b-instruct** está disponible
   - En el plan Lite está incluido sin costo
3. Si aparece un error de acceso, ir a **https://cloud.ibm.com/catalog/services/watson-machine-learning** y provisionar la instancia Lite

---

## PASO 2 — Subir el proyecto a GitHub

```
# En la carpeta sos-bpo-gabi:
git init
git add .
git commit -m "feat: SOS BPO Gabi v1 - demo directorio"
```

Luego en **https://github.com/new**:
- Repository name: `sos-bpo-gabi`
- Visibility: **Private** (recomendado para demo)
- **NO** inicializar con README ni .gitignore (ya los tenemos)
- Clic **Create repository**

Copiar la URL del repo y ejecutar:
```
git remote add origin https://github.com/TU_USUARIO/sos-bpo-gabi.git
git branch -M main
git push -u origin main
```

---

## PASO 3 — Conectar con Vercel

1. Ir a **https://vercel.com** → **Sign up with GitHub**
2. En el dashboard → **Add New → Project**
3. En "Import Git Repository" → buscar `sos-bpo-gabi` → **Import**
4. En la pantalla de configuración:
   - **Framework Preset**: Other
   - **Root Directory**: `.` (dejar en blanco o punto)
   - **Build Command**: dejar vacío
   - **Output Directory**: dejar vacío
5. ⬇️ Expandir **Environment Variables** y agregar las dos variables:

   | Name | Value |
   |------|-------|
   | `WATSONX_API_KEY` | `<el valor del paso 1.1>` |
   | `WATSONX_PROJECT_ID` | `<el valor del paso 1.2>` |

6. Clic **Deploy** → esperar ~60 segundos

---

## PASO 4 — Verificar que todo funciona

### Test rápido de la API (desde el navegador o Postman):
```
POST https://tu-app.vercel.app/api/chat
Content-Type: application/json

{
  "messages": [{"role":"user","content":"hola"}],
  "profile": {"name":"Test","client":"IBM","device":"Lenovo"}
}
```
Debe devolver: `{"reply": "...respuesta de Gabi..."}`

### Test desde la app:
1. Abrir la URL del deploy (ej: `https://sos-bpo-gabi.vercel.app`)
2. Completar el onboarding: nombre → cliente → equipo
3. Elegir **"🔒 Me apareció una pantalla de BitLocker"**
4. Confirmar que Gabi responde con texto real (no chips de árbol local)

---

## PASO 5 — Personalizar la URL para la demo

En Vercel Dashboard → tu proyecto → **Settings → Domains**:
- Clic **Add** → escribir: `gabi-demo` → **Add**
- La URL queda: `https://gabi-demo.vercel.app`

Alternativamente, si tenés un dominio propio configurarlo acá.

---

## Deploy automático (para el día de la demo)

Cada `git push origin main` dispara un redeploy automático en Vercel.
Para hacer un cambio de último momento:

```
# Modificar cualquier archivo, luego:
git add .
git commit -m "fix: ajuste pre-demo"
git push
```
El deploy tarda ~40 segundos y Vercel mantiene la URL anterior activa hasta que el nuevo está listo.

---

## Checklist pre-demo (día anterior)

- [ ] Abrir la URL y hacer el flujo completo de BitLocker
- [ ] Probar desde el celular (responsive)
- [ ] Hacer un push de prueba para confirmar el deploy automático
- [ ] Tener la URL lista en el navegador con el onboarding ya completado
- [ ] Tener el celular del directivo para mostrar el QR o enviar la URL

---

## Solución de problemas comunes

| Síntoma | Causa probable | Solución |
|---------|---------------|---------- |
| Gabi responde con chips (árbol local) en Vercel | `IS_LOCAL` detectó mal el host | Verificar que el hostname no sea localhost |
| Error `Missing env vars` | Variables no configuradas en Vercel | Settings → Environment Variables → redeploy |
| Error `IAM HTTP 400` | API Key inválida o expirada | Regenerar en cloud.ibm.com/iam/apikeys |
| Error `WX HTTP 403` | Project ID incorrecto o sin permiso | Verificar el ID en dataplatform.cloud.ibm.com |
| Error `WX HTTP 429` | Límite de tokens del plan Lite | Esperar 1 minuto; el plan Lite tiene rate limits |
| Timeout en producción | watsonx tardó >25s | Recargar; pasa en cold start. Normal. |
| "Tuve un problema de conexión" | Error en la API | Abrir DevTools → Network para ver el error exacto |

---

## Arquitectura en producción

```
Browser
  │
  ├── GET / → index.html (Vercel Static)
  ├── GET /js/*.js → archivos estáticos
  ├── GET /css/styles.css → archivo estático
  ├── GET /assets/*.svg → imágenes SVG
  │
  └── POST /api/chat → Vercel Serverless Function (Node 18)
         │
         ├── POST https://iam.cloud.ibm.com → Bearer Token (8s timeout)
         └── POST https://us-south.ml.cloud.ibm.com → Granite 3 8B (25s timeout)
```

---

*Proyecto: SOS BPO · Gabi | Soporte IT LATAM | IBM Argentina*
