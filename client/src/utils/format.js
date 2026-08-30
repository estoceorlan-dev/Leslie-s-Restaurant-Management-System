export const formatCurrency = (cents = 0) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(cents / 100);

export const formatDateTime = (value) => {
  if (!value) return '—';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(normalized));
};

export const formatDate = (value, options = { dateStyle: 'medium' }) => {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return new Intl.DateTimeFormat('en-PH', options).format(date);
};

export const formatQuantity = (value = 0) => new Intl.NumberFormat('en-PH', {
  maximumFractionDigits: 3,
}).format(value);

export const paymentLabels = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
};

export const orderTypeLabels = {
  dine_in: 'Dine-in',
  takeout: 'Takeout',
};
