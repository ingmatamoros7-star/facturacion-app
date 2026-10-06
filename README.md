# VentasPro — Sistema de ventas y cuentas por cobrar

Sistema web interno, **simple, elegante y rápido**, para registrar ventas y controlar
cobros. Pensado para usarse desde computadora, laptop, tablet o celular, con los datos
guardados en una base de datos central.

> Primera versión (MVP) enfocada exclusivamente en:
> **CLIENTES → VENTAS → PAGOS → CUENTAS POR COBRAR → CARTERA VENCIDA → REPORTES**

---

## 1. Arquitectura propuesta

Se eligió una arquitectura **sencilla, económica y fácil de mantener**, sin frameworks
pesados ni infraestructura innecesaria:

```
Navegador (PC / celular / tablet)
        │  HTTPS
        ▼
Servidor Node.js + Express  ──►  Base de datos SQLite (archivo en disco persistente)
   (API REST + archivos web)
```

- **Frontend:** HTML + CSS + JavaScript puro (sin framework). Carga rápido, funciona en
  cualquier dispositivo y es muy fácil de mantener.
- **Backend:** Node.js con Express. Expone una API REST y sirve la página web.
- **Base de datos:** SQLite (un solo archivo). Confiable, sin servidor de BD aparte y
  suficiente para miles de registros. Migrar a PostgreSQL más adelante es directo.
- **Autenticación:** sesión con token JWT en cookie `httpOnly` + contraseñas cifradas con bcrypt.

### ¿Por qué esta tecnología?

| Prioridad | Cómo se cumple |
|-----------|----------------|
| Bajo costo | Node + SQLite corre en el plan gratuito de Render/Railway/Fly |
| Fácil mantenimiento | Un solo lenguaje (JS), sin framework que aprender |
| Seguridad razonable | Login obligatorio, contraseñas cifradas, cookies httpOnly |
| Acceso desde cualquier dispositivo | Web responsive |
| Base de datos confiable | SQLite con modo WAL + disco persistente |
| Ampliable | Estructura modular por carpetas y esquema relacional normalizado |

---

## 2. Estructura de la base de datos

Relaciones normalizadas, sin duplicar información:

```
usuarios                 clientes ──1:N── ventas ──1:N── detalle_ventas ──N:1── productos
(login/roles)                              │
                                           └──1:N── pagos
```

- **usuarios** — acceso al sistema (rol `admin` / `usuario`).
- **clientes** — nombre/razón social, cédula o RUC, teléfono, email, dirección, estado.
- **productos** — código, nombre, descripción, precio unitario, estado.
- **ventas** — número, cliente, fecha, subtotal, descuento, total, pagado, forma de pago,
  estado, fecha de vencimiento.
- **detalle_ventas** — líneas de cada venta (producto, cantidad, precio, subtotal).
- **pagos** — abonos sobre una venta (fecha, monto, método, nota).

El **estado de cada venta** (`pagado`, `pendiente`, `parcial`, `vencido`) y los **días de
vencimiento** se calculan automáticamente a partir del saldo y la fecha de vencimiento.

---

## 3. Módulos

| Módulo | Qué hace |
|--------|----------|
| **Inicio / Dashboard** | Ventas del día y del mes, total cobrado, por cobrar, cartera vencida, clientes con deuda y clientes a cobrar. |
| **Ventas** | Registro de ventas con cálculo automático de subtotal, descuento y total. Contado o crédito. |
| **¿A quién cobrar?** | Lista priorizada de pendientes (vencidos / vencen hoy / próximos) con botón de **WhatsApp**. |
| **Cuentas por cobrar** | Todas las ventas con saldo pendiente y su estado. |
| **Cartera vencida** | Solo cuentas vencidas con saldo, ordenadas por antigüedad + total. |
| **Clientes** | Alta/edición, búsqueda, saldo pendiente e historial de compras. |
| **Productos / Servicios** | Catálogo con código, precio editable y estado. |
| **Reportes** | Reporte de ventas (con filtros) y de cartera, exportables a **Excel (CSV)** y **PDF (imprimir)**. |

---

## 4. Flujo de funcionamiento

