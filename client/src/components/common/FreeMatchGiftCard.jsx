import { useCallback, useEffect, useState } from 'react';
import { FiGift, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import Card, { CardTitle } from './Card';
import Button from './Button';
import Modal from './Modal';
import { giftApi } from '../../api/giftApi';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import { toastApiError } from '../../lib/support';

const SUSPENSE_MS = 2800;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const COPY = {
  waitingSo: 'Hadiyadda waa la furayaa…',
  waitingEn: 'Opening your gift…',
  winSo: 'Waad ku guulaysatay!',
  winEn: 'You won a free match!',
  winHintSo:
    'Isticmaal koodhkan booking details-ka — ciyaarta oo dhan waa bilaash (100%).',
  winHintEn: 'Redeem this code on booking details for 100% off one match.',
  loseSo: 'Nasiib xumo — isku day campaign-ka xiga.',
  loseEn: 'Better luck next time — try another campaign when available.',
};

/**
 * Captain gift draw — suspense reveal (win/lose), gated by giftEnabled.
 */
export default function FreeMatchGiftCard() {
  const { giftEnabled, loaded: featuresLoaded } = useAuthFeatures();
  const [campaigns, setCampaigns] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enteringId, setEnteringId] = useState(null);
  const [drawPhase, setDrawPhase] = useState(null); // null | 'waiting' | 'win' | 'lose'
  const [drawResult, setDrawResult] = useState(null);

  const load = useCallback(async () => {
    if (!giftEnabled) {
      setCampaigns([]);
      setVouchers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [activeRes, vouchersRes] = await Promise.all([
        giftApi.listActive(),
        giftApi.myVouchers(),
      ]);
      setCampaigns(activeRes.data.data.campaigns || []);
      setVouchers(vouchersRes.data.data.vouchers || []);
    } catch {
      setCampaigns([]);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  }, [giftEnabled]);

  useEffect(() => {
    if (!featuresLoaded) return;
    load();
  }, [featuresLoaded, load]);

  const closeReveal = () => {
    if (drawPhase === 'waiting') return;
    setDrawPhase(null);
    setDrawResult(null);
  };

  const enter = async (campaignId) => {
    if (enteringId || drawPhase === 'waiting') return;
    setEnteringId(campaignId);
    setDrawResult(null);
    setDrawPhase('waiting');

    try {
      const [, apiRes] = await Promise.all([
        delay(SUSPENSE_MS),
        giftApi.enter(campaignId, {}),
      ]);
      const result = apiRes.data.data;
      setDrawResult(result);
      setDrawPhase(result.won ? 'win' : 'lose');
      load();
    } catch (err) {
      setDrawPhase(null);
      toastApiError(err, 'Could not enter draw');
    } finally {
      setEnteringId(null);
    }
  };

  const issued = vouchers.filter((v) => v.voucherStatus === 'issued');

  if (!featuresLoaded || !giftEnabled) return null;
  if (loading) return null;
  if (!campaigns.length && !issued.length) return null;

  return (
    <>
      <Card padding>
        <div className="flex items-center gap-2">
          <FiGift className="text-brand-green" />
          <CardTitle>Free match gift · Hadiyad bilaash</CardTitle>
        </div>
        <p className="mt-1 text-xs text-muted">
          Enter once per campaign. Geli hal mar — voucher = ciyaar bilaash (100% off).
        </p>

        {issued.length > 0 && (
          <div className="mt-3 space-y-2 rounded-xl bg-brand-green/10 p-3">
            <p className="text-xs font-semibold text-brand-green">Your vouchers · Vouchers-kaaga</p>
            {issued.map((v) => (
              <p key={v.id || v._id} className="font-mono text-sm font-bold">
                {v.voucherCode}
                <span className="ml-2 font-sans text-xs font-normal text-muted">
                  Redeem on booking details
                </span>
              </p>
            ))}
          </div>
        )}

        <div className="mt-3 space-y-2">
          {campaigns.map((c) => {
            const id = c.id || c._id;
            const busy = Boolean(enteringId) || drawPhase === 'waiting';
            return (
              <div
                key={id}
                className="flex items-center justify-between gap-2 rounded-xl border border-charcoal/10 px-3 py-2 dark:border-white/10"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-muted">
                    {[c.city, c.region].filter(Boolean).join(' · ') || 'Platform-wide'}
                    {' · '}
                    {c.remainingWinners} spots left
                  </p>
                </div>
                {c.alreadyEntered ? (
                  <span className="shrink-0 text-xs font-medium text-muted">
                    {c.myEntry?.won ? 'Won · Guul' : 'Entered · La geliyay'}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    icon={<FiGift />}
                    loading={enteringId === id}
                    disabled={busy}
                    onClick={() => enter(id)}
                  >
                    Gift
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Modal
        open={Boolean(drawPhase)}
        onClose={closeReveal}
        title={
          drawPhase === 'waiting'
            ? 'Gift draw'
            : drawPhase === 'win'
              ? 'Win · Guul'
              : 'Result · Natiijo'
        }
        size="sm"
        footer={
          drawPhase && drawPhase !== 'waiting' ? (
            <Button onClick={closeReveal}>OK · Hagaag</Button>
          ) : null
        }
      >
        {drawPhase === 'waiting' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand-green/20" />
              <FiGift className="relative z-10 animate-bounce text-4xl text-brand-green" />
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-charcoal/10 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-brand-green transition-all"
                style={{
                  animation: `giftProgress ${SUSPENSE_MS}ms linear forwards`,
                }}
              />
            </div>
            <p className="text-sm font-semibold text-charcoal dark:text-dark-text">
              {COPY.waitingSo}
            </p>
            <p className="text-xs text-muted">{COPY.waitingEn}</p>
          </div>
        )}

        {drawPhase === 'win' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <FiCheckCircle className="text-4xl text-brand-green" />
            <p className="font-display text-lg font-bold text-brand-green">{COPY.winSo}</p>
            <p className="text-sm text-muted">{COPY.winEn}</p>
            <p className="mt-2 rounded-xl bg-brand-green/10 px-4 py-3 font-mono text-lg font-bold tracking-wide">
              {drawResult?.entry?.voucherCode}
            </p>
            <p className="text-xs text-muted">{COPY.winHintSo}</p>
            <p className="text-xs text-muted">{COPY.winHintEn}</p>
          </div>
        )}

        {drawPhase === 'lose' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <FiXCircle className="text-4xl text-muted" />
            <p className="font-display text-lg font-bold text-charcoal dark:text-dark-text">
              {COPY.loseSo}
            </p>
            <p className="text-sm text-muted">{COPY.loseEn}</p>
          </div>
        )}
      </Modal>

      <style>{`
        @keyframes giftProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </>
  );
}
