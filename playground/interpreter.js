export class KontekstualError extends Error {
  constructor(message, line = 1) { super("Baris " + line + ": " + message); this.name = "KontekstualError"; this.line = line; }
}
function stripComments(source) {
  let out="", quoted=false, escape=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quoted){out+=c;if(escape)escape=false;else if(c==="\\")escape=true;else if(c==='"')quoted=false;continue;}
    if(c==='"'){quoted=true;out+=c;continue;}
    if(c==="{"&&source[i+1]==="-"){i+=2;let closed=false;while(i<source.length){if(source[i]==="-"&&source[i+1]==="}"){i++;closed=true;break;}if(source[i]==="\n")out+="\n";i++;}if(!closed)throw new KontekstualError("Komentar belum ditutup.");continue;}
    out+=c;
  } return out;
}
function lexExpr(s,line){
  const out=[];let i=0;
  while(i<s.length){if(/\s/.test(s[i])){i++;continue;}
    const rest=s.slice(i);
    if(s[i]==='"'){i++;let v="",closed=false;while(i<s.length){const c=s[i++];if(c==='"'){closed=true;break;}if(c==="\\"){if(i>=s.length)break;const e=s[i++];if(e!=='"'&&e!=="\\")throw new KontekstualError("Urutan pelolosan tidak didukung.",line);v+=e;}else v+=c;}if(!closed)throw new KontekstualError("Tanda kutip teks belum ditutup.",line);out.push({t:"value",v:v});continue;}
    const n=rest.match(/^\d+/);if(n){out.push({t:"value",v:Number(n[0])});i+=n[0].length;continue;}
    const w=rest.match(/^[\p{L}][\p{L}\p{N}_]*/u);if(w){const lower=w[0].toLocaleLowerCase("id");const phrase=rest.match(/^(lebih\s+dari|kurang\s+dari|sama\s+dengan|tidak\s+sama\s+dengan)/i);if(phrase){out.push({t:"op",v:phrase[0].toLowerCase().replace(/\s+/g," ")});i+=phrase[0].length;continue;}
      const ops={ditambah:"+",dikurangi:"-",dikali:"*",dibagi:"/"};if(ops[lower])out.push({t:"op",v:ops[lower]});else if(lower==="benar"||lower==="salah")out.push({t:"value",v:lower==="benar"});else if(["lebih","kurang","sama","tidak","dari"].includes(lower))throw new KontekstualError("Operator '"+w[0]+"' tidak lengkap.",line);else out.push({t:"name",v:w[0]});i+=w[0].length;continue;}
    if(s[i]==="("||s[i]===")"){out.push({t:s[i],v:s[i]});i++;continue;}
    throw new KontekstualError("Karakter '"+s[i]+"' tidak dikenali dalam ekspresi.",line);
  }return out;
}
const prec={"sama dengan":1,"tidak sama dengan":1,"lebih dari":1,"kurang dari":1,"+":2,"-":2,"*":3,"/":3};
function expr(text,line,vars){
  const ts=lexExpr(text,line);let p=0;
  function primary(){const t=ts[p++];if(!t)throw new KontekstualError("Ekspresi belum lengkap.",line);if(t.t==="value")return t.v;if(t.t==="name"){if(!vars.has(t.v.toLocaleLowerCase("id")))throw new KontekstualError("Variabel '"+t.v+"' belum ditetapkan sebelum digunakan.",line);return vars.get(t.v.toLocaleLowerCase("id"));}if(t.t==="("){const v=parse(0);if(!ts[p]||ts[p++].t!==")")throw new KontekstualError("Kurung tutup ')' tidak ditemukan.",line);return v;}throw new KontekstualError("Ekspresi tidak valid.",line);}
  function parse(min){let left=primary();while(ts[p]&&ts[p].t==="op"&&(prec[ts[p].v]||0)>=min){const op=ts[p++].v,r=parse(prec[op]+1);if(["+","-","*","/"].includes(op)){if(typeof left!=="number"||typeof r!=="number")throw new KontekstualError("Operasi matematika hanya menerima angka.",line);if(op==="/"&&r===0)throw new KontekstualError("Pembagian dengan nol tidak diperbolehkan.",line);if(op==="+")left+=r;if(op==="-")left-=r;if(op==="*")left*=r;if(op==="/")left=Math.trunc(left/r);if(!Number.isSafeInteger(left))throw new KontekstualError("Hasil melampaui rentang angka aman JavaScript.",line);}else if(op==="lebih dari"||op==="kurang dari"){if(typeof left!=="number"||typeof r!=="number")throw new KontekstualError("Perbandingan urutan hanya menerima angka.",line);left=op==="lebih dari"?left>r:left<r;}else{if(typeof left!==typeof r)throw new KontekstualError("Perbandingan kesamaan membutuhkan tipe yang sama.",line);left=op==="sama dengan"?left===r:left!==r;}}return left;}
  const result=parse(0);if(p!==ts.length)throw new KontekstualError("Bagian ekspresi tidak dipahami.",line);return result;
}
const kind=v=>typeof v==="number"?"angka":typeof v==="string"?"teks":"logika";
const show=v=>typeof v==="boolean"?(v?"benar":"salah"):String(v);
export function runKontekstual(source){
  const lines=stripComments(source).split(/\r?\n/),scopes=[new Map()],blocks=[],output=[];
  for(let i=0;i<lines.length;i++){const raw=lines[i];if(!raw.trim())continue;const indent=raw.match(/^\s*/)[0].replace(/\t/g,"    ").length,line=raw.trim(),num=i+1;
    while(blocks.length&&indent<blocks[blocks.length-1].indent){blocks.pop();scopes.pop();}
    if(blocks.length&&indent>blocks[blocks.length-1].indent)throw new KontekstualError("Indentasi blok tidak konsisten.",num);
    if(/^Jika\s+/i.test(line)){const m=line.match(/^Jika\s+(.+),\s*maka\s*:\s*$/i);if(!m)throw new KontekstualError("Gunakan format 'Jika kondisi, maka:'.",num);const vars=new Map();for(const scope of scopes)for(const [k,v]of scope)vars.set(k,v);const condition=expr(m[1],num,vars);if(typeof condition!=="boolean")throw new KontekstualError("Kondisi Jika harus menghasilkan logika.",num);blocks.push({indent,active:blocks.every(b=>b.active)&&condition});scopes.push(new Map());continue;}
    if(blocks.some(b=>!b.active))continue;
    const pt=line.match(/^Tampilkan\s+teks\s+"((?:\\.|[^"\\])*)"\s*\.$/i);if(pt){output.push(pt[1].replace(/\\(["\\])/g,"$1"));continue;}
    const pv=line.match(/^Tampilkan\s+nilai\s+([\p{L}][\p{L}\p{N}_]*)\s*\.$/iu);if(pv){const name=pv[1].toLocaleLowerCase("id");let found=false,val;for(const s of [...scopes].reverse())if(s.has(name)){val=s.get(name);found=true;break;}if(!found)throw new KontekstualError("Variabel '"+pv[1]+"' belum ditetapkan sebelum digunakan.",num);output.push(show(val));continue;}
    const d=line.match(/^Tetapkan\s+([\p{L}][\p{L}\p{N}_]*)\s+sebagai\s+(angka|teks|logika)\s+dengan\s+nilai\s+(.+)\.$/iu);if(d){const name=d[1].toLocaleLowerCase("id"),type=d[2].toLocaleLowerCase("id"),scope=scopes[scopes.length-1];if(scope.has(name))throw new KontekstualError("Variabel '"+d[1]+"' sudah ditetapkan pada blok ini.",num);const vars=new Map();for(const s of scopes)for(const [k,v]of s)vars.set(k,v);const val=expr(d[3],num,vars);if(kind(val)!==type)throw new KontekstualError("Nilai awal bertipe "+kind(val)+", sedangkan variabel '"+d[1]+"' memerlukan tipe "+type+".",num);scope.set(name,val);continue;}
    throw new KontekstualError("Instruksi tidak dikenali. Periksa kata kunci dan tanda titik.",num);
  }return {output,text:output.join("\n")};
}
