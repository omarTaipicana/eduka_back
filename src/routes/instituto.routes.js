const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { listarCertificadosPorCurso, descargarCertificadosSeleccionados } = require('../controllers/instituto.controllers');
const { procesarPDF, finalizarReporte } = require('../controllers/instituto.subida.controllers');
const upload = require('../utils/multerCertificados');
const verifyJWT = require('../utils/verifyJWT');
const User = require('../models/User');
const Course = require('../models/Course');
const { DIPLOMADOS } = require('../utils/piatCertificados');
const router = express.Router();
const root = path.resolve(process.env.CERT_JOB_DIR || path.join(__dirname,'../../private/cert-jobs'));
fs.mkdirSync(root,{recursive:true,mode:0o700});
const locks = new Set();
const wrap = fn => (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const base = '/instituto/cargas';
const allowed = async (req,res,next) => {
 const u = await User.findByPk(req.user?.id);
 if(!u) return res.sendStatus(403);
 req.actor = u;
 req.admin = Boolean(process.env.CI_SUPERADMIN && u.cI === process.env.CI_SUPERADMIN);
 req.allowed = req.admin ? [...new Set([...(await Course.findAll({attributes:['sigla']})).map(c=>c.sigla),...DIPLOMADOS])] : [String(u.role||'').startsWith('instituto_') ? u.role.slice(10) : ''].filter(Boolean);
 if(!req.allowed.length) return res.sendStatus(403);
 next();
};
const auth=[verifyJWT,wrap(allowed)];
function save(j){ const f=path.join(root,j.id,'job.json'); fs.writeFileSync(f+'.tmp',JSON.stringify(j),{mode:0o600}); fs.renameSync(f+'.tmp',f); }
function get(req){ const id=req.params.id; if(!/^[a-f0-9]{32}$/.test(id)) return null; try {const j=JSON.parse(fs.readFileSync(path.join(root,id,'job.json'))); return j.owner===req.actor.id && j.items.every(i=>!i.sigla||req.allowed.includes(i.sigla))?j:null;} catch{return null;} }
function view(j){return {id:j.id,items:j.items,curso:j.curso,finished:j.finished,summaryError:j.summaryError};}
router.get('/instituto/certificados/:sigla', listarCertificadosPorCurso);
router.post('/instituto/certificados/:sigla/descargar', descargarCertificadosSeleccionados);
router.get(base,...auth,wrap(async(req,res)=>{ const jobs=[]; for(const id of fs.readdirSync(root)){if(!/^[a-f0-9]{32}$/.test(id))continue; const j=get({...req,params:{id}}); if(j&&!j.finished)jobs.push(view(j));} res.json(jobs); }));
router.post(base,...auth,upload.single('zip'),wrap(async(req,res)=>{
 if(!req.file)return res.status(400).json({message:'Selecciona ZIP'});
 const curso=req.body.curso||'auto'; let dir;
 try {
 if(curso!=='auto'&&!req.allowed.includes(curso))return res.status(403).json({message:'Curso no autorizado'});
 const zip=new AdmZip(req.file.path); const entries=zip.getEntries();
 const codes=[...new Set([...(await Course.findAll({attributes:['sigla']})).map(c=>c.sigla),...DIPLOMADOS])].sort((a,b)=>b.length-a.length);
 const items=entries.map((e,index)=>({e,index})).filter(({e})=>!e.isDirectory&&/\.pdf$/i.test(e.name)).map(({e,index})=>{
 const name=e.name; const lower=name.toLowerCase(); const detected=codes.find(c=>lower.includes('_'+c.toLowerCase()+'_')||lower.endsWith('_'+c.toLowerCase()+'.pdf'));
 const sigla=curso==='auto'?detected:curso;
 const motivo=!sigla?'Curso no reconocido en el nombre':!req.allowed.includes(sigla)?'Curso no autorizado':detected&&detected!==sigla?'El PDF pertenece a otro curso':null;
 return {index,archivo:name,sigla: motivo?null:sigla,status:motivo?'error':'pendiente',motivo};
 });
 if(!items.length)return res.status(400).json({message:'ZIP sin PDF'});
 if(items.length>10000)return res.status(400).json({message:'Máximo 10000 PDF por lote'});
 const id=crypto.randomBytes(16).toString('hex'); dir=path.join(root,id); fs.mkdirSync(dir,{mode:0o700}); fs.copyFileSync(req.file.path,path.join(dir,'lote.zip'));
 const j={id,owner:req.actor.id,curso,items,finished:false}; save(j); res.json(view(j));
 }finally{try{fs.unlinkSync(req.file.path)}catch{} }
}));
router.get(base+'/:id',...auth,wrap(async(req,res)=>{const j=get(req); return j?res.json(view(j)):res.sendStatus(404);}));
router.post(base+'/:id/paso',...auth,wrap(async(req,res)=>{
 const j=get(req); if(!j)return res.sendStatus(404); if(locks.size)return res.status(409).json({message:'Procesamiento en curso'}); if(j.finished)return res.json(view(j));
 locks.add(j.id);
 try {
 const item=j.items.find(i=>i.status==='pendiente'||i.status==='procesando');
 if(item){ item.status='procesando'; save(j); try{
 const entry=new AdmZip(path.join(root,j.id,'lote.zip')).getEntries()[item.index];
 if(!entry || entry.header.size > 25*1024*1024)throw new Error("PDF supera 25 MB o no existe");
 const r=await procesarPDF(entry,item.sigla); const k=['procesados','duplicados','ignorados','erroneos'].find(k=>r[k].length); if(!k)throw new Error('Sin resultado');
 item.status=k==='erroneos'?'error':k; item.detalle=r[k][0]; item.motivo=item.detalle.motivo||null;
 }catch(e){item.status='error';item.motivo=e.message||'Error de procesamiento';} save(j); }
 else { // Finalizar solo cuando el operador lo solicita, conservando reintentos.
 if(req.body.finalizar){for(const sigla of [...new Set(j.items.map(i=>i.sigla || "sin-curso"))]){const r={procesados:[],duplicados:[],ignorados:[],erroneos:[]}; for(const i of j.items.filter(i=>(i.sigla||"sin-curso")===sigla)){r[i.status==='error'?'erroneos':i.status]?.push(i.detalle||{archivo:i.archivo,motivo:i.motivo});} await finalizarReporte(sigla,r);} j.finished=true;save(j); fs.unlinkSync(path.join(root,j.id,'lote.zip'));}
 }
 return res.json(view(j));
 }finally{locks.delete(j.id);}
}));
router.post(base+'/:id/reintentar',...auth,wrap(async(req,res)=>{const j=get(req);if(!j)return res.sendStatus(404);if(j.finished||locks.has(j.id))return res.sendStatus(409);for(const i of j.items)if(i.status==='error'&&i.sigla){i.status='pendiente';i.motivo=null;delete i.detalle;}save(j);res.json(view(j));}));
module.exports=router;
