import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { formatMZN, placeOrder, type PaymentMethod } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { brand, radius, space } from '@/lib/theme';

const METHODS: { id: PaymentMethod; label: string; wallet: boolean }[] = [
  { id: 'mpesa', label: 'M-Pesa', wallet: true },
  { id: 'emola', label: 'e-Mola', wallet: true },
  { id: 'mkesh', label: 'mKesh', wallet: true },
  { id: 'cod', label: 'Dinheiro na entrega', wallet: false },
];

export default function CheckoutScreen() {
  const router = useRouter();
  const { lines, totalCents, clear } = useCart();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('mpesa');
  const [payPhone, setPayPhone] = useState('');
  const [delivery, setDelivery] = useState<'home' | 'pickup'>('home');
  const [province, setProvince] = useState('');
  const [bairro, setBairro] = useState('');
  const [landmark, setLandmark] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const wallet = METHODS.find((m) => m.id === method)?.wallet ?? false;
  const valid = name.trim() !== '' && phone.trim() !== '' && lines.length > 0;

  async function submit() {
    if (!valid || busy) return;
    setError('');
    setBusy(true);
    try {
      const result = await placeOrder({
        name: name.trim(),
        phone: phone.trim(),
        paymentMethod: method,
        expectedTotalCents: totalCents,
        items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        deliveryMethod: delivery,
        ...(wallet && payPhone.trim() ? { payPhone: payPhone.trim() } : {}),
        ...(delivery === 'home' && province.trim() ? { province: province.trim() } : {}),
        ...(delivery === 'home' && bairro.trim() ? { bairro: bairro.trim() } : {}),
        ...(delivery === 'home' && landmark.trim() ? { landmark: landmark.trim() } : {}),
      });
      clear();
      router.replace({ pathname: '/pedido/[ref]', params: { ref: result.orderNumber } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir a compra.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>Contacto</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nome completo"
          placeholderTextColor={brand.muted}
        />
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Telemóvel (84…)"
          placeholderTextColor={brand.muted}
          keyboardType="phone-pad"
        />

        <Text style={styles.section}>Pagamento</Text>
        <View style={styles.chips}>
          {METHODS.map((m) => {
            const on = method === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMethod(m.id)}
                style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {wallet ? (
          <TextInput
            style={styles.input}
            value={payPhone}
            onChangeText={setPayPhone}
            placeholder="Número da carteira (opcional)"
            placeholderTextColor={brand.muted}
            keyboardType="phone-pad"
          />
        ) : null}

        <Text style={styles.section}>Entrega</Text>
        <View style={styles.chips}>
          {(['home', 'pickup'] as const).map((d) => {
            const on = delivery === d;
            return (
              <Pressable
                key={d}
                onPress={() => setDelivery(d)}
                style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {d === 'home' ? 'Ao domicílio' : 'Levantamento'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {delivery === 'home' ? (
          <>
            <TextInput
              style={styles.input}
              value={province}
              onChangeText={setProvince}
              placeholder="Província"
              placeholderTextColor={brand.muted}
            />
            <TextInput
              style={styles.input}
              value={bairro}
              onChangeText={setBairro}
              placeholder="Bairro"
              placeholderTextColor={brand.muted}
            />
            <TextInput
              style={styles.input}
              value={landmark}
              onChangeText={setLandmark}
              placeholder="Ponto de referência"
              placeholderTextColor={brand.muted}
            />
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>{formatMZN(totalCents)}</Text>
        </View>
        <Pressable
          style={[styles.pay, (!valid || busy) && styles.payDisabled]}
          onPress={submit}
          disabled={!valid || busy}>
          <Text style={styles.payText}>{busy ? 'A processar…' : 'Confirmar e pagar'}</Text>
        </Pressable>
        <Text style={styles.note}>Demonstração — pagamento simulado, sem cobrança real.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: brand.bg },
  content: { padding: space.lg, gap: space.sm },
  section: { marginTop: space.md, fontWeight: '700', color: brand.text, fontSize: 15 },
  input: {
    height: 48,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.md,
    backgroundColor: brand.surface,
    color: brand.text,
    fontSize: 15,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.surface,
  },
  chipOn: { borderColor: brand.green, backgroundColor: '#e6f2ee' },
  chipText: { color: brand.text },
  chipTextOn: { color: brand.green, fontWeight: '700' },
  error: { color: brand.danger, marginTop: space.sm },
  footer: {
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: brand.border,
    backgroundColor: brand.white,
    gap: space.sm,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, color: brand.text },
  total: { fontSize: 20, fontWeight: '800', color: brand.green },
  pay: {
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payDisabled: { backgroundColor: brand.muted },
  payText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  note: { fontSize: 11, color: brand.muted, textAlign: 'center', fontStyle: 'italic' },
});
