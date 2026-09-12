import apiClient from './client';
import i18n from '../i18n';
import type {
  Balance,
  C2cReceiptState,
  C2cReceiptSubmitPayload,
  C2cSession,
  Transaction,
  PaymentMethod,
  PaginatedResponse,
  PendingPayment,
  ManualCheckResponse,
  SavedCardsResponse,
} from '../types';

export const balanceApi = {
  // Get current balance
  getBalance: async (): Promise<Balance> => {
    const response = await apiClient.get<Balance>('/cabinet/balance');
    return response.data;
  },

  // Get transaction history
  getTransactions: async (params?: {
    page?: number;
    per_page?: number;
    type?: string;
  }): Promise<PaginatedResponse<Transaction>> => {
    const response = await apiClient.get<PaginatedResponse<Transaction>>(
      '/cabinet/balance/transactions',
      {
        params,
      },
    );
    return response.data;
  },

  // Get available payment methods
  getPaymentMethods: async (): Promise<PaymentMethod[]> => {
    const response = await apiClient.get<PaymentMethod[]>('/cabinet/balance/payment-methods');
    return response.data;
  },

  // Create top-up payment
  createTopUp: async (
    amountKopeks: number,
    paymentMethod: string,
    paymentOption?: string,
  ): Promise<{
    payment_id: string;
    payment_url: string;
    amount_kopeks: number;
    amount_rubles: number;
    status: string;
    expires_at: string | null;
  }> => {
    const payload: {
      amount_kopeks: number;
      payment_method: string;
      payment_option?: string;
      language?: string;
    } = {
      amount_kopeks: amountKopeks,
      payment_method: paymentMethod,
    };
    if (paymentOption) {
      payload.payment_option = paymentOption;
    }
    payload.language = i18n.language || 'ru';
    const response = await apiClient.post('/cabinet/balance/topup', payload);
    return response.data;
  },

  // Activate promo code
  activatePromocode: async (
    code: string,
    subscriptionId?: number,
  ): Promise<{
    success: boolean;
    message?: string;
    balance_before?: number;
    balance_after?: number;
    bonus_description?: string | null;
    error?: string;
    eligible_subscriptions?: Array<{ id: number; tariff_name: string; days_left: number }>;
    code?: string;
  }> => {
    const response = await apiClient.post('/cabinet/promocode/activate', {
      code,
      ...(subscriptionId ? { subscription_id: subscriptionId } : {}),
    });
    return response.data;
  },

  // Create Telegram Stars invoice for Mini App balance top-up
  createStarsInvoice: async (
    amountKopeks: number,
  ): Promise<{
    invoice_url: string;
    stars_amount?: number;
    amount_kopeks?: number;
  }> => {
    const response = await apiClient.post('/cabinet/balance/stars-invoice', {
      amount_kopeks: amountKopeks,
    });
    return response.data;
  },

  // Get pending payments for manual verification
  getPendingPayments: async (params?: {
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<PendingPayment>> => {
    const response = await apiClient.get<PaginatedResponse<PendingPayment>>(
      '/cabinet/balance/pending-payments',
      {
        params,
      },
    );
    return response.data;
  },

  // Get specific pending payment details
  getPendingPayment: async (method: string, paymentId: number): Promise<PendingPayment> => {
    const response = await apiClient.get<PendingPayment>(
      `/cabinet/balance/pending-payments/${encodeURIComponent(method)}/${encodeURIComponent(paymentId)}`,
    );
    return response.data;
  },

  // Get latest pending payment by method (fallback when sessionStorage unavailable)
  getLatestPayment: async (method: string): Promise<PendingPayment> => {
    const response = await apiClient.get<PendingPayment>(
      `/cabinet/balance/pending-payments/${encodeURIComponent(method)}/latest`,
    );
    return response.data;
  },

  // Manually check payment status
  checkPaymentStatus: async (method: string, paymentId: number): Promise<ManualCheckResponse> => {
    const response = await apiClient.post<ManualCheckResponse>(
      `/cabinet/balance/pending-payments/${encodeURIComponent(method)}/${encodeURIComponent(paymentId)}/check`,
    );
    return response.data;
  },

  // Get saved payment methods (cards) for recurrent payments
  getSavedCards: async (): Promise<SavedCardsResponse> => {
    const response = await apiClient.get<SavedCardsResponse>('/cabinet/balance/saved-cards');
    return response.data;
  },

  // Unlink (delete) a saved payment method
  deleteSavedCard: async (id: number): Promise<void> => {
    await apiClient.delete(`/cabinet/balance/saved-cards/${id}`);
  },

  // Card-to-card: assign a card and hold the user's single pending receipt (amount on the wire scale)
  c2cStartSession: async (amountKopeks: number): Promise<C2cSession> => {
    const response = await apiClient.post<C2cSession>('/cabinet/balance/c2c/session', {
      amount_kopeks: amountKopeks,
    });
    return response.data;
  },

  // Card-to-card: attach the uploaded receipt image and/or a note, forwarded for review
  c2cSubmitReceipt: async (payload: C2cReceiptSubmitPayload): Promise<C2cReceiptState> => {
    const response = await apiClient.post<C2cReceiptState>('/cabinet/balance/c2c/receipt', payload);
    return response.data;
  },

  // Card-to-card: the pending receipt (null when none), or — with receiptId — that receipt in any status
  c2cGetCurrent: async (receiptId?: number): Promise<C2cReceiptState | null> => {
    const response = await apiClient.get<C2cReceiptState | ''>('/cabinet/balance/c2c/current', {
      params: receiptId ? { receipt_id: receiptId } : undefined,
    });
    return response.status === 204 || !response.data ? null : response.data;
  },

  // Card-to-card: cancel a pending receipt that has nothing attached yet
  c2cCancel: async (receiptId: number): Promise<C2cReceiptState> => {
    const response = await apiClient.post<C2cReceiptState>('/cabinet/balance/c2c/cancel', {
      receipt_id: receiptId,
    });
    return response.data;
  },
};
