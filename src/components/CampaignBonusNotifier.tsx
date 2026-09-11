import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { useCurrency } from '../hooks/useCurrency';
import { useToast } from './Toast';

export default function CampaignBonusNotifier() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { formatAmount, currencySymbol } = useCurrency();
  const bonus = useAuthStore((s) => s.pendingCampaignBonus);
  const clearBonus = useAuthStore((s) => s.clearCampaignBonus);

  useEffect(() => {
    if (!bonus) return;

    let message: string | null = null;
    if (bonus.bonus_type === 'balance' && bonus.balance_kopeks > 0) {
      message = t('campaignBonus.balance', {
        // balance_kopeks is the bonus credited to the Toman 1:1 balance — no ÷100.
        amount: formatAmount(bonus.balance_kopeks, 0),
        currency: currencySymbol,
        name: bonus.campaign_name,
      });
    } else if (bonus.bonus_type === 'subscription' && bonus.subscription_days) {
      message = t('campaignBonus.subscription', {
        days: bonus.subscription_days,
        name: bonus.campaign_name,
      });
    } else if (bonus.bonus_type === 'tariff' && bonus.tariff_name) {
      message = t('campaignBonus.tariff', {
        tariff: bonus.tariff_name,
        name: bonus.campaign_name,
      });
    }

    if (message) {
      showToast({
        type: 'success',
        title: t('campaignBonus.title'),
        message,
        duration: 8000,
      });
    }

    clearBonus();
  }, [bonus, clearBonus, showToast, t, formatAmount, currencySymbol]);

  return null;
}
