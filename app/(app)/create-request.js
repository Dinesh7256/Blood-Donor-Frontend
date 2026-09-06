import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext.js';
import { requestApi } from '../../src/api/requestApi.js';
import { BLOOD_GROUPS } from '../../src/constants/bloodGroups.js';
import { validateBloodGroup, validateHospitalName } from '../../src/utils/validation.js';
import {
  canCreateBloodRequest,
  getProfileCompletionMessage,
} from '../../src/utils/profileCompletion.js';
import { getUserFriendlyErrorMessage } from '../../src/utils/errorMessages.js';
import { assertNetworkAvailable } from '../../src/utils/networkGuard.js';
import { logBloodRequest, logBloodRequestError } from '../../src/utils/flowLog.js';
import LoadingButton from '../../src/components/LoadingButton.js';
import FormFieldError from '../../src/components/FormFieldError.js';

export default function CreateRequestScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const initialBloodGroup = Array.isArray(params.bloodGroup)
    ? params.bloodGroup[0]
    : params.bloodGroup || 'A+';

  const [bloodGroup, setBloodGroup] = useState(
    BLOOD_GROUPS.includes(initialBloodGroup) ? initialBloodGroup : 'A+'
  );
  const [hospitalName, setHospitalName] = useState('');
  const [message, setMessage] = useState('');
  const [emergency, setEmergency] = useState(true);
  const [showBloodGroupPicker, setShowBloodGroupPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async () => {
    if (!canCreateBloodRequest(user)) {
      Alert.alert('Profile Incomplete', getProfileCompletionMessage(), [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete Profile', onPress: () => router.push('/(app)/profile') },
      ]);
      return;
    }

    const bloodGroupResult = validateBloodGroup(bloodGroup);
    const hospitalResult = validateHospitalName(hospitalName);
    const nextErrors = {};

    if (!bloodGroupResult.valid) nextErrors.bloodGroup = bloodGroupResult.message;
    if (!hospitalResult.valid) nextErrors.hospitalName = hospitalResult.message;

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      Alert.alert('Please correct the highlighted information.');
      return;
    }

    const coordinates = user?.location?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      Alert.alert(
        'Location Required',
        'Your saved location is required. Update your location from Profile and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Profile', onPress: () => router.push('/(app)/profile') },
        ]
      );
      return;
    }

    if (submitting) {
      return;
    }

    setSubmitting(true);
    logBloodRequest('Create request form submitted');

    try {
      await assertNetworkAvailable();
      const [longitude, latitude] = coordinates;
      const response = await requestApi.createRequest({
        bloodGroup: bloodGroupResult.value,
        hospitalName: hospitalResult.value,
        message: message.trim() || undefined,
        emergency,
        location: {
          latitude,
          longitude,
        },
        radius: 10,
      });

      logBloodRequest(`Create request success = ${response?.success === true}`);
      const donorCount = response?.eligibleDonors ?? response?.data?.summary?.notified ?? 0;
      Alert.alert(
        'Request Sent',
        donorCount > 0
          ? `Blood request sent successfully to ${donorCount} nearby eligible donor${donorCount === 1 ? '' : 's'}.`
          : 'Blood request sent successfully. No eligible donors were found nearby right now.',
        [{ text: 'OK', onPress: () => router.replace('/(app)/my-requests') }]
      );
    } catch (error) {
      logBloodRequestError('Create request failed', error);

      if (error?.response?.status === 403) {
        Alert.alert('Profile Incomplete', getProfileCompletionMessage(), [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete Profile', onPress: () => router.push('/(app)/profile') },
        ]);
        return;
      }

      if (error?.response?.status === 409) {
        Alert.alert(
          'Request Already Sent',
          error?.response?.data?.message || 'You already have an active request for this blood group.',
          [{ text: 'View Requests', onPress: () => router.replace('/(app)/my-requests') }]
        );
        return;
      }

      Alert.alert(
        'Request Failed',
        getUserFriendlyErrorMessage(error, 'Unable to send your blood request. Please try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} disabled={submitting}>
              <Text style={styles.backLink}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Request Blood</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.form}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Blood Group Required</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowBloodGroupPicker(!showBloodGroupPicker)}
                disabled={submitting}
              >
                <Text style={styles.pickerButtonText}>{bloodGroup}</Text>
              </TouchableOpacity>
              {showBloodGroupPicker ? (
                <View style={styles.pickerList}>
                  {BLOOD_GROUPS.map((group) => (
                    <TouchableOpacity
                      key={group}
                      style={styles.pickerOption}
                      onPress={() => {
                        setBloodGroup(group);
                        setShowBloodGroupPicker(false);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>{group}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Hospital / Location Detail</Text>
              <TextInput
                style={[styles.input, fieldErrors.hospitalName && styles.inputError]}
                placeholder="e.g. Capital Hospital, Bhubaneswar"
                placeholderTextColor="#999"
                value={hospitalName}
                onChangeText={(value) => {
                  setHospitalName(value);
                  if (fieldErrors.hospitalName) {
                    setFieldErrors((prev) => ({ ...prev, hospitalName: undefined }));
                  }
                }}
                editable={!submitting}
              />
              <FormFieldError message={fieldErrors.hospitalName} />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Message (optional)</Text>
              <TextInput
                style={[styles.input, styles.messageInput]}
                placeholder="Brief details for donors"
                placeholderTextColor="#999"
                value={message}
                onChangeText={setMessage}
                editable={!submitting}
                multiline
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Emergency request</Text>
              <Switch
                value={emergency}
                onValueChange={setEmergency}
                disabled={submitting}
                trackColor={{ false: '#ccc', true: '#e74c3c' }}
                thumbColor="#fff"
              />
            </View>

            <LoadingButton
              loading={submitting}
              loadingText="Sending request..."
              onPress={handleSubmit}
            >
              Send Request
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
  messageInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  pickerList: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  submitButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  processingText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
};
