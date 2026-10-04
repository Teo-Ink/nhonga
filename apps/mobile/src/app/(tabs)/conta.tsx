import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  clearToken,
  formatMZN,
  me,
  myListings,
  removeListing,
  requestOtp,
  setListingStatus,
  setToken,
  verifyOtp,
  type AuthUser,
  type MineResponse,
} from '@/lib/api';
import { registerForPush, unregisterForPush } from '@/lib/push';
import { useFavorites } from '@/lib/favorites';
import { WalletCard } from '@/components/WalletCard';
import { brand, radius, space, shadow } from '@/lib/theme';

type Step = 'phone' | 'code' | 'done';
type PushState = 'unknown' | 'on' | 'off' | 'unavailable';

export default function AccountScreen() {
  const router = useRouter();
  const { count: favCount } = useFavorites();
  const [step, setStep] = useState<Step>('phone');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mine, setMine] = useState<MineResponse | null>(null);
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [devCode, setDevCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [push, setPush] = useState<PushState>('unknown');

  function enablePush() {
    if (Platform.OS === 'web') {
      setPush('unavailable');
      return;
    }
    registerForPush()
      .then((token) => setPush(token ? 'on' : 'off'))
      .catch(() => setPush('off'));
  }

  // After a session is known, load the user's shop + listings (seller vs buyer).
  function loadMine() {
    myListings()
      .then(setMine)
      .catch(() => setMine(null));
  }

  function onSignedIn(u: AuthUser) {
    setUser(u);
    setStep('done');
    enablePush();
    loadMine();
  }

  // Seller actions: change a listing's status / remove it, then re-sync.
  async function changeStatus(id: string, status: 'active' | 'sold') {
    setBusyId(id);
    setMine((d) =>
      d ? { ...d, items: d.items.map((i) => (i.id === id ? { ...i, status } : i)) } : d,
    );
    try {
      await setListingStatus(id, status);
    } finally {
      loadMine();
      setBusyId(null);
    }
  }

  function confirmRemove(id: string) {
    Alert.alert('Remover anúncio', 'Tem a certeza que quer remover este anúncio?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => void doRemove(id),
      },
    ]);
  }
  async function doRemove(id: string) {
    setBusyId(id);
    setMine((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== id) } : d));
    try {
      await removeListing(id);
    } finally {
      loadMine();
      setBusyId(null);
    }
  }

  // Restore an existing session on mount.
  useEffect(() => {
    me()
      .then((r) => {
        if (r.user) onSignedIn(r.user);
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
      onSignedIn(r.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    await unregisterForPush();
    await clearToken();
    setUser(null);
    setMine(null);
    setPhone('');
    setCode('');
    setStep('phone');
    setPush('unknown');
  }

  if (step === 'done' && user) {
    const firstName = user.displayName.split(' ')[0] ?? user.displayName;
    const isSeller = mine?.shop != null;
    const stats = mine?.stats;
    const items = mine?.items ?? [];

    return (
      <ScrollView style={{ backgroundColor: brand.bg }} contentContainerStyle={styles.content}>
        {/* Identity */}
        <View style={styles.idRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(firstName[0] ?? 'U').toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>{firstName}</Text>
            <Text style={styles.muted}>{user.phoneE164}</Text>
            <View style={[styles.badge, isSeller && styles.badgeSeller]}>
              <Text style={[styles.badgeText, isSeller && styles.badgeTextSeller]}>
                {isSeller ? 'Vendedor' : 'Comprador'}
              </Text>
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.notifyRow}>
          <Ionicons
            name={push === 'on' ? 'notifications' : 'notifications-outline'}
            size={20}
            color={push === 'on' ? brand.green : brand.muted}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.notifyTitle}>
              {push === 'on'
                ? 'Alertas ativados'
                : push === 'unavailable'
                  ? 'Alertas no telemóvel'
                  : 'Ativar alertas'}
            </Text>
            <Text style={styles.notifyHint}>
              {push === 'on'
                ? 'Avisamos-te por notificação e SMS quando surgir algo nas tuas pesquisas guardadas.'
                : push === 'unavailable'
                  ? 'As notificações push funcionam na app instalada; aqui usamos SMS.'
                  : 'Recebe uma notificação quando surgirem novos anúncios para ti.'}
            </Text>
          </View>
          {push !== 'on' && push !== 'unavailable' ? (
            <Pressable onPress={enablePush} hitSlop={6}>
              <Text style={styles.notifyAction}>Ativar</Text>
            </Pressable>
          ) : null}
        </View>

        {isSeller ? (
          <>
            <Text style={styles.sectionTitle}>A minha carteira</Text>
            <WalletCard />
            <Text style={styles.sectionTitle}>Os meus anúncios</Text>
            <View style={styles.statsRow}>
              <Stat n={stats?.active ?? 0} label="Activos" />
              <Stat n={stats?.sold ?? 0} label="Vendidos" />
              <Stat n={stats?.views ?? 0} label="Vistas" />
              <Stat n={stats?.contacts ?? 0} label="Contactos" />
            </View>
            {items.length === 0 ? (
              <Text style={styles.muted}>Ainda não tens anúncios.</Text>
            ) : (
              items.map((it) => {
                const rowBusy = busyId === it.id;
                return (
                  <View style={styles.listing} key={it.id}>
                    <Pressable
                      style={({ pressed }) => [styles.listingMain, pressed && { opacity: 0.7 }]}
                      onPress={() =>
                        router.push({ pathname: '/produto/[slug]', params: { slug: it.slug } })
                      }
                    >
                      <View style={styles.listingThumb}>
                        {it.imageUrl ? (
                          <Image
                            source={{ uri: it.imageUrl }}
                            style={styles.listingImg}
                            resizeMode="cover"
                          />
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listingTitle} numberOfLines={1}>
                          {it.title}
                        </Text>
                        <Text style={styles.listingPrice}>{formatMZN(it.priceCents)}</Text>
                        <Text style={styles.listingMeta}>
                          {statusLabel(it.status)} · {it.views} vistas · {it.contacts} contactos
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={brand.muted} />
                    </Pressable>

                    <View style={styles.rowActions}>
                      {rowBusy ? (
                        <ActivityIndicator size="small" color={brand.muted} />
                      ) : it.status === 'active' ? (
                        <Pressable
                          style={styles.act}
                          onPress={() => void changeStatus(it.id, 'sold')}
                        >
                          <Ionicons name="checkmark-circle-outline" size={16} color={brand.text} />
                          <Text style={styles.actText}>Marcar vendido</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={styles.act}
                          onPress={() => void changeStatus(it.id, 'active')}
                        >
                          <Ionicons name="refresh-outline" size={16} color={brand.text} />
                          <Text style={styles.actText}>Reativar</Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={styles.act}
                        disabled={rowBusy}
                        onPress={() => confirmRemove(it.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color={brand.danger} />
                        <Text style={[styles.actText, { color: brand.danger }]}>Remover</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>A minha atividade</Text>
            <View style={styles.statsRow}>
              <Stat n={favCount} label="Favoritos" />
            </View>
            <View style={styles.sellBox}>
              <Ionicons name="storefront-outline" size={22} color={brand.green} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sellTitle}>Vender no Nhonga</Text>
                <Text style={styles.notifyHint}>
                  Crie a sua loja grátis no site nhonga.co.mz para começar a anunciar.
                </Text>
              </View>
            </View>
          </>
        )}

        <Pressable style={styles.secondary} onPress={onSignOut}>
          <Text style={styles.secondaryText}>Terminar sessão</Text>
        </Pressable>
      </ScrollView>
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

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function statusLabel(s: string): string {
  return s === 'active' ? 'Activo' : s === 'sold' ? 'Vendido' : s === 'archived' ? 'Arquivado' : s;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space.xl, gap: space.md, backgroundColor: brand.bg },
  content: { padding: space.lg, gap: space.md },
  title: { fontSize: 20, fontWeight: '700', color: brand.text },
  hello: { fontSize: 20, fontWeight: '700', color: brand.text },
  muted: { color: brand.muted },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: brand.surfaceSunken,
  },
  badgeSeller: { backgroundColor: '#e8f2ec' },
  badgeText: { fontSize: 11, fontWeight: '800', color: brand.muted },
  badgeTextSeller: { color: brand.greenDark },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: brand.text, marginTop: space.sm },
  statsRow: { flexDirection: 'row', gap: space.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.border,
  },
  statN: { fontSize: 18, fontWeight: '800', color: brand.text },
  statLabel: { fontSize: 11, color: brand.muted, marginTop: 2 },
  listing: {
    borderRadius: radius.md,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.border,
    overflow: 'hidden',
  },
  listingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
  },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderTopWidth: 1,
    borderTopColor: brand.border,
    backgroundColor: brand.surfaceSunken,
    minHeight: 40,
  },
  act: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  actText: { fontSize: 12, fontWeight: '600', color: brand.text },
  listingThumb: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: brand.surfaceSunken,
  },
  listingImg: { width: '100%', height: '100%' },
  listingTitle: { fontSize: 14, fontWeight: '600', color: brand.text },
  listingPrice: { fontSize: 14, fontWeight: '800', color: brand.green, marginTop: 1 },
  listingMeta: { fontSize: 11, color: brand.muted, marginTop: 1 },
  sellBox: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.border,
    ...shadow.sm,
  },
  sellTitle: { fontSize: 14, fontWeight: '700', color: brand.text },
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
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.border,
  },
  notifyTitle: { color: brand.text, fontWeight: '600', fontSize: 14 },
  notifyHint: { color: brand.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  notifyAction: { color: brand.green, fontWeight: '700' },
  link: { color: brand.green, textAlign: 'center', marginTop: space.sm },
  dev: {
    color: brand.green,
    backgroundColor: brand.surfaceSunken,
    padding: space.sm,
    borderRadius: radius.sm,
  },
  error: { color: brand.danger },
});
