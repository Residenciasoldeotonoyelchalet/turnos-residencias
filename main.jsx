import { useState, useEffect } from "react";

// ══════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN EMAILJS — reemplazá estos valores
// ══════════════════════════════════════════════════════════════════
const EMAILJS_SERVICE_ID   = "service_5gzd3qp";
const EMAILJS_PUBLIC_KEY   = "01nhxWmMYtLbCwEe7";
const TEMPLATE_CONFIRM     = "template_mzosw6u";
const TEMPLATE_CANCEL      = "template_m4ybolv";
// ══════════════════════════════════════════════════════════════════

async function loadData(key, fallback) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : fallback; }
  catch { return fallback; }
}
async function saveData(key, value) {
  try { await window.storage.set(key, JSON.stringify(value)); } catch {}
}

const RESIDENCIAS = ["Sol de Otoño", "El Chalet"];
const TIPOS = [
  { id:"visita",        label:"Visita Familiar",  icon:"👥", color:"#4ade80", maxSim:3 },
  { id:"salida",        label:"Salida",            icon:"🚶", color:"#fb923c", maxSim:1 },
  { id:"kinesio",       label:"Kinesiología",      icon:"🏃", color:"#60a5fa", maxSim:2 },
  { id:"medico",        label:"Turno Médico",      icon:"🩺", color:"#c084fc", maxSim:2 },
  { id:"analisis",      label:"Análisis Clínicos", icon:"🔬", color:"#f472b6", maxSim:2 },
  { id:"visita_medica", label:"Visita Médica",     icon:"👨‍⚕️", color:"#34d399", maxSim:2 },
];
const MOTIVOS = [
  "Residente sedado/a","Residente con fiebre","Residente descansando",
  "Visita médica urgente","Cuarentena / aislamiento",
  "Mantenimiento de la residencia","Solicitud del residente","Otro motivo",
];
const HORAS = Array.from({length:24},(_,i)=>`${String(i).padStart(2,"0")}:00`);
const defaultResidents = [
  {id:"r1",  nombre:"Susana Bustos",       residencia:"El Chalet"},
  {id:"r2",  nombre:"Amelia Ápez",         residencia:"El Chalet"},
  {id:"r3",  nombre:"Esther Moreno",       residencia:"El Chalet"},
  {id:"r4",  nombre:"Olga Marinelli",      residencia:"El Chalet"},
  {id:"r5",  nombre:"Inés Rivera",         residencia:"El Chalet"},
  {id:"r6",  nombre:"Amelia Cigalá",       residencia:"El Chalet"},
  {id:"r7",  nombre:"Emilia Girón",        residencia:"El Chalet"},
  {id:"r8",  nombre:"Dora Moreno",         residencia:"El Chalet"},
  {id:"r9",  nombre:"Rosa Andraca",        residencia:"El Chalet"},
  {id:"r10", nombre:"Lidia Gómez",         residencia:"El Chalet"},
  {id:"r11", nombre:"Antonio de la Vega",  residencia:"Sol de Otoño"},
  {id:"r12", nombre:"Nelson Tello",        residencia:"Sol de Otoño"},
  {id:"r13", nombre:"Carmen Narváez",      residencia:"Sol de Otoño"},
  {id:"r14", nombre:"Mireya Olivares",     residencia:"Sol de Otoño"},
  {id:"r15", nombre:"Francisco Linares",   residencia:"Sol de Otoño"},
  {id:"r16", nombre:"Francisco Cara",      residencia:"Sol de Otoño"},
  {id:"r17", nombre:"Gladys Núñez",        residencia:"Sol de Otoño"},
  {id:"r18", nombre:"Manuel Ricavarren",   residencia:"Sol de Otoño"},
  {id:"r19", nombre:"Rosa Oche",           residencia:"Sol de Otoño"},
  {id:"r20", nombre:"José Collado",        residencia:"Sol de Otoño"},
  {id:"r21", nombre:"Mario Rivero",        residencia:"Sol de Otoño"},
  {id:"r22", nombre:"Susana Serignani",    residencia:"Sol de Otoño"},
  {id:"r23", nombre:"Carlos Quiroga",      residencia:"Sol de Otoño"},
];

const hoyISO = () => new Date().toISOString().slice(0,10);
const fmt    = iso => { const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; };
const toMin  = t => { const [h,m]=t.split(":").map(Number); return h*60+m; };
const overlaps = (a,b) => toMin(a.horaInicio)<toMin(b.horaFin) && toMin(b.horaInicio)<toMin(a.horaFin);
const canCancel = t => (new Date(`${t.fecha}T${t.horaInicio}:00`) - new Date()) > 12*3600*1000;

async function sendEmail(templateId, params) {
  if (EMAILJS_SERVICE_ID==="TU_SERVICE_ID") return;
  try { await window.emailjs.send(EMAILJS_SERVICE_ID, templateId, params, EMAILJS_PUBLIC_KEY); }
  catch(e) { console.warn("EmailJS:",e); }
}
const notifyConfirm = t => !t.emailFamiliar ? null : sendEmail(TEMPLATE_CONFIRM,{
  to_email:t.emailFamiliar, to_name:t.nombreFamiliar, residente:t.residenteNombre,
  residencia:t.residencia,  habitacion:t.habitacion,  tipo:t.tipoLabel,
  fecha:fmt(t.fecha), hora_inicio:t.horaInicio, hora_fin:t.horaFin, turno_id:t.id,
});
const notifyCancel = (t,motivo,por) => !t.emailFamiliar ? null : sendEmail(TEMPLATE_CANCEL,{
  to_email:t.emailFamiliar, to_name:t.nombreFamiliar, residente:t.residenteNombre,
  residencia:t.residencia, tipo:t.tipoLabel, fecha:fmt(t.fecha),
  hora_inicio:t.horaInicio, hora_fin:t.horaFin, motivo, cancelado_por:por,
});

