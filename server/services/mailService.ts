import nodemailer, { Transporter } from 'nodemailer';
import { db } from '../db';
import { Registration, EntryToken, MailSettings } from '../../src/types';

export const initialMailSettings: MailSettings = {
  mail_driver: (process.env.MAIL_DRIVER as any) || 'smtp',
  smtp_host: process.env.MAIL_HOST || 'smtp.gmail.com',
  smtp_port: parseInt(process.env.MAIL_PORT || '587', 10),
  smtp_encryption: (process.env.MAIL_ENCRYPTION as any) || 'tls',
  smtp_username: process.env.MAIL_USERNAME || '',
  smtp_password: process.env.MAIL_PASSWORD || '',
  from_email: process.env.MAIL_FROM_ADDRESS || 'reunion@nanupuralumni.org',
  from_name: process.env.MAIL_FROM_NAME || 'Nanupur Abu Sobhan High School Alumni Association',
  reply_to: process.env.MAIL_REPLY_TO || 'info@nanupuralumni.org',
  timeout: 10000,
  email_notifications_enabled: true,
  templates: {
    confirmation_subject_en: 'Official Entry Pass & Registration Confirmation — 85th Anniversary Alumni Reunion',
    confirmation_subject_bn: '৮৫ বছর পূর্তি উৎসব ও পুনর্মিলনী: অফিশিয়াল প্রবেশ পাস ও নিবন্ধন নিশ্চিতকরণ',
    confirmation_body_en: 'Congratulations! Your manual payment has been verified by the alumni finance committee. Your event registration is now officially confirmed.',
    confirmation_body_bn: 'অভিনন্দন! আপনার পেমেন্ট সফলভাবে যাচাই করা হয়েছে এবং আপনার পুনর্মিলনী নিবন্ধন আনুষ্ঠানিকভাবে নিশ্চিত করা হয়েছে।',
  },
};

export class MailService {
  private static cachedTransporter: Transporter | null = null;
  private static cachedConfigHash: string = '';

  /**
   * Retrieve active mail settings from database (or fall back to defaults)
   */
  public static getSettings(maskPassword: boolean = false): MailSettings {
    const raw = db.get('mail_settings');
    const settings: MailSettings = {
      ...initialMailSettings,
      ...(raw || {}),
      templates: {
        ...initialMailSettings.templates,
        ...(raw?.templates || {}),
      },
    };

    if (maskPassword && settings.smtp_password) {
      settings.smtp_password = '••••••••';
    }

    return settings;
  }

  /**
   * Save updated mail settings to database
   */
  public static updateSettings(newSettings: Partial<MailSettings>, adminUser?: { name?: string; email?: string }): MailSettings {
    const current = this.getSettings(false);
    
    // Preserve password if sent as masked or empty
    let updatedPassword = current.smtp_password;
    if (newSettings.smtp_password !== undefined && newSettings.smtp_password.trim() !== '' && newSettings.smtp_password !== '••••••••') {
      updatedPassword = newSettings.smtp_password.trim();
    }

    const updated: MailSettings = {
      ...current,
      ...newSettings,
      smtp_password: updatedPassword,
      smtp_port: Number(newSettings.smtp_port) || current.smtp_port || 587,
      timeout: Number(newSettings.timeout) || current.timeout || 10000,
      templates: {
        ...current.templates,
        ...(newSettings.templates || {}),
      },
    };

    db.set('mail_settings', updated);
    this.cachedTransporter = null; // Invalidate transporter

    db.logAudit(
      adminUser?.name || 'Admin',
      adminUser?.email || 'admin@nanupuralumni.org',
      'UPDATE_MAIL_SETTINGS',
      'MailSettings',
      `Updated email configuration (Driver: ${updated.mail_driver}, Host: ${updated.smtp_host}:${updated.smtp_port}, From: ${updated.from_email})`
    );

    return this.getSettings(true);
  }

