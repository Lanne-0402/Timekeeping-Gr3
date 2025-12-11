import {
  handleCheckInService,
  handleCheckOutService,
  fetchHistoryService,
  fetchSummaryService,
  adminFetchAllAttendanceService,
  adminFetchOneAttendanceService,
  adminUpdateAttendanceService,
  getUserCalendarService
} from '../services/attendance.service.js';

// Mock Firebase
jest.mock('../config/firebase.js', () => ({
  _esModule: true,
  default: {
    collection: jest.fn()
  }
}));

import db from '../config/firebase.js';

describe('Attendance Service', () => {
  let mockCollection;
  let mockDoc;
  let mockGet;
  let mockSet;
  let mockUpdate;
  let mockWhere;
  let mockLimit;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock chain
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockUpdate = jest.fn().mockResolvedValue(undefined);
    mockGet = jest.fn();
    mockLimit = jest.fn();
    mockWhere = jest.fn();
    mockDoc = jest.fn();
    mockCollection = jest.fn();

    db.collection = mockCollection;
  });

  describe('handleCheckInService', () => {
    const userId = 'user123';
    const today = new Date().toISOString().split('T')[0];
    const docId = `${userId}_${today}`;

    it('should successfully check in user when not already checked in', async () => {
      const mockShiftData = {
        shiftId: 'shift1',
        shiftName: 'Morning Shift'
      };

      // Mock attendance check (not exists)
      mockGet.mockResolvedValueOnce({ exists: false });
      
      // Mock shift query
      const mockShiftDocs = [{ data: () => mockShiftData }];
      mockGet.mockResolvedValueOnce({ empty: false, docs: mockShiftDocs });

      mockDoc.mockReturnValue({ get: mockGet, set: mockSet });
      mockLimit.mockReturnValue({ get: mockGet });
      mockWhere.mockReturnValue({ 
        where: mockWhere,
        limit: mockLimit 
      });
      mockCollection.mockReturnValue({ 
        doc: mockDoc,
        where: mockWhere 
      });

      const result = await handleCheckInService(userId);

      expect(result.success).toBe(true);
      expect(result.data.docId).toBe(docId);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          docId,
          userId,
          date: today,
          shiftId: 'shift1',
          shiftName: 'Morning Shift',
          checkOutAt: null,
          workSeconds: 0
        })
      );
    });

    it('should fail when user already checked in today', async () => {
      mockGet.mockResolvedValue({ exists: true });
      mockDoc.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ doc: mockDoc });

      const result = await handleCheckInService(userId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('check-in');
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('should check in without shift if no shift assigned', async () => {
      mockGet.mockResolvedValueOnce({ exists: false });
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

      mockDoc.mockReturnValue({ get: mockGet, set: mockSet });
      mockLimit.mockReturnValue({ get: mockGet });
      mockWhere.mockReturnValue({ 
        where: mockWhere,
        limit: mockLimit 
      });
      mockCollection.mockReturnValue({ 
        doc: mockDoc,
        where: mockWhere 
      });

      const result = await handleCheckInService(userId);

      expect(result.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          shiftId: null,
          shiftName: null
        })
      );
    });
  });

  describe('handleCheckOutService', () => {
    const userId = 'user123';
    const today = new Date().toISOString().split('T')[0];
    const docId = `${userId}_${today}`;

    it('should successfully check out user', async () => {
      const checkInTime = new Date(Date.now() - 8 * 3600 * 1000).toISOString();
      const mockData = {
        checkInAt: checkInTime,
        checkOutAt: null
      };

      mockGet.mockResolvedValue({ 
        exists: true, 
        data: () => mockData 
      });
      mockDoc.mockReturnValue({ 
        get: mockGet, 
        update: mockUpdate 
      });
      mockCollection.mockReturnValue({ doc: mockDoc });

      const result = await handleCheckOutService(userId);

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          checkOutAt: expect.any(String),
          workSeconds: expect.any(Number)
        })
      );
    });

    it('should fail when user has not checked in', async () => {
      mockGet.mockResolvedValue({ exists: false });
      mockDoc.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ doc: mockDoc });

      const result = await handleCheckOutService(userId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('chưa check-in');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should fail when user already checked out', async () => {
      const mockData = {
        checkInAt: new Date().toISOString(),
        checkOutAt: new Date().toISOString()
      };

      mockGet.mockResolvedValue({ 
        exists: true, 
        data: () => mockData 
      });
      mockDoc.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ doc: mockDoc });

      const result = await handleCheckOutService(userId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('check-out');
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('fetchHistoryService', () => {
    const userId = 'user123';

    it('should return sorted attendance history', async () => {
      const mockDocs = [
        {
          data: () => ({
            date: '2024-03-15',
            checkInAt: '2024-03-15T08:00:00.000Z',
            checkOutAt: '2024-03-15T17:00:00.000Z',
            workSeconds: 32400,
            note: 'Regular day'
          })
        },
        {
          data: () => ({
            date: '2024-03-14',
            checkInAt: '2024-03-14T08:30:00.000Z',
            checkOutAt: '2024-03-14T17:30:00.000Z',
            workSeconds: 32400
          })
        }
      ];

      mockGet.mockResolvedValue({ docs: mockDocs });
      mockWhere.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ where: mockWhere });

      const result = await fetchHistoryService(userId);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-03-14');
      expect(result[1].date).toBe('2024-03-15');
      expect(result[0].workMinutes).toBe(540);
      expect(result[1].note).toBe('Regular day');
    });

    it('should return empty array when no history', async () => {
      mockGet.mockResolvedValue({ docs: [] });
      mockWhere.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ where: mockWhere });

      const result = await fetchHistoryService(userId);

      expect(result).toEqual([]);
    });
  });

  describe('fetchSummaryService', () => {
    const userId = 'user123';

    it('should calculate correct days worked and days off', async () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const monthKey = `${yyyy}-${mm}`;

      // Mock shifts
      const mockShiftDocs = [
        { data: () => ({ date: `${monthKey}-01`, userId }) },
        { data: () => ({ date: `${monthKey}-02`, userId }) },
        { data: () => ({ date: `${monthKey}-03`, userId }) },
        { data: () => ({ date: `${monthKey}-04`, userId }) }
      ];

      // Mock attendance (only 3 days checked in)
      const mockAttDocs = [
        { data: () => ({ date: `${monthKey}-01`, userId }) },
        { data: () => ({ date: `${monthKey}-02`, userId }) },
        { data: () => ({ date: `${monthKey}-03`, userId }) }
      ];

      mockGet
        .mockResolvedValueOnce({ docs: mockShiftDocs })
        .mockResolvedValueOnce({ docs: mockAttDocs });

      mockWhere.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ where: mockWhere });

      const result = await fetchSummaryService(userId);

      expect(result.daysWorked).toBe(3);
      expect(result.daysOff).toBe(1);
    });

    it('should return zero when no shifts assigned', async () => {
      mockGet
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });

      mockWhere.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ where: mockWhere });

      const result = await fetchSummaryService(userId);

      expect(result.daysWorked).toBe(0);
      expect(result.daysOff).toBe(0);
    });
  });

  describe('adminFetchAllAttendanceService', () => {
    it('should return all attendance records sorted by date', async () => {
      const mockDocs = [
        { data: () => ({ date: '2024-03-15', userId: 'user1' }) },
        { data: () => ({ date: '2024-03-14', userId: 'user2' }) }
      ];

      mockGet.mockResolvedValue({ docs: mockDocs });
      mockCollection.mockReturnValue({ get: mockGet });

      const result = await adminFetchAllAttendanceService();

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-03-14');
      expect(result[1].date).toBe('2024-03-15');
    });
  });

  describe('adminFetchOneAttendanceService', () => {
    const docId = 'user123_2024-03-15';

    it('should return attendance record when exists', async () => {
      const mockData = { docId, userId: 'user123', date: '2024-03-15' };
      
      mockGet.mockResolvedValue({ 
        exists: true, 
        data: () => mockData 
      });
      mockDoc.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ doc: mockDoc });

      const result = await adminFetchOneAttendanceService(docId);

      expect(result).toEqual(mockData);
    });

    it('should return null when record does not exist', async () => {
      mockGet.mockResolvedValue({ exists: false });
      mockDoc.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ doc: mockDoc });

      const result = await adminFetchOneAttendanceService(docId);

      expect(result).toBeNull();
    });
  });

  describe('adminUpdateAttendanceService', () => {
    const docId = 'user123_2024-03-15';

    it('should successfully update attendance record', async () => {
      mockGet.mockResolvedValue({ exists: true });
      mockDoc.mockReturnValue({ 
        get: mockGet, 
        update: mockUpdate 
      });
      mockCollection.mockReturnValue({ doc: mockDoc });

      const updates = { workSeconds: 28800, note: 'Approved' };
      const result = await adminUpdateAttendanceService(docId, updates);

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updates,
          updatedAt: expect.any(String)
        })
      );
    });

    it('should fail when attendance record does not exist', async () => {
      mockGet.mockResolvedValue({ exists: false });
      mockDoc.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ doc: mockDoc });

      const result = await adminUpdateAttendanceService(docId, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('không tồn tại');
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getUserCalendarService', () => {
    const userId = 'user123';
    const month = '2024-03';

    it('should return comprehensive calendar with all statuses', async () => {
      // Mock shifts
      const mockShiftDocs = [
        { data: () => ({ date: '2024-03-01', userId, shiftId: 's1', shiftName: 'Morning' }) },
        { data: () => ({ date: '2024-03-02', userId, shiftId: 's2', shiftName: 'Evening' }) },
        { data: () => ({ date: '2024-03-03', userId, shiftId: 's3', shiftName: 'Morning' }) }
      ];

      // Mock attendance
      const mockAttDocs = [
        { 
          data: () => ({ 
            date: '2024-03-01', 
            userId,
            checkInAt: '2024-03-01T08:00:00.000Z',
            checkOutAt: '2024-03-01T17:00:00.000Z'
          })
        }
      ];

      // Mock requests
      const mockReqDocs = [
        { data: () => ({ date: '2024-03-02', userId, status: 'pending' }) }
      ];

      // Mock leaves
      const mockLeaveDocs = [
        { data: () => ({ date: '2024-03-03', userId, status: 'approved' }) }
      ];

      mockGet
        .mockResolvedValueOnce({ docs: mockShiftDocs })
        .mockResolvedValueOnce({ docs: mockAttDocs })
        .mockResolvedValueOnce({ docs: mockReqDocs })
        .mockResolvedValueOnce({ docs: mockLeaveDocs });

      mockWhere.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ where: mockWhere });

      const result = await getUserCalendarService(userId, month);

      expect(result['2024-03-01'].status).toBe('checked-full');
      expect(result['2024-03-02'].status).toBe('pending-request');
      expect(result['2024-03-03'].status).toBe('leave-approved');
    });

    it('should mark absent days correctly', async () => {
      const mockShiftDocs = [
        { data: () => ({ date: '2024-03-01', userId, shiftId: 's1' }) }
      ];

      mockGet
        .mockResolvedValueOnce({ docs: mockShiftDocs })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });

      mockWhere.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ where: mockWhere });

      const result = await getUserCalendarService(userId, month);

      expect(result['2024-03-01'].status).toBe('absent');
      expect(result['2024-03-01'].icon).toBe('X');
    });
  });
});