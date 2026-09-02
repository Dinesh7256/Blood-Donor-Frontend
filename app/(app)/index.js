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
import { locationService } from '../../src/services/locationService.js';
import { userApi } from '../../src/api/userApi.js';
import { donorApi } from '../../src/api/donorApi.js';
import { auth } from '../../src/config/firebase.js';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function HomeScreen() {
  const { logout, isAuthReady, user } = useAuth();

  const [selectedBloodGroup, setSelectedBloodGroup] = useState('A+');
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAuthenticated = isAuthReady && !!user && !!auth.currentUser;

  // Get location and update backend, then search donors
  const initializeHome = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Request and get location
      setLocationLoading(true);
      let location;
      try {
        location = await locationService.getCurrentLocation();
      } catch (_locationError) {
        // Permission denied or location failure
        setLocationLoading(false);
        Alert.alert(
          'Location Required',
          'Location permission is required to find nearby donors. Please enable location access in settings and try again.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }
      setLocationLoading(false);

      // Step 2: Update location in backend
      try {
        await userApi.updateLocation(location.latitude, location.longitude);
      } catch (updateError) {
        console.error('Failed to update location:', updateError);
        Alert.alert(
          'Error',
          'Failed to update your location. Please try again.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      // Step 3: Search donors with default blood group
      try {
        const result = await donorApi.searchDonors(selectedBloodGroup, 10);
        setDonors(result.data || []);
      } catch (searchError) {
        console.error('Failed to search donors:', searchError);
        Alert.alert(
          'Error',
          'Failed to search for donors. Please try again.',
          [{ text: 'OK' }]
        );
        setDonors([]);
      }
    } catch (err) {
      console.error('Initialization error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [selectedBloodGroup]);

  // Run initialization only when Firebase auth and app user state are ready
  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let cancelled = false;

    const runInitialization = async () => {
      if (!cancelled) {
        await initializeHome();
      }
    };

    runInitialization();

    return () => {
      cancelled = true;
    };
  }, [initializeHome, isAuthenticated]);

  // Search donors when blood group changes
  const handleBloodGroupChange = useCallback(async (bloodGroup) => {
    if (!isAuthenticated) {
      return;
    }

    setSelectedBloodGroup(bloodGroup);
    setLoading(true);
    setError(null);

    try {
      const result = await donorApi.searchDonors(bloodGroup, 10);
      setDonors(result.data || []);
    } catch (err) {
      console.error('Failed to search donors:', err);
      setError('Failed to search donors');
      setDonors([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (logoutError) {
      console.error('Logout failed:', logoutError);
    }
  };

  if (!isAuthReady || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!auth.currentUser) {
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
