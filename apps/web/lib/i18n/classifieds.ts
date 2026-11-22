// Copy switch for CONT-01.
//
// Nhonga's storefront was written with marketplace promises (buyer protection
// with refunds, nationwide delivery with live tracking, cash on delivery) that
// the platform does not yet keep: buyers and sellers agree payment and delivery
// between themselves, as on a classifieds site. Making those promises is a
// consumer-law risk, so by default the keys below are replaced with classifieds
// copy. Set NEXT_PUBLIC_MARKETPLACE_PROMISES=1 at build time, once the
// transactional marketplace really exists, to show the original copy.

type Overrides = Record<string, Record<string, string>>;

export function marketplacePromisesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MARKETPLACE_PROMISES === '1';
}

export function withListingCopy<T extends object>(base: T, overrides: Overrides): T {
  if (marketplacePromisesEnabled()) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [section, keys] of Object.entries(overrides)) {
    const current = out[section];
    if (current && typeof current === 'object') {
      out[section] = { ...(current as Record<string, unknown>), ...keys };
    }
  }
  return out as T;
}

export const CLASSIFIEDS_PT: Overrides = {
  footer: {
    payments: 'Pagamentos: M-Pesa · e-Mola · Transferência bancária · Visa',
  },
  trust: {
    buyer_protection: 'Vendedores verificados',
    buyer_protection_desc: 'Lojas com selo de verificação e avaliações reais',
    secure_payment: 'Contacto directo',
    secure_payment_desc: 'Fale com o vendedor por mensagem ou WhatsApp',
    delivery: 'Anúncios em todo o país',
    delivery_desc: 'Encontre o que procura perto de si',
  },
  home: {
    hero_subtitle:
      'Compre e venda perto de si. Combine o pagamento e a entrega directamente com o vendedor.',
    side_benefit1: 'Dicas de segurança em cada anúncio',
    side_benefit2: 'Fale com o vendedor por mensagem',
    app_b1: 'Avisos de novas mensagens em tempo real',
    app_sub: 'Compre, venda e fale com vendedores onde estiver — apps para iOS e Android.',
  },
  help: {
    a_payment:
      'O pagamento e a entrega combinam-se directamente com o vendedor. Nunca pague antes de ver o produto. Os serviços do Nhonga (destaques e Loja Pro) pagam-se por M-Pesa, e-Mola ou cartão Visa.',
  },
  dash: {
    safety_tip:
      'Dica de segurança: nunca pague antes de ver o produto e desconfie de preços demasiado baixos ou de pedidos de pagamento adiantado.',
  },
};

export const CLASSIFIEDS_EN: Overrides = {
  footer: {
    payments: 'Payments: M-Pesa · e-Mola · Bank transfer · Visa',
  },
  trust: {
    buyer_protection: 'Verified sellers',
    buyer_protection_desc: 'Shops with a verification badge and real reviews',
    secure_payment: 'Direct contact',
    secure_payment_desc: 'Talk to the seller by message or WhatsApp',
    delivery: 'Listings nationwide',
    delivery_desc: 'Find what you need near you',
  },
  home: {
    hero_subtitle: 'Buy and sell near you. Agree payment and delivery directly with the seller.',
    side_benefit1: 'Safety tips on every listing',
    side_benefit2: 'Message the seller directly',
    app_b1: 'Real-time alerts for new messages',
    app_sub: 'Buy, sell and talk to sellers anywhere — apps for iOS and Android.',
  },
  help: {
    a_payment:
      "Payment and delivery are agreed directly with the seller. Never pay before seeing the item. Nhonga's own services (boosts and Loja Pro) are paid by M-Pesa, e-Mola or Visa card.",
  },
  dash: {
    safety_tip:
      'Safety tip: never pay before seeing the item, and be wary of prices that look too good or requests to pay in advance.',
  },
};
