import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext.js';
import { getFirebaseAuthErrorMessage } from '../../src/utils/authErrors.js';
import { logAuthDebug } from '../../src/utils/flowLog.js';
import { BLOOD_GROUPS } from '../../src/constants/bloodGroups.js';
import {
  validateName,
  validateEmail,
  validatePassword,
  validatePhone,
  validateBloodGroup,
} from '../../src/utils/validation.js';
import {
  validateRegistrationForm,
  getFirstValidationError,
} from '../../src/utils/formValidation.js';
import { assertNetworkAvailable } from '../../src/utils/networkGuard.js';
import LoadingButton from '../../src/components/LoadingButton.js';
import FormFieldError from '../../src/components/FormFieldError.js';

const validators = {
  validateName,
  validateEmail,
  validatePassword,
  validatePhone,
  validateBloodGroup,
};

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [showBloodGroupPicker, setShowBloodGroupPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const router = useRouter();
  const { register } = useAuth();

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleRegister = async () => {
    const errors = validateRegistrationForm({
      name,
      email,
      password,
      phone,
      bloodGroup,
      validators,
    });
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
      logAuthDebug('Register button pressed');
      await assertNetworkAvailable();
      await register(
        validateEmail(email).value,
        validatePassword(password).value,
        validateName(name).value,
        validatePhone(phone, { required: true }).value,
        validateBloodGroup(bloodGroup).value
      );
      logAuthDebug('Register completed successfully');
    } catch (error) {
      logAuthDebug(`Register failed: ${error?.message || error}`);
      Alert.alert(
        'Registration Error',
        getFirebaseAuthErrorMessage(error, 'Registration failed. Please try again.')
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
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join us to help save lives</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={[styles.input, fieldErrors.name && styles.inputError]}
                  placeholder="Enter your full name"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    clearFieldError('name');
                  }}
                  editable={!loading}
                />
                <FormFieldError message={fieldErrors.name} />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, fieldErrors.email && styles.inputError]}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    clearFieldError('email');
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
                  placeholder="Enter a password (min 6 characters)"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    clearFieldError('password');
                  }}
                  editable={!loading}
                  secureTextEntry
                />
                <FormFieldError message={fieldErrors.password} />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={[styles.input, fieldErrors.phone && styles.inputError]}
                  placeholder="Enter your mobile number"
                  placeholderTextColor="#999"
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(value);
                    clearFieldError('phone');
                  }}
                  editable={!loading}
                  keyboardType="phone-pad"
                />
                <FormFieldError message={fieldErrors.phone} />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Blood Group</Text>
                <TouchableOpacity
                  style={[styles.bloodGroupButton, fieldErrors.bloodGroup && styles.inputError]}
                  onPress={() => setShowBloodGroupPicker(!showBloodGroupPicker)}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.bloodGroupButtonText,
                      !bloodGroup && styles.bloodGroupPlaceholder,
                    ]}
                  >
                    {bloodGroup || 'Select your blood group'}
                  </Text>
                </TouchableOpacity>
                <FormFieldError message={fieldErrors.bloodGroup} />

                {showBloodGroupPicker ? (
                  <View style={styles.bloodGroupPicker}>
                    {BLOOD_GROUPS.map((group) => (
                      <TouchableOpacity
                        key={group}
                        style={styles.bloodGroupOption}
                        onPress={() => {
                          setBloodGroup(group);
                          setShowBloodGroupPicker(false);
                          clearFieldError('bloodGroup');
                        }}
                      >
                        <Text
                          style={[
                            styles.bloodGroupOptionText,
                            bloodGroup === group && styles.bloodGroupOptionSelected,
                          ]}
                        >
                          {group}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>

              <LoadingButton
                loading={loading}
                loadingText="Creating account..."
                onPress={handleRegister}
              >
                Create Account
              </LoadingButton>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Text
                style={styles.loginLink}
                onPress={() => !loading && router.push('/(auth)/login')}
              >
                Login here
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
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  container: {
    padding: 20,
  },
  header: {
    marginTop: 16,
    marginBottom: 24,
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
    gap: 16,
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
  bloodGroupButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  bloodGroupButtonText: {
    fontSize: 16,
    color: '#333',
  },
  bloodGroupPlaceholder: {
    color: '#999',
  },
  bloodGroupPicker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 4,
    overflow: 'hidden',
  },
  bloodGroupOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  bloodGroupOptionText: {
    fontSize: 16,
    color: '#333',
  },
  bloodGroupOptionSelected: {
    color: '#e74c3c',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
  },
};
