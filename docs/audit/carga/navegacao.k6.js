// k6 — navegação típica no staging. NÃO EXECUTAR sem autorização do dono
// (ver docs/audit/07-escalabilidade-elasticidade.md). Nunca contra produção.
//
//   BASE=http://nhonga-staging-62630277.af-south-1.elb.amazonaws.com k6 run navegacao.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE;
const TERMS = ['toyota', 'apartamento', 'samsung', 'capulana', 'canalizador', 'arroz'];
const CATEGORIES = ['viaturas', 'imoveis', 'telemoveis', 'empregos', 'servicos'];

export const options = {
  stages: [
    { duration: '5m', target: 50 },
    { duration: '10m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export default function () {
  const r = Math.random();
  let res;
  if (r < 0.3) res = http.get(`${BASE}/`);
  else if (r < 0.5) res = http.get(`${BASE}/categoria/${pick(CATEGORIES)}`);
  else if (r < 0.7) res = http.get(`${BASE}/pesquisa?q=${pick(TERMS)}`);
  else res = http.get(`${BASE}/api/listings?limit=24`);
  check(res, { 'status < 400': (x) => x.status < 400 });
  sleep(1 + Math.random() * 3);
}
