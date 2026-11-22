import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { chat, type ChatMessage } from '@/lib/api';
import { brand, radius, space } from '@/lib/theme';

const GREETING =
  'Olá! Sou o assistente do Nhonga. Posso ajudar com pagamentos, entregas, encomendas ou como vender. Em que posso ajudar?';

export default function AssistantScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: GREETING },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function send() {
    const text = input.trim();
    if (text === '' || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const data = await chat(next.slice(1)); // skip the local greeting
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Ocorreu um erro. Tenta novamente.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.role === 'user' ? styles.user : styles.assistant]}>
            <Text style={m.role === 'user' ? styles.userText : styles.assistantText}>
              {m.content}
            </Text>
          </View>
        ))}
        {busy ? (
          <View style={[styles.bubble, styles.assistant]}>
            <ActivityIndicator color={brand.muted} />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escreva a sua pergunta…"
          placeholderTextColor={brand.muted}
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[styles.send, (busy || input.trim() === '') && styles.sendDisabled]}
          onPress={send}
          disabled={busy || input.trim() === ''}
        >
          <Text style={styles.sendText}>Enviar</Text>
        </Pressable>
      </View>
      <Text style={styles.disclaimer}>
        Assistente de IA — pode cometer erros. Não partilhes palavras-passe nem códigos.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: brand.surfaceSunken },
  list: { padding: space.md, gap: space.sm },
  bubble: {
    maxWidth: '84%',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
  },
  assistant: {
    alignSelf: 'flex-start',
    backgroundColor: brand.white,
    borderWidth: 1,
    borderColor: brand.border,
    borderBottomLeftRadius: 4,
  },
  user: { alignSelf: 'flex-end', backgroundColor: brand.green, borderBottomRightRadius: 4 },
  assistantText: { color: brand.text, fontSize: 14, lineHeight: 20 },
  userText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.sm,
    backgroundColor: brand.white,
    borderTopWidth: 1,
    borderTopColor: brand.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.lg,
    backgroundColor: brand.surfaceSunken,
    color: brand.text,
  },
  send: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: brand.green,
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '600' },
  disclaimer: {
    padding: space.sm,
    fontSize: 11,
    color: brand.muted,
    textAlign: 'center',
    backgroundColor: brand.white,
  },
});
