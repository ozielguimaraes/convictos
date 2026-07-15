import "dotenv/config";
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

const transport = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null;

/* Envia o e-mail de login com o código OTP e o link mágico.
   Sem SMTP configurado (dev), imprime no console do servidor. */
export async function sendLoginEmail(email, code, magicLink) {
  if (!transport) {
    console.log("\n=== LOGIN (SMTP não configurado — modo dev) ===");
    console.log(`Para:   ${email}`);
    console.log(`Código: ${code}`);
    console.log(`Link:   ${magicLink}`);
    console.log("===============================================\n");
    return;
  }
  await transport.sendMail({
    from: SMTP_FROM || "Convictos <no-reply@querc.app>",
    to: email,
    subject: `Seu código de acesso: ${code}`,
    text: `Seu código de acesso é ${code} (expira em 15 minutos).\n\nOu entre direto pelo link:\n${magicLink}\n`,
    html: `
      <p>Seu código de acesso é:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>
      <p>Ou entre direto clicando no botão:</p>
      <p><a href="${magicLink}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:#fff;border-radius:8px;text-decoration:none">Entrar no painel</a></p>
      <p style="color:#888;font-size:12px">O código e o link expiram em 15 minutos.</p>
    `,
  });
}
