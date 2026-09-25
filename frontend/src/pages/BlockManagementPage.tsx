import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  RotateCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  LayoutGrid,
  Layers,
  UserCheck,
  Eye,
  BedDouble,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';
import {
  managementApiService,
  RoomItem,
  CreateRoomDto,
  Block,
} from '../services/api';

interface BlockManagementPageProps {
  onNavigate?: (path: string) => void;
}

export const formatRoomType = (roomType?: string | null): string => {
  if (!roomType) return 'Standard Room';
  let clean = roomType
    .replace(/\bNon-AC\s*/gi, '')
    .replace(/\bAC\s*/gi, '')
    .trim();
  const match = clean.match(/^Room\s*\(([^)]+)\)$/i);
  if (match) {
    clean = `${match[1]} Room`;
  }
  return clean || 'Standard Room';
};

export const BlockManagementPage: React.FC<BlockManagementPageProps> = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeFloorFilter, setActiveFloorFilter] = useState<number | 'ALL'>('ALL');
  const [inspectingRoom, setInspectingRoom] = useState<RoomItem | null>(null);

  // Room Create/Edit Modal State
  const [isRoomModalOpen, setIsRoomModalOpen] = useState<boolean>(false);
  const [editingRoom, setEditingRoom] = useState<RoomItem | null>(null);
  const [roomFormError, setRoomFormError] = useState<string | null>(null);
  const [isSubmittingRoom, setIsSubmittingRoom] = useState<boolean>(false);
  const [roomFormData, setRoomFormData] = useState<CreateRoomDto>({
    blockId: '',
    roomNumber: '',
    floor: 1,
    roomType: '2 Sharing Room',
    capacity: 2,
    status: 'ACTIVE',
  });

  // Delete Room Modal State
  const [deleteRoomTarget, setDeleteRoomTarget] = useState<RoomItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Export entire hostel floor plan to Excel (.xlsx)
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const blob = await managementApiService.exportFloorPlanExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const todayStr = new Date().toISOString().slice(0, 10);
      a.download = `hostel_entire_floor_plan_${todayStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Entire hostel floor plan exported to Excel successfully.');
    } catch (err: any) {
      console.error('Failed to export floor plan:', err);
      showToast(err.message || 'Failed to export hostel floor plan to Excel.', 'error');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Fetch authoritative blocks from PostgreSQL
  const fetchBlocks = useCallback(async () => {
    try {
      const res = await managementApiService.getBlocks();
      if (res && res.blocks) {
        setBlocks(res.blocks);
        setSelectedBlockId((prev) => {
          if (prev && res.blocks.some((b) => b.id === prev)) return prev;
          return res.blocks[0]?.id || '';
        });
      }
    } catch (err: any) {
      console.error('Failed to load blocks:', err);
    }
  }, []);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  // Fetch authoritative rooms & allocations from PostgreSQL
  const fetchRooms = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const response = await managementApiService.getRooms({
        search: searchTerm,
      });
      setRooms(response.rooms || []);
    } catch (err: any) {
      console.error('Failed to load rooms from PostgreSQL:', err);
      showToast('Failed to load hostel block data.', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchRooms(false);
  }, [fetchRooms]);

  // Active Block
  const currentBlock = useMemo(() => {
    return blocks.find((b) => b.id === selectedBlockId) || blocks[0] || null;
  }, [blocks, selectedBlockId]);

  // Filter rooms belonging to current selected block
  const currentBlockRooms = useMemo(() => {
    if (!currentBlock) return rooms;
    return rooms.filter((r) => {
      if (r.blockId && r.blockId === currentBlock.id) return true;
      if (r.block?.id && r.block.id === currentBlock.id) return true;
      if (r.block?.code && r.block.code.toLowerCase() === currentBlock.code.toLowerCase()) return true;
      if (r.block?.name && r.block.name.toLowerCase() === currentBlock.name.toLowerCase()) return true;
      return false;
    });
  }, [rooms, currentBlock]);

  // Helper to extract occupants robustly from either allocations or activeOccupants
  const getRoomOccupants = useCallback((r: RoomItem) => {
    if (r.allocations && r.allocations.length > 0) {
      return r.allocations
        .filter((a: any) => a.status === 'ACTIVE' || !a.status)
        .map((a: any) => ({
          id: a.id || a.allocationId,
          name: a.student?.name || a.name || 'Resident',
          jntuNo: a.student?.jntuNo || a.jntuNo || '',
          bedNumber: a.bedNumber || 'Bed',
          department: a.student?.department || a.department || '',
          phone: a.student?.phoneNumber || a.phone || '',
        }));
    }
    if (r.activeOccupants && r.activeOccupants.length > 0) {
      return r.activeOccupants.map((o: any) => ({
        id: o.allocationId || o.studentId,
        name: o.name || 'Resident',
        jntuNo: o.jntuNo || '',
        bedNumber: o.bedNumber || 'Bed',
        department: o.department || '',
        phone: o.phone || '',
      }));
    }
    return [];
  }, []);

  // Overall Statistics for current selected block
  const stats = useMemo(() => {
    const totalRooms = currentBlockRooms.length;
    const totalCapacity = currentBlockRooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
    const totalOccupants = currentBlockRooms.reduce((acc, r) => acc + (getRoomOccupants(r).length || r.occupancy || 0), 0);
    const availableBeds = Math.max(0, totalCapacity - totalOccupants);
    return { totalRooms, totalCapacity, totalOccupants, availableBeds };
  }, [currentBlockRooms, getRoomOccupants]);

  // Floor Definitions for current selected block
  const floorGroupings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const filterRoom = (r: RoomItem) => {
      if (!term) return true;
      const matchesNum = r.roomNumber.toLowerCase().includes(term);
      const matchesType = r.roomType?.toLowerCase().includes(term);
      const occupants = getRoomOccupants(r);
      const matchesStudent = occupants.some(
        (occ) =>
          occ.name.toLowerCase().includes(term) ||
          occ.jntuNo.toLowerCase().includes(term)
      );
      return matchesNum || matchesType || matchesStudent;
    };

    const floor1Rooms = currentBlockRooms
      .filter((r) => (r.floor === 1 || (r.floor == null && r.roomNumber.startsWith('1') && r.roomNumber !== '109')) && r.roomNumber !== '208')
      .filter(filterRoom)
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));

    const floor2Rooms = currentBlockRooms
      .filter((r) => (r.floor === 2 || (r.floor == null && r.roomNumber.startsWith('2') && r.roomNumber !== '208')))
      .filter(filterRoom)
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));

    const floor3Rooms = currentBlockRooms
      .filter((r) => (r.floor === 3 || (r.floor == null && (r.roomNumber.startsWith('3') || r.roomNumber === '109' || r.roomNumber === '208'))))
      .filter(filterRoom)
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));

    return [
      { floorNum: 1, floorLabel: 'First Floor', rooms: floor1Rooms },
      { floorNum: 2, floorLabel: 'Second Floor', rooms: floor2Rooms },
      { floorNum: 3, floorLabel: 'Third Floor', rooms: floor3Rooms },
    ];
  }, [currentBlockRooms, searchTerm, getRoomOccupants]);

  // Handlers for Room Modals
  const handleOpenAddRoom = (floorNum: number = 1) => {
    setEditingRoom(null);
    setRoomFormData({
      blockId: selectedBlockId || currentBlock?.id || blocks[0]?.id || '',
      roomNumber: '',
      floor: floorNum,
      roomType: '2 Sharing Room',
      capacity: 2,
      status: 'ACTIVE',
    });
    setRoomFormError(null);
    setIsRoomModalOpen(true);
  };

  const handleOpenEditRoom = (room: RoomItem) => {
    setEditingRoom(room);
    setRoomFormData({
      blockId: room.blockId,
      roomNumber: room.roomNumber,
      floor: room.floor || 1,
      roomType: formatRoomType(room.roomType) || '2 Sharing Room',
      capacity: room.capacity || 2,
      status: (room.status as any) || 'ACTIVE',
    });
    setRoomFormError(null);
    setIsRoomModalOpen(true);
  };

  const handleSubmitRoomForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomFormError(null);

    if (!roomFormData.roomNumber.trim()) {
      setRoomFormError('Room number is required.');
      return;
    }
    if (roomFormData.capacity <= 0 || roomFormData.capacity > 20) {
      setRoomFormError('Capacity must be between 1 and 20.');
      return;
    }

    setIsSubmittingRoom(true);
    try {
      if (editingRoom) {
        await managementApiService.updateRoom(editingRoom.id, roomFormData);
        showToast(`Room '${roomFormData.roomNumber}' updated successfully.`);
      } else {
        await managementApiService.createRoom(roomFormData);
        showToast(`Room '${roomFormData.roomNumber}' added successfully.`);
      }
      setIsRoomModalOpen(false);
      fetchRooms(false);
      fetchBlocks();
    } catch (err: any) {
      setRoomFormError(err.message || 'Failed to save room record.');
    } finally {
      setIsSubmittingRoom(false);
    }
  };

  const handleConfirmDeleteRoom = async () => {
    if (!deleteRoomTarget) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await managementApiService.deleteRoom(deleteRoomTarget.id);
      showToast(`Room '${deleteRoomTarget.roomNumber}' removed successfully.`);
      setDeleteRoomTarget(null);
      fetchRooms(false);
      fetchBlocks();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete room.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="block-mgmt-page" style={{ padding: 'clamp(1rem, 2.5vw, 2rem)', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`toast-alert ${toastMessage.type === 'success' ? 'toast-success' : 'toast-error'}`}
          role="status"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            borderRadius: '8px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            background: toastMessage.type === 'success' ? '#10B981' : '#EF4444',
            color: '#FFFFFF',
            fontWeight: 600,
          }}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#EEF2FF', padding: '0.65rem', borderRadius: '12px', color: '#151B54', display: 'flex' }}>
              <LayoutGrid size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                Block Management
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '0.2rem 0 0 0' }}>
                Block-wise room distribution, floor plans, and student allocations from authoritative hostel records.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              fetchRooms(true);
              fetchBlocks();
            }}
            disabled={isRefreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RotateCw size={15} className={isRefreshing ? 'spin-anim' : ''} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              border: '1px solid #10B981',
              background: '#ECFDF5',
              color: '#065F46',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: isExportingExcel ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.12)',
            }}
            title="Export entire hostel floor plan and student allocations to Excel (.xlsx)"
          >
            <FileSpreadsheet size={16} color="#059669" className={isExportingExcel ? 'spin-anim' : ''} />
            <span>{isExportingExcel ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddRoom(activeFloorFilter === 'ALL' ? 1 : activeFloorFilter)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              background: '#151B54',
              color: '#FFFFFF',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(21, 27, 84, 0.25)',
            }}
          >
            <Plus size={16} />
            <span>Add Room</span>
          </button>
        </div>
      </div>

      {/* Block Selector Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        paddingBottom: '4px',
      }}>
        {blocks.map((b) => {
          const isSelected = (currentBlock?.id === b.id) || (selectedBlockId === b.id);
          const blockRoomCount = rooms.filter(
            (r) =>
              r.blockId === b.id ||
              r.block?.id === b.id ||
              (r.block?.code && r.block.code.toLowerCase() === b.code.toLowerCase()) ||
              (r.block?.name && r.block.name.toLowerCase() === b.name.toLowerCase())
          ).length;

          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setSelectedBlockId(b.id);
                setActiveFloorFilter('ALL');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.7rem 1.25rem',
                borderRadius: '12px',
                border: isSelected ? '2px solid #151B54' : '1px solid #CBD5E1',
                background: isSelected ? '#151B54' : '#FFFFFF',
                color: isSelected ? '#FFFFFF' : '#334155',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 4px 14px rgba(21, 27, 84, 0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                whiteSpace: 'nowrap',
              }}
            >
              <Building2 size={18} color={isSelected ? '#93C5FD' : '#64748B'} />
              <span>{b.name}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.6rem',
                  borderRadius: '9999px',
                  background: isSelected ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
                  color: isSelected ? '#FFFFFF' : '#64748B',
                }}
              >
                {blockRoomCount > 0 ? `${blockRoomCount} Rooms` : 'Empty (0 Rooms)'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Summary Statistics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#FFFFFF', padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Block</span>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentBlock?.name || 'All Blocks'}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#3B82F6', fontWeight: 600 }}>Code: {currentBlock?.code || 'N/A'}</span>
        </div>

        <div style={{ background: '#FFFFFF', padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Rooms</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#151B54', marginTop: '0.2rem' }}>{stats.totalRooms} Rooms</div>
          <span style={{ fontSize: '0.75rem', color: stats.totalRooms > 0 ? '#10B981' : '#94A3B8', fontWeight: 600 }}>
            {stats.totalRooms > 0 ? 'Configured Rooms' : 'Pending Floor Plan'}
          </span>
        </div>

        <div style={{ background: '#FFFFFF', padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bed Capacity</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4F46E5', marginTop: '0.2rem' }}>{stats.totalCapacity} Beds</div>
          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
            {stats.totalCapacity > 0 ? 'Capacity in DB' : '0 Beds Configured'}
          </span>
        </div>

        <div style={{ background: '#FFFFFF', padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Allocated Residents</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stats.totalOccupants > 0 ? '#16A34A' : '#64748B', marginTop: '0.2rem' }}>{stats.totalOccupants} Students</div>
          <span style={{ fontSize: '0.75rem', color: stats.totalOccupants > 0 ? '#16A34A' : '#94A3B8', fontWeight: 700 }}>
            {stats.totalOccupants > 0 ? 'Active Residents' : 'No Allocations'}
          </span>
        </div>
      </div>

      {/* Search & Floor Filter Toolbar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search room number (101, 201, 301) or resident student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 1rem 0.65rem 2.4rem',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              fontSize: '0.875rem',
              outline: 'none',
              background: '#FFFFFF',
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Floor Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveFloorFilter('ALL')}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeFloorFilter === 'ALL' ? 'none' : '1px solid #CBD5E1',
              background: activeFloorFilter === 'ALL' ? '#151B54' : '#FFFFFF',
              color: activeFloorFilter === 'ALL' ? '#FFFFFF' : '#475569',
            }}
          >
            All Floors ({currentBlockRooms.length})
          </button>
          {floorGroupings.map((fg) => (
            <button
              key={fg.floorNum}
              type="button"
              onClick={() => setActiveFloorFilter(fg.floorNum)}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: activeFloorFilter === fg.floorNum ? 'none' : '1px solid #CBD5E1',
                background: activeFloorFilter === fg.floorNum ? '#151B54' : '#FFFFFF',
                color: activeFloorFilter === fg.floorNum ? '#FFFFFF' : '#475569',
              }}
            >
              {fg.floorLabel} ({fg.rooms.length})
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
          <RotateCw size={28} className="spin-anim" style={{ marginBottom: '0.5rem' }} />
          <div>Loading authoritative hostel records...</div>
        </div>
      )}

      {/* Empty Block State */}
      {!isLoading && currentBlockRooms.length === 0 && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          border: '1px solid #E2E8F0',
          padding: '4rem 2rem',
          textAlign: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
        }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: '#EEF2FF',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#151B54',
            marginBottom: '1.25rem',
          }}>
            <Building2 size={34} />
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.5rem 0' }}>
            {currentBlock?.name || 'Selected Block'} — Empty Block
          </h3>
          <p style={{ fontSize: '0.925rem', color: '#64748B', maxWidth: '520px', margin: '0 auto 1.5rem auto', lineHeight: 1.6 }}>
            No rooms have been configured yet for <strong>{currentBlock?.name}</strong> ({currentBlock?.code}).
            Floor plan is pending configuration. You can add rooms whenever you are ready.
          </p>
          <button
            type="button"
            onClick={() => handleOpenAddRoom(1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: '#151B54',
              color: '#FFFFFF',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(21, 27, 84, 0.2)',
            }}
          >
            <Plus size={16} />
            <span>Add Room to {currentBlock?.name || 'Block'}</span>
          </button>
        </div>
      )}

      {/* Floor Sections Grid (Hierarchy: Floor -> Room -> Students) */}
      {!isLoading && currentBlockRooms.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {floorGroupings
            .filter((fg) => activeFloorFilter === 'ALL' || activeFloorFilter === fg.floorNum)
            .map((fg) => (
              <section key={fg.floorNum} aria-labelledby={`floor-heading-${fg.floorNum}`} style={{ background: '#FFFFFF', borderRadius: '18px', padding: '1.5rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                {/* Floor Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '2px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ background: '#EEF2FF', padding: '0.45rem', borderRadius: '8px', color: '#4F46E5', display: 'flex' }}>
                      <Layers size={18} />
                    </div>
                    <div>
                      <h2 id={`floor-heading-${fg.floorNum}`} style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                        {fg.floorLabel}
                      </h2>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#EFF6FF', color: '#1E40AF', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                      {fg.rooms.length} Rooms Configured
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAddRoom(fg.floorNum)}
                    style={{
                      background: '#F8FAFC',
                      color: '#475569',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.775rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Plus size={13} /> Add Room
                  </button>
                </div>

                {/* Rooms Grid for this Floor */}
                {fg.rooms.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
                    No rooms matched the search query on {fg.floorLabel}.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {fg.rooms.map((r) => {
                      const occupants = getRoomOccupants(r);
                      const activeCount = occupants.length;
                      const isFull = activeCount >= (r.capacity || 2);

                      return (
                        <div
                          key={r.id}
                          style={{
                            background: isFull ? '#FAFCFF' : '#FFFFFF',
                            border: isFull ? '1.5px solid #C7D2FE' : '1px solid #E2E8F0',
                            borderRadius: '14px',
                            padding: '1.15rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          }}
                        >
                          <div>
                            {/* Card Top Row: Room Number & Status Pill */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                                Room {r.roomNumber}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.725rem',
                                  fontWeight: 800,
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '9999px',
                                  background: isFull ? '#DCFCE7' : '#EFF6FF',
                                  color: isFull ? '#15803D' : '#1D4ED8',
                                }}
                              >
                                {isFull ? `Full (${activeCount}/${r.capacity})` : `Occupied (${activeCount}/${r.capacity})`}
                              </span>
                            </div>

                            {/* Room Type Description */}
                            <div style={{ fontSize: '0.775rem', color: '#64748B', marginBottom: '0.75rem' }}>
                              {formatRoomType(r.roomType)} • Capacity: {r.capacity} Beds
                            </div>

                            {/* Occupant Students List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.85rem' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Allocated Students:
                              </span>
                              {occupants.length > 0 ? (
                                occupants.map((occ: any, idx: number) => (
                                  <div
                                    key={occ.id || idx}
                                    style={{
                                      fontSize: '0.8rem',
                                      color: '#1E293B',
                                      background: '#F1F5F9',
                                      padding: '0.35rem 0.6rem',
                                      borderRadius: '6px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.35rem',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                                      <UserCheck size={13} color="#16A34A" style={{ flexShrink: 0 }} />
                                      <span style={{ fontWeight: 700, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                        {occ.name}
                                      </span>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'monospace' }}>
                                      {occ.bedNumber || `Bed-${idx + 1}`}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic' }}>
                                  No occupants allocated
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Actions Bottom Row */}
                          <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                            <button
                              type="button"
                              onClick={() => setInspectingRoom(r)}
                              style={{
                                flex: 2,
                                background: '#EEF2FF',
                                color: '#4338CA',
                                border: '1px solid #C7D2FE',
                                borderRadius: '6px',
                                padding: '0.4rem 0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.25rem',
                              }}
                              title="Inspect full resident details"
                            >
                              <Eye size={13} /> View Details ({activeCount})
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditRoom(r)}
                              style={{
                                flex: 1,
                                background: '#FFFFFF',
                                color: '#475569',
                                border: '1px solid #CBD5E1',
                                borderRadius: '6px',
                                padding: '0.4rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Edit Room Configuration"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteRoomTarget(r)}
                              style={{
                                background: '#FEF2F2',
                                color: '#DC2626',
                                border: '1px solid #FCA5A5',
                                borderRadius: '6px',
                                padding: '0.4rem 0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Delete Room"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
        </div>
      )}

      {/* =========================================================================
          MODAL: INSPECT ROOM RESIDENTS
          ========================================================================= */}
      {inspectingRoom && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '18px', width: '100%', maxWidth: '640px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#151B54', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <BedDouble size={22} color="#818CF8" />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                    Room {inspectingRoom.roomNumber} Resident Details
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                    Floor {inspectingRoom.floor || 1} • {inspectingRoom.roomType || 'Standard'} • Capacity: {inspectingRoom.capacity} Beds
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingRoom(null)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.25rem' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {(() => {
              const inspectingOccupants = getRoomOccupants(inspectingRoom);
              const isFull = inspectingOccupants.length >= (inspectingRoom.capacity || 2);

              return (
                <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                      Current Occupancy: {inspectingOccupants.length} / {inspectingRoom.capacity} Beds
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, background: isFull ? '#DCFCE7' : '#EFF6FF', color: isFull ? '#15803D' : '#1D4ED8', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                      {isFull ? 'FULL OCCUPANCY' : 'AVAILABLE'}
                    </span>
                  </div>

                  {inspectingOccupants.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {inspectingOccupants.map((occ: any, idx: number) => (
                        <div
                          key={occ.id || idx}
                          style={{
                            padding: '1rem',
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#EEF2FF', color: '#151B54', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
                              {idx + 1}
                            </div>
                            <div>
                              <strong style={{ fontSize: '0.95rem', color: '#0F172A', display: 'block' }}>
                                {occ.name}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'monospace' }}>
                                Roll No: {occ.jntuNo || 'N/A'}
                              </span>
                              {occ.department && (
                                <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                                  Dept: {occ.department}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#F1F5F9', color: '#475569', padding: '0.25rem 0.6rem', borderRadius: '6px' }}>
                              {occ.bedNumber || `Bed-${idx + 1}`}
                            </span>
                            <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 700, marginTop: '4px' }}>
                              ACTIVE RESIDENT
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
                      No active students currently allocated to this room.
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', background: '#F8FAFC' }}>
              <button
                type="button"
                onClick={() => setInspectingRoom(null)}
                style={{
                  background: '#151B54',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.55rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD / EDIT ROOM
          ========================================================================= */}
      {isRoomModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '18px', width: '100%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#151B54', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BedDouble size={20} color="#818CF8" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  {editingRoom ? `Edit Room ${editingRoom.roomNumber}` : 'Add New Room'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRoomModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitRoomForm}>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {roomFormError && (
                  <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', color: '#B91C1C', fontSize: '0.825rem' }}>
                    {roomFormError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                    Hostel Block *
                  </label>
                  <select
                    value={roomFormData.blockId}
                    onChange={(e) => setRoomFormData({ ...roomFormData, blockId: e.target.value })}
                    required
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 0.75rem', fontSize: '0.85rem' }}
                  >
                    {blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                      Room Number *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 101"
                      value={roomFormData.roomNumber}
                      onChange={(e) => setRoomFormData({ ...roomFormData, roomNumber: e.target.value })}
                      required
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 0.75rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                      Floor (1, 2, 3) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={roomFormData.floor}
                      onChange={(e) => setRoomFormData({ ...roomFormData, floor: Number(e.target.value) })}
                      required
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 0.75rem', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                      Bed Capacity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={roomFormData.capacity}
                      onChange={(e) => setRoomFormData({ ...roomFormData, capacity: Number(e.target.value) })}
                      required
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 0.75rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                      Status
                    </label>
                    <select
                      value={roomFormData.status}
                      onChange={(e) => setRoomFormData({ ...roomFormData, status: e.target.value as any })}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 0.75rem', fontSize: '0.85rem' }}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="UNDER_MAINTENANCE">Maintenance</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                    Room Type Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 4 Sharing Room"
                    value={roomFormData.roomType || ''}
                    onChange={(e) => setRoomFormData({ ...roomFormData, roomType: e.target.value })}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 0.75rem', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: '#F8FAFC' }}>
                <button
                  type="button"
                  onClick={() => setIsRoomModalOpen(false)}
                  disabled={isSubmittingRoom}
                  style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRoom}
                  style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: 'none', background: '#151B54', color: '#FFFFFF', fontSize: '0.825rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {isSubmittingRoom ? 'Saving...' : editingRoom ? 'Update Room' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: DELETE ROOM CONFIRMATION
          ========================================================================= */}
      {deleteRoomTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '18px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#DC2626' }}>
                <AlertTriangle size={24} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Confirm Room Deletion</h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155' }}>
                Are you sure you want to delete <strong>Room {deleteRoomTarget.roomNumber}</strong>?
              </p>
              {deleteError && (
                <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', color: '#B91C1C', fontSize: '0.8rem' }}>
                  {deleteError}
                </div>
              )}
            </div>

            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: '#F8FAFC' }}>
              <button
                type="button"
                onClick={() => setDeleteRoomTarget(null)}
                disabled={isDeleting}
                style={{ padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRoom}
                disabled={isDeleting}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockManagementPage;
