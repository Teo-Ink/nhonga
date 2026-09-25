import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  clearToken,
  me,
  requestOtp,
  setToken,
  verifyOtp,
  type AuthUser,
} from '@/lib/api';
import { brand, radius, space } from '@/lib/theme';

type Step = 'phone' | 'code' | 'done';

export default function AccountScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [devCode, setDevCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Restore an existing session on mount.
  useEffect(() => {
    me()
      .then((r) => {
        if (r.user) {
          setUser(r.user);
          setStep('done');
        }
      })
      .catch(() => {});
  }, []);

  async function onRequest() {
    setError('');
    setBusy(true);
    try {
      const r = await requestOtp(phone.trim());
      setChallengeId(r.challengeId);
      setDevCode(r.devCode ?? '');
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    setError('');
    setBusy(true);
    try {
      const r = await verifyOtp(challengeId, code.trim());
      await setToken(r.sessionToken);
      setUser(r.user);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    await clearToken();
    setUser(null);
    setPhone('');
    setCode('');
    setStep('phone');
  }

  if (step === 'done' && user) {
    return (
      <View style={styles.container}>
        <Text style={styles.hello}>Olá, {user.displayName.split(' ')[0]}!</Text>
        <Text style={styles.muted}>{user.phoneE164}</Text>
        <Pressable style={styles.secondary} onPress={onSignOut}>
          <Text style={styles.secondaryText}>Terminar sessão</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entrar ou criar conta</Text>
      <Text style={styles.muted}>Usamos o teu telemóvel e um código para confirmar.</Text>

      {step === 'phone' ? (
        <>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="84 123 4567"
            placeholderTextColor={brand.muted}
            keyboardType="phone-pad"
          />
          <Pressable style={styles.primary} onPress={onRequest} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? 'A enviar…' : 'Enviar código'}</Text>
          </Pressable>
        </>
      ) : (
        <>
          {devCode ? <Text style={styles.dev}>Código de teste: {devCode}</Text> : null}
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={brand.muted}
            keyboardType="number-pad"
          />
          <Pressable style={styles.primary} onPress={onVerify} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? 'A verificar…' : 'Confirmar'}</Text>
          </Pressable>
          <Pressable onPress={() => setStep('phone')}>
            <Text style={styles.link}>Usar outro número</Text>
          </Pressable>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space.xl, gap: space.md, backgroundColor: brand.bg },
  title: { fontSize: 20, fontWeight: '700', color: brand.text },
  hello: { fontSize: 22, fontWeight: '700', color: brand.text },
  muted: { color: brand.muted },
  input: {
    height: 48,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.md,
    backgroundColor: brand.surface,
    color: brand.text,
    fontSize: 16,
  },
  primary: {
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: {
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: brand.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  secondaryText: { color: brand.text, fontWeight: '600' },
  link: { color: brand.green, textAlign: 'center', marginTop: space.sm },
  dev: { color: brand.green, backgroundColor: brand.surfaceSunken, padding: space.sm, borderRadius: radius.sm },
  error: { color: brand.danger },
});
