import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext.js';
import { requestApi } from '../../src/api/requestApi.js';
import { formatDistanceKm } from '../../src/utils/distance.js';
import { formatTimeAgo } from '../../src/utils/timeAgo.js';
import EmptyState from '../../src/components/EmptyState.js';
import ErrorState from '../../src/components/ErrorState.js';
import { assertNetworkAvailable } from '../../src/utils/networkGuard.js';
import { getUserFriendlyErrorMessage } from '../../src/utils/errorMessages.js';
import {
  getDonorResponseLabel,
  getRequestLifecycleLabel,
} from '../../src/constants/requestStatuses.js';
import {
  canCreateBloodRequest,
  getBloodRequestBlockMessage,
} from '../../src/utils/profileCompletion.js';

const TABS = {
  INCOMING: 'incoming',
  MINE: 'mine',
};

const getStatusStyle = (status) => {
  if (status === 'accepted') return styles.statusAccepted;
  if (status === 'rejected') return styles.statusRejected;
  return styles.statusPending;
};

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const initialTab = useMemo(() => {
    const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    return tabParam === TABS.MINE ? TABS.MINE : TABS.INCOMING;
  }, [params.tab]);

  const [activeTab, setActiveTab] = useState(initialTab);
  const appliedTabParamRef = useRef(initialTab);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [respondingId, setRespondingId] = useState(null);
  const [respondingAction, setRespondingAction] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const openedRequestRef = useRef(null);

  const requestIdParam = useMemo(() => {
    const value = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
    return value || null;
  }, [params.requestId]);

  const loadIncoming = useCallback(async () => {
    const response = await requestApi.getIncomingRequests();
    setIncomingRequests(response?.data || []);
  }, []);

  const loadMine = useCallback(async () => {
    const response = await requestApi.getMyRequests();
    setMyRequests(response?.data || []);
  }, []);

  const loadHistory = useCallback(async ({ showLoader = true } = {}) => {
    if (showLoader) {
      setLoading(true);
    }

    setError(null);

    try {
      await assertNetworkAvailable();
      await Promise.all([loadIncoming(), loadMine()]);
    } catch (loadError) {
      setError(
        getUserFriendlyErrorMessage(loadError, 'Unable to load request history. Please try again.')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadIncoming, loadMine]);

  useFocusEffect(
    useCallback(() => {
      if (appliedTabParamRef.current !== initialTab) {
        appliedTabParamRef.current = initialTab;
        setActiveTab(initialTab);
      }

      void loadHistory();

      if (requestIdParam && openedRequestRef.current !== requestIdParam) {
        openedRequestRef.current = requestIdParam;
        router.push(`/(app)/request/${requestIdParam}`);
      }
    }, [initialTab, loadHistory, requestIdParam, router])
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
      await loadHistory({ showLoader: false });
    } catch (respondError) {
      Alert.alert(
        'Error',
        getUserFriendlyErrorMessage(respondError, 'Unable to update the request. Please try again.')
      );
    } finally {
      setRespondingId(null);
      setRespondingAction(null);
    }
  };

  const handleCancel = (item) => {
    if (cancellingId) {
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
            setCancellingId(item._id);
            try {
              await assertNetworkAvailable();
              await requestApi.cancelRequest(item._id);
              Alert.alert('Cancelled', 'This blood request has been cancelled.');
              await loadHistory({ showLoader: false });
            } catch (cancelError) {
              Alert.alert(
                'Error',
                getUserFriendlyErrorMessage(cancelError, 'Unable to cancel this request. Please try again.')
              );
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const handleCreateRequest = () => {
    if (!canCreateBloodRequest(user)) {
      Alert.alert('Action Required', getBloodRequestBlockMessage(user), [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Profile', onPress: () => router.push('/(app)/profile') },
      ]);
      return;
    }

    router.push('/(app)/create-request');
  };

  const renderIncomingCard = ({ item }) => {
    const request = item.request || {};
    const requesterName = request.requester?.name || 'Unknown';
    const isPending = item.status === 'pending';
    const isProcessing = respondingId === item.requestId;
    const processingLabel =
      respondingAction === 'accept' ? 'Accepting request...' : 'Rejecting request...';

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Blood Needed: {request.bloodGroup}</Text>
        <Text style={styles.cardSubtitle}>Recipient: {requesterName}</Text>
        <Text style={styles.cardMeta}>Distance: {formatDistanceKm(item.distanceKm)}</Text>
        <Text style={styles.cardMeta}>Requested: {formatTimeAgo(item.createdAt)}</Text>

        {request.hospitalName ? (
          <Text style={styles.cardMeta}>Hospital: {request.hospitalName}</Text>
        ) : null}

        {request.message ? <Text style={styles.messageText}>{request.message}</Text> : null}

        <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>
          Status: {getDonorResponseLabel(item.status)}
        </Text>

        {item.status === 'accepted' && request.requester?.phone ? (
          <Text style={styles.contactText}>Recipient phone: {request.requester.phone}</Text>
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

        {isProcessing ? <Text style={styles.processingText}>{processingLabel}</Text> : null}

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push(`/(app)/request/${item.requestId}`)}
        >
          <Text style={styles.linkButtonText}>View Request</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMyRequestCard = ({ item }) => {
    const summary = item.summary || {};
    const isActive = item.status === 'active';
    const isCancelling = cancellingId === item._id;

    return (
      <View style={styles.cardMine}>
        <TouchableOpacity onPress={() => router.push(`/(app)/request/${item._id}`)}>
          <Text style={styles.cardTitle}>{item.bloodGroup} Blood Required</Text>
          <Text style={styles.cardMeta}>Created: {formatTimeAgo(item.createdAt)}</Text>
          <Text style={styles.cardMeta}>Status: {getRequestLifecycleLabel(item.status)}</Text>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Donors notified: {summary.notified || 0}</Text>
            <Text style={styles.summaryAccepted}>✓ Accepted: {summary.accepted || 0}</Text>
            <Text style={styles.summaryRejected}>✕ Rejected: {summary.rejected || 0}</Text>
            <Text style={styles.summaryPending}>◷ Pending: {summary.pending || 0}</Text>
          </View>
        </TouchableOpacity>

        {isActive ? (
          <TouchableOpacity
            style={[styles.cancelButton, isCancelling && styles.buttonDisabled]}
            onPress={() => handleCancel(item)}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator color="#c0392b" size="small" />
            ) : (
              <Text style={styles.cancelButtonText}>Cancel Request</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const listData = activeTab === TABS.INCOMING ? incomingRequests : myRequests;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={styles.title}>History</Text>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === TABS.INCOMING && styles.tabButtonActive]}
            onPress={() => setActiveTab(TABS.INCOMING)}
          >
            <Text
              style={[styles.tabButtonText, activeTab === TABS.INCOMING && styles.tabButtonTextActive]}
            >
              Incoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === TABS.MINE && styles.tabButtonActive]}
            onPress={() => setActiveTab(TABS.MINE)}
          >
            <Text
              style={[styles.tabButtonText, activeTab === TABS.MINE && styles.tabButtonTextActive]}
            >
              My Requests
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#208AEF" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadHistory()} />
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) =>
              String(activeTab === TABS.INCOMING ? item.recipientId || item.requestId : item._id)
            }
            renderItem={activeTab === TABS.INCOMING ? renderIncomingCard : renderMyRequestCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  if (refreshing) {
                    return;
                  }
                  setRefreshing(true);
                  void loadHistory({ showLoader: false });
                }}
              />
            }
            ListEmptyComponent={
              activeTab === TABS.INCOMING ? (
                <EmptyState
                  title="No blood requests right now"
                  message="You will see nearby blood requests here."
                />
              ) : (
                <EmptyState
                  title="You have not created any blood requests yet"
                  message="Your blood requests will appear here."
                  actionLabel="Create Request"
                  onAction={handleCreateRequest}
                />
              )
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
    paddingTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#e8eef5',
    borderRadius: 10,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#fff',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabButtonTextActive: {
    color: '#208AEF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
    marginBottom: 12,
  },
  cardMine: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#208AEF',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#444',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
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
  contactText: {
    marginTop: 8,
    fontSize: 14,
    color: '#208AEF',
    fontWeight: '500',
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
  cancelButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#c0392b',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#c0392b',
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
  processingText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
  },
};
