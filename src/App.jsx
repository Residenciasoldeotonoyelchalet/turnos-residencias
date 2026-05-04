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
  try {
    // Try window.storage first (Claude environment)
    if (window.storage) {
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : fallback;
    }
    // Fallback to localStorage
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
async function saveData(key, value) {
  try {
    if (window.storage) {
      await window.storage.set(key, JSON.stringify(value));
    }
    // Always also save to localStorage as backup
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const RESIDENCIAS = ["Sol de Otoño", "El Chalet"];
const TIPOS = [
  { id:"visita",          label:"Visita Familiar",              icon:"👥", color:"#4ade80", maxSim:3 },
  { id:"salida",          label:"Salida",                       icon:"🚶", color:"#fb923c", maxSim:5, noOverlap:true },
  { id:"kinesio",         label:"Kinesiología",                 icon:"🏃", color:"#60a5fa", maxSim:2 },
  { id:"medico",          label:"Turno Médico",                 icon:"🩺", color:"#c084fc", maxSim:2 },
  { id:"analisis_visita", label:"Análisis - Bioquímico visita", icon:"🔬", color:"#f472b6", maxSim:2, horaMin:"07:00", horaMax:"09:00" },
  { id:"analisis_buscan", label:"Análisis - Buscan al residente",icon:"🧪", color:"#e879f9", maxSim:2, horaMin:"07:00", horaMax:"09:00" },
  { id:"visita_medica",   label:"Visita Médica",                icon:"👨‍⚕️", color:"#34d399", maxSim:2 },
];
const DEFAULT_KINESIO_HORARIOS = ["10:00","10:30","11:00","11:30","18:00","18:30","19:00","19:30"];
const DEFAULT_ANALISIS_HORARIOS = ["07:00","07:30","08:00","08:30","09:00"];
const SALIDA_HORARIOS_MANANA = ["10:00","10:30","11:00","11:30","12:00"];
const SALIDA_HORARIOS_TARDE  = ["18:00","18:30","19:00","19:30","20:00"];
const SALIDA_HORARIOS_NOCHE  = ["22:00","22:30","23:00","23:30","00:00","00:30","01:00"];
const SALIDA_HORARIOS_ALL    = [...SALIDA_HORARIOS_MANANA, ...SALIDA_HORARIOS_TARDE, ...SALIDA_HORARIOS_NOCHE];

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
const normalizar = s => s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
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
      const h = await loadData("horarios-v1",{kinesio: DEFAULT_KINESIO_HORARIOS, analisis: DEFAULT_ANALISIS_HORARIOS});
      const b = await loadData("bloqueos-v1",[]);
      setTurnos(t); setRes(r); setHorarios(h); setBloqueos(b); setLoading(false);
    })();
  },[]);

  const [horarios, setHorarios] = useState({kinesio: DEFAULT_KINESIO_HORARIOS, analisis: DEFAULT_ANALISIS_HORARIOS});
  const [bloqueos, setBloqueos] = useState([]);

  const saveTurnos = async v => { setTurnos(v); await saveData("turnos-v2",v); };
  const saveRes    = async v => { setRes(v);    await saveData("residents-v2",v); };
  const saveHorarios = async v => { setHorarios(v); await saveData("horarios-v1",v); };
  const saveBloqueos = async v => { setBloqueos(v); await saveData("bloqueos-v1",v); };

  if (loading) return (
    <div style={{background:"#1a1a2e",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{color:"#7eb8ff",fontFamily:"Georgia,serif",letterSpacing:3,fontSize:18,textTransform:"uppercase",fontWeight:"bold"}}>Cargando…</span>
    </div>
  );

  const props = {turnos,residents,saveTurnos,saveResidents:saveRes,setView,horarios,saveHorarios,bloqueos,saveBloqueos};
  return (
    <div style={{fontFamily:"'Georgia',serif",background:"#1a1a2e",minHeight:"100vh",color:"#e2e8f0"}}>
      {view==="home"       && <HomeView      setView={setView}/>}
      {view==="familiar"   && <FamiliarView  {...props} horarios={horarios} bloqueos={bloqueos}/>}
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

  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(()=>{
    window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); setInstallPrompt(e); });
    window.addEventListener("appinstalled", () => setInstalled(true));
  },[]);

  const instalar = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const {outcome} = await installPrompt.userChoice;
    if (outcome==="accepted") setInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,gap:28}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:10}}>🏡</div>
        <h1 style={{fontSize:34,fontWeight:"bold",color:"#ffffff",margin:0,letterSpacing:1,textShadow:"0 2px 8px rgba(0,102,255,0.3)"}}>Sistema de Turnos</h1>
        <p style={{color:"#7eb8ff",margin:"8px 0 0",fontSize:17,letterSpacing:2,textTransform:"uppercase",fontWeight:"bold"}}>Sol de Otoño · El Chalet</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:360}}>
        <HCard icon="📅" title="Reservar turno"     sub="Nuevo turno para un residente" color="#4ade80" onClick={()=>setView("familiar")}/>
        <HCard icon="📋" title="Mis turnos"          sub="Ver y cancelar mis reservas"   color="#fb923c" onClick={()=>setView("mis-turnos")}/>
        {installPrompt && !installed && (
          <button onClick={instalar} style={{
            width:"100%", padding:"16px 20px", background:"#003d99",
            border:"3px solid #4a9eff", borderRadius:16, cursor:"pointer",
            display:"flex", alignItems:"center", gap:14, textAlign:"left",
            fontFamily:"Georgia,serif"
          }}>
            <div style={{fontSize:36}}>📲</div>
            <div style={{flex:1}}>
              <div style={{color:"#7eb8ff",fontSize:18,fontWeight:"bold"}}>Instalar en el celular</div>
              <div style={{color:"#a0c4ff",fontSize:14,marginTop:3}}>Guardala como app en tu pantalla</div>
            </div>
          </button>
        )}
        {installed && (
          <div style={{textAlign:"center",color:"#4ade80",fontSize:15,padding:"8px 0"}}>✅ App instalada</div>
        )}
        {!installPrompt && !installed && (
          <div style={{background:"#16213e",border:"2px solid #334d6e",borderRadius:14,padding:16,width:"100%",maxWidth:360}}>
            <div style={{color:"#7eb8ff",fontWeight:"bold",fontSize:16,marginBottom:10}}>📲 Instalá la app en tu celular</div>
            <div style={{color:"#b8d4ff",fontSize:15,marginBottom:8}}>
              <b style={{color:"#f5c200"}}>Android:</b> Tocá los 3 puntitos del navegador → "Agregar a pantalla de inicio"
            </div>
            <div style={{color:"#b8d4ff",fontSize:15}}>
              <b style={{color:"#4ade80"}}>iPhone:</b> Abrí en Safari → tocá el botón compartir ↑ → "Agregar a pantalla de inicio"
            </div>
          </div>
        )}
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
          <h3 style={{color:"#b8d4ff",fontWeight:"normal",margin:"0 0 14px"}}>Ingresá el PIN</h3>
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
      background:h?"#1e3a6e":"#16213e", border:`2px solid ${h?color+"44":"#1e293b"}`,
      borderRadius:16,padding:"22px 20px",display:"flex",alignItems:"center",gap:16,
      cursor:"pointer",transition:"all 0.18s",width:"100%",textAlign:"left",
      transform:h?"translateY(-2px)":"none", boxShadow:h?`0 8px 28px ${color}18`:"none",
    }}>
      <div style={{fontSize:40}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{color,fontSize:20,fontWeight:"bold"}}>{title}</div>
        <div style={{color:"#b8d4ff",fontSize:15,marginTop:4}}>{sub}</div>
      </div>
      <div style={{color:"#1e3a5f",fontSize:18}}>›</div>
    </button>
  );
}

