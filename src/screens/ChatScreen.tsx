import React, { useState, useEffect, useRef } from 'react';
import {
  View, TouchableOpacity, ActivityIndicator, Text, FlatList, TextInput,
  StyleSheet, Image, KeyboardAvoidingView, Platform, Dimensions, Alert, ScrollView
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = "https://darlyn-alt-backend-znbx.onrender.com";
const { width } = Dimensions.get('window');

interface Message {
  _id: string;
  content?: string;
  senderId: string;
  senderRole: string;
  createdAt: string;
  images?: string[];
  readBy?: Array<{ userId: string; readAt: string }>;
}

interface User {
  _id: string;
  name: string;
  email: string;
  lastSeen?: string;
  isOnline?: boolean;
  unreadCount?: number;
}

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface GroupedMessages {
  date: string;
  dateLabel: string;
  messages: Message[];
}

const getToken = async (): Promise<string | null> => {
  try { return await AsyncStorage.getItem('token'); }
  catch { return null; }
};

const groupMessagesByDate = (messages: Message[]): GroupedMessages[] => {
  const groups: { [key: string]: Message[] } = {};
  messages.forEach(message => {
    const key = new Date(message.createdAt).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(message);
  });

  return Object.entries(groups).map(([dateKey, msgs]) => {
    const date = new Date(dateKey);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateLabel: string;
    if (date.toDateString() === today.toDateString()) dateLabel = 'Today';
    else if (date.toDateString() === yesterday.toDateString()) dateLabel = 'Yesterday';
    else dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return {
      date: dateKey,
      dateLabel,
      messages: msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const getActivityStatus = (user: User): { text: string; color: string } => {
  if (user.isOnline) return { text: 'Online', color: '#4ade80' };
  if (!user.lastSeen) return { text: 'Offline', color: '#444466' };

  const diffMinutes = Math.floor((Date.now() - new Date(user.lastSeen).getTime()) / 60000);
  if (diffMinutes < 5) return { text: 'Just now', color: '#4ade80' };
  if (diffMinutes < 60) return { text: `${diffMinutes}m ago`, color: '#fbbf24' };
  if (diffMinutes < 1440) return { text: `${Math.floor(diffMinutes / 60)}h ago`, color: '#fbbf24' };
  return { text: `${Math.floor(diffMinutes / 1440)}d ago`, color: '#444466' };
};

const getInitials = (name: string) => {
  const parts = name.trim().split(' ');
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[1]?.[0] : '')).toUpperCase();
};

// Stable avatar color per name
const AVATAR_COLORS = ['#5340f0', '#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706'];
const getAvatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const ChatScreen: React.FC = () => {
  const [step, setStep] = useState<'selectUser' | 'chat'>('selectUser');
  const [users, setUsers] = useState<User[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupedMessages, setGroupedMessages] = useState<GroupedMessages[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const globalSocketRef = useRef<Socket | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (messages.length > 0) {
      setGroupedMessages(groupMessagesByDate(messages));
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const token = await getToken();
        if (!token) { Alert.alert('Error', 'No authentication token found'); return; }
        const response = await axios.get<UserProfile>(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const { _id, role } = response.data;
        setUserId(_id);
        setRole(role);
        await AsyncStorage.setItem('userId', _id);
        await AsyncStorage.setItem('role', role);
      } catch {
        try {
          const storedId = await AsyncStorage.getItem('userId');
          const storedRole = await AsyncStorage.getItem('role');
          if (storedId && storedRole) { setUserId(storedId); setRole(storedRole); }
          else Alert.alert('Error', 'Failed to load user profile. Please login again.');
        } catch { Alert.alert('Error', 'Failed to load user data'); }
      }
    };
    loadUserProfile();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const init = async () => {
      const token = await getToken();
      if (!token) return;
      if (globalSocketRef.current) globalSocketRef.current.disconnect();

      const globalSocket = io(API_BASE_URL, {
        transports: ['websocket'], auth: { token }, query: { userId, type: 'presence' },
      });
      globalSocketRef.current = globalSocket;

      globalSocket.on('connect', () => globalSocket.emit('userOnline', userId));
      globalSocket.on('userOnline', (id: string) => {
        setOnlineUsers(prev => new Set([...prev, id]));
        setUsers(prev => prev.map(u => u._id === id ? { ...u, isOnline: true } : u));
      });
      globalSocket.on('userOffline', (id: string) => {
        setOnlineUsers(prev => { const s = new Set(prev); s.delete(id); return s; });
        setUsers(prev => prev.map(u => u._id === id ? { ...u, isOnline: false } : u));
      });

      const interval = setInterval(() => globalSocket.emit('updateActivity', userId), 30000);
      return () => { clearInterval(interval); globalSocket.emit('userOffline', userId); globalSocket.disconnect(); };
    };
    const cleanup = init();
    return () => { cleanup?.then(fn => fn?.()); };
  }, [userId]);

  useEffect(() => {
    if (!role) return;
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        if (role === 'customer') {
          const res = await axios.get(`${API_BASE_URL}/users/approved-workers?includeActivity=true`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUsers(res.data.map((w: any) => ({
            _id: w._id || w.id, name: w.name || 'Unnamed Worker', email: w.email || 'No email',
            lastSeen: w.lastSeen, isOnline: w.isOnline || false, unreadCount: w.unreadCount || 0,
          })));
        } else {
          const res = await axios.get(`${API_BASE_URL}/chat/my-chats?includeActivity=true`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUsers(res.data.map((c: any) => ({
            _id: c._id || c.id, name: c.name || 'Unnamed Customer', email: c.email || 'No email',
            lastSeen: c.lastSeen, isOnline: c.isOnline || false, unreadCount: c.unreadCount || 0,
          })));
        }
      } catch { Alert.alert('Error', 'Failed to load contacts'); }
      finally { setLoading(false); }
    };
    fetchUsers();
  }, [role]);

  const markMessagesAsRead = async (roomId: string) => {
    if (!userId) return;
    try {
      const token = await getToken();
      const response = await axios.post(`${API_BASE_URL}/chat/rooms/${roomId}/mark-read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.updatedMessages && Array.isArray(response.data.updatedMessages)) {
        const map = new Map<string, Message>(response.data.updatedMessages.map((m: Message) => [m._id, m]));
        setMessages(prev => prev.map(m => map.get(m._id) ?? m));
        if (socketRef.current) {
          response.data.updatedMessages.forEach((msg: Message) => {
            socketRef.current?.emit('messageRead', { messageId: msg._id, userId, roomId });
          });
        }
      }
      if (activeUserId) setUsers(prev => prev.map(u => u._id === activeUserId ? { ...u, unreadCount: 0 } : u));
    } catch { /* silent */ }
  };

  const fetchMessages = async (roomId: string) => {
    try {
      const token = await getToken();
      const res = await axios.get(`${API_BASE_URL}/chat/rooms/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(res.data.items)) {
        setMessages(res.data.items.reverse());
        setTimeout(() => markMessagesAsRead(roomId), 500);
      }
    } catch { /* silent */ }
  };

  const comingSoon = () => Alert.alert("Coming Soon", "This feature will be available in a future update 🚀");

  const handleUserSelect = async (otherUser: User) => {
    setActiveUserId(otherUser._id);
    setActiveUser(otherUser);
    if (!userId) { Alert.alert('Error', 'User ID not loaded yet'); return; }
    setLoading(true);
    try {
      const token = await getToken();
      const params = role === 'customer'
        ? { customerId: userId, workerId: otherUser._id }
        : { customerId: otherUser._id, workerId: userId };

      const res = await axios.get(`${API_BASE_URL}/chat/rooms`, {
        headers: { Authorization: `Bearer ${token}` }, params,
      });
      const activeRoomId = res.data.roomId;
      if (!activeRoomId) throw new Error('Room ID missing');

      setRoomId(activeRoomId);
      await fetchMessages(activeRoomId);

      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }

      const socket = io(API_BASE_URL, {
        transports: ['websocket'], auth: { token }, query: { roomId: activeRoomId, userId, type: 'chat' },
      });
      socketRef.current = socket;

      socket.on('connect', () => socket.emit('joinRoom', activeRoomId));
      socket.on('newMessage', (msg: Message) => {
        setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
        if (msg.senderId !== userId) setTimeout(() => markMessagesAsRead(activeRoomId), 500);
      });
      socket.on('messageUpdated', (updated: Message) => {
        setMessages(prev => prev.map(m => m._id === updated._id ? updated : m));
      });
      socket.on('messageRead', (data: { messageId: string; userId: string; readAt: string }) => {
        setMessages(prev => prev.map(msg => {
          if (msg._id === data.messageId && msg.senderId === userId) {
            const readBy = [...(msg.readBy || [])];
            const idx = readBy.findIndex(r => r.userId === data.userId);
            if (idx >= 0) readBy[idx] = { userId: data.userId, readAt: data.readAt };
            else readBy.push({ userId: data.userId, readAt: data.readAt });
            return { ...msg, readBy };
          }
          return msg;
        }));
      });

      setStep('chat');
    } catch { Alert.alert('Error', 'Failed to start chat'); }
    finally { setLoading(false); }
  };

  const handleBack = () => {
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    setRoomId(null); setMessages([]); setGroupedMessages([]);
    setInputText(''); setActiveUser(null); setActiveUserId(null);
    setStep('selectUser');
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !roomId || !userId || sending) return;
    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      _id: tempId, content: messageText,
      senderId: userId, senderRole: role || 'customer',
      createdAt: new Date().toISOString(), readBy: [],
    }]);

    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_BASE_URL}/chat/rooms/${roomId}/messages`,
        { content: messageText, customerId: role === 'customer' ? userId : activeUserId, workerId: role === 'worker' ? userId : activeUserId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(prev => prev.map(m => m._id === tempId ? res.data : m));
      if (socketRef.current) socketRef.current.emit('sendMessage', res.data);
    } catch {
      setMessages(prev => prev.filter(m => m._id !== tempId));
      Alert.alert('Error', 'Failed to send message');
    } finally { setSending(false); }
  };

  const handleImagePick = async () => {
    if (!roomId || !userId) { Alert.alert('Error', 'Cannot send image at this time'); return; }
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, async (response) => {
      if (response.didCancel || response.errorCode || !response.assets?.[0]) return;
      const image = response.assets[0];
      const tempId = `temp-${Date.now()}`;
      setMessages(prev => [...prev, {
        _id: tempId, senderId: userId!, senderRole: role || 'customer',
        createdAt: new Date().toISOString(), images: [image.uri!], readBy: [],
      }]);

      const formData = new FormData();
      formData.append('images', { uri: image.uri, type: image.type || 'image/jpeg', name: image.fileName || 'image.jpg' } as any);
      formData.append('customerId', role === 'customer' ? userId! : activeUserId!);
      formData.append('workerId', role === 'worker' ? userId! : activeUserId!);

      try {
        const token = await getToken();
        const res = await axios.post(`${API_BASE_URL}/chat/rooms/${roomId}/messages`, formData, {
          headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
          timeout: 30000,
        });
        setMessages(prev => prev.map(m => m._id === tempId ? res.data : m));
        if (socketRef.current) socketRef.current.emit('sendMessage', res.data);
      } catch {
        setMessages(prev => prev.filter(m => m._id !== tempId));
        Alert.alert('Error', 'Failed to send image. Please try again.');
      }
    });
  };

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const getMessageReadStatus = (message: Message) => {
    if (!message.readBy || message.senderId !== userId) return { isRead: false, isSent: false };
    return {
      isSent: !message._id.startsWith('temp-'),
      isRead: message.readBy.some(r => r.userId !== message.senderId),
    };
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (globalSocketRef.current) {
        globalSocketRef.current.emit('userOffline', userId);
        globalSocketRef.current.disconnect();
      }
    };
  }, [userId]);

  // ── Loading state ──
  if (!userId || !role || loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5340f0" />
          <Text style={styles.loadingText}>
            {!userId ? 'Loading profile...' : !role ? 'Loading role...' : 'Loading...'}
          </Text>
        </View>
      </View>
    );
  }

  // ── Contact List ──
  if (step === 'selectUser') {
    return (
      <View style={styles.container}>
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderBrand}>DARLYN-ALT</Text>
          <Text style={styles.listHeaderTitle}>Messages</Text>
          <Text style={styles.listHeaderSub}>
            {role === 'customer' ? 'Chat with a worker' : 'Chat with a customer'}
          </Text>
        </View>

        {users.length === 0 ? (
          <View style={styles.centered}>
            <Icon name="message-circle" size={40} color="#2a2a50" />
            <Text style={styles.emptyText}>No contacts yet</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.contactList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const status = getActivityStatus(item);
              const initials = getInitials(item.name);
              const avatarBg = getAvatarColor(item.name);
              return (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => handleUserSelect(item)}
                  activeOpacity={0.75}
                >
                  {/* Avatar */}
                  <View style={[styles.contactAvatar, { backgroundColor: avatarBg }]}>
                    <Text style={styles.contactAvatarText}>{initials}</Text>
                    {item.isOnline && <View style={styles.onlineDot} />}
                  </View>

                  {/* Info */}
                  <View style={styles.contactInfo}>
                    <View style={styles.contactNameRow}>
                      <Text style={styles.contactName}>{item.name}</Text>
                      {(item.unreadCount || 0) > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>
                            {item.unreadCount! > 99 ? '99+' : item.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.contactEmail} numberOfLines={1}>{item.email}</Text>
                  </View>

                  {/* Status */}
                  <View style={styles.contactStatus}>
                    <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    );
  }

  // ── Chat View ──
  const activityStatus = activeUser ? getActivityStatus(activeUser) : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color="#5340f0" />
        </TouchableOpacity>

        {activeUser && (
          <View style={styles.chatHeaderCenter}>
            <View style={[styles.chatHeaderAvatar, { backgroundColor: getAvatarColor(activeUser.name) }]}>
              <Text style={styles.chatHeaderAvatarText}>{getInitials(activeUser.name)}</Text>
            </View>
            <View>
              <Text style={styles.chatHeaderName}>{activeUser.name}</Text>
              {activityStatus && (
                <View style={styles.chatHeaderStatusRow}>
                  <View style={[styles.statusDot, { backgroundColor: activityStatus.color }]} />
                  <Text style={[styles.chatHeaderStatusText, { color: activityStatus.color }]}>
                    {activityStatus.text}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.chatHeaderActions}>
          <TouchableOpacity onPress={comingSoon} style={styles.headerActionBtn} activeOpacity={0.7}>
            <Icon name="phone" size={18} color="#5340f0" />
          </TouchableOpacity>
          <TouchableOpacity onPress={comingSoon} style={styles.headerActionBtn} activeOpacity={0.7}>
            <Icon name="video" size={18} color="#5340f0" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
      >
        {groupedMessages.map((group, idx) => (
          <View key={`${group.date}-${idx}`}>
            {/* Date separator */}
            <View style={styles.dateSeparator}>
              <View style={styles.dateLine} />
              <Text style={styles.dateText}>{group.dateLabel}</Text>
              <View style={styles.dateLine} />
            </View>

            {/* Messages */}
            {group.messages.map((item) => {
              const isMe = item.senderId === userId;
              const { isRead, isSent } = getMessageReadStatus(item);
              return (
                <View key={item._id} style={[styles.messageContainer, isMe ? styles.myMessage : styles.otherMessage]}>
                  {!isMe && (
                    <View style={[styles.messageMiniAvatar, { backgroundColor: getAvatarColor(activeUser?.name || '') }]}>
                      <Text style={styles.messageMiniAvatarText}>{getInitials(activeUser?.name || '?')}</Text>
                    </View>
                  )}
                  <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
                    {item.images?.map((img, i) => (
                      <Image
                        key={`${item._id}-img-${i}`}
                        source={{ uri: img }}
                        style={styles.messageImage}
                        resizeMode="cover"
                      />
                    ))}
                    {item.content && (
                      <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
                        {item.content}
                      </Text>
                    )}
                    <View style={[styles.messageFooter, isMe ? { justifyContent: 'flex-end' } : {}]}>
                      <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.otherTimeText]}>
                        {formatTime(item.createdAt)}
                      </Text>
                      {isMe && isSent && (
                        <Icon
                          name="check"
                          size={13}
                          color={isRead ? '#4ade80' : 'rgba(255,255,255,0.45)'}
                          style={{ marginLeft: 3 }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={handleImagePick} style={styles.attachBtn} activeOpacity={0.7}>
          <Icon name="image" size={20} color="#5340f0" />
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#333366"
          multiline
          maxLength={1000}
        />

        <TouchableOpacity
          onPress={sendMessage}
          style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Icon name="send" size={16} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6666aa',
  },
  emptyText: {
    fontSize: 15,
    color: '#444466',
    fontWeight: '500',
  },

  // ── Contact list header ──
  listHeader: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a30',
  },
  listHeaderBrand: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5340f0',
    letterSpacing: 4,
    marginBottom: 6,
  },
  listHeaderTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  listHeaderSub: {
    fontSize: 13,
    color: '#444466',
  },

  // ── Contact items ──
  contactList: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#111128',
    gap: 14,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  contactAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#4ade80',
    borderWidth: 2,
    borderColor: '#0a0a0f',
  },
  contactInfo: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#eeeeee',
  },
  unreadBadge: {
    backgroundColor: '#5340f0',
    borderRadius: 10,
    minWidth: 20,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  contactEmail: {
    fontSize: 12,
    color: '#444466',
  },
  contactStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // ── Chat header ──
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
    backgroundColor: '#0a0a0f',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a30',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111128',
    borderWidth: 0.5,
    borderColor: '#2a2a40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatHeaderCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatHeaderAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatHeaderAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  chatHeaderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  chatHeaderStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  chatHeaderStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  chatHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(83,64,240,0.1)',
    borderWidth: 0.5,
    borderColor: '#2a2a50',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Messages ──
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dateLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: '#1a1a30',
  },
  dateText: {
    marginHorizontal: 12,
    fontSize: 11,
    color: '#444466',
    fontWeight: '600',
    backgroundColor: '#0a0a0f',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    letterSpacing: 0.3,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
    gap: 6,
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  messageMiniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  messageMiniAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  messageBubble: {
    maxWidth: width * 0.72,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: '#5340f0',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#111120',
    borderWidth: 0.5,
    borderColor: '#2a2a40',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#ddddff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
  },
  myTimeText: {
    color: 'rgba(255,255,255,0.45)',
  },
  otherTimeText: {
    color: '#333355',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 6,
  },

  // ── Input bar ──
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0a0a0f',
    borderTopWidth: 0.5,
    borderTopColor: '#1a1a30',
    gap: 10,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(83,64,240,0.1)',
    borderWidth: 0.5,
    borderColor: '#2a2a50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  textInput: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: '#2a2a40',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: '#111120',
    color: '#e0e0ff',
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5340f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
    shadowColor: '#5340f0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: '#2a2a40',
    shadowOpacity: 0,
    elevation: 0,
  },
});