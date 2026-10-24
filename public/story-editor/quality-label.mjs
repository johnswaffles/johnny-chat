export function editorialQualityLabel(quality){
 if(!quality?.model)return 'Editor configuration unavailable';
 const model=({'gpt-6.1-sol':'GPT-6.1 Sol','gpt-6-astra':'GPT-6 Astra'})[quality.model]||quality.model;
 const effort=({low:'Low',medium:'Medium',high:'High',xhigh:'Extra High',max:'Max'})[quality.effort]||quality.effort||'unconfirmed';
 const mode=({pro:'Pro',standard:'Standard'})[quality.mode]||quality.mode||'unconfirmed mode';
 return `${model} · ${effort} reasoning · ${mode}`;
}
