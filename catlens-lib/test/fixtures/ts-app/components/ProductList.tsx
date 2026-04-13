interface Product {
  id: string
  name: string
  price: number
}

interface ProductListProps {
  products: Product[]
}

export function ProductList({ products }: ProductListProps) {
  return (
    <ul>
      {products.map(p => (
        <li key={p.id}>{p.name} - {p.price}</li>
      ))}
    </ul>
  )
}
