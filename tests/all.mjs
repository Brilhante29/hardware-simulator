import {runConformance} from './sn74hc595.mjs';
import {runElectricalTests} from './electrical.mjs';
const results=[...runConformance(),...runElectricalTests()];
for(const r of results)console.log(`${r.pass?'PASS':'FAIL'} ${r.name}${r.error?': '+r.error:''}`);
console.log(`${results.filter(r=>r.pass).length}/${results.length} grupos passaram`);
if(results.some(r=>!r.pass))process.exitCode=1;
