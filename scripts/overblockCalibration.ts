import { runOverblockCalibration } from "../src/campaign/OverblockCalibration.js";

const result = await runOverblockCalibration(process.cwd());
console.log(JSON.stringify(result, null, 2));
