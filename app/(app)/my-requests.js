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
import { formatTimeAgo } from '../../src/utils/timeAgo.js';
import EmptyState from '../../src/components/EmptyState.js';
import { assertNetworkAvailable } from '../../src/utils/networkGuard.js';
import { getUserFriendlyErrorMessage } from '../../src/utils/errorMessages.js';
import { getRequestLifecycleLabel } from '../../src/constants/requestStatuses.js';

export default function MyRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRequests = useCallback(async ({ showLoader = true } = {}) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      await assertNetworkAvailable();
      const response = await requestApi.getMyRequests();
      setRequests(response?.data || []);
    } catch (error) {
      Alert.alert(
        'Error',
        getUserFriendlyErrorMessage(error, 'Unable to load your requests. Please try again.')
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

  const renderRequestCard = ({ item }) => {
    const summary = item.summary || {};

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/request/${item._id}`)}
      >
        <Text style={styles.cardTitle}>Blood Request</Text>
        <Text style={styles.bloodGroup}>{item.bloodGroup} Required</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <Text style={styles.detailValue}>{getRequestLifecycleLabel(item.status)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Requested</Text>
          <Text style={styles.detailValue}>{formatTimeAgo(item.createdAt)}</Text>
        </View>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Donors notified: {summary.notified || 0}</Text>
          <Text style={styles.summaryAccepted}>✓ Accepted: {summary.accepted || 0}</Text>
          <Text style={styles.summaryPending}>⏳ Pending: {summary.pending || 0}</Text>
          <Text style={styles.summaryRejected}>✕ Rejected: {summary.rejected || 0}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>My Requests</Text>
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
            keyExtractor={(item) => String(item._id)}
            renderItem={renderRequestCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void loadRequests({ showLoader: false });
                }}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="No blood requests"
                message="No requests yet. Your blood requests will appear here."
                actionLabel="Create Request"
                onAction={() => router.push('/(app)/create-request')}
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
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#208AEF',
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
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    textTransform: 'capitalize',
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
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
};
