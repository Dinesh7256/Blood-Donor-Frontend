import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext.js';
import { userApi } from '../../src/api/userApi.js';
import { locationService } from '../../src/services/locationService.js';
import { BLOOD_GROUPS } from '../../src/constants/bloodGroups.js';
import {
  validateName,
  validatePhone,
  validateBloodGroup,
  validateAddress,
  formatIndianPhoneDisplay,
  normalizeIndianPhone,
} from '../../src/utils/validation.js';
import {
  isProfileComplete,
  getMissingFieldLabels,
  getLocationStatusLabel,
} from '../../src/utils/profileCompletion.js';
import { getUserFriendlyErrorMessage } from '../../src/utils/errorMessages.js';
import { assertNetworkAvailable } from '../../src/utils/networkGuard.js';
import { sendPhoneOtp } from '../../src/services/phoneAuthService.js';
import { getPhoneAuthErrorMessage } from '../../src/utils/phoneAuthErrors.js';
import LoadingButton from '../../src/components/LoadingButton.js';
import FormFieldError from '../../src/components/FormFieldError.js';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [address, setAddress] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const [showBloodGroupPicker, setShowBloodGroupPicker] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [startingVerification, setStartingVerification] = useState(false);

  const syncFormFromUser = useCallback((profileUser) => {
    if (!profileUser) {
      return;
    }
    setName(profileUser.name || '');
    setPhone(profileUser.phone || '');
    setBloodGroup(profileUser.bloodGroup || '');
    setAddress(profileUser.address || '');
    setIsAvailable(Boolean(profileUser.isAvailable));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const response = await userApi.getProfile();
        if (isMounted && response?.success && response?.data) {
          syncFormFromUser(response.data);
          await refreshUser(response.data);
        }
      } catch (loadError) {
        if (isMounted) {
          Alert.alert(
            'Error',
            getUserFriendlyErrorMessage(loadError, 'Unable to load your profile. Please try again.')
          );
        }
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
    // Load once on mount; form is updated after save/location refresh explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async () => {
    const nameResult = validateName(name);
    const phoneResult = validatePhone(phone, { required: true });
    const bloodGroupResult = validateBloodGroup(bloodGroup);
    const addressResult = validateAddress(address, { required: false });
    const nextErrors = {};

    if (!nameResult.valid) nextErrors.name = nameResult.message;
    if (!phoneResult.valid) nextErrors.phone = phoneResult.message;
    if (!bloodGroupResult.valid) nextErrors.bloodGroup = bloodGroupResult.message;
    if (!addressResult.valid) nextErrors.address = addressResult.message;

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      Alert.alert('Please correct the highlighted information.');
      return;
    }

    if (saving) {
      return;
    }

    setSaving(true);

    try {
      await assertNetworkAvailable();
      const response = await userApi.updateProfile({
        name: nameResult.value,
        phone: phoneResult.value,
        bloodGroup: bloodGroupResult.value,
        address: addressResult.value,
        isAvailable,
      });

      if (response?.success && response?.data) {
        await refreshUser(response.data);
        syncFormFromUser(response.data);
        Alert.alert('Success', 'Profile updated successfully.');
      }
    } catch (saveError) {
      const message = getUserFriendlyErrorMessage(
        saveError,
        'Unable to update your profile. Please try again.'
      );
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyPhone = async () => {
    if (startingVerification || saving || updatingLocation) {
      return;
    }

    const phoneResult = validatePhone(phone, { required: true });
    if (!phoneResult.valid) {
      setFieldErrors((prev) => ({ ...prev, phone: phoneResult.message }));
      Alert.alert('Phone Number Required', phoneResult.message);
      return;
    }

    if (phoneResult.value !== user?.phone) {
      Alert.alert(
        'Save Profile First',
        'Save your phone number before verifying. Changing your number requires verification again.'
      );
      return;
    }

    if (user?.phoneVerified) {
      Alert.alert('Already Verified', 'Your phone number is already verified.');
      return;
    }

    setStartingVerification(true);

    try {
      await assertNetworkAvailable();
      await sendPhoneOtp(phoneResult.value);
      router.push({
        pathname: '/(app)/verify-phone',
        params: { phone: phoneResult.value, sent: '1' },
      });
    } catch (verificationError) {
      Alert.alert(
        'Verification Error',
        getPhoneAuthErrorMessage(
          verificationError,
          getUserFriendlyErrorMessage(
            verificationError,
            'Unable to send the verification code right now. Please try again.'
          )
        )
      );
    } finally {
      setStartingVerification(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (updatingLocation) {
      return;
    }

    setUpdatingLocation(true);

    try {
      await assertNetworkAvailable();
      const location = await locationService.getCurrentLocation();
      const response = await userApi.updateLocation(location.latitude, location.longitude);

      if (response?.success && response?.data) {
        await refreshUser(response.data);
        Alert.alert('Success', 'Location updated successfully.');
      }
    } catch (locationError) {
      Alert.alert(
        'Location Error',
        getUserFriendlyErrorMessage(locationError, 'Unable to update your location. Please try again.')
      );
    } finally {
      setUpdatingLocation(false);
    }
  };

  const profileComplete = isProfileComplete(user);
  const missingFieldLabels = getMissingFieldLabels(user);
  const locationStatus = getLocationStatusLabel(user);
  const phoneDisplay = formatIndianPhoneDisplay(user?.phone || phone);
  const phoneVerified = Boolean(user?.phoneVerified);
  const normalizedFormPhone = normalizeIndianPhone(phone);
  const phoneDirty = Boolean(normalizedFormPhone && normalizedFormPhone !== user?.phone);

  if (loadingProfile && !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} disabled={saving || updatingLocation}>
              <Text style={styles.backLink}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Profile</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Profile Status</Text>
            <Text style={[styles.statusValue, profileComplete ? styles.statusGood : styles.statusWarn]}>
              {profileComplete ? '✓ Profile complete' : '⚠ Complete your profile'}
            </Text>
            {profileComplete && !phoneVerified ? (
              <Text style={[styles.summaryHint, styles.statusWarn]}>
                Phone verification is required before requesting blood.
              </Text>
            ) : null}
            {!profileComplete && missingFieldLabels.length ? (
              <View style={styles.missingFieldsBox}>
                <Text style={styles.missingFieldsTitle}>Missing:</Text>
                {missingFieldLabels.map((label) => (
                  <Text key={label} style={styles.missingFieldItem}>
                    • {label}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Full Name</Text>
            <Text style={styles.summaryValue}>{name || 'Not set'}</Text>
            <Text style={styles.summaryLabel}>Email Address</Text>
            <Text style={styles.summaryValue}>{user?.email || 'Not set'}</Text>
            <Text style={styles.summaryLabel}>Phone Number</Text>
            <Text style={styles.summaryValue}>{phoneDisplay || 'Not set'}</Text>
            <Text style={[styles.summaryHint, phoneVerified ? styles.statusGood : styles.statusWarn]}>
              Status: {phoneVerified ? '✓ Verified' : '⚠ Not verified'}
            </Text>
            <Text style={styles.summaryLabel}>Blood Group</Text>
            <Text style={styles.summaryValue}>{bloodGroup || 'Not set'}</Text>
            <Text style={styles.summaryLabel}>Area / Address</Text>
            <Text style={styles.summaryValue}>{address || 'Optional — add for easier coordination'}</Text>
          </View>

          <Text style={styles.sectionTitle}>Edit Profile</Text>

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
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                editable={!saving && !updatingLocation}
              />
              <FormFieldError message={fieldErrors.name} />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={[styles.input, styles.inputReadOnly]}
                value={user?.email || ''}
                editable={false}
              />
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
                  if (fieldErrors.phone) {
                    setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }
                }}
                editable={!saving && !updatingLocation}
                keyboardType="phone-pad"
              />
              <FormFieldError message={fieldErrors.phone} />
              {!phoneVerified && user?.phone && !phoneDirty ? (
                <LoadingButton
                  loading={startingVerification}
                  loadingText="Sending verification code..."
                  onPress={handleVerifyPhone}
                  disabled={saving || updatingLocation}
                  variant="secondary"
                >
                  Verify Phone Number
                </LoadingButton>
              ) : null}
              {!user?.phone ? (
                <Text style={styles.summaryHint}>Add and save your phone number to verify it.</Text>
              ) : null}
              {phoneDirty ? (
                <Text style={styles.summaryHint}>
                  Save your profile to apply the new phone number. Verification will reset.
                </Text>
              ) : null}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Blood Group</Text>
              <TouchableOpacity
                style={styles.bloodGroupButton}
                onPress={() => setShowBloodGroupPicker(!showBloodGroupPicker)}
                disabled={saving || updatingLocation}
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

              {showBloodGroupPicker ? (
                <View style={styles.bloodGroupPicker}>
                  {BLOOD_GROUPS.map((group) => (
                    <TouchableOpacity
                      key={group}
                      style={styles.bloodGroupOption}
                      onPress={() => {
                        setBloodGroup(group);
                        setShowBloodGroupPicker(false);
                        if (fieldErrors.bloodGroup) {
                          setFieldErrors((prev) => ({ ...prev, bloodGroup: undefined }));
                        }
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
              <FormFieldError message={fieldErrors.bloodGroup} />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Area / Address (optional)</Text>
              <TextInput
                style={[styles.input, styles.messageInput, fieldErrors.address && styles.inputError]}
                placeholder="e.g. Khandagiri, Bhubaneswar"
                placeholderTextColor="#999"
                value={address}
                onChangeText={(value) => {
                  setAddress(value);
                  if (fieldErrors.address) {
                    setFieldErrors((prev) => ({ ...prev, address: undefined }));
                  }
                }}
                editable={!saving && !updatingLocation}
                multiline
              />
              <FormFieldError message={fieldErrors.address} />
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>Location Status</Text>
              <Text style={[styles.statusValue, profileComplete ? styles.statusGood : styles.statusWarn]}>
                {locationStatus}
              </Text>
              <TouchableOpacity
                style={[styles.secondaryButton, updatingLocation && styles.buttonDisabled]}
                onPress={handleUpdateLocation}
                disabled={updatingLocation || saving}
              >
              {updatingLocation ? (
                <ActivityIndicator color="#208AEF" size="small" />
              ) : (
                <Text style={styles.secondaryButtonText}>Update Location</Text>
              )}
            </TouchableOpacity>
            {updatingLocation ? (
              <Text style={styles.processingText}>Updating location...</Text>
            ) : null}
          </View>

            <View style={styles.availabilityRow}>
              <View style={styles.availabilityText}>
                <Text style={styles.label}>Available to Donate</Text>
                <Text style={styles.availabilityHint}>
                  {isAvailable ? 'ON — visible to nearby requests' : 'OFF — hidden from donor search'}
                </Text>
              </View>
              <Switch
                value={isAvailable}
                onValueChange={setIsAvailable}
                disabled={saving || updatingLocation}
                trackColor={{ false: '#ccc', true: '#208AEF' }}
                thumbColor="#fff"
              />
            </View>

            <LoadingButton
              loading={saving}
              loadingText="Saving profile..."
              onPress={handleSaveProfile}
              disabled={updatingLocation}
              variant="secondary"
            >
              Save Profile
            </LoadingButton>
          </View>
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
    marginBottom: 20,
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#208AEF',
  },
  statusLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  statusGood: {
    color: '#27ae60',
  },
  statusWarn: {
    color: '#e67e22',
  },
  missingFieldsBox: {
    marginTop: 8,
    gap: 4,
  },
  missingFieldsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  missingFieldItem: {
    fontSize: 14,
    color: '#e67e22',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  summaryHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  messageInput: {
    minHeight: 72,
    textAlignVertical: 'top',
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
  inputReadOnly: {
    backgroundColor: '#f0f0f0',
    color: '#666',
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
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  availabilityText: {
    flex: 1,
  },
  availabilityHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#208AEF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: {
    color: '#208AEF',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#208AEF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  processingText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
};
