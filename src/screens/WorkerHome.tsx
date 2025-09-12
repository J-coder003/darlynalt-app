import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  FlatList,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../utils/api';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

type Job = {
  id: string;
  service: string;
  status: string;
  date: string;
  customer?: string | null;
  amount?: number;
  progress?: number;
  description?: string;
  createdAt?: string;
};

type Complaint = {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt?: string;
  customerName?: string;
};

type Feedback = {
  id: string;
  comment: string;
  status: string;
  rating?: number;
  createdAt?: string;
  customerName?: string;
};

type Notification = {
  id: number;
  title: string;
  message: string;
  time: string;
  type: string;
};

type QueryMessage = {
  id: string;
  sender: 'admin' | 'worker';
  content: string;
  type?: 'query' | 'reply' | 'penalty' | 'report';
  createdAt: string;
};

export default function WorkerHome({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);

  const [profile, setProfile] = useState<any | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // NEW STATE
  const [jobQueries, setJobQueries] = useState<{ [jobId: string]: QueryMessage[] }>({});
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetailsModalVisible, setJobDetailsModalVisible] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [reportContent, setReportContent] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Complaint modal state
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [complaintDetailsModalVisible, setComplaintDetailsModalVisible] = useState(false);
  const [complaintStatusUpdating, setComplaintStatusUpdating] = useState(false);
  const [complaintJob, setComplaintJob] = useState<Job | null>(null);

  // Arrival modal state
  const [arrivalModalVisible, setArrivalModalVisible] = useState(false);
  const [arrivalNote, setArrivalNote] = useState('');
  const [arrivalSubmitting, setArrivalSubmitting] = useState(false);
  const [showArrivalPicker, setShowArrivalPicker] = useState(false);
  const [arrivalDate, setArrivalDate] = useState<Date | null>(null);

  // Other modals
  const [showNotifications, setShowNotifications] = useState(false);
  const [showComplaints, setShowComplaints] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showJobsModal, setShowJobsModal] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Track last seen IDs to detect new assignments
  const lastJobIds = useRef<Set<string>>(new Set());
  const lastComplaintIds = useRef<Set<string>>(new Set());
  const lastFeedbackIds = useRef<Set<string>>(new Set());

  // Notification Modal
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
        <FlatList
          data={notifications.slice().reverse()}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.modalContent}
          renderItem={({ item }) => (
            <View style={styles.notificationItem}>
              <View style={styles.notificationIcon}>
                <Icon
                  name={
                    item.type === 'job'
                      ? 'briefcase'
                      : item.type === 'complaint'
                      ? 'alert-circle'
                      : 'message-square'
                  }
                  size={20}
                  color="#2563eb"
                />
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                <Text style={styles.notificationMessage}>{item.message}</Text>
                <Text style={styles.notificationTime}>{item.time}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="bell" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No notifications</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );

  // Fetch and detect new assignments
  const fetchAll = async () => {
  try {
    setLoading(true);

    // 1. Profile
    const profileRes = await api.get('/users/me');
    setProfile(profileRes.data);

    // 2. Worker-specific data
    const [jobsRes, complaintsRes, feedbackRes] = await Promise.all([
      api.get('/jobs/assigned'),
      api.get('/complaints/assigned'),
      api.get('/feedback/assigned'),
    ]);

    // Normalize jobs
    const jobsWithProgress = (jobsRes.data || []).map((job: any) => ({
      id: job.id || job._id,
      service: job.serviceType || job.service || 'Service',
      status: job.status || 'pending',
      date: job.createdAt
        ? new Date(job.createdAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      customer: job.customerName || job.customer || null,
      amount: job.amount || 0,
      progress:
        job.status === 'ongoing'
          ? Math.floor(Math.random() * 80) + 10
          : job.status === 'completed'
          ? 100
          : 0,
      description: job.description || '',
      createdAt: job.createdAt,
    }));
    setJobs(jobsWithProgress);

    // Complaints
    const complaintsList = (complaintsRes.data?.items || []).map((c: any) => ({
      id: c.id || c._id,
      title: c.title || 'Complaint',
      description: c.description || '',
      status: c.status || 'pending',
      createdAt: c.createdAt,
      customerName: c.customerName || 'Unknown Customer',
    }));
    setComplaints(complaintsList);

    // Feedback
    const feedbackList = (feedbackRes.data?.items || []).map((f: any) => ({
      id: f.id || f._id,
      comment: f.comment || '',
      status: f.status || 'new',
      rating: f.rating || 0,
      createdAt: f.createdAt,
      customerName: f.customerName || 'Unknown Customer',
    }));
    setFeedbacks(feedbackList);

    // Notifications logic
    let newNotifications: Notification[] = [];
    let newCount = 0;

    // Jobs
    const currentJobIds = new Set<string>(jobsWithProgress.map((j: Job) => j.id));
    jobsWithProgress.forEach((job: Job) => {
      if (!lastJobIds.current.has(job.id)) {
        newNotifications.push({
          id: Date.now() + Math.random(),
          title: 'New Job Assigned',
          message: `Job "${job.service}" assigned.`,
          time: job.createdAt ? new Date(job.createdAt).toLocaleString() : new Date().toLocaleString(),
          type: 'job',
        });
        newCount++;
      }
    });
    lastJobIds.current = currentJobIds;

    // Complaints
    const currentComplaintIds = new Set<string>(complaintsList.map((c: Complaint) => c.id));
    complaintsList.forEach((c: Complaint) => {
      if (!lastComplaintIds.current.has(c.id)) {
        newNotifications.push({
          id: Date.now() + Math.random(),
          title: 'New Complaint Assigned',
          message: `Complaint "${c.title}" assigned.`,
          time: c.createdAt ? new Date(c.createdAt).toLocaleString() : new Date().toLocaleString(),
          type: 'complaint',
        });
        newCount++;
      }
    });
    lastComplaintIds.current = currentComplaintIds;

    // Feedback
    const currentFeedbackIds = new Set<string>(feedbackList.map((f: Feedback) => f.id));
    feedbackList.forEach((f: Feedback) => {
      if (!lastFeedbackIds.current.has(f.id)) {
        newNotifications.push({
          id: Date.now() + Math.random(),
          title: 'New Feedback Received',
          message: `Feedback from ${f.customerName}.`,
          time: f.createdAt ? new Date(f.createdAt).toLocaleString() : new Date().toLocaleString(),
          type: 'feedback',
        });
        newCount++;
      }
    });
    lastFeedbackIds.current = currentFeedbackIds;

    if (newNotifications.length > 0) {
      setNotifications(prev => [...prev, ...newNotifications]);
      setUnreadCount(prev => prev + newCount);
    }

    // Load queries for each job
    const queriesData: { [jobId: string]: QueryMessage[] } = {};
    for (let job of jobsRes.data || []) {
      try {
        const qRes = await api.get(`/queries/job/${job.id || job._id}`);
        queriesData[job.id || job._id] = qRes.data || [];
      } catch (e) {
        queriesData[job.id || job._id] = [];
      }
    }
    setJobQueries(queriesData);

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
      case 'resolved':
        return { bg: '#dcfce7', text: '#166534' };
      case 'ongoing':
      case 'in_progress':
        return { bg: '#dbeafe', text: '#1d4ed8' };
      case 'pending':
        return { bg: '#fef3c7', text: '#92400e' };
      default:
        return { bg: '#f3f4f6', text: '#374151' };
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Update job status
  const updateJobStatus = async (jobId: string, status: 'in_progress' | 'completed') => {
    setStatusUpdating(true);
    try {
      await api.patch(`/jobs/${jobId}/status`, { status });
      await fetchAll();
      Alert.alert('Success', `Job marked as ${status.replace('_', ' ')}`);
      setJobDetailsModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Submit report
  const submitReport = async () => {
    if (!reportContent.trim() || !selectedJob) return;
    try {
      await api.post(`/jobs/${selectedJob.id}/report`, { content: reportContent });
      Alert.alert('Success', 'Report submitted');
      setReportContent('');
      await fetchAll();
      setJobDetailsModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit report');
    }
  };

  // Reply to query
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedJob) return;
    try {
      await api.post(`/queries/job/${selectedJob.id}`, {
        content: newMessage,
        type: 'reply',
      });
      const updatedQueries = await api.get(`/queries/job/${selectedJob.id}`);
      setJobQueries((prev) => ({ ...prev, [selectedJob.id]: updatedQueries.data || [] }));
      setNewMessage('');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to send message');
    }
  };

  // Update complaint status
  const updateComplaintStatus = async (complaintId: string) => {
    setComplaintStatusUpdating(true);
    try {
      await api.patch(`/complaints/${complaintId}/status`, { status: 'resolved' });
      await fetchAll();
      Alert.alert('Success', 'Complaint marked as resolved');
      setComplaintDetailsModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update complaint');
    } finally {
      setComplaintStatusUpdating(false);
    }
  };

  // Fetch job related to complaint
  const openComplaintDetails = async (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setComplaintJob(null);
    setComplaintDetailsModalVisible(true);
    try {
      const res = await api.get(`/jobs/by-complaint/${complaint.id}`);
      setComplaintJob(res.data || null);
    } catch {
      setComplaintJob(null);
    }
  };

  // Jobs Modal
  const JobsModal = () => (
    <Modal
      visible={showJobsModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowJobsModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Assigned Jobs</Text>
          <TouchableOpacity onPress={() => setShowJobsModal(false)}>
            <Icon name="x" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.modalContent}
          renderItem={({ item }) => {
            const statusStyle = getStatusColor(item.status);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.service}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.text }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Text>Date: {item.date}</Text>
                {item.customer && <Text>Customer: {item.customer}</Text>}
                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  onPress={() => {
                    setSelectedJob(item);
                    setJobDetailsModalVisible(true);
                    setReportContent('');
                    setNewMessage('');
                  }}
                >
                  <Text style={styles.viewDetailsText}>View Details</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="briefcase" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No jobs assigned</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );

  // Job Arrival Details Modal
  const JobArrivalModal = () => (
    <Modal
      visible={arrivalModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setArrivalModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Arrival Details</Text>
          <TouchableOpacity onPress={() => setArrivalModalVisible(false)}>
            <Icon name="x" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
        <View style={styles.modalContent}>
          <TouchableOpacity
            style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
            onPress={() => setShowArrivalPicker(true)}
          >
            <Text>
              {arrivalDate
                ? arrivalDate.toLocaleString()
                : 'Pick expected arrival date & time'}
            </Text>
            <Icon name="calendar" size={20} color="#2563eb" />
          </TouchableOpacity>
          {showArrivalPicker && (
            <DateTimePicker
              value={arrivalDate || new Date()}
              mode="datetime"
              display="default"
              onChange={(event, date) => {
                setShowArrivalPicker(false);
                if (date) setArrivalDate(date);
              }}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Notes"
            value={arrivalNote}
            onChangeText={setArrivalNote}
            multiline
          />
          <TouchableOpacity
            style={styles.sendButton}
            disabled={arrivalSubmitting}
            onPress={async () => {
              if (!selectedJob || !arrivalDate) {
                Alert.alert('Error', 'Please pick arrival date & time');
                return;
              }
              setArrivalSubmitting(true);
              try {
                await api.put(`/jobs/${selectedJob.id}/arrival`, {
                  expectedArrival: arrivalDate.toISOString(),
                  note: arrivalNote,
                });
                Alert.alert('Success', 'Arrival details submitted');
                setArrivalModalVisible(false);
                setArrivalNote('');
                setArrivalDate(null);
                await fetchAll();
              } catch (err: any) {
                Alert.alert('Error', err?.response?.data?.message || 'Failed to submit arrival details');
              } finally {
                setArrivalSubmitting(false);
              }
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Submit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Complaint Details Modal
  const ComplaintDetailsModal = () => (
    <Modal
      visible={complaintDetailsModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setComplaintDetailsModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Complaint Details</Text>
          <TouchableOpacity onPress={() => setComplaintDetailsModalVisible(false)}>
            <Icon name="x" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
        {selectedComplaint && (
          <ScrollView style={styles.modalContent}>
            <Text style={styles.cardTitle}>{selectedComplaint.title}</Text>
            <Text>Status: {selectedComplaint.status}</Text>
            <Text>Description: {selectedComplaint.description}</Text>
            <Text>Customer: {selectedComplaint.customerName}</Text>
            <Text>Date: {formatDate(selectedComplaint.createdAt || '')}</Text>
            {selectedComplaint.status !== 'resolved' && (
              <TouchableOpacity
                style={styles.primaryAction}
                disabled={complaintStatusUpdating}
                onPress={() => updateComplaintStatus(selectedComplaint.id)}
              >
                <Text style={styles.primaryActionText}>Mark as Resolved</Text>
              </TouchableOpacity>
            )}
            {/* Show related job if available */}
            {complaintJob && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionTitle}>Related Job</Text>
                <Text>Service: {complaintJob.service}</Text>
                <Text>Status: {complaintJob.status}</Text>
                <Text>Date: {complaintJob.date}</Text>
                <Text>Description: {complaintJob.description || 'No description provided'}</Text>
                {complaintJob.customer && <Text>Customer: {complaintJob.customer}</Text>}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  // Complaints Modal
  const ComplaintsModal = () => (
    <Modal
      visible={showComplaints}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowComplaints(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Assigned Complaints</Text>
          <TouchableOpacity onPress={() => setShowComplaints(false)}>
            <Icon name="x" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={complaints}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.modalContent}
          renderItem={({ item }) => {
            const statusStyle = getStatusColor(item.status);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.text }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardDescription}>{item.description}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardMetaText}>Customer: {item.customerName}</Text>
                  <Text style={styles.cardMetaText}>Date: {formatDate(item.createdAt || '')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  onPress={() => openComplaintDetails(item)}
                >
                  <Text style={styles.viewDetailsText}>View Details</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="alert-circle" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No complaints assigned</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );

  // Feedback Modal (no view details button)
  const FeedbackModal = () => (
    <Modal
      visible={showFeedback}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFeedback(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Customer Feedback</Text>
          <TouchableOpacity onPress={() => setShowFeedback(false)}>
            <Icon name="x" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={feedbacks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.modalContent}
          renderItem={({ item }) => {
            const statusStyle = getStatusColor(item.status);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Feedback from {item.customerName}</Text>
                  <View style={styles.ratingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Icon
                        key={star}
                        name="star"
                        size={16}
                        color={star <= (item.rating || 0) ? '#fbbf24' : '#d1d5db'}
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.cardDescription}>{item.comment}</Text>
                <View style={styles.cardMeta}>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.text }]}>
                      {item.status}
                    </Text>
                  </View>
                  <Text style={styles.cardMetaText}>Date: {formatDate(item.createdAt || '')}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="message-square" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No feedback yet</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );

  // Job Details Modal (arrival button only here)
  const JobDetailsModal = () => (
    <Modal
      visible={jobDetailsModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setJobDetailsModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Job Details</Text>
          <TouchableOpacity onPress={() => setJobDetailsModalVisible(false)}>
            <Icon name="x" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
        {selectedJob && (
          <ScrollView style={styles.modalContent}>
            <Text style={styles.cardTitle}>{selectedJob.service}</Text>
            <Text>Status: {selectedJob.status}</Text>
            <Text>Date: {selectedJob.date}</Text>
            <Text>Description: {selectedJob.description || 'No description provided'}</Text>
            {selectedJob.customer && <Text>Customer: {selectedJob.customer}</Text>}
            {/* Arrival Details Button - only here */}
            {selectedJob.status === 'assigned' && (
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => setArrivalModalVisible(true)}
              >
                <Text style={styles.primaryActionText}>Fill Arrival Details</Text>
              </TouchableOpacity>
            )}
            {/* Status Controls */}
            {['pending', 'assigned', 'in_progress'].includes(selectedJob.status) && (
              <View style={{ flexDirection: 'row', gap: 12, marginVertical: 12 }}>
                {selectedJob.status !== 'in_progress' && (
                  <TouchableOpacity
                    style={styles.primaryAction}
                    disabled={statusUpdating}
                    onPress={() => updateJobStatus(selectedJob.id, 'in_progress')}
                  >
                    <Text style={styles.primaryActionText}>Mark In Progress</Text>
                  </TouchableOpacity>
                )}
                {selectedJob.status !== 'completed' && (
                  <TouchableOpacity
                    style={styles.primaryAction}
                    disabled={statusUpdating}
                    onPress={() => updateJobStatus(selectedJob.id, 'completed')}
                  >
                    <Text style={styles.primaryActionText}>Mark Completed</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {/* Report Section */}
            {selectedJob.status === 'completed' && (
              <View style={{ marginVertical: 16 }}>
                <Text style={styles.sectionTitle}>Write Report</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Write your report about this job..."
                  value={reportContent}
                  onChangeText={setReportContent}
                  multiline
                />
                <TouchableOpacity style={styles.sendButton} onPress={submitReport}>
                  <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Submit Report</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* Queries Section */}
            <View style={{ marginVertical: 16 }}>
              <Text style={styles.sectionTitle}>Queries & Replies</Text>
              {(jobQueries[selectedJob.id] || []).length === 0 ? (
                <Text style={styles.emptyText}>No queries yet</Text>
              ) : (
                (jobQueries[selectedJob.id] || []).map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.messageBubble,
                      item.sender === 'worker' ? styles.workerBubble : styles.adminBubble,
                      item.type === 'penalty' && styles.penaltyBubble,
                    ]}
                  >
                    <Text style={styles.messageSender}>
                      {item.sender === 'admin' ? 'Admin' : 'You'} ({item.type})
                    </Text>
                    <Text style={styles.messageText}>{item.content}</Text>
                    <Text style={styles.messageTime}>{formatDate(item.createdAt)}</Text>
                  </View>
                ))
              )}
              {/* Reply to Query */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Reply to query..."
                  value={newMessage}
                  onChangeText={setNewMessage}
                />
                <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                  <Icon name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );

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
          <TouchableOpacity style={styles.notificationButton} onPress={() => {
            setShowNotifications(true);
            setUnreadCount(0); // Mark all as read when opened
          }}>
            <Icon name="bell" size={20} color="#fff" />
            {unreadCount > 0 && (
              <View style={{
                position: 'absolute',
                top: 2,
                right: 2,
                backgroundColor: '#ef4444',
                borderRadius: 8,
                paddingHorizontal: 5,
                paddingVertical: 1,
                minWidth: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Hello, {user?.name || profile?.name || 'Worker'}!</Text>
          <Text style={styles.welcomeSubtitle}>Here's your assigned work and updates.</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.primaryAction} onPress={() => setShowJobsModal(true)}>
              <Icon name="briefcase" size={20} color="#fff" />
              <Text style={styles.primaryActionText}>My Jobs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={() => setShowComplaints(true)}>
              <Icon name="alert-circle" size={20} color="#374151" />
              <Text style={styles.secondaryActionText}>Complaints</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={() => setShowFeedback(true)}>
              <Icon name="message-square" size={20} color="#374151" />
              <Text style={styles.secondaryActionText}>Feedback</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Jobs */}
        <View style={styles.section}>
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>Assigned Jobs</Text>
    <TouchableOpacity onPress={() => setShowJobsModal(true)}>
      <Text style={styles.viewAllButton}>View All</Text>
    </TouchableOpacity>
  </View>
  {jobs.length === 0 ? (
    <View style={styles.emptyState}>
      <Icon name="briefcase" size={48} color="#d1d5db" />
      <Text style={styles.emptyText}>No jobs assigned</Text>
    </View>
  ) : (
    jobs.slice(0, 2).map((job) => {
      const statusStyle = getStatusColor(job.status);
      return (
        <View key={job.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{job.service}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>{job.status}</Text>
            </View>
          </View>
          <Text>Date: {job.date}</Text>
          {job.customer && <Text>Customer: {job.customer}</Text>}
          {/* Only show "View Details" here */}
          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={() => {
              setSelectedJob(job);
              setJobDetailsModalVisible(true);
              setReportContent('');
              setNewMessage('');
            }}
          >
            <Text style={styles.viewDetailsText}>View Details</Text>
          </TouchableOpacity>
        </View>
      );
    })
  )}
</View>

        {/* Complaints */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assigned Complaints</Text>
            <TouchableOpacity onPress={() => setShowComplaints(true)}>
              <Text style={styles.viewAllButton}>View All</Text>
            </TouchableOpacity>
          </View>
          {complaints.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="alert-circle" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No complaints assigned</Text>
            </View>
          ) : (
            complaints.slice(0, 2).map((c) => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.cardDescription}>{c.description}</Text>
                <Text>Status: {c.status}</Text>
              </View>
            ))
          )}
        </View>

        {/* Feedback */}
        <View style={[styles.section, { marginBottom: 20 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Customer Feedback</Text>
            <TouchableOpacity onPress={() => setShowFeedback(true)}>
              <Text style={styles.viewAllButton}>View All</Text>
            </TouchableOpacity>
          </View>
          {feedbacks.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="message-square" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No feedback yet</Text>
            </View>
          ) : (
            feedbacks.slice(0, 2).map((f) => (
              <View key={f.id} style={styles.card}>
                <Text style={styles.cardTitle}>Feedback from {f.customerName}</Text>
                <Text style={styles.cardDescription}>{f.comment}</Text>
                <Text>Status: {f.status}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <NotificationModal />
      <JobsModal />
      <ComplaintsModal />
      <FeedbackModal />
      <JobDetailsModal />
      <ComplaintDetailsModal />
      <JobArrivalModal />
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
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  cardMetaText: {
    fontSize: 13,
    color: '#6b7280',
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
  ratingContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  viewDetailsButton: {
    marginTop: 8,
  },
  viewDetailsText: {
    color: '#2563eb',
    fontWeight: '500',
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
  modal: { flex: 1, backgroundColor: '#fff' },
  messageBubble: { marginVertical: 6, padding: 10, borderRadius: 8, maxWidth: '80%' },
  adminBubble: { backgroundColor: '#dbeafe', alignSelf: 'flex-start' },
  workerBubble: { backgroundColor: '#dcfce7', alignSelf: 'flex-end' },
  penaltyBubble: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#b91c1c' },
  messageSender: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  messageText: { fontSize: 14 },
  messageTime: { fontSize: 10, color: '#6b7280', marginTop: 4 },
  inputContainer: { flexDirection: 'row', padding: 8, backgroundColor: '#f3f4f6', alignItems: 'center' },
  input: {
    flex: 1,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 8,
  },
  sendButton: { padding: 10, backgroundColor: '#2563eb', borderRadius: 8 },
  reportButton: { padding: 10, backgroundColor: '#16a34a', borderRadius: 8, marginLeft: 6 },
});