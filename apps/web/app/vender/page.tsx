import { MyShopPanel } from '../../components/vender/MyShopPanel';

export const dynamic = 'force-dynamic';

// Seller dashboard = "A minha loja". The signed-in seller sees their own shop
// and listings (with edit/remove), loaded client-side from the session. Visitors
// without a session get a sign-in prompt; the whole panel lives in MyShopPanel.
export default function SellerDashboard() {
  return (
    <section className="dash">
      <MyShopPanel />
    </section>
  );
}
