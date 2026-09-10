import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  BedDouble,
  Footprints,
  FileText,
  AlertCircle,
  ShieldAlert,
  Clock,
  Fingerprint,
  RotateCw,
  Lock,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import {
  managementApiService,
  ManagementDashboardData,
  AttentionItem,
} from '../services/api';

interface ManagementDashboardPageProps {
  onModuleNotice?: (moduleName: string) => void;
  onRefreshStateChange?: (isRefreshing: boolean, isConnected: boolean) => void;
  registerRefreshHandler?: (refreshFn: () => void) => void;
}

export const ManagementDashboardPage: React.FC<ManagementDashboardPageProps> = ({
  onModuleNotice,
  onRefreshStateChange,
  registerRefreshHandler,
}) => {
  const [data, setData] = useState<ManagementDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'activity' | 'biometrics'>('activity');

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
      onRefreshStateChange?.(true, isRealtimeConnected);
    }
    setError(null);

    try {
      const response = await managementApiService.getDashboard();
      setData(response);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error('Failed to load admin dashboard:', err);
      setError(err.message || 'Unable to load administration metrics. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      onRefreshStateChange?.(false, isRealtimeConnected);
    }
  }, [onRefreshStateChange, isRealtimeConnected]);

  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  // Register manual refresh handler with parent layout
  useEffect(() => {
    if (registerRefreshHandler) {
      registerRefreshHandler(() => fetchDashboardData(true));
    }
  }, [registerRefreshHandler, fetchDashboardData]);

  // Real-time SSE: Domain change → DB → SSE → Refetch → UI
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents(
      (_event) => {
        fetchDashboardData(true);
      },
      (connected) => {
        setIsRealtimeConnected(connected);
        onRefreshStateChange?.(isRefreshing, connected);
      }
    );
    return () => unsubscribe();
  }, [fetchDashboardData, onRefreshStateChange, isRefreshing]);

  const handleAttentionClick = (item: AttentionItem) => {
    if (!item.isAvailable && onModuleNotice) {
      onModuleNotice(item.targetModule);
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return dateStr; }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  };

  // Loading skeleton
  if (isLoading && !data) {
    return (
      <div className="management-dashboard-view" aria-busy="true">
        <div className="mgmt-loading-hero skeleton-block" />
        <div className="mgmt-kpi-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="mgmt-kpi-card skeleton-card" />
          ))}
        </div>
        <div className="mgmt-analytics-grid">
          <div className="mgmt-card skeleton-panel" />
          <div className="mgmt-card skeleton-panel" />
        </div>
        <div className="mgmt-card skeleton-panel" style={{ height: '240px' }} />
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="management-dashboard-view">
        <div className="mgmt-error-card" role="alert">
          <AlertCircle size={40} className="mgmt-error-icon" />
          <h2 className="mgmt-error-title">Unable to Load Operational Dashboard</h2>
          <p className="mgmt-error-msg">{error}</p>
          <button
            type="button"
            onClick={() => fetchDashboardData(false)}
            className="btn-primary"
            style={{ marginTop: '1rem' }}
          >
            <RotateCw size={16} style={{ marginRight: '6px' }} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Use correct field names from backend
  const residents = data.residents;
  const rooms = data.rooms;
  const requests = data.requests;
  const attentionItems = data.attention || [];
  const recentActivity = data.recentActivity || [];
  const recentBiometricLogs = data.recentBiometricEvents || [];

  // Room occupancy donut chart values
  const totalR = rooms.totalRooms || 1;
  const occupiedPct = Math.round(((rooms.occupied || 0) / totalR) * 100);
  const partialPct = Math.round(((rooms.partiallyOccupied || 0) / totalR) * 100);
  const vacantPct = Math.max(0, 100 - occupiedPct - partialPct);

  // SVG donut circumference = 2 * PI * r40 ≈ 251.2
  const circ = 251.2;
  const strokeOccupied = (occupiedPct / 100) * circ;
  const strokePartial = (partialPct / 100) * circ;
  const strokeVacant = (vacantPct / 100) * circ;

  // Resident presence bar percentages
  const totalRes = residents.totalResidents || 1;
  const insidePct = Math.round((residents.currentlyInside / totalRes) * 100);
  const outsidePct = Math.round((residents.currentlyOutside / totalRes) * 100);
  const onLeavePct = Math.round((residents.onLeave / totalRes) * 100);
  const suspendedPct = Math.round((residents.suspended / totalRes) * 100);

  return (
    <div className="management-dashboard-view">
      {/* Operational Meta Bar */}
      <div className="mgmt-meta-bar">
        <div className="mgmt-meta-left">
          <span className="mgmt-meta-badge">
            <Activity size={13} />
            PostgreSQL Authoritative
          </span>
          {data.systemStatus && (
            <span className="mgmt-meta-text">
              DB: <strong>{data.systemStatus.database}</strong> •
              Biometric: <strong>{data.systemStatus.biometricSync}</strong>
            </span>
          )}
        </div>
        <div className="mgmt-meta-right">
          {lastRefreshedAt && (
            <span className="mgmt-sync-time">
              Synced at {lastRefreshedAt.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="mgmt-inline-refresh"
            title="Fetch authoritative counts from PostgreSQL"
          >
            <RotateCw size={13} className={isRefreshing ? 'spin-anim' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* 8 KPI Cards */}
      <section className="mgmt-kpi-grid" aria-label="Key Operational Indicators">
        <div className="mgmt-kpi-card card-blue">
          <div className="mgmt-kpi-header">
            <span className="mgmt-kpi-label">Total Residents</span>
            <div className="mgmt-kpi-icon-wrap icon-blue"><Users size={18} /></div>
          </div>
          <div className="mgmt-kpi-value">{residents.totalResidents}</div>
          <div className="mgmt-kpi-context">{residents.activeResidents} active bed allocations</div>
        </div>

        <div className="mgmt-kpi-card card-emerald">
          <div className="mgmt-kpi-header">
            <span className="mgmt-kpi-label">Currently Inside</span>
            <div className="mgmt-kpi-icon-wrap icon-emerald"><UserCheck size={18} /></div>
          </div>
          <div className="mgmt-kpi-value">{residents.currentlyInside}</div>
          <div className="mgmt-kpi-context">
            <span className="text-emerald">{insidePct}% of residents</span>
          </div>
        </div>

        <div className="mgmt-kpi-card card-amber">
          <div className="mgmt-kpi-header">
            <span className="mgmt-kpi-label">Currently Outside</span>
            <div className="mgmt-kpi-icon-wrap icon-amber"><UserX size={18} /></div>
          </div>
          <div className="mgmt-kpi-value">{residents.currentlyOutside}</div>
          <div className="mgmt-kpi-context">{requests.outOutings} on active gate pass</div>
        </div>

        <div className="mgmt-kpi-card card-indigo">
          <div className="mgmt-kpi-header">
            <span className="mgmt-kpi-label">Room Occupancy</span>
            <div className="mgmt-kpi-icon-wrap icon-indigo"><BedDouble size={18} /></div>
          </div>
          <div className="mgmt-kpi-value">{rooms.occupancyPercentage}%</div>
          <div className="mgmt-kpi-context">{rooms.allocatedBeds} / {rooms.totalCapacity} beds filled</div>
        </div>

        <div className="mgmt-kpi-card card-teal">
          <div className="mgmt-kpi-header">
            <span className="mgmt-kpi-label">Pending Outings</span>
            <div className="mgmt-kpi-icon-wrap icon-teal"><Footprints size={18} /></div>
          </div>
          <div className="mgmt-kpi-value">{requests.pendingOutings}</div>
          <div className="mgmt-kpi-context">
            <span className={requests.pendingOutings > 0 ? 'text-amber' : 'text-slate'}>
              {requests.pendingOutings > 0 ? 'Action required' : 'All caught up'}
            </span>
          </div>
        </div>

        <div className="mgmt-kpi-card card-violet">
          <div className="mgmt-kpi-header">
            <span className="mgmt-kpi-label">Pending Leaves</span>
            <div className="mgmt-kpi-icon-wrap icon-violet"><FileText size={18} /></div>
          </div>
          <div className="mgmt-kpi-value">{requests.pendingLeaves}</div>
          <div className="mgmt-kpi-context">{requests.activeLeaves} on active leave</div>
        </div>

        <div className="mgmt-kpi-card card-rose">
          <div className="mgmt-kpi-header">
            <span className="mgmt-kpi-label">Open Complaints</span>
            <div className="mgmt-kpi-icon-wrap icon-rose"><AlertCircle size={18} /></div>
          </div>
          <div className="mgmt-kpi-value">{requests.openComplaints}</div>
          <div className="mgmt-kpi-context">{requests.inProgressComplaints} in progress</div>
        </div>

        <div className="mgmt-kpi-card card-crimson">
          <div className="mgmt-kpi-header">
            <span className="mgmt-kpi-label">Suspended</span>
            <div className="mgmt-kpi-icon-wrap icon-crimson"><ShieldAlert size={18} /></div>
          </div>
          <div className="mgmt-kpi-value">{residents.suspended}</div>
          <div className="mgmt-kpi-context">
            <span className={residents.suspended > 0 ? 'text-crimson font-medium' : 'text-slate'}>
              {residents.suspended > 0 ? 'Restricted access' : 'No active suspensions'}
            </span>
          </div>
        </div>
      </section>

      {/* Requires Attention Section */}
      <section className="mgmt-section" aria-label="Actionable Operational Items">
        <div className="mgmt-section-header">
          <div>
            <h2 className="mgmt-section-title">Requires Attention</h2>
            <p className="mgmt-section-subtitle">Items requiring administrative review or action</p>
          </div>
          <span className="mgmt-attention-count-badge">{requests.actionableTotal} items</span>
        </div>

        {attentionItems.length === 0 ? (
          <div className="mgmt-empty-attention">
            <CheckCircle2 size={32} className="text-emerald" />
            <p className="mgmt-empty-title">All Caught Up</p>
            <p className="mgmt-empty-desc">No pending items requiring immediate attention.</p>
          </div>
        ) : (
          <div className="mgmt-attention-grid">
            {attentionItems.map((item) => {
              const urgencyClass =
                item.urgency === 'URGENT' ? 'severity-urgent'
                : item.urgency === 'HIGH' ? 'severity-high'
                : item.urgency === 'MEDIUM' ? 'severity-medium'
                : 'severity-low';

              return (
                <div
                  key={item.id}
                  onClick={() => handleAttentionClick(item)}
                  className={`mgmt-attention-card ${urgencyClass} ${!item.isAvailable ? 'disabled-target' : ''}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAttentionClick(item)}
                  title={!item.isAvailable ? `${item.targetModule} is scheduled for a future module` : item.title}
                >
                  <div className="mgmt-attention-header">
                    <span className={`mgmt-severity-pill ${urgencyClass}`}>{item.urgency}</span>
                    <span className="mgmt-attention-module-tag">
                      {!item.isAvailable && <Lock size={11} style={{ marginRight: 3 }} />}
                      {item.category}
                    </span>
                  </div>
                  <div className="mgmt-attention-body">
                    <div className="mgmt-attention-count">{item.count}</div>
                    <div className="mgmt-attention-label">{item.title}</div>
                    {item.description && (
                      <div className="mgmt-attention-desc">{item.description}</div>
                    )}
                  </div>
                  <div className="mgmt-attention-footer">
                    <span className="mgmt-target-note">
                      {!item.isAvailable ? 'Module scheduled' : 'Review items'}
                    </span>
                    <ArrowUpRight size={14} className="mgmt-target-arrow" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Visual Analytics Grid */}
      <section className="mgmt-analytics-grid" aria-label="Visual Analytics">
        {/* Room Occupancy Donut */}
        <div className="mgmt-card analytics-card">
          <div className="mgmt-card-header">
            <div>
              <h3 className="mgmt-card-title">Room Occupancy Breakdown</h3>
              <p className="mgmt-card-subtitle">Authoritative bed and room allocations from PostgreSQL</p>
            </div>
            <span className="badge-pill">{rooms.totalRooms} total rooms</span>
          </div>

          <div className="mgmt-donut-container">
            <div className="donut-chart-wrapper">
              <svg width="140" height="140" viewBox="0 0 100 100" className="donut-chart">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="12" />
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#E2E8F0" strokeWidth="12"
                  strokeDasharray={`${strokeVacant} ${circ}`} strokeDashoffset={0} transform="rotate(-90 50 50)" />
                {strokePartial > 0 && (
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F59E0B" strokeWidth="12"
                    strokeDasharray={`${strokePartial} ${circ}`} strokeDashoffset={-strokeVacant} transform="rotate(-90 50 50)" />
                )}
                {strokeOccupied > 0 && (
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#151B54" strokeWidth="12"
                    strokeDasharray={`${strokeOccupied} ${circ}`} strokeDashoffset={-(strokeVacant + strokePartial)} transform="rotate(-90 50 50)" />
                )}
              </svg>
              <div className="donut-center-label">
                <span className="donut-pct">{rooms.occupancyPercentage}%</span>
                <span className="donut-sub">Occupied</span>
              </div>
            </div>

            <div className="donut-legend">
              <div className="legend-row">
                <span className="legend-dot" style={{ backgroundColor: '#151B54' }} />
                <span className="legend-label">Fully Occupied</span>
                <span className="legend-val">{rooms.occupied} rooms</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ backgroundColor: '#F59E0B' }} />
                <span className="legend-label">Partially Occupied</span>
                <span className="legend-val">{rooms.partiallyOccupied} rooms</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ backgroundColor: '#CBD5E1' }} />
                <span className="legend-label">Fully Vacant</span>
                <span className="legend-val">{rooms.vacant} rooms</span>
              </div>
              <div className="legend-divider" />
              <div className="legend-row summary-row">
                <span className="legend-label">Total Beds</span>
                <span className="legend-val">{rooms.allocatedBeds} / {rooms.totalCapacity} allocated</span>
              </div>
            </div>
          </div>
        </div>

        {/* Resident Presence Distribution */}
        <div className="mgmt-card analytics-card">
          <div className="mgmt-card-header">
            <div>
              <h3 className="mgmt-card-title">Resident Presence Distribution</h3>
              <p className="mgmt-card-subtitle">Derived from biometric entry/exit events and active passes</p>
            </div>
            <span className="badge-pill">{residents.totalResidents} residents</span>
          </div>

          <div className="presence-stack-container">
            <div className="presence-stacked-bar" role="progressbar" aria-label="Presence Distribution">
              <div className="bar-segment seg-inside" style={{ width: `${insidePct}%` }}
                title={`Inside: ${residents.currentlyInside} (${insidePct}%)`} />
              <div className="bar-segment seg-outside" style={{ width: `${outsidePct}%` }}
                title={`Outside: ${residents.currentlyOutside} (${outsidePct}%)`} />
              <div className="bar-segment seg-leave" style={{ width: `${onLeavePct}%` }}
                title={`On Leave: ${residents.onLeave} (${onLeavePct}%)`} />
              <div className="bar-segment seg-suspended" style={{ width: `${suspendedPct}%` }}
                title={`Suspended: ${residents.suspended} (${suspendedPct}%)`} />
            </div>

            <div className="presence-stat-list">
              <div className="presence-stat-item">
                <div className="stat-bullet bg-emerald" />
                <div className="stat-content">
                  <span className="stat-name">Inside Hostel</span>
                  <span className="stat-desc">Biometrically confirmed on premises</span>
                </div>
                <span className="stat-count">{residents.currentlyInside} ({insidePct}%)</span>
              </div>
              <div className="presence-stat-item">
                <div className="stat-bullet bg-amber" />
                <div className="stat-content">
                  <span className="stat-name">Currently Outside</span>
                  <span className="stat-desc">Gate pass active or verified exit</span>
                </div>
                <span className="stat-count">{residents.currentlyOutside} ({outsidePct}%)</span>
              </div>
              <div className="presence-stat-item">
                <div className="stat-bullet bg-indigo" />
                <div className="stat-content">
                  <span className="stat-name">On Approved Leave</span>
                  <span className="stat-desc">Multi-day sanctioned leave</span>
                </div>
                <span className="stat-count">{residents.onLeave} ({onLeavePct}%)</span>
              </div>
              <div className="presence-stat-item">
                <div className="stat-bullet bg-crimson" />
                <div className="stat-content">
                  <span className="stat-name">Suspended</span>
                  <span className="stat-desc">Disciplinary campus bar in effect</span>
                </div>
                <span className="stat-count">{residents.suspended} ({suspendedPct}%)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Activity & Biometric Feed */}
      <section className="mgmt-card mgmt-feed-section" aria-label="Operational Logs">
        <div className="mgmt-card-header mgmt-feed-header">
          <div>
            <h3 className="mgmt-card-title">Authoritative Operational Logs</h3>
            <p className="mgmt-card-subtitle">Real-time domain records from PostgreSQL ActivityLog and BiometricEvent</p>
          </div>
          <div className="mgmt-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'activity'}
              onClick={() => setActiveTab('activity')}
              className={`mgmt-tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
            >
              <Clock size={14} />
              <span>Hostel Activity ({recentActivity.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'biometrics'}
              onClick={() => setActiveTab('biometrics')}
              className={`mgmt-tab-btn ${activeTab === 'biometrics' ? 'active' : ''}`}
            >
              <Fingerprint size={14} />
              <span>Biometric Gate Logs ({recentBiometricLogs.length})</span>
            </button>
          </div>
        </div>

        {activeTab === 'activity' ? (
          <div className="mgmt-activity-feed" role="tabpanel">
            {recentActivity.length === 0 ? (
              <div className="mgmt-feed-empty">
                <Layers size={28} className="text-slate" />
                <p>No recent activity records logged.</p>
              </div>
            ) : (
              <div className="activity-timeline">
                {recentActivity.map((act) => (
                  <div key={act.id} className="activity-item">
                    <div className="activity-dot-wrapper">
                      <div className="activity-dot" />
                      <div className="activity-line" />
                    </div>
                    <div className="activity-content">
                      <div className="activity-top">
                        <span className="activity-type-badge">{act.activityType}</span>
                        {act.student && (
                          <span className="activity-actor">{act.student.name} ({act.student.jntuNo})</span>
                        )}
                        <span className="activity-time">{formatDate(act.timestamp)} {formatTimestamp(act.timestamp)}</span>
                      </div>
                      <p className="activity-desc">{act.description}</p>
                      {act.student?.blockName && (
                        <div className="activity-meta">
                          <span>Block: {act.student.blockName}</span>
                          {act.student.roomNumber && <span> • Room {act.student.roomNumber}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mgmt-biometric-feed" role="tabpanel">
            {recentBiometricLogs.length === 0 ? (
              <div className="mgmt-feed-empty">
                <Fingerprint size={28} className="text-slate" />
                <p>No biometric events recorded today.</p>
              </div>
            ) : (
              <div className="biometric-table-wrapper">
                <table className="biometric-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Student</th>
                      <th>JNTU No.</th>
                      <th>Gate</th>
                      <th>Verification</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBiometricLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <span className={`direction-badge ${log.eventType === 'ENTRY' ? 'dir-in' : 'dir-out'}`}>
                            {log.eventType}
                          </span>
                        </td>
                        <td className="font-medium">{log.student.name}</td>
                        <td><code>{log.student.jntuNo}</code></td>
                        <td>{log.gate || 'Main Gate'}</td>
                        <td>
                          <span className="verification-badge badge-verified">{log.verificationStatus}</span>
                        </td>
                        <td className="text-muted">
                          {formatDate(log.eventTimestamp)} {formatTimestamp(log.eventTimestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
