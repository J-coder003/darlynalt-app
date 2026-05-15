import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity,
  RefreshControl, Dimensions, Modal, FlatList, TextInput, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../utils/api';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

type Job = { id: string; service: string; status: string; date: string; customer?: string | null; amount?: number; progress?: number; description?: string; createdAt?: string };
type Complaint = { id: string; title: string; description: string; status: string; createdAt?: string; customerName?: string };
type Feedback = { id: string; comment: string; status: string; rating?: number; createdAt?: string; customerName?: string };
type Notification = { id: number; title: string; message: string; time: string; type: string };
type QueryMessage = { id: string; sender: 'admin' | 'worker'; content: string; type?: string; createdAt: string };

export default function WorkerHome({ navigation }: any) {
  const { user } = useSelector((s: RootState) => s.auth);

  const [profile, setProfile] = useState<any | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [jobQueries, setJobQueries] = useState<{ [jobId: string]: QueryMessage[] }>({});
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetailsModalVisible, setJobDetailsModalVisible] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [reportContent, setReportContent] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [complaintDetailsModalVisible, setComplaintDetailsModalVisible] = useState(false);
  const [complaintStatusUpdating, setComplaintStatusUpdating] = useState(false);
  const [complaintJob, setComplaintJob] = useState<Job | null>(null);

  const [arrivalModalVisible, setArrivalModalVisible] = useState(false);
  const [arrivalNote, setArrivalNote] = useState('');
  const [arrivalSubmitting, setArrivalSubmitting] = useState(false);
  const [showArrivalPicker, setShowArrivalPicker] = useState(false);
  const [arrivalDate, setArrivalDate] = useState<Date | null>(null);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showComplaints, setShowComplaints] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showJobsModal, setShowJobsModal] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const lastJobIds = useRef<Set<string>>(new Set());
  const lastComplaintIds = useRef<Set<string>>(new Set());
  const lastFeedbackIds = useRef<Set<string>>(new Set());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':  return { bg: '#0a2a1a', text: '#44cc77' };
      case 'ongoing':
      case 'in_progress': return { bg: '#0a1a3e', text: '#6688ff' };
      case 'pending':
      case 'assigned':    return { bg: '#2a1a0a', text: '#dd9944' };
      default:            return { bg: '#1a1a2e', text: '#8888bb' };
    }
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : 'N/A';

  const fetchAll = async () => {
    try {
      setLoading(true);
      const profileRes = await api.get('/users/me');
      setProfile(profileRes.data);

      const [jobsRes, complaintsRes, feedbackRes] = await Promise.all([
        api.get('/jobs/assigned'),
        api.get('/complaints/assigned'),
        api.get('/feedback/assigned'),
      ]);

      const jobsNorm: Job[] = (jobsRes.data || []).map((job: any) => ({
        id: job.id || job._id,
        service: job.serviceType || job.service || 'Service',
        status: job.status || 'pending',
        date: job.createdAt ? new Date(job.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        customer: job.customerName || job.customer || null,
        amount: job.amount || 0,
        progress: job.status === 'ongoing' ? Math.floor(Math.random() * 80) + 10 : job.status === 'completed' ? 100 : 0,
        description: job.description || '',
        createdAt: job.createdAt,
      }));
      setJobs(jobsNorm);

      const complaintsList: Complaint[] = (complaintsRes.data?.items || []).map((c: any) => ({
        id: c.id || c._id, title: c.title || 'Complaint', description: c.description || '',
        status: c.status || 'pending', createdAt: c.createdAt, customerName: c.customerName || 'Unknown',
      }));
      setComplaints(complaintsList);

      const feedbackList: Feedback[] = (feedbackRes.data?.items || []).map((f: any) => ({
        id: f.id || f._id, comment: f.comment || '', status: f.status || 'new',
        rating: f.rating || 0, createdAt: f.createdAt, customerName: f.customerName || 'Unknown',
      }));
      setFeedbacks(feedbackList);

      // Notifications
      let newNotifs: Notification[] = [];
      let newCount = 0;
      const currentJobIds = new Set<string>(jobsNorm.map(j => j.id));
      jobsNorm.forEach(job => {
        if (!lastJobIds.current.has(job.id)) {
          newNotifs.push({ id: Date.now() + Math.random(), title: 'New Job Assigned', message: `Job "${job.service}" assigned.`, time: job.createdAt ? new Date(job.createdAt).toLocaleString() : new Date().toLocaleString(), type: 'job' });
          newCount++;
        }
      });
      lastJobIds.current = currentJobIds;

      const currentComplaintIds = new Set<string>(complaintsList.map(c => c.id));
      complaintsList.forEach(c => {
        if (!lastComplaintIds.current.has(c.id)) {
          newNotifs.push({ id: Date.now() + Math.random(), title: 'New Complaint Assigned', message: `Complaint "${c.title}" assigned.`, time: c.createdAt ? new Date(c.createdAt).toLocaleString() : new Date().toLocaleString(), type: 'complaint' });
          newCount++;
        }
      });
      lastComplaintIds.current = currentComplaintIds;

      const currentFeedbackIds = new Set<string>(feedbackList.map(f => f.id));
      feedbackList.forEach(f => {
        if (!lastFeedbackIds.current.has(f.id)) {
          newNotifs.push({ id: Date.now() + Math.random(), title: 'New Feedback', message: `Feedback from ${f.customerName}.`, time: f.createdAt ? new Date(f.createdAt).toLocaleString() : new Date().toLocaleString(), type: 'feedback' });
          newCount++;
        }
      });
      lastFeedbackIds.current = currentFeedbackIds;

      if (newNotifs.length > 0) { setNotifications(prev => [...prev, ...newNotifs]); setUnreadCount(prev => prev + newCount); }

      const queriesData: { [jobId: string]: QueryMessage[] } = {};
      for (let job of jobsRes.data || []) {
        try { const qRes = await api.get(`/queries/job/${job.id || job._id}`); queriesData[job.id || job._id] = qRes.data || []; }
        catch { queriesData[job.id || job._id] = []; }
      }
      setJobQueries(queriesData);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to load data');
    } finally { setLoading(false); }
  };

  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); }, []);
  useEffect(() => { fetchAll(); }, []);

  const updateJobStatus = async (jobId: string, status: 'in_progress' | 'completed') => {
    setStatusUpdating(true);
    try {
      await api.patch(`/jobs/${jobId}/status`, { status });
      await fetchAll();
      Alert.alert('Success', `Job marked as ${status.replace('_', ' ')}`);
      setJobDetailsModalVisible(false);
    } catch (err: any) { Alert.alert('Error', err?.response?.data?.message || 'Failed to update status'); }
    finally { setStatusUpdating(false); }
  };

  const submitReport = async () => {
    if (!reportContent.trim() || !selectedJob) return;
    try {
      await api.post(`/jobs/${selectedJob.id}/report`, { content: reportContent });
      Alert.alert('Success', 'Report submitted');
      setReportContent('');
      await fetchAll();
      setJobDetailsModalVisible(false);
    } catch (err: any) { Alert.alert('Error', err?.response?.data?.message || 'Failed to submit report'); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedJob) return;
    try {
      await api.post(`/queries/job/${selectedJob.id}`, { content: newMessage, type: 'reply' });
      const updatedQueries = await api.get(`/queries/job/${selectedJob.id}`);
      setJobQueries(prev => ({ ...prev, [selectedJob.id]: updatedQueries.data || [] }));
      setNewMessage('');
    } catch (err: any) { Alert.alert('Error', err?.response?.data?.message || 'Failed to send message'); }
  };

  const updateComplaintStatus = async (complaintId: string) => {
    setComplaintStatusUpdating(true);
    try {
      await api.patch(`/complaints/${complaintId}/status`, { status: 'resolved' });
      await fetchAll();
      Alert.alert('Success', 'Complaint marked as resolved');
      setComplaintDetailsModalVisible(false);
    } catch (err: any) { Alert.alert('Error', err?.response?.data?.message || 'Failed to update complaint'); }
    finally { setComplaintStatusUpdating(false); }
  };

  const openComplaintDetails = async (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setComplaintJob(null);
    setComplaintDetailsModalVisible(true);
    try { const res = await api.get(`/jobs/by-complaint/${complaint.id}`); setComplaintJob(res.data || null); }
    catch { setComplaintJob(null); }
  };

  // ─── STATS ─────────────────────────────────────────────────────────────────
  const activeJobs = jobs.filter(j => j.status === 'ongoing' || j.status === 'in_progress' || j.status === 'assigned').length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const pendingComplaints = complaints.filter(c => c.status !== 'resolved').length;
  const displayName = (user?.name || profile?.name || 'Worker').split(' ');
  const shortName = displayName[0] + (displayName[1] ? ` ${displayName[1][0]}.` : '');

  // ─── MODALS ────────────────────────────────────────────────────────────────
  const NotificationModal = () => (
    <Modal visible={showNotifications} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotifications(false)}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Notifications</Text>
          <TouchableOpacity onPress={() => setShowNotifications(false)}><Icon name="x" size={22} color="#aaaacc" /></TouchableOpacity>
        </View>
        <FlatList
          data={notifications.slice().reverse()}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.modalContent}
          renderItem={({ item }) => (
            <View style={styles.notifItem}>
              <View style={[styles.notifIconWrap, { backgroundColor: item.type === 'job' ? '#0d1f4e' : item.type === 'complaint' ? '#2a0a0a' : '#0a2a1a' }]}>
                <Icon name={item.type === 'job' ? 'briefcase' : item.type === 'complaint' ? 'alert-circle' : 'message-square'} size={14}
                  color={item.type === 'job' ? '#6688ff' : item.type === 'complaint' ? '#ff6b6b' : '#44cc77'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifMsg}>{item.message}</Text>
                <Text style={styles.notifTime}>{item.time}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<View style={styles.emptyState}><Icon name="bell-off" size={36} color="#2a2a40" /><Text style={styles.emptyText}>No notifications</Text></View>}
        />
      </View>
    </Modal>
  );

  const JobsModal = () => (
    <Modal visible={showJobsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowJobsModal(false)}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Assigned Jobs</Text>
          <TouchableOpacity onPress={() => setShowJobsModal(false)}><Icon name="x" size={22} color="#aaaacc" /></TouchableOpacity>
        </View>
        <FlatList
          data={jobs}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.modalContent}
          renderItem={({ item }) => {
            const sc = getStatusColor(item.status);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.service}</Text>
                    <Text style={styles.cardMeta}>{item.date}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.text }]}>{item.status}</Text>
                  </View>
                </View>
                {item.customer && <Text style={styles.cardMeta}>👤 {item.customer}</Text>}
                <TouchableOpacity style={styles.viewDetailsBtn} onPress={() => { setSelectedJob(item); setJobDetailsModalVisible(true); setReportContent(''); setNewMessage(''); }}>
                  <Text style={styles.viewDetailsTxt}>View Details →</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={<View style={styles.emptyState}><Icon name="briefcase" size={36} color="#2a2a40" /><Text style={styles.emptyText}>No jobs assigned</Text></View>}
        />
      </View>
    </Modal>
  );

  const JobArrivalModal = () => (
    <Modal visible={arrivalModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setArrivalModalVisible(false)}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Arrival Details</Text>
          <TouchableOpacity onPress={() => setArrivalModalVisible(false)}><Icon name="x" size={22} color="#aaaacc" /></TouchableOpacity>
        </View>
        <View style={[styles.modalContent, { paddingTop: 24 }]}>
          <Text style={styles.fieldLabel}>Expected Arrival</Text>
          <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowArrivalPicker(true)}>
            <Icon name="calendar" size={16} color="#7a6ff0" style={{ marginRight: 8 }} />
            <Text style={{ color: arrivalDate ? '#e0e0ff' : '#333366', fontSize: 14 }}>
              {arrivalDate ? arrivalDate.toLocaleString() : 'Pick date & time'}
            </Text>
          </TouchableOpacity>
          {showArrivalPicker && (
            <DateTimePicker value={arrivalDate || new Date()} mode="datetime" display="default"
              onChange={(_, date) => { setShowArrivalPicker(false); if (date) setArrivalDate(date); }} />
          )}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Notes</Text>
          <TextInput style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]} placeholder="Add notes..." placeholderTextColor="#333366" value={arrivalNote} onChangeText={setArrivalNote} multiline />
          <TouchableOpacity style={[styles.actionBtn, { marginTop: 24 }]} disabled={arrivalSubmitting}
            onPress={async () => {
              if (!selectedJob || !arrivalDate) { Alert.alert('Error', 'Please pick arrival date & time'); return; }
              setArrivalSubmitting(true);
              try {
                await api.put(`/jobs/${selectedJob.id}/arrival`, { expectedArrival: arrivalDate.toISOString(), note: arrivalNote });
                Alert.alert('Success', 'Arrival details submitted');
                setArrivalModalVisible(false); setArrivalNote(''); setArrivalDate(null); await fetchAll();
              } catch (err: any) { Alert.alert('Error', err?.response?.data?.message || 'Failed to submit'); }
              finally { setArrivalSubmitting(false); }
            }}>
            {arrivalSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionBtnText}>Submit Arrival</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const ComplaintDetailsModal = () => (
    <Modal visible={complaintDetailsModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setComplaintDetailsModalVisible(false)}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Complaint Details</Text>
          <TouchableOpacity onPress={() => setComplaintDetailsModalVisible(false)}><Icon name="x" size={22} color="#aaaacc" /></TouchableOpacity>
        </View>
        {selectedComplaint && (
          <ScrollView style={styles.modalContent}>
            {[
              { label: 'Title', value: selectedComplaint.title },
              { label: 'Customer', value: selectedComplaint.customerName },
              { label: 'Status', value: selectedComplaint.status },
              { label: 'Date', value: formatDate(selectedComplaint.createdAt || '') },
              { label: 'Description', value: selectedComplaint.description },
            ].map(({ label, value }) => (
              <View key={label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
            ))}
            {selectedComplaint.status !== 'resolved' && (
              <TouchableOpacity style={[styles.actionBtn, { marginTop: 24 }]} disabled={complaintStatusUpdating} onPress={() => updateComplaintStatus(selectedComplaint.id)}>
                {complaintStatusUpdating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionBtnText}>Mark as Resolved</Text>}
              </TouchableOpacity>
            )}
            {complaintJob && (
              <View style={{ marginTop: 24 }}>
                <Text style={styles.sectionLabel}>Related Job</Text>
                {[{ label: 'Service', value: complaintJob.service }, { label: 'Status', value: complaintJob.status }, { label: 'Date', value: complaintJob.date }].map(({ label, value }) => (
                  <View key={label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={styles.detailValue}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  const ComplaintsModal = () => (
    <Modal visible={showComplaints} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowComplaints(false)}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Assigned Complaints</Text>
          <TouchableOpacity onPress={() => setShowComplaints(false)}><Icon name="x" size={22} color="#aaaacc" /></TouchableOpacity>
        </View>
        <FlatList
          data={complaints}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.modalContent}
          renderItem={({ item }) => {
            const sc = getStatusColor(item.status);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>{item.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.text }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardDesc}>{item.description}</Text>
                <Text style={styles.cardMeta}>👤 {item.customerName} · {formatDate(item.createdAt || '')}</Text>
                <TouchableOpacity style={styles.viewDetailsBtn} onPress={() => openComplaintDetails(item)}>
                  <Text style={styles.viewDetailsTxt}>View Details →</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={<View style={styles.emptyState}><Icon name="alert-circle" size={36} color="#2a2a40" /><Text style={styles.emptyText}>No complaints assigned</Text></View>}
        />
      </View>
    </Modal>
  );

  const FeedbackModal = () => (
    <Modal visible={showFeedback} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFeedback(false)}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Customer Feedback</Text>
          <TouchableOpacity onPress={() => setShowFeedback(false)}><Icon name="x" size={22} color="#aaaacc" /></TouchableOpacity>
        </View>
        <FlatList
          data={feedbacks}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.modalContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { flex: 1 }]}>From {item.customerName}</Text>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Icon key={star} name="star" size={14} color={star <= (item.rating || 0) ? '#fbbf24' : '#2a2a40'} />
                  ))}
                </View>
              </View>
              <Text style={styles.cardDesc}>{item.comment}</Text>
              <Text style={styles.cardMeta}>{formatDate(item.createdAt || '')}</Text>
            </View>
          )}
          ListEmptyComponent={<View style={styles.emptyState}><Icon name="message-square" size={36} color="#2a2a40" /><Text style={styles.emptyText}>No feedback yet</Text></View>}
        />
      </View>
    </Modal>
  );

  const JobDetailsModal = () => (
    <Modal visible={jobDetailsModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setJobDetailsModalVisible(false)}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Job Details</Text>
          <TouchableOpacity onPress={() => setJobDetailsModalVisible(false)}><Icon name="x" size={22} color="#aaaacc" /></TouchableOpacity>
        </View>
        {selectedJob && (
          <ScrollView style={styles.modalContent}>
            {[
              { label: 'Service', value: selectedJob.service },
              { label: 'Status', value: selectedJob.status, badge: true },
              { label: 'Date', value: selectedJob.date },
              { label: 'Customer', value: selectedJob.customer || 'Unknown' },
              ...(selectedJob.description ? [{ label: 'Description', value: selectedJob.description }] : []),
            ].map(({ label, value, badge }) => (
              <View key={label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{label}</Text>
                {badge ? (
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(value as string).bg }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(value as string).text }]}>{value}</Text>
                  </View>
                ) : <Text style={styles.detailValue}>{value}</Text>}
              </View>
            ))}

            {/* Arrival */}
            {selectedJob.status === 'assigned' && (
              <TouchableOpacity style={[styles.actionBtn, { marginTop: 20 }]} onPress={() => setArrivalModalVisible(true)}>
                <Icon name="calendar" size={15} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Fill Arrival Details</Text>
              </TouchableOpacity>
            )}

            {/* Status controls */}
            {['pending', 'assigned', 'in_progress'].includes(selectedJob.status) && (
              <View style={{ gap: 10, marginTop: 16 }}>
                {selectedJob.status !== 'in_progress' && (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#0d4a8e' }]} disabled={statusUpdating} onPress={() => updateJobStatus(selectedJob.id, 'in_progress')}>
                    {statusUpdating ? <ActivityIndicator color="#fff" size="small" /> : <><Icon name="play" size={14} color="#fff" style={{ marginRight: 8 }} /><Text style={styles.actionBtnText}>Mark In Progress</Text></>}
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#0a4a2a' }]} disabled={statusUpdating} onPress={() => updateJobStatus(selectedJob.id, 'completed')}>
                  {statusUpdating ? <ActivityIndicator color="#fff" size="small" /> : <><Icon name="check-circle" size={14} color="#44cc77" style={{ marginRight: 8 }} /><Text style={[styles.actionBtnText, { color: '#44cc77' }]}>Mark Completed</Text></>}
                </TouchableOpacity>
              </View>
            )}

            {/* Report */}
            {selectedJob.status === 'completed' && (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.sectionLabel}>Write Report</Text>
                <TextInput style={[styles.textInput, { height: 90, textAlignVertical: 'top', marginTop: 8 }]}
                  placeholder="Write your report about this job..." placeholderTextColor="#333366"
                  value={reportContent} onChangeText={setReportContent} multiline />
                <TouchableOpacity style={[styles.actionBtn, { marginTop: 10 }]} onPress={submitReport}>
                  <Icon name="file-text" size={14} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>Submit Report</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Queries */}
            <View style={{ marginTop: 24, marginBottom: 40 }}>
              <Text style={styles.sectionLabel}>Queries & Replies</Text>
              {(jobQueries[selectedJob.id] || []).length === 0 ? (
                <Text style={{ color: '#333355', fontSize: 13, marginTop: 8 }}>No queries yet</Text>
              ) : (
                (jobQueries[selectedJob.id] || []).map(item => (
                  <View key={item.id} style={[styles.messageBubble, item.sender === 'worker' ? styles.workerBubble : styles.adminBubble, item.type === 'penalty' && styles.penaltyBubble]}>
                    <Text style={styles.messageSender}>{item.sender === 'admin' ? 'Admin' : 'You'} · {item.type}</Text>
                    <Text style={styles.messageText}>{item.content}</Text>
                    <Text style={styles.messageTime}>{formatDate(item.createdAt)}</Text>
                  </View>
                ))
              )}
              <View style={styles.replyRow}>
                <TextInput style={styles.replyInput} placeholder="Reply to query..." placeholderTextColor="#333366" value={newMessage} onChangeText={setNewMessage} />
                <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                  <Icon name="send" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  // ─── MAIN RENDER ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5340f0" />} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>DARLYN-ALT</Text>
          <TouchableOpacity style={styles.notifBtn} onPress={() => { setShowNotifications(true); setUnreadCount(0); }}>
            <Icon name="bell" size={18} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>{unreadCount}</Text></View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── WELCOME CARD ── */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeOrb} />
          <View style={styles.workerBadge}>
            <Icon name="briefcase" size={11} color="#a090ff" style={{ marginRight: 4 }} />
            <Text style={styles.workerBadgeText}>STAFF</Text>
          </View>
          <Text style={styles.welcomeGreeting}>Good morning</Text>
          <Text style={styles.welcomeName}>{shortName}</Text>
          <Text style={styles.welcomeSub}>Here's your assigned work & updates.</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{activeJobs}</Text>
              <Text style={styles.statLabel}>Active Jobs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{completedJobs}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{pendingComplaints}</Text>
              <Text style={styles.statLabel}>Complaints</Text>
            </View>
          </View>
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          <View style={styles.quickActionsRow}>
            {[
              { label: 'My Jobs', icon: 'briefcase', onPress: () => setShowJobsModal(true), primary: true },
              { label: 'Complaints', icon: 'alert-circle', onPress: () => setShowComplaints(true) },
              { label: 'Feedback', icon: 'message-square', onPress: () => setShowFeedback(true) },
            ].map(({ label, icon, onPress, primary }) => (
              <TouchableOpacity key={label} style={[styles.quickBtn, primary && styles.quickBtnPrimary]} onPress={onPress} activeOpacity={0.8}>
                <Icon name={icon} size={18} color={primary ? '#fff' : '#7a6ff0'} />
                <Text style={[styles.quickBtnText, primary && styles.quickBtnTextPrimary]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── ASSIGNED JOBS ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ASSIGNED JOBS</Text>
            <TouchableOpacity onPress={() => setShowJobsModal(true)}><Text style={styles.seeAll}>View all</Text></TouchableOpacity>
          </View>
          {jobs.length === 0 ? (
            <View style={styles.emptyState}><Icon name="briefcase" size={32} color="#2a2a40" /><Text style={styles.emptyText}>No jobs assigned yet</Text></View>
          ) : jobs.slice(0, 2).map(job => {
            const sc = getStatusColor(job.status);
            return (
              <TouchableOpacity key={job.id} style={styles.card} onPress={() => { setSelectedJob(job); setJobDetailsModalVisible(true); setReportContent(''); setNewMessage(''); }}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{job.service}</Text>
                    <Text style={styles.cardMeta}>{job.date}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.text }]}>{job.status}</Text>
                  </View>
                </View>
                {job.customer && (
                  <View style={styles.metaRow}>
                    <Icon name="user" size={12} color="#555577" style={{ marginRight: 4 }} />
                    <Text style={styles.cardMeta}>{job.customer}</Text>
                  </View>
                )}
                {job.status === 'in_progress' && job.progress !== undefined && (
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${job.progress}%` as any }]} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── COMPLAINTS ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>COMPLAINTS</Text>
            <TouchableOpacity onPress={() => setShowComplaints(true)}><Text style={styles.seeAll}>View all</Text></TouchableOpacity>
          </View>
          {complaints.length === 0 ? (
            <View style={styles.emptyState}><Icon name="alert-circle" size={32} color="#2a2a40" /><Text style={styles.emptyText}>No complaints assigned</Text></View>
          ) : complaints.slice(0, 2).map(c => {
            const sc = getStatusColor(c.status);
            return (
              <TouchableOpacity key={c.id} style={styles.card} onPress={() => openComplaintDetails(c)}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>{c.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.text }]}>{c.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>{c.description}</Text>
                <Text style={styles.cardMeta}>👤 {c.customerName}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── FEEDBACK ── */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>FEEDBACK</Text>
            <TouchableOpacity onPress={() => setShowFeedback(true)}><Text style={styles.seeAll}>View all</Text></TouchableOpacity>
          </View>
          {feedbacks.length === 0 ? (
            <View style={styles.emptyState}><Icon name="message-square" size={32} color="#2a2a40" /><Text style={styles.emptyText}>No feedback yet</Text></View>
          ) : feedbacks.slice(0, 2).map(f => (
            <View key={f.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { flex: 1 }]}>From {f.customerName}</Text>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map(star => <Icon key={star} name="star" size={13} color={star <= (f.rating || 0) ? '#fbbf24' : '#2a2a40'} />)}
                </View>
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>{f.comment}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── MODALS ── */}
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
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  scrollView: { flex: 1 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12 },
  appTitle: { fontSize: 16, fontWeight: '800', color: '#ffffff', letterSpacing: 3 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111128', borderWidth: 0.5, borderColor: '#2a2a40', alignItems: 'center', justifyContent: 'center' },
  notifBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#e03b6a', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  welcomeCard: { margin: 20, marginTop: 8, backgroundColor: '#0d1f4e', borderRadius: 20, padding: 20, borderWidth: 0.5, borderColor: '#2a3a8e', overflow: 'hidden' },
  welcomeOrb: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(83,64,240,0.18)', right: -30, top: -30 },
  workerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(160,144,255,0.12)', borderWidth: 0.5, borderColor: '#3a3a7e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 12 },
  workerBadgeText: { color: '#a090ff', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  welcomeGreeting: { color: '#7a90cc', fontSize: 14, marginBottom: 2 },
  welcomeName: { color: '#ffffff', fontSize: 26, fontWeight: '700', marginBottom: 4 },
  welcomeSub: { color: '#5566aa', fontSize: 13, marginBottom: 16 },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 14, overflow: 'hidden' },
  statBox: { flex: 1, padding: 14, alignItems: 'center' },
  statDivider: { width: 0.5, backgroundColor: '#2a3a8e' },
  statValue: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 2 },
  statLabel: { color: '#5566aa', fontSize: 11 },

  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#555577', letterSpacing: 1.5 },
  seeAll: { color: '#5340f0', fontSize: 13, fontWeight: '500' },

  quickActionsRow: { flexDirection: 'row', gap: 10 },
  quickBtn: { flex: 1, backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 6 },
  quickBtnPrimary: { backgroundColor: '#4f35e8', borderColor: '#5340f0', shadowColor: '#5340f0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  quickBtnText: { color: '#7a6ff0', fontSize: 12, fontWeight: '600' },
  quickBtnTextPrimary: { color: '#fff' },

  card: { backgroundColor: '#111120', borderRadius: 16, borderWidth: 0.5, borderColor: '#2a2a40', padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { color: '#eeeeee', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  cardDesc: { color: '#555577', fontSize: 13, marginBottom: 8 },
  cardMeta: { color: '#444466', fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  progressBar: { height: 4, backgroundColor: '#1a1a30', borderRadius: 2, marginTop: 10 },
  progressFill: { height: '100%', backgroundColor: '#5340f0', borderRadius: 2 },
  viewDetailsBtn: { marginTop: 8 },
  viewDetailsTxt: { color: '#5340f0', fontSize: 13, fontWeight: '500' },

  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { color: '#333355', fontSize: 13, fontWeight: '500', marginTop: 10 },

  modalContainer: { flex: 1, backgroundColor: '#0a0a0f' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 56, borderBottomWidth: 0.5, borderBottomColor: '#1a1a30' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  modalContent: { padding: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#555577', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#1a1a30' },
  detailLabel: { color: '#555577', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  detailValue: { color: '#ddddff', fontSize: 14, flex: 1, textAlign: 'right' },
  actionBtn: { backgroundColor: '#4f35e8', paddingVertical: 15, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', shadowColor: '#5340f0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6666aa', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 12, paddingHorizontal: 14, height: 52 },
  textInput: { backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 12, padding: 14, color: '#e0e0ff', fontSize: 14 },
  messageBubble: { marginVertical: 6, padding: 12, borderRadius: 12, maxWidth: '80%' },
  adminBubble: { backgroundColor: '#0d1a3e', alignSelf: 'flex-start', borderWidth: 0.5, borderColor: '#2a3a7e' },
  workerBubble: { backgroundColor: '#1a0a3e', alignSelf: 'flex-end', borderWidth: 0.5, borderColor: '#3a2a6e' },
  penaltyBubble: { backgroundColor: '#2a0a0a', borderWidth: 0.5, borderColor: '#5a1a1a' },
  messageSender: { fontSize: 11, fontWeight: '600', marginBottom: 4, color: '#8888bb' },
  messageText: { fontSize: 14, color: '#ddddff' },
  messageTime: { fontSize: 10, color: '#444466', marginTop: 4 },
  replyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  replyInput: { flex: 1, backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 12, padding: 12, color: '#e0e0ff', fontSize: 14 },
  sendBtn: { width: 44, height: 44, backgroundColor: '#5340f0', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifItem: { flexDirection: 'row', backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 14, padding: 14, marginBottom: 10 },
  notifIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  notifTitle: { color: '#ddddff', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  notifMsg: { color: '#555577', fontSize: 12 },
  notifTime: { color: '#333355', fontSize: 11, marginTop: 4 },
});