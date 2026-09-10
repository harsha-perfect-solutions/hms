import React, { useState, useEffect, useCallback } from 'react';
import {
  Bed,
  Building,
  Layers,
  LayoutGrid,
  Home,
  Users,
  UserCheck,
  Calendar,
  AlertCircle,
  RefreshCw,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { apiService, MyRoomData } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const MyRoomPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<MyRoomData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchRoomData = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await apiService.getMyRoomData();
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Unable to load room information.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRoomData();

    // Real-time SSE synchronization: refetch authoritative data upon room allocation change
    const unsubscribe = apiService.subscribeToRoomEvents(() => {
      fetchRoomData(true);
    });

    return () => unsubscribe();
  }, [fetchRoomData]);


  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Not recorded';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Compute initials for roommate avatar
  const getInitial = (name?: string) => {
    if (!name) return 'S';
    return name.trim().charAt(0).toUpperCase();
  };

  // 1. Error State
  if (error && !loading) {
    return (
      <div className="room-state-container" role="alert">
        <div className="state-card error-state">
          <div className="state-icon-circle error">
            <AlertCircle size={32} />
          </div>
          <h2 className="state-title">Unable to load room information</h2>
          <p className="state-desc">{error}</p>
          <button
            type="button"
            onClick={() => fetchRoomData()}
            className="btn-retry"
          >
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Loading Skeleton State
  if (loading && !data) {
    return (
      <div className="room-page-content" aria-busy="true">
        <div className="skeleton skeleton-room-header" />
        <div className="skeleton skeleton-room-details" />
        <div className="skeleton skeleton-roommates" />
      </div>
    );
  }

  const allocation = data?.allocation;
  const room = data?.room;
  const roommates = data?.roommates || [];
  const isAllocated = allocation?.status === 'ALLOCATED' && !!room;

  return (
    <div className="room-page-content">
      {/* Top Page Actions & Status Bar */}
      <div className="room-page-topbar">
        <div className="topbar-left">
          <span className="topbar-student-badge">
            <strong>Student:</strong> {data?.student.name || user?.name} ({data?.student.jntuNo || user?.jntuNo})
          </span>
          <span className={`topbar-status-pill ${isAllocated ? 'pill-success' : 'pill-warning'}`}>
            {allocation?.status || 'NOT_ALLOCATED'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => fetchRoomData(true)}
          className={`btn-sync-room ${isRefreshing ? 'spinning' : ''}`}
          aria-label="Refresh room information"
          title="Refresh room information"
        >
          <RefreshCw size={14} />
          <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {isAllocated && room ? (
        <>
          {/* Main Room Overview Banner (matching reference screenshot) */}
          <section className="room-overview-banner" aria-label="Room Overview">
            <div className="overview-left">
              <div className="room-hero-icon" aria-hidden="true">
                <Bed size={26} />
              </div>
              <div className="room-hero-text">
                <h2 className="room-hero-title">
                  {room.block} - {room.roomNumber}
                </h2>
                <p className="room-hero-sub">
                  Floor {room.floor} · {room.roomType}
                </p>
              </div>
            </div>

            <div className="overview-right">
              <span className="occupancy-pill">
                {room.occupancyStatus || 'Occupied'}
              </span>
            </div>
          </section>

          {/* Section: ROOM DETAILS */}
          <section className="room-section-container" aria-label="Room Details">
            <h3 className="room-section-header">ROOM DETAILS</h3>

            <div className="room-details-card">
              <div className="detail-row">
                <div className="detail-row-left">
                  <div className="detail-icon-circle" aria-hidden="true">
                    <Building size={18} />
                  </div>
                  <span className="detail-label">Block</span>
                </div>
                <div className="detail-value">{room.block}</div>
              </div>

              <div className="detail-row">
                <div className="detail-row-left">
                  <div className="detail-icon-circle" aria-hidden="true">
                    <Layers size={18} />
                  </div>
                  <span className="detail-label">Floor</span>
                </div>
                <div className="detail-value">{room.floor}</div>
              </div>

              <div className="detail-row">
                <div className="detail-row-left">
                  <div className="detail-icon-circle" aria-hidden="true">
                    <LayoutGrid size={18} />
                  </div>
                  <span className="detail-label">Room No.</span>
                </div>
                <div className="detail-value">{room.roomNumber}</div>
              </div>

              <div className="detail-row">
                <div className="detail-row-left">
                  <div className="detail-icon-circle" aria-hidden="true">
                    <Home size={18} />
                  </div>
                  <span className="detail-label">Type</span>
                </div>
                <div className="detail-value">{room.roomType}</div>
              </div>

              <div className="detail-row">
                <div className="detail-row-left">
                  <div className="detail-icon-circle" aria-hidden="true">
                    <Users size={18} />
                  </div>
                  <span className="detail-label">Capacity</span>
                </div>
                <div className="detail-value">{room.capacity}</div>
              </div>

              <div className="detail-row">
                <div className="detail-row-left">
                  <div className="detail-icon-circle" aria-hidden="true">
                    <UserCheck size={18} />
                  </div>
                  <span className="detail-label">Current Occupancy</span>
                </div>
                <div className="detail-value">{room.occupancy}</div>
              </div>
            </div>
          </section>

          {/* Section: ROOMMATES */}
          <section className="room-section-container" aria-label="Roommates">
            <h3 className="room-section-header">ROOMMATES</h3>

            <div className="roommates-card-list">
              {roommates.length > 0 ? (
                roommates.map((occupant) => (
                  <div
                    key={occupant.id}
                    className={`roommate-item-card ${occupant.isCurrentStudent ? 'is-self' : ''}`}
                  >
                    <div className="roommate-avatar">
                      {getInitial(occupant.name)}
                    </div>

                    <div className="roommate-info">
                      <div className="roommate-name-wrap">
                        <span className="roommate-name">{occupant.name}</span>
                        {occupant.isCurrentStudent && (
                          <span className="self-badge">You</span>
                        )}
                      </div>
                      <span className="roommate-roll">{occupant.jntuNo}</span>
                    </div>

                    <div className="roommate-meta">
                      {occupant.bedNumber && (
                        <span className="roommate-bed-badge">
                          {occupant.bedNumber}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="roommates-empty-state">
                  <Users size={24} className="empty-icon" />
                  <p>No roommates currently assigned.</p>
                </div>
              )}
            </div>
          </section>

          {/* Section: ALLOCATION INFORMATION & ADMINISTRATION NOTICE */}
          <section className="room-section-container" aria-label="Allocation Information">
            <h3 className="room-section-header">ALLOCATION RECORD</h3>

            <div className="allocation-info-card">
              <div className="allocation-meta-grid">
                <div className="alloc-meta-item">
                  <span className="alloc-label">Allocation Status</span>
                  <span className="alloc-val status-badge-inline">
                    <ShieldCheck size={16} />
                    {allocation.status}
                  </span>
                </div>

                <div className="alloc-meta-item">
                  <span className="alloc-label">Assigned Bed</span>
                  <span className="alloc-val">{allocation.bedNumber || 'Assigned'}</span>
                </div>

                <div className="alloc-meta-item">
                  <span className="alloc-label">Allocation Date</span>
                  <span className="alloc-val">
                    <Calendar size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    {formatDate(allocation.allocatedAt)}
                  </span>
                </div>
              </div>

              {/* Informational Message */}
              <div className="admin-notice-box" role="note">
                <Info size={18} className="notice-icon" />
                <p className="notice-text">
                  Room allocation changes, transfers, and vacate requests are managed by hostel administration.
                </p>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* Empty State: Unallocated Student */
        <section className="room-empty-container" aria-label="Unallocated Accommodation">
          <div className="room-empty-card">
            <div className="room-empty-icon-wrap" aria-hidden="true">
              <Bed size={36} />
            </div>
            <h2 className="room-empty-title">No Room Allocated</h2>
            <p className="room-empty-desc">
              You currently do not have an active hostel room allocation.
            </p>

            <div className="admin-notice-box" style={{ marginTop: '1.25rem' }}>
              <Info size={18} className="notice-icon" />
              <p className="notice-text">
                Please contact your hostel warden or the residential administration office to complete your room allocation.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
