import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/Ionicons';
import { RootState } from '../store/store';
import api from '../utils/api';

interface Transaction {
  _id: string;
  type: 'credit' | 'debit' | 'withdrawal' | 'deposit';
  amount: number;
  description: string;
  createdAt: string;
  status: 'pending' | 'completed' | 'failed';
}

interface WalletData {
  balance: number;
  transactions: Transaction[];
}

export default function WalletScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [wallet, setWallet] = useState<WalletData>({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const res = await api.get('/wallet');
      setWallet(res.data);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to load wallet';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      if (Platform.OS === 'web') {
        alert('Error: Please enter a valid amount');
      } else {
        Alert.alert('Error', 'Please enter a valid amount');
      }
      return;
    }

    if (!bankAccount.trim()) {
      if (Platform.OS === 'web') {
        alert('Error: Please enter your bank account details');
      } else {
        Alert.alert('Error', 'Please enter your bank account details');
      }
      return;
    }

    if (parseFloat(amount) > wallet.balance) {
      if (Platform.OS === 'web') {
        alert('Error: Insufficient balance');
      } else {
        Alert.alert('Error', 'Insufficient balance');
      }
      return;
    }

    try {
      setProcessing(true);
      await api.post('/wallet/withdraw', {
        amount: parseFloat(amount),
        bankAccount: bankAccount.trim(),
      });
      
      if (Platform.OS === 'web') {
        alert('Success: Withdrawal request submitted successfully');
      } else {
        Alert.alert('Success', 'Withdrawal request submitted successfully');
      }
      
      setShowWithdrawModal(false);
      setAmount('');
      setBankAccount('');
      fetchWallet();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to withdraw';
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Wallet</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(wallet.balance)}</Text>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.withdrawButton]}
              onPress={() => setShowWithdrawModal(true)}
            >
              <Icon name="arrow-up-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transactions */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>

          {wallet.transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="wallet-outline" size={60} color="#4a4a6a" />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            wallet.transactions.map((transaction) => (
              <View key={transaction._id} style={styles.transactionItem}>
                <View style={styles.transactionIcon}>
                  <Icon
                    name={
                      transaction.type === 'credit' || transaction.type === 'deposit'
                        ? 'arrow-down'
                        : 'arrow-up'
                    }
                    size={20}
                    color={
                      transaction.type === 'credit' || transaction.type === 'deposit'
                        ? '#4ade80'
                        : '#f87171'
                    }
                  />
                </View>

                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionDescription}>{transaction.description}</Text>
                  <Text style={styles.transactionDate}>{formatDate(transaction.createdAt)}</Text>
                </View>

                <View style={styles.transactionRight}>
                  <Text
                    style={[
                      styles.transactionAmount,
                      transaction.type === 'credit' || transaction.type === 'deposit'
                        ? styles.creditAmount
                        : styles.debitAmount,
                    ]}
                  >
                    {transaction.type === 'credit' || transaction.type === 'deposit' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </Text>
                  <Text
                    style={[
                      styles.transactionStatus,
                      transaction.status === 'completed' && styles.statusCompleted,
                      transaction.status === 'pending' && styles.statusPending,
                      transaction.status === 'failed' && styles.statusFailed,
                    ]}
                  >
                    {transaction.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal visible={showWithdrawModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Withdraw Funds</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <TextInput
              style={styles.input}
              placeholder="Bank account number"
              placeholderTextColor="#6b7280"
              value={bankAccount}
              onChangeText={setBankAccount}
            />

            <Text style={styles.balanceInfo}>
              Available: {formatCurrency(wallet.balance)}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowWithdrawModal(false);
                  setAmount('');
                  setBankAccount('');
                }}
                disabled={processing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleWithdraw}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Withdraw</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  },
  content: {
    flex: 1,
    padding: 20,
  },
  balanceCard: {
    backgroundColor: '#7c8bff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#e0e0ff',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  fundButton: {
    backgroundColor: '#4ade80',
  },
  withdrawButton: {
    backgroundColor: '#1a1a30',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  transactionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a30',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a40',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  creditAmount: {
    color: '#4ade80',
  },
  debitAmount: {
    color: '#f87171',
  },
  transactionStatus: {
    fontSize: 11,
    textTransform: 'capitalize',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusCompleted: {
    backgroundColor: '#4ade8020',
    color: '#4ade80',
  },
  statusPending: {
    backgroundColor: '#fbbf2420',
    color: '#fbbf24',
  },
  statusFailed: {
    backgroundColor: '#f8717120',
    color: '#f87171',
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
  balanceInfo: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 20,
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
