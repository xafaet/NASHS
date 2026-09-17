import { db } from '../db';
import { Batch, BatchConfig } from '../../src/types';

export class BatchService {
  /**
   * Determine or dynamically calculate the batch based on passing year
   * and admin configured rules.
   * Known reference: 2008 = 65th Batch
   * Formula: Batch Number = reference_batch + (Passing Year - reference_year)
   */
  static getBatchByPassingYear(passingYear: number): {
    batch_id: string;
    batch_name: string;
    batch_name_bn: string;
    batch_number: number;
    is_overridden: boolean;
    override_reason?: string;
  } {
    const config: BatchConfig = db.get('batch_config') || {
      reference_year: 2008,
      reference_batch: 65,
      formula_description: 'Batch = 65 + (Passing Year - 2008)',
      naming_format: 'batch_number',
      overrides: [],
    };

    // 1. Check if an administrative manual override exists
    const override = (config.overrides || []).find(o => o.passing_year === passingYear);
    if (override) {
      return {
        batch_id: `batch-${passingYear}`,
        batch_name: override.batch_name_en,
        batch_name_bn: override.batch_name_bn,
        batch_number: override.override_batch_number,
        is_overridden: true,
        override_reason: override.reason,
      };
    }

    // 2. Dynamic formula calculation
    const refYear = config.reference_year || 2008;
    const refBatch = config.reference_batch || 65;
    const batchNumber = refBatch + (passingYear - refYear);

    const getOrdinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const toBnNumerals = (n: number | string) =>
      n.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);

    const name_en = `${getOrdinal(batchNumber)} Batch (${passingYear})`;
    const name_bn = `${toBnNumerals(batchNumber)}তম ব্যাচ (${toBnNumerals(passingYear)})`;
    const id = `batch-${passingYear}`;

    // Ensure a batch entity is tracked in the batches collection
    const batches: Batch[] = db.get('batches') || [];
    let batchItem = batches.find(b => b.passing_year === passingYear);
    if (!batchItem) {
      batchItem = {
        id,
        name_en,
        name_bn,
        passing_year: passingYear,
        batch_number: batchNumber,
        registration_count: 0,
        is_active: true,
      };
      batches.push(batchItem);
      db.set('batches', batches);
    }

    return {
      batch_id: id,
      batch_name: name_en,
      batch_name_bn: name_bn,
      batch_number: batchNumber,
      is_overridden: false,
    };
  }

  static getAllBatches(): (Batch & { is_overridden?: boolean; override_reason?: string })[] {
    const batches = db.get('batches') || [];
    const registrations = db.get('registrations') || [];
    const config: BatchConfig = db.get('batch_config') || {
      reference_year: 2008,
      reference_batch: 65,
      formula_description: 'Batch = 65 + (Passing Year - 2008)',
      naming_format: 'batch_number',
      overrides: [],
    };

    return batches
      .map(batch => {
        const count = registrations.filter(
          (r: any) => r.passing_year === batch.passing_year && r.payment_status === 'paid'
        ).length;
        const override = (config.overrides || []).find(o => o.passing_year === batch.passing_year);
        return {
          ...batch,
          name_en: override ? override.batch_name_en : batch.name_en,
          name_bn: override ? override.batch_name_bn : batch.name_bn,
          batch_number: override ? override.override_batch_number : batch.batch_number,
          registration_count: count,
          is_overridden: !!override,
          override_reason: override ? override.reason : undefined,
        };
      })
      .sort((a, b) => b.passing_year - a.passing_year);
  }
}
