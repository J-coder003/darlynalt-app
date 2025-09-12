import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../utils/api';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { logout } from '../store/authSlice';
import CustomButton from '../components/CustomButton';

const { width } = Dimensions.get('window');

const normalizeId = (id: string) =>
  /^[0-9a-fA-F]{24}$/.test(id) ? id : id.padStart(24, '0');

type Job = {
  id: string;
  service: string;
  status: string;
  date: string;
  worker?: string | null;
  amount?: number;
  progress?: number;
};

type Invoice = {
  id: string;
  amount: number;
  status: string;
  service?: string;
  date?: string;
};

type Service = {
  name: string;
  icon: string;
  description: string;
};

type Notification = {
  id: number;
  title: string;
  message: string;
  time: string;
  type: string;
};

export default function CustomerHome({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);

  const [profile, setProfile] = useState<any | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const services: Service[] = [
    { name: 'Solar Energy', icon: 'sun', description: 'Complete solar installation' },
    { name: 'Smart Home', icon: 'home', description: 'Home automation systems' },
    { name: 'Security', icon: 'shield', description: 'Advanced security solutions' },
    { name: 'Audio Systems', icon: 'music', description: 'Digital audio & sound' },
  ];

  const notifications: Notification[] = [
    { id: 1, title: 'Job Update', message: 'Your solar installation is 60% complete', time: '2 hours ago', type: 'job' },
    { id: 2, title: 'Payment Due', message: 'Invoice INV-002 is due in 2 days', time: '1 day ago', type: 'payment' },
    { id: 3, title: 'New Message', message: 'Mike Johnson sent you a message', time: '3 hours ago', type: 'chat' },
  ];

  const fetchAll = async () => {
  try {
    setLoading(true);

    // 1. Profile
    const profileRes = await api.get('/users/me');
    setProfile(profileRes.data);
    console.log('Profile response:', profileRes.data);

    // 2. Jobs & Invoices (no params needed!)
    const [jobsRes, invoicesRes] = await Promise.all([
      api.get('/jobs/my'),
      api.get('/invoices'),
    ]);

    console.log('Jobs response:', jobsRes.data);
    console.log('Invoices response:', invoicesRes.data);

    // 3. Normalize jobs
    const jobsWithProgress = (jobsRes.data || []).map((job: any) => ({
      id: job.id || job._id,
      service: job.serviceType || job.service || 'Service',
      status: job.status || 'pending',
      date: job.createdAt
        ? new Date(job.createdAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      worker: job.workerName || job.worker || null,
      amount: job.amount || 0,
      progress:
        job.status === 'ongoing'
          ? Math.floor(Math.random() * 80) + 10
          : job.status === 'completed'
          ? 100
          : 0,
    }));
    setJobs(jobsWithProgress);

    // 4. Normalize invoices
    const invoiceList = (invoicesRes.data || []).map((invoice: any) => ({
      id: invoice.id || invoice._id,
      amount: invoice.amount || 0,
      status: invoice.status || 'pending',
      service: invoice.serviceType || 'Service',
      date: invoice.createdAt
        ? new Date(invoice.createdAt).toISOString().split('T')[0]
        : '',
    }));
    setInvoices(invoiceList);
  } catch (err: any) {
    console.error('Fetch error:', err.response?.data || err.message || err);
    Alert.alert('Error', err?.response?.data?.message || 'Failed to load data');
  } finally {
    setLoading(false);
  }
};


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, []);


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: '#dcfce7', text: '#166534' };
      case 'ongoing':
        return { bg: '#dbeafe', text: '#1d4ed8' };
      case 'pending':
        return { bg: '#fef3c7', text: '#92400e' };
      default:
        return { bg: '#f3f4f6', text: '#374151' };
    }
  };
  /**
   * Notification Modal
   */
  const NotificationModal = () => (
    <Modal
      visible={showNotifications}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowNotifications(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Notifications</Text>
          <TouchableOpacity onPress={() => setShowNotifications(false)}>
            <Icon name="x" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent}>
          {notifications.map((notification) => (
            <View key={notification.id} style={styles.notificationItem}>
              <View
                style={[
                  styles.notificationIcon,
                  {
                    backgroundColor:
                      notification.type === 'job'
                        ? '#dbeafe'
                        : notification.type === 'payment'
                        ? '#fef3c7'
                        : '#dcfce7',
                  },
                ]}
              >
                <Icon
                  name={
                    notification.type === 'job'
                      ? 'briefcase'
                      : notification.type === 'payment'
                      ? 'credit-card'
                      : 'message-circle'
                  }
                  size={16}
                  color={
                    notification.type === 'job'
                      ? '#1d4ed8'
                      : notification.type === 'payment'
                      ? '#92400e'
                      : '#166534'
                  }
                />
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                <Text style={styles.notificationTime}>{notification.time}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  /**
   * Job Booking Modal
   */
  const JobBookingModal = () => {
    const [serviceType, setServiceType] = useState('');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');
    const [loadingSubmit, setLoadingSubmit] = useState(false);

    const handleSubmitJob = async () => {
      if (!serviceType || !description || !address) {
        Alert.alert('Validation Error', 'Please fill all required fields.');
        return;
      }

      try {
        setLoadingSubmit(true);
        const payload = {
          title: `${serviceType} Job`,
          serviceType,
          description,
          address,
          images: [],
          customerId: normalizeId(user?._id || user?.id), // ✅ fix
        };

        const res = await api.post('/jobs', payload);

        const newJob = {
          id: res.data.id || res.data._id,
          service: serviceType,
          status: res.data.status || 'pending',
          date: new Date().toISOString().split('T')[0],
          worker: null,
          amount: 0,
          progress: 0,
        };
        setJobs((prevJobs) => [newJob, ...prevJobs]);

        setServiceType('');
        setDescription('');
        setAddress('');
        setShowJobForm(false);

        Alert.alert('Success', 'Service request submitted successfully!');
      } catch (error: any) {
        console.error('Job creation error:', error.response?.data || error.message);
        Alert.alert('Error', error.response?.data?.message || 'Failed to create job');
      } finally {
        setLoadingSubmit(false);
      }
    };

    return (
      <Modal
        visible={showJobForm}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowJobForm(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book a Service</Text>
            <TouchableOpacity onPress={() => setShowJobForm(false)}>
              <Icon name="x" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Service Type</Text>
              {services.map((service, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.formInput,
                    {
                      marginBottom: 10,
                      backgroundColor: serviceType === service.name ? '#dbeafe' : '#fff',
                    },
                  ]}
                  onPress={() => setServiceType(service.name)}
                >
                  <Text style={{ color: serviceType === service.name ? '#1d4ed8' : '#374151' }}>
                    {service.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Describe your requirements..."
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Address</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Installation address"
                value={address}
                onChangeText={setAddress}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Upload Images (Optional)</Text>
              <TouchableOpacity style={styles.uploadArea}>
                <Icon name="camera" size={32} color="#9ca3af" />
                <Text style={styles.uploadText}>Tap to upload images</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.submitButton}>
  <CustomButton
    title={loadingSubmit ? 'Submitting...' : 'Submit Request'}
    onPress={handleSubmitJob}
    disabled={loadingSubmit}
  />
</View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.appTitle}>DARLYN_ALT</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton} onPress={() => setShowNotifications(true)}>
            <Icon name="bell" size={20} color="#fff" />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome back, {user?.name || profile?.name || 'User'}!</Text>
          <Text style={styles.welcomeSubtitle}>Ready for your next home upgrade?</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.primaryAction} onPress={() => setShowJobForm(true)}>
              <Icon name="plus" size={20} color="#fff" />
              <Text style={styles.primaryActionText}>Book Service</Text>
            </TouchableOpacity>
            <TouchableOpacity
  style={styles.secondaryAction}
  onPress={() => navigation.navigate('Invoices')}
>
  <Icon name="file-text" size={20} color="#374151" />
  <Text style={styles.secondaryActionText}>Invoices</Text>
</TouchableOpacity>

          </View>
        </View>

        {/* Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Services</Text>
          <View style={styles.servicesGrid}>
            {services.map((service, index) => (
              <TouchableOpacity key={index} style={styles.serviceCard}>
                <View style={styles.serviceIconContainer}>
                  <Icon name={service.icon} size={24} color="#2563eb" />
                </View>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceDescription}>{service.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Jobs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Jobs</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllButton}>View All</Text>
            </TouchableOpacity>
          </View>

          {jobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="briefcase" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No jobs found</Text>
              <Text style={styles.emptySubtext}>Book your first service to get started</Text>
            </View>
          ) : (
            <View style={styles.jobsList}>
              {jobs.slice(0, 2).map((job) => {
                const statusStyle = getStatusColor(job.status);
                return (
                  <TouchableOpacity key={String(job.id)} style={styles.jobCard}>
                    <View style={styles.jobHeader}>
                      <Text style={styles.jobTitle}>{job.service}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusText, { color: statusStyle.text }]}>{job.status}</Text>
                      </View>
                    </View>

                    <View style={styles.jobMeta}>
                      <View style={styles.jobMetaItem}>
                        <Icon name="calendar" size={14} color="#6b7280" />
                        <Text style={styles.jobMetaText}>{job.date}</Text>
                      </View>
                      {job.worker && (
                        <View style={styles.jobMetaItem}>
                          <Icon name="user" size={14} color="#6b7280" />
                          <Text style={styles.jobMetaText}>{job.worker}</Text>
                        </View>
                      )}
                      <View style={styles.jobMetaItem}>
                        <Icon name="credit-card" size={14} color="#6b7280" />
                        <Text style={styles.jobMetaText}>₦{(job.amount ?? 0).toLocaleString()}</Text>
                      </View>
                    </View>

                    {job.status === 'ongoing' && job.progress !== undefined && (
                      <View style={styles.progressSection}>
                        <View style={styles.progressHeader}>
                          <Text style={styles.progressLabel}>Progress</Text>
                          <Text style={styles.progressValue}>{job.progress}%</Text>
                        </View>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${job.progress}%` }]} />
                        </View>
                      </View>
                    )}

                    <View style={styles.jobFooter}>
                      <Text style={styles.viewDetailsText}>View Details</Text>
                      <Icon name="chevron-right" size={16} color="#9ca3af" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>


        {/* Recent Invoices */}
        <View style={[styles.section, { marginBottom: 20 }]}>
          <Text style={styles.sectionTitle}>Recent Invoices</Text>

          {invoices.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="file-text" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No invoices available</Text>
            </View>
          ) : (
            <View style={styles.invoicesList}>
              {invoices.slice(0, 2).map((invoice) => (
                <TouchableOpacity key={String(invoice.id)} style={styles.invoiceCard}>
                  <View style={styles.invoiceHeader}>
                    <View style={styles.invoiceIconContainer}>
                      <Icon name="file-text" size={18} color="#2563eb" />
                    </View>
                    <View style={styles.invoiceInfo}>
                      <Text style={styles.invoiceTitle}>{invoice.service || 'Invoice'}</Text>
                      <Text style={styles.invoiceMeta}>
                        {invoice.date} • {invoice.status}
                      </Text>
                    </View>
                    <Text style={styles.invoiceAmount}>₦{invoice.amount?.toLocaleString()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <NotificationModal />
      <JobBookingModal />

      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#1d4ed8',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  welcomeSection: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#bfdbfe',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllButton: {
    color: '#2563eb',
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: '#1d4ed8',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '500',
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    color: '#374151',
    fontWeight: '500',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    backgroundColor: '#fff',
    width: (width - 44) / 2,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  serviceIconContainer: {
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  jobsList: {
    gap: 12,
  },
  jobCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  jobMeta: {
    gap: 8,
    marginBottom: 12,
  },
  jobMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobMetaText: {
    fontSize: 13,
    color: '#6b7280',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  progressValue: {
    fontSize: 13,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1d4ed8',
    borderRadius: 3,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewDetailsText: {
    color: '#2563eb',
    fontWeight: '500',
  },
  invoicesList: {
    gap: 8,
  },
  invoiceCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invoiceIconContainer: {
    marginRight: 8,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  invoiceMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  logoutContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  logoutButton: {
    marginTop: 0,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingTop: 50,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 8,
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  notificationTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formInputText: {
    color: '#9ca3af',
    flex: 1,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    color: '#6b7280',
    marginTop: 8,
  },
  submitButton: {
    marginTop: 20,
  },
});