const XLSX = require("../Frontend/node_modules/xlsx");
const path = require("path");
const dir = __dirname + "/Additional Report for DAILY PRODUCTION";

function load(file) {
  const wb = XLSX.readFile(path.join(dir, file), { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const rows = [];
  for (let r = 0; r <= range.e.r; r++) {
    const row = [];
    for (let c = 0; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      row.push(cell && cell.v != null ? cell.v : null);
    }
    rows.push(row);
  }
  return rows;
}

function text(v) {
  return v == null ? "" : String(v).replace(/\s+/g, " ").trim();
}
function num(v) {
  if (v == null || v === "" || v === "-") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/,/g, "").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parse004A(file) {
  const rows = load(file);
  const header = text(rows[4][0]);
  const date = (header.match(/Date\s*:\s*(\d{4}-\d{2}-\d{2})/) || [])[1];
  const plants = (header.match(/Plant\s*:\s*([^]+)/) || [])[1] || "";
  let section = "";
  const feed = [];
  const product = [];
  const pfad = [];
  const be = [];
  const pa = [];
  const remarks = [];
  const utility = [];
  for (let i = 6; i < rows.length; i++) {
    const a = text(rows[i][0]);
    if (/^CPO\/RPO/i.test(a)) { section = "feed"; continue; }
    if (/^RBDPO/i.test(a)) { section = "product"; continue; }
    if (/^PFAD/i.test(a)) { section = "pfad"; continue; }
    if (/BLEACHING EARTH/i.test(a)) { section = "be"; continue; }
    if (/PHOSPHORIC/i.test(a)) { section = "pa"; continue; }
    if (/^REMARK/i.test(a)) { section = "remark"; continue; }
    if (/^UTILITY/i.test(a)) { section = "utility"; continue; }
    if (/^Shift$|^1\. Leader|^Dokumen/i.test(a)) continue;
    if (section === "feed" && /^Shift/i.test(a)) {
      feed.push({
        shift: a,
        tank: text(rows[i][1]),
        oil: text(rows[i][2]),
        start: text(rows[i][3]),
        startMeter: num(rows[i][4]),
        end: text(rows[i][5]),
        endMeter: num(rows[i][6]),
        total: num(rows[i][7]),
      });
    }
    if (section === "product" && /^Shift/i.test(a)) {
      product.push({
        shift: a,
        start: text(rows[i][1]),
        startMeter: num(rows[i][2]),
        end: text(rows[i][3]),
        endMeter: num(rows[i][4]),
        total: num(rows[i][5]),
        toTank: text(rows[i][6]),
      });
    }
    if (section === "pfad" && /^Shift/i.test(a) && text(rows[i][1]) !== "Jam" && text(rows[i][1]) !== "Shift") {
      const total = num(rows[i][5]);
      if (total == null && num(rows[i][4]) == null) continue;
      pfad.push({
        shift: a,
        start: text(rows[i][1]),
        startMeter: num(rows[i][2]),
        end: text(rows[i][3]),
        endMeter: num(rows[i][4]),
        total,
        toTank: text(rows[i][6]),
      });
    }
    if (section === "be" && /^Shift/i.test(a)) {
      be.push({
        shift: a,
        bag1: num(rows[i][1]),
        lot1: text(rows[i][2]),
        grade1: text(rows[i][3]),
        bag2: num(rows[i][4]),
        lot2: text(rows[i][5]),
        grade2: text(rows[i][6]),
        bag3: num(rows[i][7]),
        totalBags: num(rows[i][10]),
      });
    }
    if (section === "pa" && /^Shift/i.test(a) && text(rows[i][1]) !== "Penggunaan PA Pershift") {
      pa.push({
        shift: a,
        usage: num(rows[i][1]),
        tankVolume: num(rows[i][2]),
        total: num(rows[i][3]),
        lot: text(rows[i][4]),
      });
    }
    if (section === "remark" && /^Shift/i.test(a)) {
      const note = text(rows[i][1]);
      if (note) remarks.push(note);
    }
    if (section === "utility" && /^Shift/i.test(a)) {
      utility.push({
        shift: a,
        steam: num(rows[i][1]),
        powerStart: num(rows[i][2]),
        powerEnd: num(rows[i][3]),
        power: num(rows[i][4]),
        gasStart: num(rows[i][5]),
        gasEnd: num(rows[i][6]),
        gas: num(rows[i][7]),
      });
    }
  }
  return { file, date, plants: plants.trim(), feed, product, pfad, be, pa, remarks, utility };
}

function parse004B(file) {
  const rows = load(file);
  const header = text(rows[4][0]);
  const date = (header.match(/Date\s*:\s*(\d{4}-\d{2}-\d{2})/) || [])[1];
  const plant = (header.match(/Plant\s*:\s*(.+)/) || [])[1] || "";
  let section = "";
  const feed = [];
  const olein = [];
  const stearin = [];
  const remarks = [];
  const utility = [];
  for (let i = 6; i < rows.length; i++) {
    const a = text(rows[i][0]);
    if (/^RBDPO\/ROL/i.test(a)) { section = "feed"; continue; }
    if (/^OLEIN/i.test(a)) { section = "olein"; continue; }
    if (/^STEARIN/i.test(a)) { section = "stearin"; continue; }
    if (/^REMARK/i.test(a)) { section = "remark"; continue; }
    if (/^UTILITY/i.test(a)) { section = "utility"; continue; }
    if (/^TOTAL/i.test(a)) { section = "total"; continue; }
    if (section === "feed" && /Shift/i.test(a)) {
      feed.push({
        shift: a, cr: text(rows[i][1]), tank: text(rows[i][2]), oil: text(rows[i][3]),
        start: text(rows[i][4]), startMeter: num(rows[i][5]), end: text(rows[i][6]),
        endMeter: num(rows[i][7]), total: num(rows[i][8]),
      });
    }
    if (section === "olein" && /Shift/i.test(a)) {
      olein.push({
        shift: a, cr: text(rows[i][1]), start: text(rows[i][2]), startMeter: num(rows[i][3]),
        end: text(rows[i][4]), endMeter: num(rows[i][5]), total: num(rows[i][6]), toTank: text(rows[i][7]),
      });
    }
    if (section === "stearin" && /Shift/i.test(a) && text(rows[i][1]) !== "Jam") {
      stearin.push({
        shift: a, start: text(rows[i][1]), startMeter: num(rows[i][2]), end: text(rows[i][3]),
        endMeter: num(rows[i][4]), total: num(rows[i][5]), toTank: text(rows[i][6]),
      });
    }
    if (section === "remark" && text(rows[i][1]) && text(rows[i][1]) !== "-") remarks.push(text(rows[i][1]));
    if (section === "utility" && /Shift/i.test(a)) {
      utility.push({
        shift: a,
        steamStart: num(rows[i][1]), steamEnd: num(rows[i][2]), steam: num(rows[i][3]),
        powerStart: num(rows[i][4]), powerEnd: num(rows[i][5]), power: num(rows[i][6]),
        waterStart: num(rows[i][7]), waterEnd: num(rows[i][8]), water: num(rows[i][9]),
      });
    }
  }
  return { file, date, plant: plant.trim(), feed, olein, stearin, remarks, utility };
}

const a1 = parse004A("logsheet-F-RFA-004(A)-AS-20261014.xlsx");
const a2 = parse004A("logsheet-F-RFA-004(A)-AS-20261014 (1).xlsx");
const b = parse004B("logsheet-F-RFA-004(B)-AS-20261014.xlsx");
console.log(JSON.stringify({ a1, a2, b }, null, 2));
