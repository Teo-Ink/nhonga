import { describe, expect, it } from 'vitest';
import { isGamblingAd } from './ads.service.js';

describe('isGamblingAd (P0-17)', () => {
  it('refuses betting and casino advertisers, headlines and links', () => {
    expect(isGamblingAd('Premier Bet Moçambique')).toBe(true);
    expect(isGamblingAd('Loja X', 'Aposte já e ganhe', 'https://loja.co.mz')).toBe(false);
    expect(isGamblingAd('Loja X', 'Apostas desportivas', 'https://loja.co.mz')).toBe(true);
    expect(isGamblingAd('Promo', '', 'https://www.1xbet.co.mz/promo')).toBe(true);
    expect(isGamblingAd('Promo', 'Casino online', 'https://x.com')).toBe(true);
  });

  it('does not catch ordinary shops', () => {
    expect(isGamblingAd('Betão & Cimentos Lda', 'Cimento 50 kg', 'https://betao.co.mz')).toBe(
      false,
    );
    expect(isGamblingAd('Alfabeto Livraria', 'Livros escolares', 'https://alfabeto.co.mz')).toBe(
      false,
    );
  });
});
