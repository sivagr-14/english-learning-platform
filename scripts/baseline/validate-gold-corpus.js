const fs=require("fs"); const path=require("path");
const root=path.resolve(__dirname,"../.."); const dir=path.join(root,"test/fixtures/gold-corpus");
const expected=JSON.parse(fs.readFileSync(path.join(dir,"expectations.json"),"utf8"));
const source=fs.readFileSync(path.join(dir,"source.txt"),"utf8").split(/\r?\n/); const srt=fs.readFileSync(path.join(dir,"subtitles.srt"),"utf8");
const ids=new Set(), identities=new Set();
for(const item of expected.cases){
  if(ids.has(item.id)) throw new Error(`Duplicate case id: ${item.id}`); ids.add(item.id);
  const identity=`${item.term.toLowerCase()}::${item.senseKey}`; if(identities.has(identity)) throw new Error(`Duplicate term+sense: ${identity}`); identities.add(identity);
  const located=item.locator.kind==="line" ? source[item.locator.value-1] : srt.match(new RegExp(`(?:^|\\n)${item.locator.value}\\n[\\s\\S]*?\\n\\n`))?.[0];
  const evidence=(item.evidenceSurface||item.term).toLowerCase();
  if(!located || !located.toLowerCase().includes(evidence)) throw new Error(`Locator does not contain ${evidence}: ${item.id}`);
  for(const key of ["contextualMeaning","tamilMeaning","decision","frequency"]) if(!item[key]) throw new Error(`Missing ${key}: ${item.id}`);
}
const formats=expected.generatedFormats; for(const ext of formats){const name=ext==="txt"?"gold.txt":ext==="srt"?"gold.srt":`gold.${ext}`; const p=path.join(dir,"generated",name); if(!fs.existsSync(p)||fs.statSync(p).size<20) throw new Error(`Missing generated fixture: ${name}`);}
const banks=expected.cases.filter(x=>x.term==="bank"); if(banks.length!==2||new Set(banks.map(x=>x.senseKey)).size!==2) throw new Error("Polysemy fixture must retain two bank senses");
console.log(`Validated ${formats.length} formats and ${expected.cases.length} candidate senses.`);
