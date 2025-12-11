// backend/test/jest/shifts.service.test.js
import {
  createShiftService,
  getShiftsService,
  deleteShiftService,
  assignShiftService,
  getUserShiftsService,
  getShiftByIdService,
  getEmployeesInShiftService,
  updateShiftService,
  addEmployeeToShiftService,
  removeEmployeeFromShiftService
} from '../services/shifts.service.js';
import db from '../config/firebase.js';
import * as idGenerator from '../utils/idGenerator.js';

// Mock Firebase
jest.mock('../config/firebase.js', () => ({
  __esModule: true,
  default: {
    collection: jest.fn()
  }
}));

// Mock ID Generator
jest.mock('../utils/idGenerator.js');

// Mock firebase-admin Timestamp
jest.mock('firebase-admin', () => ({
  firestore: {
    Timestamp: {
      now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 }))
    }
  }
}));

describe('Shifts Service', () => {
  let mockCollection;
  let mockDoc;
  let mockGet;
  let mockSet;
  let mockUpdate;
  let mockDelete;
  let mockWhere;
  let mockOrderBy;
  let mockBatch;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSet = jest.fn().mockResolvedValue(undefined);
    mockUpdate = jest.fn().mockResolvedValue(undefined);
    mockDelete = jest.fn().mockResolvedValue(undefined);
    mockGet = jest.fn();
    mockWhere = jest.fn();
    mockOrderBy = jest.fn();
    mockDoc = jest.fn();
    mockCollection = jest.fn();
    mockBatch = {
      set: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined)
    };

    db.collection = mockCollection;
    db.batch = jest.fn(() => mockBatch);

    idGenerator.generateShiftCode.mockResolvedValue('CA001');
  });

  describe('createShiftService', () => {
    it('should create shift with all fields provided', async () => {
      const shiftRef = { id: 'shift123' };
      mockDoc.mockReturnValue(shiftRef);
      shiftRef.set = mockSet;
      mockCollection.mockReturnValue({ doc: mockDoc });

      const payload = {
        date: '2024-03-15',
        name: 'Morning Shift',
        startTime: '08:00',
        endTime: '17:00'
      };

      const result = await createShiftService(payload);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'shift123',
          shiftCode: 'CA001',
          name: 'Morning Shift',
          startTime: '08:00',
          endTime: '17:00',
          date: '2024-03-15'
        })
      );
      expect(result.shiftCode).toBe('CA001');
    });

    it('should generate name if not provided', async () => {
      const shiftRef = { id: 'shift123', set: mockSet };
      mockDoc.mockReturnValue(shiftRef);
      mockCollection.mockReturnValue({ doc: mockDoc });

      const payload = {
        date: '2024-03-15',
        startTime: '08:00',
        endTime: '17:00'
      };

      const result = await createShiftService(payload);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Ca ngày 2024-03-15 (08:00-17:00)'
        })
      );
    });

    it('should generate name without date if date not provided', async () => {
      const shiftRef = { id: 'shift123', set: mockSet };
      mockDoc.mockReturnValue(shiftRef);
      mockCollection.mockReturnValue({ doc: mockDoc });

      const payload = {
        startTime: '08:00',
        endTime: '17:00'
      };

      const result = await createShiftService(payload);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Ca (08:00-17:00)'
        })
      );
    });

    it('should throw error if startTime is missing', async () => {
      const payload = {
        endTime: '17:00'
      };

      await expect(createShiftService(payload)).rejects.toThrow('Thiếu giờ bắt đầu hoặc kết thúc');
    });

    it('should throw error if endTime is missing', async () => {
      const payload = {
        startTime: '08:00'
      };

      await expect(createShiftService(payload)).rejects.toThrow('Thiếu giờ bắt đầu hoặc kết thúc');
    });

    it('should trim whitespace from name', async () => {
      const shiftRef = { id: 'shift123', set: mockSet };
      mockDoc.mockReturnValue(shiftRef);
      mockCollection.mockReturnValue({ doc: mockDoc });

      const payload = {
        name: '  Morning Shift  ',
        startTime: '08:00',
        endTime: '17:00'
      };

      await createShiftService(payload);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Morning Shift'
        })
      );
    });

    it('should not include date field if date is not provided', async () => {
      const shiftRef = { id: 'shift123', set: mockSet };
      mockDoc.mockReturnValue(shiftRef);
      mockCollection.mockReturnValue({ doc: mockDoc });

      const payload = {
        name: 'Evening Shift',
        startTime: '18:00',
        endTime: '22:00'
      };

      await createShiftService(payload);

      const callArg = mockSet.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('date');
    });
  });

  describe('getShiftsService', () => {
    it('should return shifts with employee count', async () => {
      const mockShiftDocs = [
        { data: () => ({ id: 'shift1', name: 'Morning', startTime: '08:00', endTime: '17:00' }) },
        { data: () => ({ id: 'shift2', name: 'Evening', startTime: '18:00', endTime: '22:00' }) }
      ];

      mockGet
        .mockResolvedValueOnce({ docs: mockShiftDocs })
        .mockResolvedValueOnce({ size: 5 })
        .mockResolvedValueOnce({ size: 3 });

      mockOrderBy.mockReturnValue({ get: mockGet });
      mockWhere.mockReturnValue({ get: mockGet });
      mockCollection.mockImplementation((name) => {
        if (name === 'shifts') {
          return { orderBy: mockOrderBy };
        }
        return { where: mockWhere };
      });

      const result = await getShiftsService();

      expect(result).toHaveLength(2);
      expect(result[0].employeeCount).toBe(5);
      expect(result[1].employeeCount).toBe(3);
    });

    it('should return empty array when no shifts exist', async () => {
      mockGet.mockResolvedValue({ docs: [] });
      mockOrderBy.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ orderBy: mockOrderBy });

      const result = await getShiftsService();

      expect(result).toEqual([]);
    });
  });

  describe('deleteShiftService', () => {
    it('should delete shift successfully', async () => {
      mockDoc.mockReturnValue({ delete: mockDelete });
      mockCollection.mockReturnValue({ doc: mockDoc });

      const result = await deleteShiftService('shift123');

      expect(mockCollection).toHaveBeenCalledWith('shifts');
      expect(mockDoc).toHaveBeenCalledWith('shift123');
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should throw error if id is missing', async () => {
      await expect(deleteShiftService()).rejects.toThrow('Thiếu ID ca làm');
    });

    it('should throw error if id is empty string', async () => {
      await expect(deleteShiftService('')).rejects.toThrow('Thiếu ID ca làm');
    });
  });

  describe('assignShiftService', () => {
    beforeEach(() => {
      mockDoc.mockReturnValue({ id: 'assignment123' });
      mockCollection.mockReturnValue({ doc: mockDoc });
    });

    it('should assign single user to single shift', async () => {
      const payload = {
        userId: 'user123',
        shiftId: 'shift456',
        date: '2024-03-15'
      };

      const result = await assignShiftService(payload);

      expect(mockBatch.set).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: 'user123',
        shiftId: 'shift456',
        date: '2024-03-15'
      });
    });

    it('should assign multiple users to multiple shifts', async () => {
      const payload = {
        userIds: ['user1', 'user2'],
        shiftIds: ['shift1', 'shift2'],
        date: '2024-03-15'
      };

      const result = await assignShiftService(payload);

      expect(mockBatch.set).toHaveBeenCalledTimes(4); // 2 users × 2 shifts
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(result).toHaveLength(4);
    });

    it('should convert date format from dd/mm/yyyy to yyyy-mm-dd', async () => {
      const payload = {
        userId: 'user123',
        shiftId: 'shift456',
        date: '28/11/2025'
      };

      const result = await assignShiftService(payload);

      expect(result[0].date).toBe('2025-11-28');
    });

    it('should keep yyyy-mm-dd format unchanged', async () => {
      const payload = {
        userId: 'user123',
        shiftId: 'shift456',
        date: '2025-11-28'
      };

      const result = await assignShiftService(payload);

      expect(result[0].date).toBe('2025-11-28');
    });

    it('should throw error if date is missing', async () => {
      const payload = {
        userId: 'user123',
        shiftId: 'shift456'
      };

      await expect(assignShiftService(payload)).rejects.toThrow('Thiếu ngày gán ca');
    });

    it('should throw error if userIds are missing', async () => {
      const payload = {
        shiftIds: ['shift1'],
        date: '2024-03-15'
      };

      await expect(assignShiftService(payload)).rejects.toThrow('Thiếu userId');
    });

    it('should throw error if shiftIds are missing', async () => {
      const payload = {
        userIds: ['user1'],
        date: '2024-03-15'
      };

      await expect(assignShiftService(payload)).rejects.toThrow('Thiếu userId');
    });
  });

  describe('getUserShiftsService', () => {
    it('should return user shifts sorted by date descending', async () => {
      const mockDocs = [
        { data: () => ({ userId: 'user123', shiftId: 'shift1', date: '2024-03-15' }) },
        { data: () => ({ userId: 'user123', shiftId: 'shift2', date: '2024-03-20' }) },
        { data: () => ({ userId: 'user123', shiftId: 'shift3', date: '2024-03-10' }) }
      ];

      mockGet.mockResolvedValue({ docs: mockDocs });
      mockWhere.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ where: mockWhere });

      const result = await getUserShiftsService('user123');

      expect(result).toHaveLength(3);
      expect(result[0].date).toBe('2024-03-20'); // Most recent first
      expect(result[2].date).toBe('2024-03-10');
    });

    it('should throw error if userId is missing', async () => {
      await expect(getUserShiftsService()).rejects.toThrow('Thiếu userId');
    });

    it('should return empty array when user has no shifts', async () => {
      mockGet.mockResolvedValue({ docs: [] });
      mockWhere.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ where: mockWhere });

      const result = await getUserShiftsService('user123');

      expect(result).toEqual([]);
    });
  });

  describe('getShiftByIdService', () => {
    it('should return shift data when exists', async () => {
      const mockShiftData = {
        id: 'shift123',
        name: 'Morning Shift',
        startTime: '08:00',
        endTime: '17:00'
      };

      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockShiftData
      });
      mockDoc.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ doc: mockDoc });

      const result = await getShiftByIdService('shift123');

      expect(result).toEqual(mockShiftData);
    });

    it('should throw error if shift does not exist', async () => {
      mockGet.mockResolvedValue({ exists: false });
      mockDoc.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ doc: mockDoc });

      await expect(getShiftByIdService('shift123')).rejects.toThrow('Ca không tồn tại');
    });

    it('should throw error if shiftId is missing', async () => {
      await expect(getShiftByIdService()).rejects.toThrow('Thiếu ID ca');
    });
  });

  describe('getEmployeesInShiftService', () => {
    it('should return list of employees with names', async () => {
      const mockUserShiftDocs = [
        { data: () => ({ userId: 'user1', shiftId: 'shift123' }) },
        { data: () => ({ userId: 'user2', shiftId: 'shift123' }) }
      ];

      mockGet
        .mockResolvedValueOnce({ docs: mockUserShiftDocs })
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: 'John Doe' }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: 'Jane Smith' }) });

      mockWhere.mockReturnValue({ get: mockGet });
      mockDoc.mockReturnValue({ get: mockGet });
      mockCollection.mockImplementation((name) => {
        if (name === 'user_shifts') {
          return { where: mockWhere };
        }
        return { doc: mockDoc };
      });

      const result = await getEmployeesInShiftService('shift123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'user1', name: 'John Doe' });
      expect(result[1]).toEqual({ id: 'user2', name: 'Jane Smith' });
    });

    it('should return "Unknown" for users that do not exist', async () => {
      const mockUserShiftDocs = [
        { data: () => ({ userId: 'user1', shiftId: 'shift123' }) }
      ];

      mockGet
        .mockResolvedValueOnce({ docs: mockUserShiftDocs })
        .mockResolvedValueOnce({ exists: false });

      mockWhere.mockReturnValue({ get: mockGet });
      mockDoc.mockReturnValue({ get: mockGet });
      mockCollection.mockImplementation((name) => {
        if (name === 'user_shifts') {
          return { where: mockWhere };
        }
        return { doc: mockDoc };
      });

      const result = await getEmployeesInShiftService('shift123');

      expect(result[0].name).toBe('Unknown');
    });
  });

  describe('updateShiftService', () => {
    it('should update shift with provided fields', async () => {
      mockDoc.mockReturnValue({ update: mockUpdate });
      mockCollection.mockReturnValue({ doc: mockDoc });

      const payload = {
        date: '2024-03-20',
        startTime: '09:00',
        endTime: '18:00',
        name: 'Updated Shift'
      };

      const result = await updateShiftService('shift123', payload);

      expect(mockUpdate).toHaveBeenCalledWith({
        date: '2024-03-20',
        startTime: '09:00',
        endTime: '18:00',
        name: 'Updated Shift'
      });
      expect(result).toBe(true);
    });

    it('should only update provided fields', async () => {
      mockDoc.mockReturnValue({ update: mockUpdate });
      mockCollection.mockReturnValue({ doc: mockDoc });

      const payload = {
        startTime: '09:00'
      };

      await updateShiftService('shift123', payload);

      expect(mockUpdate).toHaveBeenCalledWith({
        startTime: '09:00'
      });
    });

    it('should handle empty payload', async () => {
      mockDoc.mockReturnValue({ update: mockUpdate });
      mockCollection.mockReturnValue({ doc: mockDoc });

      await updateShiftService('shift123', {});

      expect(mockUpdate).toHaveBeenCalledWith({});
    });
  });

  describe('addEmployeeToShiftService', () => {
    it('should add employee to shift successfully', async () => {
      const shiftData = {
        id: 'shift123',
        name: 'Morning Shift',
        date: '2024-03-15'
      };

      mockGet
        .mockResolvedValueOnce({ exists: true, data: () => shiftData })
        .mockResolvedValueOnce({ empty: true });

      const newDocRef = { id: 'assignment123', set: mockSet };
      mockDoc.mockReturnValue(newDocRef);
      mockWhere.mockReturnValue({ where: mockWhere, get: mockGet });
      mockCollection.mockImplementation((name) => {
        if (name === 'shifts') {
          return { doc: () => ({ get: mockGet }) };
        }
        return { where: mockWhere, doc: mockDoc };
      });

      const result = await addEmployeeToShiftService('shift123', 'user456');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          shiftId: 'shift123',
          userId: 'user456',
          date: '2024-03-15'
        })
      );
      expect(result).toBe(true);
    });

    it('should throw error if shift does not exist', async () => {
      mockGet.mockResolvedValue({ exists: false });
      mockDoc.mockReturnValue({ get: mockGet });
      mockCollection.mockReturnValue({ doc: mockDoc });

      await expect(addEmployeeToShiftService('shift123', 'user456'))
        .rejects.toThrow('Ca không tồn tại');
    });

    it('should throw error if employee already in shift', async () => {
      const shiftData = { id: 'shift123', date: '2024-03-15' };

      mockGet
        .mockResolvedValueOnce({ exists: true, data: () => shiftData })
        .mockResolvedValueOnce({ empty: false });

      mockDoc.mockReturnValue({ get: mockGet });
      mockWhere.mockReturnValue({ where: mockWhere, get: mockGet });
      mockCollection.mockImplementation((name) => {
        if (name === 'shifts') {
          return { doc: () => ({ get: mockGet }) };
        }
        return { where: mockWhere };
      });

      await expect(addEmployeeToShiftService('shift123', 'user456'))
        .rejects.toThrow('Nhân viên đã được gán vào ca này rồi');
    });

    it('should throw error if shiftId is missing', async () => {
      await expect(addEmployeeToShiftService(null, 'user456'))
        .rejects.toThrow('Thiếu shiftId hoặc userId');
    });

    it('should throw error if userId is missing', async () => {
      await expect(addEmployeeToShiftService('shift123', null))
        .rejects.toThrow('Thiếu shiftId hoặc userId');
    });
  });

  describe('removeEmployeeFromShiftService', () => {
    it('should remove employee from shift successfully', async () => {
      const mockDocs = [
        { ref: { path: 'doc1' } }
      ];

      mockGet.mockResolvedValue({ empty: false, docs: mockDocs, forEach: (callback) => mockDocs.forEach(callback) });
      mockWhere.mockReturnValue({ where: mockWhere, get: mockGet });
      mockCollection.mockReturnValue({ where: mockWhere });

      const result = await removeEmployeeFromShiftService('shift123', 'user456');

      expect(mockBatch.delete).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should throw error if employee not in shift', async () => {
      mockGet.mockResolvedValue({ empty: true });
      mockWhere.mockReturnValue({ where: mockWhere, get: mockGet });
      mockCollection.mockReturnValue({ where: mockWhere });

      await expect(removeEmployeeFromShiftService('shift123', 'user456'))
        .rejects.toThrow('Nhân viên không tồn tại trong ca này');
    });

    it('should throw error if shiftId is missing', async () => {
      await expect(removeEmployeeFromShiftService(null, 'user456'))
        .rejects.toThrow('Thiếu shiftId hoặc userId');
    });

    it('should throw error if userId is missing', async () => {
      await expect(removeEmployeeFromShiftService('shift123', null))
        .rejects.toThrow('Thiếu shiftId hoặc userId');
    });
  });
});