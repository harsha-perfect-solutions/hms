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
    <div className="room-mgmt-page" style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
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
      <div
        className="mgmt-page-header"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.6rem',
              fontWeight: 700,
              color: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <BedDouble size={26} style={{ color: '#151B54' }} />
            Room Management & Allocation
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Configure rooms, track bed occupancy, and assign residential accommodations.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
      <section
        className="mgmt-kpi-grid"
        aria-label="Summary Statistics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div className="mgmt-card kpi-card" style={{ padding: '1.1rem' }}>
          <span className="mgmt-kpi-label" style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 600 }}>
            TOTAL ROOMS
          </span>
          <div className="mgmt-kpi-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0F172A', marginTop: '0.25rem' }}>
            {summaryMetrics.totalRooms}
          </div>
          <div className="mgmt-kpi-sub" style={{ fontSize: '0.78rem', color: '#64748B' }}>
            Across all blocks
          </div>
        </div>

        <div className="mgmt-card kpi-card" style={{ padding: '1.1rem' }}>
          <span className="mgmt-kpi-label" style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 600 }}>
            OCCUPIED ROOMS
          </span>
          <div className="mgmt-kpi-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1E293B', marginTop: '0.25rem' }}>
            {summaryMetrics.occupiedRooms}
          </div>
          <div className="mgmt-kpi-sub" style={{ fontSize: '0.78rem', color: '#059669' }}>
            At 100% capacity
          </div>
        </div>

        <div className="mgmt-card kpi-card" style={{ padding: '1.1rem' }}>
          <span className="mgmt-kpi-label" style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 600 }}>
            PARTIALLY OCCUPIED
          </span>
          <div className="mgmt-kpi-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97706', marginTop: '0.25rem' }}>
            {summaryMetrics.partiallyOccupied}
          </div>
          <div className="mgmt-kpi-sub" style={{ fontSize: '0.78rem', color: '#B45309' }}>
            Has vacancies
          </div>
        </div>

        <div className="mgmt-card kpi-card" style={{ padding: '1.1rem' }}>
          <span className="mgmt-kpi-label" style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 600 }}>
            VACANT ROOMS
          </span>
          <div className="mgmt-kpi-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#64748B', marginTop: '0.25rem' }}>
            {summaryMetrics.vacantRooms}
          </div>
          <div className="mgmt-kpi-sub" style={{ fontSize: '0.78rem', color: '#475569' }}>
            0 allocations
          </div>
        </div>

        <div className="mgmt-card kpi-card" style={{ padding: '1.1rem' }}>
          <span className="mgmt-kpi-label" style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 600 }}>
            TOTAL CAPACITY
          </span>
          <div className="mgmt-kpi-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0F172A', marginTop: '0.25rem' }}>
            {summaryMetrics.totalCapacity}
          </div>
          <div className="mgmt-kpi-sub" style={{ fontSize: '0.78rem', color: '#64748B' }}>
            Total beds available
          </div>
        </div>

        <div className="mgmt-card kpi-card" style={{ padding: '1.1rem' }}>
          <span className="mgmt-kpi-label" style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 600 }}>
            ALLOCATED BEDS
          </span>
          <div className="mgmt-kpi-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#2563EB', marginTop: '0.25rem' }}>
            {summaryMetrics.allocatedBeds}
          </div>
          <div className="mgmt-kpi-sub" style={{ fontSize: '0.78rem', color: '#2563EB' }}>
            {summaryMetrics.occupancyRate}% filled
          </div>
        </div>
      </section>

      {/* View Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid #E2E8F0',
          marginBottom: '1.25rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('rooms')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.92rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'rooms' ? '3px solid #151B54' : '3px solid transparent',
            color: activeTab === 'rooms' ? '#151B54' : '#64748B',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <LayoutGrid size={16} />
          <span>Rooms Overview ({rooms.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('allocations')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.92rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'allocations' ? '3px solid #151B54' : '3px solid transparent',
            color: activeTab === 'allocations' ? '#151B54' : '#64748B',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <History size={16} />
          <span>Allocations History</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div
        className="mgmt-card filter-card"
        style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94A3B8',
            }}
          />
          <input
            type="text"
            placeholder={
              activeTab === 'rooms'
                ? 'Search room number, block name...'
                : 'Search student name, roll number, room...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mgmt-input"
            style={{ width: '100%', paddingLeft: '36px', height: '40px' }}
          />
        </div>

        {activeTab === 'rooms' && (
          <>
            {/* Block Filter */}
            <div style={{ minWidth: '160px' }}>
              <select
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                className="mgmt-select"
                style={{ width: '100%', height: '40px' }}
                aria-label="Filter by block"
              >
                <option value="ALL">All Blocks</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ minWidth: '140px' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mgmt-select"
                style={{ width: '100%', height: '40px' }}
                aria-label="Filter by room status"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="UNDER_MAINTENANCE">Maintenance</option>
              </select>
            </div>

            {/* Occupancy Filter */}
            <div style={{ minWidth: '150px' }}>
              <select
                value={occupancyFilter}
                onChange={(e) => setOccupancyFilter(e.target.value)}
                className="mgmt-select"
                style={{ width: '100%', height: '40px' }}
                aria-label="Filter by occupancy"
              >
                <option value="ALL">All Occupancy</option>
                <option value="OCCUPIED">Fully Occupied</option>
                <option value="PARTIALLY_OCCUPIED">Partially Occupied</option>
                <option value="VACANT">Fully Vacant</option>
              </select>
            </div>
          </>
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
          <div
            className="rooms-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {rooms.map((room) => {
              const occPct = room.capacity > 0 ? Math.round((room.occupancy / room.capacity) * 100) : 0;
              const isFull = room.occupancy >= room.capacity;
              const hasVacancy = !isFull && room.status === 'ACTIVE' && room.block.status === 'ACTIVE';

              return (
                <div
                  key={room.id}
                  className="room-card mgmt-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1.25rem',
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
                  {/* Card Header */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              fontSize: '1.25rem',
                              fontWeight: 700,
                              color: '#0F172A',
                            }}
                          >
                            Room {room.roomNumber}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor:
                                room.status === 'ACTIVE'
                                  ? '#DEF7EC'
                                  : room.status === 'UNDER_MAINTENANCE'
                                  ? '#FEF3C7'
                                  : '#F1F5F9',
                              color:
                                room.status === 'ACTIVE'
                                  ? '#03543F'
                                  : room.status === 'UNDER_MAINTENANCE'
                                  ? '#92400E'
                                  : '#475569',
                            }}
                          >
                            {room.status}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            color: '#475569',
                            marginTop: '0.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                          }}
                        >
                          <Building size={14} />
                          <span>
                            {room.block.name} ({room.block.code})
                          </span>
                        </div>
                      </div>

                      {/* Top Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(room)}
                          className="icon-btn"
                          title="Edit Room"
                          style={{ padding: '6px', borderRadius: '4px', border: 'none', background: '#F1F5F9', cursor: 'pointer' }}
                        >
                          <Edit2 size={14} style={{ color: '#475569' }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteRoomTarget(room);
                            setDeleteRoomError(null);
                          }}
                          className="icon-btn"
                          title="Delete Room"
                          disabled={room.occupancy > 0}
                          style={{
                            padding: '6px',
                            borderRadius: '4px',
                            border: 'none',
                            background: room.occupancy > 0 ? '#F8FAFC' : '#FEE2E2',
                            cursor: room.occupancy > 0 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <Trash2 size={14} style={{ color: room.occupancy > 0 ? '#94A3B8' : '#DC2626' }} />
                        </button>
                      </div>
                    </div>

                    {/* Room Meta (Floor, Type) */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        fontSize: '0.8rem',
                        color: '#64748B',
                        marginBottom: '1rem',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Layers size={13} /> Floor {room.floor || 1}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Home size={13} /> {room.roomType || 'Non-AC'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Users size={13} /> Cap: {room.capacity}
                      </span>
                    </div>

                    {/* Occupancy Progress Visual Indicator */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          marginBottom: '4px',
                        }}
                      >
                        <span style={{ color: isFull ? '#1E293B' : '#059669' }}>
                          {room.occupancy} / {room.capacity} occupied
                        </span>
                        <span style={{ color: '#64748B' }}>
                          {room.availableBeds} {room.availableBeds === 1 ? 'bed' : 'beds'} free
                        </span>
                      </div>
                      <div
                        style={{
                          height: '8px',
                          backgroundColor: '#E2E8F0',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${occPct}%`,
                            height: '100%',
                            backgroundColor: isFull ? '#151B54' : room.occupancy > 0 ? '#F59E0B' : '#10B981',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Active Occupants List */}
                    <div style={{ marginBottom: '1rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#64748B',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Assigned Students ({room.activeOccupants.length})
                      </span>

                      <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {room.activeOccupants.length > 0 ? (
                          room.activeOccupants.map((occ) => (
                            <div
                              key={occ.allocationId}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 10px',
                                backgroundColor: '#F8FAFC',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 600, color: '#0F172A' }}>{occ.name}</span>{' '}
                                <span style={{ color: '#64748B', fontSize: '0.75rem' }}>({occ.jntuNo})</span>
                                {occ.bedNumber && (
                                  <span
                                    style={{
                                      marginLeft: '6px',
                                      padding: '1px 6px',
                                      backgroundColor: '#E2E8F0',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {occ.bedNumber}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '4px' }}>
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
                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                    {hasVacancy ? (
                      <button
                        type="button"
                        onClick={() => handleOpenAllocateModal(room.id, room.blockId)}
                        className="btn-secondary"
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem',
                          fontSize: '0.82rem',
                          color: '#0F766E',
                          borderColor: '#99F6E4',
                          backgroundColor: '#F0FDFA',
                        }}
                      >
                        <UserPlus size={14} />
                        <span>Allocate Available Bed</span>
                      </button>
                    ) : (
                      <div
                        style={{
                          textAlign: 'center',
                          fontSize: '0.78rem',
                          color: isFull ? '#64748B' : '#94A3B8',
                          padding: '0.4rem 0',
                        }}
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
        <div className="mgmt-card" style={{ overflowX: 'auto', padding: '0.5rem' }}>
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
            <table className="mgmt-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px 14px' }}>Student</th>
                  <th style={{ padding: '10px 14px' }}>JNTU No</th>
                  <th style={{ padding: '10px 14px' }}>Block & Room</th>
                  <th style={{ padding: '10px 14px' }}>Bed</th>
                  <th style={{ padding: '10px 14px' }}>Allocated Date</th>
                  <th style={{ padding: '10px 14px' }}>Vacated Date</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc) => {
                  const isActive = alloc.status === 'ACTIVE';

                  return (
                    <tr key={alloc.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0F172A' }}>
                        {alloc.student.name}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{alloc.student.jntuNo}</td>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>
                        {alloc.room.block.name} - Room {alloc.room.roomNumber}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{alloc.bedNumber || 'Auto'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748B', fontSize: '0.82rem' }}>
                        {new Date(alloc.allocatedAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748B', fontSize: '0.82rem' }}>
                        {alloc.vacatedAt ? new Date(alloc.vacatedAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor:
                              alloc.status === 'ACTIVE'
                                ? '#DEF7EC'
                                : alloc.status === 'VACATED'
                                ? '#FEE2E2'
                                : '#FEF3C7',
                            color:
                              alloc.status === 'ACTIVE'
                                ? '#03543F'
                                : alloc.status === 'VACATED'
                                ? '#991B1B'
                                : '#92400E',
                          }}
                        >
                          {alloc.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
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