// ─── FAMILIAR: NUEVA RESERVA ──────────────────────────────────────
function FamiliarView({turnos,residents,saveTurnos,setView,horarios,bloqueos}) {
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
    if (tipo?.id==="kinesio" && !(horarios?.kinesio||DEFAULT_KINESIO_HORARIOS).includes(hi)) { setErr("⚠️ Por favor elegí un horario de kinesiología en el paso anterior."); return; }
    if ((tipo?.id==="analisis_visita"||tipo?.id==="analisis_buscan") && !(horarios?.analisis||DEFAULT_ANALISIS_HORARIOS).includes(hi)) { setErr("⚠️ Por favor elegí un horario de análisis en el paso anterior."); return; }
    if (tipo?.id==="salida" && !hi) { setErr("⚠️ Por favor elegí el horario de salida en el paso anterior."); return; }
    if (tipo?.id==="salida" && !hf) { setErr("⚠️ Por favor elegí el horario de regreso en el paso anterior."); return; }
    // Validar 12hs mínimas de anticipación
    const turnoDateTime = new Date(`${fecha}T${hi}:00`);
    const horasHastaElTurno = (turnoDateTime - new Date()) / 3600000;
    if (horasHastaElTurno < 12) { setErr(`⚠️ Las reservas deben hacerse con al menos 12 horas de anticipación. Este turno comienza en ${Math.round(horasHastaElTurno)}hs.`); return; }
    // Validar bloqueos de horario
    const bloqueoActivo = (bloqueos||[]).find(b =>
      b.residencia === res.residencia &&
      b.fecha === fecha &&
      b.estado !== "eliminado" &&
      toMin(b.horaInicio) < toMin(hf) &&
      toMin(b.horaFin) > toMin(hi)
    );
    if (bloqueoActivo) { setErr(`⚠️ Ese horario está bloqueado en ${res.residencia}: "${bloqueoActivo.motivo}" (${bloqueoActivo.horaInicio}–${bloqueoActivo.horaFin}). No se pueden hacer reservas en ese rango.`); return; }
    const dia = turnos.filter(t=>t.residenteId===res.id&&t.fecha===fecha&&t.estado!=="cancelado");
    const nuevo = {horaInicio:hi,horaFin:hf};
    // Bloqueo por salida existente que se superpone
    const salBlq = dia.find(t=>t.tipo==="salida"&&overlaps(t,nuevo));
    if (salBlq) { setErr(`⚠️ ${res.nombre} tiene una salida ${salBlq.horaInicio}–${salBlq.horaFin}. No estará disponible.`); return; }

    // Salidas: validar horario permitido y no superposición
    if (tipo.id==="salida") {
      if (!hi) { setErr("⚠️ Elegí un horario de salida."); return; }
      if (!hf) { setErr("⚠️ Elegí un horario de regreso."); return; }
      if (!SALIDA_HORARIOS_ALL.includes(hi)) { setErr("⚠️ El horario de salida debe estar entre 10:00-12:00, 18:00-20:00 o 22:00-01:00."); return; }
      if (!SALIDA_HORARIOS_ALL.includes(hf)) { setErr("⚠️ El horario de regreso debe estar dentro del rango permitido."); return; }
      const hiM = toMin(hi) < 120 ? toMin(hi)+1440 : toMin(hi);
      const hfM = toMin(hf) < 120 ? toMin(hf)+1440 : toMin(hf);
      if (hfM - hiM < 30) { setErr("⚠️ Debe haber al menos 30 minutos entre la salida y el regreso."); return; }
      // Bloquear horarios ya usados en TODA la residencia ese día (salida o regreso)
      const turnosResidencia = turnos.filter(t=>t.tipo==="salida"&&t.fecha===fecha&&t.residencia===res.residencia&&t.estado!=="cancelado");
      const horasOcupadas = turnosResidencia.flatMap(t=>[t.horaInicio,t.horaFin]);
      if (horasOcupadas.includes(hi)) { setErr(`⚠️ El horario ${hi} ya está ocupado por otra salida en ${res.residencia}. No pueden coincidir entradas ni salidas.`); return; }
      if (horasOcupadas.includes(hf)) { setErr(`⚠️ El horario de regreso ${hf} ya está ocupado por otra salida en ${res.residencia}. No pueden coincidir entradas ni salidas.`); return; }
      const conf = dia.find(t=>t.tipo==="salida"&&overlaps(t,nuevo));
      if (conf) { setErr(`⚠️ Ya hay una salida de ${conf.horaInicio} a ${conf.horaFin}. Cada salida debe tener horario distinto.`); return; }
      const totalSalidas = dia.filter(t=>t.tipo==="salida").length;
      if (totalSalidas>=5) { setErr(`⚠️ Ya hay 5 salidas registradas para este día (máximo permitido).`); return; }
    }



    // Análisis clínicos: solo de 7:00 a 9:00
    if (tipo.horaMin && tipo.horaMax) {
      if (toMin(hi) < toMin(tipo.horaMin) || toMin(hf) > toMin(tipo.horaMax)) {
        setErr(`⚠️ Los análisis clínicos solo se pueden reservar entre ${tipo.horaMin} y ${tipo.horaMax}.`); return;
      }
    }

    const superp = dia.filter(t=>t.tipo===tipo.id&&overlaps(t,nuevo));
    if (tipo.id!=="salida" && superp.length>=tipo.maxSim) { setErr(`⚠️ Ya hay ${tipo.maxSim} turno(s) de ${tipo.label} en ese horario.`); return; }
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
        <SL>Nombre del residente</SL>
        <input
          placeholder="Escribí el nombre completo…"
          value={busq}
          onChange={e=>{setBusq(e.target.value);setErr("");}}
          style={IS}
          autoComplete="off"
        />
        {err&&<ErrBox>{err}</ErrBox>}
        <PBtn onClick={()=>{
          const encontrado = residents.find(r=>normalizar(r.nombre)===normalizar(busq));
          if (!encontrado) { setErr("⚠️ No encontramos ese residente. Verificá el nombre completo."); return; }
          setRes(encontrado); setErr(""); setStep(2);
        }} style={{marginTop:8}}>Continuar →</PBtn>
      </>}

      {step===2&&<>
        <SL>Tipo de turno para <b style={{color:"#e2e8f0"}}>{res?.nombre}</b></SL>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {TIPOS.map(t=>(
            <RBtn key={t.id} onClick={()=>{setTipo(t);setStep(3);}} accent={t.color}>
              <span style={{fontSize:34}}>{t.icon}</span>
              <div><div style={{color:t.color,fontWeight:"bold",fontSize:17}}>{t.label}</div><div style={{color:"#b8d4ff",fontSize:14,marginTop:3}}>Máx. {t.maxSim} simultáneo(s)</div></div>
            </RBtn>
          ))}
        </div>
      </>}

      {step===3&&<>
        <SL>Fecha y horario</SL>
        <FL>Fecha</FL><input type="date" value={fecha} min={hoyISO()} onChange={e=>setFecha(e.target.value)} style={IS}/>

        {tipo?.id==="kinesio" ? (
          <>
            <FL>Elegí un horario disponible</FL>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              {(horarios?.kinesio||DEFAULT_KINESIO_HORARIOS).map(h=>{
                const hFin = `${String(Math.floor((toMin(h)+40)/60)).padStart(2,"0")}:${String((toMin(h)+40)%60).padStart(2,"0")}`;
                const ocupados = turnos.filter(t=>t.residenteId===res?.id&&t.fecha===fecha&&t.tipo==="kinesio"&&t.estado!=="cancelado"&&t.horaInicio===h).length;
                const lleno = ocupados >= 2;
                const selec = hi===h;
                return (
                  <button key={h} onClick={()=>{if(!lleno){setHi(h);setHf(hFin);}}} style={{
                    padding:"14px 8px", borderRadius:10, border:`2px solid ${selec?"#60a5fa":lleno?"#334155":"#1e293b"}`,
                    background:selec?"#0052cc":lleno?"#0f1429":"#16213e",
                    color:selec?"#60a5fa":lleno?"#334155":"#94a3b8",
                    cursor:lleno?"not-allowed":"pointer", fontSize:16, fontFamily:"Georgia,serif",
                    opacity:lleno?0.5:1
                  }}>
                    <div style={{fontWeight:"bold"}}>{h}</div>
                    <div style={{fontSize:13,marginTop:2}}>{lleno?"Completo":`${2-ocupados} lugar${2-ocupados===1?"":"es"}`}</div>
                  </button>
                );
              })}
            </div>
          </>
        ) : tipo?.id==="analisis_visita"||tipo?.id==="analisis_buscan" ? (
          <>
            <FL>Horario disponible (7:00 a 9:00)</FL>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              {(horarios?.analisis||DEFAULT_ANALISIS_HORARIOS).map(h=>{
                const hFin = `${String(Math.floor((toMin(h)+30)/60)).padStart(2,"0")}:${String((toMin(h)+30)%60).padStart(2,"0")}`;
                const ocupados = turnos.filter(t=>t.residenteId===res?.id&&t.fecha===fecha&&t.tipo===tipo.id&&t.estado!=="cancelado"&&t.horaInicio===h).length;
                const lleno = ocupados >= 2;
                const selec = hi===h;
                return (
                  <button key={h} onClick={()=>{if(!lleno){setHi(h);setHf(hFin);}}} style={{
                    padding:"14px 8px", borderRadius:10, border:`2px solid ${selec?"#f472b6":lleno?"#334155":"#1e293b"}`,
                    background:selec?"#3d1a4e":lleno?"#0f1429":"#16213e",
                    color:selec?"#f472b6":lleno?"#334155":"#94a3b8",
                    cursor:lleno?"not-allowed":"pointer", fontSize:16, fontFamily:"Georgia,serif",
                    opacity:lleno?0.5:1
                  }}>
                    <div style={{fontWeight:"bold"}}>{h}</div>
                    <div style={{fontSize:13,marginTop:2}}>{lleno?"Completo":`${2-ocupados} lugar${2-ocupados===1?"":"es"}`}</div>
                  </button>
                );
              })}
            </div>
          </>
        ) : tipo?.id==="salida" ? (
          <>
            <FL>Horario de salida</FL>
            <select value={hi} onChange={e=>{setHi(e.target.value);setHf("");}} style={IS}>
              <option value="">-- Elegí hora de salida --</option>
              {(() => {
                const horasOcupadas = turnos.filter(t=>t.tipo==="salida"&&t.fecha===fecha&&t.residencia===res?.residencia&&t.estado!=="cancelado").flatMap(t=>[t.horaInicio,t.horaFin]);
                const renderOpt = h => {
                  const ocupado = horasOcupadas.includes(h);
                  return <option key={h} value={h} disabled={ocupado}>{ocupado ? `${h} — ocupado` : h}</option>;
                };
                return <>
                  <optgroup label="Mañana (10:00 - 12:00)">{SALIDA_HORARIOS_MANANA.map(renderOpt)}</optgroup>
                  <optgroup label="Tarde (18:00 - 20:00)">{SALIDA_HORARIOS_TARDE.map(renderOpt)}</optgroup>
                  <optgroup label="Noche (22:00 - 01:00)">{SALIDA_HORARIOS_NOCHE.map(renderOpt)}</optgroup>
                </>;
              })()}
            </select>
            <FL>Horario de regreso</FL>
            <select value={hf} onChange={e=>setHf(e.target.value)} style={IS}>
              <option value="">-- Elegí hora de regreso --</option>
              {hi && (() => {
                const hiMin = toMin(hi) < 120 ? toMin(hi)+1440 : toMin(hi);
                const horasOcupadas = turnos.filter(t=>t.tipo==="salida"&&t.fecha===fecha&&t.residencia===res?.residencia&&t.estado!=="cancelado").flatMap(t=>[t.horaInicio,t.horaFin]);
                const opciones = SALIDA_HORARIOS_ALL.filter(h => {
                  const hMin = toMin(h) < 120 ? toMin(h)+1440 : toMin(h);
                  return hMin - hiMin >= 30;
                });
                const renderOpt = h => {
                  const ocupado = horasOcupadas.includes(h);
                  return <option key={h} value={h} disabled={ocupado}>{ocupado ? `${h} — ocupado` : h}</option>;
                };
                const enManana = opciones.filter(h=>SALIDA_HORARIOS_MANANA.includes(h));
                const enTarde  = opciones.filter(h=>SALIDA_HORARIOS_TARDE.includes(h));
                const enNoche  = opciones.filter(h=>SALIDA_HORARIOS_NOCHE.includes(h));
                return <>
                  {enManana.length>0&&<optgroup label="Mañana (10:00-12:00)">{enManana.map(renderOpt)}</optgroup>}
                  {enTarde.length>0 &&<optgroup label="Tarde (18:00-20:00)">{enTarde.map(renderOpt)}</optgroup>}
                  {enNoche.length>0 &&<optgroup label="Noche (22:00-01:00)">{enNoche.map(renderOpt)}</optgroup>}
                </>;
              })()}
            </select>
          </>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <FL>Desde</FL>
              <select value={hi} onChange={e=>setHi(e.target.value)} style={IS}>
                {HORAS.map(h=>{
                  const ocupado = turnos.filter(t=>
                    t.residenteId===res?.id && t.fecha===fecha &&
                    t.tipo===tipo?.id && t.estado!=="cancelado" &&
                    toMin(t.horaInicio)<=toMin(h) && toMin(h)<toMin(t.horaFin)
                  ).length >= (tipo?.maxSim||99);
                  return <option key={h} value={h} disabled={ocupado}>{ocupado ? `${h} — ocupado` : h}</option>;
                })}
              </select>
            </div>
            <div>
              <FL>Hasta</FL>
              <select value={hf} onChange={e=>setHf(e.target.value)} style={IS}>
                {HORAS.filter(h=>toMin(h)>toMin(hi)).map(h=>{
                  const ocupado = turnos.filter(t=>
                    t.residenteId===res?.id && t.fecha===fecha &&
                    t.tipo===tipo?.id && t.estado!=="cancelado" &&
                    toMin(t.horaInicio)<toMin(h) && toMin(h)<=toMin(t.horaFin)
                  ).length >= (tipo?.maxSim||99);
                  return <option key={h} value={h} disabled={ocupado}>{ocupado ? `${h} — ocupado` : h}</option>;
                })}
              </select>
            </div>
          </div>
        )}

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
          <p style={{color:"#b8d4ff",fontSize:14,lineHeight:1.9}}>
            {tipo?.icon} {tipo?.label} para <b style={{color:"#e2e8f0"}}>{res?.nombre}</b><br/>
            {fmt(fecha)} · {hi} – {hf}<br/>
            <span style={{color:"#7a9abf",fontSize:12}}>📧 Confirmación enviada a {email}</span>
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
            <span style={{color:"#8ab4d4",fontSize:12}}>📧 {buscado}</span>
            <button onClick={()=>{setBuscado("");setMail("");}} style={{background:"none",border:"none",color:"#7a9abf",cursor:"pointer",fontSize:12}}>Cambiar</button>
          </div>
          {!lista.length?(
            <div style={{textAlign:"center",color:"#7a9abf",padding:"50px 0"}}>
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
                const msRestantes = new Date(`${t.fecha}T${t.horaInicio}:00`) - new Date();
                const hrs = !cancelado&&!pasado ? Math.max(0, Math.floor(msRestantes/3600000)) : null;
                const mins = !cancelado&&!pasado ? Math.max(0, Math.floor((msRestantes%3600000)/60000)) : null;
                return (
                  <div key={t.id} style={{
                    background:cancelado?"#0f1429":"#16213e",
                    border:`1px solid ${cancelado?"#1e293b":tp?.color+"33"}`,
                    borderLeft:`4px solid ${cancelado?"#334155":tp?.color}`,
                    borderRadius:"0 12px 12px 0",padding:"14px 16px",
                    opacity:cancelado||pasado?0.6:1,
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{color:cancelado?"#475569":tp?.color,fontWeight:"bold",fontSize:14}}>{tp?.icon} {tp?.label}</div>
                        <div style={{color:"#b8d4ff",fontSize:13,marginTop:2}}>👤 {t.residenteNombre} · {t.residencia}</div>
                        <div style={{color:"#8ab4d4",fontSize:12,marginTop:2}}>📅 {fmt(t.fecha)} · {t.horaInicio}–{t.horaFin}</div>
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
                        ⚠️ Quedan {hrs > 0 ? `${hrs}h` : `${mins}min`} · Ya no podés cancelar (límite: 12hs antes)
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
          <p style={{color:"#b8d4ff",fontSize:12,margin:"0 0 14px"}}>
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
  // Load from localStorage as backup if turnos is empty
  const [localTurnos, setLocalTurnos] = useState(turnos);
  useEffect(()=>{
    if (turnos.length > 0) { setLocalTurnos(turnos); return; }
    try {
      const v = localStorage.getItem("turnos-v2");
      if (v) setLocalTurnos(JSON.parse(v));
    } catch {}
  },[turnos]);
  const lista=localTurnos
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
        <div style={{textAlign:"center",color:"#7a9abf",padding:"60px 0"}}>
          <div style={{fontSize:44,marginBottom:10}}>📭</div><p>Sin turnos para este día</p>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {lista.map(t=>{
            const tp=TIPOS.find(x=>x.id===t.tipo);
            return (
              <div key={t.id} style={{background:"#16213e",borderLeft:`4px solid ${tp?.color}`,borderRadius:"0 12px 12px 0",padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontWeight:"bold",fontSize:18}}>{t.residenteNombre}</div>
                    <div style={{color:"#7a9abf",fontSize:12}}>{t.residencia}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{color:tp?.color,fontSize:16,fontWeight:"bold"}}>{tp?.icon} {tp?.label}</div>
                    <div style={{color:"#b8d4ff",fontSize:16}}>🕐 {t.horaInicio}–{t.horaFin}</div>
                  </div>
                </div>
                <div style={{borderTop:"1px solid #1e293b",marginTop:10,paddingTop:8,fontSize:12,color:"#8ab4d4"}}>
                  👤 {t.nombreFamiliar}{t.telefono?` · 📞 ${t.telefono}`:""}
                  {t.observaciones&&<div style={{marginTop:3}}>📝 {t.observaciones}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{marginTop:20,background:"#16213e",border:"1px solid #1e293b",borderRadius:12,padding:16,fontSize:13}}>
        <b style={{color:"#b8d4ff"}}>Resumen · {fmt(fecha)}</b>
        {TIPOS.map(tp=>{const n=lista.filter(t=>t.tipo===tp.id).length;return n?<div key={tp.id} style={{marginTop:4,color:"#8ab4d4"}}>{tp.icon} {tp.label}: <b style={{color:tp.color}}>{n}</b></div>:null;})}
        <div style={{borderTop:"1px solid #1e293b",marginTop:8,paddingTop:8,color:"#8ab4d4"}}>Total: <b style={{color:"#e2e8f0"}}>{lista.length}</b></div>
      </div>
    </div>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────
function AdminView({turnos,residents,saveTurnos,saveResidents,setView,horarios,saveHorarios,bloqueos,saveBloqueos}) {
  const [tab,setTab]=useState("turnos");
  return (
    <div style={{maxWidth:600,margin:"0 auto",padding:16}}>
      <TopBar title="Administración" onBack={()=>setView("home")}/>
      <TabBar tabs={[["turnos","📋 Turnos"],["residentes","👥 Residentes"],["config","⚙️ Horarios"],["bloqueos","🚫 Bloqueos"]]} active={tab} setActive={setTab}/>
      {tab==="turnos"    &&<AdminTurnos    turnos={turnos}    saveTurnos={saveTurnos}/>}
      {tab==="residentes"&&<AdminResidentes residents={residents} saveResidents={saveResidents}/>}
      {tab==="config"    &&<AdminHorarios  horarios={horarios} saveHorarios={saveHorarios} turnos={turnos}/>}
      {tab==="bloqueos"  &&<AdminBloqueos  bloqueos={bloqueos} saveBloqueos={saveBloqueos}/>}
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
      {!lista.length?<p style={{color:"#7a9abf",textAlign:"center",padding:40}}>Sin turnos</p>:(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {lista.map(t=>{
            const tp=TIPOS.find(x=>x.id===t.tipo);
            const cancelado=t.estado==="cancelado";
            return (
              <div key={t.id} style={{
                background:cancelado?"#0f1429":"#16213e",
                borderLeft:`4px solid ${cancelado?"#334155":tp?.color}`,
                borderRadius:"0 10px 10px 0",padding:"12px 14px",opacity:cancelado?0.55:1
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"bold",fontSize:14}}>{t.residenteNombre} <span style={{color:"#7a9abf",fontSize:12}}>· {t.residencia}</span></div>
                    <div style={{color:tp?.color,fontSize:12}}>{tp?.icon} {tp?.label} · {t.horaInicio}–{t.horaFin}</div>
                    <div style={{color:"#8ab4d4",fontSize:12}}>👤 {t.nombreFamiliar}{t.emailFamiliar?` · ${t.emailFamiliar}`:""}</div>
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
          <p style={{color:"#b8d4ff",fontSize:12,margin:"0 0 14px",lineHeight:1.7}}>
            {canc.residenteNombre} · {canc.tipoLabel}<br/>
            {fmt(canc.fecha)} · {canc.horaInicio}–{canc.horaFin}<br/>
            <span style={{color:"#7a9abf"}}>Notificación → {canc.emailFamiliar||"sin email"}</span>
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


function AdminHorarios({horarios,saveHorarios,turnos}) {
  const [nuevoK,setNuevoK] = useState("");
  const [nuevoA,setNuevoA] = useState("");
  const [msg,setMsg]       = useState("");

  const toMin2 = t => { const [h,m]=t.split(":").map(Number); return h*60+m; };

  const tieneReservas = (tipo, hora) => {
    return turnos.some(t => t.tipo===tipo && t.horaInicio===hora && t.estado!=="cancelado");
  };

  const agregarK = () => {
    if (!nuevoK.match(/^\d{2}:\d{2}$/)) { setMsg("Formato inválido. Usá HH:MM (ej: 09:30)"); return; }
    if (horarios.kinesio.includes(nuevoK)) { setMsg("Ese horario ya existe"); return; }
    const sorted = [...horarios.kinesio, nuevoK].sort();
    saveHorarios({...horarios, kinesio: sorted});
    setNuevoK(""); setMsg("✅ Horario agregado");
  };

  const eliminarK = (h) => {
    if (tieneReservas("kinesio", h)) { setMsg(`⚠️ Hay turnos reservados a las ${h}. Cancelalos primero.`); return; }
    saveHorarios({...horarios, kinesio: horarios.kinesio.filter(x=>x!==h)});
    setMsg("✅ Horario eliminado");
  };

  const agregarA = () => {
    if (!nuevoA.match(/^\d{2}:\d{2}$/)) { setMsg("Formato inválido. Usá HH:MM (ej: 07:30)"); return; }
    if (horarios.analisis.includes(nuevoA)) { setMsg("Ese horario ya existe"); return; }
    const min = toMin2(nuevoA);
    if (min < toMin2("07:00") || min > toMin2("09:00")) { setMsg("⚠️ Análisis solo de 07:00 a 09:00"); return; }
    const sorted = [...horarios.analisis, nuevoA].sort();
    saveHorarios({...horarios, analisis: sorted});
    setNuevoA(""); setMsg("✅ Horario agregado");
  };

  const eliminarA = (h) => {
    if (tieneReservas("analisis_visita", h) || tieneReservas("analisis_buscan", h)) {
      setMsg(`⚠️ Hay turnos reservados a las ${h}. Cancelalos primero.`); return;
    }
    saveHorarios({...horarios, analisis: horarios.analisis.filter(x=>x!==h)});
    setMsg("✅ Horario eliminado");
  };

  return (
    <div>
      {msg && <div style={{background: msg.startsWith("⚠️")?"#1a0a0a":"#0a1a0a", color: msg.startsWith("⚠️")?"#f87171":"#4ade80", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:15}}>{msg}</div>}

      {/* KINESIOLOGÍA */}
      <div style={{background:"#16213e",borderRadius:14,padding:16,marginBottom:16}}>
        <div style={{color:"#60a5fa",fontWeight:"bold",fontSize:17,marginBottom:12}}>🏃 Horarios de Kinesiología</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {(horarios?.kinesio||[]).map(h=>(
            <div key={h} style={{background:"#1a1a2e",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:"#e2e8f0",fontSize:16,fontWeight:"bold"}}>{h}</span>
              <button onClick={()=>eliminarK(h)} style={{background:"#1a0a0a",color:"#f87171",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:13}}>✕</button>
            </div>
          ))}
        </div>
        <FL>Agregar horario (HH:MM)</FL>
        <div style={{display:"flex",gap:8}}>
          <input value={nuevoK} onChange={e=>setNuevoK(e.target.value)} placeholder="ej: 09:30" style={{...IS,marginBottom:0,flex:1}}/>
          <button onClick={agregarK} style={{background:"#1e3a5f",color:"#60a5fa",border:"none",borderRadius:10,padding:"0 16px",cursor:"pointer",fontSize:16,fontWeight:"bold",fontFamily:"Georgia,serif"}}>+</button>
        </div>
      </div>

      {/* ANÁLISIS */}
      <div style={{background:"#16213e",borderRadius:14,padding:16}}>
        <div style={{color:"#f472b6",fontWeight:"bold",fontSize:17,marginBottom:4}}>🔬 Horarios de Análisis Clínicos</div>
        <div style={{color:"#7a9abf",fontSize:13,marginBottom:12}}>Solo entre 07:00 y 09:00</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {(horarios?.analisis||[]).map(h=>(
            <div key={h} style={{background:"#1a1a2e",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:"#e2e8f0",fontSize:16,fontWeight:"bold"}}>{h}</span>
              <button onClick={()=>eliminarA(h)} style={{background:"#1a0a0a",color:"#f87171",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:13}}>✕</button>
            </div>
          ))}
        </div>
        <FL>Agregar horario (HH:MM)</FL>
        <div style={{display:"flex",gap:8}}>
          <input value={nuevoA} onChange={e=>setNuevoA(e.target.value)} placeholder="ej: 08:30" style={{...IS,marginBottom:0,flex:1}}/>
          <button onClick={agregarA} style={{background:"#2d1a2e",color:"#f472b6",border:"none",borderRadius:10,padding:"0 16px",cursor:"pointer",fontSize:16,fontWeight:"bold",fontFamily:"Georgia,serif"}}>+</button>
        </div>
      </div>
    </div>
  );
}


function AdminBloqueos({bloqueos,saveBloqueos}) {
  const [fecha,setFecha]   = useState(hoyISO());
  const [res,setRes]       = useState(RESIDENCIAS[0]);
  const [hi,setHi]         = useState("17:00");
  const [hf,setHf]         = useState("20:00");
  const [motivo,setMotivo] = useState("");
  const [msg,setMsg]       = useState("");

  const activos = (bloqueos||[]).filter(b=>b.estado!=="eliminado").sort((a,b)=>a.fecha>b.fecha?1:-1);

  const agregar = () => {
    if (!motivo.trim()) { setMsg("⚠️ Escribí el motivo del bloqueo"); return; }
    if (toMin(hf) <= toMin(hi)) { setMsg("⚠️ La hora de fin debe ser posterior a la de inicio"); return; }
    const nuevo = {
      id: Date.now().toString(),
      fecha, residencia: res,
      horaInicio: hi, horaFin: hf,
      motivo, estado: "activo",
      creadoEn: new Date().toISOString()
    };
    saveBloqueos([...(bloqueos||[]), nuevo]);
    setMotivo(""); setMsg("✅ Bloqueo creado");
  };

  const eliminar = (id) => {
    if (!confirm("¿Eliminar este bloqueo?")) return;
    saveBloqueos((bloqueos||[]).map(b=>b.id===id?{...b,estado:"eliminado"}:b));
    setMsg("✅ Bloqueo eliminado");
  };

  return (
    <div>
      {msg && <div style={{background:msg.startsWith("⚠️")?"#1a0a0a":"#0a1a0a",color:msg.startsWith("⚠️")?"#f87171":"#4ade80",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:15,border:`1px solid ${msg.startsWith("⚠️")?"#7f1d1d":"#166534"}`}}>{msg}</div>}

      {/* Formulario nuevo bloqueo */}
      <div style={{background:"#16213e",borderRadius:14,padding:16,marginBottom:16,border:"2px solid #334d6e"}}>
        <div style={{color:"#f87171",fontWeight:"bold",fontSize:17,marginBottom:12}}>🚫 Nuevo bloqueo de horario</div>

        <FL>Residencia</FL>
        <select value={res} onChange={e=>setRes(e.target.value)} style={IS}>
          {RESIDENCIAS.map(r=><option key={r} value={r}>{r}</option>)}
        </select>

        <FL>Fecha</FL>
        <input type="date" value={fecha} min={hoyISO()} onChange={e=>setFecha(e.target.value)} style={IS}/>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <FL>Desde</FL>
            <select value={hi} onChange={e=>setHi(e.target.value)} style={IS}>
              {HORAS.map(h=><option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <FL>Hasta</FL>
            <select value={hf} onChange={e=>setHf(e.target.value)} style={IS}>
              {HORAS.filter(h=>toMin(h)>toMin(hi)).map(h=><option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <FL>Motivo (ej: Fiesta de cumpleaños, Actividad grupal)</FL>
        <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ej: Actividad recreativa tarde" style={IS}/>

        <PBtn onClick={agregar}>🚫 Crear bloqueo</PBtn>
      </div>

      {/* Lista de bloqueos activos */}
      <div style={{color:"#94a3b8",fontSize:13,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Bloqueos activos</div>
      {activos.length===0 ? (
        <p style={{color:"#475569",textAlign:"center",padding:30}}>Sin bloqueos activos</p>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {activos.map(b=>(
            <div key={b.id} style={{background:"#16213e",border:"2px solid #7f1d1d",borderLeft:"6px solid #ef4444",borderRadius:"0 12px 12px 0",padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{color:"#f87171",fontWeight:"bold",fontSize:16}}>🚫 {b.motivo}</div>
                  <div style={{color:"#94a3b8",fontSize:14,marginTop:3}}>{b.residencia}</div>
                  <div style={{color:"#64748b",fontSize:13,marginTop:2}}>📅 {fmt(b.fecha)} · {b.horaInicio}–{b.horaFin}</div>
                </div>
                <button onClick={()=>eliminar(b.id)} style={{background:"#1a0a0a",color:"#f87171",border:"1px solid #7f1d1d",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif"}}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
          <div key={r.id} style={{background:"#16213e",borderRadius:12,padding:14,marginBottom:10}}>
            <F val={ed.nombre} onChange={v=>setEd({...ed,nombre:v})} ph="Nombre"/>
            <select value={ed.residencia} onChange={e=>setEd({...ed,residencia:e.target.value})} style={IS}>{RESIDENCIAS.map(x=><option key={x} value={x}>{x}</option>)}</select>
            <div style={{display:"flex",gap:8}}><PBtn onClick={save} style={{flex:1,padding:"9px 0"}}>Guardar</PBtn><GBtn onClick={()=>setEd(null)} style={{flex:1,marginTop:0}}>Cancelar</GBtn></div>
          </div>
        ):(
          <div key={r.id} style={{background:"#16213e",borderRadius:12,padding:14,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:"bold"}}>{r.nombre}</div><div style={{color:"#7a9abf",fontSize:12}}>{r.residencia}</div></div>
            <div style={{display:"flex",gap:8}}>
              <IBtn onClick={()=>setEd({...r})} c="#60a5fa" bg="#0c1f36">✏️</IBtn>
              <IBtn onClick={()=>del(r.id)} c="#f87171" bg="#1a0a0a">🗑️</IBtn>
            </div>
          </div>
        )
      ))}
      {modo?(
        <div style={{background:"#16213e",borderRadius:12,padding:14,marginTop:8}}>
          <FL>Nuevo residente</FL>
          <F val={nv.nombre} onChange={v=>setNv({...nv,nombre:v})} ph="Nombre completo"/>
          <select value={nv.residencia} onChange={e=>setNv({...nv,residencia:e.target.value})} style={IS}>{RESIDENCIAS.map(x=><option key={x} value={x}>{x}</option>)}</select>
          <div style={{display:"flex",gap:8}}><PBtn onClick={add} style={{flex:1,padding:"9px 0"}}>Agregar</PBtn><GBtn onClick={()=>setModo(false)} style={{flex:1,marginTop:0}}>Cancelar</GBtn></div>
        </div>
      ):(
        <button onClick={()=>setModo(true)} style={{width:"100%",padding:14,background:"none",border:"2px dashed #1e293b",color:"#7a9abf",borderRadius:12,cursor:"pointer",fontSize:14,marginTop:4}}>+ Agregar residente</button>
      )}
    </div>
  );
}

function AdminEmail() {
  return (
    <div style={{background:"#16213e",borderRadius:14,padding:20,fontSize:14,lineHeight:1.9}}>
      <div style={{fontSize:28,marginBottom:10}}>📧</div>
      <h3 style={{color:"#60a5fa",fontWeight:"normal",margin:"0 0 10px"}}>Configurar EmailJS</h3>
      <p style={{color:"#b8d4ff",fontSize:13,marginBottom:14}}>Para enviar emails automáticos a los familiares seguí estos pasos:</p>
      {[
        ["1","Creá cuenta gratis en ","emailjs.com"],
        ["2","Agregá un Email Service conectando el email de la residencia"],
        ["3",'Creá 2 Email Templates: "confirmación" y "cancelación"'],
        ["4","Copiá el Service ID, Public Key y los 2 Template IDs"],
        ["5","Pegálos en las primeras líneas del código de la app"],
      ].map(([n,txt,link])=>(
        <div key={n} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}>
          <span style={{background:"#1e3a5f",color:"#60a5fa",borderRadius:8,padding:"2px 8px",fontSize:12,fontWeight:"bold",flexShrink:0}}>{n}</span>
          <span style={{color:"#b8d4ff",fontSize:13}}>{txt}{link&&<a href={`https://${link}`} target="_blank" rel="noreferrer" style={{color:"#60a5fa"}}>{link}</a>}</span>
        </div>
      ))}
      <div style={{borderTop:"1px solid #1e293b",marginTop:14,paddingTop:14}}>
        <div style={{color:"#8ab4d4",fontSize:12,marginBottom:8}}>Variables para tus templates:</div>
        {["to_email","to_name","residente","residencia","tipo","fecha","hora_inicio","hora_fin","motivo","cancelado_por"].map(v=>(
          <code key={v} style={{display:"inline-block",background:"#1a1a2e",color:"#4ade80",borderRadius:6,padding:"2px 8px",fontSize:11,margin:"2px 4px 2px 0"}}>{`{{${v}}}`}</code>
        ))}
      </div>
    </div>
  );
}

// ─── SHARED ───────────────────────────────────────────────────────
function TopBar({title,onBack}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22,paddingTop:8}}>
      <button onClick={onBack} style={{background:"#16213e",border:"1px solid #1e293b",color:"#b8d4ff",borderRadius:10,padding:"8px 13px",cursor:"pointer",fontSize:16}}>‹</button>
      <h2 style={{margin:0,fontSize:26,fontWeight:"bold",color:"#ffffff"}}>{title}</h2>
    </div>
  );
}
function TabBar({tabs,active,setActive}) {
  return (
    <div style={{display:"flex",gap:8,marginBottom:20}}>
      {tabs.map(([id,label])=>(
        <button key={id} onClick={()=>setActive(id)} style={{flex:1,padding:"14px 4px",borderRadius:10,border:"none",cursor:"pointer",fontSize:16,fontWeight:"bold",fontFamily:"Georgia,serif",background:active===id?"#0066ff":"#16213e",color:active===id?"#ffffff":"#a0c4ff"}}>{label}</button>
      ))}
    </div>
  );
}
function DispoMini({turnos,residenteId,fecha}) {
  const list=turnos.filter(t=>t.residenteId===residenteId&&t.fecha===fecha&&t.estado!=="cancelado");
  if (!list.length) return null;
  return (
    <div style={{marginTop:12}}>
      <FL>Turnos ya reservados ese día</FL>
      {list.map(t=>{const tp=TIPOS.find(x=>x.id===t.tipo);return(
        <div key={t.id} style={{background:"#1a1a2e",borderLeft:`3px solid ${tp?.color||"#64748b"}`,borderRadius:"0 8px 8px 0",padding:"5px 10px",marginBottom:4,fontSize:12,display:"flex",justifyContent:"space-between"}}>
          <span>{tp?.icon} {tp?.label}</span><span style={{color:"#8ab4d4"}}>{t.horaInicio}–{t.horaFin}</span>
        </div>
      );})}
    </div>
  );
}
function Resumen({items}) {
  return (
    <div style={{background:"#1a1a2e",border:"1px solid #1e293b",borderRadius:12,padding:14,marginTop:12,fontSize:13,lineHeight:2}}>
      {items.map(([k,v])=><div key={k}><b style={{color:"#8ab4d4"}}>{k}:</b> <span style={{color:"#b8d4ff"}}>{v}</span></div>)}
    </div>
  );
}
function Modal({children,onClose}) {
  return (
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:"#16213e",border:"1px solid #1e293b",borderRadius:16,padding:24,maxWidth:380,width:"100%",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
function Tag({children,c}) {
  return <span style={{background:`${c}33`,color:c,borderRadius:8,padding:"5px 12px",fontSize:14,fontWeight:"bold",whiteSpace:"nowrap",border:`2px solid ${c}66`}}>{children}</span>;
}
function SL({children}) { return <h3 style={{color:"#7eb8ff",fontSize:15,textTransform:"uppercase",letterSpacing:2,margin:"0 0 16px",fontWeight:"bold"}}>{children}</h3>; }
function FL({children}) { return <div style={{color:"#a0c4ff",fontSize:15,textTransform:"uppercase",letterSpacing:1,marginBottom:6,fontWeight:"bold"}}>{children}</div>; }
function ErrBox({children}) { return <div style={{color:"#ff6b6b",background:"#3d0000",border:"2px solid #ff4444",borderRadius:10,padding:14,marginTop:10,fontSize:17,fontWeight:"bold"}}>{children}</div>; }
function PBtn({children,onClick,style={},disabled=false}) {
  const [h,setH]=useState(false);
  return <button onClick={onClick} disabled={disabled} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{width:"100%",padding:"16px 0",background:disabled?"#2a2a3e":h?"#0052cc":"#0066ff",color:disabled?"#475569":"#fff",border:"none",borderRadius:14,cursor:disabled?"not-allowed":"pointer",fontSize:18,fontWeight:"bold",transition:"background 0.15s",display:"block",fontFamily:"Georgia,serif",...style}}>{children}</button>;
}
function GBtn({children,onClick,style={}}) {
  return <button onClick={onClick} style={{width:"100%",padding:"14px 0",background:"none",border:"3px solid #4a9eff",color:"#a0c4ff",borderRadius:14,cursor:"pointer",fontSize:17,fontFamily:"Georgia,serif",marginTop:10,...style}}>{children}</button>;
}
function RBtn({children,onClick,accent}) {
  const [h,setH]=useState(false);
  return <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{background:h?"#1e3a6e":"#16213e",border:`1px solid ${h&&accent?accent+"44":"#1e293b"}`,borderRadius:12,padding:"16px 18px",cursor:"pointer",textAlign:"left",color:"#e2e8f0",display:"flex",alignItems:"center",gap:14,transition:"all 0.15s",width:"100%"}}>{children}<span style={{marginLeft:"auto",color:"#7a9abf",fontSize:22}}>›</span></button>;
}
function IBtn({children,onClick,c,bg}) {
  return <button onClick={onClick} style={{background:bg,color:c,border:"none",borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:13}}>{children}</button>;
}
const IS={width:"100%",background:"#1a1a2e",border:"2px solid #334155",color:"#f1f5f9",borderRadius:12,padding:"14px 16px",fontSize:18,outline:"none",boxSizing:"border-box",marginBottom:12,fontFamily:"Georgia,serif"};
