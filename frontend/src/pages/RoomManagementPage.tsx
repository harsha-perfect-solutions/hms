import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BedDouble,
  Plus,
  Search,
  RotateCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Users,
  Building,
  Layers,
  Home,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  X,
  History,
  LayoutGrid,
} from 'lucide-react';
import {
  managementApiService,
  RoomItem,
  RoomAllocationItem,
  EligibleStudent,
  CreateRoomDto,
  Block,
} from '../services/api';

interface RoomManagementPageProps {
  onNavigate?: (path: string) => void;
}

export const RoomManagementPage: React.FC<RoomManagementPageProps> = () => {
  // Navigation Tabs: 'rooms' | 'allocations'
  const [activeTab, setActiveTab] = useState<'rooms' | 'allocations'>('rooms');

  // Rooms State
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Allocations History State
  const [allocations, setAllocations] = useState<RoomAllocationItem[]>([]);
  const [allocationsLoading, setAllocationsLoading] = useState<boolean>(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [blockFilter, setBlockFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [occupancyFilter, setOccupancyFilter] = useState<string>('ALL');

  // Room Create/Edit Modal State
  const [isRoomModalOpen, setIsRoomModalOpen] = useState<boolean>(false);
  const [editingRoom, setEditingRoom] = useState<RoomItem | null>(null);
  const [roomFormData, setRoomFormData] = useState<CreateRoomDto>({
    blockId: '',
    roomNumber: '',
    floor: 1,
    roomType: 'Non-AC Room (2 Sharing)',
    capacity: 2,
    status: 'ACTIVE',
  });
  const [roomFormError, setRoomFormError] = useState<string | null>(null);
  const [isSubmittingRoom, setIsSubmittingRoom] = useState<boolean>(false);

  // Allocate Student Modal State
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState<boolean>(false);
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudent[]>([]);
  const [allocateBlockId, setAllocateBlockId] = useState<string>('');
  const [allocateRoomId, setAllocateRoomId] = useState<string>('');
  const [allocateStudentId, setAllocateStudentId] = useState<string>('');
  const [allocateBedNumber, setAllocateBedNumber] = useState<string>('');
  const [allocateError, setAllocateError] = useState<string | null>(null);
  const [isSubmittingAllocation, setIsSubmittingAllocation] = useState<boolean>(false);

  // Vacate Modal State
  const [vacateModalData, setVacateModalData] = useState<{
    allocationId: string;
    studentName: string;
    roomNumber: string;
    blockName: string;
    bedNumber?: string | null;
  } | null>(null);
  const [isVacating, setIsVacating] = useState<boolean>(false);
  const [vacateError, setVacateError] = useState<string | null>(null);

  // Reallocate Modal State
  const [reallocateModalData, setReallocateModalData] = useState<{
    allocationId: string;
    studentId: string;
    studentName: string;
    currentRoomNumber: string;
    currentBlockName: string;
    currentBedNumber?: string | null;
  } | null>(null);
  const [targetBlockId, setTargetBlockId] = useState<string>('');
  const [targetRoomId, setTargetRoomId] = useState<string>('');
  const [newBedNumber, setNewBedNumber] = useState<string>('');
  const [isReallocating, setIsReallocating] = useState<boolean>(false);
  const [reallocateError, setReallocateError] = useState<string | null>(null);

  // Delete Room Modal State
  const [deleteRoomTarget, setDeleteRoomTarget] = useState<RoomItem | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState<boolean>(false);
  const [deleteRoomError, setDeleteRoomError] = useState<string | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch Blocks for Dropdowns
  const fetchBlocks = useCallback(async () => {
    try {
      const res = await managementApiService.getBlocks();
      setBlocks(res.blocks || []);
    } catch (err) {
      console.error('Failed to load blocks for dropdowns:', err);
    }
  }, []);

  // Fetch authoritative rooms from PostgreSQL
  const fetchRooms = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const response = await managementApiService.getRooms({
        block: blockFilter,
        status: statusFilter,
        occupancy: occupancyFilter,
        search: searchTerm,
      });
      setRooms(response.rooms || []);
    } catch (err: any) {
      console.error('Failed to fetch rooms:', err);
      setError(err.message || 'Unable to load rooms from database.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [blockFilter, statusFilter, occupancyFilter, searchTerm]);

  // Fetch allocations history
  const fetchAllocations = useCallback(async () => {
    setAllocationsLoading(true);
    try {
      const res = await managementApiService.getAllocations({
        search: searchTerm,
      });
      setAllocations(res.allocations || []);
    } catch (err: any) {
      console.error('Failed to fetch allocations:', err);
    } finally {
      setAllocationsLoading(false);
    }
  }, [searchTerm]);

  // Initial load
  useEffect(() => {
    fetchBlocks();
    fetchRooms(false);
  }, [fetchBlocks, fetchRooms]);

  useEffect(() => {
    if (activeTab === 'allocations') {
      fetchAllocations();
    }
  }, [activeTab, fetchAllocations]);

  // Real-time SSE synchronization
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents((event) => {
      if (
        event?.type === 'ROOM_CREATED' ||
        event?.type === 'ROOM_UPDATED' ||
        event?.type === 'ROOM_DELETED' ||
        event?.type === 'STUDENT_ALLOCATED' ||
        event?.type === 'STUDENT_VACATED' ||
        event?.type === 'STUDENT_REALLOCATED' ||
        event?.type === 'ROOM_ALLOCATION_CHANGED'
      ) {
        fetchRooms(true);
        if (activeTab === 'allocations') {
          fetchAllocations();
        }
      }
    });

    return () => unsubscribe();
  }, [fetchRooms, fetchAllocations, activeTab]);

  // Metrics summary
  const summaryMetrics = useMemo(() => {
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r) => r.occupancy >= r.capacity).length;
    const partiallyOccupied = rooms.filter((r) => r.occupancy > 0 && r.occupancy < r.capacity).length;
    const vacantRooms = rooms.filter((r) => r.occupancy === 0).length;
    const totalCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);
    const allocatedBeds = rooms.reduce((acc, r) => acc + r.occupancy, 0);
    const occupancyRate = totalCapacity > 0 ? Math.round((allocatedBeds / totalCapacity) * 100) : 0;

    return {
      totalRooms,
      occupiedRooms,
      partiallyOccupied,
      vacantRooms,
      totalCapacity,
      allocatedBeds,
      occupancyRate,
    };
  }, [rooms]);

  // Handle Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingRoom(null);
    const activeBlocks = blocks.filter((b) => b.status === 'ACTIVE');
    setRoomFormData({
      blockId: activeBlocks.length > 0 ? activeBlocks[0].id : '',
      roomNumber: '',
      floor: 1,
      roomType: 'Non-AC Room (2 Sharing)',
      capacity: 2,
      status: 'ACTIVE',
    });
    setRoomFormError(null);
    setIsRoomModalOpen(true);
  };

  // Handle Open Edit Modal
  const handleOpenEditModal = (room: RoomItem) => {
    setEditingRoom(room);
    setRoomFormData({
      blockId: room.blockId,
      roomNumber: room.roomNumber,
      floor: room.floor || 1,
      roomType: room.roomType || 'Non-AC Room (2 Sharing)',
      capacity: room.capacity,
      status: room.status,
    });
    setRoomFormError(null);
    setIsRoomModalOpen(true);
  };

  // Handle Submit Room (Create / Edit)
  const handleSubmitRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomFormError(null);

    if (!roomFormData.blockId) {
      setRoomFormError('Please select a residential block.');
      return;
    }
    if (!roomFormData.roomNumber.trim()) {
      setRoomFormError('Room number is required.');
      return;
    }
    if (roomFormData.capacity < 1 || roomFormData.capacity > 10) {
      setRoomFormError('Capacity must be between 1 and 10.');
      return;
    }

    setIsSubmittingRoom(true);
    try {
      if (editingRoom) {
        await managementApiService.updateRoom(editingRoom.id, {
          blockId: roomFormData.blockId,
          roomNumber: roomFormData.roomNumber.trim(),
          floor: Number(roomFormData.floor),
          roomType: roomFormData.roomType,
          capacity: Number(roomFormData.capacity),
          status: roomFormData.status,
        });
        showToast(`Room '${roomFormData.roomNumber.trim()}' updated successfully.`);
      } else {
        await managementApiService.createRoom({
          blockId: roomFormData.blockId,
          roomNumber: roomFormData.roomNumber.trim(),
          floor: Number(roomFormData.floor),
          roomType: roomFormData.roomType,
          capacity: Number(roomFormData.capacity),
          status: roomFormData.status,
        });
        showToast(`Room '${roomFormData.roomNumber.trim()}' created successfully.`);
      }

      setIsRoomModalOpen(false);
      fetchRooms(false);
    } catch (err: any) {
      setRoomFormError(err.message || 'Failed to save room.');
    } finally {
      setIsSubmittingRoom(false);
    }
  };

  // Handle Open Allocate Modal
  const handleOpenAllocateModal = async (preselectedRoomId?: string, preselectedBlockId?: string) => {
    setAllocateError(null);
    setAllocateStudentId('');
    setAllocateBedNumber('');

    // Preselect block & room if given
    if (preselectedBlockId) setAllocateBlockId(preselectedBlockId);
    else if (blocks.length > 0) setAllocateBlockId(blocks[0].id);

    if (preselectedRoomId) setAllocateRoomId(preselectedRoomId);
    else setAllocateRoomId('');

    // Fetch eligible unallocated students
    try {
      const res = await managementApiService.getEligibleStudents();
      setEligibleStudents(res.students || []);
      if (res.students && res.students.length > 0) {
        setAllocateStudentId(res.students[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load eligible students:', err);
    }

    setIsAllocateModalOpen(true);
  };

  // Available rooms for allocate modal based on selected block
  const availableRoomsForAllocation = useMemo(() => {
    if (!allocateBlockId) return [];
    return rooms.filter(
      (r) => r.blockId === allocateBlockId && r.status === 'ACTIVE' && r.occupancy < r.capacity
    );
  }, [rooms, allocateBlockId]);

  // When available rooms change in allocate modal, update allocateRoomId if not set or invalid
  useEffect(() => {
    if (isAllocateModalOpen && availableRoomsForAllocation.length > 0) {
      if (!allocateRoomId || !availableRoomsForAllocation.some((r) => r.id === allocateRoomId)) {
        setAllocateRoomId(availableRoomsForAllocation[0].id);
      }
    }
  }, [availableRoomsForAllocation, allocateRoomId, isAllocateModalOpen]);

  // Handle Submit Allocation
  const handleSubmitAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setAllocateError(null);

    if (!allocateRoomId) {
      setAllocateError('Please select a room with available vacancy.');
      return;
    }
    if (!allocateStudentId) {
      setAllocateError('Please select an eligible student to allocate.');
      return;
    }

    setIsSubmittingAllocation(true);
    try {
      const res = await managementApiService.allocateStudent({
        roomId: allocateRoomId,
        studentId: allocateStudentId,
        bedNumber: allocateBedNumber.trim() ? allocateBedNumber.trim() : undefined,
      });

      showToast(res.message || 'Student allocated successfully!');
      setIsAllocateModalOpen(false);
      fetchRooms(false);
      if (activeTab === 'allocations') fetchAllocations();
    } catch (err: any) {
      setAllocateError(err.message || 'Failed to allocate student.');
    } finally {
      setIsSubmittingAllocation(false);
    }
  };

  // Handle Vacate Student
  const handleConfirmVacate = async () => {
    if (!vacateModalData) return;
    setIsVacating(true);
    setVacateError(null);

    try {
      await managementApiService.vacateStudent(vacateModalData.allocationId);
      showToast(`Student ${vacateModalData.studentName} vacated successfully.`);
      setVacateModalData(null);
      fetchRooms(false);
      if (activeTab === 'allocations') fetchAllocations();
    } catch (err: any) {
      setVacateError(err.message || 'Failed to vacate resident.');
    } finally {
      setIsVacating(false);
    }
  };

  // Handle Open Reallocate Modal
  const handleOpenReallocateModal = (alloc: {
    allocationId: string;
    studentId: string;
    studentName: string;
    currentRoomNumber: string;
    currentBlockName: string;
    currentBedNumber?: string | null;
  }) => {
    setReallocateModalData(alloc);
    setReallocateError(null);
    setNewBedNumber('');

    // Default target block & room
    const activeBlocks = blocks.filter((b) => b.status === 'ACTIVE');
    const firstBlockId = activeBlocks.length > 0 ? activeBlocks[0].id : '';
    setTargetBlockId(firstBlockId);

    const vacantRooms = rooms.filter(
      (r) => r.blockId === firstBlockId && r.status === 'ACTIVE' && r.occupancy < r.capacity
    );
    setTargetRoomId(vacantRooms.length > 0 ? vacantRooms[0].id : '');
  };

  // Target rooms available for reallocation
  const availableTargetRooms = useMemo(() => {
    if (!targetBlockId) return [];
    return rooms.filter(
      (r) => r.blockId === targetBlockId && r.status === 'ACTIVE' && r.occupancy < r.capacity
    );
  }, [rooms, targetBlockId]);

  // Handle Confirm Reallocation
  const handleConfirmReallocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reallocateModalData) return;
    setReallocateError(null);

    if (!targetRoomId) {
      setReallocateError('Please select a target room with available vacancy.');
      return;
    }

    setIsReallocating(true);
    try {
      const res = await managementApiService.reallocateStudent(reallocateModalData.allocationId, {
        targetRoomId,
        newBedNumber: newBedNumber.trim() ? newBedNumber.trim() : undefined,
      });

      showToast(res.message || 'Student reallocated successfully.');
      setReallocateModalData(null);
      fetchRooms(false);
      if (activeTab === 'allocations') fetchAllocations();
    } catch (err: any) {
      setReallocateError(err.message || 'Failed to reallocate resident.');
    } finally {
      setIsReallocating(false);
    }
  };

  // Handle Confirm Delete Room
  const handleConfirmDeleteRoom = async () => {
    if (!deleteRoomTarget) return;
    setIsDeletingRoom(true);
    setDeleteRoomError(null);

    try {
      await managementApiService.deleteRoom(deleteRoomTarget.id);
      showToast(`Room '${deleteRoomTarget.roomNumber}' deleted successfully.`);
      setDeleteRoomTarget(null);
      fetchRooms(false);
    } catch (err: any) {
      setDeleteRoomError(err.message || 'Failed to delete room.');
    } finally {
      setIsDeletingRoom(false);
    }
  };

  return (
    <div className="room-mgmt-page">
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
            fontWeight: 500,
          }}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="room-page-header">
        <div className="room-header-title-group">
          <h1>
            <BedDouble size={26} style={{ color: '#151B54' }} />
            Room Management &amp; Allocation
          </h1>
          <p>
            Configure rooms, track bed occupancy, and assign residential accommodations.
          </p>
        </div>

        <div className="room-header-actions">
          <button
            type="button"
            onClick={() => fetchRooms(true)}
            className="btn-secondary"
            title="Synchronize authoritative data"
            disabled={isRefreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem' }}
          >
            <RotateCw size={15} className={isRefreshing ? 'spin-anim' : ''} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAllocateModal()}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1rem',
              backgroundColor: '#0F766E',
            }}
          >
            <UserPlus size={16} />
            <span>Allocate Student</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1rem',
              backgroundColor: '#151B54',
            }}
          >
            <Plus size={16} />
            <span>Add Room</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <section className="room-kpi-grid" aria-label="Summary Statistics">
        <div className="room-kpi-card">
          <span className="room-kpi-label">TOTAL ROOMS</span>
          <div className="room-kpi-value" style={{ color: '#0F172A' }}>
            {summaryMetrics.totalRooms}
          </div>
          <div className="room-kpi-sub" style={{ color: '#64748B' }}>
            Across all blocks
          </div>
        </div>

        <div className="room-kpi-card">
          <span className="room-kpi-label">OCCUPIED ROOMS</span>
          <div className="room-kpi-value" style={{ color: '#1E293B' }}>
            {summaryMetrics.occupiedRooms}
          </div>
          <div className="room-kpi-sub" style={{ color: '#059669' }}>
            At 100% capacity
          </div>
        </div>

        <div className="room-kpi-card">
          <span className="room-kpi-label">PARTIALLY OCCUPIED</span>
          <div className="room-kpi-value" style={{ color: '#D97706' }}>
            {summaryMetrics.partiallyOccupied}
          </div>
          <div className="room-kpi-sub" style={{ color: '#B45309' }}>
            Has vacancies
          </div>
        </div>

        <div className="room-kpi-card">
          <span className="room-kpi-label">VACANT ROOMS</span>
          <div className="room-kpi-value" style={{ color: '#64748B' }}>
            {summaryMetrics.vacantRooms}
          </div>
          <div className="room-kpi-sub" style={{ color: '#475569' }}>
            0 allocations
          </div>
        </div>

        <div className="room-kpi-card">
          <span className="room-kpi-label">TOTAL CAPACITY</span>
          <div className="room-kpi-value" style={{ color: '#0F172A' }}>
            {summaryMetrics.totalCapacity}
          </div>
          <div className="room-kpi-sub" style={{ color: '#64748B' }}>
            Total beds available
          </div>
        </div>

        <div className="room-kpi-card">
          <span className="room-kpi-label">ALLOCATED BEDS</span>
          <div className="room-kpi-value" style={{ color: '#2563EB' }}>
            {summaryMetrics.allocatedBeds}
          </div>
          <div className="room-kpi-sub" style={{ color: '#2563EB' }}>
            {summaryMetrics.occupancyRate}% filled
          </div>
        </div>
      </section>

      {/* View Switcher Tabs */}
      <div className="room-tabs-bar">
        <button
          type="button"
          onClick={() => setActiveTab('rooms')}
          className={`room-tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}
        >
          <LayoutGrid size={16} />
          <span>Rooms Overview ({rooms.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('allocations')}
          className={`room-tab-btn ${activeTab === 'allocations' ? 'active' : ''}`}
        >
          <History size={16} />
          <span>Allocations History</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="room-filter-toolbar">
        <div className="room-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder={
              activeTab === 'rooms'
                ? 'Search room number, block name...'
                : 'Search student name, roll number, room...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search"
          />
        </div>

        {activeTab === 'rooms' && (
          <div className="room-filter-controls">
            {/* Block Filter */}
            <select
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
              className="room-filter-select"
              aria-label="Filter by block"
            >
              <option value="ALL">All Blocks</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="room-filter-select"
              aria-label="Filter by room status"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="UNDER_MAINTENANCE">Maintenance</option>
            </select>

            {/* Occupancy Filter */}
            <select
              value={occupancyFilter}
              onChange={(e) => setOccupancyFilter(e.target.value)}
              className="room-filter-select"
              aria-label="Filter by occupancy"
            >
              <option value="ALL">All Occupancy</option>
              <option value="OCCUPIED">Fully Occupied</option>
              <option value="PARTIALLY_OCCUPIED">Partially Occupied</option>
              <option value="VACANT">Fully Vacant</option>
            </select>

            {(blockFilter !== 'ALL' || statusFilter !== 'ALL' || occupancyFilter !== 'ALL' || searchTerm.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  setBlockFilter('ALL');
                  setStatusFilter('ALL');
                  setOccupancyFilter('ALL');
                  setSearchTerm('');
                }}
                className="room-reset-filter-btn"
                title="Reset all filters"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
          <div className="spin-anim" style={{ display: 'inline-block', marginBottom: '0.5rem' }}>
            <RotateCw size={28} />
          </div>
          <p>Loading rooms from PostgreSQL database...</p>
        </div>
      ) : error ? (
        <div
          className="state-card error-state"
          style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '8px',
          }}
        >
          <AlertTriangle size={32} style={{ color: '#DC2626', margin: '0 auto 0.5rem' }} />
          <h3 style={{ color: '#991B1B', fontWeight: 600 }}>Failed to Load Rooms</h3>
          <p style={{ color: '#B91C1C', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>
          <button type="button" onClick={() => fetchRooms(false)} className="btn-primary">
            Retry
          </button>
        </div>
      ) : activeTab === 'rooms' ? (
        /* ROOMS GRID / LIST VIEW */
        rooms.length === 0 ? (
          <div
            className="mgmt-card empty-state-card"
            style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}
          >
            <BedDouble size={48} style={{ color: '#CBD5E1', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1E293B' }}>No Rooms Found</h3>
            <p style={{ fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: '1.25rem' }}>
              No rooms match your filter criteria or no rooms have been added yet.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={16} />
              <span>Add First Room</span>
            </button>
          </div>
        ) : (
          <div className="rooms-grid">
            {rooms.map((room) => {
              const occPct = room.capacity > 0 ? Math.round((room.occupancy / room.capacity) * 100) : 0;
              const isFull = room.occupancy >= room.capacity;
              const hasVacancy = !isFull && room.status === 'ACTIVE' && room.block.status === 'ACTIVE';

              return (
                <div
                  key={room.id}
                  className="room-card"
                  style={{
                    borderLeft: `4px solid ${
                      room.status !== 'ACTIVE'
                        ? '#CBD5E1'
                        : isFull
                        ? '#151B54'
                        : room.occupancy > 0
                        ? '#F59E0B'
                        : '#10B981'
                    }`,
                  }}
                >
                  {/* Card Header & Content */}
                  <div>
                    <div className="room-card-header">
                      {/* Top Row: Room Number & Action Buttons */}
                      <div className="room-header-top-row">
                        <span className="room-title-number">
                          Room {room.roomNumber}
                        </span>

                        <div className="room-header-actions">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(room)}
                            className="room-action-icon-btn"
                            title="Edit Room"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteRoomTarget(room);
                              setDeleteRoomError(null);
                            }}
                            className="room-action-icon-btn delete"
                            title="Delete Room"
                            disabled={room.occupancy > 0}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Sub Row: Status Badge & Block Info */}
                      <div className="room-sub-row">
                        <span
                          className={`room-badge-status ${
                            room.status === 'ACTIVE'
                              ? 'active'
                              : room.status === 'UNDER_MAINTENANCE'
                              ? 'maintenance'
                              : 'inactive'
                          }`}
                        >
                          {room.status}
                        </span>
                        <div className="room-block-info">
                          <Building size={13} />
                          <span>
                            {room.block.name} ({room.block.code})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Room Meta (Floor, Type, Capacity) */}
                    <div className="room-specs-row">
                      <span className="room-spec-item">
                        <Layers size={13} /> Floor {room.floor || 1}
                      </span>
                      <span className="room-spec-item">
                        <Home size={13} /> {room.roomType || 'Non-AC'}
                      </span>
                      <span className="room-spec-item">
                        <Users size={13} /> Cap: {room.capacity}
                      </span>
                    </div>

                    {/* Occupancy Progress Visual Indicator */}
                    <div className="room-occupancy-indicator">
                      <div className="room-occupancy-labels">
                        <span style={{ color: isFull ? '#1E293B' : '#059669' }}>
                          {room.occupancy} / {room.capacity} occupied
                        </span>
                        <span style={{ color: '#64748B' }}>
                          {room.availableBeds} {room.availableBeds === 1 ? 'bed' : 'beds'} free
                        </span>
                      </div>
                      <div className="room-occupancy-track">
                        <div
                          className="room-occupancy-fill"
                          style={{
                            width: `${occPct}%`,
                            backgroundColor: isFull ? '#151B54' : room.occupancy > 0 ? '#F59E0B' : '#10B981',
                          }}
                        />
                      </div>
                    </div>

                    {/* Active Occupants List */}
                    <div className="room-occupants-box">
                      <span className="room-occupants-heading">
                        Assigned Students ({room.activeOccupants.length})
                      </span>

                      <div>
                        {room.activeOccupants.length > 0 ? (
                          room.activeOccupants.map((occ) => (
                            <div key={occ.allocationId} className="room-occupant-chip">
                              <div className="room-occupant-meta">
                                <span className="room-occupant-name">{occ.name}</span>{' '}
                                <span className="room-occupant-jntu">({occ.jntuNo})</span>
                                {occ.bedNumber && (
                                  <span className="room-occupant-bed">
                                    {occ.bedNumber}
                                  </span>
                                )}
                              </div>

                              <div className="room-occupant-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenReallocateModal({
                                      allocationId: occ.allocationId,
                                      studentId: occ.studentId,
                                      studentName: occ.name,
                                      currentRoomNumber: room.roomNumber,
                                      currentBlockName: room.block.name,
                                      currentBedNumber: occ.bedNumber,
                                    })
                                  }
                                  title="Reallocate student to another room"
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#2563EB',
                                    cursor: 'pointer',
                                    padding: '2px',
                                  }}
                                >
                                  <ArrowRightLeft size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVacateModalData({
                                      allocationId: occ.allocationId,
                                      studentName: occ.name,
                                      roomNumber: room.roomNumber,
                                      blockName: room.block.name,
                                      bedNumber: occ.bedNumber,
                                    })
                                  }
                                  title="Vacate student"
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#DC2626',
                                    cursor: 'pointer',
                                    padding: '2px',
                                  }}
                                >
                                  <UserMinus size={13} />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontStyle: 'italic', padding: '4px 0' }}>
                            No residents currently assigned.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Quick Action */}
                  <div className="room-card-footer">
                    {hasVacancy ? (
                      <button
                        type="button"
                        onClick={() => handleOpenAllocateModal(room.id, room.blockId)}
                        className="room-allocate-btn"
                      >
                        <UserPlus size={14} />
                        <span>Allocate Available Bed</span>
                      </button>
                    ) : (
                      <div
                        className="room-empty-footer"
                        style={{ color: isFull ? '#64748B' : '#94A3B8' }}
                      >
                        {isFull ? 'Room Fully Occupied' : `Unavailable (${room.status})`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ALLOCATIONS HISTORY TAB VIEW */
        <div className="room-table-card">
          {allocationsLoading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748B' }}>
              <RotateCw size={24} className="spin-anim" style={{ margin: '0 auto 0.5rem' }} />
              <p>Loading historical allocation records...</p>
            </div>
          ) : allocations.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748B' }}>
              <History size={36} style={{ color: '#CBD5E1', margin: '0 auto 0.75rem' }} />
              <p>No room allocations found.</p>
            </div>
          ) : (
            <div className="room-table-wrap">
              <table className="room-alloc-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>JNTU No</th>
                    <th>Block &amp; Room</th>
                    <th>Bed</th>
                    <th>Allocated Date</th>
                    <th>Vacated Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((alloc) => {
                    const isActive = alloc.status === 'ACTIVE';

                    return (
                      <tr key={alloc.id}>
                        <td style={{ fontWeight: 600, color: '#0F172A' }}>
                          {alloc.student.name}
                        </td>
                        <td style={{ color: '#475569' }}>{alloc.student.jntuNo}</td>
                        <td style={{ color: '#334155' }}>
                          {alloc.room.block.name} - Room {alloc.room.roomNumber}
                        </td>
                        <td style={{ color: '#475569' }}>{alloc.bedNumber || 'Auto'}</td>
                        <td style={{ color: '#64748B', fontSize: '0.82rem' }}>
                          {new Date(alloc.allocatedAt).toLocaleDateString()}
                        </td>
                        <td style={{ color: '#64748B', fontSize: '0.82rem' }}>
                          {alloc.vacatedAt ? new Date(alloc.vacatedAt).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          <span
                            className={`room-badge-status ${
                              alloc.status === 'ACTIVE'
                                ? 'active'
                                : alloc.status === 'VACATED'
                                ? 'inactive'
                                : 'maintenance'
                            }`}
                          >
                            {alloc.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isActive ? (
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenReallocateModal({
                                    allocationId: alloc.id,
                                    studentId: alloc.studentId,
                                    studentName: alloc.student.name,
                                    currentRoomNumber: alloc.room.roomNumber,
                                    currentBlockName: alloc.room.block.name,
                                    currentBedNumber: alloc.bedNumber,
                                  })
                                }
                                className="btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                              >
                                Reallocate
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setVacateModalData({
                                    allocationId: alloc.id,
                                    studentName: alloc.student.name,
                                    roomNumber: alloc.room.roomNumber,
                                    blockName: alloc.room.block.name,
                                    bedNumber: alloc.bedNumber,
                                  })
                                }
                                className="btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#DC2626' }}
                              >
                                Vacate
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Archived</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* 1. Add / Edit Room Modal */}
      {isRoomModalOpen && (
        <div className="mgmt-modal-backdrop" onClick={() => setIsRoomModalOpen(false)}>
          <div className="mgmt-notice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="notice-modal-header">
              <div className="notice-icon-circle">
                <BedDouble size={20} />
              </div>
              <h3 className="notice-modal-title">{editingRoom ? 'Edit Room' : 'Add New Room'}</h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsRoomModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitRoom}>
              <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {roomFormError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: '6px',
                      color: '#B91C1C',
                      fontSize: '0.85rem',
                    }}
                  >
                    {roomFormError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    Residential Block *
                  </label>
                  <select
                    value={roomFormData.blockId}
                    onChange={(e) => setRoomFormData({ ...roomFormData, blockId: e.target.value })}
                    className="mgmt-select"
                    required
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">Select Block</option>
                    {blocks.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.status !== 'ACTIVE'}>
                        {b.name} ({b.code}) {b.status !== 'ACTIVE' ? '- Inactive' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      Room Number *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 101, 204"
                      value={roomFormData.roomNumber}
                      onChange={(e) => setRoomFormData({ ...roomFormData, roomNumber: e.target.value })}
                      className="mgmt-input"
                      required
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      Floor
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={roomFormData.floor ?? 1}
                      onChange={(e) => setRoomFormData({ ...roomFormData, floor: Number(e.target.value) })}
                      className="mgmt-input"
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      Capacity (Beds) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={roomFormData.capacity}
                      onChange={(e) => setRoomFormData({ ...roomFormData, capacity: Number(e.target.value) })}
                      className="mgmt-input"
                      required
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      Status
                    </label>
                    <select
                      value={roomFormData.status}
                      onChange={(e) => setRoomFormData({ ...roomFormData, status: e.target.value as any })}
                      className="mgmt-select"
                      style={{ width: '100%', height: '38px' }}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="UNDER_MAINTENANCE">Maintenance</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    Room Type
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Non-AC Room (2 Sharing)"
                    value={roomFormData.roomType || ''}
                    onChange={(e) => setRoomFormData({ ...roomFormData, roomType: e.target.value })}
                    className="mgmt-input"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div className="notice-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsRoomModalOpen(false)}
                  disabled={isSubmittingRoom}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmittingRoom}>
                  {isSubmittingRoom ? 'Saving...' : editingRoom ? 'Update Room' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Allocate Student Modal */}
      {isAllocateModalOpen && (
        <div className="mgmt-modal-backdrop" onClick={() => setIsAllocateModalOpen(false)}>
          <div className="mgmt-notice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#CCFBF1', color: '#0F766E' }}>
                <UserPlus size={20} />
              </div>
              <h3 className="notice-modal-title">Allocate Student to Room</h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsAllocateModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitAllocation}>
              <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {allocateError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: '6px',
                      color: '#B91C1C',
                      fontSize: '0.85rem',
                    }}
                  >
                    {allocateError}
                  </div>
                )}

                {/* Block Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    1. Select Block *
                  </label>
                  <select
                    value={allocateBlockId}
                    onChange={(e) => {
                      setAllocateBlockId(e.target.value);
                      setAllocateRoomId('');
                    }}
                    className="mgmt-select"
                    required
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">Choose Block</option>
                    {blocks
                      .filter((b) => b.status === 'ACTIVE')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Room Selection with Vacancy */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    2. Select Room (with Vacancies) *
                  </label>
                  <select
                    value={allocateRoomId}
                    onChange={(e) => setAllocateRoomId(e.target.value)}
                    className="mgmt-select"
                    required
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">
                      {availableRoomsForAllocation.length === 0
                        ? 'No vacant rooms in this block'
                        : 'Choose Room'}
                    </option>
                    {availableRoomsForAllocation.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.roomNumber} ({r.occupancy}/{r.capacity} occupied, {r.availableBeds} beds free)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Student Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    3. Select Eligible Student *
                  </label>
                  {eligibleStudents.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#64748B', fontStyle: 'italic', padding: '6px 0' }}>
                      No unallocated students eligible for assignment.
                    </div>
                  ) : (
                    <select
                      value={allocateStudentId}
                      onChange={(e) => setAllocateStudentId(e.target.value)}
                      className="mgmt-select"
                      required
                      style={{ width: '100%', height: '38px' }}
                    >
                      <option value="">Choose Student</option>
                      {eligibleStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.jntuNo})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Optional Bed Number */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    4. Bed Assignment (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Leave empty to auto-assign (e.g. Bed-1, Bed-2)"
                    value={allocateBedNumber}
                    onChange={(e) => setAllocateBedNumber(e.target.value)}
                    className="mgmt-input"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div className="notice-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAllocateModalOpen(false)}
                  disabled={isSubmittingAllocation}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingAllocation || availableRoomsForAllocation.length === 0 || eligibleStudents.length === 0}
                  style={{ backgroundColor: '#0F766E' }}
                >
                  {isSubmittingAllocation ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Reallocate Student Modal */}
      {reallocateModalData && (
        <div className="mgmt-modal-backdrop" onClick={() => setReallocateModalData(null)}>
          <div className="mgmt-notice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#DBEAFE', color: '#2563EB' }}>
                <ArrowRightLeft size={20} />
              </div>
              <h3 className="notice-modal-title">Reallocate Student</h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setReallocateModalData(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReallocation}>
              <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {reallocateError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: '6px',
                      color: '#B91C1C',
                      fontSize: '0.85rem',
                    }}
                  >
                    {reallocateError}
                  </div>
                )}

                <div style={{ backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <div>
                    <strong>Student:</strong> {reallocateModalData.studentName}
                  </div>
                  <div>
                    <strong>Current Room:</strong> {reallocateModalData.currentBlockName} - Room {reallocateModalData.currentRoomNumber} ({reallocateModalData.currentBedNumber || 'Bed Assigned'})
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    Target Block *
                  </label>
                  <select
                    value={targetBlockId}
                    onChange={(e) => {
                      setTargetBlockId(e.target.value);
                      setTargetRoomId('');
                    }}
                    className="mgmt-select"
                    required
                    style={{ width: '100%', height: '38px' }}
                  >
                    {blocks
                      .filter((b) => b.status === 'ACTIVE')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    Target Room (with Vacancies) *
                  </label>
                  <select
                    value={targetRoomId}
                    onChange={(e) => setTargetRoomId(e.target.value)}
                    className="mgmt-select"
                    required
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">
                      {availableTargetRooms.length === 0 ? 'No vacant rooms available' : 'Choose Target Room'}
                    </option>
                    {availableTargetRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.roomNumber} ({r.occupancy}/{r.capacity} occupied, {r.availableBeds} beds free)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    New Bed Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Leave empty to auto-assign next free bed"
                    value={newBedNumber}
                    onChange={(e) => setNewBedNumber(e.target.value)}
                    className="mgmt-input"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div className="notice-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setReallocateModalData(null)}
                  disabled={isReallocating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isReallocating || availableTargetRooms.length === 0}
                  style={{ backgroundColor: '#2563EB' }}
                >
                  {isReallocating ? 'Reallocating...' : 'Confirm Reallocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Vacate Confirmation Modal */}
      {vacateModalData && (
        <div className="mgmt-modal-backdrop" onClick={() => setVacateModalData(null)}>
          <div className="mgmt-notice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                <UserMinus size={20} />
              </div>
              <h3 className="notice-modal-title">Vacate Resident</h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setVacateModalData(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-modal-body">
              {vacateError && (
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '6px',
                    color: '#B91C1C',
                    fontSize: '0.85rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  {vacateError}
                </div>
              )}

              <p style={{ fontSize: '0.92rem', color: '#334155' }}>
                Are you sure you want to vacate{' '}
                <strong>{vacateModalData.studentName}</strong> from{' '}
                <strong>
                  {vacateModalData.blockName}, Room {vacateModalData.roomNumber} ({vacateModalData.bedNumber || 'Assigned Bed'})
                </strong>?
              </p>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '0.5rem' }}>
                This student's room allocation will be updated to <em>VACATED</em> in PostgreSQL and their accommodation status will return to unallocated.
              </p>
            </div>

            <div className="notice-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setVacateModalData(null)}
                disabled={isVacating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmVacate}
                disabled={isVacating}
                style={{ backgroundColor: '#DC2626' }}
              >
                {isVacating ? 'Vacating...' : 'Confirm Vacate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Delete Room Modal */}
      {deleteRoomTarget && (
        <div className="mgmt-modal-backdrop" onClick={() => setDeleteRoomTarget(null)}>
          <div className="mgmt-notice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                <Trash2 size={20} />
              </div>
              <h3 className="notice-modal-title">Delete Room</h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setDeleteRoomTarget(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-modal-body">
              {deleteRoomError && (
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '6px',
                    color: '#B91C1C',
                    fontSize: '0.85rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  {deleteRoomError}
                </div>
              )}

              <p style={{ fontSize: '0.92rem', color: '#334155' }}>
                Are you sure you want to delete <strong>Room {deleteRoomTarget.roomNumber}</strong> in{' '}
                <strong>{deleteRoomTarget.block.name}</strong>?
              </p>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '0.5rem' }}>
                This room has 0 active student allocations and can be safely removed.
              </p>
            </div>

            <div className="notice-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteRoomTarget(null)}
                disabled={isDeletingRoom}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmDeleteRoom}
                disabled={isDeletingRoom}
                style={{ backgroundColor: '#DC2626' }}
              >
                {isDeletingRoom ? 'Deleting...' : 'Delete Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomManagementPage;
