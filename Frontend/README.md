# Plant Information Dashboard

Frontend shell for the Priscolin Bekasi tank farm console. The frame follows Jetty Planning System. Colours follow the dashboard mockup.

```bash
npm install
npm run dev
```

`VITE_DATA_SOURCE=api` reads the database through Express at `VITE_API_URL`. The dev server stays on port 5176. See `.env.example`.

The API the backend should implement:

- `GET /api/site`
- `GET /api/site/snapshot`
- `GET /api/live/tanks`
- `GET /api/live/logistics`
- `GET /api/tanks/:tankId/soundings`
- `GET /api/tanks/:tankId/labs`
- `GET /api/analytics/summary?tankId=`
- `GET /api/analytics/movements`

Response bodies match the types in `src/domain/types.ts`.
