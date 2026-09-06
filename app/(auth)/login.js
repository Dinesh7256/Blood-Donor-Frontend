import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext.js';
import { getFirebaseAuthErrorMessage } from '../../src/utils/authErrors.js';
import { logAuthDebug } from '../../src/utils/flowLog.js';
import { validateEmail, validatePassword } from '../../src/utils/validation.js';
import { validateLoginForm, getFirstValidationError } from '../../src/utils/formValidation.js';
import { assertNetworkAvailable } from '../../src/utils/networkGuard.js';
import LoadingButton from '../../src/components/LoadingButton.js';
import FormFieldError from '../../src/components/FormFieldError.js';

const validators = { validateEmail, validatePassword };

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    const errors = validateLoginForm({ email, password, validators });
    setFieldErrors(errors);

    if (Object.keys(errors).length) {
      Alert.alert('Please correct the highlighted information.', getFirstValidationError(errors));
      return;
    }

    if (loading) {
      return;
    }

    setLoading(true);

    try {
      logAuthDebug('Login button pressed');
      await assertNetworkAvailable();
      const emailResult = validateEmail(email);
      const passwordResult = validatePassword(password);
      await login(emailResult.value, passwordResult.value);
      logAuthDebug('Login completed successfully');
    } catch (error) {
      logAuthDebug(`Login failed: ${error?.message || error}`);
      Alert.alert(
        'Login Error',
        getFirebaseAuthErrorMessage(error, 'Login failed. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Blood Donor Finder</Text>
              <Text style={styles.subtitle}>Login to your account</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, fieldErrors.email && styles.inputError]}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  editable={!loading}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <FormFieldError message={fieldErrors.email} />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={[styles.input, fieldErrors.password && styles.inputError]}
                  placeholder="Enter your password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  editable={!loading}
                  secureTextEntry
                />
                <FormFieldError message={fieldErrors.password} />
              </View>

              <LoadingButton loading={loading} loadingText="Logging in..." onPress={handleLogin}>
                Login
              </LoadingButton>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don&apos;t have an account? </Text>
              <Text
                style={styles.registerLink}
                onPress={() => !loading && router.push('/(auth)/register')}
              >
                Register here
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { flexGrow: 1 },
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 24,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    gap: 20,
  },
  fieldContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  registerLink: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
  },
};
