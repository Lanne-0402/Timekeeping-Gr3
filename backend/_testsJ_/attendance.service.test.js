import {
  handleCheckInService,
  handleCheckOutService,
  fetchHistoryService,
  fetchSummaryService
} from '../services/attendance.service.js';

// Mock Firebase
jest.mock('../config/firebase.js', () => ({
  __esModule: true,
  default: {
    collection: jest.fn()
  }
}));

import db from '../config/firebase.js';

describe('Attendance Service Logic', () => {
  let mockCollection;
  let mockDoc;
  let mockGet;
  let mockSet;
  let mockUpdate;
  let mockWhere;
  let mockLimit;

  beforeEach(() => {
    // 1. Reset mọi mock
    jest.clearAllMocks();

    // 2. Kích hoạt Fake Timers
    jest.useFakeTimers();
    // Đặt thời gian mặc định: 08:00 ngày 20/03/2024
    jest.setSystemTime(new Date('2024-03-20T08:00:00.000Z'));

    // 3. Setup Firebase Mock
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockUpdate = jest.fn().mockResolvedValue(undefined);
    mockGet = jest.fn();
    mockLimit = jest.fn();
    mockWhere = jest.fn();
    mockDoc = jest.fn();
    mockCollection = jest.fn();

    db.collection = mockCollection;
    
    // Chain: db.collection().doc()
    // Chain: db.collection().where()
    mockCollection.mockReturnValue({ 
      doc: mockDoc,
      where: mockWhere 
    });

    // Chain: .doc().get/set/update
    mockDoc.mockReturnValue({ 
      get: mockGet, 
      set: mockSet,
      update: mockUpdate
    });

    // Chain: .where().where().limit().get()
    mockWhere.mockReturnValue({ 
      where: mockWhere,
      limit: mockLimit,
      get: mockGet
    });
    
    mockLimit.mockReturnValue({ get: mockGet });
  });

  afterEach(() => {
    // Trả lại đồng hồ thật sau mỗi bài test
    jest.useRealTimers();
  });

  describe('1. Logic Check-In', () => {
    const userId = 'user123';
    // Code service dùng today() -> new Date(), nên nó sẽ lấy theo giờ Mock ở trên (20/03/2024)

    it('Should create attendance record correctly when user has a shift', async () => {
      const todayStr = '2024-03-20';
      const docId = `${userId}_${todayStr}`;
      
      // Mock: Chưa check-in
      mockGet.mockResolvedValueOnce({ exists: false });

      // Mock: Có ca làm việc
      const mockShiftData = { 
        shiftId: 'SHIFT_MORNING', 
        shiftName: 'Ca Sáng',
        userId: userId,
        date: todayStr
      };
      // Giả lập tìm thấy ca
      mockGet.mockResolvedValueOnce({ 
        empty: false, 
        docs: [{ data: () => mockShiftData }] 
      });

      const result = await handleCheckInService(userId);

      expect(result.success).toBe(true);
      expect(result.data.docId).toBe(docId);
      
      expect(mockSet).toHaveBeenCalledWith({
        docId: docId,
        userId: userId,
        date: todayStr,
        shiftId: 'SHIFT_MORNING',
        shiftName: 'Ca Sáng',
        checkInAt: expect.any(String),
        checkOutAt: null,
        workSeconds: 0,
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
    });

    it('Should BLOCK check-in if user has NO shift today', async () => {
      // Mock: Chưa check-in
      mockGet.mockResolvedValueOnce({ exists: false });

      // Mock: Không tìm thấy ca (empty)
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

      const result = await handleCheckInService(userId);

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/không có ca làm/i);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('Should BLOCK if already checked-in', async () => {
      // Mock: Đã check-in
      mockGet.mockResolvedValueOnce({ exists: true });

      const result = await handleCheckInService(userId);

      expect(result.success).toBe(false);
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('2. Logic Check-Out (Work Seconds Calculation)', () => {
    const userId = 'user123';
    
    it('Should calculate workSeconds EXACTLY correct', async () => {
      // Setup: Giờ hệ thống đang là 08:00 (do beforeEach set)
      const checkInTimeStr = '2024-03-20T08:00:00.000Z';
      
      // Mock DB trả về record đã check-in lúc 08:00
      mockGet.mockResolvedValue({ 
        exists: true, 
        data: () => ({
          checkInAt: checkInTimeStr,
          checkOutAt: null
        }) 
      });

      // --- Tua đồng hồ đến 17:30 ---
      jest.setSystemTime(new Date('2024-03-20T17:30:00.000Z'));

      // Thực thi hàm (bên trong hàm sẽ gọi new Date() -> lấy ra 17:30)
      const result = await handleCheckOutService(userId);

      expect(result.success).toBe(true);
      
      // Tính toán: 17:30 - 08:00 = 9.5 tiếng = 34200 giây
      // Vì dùng fake timers nên kết quả phải chính xác tuyệt đối
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        workSeconds: 34200, 
        checkOutAt: '2024-03-20T17:30:00.000Z' 
      }));
    });

    it('Should fail if not checked-in yet', async () => {
      mockGet.mockResolvedValue({ exists: false });
      const result = await handleCheckOutService(userId);
      expect(result.success).toBe(false);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('Should fail if already checked-out', async () => {
      mockGet.mockResolvedValue({ 
        exists: true, 
        data: () => ({ checkInAt: '...', checkOutAt: 'some-date' }) 
      });
      const result = await handleCheckOutService(userId);
      expect(result.success).toBe(false);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('3. History & Summary Logic', () => {
    const userId = 'user123';

    it('fetchSummaryService: Should count daysWorked/daysOff correctly', async () => {
      
      const mockShifts = [
        { data: () => ({ date: '2024-03-01' }) },
        { data: () => ({ date: '2024-03-02' }) },
        { data: () => ({ date: '2024-03-03' }) }
      ];

      const mockAttendance = [
        { data: () => ({ date: '2024-03-01' }) },
        { data: () => ({ date: '2024-03-03' }) }
      ];

      mockGet
        .mockResolvedValueOnce({ docs: mockShifts })
        .mockResolvedValueOnce({ docs: mockAttendance });

      const result = await fetchSummaryService(userId);

      expect(result.daysWorked).toBe(2);
      expect(result.daysOff).toBe(1);
    });

    it('fetchHistoryService: Should calculate workMinutes from workSeconds', async () => {
      const mockDocs = [{
        data: () => ({
          date: '2024-03-15',
          checkInAt: '...',
          checkOutAt: '...',
          workSeconds: 32400,
          note: ''
        })
      }];

      mockGet.mockResolvedValue({ docs: mockDocs });

      const result = await fetchHistoryService(userId);

      expect(result[0].workMinutes).toBe(540);
    });
  });
});