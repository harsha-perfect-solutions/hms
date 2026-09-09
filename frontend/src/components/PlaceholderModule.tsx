import React from 'react';
import { ArrowLeft, Clock } from 'lucide-react';

interface PlaceholderModuleProps {
  moduleName: string;
  onBackToDashboard: () => void;
}

export const PlaceholderModule: React.FC<PlaceholderModuleProps> = ({
  moduleName,
  onBackToDashboard,
}) => {
  return (
    <div className="placeholder-container">
      <div className="placeholder-card">
        <div className="placeholder-icon-badge">
          <Clock size={32} />
        </div>
        <h2 className="placeholder-title">{moduleName}</h2>
        <p className="placeholder-desc">
          This module is part of the upcoming implementation steps. In this phase, we are verifying the Student Hostel Dashboard and real-time backend data layer.
        </p>

        <button
          type="button"
          onClick={onBackToDashboard}
          className="placeholder-back-btn"
        >
          <ArrowLeft size={16} />
          <span>Return to Dashboard</span>
        </button>
      </div>
    </div>
  );
};
