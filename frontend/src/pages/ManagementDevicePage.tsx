import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Eye,
  Edit2,
  Power,
  KeyRound,
  History,
  X,
  Copy,
  Check,
  AlertTriangle,
  Radio,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Network,
  Wrench,
} from 'lucide-react';
import {
  managementApiService,
  DeviceItem,
  DeviceDetail,
  DeviceKPIs,
  CreateDevicePayload,
  UpdateDevicePayload,
  DeviceActivityItem,
} from '../services/api';
import '../styles/DeviceManagement.css';

interface ManagementDevicePageProps {
  onNavigate?: (path: string) => void;
}

export const ManagementDevicePage: React.FC<ManagementDevicePageProps> = () => {
  // Authoritative State
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [stats, setStats] = useState<DeviceKPIs>({
    totalDevices: 0,
    activeDevices: 0,
    disabledDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    maintenanceDevices: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [enabledFilter, setEnabledFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('');

  // Applied Filters State (for fetch)
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    type: 'ALL',
    status: 'ALL',
    enabled: 'ALL',
    location: '',
  });

  // Modals State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isRotateModalOpen, setIsRotateModalOpen] = useState<boolean>(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = useState<boolean>(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState<boolean>(false);

  // Target Device Selection
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [selectedDeviceDetail, setSelectedDeviceDetail] = useState<DeviceDetail | null>(null);
  const [deviceActivities, setDeviceActivities] = useState<DeviceActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState<boolean>(false);

  // One-Time Credential Banner State
  const [newCredentialInfo, setNewCredentialInfo] = useState<{
    apiKey: string;
    warning: string;
    deviceIdentifier: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Form States for Register Device
  const [registerForm, setRegisterForm] = useState<CreateDevicePayload>({
    name: '',
    deviceIdentifier: '',
    deviceType: 'TURNSTILE',
    location: '',
    description: '',
    isEnabled: true,
    ipAddress: '',
    macAddress: '',
    firmwareVersion: '',
    maintenanceNotes: '',
  });
  const [registerSubmitting, setRegisterSubmitting] = useState<boolean>(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Form States for Edit Device
  const [editForm, setEditForm] = useState<UpdateDevicePayload>({
    name: '',
    location: '',
    deviceType: 'TURNSTILE',
    description: '',
    status: 'ONLINE',
    isEnabled: true,
    ipAddress: '',
    macAddress: '',
    firmwareVersion: '',
    maintenanceNotes: '',
  });
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Action Pending Spinners
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // FETCH DEVICES (Authoritative Query)
  // --------------------------------------------------------------------------
  const fetchDevices = useCallback(
    async (pageToFetch = pagination.page) => {
      try {
        setIsLoading(true);
        setError(null);

        const res = await managementApiService.getDevices({
          page: pageToFetch,
          pageSize: pagination.pageSize,
          search: appliedFilters.search,
          type: appliedFilters.type,
          status: appliedFilters.status,
          enabled: appliedFilters.enabled,
          location: appliedFilters.location,
        });

        if (res.success) {
          setDevices(res.devices);
          setStats(res.stats);
          setPagination(res.pagination);
        } else {
          setError('Failed to fetch devices from authoritative database.');
        }
      } catch (err: any) {
        console.error('Error fetching devices:', err);
        setError(err.message || 'An unexpected network error occurred.');
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.pageSize, appliedFilters]
  );

  useEffect(() => {
    fetchDevices(pagination.page);
  }, [fetchDevices, pagination.page]);

  // --------------------------------------------------------------------------
  // REAL-TIME SSE SUBSCRIPTION (No Polling)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents((event: any) => {
      // Re-fetch authoritative state when device mutations or heartbeat events occur
      const deviceEvents = [
        'DEVICE_CREATED',
        'DEVICE_UPDATED',
        'DEVICE_ENABLED',
        'DEVICE_DISABLED',
        'DEVICE_STATUS_CHANGED',
        'DEVICE_CREDENTIAL_ROTATED',
        'DEVICE_MANAGEMENT_UPDATE',
        'device_event',
        'dashboard_update',
      ];

      if (deviceEvents.includes(event.type) || deviceEvents.includes(event.action)) {
        fetchDevices(pagination.page);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [fetchDevices, pagination.page]);

  // --------------------------------------------------------------------------
  // FILTER HANDLERS
  // --------------------------------------------------------------------------
  const handleApplyFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setAppliedFilters({
      search: searchQuery.trim(),
      type: typeFilter,
      status: statusFilter,
      enabled: enabledFilter,
      location: locationFilter.trim(),
    });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setEnabledFilter('ALL');
    setLocationFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
    setAppliedFilters({
      search: '',
      type: 'ALL',
      status: 'ALL',
      enabled: 'ALL',
      location: '',
    });
  };

  // --------------------------------------------------------------------------
  // COPY ONE-TIME CREDENTIAL
  // --------------------------------------------------------------------------
  const handleCopyApiKey = () => {
    if (!newCredentialInfo?.apiKey) return;
    navigator.clipboard.writeText(newCredentialInfo.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
  };

  // --------------------------------------------------------------------------
  // VIEW DEVICE DETAIL
  // --------------------------------------------------------------------------
  const handleViewDetail = async (device: DeviceItem) => {
    setSelectedDevice(device);
    setSelectedDeviceDetail(null);
    setIsDetailModalOpen(true);

    try {
      const res = await managementApiService.getDeviceDetail(device.id);
      if (res.success) {
        setSelectedDeviceDetail(res.device);
      }
    } catch (err: any) {
      console.error('Failed to load device detail:', err);
    }
  };

  // --------------------------------------------------------------------------
  // REGISTER DEVICE
  // --------------------------------------------------------------------------
  const handleOpenRegisterModal = () => {
    setRegisterForm({
      name: '',
      deviceIdentifier: '',
      deviceType: 'TURNSTILE',
      location: '',
      description: '',
      isEnabled: true,
      ipAddress: '',
      macAddress: '',
      firmwareVersion: '',
      maintenanceNotes: '',
    });
    setRegisterError(null);
    setIsRegisterModalOpen(true);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    if (!registerForm.name.trim()) {
      setRegisterError('Device name is required.');
      return;
    }
    if (!registerForm.deviceIdentifier.trim()) {
      setRegisterError('Device identifier is required.');
      return;
    }
    if (!registerForm.location.trim()) {
      setRegisterError('Device location is required.');
      return;
    }

    try {
      setRegisterSubmitting(true);
      const res = await managementApiService.createDevice({
        ...registerForm,
        deviceIdentifier: registerForm.deviceIdentifier.trim().toUpperCase(),
      });

      if (res.success) {
        setIsRegisterModalOpen(false);
        setNewCredentialInfo({
          apiKey: res.apiKey,
          warning: res.warning,
          deviceIdentifier: res.device.deviceIdentifier,
        });
        fetchDevices(1);
      } else {
        setRegisterError(res.message || 'Failed to register device.');
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      setRegisterError(err.message || 'Could not register device.');
    } finally {
      setRegisterSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // EDIT DEVICE
  // --------------------------------------------------------------------------
  const handleOpenEditModal = (device: DeviceItem) => {
    setSelectedDevice(device);
    setEditForm({
      name: device.name,
      location: device.location,
      deviceType: device.deviceType,
      description: device.description || '',
      status: device.status,
      isEnabled: device.isEnabled,
      ipAddress: device.ipAddress || '',
      macAddress: device.macAddress || '',
      firmwareVersion: device.firmwareVersion || '',
      maintenanceNotes: device.maintenanceNotes || '',
    });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    setEditError(null);

    try {
      setEditSubmitting(true);
      const res = await managementApiService.updateDevice(selectedDevice.id, editForm);
      if (res.success) {
        setIsEditModalOpen(false);
        fetchDevices(pagination.page);
      } else {
        setEditError(res.message || 'Failed to update device.');
      }
    } catch (err: any) {
      console.error('Update failed:', err);
      setEditError(err.message || 'Could not update device.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // ENABLE / DISABLE TOGGLE
  // --------------------------------------------------------------------------
  const handleToggleEnable = (device: DeviceItem) => {
    setSelectedDevice(device);
    if (device.isEnabled) {
      setIsDisableModalOpen(true);
    } else {
      executeEnableDevice(device.id);
    }
  };

  const executeEnableDevice = async (id: string) => {
    try {
      setActionInProgress(true);
      const res = await managementApiService.enableDevice(id);
      if (res.success) {
        fetchDevices(pagination.page);
      }
    } catch (err: any) {
      alert(`Failed to enable device: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const executeDisableDevice = async () => {
    if (!selectedDevice) return;
    try {
      setActionInProgress(true);
      const res = await managementApiService.disableDevice(selectedDevice.id);
      if (res.success) {
        setIsDisableModalOpen(false);
        fetchDevices(pagination.page);
      }
    } catch (err: any) {
      alert(`Failed to disable device: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // --------------------------------------------------------------------------
  // ROTATE CREDENTIAL
  // --------------------------------------------------------------------------
  const handleOpenRotateModal = (device: DeviceItem) => {
    setSelectedDevice(device);
    setIsRotateModalOpen(true);
  };

  const executeRotateCredential = async () => {
    if (!selectedDevice) return;
    try {
      setActionInProgress(true);
      const res = await managementApiService.rotateDeviceCredential(selectedDevice.id);
      if (res.success) {
        setIsRotateModalOpen(false);
        setNewCredentialInfo({
          apiKey: res.apiKey,
          warning: res.warning,
          deviceIdentifier: res.device.deviceIdentifier,
        });
        fetchDevices(pagination.page);
      }
    } catch (err: any) {
      alert(`Failed to rotate credential: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // --------------------------------------------------------------------------
  // DEVICE ACTIVITY TRAIL
  // --------------------------------------------------------------------------
  const handleViewActivity = async (device: DeviceItem) => {
    setSelectedDevice(device);
    setDeviceActivities([]);
    setIsActivityModalOpen(true);
    setActivityLoading(true);

    try {
      const res = await managementApiService.getDeviceActivity(device.id, 1, 50);
      if (res.success) {
        setDeviceActivities(res.activity);
      }
    } catch (err: any) {
      console.error('Failed to load activity log:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // FORMATTERS
  // --------------------------------------------------------------------------
  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return 'Never / No Record';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="device-management-container" id="device-management-module">
      {/* --------------------------------------------------------------------
         KPI SUMMARY CARDS (6 Authoritative PostgreSQL Metrics)
         -------------------------------------------------------------------- */}
      <div className="device-kpis-grid">
        <div className="device-kpi-card" id="kpi-total-devices">
          <div className="device-kpi-icon total">
            <Cpu size={22} />
          </div>
          <div className="device-kpi-content">
            <span className="device-kpi-label">Total Devices</span>
            <span className="device-kpi-value">{stats.totalDevices}</span>
          </div>
        </div>

        <div className="device-kpi-card" id="kpi-active-devices">
          <div className="device-kpi-icon active">
            <CheckCircle2 size={22} />
          </div>
          <div className="device-kpi-content">
            <span className="device-kpi-label">Active</span>
            <span className="device-kpi-value">{stats.activeDevices}</span>
          </div>
        </div>

        <div className="device-kpi-card" id="kpi-disabled-devices">
          <div className="device-kpi-icon disabled">
            <XCircle size={22} />
          </div>
          <div className="device-kpi-content">
            <span className="device-kpi-label">Disabled</span>
            <span className="device-kpi-value">{stats.disabledDevices}</span>
          </div>
        </div>

        <div className="device-kpi-card" id="kpi-online-devices">
          <div className="device-kpi-icon online">
            <Radio size={22} />
          </div>
          <div className="device-kpi-content">
            <span className="device-kpi-label">Online</span>
            <span className="device-kpi-value">{stats.onlineDevices}</span>
          </div>
        </div>

        <div className="device-kpi-card" id="kpi-offline-devices">
          <div className="device-kpi-icon offline">
            <Clock size={22} />
          </div>
          <div className="device-kpi-content">
            <span className="device-kpi-label">Offline</span>
            <span className="device-kpi-value">{stats.offlineDevices}</span>
          </div>
        </div>

        <div className="device-kpi-card" id="kpi-maintenance-devices">
          <div className="device-kpi-icon maintenance">
            <Wrench size={22} />
          </div>
          <div className="device-kpi-content">
            <span className="device-kpi-label">Maintenance</span>
            <span className="device-kpi-value">{stats.maintenanceDevices}</span>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------
         ONE-TIME CREDENTIAL DISPLAY BANNER (Shown strictly on creation/rotation)
         -------------------------------------------------------------------- */}
      {newCredentialInfo && (
        <div className="credential-alert-banner" id="credential-display-banner">
          <div className="credential-alert-header">
            <div className="credential-alert-title">
              <ShieldAlert size={20} />
              <span>CONFIDENTIAL: Device Access Key Generated ({newCredentialInfo.deviceIdentifier})</span>
            </div>
            <button
              className="device-modal-close-btn"
              onClick={() => setNewCredentialInfo(null)}
              title="Dismiss warning"
            >
              <X size={18} />
            </button>
          </div>
          <p className="credential-alert-text">{newCredentialInfo.warning}</p>
          <div className="credential-key-box">
            <span className="credential-key-code">{newCredentialInfo.apiKey}</span>
            <button className="credential-copy-btn" onClick={handleCopyApiKey} id="btn-copy-device-key">
              {copiedKey ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedKey ? 'Copied to Clipboard' : 'Copy Key'}</span>
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
         FILTER TOOLBAR
         -------------------------------------------------------------------- */}
      <div className="device-toolbar-card">
        <div className="device-toolbar-row">
          <div className="device-search-wrapper">
            <Search className="device-search-icon" size={18} />
            <input
              type="text"
              className="device-search-input"
              placeholder="Search by device name, identifier, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              id="device-search-input"
            />
          </div>

          <div className="device-filters-group">
            <select
              className="device-filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              id="filter-device-type"
            >
              <option value="ALL">All Device Types</option>
              <option value="TURNSTILE">Turnstile</option>
              <option value="BIOMETRIC">Biometric Terminal</option>
              <option value="GATE_READER">Gate Reader</option>
              <option value="RFID">RFID Controller</option>
              <option value="OTHER">Other</option>
            </select>

            <select
              className="device-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              id="filter-device-status"
            >
              <option value="ALL">All Statuses</option>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="DISABLED">Disabled</option>
            </select>

            <select
              className="device-filter-select"
              value={enabledFilter}
              onChange={(e) => setEnabledFilter(e.target.value)}
              id="filter-device-enabled"
            >
              <option value="ALL">All States</option>
              <option value="true">Enabled Only</option>
              <option value="false">Disabled Only</option>
            </select>

            <button className="device-btn-secondary" onClick={handleApplyFilters} id="btn-apply-filters">
              <Filter size={16} />
              <span>Apply</span>
            </button>

            <button className="device-btn-secondary" onClick={handleClearFilters} id="btn-clear-filters">
              <span>Reset</span>
            </button>

            <button
              className="device-btn-secondary"
              onClick={() => fetchDevices(pagination.page)}
              title="Refresh Authoritative Data"
              id="btn-refresh-devices"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>

            <button
              className="device-action-btn-primary"
              onClick={handleOpenRegisterModal}
              id="btn-register-device"
            >
              <Plus size={18} />
              <span>Register Device</span>
            </button>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------
         ERROR NOTICE
         -------------------------------------------------------------------- */}
      {error && (
        <div className="credential-alert-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', borderLeftColor: '#ef4444' }}>
          <div className="credential-alert-header">
            <div className="credential-alert-title" style={{ color: '#991b1b' }}>
              <AlertTriangle size={20} />
              <span>Error Loading Device Registry</span>
            </div>
          </div>
          <p className="credential-alert-text" style={{ color: '#b91c1c' }}>{error}</p>
        </div>
      )}

      {/* --------------------------------------------------------------------
         DESKTOP TABLE & MOBILE STACKED CARDS
         -------------------------------------------------------------------- */}
      <div className="device-table-card">
        {/* Desktop View Table */}
        <div className="device-table-wrapper">
          <table className="device-table" id="device-registry-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Identifier</th>
                <th>Type</th>
                <th>Location</th>
                <th>Status</th>
                <th>Last Communication</th>
                <th>Enabled</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                    {isLoading ? 'Loading authoritative device registry...' : 'No hardware devices found matching criteria.'}
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id} id={`device-row-${device.id}`}>
                    <td>
                      <div className="device-cell-name">
                        <span className="device-name-text">{device.name}</span>
                        {device.description && (
                          <span className="device-desc-subtext" title={device.description}>
                            {device.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="device-identifier-tag">{device.deviceIdentifier}</span>
                    </td>
                    <td>
                      <span className={`device-type-badge ${device.deviceType.toLowerCase()}`}>
                        {device.deviceType.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MapPin size={14} color="#64748b" />
                        <span>{device.location}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`device-status-badge ${device.status.toLowerCase()}`}>
                        <span className="device-status-dot" />
                        <span>{device.status}</span>
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: '#475569' }}>
                        {formatDateTime(device.lastSeenAt)}
                      </span>
                    </td>
                    <td>
                      <span className={`device-enabled-pill ${device.isEnabled ? 'active' : 'inactive'}`}>
                        {device.isEnabled ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="device-row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="device-table-action-btn"
                          onClick={() => handleViewDetail(device)}
                          title="View Device Details & Telemetry"
                          id={`btn-view-${device.id}`}
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>

                        <button
                          className="device-table-action-btn"
                          onClick={() => handleOpenEditModal(device)}
                          title="Edit Safe Attributes"
                          id={`btn-edit-${device.id}`}
                        >
                          <Edit2 size={14} />
                          <span>Edit</span>
                        </button>

                        <button
                          className={`device-table-action-btn ${device.isEnabled ? 'danger' : 'success'}`}
                          onClick={() => handleToggleEnable(device)}
                          title={device.isEnabled ? 'Disable Device' : 'Enable Device'}
                          id={`btn-toggle-enable-${device.id}`}
                        >
                          <Power size={14} />
                          <span>{device.isEnabled ? 'Disable' : 'Enable'}</span>
                        </button>

                        <button
                          className="device-table-action-btn"
                          onClick={() => handleOpenRotateModal(device)}
                          title="Rotate Security API Key"
                          id={`btn-rotate-${device.id}`}
                        >
                          <KeyRound size={14} />
                          <span>Rotate Key</span>
                        </button>

                        <button
                          className="device-table-action-btn"
                          onClick={() => handleViewActivity(device)}
                          title="View Audit Activity Trail"
                          id={`btn-activity-${device.id}`}
                        >
                          <History size={14} />
                          <span>Activity</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Stacked Responsive Cards (<= 768px) */}
        <div className="device-mobile-cards-list">
          {devices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
              {isLoading ? 'Loading devices...' : 'No devices found.'}
            </div>
          ) : (
            devices.map((device) => (
              <div className="device-mobile-card" key={`mobile-${device.id}`} id={`mobile-card-${device.id}`}>
                <div className="device-mobile-header">
                  <div className="device-mobile-title-block">
                    <span className="device-mobile-name">{device.name}</span>
                    <span className="device-identifier-tag">{device.deviceIdentifier}</span>
                  </div>
                  <span className={`device-status-badge ${device.status.toLowerCase()}`}>
                    <span className="device-status-dot" />
                    <span>{device.status}</span>
                  </span>
                </div>

                <div className="device-mobile-meta-row">
                  <span className="device-mobile-label">Type</span>
                  <span className={`device-type-badge ${device.deviceType.toLowerCase()}`}>
                    {device.deviceType.replace('_', ' ')}
                  </span>
                </div>

                <div className="device-mobile-meta-row">
                  <span className="device-mobile-label">Location</span>
                  <span className="device-mobile-val">{device.location}</span>
                </div>

                <div className="device-mobile-meta-row">
                  <span className="device-mobile-label">Last Communication</span>
                  <span className="device-mobile-val">{formatDateTime(device.lastSeenAt)}</span>
                </div>

                <div className="device-mobile-meta-row">
                  <span className="device-mobile-label">State</span>
                  <span className={`device-enabled-pill ${device.isEnabled ? 'active' : 'inactive'}`}>
                    {device.isEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>

                <div className="device-mobile-actions-row">
                  <button className="device-mobile-action-btn" onClick={() => handleViewDetail(device)}>
                    <Eye size={16} />
                    <span>Details</span>
                  </button>

                  <button className="device-mobile-action-btn" onClick={() => handleOpenEditModal(device)}>
                    <Edit2 size={16} />
                    <span>Edit</span>
                  </button>

                  <button
                    className={`device-mobile-action-btn ${device.isEnabled ? 'danger' : 'success'}`}
                    onClick={() => handleToggleEnable(device)}
                  >
                    <Power size={16} />
                    <span>{device.isEnabled ? 'Disable' : 'Enable'}</span>
                  </button>

                  <button className="device-mobile-action-btn" onClick={() => handleOpenRotateModal(device)}>
                    <KeyRound size={16} />
                    <span>Key</span>
                  </button>

                  <button className="device-mobile-action-btn" onClick={() => handleViewActivity(device)}>
                    <History size={16} />
                    <span>Audit</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bounded Pagination Footer */}
        <div className="device-pagination-footer">
          <span>
            Showing{' '}
            <strong>
              {devices.length === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong>
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </strong>{' '}
            of <strong>{pagination.total}</strong> registered devices
          </span>

          <div className="device-pagination-controls">
            <button
              className="device-page-btn"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              id="btn-prev-page"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.84375rem', fontWeight: 600 }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              className="device-page-btn"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              id="btn-next-page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
         MODAL 1: REGISTER DEVICE
         ==================================================================== */}
      {isRegisterModalOpen && (
        <div className="device-modal-overlay" onClick={() => setIsRegisterModalOpen(false)}>
          <div className="device-modal-container" onClick={(e) => e.stopPropagation()} id="modal-register-device">
            <div className="device-modal-header">
              <h3 className="device-modal-title">
                <Cpu size={20} />
                <span>Register Hardware Device</span>
              </h3>
              <button className="device-modal-close-btn" onClick={() => setIsRegisterModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit}>
              <div className="device-modal-body">
                {registerError && (
                  <div className="credential-alert-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', borderLeftColor: '#ef4444' }}>
                    <p className="credential-alert-text" style={{ color: '#991b1b' }}>{registerError}</p>
                  </div>
                )}

                <div className="device-form-grid">
                  <div className="device-form-field">
                    <label className="device-form-label">
                      Device Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="device-form-input"
                      placeholder="e.g. Main Gate Entry Turnstile"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      required
                      id="input-device-name"
                    />
                  </div>

                  <div className="device-form-field">
                    <label className="device-form-label">
                      Device Identifier <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="device-form-input"
                      placeholder="e.g. DEV-GATE-04"
                      value={registerForm.deviceIdentifier}
                      onChange={(e) =>
                        setRegisterForm({
                          ...registerForm,
                          deviceIdentifier: e.target.value.toUpperCase(),
                        })
                      }
                      required
                      id="input-device-identifier"
                    />
                  </div>

                  <div className="device-form-field">
                    <label className="device-form-label">
                      Device Type <span className="required">*</span>
                    </label>
                    <select
                      className="device-form-select"
                      value={registerForm.deviceType}
                      onChange={(e) => setRegisterForm({ ...registerForm, deviceType: e.target.value })}
                      required
                      id="select-device-type"
                    >
                      <option value="TURNSTILE">Turnstile</option>
                      <option value="BIOMETRIC">Biometric Terminal</option>
                      <option value="GATE_READER">Gate Reader</option>
                      <option value="RFID">RFID Controller</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="device-form-field">
                    <label className="device-form-label">
                      Location / Perimeter Gate <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="device-form-input"
                      placeholder="e.g. Hostel Main Gate"
                      value={registerForm.location}
                      onChange={(e) => setRegisterForm({ ...registerForm, location: e.target.value })}
                      required
                      id="input-device-location"
                    />
                  </div>

                  <div className="device-form-field">
                    <label className="device-form-label">IP Address</label>
                    <input
                      type="text"
                      className="device-form-input"
                      placeholder="e.g. 192.168.10.104"
                      value={registerForm.ipAddress || ''}
                      onChange={(e) => setRegisterForm({ ...registerForm, ipAddress: e.target.value })}
                      id="input-device-ip"
                    />
                  </div>

                  <div className="device-form-field">
                    <label className="device-form-label">MAC Address</label>
                    <input
                      type="text"
                      className="device-form-input"
                      placeholder="e.g. 00:1B:44:11:3A:C5"
                      value={registerForm.macAddress || ''}
                      onChange={(e) => setRegisterForm({ ...registerForm, macAddress: e.target.value })}
                      id="input-device-mac"
                    />
                  </div>

                  <div className="device-form-field full-width">
                    <label className="device-form-label">Firmware Version</label>
                    <input
                      type="text"
                      className="device-form-input"
                      placeholder="e.g. v2.4.15-build-82"
                      value={registerForm.firmwareVersion || ''}
                      onChange={(e) => setRegisterForm({ ...registerForm, firmwareVersion: e.target.value })}
                      id="input-device-firmware"
                    />
                  </div>

                  <div className="device-form-field full-width">
                    <label className="device-form-label">Description / Functional Notes</label>
                    <textarea
                      className="device-form-textarea"
                      placeholder="Operational purpose, connected relay, or zone information..."
                      value={registerForm.description || ''}
                      onChange={(e) => setRegisterForm({ ...registerForm, description: e.target.value })}
                      id="input-device-description"
                    />
                  </div>

                  <div className="device-form-field full-width">
                    <label className="device-checkbox-label">
                      <input
                        type="checkbox"
                        checked={registerForm.isEnabled}
                        onChange={(e) => setRegisterForm({ ...registerForm, isEnabled: e.target.checked })}
                        id="checkbox-device-enabled"
                      />
                      <span>Enable device immediately upon provisioning</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="device-modal-footer">
                <button
                  type="button"
                  className="device-btn-secondary"
                  onClick={() => setIsRegisterModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="device-action-btn-primary"
                  disabled={registerSubmitting}
                  id="btn-submit-register"
                >
                  {registerSubmitting ? 'Registering...' : 'Provision & Generate Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
         MODAL 2: EDIT DEVICE
         ==================================================================== */}
      {isEditModalOpen && selectedDevice && (
        <div className="device-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="device-modal-container" onClick={(e) => e.stopPropagation()} id="modal-edit-device">
            <div className="device-modal-header">
              <h3 className="device-modal-title">
                <Edit2 size={20} />
                <span>Edit Device ({selectedDevice.deviceIdentifier})</span>
              </h3>
              <button className="device-modal-close-btn" onClick={() => setIsEditModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="device-modal-body">
                {editError && (
                  <div className="credential-alert-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', borderLeftColor: '#ef4444' }}>
                    <p className="credential-alert-text" style={{ color: '#991b1b' }}>{editError}</p>
                  </div>
                )}

                <div className="device-form-grid">
                  <div className="device-form-field full-width">
                    <label className="device-form-label">Device Name</label>
                    <input
                      type="text"
                      className="device-form-input"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      required
                      id="edit-device-name"
                    />
                  </div>

                  <div className="device-form-field">
                    <label className="device-form-label">Location</label>
                    <input
                      type="text"
                      className="device-form-input"
                      value={editForm.location || ''}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      required
                      id="edit-device-location"
                    />
                  </div>

                  <div className="device-form-field">
                    <label className="device-form-label">Operational Status</label>
                    <select
                      className="device-form-select"
                      value={editForm.status || 'ONLINE'}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      id="edit-device-status"
                    >
                      <option value="ONLINE">Online</option>
                      <option value="OFFLINE">Offline</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="DISABLED">Disabled</option>
                    </select>
                  </div>

                  <div className="device-form-field">
                    <label className="device-form-label">IP Address</label>
                    <input
                      type="text"
                      className="device-form-input"
                      value={editForm.ipAddress || ''}
                      onChange={(e) => setEditForm({ ...editForm, ipAddress: e.target.value })}
                      id="edit-device-ip"
                    />
                  </div>

                  <div className="device-form-field">
                    <label className="device-form-label">Firmware Version</label>
                    <input
                      type="text"
                      className="device-form-input"
                      value={editForm.firmwareVersion || ''}
                      onChange={(e) => setEditForm({ ...editForm, firmwareVersion: e.target.value })}
                      id="edit-device-firmware"
                    />
                  </div>

                  <div className="device-form-field full-width">
                    <label className="device-form-label">Maintenance Notes</label>
                    <textarea
                      className="device-form-textarea"
                      placeholder="Notes regarding recent sensor cleaning, antenna tuning, or repairs..."
                      value={editForm.maintenanceNotes || ''}
                      onChange={(e) => setEditForm({ ...editForm, maintenanceNotes: e.target.value })}
                      id="edit-device-notes"
                    />
                  </div>

                  <div className="device-form-field full-width">
                    <label className="device-checkbox-label">
                      <input
                        type="checkbox"
                        checked={editForm.isEnabled}
                        onChange={(e) => setEditForm({ ...editForm, isEnabled: e.target.checked })}
                        id="edit-device-checkbox-enabled"
                      />
                      <span>Device is administratively enabled</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="device-modal-footer">
                <button
                  type="button"
                  className="device-btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="device-action-btn-primary"
                  disabled={editSubmitting}
                  id="btn-submit-edit"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
         MODAL 3: DEVICE DETAIL & TELEMETRY VIEW
         ==================================================================== */}
      {isDetailModalOpen && selectedDevice && (
        <div className="device-modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
          <div className="device-modal-container wide" onClick={(e) => e.stopPropagation()} id="modal-device-detail">
            <div className="device-modal-header">
              <h3 className="device-modal-title">
                <Eye size={20} />
                <span>Device Details: {selectedDevice.name}</span>
              </h3>
              <button className="device-modal-close-btn" onClick={() => setIsDetailModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="device-modal-body">
              <div className="device-detail-sections">
                {/* 1. Identity & Operational Status */}
                <div className="device-detail-section-card">
                  <div className="device-detail-section-title">
                    <Cpu size={16} />
                    <span>Identity & Operational State</span>
                  </div>
                  <div className="device-detail-grid">
                    <div className="device-detail-item">
                      <span className="device-detail-item-label">Device Identifier</span>
                      <span className="device-detail-item-value mono">{selectedDevice.deviceIdentifier}</span>
                    </div>
                    <div className="device-detail-item">
                      <span className="device-detail-item-label">Status</span>
                      <span className={`device-status-badge ${selectedDevice.status.toLowerCase()}`}>
                        <span className="device-status-dot" />
                        <span>{selectedDevice.status}</span>
                      </span>
                    </div>
                    <div className="device-detail-item">
                      <span className="device-detail-item-label">Device Type</span>
                      <span className="device-detail-item-value">{selectedDevice.deviceType}</span>
                    </div>
                    <div className="device-detail-item">
                      <span className="device-detail-item-label">Location / Perimeter Gate</span>
                      <span className="device-detail-item-value">{selectedDevice.location}</span>
                    </div>
                    <div className="device-detail-item">
                      <span className="device-detail-item-label">Administrative State</span>
                      <span className={`device-enabled-pill ${selectedDevice.isEnabled ? 'active' : 'inactive'}`}>
                        {selectedDevice.isEnabled ? 'ACTIVE & ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <div className="device-detail-item">
                      <span className="device-detail-item-label">Last Communication</span>
                      <span className="device-detail-item-value">{formatDateTime(selectedDevice.lastSeenAt)}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Biometric Correlated Telemetry */}
                <div className="device-detail-section-card">
                  <div className="device-detail-section-title">
                    <Activity size={16} />
                    <span>Biometric Event Telemetry</span>
                  </div>
                  {selectedDeviceDetail?.telemetry ? (
                    <div className="telemetry-stat-pills">
                      <div className="telemetry-pill">
                        <span className="telemetry-pill-val">
                          {selectedDeviceDetail.telemetry.totalEvents}
                        </span>
                        <span className="telemetry-pill-label">Total Ingestion Hits</span>
                      </div>
                      <div className="telemetry-pill">
                        <span className="telemetry-pill-val" style={{ color: '#16a34a' }}>
                          {selectedDeviceDetail.telemetry.verifiedEvents}
                        </span>
                        <span className="telemetry-pill-label">Verified Access Scans</span>
                      </div>
                      <div className="telemetry-pill">
                        <span className="telemetry-pill-val" style={{ color: '#dc2626' }}>
                          {selectedDeviceDetail.telemetry.rejectedEvents}
                        </span>
                        <span className="telemetry-pill-label">Rejected / Mismatches</span>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading telemetry...</p>
                  )}
                </div>

                {/* 3. Hardware & Network Configuration */}
                <div className="device-detail-section-card">
                  <div className="device-detail-section-title">
                    <Network size={16} />
                    <span>Network & Hardware Configuration</span>
                  </div>
                  <div className="device-detail-grid">
                    <div className="device-detail-item">
                      <span className="device-detail-item-label">IP Address</span>
                      <span className="device-detail-item-value mono">
                        {selectedDevice.ipAddress || 'Not Assigned'}
                      </span>
                    </div>
                    <div className="device-detail-item">
                      <span className="device-detail-item-label">MAC Address</span>
                      <span className="device-detail-item-value mono">
                        {selectedDevice.macAddress || 'Not Recorded'}
                      </span>
                    </div>
                    <div className="device-detail-item">
                      <span className="device-detail-item-label">Firmware Version</span>
                      <span className="device-detail-item-value">
                        {selectedDevice.firmwareVersion || 'Standard Base'}
                      </span>
                    </div>
                    <div className="device-detail-item">
                      <span className="device-detail-item-label">Provisioned At</span>
                      <span className="device-detail-item-value">
                        {formatDateTime(selectedDevice.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Security & Cryptographic Key Metadata */}
                <div className="device-detail-section-card">
                  <div className="device-detail-section-title">
                    <KeyRound size={16} />
                    <span>Security & Credential Lifecycle</span>
                  </div>
                  <div className="device-detail-grid">
                    <div className="device-detail-item">
                      <span className="device-detail-item-label">API Key Status</span>
                      <span className="device-detail-item-value" style={{ color: '#16a34a' }}>
                        {selectedDevice.hasApiKey ? 'Active (SHA-256 Hashed)' : 'Missing'}
                      </span>
                    </div>
                    <div className="device-detail-item">
                      <span className="device-detail-item-label">Secret Representation</span>
                      <span className="device-detail-item-value mono" style={{ color: '#64748b' }}>
                        •••••••••••••••••••••••••••••••• (Protected)
                      </span>
                    </div>
                    <div className="device-detail-item full-width">
                      <span className="device-detail-item-label">Last Key Rotation</span>
                      <span className="device-detail-item-value">
                        {formatDateTime(selectedDevice.keyLastRotatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="device-modal-footer">
              <button
                className="device-action-btn-primary"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
         MODAL 4: CONFIRM DISABLE DEVICE
         ==================================================================== */}
      {isDisableModalOpen && selectedDevice && (
        <div className="device-modal-overlay" onClick={() => setIsDisableModalOpen(false)}>
          <div className="device-modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="device-modal-header">
              <h3 className="device-modal-title" style={{ color: '#dc2626' }}>
                <AlertTriangle size={20} />
                <span>Disable Device</span>
              </h3>
              <button className="device-modal-close-btn" onClick={() => setIsDisableModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="device-modal-body">
              <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.5, margin: 0 }}>
                Are you sure you want to administratively disable{' '}
                <strong>{selectedDevice.name}</strong> ({selectedDevice.deviceIdentifier})?
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.4, margin: 0 }}>
                Historical biometric scans and outing transit logs will remain preserved. The device
                will not process entry/exit authorizations until re-enabled.
              </p>
            </div>

            <div className="device-modal-footer">
              <button
                className="device-btn-secondary"
                onClick={() => setIsDisableModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="device-action-btn-primary"
                style={{ background: '#dc2626' }}
                onClick={executeDisableDevice}
                disabled={actionInProgress}
                id="btn-confirm-disable"
              >
                {actionInProgress ? 'Disabling...' : 'Confirm Disable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
         MODAL 5: ROTATE CREDENTIAL CONFIRMATION
         ==================================================================== */}
      {isRotateModalOpen && selectedDevice && (
        <div className="device-modal-overlay" onClick={() => setIsRotateModalOpen(false)}>
          <div className="device-modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="device-modal-header">
              <h3 className="device-modal-title" style={{ color: '#d97706' }}>
                <KeyRound size={20} />
                <span>Rotate Security Key</span>
              </h3>
              <button className="device-modal-close-btn" onClick={() => setIsRotateModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="device-modal-body">
              <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.5, margin: 0 }}>
                You are about to regenerate the API key for{' '}
                <strong>{selectedDevice.name}</strong> ({selectedDevice.deviceIdentifier}).
              </p>
              <div className="credential-alert-banner" style={{ margin: 0 }}>
                <div className="credential-alert-title" style={{ fontSize: '0.875rem' }}>
                  <ShieldAlert size={18} />
                  <span>Immediate Invalidation Notice</span>
                </div>
                <p className="credential-alert-text">
                  The current key will immediately stop working. The turnstile/biometric controller must
                  be updated with the new key right away.
                </p>
              </div>
            </div>

            <div className="device-modal-footer">
              <button
                className="device-btn-secondary"
                onClick={() => setIsRotateModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="device-action-btn-primary"
                style={{ background: '#d97706' }}
                onClick={executeRotateCredential}
                disabled={actionInProgress}
                id="btn-confirm-rotate"
              >
                {actionInProgress ? 'Rotating...' : 'Generate New Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
         MODAL 6: DEVICE ACTIVITY AUDIT TRAIL
         ==================================================================== */}
      {isActivityModalOpen && selectedDevice && (
        <div className="device-modal-overlay" onClick={() => setIsActivityModalOpen(false)}>
          <div className="device-modal-container wide" onClick={(e) => e.stopPropagation()} id="modal-device-activity">
            <div className="device-modal-header">
              <h3 className="device-modal-title">
                <History size={20} />
                <span>Audit Trail: {selectedDevice.name}</span>
              </h3>
              <button className="device-modal-close-btn" onClick={() => setIsActivityModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="device-modal-body">
              {activityLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                  Loading authoritative audit trail...
                </div>
              ) : deviceActivities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                  No historical activity logs recorded for this device.
                </div>
              ) : (
                <div className="device-activity-list">
                  {deviceActivities.map((act) => (
                    <div
                      key={act.id}
                      className={`device-activity-card ${act.action || ''}`}
                    >
                      <div className="device-activity-head">
                        <span className="device-activity-action">{act.action}</span>
                        <span className="device-activity-time">{formatDateTime(act.createdAt)}</span>
                      </div>
                      <span className="device-activity-desc">{act.description}</span>
                      <span className="device-activity-actor">
                        Actor: {act.performedBy} ({act.userRole})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="device-modal-footer">
              <button
                className="device-action-btn-primary"
                onClick={() => setIsActivityModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagementDevicePage;
