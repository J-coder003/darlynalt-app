import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/Ionicons';
import { RootState } from '../store/store';
import api from '../utils/api';

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'negotiating';
type RequestType = 'material' | 'wage';

interface MaterialItem {
  name: string;
  quantity: number;
  price: number;
}

interface NegotiationMessage {
  _id: string;
  sender: 'worker' | 'admin';
  message: string;
  proposedAmount?: number;
  createdAt: string;
}

interface MoneyRequest {
  _id: string;
  type: RequestType;
  status: RequestStatus;
  worker: {
    _id: string;
    name: string;
    email: string;
  };
  items?: MaterialItem[];
  totalAmount?: number;
  requestedAmount?: number;
  approvedAmount?: number;
  description?: string;
  negotiations?: NegotiationMessage[];
  createdAt: string;
  updatedAt: string;
}

export default function RequestDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { requestId } = route.params as { requestId: string };
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === 'customer';

  const [request, setRequest] = useState<MoneyRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showNegotiateModal, setShowNegotiateModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [negotiationMessage, setNegotiationMessage] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  const [approvalAmount, setApprovalAmount] = useState('');

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/money-requests/${requestId}`);
      setRequest(res.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to load request details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!request) return;

    const amount = request.type === 'wage' 
      ? parseFloat(approvalAmount) 
      : request.totalAmount;

    if (request.type === 'wage' && (!approvalAmount || amount <= 0)) {
      if (Platform.OS === 'web') {
        alert('Error: Please enter a valid approval amount');
      } else {
        Alert.alert('Error', 'Please enter a valid approval amount');
      }
      return;
    }

    try {
      setProcessing(true);
      await api.put(`/money-requests/${requestId}/approve`, {
        approvedAmount: amount,
      });
      
      if (Platform.OS === 'web') {
        alert('Success: Request approved and funds transferred successfully');
        navigation.goBack();
      } else {
        Alert.alert('Success', 'Request approved and funds transferred successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
      setShowApproveModal(false);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to approve request';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = () => {
    const confirmReject = () => {
      return new Promise<boolean>((resolve) => {
        if (Platform.OS === 'web') {
          resolve(confirm('Are you sure you want to reject this request?'));
        } else {
          Alert.alert(
            'Reject Request',
            'Are you sure you want to reject this request?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Reject', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        }
      });
    };

    confirmReject().then(async (confirmed) => {
      if (!confirmed) return;

      try {
        setProcessing(true);
        await api.put(`/money-requests/${requestId}/reject`);
        
        if (Platform.OS === 'web') {
          alert('Success: Request rejected');
          navigation.goBack();
        } else {
          Alert.alert('Success', 'Request rejected', [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]);
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || 'Failed to reject request';
        if (Platform.OS === 'web') {
          alert('Error: ' + errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      } finally {
        setProcessing(false);
      }
    });
  };

  const handleNegotiate = async () => {
    if (!negotiationMessage.trim() && !proposedAmount) {
      if (Platform.OS === 'web') {
        alert('Error: Please enter a message or proposed amount');
      } else {
        Alert.alert('Error', 'Please enter a message or proposed amount');
      }
      return;
    }

    try {
      setProcessing(true);
      await api.post(`/money-requests/${requestId}/negotiate`, {
        message: negotiationMessage.trim(),
        proposedAmount: proposedAmount ? parseFloat(proposedAmount) : undefined,
      });
      
      if (Platform.OS === 'web') {
        alert('Success: Negotiation message sent');
      } else {
        Alert.alert('Success', 'Negotiation message sent');
      }
      
      setShowNegotiateModal(false);
      setNegotiationMessage('');
      setProposedAmount('');
      fetchRequestDetails();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to send negotiation';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleAcceptNegotiation = async () => {
    if (!request) return;
    
    // Get the last negotiated amount
    const negotiations = request.negotiations || [];
    const lastNegotiation = negotiations[negotiations.length - 1];
    const negotiatedAmount = lastNegotiation?.proposedAmount;

    const confirmAccept = () => {
      return new Promise<boolean>((resolve) => {
        const message = negotiatedAmount 
          ? `Accept the negotiated amount of ${formatCurrency(negotiatedAmount)}?`
          : 'Do you want to accept the current negotiation terms?';
        
        if (Platform.OS === 'web') {
          resolve(confirm(message));
        } else {
          Alert.alert(
            'Accept Terms',
            message,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Accept', onPress: () => resolve(true) },
            ]
          );
        }
      });
    };

    const confirmed = await confirmAccept();
    if (!confirmed) return;

    try {
      setProcessing(true);
      const response = await api.post(`/money-requests/${requestId}/accept-negotiation`);
      const message = response.data?.message || 'Negotiation accepted. Request is now pending admin approval.';
      
      if (Platform.OS === 'web') {
        alert('Success: ' + message);
        navigation.goBack();
      } else {
        Alert.alert('Success', message, [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to accept negotiation';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setProcessing(false);
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c8bff" />
      </View>
    );
  }

  if (!request) {
    return null;
  }

  const canApprove = isAdmin && (request.status === 'pending' || request.status === 'negotiating');
  const canReject = isAdmin && request.status !== 'rejected' && request.status !== 'approved';
  const canNegotiate = request.type === 'material' && request.status !== 'approved' && request.status !== 'rejected';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Icon
              name={request.type === 'material' ? 'construct' : 'cash'}
              size={32}
              color="#7c8bff"
            />
            <Text style={styles.requestType}>
              {request.type === 'material' ? 'Material Request' : 'Wage Request'}
            </Text>
          </View>

          <Text style={styles.statusLabel}>Status</Text>
          <Text style={[styles.statusValue, { color: getStatusColor(request.status) }]}>
            {request.status.toUpperCase()}
          </Text>

          {isAdmin && (
            <View style={styles.workerInfo}>
              <Text style={styles.workerLabel}>Requested by</Text>
              <Text style={styles.workerName}>{request.worker.name}</Text>
              <Text style={styles.workerEmail}>{request.worker.email}</Text>
            </View>
          )}
        </View>

        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>
            {request.status === 'approved' ? 'Approved Amount' : 'Requested Amount'}
          </Text>
          <Text style={styles.amountValue}>
            {formatCurrency(request.approvedAmount || request.totalAmount || request.requestedAmount || 0)}
          </Text>
        </View>

        {/* Material Items */}
        {request.type === 'material' && request.items && request.items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Material Items</Text>
            {request.items.map((item, index) => (
              <View key={index} style={styles.materialItem}>
                <Text style={styles.materialName}>{item.name}</Text>
                <View style={styles.materialDetails}>
                  <Text style={styles.materialText}>Qty: {item.quantity}</Text>
                  <Text style={styles.materialText}>Price: {formatCurrency(item.price)}</Text>
                  <Text style={styles.materialTotal}>
                    Total: {formatCurrency(item.quantity * item.price)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Description */}
        {request.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{request.description}</Text>
          </View>
        )}

        {/* Negotiations */}
        {request.negotiations && request.negotiations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Negotiation History</Text>
            {request.negotiations.map((msg) => (
              <View
                key={msg._id}
                style={[
                  styles.negotiationMessage,
                  msg.sender === 'admin' ? styles.adminMessage : styles.workerMessage,
                ]}
              >
                <Text style={styles.messageSender}>
                  {msg.sender === 'admin' ? 'Admin' : 'Worker'}
                </Text>
                <Text style={styles.messageText}>{msg.message}</Text>
                {msg.proposedAmount && (
                  <Text style={styles.proposedAmount}>
                    Proposed: {formatCurrency(msg.proposedAmount)}
                  </Text>
                )}
                <Text style={styles.messageDate}>{formatDate(msg.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        {(canApprove || canReject || canNegotiate) && (
          <View style={styles.actions}>
            {canApprove && (
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => {
                  if (request.type === 'wage') {
                    setShowApproveModal(true);
                  } else {
                    handleApprove();
                  }
                }}
                disabled={processing}
              >
                <Icon name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </TouchableOpacity>
            )}

            {canNegotiate && (
              <TouchableOpacity
                style={[styles.actionButton, styles.negotiateButton]}
                onPress={() => setShowNegotiateModal(true)}
                disabled={processing}
              >
                <Icon name="swap-horizontal" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Negotiate</Text>
              </TouchableOpacity>
            )}

            {canReject && (
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={handleReject}
                disabled={processing}
              >
                <Icon name="close-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>
            )}

            {!isAdmin && request.status === 'negotiating' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={handleAcceptNegotiation}
                disabled={processing}
              >
                <Icon name="checkmark-done" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Accept Terms</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Negotiate Modal */}
      <Modal visible={showNegotiateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send Negotiation</Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Your message"
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={4}
              value={negotiationMessage}
              onChangeText={setNegotiationMessage}
            />

            <TextInput
              style={styles.input}
              placeholder="Proposed amount (optional)"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={proposedAmount}
              onChangeText={setProposedAmount}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowNegotiateModal(false);
                  setNegotiationMessage('');
                  setProposedAmount('');
                }}
                disabled={processing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleNegotiate}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Approve Wage Modal */}
      <Modal visible={showApproveModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Approve Wage Request</Text>
            <Text style={styles.modalSubtitle}>
              Requested: {formatCurrency(request.requestedAmount || 0)}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Approval amount"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={approvalAmount}
              onChangeText={setApprovalAmount}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowApproveModal(false);
                  setApprovalAmount('');
                }}
                disabled={processing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleApprove}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'approved':
      return '#4ade80';
    case 'rejected':
      return '#f87171';
    case 'negotiating':
      return '#fbbf24';
    default:
      return '#6b7280';
  }
};

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
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a30',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusCard: {
    backgroundColor: '#1a1a30',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  requestType: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  workerInfo: {
    borderTopWidth: 1,
    borderTopColor: '#2a2a40',
    paddingTop: 16,
  },
  workerLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  workerEmail: {
    fontSize: 14,
    color: '#9ca3af',
  },
  amountCard: {
    backgroundColor: '#7c8bff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: '#e0e0ff',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    backgroundColor: '#1a1a30',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  materialItem: {
    backgroundColor: '#2a2a40',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  materialName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  materialDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  materialText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  materialTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c8bff',
  },
  descriptionText: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
  },
  negotiationMessage: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  adminMessage: {
    backgroundColor: '#7c8bff20',
    borderLeftWidth: 3,
    borderLeftColor: '#7c8bff',
  },
  workerMessage: {
    backgroundColor: '#4ade8020',
    borderLeftWidth: 3,
    borderLeftColor: '#4ade80',
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7c8bff',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  proposedAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fbbf24',
    marginBottom: 4,
  },
  messageDate: {
    fontSize: 11,
    color: '#6b7280',
  },
  actions: {
    gap: 12,
    marginBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#4ade80',
  },
  negotiateButton: {
    backgroundColor: '#fbbf24',
  },
  rejectButton: {
    backgroundColor: '#f87171',
  },
  acceptButton: {
    backgroundColor: '#7c8bff',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a30',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#2a2a40',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2a2a40',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#7c8bff',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
