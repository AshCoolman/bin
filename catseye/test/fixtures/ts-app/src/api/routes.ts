export const ROUTES = {
  home: '/',
  checkout: '/checkout',
  checkoutConfirm: '/checkout/confirm',
  products: '/products',
  api: {
    checkout: '/api/checkout',
    products: '/api/products',
    users: '/api/users',
  },
} as const

export type Route = (typeof ROUTES)[keyof typeof ROUTES]
