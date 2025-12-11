import {
  getHistory,
  getSummary,
  adminGetAllAttendance,
  adminGetOneAttendance,
  adminUpdateAttendance,
  getUserCalendar
} from '../controllers/attendance.controllers.js';
import * as attendanceService from '../services/attendance.service.js';

// Mock services
jest.mock('../services/attendance.service.js');

describe('Attendance Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      user: { userId: 'user123' },
      params: {},
      query: {},
      body: {}
    };

    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
  });

  describe('getHistory', () => {
    it('should return user attendance history successfully', async () => {
      const mockHistory = [
        {
          date: '2024-03-14',
          checkIn: '08:00',
          checkOut: '17:00',
          workMinutes: 540,
          note: ''
        },
        {
          date: '2024-03-15',
          checkIn: '08:30',
          checkOut: '17:30',
          workMinutes: 540,
          note: 'Regular day'
        }
      ];

      attendanceService.fetchHistoryService.mockResolvedValue(mockHistory);

      await getHistory(req, res);

      expect(attendanceService.fetchHistoryService).toHaveBeenCalledWith('user123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockHistory
      });
    });

    it('should return empty array when no history exists', async () => {
      attendanceService.fetchHistoryService.mockResolvedValue([]);

      await getHistory(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle service errors gracefully', async () => {
      attendanceService.fetchHistoryService.mockRejectedValue(new Error('Database error'));

      await getHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error'
      });
    });
  });

  describe('getSummary', () => {
    it('should return user attendance summary successfully', async () => {
      const mockSummary = {
        daysWorked: 15,
        daysOff: 2
      };

      attendanceService.fetchSummaryService.mockResolvedValue(mockSummary);

      await getSummary(req, res);

      expect(attendanceService.fetchSummaryService).toHaveBeenCalledWith('user123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSummary
      });
    });

    it('should return zero values when no attendance data', async () => {
      const mockSummary = {
        daysWorked: 0,
        daysOff: 0
      };

      attendanceService.fetchSummaryService.mockResolvedValue(mockSummary);

      await getSummary(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSummary
      });
    });

    it('should handle service errors gracefully', async () => {
      attendanceService.fetchSummaryService.mockRejectedValue(new Error('Database error'));

      await getSummary(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error'
      });
    });
  });

  describe('adminGetAllAttendance', () => {
    it('should return all attendance records successfully', async () => {
      const mockData = [
        { docId: 'user1_2024-03-14', userId: 'user1', date: '2024-03-14' },
        { docId: 'user2_2024-03-14', userId: 'user2', date: '2024-03-14' }
      ];

      attendanceService.adminFetchAllAttendanceService.mockResolvedValue(mockData);

      await adminGetAllAttendance(req, res);

      expect(attendanceService.adminFetchAllAttendanceService).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockData
      });
    });

    it('should return empty array when no records exist', async () => {
      attendanceService.adminFetchAllAttendanceService.mockResolvedValue([]);

      await adminGetAllAttendance(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle service errors gracefully', async () => {
      attendanceService.adminFetchAllAttendanceService.mockRejectedValue(new Error('Database error'));

      await adminGetAllAttendance(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error'
      });
    });
  });

  describe('adminGetOneAttendance', () => {
    it('should return attendance record when it exists', async () => {
      const docId = 'user123_2024-03-15';
      req.params.docId = docId;

      const mockData = {
        docId,
        userId: 'user123',
        date: '2024-03-15',
        checkInAt: '2024-03-15T08:00:00.000Z',
        checkOutAt: '2024-03-15T17:00:00.000Z',
        workSeconds: 32400
      };

      attendanceService.adminFetchOneAttendanceService.mockResolvedValue(mockData);

      await adminGetOneAttendance(req, res);

      expect(attendanceService.adminFetchOneAttendanceService).toHaveBeenCalledWith(docId);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockData
      });
    });

    it('should return 404 when record does not exist', async () => {
      req.params.docId = 'nonexistent_2024-03-15';

      attendanceService.adminFetchOneAttendanceService.mockResolvedValue(null);

      await adminGetOneAttendance(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Không tìm thấy'
      });
    });

    it('should handle service errors gracefully', async () => {
      req.params.docId = 'user123_2024-03-15';

      attendanceService.adminFetchOneAttendanceService.mockRejectedValue(new Error('Database error'));

      await adminGetOneAttendance(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error'
      });
    });
  });

  describe('adminUpdateAttendance', () => {
    it('should successfully update attendance record', async () => {
      const docId = 'user123_2024-03-15';
      req.params.docId = docId;
      req.body = {
        workSeconds: 28800,
        note: 'Approved by admin'
      };

      const mockResult = {
        success: true,
        message: 'Cập nhật thành công'
      };

      attendanceService.adminUpdateAttendanceService.mockResolvedValue(mockResult);

      await adminUpdateAttendance(req, res);

      expect(attendanceService.adminUpdateAttendanceService).toHaveBeenCalledWith(
        docId,
        req.body
      );
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should fail when record does not exist', async () => {
      req.params.docId = 'nonexistent_2024-03-15';
      req.body = { note: 'Test' };

      const mockResult = {
        success: false,
        message: 'Attendance không tồn tại'
      };

      attendanceService.adminUpdateAttendanceService.mockResolvedValue(mockResult);

      await adminUpdateAttendance(req, res);

      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle service errors gracefully', async () => {
      req.params.docId = 'user123_2024-03-15';
      req.body = { note: 'Test' };

      attendanceService.adminUpdateAttendanceService.mockRejectedValue(new Error('Database error'));

      await adminUpdateAttendance(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error'
      });
    });

    it('should pass all update fields to service', async () => {
      req.params.docId = 'user123_2024-03-15';
      req.body = {
        checkInAt: '2024-03-15T08:30:00.000Z',
        checkOutAt: '2024-03-15T17:30:00.000Z',
        workSeconds: 32400,
        note: 'Updated by admin'
      };

      attendanceService.adminUpdateAttendanceService.mockResolvedValue({
        success: true,
        message: 'Cập nhật thành công'
      });

      await adminUpdateAttendance(req, res);

      expect(attendanceService.adminUpdateAttendanceService).toHaveBeenCalledWith(
        'user123_2024-03-15',
        req.body
      );
    });
  });

  describe('getUserCalendar', () => {
    it('should return calendar data with valid month parameter', async () => {
      req.params.userId = 'user123';
      req.query.month = '2024-03';

      const mockCalendar = {
        '2024-03-01': {
          date: '2024-03-01',
          hasShift: true,
          shift: 'Morning',
          status: 'checked-full',
          icon: '✓',
          checkIn: '08:00',
          checkOut: '17:00'
        },
        '2024-03-02': {
          date: '2024-03-02',
          hasShift: true,
          shift: 'Evening',
          status: 'absent',
          icon: 'X',
          checkIn: null,
          checkOut: null
        }
      };

      attendanceService.getUserCalendarService.mockResolvedValue(mockCalendar);

      await getUserCalendar(req, res);

      expect(attendanceService.getUserCalendarService).toHaveBeenCalledWith('user123', '2024-03');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockCalendar
      });
    });

    it('should return 400 when month parameter is missing', async () => {
      req.params.userId = 'user123';
      req.query.month = undefined;

      await getUserCalendar(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Thiếu month (YYYY-MM).'
      });
      expect(attendanceService.getUserCalendarService).not.toHaveBeenCalled();
    });

    it('should return 400 when month parameter is empty string', async () => {
      req.params.userId = 'user123';
      req.query.month = '';

      await getUserCalendar(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Thiếu month (YYYY-MM).'
      });
    });

    it('should handle service errors gracefully', async () => {
      req.params.userId = 'user123';
      req.query.month = '2024-03';

      attendanceService.getUserCalendarService.mockRejectedValue(new Error('Database error'));

      await getUserCalendar(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error'
      });
    });

    it('should return empty object when no calendar data exists', async () => {
      req.params.userId = 'user123';
      req.query.month = '2024-03';

      attendanceService.getUserCalendarService.mockResolvedValue({});

      await getUserCalendar(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {}
      });
    });

    it('should accept different month formats', async () => {
      req.params.userId = 'user123';
      req.query.month = '2024-12';

      attendanceService.getUserCalendarService.mockResolvedValue({});

      await getUserCalendar(req, res);

      expect(attendanceService.getUserCalendarService).toHaveBeenCalledWith('user123', '2024-12');
    });
  });
});