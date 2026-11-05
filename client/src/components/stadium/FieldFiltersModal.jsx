import { useEffect, useState } from 'react';
import clsx from 'clsx';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { EMPTY_FIELD_FILTERS } from '../../lib/fieldFormats';
import { useTranslation } from '../../i18n/LanguageContext';

export default function FieldFiltersModal({ open, onClose, value, onApply, sizes = [] }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value || EMPTY_FIELD_FILTERS);

  useEffect(() => {
    if (open) setDraft({ ...EMPTY_FIELD_FILTERS, ...value });
  }, [open, value]);

  const toggleType = (type) => {
    setDraft((prev) => {
      const types = prev.types || [];
      const next = types.includes(type) ? types.filter((x) => x !== type) : [...types, type];
      return { ...prev, types: next };
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('stadiumDetail.filterFields')}
      size="md"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              onApply(EMPTY_FIELD_FILTERS);
              onClose();
            }}
          >
            {t('search.clearFilters')}
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {t('stadiumDetail.applyFilters')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-3 py-3 dark:border-dark-border">
          <span>
            <span className="block text-sm font-bold text-charcoal dark:text-dark-text">
              {t('stadiumDetail.filterBanaan')}
            </span>
            <span className="text-xs text-muted">{t('stadiumDetail.filterBanaanHint')}</span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-forest"
            checked={Boolean(draft.openOnly)}
            onChange={(e) => setDraft((prev) => ({ ...prev, openOnly: e.target.checked }))}
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-bold text-charcoal dark:text-dark-text">
            {t('stadiumDetail.filterSize')}
          </p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const on = (draft.types || []).includes(s.type);
              return (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => toggleType(s.type)}
                  className={clsx(
                    'rounded-full border px-3 py-1.5 text-sm font-bold',
                    on
                      ? 'border-forest bg-forest text-white dark:border-dark-primary dark:bg-dark-primary'
                      : 'border-border bg-white text-charcoal dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text'
                  )}
                >
                  {s.type}
                  <span className="ml-1.5 font-semibold opacity-80">({s.count})</span>
                </button>
              );
            })}
            {!sizes.length ? (
              <p className="text-xs text-muted">{t('search.noFields')}</p>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold text-charcoal dark:text-dark-text">
            {t('stadiumDetail.filterPrice')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              min="0"
              label={t('search.minPrice')}
              value={draft.minPrice}
              onChange={(e) => setDraft((prev) => ({ ...prev, minPrice: e.target.value }))}
            />
            <Input
              type="number"
              min="0"
              label={t('search.maxPrice')}
              value={draft.maxPrice}
              onChange={(e) => setDraft((prev) => ({ ...prev, maxPrice: e.target.value }))}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
