import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext.js';
import { auth } from '../../src/config/firebase.js';
import { locationService } from '../../src/services/locationService.js';
import { userApi } from '../../src/api/userApi.js';
import { donorApi } from '../../src/api/donorApi.js';
import { BLOOD_GROUPS } from '../../src/constants/bloodGroups.js';
import {
  canCreateBloodRequest,
  getBloodRequestBlockMessage,
} from '../../src/utils/profileCompletion.js';
import {
  resetHomeInitSession,
  tryBeginHomeInitSession,
  markHomeInitSessionCompleted,
  endHomeInitSessionInProgress,
  failHomeInitSession,
  setHomeInitInFlightPromise,
  getHomeInitInFlightPromise,
  isHomeInitCompleted,
} from '../../src/utils/homeInitSession.js';
import {
  logLocationFlow,
  logLocationError,
  logHomeFlow,
} from '../../src/utils/flowLog.js';
import { getUserFriendlyErrorMessage } from '../../src/utils/errorMessages.js';
import { captureAuthSession } from '../../src/utils/authSession.js';
import { shouldContinueHomeInit } from '../../src/utils/homeInitGuards.js';
import EmptyState from '../../src/components/EmptyState.js';
import ErrorState from '../../src/components/ErrorState.js';
import LoadingButton from '../../src/components/LoadingButton.js';

const ensureFirebaseSessionForApi = async () => {
  await auth.authStateReady();
  if (!auth.currentUser) {
    return false;
  }
  await auth.currentUser.getIdToken();
  return true;
};

