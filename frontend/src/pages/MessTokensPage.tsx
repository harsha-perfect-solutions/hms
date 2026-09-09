import React, { useState, useEffect, useCallback } from 'react';
import {
  UtensilsCrossed,
  Coffee,
  Sun,
  Cookie,
  Moon,
  CheckCircle2,
  Clock,
  QrCode,
  Calendar,
  AlertCircle,
  RefreshCw,
  Ticket,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  apiService,
  MessTokensData,
  MessMealSlot,
  ActiveMessToken,
  MessTokenHistoryItem,
} from '../services/api';

export const MessTokensPage: React.FC = () => {
  const [data, setData] = useState<MessTokensData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Booking state
  const [bookingMeal, setBookingMeal] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchMessTokens = useCallback(async (isSilentRefresh = false) => {
    if (isSilentRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await apiService.getMessTokensData();
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Unable to load mess token information.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMessTokens();
  }, [fetchMessTokens]);

  const handleBookToken = async (mealType: string) => {
    if (bookingMeal) return; // Prevent double submission
    setBookingMeal(mealType);
    setActionSuccess(null);
    setActionError(null);

    try {
      const result = await apiService.bookMessToken(mealType);
      setActionSuccess(result.message || 'Mess token booked successfully!');
      // Refresh authoritative backend state immediately
      await fetchMessTokens(true);
    } catch (err: any) {
      setActionError(err.message || 'Failed to book mess token. Please try again.');
    } finally {
      setBookingMeal(null);
    }
  };

  const getMealIcon = (mealType: string) => {
    switch (mealType) {
      case 'BREAKFAST':
        return <Coffee size={22} className="meal-icon breakfast" />;
      case 'LUNCH':
        return <Sun size={22} className="meal-icon lunch" />;
      case 'SNACKS':
        return <Cookie size={22} className="meal-icon snacks" />;
      case 'DINNER':
        return <Moon size={22} className="meal-icon dinner" />;
      default:
        return <UtensilsCrossed size={22} className="meal-icon default" />;
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateOnly = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
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

  // 1. Error State
  if (error && !loading) {
    return (
      <div className="room-state-container" role="alert">
        <div className="state-card error-state">
          <div className="state-icon-circle error">
            <AlertCircle size={32} />
          </div>
          <h2 className="state-title">Unable to load mess tokens</h2>
          <p className="state-desc">{error}</p>
          <button
            type="button"
            onClick={() => fetchMessTokens()}
            className="btn-retry"
          >
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (loading && !data) {
    return (
      <div className="mess-page-content" aria-busy="true">
        <div className="skeleton skeleton-welcome" style={{ height: '120px' }} />
        <div className="mess-slots-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton skeleton-card" style={{ height: '220px' }} />
          ))}
        </div>
        <div className="skeleton skeleton-feed" style={{ height: '260px' }} />
      </div>
    );
  }

  const today = data?.today;
  const summary = today?.summary;
  const mealSlots = today?.mealSlots || [];
  const activePasses = today?.activeTokensToday || [];
  const history = data?.history || [];

  return (
    <div className="mess-page-content">
      {/* Toast / Action Feedback Notifications */}
      {actionSuccess && (
        <div className="feedback-banner success" role="status">
          <div className="feedback-content">
            <CheckCircle2 size={20} className="feedback-icon" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            className="feedback-dismiss-btn"
            onClick={() => setActionSuccess(null)}
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {actionError && (
        <div className="feedback-banner error" role="alert">
          <div className="feedback-content">
            <AlertCircle size={20} className="feedback-icon" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            className="feedback-dismiss-btn"
            onClick={() => setActionError(null)}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Page Title & Refresh Control */}
      <div className="mess-page-header">
        <div>
          <h1 className="mess-page-title">Mess Tokens</h1>
          <p className="mess-page-subtitle">
            Manage your daily hostel meal tokens, booking slots, and active passes.
          </p>
        </div>
        <button
          type="button"
          className={`refresh-tokens-btn ${isRefreshing ? 'spinning' : ''}`}
          onClick={() => fetchMessTokens(true)}
          disabled={isRefreshing}
          aria-label="Refresh mess tokens"
          title="Refresh mess tokens"
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Overview Banner */}
      <section className="mess-summary-banner" aria-label="Today's Token Summary">
        <div className="summary-banner-left">
          <div className="summary-date-badge">
            <Calendar size={18} />
            <span>{today?.formattedDate || 'Today'}</span>
          </div>
          <h2 className="summary-main-stat">
            {summary?.bookedCount || 0} of {summary?.totalMeals || 4} Meals Booked
          </h2>
          <p className="summary-subtext">
            {summary?.remainingCount === 0
              ? 'All daily meals have been booked for today.'
              : `${summary?.remainingCount} meal token${
                  summary?.remainingCount === 1 ? '' : 's'
                } remaining available for today.`}
          </p>
        </div>

        <div className="summary-banner-right">
          <div className="summary-pill-group">
            <div className="summary-stat-box">
              <span className="stat-number">{summary?.bookedCount || 0}</span>
              <span className="stat-label">Booked</span>
            </div>
            <div className="summary-stat-box">
              <span className="stat-number">{summary?.remainingCount || 0}</span>
              <span className="stat-label">Available</span>
            </div>
          </div>
          <div
            className={`status-pill ${
              summary?.bookedCount === 4
                ? 'status-pill-success'
                : summary?.bookedCount! > 0
                ? 'status-pill-info'
                : 'status-pill-neutral'
            }`}
          >
            <ShieldCheck size={14} />
            <span>{summary?.summaryStatus || 'Active Session'}</span>
          </div>
        </div>
      </section>

      {/* Daily Meal Slots Booking Section */}
      <section className="mess-section" aria-labelledby="meal-slots-heading">
        <div className="section-title-group">
          <h2 id="meal-slots-heading" className="mess-section-title">
            Today's Meal Slots
          </h2>
          <span className="section-badge">Residential Hostel Menu</span>
        </div>

        <div className="mess-slots-grid">
          {mealSlots.map((slot: MessMealSlot) => {
            const isBooked = slot.status === 'BOOKED' || slot.status === 'USED';
            const isSubmitting = bookingMeal === slot.mealType;

            return (
              <div
                key={slot.mealType}
                className={`meal-slot-card ${isBooked ? 'card-booked' : 'card-available'}`}
              >
                <div className="meal-card-top">
                  <div className="meal-icon-box">{getMealIcon(slot.mealType)}</div>
                  <div
                    className={`meal-status-badge ${
                      isBooked
                        ? 'badge-booked'
                        : slot.status === 'AVAILABLE'
                        ? 'badge-available'
                        : 'badge-expired'
                    }`}
                  >
                    {isBooked ? (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Booked</span>
                      </>
                    ) : (
                      <>
                        <Clock size={13} />
                        <span>Available</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="meal-card-body">
                  <h3 className="meal-name">{slot.name}</h3>
                  <div className="meal-timing">
                    <Clock size={14} />
                    <span>{slot.timing}</span>
                  </div>
                  <p className="meal-desc">{slot.description}</p>
                </div>

                <div className="meal-card-footer">
                  {isBooked ? (
                    <div className="booked-token-indicator">
                      <Ticket size={15} />
                      <span className="token-ref">
                        Ref: {slot.token?.tokenNumber || 'Verified'}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-book-token"
                      onClick={() => handleBookToken(slot.mealType)}
                      disabled={isSubmitting || !!bookingMeal}
                      aria-label={`Book token for ${slot.name}`}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="spinner-sm" />
                          <span>Booking...</span>
                        </>
                      ) : (
                        <>
                          <Ticket size={16} />
                          <span>Book Token</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Today's Active Digital Passes (Ticket Cards) */}
      {activePasses.length > 0 && (
        <section className="mess-section" aria-labelledby="active-passes-heading">
          <div className="section-title-group">
            <h2 id="active-passes-heading" className="mess-section-title">
              Active Meal Passes
            </h2>
            <span className="section-badge highlight">
              {activePasses.length} Active Today
            </span>
          </div>

          <div className="passes-grid">
            {activePasses.map((pass: ActiveMessToken) => (
              <div key={pass.id} className="digital-token-pass">
                <div className="pass-header">
                  <div className="pass-brand">
                    <QrCode size={18} className="pass-qr-icon" />
                    <span>HOSTEL MEAL PASS</span>
                  </div>
                  <span className="pass-valid-tag">VALID FOR TODAY</span>
                </div>

                <div className="pass-main">
                  <div className="pass-left">
                    <span className="pass-meal-label">{pass.mealName}</span>
                    <h3 className="pass-token-number">{pass.tokenNumber}</h3>
                    <div className="pass-timing-chip">
                      <Clock size={13} />
                      <span>{pass.timing}</span>
                    </div>
                  </div>

                  <div className="pass-qr-visual" aria-hidden="true">
                    <QrCode size={52} />
                  </div>
                </div>

                <div className="pass-details-footer">
                  <div className="pass-meta-col">
                    <span className="meta-label">STUDENT</span>
                    <span className="meta-value">{pass.studentName}</span>
                  </div>
                  <div className="pass-meta-col">
                    <span className="meta-label">JNTU NO</span>
                    <span className="meta-value">{pass.jntuNo}</span>
                  </div>
                  <div className="pass-meta-col">
                    <span className="meta-label">LOCATION</span>
                    <span className="meta-value">
                      {pass.blockName} - {pass.roomNumber}
                    </span>
                  </div>
                </div>

                <div className="pass-bottom-note">
                  <ShieldCheck size={13} />
                  <span>Present this token number or pass at the mess service counter</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Token History Section */}
      <section className="mess-section" aria-labelledby="token-history-heading">
        <div className="section-title-group">
          <h2 id="token-history-heading" className="mess-section-title">
            Token Booking History
          </h2>
          <span className="section-badge">Recent Records</span>
        </div>

        {history.length === 0 ? (
          <div className="empty-history-card">
            <Ticket size={40} className="empty-history-icon" />
            <h3 className="empty-history-title">No token history yet</h3>
            <p className="empty-history-desc">
              When you book meal tokens, your complete verification records and booking history will appear here.
            </p>
          </div>
        ) : (
          <div className="history-table-container">
            <table className="mess-history-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Meal Type</th>
                  <th scope="col">Token ID / Reference</th>
                  <th scope="col">Timing</th>
                  <th scope="col">Booked At</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item: MessTokenHistoryItem) => (
                  <tr key={item.id}>
                    <td className="font-medium text-slate-800">
                      {formatDateOnly(item.date)}
                    </td>
                    <td>
                      <div className="history-meal-cell">
                        {getMealIcon(item.mealType)}
                        <span className="font-semibold">{item.mealName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="history-token-pill">
                        {item.tokenNumber || 'MT-RECORD'}
                      </span>
                    </td>
                    <td className="text-slate-600 text-sm">{item.timing}</td>
                    <td className="text-slate-500 text-sm">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td>
                      <span
                        className={`history-status-badge ${
                          item.status === 'BOOKED'
                            ? 'badge-success'
                            : item.status === 'CONSUMED'
                            ? 'badge-neutral'
                            : 'badge-warning'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default MessTokensPage;
