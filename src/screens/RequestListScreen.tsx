import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
  totalAmount?: number;
  requestedAmount?: number;
  approvedAmount?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  negotiationCount?: number;
}

export default function RequestListScreen() {
  const navigation = useNavigation();
  const [requests, setRequests] = useState<MoneyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const res = await api.get('/money-requests');
      setRequests(res.data);
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

  const renderRequest = ({ item }: { item: MoneyRequest }) => {
    const amount = item.approvedAmount || item.totalAmount || item.requestedAmount || 0;

    return (
      <TouchableOpacity
        style={styles.requestCard}
        onPress={() => navigation.navigate('RequestDetails' as never, { requestId: item._id } as never)}
      >
        <View style={styles.requestHeader}>
          <View style={styles.requestType}>
            <Icon
              name={item.type === 'material' ? 'construct' : 'cash'}
              size={20}
              color="#7c8bff"
            />
            <Text style={styles.requestTypeText}>
              {item.type === 'material' ? 'Materials' : 'Wages/Salary'}
            </Text>
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
        <Text style={styles.headerTitle}>My Requests</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('MoneyRequest' as never)}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="document-text-outline" size={80} color="#4a4a6a" />
          <Text style={styles.emptyTitle}>No Requests Yet</Text>
          <Text style={styles.emptyText}>
            Create your first money request to get started
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('MoneyRequest' as never)}
          >
            <Icon name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.createButtonText}>Create Request</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a30',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c8bff',
    alignItems: 'center',
    justifyContent: 'center',
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
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c8bff',
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
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c8bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
