/**
 * Seed script: populates the DB with realistic demo data
 * based on the actual MGNREGA portal structure for Jharkhand.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TODAY = new Date().toISOString().split("T")[0];
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().split("T")[0];

const PANCHAYATS = [
  { code: "3401001002", name: "ANGARA", blockCode: "3401001", blockName: "ANGARA", districtCode: "3401", districtName: "RANCHI" },
  { code: "3401001004", name: "BISA",   blockCode: "3401001", blockName: "ANGARA", districtCode: "3401", districtName: "RANCHI" },
  { code: "3401001006", name: "CHAINPUR", blockCode: "3401001", blockName: "ANGARA", districtCode: "3401", districtName: "RANCHI" },
  { code: "3401002001", name: "BERO",   blockCode: "3401002", blockName: "BERO",   districtCode: "3401", districtName: "RANCHI" },
];

const WORK_NAMES = [
  "ग्राम बीसा में महिन्द्र भोगता के जमीन पर 1 एकड़ का आम बागवानी",
  "ग्राम अंगारा में सड़क निर्माण कार्य",
  "ग्राम चैनपुर में तालाब खुदाई कार्य",
  "ग्राम बेरो में नाली निर्माण कार्य",
  "ग्राम अंगारा में वृक्षारोपण कार्य",
];

const WORKER_NAMES = [
  ["MAHENDRA BHOGTA", "M"], ["RAM SHING BHOGTA", "M"], ["SANGITA DEVI", "F"],
  ["SANJOTI DEVI", "F"], ["BIRSA MUNDA", "M"], ["SUKRI DEVI", "F"],
  ["RAMESH ORAON", "M"], ["PHULO DEVI", "F"], ["MANGAL SINGH", "M"],
  ["CHAMPA DEVI", "F"], ["SURESH MAHTO", "M"], ["GEETA DEVI", "F"],
  ["ARJUN MUNDA", "M"], ["SAVITRI DEVI", "F"], ["DINESH ORAON", "M"],
];

function randomWorkers(count: number, date: string) {
  const shuffled = [...WORKER_NAMES].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((w, i) => ({
    sno: i + 1,
    jobCardNo: `JH-01-001-004-002/${100 + Math.floor(Math.random() * 400)}`,
    workerName: w[0],
    gender: w[1],
    attendanceDate: date,
    isPresent: Math.random() > 0.2, // 80% attendance rate
  }));
}

async function seed() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.worker.deleteMany();
  await prisma.musterRoll.deleteMany();

  let mrCount = 0;

  for (const date of [TODAY, YESTERDAY]) {
    for (const p of PANCHAYATS) {
      // 1-3 MRs per panchayat per day
      const numMRs = Math.floor(Math.random() * 3) + 1;

      for (let m = 0; m < numMRs; m++) {
        const msrNo = String(300 + mrCount);
        const workCode = `${p.code}/IF/${7080900000000 + mrCount * 1234}`;
        const workers = randomWorkers(Math.floor(Math.random() * 8) + 3, date);
        const presentCount = workers.filter((w) => w.isPresent).length;

        const mr = await prisma.musterRoll.create({
          data: {
            attendanceDate: date,
            districtCode: p.districtCode,
            districtName: p.districtName,
            blockCode: p.blockCode,
            blockName: p.blockName,
            panchayatCode: p.code,
            panchayatName: p.name,
            workCode,
            msrNo,
            workName: WORK_NAMES[mrCount % WORK_NAMES.length],
            detailUrl: `https://mnregaweb4.nic.in/netnrega/View_NMMS_atten_date_dtl_rpt.aspx?work_code=${workCode}&msr_no=${msrNo}`,
            photo1Url: `/photos/sample_photo1.jpeg`,
            photo1TakenAt: `${date.split("-").reverse().join(" ").replace(/(\d+) (\d+) (\d+)/, "$1 Apr $3")} 06:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00:000`,
            photo1UploadedAt: `${date.split("-").reverse().join(" ").replace(/(\d+) (\d+) (\d+)/, "$1 Apr $3")} 18:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00:000`,
            photo1Coords: `23.${4000 + Math.floor(Math.random() * 1000)},85.${5000 + Math.floor(Math.random() * 1000)}`,
            photo1TakenBy: "Raj Roshan Minj",
            photo1Designation: "Gram Panchayat Level",
            photo2Url: Math.random() > 0.3 ? `/photos/sample_photo2.jpeg` : null,
            totalWorkers: workers.length,
            presentCount,
            absentCount: workers.length - presentCount,
            workers: {
              create: workers,
            },
          },
        });

        console.log(`  ✓ MR #${msrNo} – ${p.name} (${presentCount}/${workers.length} present)`);
        mrCount++;
        void mr;
      }
    }
  }

  console.log(`\n✅ Seeded ${mrCount} muster rolls across ${PANCHAYATS.length} panchayats for ${TODAY} and ${YESTERDAY}`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
