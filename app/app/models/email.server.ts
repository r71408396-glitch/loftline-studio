// Production updates to customers. Shopify can't send custom emails for an
// app, so the app sends them itself over SMTP (SMTP_URL, e.g.
// smtp://user:pass@smtp.example.com:587). Without SMTP_URL nothing is sent and
// the stage change still goes through.
import nodemailer from 'nodemailer';

let transport: nodemailer.Transporter | null | undefined;

function getTransport() {
  if (transport === undefined) transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  return transport;
}

export async function sendCustomerEmail(to: string | null | undefined, subject: string, text: string): Promise<boolean> {
  const smtp = getTransport();
  if (!smtp || !to) return false;
  await smtp.sendMail({
    from: process.env.MAIL_FROM || 'Loftline Studio <hello@loftline.studio>',
    to,
    subject,
    text,
  });
  return true;
}
