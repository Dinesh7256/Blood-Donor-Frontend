import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { requestApi } from '../../src/api/requestApi.js';
import { formatDistanceKm } from '../../src/utils/distance.js';
import { formatTimeAgo } from '../../src/utils/timeAgo.js';
import EmptyState from '../../src/components/EmptyState.js';
import { assertNetworkAvailable } from '../../src/utils/networkGuard.js';
import { getUserFriendlyErrorMessage } from '../../src/utils/errorMessages.js';
import { getDonorResponseLabel } from '../../src/constants/requestStatuses.js';

const getStatusStyle = (status) => {
  if (status === 'accepted') return styles.statusAccepted;
  if (status === 'rejected') return styles.statusRejected;
  return styles.statusPending;
};

export default function RequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [respondingAction, setRespondingAction] = useState(null);

  const loadRequests = useCallback(async ({ showLoader = true } = {}) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      await assertNetworkAvailable();
      const response = await requestApi.getIncomingRequests();
      setRequests(response?.data || []);
    } catch (error) {
      Alert.alert(
        'Error',
        getUserFriendlyErrorMessage(error, 'Unable to load requests. Please try again.')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests])
  );

  const handleRespond = async (item, response) => {
    if (respondingId) {
      return;
    }

    setRespondingId(item.requestId);
    setRespondingAction(response === 'accept' ? 'accept' : 'reject');

    try {
      await assertNetworkAvailable();
      await requestApi.respondToRequest(item.requestId, response);
      Alert.alert(
        'Success',
        response === 'accept'
          ? 'You accepted this blood request.'
          : 'Request declined.'
      );
      await loadRequests({ showLoader: false });
    } catch (error) {
      Alert.alert(
        'Error',
        getUserFriendlyErrorMessage(error, 'Unable to update the request. Please try again.')
      );
    } finally {
      setRespondingId(null);
      setRespondingAction(null);
    }
  };

  const renderRequestCard = ({ item }) => {
    const request = item.request || {};
    const requesterName = request.requester?.name || 'Unknown';
    const isPending = item.status === 'pending';
    const isProcessing = respondingId === item.requestId;
    const processingLabel =
      respondingAction === 'accept' ? 'Accepting request...' : 'Rejecting request...';

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Blood Request</Text>
        <Text style={styles.bloodGroup}>{request.bloodGroup} Blood Required</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Requested by</Text>
          <Text style={styles.detailValue}>{requesterName}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Distance</Text>
          <Text style={styles.detailValue}>{formatDistanceKm(item.distanceKm)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Requested</Text>
          <Text style={styles.detailValue}>{formatTimeAgo(item.createdAt)}</Text>
        </View>

        {request.hospitalName ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Hospital</Text>
            <Text style={styles.detailValue}>{request.hospitalName}</Text>
          </View>
        ) : null}

        {request.message ? (
          <Text style={styles.messageText}>{request.message}</Text>
        ) : null}

        <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>
          {getDonorResponseLabel(item.status)}
        </Text>

        {request.requester?.phone ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recipient phone</Text>
            <Text style={styles.detailValue}>{request.requester.phone}</Text>
          </View>
        ) : null}

        {isPending ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.acceptButton, isProcessing && styles.buttonDisabled]}
              onPress={() => handleRespond(item, 'accept')}
              disabled={isProcessing}
            >
              {isProcessing && respondingAction === 'accept' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectButton, isProcessing && styles.buttonDisabled]}
              onPress={() => handleRespond(item, 'reject')}
              disabled={isProcessing}
            >
              {isProcessing && respondingAction === 'reject' ? (
                <ActivityIndicator color="#e74c3c" size="small" />
              ) : (
                <Text style={styles.rejectButtonText}>Reject</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {isProcessing ? (
          <Text style={styles.processingText}>{processingLabel}</Text>
        ) : null}

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push(`/(app)/request/${item.requestId}`)}
        >
          <Text style={styles.linkButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Requests</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#208AEF" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item) => String(item.recipientId || item.requestId)}
            renderItem={renderRequestCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => {
                setRefreshing(true);
                void loadRequests({ showLoader: false });
              }} />
            }
            ListEmptyComponent={
              <EmptyState
                title="No incoming requests"
                message="No blood requests available right now. Check again later."
              />
            }
          />
        )}
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  bloodGroup: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e74c3c',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
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
  },
  messageText: {
    marginTop: 8,
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  statusBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '600',
  },
  statusPending: {
    backgroundColor: '#fff4e5',
    color: '#e67e22',
  },
  statusAccepted: {
    backgroundColor: '#eafaf1',
    color: '#27ae60',
  },
  statusRejected: {
    backgroundColor: '#fdecea',
    color: '#c0392b',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#27ae60',
    paddingVertical: 12,
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
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#c0392b',
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#208AEF',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    fontSize: 14,
  },
  processingText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
  },
};
