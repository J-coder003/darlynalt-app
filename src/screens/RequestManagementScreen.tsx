import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../utils/api';

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'negotiating';
type RequestType = 'material' | 'wage';

interface MoneyRequest {
  _id: string;
  type: RequestType;
  status: RequestStatus;
  worker: {
    _id: string;
    name: string;
  };
  totalAmount?: number;
  requestedAmount?: number;
  approvedAmount?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  negotiationCount?: number;
}

type FilterStatus = 'all' | RequestStatus;

export default function RequestManagementScreen() {
  const navigation = useNavigation();
  const [requests, setRequests] = useState<MoneyRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<MoneyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const fetchRequests = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const res = await api.get('/money-requests');
      setRequests(res.data);
      applyFilter(res.data, filterStatus);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchRequests();
    }, [])
  );

  const applyFilter = (data: MoneyRequest[], status: FilterStatus) => {
    if (status === 'all') {
      setFilteredRequests(data);
    } else {
      setFilteredRequests(data.filter((req) => req.status === status));
    }
  };

  const handleFilterChange = (status: FilterStatus) => {
    setFilterStatus(status);
    applyFilter(requests, status);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests(true);
  };

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case 'approved':
        return '#4ade80';
      case 'rejected':
        return '#f87171';
      case 'negotiating':
        return '#fbbf24';
      case 'pending':
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: RequestStatus) => {
    switch (status) {
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      case 'negotiating':
        return 'swap-horizontal';
      case 'pending':
      default:
        return 'time';
    }
  };

  const formatCurrency = (value: number) => {
    return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusCount = (status: FilterStatus) => {
    if (status === 'all') return requests.length;
    return requests.filter((req) => req.status === status).length;
  };

  const renderRequest = ({ item }: { item: MoneyRequest }) => {
    const amount = item.approvedAmount || item.totalAmount || item.requestedAmount || 0;
    const needsAttention = item.status === 'pending' || item.status === 'negotiating';

    return (
      <TouchableOpacity
        style={[styles.requestCard, needsAttention && styles.requestCardHighlight]}
        onPress={() => navigation.navigate('RequestDetails' as never, { requestId: item._id } as never)}
      >
        <View style={styles.requestHeader}>
          <View style={styles.requestLeft}>
            <View style={styles.requestType}>
              <Icon
                name={item.type === 'material' ? 'construct' : 'cash'}
                size={20}
                color="#7c8bff"
              />
              <Text style={styles.requestTypeText}>
                {item.type === 'material' ? 'Materials' : 'Wages'}
              </Text>
            </View>
            <Text style={styles.workerName}>{item.worker.name}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
            <Icon name={getStatusIcon(item.status)} size={14} color={getStatusColor(item.status)} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <Text style={styles.requestAmount}>{formatCurrency(amount)}</Text>

        {item.description && (
          <Text style={styles.requestDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.requestFooter}>
          <Text style={styles.requestDate}>{formatDate(item.createdAt)}</Text>
          {item.status === 'negotiating' && item.negotiationCount && item.negotiationCount > 0 && (
            <View style={styles.negotiationBadge}>
              <Icon name="chatbubbles" size={12} color="#fbbf24" />
              <Text style={styles.negotiationText}>{item.negotiationCount} messages</Text>
            </View>
          )}
          {needsAttention && (
            <View style={styles.attentionBadge}>
              <Icon name="alert-circle" size={12} color="#f87171" />
              <Text style={styles.attentionText}>Action needed</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c8bff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Money Requests</Text>
        <View style={styles.headerStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{getStatusCount('pending')}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{getStatusCount('negotiating')}</Text>
            <Text style={styles.statLabel}>Negotiating</Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['all', 'pending', 'negotiating', 'approved', 'rejected'] as FilterStatus[]).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterTab, filterStatus === status && styles.filterTabActive]}
              onPress={() => handleFilterChange(status)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterStatus === status && styles.filterTabTextActive,
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
              <View style={[styles.filterBadge, filterStatus === status && styles.filterBadgeActive]}>
                <Text
                  style={[
                    styles.filterBadgeText,
                    filterStatus === status && styles.filterBadgeTextActive,
                  ]}
                >
                  {getStatusCount(status)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {filteredRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="document-text-outline" size={80} color="#4a4a6a" />
          <Text style={styles.emptyTitle}>No Requests</Text>
          <Text style={styles.emptyText}>
            {filterStatus === 'all'
              ? 'No money requests have been submitted yet'
              : `No ${filterStatus} requests found`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          renderItem={renderRequest}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7c8bff"
              colors={['#7c8bff']}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a30',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7c8bff',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#2a2a40',
  },
  filterContainer: {
    backgroundColor: '#1a1a30',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a40',
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#2a2a40',
    gap: 8,
  },
  filterTabActive: {
    backgroundColor: '#7c8bff',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  filterBadge: {
    backgroundColor: '#1a1a30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: '#fff',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  filterBadgeTextActive: {
    color: '#7c8bff',
  },
  listContent: {
    padding: 20,
  },
  requestCard: {
    backgroundColor: '#1a1a30',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  requestCardHighlight: {
    borderWidth: 2,
    borderColor: '#7c8bff40',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestLeft: {
    flex: 1,
  },
  requestType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  requestTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7c8bff',
  },
  workerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  requestAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  requestDescription: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 12,
    lineHeight: 20,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  requestDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  negotiationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  negotiationText: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '500',
  },
  attentionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attentionText: {
    fontSize: 12,
    color: '#f87171',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
