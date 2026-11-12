import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { DEMO_EXPIRED_CODE, DEMO_OTP_CODE } from '@/data/demo/DemoBackend';
import { RepoError } from '@/data/repository';
import { useApp } from '@/state/AppContext';
import { Button } from './components';
import { errorMessage } from './errors';
import { colors, MIN_TAP, radius, space, type } from './theme';

const RESEND_COOLDOWN_SEC = 60;

/** メールOTP認証。送信 → コード入力 → 期限切れ・誤り → 再送 まで扱う */
export function OtpLogin({ onSignedIn }: { onSignedIn?: () => void }) {
  const { backend, isDemo } = useApp();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const send = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await backend.auth.sendOtp(email.trim());
      setStep('code');
      setCode('');
      setCooldown(RESEND_COOLDOWN_SEC);
      setInfo(isDemo ? 'デモのため、メールは送信していません。' : `${email.trim()} に6桁の確認コードを送りました。`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await backend.auth.verifyOtp(email.trim(), code.trim());
      onSignedIn?.();
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof RepoError && e.kind === 'otp_invalid_or_expired') setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      {isDemo ? (
        <View style={{ backgroundColor: colors.demoBg, padding: space.md, borderRadius: radius.md }}>
          <Text style={{ color: colors.demo, fontWeight: '700' }}>デモの模擬ログインです</Text>
          <Text style={type.small}>
            実際のログイン・メール送信は行いません。コード欄に {DEMO_OTP_CODE} を入力すると模擬ログインします（{DEMO_EXPIRED_CODE} で期限切れ表示を確認できます）。
          </Text>
        </View>
      ) : null}
      {step === 'email' ? (
        <>
          <Text style={type.label}>メールアドレス</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            style={input}
            accessibilityLabel="メールアドレス"
          />
          <Button label="確認コードを送る" onPress={send} loading={busy} disabled={!emailValid} disabledReason={!emailValid && email ? 'メールアドレスの形式を確認してください' : undefined} />
        </>
      ) : (
        <>
          {info ? <Text style={type.body}>{info}</Text> : null}
          <Text style={type.label}>確認コード（6桁）</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            placeholder="123456"
            placeholderTextColor={colors.textMuted}
            style={input}
            accessibilityLabel="確認コード6桁"
          />
          <Button label="確認してログイン" onPress={verify} loading={busy} disabled={code.length !== 6} />
          <Button
            label={cooldown > 0 ? `コードを再送（${cooldown}秒後に可能）` : 'コードを再送'}
            variant="secondary"
            onPress={send}
            disabled={cooldown > 0 || busy}
          />
          <Button label="メールアドレスを変更" variant="ghost" onPress={() => setStep('email')} />
          <Text style={type.small}>コードには有効期限があります。期限が切れた場合は再送してください。</Text>
        </>
      )}
      {error ? (
        <Text style={{ color: colors.bad, fontSize: 15 }} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const input = {
  minHeight: MIN_TAP,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.md,
  paddingHorizontal: space.md,
  fontSize: 16,
  color: colors.text,
  backgroundColor: colors.surface,
};
