# Observatorio Turístico Municipal · versión corregida

Esta versión mantiene la arquitectura con Supabase y corrige los fallos reportados:

- cierre de sesión vuelve al acceso
- encuesta guarda correctamente
- alojamientos guardan correctamente
- botón sincronizar recarga perfil, encuestas y alojamientos
- botón borrar demo elimina demo del municipio actual
- interfaz responsive y mobile-first
- se elimina el error de `favicon.ico 404`

## Archivos

- `index.html`
- `styles.css`
- `app.js`
- `supabase.js`
- `schema.sql`
- `netlify.toml`

## Qué estaba mal y qué se corrigió

### 1) Error al guardar encuesta
El formulario de encuestas tenía `id` pero no `name` en los campos. Por eso `FormData` devolvía valores faltantes y aparecía:

`Cannot read properties of undefined (reading 'trim')`

Ahora los campos tienen `name` y además `app.js` valida y normaliza los datos antes de insertar.

### 2) Logout no volvía al acceso
Ahora `Cerrar sesión`:
- limpia estado local
- oculta la app
- muestra la pantalla de acceso
- cierra la sesión local en Supabase
- vuelve al dashboard base

### 3) Guardado de alojamientos
Se mejoró la sanitización del payload y el manejo del botón para que no quede pegado en `Guardando...`.

### 4) Base demo
Ahora existe `Borrar demo`, que elimina encuestas y alojamientos del municipio actual.

## Importante sobre Supabase

Esta app usa columnas adicionales en `public.survey_responses`:

- `municipality_name`
- `province_label`
- `transport_mode`
- `satisfaction`
- `recommendation`

El `schema.sql` ya viene actualizado y además incluye un patch con `alter table ... add column if not exists ...` para bases ya existentes.

## Qué tenés que hacer en Supabase

### Opción A — ya tenés la base creada
Ejecutá el `schema.sql` actualizado completo. No debería romper nada porque usa `if not exists` y agrega el patch de columnas faltantes.

### Opción B — querés ser quirúrgico
Corré solo este bloque:

```sql
alter table public.survey_responses add column if not exists municipality_name text;
alter table public.survey_responses add column if not exists province_label text;
alter table public.survey_responses add column if not exists transport_mode text;
alter table public.survey_responses add column if not exists satisfaction integer not null default 0;
alter table public.survey_responses add column if not exists recommendation integer not null default 0;
```

## Qué tenés que hacer en `supabase.js`

Revisá que tenga tus credenciales reales del proyecto:

```js
window.SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
window.SUPABASE_ANON_KEY = "TU-KEY-PUBLICA";
```

## Qué tenés que hacer en VS Code / CMD

No necesitás compilar nada.

### Para probar local
Podés usar:

```bash
python -m http.server 8080
```

Después abrí:

```bash
http://localhost:8080
```

## Cómo subir a GitHub Pages

1. Creá un repo nuevo en GitHub.
2. Subí estos archivos al root.
3. En GitHub: `Settings > Pages`.
4. Elegí `Deploy from a branch`.
5. Seleccioná `main` y carpeta `/root`.
6. Guardá.

## Netlify

No requiere build. `netlify.toml` ya está incluido.

## Nota final

Si después de esto falla algo, ya no va a ser por los errores reportados arriba. Lo más probable sería:
- credenciales de Supabase incorrectas
- RLS bloqueando una operación
- cache o locks viejos del navegador
