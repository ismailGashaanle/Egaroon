import toast from 'react-hot-toast';

/** Default E-Garoon support — overridden by /auth/contacts when loaded */
export const SUPPORT = {
  phone: '0610000000',
  email: 'support@egaroon.com',
  whatsapp: '252610000000',
};

export function supportHint(extra = '') {
  const base = `La xiriir kooxda E-Garoon: ${SUPPORT.phone} · ${SUPPORT.email}`;
  return extra ? `${extra} ${base}` : base;
}

export function toastApiError(err, fallback = 'Something went wrong') {
  const msg =
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    fallback;
  const needsContact =
    /kulansiiye|fog|magaalo|gobol|otp|dhaafay|contact|xiriir/i.test(msg) ||
    err?.response?.status >= 500;
  toast.error(needsContact ? msg : `${msg} — ${supportHint()}`);
}

export async function loadSupportContacts(params = {}) {
  try {
    const { default: axiosClient } = await import('../api/axiosClient');
    const { data } = await axiosClient.get('/auth/contacts', { params });
    const def = data.data?.default;
    if (def?.phone) SUPPORT.phone = def.phone;
    if (def?.email) SUPPORT.email = def.email;
    if (def?.whatsapp) SUPPORT.whatsapp = def.whatsapp;
    return data.data;
  } catch {
    return { default: SUPPORT, contacts: [] };
  }
}
