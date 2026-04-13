import type { CheckoutCart } from '../src/checkout/checkout.js'
import { calculateCheckoutTotal } from '../src/checkout/checkout.js'

interface CheckoutFormProps {
  cart: CheckoutCart
  onSubmit: (cart: CheckoutCart) => void
}

export function CheckoutForm({ cart, onSubmit }: CheckoutFormProps) {
  const total = calculateCheckoutTotal(cart)

  return (
    <form onSubmit={() => onSubmit(cart)}>
      <h2>Checkout</h2>
      <p>Total: {total}</p>
      <button type="submit">Complete Checkout</button>
    </form>
  )
}
