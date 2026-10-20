\# Technical Specification Document (TSD)



\*\*Project Name:\*\* Plant Information Dashboard | Tank Farm \& Quality Operations Console  

\*\*Document Owner:\*\* Engineering Lead  

\*\*Architecture:\*\* Client-Server Web Application  

\*\*Infrastructure:\*\* Alibaba Cloud (Alicloud)  



\---



\## 1. System Architecture \& Tech Stack



The application is built on a modern, decoupled full-stack architecture to ensure scalability, maintainability, and clear separation of concerns.



\* \*\*Frontend:\*\* React.js (Vite or Create React App)

\* \*\*Styling \& UI:\*\* Tailwind CSS, shadcn/ui (for accessible components), Lucide React (for icons)

\* \*\*Data Visualization:\*\* Recharts (React charting library)

\* \*\*Backend API:\*\* Node.js with Express.js

\* \*\*Database:\*\* PostgreSQL (Relational mapping for tanks, QC logs, and logistics)

\* \*\*Containerization:\*\* Docker (Ensuring environment parity)



\---



\## 2. Environment Configuration \& Management



The application must support three distinct environments. Environment variables are managed using separate `.env` files. \*\*Security Note: Never commit `.env` files to version control.\*\*



\### 2.1. Environment Files

1\. \*\*`Dev (Local)`\*\* $\\rightarrow$ `.env.development`

&#x20;  \* \*Usage:\* Local development (Vibe coding in Cursor).

&#x20;  \* \*Database:\* Local PostgreSQL instance or local Dockerized Postgres.

&#x20;  \* \*Frontend API URL:\* `VITE\_API\_URL=http://localhost:5000/api`

&#x20;  \* \*Backend DB URI:\* `DB\_CONNECTION\_STRING=postgresql://user:pass@localhost:5432/tankfarm\_dev`



2\. \*\*`Testing (Alicloud)`\*\* $\\rightarrow$ `.env.test`

&#x20;  \* \*Usage:\* Deployed on an isolated Alibaba Cloud ECS instance for UAT and QC verification.

&#x20;  \* \*Database:\* Alicloud RDS (PostgreSQL) - Staging Instance.

&#x20;  \* \*Frontend API URL:\* `VITE\_API\_URL=https://staging-api.tankfarm.internal/api`

&#x20;  \* \*Backend DB URI:\* `DB\_CONNECTION\_STRING=postgresql://user:pass@rds-staging.../tankfarm\_test`



3\. \*\*`Production (Alicloud)`\*\* $\\rightarrow$ `.env.production`

&#x20;  \* \*Usage:\* Live operations environment deployed on Alicloud ECS or ACK.

&#x20;  \* \*Database:\* Alicloud RDS (PostgreSQL) - Production Instance (High Availability).

&#x20;  \* \*Frontend API URL:\* `VITE\_API\_URL=https://api.tankfarm.internal/api`

&#x20;  \* \*Backend DB URI:\* `DB\_CONNECTION\_STRING=postgresql://user:pass@rds-prod.../tankfarm\_prod`



\---



\## 3. Frontend Architecture (React.js)



The React.js frontend will utilize a modular, component-driven architecture.



\### 3.1. Layout \& Routing

\* `src/App.jsx`: Main application router (using `react-router-dom`).

\* `src/components/layout/Sidebar.jsx`: Persistent left navigation.

\* `src/components/layout/TopNav.jsx`: Header containing location data, timezones, and user profile.



\### 3.2. Core Modules

\* \*\*Tank Grid (Live Ops):\*\*

&#x20; \* `src/components/tanks/TankGrid.jsx`: Responsive CSS Grid container.

&#x20; \* `src/components/tanks/TankCard.jsx`: Renders individual tank data, dynamic vertical progress bars, and QC badges (e.g., Red for 'QUARANTINE').

\* \*\*Quality Gatekeeper (Logistics):\*\*

&#x20; \* `src/components/logistics/LiveLogisticsPanel.jsx`: Right-side drawer for inbound/outbound traffic.

&#x20; \* `src/components/logistics/TruckItem.jsx`: Evaluates incoming QC logic (e.g., locking the route if FFA > 5.0).

\* \*\*Analytics:\*\*

&#x20; \* `src/components/analytics/TrendChart.jsx`: Recharts dual-Y-axis implementation for Sound

