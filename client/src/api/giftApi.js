import axiosClient from './axiosClient';

export const giftApi = {
  listActive: () => axiosClient.get('/gifts/active'),
  enter: (campaignId, payload) => axiosClient.post(`/gifts/campaigns/${campaignId}/enter`, payload),
  myVouchers: () => axiosClient.get('/gifts/vouchers/mine'),
  previewVoucher: (voucherCode) => axiosClient.post('/gifts/vouchers/preview', { voucherCode }),
  redeemOnBooking: (bookingId, voucherCode) =>
    axiosClient.post(`/gifts/bookings/${bookingId}/redeem`, { voucherCode }),
};
