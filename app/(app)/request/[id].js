import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { requestApi } from '../../../src/api/requestApi.js';
import { formatDistanceKm } from '../../../src/utils/distance.js';
import { formatTimeAgo } from '../../../src/utils/timeAgo.js';
import { assertNetworkAvailable } from '../../../src/utils/networkGuard.js';
import { getUserFriendlyErrorMessage } from '../../../src/utils/errorMessages.js';
import {
  DONOR_RESPONSE_STATUS,
  REQUEST_LIFECYCLE_STATUS,
  getDonorResponseLabel,
  getRequestLifecycleLabel,
} from '../../../src/constants/requestStatuses.js';

export default function RequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const requestId = Array.isArray(id) ? id[0] : id;

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [respondingAction, setRespondingAction] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const loadRequest = useCallback(async () => {
    if (!requestId) {
      return;
    }

    setLoading(true);

    try {
      const response = await requestApi.getRequestById(requestId);
      setRequest(response?.data || null);
    } catch (error) {
      Alert.alert(
        'Error',
        getUserFriendlyErrorMessage(error, 'Unable to load this request. Please try again.'),
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } finally {
      setLoading(false);
    }
  }, [requestId, router]);

  useFocusEffect(
    useCallback(() => {
      void loadRequest();
    }, [loadRequest])
  );

  const handleRespond = async (response) => {
    if (responding) {
      return;
    }

    setResponding(true);
    setRespondingAction(response);

    try {
      await assertNetworkAvailable();
      await requestApi.respondToRequest(requestId, response);
      Alert.alert(
        'Success',
        response === 'accept'
          ? 'You accepted this blood request.'
          : 'Request declined.'
      );
      await loadRequest();
    } catch (error) {
      Alert.alert(
        'Error',
        getUserFriendlyErrorMessage(error, 'Unable to update the request. Please try again.')
      );
    } finally {
      setResponding(false);
      setRespondingAction(null);
    }
  };

  const handleCancel = async () => {
    if (cancelling) {
      return;
    }

    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this blood request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await assertNetworkAvailable();
              await requestApi.cancelRequest(requestId);
              Alert.alert('Cancelled', 'This blood request has been cancelled.');
              await loadRequest();
            } catch (error) {
              Alert.alert(
                'Error',
                getUserFriendlyErrorMessage(error, 'Unable to cancel this request. Please try again.')
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={styles.loadingText}>Loading request...</Text>
      </View>
    );
  }

  if (!request) {
    return null;
  }

  const isRequester = request.role === 'requester';
  const isDonor = request.role === 'donor';
  const canRespond =
    isDonor &&
    request.responseStatus === DONOR_RESPONSE_STATUS.PENDING &&
    request.status === REQUEST_LIFECYCLE_STATUS.ACTIVE;
  const canCancel =
    isRequester && request.status === REQUEST_LIFECYCLE_STATUS.ACTIVE;
  const donorHasAccepted =
    isDonor && request.responseStatus === DONOR_RESPONSE_STATUS.ACCEPTED;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} disabled={responding}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Request Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Blood Request</Text>
          <Text style={styles.bloodGroup}>{request.bloodGroup} Required</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={styles.detailValue}>{getRequestLifecycleLabel(request.status)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Requested</Text>
            <Text style={styles.detailValue}>{formatTimeAgo(request.createdAt)}</Text>
          </View>

          {request.hospitalName ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Hospital</Text>
              <Text style={styles.detailValue}>{request.hospitalName}</Text>
            </View>
          ) : null}

          {request.message ? (
            <View style={styles.messageBox}>
              <Text style={styles.detailLabel}>Message</Text>
              <Text style={styles.messageText}>{request.message}</Text>
            </View>
          ) : null}

          {isDonor ? (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Requested by</Text>
                <Text style={styles.detailValue}>{request.requester?.name || 'Unknown'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Distance</Text>
                <Text style={styles.detailValue}>{formatDistanceKm(request.distanceKm)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Your response</Text>
                <Text style={styles.detailValue}>
                  {getDonorResponseLabel(request.responseStatus)}
                </Text>
              </View>
              {donorHasAccepted && request.requester?.phone ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Recipient phone</Text>
                  <Text style={styles.detailValue}>{request.requester.phone}</Text>
                </View>
              ) : null}
            </>
          ) : null}

          {isRequester && request.summary ? (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Donors notified: {request.summary.notified || 0}</Text>
              <Text style={styles.summaryAccepted}>✓ Accepted: {request.summary.accepted || 0}</Text>
              <Text style={styles.summaryPending}>⏳ Pending: {request.summary.pending || 0}</Text>
              <Text style={styles.summaryRejected}>✕ Rejected: {request.summary.rejected || 0}</Text>
            </View>
          ) : null}
        </View>

        {isRequester && request.acceptedDonors?.length ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Accepted Donors</Text>
            {request.acceptedDonors.map((donor) => (
              <View key={String(donor.recipientId || donor.donorId)} style={styles.donorCard}>
                <Text style={styles.donorName}>{donor.name}</Text>
                <Text style={styles.donorPhone}>{donor.phone || 'Phone unavailable'}</Text>
                <Text style={styles.donorMeta}>
                  {donor.bloodGroup} · {formatDistanceKm(donor.distanceKm)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {canCancel ? (
          <TouchableOpacity
            style={[styles.cancelButton, (cancelling || responding) && styles.buttonDisabled]}
            onPress={handleCancel}
            disabled={cancelling || responding}
          >
            {cancelling ? (
              <ActivityIndicator color="#c0392b" size="small" />
            ) : (
              <Text style={styles.cancelButtonText}>Cancel Request</Text>
            )}
          </TouchableOpacity>
        ) : null}

        {canRespond ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.acceptButton, responding && styles.buttonDisabled]}
              onPress={() => handleRespond('accept')}
              disabled={responding}
            >
              {responding && respondingAction === 'accept' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectButton, responding && styles.buttonDisabled]}
              onPress={() => handleRespond('reject')}
              disabled={responding}
            >
              {responding && respondingAction === 'reject' ? (
                <ActivityIndicator color="#c0392b" size="small" />
              ) : (
                <Text style={styles.rejectButtonText}>Reject</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {responding ? (
          <Text style={styles.processingText}>
            {respondingAction === 'accept' ? 'Accepting request...' : 'Rejecting request...'}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#208AEF',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  bloodGroup: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e74c3c',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    textTransform: 'capitalize',
  },
  messageBox: {
    marginTop: 8,
    marginBottom: 8,
  },
  messageText: {
    marginTop: 4,
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  summaryBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 4,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  summaryAccepted: {
    color: '#27ae60',
    fontSize: 14,
  },
  summaryPending: {
    color: '#e67e22',
    fontSize: 14,
  },
  summaryRejected: {
    color: '#c0392b',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  donorCard: {
    backgroundColor: '#f8fbff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  donorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  donorPhone: {
    fontSize: 15,
    color: '#208AEF',
    marginTop: 4,
  },
  donorMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#27ae60',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c0392b',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#c0392b',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c0392b',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#c0392b',
    fontWeight: '600',
  },
  processingText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
};
