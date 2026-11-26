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
