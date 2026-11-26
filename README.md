# Paddock · Gestión de campeonatos de motor

App web para promotoras de campeonatos tipo F1 / MotoGP: promotoras → campeonatos → categorías → temporadas → rondas → resultados, con clasificaciones de pilotos y equipos, calendario, estadísticas y palmarés.

## Uso rápido
- `npm install`
- `npm run dev` → servidor de desarrollo
- `npm test` → tests del motor de puntuación
- `npm run build` → genera `dist/index.html`, un único archivo que se abre con doble clic

Los datos se guardan en el navegador (localStorage). Usa «Exportar copia» para hacer backup en JSON.

## Estructura
- `src/lib/model.ts` – modelo de datos
- `src/lib/scoring.ts` – motor de puntuación y plantillas (F1, MotoGP, Fórmula E, F1 clásico, club)
- `src/lib/selectors.ts` – palmarés, estadísticas de carrera deportiva
- `src/pages/*` – pantallas
- `src/components/Evolution.tsx` – gráfico de evolución de puntos / posiciones

Ideas pendientes: ver [IDEAS.md](IDEAS.md).

## Base de datos (Supabase)
Sin configuración, la app guarda en el navegador («Modo local»). Para usar la nube:
1. En Supabase › SQL Editor, ejecuta `supabase/migrations/0001_init.sql`.
2. Copia `.env.example` a `.env.local` y pon la URL del proyecto y la clave **anon/publishable**.
3. `npm run dev` o `npm run build`.

Cada promotora solo la ven y editan sus miembros (Row Level Security). Quien la crea es propietario y puede invitar a otros organizadores por email desde Ajustes. Si el navegador tenía datos locales, la portada ofrece subirlos a la nube.
