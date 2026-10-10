# Guía de despliegue — VentasPro

Esta guía te lleva paso a paso para publicar el sistema en una **dirección web**
(ej. `https://ventaspro.onrender.com` o tu dominio `https://sistema.midominio.com`),
**gratis y permanente**, accesible desde cualquier dispositivo.

Arquitectura de producción:

- **Servidor web:** Render (plan gratuito).
- **Base de datos:** Turso / libSQL (plan gratuito, permanente). Los datos viven en
  Turso, no en el servidor, así que nunca se borran aunque Render reinicie.

> Resultado: **$0/mes** (salvo que compres un dominio propio).

---

## Paso 1 — Crear la base de datos en Turso

1. Entra a **[turso.tech](https://turso.tech)** y crea una cuenta gratuita (puedes usar GitHub).
2. Crea una base de datos nueva (botón **Create Database**). Elige la región más
   cercana (ej. `aws-us-east-1`).
3. Copia los dos datos que necesitarás:
   - **Database URL** — algo como `libsql://tu-base-xxxx.turso.io`
   - **Auth Token** — en la base, genera un token (**Create Token**) y cópialo.

> Con la CLI de Turso sería:
> ```bash
> turso db create ventaspro
> turso db show ventaspro --url        # -> TURSO_DATABASE_URL
> turso db tokens create ventaspro     # -> TURSO_AUTH_TOKEN
> ```

Guarda esos dos valores; los pondrás en Render en el Paso 3.

---

## Paso 2 — Crear el servicio web en Render

1. Entra a **[render.com](https://render.com)** (puedes usar tu cuenta de GitHub).
2. **Mergea el Pull Request** a `main` (o despliega directo desde la rama).
3. En Render: **New +** → **Blueprint** → elige el repositorio **`facturacion-app`**.
4. Render detecta `render.yaml` y muestra el servicio **facturacion-app**. Clic en **Apply**.

---

## Paso 3 — Configurar las variables de entorno

Al aplicar el Blueprint, Render te pedirá los valores de las variables marcadas como
`sync: false`. Completa:

| Variable | Valor |
|----------|-------|
| `TURSO_DATABASE_URL` | la URL `libsql://...` del Paso 1 |
| `TURSO_AUTH_TOKEN` | el token del Paso 1 |

Estas ya vienen configuradas solas:

| Variable | Valor | Para qué |
|----------|-------|----------|
| `NODE_ENV` | `production` | Cookies seguras (HTTPS) |
| `JWT_SECRET` | *(se genera solo)* | Firma de la sesión |

**Opcional** — para definir tú el primer administrador, agrega antes del primer arranque:

| Variable | Ejemplo |
|----------|---------|
| `ADMIN_EMAIL` | `tunombre@tudominio.com` |
| `ADMIN_PASSWORD` | *(una contraseña fuerte)* |

Si no las defines, se crea `admin@sistema.com` / `admin123`.

Guarda y deja que Render despliegue (2–4 min). Obtendrás una URL `https://...onrender.com`.

---

## Paso 4 — Primer acceso

1. Abre la URL que te dio Render.
2. Inicia sesión con tu usuario admin (o `admin@sistema.com` / `admin123`).
3. **Cambia la contraseña** desde el menú de usuario (arriba a la derecha) → *Mi cuenta*.

### (Opcional) Datos de ejemplo
Para ver el sistema poblado en una demo, en Render → **Shell** ejecuta:

```bash
npm run seed
```

(No lo hagas si vas a usarlo con datos reales.)

---

## Dominio propio (`https://sistema.midominio.com`)

1. Render → tu servicio → **Settings** → **Custom Domains** → **Add Custom Domain**.
2. Ingresa `sistema.midominio.com`. Render te dará un registro **CNAME**.
3. En el panel de tu dominio, crea ese CNAME apuntando al valor de Render.
4. En minutos Render emite el certificado **HTTPS** automáticamente.

---

## Nota sobre el plan gratuito de Render

El plan gratuito de Render **suspende** el servicio tras ~15 min de inactividad; la
primera visita después tarda unos segundos en "despertar". Los **datos no se pierden**
(están en Turso). Si quieres que esté siempre encendido, sube el servicio al plan
**Starter (~$7/mes)**; la base de datos sigue siendo gratis en Turso.

---

## Respaldos de la base de datos

Con la CLI de Turso:

```bash
turso db shell ventaspro ".dump" > respaldo.sql     # exportar
```

Hazlo periódicamente (y antes de cambios grandes). Turso también mantiene réplicas y
punto-en-el-tiempo según el plan.

---

## Actualizaciones futuras

Cada `git push` a la rama conectada hace que Render **redespliegue solo**. Los datos
permanecen intactos en Turso.

---

## Desarrollo local (sin configurar nada)

Si no defines `TURSO_DATABASE_URL`, el sistema usa un archivo SQLite local
(`facturacion.db`) automáticamente:

```bash
npm install
npm run seed     # opcional: datos de ejemplo
npm start        # http://localhost:3000
```

---

## Checklist de seguridad (antes de producción)

- [ ] `JWT_SECRET` propio (Render lo genera; no lo compartas).
- [ ] Contraseña del administrador cambiada (no dejar `admin123`).
- [ ] `TURSO_AUTH_TOKEN` tratado como secreto (nunca en el repositorio).
- [ ] `NODE_ENV=production` (ya configurado) para cookies seguras.
- [ ] Respaldos periódicos de la base en Turso.

---

## Alternativas de hosting

| Plataforma | Notas | Costo aprox. |
|------------|-------|--------------|
| **Railway** | Despliegue desde GitHub; usa las mismas variables `TURSO_*` | $0–5 USD/mes |
| **Fly.io** | Igual, con las variables `TURSO_*` como secrets | $0–5 USD/mes |
| **VPS** (Hetzner, DigitalOcean) | Node + PM2 + Nginx; variables `TURSO_*` en el entorno | ~$4–6 USD/mes |

En todas, la base de datos sigue siendo Turso (gratis), así que solo cambias dónde corre
`node server.js`.
