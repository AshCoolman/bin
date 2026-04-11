export interface CheckoutItem {
  id: string
  name: string
  price: number
  quantity: number
}

export interface CheckoutCart {
  items: CheckoutItem[]
  discountCode?: string
}

export function calculateCheckoutTotal(cart: CheckoutCart): number {
  return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

export function validateCheckoutCart(cart: CheckoutCart): string[] {
  const errors: string[] = []
  if (cart.items.length === 0) {
    errors.push('Cart is empty')
  }
  for (const item of cart.items) {
    if (item.quantity <= 0) {
      errors.push(`Invalid quantity for ${item.name}`)
    }
  }
  return errors
}
