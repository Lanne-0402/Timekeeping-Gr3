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
    collection: jest.fn(),
    batch: jest.fn()
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

describe('Shifts Service Logic', () => {
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

    // Setup Mock Functions cơ bản
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockUpdate = jest.fn().mockResolvedValue(undefined);
    mockDelete = jest.fn().mockResolvedValue(undefined);
    mockGet = jest.fn();
    mockWhere = jest.fn();
    mockOrderBy = jest.fn();
    mockDoc = jest.fn();
    mockCollection = jest.fn();
    
    // Setup Mock Batch
    mockBatch = {
      set: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined)
    };

    db.collection = mockCollection;
    db.batch = jest.fn(() => mockBatch);

    idGenerator.generateShiftCode.mockResolvedValue('CA001');

    mockCollection.mockReturnValue({ 
      doc: mockDoc,
      where: mockWhere,
      orderBy: mockOrderBy
    });
    mockDoc.mockReturnValue({ 
      set: mockSet, 
      get: mockGet, 
      update: mockUpdate, 
      delete: mockDelete 
    });
    mockWhere.mockReturnValue({ 
      where: mockWhere, 
      orderBy: mockOrderBy, 
      get: mockGet 
    });
    mockOrderBy.mockReturnValue({ get: mockGet });
  });

  // ==========================================
  // 1. CREATE SHIFT
  // ==========================================
  describe('createShiftService', () => {
    it('should create shift successfully with auto-generated name', async () => {
      const payload = {
        date: '2024-03-15',
        startTime: '08:00',
        endTime: '17:00'
      };

      const result = await createShiftService(payload);

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        shiftCode: 'CA001',
        name: 'Ca ngày 2024-03-15 (08:00-17:00)',
        date: '2024-03-15'
      }));
      expect(result.shiftCode).toBe('CA001');
    });

    it('should throw error if startTime or endTime is missing', async () => {
      await expect(createShiftService({ startTime: '08:00' }))
        .rejects.toThrow('Thiếu giờ bắt đầu hoặc kết thúc');
    });
  });

  // ==========================================
  // 2. ASSIGN SHIFT
  // ==========================================
  describe('assignShiftService', () => {
    beforeEach(() => {
      // Setup mặc định cho check trùng: Trả về empty (chưa có ca)
      mockGet.mockResolvedValue({ empty: true });
    });

    it('Should SUCCESS: Assign user to shift (No duplicate)', async () => {
      const payload = {
        userId: 'user123',
        shiftId: 'shift001',
        date: '2024-03-20'
      };

      const result = await assignShiftService(payload);

      expect(mockCollection).toHaveBeenCalledWith('user_shifts');
      expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user123');
      
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('Should THROW ERROR: If user already has a shift on that date', async () => {
      // Mock logic: Query tìm thấy bản ghi cũ (Duplicate)
      mockGet.mockResolvedValueOnce({ 
        empty: false, 
        docs: [{ data: () => ({ id: 'old_shift' }) }] 
      });

      const payload = {
        userId: 'user123',
        shiftId: 'shift_new',
        date: '2024-03-20'
      };

      await expect(assignShiftService(payload))
        .rejects.toThrow(/Nhân viên đã có ca trong ngày/);
      
      expect(mockBatch.commit).not.toHaveBeenCalled();
    });

    it('Should THROW ERROR: If trying to assign multiple shifts per day', async () => {
      const payload = {
        userId: 'user123',
        shiftIds: ['shift1', 'shift2'], 
        date: '2024-03-20'
      };

      await expect(assignShiftService(payload))
        .rejects.toThrow('Mỗi ngày chỉ được gán 1 ca làm duy nhất');
    });

    it('Should NORMALIZE date format (dd/mm/yyyy -> yyyy-mm-dd)', async () => {
      const payload = {
        userId: 'user123',
        shiftId: 'shift001',
        date: '20/11/2024' 
      };

      await assignShiftService(payload);

      const callArgs = mockBatch.set.mock.calls[0][1];
      expect(callArgs.date).toBe('2024-11-20');
    });
  });

  // ==========================================
  // 3. GET SHIFTS (Logic đếm nhân viên)
  // ==========================================
  describe('getShiftsService', () => {
    it('should return shifts with correct employee count', async () => {
      // Mock Shifts data
      const mockShifts = [
        { data: () => ({ id: 's1', name: 'Ca 1' }) },
        { data: () => ({ id: 's2', name: 'Ca 2' }) }
      ];

      // Mock User Shifts data (để đếm)
      // Ca s1 có 2 người, ca s2 có 1 người
      const mockUserShifts = [
        { data: () => ({ shiftId: 's1' }) },
        { data: () => ({ shiftId: 's1' }) },
        { data: () => ({ shiftId: 's2' }) }
      ];
      mockGet
        .mockResolvedValueOnce({ docs: mockShifts })     
        .mockResolvedValueOnce({ docs: mockUserShifts }); 

      const result = await getShiftsService('2024-03');

      expect(result).toHaveLength(2);
      expect(result[0].employeeCount).toBe(2); 
      expect(result[1].employeeCount).toBe(1); 
    });
  });

  // ==========================================
  // 4. GET EMPLOYEES IN SHIFT
  // ==========================================
  describe('getEmployeesInShiftService', () => {
    it('should return employee details with employeeCode', async () => {
      // 1. Mock user_shifts
      const mockAssignments = [
        { data: () => ({ userId: 'u1', shiftId: 's1' }) },
        { data: () => ({ userId: 'u2', shiftId: 's1' }) }
      ];

      // 2. Mock users info (IN query)
      const mockUsers = [
        { id: 'u1', data: () => ({ name: 'Alice', employeeCode: 'NV01' }) },
        { id: 'u2', data: () => ({ name: 'Bob', employeeCode: 'NV02' }) }
      ];

      mockGet
        .mockResolvedValueOnce({ docs: mockAssignments }) 
        .mockResolvedValueOnce({ docs: mockUsers });      

      const result = await getEmployeesInShiftService('s1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'u1',
        name: 'Alice',
        employeeCode: 'NV01'
      });
      expect(result[1]).toEqual({
        id: 'u2',
        name: 'Bob',
        employeeCode: 'NV02'
      });
    });
  });

  // ==========================================
  // 5. OTHER UTILS
  // ==========================================
  describe('addEmployeeToShiftService', () => {
    it('should check duplicate before adding', async () => {
      // Mock: Lấy thông tin ca (tồn tại)
      mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ date: '2024-03-20' }) });
      
      // Mock: Kiểm tra user_shifts -> Tìm thấy (Duplicate)
      mockGet.mockResolvedValueOnce({ empty: false });

      await expect(addEmployeeToShiftService('s1', 'u1'))
        .rejects.toThrow('Nhân viên đã được gán vào ca này rồi');
    });

    it('should success if not duplicate', async () => {
      // Mock: Ca tồn tại
      mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ date: '2024-03-20' }) });
      
      // Mock: Chưa có trong ca (Empty)
      mockGet.mockResolvedValueOnce({ empty: true });

      const result = await addEmployeeToShiftService('s1', 'u1');
      
      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe('getUserShiftsService', () => {
    it('should filter by month correctly', async () => {
      const mockDocs = [
        { data: () => ({ userId: 'u1', shiftId: 's1', date: '2024-11-20' }) }, 
        { data: () => ({ userId: 'u1', shiftId: 's2', date: '2024-12-01' }) } 
      ];

      mockGet.mockResolvedValueOnce({ empty: false, docs: mockDocs });
      
      mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ name: 'Ca Sáng' }) });

      const result = await getUserShiftsService('u1', '2024-11');

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-11-20');
    });
  });

  describe('deleteShiftService', () => {
    it('should delete successfully', async () => {
      const result = await deleteShiftService('s1');
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('updateShiftService', () => {
    it('should update specific fields', async () => {
      await updateShiftService('s1', { startTime: '09:00' });
      expect(mockUpdate).toHaveBeenCalledWith({ startTime: '09:00' });
    });
  });
});