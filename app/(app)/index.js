import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext.js';
import { auth } from '../../src/config/firebase.js';
import { locationService } from '../../src/services/locationService.js';
import { userApi } from '../../src/api/userApi.js';
import { donorApi } from '../../src/api/donorApi.js';
import { requestApi } from '../../src/api/requestApi.js';
import {
  resetHomeInitSession,
  tryBeginHomeInitSession,
  markHomeInitSessionCompleted,
  endHomeInitSessionInProgress,
  failHomeInitSession,
} from '../../src/utils/homeInitSession.js';
import { logLocationFlow, logLocationError, logBloodRequest, logBloodRequestError } from '../../src/utils/flowLog.js';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const hasLiveFirebaseSession = async () => {
  await auth.authStateReady();
  return !!auth.currentUser;
};

const waitForLiveFirebaseSession = async (maxAttempts = 10, delayMs = 200) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await auth.authStateReady();
    if (auth.currentUser) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
};

export default function HomeScreen() {
  const { logout, isAuthReady, isFirebaseAuthenticated, user } = useAuth();

  const [selectedBloodGroup, setSelectedBloodGroup] = useState('A+');
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastKnownLocation, setLastKnownLocation] = useState(null);
  const [requestingDonorId, setRequestingDonorId] = useState(null);

  const isAuthenticated =
    isAuthReady && isFirebaseAuthenticated && Boolean(user?._id);

  // Get location and update backend, then search donors
  const initializeHome = useCallback(async (bloodGroup, backendUserId) => {
    if (!tryBeginHomeInitSession(backendUserId)) {
      logLocationFlow('Home initialization skipped (already in progress or completed)');
      return;
    }

    logLocationFlow('Home initialization started');

    setLoading(true);
    setError(null);

    try {
      setLocationLoading(true);
      let location;
      try {
        location = await locationService.getCurrentLocation();
      } catch (locationError) {
        logLocationError('Location permission or GPS failed', locationError);
        failHomeInitSession();
        Alert.alert(
          'Location Required',
          'Location permission is required to find nearby donors. Please enable location access in settings and try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      setLocationLoading(false);
      setLastKnownLocation(location);

      const hasFirebaseSession = await waitForLiveFirebaseSession();
      logLocationFlow(`Firebase session ready for location update = ${hasFirebaseSession}`);

      if (!hasFirebaseSession) {
        failHomeInitSession();
        Alert.alert(
          'Authentication',
          'Sign-in is still completing. Please wait a moment and reopen the app if location cannot be saved.',
          [{ text: 'OK' }]
        );
        return;
      }

      try {
        logLocationFlow('Backend location update started');
        await userApi.updateLocation(location.latitude, location.longitude);
        logLocationFlow('Backend location update successful');
      } catch (updateError) {
        failHomeInitSession();
        if (!(await hasLiveFirebaseSession())) {
          logLocationError('Backend location update aborted — Firebase session lost', updateError);
          return;
        }
        logLocationError('Backend location update failed', updateError);
        Alert.alert(
          'Error',
          'Failed to update your location. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      try {
        logLocationFlow('Donor search starting');
        const result = await donorApi.searchDonors(bloodGroup, 10);
        setDonors(result.data || []);
        logLocationFlow(`Donor search result count = ${(result.data || []).length}`);
        markHomeInitSessionCompleted();
      } catch (searchError) {
        failHomeInitSession();
        if (!(await hasLiveFirebaseSession())) {
          logLocationError('Donor search aborted — Firebase session lost', searchError);
          return;
        }
        logLocationError('Donor search failed', searchError);
        Alert.alert(
          'Error',
          'Failed to search for donors. Please try again.',
          [{ text: 'OK' }]
        );
        setDonors([]);
      }
    } catch (err) {
      failHomeInitSession();
      logLocationError('Home initialization failed', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
      setLocationLoading(false);
      endHomeInitSessionInProgress();
    }
  }, []);

  // Run initialization once when Firebase auth and app user state are ready
  useEffect(() => {
    logLocationFlow(`auth ready = ${isAuthReady}`);
    logLocationFlow(`firebase authenticated = ${isFirebaseAuthenticated}`);
    logLocationFlow(`backend user exists = ${Boolean(user?._id)}`);

    if (!isAuthenticated || !user?._id) {
      if (!isAuthenticated) {
        resetHomeInitSession();
        logLocationFlow('Home initialization skipped (backend user not ready yet)');
      }
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      void initializeHome(selectedBloodGroup, user._id);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isAuthenticated, user?._id, initializeHome]);

  // Search donors when blood group changes
  const handleBloodGroupChange = useCallback(async (bloodGroup) => {
    if (!(await hasLiveFirebaseSession())) {
      return;
    }

    setSelectedBloodGroup(bloodGroup);
    setLoading(true);
    setError(null);

    try {
      const result = await donorApi.searchDonors(bloodGroup, 10);
      setDonors(result.data || []);
    } catch (err) {
      if (!(await hasLiveFirebaseSession())) {
        return;
      }
      console.error('Failed to search donors:', err);
      setError('Failed to search donors');
      setDonors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBloodRequest = useCallback(
    async (donor) => {
      if (!lastKnownLocation) {
        Alert.alert('Location Required', 'Your location is not available yet. Please wait and try again.');
        return;
      }

      logBloodRequest('Send button pressed');
      setRequestingDonorId(donor._id);

      try {
        logBloodRequest('API request started');
        const response = await requestApi.createRequest({
          bloodGroup: selectedBloodGroup,
          hospitalName: 'Nearby hospital',
          location: {
            latitude: lastKnownLocation.latitude,
            longitude: lastKnownLocation.longitude,
          },
          radius: 10,
        });
        logBloodRequest(`Backend response success = ${response?.success === true}`);
        Alert.alert('Request Sent', 'Nearby eligible donors will be notified.');
      } catch (requestError) {
        logBloodRequestError('Blood request failed', requestError);
        Alert.alert(
          'Request Failed',
          requestError.response?.data?.message || 'Could not send the blood request. Please try again.'
        );
      } finally {
        setRequestingDonorId(null);
      }
    },
    [lastKnownLocation, selectedBloodGroup]
  );

  const handleLogout = async () => {
    try {
      await logout();
    } catch (logoutError) {
      console.error('Logout failed:', logoutError);
    }
  };

  if (!isAuthReady || !user?._id) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!isFirebaseAuthenticated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={styles.loadingText}>Restoring authentication...</Text>
      </View>
    );
  }

  const renderBloodGroupButton = ({ item: bloodGroup }) => (
    <TouchableOpacity
      style={[
        styles.bloodGroupButton,
        selectedBloodGroup === bloodGroup && styles.bloodGroupButtonActive,
      ]}
      onPress={() => handleBloodGroupChange(bloodGroup)}
    >
      <Text
        style={[
          styles.bloodGroupButtonText,
          selectedBloodGroup === bloodGroup && styles.bloodGroupButtonTextActive,
        ]}
      >
        {bloodGroup}
      </Text>
    </TouchableOpacity>
  );

  const renderDonorCard = ({ item: donor }) => (
    <View style={styles.donorCard}>
      <Text style={styles.donorName}>{donor.name}</Text>
      <View style={styles.donorInfo}>
        <Text style={styles.donorBloodGroup}>🩸 {donor.bloodGroup}</Text>
        <Text style={styles.donorAvailability}>
          {donor.isAvailable ? '✓ Available' : '✗ Not Available'}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.requestButton,
          requestingDonorId === donor._id && styles.buttonDisabled,
        ]}
        onPress={() => handleBloodRequest(donor)}
        disabled={Boolean(requestingDonorId)}
      >
        {requestingDonorId === donor._id ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.requestButtonText}>Request Blood</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Find Donors</Text>
        <Text style={styles.subtitle}>
          {locationLoading ? 'Getting your location...' : 'Select blood group'}
        </Text>
      </View>

      {/* Blood Group Selector */}
      <View style={styles.section}>
        <FlatList
          data={BLOOD_GROUPS}
          renderItem={renderBloodGroupButton}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={true}
          contentContainerStyle={styles.bloodGroupList}
        />
      </View>

      {/* Donor List */}
      <View style={styles.donorListContainer}>
        {loading && !locationLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#208AEF" />
            <Text style={styles.loadingText}>Finding nearby donors...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : donors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No nearby donors found for {selectedBloodGroup}
            </Text>
          </View>
        ) : (
          <FlatList
            data={donors}
            renderItem={renderDonorCard}
            keyExtractor={(item) => item._id}
            scrollEnabled={true}
            contentContainerStyle={styles.donorList}
          />
        )}
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  bloodGroupList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  bloodGroupButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  bloodGroupButtonActive: {
    backgroundColor: '#208AEF',
    borderColor: '#208AEF',
  },
  bloodGroupButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  bloodGroupButtonTextActive: {
    color: '#fff',
  },
  donorListContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  donorList: {
    gap: 12,
  },
  donorCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#208AEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  donorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  donorInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  donorBloodGroup: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '600',
  },
  donorAvailability: {
    fontSize: 14,
    color: '#27ae60',
    fontWeight: '500',
  },
  requestButton: {
    marginTop: 12,
    backgroundColor: '#e74c3c',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
};