  /**
   * Build or retrieve active Nodemailer transporter
   */
  public static getTransporter(customSettings?: MailSettings): Transporter {
    const settings = customSettings || this.getSettings(false);
    const hash = `${settings.mail_driver}:${settings.smtp_host}:${settings.smtp_port}:${settings.smtp_encryption}:${settings.smtp_username}:${settings.smtp_password}`;

    if (!customSettings && this.cachedTransporter && this.cachedConfigHash === hash) {
      return this.cachedTransporter;
    }

    const isSecure = settings.smtp_port === 465 || settings.smtp_encryption === 'ssl';
    
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: isSecure,
      auth: settings.smtp_username
        ? {
            user: settings.smtp_username,
            pass: settings.smtp_password || '',
          }
        : undefined,
      connectionTimeout: settings.timeout || 10000,
      greetingTimeout: settings.timeout || 10000,
      socketTimeout: settings.timeout || 10000,
      tls: {
        rejectUnauthorized: false, // Prevent cert errors in custom enterprise mail servers
      },
    });

    if (!customSettings) {
      this.cachedTransporter = transporter;
      this.cachedConfigHash = hash;
    }

    return transporter;
  }

  /**
   * Test email delivery configuration
   */
  public static async sendTestEmail(
    toEmail: string,
    overrideSettings?: MailSettings
  ): Promise<{ success: boolean; message: string; details?: any }> {
    if (!toEmail || !toEmail.includes('@')) {
      return { success: false, message: 'Please provide a valid recipient email address.' };
    }

    const settings = overrideSettings || this.getSettings(false);

    try {
      const transporter = this.getTransporter(settings);

      // Verify SMTP connection handshake first
      await transporter.verify();

      const info = await transporter.sendMail({
        from: `"${settings.from_name}" <${settings.from_email}>`,
        to: toEmail,
        replyTo: settings.reply_to || settings.from_email,
        subject: `[Test] Nanupur Alumni Platform Email Configuration Test (${new Date().toLocaleTimeString()})`,
        text: `Hello,\n\nThis is a test email sent from the Nanupur Abu Sobhan High School Alumni Association Platform.\n\nYour SMTP settings (${settings.smtp_host}:${settings.smtp_port}) are working correctly and ready for automated delivery.\n\nTime: ${new Date().toISOString()}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <div style="background: #0f4d2a; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
              <h2 style="color: #ffffff; margin: 0; font-size: 18px;">NANUPUR ABU SOBHAN HIGH SCHOOL</h2>
              <p style="color: #fde68a; margin: 4px 0 0 0; font-size: 12px;">ALUMNI ASSOCIATION • 85TH ANNIVERSARY</p>
            </div>
            <h3 style="color: #0f172a; margin-top: 0;">✓ Email Delivery System Test Successful</h3>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              This confirmation test verifies that your SMTP mail settings are properly configured and operational.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
              <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; width: 140px;">SMTP Server</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${settings.smtp_host}:${settings.smtp_port}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Encryption</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${settings.smtp_encryption.toUpperCase()}</td></tr>
              <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">From Address</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${settings.from_email}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Timestamp</td><td style="padding: 8px; border: 1px solid #e2e8f0;">${new Date().toLocaleString()}</td></tr>
            </table>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
              Sent via Nanupur Abu Sobhan High School Alumni Platform • Fatikchhari, Chattogram
            </p>
          </div>
        `,
      });

      return {
        success: true,
        message: `Test email successfully delivered to ${toEmail}. Message ID: ${info.messageId || 'OK'}`,
        details: { messageId: info.messageId, response: info.response },
      };
    } catch (err: any) {
      console.error('MailService.sendTestEmail error:', err);
      let errorMsg = err.message || 'SMTP delivery failed';
      if (err.code === 'EAUTH') {
        errorMsg = 'SMTP Authentication failed. Check your username and password or application password.';
      } else if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT') {
        errorMsg = `Connection to ${settings.smtp_host}:${settings.smtp_port} timed out. Verify host, port, and firewall rules.`;
      } else if (err.code === 'EENVELOPE') {
        errorMsg = 'Invalid envelope address. Check the sender or recipient email.';
      }
      return {
        success: false,
        message: errorMsg,
        details: { code: err.code, response: err.response, command: err.command },
      };
    }
  }

  /**
   * Automatically email official PDF entry pass & bilingual confirmation after payment verification
   */
  public static async sendRegistrationConfirmationEmail(
    registration: Registration,
    token: EntryToken,
    pdfBuffer: Buffer
  ): Promise<{ success: boolean; messageId?: string; simulated?: boolean; error?: string }> {
    if (!registration.email || !registration.email.includes('@')) {
      console.log(`[MailService] No valid recipient email address for ${registration.full_name} (${registration.id}). Skipping email dispatch.`);
      return { success: false, error: 'Registrant email is not provided' };
    }

    const settings = this.getSettings(false);
    if (!settings.email_notifications_enabled) {
      console.log('[MailService] Email notifications are disabled in settings. Skipping.');
      return { success: false, error: 'Email notifications disabled' };
    }

    const tokenCode = token.token_code || registration.token_code;
    const year = registration.passing_year || (token as any).passing_year;
    const toBn = (n: number | string) => n.toString().replace(/\d/g, (d: string) => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
    const batchName = year ? `SSC Batch ${year}` : (registration.batch_name || token.batch_name || 'Alumni');
    const batchNameBn = year ? `এসএসসি ব্যাচ ${toBn(year)}` : (registration.batch_name_bn || token.batch_name_bn || '');
    const eventDate = 'Saturday, 16 January 2027 • 08:00 AM onwards (শনিবার, ১৬ জানুয়ারি ২০২৭)';
    const venue = 'Nanupur Abu Sobhan High School Premises, Fatikchhari, Chattogram (নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাঙ্গণ)';
    const gateInfo = 'Gate 01 - Main Gate (VIP, Alumni & Delegates)';

    const subject = `[Confirmed] 85th Anniversary Official Entry Pass & Registration Confirmation — ${tokenCode}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
    <!-- Header Ribbon -->
    <tr>
      <td style="background-color: #0f4d2a; padding: 28px 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">
          NANUPUR ABU SOBHAN HIGH SCHOOL
        </h1>
        <p style="color: #fde68a; margin: 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
          ALUMNI ASSOCIATION (ESTD. 1942)
        </p>
        <div style="background-color: #d97706; height: 3px; width: 60px; margin: 14px auto 0 auto; border-radius: 2px;"></div>
        <p style="color: #ffffff; margin: 12px 0 0 0; font-size: 15px; font-weight: 700;">
          ৮৫ বছর পূর্তি উৎসব ও পুনর্মিলনী ২০২৭
        </p>
      </td>
    </tr>

    <!-- Status Banner -->
    <tr>
      <td style="background-color: #ecfdf5; border-bottom: 1px solid #a7f3d0; padding: 14px 24px; text-align: center;">
        <span style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
          ✓ PAYMENT VERIFIED & REGISTRATION CONFIRMED
        </span>
        <p style="color: #065f46; font-size: 13px; font-weight: 600; margin: 6px 0 0 0;">
          পেমেন্ট সফলভাবে যাচাইকৃত ও নিবন্ধন নিশ্চিত করা হয়েছে
        </p>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding: 28px 28px 12px 28px;">
        <p style="font-size: 16px; line-height: 1.6; color: #1e293b; margin: 0 0 16px 0;">
          Dear <strong>${registration.full_name}</strong> (প্রিয় <strong>${registration.full_name}</strong>),
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
          We are pleased to inform you that your registration payment for the <strong>85th Anniversary Celebration & Grand Alumni Reunion</strong> has been reviewed and approved by the Alumni Secretariat.
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #475569; margin: 0 0 24px 0; background-color: #f8fafc; padding: 12px 16px; border-left: 4px solid #0f4d2a; border-radius: 4px;">
          ঐতিহ্যবাহী নানুপুর আবু সোবহান উচ্চ বিদ্যালয়ের গৌরবময় ৮৫ বছর পূর্তি উৎসব ও পুনর্মিলনীতে আপনার অংশগ্রহণ নিশ্চিত করা হয়েছে। আপনার অফিশিয়াল পিডিএফ প্রবেশ পাসটি এই ইমেলের সাথে সংযুক্ত করা হলো।
        </p>

        <!-- Pass Highlights Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fafaf9; border: 2px dashed #cbd5e1; border-radius: 12px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="6" style="font-size: 13px;">
                <tr>
                  <td style="color: #64748b; font-weight: 600; width: 40%;">Official Token Number:</td>
                  <td style="color: #0f4d2a; font-weight: 800; font-family: monospace; font-size: 16px;">${tokenCode}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600;">Registrant Name:</td>
                  <td style="color: #0f172a; font-weight: 700;">${registration.full_name}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600;">Batch:</td>
                  <td style="color: #0f172a; font-weight: 700;">${batchName} ${batchNameBn ? `(${batchNameBn})` : ''}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600;">T-Shirt Size:</td>
                  <td style="color: #0f172a; font-weight: 700;">${registration.t_shirt_size || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600;">Event Date:</td>
                  <td style="color: #0f172a; font-weight: 700;">${eventDate}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600;">Venue:</td>
                  <td style="color: #0f172a; font-weight: 700;">${venue}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600;">Assigned Gate:</td>
                  <td style="color: #0f172a; font-weight: 700;">${gateInfo}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 600;">Amount Paid:</td>
                  <td style="color: #059669; font-weight: 800;">৳${registration.paid_amount || registration.fee_amount || 1000} BDT (PAID)</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Instructions for the Event Day -->
        <h3 style="color: #0f172a; font-size: 15px; font-weight: 700; margin: 0 0 10px 0;">
          Important Instructions for the Event Day (অনুষ্ঠান দিবসের নির্দেশনা):
        </h3>
        <ul style="color: #475569; font-size: 13px; line-height: 1.7; padding-left: 20px; margin: 0 0 24px 0;">
          <li><strong>Attached PDF Pass:</strong> Your official printable PDF Entry Pass is attached to this email. Please print it out or keep the QR code ready on your mobile screen.</li>
          <li><strong>Entry Verification:</strong> At the entrance, present your QR code pass to the security & gate verification volunteers for instant barcode check-in.</li>
          <li><strong>Delegate Kit Collection:</strong> Upon successful QR verification, proceed to your designated batch registration counter to collect your event badge, souvenir bag, customized T-shirt, and food tokens.</li>
          <li><strong>Online Verification:</strong> You can also verify your token live at any time by visiting: <a href="https://nanupuralumni.org/verify?token=${encodeURIComponent(tokenCode)}" style="color: #0f4d2a; text-decoration: underline;">https://nanupuralumni.org/verify</a>.</li>
        </ul>

        <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin-bottom: 24px; text-align: center;">
          <p style="color: #92400e; font-size: 13px; font-weight: 600; margin: 0;">
            প্রবেশ পথে দ্রুত চেকিং এর জন্য সংযুক্ত পিডিএফ পাসটি প্রিন্ট করে অথবা মোবাইলে সাথে রাখুন।
          </p>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.6;">
        <p style="margin: 0 0 4px 0; font-weight: 700; color: #334155;">
          Nanupur Abu Sobhan High School Alumni Association
        </p>
        <p style="margin: 0 0 8px 0;">
          Nanupur, Fatikchhari, Chattogram 4350, Bangladesh • Hotline: +880 1819-123456
        </p>
        <p style="margin: 0;">
          Questions? Reply directly to this email or visit <a href="https://nanupuralumni.org" style="color: #0f4d2a; text-decoration: none; font-weight: 600;">nanupuralumni.org</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const plainTextContent = `
NANUPUR ABU SOBHAN HIGH SCHOOL ALUMNI ASSOCIATION
85th Anniversary Celebration & Grand Alumni Reunion 2027

Dear ${registration.full_name},

Congratulations! Your registration payment for the 85th Anniversary Celebration has been verified and confirmed.

Official Token Number: ${tokenCode}
Registrant: ${registration.full_name}
Batch: ${batchName}
T-Shirt Size: ${registration.t_shirt_size || 'N/A'}
Event Date: ${eventDate}
Venue: ${venue}
Status: Confirmed & Paid (৳${registration.paid_amount || registration.fee_amount || 1000} BDT)

Your official PDF Entry Pass is attached to this email. Please print it or save it to your phone to present at the entry gate for QR scanning and badge collection.

Online Verification: https://nanupuralumni.org/verify?token=${encodeURIComponent(tokenCode)}

We look forward to welcoming you home!

Nanupur Abu Sobhan High School Alumni Secretariat
Nanupur, Fatikchhari, Chattogram
    `.trim();

    try {
      // If SMTP credentials are not configured or invalid, log safely and simulate
      const hasSmtpConfig = settings.smtp_host && settings.smtp_username && settings.smtp_password;
      
      if (!hasSmtpConfig) {
        console.log(`[MailService] SMTP not fully configured in settings. Simulating automated email delivery to ${registration.email}.`);
        db.logAudit(
          'Automated Mailer',
          registration.email,
          'SEND_CONFIRMATION_EMAIL_SIMULATED',
          'Registration',
          `Simulated confirmation email delivery with PDF pass attachment (${tokenCode}) to ${registration.email} (SMTP unconfigured).`
        );
        return {
          success: true,
          simulated: true,
          messageId: `simulated-${Date.now()}`,
        };
      }

      const transporter = this.getTransporter(settings);

      const mailOptions = {
        from: `"${settings.from_name}" <${settings.from_email}>`,
        to: registration.email,
        replyTo: settings.reply_to || settings.from_email,
        subject,
        text: plainTextContent,
        html: htmlContent,
        attachments: [
          {
            filename: `Registration_Pass_${tokenCode}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      };

      const info = await transporter.sendMail(mailOptions);

      console.log(`[MailService] Confirmation email and PDF successfully dispatched to ${registration.email}. Message ID: ${info.messageId}`);
      db.logAudit(
        'Automated Mailer',
        registration.email,
        'REGISTRATION_EMAIL_SENT',
        'Registration',
        `Automated confirmation email with PDF pass attachment (${tokenCode}) dispatched to ${registration.email}. MessageId: ${info.messageId || 'OK'}`
      );

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err: any) {
      console.error('[MailService] Failed to send confirmation email:', err.message);
      db.logAudit(
        'Automated Mailer',
        registration.email,
        'REGISTRATION_EMAIL_FAILED',
        'Registration',
        `Email dispatch failed for ${registration.email} (${tokenCode}): ${err.message}`
      );
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