**Registrar una venta a crédito:**
1. Entrar al sistema → **Nueva venta**.
2. Elegir cliente y producto(s); el sistema calcula el total.
3. Seleccionar **Crédito** → ingresar fecha de vencimiento (y abono inicial si aplica).
4. Guardar → la deuda queda automáticamente en **Cuentas por cobrar**.

**Cobrar:**
1. Buscar la venta (o ir a *¿A quién cobrar?*).
2. **Registrar pago** → el saldo se actualiza solo.
3. Cuando el saldo llega a $0, la venta pasa a **Pagado** automáticamente.

En ventas de **contado** (efectivo/transferencia/tarjeta) la venta queda pagada al instante.

---

## 5. Puesta en producción (hosting)

El proyecto incluye `render.yaml` para desplegar en **Render** en pocos clics:

1. Subir el repositorio a GitHub.
2. En Render → *New → Blueprint* → seleccionar el repo (lee `render.yaml`).
3. Configurar las variables de entorno (ver `.env.example`), **especialmente `JWT_SECRET`**.
4. Render entrega una URL `https://...onrender.com`; se le puede asignar un dominio propio
   (ej. `https://sistema.midominio.com`).

Alternativas equivalentes: Railway, Fly.io o un VPS económico.

### Estimación de costos

| Concepto | Costo aproximado |
|----------|------------------|
| Hosting (Render/Railway plan free o básico) | **$0 – $7 USD/mes** |
| Disco persistente para la base de datos | incluido / ~$1 USD/mes |
| Dominio propio (opcional) | ~$10 – $15 USD/año |
| **Total típico** | **$0 – $8 USD/mes** |

**Posibles costos adicionales futuros:** envío de WhatsApp/SMS automatizado vía API,
correos transaccionales, respaldos gestionados o migrar a PostgreSQL administrado si el
volumen crece mucho. Nada de esto es necesario para el MVP.

---

## 6. Estructura del proyecto

```
facturacion-app/
├── server.js             # Servidor Express y montaje de rutas
├── database.js           # Esquema SQLite, migraciones y usuario admin inicial
├── render.yaml           # Configuración de despliegue en Render
├── .env.example          # Variables de entorno de ejemplo
├── lib/
│   └── estado.js         # Cálculo de saldo, estado y días de vencimiento
├── middleware/
│   └── auth.js           # Protección de rutas (JWT) y roles
├── routes/
│   ├── auth.js           # Login, logout, sesión y cambio de contraseña
│   ├── clientes.js       # CRUD de clientes + historial
│   ├── productos.js      # CRUD de productos/servicios
│   ├── ventas.js         # Registro y consulta de ventas
│   ├── pagos.js          # Registro de pagos
│   ├── cobranza.js       # Cuentas por cobrar, cartera vencida y cobros
│   ├── dashboard.js      # Indicadores del inicio
│   └── reportes.js       # Reportes de ventas y cartera
└── public/
    ├── index.html        # Interfaz (login + aplicación)
    ├── css/styles.css     # Estilos (diseño responsive)
    └── js/app.js         # Lógica del frontend
```

---

## 7. Cómo ejecutarlo localmente

```bash
npm install
npm start          # http://localhost:3000
```

**Primer acceso** (se crea automáticamente la primera vez):

- Usuario: `admin@sistema.com`
- Contraseña: `admin123`

> Cambia la contraseña desde *Mi cuenta* (menú del usuario, arriba a la derecha) y
> define un `JWT_SECRET` propio antes de usarlo en producción.

**Datos de ejemplo (opcional):** para probar el sistema ya poblado puedes cargar
datos demo (clientes, productos y ventas de muestra):

```bash
npm run seed            # solo si la base está vacía
npm run seed -- --force # forzar aunque ya existan datos
```

Es un comando aparte, pensado solo para evaluación; no se ejecuta en producción.

---

## 8. Preparado para el futuro (no incluido aún)

El proyecto quedó ordenado para poder agregar más adelante, sin reconstruir:
inventario, facturación electrónica, proveedores, gastos, recordatorios automáticos de
cobro, usuarios con permisos avanzados, múltiples sucursales o app móvil.