export default function HomeScreen() {
  const router = useRouter();
  const { logout, isAuthReady, isFirebaseAuthenticated, user, refreshUser } = useAuth();
  const initStartedForUserRef = useRef(null);

  const [selectedBloodGroup, setSelectedBloodGroup] = useState('A+');
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initFailed, setInitFailed] = useState(false);
  const [isCreatingRequestNav, setIsCreatingRequestNav] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isAuthenticated =
    isAuthReady && isFirebaseAuthenticated && Boolean(user?._id);

  const refreshDonorsOnly = useCallback(async (bloodGroup, backendUserId, sessionContext) => {
    setLoading(true);
    setError(null);

    try {
      const result = await donorApi.searchDonors(bloodGroup, 10);
      if (!shouldContinueHomeInit(backendUserId, sessionContext)) {
        return;
      }
      setDonors(result.data || []);
      setInitFailed(false);
    } catch (searchError) {
      if (!shouldContinueHomeInit(backendUserId, sessionContext)) {
        return;
      }
      setInitFailed(true);
      setError(
        getUserFriendlyErrorMessage(searchError, 'Failed to search for donors. Please try again.')
      );
      setDonors([]);
    } finally {
      if (shouldContinueHomeInit(backendUserId, sessionContext)) {
        setLoading(false);
      }
    }
  }, []);

  const runHomeInitialization = useCallback(async (bloodGroup, backendUserId, { force = false } = {}) => {
    const existingPromise = getHomeInitInFlightPromise();
    if (existingPromise && !force) {
      logHomeFlow('Waiting for in-flight Home initialisation');
      setLoading(true);
      return existingPromise.finally(() => {
        setLoading(false);
      });
    }

    if (!tryBeginHomeInitSession(backendUserId, { force })) {
      const sessionContext = captureAuthSession();

      if (isHomeInitCompleted() && !force) {
        logHomeFlow('Home initialisation skipped (already completed) — refreshing donors');
        return refreshDonorsOnly(bloodGroup, backendUserId, sessionContext);
      }

      logHomeFlow('Home initialisation skipped (already in progress)');
      return undefined;
    }

    const sessionContext = captureAuthSession();

    const initPromise = (async () => {
      logHomeFlow('Home initialisation started');

      if (!shouldContinueHomeInit(backendUserId, sessionContext)) {
        logHomeFlow('Home initialisation aborted before start — session ended');
        return;
      }

      setLoading(true);
      setError(null);
      setInitFailed(false);

      try {
        setLocationLoading(true);
        let location;
        try {
          location = await locationService.getCurrentLocation();
        } catch (locationError) {
          if (!shouldContinueHomeInit(backendUserId, sessionContext)) {
            logHomeFlow('Home initialisation aborted after location failure — session ended');
            return;
          }
          logLocationError('Location permission or GPS failed', locationError);
          failHomeInitSession();
          setInitFailed(true);
          setError(getUserFriendlyErrorMessage(locationError, 'Unable to get your location. Please try again.'));
          return;
        }
        setLocationLoading(false);

        if (!shouldContinueHomeInit(backendUserId, sessionContext)) {
          logHomeFlow('Home initialisation aborted after GPS — session ended');
          return;
        }

        const hasFirebaseSession = await ensureFirebaseSessionForApi();
        logLocationFlow(`Firebase session ready for location update = ${hasFirebaseSession}`);

        if (!hasFirebaseSession) {
          failHomeInitSession();
          setInitFailed(true);
          setError('Your session is still completing. Please try again.');
          return;
        }

        try {
          logLocationFlow('Backend location update started');
          const locationResponse = await userApi.updateLocation(location.latitude, location.longitude);
          logLocationFlow('Backend location update successful');
          if (locationResponse?.success && locationResponse?.data) {
            if (!shouldContinueHomeInit(backendUserId, sessionContext)) {
              logHomeFlow('Skipped refreshUser after location update — session ended');
              return;
            }
            await refreshUser(locationResponse.data, sessionContext);
          }
        } catch (updateError) {
          if (!shouldContinueHomeInit(backendUserId, sessionContext)) {
            logHomeFlow('Home initialisation aborted after location update failure — session ended');
            return;
          }
          failHomeInitSession();
          setInitFailed(true);
          logLocationError('Backend location update failed', updateError);
          const message = getUserFriendlyErrorMessage(
            updateError,
            'Failed to update your location. Please try again.'
          );
          setError(message);
          return;
        }

        if (!shouldContinueHomeInit(backendUserId, sessionContext)) {
          logHomeFlow('Home initialisation aborted before donor search — session ended');
          return;
        }

        try {
          logLocationFlow('Donor search starting');
          const result = await donorApi.searchDonors(bloodGroup, 10);
          if (!shouldContinueHomeInit(backendUserId, sessionContext)) {
            logHomeFlow('Home initialisation aborted after donor search — session ended');
            return;
          }
          setDonors(result.data || []);
          logLocationFlow(`Donor search result count = ${(result.data || []).length}`);
          markHomeInitSessionCompleted();
          setInitFailed(false);
        } catch (searchError) {
          if (!shouldContinueHomeInit(backendUserId, sessionContext)) {
            logHomeFlow('Home initialisation aborted after donor search failure — session ended');
            return;
          }
          failHomeInitSession();
          setInitFailed(true);
          logLocationError('Donor search failed', searchError);
          setError(
            getUserFriendlyErrorMessage(searchError, 'Failed to search for donors. Please try again.')
          );
          setDonors([]);
        }
      } catch (err) {
        if (!shouldContinueHomeInit(backendUserId, sessionContext)) {
          logHomeFlow('Home initialisation aborted after unexpected error — session ended');
          return;
        }
        failHomeInitSession();
        setInitFailed(true);
        logLocationError('Home initialisation failed', err);
        setError(getUserFriendlyErrorMessage(err));
      } finally {
        if (shouldContinueHomeInit(backendUserId, sessionContext)) {
          setLoading(false);
          setLocationLoading(false);
        }
        endHomeInitSessionInProgress();
      }
    })();

    setHomeInitInFlightPromise(initPromise);
    return initPromise;
  }, [refreshDonorsOnly, refreshUser]);

  useFocusEffect(
    useCallback(() => {
      setIsCreatingRequestNav(false);
      return undefined;
    }, [])
  );

  const handleRetryHomeInit = useCallback(() => {
    if (!user?._id) {
      return;
    }
    logHomeFlow('Manual Home initialisation retry requested');
    initStartedForUserRef.current = null;
    void runHomeInitialization(selectedBloodGroup, user._id, { force: true });
  }, [runHomeInitialization, selectedBloodGroup, user]);

  useEffect(() => {
    logHomeFlow(`auth ready = ${isAuthReady}`);
    logHomeFlow(`firebase authenticated = ${isFirebaseAuthenticated}`);
    logHomeFlow(`backend user exists = ${Boolean(user?._id)}`);

    if (!isAuthenticated || !user?._id) {
      if (!isAuthenticated) {
        resetHomeInitSession();
        initStartedForUserRef.current = null;
        logHomeFlow('Home initialisation skipped (backend user not ready yet)');
      }
      return undefined;
    }

    if (initStartedForUserRef.current === user._id) {
      logHomeFlow('Home initialisation skipped (already attempted for this user session)');
      return undefined;
    }

    initStartedForUserRef.current = user._id;
    void runHomeInitialization(selectedBloodGroup, user._id);

    return undefined;
    // Initial home setup only; blood-group changes use handleBloodGroupChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?._id, runHomeInitialization]);

  const handleBloodGroupChange = useCallback(async (bloodGroup) => {
    if (!(await ensureFirebaseSessionForApi())) {
      return;
    }

    setSelectedBloodGroup(bloodGroup);
    setLoading(true);
    setError(null);

    try {
      const result = await donorApi.searchDonors(bloodGroup, 10);
      setDonors(result.data || []);
    } catch (err) {
      logLocationError('Donor search failed after blood group change', err);
      setError(getUserFriendlyErrorMessage(err, 'Failed to search donors'));
      setDonors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateRequest = useCallback(() => {
    if (isCreatingRequestNav) {
      return;
    }

    if (!canCreateBloodRequest(user)) {
      Alert.alert(
        'Action Required',
        getBloodRequestBlockMessage(user),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Profile', onPress: () => router.push('/(app)/profile') },
        ]
      );
      return;
    }

    setIsCreatingRequestNav(true);
    router.push({
      pathname: '/(app)/create-request',
      params: { bloodGroup: selectedBloodGroup },
    });
  }, [isCreatingRequestNav, router, selectedBloodGroup, user]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await logout();
    } catch (logoutError) {
      console.error('Logout failed:', logoutError);
    } finally {
      setIsLoggingOut(false);
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
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>Find Donors</Text>
        </View>
        <Text style={styles.subtitle}>
          {locationLoading ? 'Getting your location...' : 'Select blood group'}
        </Text>
        {!canCreateBloodRequest(user) ? (
          <Text style={styles.profileHint}>Complete your profile to request blood.</Text>
        ) : null}
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

      <LoadingButton
        loading={isCreatingRequestNav}
        loadingText="Opening request form..."
        onPress={handleCreateRequest}
        variant="primary"
        style={styles.createRequestButton}
      >
        Request Blood
      </LoadingButton>

      {/* Donor List */}
      <View style={styles.donorListContainer}>
        {loading && !locationLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#208AEF" />
            <Text style={styles.loadingText}>Finding nearby donors...</Text>
          </View>
        ) : error ? (
          <ErrorState message={error} onRetry={initFailed ? handleRetryHomeInit : undefined} />
        ) : donors.length === 0 ? (
          <EmptyState
            title="No nearby donors"
            message={`No donors found nearby for ${selectedBloodGroup}. Try another blood group or check again later.`}
            actionLabel="Try Again"
            onAction={handleRetryHomeInit}
          />
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
      <TouchableOpacity
        style={[styles.logoutButton, isLoggingOut && styles.buttonDisabled]}
        onPress={handleLogout}
        disabled={isLoggingOut}
      >
        <Text style={styles.logoutButtonText}>{isLoggingOut ? 'Logging out...' : 'Logout'}</Text>
      </TouchableOpacity>
    </View>
    </SafeAreaView>
  );
}

const styles = {
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
    flexShrink: 1,
  },
  headerActionButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#208AEF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  headerActionText: {
    color: '#208AEF',
    fontSize: 12,
    fontWeight: '600',
  },
  profileButton: {
    backgroundColor: '#208AEF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  profileButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#e67e22',
  },
  createRequestButton: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  createRequestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#208AEF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
