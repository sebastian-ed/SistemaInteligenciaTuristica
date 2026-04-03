# Observatorio Turístico Municipal · fusión v3

Esta versión combina:

- la **arquitectura con Supabase, login, RLS, vistas y multiusuario** del proyecto principal
- la **calidad de la encuesta y la visualización de resultados** del segundo proyecto

## Qué quedó fusionado

- Autenticación con Supabase
- Aislamiento por municipio con RLS
- Dashboard con KPIs más claros
- Encuesta ampliada con mejores campos y mejor presentación
- Gráficos y hallazgos automáticos
- Inventario de alojamientos y plazas
- Reporte ejecutivo exportable
- Botón para cargar demo y **botón real para borrarla**
- Botón de sincronización
- Botón para volver al dashboard
- Mejor manejo de errores en login

## Archivos

- `index.html` → interfaz principal fusionada
- `styles.css` → estilos responsive
- `app.js` → lógica principal
- `supabase.js` → credenciales del proyecto
- `schema.sql` → base de datos y políticas RLS
- `netlify.toml` → configuración básica de Netlify

## Problemas corregidos respecto del proyecto base

### 1. Sincronizar
No solo refresca encuestas y alojamientos. También vuelve a cargar perfil y municipio para evitar estados viejos.

### 2. Guardar cambios
La configuración ahora actualiza `municipalities` con feedback visible y relectura del estado.

### 3. Cerrar sesión
Limpia estado, oculta la app y vuelve al flujo de acceso.

### 4. Volver atrás
Se agregó un botón `Volver al dashboard` cuando estás fuera de la vista principal.

### 5. Demo
La demo ya no queda clavada sin salida. Ahora existe `Borrar demo`, que elimina encuestas y alojamientos del municipio actual.

### 6. Login con `Failed to fetch`
No desaparece mágicamente si Supabase está mal configurado o caído, pero ahora el mensaje es más útil y menos idiota.

## Importante sobre el esquema SQL

El frontend fusionado usa algunos campos adicionales en `survey_responses`:

- `municipality_name`
- `province_label`
- `transport_mode`
- `satisfaction`
- `recommendation`

Agregá estas columnas si tu tabla original no las tiene.

### SQL sugerido

```sql
alter table public.survey_responses add column if not exists municipality_name text;
alter table public.survey_responses add column if not exists province_label text;
alter table public.survey_responses add column if not exists transport_mode text;
alter table public.survey_responses add column if not exists satisfaction integer default 0;
alter table public.survey_responses add column if not exists recommendation integer default 0;
```

## Deploy

### GitHub Pages
Subí todos los archivos al root del repo y publicá la rama principal.

### Netlify
No requiere build. Publish directory: `.`

## Observación de negocio

No lo vendas como "formulario". Vendelo como **tablero operativo de inteligencia turística local**. Nadie asigna presupuesto serio a una encuesta suelta. Sí a un sistema que produce lectura ejecutiva.
