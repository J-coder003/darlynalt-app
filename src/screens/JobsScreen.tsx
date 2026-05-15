import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../utils/api';

type Job = {
  id: string;
  service: string;
  status: string;
  date: string;
  worker?: string | null;
  amount?: number;
  progress?: number;
  description?: string;
  address?: string;
  feedback?: { rating: number; comment: string } | null;
  complaints?: { title: string; description: string; status: string }[];
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  completed: { label: 'Completed', bg: 'rgba(34,197,94,0.12)', text: '#4ade80', dot: '#4ade80' },
  ongoing:   { label: 'Ongoing',   bg: 'rgba(99,102,241,0.15)', text: '#818cf8', dot: '#818cf8' },
  pending:   { label: 'Pending',   bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', dot: '#fbbf24' },
};

const getStatus = (status: string) =>
  STATUS_CONFIG[status] ?? { label: status, bg: 'rgba(255,255,255,0.08)', text: '#aaaacc', dot: '#aaaacc' };

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const [complaintTitle, setComplaintTitle] = useState('');
  const [complaintText, setComplaintText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [submitting, setSubmitting] = useState(false);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const [jobsRes, complaintsRes, feedbackRes, invoicesRes] = await Promise.all([
        api.get('/jobs/my'),
        api.get('/complaints/my'),
        api.get('/feedback/my'),
        api.get('/invoices'),
      ]);

      const complaintsData = Array.isArray(complaintsRes.data?.items) ? complaintsRes.data.items : [];
      const feedbackData = Array.isArray(feedbackRes.data) ? feedbackRes.data : feedbackRes.data?.feedback || [];
      const invoicesData = Array.isArray(invoicesRes.data) ? invoicesRes.data : invoicesRes.data?.invoices || [];

      const jobsData = (jobsRes.data || []).map((job: any) => {
        const jobId = job._id || job.id;
        const jobComplaints = complaintsData.filter((c: any) => {
          const cJobId = typeof c.jobId === 'object' ? c.jobId._id : c.jobId;
          return cJobId === jobId;
        });
        const jobFeedback = feedbackData.find((f: any) => {
          const fJobId = typeof f.jobId === 'object' ? f.jobId._id : f.jobId;
          return fJobId === jobId;
        }) || null;
        const jobInvoices = invoicesData.filter((inv: any) => {
          const invJobId = typeof inv.jobId === 'object' ? inv.jobId._id : inv.jobId;
          return invJobId === jobId;
        });
        const totalInvoiceAmount = jobInvoices.reduce((sum: number, inv: any) => sum + (inv.totalAmount || 0), 0);

        return {
          id: jobId,
          service: job.serviceType || job.service || 'Service',
          status: job.status || 'pending',
          date: job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
          worker: typeof job.assignedWorker === 'object' ? job.assignedWorker?.name : job.assignedWorker ? `Worker ID: ${job.assignedWorker}` : null,
          amount: totalInvoiceAmount,
          progress: job.status === 'ongoing' ? Math.floor(Math.random() * 80) + 10 : job.status === 'completed' ? 100 : 0,
          description: job.description || 'No description provided',
          address: job.address || 'No address provided',
          feedback: jobFeedback,
          complaints: jobComplaints,
        };
      });

      setJobs(jobsData);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  const submitComplaint = async () => {
    if (!complaintTitle.trim() || !complaintText.trim()) {
      return Alert.alert('Error', 'Please enter both title and complaint details');
    }
    try {
      setSubmitting(true);
      await api.post('/complaints', { jobId: selectedJob?.id, title: complaintTitle, description: complaintText });
      Alert.alert('Success', 'Complaint submitted successfully');
      setComplaintTitle('');
      setComplaintText('');
      setShowComplaintModal(false);
      fetchJobs();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackText.trim()) return Alert.alert('Error', 'Please enter feedback');
    try {
      setSubmitting(true);
      await api.post('/feedback', { jobId: selectedJob?.id, rating, comment: feedbackText });
      Alert.alert('Success', 'Feedback submitted successfully');
      setFeedbackText('');
      setRating(5);
      setShowFeedbackModal(false);
      fetchJobs();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const renderJob = ({ item }: { item: Job }) => {
    const st = getStatus(item.status);
    return (
      <TouchableOpacity style={styles.jobCard} onPress={() => setSelectedJob(item)} activeOpacity={0.8}>
        <View style={styles.jobCardTop}>
          <Text style={styles.jobTitle}>{item.service}</Text>
          <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: st.dot }]} />
            <Text style={[styles.statusPillText, { color: st.text }]}>{st.label}</Text>
          </View>
        </View>

        <Text style={styles.jobDate}>{item.date}</Text>

        {item.status === 'ongoing' && typeof item.progress === 'number' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${item.progress}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{item.progress}%</Text>
          </View>
        )}

        <View style={styles.jobCardMeta}>
          {item.worker && (
            <View style={styles.metaChip}>
              <Icon name="user" size={11} color="#6666aa" />
              <Text style={styles.metaChipText}>{item.worker}</Text>
            </View>
          )}
          {item.amount != null && item.amount > 0 && (
            <View style={styles.metaChip}>
              <Icon name="credit-card" size={11} color="#6666aa" />
              <Text style={styles.metaChipText}>₦{item.amount.toLocaleString()}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Darlyn-Alt</Text>
        <Text style={styles.headerTitle}>My Jobs</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5340f0" />
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.centered}>
          <Icon name="briefcase" size={40} color="#2a2a50" />
          <Text style={styles.emptyText}>No jobs found</Text>
          <Text style={styles.emptySubtext}>Your booked jobs will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Job Detail Modal ── */}
      <Modal visible={!!selectedJob} animationType="slide" onRequestClose={() => setSelectedJob(null)}>
        <View style={styles.modalContainer}>
          <SafeAreaView style={{ backgroundColor: '#0a0a0f' }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedJob(null)} style={styles.backBtn}>
                <Icon name="arrow-left" size={20} color="#5340f0" />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>{selectedJob?.service}</Text>
              <View style={{ width: 60 }} />
            </View>
          </SafeAreaView>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            {/* Status + Date row */}
            <View style={styles.detailRow}>
              {(() => {
                const st = getStatus(selectedJob?.status || '');
                return (
                  <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: st.dot }]} />
                    <Text style={[styles.statusPillText, { color: st.text }]}>{st.label}</Text>
                  </View>
                );
              })()}
              <Text style={styles.detailDate}>{selectedJob?.date}</Text>
            </View>

            {/* Progress bar for ongoing */}
            {selectedJob?.status === 'ongoing' && typeof selectedJob.progress === 'number' && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>PROGRESS</Text>
                <View style={styles.progressTrackLarge}>
                  <View style={[styles.progressFillLarge, { width: `${selectedJob.progress}%` }]} />
                </View>
                <Text style={styles.progressLargeLabel}>{selectedJob.progress}% complete</Text>
              </View>
            )}

            {/* Info cards */}
            <View style={styles.infoGrid}>
              <View style={styles.infoCard}>
                <Icon name="user" size={14} color="#5340f0" style={{ marginBottom: 6 }} />
                <Text style={styles.infoCardLabel}>WORKER</Text>
                <Text style={styles.infoCardValue}>{selectedJob?.worker || 'Not assigned'}</Text>
              </View>
              <View style={styles.infoCard}>
                <Icon name="credit-card" size={14} color="#5340f0" style={{ marginBottom: 6 }} />
                <Text style={styles.infoCardLabel}>AMOUNT</Text>
                <Text style={styles.infoCardValue}>
                  {selectedJob?.amount ? `₦${selectedJob.amount.toLocaleString()}` : '—'}
                </Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>ADDRESS</Text>
              <Text style={styles.detailValue}>{selectedJob?.address}</Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>DESCRIPTION</Text>
              <Text style={styles.detailValue}>{selectedJob?.description}</Text>
            </View>

            {/* Feedback */}
            {selectedJob?.feedback && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>YOUR FEEDBACK</Text>
                <View style={styles.feedbackRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Text key={s} style={{ fontSize: 18, color: s <= selectedJob.feedback!.rating ? '#fbbf24' : '#2a2a40' }}>★</Text>
                  ))}
                </View>
                {selectedJob.feedback.comment ? (
                  <Text style={styles.detailValue}>{selectedJob.feedback.comment}</Text>
                ) : null}
              </View>
            )}

            {/* Complaints */}
            {selectedJob?.complaints && selectedJob.complaints.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>COMPLAINTS</Text>
                {selectedJob.complaints.map((c, i) => (
                  <View key={i} style={styles.complaintCard}>
                    <View style={styles.complaintCardTop}>
                      <Text style={styles.complaintCardTitle}>{c.title}</Text>
                      <View style={[styles.statusPill, { backgroundColor: c.status === 'resolved' ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)' }]}>
                        <Text style={[styles.statusPillText, { color: c.status === 'resolved' ? '#4ade80' : '#fbbf24' }]}>
                          {c.status === 'resolved' ? 'Resolved' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.complaintCardDesc}>{c.description}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.actionsBlock}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowComplaintModal(true)} activeOpacity={0.8}>
                <Icon name="alert-circle" size={15} color="#ff6b6b" />
                <Text style={styles.secondaryBtnText}>Add Complaint</Text>
              </TouchableOpacity>

              {selectedJob?.status === 'completed' && (
                <TouchableOpacity
                  style={[styles.primaryBtn, selectedJob.feedback && styles.primaryBtnDisabled]}
                  onPress={() => !selectedJob.feedback && setShowFeedbackModal(true)}
                  disabled={!!selectedJob.feedback}
                  activeOpacity={0.85}
                >
                  <Icon name="star" size={15} color="#fff" />
                  <Text style={styles.primaryBtnText}>
                    {selectedJob.feedback ? 'Feedback Submitted' : 'Give Feedback'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Complaint Modal ── */}
      <Modal visible={showComplaintModal} animationType="slide" onRequestClose={() => setShowComplaintModal(false)}>
        <View style={styles.formModalContainer}>
          <SafeAreaView style={{ backgroundColor: '#0a0a0f' }}>
            <View style={styles.formModalHeader}>
              <TouchableOpacity onPress={() => setShowComplaintModal(false)}>
                <Icon name="x" size={22} color="#5340f0" />
              </TouchableOpacity>
              <Text style={styles.formModalTitle}>Add Complaint</Text>
              <View style={{ width: 22 }} />
            </View>
          </SafeAreaView>

          <ScrollView contentContainerStyle={styles.formModalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>TITLE</Text>
              <TextInput
                style={styles.textInput}
                value={complaintTitle}
                onChangeText={setComplaintTitle}
                placeholder="Brief title for your complaint"
                placeholderTextColor="#333366"
                autoCapitalize="sentences"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>DETAILS</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={complaintText}
                onChangeText={setComplaintText}
                placeholder="Describe the issue in detail..."
                placeholderTextColor="#333366"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              onPress={submitComplaint}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Submit Complaint</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Feedback Modal ── */}
      <Modal visible={showFeedbackModal} animationType="slide" onRequestClose={() => setShowFeedbackModal(false)}>
        <View style={styles.formModalContainer}>
          <SafeAreaView style={{ backgroundColor: '#0a0a0f' }}>
            <View style={styles.formModalHeader}>
              <TouchableOpacity onPress={() => setShowFeedbackModal(false)}>
                <Icon name="x" size={22} color="#5340f0" />
              </TouchableOpacity>
              <Text style={styles.formModalTitle}>Give Feedback</Text>
              <View style={{ width: 22 }} />
            </View>
          </SafeAreaView>

          <ScrollView contentContainerStyle={styles.formModalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>RATING</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                    <Text style={[styles.starIcon, { color: star <= rating ? '#fbbf24' : '#2a2a40' }]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.ratingLabel}>{rating} / 5 stars</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>COMMENT</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="Share your experience..."
                placeholderTextColor="#333366"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              onPress={submitFeedback}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>Submit Feedback</Text>}
            </TouchableOpacity>
          </ScrollView>
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a30',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5340f0',
    letterSpacing: 4,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444466',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#2a2a50',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Job Card
  jobCard: {
    backgroundColor: '#0e0e1c',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: '#1e1e38',
    padding: 18,
    marginBottom: 12,
  },
  jobCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    marginRight: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  jobDate: {
    fontSize: 12,
    color: '#444466',
    marginBottom: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#1e1e38',
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#5340f0',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: '#7a6ff0',
    fontWeight: '600',
    minWidth: 34,
    textAlign: 'right',
  },
  jobCardMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#111120',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: '#2a2a40',
  },
  metaChipText: {
    fontSize: 12,
    color: '#8888bb',
  },

  // Detail Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a30',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 70,
  },
  backBtnText: {
    color: '#5340f0',
    fontSize: 14,
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  modalScroll: { flex: 1 },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 50,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailDate: {
    fontSize: 13,
    color: '#555577',
  },
  detailSection: {
    backgroundColor: '#0e0e1c',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#1e1e38',
    padding: 16,
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#555577',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 14,
    color: '#ccccee',
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#0e0e1c',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#1e1e38',
    padding: 14,
  },
  infoCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#555577',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  infoCardValue: {
    fontSize: 14,
    color: '#ccccee',
    fontWeight: '500',
  },
  progressTrackLarge: {
    height: 6,
    backgroundColor: '#1e1e38',
    borderRadius: 3,
    marginBottom: 6,
  },
  progressFillLarge: {
    height: 6,
    backgroundColor: '#5340f0',
    borderRadius: 3,
  },
  progressLargeLabel: {
    fontSize: 12,
    color: '#7a6ff0',
    fontWeight: '500',
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  complaintCard: {
    backgroundColor: '#111120',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#2a2a40',
    padding: 12,
    marginTop: 8,
  },
  complaintCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  complaintCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#eeeeee',
    flex: 1,
    marginRight: 8,
  },
  complaintCardDesc: {
    fontSize: 12,
    color: '#666688',
    lineHeight: 17,
  },
  actionsBlock: {
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    backgroundColor: '#4f35e8',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#5340f0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 7,
  },
  primaryBtnDisabled: {
    backgroundColor: '#2a2a50',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    borderWidth: 0.5,
    borderColor: '#3a1a1a',
    backgroundColor: 'rgba(255,107,107,0.06)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
  },

  // Form Modal
  formModalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  formModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a30',
  },
  formModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  formModalContent: {
    padding: 24,
    paddingBottom: 50,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#555577',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#111120',
    borderWidth: 0.5,
    borderColor: '#2a2a40',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#e0e0ff',
    fontSize: 15,
    height: 52,
  },
  textArea: {
    height: 120,
    paddingTop: 14,
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  starIcon: {
    fontSize: 34,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#555577',
  },
});