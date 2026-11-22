import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  applyBanner,
  bannerQuota,
  bannerSvgUrl,
  generateBanner,
  getProduct,
  type BannerQuota,
  type BannerVariant,
} from '@/lib/api';
import { brand, radius, space } from '@/lib/theme';

const RATIOS: { key: string; label: string }[] = [
  { key: 'square', label: 'Quadrado' },
  { key: 'landscape', label: 'Horizontal' },
  { key: 'portrait', label: 'Vertical' },
];
const PRESETS: { key: string; label: string }[] = [
  { key: 'moderno', label: 'Moderno' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'promocao', label: 'Promoção' },
  { key: 'luxo', label: 'Luxo' },
  { key: 'alegre', label: 'Alegre' },
  { key: 'mercado', label: 'Mercado Local' },
];

// AI Banner Studio (mobile). Reached from a seller's listing in the account
// tab. Generates template-composited banners server-side and applies one to the
// listing; previews render the SVG via expo-image.
export default function BannerScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [productId, setProductId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [ratio, setRatio] = useState('square');
  const [preset, setPreset] = useState('moderno');
  const [prompt, setPrompt] = useState('');
  const [variants, setVariants] = useState<BannerVariant[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [aiUsed, setAiUsed] = useState<boolean | null>(null);
  const [quota, setQuota] = useState<BannerQuota | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!slug) return;
    getProduct(slug)
      .then((p) => setProductId(p.id))
      .catch(() => setProductId(''))
      .finally(() => setLoaded(true));
    bannerQuota()
      .then(setQuota)
      .catch(() => setQuota(null));
  }, [slug]);

  async function generate() {
    if (!productId) return;
    setBusy(true);
    try {
      const r = await generateBanner({
        productId,
        ratio,
        preset,
        prompt: prompt.trim() || undefined,
      });
      setVariants(r.variants);
      setSelected(r.variants[0]?.id ?? null);
      setAiUsed(r.aiUsed);
      setQuota(r.quota);
      setApplied(null);
    } catch (e) {
      Alert.alert('Banner', e instanceof Error ? e.message : 'Não foi possível gerar o banner.');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!selected) return;
    setApplying(true);
    try {
      await applyBanner(selected);
      setApplied(selected);
      Alert.alert('Banner aplicado', 'O banner foi aplicado ao anúncio.');
    } catch (e) {
      Alert.alert('Banner', e instanceof Error ? e.message : 'Não foi possível aplicar.');
    } finally {
      setApplying(false);
    }
  }

  const quotaLabel = quota?.isPro
    ? 'Loja Pro — sem limites'
    : quota
      ? quota.remaining > 0
        ? `${quota.remaining} grátis este mês`
        : `Grátis esgotados — ${quota.pointCost} pontos por banner`
      : '';

  return (
    <ScrollView style={{ backgroundColor: brand.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Banner com IA', headerBackTitle: 'Voltar' }} />

      {!loaded ? (
        <ActivityIndicator color={brand.green} style={{ marginTop: space.xl }} />
      ) : !productId ? (
        <Text style={styles.muted}>Inicie sessão como vendedor para criar banners.</Text>
      ) : (
        <>
          <Text style={styles.lead}>
            Cria um banner profissional para este anúncio em segundos.
          </Text>
          {quotaLabel ? <Text style={styles.quota}>{quotaLabel}</Text> : null}

          <Text style={styles.label}>Formato</Text>
          <View style={styles.chips}>
            {RATIOS.map((r) => (
              <Chip
                key={r.key}
                on={ratio === r.key}
                label={r.label}
                onPress={() => setRatio(r.key)}
              />
            ))}
          </View>

          <Text style={styles.label}>Estilo</Text>
          <View style={styles.chips}>
            {PRESETS.map((pr) => (
              <Chip
                key={pr.key}
                on={preset === pr.key}
                label={pr.label}
                onPress={() => setPreset(pr.key)}
              />
            ))}
          </View>

          <Text style={styles.label}>Pedido (opcional)</Text>
          <TextInput
            style={styles.input}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="ex.: estilo festivo, cores vivas…"
            placeholderTextColor={brand.muted}
            maxLength={120}
          />

          <Pressable style={styles.primary} onPress={generate} disabled={busy}>
            <Text style={styles.primaryText}>
              {busy ? 'A gerar…' : variants.length ? 'Gerar outra vez' : 'Gerar banner'}
            </Text>
          </Pressable>

          {variants.length > 0 ? (
            <>
              {aiUsed === false ? (
                <Text style={styles.note}>
                  Sugestão de IA indisponível de momento — o texto foi criado a partir do seu
                  anúncio.
                </Text>
              ) : null}
              <Text style={styles.label}>Escolha o seu preferido</Text>
              {variants.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => setSelected(v.id)}
                  style={[styles.card, selected === v.id && styles.cardOn]}
                >
                  <Image
                    style={styles.preview}
                    source={{ uri: bannerSvgUrl(v.id) }}
                    contentFit="cover"
                  />
                </Pressable>
              ))}

              <Pressable
                style={[styles.primary, (applying || applied === selected) && styles.primaryDim]}
                onPress={apply}
                disabled={applying || !selected || applied === selected}
              >
                <Text style={styles.primaryText}>
                  {applied === selected
                    ? 'Banner aplicado ✓'
                    : applying
                      ? 'A aplicar…'
                      : 'Aplicar ao anúncio'}
                </Text>
              </Pressable>
              <Text style={styles.muted}>
                {quota?.isPro
                  ? 'Banner gerado pela plataforma (sem custos de imagem externos).'
                  : 'Os banners grátis trazem a marca Nhonga. Loja Pro remove-a.'}
              </Text>
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.sm },
  lead: { color: brand.muted, fontSize: 14 },
  quota: {
    alignSelf: 'flex-start',
    backgroundColor: brand.surfaceSunken,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '600',
    color: brand.text,
    overflow: 'hidden',
  },
  label: { fontSize: 13, fontWeight: '700', color: brand.muted, marginTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: brand.surface,
  },
  chipOn: { backgroundColor: brand.green, borderColor: brand.green },
  chipText: { fontSize: 13, color: brand.text },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  input: {
    height: 46,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.md,
    backgroundColor: brand.surface,
    color: brand.text,
    fontSize: 15,
  },
  primary: {
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: brand.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  primaryDim: { opacity: 0.6 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  note: {
    backgroundColor: brand.surfaceSunken,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.md,
    padding: space.sm,
    fontSize: 12,
    color: brand.muted,
  },
  card: {
    borderWidth: 3,
    borderColor: 'transparent',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: brand.surfaceSunken,
  },
  cardOn: { borderColor: brand.green },
  preview: { width: '100%', aspectRatio: 1.2, backgroundColor: brand.surfaceSunken },
  muted: { color: brand.muted, fontSize: 12 },
});
