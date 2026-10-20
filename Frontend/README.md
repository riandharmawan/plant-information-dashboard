# Plant Information Dashboard

Frontend shell for the Priscolin Bekasi tank farm console. The frame follows Jetty Planning System. Colours follow the dashboard mockup.

```bash
npm install
npm run dev
```

`VITE_DATA_SOURCE=local` (the default) reads `LocalOperationsRepository`. Set it to `api` and point `VITE_API_URL` at Express when the backend exists. Screens call `OperationsRepository` either way. See `.env.example`.

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
