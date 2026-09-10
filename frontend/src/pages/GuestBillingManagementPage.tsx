import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Receipt,
  UserCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Search,
  RefreshCw,
  Plus,
  Eye,
  CreditCard,
  Ban,
  Phone,
  Mail,
  Clock,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  UserPlus,
  Check,
} from 'lucide-react';
import {
  managementApiService,
  GuestBillingStats,
  GuestItem,
  GuestVisitItem,
  GuestBillItem,
  HostStudentItem,
  BillingItemRecord,
} from '../services/api';

interface GuestBillingManagementPageProps {
  onNavigate?: (path: string) => void;
}

export const GuestBillingManagementPage: React.FC<GuestBillingManagementPageProps> = () => {

  // Active Tab: 'guests' | 'visits' | 'bills'
  const [activeTab, setActiveTab] = useState<'guests' | 'visits' | 'bills'>('bills');

  // KPI Statistics
  const [stats, setStats] = useState<GuestBillingStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  // Guests State
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [isGuestsLoading, setIsGuestsLoading] = useState<boolean>(false);
  const [guestSearch, setGuestSearch] = useState<string>('');
  const [guestPagination, setGuestPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Visits State
  const [visits, setVisits] = useState<GuestVisitItem[]>([]);
  const [isVisitsLoading, setIsVisitsLoading] = useState<boolean>(false);
  const [visitSearch, setVisitSearch] = useState<string>('');
  const [visitStatusFilter, setVisitStatusFilter] = useState<string>('ALL');
  const [visitPagination, setVisitPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Bills State
  const [bills, setBills] = useState<GuestBillItem[]>([]);
  const [isBillsLoading, setIsBillsLoading] = useState<boolean>(false);
  const [billSearch, setBillSearch] = useState<string>('');
  const [billStatusFilter, setBillStatusFilter] = useState<string>('ALL');
  const [billPagination, setBillPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Realtime Connection State
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState<boolean>(false);

  // Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals State
  const [isGuestModalOpen, setIsGuestModalOpen] = useState<boolean>(false);
  const [editingGuest, setEditingGuest] = useState<GuestItem | null>(null);
  const [guestFormData, setGuestFormData] = useState({
    name: '',
    phone: '',
    email: '',
    idProofType: 'AADHAAR',
    idProofNumber: '',
    relation: 'PARENT',
    address: '',
  });

  const [isVisitModalOpen, setIsVisitModalOpen] = useState<boolean>(false);
  const [visitFormData, setVisitFormData] = useState({
    guestId: '',
    hostStudentId: '',
    purpose: '',
    remarks: '',
  });
  const [hostSearchQuery, setHostSearchQuery] = useState<string>('');
  const [searchedHosts, setSearchedHosts] = useState<HostStudentItem[]>([]);
  const [isSearchingHosts, setIsSearchingHosts] = useState<boolean>(false);
  const [selectedHostName, setSelectedHostName] = useState<string>('');

  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState<boolean>(false);
  const [visitToCheckout, setVisitToCheckout] = useState<GuestVisitItem | null>(null);

  const [isBillModalOpen, setIsBillModalOpen] = useState<boolean>(false);
  const [billFormData, setBillFormData] = useState({
    guestVisitId: '',
    billNumber: '',
    items: [{ description: 'Guest Room Accommodation', quantity: 1, unitAmount: 500 }],
  });

  const [isBillDetailModalOpen, setIsBillDetailModalOpen] = useState<boolean>(false);
  const [selectedBillDetail, setSelectedBillDetail] = useState<GuestBillItem | null>(null);
  const [isLoadingBillDetail, setIsLoadingBillDetail] = useState<boolean>(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [billToPay, setBillToPay] = useState<GuestBillItem | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    paymentMethod: 'UPI',
    paymentReference: '',
    notes: '',
  });

  const [isVoidModalOpen, setIsVoidModalOpen] = useState<boolean>(false);
  const [billToVoid, setBillToVoid] = useState<GuestBillItem | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // -----------------------------------------------------------------
  // DATA FETCHING
  // -----------------------------------------------------------------

  const fetchOverview = useCallback(async () => {
    try {
      setIsStatsLoading(true);
      const res = await managementApiService.getGuestBillingOverview();
      if (res.success) {
        setStats(res.stats);
      }
    } catch (err: any) {
      console.error('Failed to fetch guest billing overview:', err);
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  const fetchGuests = useCallback(async () => {
    try {
      setIsGuestsLoading(true);
      const res = await managementApiService.getGuests({
        page: guestPagination.page,
        limit: guestPagination.limit,
        search: guestSearch,
      });
      if (res.success) {
        setGuests(res.guests);
        setGuestPagination((prev) => ({
          ...prev,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        }));
      }
    } catch (err: any) {
      console.error('Failed to fetch guests:', err);
      showToast('error', err.message || 'Failed to load guests.');
    } finally {
      setIsGuestsLoading(false);
    }
  }, [guestPagination.page, guestPagination.limit, guestSearch]);

  const fetchVisits = useCallback(async () => {
    try {
      setIsVisitsLoading(true);
      const res = await managementApiService.getGuestVisits({
        page: visitPagination.page,
        limit: visitPagination.limit,
        search: visitSearch,
        status: visitStatusFilter,
      });
      if (res.success) {
        setVisits(res.visits);
        setVisitPagination((prev) => ({
          ...prev,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        }));
      }
    } catch (err: any) {
      console.error('Failed to fetch visits:', err);
      showToast('error', err.message || 'Failed to load visits.');
    } finally {
      setIsVisitsLoading(false);
    }
  }, [visitPagination.page, visitPagination.limit, visitSearch, visitStatusFilter]);

  const fetchBills = useCallback(async () => {
    try {
      setIsBillsLoading(true);
      const res = await managementApiService.getGuestBills({
        page: billPagination.page,
        limit: billPagination.limit,
        search: billSearch,
        status: billStatusFilter,
      });
      if (res.success) {
        setBills(res.bills);
        setBillPagination((prev) => ({
          ...prev,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        }));
      }
    } catch (err: any) {
      console.error('Failed to fetch bills:', err);
      showToast('error', err.message || 'Failed to load bills.');
    } finally {
      setIsBillsLoading(false);
    }
  }, [billPagination.page, billPagination.limit, billSearch, billStatusFilter]);

  const refreshAll = useCallback(async () => {
    setIsManualRefreshing(true);
    await Promise.all([
      fetchOverview(),
      activeTab === 'guests' ? fetchGuests() : Promise.resolve(),
      activeTab === 'visits' ? fetchVisits() : Promise.resolve(),
      activeTab === 'bills' ? fetchBills() : Promise.resolve(),
    ]);
    setIsManualRefreshing(false);
  }, [fetchOverview, activeTab, fetchGuests, fetchVisits, fetchBills]);

  // Initial Load
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (activeTab === 'guests') fetchGuests();
    if (activeTab === 'visits') fetchVisits();
    if (activeTab === 'bills') fetchBills();
  }, [activeTab, fetchGuests, fetchVisits, fetchBills]);

  // -----------------------------------------------------------------
  // REAL-TIME SSE SUBSCRIPTION
  // -----------------------------------------------------------------

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let isMounted = true;

    const connectSSE = () => {
      if (!isMounted) return;
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        eventSource = new EventSource(`/api/management/events-stream?token=${encodeURIComponent(token)}`);

        eventSource.onopen = () => {
          if (isMounted) setIsLiveConnected(true);
        };

        const handleUpdate = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            const evtType = data.type || '';
            const guestBillingEvents = [
              'GUEST_CREATED',
              'GUEST_UPDATED',
              'GUEST_VISIT_CREATED',
              'GUEST_VISIT_UPDATED',
              'GUEST_CHECKED_OUT',
              'GUEST_BILL_CREATED',
              'GUEST_PAYMENT_RECORDED',
              'GUEST_BILL_VOIDED',
              'GUEST_BILLING_STATS_UPDATED',
            ];

            if (guestBillingEvents.includes(evtType)) {
              fetchOverview();
              if (activeTab === 'guests') fetchGuests();
              if (activeTab === 'visits') fetchVisits();
              if (activeTab === 'bills') fetchBills();
            }
          } catch (err) {
            console.error('Error parsing SSE event:', err);
          }
        };

        eventSource.addEventListener('management_dashboard_update', handleUpdate);
        eventSource.addEventListener('management_dashboard_event', handleUpdate);

        eventSource.onerror = () => {
          if (isMounted) setIsLiveConnected(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (isMounted) {
            reconnectTimeout = setTimeout(connectSSE, 4000);
          }
        };
      } catch (err) {
        if (isMounted) {
          setIsLiveConnected(false);
          reconnectTimeout = setTimeout(connectSSE, 5000);
        }
      }
    };

    connectSSE();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [activeTab, fetchOverview, fetchGuests, fetchVisits, fetchBills]);

  // Host Student Lookup for Check-in Modal
  const searchHosts = useCallback(async (query: string) => {
    try {
      setIsSearchingHosts(true);
      const res = await managementApiService.getHostStudents(query);
      if (res.success) {
        setSearchedHosts(res.hosts);
      }
    } catch (err) {
      console.error('Error searching host students:', err);
    } finally {
      setIsSearchingHosts(false);
    }
  }, []);

  useEffect(() => {
    if (isVisitModalOpen) {
      searchHosts(hostSearchQuery);
    }
  }, [isVisitModalOpen, hostSearchQuery, searchHosts]);

  // -----------------------------------------------------------------
  // HANDLERS: GUEST
  // -----------------------------------------------------------------

  const handleOpenAddGuest = () => {
    setEditingGuest(null);
    setGuestFormData({
      name: '',
      phone: '',
      email: '',
      idProofType: 'AADHAAR',
      idProofNumber: '',
      relation: 'PARENT',
      address: '',
    });
    setIsGuestModalOpen(true);
  };

  const handleOpenEditGuest = (g: GuestItem) => {
    setEditingGuest(g);
    setGuestFormData({
      name: g.name,
      phone: g.phone,
      email: g.email || '',
      idProofType: g.idProofType || 'AADHAAR',
      idProofNumber: g.idProofNumber || '',
      relation: g.relation || 'PARENT',
      address: g.address || '',
    });
    setIsGuestModalOpen(true);
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestFormData.name.trim() || guestFormData.name.trim().length < 2) {
      showToast('error', 'Guest name must be at least 2 characters.');
      return;
    }
    if (!guestFormData.phone.trim() || guestFormData.phone.trim().length < 7) {
      showToast('error', 'Valid contact phone number is required.');
      return;
    }

    try {
      if (editingGuest) {
        const res = await managementApiService.updateGuest(editingGuest.id, guestFormData);
        showToast('success', res.message || 'Guest updated successfully.');
      } else {
        const res = await managementApiService.createGuest(guestFormData);
        showToast('success', res.message || 'Guest registered successfully.');
      }
      setIsGuestModalOpen(false);
      fetchGuests();
      fetchOverview();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save guest record.');
    }
  };

  // -----------------------------------------------------------------
  // HANDLERS: VISIT & CHECKOUT
  // -----------------------------------------------------------------

  const handleOpenCheckinForGuest = (g: GuestItem) => {
    setVisitFormData({
      guestId: g.id,
      hostStudentId: '',
      purpose: '',
      remarks: '',
    });
    setSelectedHostName('');
    setIsVisitModalOpen(true);
  };

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitFormData.guestId) {
      showToast('error', 'Please select a guest.');
      return;
    }
    if (!visitFormData.hostStudentId) {
      showToast('error', 'Please select the host resident student.');
      return;
    }
    if (!visitFormData.purpose.trim()) {
      showToast('error', 'Please provide the purpose of the visit.');
      return;
    }

    try {
      const res = await managementApiService.createGuestVisit(visitFormData);
      showToast('success', res.message || 'Guest check-in registered.');
      setIsVisitModalOpen(false);
      fetchVisits();
      fetchOverview();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to check in guest.');
    }
  };

  const handleOpenCheckout = (v: GuestVisitItem) => {
    setVisitToCheckout(v);
    setIsCheckoutConfirmOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (!visitToCheckout) return;
    try {
      const res = await managementApiService.checkoutGuestVisit(visitToCheckout.id);
      showToast('success', res.message || 'Guest checked out successfully.');
      setIsCheckoutConfirmOpen(false);
      setVisitToCheckout(null);
      fetchVisits();
      fetchOverview();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to check out visit.');
    }
  };

  // -----------------------------------------------------------------
  // HANDLERS: BILLING
  // -----------------------------------------------------------------

  const handleOpenCreateBillForVisit = (v: GuestVisitItem) => {
    setBillFormData({
      guestVisitId: v.id,
      billNumber: '',
      items: [{ description: 'Guest Room Accommodation (1 Night)', quantity: 1, unitAmount: 500 }],
    });
    setIsBillModalOpen(true);
  };

  const handleAddItemToBill = () => {
    setBillFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unitAmount: 0 }],
    }));
  };

  const handleRemoveItemFromBill = (index: number) => {
    if (billFormData.items.length <= 1) {
      showToast('error', 'A bill must have at least one item.');
      return;
    }
    setBillFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleBillItemChange = (index: number, field: keyof BillingItemRecord, value: any) => {
    setBillFormData((prev) => {
      const copy = [...prev.items];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, items: copy };
    });
  };

  const calculateFormTotal = () => {
    return billFormData.items.reduce((acc, it) => {
      const qty = parseInt(String(it.quantity), 10) || 0;
      const unit = parseFloat(String(it.unitAmount)) || 0;
      return acc + qty * unit;
    }, 0);
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billFormData.guestVisitId) {
      showToast('error', 'Please select a valid guest visit.');
      return;
    }

    // Validate items
    for (let i = 0; i < billFormData.items.length; i++) {
      const it = billFormData.items[i];
      if (!it.description.trim()) {
        showToast('error', `Item #${i + 1} requires a description.`);
        return;
      }
      if (it.quantity <= 0) {
        showToast('error', `Item #${i + 1} quantity must be greater than zero.`);
        return;
      }
      if (it.unitAmount < 0) {
        showToast('error', `Item #${i + 1} unit amount cannot be negative.`);
        return;
      }
    }

    try {
      const res = await managementApiService.createGuestBill(billFormData);
      showToast('success', res.message || 'Bill created successfully.');
      setIsBillModalOpen(false);
      fetchBills();
      fetchOverview();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create bill.');
    }
  };

  const handleViewBillDetail = async (billId: string) => {
    setIsLoadingBillDetail(true);
    setIsBillDetailModalOpen(true);
    try {
      const res = await managementApiService.getGuestBill(billId);
      if (res.success) {
        setSelectedBillDetail(res.bill);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load bill details.');
    } finally {
      setIsLoadingBillDetail(false);
    }
  };

  // -----------------------------------------------------------------
  // HANDLERS: PAYMENT
  // -----------------------------------------------------------------

  const handleOpenRecordPayment = (b: GuestBillItem) => {
    setBillToPay(b);
    setPaymentFormData({
      amount: b.balanceAmount > 0 ? String(b.balanceAmount) : '',
      paymentMethod: 'UPI',
      paymentReference: '',
      notes: '',
    });
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billToPay) return;

    const amt = parseFloat(paymentFormData.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('error', 'Payment amount must be greater than zero.');
      return;
    }
    if (amt > billToPay.balanceAmount + 0.001) {
      showToast('error', `Amount exceeds outstanding balance of Rs. ${billToPay.balanceAmount.toFixed(2)}.`);
      return;
    }

    try {
      const res = await managementApiService.recordGuestBillPayment(billToPay.id, {
        amount: amt,
        paymentMethod: paymentFormData.paymentMethod,
        paymentReference: paymentFormData.paymentReference || undefined,
        notes: paymentFormData.notes || undefined,
      });

      showToast('success', res.message || 'Payment recorded successfully.');
      setIsPaymentModalOpen(false);
      setBillToPay(null);
      fetchBills();
      fetchOverview();
      if (selectedBillDetail && selectedBillDetail.id === billToPay.id) {
        handleViewBillDetail(billToPay.id);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to record payment.');
    }
  };

  // -----------------------------------------------------------------
  // HANDLERS: VOID
  // -----------------------------------------------------------------

  const handleOpenVoidBill = (b: GuestBillItem) => {
    setBillToVoid(b);
    setVoidReason('');
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billToVoid) return;
    if (!voidReason.trim() || voidReason.trim().length < 3) {
      showToast('error', 'A valid reason (min 3 characters) is required to void this bill.');
      return;
    }

    try {
      const res = await managementApiService.voidGuestBill(billToVoid.id, voidReason.trim());
      showToast('success', res.message || 'Bill voided successfully.');
      setIsVoidModalOpen(false);
      setBillToVoid(null);
      fetchBills();
      fetchOverview();
      if (selectedBillDetail && selectedBillDetail.id === billToVoid.id) {
        handleViewBillDetail(billToVoid.id);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to void bill.');
    }
  };

  return (
    <div className="guest-billing-management-page">
      {/* Toast feedback */}
      {toast && (
        <div className={`toast-alert toast-${toast.type}`} role="alert">
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Top Banner with Realtime Sync Status & Quick Actions */}
      <div className="guest-billing-top-bar">
        <div className="guest-billing-header-title">
          <div className="guest-billing-badge-icon">
            <Receipt size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 m-0 leading-tight">
              Guest Visits & Billing Operations
            </h2>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              Authoritative visitor management, resident check-ins, line-item invoicing, and payment processing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Real-time SSE Connection Indicator */}
          <div className="guest-live-indicator" title={isLiveConnected ? 'SSE Stream Online' : 'Connecting...'}>
            <span className={`guest-live-dot ${isLiveConnected ? 'connected' : ''}`} />
            <span>{isLiveConnected ? 'Live Synchronized' : 'Connecting Realtime...'}</span>
          </div>

          <button
            type="button"
            className="guest-header-btn-sync"
            onClick={refreshAll}
            disabled={isManualRefreshing}
            title="Refresh latest data"
          >
            <RefreshCw size={15} className={isManualRefreshing ? 'animate-spin' : ''} />
            <span>{isManualRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <button
            type="button"
            className="guest-btn-primary"
            onClick={handleOpenAddGuest}
          >
            <UserPlus size={15} />
            <span>Add Guest</span>
          </button>

          <button
            type="button"
            className="guest-btn-primary"
            style={{ background: 'linear-gradient(135deg, #047857 0%, #10B981 100%)' }}
            onClick={() => {
              setVisitFormData({ guestId: '', hostStudentId: '', purpose: '', remarks: '' });
              setSelectedHostName('');
              setIsVisitModalOpen(true);
            }}
          >
            <UserCheck size={15} />
            <span>Check-In Visit</span>
          </button>
        </div>
      </div>

      {/* 6 KPI Cards Grid */}
      <div className="guest-kpi-grid">
        <div className="guest-kpi-card" onClick={() => setActiveTab('guests')} style={{ cursor: 'pointer' }}>
          <div className="guest-kpi-header">
            <span className="guest-kpi-label">Total Guests</span>
            <div className="guest-kpi-icon-wrap" style={{ background: '#EFF6FF', color: '#2563EB' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="guest-kpi-val">
            {isStatsLoading ? '—' : (stats?.totalGuests ?? 0).toLocaleString()}
          </div>
          <div className="guest-kpi-sub">Registered in directory</div>
        </div>

        <div className="guest-kpi-card" onClick={() => { setActiveTab('visits'); setVisitStatusFilter('ALL'); }} style={{ cursor: 'pointer' }}>
          <div className="guest-kpi-header">
            <span className="guest-kpi-label">Today's Visits</span>
            <div className="guest-kpi-icon-wrap" style={{ background: '#ECFDF5', color: '#059669' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div className="guest-kpi-val" style={{ color: '#059669' }}>
            {isStatsLoading ? '—' : (stats?.todayVisits ?? 0).toLocaleString()}
          </div>
          <div className="guest-kpi-sub">Arrived today</div>
        </div>

        <div className="guest-kpi-card" onClick={() => { setActiveTab('visits'); setVisitStatusFilter('CHECKED_IN'); }} style={{ cursor: 'pointer' }}>
          <div className="guest-kpi-header">
            <span className="guest-kpi-label">Active Visits</span>
            <div className="guest-kpi-icon-wrap" style={{ background: '#FFFBEB', color: '#D97706' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div className="guest-kpi-val" style={{ color: '#D97706' }}>
            {isStatsLoading ? '—' : (stats?.activeVisits ?? 0).toLocaleString()}
          </div>
          <div className="guest-kpi-sub">Currently on campus</div>
        </div>

        <div className="guest-kpi-card" onClick={() => { setActiveTab('bills'); setBillStatusFilter('ALL'); }} style={{ cursor: 'pointer' }}>
          <div className="guest-kpi-header">
            <span className="guest-kpi-label">Total Bills</span>
            <div className="guest-kpi-icon-wrap" style={{ background: '#FAF5FF', color: '#7C3AED' }}>
              <Receipt size={18} />
            </div>
          </div>
          <div className="guest-kpi-val" style={{ color: '#7C3AED' }}>
            {isStatsLoading ? '—' : (stats?.totalBills ?? 0).toLocaleString()}
          </div>
          <div className="guest-kpi-sub">Invoices generated</div>
        </div>

        <div className="guest-kpi-card" onClick={() => { setActiveTab('bills'); setBillStatusFilter('UNPAID'); }} style={{ cursor: 'pointer' }}>
          <div className="guest-kpi-header">
            <span className="guest-kpi-label">Unpaid Amount</span>
            <div className="guest-kpi-icon-wrap" style={{ background: '#FFF1F2', color: '#E11D48' }}>
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="guest-kpi-val" style={{ color: '#E11D48' }}>
            {isStatsLoading ? '—' : `₹ ${(stats?.unpaidAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          </div>
          <div className="guest-kpi-sub">Pending receivables</div>
        </div>

        <div className="guest-kpi-card" onClick={() => { setActiveTab('bills'); setBillStatusFilter('PAID'); }} style={{ cursor: 'pointer' }}>
          <div className="guest-kpi-header">
            <span className="guest-kpi-label">Paid Amount</span>
            <div className="guest-kpi-icon-wrap" style={{ background: '#F0FDFA', color: '#0D9488' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="guest-kpi-val" style={{ color: '#0D9488' }}>
            {isStatsLoading ? '—' : `₹ ${(stats?.paidAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          </div>
          <div className="guest-kpi-sub">Authoritative collections</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="guest-tabs-bar">
        <button
          type="button"
          className={`guest-tab-button ${activeTab === 'bills' ? 'active' : ''}`}
          onClick={() => setActiveTab('bills')}
        >
          <Receipt size={18} />
          <span>Bills & Payments</span>
          {stats?.totalBills !== undefined && <span className="guest-tab-counter">{stats.totalBills}</span>}
        </button>

        <button
          type="button"
          className={`guest-tab-button ${activeTab === 'visits' ? 'active' : ''}`}
          onClick={() => setActiveTab('visits')}
        >
          <Clock size={18} />
          <span>Visits Lifecycle</span>
          {stats?.activeVisits !== undefined && <span className="guest-tab-counter">{stats.activeVisits} active</span>}
        </button>

        <button
          type="button"
          className={`guest-tab-button ${activeTab === 'guests' ? 'active' : ''}`}
          onClick={() => setActiveTab('guests')}
        >
          <Users size={18} />
          <span>Guest Directory</span>
          {stats?.totalGuests !== undefined && <span className="guest-tab-counter">{stats.totalGuests}</span>}
        </button>
      </div>

      {/* TAB 1: BILLS & PAYMENTS */}
      {activeTab === 'bills' && (
        <section className="guest-content-container">
          {/* Filters Bar */}
          <div className="guest-filter-controls-bar">
            <div className="guest-search-input-wrapper">
              <Search size={16} className="guest-search-icon-inside" />
              <input
                type="text"
                placeholder="Search by Bill #, Guest, or Resident..."
                value={billSearch}
                onChange={(e) => {
                  setBillSearch(e.target.value);
                  setBillPagination((p) => ({ ...p, page: 1 }));
                }}
              />
            </div>

            <div className="guest-select-filter-group">
              <label htmlFor="billStatusSelect">Payment Status:</label>
              <select
                id="billStatusSelect"
                value={billStatusFilter}
                onChange={(e) => {
                  setBillStatusFilter(e.target.value);
                  setBillPagination((p) => ({ ...p, page: 1 }));
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="UNPAID">UNPAID</option>
                <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                <option value="PAID">PAID</option>
                <option value="VOID">VOID</option>
              </select>
            </div>
          </div>

          {/* Bills Data Table */}
          <div className="guest-table-wrapper">
            {isBillsLoading ? (
              <div className="loading-state p-8 text-center">
                <RefreshCw size={24} className="animate-spin text-primary inline-block" />
                <p className="mt-2 text-sm text-slate-500">Loading authoritative bills...</p>
              </div>
            ) : bills.length === 0 ? (
              <div className="empty-state p-8 text-center">
                <Receipt size={40} className="empty-icon inline-block text-slate-400" />
                <h4 className="mt-2 text-base font-semibold text-slate-700">No Guest Bills Found</h4>
                <p className="text-sm text-slate-500">There are no guest bills matching your selected filter.</p>
              </div>
            ) : (
              <table className="guest-data-table">
                <thead>
                  <tr>
                    <th>Bill Number</th>
                    <th>Guest & Host</th>
                    <th>Total Amount</th>
                    <th>Paid / Balance</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id} className={b.paymentStatus === 'VOID' ? 'row-voided' : ''}>
                      <td>
                        <span className="font-mono font-bold text-primary">{b.billNumber}</span>
                        {b.paymentMethod && (
                          <div className="text-xs text-muted mt-0.5">
                            Method: {b.paymentMethod} {b.paymentReference ? `(${b.paymentReference})` : ''}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="font-semibold text-slate-900">
                          {b.guestVisit?.guest?.name || 'Guest'}
                        </div>
                        <div className="text-xs text-muted">
                          Host: {b.guestVisit?.hostStudent?.name} ({b.guestVisit?.hostStudent?.jntuNo})
                        </div>
                      </td>
                      <td>
                        <span className="font-bold text-slate-900">
                          ₹ {b.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="text-xs text-muted">
                          {b.items?.length || 0} line item(s)
                        </div>
                      </td>
                      <td>
                        <div className="text-sm font-semibold text-emerald-600">
                          Paid: ₹ {b.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs font-semibold text-rose-600">
                          Bal: ₹ {b.balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill status-${b.paymentStatus.toLowerCase().replace('_', '-')}`}>
                          {b.paymentStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div className="text-sm font-medium">
                          {new Date(b.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted">
                          {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="guest-actions-cluster">
                          <button
                            type="button"
                            className="guest-btn-table-action btn-details"
                            onClick={() => handleViewBillDetail(b.id)}
                            title="View bill & payment details"
                          >
                            <Eye size={14} />
                            <span>Details</span>
                          </button>

                          {b.paymentStatus !== 'PAID' && b.paymentStatus !== 'VOID' && (
                            <button
                              type="button"
                              className="guest-btn-table-action btn-pay"
                              onClick={() => handleOpenRecordPayment(b)}
                              title="Record payment"
                            >
                              <CreditCard size={14} />
                              <span>Pay</span>
                            </button>
                          )}

                          {b.paymentStatus !== 'VOID' && (
                            <button
                              type="button"
                              className="guest-btn-table-action btn-void"
                              onClick={() => handleOpenVoidBill(b)}
                              title="Void this bill"
                            >
                              <Ban size={14} />
                              <span>Void</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Bills Pagination */}
          {billPagination.totalPages > 1 && (
            <div className="pagination-bar p-3 border-t border-slate-200 flex justify-between items-center">
              <span className="pagination-info text-xs text-slate-500">
                Showing page {billPagination.page} of {billPagination.totalPages} ({billPagination.total} bills)
              </span>
              <div className="pagination-controls flex items-center gap-1">
                <button
                  type="button"
                  className="btn-page"
                  disabled={billPagination.page <= 1}
                  onClick={() => setBillPagination((p) => ({ ...p, page: p.page - 1 }))}
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  className="btn-page"
                  disabled={billPagination.page >= billPagination.totalPages}
                  onClick={() => setBillPagination((p) => ({ ...p, page: p.page + 1 }))}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: VISITS LIFECYCLE */}
      {activeTab === 'visits' && (
        <section className="guest-content-container">
          {/* Visits Filter Bar */}
          <div className="guest-filter-controls-bar">
            <div className="guest-search-input-wrapper">
              <Search size={16} className="guest-search-icon-inside" />
              <input
                type="text"
                placeholder="Search visits by guest, host, or purpose..."
                value={visitSearch}
                onChange={(e) => {
                  setVisitSearch(e.target.value);
                  setVisitPagination((p) => ({ ...p, page: 1 }));
                }}
              />
            </div>

            <div className="guest-select-filter-group">
              <label htmlFor="visitStatusSelect">Visit Status:</label>
              <select
                id="visitStatusSelect"
                value={visitStatusFilter}
                onChange={(e) => {
                  setVisitStatusFilter(e.target.value);
                  setVisitPagination((p) => ({ ...p, page: 1 }));
                }}
              >
                <option value="ALL">All Visits</option>
                <option value="CHECKED_IN">CHECKED IN (Active)</option>
                <option value="CHECKED_OUT">CHECKED OUT</option>
              </select>
            </div>
          </div>

          {/* Visits Table */}
          <div className="guest-table-wrapper">
            {isVisitsLoading ? (
              <div className="loading-state p-8 text-center">
                <RefreshCw size={24} className="animate-spin text-primary inline-block" />
                <p className="mt-2 text-sm text-slate-500">Loading guest visits...</p>
              </div>
            ) : visits.length === 0 ? (
              <div className="empty-state p-8 text-center">
                <Clock size={40} className="empty-icon inline-block text-slate-400" />
                <h4 className="mt-2 text-base font-semibold text-slate-700">No Visits Recorded</h4>
                <p className="text-sm text-slate-500">No guest visits matching your criteria were found.</p>
              </div>
            ) : (
              <table className="guest-data-table">
                <thead>
                  <tr>
                    <th>Guest Information</th>
                    <th>Host Resident</th>
                    <th>Purpose & Remarks</th>
                    <th>Check-In Time</th>
                    <th>Check-Out Time</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div className="font-semibold text-slate-900">{v.guest?.name}</div>
                        <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          <Phone size={12} /> {v.guest?.phone}
                        </div>
                      </td>
                      <td>
                        <div className="font-semibold text-slate-900">{v.hostStudent?.name}</div>
                        <div className="text-xs text-muted">
                          {v.hostStudent?.jntuNo} • {v.hostStudent?.blockName || 'Main'} / {v.hostStudent?.roomNumber || 'Room'}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm font-medium text-slate-800">{v.purpose}</div>
                        {v.remarks && <div className="text-xs text-muted italic">"{v.remarks}"</div>}
                      </td>
                      <td>
                        <div className="text-sm font-medium">
                          {new Date(v.checkInTime).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted">
                          {new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td>
                        {v.checkOutTime ? (
                          <>
                            <div className="text-sm font-medium text-slate-700">
                              {new Date(v.checkOutTime).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted">
                              {new Date(v.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded">Currently On Campus</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill status-${v.status.toLowerCase().replace('_', '-')}`}>
                          {v.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="guest-actions-cluster">
                          {v.status === 'CHECKED_IN' && (
                            <button
                              type="button"
                              className="guest-btn-table-action btn-checkout"
                              onClick={() => handleOpenCheckout(v)}
                              title="Checkout guest"
                            >
                              <UserCheck size={14} />
                              <span>Check-out</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="guest-btn-table-action btn-bill"
                            onClick={() => handleOpenCreateBillForVisit(v)}
                            title="Generate bill for this visit"
                          >
                            <Receipt size={14} />
                            <span>Bill</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Visits Pagination */}
          {visitPagination.totalPages > 1 && (
            <div className="pagination-bar p-3 border-t border-slate-200 flex justify-between items-center">
              <span className="pagination-info text-xs text-slate-500">
                Showing page {visitPagination.page} of {visitPagination.totalPages} ({visitPagination.total} visits)
              </span>
              <div className="pagination-controls flex items-center gap-1">
                <button
                  type="button"
                  className="btn-page"
                  disabled={visitPagination.page <= 1}
                  onClick={() => setVisitPagination((p) => ({ ...p, page: p.page - 1 }))}
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  className="btn-page"
                  disabled={visitPagination.page >= visitPagination.totalPages}
                  onClick={() => setVisitPagination((p) => ({ ...p, page: p.page + 1 }))}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: GUEST DIRECTORY */}
      {activeTab === 'guests' && (
        <section className="guest-content-container">
          {/* Guest Search Bar */}
          <div className="guest-filter-controls-bar">
            <div className="guest-search-input-wrapper">
              <Search size={16} className="guest-search-icon-inside" />
              <input
                type="text"
                placeholder="Search guests by name, phone, ID proof..."
                value={guestSearch}
                onChange={(e) => {
                  setGuestSearch(e.target.value);
                  setGuestPagination((p) => ({ ...p, page: 1 }));
                }}
              />
            </div>
          </div>

          {/* Guests Table */}
          <div className="guest-table-wrapper">
            {isGuestsLoading ? (
              <div className="loading-state p-8 text-center">
                <RefreshCw size={24} className="animate-spin text-primary inline-block" />
                <p className="mt-2 text-sm text-slate-500">Loading guest directory...</p>
              </div>
            ) : guests.length === 0 ? (
              <div className="empty-state p-8 text-center">
                <Users size={40} className="empty-icon inline-block text-slate-400" />
                <h4 className="mt-2 text-base font-semibold text-slate-700">No Guests Registered</h4>
                <p className="text-sm text-slate-500">No guest records found. Use "+ Add Guest" above to register new visitors.</p>
              </div>
            ) : (
              <table className="guest-data-table">
                <thead>
                  <tr>
                    <th>Guest Name</th>
                    <th>Contact Phone & Email</th>
                    <th>Identity Proof</th>
                    <th>Relation</th>
                    <th>Address</th>
                    <th>Total Visits</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g) => (
                    <tr key={g.id}>
                      <td className="font-semibold text-slate-900">{g.name}</td>
                      <td>
                        <div className="text-sm font-medium flex items-center gap-1">
                          <Phone size={13} className="text-muted" /> {g.phone}
                        </div>
                        {g.email && (
                          <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                            <Mail size={12} /> {g.email}
                          </div>
                        )}
                      </td>
                      <td>
                        {g.idProofType ? (
                          <div className="text-sm">
                            <span className="font-medium text-slate-700">{g.idProofType}:</span>{' '}
                            <span className="font-mono text-xs text-slate-600">{g.idProofNumber || 'N/A'}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">Not recorded</span>
                        )}
                      </td>
                      <td>
                        <span className="badge-relation">{g.relation || 'VISITOR'}</span>
                      </td>
                      <td className="text-sm text-slate-600 max-w-xs truncate" title={g.address || ''}>
                        {g.address || '—'}
                      </td>
                      <td>
                        <span className="font-bold text-primary">
                          {g._count?.visits ?? (g.visits?.length || 0)}
                        </span>{' '}
                        visit(s)
                      </td>
                      <td className="text-right">
                        <div className="guest-actions-cluster">
                          <button
                            type="button"
                            className="guest-btn-table-action btn-checkout"
                            onClick={() => handleOpenCheckinForGuest(g)}
                            title="Check-in this guest"
                          >
                            <UserCheck size={14} />
                            <span>Check-in</span>
                          </button>

                          <button
                            type="button"
                            className="guest-btn-table-action btn-details"
                            onClick={() => handleOpenEditGuest(g)}
                            title="Edit guest profile"
                          >
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Guests Pagination */}
          {guestPagination.totalPages > 1 && (
            <div className="pagination-bar p-3 border-t border-slate-200 flex justify-between items-center">
              <span className="pagination-info text-xs text-slate-500">
                Showing page {guestPagination.page} of {guestPagination.totalPages} ({guestPagination.total} guests)
              </span>
              <div className="pagination-controls flex items-center gap-1">
                <button
                  type="button"
                  className="btn-page"
                  disabled={guestPagination.page <= 1}
                  onClick={() => setGuestPagination((p) => ({ ...p, page: p.page - 1 }))}
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  className="btn-page"
                  disabled={guestPagination.page >= guestPagination.totalPages}
                  onClick={() => setGuestPagination((p) => ({ ...p, page: p.page + 1 }))}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ============================================================= */}
      {/* MODALS */}
      {/* ============================================================= */}

      {/* 1. ADD / EDIT GUEST MODAL */}
      {isGuestModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsGuestModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingGuest ? 'Edit Guest Details' : 'Register New Guest'}</h3>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setIsGuestModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveGuest}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="guestNameInput">Guest Full Name *</label>
                  <input
                    id="guestNameInput"
                    type="text"
                    required
                    placeholder="e.g. Ramesh Sharma"
                    value={guestFormData.name}
                    onChange={(e) => setGuestFormData({ ...guestFormData, name: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label htmlFor="guestPhoneInput">Contact Phone Number *</label>
                    <input
                      id="guestPhoneInput"
                      type="tel"
                      required
                      placeholder="e.g. 9848012345"
                      value={guestFormData.phone}
                      onChange={(e) => setGuestFormData({ ...guestFormData, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label htmlFor="guestEmailInput">Email Address</label>
                    <input
                      id="guestEmailInput"
                      type="email"
                      placeholder="e.g. ramesh@example.com"
                      value={guestFormData.email}
                      onChange={(e) => setGuestFormData({ ...guestFormData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label htmlFor="guestIdTypeSelect">ID Proof Type</label>
                    <select
                      id="guestIdTypeSelect"
                      value={guestFormData.idProofType}
                      onChange={(e) => setGuestFormData({ ...guestFormData, idProofType: e.target.value })}
                    >
                      <option value="AADHAAR">Aadhaar Card</option>
                      <option value="PAN">PAN Card</option>
                      <option value="DRIVING_LICENSE">Driving License</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="VOTER_ID">Voter ID</option>
                      <option value="OTHER">Other Government ID</option>
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label htmlFor="guestIdNumInput">ID Proof Number</label>
                    <input
                      id="guestIdNumInput"
                      type="text"
                      placeholder="e.g. 1234 5678 9012"
                      value={guestFormData.idProofNumber}
                      onChange={(e) => setGuestFormData({ ...guestFormData, idProofNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="guestRelationSelect">Relationship to Resident</label>
                  <select
                    id="guestRelationSelect"
                    value={guestFormData.relation}
                    onChange={(e) => setGuestFormData({ ...guestFormData, relation: e.target.value })}
                  >
                    <option value="PARENT">Parent (Father / Mother)</option>
                    <option value="GUARDIAN">Local Guardian</option>
                    <option value="SIBLING">Sibling (Brother / Sister)</option>
                    <option value="RELATIVE">Relative</option>
                    <option value="FRIEND">Friend</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="guestAddressInput">Permanent Residential Address</label>
                  <textarea
                    id="guestAddressInput"
                    rows={2}
                    placeholder="Enter city, state, or address..."
                    value={guestFormData.address}
                    onChange={(e) => setGuestFormData({ ...guestFormData, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsGuestModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingGuest ? 'Update Guest' : 'Save Guest Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CHECK-IN VISIT MODAL */}
      {isVisitModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsVisitModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Check-In Guest Visit</h3>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setIsVisitModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateVisit}>
              <div className="modal-body">
                {/* Guest Selector */}
                <div className="form-group">
                  <label htmlFor="visitGuestSelect">Select Guest *</label>
                  <select
                    id="visitGuestSelect"
                    required
                    value={visitFormData.guestId}
                    onChange={(e) => setVisitFormData({ ...visitFormData, guestId: e.target.value })}
                  >
                    <option value="">-- Choose registered guest --</option>
                    {guests.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.phone}) - {g.relation || 'Guest'}
                      </option>
                    ))}
                  </select>
                  {guests.length === 0 && (
                    <span className="text-xs text-rose-600 mt-1">
                      No guests loaded. You can add one via "+ Add Guest" first.
                    </span>
                  )}
                </div>

                {/* Host Student Lookup */}
                <div className="form-group">
                  <label htmlFor="hostSearchInput">Search Host Student (Name or JNTU No.) *</label>
                  <input
                    id="hostSearchInput"
                    type="text"
                    placeholder="Type student name or roll number..."
                    value={hostSearchQuery}
                    onChange={(e) => setHostSearchQuery(e.target.value)}
                  />

                  {/* Search Results Dropdown */}
                  <div className="host-select-container mt-2">
                    {isSearchingHosts ? (
                      <div className="p-2 text-xs text-muted">Searching students...</div>
                    ) : searchedHosts.length === 0 ? (
                      <div className="p-2 text-xs text-muted">No students found matching query.</div>
                    ) : (
                      <div className="host-options-list">
                        {searchedHosts.slice(0, 5).map((h) => (
                          <div
                            key={h.id}
                            className={`host-option-item ${visitFormData.hostStudentId === h.id ? 'host-selected' : ''}`}
                            onClick={() => {
                              setVisitFormData({ ...visitFormData, hostStudentId: h.id });
                              setSelectedHostName(`${h.name} (${h.jntuNo})`);
                            }}
                          >
                            <div className="font-semibold text-sm">{h.name}</div>
                            <div className="text-xs text-muted">
                              {h.jntuNo} • {h.blockName || 'Block'} / {h.roomNumber || 'Room'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedHostName && (
                    <div className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 p-2 rounded flex items-center gap-1.5">
                      <Check size={14} /> Selected Host: {selectedHostName}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="visitPurposeInput">Purpose of Visit *</label>
                  <input
                    id="visitPurposeInput"
                    type="text"
                    required
                    placeholder="e.g. Meeting resident, campus tour, fee clearance..."
                    value={visitFormData.purpose}
                    onChange={(e) => setVisitFormData({ ...visitFormData, purpose: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="visitRemarksInput">Optional Remarks</label>
                  <input
                    id="visitRemarksInput"
                    type="text"
                    placeholder="e.g. Expected stay duration, special permission..."
                    value={visitFormData.remarks}
                    onChange={(e) => setVisitFormData({ ...visitFormData, remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsVisitModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. CHECKOUT CONFIRMATION MODAL */}
      {isCheckoutConfirmOpen && visitToCheckout && (
        <div className="modal-backdrop" onClick={() => setIsCheckoutConfirmOpen(false)}>
          <div className="modal-dialog modal-dialog-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Guest Check-Out</h3>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setIsCheckoutConfirmOpen(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p className="text-slate-700">
                Are you sure you want to mark guest <strong>{visitToCheckout.guest?.name}</strong> as checked out?
              </p>
              <div className="checkout-summary-box mt-3">
                <div className="text-xs text-muted">Check-In Time</div>
                <div className="font-semibold text-sm">
                  {new Date(visitToCheckout.checkInTime).toLocaleString()}
                </div>
                <div className="text-xs text-muted mt-2">Host Resident</div>
                <div className="font-medium text-sm">
                  {visitToCheckout.hostStudent?.name} ({visitToCheckout.hostStudent?.jntuNo})
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsCheckoutConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary btn-checkout-confirm"
                onClick={handleConfirmCheckout}
              >
                Confirm Check-Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CREATE BILL MODAL */}
      {isBillModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsBillModalOpen(false)}>
          <div className="modal-dialog modal-dialog-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Guest Billing Invoice</h3>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setIsBillModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBill}>
              <div className="modal-body">
                {/* Visit Selector (if not preselected) */}
                <div className="form-group">
                  <label htmlFor="billVisitSelect">Select Associated Guest Visit *</label>
                  <select
                    id="billVisitSelect"
                    required
                    value={billFormData.guestVisitId}
                    onChange={(e) => setBillFormData({ ...billFormData, guestVisitId: e.target.value })}
                  >
                    <option value="">-- Choose guest visit --</option>
                    {visits.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.guest?.name} visiting {v.hostStudent?.name} ({new Date(v.checkInTime).toLocaleDateString()}) - {v.status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="customBillNumInput">Custom Bill Number (Optional, auto-generated if left empty)</label>
                  <input
                    id="customBillNumInput"
                    type="text"
                    placeholder="Leave empty for auto: GB-YYYYMMDD-XXXX"
                    value={billFormData.billNumber}
                    onChange={(e) => setBillFormData({ ...billFormData, billNumber: e.target.value })}
                  />
                </div>

                {/* Line Items Builder */}
                <div className="line-items-section mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-semibold text-slate-800">Billing Line Items *</label>
                    <button
                      type="button"
                      className="btn-secondary btn-sm flex items-center gap-1"
                      onClick={handleAddItemToBill}
                    >
                      <Plus size={14} /> Add Line Item
                    </button>
                  </div>

                  <div className="line-items-list">
                    {billFormData.items.map((it, idx) => (
                      <div key={idx} className="line-item-row">
                        <div className="item-col-desc">
                          <input
                            type="text"
                            required
                            placeholder="Description (e.g. Room accommodation, Guest meals)"
                            value={it.description}
                            onChange={(e) => handleBillItemChange(idx, 'description', e.target.value)}
                          />
                        </div>

                        <div className="item-col-qty">
                          <input
                            type="number"
                            required
                            min="1"
                            title="Quantity"
                            placeholder="Qty"
                            value={it.quantity}
                            onChange={(e) => handleBillItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                          />
                        </div>

                        <div className="item-col-unit">
                          <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            title="Unit Price"
                            placeholder="Unit Amount (₹)"
                            value={it.unitAmount}
                            onChange={(e) => handleBillItemChange(idx, 'unitAmount', parseFloat(e.target.value) || 0)}
                          />
                        </div>

                        <div className="item-col-subtotal font-semibold text-sm text-slate-700">
                          ₹ {(it.quantity * it.unitAmount).toFixed(2)}
                        </div>

                        <div className="item-col-del">
                          <button
                            type="button"
                            className="btn-icon-del"
                            onClick={() => handleRemoveItemFromBill(idx)}
                            aria-label="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Calculated Total Display */}
                  <div className="bill-total-summary-card mt-3">
                    <span className="text-sm font-medium text-slate-600">Calculated Bill Total:</span>
                    <span className="text-xl font-bold text-slate-900">
                      ₹ {calculateFormTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsBillModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Generate Authoritative Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. VIEW BILL DETAIL MODAL */}
      {isBillDetailModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsBillDetailModalOpen(false)}>
          <div className="modal-dialog modal-dialog-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Bill Details & Payment History</h3>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setIsBillDetailModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {isLoadingBillDetail || !selectedBillDetail ? (
                <div className="loading-state">
                  <RefreshCw size={24} className="animate-spin text-primary" />
                  <p>Loading authoritative bill information...</p>
                </div>
              ) : (
                <div className="bill-detail-content">
                  {/* Bill Banner */}
                  <div className="bill-header-banner">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted">Invoice Number</div>
                      <h4 className="text-xl font-bold text-slate-900 font-mono">
                        {selectedBillDetail.billNumber}
                      </h4>
                      <div className="text-xs text-muted mt-1">
                        Generated on {new Date(selectedBillDetail.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`status-pill status-${selectedBillDetail.paymentStatus.toLowerCase().replace('_', '-')}`}
                      >
                        {selectedBillDetail.paymentStatus.replace('_', ' ')}
                      </span>
                      {selectedBillDetail.paidAt && (
                        <div className="text-xs text-emerald-700 font-medium mt-1">
                          Settled on {new Date(selectedBillDetail.paidAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedBillDetail.paymentStatus === 'VOID' && (
                    <div className="void-alert-box mt-3">
                      <div className="font-semibold text-rose-800 flex items-center gap-1">
                        <Ban size={16} /> Bill Voided by {selectedBillDetail.voidedBy || 'Management'}
                      </div>
                      <div className="text-xs text-rose-700 mt-1">
                        Reason: "{selectedBillDetail.voidReason || 'No reason specified'}" on{' '}
                        {selectedBillDetail.voidedAt
                          ? new Date(selectedBillDetail.voidedAt).toLocaleString()
                          : 'N/A'}
                      </div>
                    </div>
                  )}

                  {/* Resident and Guest Info */}
                  <div className="bill-meta-grid mt-4">
                    <div className="meta-box">
                      <span className="meta-label">Guest Visitor</span>
                      <span className="meta-val font-semibold">
                        {selectedBillDetail.guestVisit?.guest?.name}
                      </span>
                      <span className="text-xs text-muted">
                        Phone: {selectedBillDetail.guestVisit?.guest?.phone}
                      </span>
                    </div>

                    <div className="meta-box">
                      <span className="meta-label">Host Student Resident</span>
                      <span className="meta-val font-semibold">
                        {selectedBillDetail.guestVisit?.hostStudent?.name}
                      </span>
                      <span className="text-xs text-muted">
                        JNTU: {selectedBillDetail.guestVisit?.hostStudent?.jntuNo} •{' '}
                        {selectedBillDetail.guestVisit?.hostStudent?.roomNumber || 'Room'}
                      </span>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="mt-4">
                    <h5 className="font-semibold text-slate-800 mb-2">Itemized Charges</h5>
                    <table className="detail-items-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th className="text-center">Qty</th>
                          <th className="text-right">Unit Price</th>
                          <th className="text-right">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBillDetail.items?.map((it, i) => (
                          <tr key={it.id || i}>
                            <td className="font-medium text-slate-800">{it.description}</td>
                            <td className="text-center">{it.quantity}</td>
                            <td className="text-right">₹ {it.unitAmount.toFixed(2)}</td>
                            <td className="text-right font-semibold">
                              ₹ {(it.quantity * it.unitAmount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="text-right font-bold">Total Bill Amount:</td>
                          <td className="text-right font-bold text-lg text-slate-900">
                            ₹ {selectedBillDetail.totalAmount.toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="text-right font-semibold text-emerald-700">Amount Paid:</td>
                          <td className="text-right font-semibold text-emerald-700">
                            ₹ {selectedBillDetail.paidAmount.toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="text-right font-bold text-rose-700">Balance Due:</td>
                          <td className="text-right font-bold text-rose-700 text-lg">
                            ₹ {selectedBillDetail.balanceAmount.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Payment History */}
                  <div className="mt-5">
                    <h5 className="font-semibold text-slate-800 mb-2">Payment Transaction History</h5>
                    {(!selectedBillDetail.payments || selectedBillDetail.payments.length === 0) ? (
                      <p className="text-xs text-muted italic">No payment transactions recorded yet.</p>
                    ) : (
                      <div className="payment-history-list">
                        {selectedBillDetail.payments.map((p, idx) => (
                          <div key={p.id || idx} className="payment-history-item">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-emerald-700 text-base">
                                + ₹ {p.amount.toFixed(2)}
                              </span>
                              <span className="badge-method">{p.paymentMethod}</span>
                            </div>
                            <div className="text-xs text-muted mt-1">
                              Recorded on {new Date(p.createdAt).toLocaleString()} by{' '}
                              <strong>{p.recordedBy || 'Staff'}</strong>
                            </div>
                            {p.paymentReference && (
                              <div className="text-xs font-mono text-slate-600 mt-0.5">
                                Ref: {p.paymentReference}
                              </div>
                            )}
                            {p.notes && (
                              <div className="text-xs text-slate-500 italic mt-0.5">
                                Notes: "{p.notes}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {selectedBillDetail &&
                selectedBillDetail.paymentStatus !== 'PAID' &&
                selectedBillDetail.paymentStatus !== 'VOID' && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      handleOpenRecordPayment(selectedBillDetail);
                    }}
                  >
                    <CreditCard size={15} /> Record Payment
                  </button>
                )}

              {selectedBillDetail && selectedBillDetail.paymentStatus !== 'VOID' && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    handleOpenVoidBill(selectedBillDetail);
                  }}
                >
                  <Ban size={15} /> Void Bill
                </button>
              )}

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsBillDetailModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && billToPay && (
        <div className="modal-backdrop" onClick={() => setIsPaymentModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record Bill Payment</h3>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setIsPaymentModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment}>
              <div className="modal-body">
                {/* Financial Summary Card */}
                <div className="payment-balance-summary">
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>Invoice: {billToPay.billNumber}</span>
                    <span>Total: ₹ {billToPay.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-700">Outstanding Balance:</span>
                    <span className="text-xl text-rose-600">
                      ₹ {billToPay.balanceAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="form-group mt-3">
                  <label htmlFor="payAmountInput">Payment Amount (₹) *</label>
                  <input
                    id="payAmountInput"
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    max={billToPay.balanceAmount}
                    value={paymentFormData.amount}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                  />
                  <span className="text-xs text-muted mt-1">
                    Cannot exceed outstanding balance of ₹ {billToPay.balanceAmount.toFixed(2)}.
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="payMethodSelect">Payment Method *</label>
                  <select
                    id="payMethodSelect"
                    value={paymentFormData.paymentMethod}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                  >
                    <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                    <option value="CASH">Cash at Desk</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="BANK_TRANSFER">Direct Bank Transfer / NEFT</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="payRefInput">Transaction / Reference Number</label>
                  <input
                    id="payRefInput"
                    type="text"
                    placeholder="e.g. UPI-1234567890 or Receipt-042"
                    value={paymentFormData.paymentReference}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentReference: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="payNotesInput">Optional Notes</label>
                  <input
                    id="payNotesInput"
                    type="text"
                    placeholder="e.g. Partial cash installment..."
                    value={paymentFormData.notes}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsPaymentModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. VOID BILL MODAL */}
      {isVoidModalOpen && billToVoid && (
        <div className="modal-backdrop" onClick={() => setIsVoidModalOpen(false)}>
          <div className="modal-dialog modal-dialog-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-rose-700 flex items-center gap-1.5">
                <AlertTriangle size={20} /> Void Bill Invoice
              </h3>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setIsVoidModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmVoid}>
              <div className="modal-body">
                <div className="void-warning-banner">
                  <strong>Warning:</strong> Voiding invoice <strong>{billToVoid.billNumber}</strong> (₹{' '}
                  {billToVoid.totalAmount.toFixed(2)}) will invalidate outstanding balances and mark it
                  VOID in authoritative financial records. This action will be permanently recorded in
                  the audit history.
                </div>

                <div className="form-group mt-3">
                  <label htmlFor="voidReasonInput">Reason for Voiding *</label>
                  <textarea
                    id="voidReasonInput"
                    rows={3}
                    required
                    placeholder="Provide detailed administrative justification (e.g. Duplicate entry, guest waiver authorized by Chief Warden)..."
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsVoidModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-danger">
                  Authorize & Void Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
