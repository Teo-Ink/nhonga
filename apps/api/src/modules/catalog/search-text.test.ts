import { describe, expect, it } from 'vitest';
import {
  buildVocabulary,
  correctTokens,
  editDistance,
  expandToken,
  inflections,
  matchesTerm,
  normalise,
  scoreListing,
  tokenize,
} from './search-text.js';

describe('normalise / tokenize', () => {
  it('strips accents, case and punctuation', () => {
    expect(normalise('Telemóvel  Samsung—A14!')).toBe('telemovel samsung a14');
    expect(normalise('Smartphone 6.5"')).toBe('smartphone 6 5');
  });

  it('drops stopwords and duplicates', () => {
    expect(tokenize('Vendo carro de Maputo carro')).toEqual(['carro', 'maputo']);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('inflections', () => {
  it('handles Portuguese plural endings both ways', () => {
    expect(inflections('telemoveis')).toContain('telemovel');
    expect(inflections('telemovel')).toContain('telemoveis');
    expect(inflections('camioes')).toContain('camiao');
    expect(inflections('carros')).toContain('carro');
  });
});

describe('expandToken', () => {
  it('maps everyday words to the vertical they belong to', () => {
    expect(expandToken('carro')).toContain('viatura');
    expect(expandToken('carros')).toContain('viatura');
    expect(expandToken('apartamento')).toContain('imovel');
    expect(expandToken('celular')).toContain('telemovel');
    expect(expandToken('vaga')).toContain('emprego');
  });

  it('leaves unknown words as themselves', () => {
    expect(expandToken('hilux')).toEqual(['hilux']);
  });
});

describe('matchesTerm', () => {
  it('matches long terms as a word prefix', () => {
    expect(matchesTerm('telemoveis baratos', 'telemov')).toBe(true);
    expect(matchesTerm('smartphone android', 'phone')).toBe(false);
  });

  it('requires a whole word (or plural) for short terms', () => {
    expect(matchesTerm('casas em maputo', 'casa')).toBe(true);
    expect(matchesTerm('decoracao de casamentos', 'casa')).toBe(false);
    expect(matchesTerm('carregador solar', 'car')).toBe(false);
    expect(matchesTerm('televisor 43 tvs', 'tv')).toBe(true);
  });
});

describe('scoreListing', () => {
  const base = { attributes: '', location: '', vendor: '', description: '' };
  it('ranks a title hit above a description-only hit', () => {
    const title = scoreListing(['toyota'], {
      ...base,
      title: 'toyota hilux',
      category: 'viaturas',
    });
    const desc = scoreListing(['toyota'], {
      ...base,
      title: 'pneus',
      category: 'viaturas',
      description: 'serve toyota',
    });
    expect(title).toBeGreaterThan(desc);
  });

  it('ranks a category synonym hit above a title synonym hit', () => {
    const car = scoreListing(['carro'], {
      ...base,
      title: 'nissan almera',
      category: 'viaturas vehicles',
    });
    const job = scoreListing(['carro'], {
      ...base,
      title: 'motorista heavy vehicle driver',
      category: 'empregos jobs',
    });
    expect(car).toBeGreaterThan(job);
  });

  it('gives synonym matches credit', () => {
    const s = scoreListing(['carro'], {
      ...base,
      title: 'honda fit 2014',
      category: 'viaturas vehicles',
    });
    expect(s).toBeGreaterThan(0);
  });
});

describe('typo correction', () => {
  const vocab = buildVocabulary([
    'Toyota Corolla 2016',
    'Toyota Hilux 2015 4x4',
    'Samsung Galaxy A14',
  ]);

  it('fixes a one-letter slip to the closest real word', () => {
    expect(correctTokens(['toyta'], vocab)).toEqual(['toyota']);
    expect(correctTokens(['samsumg'], vocab)).toEqual(['samsung']);
  });

  it('returns null when nothing needs fixing', () => {
    expect(correctTokens(['toyota'], vocab)).toBeNull();
    expect(correctTokens(['carro'], vocab)).toBeNull(); // a known synonym
    expect(correctTokens(['xyzzyq'], vocab)).toBeNull();
  });

  it('computes edit distance with transpositions', () => {
    expect(editDistance('toyota', 'toyta')).toBe(1);
    expect(editDistance('hilux', 'hiulx')).toBe(1);
  });
});
