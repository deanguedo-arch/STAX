import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const doctrinePath = join(process.cwd(), "docs", "STAX_DOCTRINE_LOCK.md");
const migrationPath = join(process.cwd(), "docs", "MIGRATION_MAP.md");

if (!existsSync(doctrinePath)) {
  console.error("Doctrine audit failed. Missing docs/STAX_DOCTRINE_LOCK.md.");
  process.exit(1);
}

if (!existsSync(migrationPath)) {
  console.error("Doctrine audit failed. Missing docs/MIGRATION_MAP.md.");
  process.exit(1);
}

const doctrine = readFileSync(doctrinePath, "utf8");
const migration = readFileSync(migrationPath, "utf8");

const doctrineRequired = [
  "Immutable Flow",
  "Validate (Event Horizon)",
  "No layer may bypass a preceding layer.",
  "Truth States",
  "Provenance Minimum",
  "Uncertainty Minimum"
];

const migrationRequired = [
  "core",
  "meta",
  "reference",
  "deprecated",
  "Boundary Between Core and Operator"
];

const doctrineMissing = doctrineRequired.filter((token) => !doctrine.includes(token));
const migrationMissing = migrationRequired.filter((token) => !migration.includes(token));

if (doctrineMissing.length > 0 || migrationMissing.length > 0) {
  console.error("Doctrine audit failed.");
  if (doctrineMissing.length > 0) {
    console.error(`Missing doctrine sections: ${doctrineMissing.join(", ")}`);
  }
  if (migrationMissing.length > 0) {
    console.error(`Missing migration sections: ${migrationMissing.join(", ")}`);
  }
  process.exit(1);
}

console.log("Doctrine audit passed.");
