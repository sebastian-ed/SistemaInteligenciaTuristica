# Observatorio Turístico Municipal · v2

Webapp responsive y mobile-first para municipios argentinos que necesitan medir demanda turística, inventario de plazas y generar reportes básicos sin depender de Excel eterno ni de intuiciones disfrazadas de diagnóstico.

## Qué incluye

- Autenticación con Supabase
- Aislamiento por municipio con Row Level Security
- Módulo de encuestas a visitantes
- Módulo de inventario de alojamientos y plazas
- Dashboard con KPIs y gráficos
- Hallazgos automáticos para lectura ejecutiva
- Exportación CSV y JSON
- Diseño responsive / mobile-first
- Deploy simple en Netlify, Vercel o GitHub Pages

## Stack

- HTML + CSS + JavaScript vanilla
- Supabase Auth + Database
- Chart.js vía CDN

## Estructura

- `index.html` → interfaz principal
- `styles.css` → estilos responsive
- `app.js` → lógica del frontend
- `supabase.js` → configuración del proyecto Supabase
- `sql/schema.sql` → base de datos, funciones, triggers y políticas RLS
- `netlify.toml` → configuración básica de Netlify

## Paso 1: crear proyecto en Supabase

1. Crear un proyecto en Supabase.
2. Ir a **SQL Editor**.
3. Copiar y ejecutar el contenido de `sql/schema.sql`.
4. En **Project Settings > API**, copiar:
   - Project URL
   - anon public key
5. Pegarlos en `supabase.js`.

Ejemplo:

```js
window.SUPABASE_URL = "https://xxxxx.supabase.co";
window.SUPABASE_ANON_KEY = "eyJ...";
```

## Paso 2: comportamiento de alta inicial

La app permite:
- iniciar sesión si ya existe usuario
- crear la cuenta inicial del municipio

En el primer alta:
- se crea el usuario en Auth
- un trigger crea automáticamente el municipio
- se crea el perfil del usuario
- el usuario queda con rol `admin`

## Paso 3: correr local

Como es una app estática, alcanza con un servidor simple.

### Opción A: VS Code + Live Server
Abrí la carpeta y ejecutá Live Server.

### Opción B: Python
```bash
python -m http.server 8080
```

Luego abrí:
```bash
http://localhost:8080
```

## Paso 4: deploy

### Netlify
1. Subí este repo a GitHub
2. Crear nuevo sitio en Netlify desde GitHub
3. Build command: vacío
4. Publish directory: `/`

### GitHub Pages
Podés publicarlo como sitio estático directamente.

### Vercel
También funciona sin build.

## Modelo de datos

### municipalities
Municipio y datos institucionales.

### profiles
Usuario autenticado, vinculado a un municipio.

### survey_responses
Encuestas de turistas.

### lodging_inventory
Base de alojamientos y plazas.

## Seguridad

Se usa Row Level Security para que cada usuario solo vea y escriba datos de su municipio.

## Recomendación de producto

No te conviene vender esto como “encuesta”.
Conviene venderlo como:

**Observatorio Turístico Municipal**
o
**Sistema de Inteligencia Turística Local**

Cambia la conversación comercial:
- menos formulario
- más gestión
- más datos para decidir
- más legitimidad frente a intendencia y concejo

## Próxima versión sugerida

Lo lógico después de esta versión es agregar:

- roles por usuario (`admin`, `carga`, `consulta`)
- tablero histórico con comparativas interanuales
- cortes por evento y temporada
- carga de ocupación mensual declarada por alojamientos
- QR público para encuesta autogestionada
- módulo de reportes PDF institucionales con branding del municipio
- integración con Power BI o Looker Studio

## Licencia

Usalo, adaptalo y mejoralo. Pero no lo dejes en demo eterna: producto que no entra al circuito operativo termina siendo un adorno caro.
