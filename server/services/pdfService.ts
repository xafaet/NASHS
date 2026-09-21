import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface PassPDFData {
  tokenCode: string;
  fullName: string;
  batchName: string;
  batchNameBn?: string;
  passingYear?: number | string;
  registrationId?: string;
  bloodGroup?: string;
  tShirtSize?: string;
  occupation?: string;
  phone?: string;
  eventDate?: string;
  venue?: string;
  gateName?: string;
  status?: string;
  issuedAt?: string;
}

export async function generateEntryPassPDF(data: PassPDFData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 36, bottom: 36, left: 36, right: 36 },
        info: {
          Title: `NASH-85th-Reunion-Pass-${data.tokenCode}`,
          Author: 'Nanupur Abu Sobhan High School Alumni Association',
          Subject: '85th Anniversary Official Entry Pass',
          Keywords: 'Alumni, Reunion, Pass, Token, 85th Anniversary',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const verificationUrl = `${process.env.APP_URL || 'https://nanupuralumni.org'}/verify?token=${encodeURIComponent(data.tokenCode)}`;
      let qrBuffer: Buffer;
      try {
        qrBuffer = await QRCode.toBuffer(verificationUrl, {
          type: 'png',
          width: 240,
          margin: 1,
          color: {
            dark: '#0f4d2a',
            light: '#ffffff',
          },
        });
      } catch (err) {
        qrBuffer = await QRCode.toBuffer(data.tokenCode, { type: 'png', width: 240, margin: 1 });
      }

      const pageWidth = 595.28; // standard A4 pt
      const margin = 36;
      const contentWidth = pageWidth - margin * 2; // 523.28

      // Outer Card Frame
      doc
        .roundedRect(margin, margin, contentWidth, 750, 12)
        .lineWidth(2)
        .strokeColor('#d97706')
        .stroke();

      // Top Header Ribbon (Emerald)
      doc
        .roundedRect(margin + 2, margin + 2, contentWidth - 4, 110, 10)
        .fillColor('#0f4d2a')
        .fill();

      // Header Gold Accent Bar
      doc
        .rect(margin + 2, margin + 110, contentWidth - 4, 6)
        .fillColor('#d97706')
        .fill();

      // School Name in Header
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(16)
        .text('NANUPUR ABU SOBHAN HIGH SCHOOL', margin, margin + 18, {
          width: contentWidth,
          align: 'center',
        });

      doc
        .fillColor('#fde68a')
        .font('Helvetica')
        .fontSize(11)
        .text('ALUMNI ASSOCIATION (ESTD. 1942)', margin, margin + 40, {
          width: contentWidth,
          align: 'center',
        });

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('85th Anniversary Celebration & Grand Alumni Reunion 2027', margin, margin + 60, {
          width: contentWidth,
          align: 'center',
        });

      doc
        .fillColor('#a7f3d0')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('OFFICIAL DIGITAL ENTRY PASS • NON-TRANSFERABLE', margin, margin + 86, {
          width: contentWidth,
          align: 'center',
        });

      // Main Pass Body Container
      let y = margin + 130;

      // Left Column: Attendee Details
      const leftColX = margin + 20;
      const leftColW = 310;
      const rightColX = margin + 350;
      const rightColW = 150;

      // Name
      doc
        .fillColor('#64748b')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('ATTENDEE FULL NAME', leftColX, y);

      doc
        .fillColor('#0f172a')
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(data.fullName || 'Registered Alumni Member', leftColX, y + 12);

      if (data.occupation) {
        doc
          .fillColor('#0f4d2a')
          .font('Helvetica')
          .fontSize(9)
          .text(data.occupation, leftColX, y + 32);
      }

      // Batch & Passing Year Box
      const batchY = y + 50;
      doc
        .roundedRect(leftColX, batchY, leftColW, 58, 6)
        .fillColor('#f8fafc')
        .fill()
        .strokeColor('#e2e8f0')
        .lineWidth(1)
        .stroke();

      doc
        .fillColor('#64748b')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('ALUMNI BATCH & GENERATION', leftColX + 12, batchY + 10);

      doc
        .fillColor('#0f4d2a')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(data.batchName || 'General Alumni', leftColX + 12, batchY + 22);

      const passYearStr = data.passingYear ? `SSC Year: ${data.passingYear}` : '';
      const bloodStr = data.bloodGroup ? ` • Blood: ${data.bloodGroup}` : '';
      const tshirtStr = data.tShirtSize ? ` • T-Shirt: ${data.tShirtSize}` : '';
      doc
        .fillColor('#475569')
        .font('Helvetica')
        .fontSize(9)
        .text(`${passYearStr}${bloodStr}${tshirtStr}`, leftColX + 12, batchY + 40);

      // Registration ID & Token Code Box
      const tokenY = batchY + 68;
      doc
        .roundedRect(leftColX, tokenY, leftColW, 64, 6)
        .fillColor('#fef3c7')
        .fill()
        .strokeColor('#f59e0b')
        .lineWidth(1.5)
        .stroke();

      doc
        .fillColor('#92400e')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('SECURITY PASS TOKEN NUMBER', leftColX + 12, tokenY + 8);

      doc
        .fillColor('#78350f')
        .font('Courier-Bold')
        .fontSize(15)
        .text(data.tokenCode, leftColX + 12, tokenY + 22);

      if (data.registrationId) {
        doc
          .fillColor('#b45309')
          .font('Helvetica')
          .fontSize(8)
          .text(`Reg. ID: ${data.registrationId}`, leftColX + 12, tokenY + 44);
      }

      // Gate Assignment
      const gateY = tokenY + 74;
      doc
        .roundedRect(leftColX, gateY, leftColW, 46, 6)
        .fillColor('#ecfdf5')
        .fill()
        .strokeColor('#10b981')
        .lineWidth(1)
        .stroke();

      doc
        .fillColor('#065f46')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('DESIGNATED ENTRY GATE', leftColX + 12, gateY + 8);

      doc
        .fillColor('#047857')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(data.gateName || 'Gate 01 - Main Gate', leftColX + 12, gateY + 22);

      // Right Column: QR Code & Verification Status
      // QR Code Box
      doc
        .roundedRect(rightColX, y, rightColW, 195, 8)
        .fillColor('#ffffff')
        .fill()
        .strokeColor('#0f4d2a')
        .lineWidth(2)
        .stroke();

      // QR Code Image
      doc.image(qrBuffer, rightColX + 15, y + 15, { width: 120, height: 120 });

      // Scan instruction
      doc
        .fillColor('#0f4d2a')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('SCAN AT THE GATE', rightColX, y + 142, {
          width: rightColW,
          align: 'center',
        });

      doc
        .fillColor('#64748b')
        .font('Helvetica')
        .fontSize(7)
        .text('Encrypted Token Pass', rightColX, y + 154, {
          width: rightColW,
          align: 'center',
        });

      // Verification Badge Box
      doc
        .roundedRect(rightColX + 10, y + 168, rightColW - 20, 20, 10)
        .fillColor('#059669')
        .fill();

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('PAYMENT VERIFIED', rightColX + 10, y + 174, {
          width: rightColW - 20,
          align: 'center',
        });

      // Event Details Banner
      const eventDetailsY = y + 258;
      doc
        .roundedRect(margin + 20, eventDetailsY, contentWidth - 40, 56, 6)
        .fillColor('#f1f5f9')
        .fill()
        .strokeColor('#cbd5e1')
        .lineWidth(1)
        .stroke();

      doc
        .fillColor('#475569')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('DATE & TIME:', margin + 35, eventDetailsY + 12)
        .font('Helvetica')
        .text(data.eventDate || 'Saturday, 16 January 2027 • 08:00 AM onwards', margin + 110, eventDetailsY + 12);

      doc
        .fillColor('#475569')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('VENUE:', margin + 35, eventDetailsY + 32)
        .font('Helvetica')
        .text(data.venue || 'Nanupur Abu Sobhan High School Premises, Fatikchhari, Chattogram', margin + 110, eventDetailsY + 32);

      // Gate Instructions / Security Notice
      const rulesY = eventDetailsY + 70;
      doc
        .roundedRect(margin + 20, rulesY, contentWidth - 40, 115, 6)
        .fillColor('#fafafa')
        .fill()
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .stroke();

      doc
        .fillColor('#0f4d2a')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('IMPORTANT SECURITY & ATTENDANCE GUIDELINES', margin + 35, rulesY + 10);

      const rules = [
        '1. Present this official printed pass or show the digital PDF on your mobile device upon arrival.',
        '2. This QR code token is unique to you and authorizes single-person admission at the gate scanner.',
        '3. Please carry a photo ID (NID, Passport, or Alumni Verification card) for smooth gate check-in.',
        '4. Gates open at 08:00 AM sharp. Breakfast and reunion gift packages will be distributed at designated booths.',
        '5. Duplication, falsification, or unauthorized sharing of this entry pass constitutes grounds for admission revocation.',
      ];

      let ruleY = rulesY + 28;
      doc.fillColor('#334155').font('Helvetica').fontSize(7.5);
      rules.forEach(rule => {
        doc.text(rule, margin + 35, ruleY, { width: contentWidth - 70 });
        ruleY += 16;
      });

      // Bottom Signature & Verification Seal
      const footerY = rulesY + 128;
      doc
        .rect(margin + 2, footerY, contentWidth - 4, 38)
        .fillColor('#0f172a')
        .fill();

      doc
        .fillColor('#94a3b8')
        .font('Helvetica')
        .fontSize(7)
        .text(
          `Security Token: ${data.tokenCode} • Issued by NASH Alumni Executive Committee • Generated: ${new Date().toISOString()}`,
          margin + 10,
          footerY + 10,
          { width: contentWidth - 20, align: 'center' }
        );

      doc
        .fillColor('#f59e0b')
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text('FOR ANY ENTRY ASSISTANCE CONTACT ALUMNI DESK: +880 1819-123456 / info@nanupuralumni.org', margin + 10, footerY + 22, {
          width: contentWidth - 20,
          align: 'center',
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
