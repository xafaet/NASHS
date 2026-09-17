import crypto from 'crypto';
import QRCode from 'qrcode';
import { db } from '../db';
import { EntryToken, Registration } from '../../src/types';

export class TokenService {
  /**
   * Generates a cryptographically secure, high-entropy unique token code
   * Format: NASH-85-2027-XXXXXX (e.g. NASH-85-2027-H9K3P2)
   */
  static generateSecureTokenCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude ambiguous characters like 0/O, 1/I
    let randomPart = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      randomPart += chars[bytes[i] % chars.length];
    }
    return `NASH-85-2027-${randomPart}`;
  }

  /**
   * Generate an Entry Token with QR Code for a confirmed registration
   */
  static async issueToken(registration: Registration): Promise<EntryToken> {
    const tokens = db.get('tokens');
    
    // Check if token already exists for this registration
    const existing = tokens.find(t => t.registration_id === registration.id);
    if (existing) {
      return existing;
    }

    let tokenCode = this.generateSecureTokenCode();
    // Ensure uniqueness
    while (tokens.some(t => t.token_code === tokenCode)) {
      tokenCode = this.generateSecureTokenCode();
    }

    const verificationUrl = `${process.env.APP_URL || ''}/verify?token=${tokenCode}`;
    
    // Generate QR code as SVG data URL
    let qrSvg = '';
    try {
      qrSvg = await QRCode.toString(verificationUrl, {
        type: 'svg',
        margin: 1,
        color: {
          dark: '#0f4d2a',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('Failed to generate QR Code SVG:', err);
    }

    const token: EntryToken = {
      id: `tok-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      token_code: tokenCode,
      registration_id: registration.id,
      event_id: registration.event_id,
      member_name: registration.full_name,
      batch_name: registration.batch_name,
      batch_name_bn: registration.batch_name_bn,
      status: 'active',
      qr_code_svg: qrSvg,
      checked_in: false,
      created_at: new Date().toISOString(),
    };

    tokens.push(token);
    db.set('tokens', tokens);

    return token;
  }

  /**
   * Public verification logic - sanitized, no private PII leaks
   */
  static verifyToken(tokenCode: string): {
    isValid: boolean;
    token?: {
      code: string;
      alumni_name: string;
      batch: string;
      batch_bn?: string;
      event_title: string;
      event_title_bn: string;
      event_date: string;
      venue: string;
      venue_bn: string;
      status: string;
      checked_in: boolean;
      checked_in_at?: string;
      registered_date: string;
    };
    message?: string;
  } {
    const cleanCode = (tokenCode || '').trim().toUpperCase();
    const tokens = db.get('tokens');
    const token = tokens.find(t => (t.token_code || '').toUpperCase() === cleanCode);

    if (!token) {
      return { isValid: false, message: 'Invalid or unrecognized token code.' };
    }

    const events = db.get('events');
    const event = events.find(e => e.id === token.event_id) || events[0];

    return {
      isValid: true,
      token: {
        code: token.token_code,
        alumni_name: token.member_name,
        batch: token.batch_name,
        batch_bn: token.batch_name_bn,
        event_title: event ? event.title_en : '85th Anniversary Celebration',
        event_title_bn: event ? event.title_bn : '৮৫ বছর পূর্তি উৎসব',
        event_date: event ? event.event_date : '2027-01-16',
        venue: event ? event.venue_en : 'Nanupur Abu Sobhan High School Premises',
        venue_bn: event ? event.venue_bn : 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাঙ্গণ',
        status: token.status,
        checked_in: token.checked_in,
        checked_in_at: token.checked_in_at,
        registered_date: token.created_at,
      }
    };
  }

  /**
   * Detailed Gate Entrance Verification:
   * Supports lookup by Entry Token Code, Registered Mobile Number, or Registration ID.
   * DOES NOT automatically mark checked-in.
   */
  static verifyGateAttendee(rawIdentifier: string): {
    found: boolean;
    canCheckIn: boolean;
    status: 'ELIGIBLE' | 'ALREADY_CHECKED_IN' | 'UNPAID' | 'CANCELLED' | 'NOT_FOUND';
    matchedBy: 'token' | 'phone' | 'registration_id' | null;
    message: string;
    member?: {
      full_name: string;
      phone: string;
      email?: string;
      batch_name: string;
      batch_name_bn?: string;
      passing_year: number;
      blood_group?: string;
      photo_url?: string;
      occupation?: string;
    };
    registration?: {
      id: string;
      event_id: string;
      fee_amount: number;
      currency: string;
      payment_status: string;
      payment_method?: string;
      registration_status: string;
      created_at: string;
    };
    token?: {
      id: string;
      token_code: string;
      status: string;
      qr_code_svg?: string;
      checked_in: boolean;
      checked_in_at?: string;
      checked_in_by?: string;
      gate?: string;
      verification_method?: string;
    };
    event?: {
      title_en: string;
      title_bn: string;
      event_date: string;
      venue_en: string;
      venue_bn: string;
    };
  } {
    const input = (rawIdentifier || '').trim();
    if (!input) {
      return {
        found: false,
        canCheckIn: false,
        status: 'NOT_FOUND',
        matchedBy: null,
        message: 'Please enter an Entry Token Code or Registered Mobile Number.',
      };
    }

    const cleanInput = input.toUpperCase();
    const cleanPhone = input.replace(/[\s-]/g, '');

    const registrations = db.get('registrations') || [];
    const tokens = db.get('tokens') || [];
    const events = db.get('events') || [];

    let matchedReg: Registration | undefined;
    let matchedToken: EntryToken | undefined;
    let matchedBy: 'token' | 'phone' | 'registration_id' | null = null;

    // 1. Try matching by Token Code
    matchedToken = tokens.find(t => 
      (t.token_code || '').toUpperCase() === cleanInput ||
      (t.token_code || '').toUpperCase().endsWith(cleanInput)
    );

    if (matchedToken) {
      matchedBy = 'token';
      matchedReg = registrations.find(r => r.id === matchedToken!.registration_id);
    }

    // 2. Try matching by Phone Number
    if (!matchedReg && cleanPhone.length >= 8) {
      matchedReg = registrations.find(r => 
        (r.phone || '').replace(/[\s-]/g, '') === cleanPhone ||
        (r.phone || '').endsWith(cleanPhone)
      );
      if (matchedReg) {
        matchedBy = 'phone';
        matchedToken = tokens.find(t => t.registration_id === matchedReg!.id);
      }
    }

    // 3. Try matching by Registration ID
    if (!matchedReg) {
      matchedReg = registrations.find(r => (r.id || '').toUpperCase() === cleanInput);
      if (matchedReg) {
        matchedBy = 'registration_id';
        matchedToken = tokens.find(t => t.registration_id === matchedReg!.id);
      }
    }

    if (!matchedReg && !matchedToken) {
      return {
        found: false,
        canCheckIn: false,
        status: 'NOT_FOUND',
        matchedBy: null,
        message: `No record found for "${input}". Please check the token code or registered mobile number.`,
      };
    }

    // Resolve member details
    const fullName = matchedReg?.full_name || matchedToken?.member_name || 'Alumni Member';
    const phone = matchedReg?.phone || '';
    const email = matchedReg?.email;
    const batchName = matchedReg?.batch_name || matchedToken?.batch_name || 'Alumni';
    const batchNameBn = matchedReg?.batch_name_bn || matchedToken?.batch_name_bn;
    const passingYear = matchedReg?.passing_year || 2008;
    const paymentStatus = matchedReg?.payment_status || (matchedToken ? 'paid' : 'pending');
    const isCheckedIn = !!(matchedToken?.checked_in || matchedReg?.checked_in);
    const checkedInAt = matchedToken?.checked_in_at || matchedReg?.checked_in_at;
    const tokenStatus = matchedToken?.status || (paymentStatus === 'paid' ? 'active' : 'inactive');

    const event = events.find(e => e.id === (matchedReg?.event_id || matchedToken?.event_id)) || events[0];

    // Determine eligibility
    if (matchedReg?.registration_status === 'cancelled' || tokenStatus === 'cancelled' || tokenStatus === 'revoked') {
      return {
        found: true,
        canCheckIn: false,
        status: 'CANCELLED',
        matchedBy,
        message: 'This registration or token has been CANCELLED or REVOKED.',
        member: { full_name: fullName, phone, email, batch_name: batchName, batch_name_bn: batchNameBn, passing_year: passingYear, blood_group: matchedReg?.blood_group, photo_url: matchedReg?.photo_url, occupation: matchedReg?.occupation },
        registration: matchedReg ? { id: matchedReg.id, event_id: matchedReg.event_id, fee_amount: matchedReg.fee_amount, currency: matchedReg.currency, payment_status: paymentStatus, payment_method: matchedReg.payment_method, registration_status: matchedReg.registration_status, created_at: matchedReg.created_at } : undefined,
        token: matchedToken ? { id: matchedToken.id, token_code: matchedToken.token_code, status: tokenStatus, qr_code_svg: matchedToken.qr_code_svg, checked_in: isCheckedIn, checked_in_at: checkedInAt } : undefined,
      };
    }

    if (paymentStatus !== 'paid') {
      return {
        found: true,
        canCheckIn: false,
        status: 'UNPAID',
        matchedBy,
        message: `Payment is UNPAID (Status: ${paymentStatus.toUpperCase()}). Gate check-in is NOT permitted until payment is verified.`,
        member: { full_name: fullName, phone, email, batch_name: batchName, batch_name_bn: batchNameBn, passing_year: passingYear, blood_group: matchedReg?.blood_group, photo_url: matchedReg?.photo_url, occupation: matchedReg?.occupation },
        registration: matchedReg ? { id: matchedReg.id, event_id: matchedReg.event_id, fee_amount: matchedReg.fee_amount, currency: matchedReg.currency, payment_status: paymentStatus, payment_method: matchedReg.payment_method, registration_status: matchedReg.registration_status, created_at: matchedReg.created_at } : undefined,
        token: matchedToken ? { id: matchedToken.id, token_code: matchedToken.token_code, status: tokenStatus, qr_code_svg: matchedToken.qr_code_svg, checked_in: isCheckedIn, checked_in_at: checkedInAt } : undefined,
      };
    }

    if (isCheckedIn) {
      const timeStr = checkedInAt ? new Date(checkedInAt).toLocaleTimeString() : 'Earlier';
      return {
        found: true,
        canCheckIn: false,
        status: 'ALREADY_CHECKED_IN',
        matchedBy,
        message: `ALREADY CHECKED IN at ${timeStr}. Duplicate entry rejected for security.`,
        member: { full_name: fullName, phone, email, batch_name: batchName, batch_name_bn: batchNameBn, passing_year: passingYear, blood_group: matchedReg?.blood_group, photo_url: matchedReg?.photo_url, occupation: matchedReg?.occupation },
        registration: matchedReg ? { id: matchedReg.id, event_id: matchedReg.event_id, fee_amount: matchedReg.fee_amount, currency: matchedReg.currency, payment_status: paymentStatus, payment_method: matchedReg.payment_method, registration_status: matchedReg.registration_status, created_at: matchedReg.created_at } : undefined,
        token: matchedToken ? { id: matchedToken.id, token_code: matchedToken.token_code, status: tokenStatus, qr_code_svg: matchedToken.qr_code_svg, checked_in: true, checked_in_at: checkedInAt } : undefined,
      };
    }

    // ELIGIBLE FOR CHECK-IN
    return {
      found: true,
      canCheckIn: true,
      status: 'ELIGIBLE',
      matchedBy,
      message: 'Verified successfully! Alumni record is authentic and eligible for gate entrance check-in.',
      member: {
        full_name: fullName,
        phone,
        email,
        batch_name: batchName,
        batch_name_bn: batchNameBn,
        passing_year: passingYear,
        blood_group: matchedReg?.blood_group,
        photo_url: matchedReg?.photo_url,
        occupation: matchedReg?.occupation,
      },
      registration: matchedReg ? {
        id: matchedReg.id,
        event_id: matchedReg.event_id,
        fee_amount: matchedReg.fee_amount,
        currency: matchedReg.currency,
        payment_status: paymentStatus,
        payment_method: matchedReg.payment_method,
        registration_status: matchedReg.registration_status,
        created_at: matchedReg.created_at,
      } : undefined,
      token: matchedToken ? {
        id: matchedToken.id,
        token_code: matchedToken.token_code,
        status: tokenStatus,
        qr_code_svg: matchedToken.qr_code_svg,
        checked_in: false,
      } : undefined,
      event: {
        title_en: event ? event.title_en : '85th Anniversary Celebration',
        title_bn: event ? event.title_bn : '৮৫ বছর পূর্তি উৎসব',
        event_date: event ? event.event_date : '2027-01-16',
        venue_en: event ? event.venue_en : 'Nanupur Abu Sobhan High School Premises',
        venue_bn: event ? event.venue_bn : 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাঙ্গণ',
      }
    };
  }

  /**
   * Event-Day Gate Check-In: Explicitly records check-in action
   */
  static checkIn(
    identifier: string,
    operatorName: string = 'Gate Officer',
    gateName: string = 'Gate 1 (Main Entrance)',
    verificationMethod: string = 'Token Number'
  ): {
    success: boolean;
    alreadyCheckedIn: boolean;
    token?: EntryToken;
    record?: any;
    message: string;
  } {
    // Run verification first
    const verification = this.verifyGateAttendee(identifier);

    if (!verification.found) {
      return {
        success: false,
        alreadyCheckedIn: false,
        message: verification.message,
      };
    }

    if (verification.status === 'UNPAID') {
      return {
        success: false,
        alreadyCheckedIn: false,
        message: 'Cannot check in: Registration is UNPAID.',
      };
    }

    if (verification.status === 'ALREADY_CHECKED_IN') {
      return {
        success: false,
        alreadyCheckedIn: true,
        message: verification.message,
      };
    }

    if (verification.status === 'CANCELLED') {
      return {
        success: false,
        alreadyCheckedIn: false,
        message: 'Cannot check in: Registration or Token is CANCELLED.',
      };
    }

    const now = new Date().toISOString();
    const tokens = db.get('tokens') || [];
    const registrations = db.get('registrations') || [];

    // Find and update token
    const tokenCode = verification.token?.token_code;
    const tokenIndex = tokens.findIndex(t => t.token_code === tokenCode);

    if (tokenIndex !== -1) {
      tokens[tokenIndex].checked_in = true;
      tokens[tokenIndex].checked_in_at = now;
      tokens[tokenIndex].status = 'used';
      db.set('tokens', tokens);
    }

    // Find and update registration
    const regId = verification.registration?.id;
    const regIndex = registrations.findIndex(r => r.id === regId);
    if (regIndex !== -1) {
      registrations[regIndex].checked_in = true;
      registrations[regIndex].checked_in_at = now;
      db.set('registrations', registrations);
    }

    // Record in check_in_logs table
    const checkInRecord = {
      id: `chk-${Date.now()}`,
      token_code: tokenCode || 'N/A',
      registration_id: regId || 'N/A',
      event_id: verification.registration?.event_id || 'event-85th-anniversary',
      member_name: verification.member?.full_name || 'Alumni Member',
      phone: verification.member?.phone || '',
      batch_name: verification.member?.batch_name || '',
      checked_in_at: now,
      operator_name: operatorName,
      gate_name: gateName,
      verification_method: verificationMethod,
      notes: `Entrance granted at ${gateName} by ${operatorName} via ${verificationMethod}`,
    };

    // Save to check_in_logs in db
    const existingLogs = (db as any).get('check_in_logs') || [];
    existingLogs.unshift(checkInRecord);
    (db as any).set('check_in_logs', existingLogs);

    // Save to audit logs
    db.logAudit(
      operatorName,
      'gatekeeper@nanupuralumni.org',
      'GATE_CHECK_IN',
      'EntryToken',
      `Gate check-in recorded for ${verification.member?.full_name} (${verification.member?.batch_name}). Token: ${tokenCode}, Gate: ${gateName}, Method: ${verificationMethod}`
    );

    return {
      success: true,
      alreadyCheckedIn: false,
      token: tokenIndex !== -1 ? tokens[tokenIndex] : undefined,
      record: checkInRecord,
      message: `Check-in recorded successfully for ${verification.member?.full_name}! Welcome to the 85th Anniversary Celebration.`,
    };
  }
}
