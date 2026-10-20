# Functional Specification Document (FSD)

**Project Name:** Plant Information Dashboard | Tank Farm & Quality Operations Console  
**Document Owner:** Rian Dharmawan  
**Business Unit:** Downstream Operations  
**Date:** October 2026  

---

## 1. Project Overview

### 1.1. Background
The downstream manufacturing site requires a modernized, real-time dashboard to monitor storage tank inventories, manage incoming/outgoing logistics, and enforce quality control (QC) standards. The legacy SCADA-style interface is being replaced with a modern, responsive web application.

### 1.2. Objective
To build a unified "Live Operations" dashboard that seamlessly integrates **Quantity** (Tank Farm Sounding Levels) with **Quality** (Lab Analytical Results) and **Logistics** (Commodity In/Out). The system will act as a "Quality Gatekeeper," automatically preventing off-spec commodity transfers.

---

## 2. User Roles & Personas

1. **Plant Operator:** Needs to see real-time tank volumes, available capacities (ullage), and active pumping statuses.
2. **QC Analyst / Lab User:** Needs to input and verify lab parameters (FFA, Moisture, etc.) and flag tanks or trucks that are off-spec.
3. **Logistics / Gate Controller:** Needs to route incoming trucks/vessels to the correct tanks based on QC clearance.
4. **Plant Manager:** Needs high-level analytics, trend charts, and operational bottlenecks at a glance.

---

## 3. UI/UX & Design System Specifications

* **Architecture:** Split-view layout. Left Main Area (70%) for Tank Grid & Analytics. Right Sidebar (30%) for Live Logistics & Quality Gatekeeper.
* **Theme:** Clean, modern "SaaS" aesthetic (No 3D skeuomorphism, no gradients on tanks).
* **Color Palette:**
  * `brand-dark` (#114C5A - Nocturnal Expedition): Top Navbar.
  * `brand-bg` (#F1F6F4 - Arctic Powder): Main application background.
  * `brand-surface` (#FFFFFF): Card backgrounds.
  * `brand-accent` (#DC2626 - Corporate Red): Active menu highlights, critical 'QUARANTINE' alerts, 'REJECTED' badges.
  * `brand-warning` (#FFC801 - Forsythia): Re-test warnings, medium-level indicators.
  * `brand-success` (#10B981): 'PASSED' QC badges, 'LIVE' indicators.

---

## 4. Functional Requirements

### Module 1: Tank Inventory Monitoring (Grid View)
* **FR-1.1:** The system shall display all active tanks as individual cards in a responsive CSS Grid.
* **FR-1.2:** Each tank card must display a 2D vertical progress bar representing the `Sounding Level (m)`. The fill height must be calculated dynamically based on max capacity vs. current volume.
* **FR-1.3:** Display primary metrics inside the card: `Product Type`, `Sounding Level (m)`, `Temperature (°C)`, and `Total Mass (Ton)`.
* **FR-1.4 (Status Badges):** Display operational status badges (e.g., "ISI LB", "ISI LK", "EMPTY"). If a tank is empty, the card should visually dim (lower opacity).

### Module 2: The Quality Gatekeeper (QC Integration)
* **FR-2.1 (Storage QC):** The system shall evaluate the *Daily Storage Tank Analytical Result*. If key parameters (e.g., FFA, Moisture) exceed the allowed threshold, the tank card's progress bar turns `#DC2626` (Red), and a **"QUARANTINE ⚠"** badge is applied, disabling any outbound transfer UI actions.
* **FR-2.2 (Stale Data Alert):** The system shall calculate the days since the last `Analysis Date`. If > 2 days, display a **"Re-test"** warning badge.
* **FR-2.3 (Inbound QC):** For incoming trucks/vessels, the system shall evaluate the *Analytical Result of Incoming Material*.
  * If **Pass** (e.g., FFA <= 5.0): Display green "Pass" badges and enable the target tank routing link (e.g., "Bongkar ke T.12").
  * If **Fail** (e.g., FFA > 5.0): Display a red **"REJECTED"** badge, lock the routing link, and highlight the vehicle row in red.

### Module 3: Live In/Out Logistics (Right Panel)
* **FR-3.1:** Display an accordion or vertical list of active transport vehicles (Vessels and Trucks) currently at the facility.
* **FR-3.2:** Differentiate UI based on transport type:
  * **Vessels:** Display split-loading logic (e.g., Palka S -> T.11, Palka C -> T.27) with mini-qualitative data per compartment.
  * **Trucks:** Display Police Number, Material, and Target Tank.
* **FR-3.3:** Use pulsing indicator dots (Green for Inbound, Blue for Outbound) to show active flow.

### Module 4: Ops Analytics & Historical Trends
* **FR-4.1:** Display top summary KPI cards: Average Tank Level, Avg Temp, Throughput (Mass), and Lab Approval Rate.
* **FR-4.2 (Trend Chart):** Implement a dual-Y-axis interactive chart (using Recharts). Left Y-axis for Product Level (m), Right Y-axis for Temperature (°C).
* **FR-4.3 (Interactive Tooltip):** Hovering over the trend chart must display Level, Temp, and the exact QC Status ("Approved" / "Hold") at that specific timestamp.

---

## 5. Data Schema & Mapping Reference

When writing the TypeScript interfaces or parsing the backend/CSV data, use the following mapping based on the legacy logsheets:

**A. Storage Tank Sounding (Ref: F-TNF-003)**
```typescript
interface TankSounding {
  tankId: string; // e.g., "T01"
  productName: string; // e.g., "Olein Tooling"
  soundingLevel: number; // e.g., 12.33
  temperature: number; // e.g., 32.0
  operationalStatus: string; // e.g., "ISI LB", "EMPTY"
}