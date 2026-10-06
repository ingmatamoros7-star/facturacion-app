# Guía de despliegue — VentasPro

Esta guía te lleva paso a paso para publicar el sistema en una **dirección web**
(ej. `https://ventaspro.onrender.com` o tu dominio `https://sistema.midominio.com`)
accesible desde cualquier dispositivo.

El proyecto ya incluye `render.yaml`, así que el despliegue en **Render** es casi
automático. Al final se mencionan alternativas (Railway, Fly.io).

---

## Importante: persistencia de datos

El sistema usa **SQLite** (un archivo). Para que la información **no se borre** en
cada actualización o reinicio, el servidor necesita un **disco persistente**.

| Plan Render | Costo | Disco persistente | ¿Para qué sirve? |
|-------------|-------|-------------------|------------------|
| **Starter** | ~$7 USD/mes | ✅ Sí | **Uso real** (datos permanentes) |
| Free | $0 | ❌ No | Solo pruebas (los datos se borran al reiniciar) |

El `render.yaml` viene configurado en **Starter con disco** (recomendado). Si solo
quieres probar gratis, cambia `plan: starter` por `plan: free` y borra la sección
`disk:` — pero recuerda que los datos serán temporales.

> ¿Quieres gratis **y** permanente? Es posible migrando de SQLite a una base
> PostgreSQL gratuita (Neon/Supabase), pero requiere un cambio de código. Dímelo
> y lo preparo.

---

## Opción A — Render con Blueprint (recomendada)

### 1. Requisitos
- Una cuenta de **GitHub** (ya tienes el repositorio `facturacion-app`).
- Una cuenta gratuita en **[Render](https://render.com)** (puedes entrar con GitHub).

### 2. Subir el código a la rama principal
El código está en la rama del PR. Primero **mergea el Pull Request** a `main`
(o despliega directamente desde la rama, Render lo permite).

### 3. Crear el servicio con el Blueprint
1. En Render, clic en **New +** → **Blueprint**.
2. Conecta tu cuenta de GitHub y selecciona el repositorio **`facturacion-app`**.
3. Render detecta el archivo `render.yaml` y muestra el servicio **facturacion-app**.
4. Clic en **Apply** / **Create**.

Render ejecutará `npm install` y luego `node server.js`. En 2–4 minutos tendrás una
URL del tipo `https://facturacion-app-xxxx.onrender.com`.

### 4. Variables de entorno (ya vienen configuradas)
El `render.yaml` define automáticamente:

| Variable | Valor | Para qué |
|----------|-------|----------|
| `NODE_ENV` | `production` | Cookies seguras (HTTPS) |
| `DB_PATH` | `/opt/render/project/data` | Carpeta del disco persistente |
| `JWT_SECRET` | *(se genera solo)* | Firma de la sesión |

**Opcional** — para definir tú el primer administrador, agrega en Render →
*Environment* (antes del primer arranque):

| Variable | Ejemplo |
|----------|---------|
| `ADMIN_EMAIL` | `tunombre@tudominio.com` |
| `ADMIN_PASSWORD` | *(una contraseña fuerte)* |

Si no las defines, se crea `admin@sistema.com` / `admin123`.

### 5. Primer acceso
1. Abre la URL que te dio Render.
2. Inicia sesión con tu usuario admin (o `admin@sistema.com` / `admin123`).
3. **Cambia la contraseña** desde el menú de usuario (arriba a la derecha) → *Mi cuenta*.

### 6. (Opcional) Datos de ejemplo
Si quieres ver el sistema poblado para una demo, en Render → *Shell* ejecuta:

```bash
npm run seed
```

(No lo hagas si ya vas a usarlo con datos reales.)

---

## Dominio propio (`https://sistema.midominio.com`)

1. En Render, entra a tu servicio → pestaña **Settings** → **Custom Domains**.
2. Clic en **Add Custom Domain** e ingresa `sistema.midominio.com`.
3. Render te dará un registro **CNAME**. Entra al panel de tu dominio (donde lo
   compraste) y crea ese CNAME apuntando al valor que indica Render.
4. Espera unos minutos: Render emite el certificado **HTTPS** automáticamente.

---

## Actualizaciones futuras

Cada vez que hagas `git push` a la rama conectada, Render **redespliega solo**.
No se pierde la base de datos porque vive en el disco persistente.

---

## Respaldos de la base de datos

La información está en `/opt/render/project/data/facturacion.db`.

- **Descargar un respaldo:** Render → tu servicio → **Shell**, y revisa el archivo
  (o usa un comando para copiarlo). Guarda `facturacion.db` en lugar seguro con
  regularidad.
- Recomendado: hacer respaldo antes de cambios grandes.

---

## Checklist de seguridad (antes de usarlo en producción)

- [ ] `JWT_SECRET` propio (Render ya lo genera; no lo compartas).
- [ ] Contraseña del administrador cambiada (no dejar `admin123`).
- [ ] `NODE_ENV=production` (ya configurado) para cookies seguras.
- [ ] Plan con disco persistente (Starter) si guardas datos reales.
- [ ] Respaldos periódicos de `facturacion.db`.

---

## Alternativas de hosting

| Plataforma | Notas | Costo aprox. |
|------------|-------|--------------|
| **Railway** | Despliegue desde GitHub, agrega un *Volume* para SQLite | ~$5 USD/mes |
| **Fly.io** | Requiere un *Volume* para persistencia | desde ~$2–5 USD/mes |
| **VPS** (Hetzner, DigitalOcean) | Más control, instalas Node + PM2 + Nginx | ~$4–6 USD/mes |

En todas, el principio es el mismo: ejecutar `node server.js`, exponer el puerto por
HTTPS y montar un disco/volumen para que `facturacion.db` persista.