// ─── ROOT ────────────────────────────────────────────────────────
export default function App() {
  const [view,setView]       = useState("home");
  const [turnos,setTurnos]   = useState([]);
  const [residents,setRes]   = useState(defaultResidents);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    (async()=>{
      const t = await loadData("turnos-v2",[]);
      const r = await loadData("residents-v2",defaultResidents);
      setTurnos(t); setRes(r); setLoading(false);
    })();
  },[]);

  const saveTurnos = async v => { setTurnos(v); await saveData("turnos-v2",v); };
  const saveRes    = async v => { setRes(v);    await saveData("residents-v2",v); };

  if (loading) return (
    <div style={{background:"#0a0f1a",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{color:"#334155",fontFamily:"Georgia,serif",letterSpacing:3,fontSize:13,textTransform:"uppercase"}}>Cargando…</span>
    </div>
  );

  const props = {turnos,residents,saveTurnos,saveResidents:saveRes,setView};
  return (
    <div style={{fontFamily:"'Georgia',serif",background:"#0a0f1a",minHeight:"100vh",color:"#e2e8f0"}}>
      {view==="home"       && <HomeView      setView={setView}/>}
      {view==="familiar"   && <FamiliarView  {...props}/>}
      {view==="mis-turnos" && <MisTurnosView {...props}/>}
      {view==="enfermeria" && <EnfermeriaView {...props}/>}
      {view==="admin"      && <AdminView      {...props}/>}
    </div>
  );
}

// ─── HOME ────────────────────────────────────────────────────────
const PIN_PERSONAL = "R1234";
const PIN_ADMIN = "abc123";

function HomeView({setView}) {
  const [pinModal, setPinModal] = useState(false);
  const [pin, setPin]           = useState("");
  const [pinErr, setPinErr]     = useState(false);
  const [destino, setDestino]   = useState("");

  const abrirPersonal = (dest) => { setDestino(dest); setPinModal(true); setPin(""); setPinErr(false); };
  const checkPin = () => {
    const pinCorrecto = destino === "admin" ? PIN_ADMIN : PIN_PERSONAL;
    if (pin === pinCorrecto) { setPinModal(false); setView(destino); }
    else { setPinErr(true); setPin(""); }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,gap:28}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:10}}>🏡</div>
        <h1 style={{fontSize:26,fontWeight:"normal",color:"#f8fafc",margin:0,letterSpacing:1.5}}>Sistema de Turnos</h1>
        <p style={{color:"#475569",margin:"6px 0 0",fontSize:11,letterSpacing:3,textTransform:"uppercase"}}>Sol de Otoño · El Chalet</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:360}}>
        <HCard icon="📅" title="Reservar turno"     sub="Nuevo turno para un residente" color="#4ade80" onClick={()=>setView("familiar")}/>
        <HCard icon="📋" title="Mis turnos"          sub="Ver y cancelar mis reservas"   color="#fb923c" onClick={()=>setView("mis-turnos")}/>
        <div style={{borderTop:"1px solid #1e293b",paddingTop:12,marginTop:4}}>
          <p style={{color:"#334155",fontSize:11,textAlign:"center",letterSpacing:2,textTransform:"uppercase",margin:"0 0 10px"}}>Personal</p>
          <HCard icon="🏥" title="Panel de enfermería" sub="Turnos del día" color="#60a5fa" onClick={()=>abrirPersonal("enfermeria")}/>
          <div style={{marginTop:12}}>
            <HCard icon="⚙️" title="Administración" sub="Gestionar residentes y turnos" color="#c084fc" onClick={()=>abrirPersonal("admin")}/>
          </div>
        </div>
      </div>

      {pinModal && (
        <Modal onClose={()=>setPinModal(false)}>
          <div style={{fontSize:32,marginBottom:8}}>🔒</div>
          <h3 style={{color:"#94a3b8",fontWeight:"normal",margin:"0 0 14px"}}>Ingresá el PIN</h3>
          <input
            type="password" value={pin} onChange={e=>setPin(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&checkPin()}
            placeholder="••••••" autoFocus
            style={{...IS, textAlign:"center", fontSize:20, letterSpacing:6}}
          />
          {pinErr && <div style={{color:"#f87171",fontSize:13,marginBottom:8}}>PIN incorrecto</div>}
          <PBtn onClick={checkPin} style={{marginTop:4}}>Entrar</PBtn>
          <GBtn onClick={()=>setPinModal(false)}>Cancelar</GBtn>
        </Modal>
      )}
    </div>
  );
}
function HCard({icon,title,sub,color,onClick}) {
  const [h,setH]=useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{
      background:h?"#131c2e":"#0f1824", border:`2px solid ${h?color+"44":"#1e293b"}`,
      borderRadius:14,padding:"18px 20px",display:"flex",alignItems:"center",gap:14,
      cursor:"pointer",transition:"all 0.18s",width:"100%",textAlign:"left",
      transform:h?"translateY(-2px)":"none", boxShadow:h?`0 8px 28px ${color}18`:"none",
    }}>
      <div style={{fontSize:32}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{color,fontSize:16,fontWeight:"bold"}}>{title}</div>
        <div style={{color:"#475569",fontSize:12,marginTop:2}}>{sub}</div>
      </div>
      <div style={{color:"#1e3a5f",fontSize:18}}>›</div>
    </button>
  );
}

