import type { CheckoutCart } from '../checkout/checkout.js'

export const API_BASE = '/api'
export const CHECKOUT_ENDPOINT = '/api/checkout'
export const PRODUCTS_ENDPOINT = '/api/products'

export async function submitCheckout(cart: CheckoutCart): Promise<{ orderId: string }> {
  const response = await fetch(CHECKOUT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cart),
  })
  if (!response.ok) {
    throw new Error(`Checkout failed: ${response.status}`)
  }
  return response.json() as Promise<{ orderId: string }>
}

export async function fetchProducts(): Promise<unknown[]> {
  const response = await fetch(PRODUCTS_ENDPOINT)
  return response.json() as Promise<unknown[]>
}
