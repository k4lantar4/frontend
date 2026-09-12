import apiClient from './client';
import type { C2cReceiptStatus } from '../types';

/**
 * Card-to-card receipt review (`/cabinet/admin/c2c-receipts`). Display amounts come in the
 * `*_toman` fields; `amount_kopeks` is the frozen x100 wire scale and is never shown.
 */

export type C2cStatusFilter = 'all' | C2cReceiptStatus;

export interface C2cReceiptUser {
  id: number;
  telegram_id: number | null;
  username: string | null;
  full_name: string | null;
  email: string | null;
}

export interface C2cReceiptReviewer {
  user_id: number | null;
  telegram_id: number | null;
  label: string | null;
  via: 'bot' | 'cabinet' | null;
}

export interface C2cReceiptAdminItem {
  id: number;
  status: C2cReceiptStatus;
  amount_kopeks: number;
  amount_toman: number;
  approved_amount_toman: number | null;
  card_label: string | null;
  receipt_type: string | null;
  has_receipt: boolean;
  created_at: string;
  processed_at: string | null;
  expires_at: string | null;
  user: C2cReceiptUser;
  reviewer: C2cReceiptReviewer;
  rejection_reason_key: string | null;
  rejection_reason: string | null;
}

export interface C2cReceiptAdminDetail extends C2cReceiptAdminItem {
  receipt_media_file_id: string | null;
  receipt_media_token: string | null;
  receipt_text: string | null;
  transaction_id: number | null;
  user_balance_toman: number;
  card_number_masked: string | null;
}

export interface C2cReceiptListResponse {
  items: C2cReceiptAdminItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface C2cReceiptStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  cancelled: number;
}

export interface C2cRejectReason {
  code: string;
  label: string;
}

/** ISO datetimes; `date_to` is exclusive. */
export interface C2cReceiptStatsParams {
  search?: string;
  date_from?: string;
  date_to?: string;
}

export interface C2cReceiptListParams extends C2cReceiptStatsParams {
  status: C2cStatusFilter;
  page: number;
  per_page: number;
}

/** Omit `amount_kopeks` to credit the requested amount. */
export interface C2cApprovePayload {
  amount_kopeks?: number;
}

export interface C2cRejectPayload {
  reason_key: string;
  comment?: string;
}

const BASE = '/cabinet/admin/c2c-receipts';

export const adminC2cReceiptsApi = {
  list: async (params: C2cReceiptListParams): Promise<C2cReceiptListResponse> => {
    const response = await apiClient.get<C2cReceiptListResponse>(BASE, { params });
    return response.data;
  },

  stats: async (params: C2cReceiptStatsParams): Promise<C2cReceiptStats> => {
    const response = await apiClient.get<C2cReceiptStats>(`${BASE}/stats`, { params });
    return response.data;
  },

  get: async (receiptId: number): Promise<C2cReceiptAdminDetail> => {
    const response = await apiClient.get<C2cReceiptAdminDetail>(`${BASE}/${receiptId}`);
    return response.data;
  },

  rejectReasons: async (): Promise<C2cRejectReason[]> => {
    const response = await apiClient.get<C2cRejectReason[]>(`${BASE}/reject-reasons`);
    return response.data;
  },

  approve: async (
    receiptId: number,
    payload: C2cApprovePayload,
  ): Promise<C2cReceiptAdminDetail> => {
    const response = await apiClient.post<C2cReceiptAdminDetail>(
      `${BASE}/${receiptId}/approve`,
      payload,
    );
    return response.data;
  },

  reject: async (receiptId: number, payload: C2cRejectPayload): Promise<C2cReceiptAdminDetail> => {
    const response = await apiClient.post<C2cReceiptAdminDetail>(
      `${BASE}/${receiptId}/reject`,
      payload,
    );
    return response.data;
  },
};

/** Query keys shared by the list and the detail, so a decision refreshes both. */
export const c2cReceiptKeys = {
  all: ['admin-c2c-receipts'] as const,
  detail: (receiptId: number) => ['admin-c2c-receipts', 'detail', receiptId] as const,
  rejectReasons: ['admin-c2c-receipts', 'reject-reasons'] as const,
};
