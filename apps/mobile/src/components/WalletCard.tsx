import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatMZN,
  getWallet,
  getWalletPackages,
  purchasePackage,
  topupWallet,
  type WalletPackage,
  type WalletView,
} from '@/lib/api';
import { brand, radius, shadow, space } from '@/lib/theme';

// Seller wallet: balance (MZN) + loyalty points, with demo top-ups and prepaid
// packages. Mirrors the web "Saldo em conta / Comprar pacote" strip. Shown only
// for sellers (the account screen gates on that).
export function WalletCard({ reloadSignal = 0 }: { reloadSignal?: number }) {
  const [w, setW] = useState<WalletView | null>(null);
  const [panel, setPanel] = useState<'none' | 'topup' | 'packages'>('none');
  const [amount, setAmount] = useState('');
  const [pkgs, setPkgs] = useState<WalletPackage[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    getWallet()
      .then(setW)
      .catch(() =>
        setW({ hasShop: false, shopName: null, balanceCents: 0, points: 0, transactions: [] }),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadSignal]);

  function openTopup() {
    setMsg(null);
    setPanel((p) => (p === 'topup' ? 'none' : 'topup'));
  }
  function openPackages() {
    setMsg(null);
    setPanel((p) => (p === 'packages' ? 'none' : 'packages'));
    if (pkgs.length === 0) {
      getWalletPackages()
        .then((d) => setPkgs(Array.isArray(d) ? d : []))
        .catch(() => setPkgs([]));
    }
  }

  async function submitTopup() {
    const mt = Number(amount.replace(/[^\d]/g, ''));
    if (!mt || mt <= 0) {
      setMsg('Indica um montante válido.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const d = await topupWallet(mt * 100);
      setW(d);
      setAmount('');
      setPanel('none');
      setMsg(`Saldo carregado: +${formatMZN(mt * 100)}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não foi possível carregar.');
    } finally {
      setBusy(false);
    }
  }

  async function buy(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const d = await purchasePackage(id);
      setW(d);
      setPanel('none');
      setMsg('Pacote adicionado à tua conta.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não foi possível comprar.');
    } finally {
      setBusy(false);
    }
  }

  if (!w) {
    return (
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator color={brand.green} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.figures}>
          <Text style={styles.label}>Saldo em conta</Text>
          <Text style={styles.balance}>{formatMZN(w.balanceCents)}</Text>
          <Text style={styles.points}>{w.points} pontos</Text>
        </View>
        <Ionicons name="wallet-outline" size={26} color={brand.green} />
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
          onPress={openTopup}
        >
          <Text style={styles.btnGhostText}>Carregar</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnCta, pressed && styles.pressed]}
          onPress={openPackages}
        >
          <Text style={styles.btnCtaText}>Comprar pacote</Text>
        </Pressable>
      </View>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      {panel === 'topup' ? (
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>Montante a carregar (MT)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="Ex.: 500"
            placeholderTextColor={brand.muted}
          />
          <View style={styles.quick}>
            {[100, 500, 1000].map((v) => (
              <Pressable
                key={v}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                onPress={() => setAmount(String(v))}
              >
                <Text style={styles.chipText}>{v} MT</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnCta, pressed && styles.pressed]}
            onPress={() => void submitTopup()}
            disabled={busy}
          >
            <Text style={styles.btnCtaText}>{busy ? 'A carregar…' : 'Carregar (demo)'}</Text>
          </Pressable>
        </View>
      ) : null}

      {panel === 'packages' ? (
        <View style={styles.panel}>
          {pkgs.length === 0 ? (
            <Text style={styles.muted}>A carregar pacotes…</Text>
          ) : (
            pkgs.map((p) => (
              <View style={styles.pkg} key={p.id}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pkgName}>{p.name}</Text>
                  <Text style={styles.pkgMeta}>
                    {formatMZN(p.balanceCents)} de saldo · {p.points} pts
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnCta,
                    styles.btnCompact,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => void buy(p.id)}
                  disabled={busy}
                >
                  <Text style={styles.btnCtaText}>{formatMZN(p.priceCents)}</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: brand.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: brand.border,
    padding: space.md,
    gap: space.sm,
    ...shadow.sm,
  },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 90 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  figures: { gap: 2 },
  label: { fontSize: 12, color: brand.muted },
  balance: { fontSize: 24, fontWeight: '800', color: brand.text, letterSpacing: -0.4 },
  points: { fontSize: 13, color: brand.green, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: space.sm },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { borderWidth: 1, borderColor: brand.border, backgroundColor: brand.bg },
  btnGhostText: { color: brand.text, fontWeight: '700' },
  btnCta: { backgroundColor: brand.green },
  btnCompact: { flex: 0, paddingHorizontal: space.lg, minWidth: 96 },
  btnCtaText: { color: '#fff', fontWeight: '700' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  msg: { fontSize: 13, color: brand.green },
  panel: { gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: brand.border },
  panelLabel: { fontSize: 13, color: brand.muted },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    color: brand.text,
    backgroundColor: brand.bg,
  },
  quick: { flexDirection: 'row', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.bg,
  },
  chipText: { color: brand.text, fontWeight: '600', fontSize: 13 },
  muted: { color: brand.muted },
  pkg: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pkgName: { fontSize: 14, fontWeight: '700', color: brand.text },
  pkgMeta: { fontSize: 12, color: brand.muted, marginTop: 2 },
});
