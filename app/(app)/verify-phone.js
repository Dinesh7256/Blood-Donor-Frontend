import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext.js';
import { userApi } from '../../src/api/userApi.js';
import {
  sendPhoneOtp,
  verifyPhoneOtp,
  clearPhoneOtpSession,
} from '../../src/services/phoneAuthService.js';
import { formatIndianPhoneDisplay, validatePhone } from '../../src/utils/validation.js';
import { getPhoneAuthErrorMessage } from '../../src/utils/phoneAuthErrors.js';
import { getUserFriendlyErrorMessage } from '../../src/utils/errorMessages.js';
import { assertNetworkAvailable } from '../../src/utils/networkGuard.js';
import LoadingButton from '../../src/components/LoadingButton.js';
import FormFieldError from '../../src/components/FormFieldError.js';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const params = useLocalSearchParams();

  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const sentParam = Array.isArray(params.sent) ? params.sent[0] : params.sent;
  const savedPhone = user?.phone || phoneParam || '';
  const phoneDisplay = formatIndianPhoneDisplay(savedPhone);
  const initiallySent = sentParam === '1';

  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [statusMessage, setStatusMessage] = useState(
    initiallySent ? `Verification code sent to ${formatIndianPhoneDisplay(savedPhone)}` : ''
  );
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSavingVerification, setIsSavingVerification] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(
    initiallySent ? RESEND_COOLDOWN_SECONDS : 0
  );
  const [otpSent, setOtpSent] = useState(initiallySent);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearPhoneOtpSession();
    };
  }, []);

  useEffect(() => {
    if (resendSecondsLeft <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setResendSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSecondsLeft]);

  const startResendCooldown = useCallback(() => {
    setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
  }, []);

  const handleSendOtp = useCallback(async () => {
    if (isSendingOtp) {
      return;
    }

    const phoneResult = validatePhone(savedPhone, { required: true });
    if (!phoneResult.valid) {
      Alert.alert('Phone Number Required', phoneResult.message);
      return;
    }

    if (phoneResult.value !== user?.phone) {
      Alert.alert(
        'Save Profile First',
        'Save your phone number on the profile screen before verifying.'
      );
      return;
    }

    setIsSendingOtp(true);
    setOtpError('');
    setStatusMessage('Sending verification code...');

    try {
      await assertNetworkAvailable();
      await sendPhoneOtp(savedPhone);

      if (!isMountedRef.current) {
        return;
      }

      setOtpSent(true);
      setStatusMessage(`Verification code sent to ${formatIndianPhoneDisplay(savedPhone)}`);
      startResendCooldown();
    } catch (sendError) {
      if (!isMountedRef.current) {
        return;
      }

      const message = getPhoneAuthErrorMessage(
        sendError,
        'Unable to send the verification code right now. Please try again.'
      );
      setStatusMessage('');
      setOtpError(message);
    } finally {
      if (isMountedRef.current) {
        setIsSendingOtp(false);
      }
    }
  }, [isSendingOtp, savedPhone, startResendCooldown, user?.phone]);

  const handleVerifyOtp = async () => {
    if (isVerifyingOtp || isSavingVerification) {
      return;
    }

    if (!/^\d{6}$/.test(otpCode.trim())) {
      setOtpError('Enter the 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError('');

    try {
      await assertNetworkAvailable();
      await verifyPhoneOtp(otpCode);

      if (!isMountedRef.current) {
        return;
      }

      setIsSavingVerification(true);
      const response = await userApi.confirmPhoneVerification();

      if (!response?.success || !response?.data) {
        throw new Error('Backend phone verification sync failed');
      }

      await refreshUser(response.data);

      if (!isMountedRef.current) {
        return;
      }

      Alert.alert('Success', 'Phone number verified successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (verifyError) {
      if (!isMountedRef.current) {
        return;
      }

      const message = getPhoneAuthErrorMessage(
        verifyError,
        getUserFriendlyErrorMessage(
          verifyError,
          'Unable to verify your phone number right now. Please try again.'
        )
      );

      setOtpError(message);
    } finally {
      if (isMountedRef.current) {
        setIsVerifyingOtp(false);
        setIsSavingVerification(false);
      }
    }
  };

  const handleResendOtp = async () => {
    if (resendSecondsLeft > 0 || isSendingOtp) {
      return;
    }

    clearPhoneOtpSession();
    setOtpCode('');
    await handleSendOtp();
  };

  const isBusy = isSendingOtp || isVerifyingOtp || isSavingVerification;
  const canVerify = /^\d{6}$/.test(otpCode.trim()) && !isBusy && otpSent;

  if (user?.phoneVerified) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Phone Verified</Text>
          <Text style={styles.subtitle}>Your phone number is already verified.</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Back to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} disabled={isBusy}>
              <Text style={styles.backLink}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Verify Phone</Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.title}>Verify Your Phone Number</Text>
          <Text style={styles.subtitle}>
            {otpSent ? 'We sent a verification code to:' : 'Verification code will be sent to:'}
          </Text>
          <Text style={styles.phoneValue}>{phoneDisplay || 'Not set'}</Text>

          {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

          <View style={styles.otpContainer}>
            <TextInput
              style={[styles.otpInput, otpError && styles.inputError]}
              value={otpCode}
              onChangeText={(value) => {
                const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
                setOtpCode(digitsOnly);
                if (otpError) {
                  setOtpError('');
                }
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={6}
              placeholder="______"
              placeholderTextColor="#bbb"
              editable={!isBusy && otpSent}
            />
          </View>

          <FormFieldError message={otpError} />

          {!otpSent ? (
            <LoadingButton
              loading={isSendingOtp}
              loadingText="Sending verification code..."
              onPress={handleSendOtp}
              disabled={isBusy}
              variant="secondary"
            >
              Send Verification Code
            </LoadingButton>
          ) : (
            <LoadingButton
              loading={isVerifyingOtp || isSavingVerification}
              loadingText={isSavingVerification ? 'Saving verification...' : 'Verifying...'}
              onPress={handleVerifyOtp}
              disabled={!canVerify}
            >
              Verify
            </LoadingButton>
          )}

          <TouchableOpacity
            style={[styles.linkButton, (resendSecondsLeft > 0 || isSendingOtp) && styles.linkDisabled]}
            onPress={handleResendOtp}
            disabled={resendSecondsLeft > 0 || isSendingOtp || isBusy}
          >
            <Text style={styles.linkButtonText}>
              {isSendingOtp
                ? 'Sending verification code...'
                : resendSecondsLeft > 0
                  ? `Resend code in ${resendSecondsLeft} seconds`
                  : 'Resend code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()} disabled={isBusy}>
            <Text style={styles.secondaryButtonText}>Edit Number</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backLink: {
    color: '#208AEF',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 60,
  },
  headerSpacer: {
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
  },
  phoneValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 16,
  },
  statusMessage: {
    fontSize: 14,
    color: '#208AEF',
    marginBottom: 16,
  },
  otpContainer: {
    marginBottom: 8,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    backgroundColor: '#fff',
    color: '#333',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkDisabled: {
    opacity: 0.6,
  },
  linkButtonText: {
    color: '#208AEF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#208AEF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#208AEF',
    fontSize: 15,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
};
