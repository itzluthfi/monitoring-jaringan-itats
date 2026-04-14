import nodemailer from 'nodemailer';

const {
  SMTP_HOST = 'smtp.gmail.com',
  SMTP_PORT = '465',
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM_NAME = 'Monitoring Jaringan ITATS',
} = process.env;

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP_USER / SMTP_PASS belum dikonfigurasi di .env');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT),
      secure: SMTP_PORT === '465', // true for port 465
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendOtpEmail(toEmail: string, username: string, otp: string): Promise<void> {
  const mailer = getTransporter();
  const subject = `[${SMTP_FROM_NAME}] Kode OTP Reset Password`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #18181b; color: #e4e4e7; border-radius: 16px; padding: 32px; border: 1px solid #3f3f46;">
      <h2 style="color: #818cf8; margin-bottom: 8px;">🔐 Reset Password</h2>
      <p style="color: #a1a1aa; margin-bottom: 24px;">Halo <strong style="color: #fff">${username}</strong>, berikut adalah kode OTP untuk mereset password Anda:</p>
      <div style="background: #1e1e2e; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid #6366f1; margin-bottom: 24px;">
        <span style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #818cf8;">${otp}</span>
      </div>
      <p style="color: #71717a; font-size: 13px;">⏰ Kode ini berlaku selama <strong>15 menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
      <p style="color: #52525b; font-size: 12px; margin-top: 32px; border-top: 1px solid #27272a; padding-top: 16px;">
        Email ini dikirim otomatis oleh sistem <strong>${SMTP_FROM_NAME}</strong>. Abaikan jika Anda tidak meminta reset password.
      </p>
    </div>
  `;

  await mailer.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
    to: toEmail,
    subject,
    html,
  });
}
