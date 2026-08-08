import React, { useState } from "react";

const projects = [
  {
    title: "Casa Nexo",
    type: "Estratégia & E-commerce",
    image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=85",
    span: "md:col-span-8",
  },
  {
    title: "Áurea",
    type: "Identidade & Direção de arte",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85",
    span: "md:col-span-4",
  },
  {
    title: "Forma",
    type: "Produto digital",
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85",
    span: "md:col-span-4",
  },
  {
    title: "Vértice",
    type: "Campanha & Conteúdo",
    image: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1600&q=85",
    span: "md:col-span-8",
  },
];

const services = [
  ["01", "Estratégia de marca", "Posicionamento, narrativa e sistema de decisões para marcas que querem ganhar clareza."],
  ["02", "Identidade visual", "Sistemas vivos de marca, feitos para crescer entre telas, produtos e campanhas."],
  ["03", "Experiências digitais", "Sites e produtos digitais pensados com arquitetura, ritmo e conversão."],
  ["04", "Conteúdo & movimento", "Direção criativa que transforma cada ponto de contato em presença reconhecível."],
];

function Arrow({ className = "" }) {
  return <span aria-hidden="true" className={`inline-block text-lg transition-transform duration-300 group-hover:translate-x-1 ${className}`}>↗</span>;
}