// ─── FAMILIAR: NUEVA RESERVA ──────────────────────────────────────
function FamiliarView({turnos,residents,saveTurnos,setView}) {
  const [step,setStep]   = useState(1);
  const [res,setRes]     = useState(null);
  const [tipo,setTipo]   = useState(null);
  const [fecha,setFecha] = useState(hoyISO());
  const [hi,setHi]       = useState("10:00");
  const [hf,setHf]       = useState("11:00");
  const [nombre,setNombre]= useState("");
  const [email,setEmail] = useState("");
  const [tel,setTel]     = useState("");
  const [obs,setObs]     = useState("");
  const [err,setErr]     = useState("");
  const [busq,setBusq]   = useState("");

  const filtrados = residents.filter(r=>
    r.nombre.toLowerCase().includes(busq.toLowerCase())||
    r.residencia.toLowerCase().includes(busq.toLowerCase())
  );

  const confirmar = async () => {
    if (!nombre.trim())             { setErr("Ingresá tu nombre"); return; }
    if (!email.includes("@"))       { setErr("Ingresá un email válido"); return; }
    const dia = turnos.filter(t=>t.residenteId===res.id&&t.fecha===fecha&&t.estado!=="cancelado");
    const nuevo = {horaInicio:hi,horaFin:hf};
    const salBlq = dia.find(t=>t.tipo==="salida"&&overlaps(t,nuevo));
    if (salBlq) { setErr(`⚠️ ${res.nombre} tiene una salida ${salBlq.horaInicio}–${salBlq.horaFin}. No estará disponible.`); return; }
    if (tipo.id==="salida") {
      const conf = dia.find(t=>overlaps(t,nuevo));
      if (conf) { const tp=TIPOS.find(x=>x.id===conf.tipo); setErr(`⚠️ Hay un turno de ${tp?.label} ${conf.horaInicio}–${conf.horaFin} que se superpone.`); return; }
    }
    const superp = dia.filter(t=>t.tipo===tipo.id&&overlaps(t,nuevo));
    if (superp.length>=tipo.maxSim) { setErr(`⚠️ Ya hay ${tipo.maxSim} turno(s) de ${tipo.label} en ese horario.`); return; }
    const t = {
      id:Date.now().toString(), residenteId:res.id, residenteNombre:res.nombre,
      residencia:res.residencia, habitacion:res.habitacion,
      tipo:tipo.id, tipoLabel:tipo.label, fecha, horaInicio:hi, horaFin:hf,
      nombreFamiliar:nombre, emailFamiliar:email, telefono:tel, observaciones:obs,
      estado:"confirmado", creadoEn:new Date().toISOString(),
    };
    await saveTurnos([...turnos,t]);
    await notifyConfirm(t);
    setErr(""); setStep(5);
  };

  const back = () => step===1 ? setView("home") : setStep(step-1);

  return (
    <div style={{maxWidth:480,margin:"0 auto",padding:16}}>
      <TopBar title="Nueva Reserva" onBack={back}/>

      {step===1&&<>
        <SL>¿Para qué residente?</SL>
        <input placeholder="Buscar…" value={busq} onChange={e=>setBusq(e.target.value)} style={IS}/>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
          {filtrados.map(r=>(
            <RBtn key={r.id} onClick={()=>{setRes(r);setStep(2);}}>
              <div><div style={{fontWeight:"bold"}}>{r.nombre}</div><div style={{color:"#64748b",fontSize:12}}>{r.residencia}</div></div>
            </RBtn>
          ))}
          {!filtrados.length&&<p style={{color:"#475569",textAlign:"center"}}>Sin resultados</p>}
        </div>
      </>}

      {step===2&&<>
        <SL>Tipo de turno para <b style={{color:"#e2e8f0"}}>{res?.nombre}</b></SL>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {TIPOS.map(t=>(
            <RBtn key={t.id} onClick={()=>{setTipo(t);setStep(3);}} accent={t.color}>
              <span style={{fontSize:26}}>{t.icon}</span>
              <div><div style={{color:t.color,fontWeight:"bold"}}>{t.label}</div><div style={{color:"#475569",fontSize:12}}>Máx. {t.maxSim} simultáneo(s)</div></div>
            </RBtn>
          ))}
        </div>
      </>}

      {step===3&&<>
        <SL>Fecha y horario</SL>
        <FL>Fecha</FL><input type="date" value={fecha} min={hoyISO()} onChange={e=>setFecha(e.target.value)} style={IS}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><FL>Desde</FL><select value={hi} onChange={e=>setHi(e.target.value)} style={IS}>{HORAS.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
          <div><FL>Hasta</FL><select value={hf} onChange={e=>setHf(e.target.value)} style={IS}>{HORAS.filter(h=>toMin(h)>toMin(hi)).map(h=><option key={h} value={h}>{h}</option>)}</select></div>
        </div>
        <DispoMini turnos={turnos} residenteId={res?.id} fecha={fecha}/>
        <PBtn onClick={()=>setStep(4)} style={{marginTop:14}}>Continuar →</PBtn>
      </>}

      {step===4&&<>
        <SL>Tus datos</SL>
        <FL>Tu nombre completo *</FL><input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej: Ana García" style={IS}/>
        <FL>Tu email * (recibís confirmación y avisos de cambios)</FL><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ejemplo@gmail.com" style={IS}/>
        <FL>Teléfono (opcional)</FL><input value={tel} onChange={e=>setTel(e.target.value)} placeholder="Ej: 011-1234-5678" style={IS}/>
        <FL>Observaciones (opcional)</FL><textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ej: llevamos silla de ruedas" style={{...IS,minHeight:70,resize:"vertical"}}/>
        <Resumen items={[["Residente",res?.nombre],["Residencia",res?.residencia],["Tipo",`${tipo?.icon} ${tipo?.label}`],["Fecha",fmt(fecha)],["Horario",`${hi} – ${hf}`]]}/>
        {err&&<ErrBox>{err}</ErrBox>}
        <PBtn onClick={confirmar} style={{marginTop:12}}>✅ Confirmar reserva</PBtn>
      </>}

      {step===5&&(
        <div style={{textAlign:"center",padding:"50px 0"}}>
          <div style={{fontSize:60,marginBottom:12}}>✅</div>
          <h2 style={{color:"#4ade80",fontWeight:"normal",margin:"0 0 8px"}}>¡Reserva confirmada!</h2>
          <p style={{color:"#94a3b8",fontSize:14,lineHeight:1.9}}>
            {tipo?.icon} {tipo?.label} para <b style={{color:"#e2e8f0"}}>{res?.nombre}</b><br/>
            {fmt(fecha)} · {hi} – {hf}<br/>
            <span style={{color:"#475569",fontSize:12}}>📧 Confirmación enviada a {email}</span>
          </p>
          <PBtn onClick={()=>{setStep(1);setRes(null);setTipo(null);setNombre("");setEmail("");setTel("");setObs("");setFecha(hoyISO());}} style={{marginTop:20}}>Nueva reserva</PBtn>
          <GBtn onClick={()=>setView("mis-turnos")} style={{marginTop:8}}>Ver mis turnos →</GBtn>
        </div>
      )}
    </div>
  );
}

// ─── MIS TURNOS ───────────────────────────────────────────────────
function MisTurnosView({turnos,saveTurnos,setView}) {
  const [mail,setMail]       = useState("");
  const [buscado,setBuscado] = useState("");
  const [cancelando,setCanc] = useState(null);
  const [motivo,setMotivo]   = useState("");

  const lista = buscado
    ? [...turnos]
        .filter(t=>t.emailFamiliar?.toLowerCase()===buscado.toLowerCase())
        .sort((a,b)=>`${b.fecha}${b.horaInicio}`.localeCompare(`${a.fecha}${a.horaInicio}`))
    : [];

  const doCancel = async () => {
    const m = motivo.trim()||"Cancelado por el familiar";
    await saveTurnos(turnos.map(t=>t.id===cancelando.id
      ?{...t,estado:"cancelado",motivoCancelacion:m,canceladoPor:"el familiar",canceladoEn:new Date().toISOString()}:t));
    await notifyCancel(cancelando,m,"el familiar");
    setCanc(null); setMotivo("");
  };

  return (
    <div style={{maxWidth:480,margin:"0 auto",padding:16}}>
      <TopBar title="Mis Turnos" onBack={()=>setView("home")}/>
      {!buscado?(
        <>
          <SL>Ingresá tu email para ver tus reservas</SL>
          <input type="email" value={mail} onChange={e=>setMail(e.target.value)} placeholder="tu@email.com" style={IS}/>
          <PBtn onClick={()=>setBuscado(mail)} style={{marginTop:6}}>Buscar mis turnos →</PBtn>
        </>
      ):(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <span style={{color:"#64748b",fontSize:12}}>📧 {buscado}</span>
            <button onClick={()=>{setBuscado("");setMail("");}} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:12}}>Cambiar</button>
          </div>
          {!lista.length?(
            <div style={{textAlign:"center",color:"#475569",padding:"50px 0"}}>
              <div style={{fontSize:40,marginBottom:10}}>📭</div>
              <p>Sin turnos para ese email</p>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {lista.map(t=>{
                const tp=TIPOS.find(x=>x.id===t.tipo);
                const cancelado=t.estado==="cancelado";
                const pasado=new Date(`${t.fecha}T${t.horaInicio}:00`)<new Date();
                const puede=!cancelado&&!pasado&&canCancel(t);
                const hrs=!cancelado&&!pasado?Math.round((new Date(`${t.fecha}T${t.horaInicio}:00`)-new Date())/3600000):null;
                return (
                  <div key={t.id} style={{
                    background:cancelado?"#0c1120":"#0f1824",
                    border:`1px solid ${cancelado?"#1e293b":tp?.color+"33"}`,
                    borderLeft:`4px solid ${cancelado?"#334155":tp?.color}`,
                    borderRadius:"0 12px 12px 0",padding:"14px 16px",
                    opacity:cancelado||pasado?0.6:1,
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{color:cancelado?"#475569":tp?.color,fontWeight:"bold",fontSize:14}}>{tp?.icon} {tp?.label}</div>
                        <div style={{color:"#94a3b8",fontSize:13,marginTop:2}}>👤 {t.residenteNombre} · {t.residencia}</div>
                        <div style={{color:"#64748b",fontSize:12,marginTop:2}}>📅 {fmt(t.fecha)} · {t.horaInicio}–{t.horaFin}</div>
                      </div>
                      <div style={{flexShrink:0,marginLeft:8}}>
                        {cancelado&&<Tag c="#ef4444">Cancelado</Tag>}
                        {!cancelado&&pasado&&<Tag c="#64748b">Finalizado</Tag>}
                        {!cancelado&&!pasado&&<Tag c="#4ade80">Confirmado</Tag>}
                      </div>
                    </div>
                    {cancelado&&t.motivoCancelacion&&(
                      <div style={{marginTop:8,background:"#1a0a0a",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#ef4444"}}>
                        ❌ Motivo: {t.motivoCancelacion} <span style={{color:"#7f1d1d"}}>({t.canceladoPor})</span>
                      </div>
                    )}
                    {!cancelado&&!pasado&&hrs!==null&&hrs<=12&&(
                      <div style={{marginTop:8,background:"#1a1200",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#fbbf24"}}>
                        ⚠️ Quedan {hrs}h · Ya no podés cancelar (límite: 12hs antes)
                      </div>
                    )}
                    {puede&&(
                      <button onClick={()=>setCanc(t)} style={{
                        marginTop:10,background:"#1a0a0a",color:"#f87171",
                        border:"1px solid #7f1d1d",borderRadius:8,padding:"7px 14px",
                        cursor:"pointer",fontSize:12,width:"100%",fontFamily:"Georgia,serif"
                      }}>Cancelar esta reserva</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {cancelando&&(
        <Modal onClose={()=>{setCanc(null);setMotivo("");}}>
          <div style={{fontSize:28,marginBottom:8}}>❌</div>
          <h3 style={{color:"#f87171",margin:"0 0 6px",fontWeight:"normal"}}>Cancelar reserva</h3>
          <p style={{color:"#94a3b8",fontSize:12,margin:"0 0 14px"}}>
            {cancelando.tipoLabel} · {fmt(cancelando.fecha)} {cancelando.horaInicio}–{cancelando.horaFin}
          </p>
          <FL>Motivo (opcional)</FL>
          <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ej: no puedo ir ese día" style={IS}/>
          <PBtn onClick={doCancel} style={{background:"#dc2626",marginTop:8}}>Confirmar cancelación</PBtn>
          <GBtn onClick={()=>{setCanc(null);setMotivo("");}}>Volver</GBtn>
        </Modal>
      )}
    </div>
  );
}

// ─── ENFERMERÍA ───────────────────────────────────────────────────
function EnfermeriaView({turnos,setView}) {
  const [fecha,setFecha]=useState(hoyISO());
  const [filtro,setFiltro]=useState("Todas");
  const lista=turnos
    .filter(t=>t.fecha===fecha&&t.estado!=="cancelado")
    .filter(t=>filtro==="Todas"||t.residencia===filtro)
    .sort((a,b)=>toMin(a.horaInicio)-toMin(b.horaInicio));

  return (
    <div style={{maxWidth:600,margin:"0 auto",padding:16}}>
      <TopBar title="Turnos del Día" onBack={()=>setView("home")}/>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...IS,flex:1,minWidth:140}}/>
        <select value={filtro} onChange={e=>setFiltro(e.target.value)} style={{...IS,flex:1,minWidth:140}}>
          <option value="Todas">Todas las residencias</option>
          {RESIDENCIAS.map(r=><option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {!lista.length?(
        <div style={{textAlign:"center",color:"#475569",padding:"60px 0"}}>
          <div style={{fontSize:44,marginBottom:10}}>📭</div><p>Sin turnos para este día</p>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {lista.map(t=>{
            const tp=TIPOS.find(x=>x.id===t.tipo);
            return (
              <div key={t.id} style={{background:"#0f1824",borderLeft:`4px solid ${tp?.color}`,borderRadius:"0 12px 12px 0",padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontWeight:"bold",fontSize:15}}>{t.residenteNombre}</div>
                    <div style={{color:"#475569",fontSize:12}}>{t.residencia}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{color:tp?.color,fontSize:13,fontWeight:"bold"}}>{tp?.icon} {tp?.label}</div>
                    <div style={{color:"#94a3b8",fontSize:13}}>🕐 {t.horaInicio}–{t.horaFin}</div>
                  </div>
                </div>
                <div style={{borderTop:"1px solid #1e293b",marginTop:10,paddingTop:8,fontSize:12,color:"#64748b"}}>
                  👤 {t.nombreFamiliar}{t.telefono?` · 📞 ${t.telefono}`:""}
                  {t.observaciones&&<div style={{marginTop:3}}>📝 {t.observaciones}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{marginTop:20,background:"#0f1824",border:"1px solid #1e293b",borderRadius:12,padding:16,fontSize:13}}>
        <b style={{color:"#94a3b8"}}>Resumen · {fmt(fecha)}</b>
        {TIPOS.map(tp=>{const n=lista.filter(t=>t.tipo===tp.id).length;return n?<div key={tp.id} style={{marginTop:4,color:"#64748b"}}>{tp.icon} {tp.label}: <b style={{color:tp.color}}>{n}</b></div>:null;})}
        <div style={{borderTop:"1px solid #1e293b",marginTop:8,paddingTop:8,color:"#64748b"}}>Total: <b style={{color:"#e2e8f0"}}>{lista.length}</b></div>
      </div>
    </div>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────
function AdminView({turnos,residents,saveTurnos,saveResidents,setView}) {
  const [tab,setTab]=useState("turnos");
  return (
    <div style={{maxWidth:600,margin:"0 auto",padding:16}}>
      <TopBar title="Administración" onBack={()=>setView("home")}/>
      <TabBar tabs={[["turnos","📋 Turnos"],["residentes","👥 Residentes"]]} active={tab} setActive={setTab}/>
      {tab==="turnos"    &&<AdminTurnos    turnos={turnos}    saveTurnos={saveTurnos}/>}
      {tab==="residentes"&&<AdminResidentes residents={residents} saveResidents={saveResidents}/>}

    </div>
  );
}

function AdminTurnos({turnos,saveTurnos}) {
  const [fecha,setFecha]=useState(hoyISO());
  const [filtro,setFiltro]=useState("Todas");
  const [canc,setCanc]=useState(null);
  const [motivo,setMotivo]=useState("");
  const [libre,setLibre]=useState("");

  const lista=turnos
    .filter(t=>t.fecha===fecha)
    .filter(t=>filtro==="Todas"||t.residencia===filtro)
    .sort((a,b)=>toMin(a.horaInicio)-toMin(b.horaInicio));

  const doCancel = async () => {
    const m=motivo==="Otro motivo"?libre:motivo;
    if (!m.trim()) return;
    await saveTurnos(turnos.map(t=>t.id===canc.id
      ?{...t,estado:"cancelado",motivoCancelacion:m,canceladoPor:"la administración",canceladoEn:new Date().toISOString()}:t));
    await notifyCancel(canc,m,"la administración");
    setCanc(null); setMotivo(""); setLibre("");
  };

  return (
    <>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...IS,flex:1}}/>
        <select value={filtro} onChange={e=>setFiltro(e.target.value)} style={{...IS,flex:1}}>
          <option value="Todas">Todas</option>
          {RESIDENCIAS.map(r=><option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {!lista.length?<p style={{color:"#475569",textAlign:"center",padding:40}}>Sin turnos</p>:(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {lista.map(t=>{
            const tp=TIPOS.find(x=>x.id===t.tipo);
            const cancelado=t.estado==="cancelado";
            return (
              <div key={t.id} style={{
                background:cancelado?"#0c1120":"#0f1824",
                borderLeft:`4px solid ${cancelado?"#334155":tp?.color}`,
                borderRadius:"0 10px 10px 0",padding:"12px 14px",opacity:cancelado?0.55:1
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"bold",fontSize:14}}>{t.residenteNombre} <span style={{color:"#475569",fontSize:12}}>· {t.residencia}</span></div>
                    <div style={{color:tp?.color,fontSize:12}}>{tp?.icon} {tp?.label} · {t.horaInicio}–{t.horaFin}</div>
                    <div style={{color:"#64748b",fontSize:12}}>👤 {t.nombreFamiliar}{t.emailFamiliar?` · ${t.emailFamiliar}`:""}</div>
                    {cancelado&&t.motivoCancelacion&&<div style={{color:"#ef4444",fontSize:11,marginTop:2}}>❌ {t.motivoCancelacion} ({t.canceladoPor})</div>}
                  </div>
                  <div style={{flexShrink:0,marginLeft:8}}>
                    {cancelado?<Tag c="#ef4444">Cancelado</Tag>:(
                      <button onClick={()=>setCanc(t)} style={{background:"#1a0a0a",color:"#f87171",border:"1px solid #7f1d1d",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:11,fontFamily:"Georgia,serif"}}>✕ Cancelar</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canc&&(
        <Modal onClose={()=>{setCanc(null);setMotivo("");setLibre("");}}>
          <div style={{fontSize:28,marginBottom:6}}>❌</div>
          <h3 style={{color:"#f87171",margin:"0 0 4px",fontWeight:"normal"}}>Cancelar turno</h3>
          <p style={{color:"#94a3b8",fontSize:12,margin:"0 0 14px",lineHeight:1.7}}>
            {canc.residenteNombre} · {canc.tipoLabel}<br/>
            {fmt(canc.fecha)} · {canc.horaInicio}–{canc.horaFin}<br/>
            <span style={{color:"#475569"}}>Notificación → {canc.emailFamiliar||"sin email"}</span>
          </p>
          <FL>Motivo de cancelación *</FL>
          <select value={motivo} onChange={e=>setMotivo(e.target.value)} style={IS}>
            <option value="">-- Elegí un motivo --</option>
            {MOTIVOS.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          {motivo==="Otro motivo"&&<input value={libre} onChange={e=>setLibre(e.target.value)} placeholder="Describí el motivo…" style={IS}/>}
          <PBtn onClick={doCancel} style={{background:"#dc2626",marginTop:8}} disabled={!motivo||(motivo==="Otro motivo"&&!libre.trim())}>
            Cancelar y notificar al familiar
          </PBtn>
          <GBtn onClick={()=>{setCanc(null);setMotivo("");setLibre("");}}>Volver</GBtn>
        </Modal>
      )}
    </>
  );
}

function AdminResidentes({residents,saveResidents}) {
  const [ed,setEd]=useState(null);
  const [nv,setNv]=useState({nombre:"",residencia:RESIDENCIAS[0]});
  const [modo,setModo]=useState(false);
  const add=()=>{if(!nv.nombre.trim()||!nv.habitacion.trim())return;saveResidents([...residents,{...nv,id:Date.now().toString()}]);setNv({nombre:"",residencia:RESIDENCIAS[0]});setModo(false);};
  const save=()=>{saveResidents(residents.map(r=>r.id===ed.id?ed:r));setEd(null);};
  const del=id=>{if(!confirm("¿Eliminar?"))return;saveResidents(residents.filter(r=>r.id!==id));};
  const F=({val,onChange,ph})=><input value={val} onChange={e=>onChange(e.target.value)} placeholder={ph} style={IS}/>;
  return (
    <div>
      {residents.map(r=>(
        ed?.id===r.id?(
          <div key={r.id} style={{background:"#0f1824",borderRadius:12,padding:14,marginBottom:10}}>
            <F val={ed.nombre} onChange={v=>setEd({...ed,nombre:v})} ph="Nombre"/>
            <select value={ed.residencia} onChange={e=>setEd({...ed,residencia:e.target.value})} style={IS}>{RESIDENCIAS.map(x=><option key={x} value={x}>{x}</option>)}</select>
            <div style={{display:"flex",gap:8}}><PBtn onClick={save} style={{flex:1,padding:"9px 0"}}>Guardar</PBtn><GBtn onClick={()=>setEd(null)} style={{flex:1,marginTop:0}}>Cancelar</GBtn></div>
          </div>
        ):(
          <div key={r.id} style={{background:"#0f1824",borderRadius:12,padding:14,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:"bold"}}>{r.nombre}</div><div style={{color:"#475569",fontSize:12}}>{r.residencia}</div></div>
            <div style={{display:"flex",gap:8}}>
              <IBtn onClick={()=>setEd({...r})} c="#60a5fa" bg="#0c1f36">✏️</IBtn>
              <IBtn onClick={()=>del(r.id)} c="#f87171" bg="#1a0a0a">🗑️</IBtn>
            </div>
          </div>
        )
      ))}
      {modo?(
        <div style={{background:"#0f1824",borderRadius:12,padding:14,marginTop:8}}>
          <FL>Nuevo residente</FL>
          <F val={nv.nombre} onChange={v=>setNv({...nv,nombre:v})} ph="Nombre completo"/>
          <select value={nv.residencia} onChange={e=>setNv({...nv,residencia:e.target.value})} style={IS}>{RESIDENCIAS.map(x=><option key={x} value={x}>{x}</option>)}</select>
          <div style={{display:"flex",gap:8}}><PBtn onClick={add} style={{flex:1,padding:"9px 0"}}>Agregar</PBtn><GBtn onClick={()=>setModo(false)} style={{flex:1,marginTop:0}}>Cancelar</GBtn></div>
        </div>
      ):(
        <button onClick={()=>setModo(true)} style={{width:"100%",padding:14,background:"none",border:"2px dashed #1e293b",color:"#475569",borderRadius:12,cursor:"pointer",fontSize:14,marginTop:4}}>+ Agregar residente</button>
      )}
    </div>
  );
}

function AdminEmail() {
  return (
    <div style={{background:"#0f1824",borderRadius:14,padding:20,fontSize:14,lineHeight:1.9}}>
      <div style={{fontSize:28,marginBottom:10}}>📧</div>
      <h3 style={{color:"#60a5fa",fontWeight:"normal",margin:"0 0 10px"}}>Configurar EmailJS</h3>
      <p style={{color:"#94a3b8",fontSize:13,marginBottom:14}}>Para enviar emails automáticos a los familiares seguí estos pasos:</p>
      {[
        ["1","Creá cuenta gratis en ","emailjs.com"],
        ["2","Agregá un Email Service conectando el email de la residencia"],
        ["3",'Creá 2 Email Templates: "confirmación" y "cancelación"'],
        ["4","Copiá el Service ID, Public Key y los 2 Template IDs"],
        ["5","Pegálos en las primeras líneas del código de la app"],
      ].map(([n,txt,link])=>(
        <div key={n} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}>
          <span style={{background:"#1e3a5f",color:"#60a5fa",borderRadius:8,padding:"2px 8px",fontSize:12,fontWeight:"bold",flexShrink:0}}>{n}</span>
          <span style={{color:"#94a3b8",fontSize:13}}>{txt}{link&&<a href={`https://${link}`} target="_blank" rel="noreferrer" style={{color:"#60a5fa"}}>{link}</a>}</span>
        </div>
      ))}
      <div style={{borderTop:"1px solid #1e293b",marginTop:14,paddingTop:14}}>
        <div style={{color:"#64748b",fontSize:12,marginBottom:8}}>Variables para tus templates:</div>
        {["to_email","to_name","residente","residencia","tipo","fecha","hora_inicio","hora_fin","motivo","cancelado_por"].map(v=>(
          <code key={v} style={{display:"inline-block",background:"#0a0f1a",color:"#4ade80",borderRadius:6,padding:"2px 8px",fontSize:11,margin:"2px 4px 2px 0"}}>{`{{${v}}}`}</code>
        ))}
      </div>
    </div>
  );
}

// ─── SHARED ───────────────────────────────────────────────────────
function TopBar({title,onBack}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22,paddingTop:8}}>
      <button onClick={onBack} style={{background:"#0f1824",border:"1px solid #1e293b",color:"#94a3b8",borderRadius:10,padding:"8px 13px",cursor:"pointer",fontSize:16}}>‹</button>
      <h2 style={{margin:0,fontSize:19,fontWeight:"normal",color:"#f1f5f9"}}>{title}</h2>
    </div>
  );
}
function TabBar({tabs,active,setActive}) {
  return (
    <div style={{display:"flex",gap:8,marginBottom:20}}>
      {tabs.map(([id,label])=>(
        <button key={id} onClick={()=>setActive(id)} style={{flex:1,padding:"10px 4px",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:"bold",fontFamily:"Georgia,serif",background:active===id?"#2563eb":"#0f1824",color:active===id?"#fff":"#475569"}}>{label}</button>
      ))}
    </div>
  );
}
function DispoMini({turnos,residenteId,fecha}) {
  const list=turnos.filter(t=>t.residenteId===residenteId&&t.fecha===fecha&&t.estado!=="cancelado");
  if (!list.length) return <p style={{color:"#4ade80",fontSize:12,marginTop:8}}>✅ Sin turnos ese día</p>;
  return (
    <div style={{marginTop:12}}>
      <FL>Turnos ya reservados ese día</FL>
      {list.map(t=>{const tp=TIPOS.find(x=>x.id===t.tipo);return(
        <div key={t.id} style={{background:"#0a0f1a",borderLeft:`3px solid ${tp?.color||"#64748b"}`,borderRadius:"0 8px 8px 0",padding:"5px 10px",marginBottom:4,fontSize:12,display:"flex",justifyContent:"space-between"}}>
          <span>{tp?.icon} {tp?.label}</span><span style={{color:"#64748b"}}>{t.horaInicio}–{t.horaFin}</span>
        </div>
      );})}
    </div>
  );
}
function Resumen({items}) {
  return (
    <div style={{background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:12,padding:14,marginTop:12,fontSize:13,lineHeight:2}}>
      {items.map(([k,v])=><div key={k}><b style={{color:"#64748b"}}>{k}:</b> <span style={{color:"#94a3b8"}}>{v}</span></div>)}
    </div>
  );
}
function Modal({children,onClose}) {
  return (
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:"#0f1824",border:"1px solid #1e293b",borderRadius:16,padding:24,maxWidth:380,width:"100%",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
function Tag({children,c}) {
  return <span style={{background:`${c}22`,color:c,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:"bold",whiteSpace:"nowrap"}}>{children}</span>;
}
function SL({children}) { return <h3 style={{color:"#64748b",fontSize:11,textTransform:"uppercase",letterSpacing:2,margin:"0 0 14px",fontWeight:"normal"}}>{children}</h3>; }
function FL({children}) { return <div style={{color:"#475569",fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{children}</div>; }
function ErrBox({children}) { return <div style={{color:"#f87171",background:"#450a0a",borderRadius:10,padding:12,marginTop:10,fontSize:13}}>{children}</div>; }
function PBtn({children,onClick,style={},disabled=false}) {
  const [h,setH]=useState(false);
  return <button onClick={onClick} disabled={disabled} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{width:"100%",padding:"13px 0",background:disabled?"#1e293b":h?"#1d4ed8":"#2563eb",color:disabled?"#475569":"#fff",border:"none",borderRadius:12,cursor:disabled?"not-allowed":"pointer",fontSize:14,fontWeight:"bold",transition:"background 0.15s",display:"block",fontFamily:"Georgia,serif",...style}}>{children}</button>;
}
function GBtn({children,onClick,style={}}) {
  return <button onClick={onClick} style={{width:"100%",padding:"11px 0",background:"none",border:"1px solid #1e293b",color:"#475569",borderRadius:12,cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif",marginTop:8,...style}}>{children}</button>;
}
function RBtn({children,onClick,accent}) {
  const [h,setH]=useState(false);
  return <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{background:h?"#131c2e":"#0f1824",border:`1px solid ${h&&accent?accent+"44":"#1e293b"}`,borderRadius:12,padding:"13px 16px",cursor:"pointer",textAlign:"left",color:"#e2e8f0",display:"flex",alignItems:"center",gap:12,transition:"all 0.15s",width:"100%"}}>{children}<span style={{marginLeft:"auto",color:"#1e3a5f"}}>›</span></button>;
}
function IBtn({children,onClick,c,bg}) {
  return <button onClick={onClick} style={{background:bg,color:c,border:"none",borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:13}}>{children}</button>;
}
const IS={width:"100%",background:"#0a0f1a",border:"1px solid #1e293b",color:"#e2e8f0",borderRadius:10,padding:"11px 13px",fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:10,fontFamily:"Georgia,serif"};
