/* ===== CONVICTOS — grade pública de patrocinadores (raiz) ===== */
import React, { useState, useEffect } from "react";
import { api } from "../lib/api.js";

// Fire-and-forget: nunca deve travar a navegação do visitante.
function track(path, body) {
  fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
}

function waLink(whatsapp) {
  const digits = whatsapp.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}
function igLink(instagram) {
  if (instagram.startsWith("http")) return instagram;
  return `https://instagram.com/${instagram.replace(/^@/, "")}`;
}
function mapsLink(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// Ícones oficiais em SVG inline (sem CDN externo) — glifo do simple-icons,
// com o fundo na identidade visual atual de cada marca.
function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#FEDA75" />
          <stop offset="25%" stopColor="#FA7E1E" />
          <stop offset="50%" stopColor="#D62976" />
          <stop offset="75%" stopColor="#962FBF" />
          <stop offset="100%" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6.5" fill="url(#ig-grad)" />
      <path
        fill="#fff"
        d="M12 6.4a5.6 5.6 0 100 11.2 5.6 5.6 0 000-11.2zm0 9.24a3.64 3.64 0 110-7.28 3.64 3.64 0 010 7.28zM17.9 6.19a1.31 1.31 0 11-2.61 0 1.31 1.31 0 012.61 0zM21.94 7.6c-.09-1.88-.52-3.55-1.9-4.92-1.37-1.38-3.04-1.81-4.92-1.9C13.2.68 10.8.68 8.88.78c-1.88.09-3.55.52-4.92 1.9C2.58 4.05 2.15 5.72 2.06 7.6-.04 9.52.06 11.92.16 13.84c.09 1.88.52 3.55 1.9 4.92 1.37 1.38 3.04 1.81 4.92 1.9 1.92.1 4.32.1 6.24 0 1.88-.09 3.55-.52 4.92-1.9 1.38-1.37 1.81-3.04 1.9-4.92.1-1.92.1-4.32 0-6.24zm-2.3 10.02a3.79 3.79 0 01-2.14 2.14c-1.48.59-4.99.45-6.62.45s-5.15.13-6.62-.45a3.79 3.79 0 01-2.14-2.14c-.59-1.48-.45-4.99-.45-6.62s-.13-5.15.45-6.62A3.79 3.79 0 015.32 2.4c1.48-.59 4.99-.45 6.62-.45s5.15-.13 6.62.45a3.79 3.79 0 012.14 2.14c.59 1.48.45 4.99.45 6.62s.14 5.15-.45 6.62z"
      />
    </svg>
  );
}
function IconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" role="img" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path
        fill="#fff"
        d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.4-1.48-.88-.78-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.19.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.34z"
      />
      <path
        fill="#fff"
        d="M12.05 2.4c-5.32 0-9.65 4.32-9.65 9.65 0 1.7.45 3.36 1.3 4.82L2.4 21.6l4.9-1.28a9.63 9.63 0 004.73 1.21h.01c5.32 0 9.65-4.32 9.65-9.65 0-2.58-1-5-2.83-6.82a9.6 9.6 0 00-6.82-2.83zm0 17.66h-.01a8 8 0 01-4.08-1.12l-.29-.17-3.03.8.81-2.96-.19-.3a8.02 8.02 0 01-1.23-4.27c0-4.43 3.6-8.03 8.03-8.03a7.99 7.99 0 015.68 2.35 7.98 7.98 0 012.35 5.68c0 4.43-3.61 8.02-8.04 8.02z"
      />
    </svg>
  );
}

function sponsorContacts(s) {
  const contacts = [];
  if (s.url) contacts.push({ kind: "click_site", href: s.url, icon: "🌐", label: "Site" });
  if (s.whatsapp) contacts.push({ kind: "click_whatsapp", href: waLink(s.whatsapp), icon: <IconWhatsApp />, label: "WhatsApp", brand: "whatsapp" });
  if (s.phone) contacts.push({ kind: "click_phone", href: `tel:${s.phone.replace(/\s+/g, "")}`, icon: "☎️", label: "Telefone" });
  if (s.instagram) contacts.push({ kind: "click_instagram", href: igLink(s.instagram), icon: <IconInstagram />, label: "Instagram", brand: "instagram" });
  if (s.address) contacts.push({ kind: "click_address", href: mapsLink(s.address), icon: "📍", label: "Endereço" });
  return contacts;
}

export default function App() {
  const [state, setState] = useState({ status: "loading", sponsors: null, links: [] });

  useEffect(() => {
    track("/api/visits", { path: "/" });
    Promise.all([api.get("/api/sponsors"), api.get("/api/profile")])
      .then(([sponsors, profile]) => {
        setState({ status: "ready", sponsors, links: profile.links || [] });
        if (sponsors.length > 0) track("/api/sponsors/views", { ids: sponsors.map((s) => s.id) });
      })
      .catch(() => setState({ status: "error", sponsors: null, links: [] }));
  }, []);

  if (state.status === "loading") {
    return <div className="sp-page"><div className="state-msg">Carregando…</div></div>;
  }
  if (state.status === "error") {
    return (
      <div className="sp-page">
        <div className="state-msg"><span className="e-emoji">⚠️</span>Não foi possível carregar a página.</div>
      </div>
    );
  }

  const { sponsors, links } = state;

  return (
    <div className="sp-page">
      <header className="sp-header">
        <h1 className="sp-title">Patrocinadores</h1>
        <p className="sp-subtitle">Empresas e pessoas que apoiam esse propósito 🙌</p>
      </header>

      {links.length > 0 && (
        <nav className="sp-nav">
          {links.map((l) => (
            <a
              key={l.id}
              className="sp-pill"
              href={l.url}
              target={l.url.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
            >
              {l.emoji ? <span>{l.emoji} </span> : null}{l.label}
            </a>
          ))}
        </nav>
      )}

      {sponsors.length === 0 ? (
        <div className="state-msg"><span className="e-emoji">🤝</span>Nenhum patrocinador cadastrado ainda.</div>
      ) : (
        <div className="sp-grid">
          {sponsors.map((s) => {
            const contacts = sponsorContacts(s);
            return (
              <div key={s.id} className={"sp-card plan-" + s.plan}>
                {s.banner ? (
                  <img className="sp-banner" src={s.banner} alt={s.name} />
                ) : s.emoji ? (
                  <span className="sp-emoji">{s.emoji}</span>
                ) : null}
                <span className="sp-name">{s.name}</span>
                {contacts.length > 0 && (
                  <div className="sp-contacts">
                    {contacts.map((c) => (
                      <a
                        key={c.kind}
                        className={"sp-contact" + (c.brand ? " brand-" + c.brand : "")}
                        href={c.href}
                        target={c.kind === "click_phone" ? undefined : "_blank"}
                        rel="noreferrer"
                        title={c.label}
                        aria-label={c.label}
                        onClick={() => track(`/api/sponsors/${s.id}/click`, { kind: c.kind })}
                      >
                        {c.icon}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