function Home({ onNavigate }) {
  return (
    <section className="qma-enter relative flex min-h-[100dvh] items-center overflow-hidden px-6 py-32 sm:px-8 lg:px-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_43%,rgba(255,255,255,0.12),transparent_25%),radial-gradient(ellipse_at_70%_65%,rgba(255,255,255,0.04),transparent_30%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center text-center">
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.18em] text-white/50">Estúdio independente · Rio de Janeiro</p>
        <h1 className="max-w-5xl font-['Clash_Display',sans-serif] text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-7xl lg:text-8xl" style={{ textWrap: "balance" }}>
          Marcas que ocupam espaço na memória.
        </h1>
        <p className="mt-8 max-w-xl text-base leading-7 text-white/60 sm:text-lg">
          Estratégia, identidade e experiências digitais para negócios que não nasceram para passar despercebidos.
        </p>
        <button
          type="button"
          onClick={() => onNavigate("portfolio")}
          className="group mt-10 inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#050505] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-95"
        >
          Ver projetos <Arrow />
        </button>
        <div className="mt-20 grid w-full max-w-3xl grid-cols-1 gap-4 border-t border-white/10 pt-6 sm:grid-cols-3 sm:gap-8">
          {["Pensamento claro", "Forma precisa", "Impacto real"].map((item) => (
            <p key={item} className="font-mono text-xs uppercase tracking-[0.14em] text-white/40">{item}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Portfolio({ onProject }) {
  return (
    <section className="qma-enter mx-auto min-h-[100dvh] max-w-7xl px-6 pb-20 pt-32 sm:px-8 lg:px-16">
      <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/45">Seleção de trabalhos</p>
          <h2 className="mt-4 font-['Clash_Display',sans-serif] text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">Portfólio</h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-white/50">Projetos com uma ideia em comum: fazer com que cada detalhe sustente uma presença impossível de ignorar.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {projects.map((project) => (
          <button
            key={project.title}
            type="button"
            onClick={() => onProject(project)}
            className={`group relative min-h-80 overflow-hidden rounded-3xl border border-white/10 bg-[#0A0A0A] text-left transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_8px_32px_rgba(255,255,255,0.05)] ${project.span}`}
          >
            <img src={project.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/20 to-transparent" />
            <div className="relative flex h-full min-h-80 flex-col justify-end p-6 sm:p-8">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-white/55">{project.type}</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <h3 className="font-['Clash_Display',sans-serif] text-3xl font-semibold tracking-[-0.03em] text-white">{project.title}</h3>
                <Arrow className="text-white/80" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function Services({ onNavigate }) {
  return (
    <section className="qma-enter mx-auto min-h-[100dvh] max-w-7xl px-6 pb-20 pt-32 sm:px-8 lg:px-16">
      <div className="grid gap-12 lg:grid-cols-[1.618fr_1fr] lg:gap-16">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/45">Capacidades</p>
          <h2 className="mt-4 max-w-xl font-['Clash_Display',sans-serif] text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl" style={{ textWrap: "balance" }}>
            Clareza para criar o próximo movimento.
          </h2>
        </div>
        <div className="border-t border-white/10 pt-6">
          <p className="text-base leading-7 text-white/60">Entramos onde a ambição encontra uma pergunta difícil. Nossa prática integra pensamento estratégico e execução para deixar a marca inteira — não apenas bonita.</p>
          <button type="button" onClick={() => onNavigate("contact")} className="group mt-8 inline-flex min-h-12 items-center gap-3 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition-all duration-300 hover:border-white/40 hover:bg-white/10 active:scale-95">
            Iniciar conversa <Arrow />
          </button>
        </div>
      </div>
      <div className="mt-20 border-t border-white/10">
        {services.map(([number, title, description]) => (
          <article key={number} className="grid gap-4 border-b border-white/5 py-8 transition-colors duration-300 hover:bg-white/[0.03] sm:grid-cols-[80px_1fr_1fr] sm:gap-8 sm:px-4">
            <span className="font-mono text-xs tracking-[0.14em] text-white/35">{number}</span>
            <h3 className="text-xl font-medium text-white/90">{title}</h3>
            <p className="max-w-md text-sm leading-6 text-white/50">{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Preencha os três campos para enviar sua mensagem.");
      setStatus("idle");
      return;
    }
    setError("");
    setStatus("loading");
    window.setTimeout(() => setStatus("success"), 1200);
  };

  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none shadow-inner placeholder:text-white/25 transition-all duration-300 focus:border-white/30 focus:ring-1 focus:ring-white/30";
  return (
    <section className="qma-enter mx-auto flex min-h-[100dvh] max-w-5xl items-center px-6 py-32 sm:px-8 lg:px-16">
      <div className="grid w-full gap-12 lg:grid-cols-[1fr_1.25fr] lg:gap-16">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/45">Contato</p>
          <h2 className="mt-4 font-['Clash_Display',sans-serif] text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl" style={{ textWrap: "balance" }}>Vamos construir algo que tenha peso.</h2>
          <p className="mt-6 max-w-sm text-base leading-7 text-white/55">Conte o que está mudando no seu negócio e nós voltamos para começar a desenhar o caminho.</p>
        </div>
        <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-8" noValidate>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <label className="text-sm text-white/70">Nome
              <input name="name" value={form.name} onChange={updateField} autoComplete="name" className={inputClass} placeholder="Como podemos chamar você?" />
            </label>
            <label className="text-sm text-white/70">E-mail
              <input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" className={inputClass} placeholder="voce@empresa.com" />
            </label>
            <label className="text-sm text-white/70 sm:col-span-2">Mensagem
              <textarea name="message" value={form.message} onChange={updateField} rows="6" className={`${inputClass} resize-none`} placeholder="Qual é o desafio que merece atenção agora?" />
            </label>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-white/65">{error}</p>}
          {status === "success" && <p role="status" className="mt-4 text-sm text-white/75">Mensagem recebida. Vamos responder em breve.</p>}
          <button type="submit" disabled={status === "loading" || status === "success"} className="group mt-8 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#050505] transition-all duration-300 hover:scale-[1.01] active:scale-95 disabled:cursor-not-allowed disabled:opacity-55">
            {status === "loading" ? "Enviando mensagem…" : status === "success" ? "Mensagem enviada" : <>Enviar mensagem <Arrow /></>}
          </button>
        </form>
      </div>
    </section>
  );
}

export default function PikaPrototype() {
  const [activeTab, setActiveTab] = useState("home");
  const [selectedProject, setSelectedProject] = useState(null);
  const tabs = [["home", "Início"], ["portfolio", "Projetos"], ["services", "Serviços"], ["contact", "Contato"]];
  const navigate = (tab) => { setSelectedProject(null); setActiveTab(tab); };

  const content = {
    home: <Home onNavigate={navigate} />,
    portfolio: <Portfolio onProject={setSelectedProject} />,
    services: <Services onNavigate={navigate} />,
    contact: <Contact />,
  };

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#050505] font-['Inter',sans-serif] text-white selection:bg-white selection:text-[#050505]">
      <style>{`@keyframes qmaEnter{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.qma-enter{animation:qmaEnter 500ms cubic-bezier(.16,1,.3,1) both}`}</style>
      <nav aria-label="Navegação principal" className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-2 shadow-2xl backdrop-blur-xl sm:px-3">
        <img src="/assets/logo-tp.svg" alt="ALDEIA" className="ml-1 hidden h-5 w-auto sm:block" />
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => navigate(id)} aria-current={activeTab === id ? "page" : undefined} className={`min-h-10 rounded-full px-3 text-xs font-medium transition-all duration-300 sm:px-4 sm:text-sm ${activeTab === id ? "bg-white/10 text-white" : "text-white/55 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </nav>
      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">{content[activeTab]}</div>
      {selectedProject && (
        <div role="dialog" aria-modal="true" aria-labelledby="project-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-[#050505]/85 p-6 backdrop-blur-md" onMouseDown={() => setSelectedProject(null)}>
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#0A0A0A] p-6 shadow-2xl sm:p-8" onMouseDown={(event) => event.stopPropagation()}>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-white/45">{selectedProject.type}</p>
            <h2 id="project-title" className="mt-4 font-['Clash_Display',sans-serif] text-4xl font-semibold tracking-[-0.04em]">{selectedProject.title}</h2>
            <p className="mt-4 text-sm leading-6 text-white/55">Uma prévia do estudo de caso. A versão completa será apresentada em uma conversa com o estúdio.</p>
            <div className="mt-8 flex gap-3">
              <button type="button" onClick={() => { setSelectedProject(null); navigate("contact"); }} className="min-h-12 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#050505] transition-transform duration-300 active:scale-95">Falar sobre um projeto</button>
              <button type="button" onClick={() => setSelectedProject(null)} className="min-h-12 rounded-full border border-white/15 px-6 py-3 text-sm text-white/70 transition-colors hover:bg-white/10">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
