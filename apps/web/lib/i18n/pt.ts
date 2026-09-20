// Portuguese — the primary locale. All UI copy lives here; no hardcoded strings
// in components. English (en.ts) mirrors this shape exactly.
export const pt = {
  common: {
    brand: 'Nhonga',
    search_placeholder: 'Pesquisar produtos, marcas e lojas…',
    all_categories: 'Todas as categorias',
    account: 'Conta',
    cart: 'Carrinho',
    menu: 'Menu',
    loading: 'A carregar…',
    retry: 'Tentar novamente',
    back: 'Voltar',
    see_all: 'Ver tudo',
    verified: 'Verificado',
    from: 'A partir de',
    sold_out: 'Esgotado',
    off: 'desconto',
    language: 'Idioma',
    theme: 'Tema',
  },
  trust: {
    buyer_protection: 'Proteção ao comprador',
    buyer_protection_desc: 'Reembolso se não receber o produto',
    secure_payment: 'Pagamento seguro',
    secure_payment_desc: 'M-Pesa, e-Mola, mKesh e mais',
    delivery: 'Entrega em todo o país',
    delivery_desc: 'Acompanhe o seu pedido em tempo real',
  },
  home: {
    categories: 'Categorias',
    deals: 'Promoções',
    featured: 'Em destaque',
    demo_notice:
      'Ambiente de teste · catálogo de demonstração. Checkout, contas e pagamentos ainda não estão ligados.',
    empty: 'Ainda não há produtos publicados.',
    load_error: 'Não foi possível carregar os produtos.',
  },
  pdp: {
    add_to_cart: 'Adicionar ao carrinho',
    coming_soon: 'em breve',
    buy_now: 'Comprar agora',
    sold_by: 'Vendido por',
    delivery_estimate: 'Entrega estimada',
    delivery_tbc: 'Calculada no checkout',
    in_stock: 'Em stock',
    only_left: 'Restam apenas {n}',
    ratings: '{n} avaliações',
    specifications: 'Especificações',
    demo_notice: 'Ambiente de teste · o botão de compra está desativado até o checkout ser ligado.',
    not_found: 'Produto não encontrado.',
  },
  categories: {
    moda: 'Moda',
    electronica: 'Eletrónica',
    casa: 'Casa e Cozinha',
    alimentacao: 'Alimentação',
    beleza: 'Beleza',
    telemoveis: 'Telemóveis',
    all: 'Ver todas',
  },
};

export type Dictionary = typeof pt;
