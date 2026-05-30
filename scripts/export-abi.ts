import fs from "node:fs";
import path from "node:path";

const artifactPath = path.resolve(
  "artifacts/contracts/BloodPoints.sol/BloodPoints.json"
);
const outputPath = path.resolve("frontend/src/contracts/BloodPoints.json");

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(artifact.abi, null, 2));

console.log(`ABI exported to ${outputPath}`);
