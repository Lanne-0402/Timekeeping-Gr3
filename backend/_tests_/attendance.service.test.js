// __tests__/services/attendance.service.test.js
import {
  handleCheckInService,
  handleCheckOutService,
  fetchHistoryService,
  fetchSummaryService,
  adminFetchAllAttendanceService,
  adminFetchOneAttendanceService,
  adminUpdateAttendanceService,
  getUserCalendarService,
} from "../backend/services/attendance.service.js";

// Mock Firebase
jest.mock("../backend/config/firebase.js", () => {
  const mockCollection = jest.fn();
  return {
    default: {
      collection: mockCollection,
    },
  };
});

import db from "../backend/config/firebase.js";

describe("Attendance Service Tests", () => {
  let mockDoc;
  let mockRef;
  let mockCollection;
  let mockQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset date to a fixed point for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));

    // Setup mock chain
    mockDoc = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockRef = {
      doc: jest.fn(() => mockDoc),
      get: jest.fn(),
      where: jest.fn(),
      limit: jest.fn(),
    };

    mockQuery = {
      where: jest.fn(),
      limit: jest.fn(),
      get: jest.fn(),
    };

    mockCollection = jest.fn(() => mockRef);
    db.collection = mockCollection;

    // Chain query methods
    mockRef.where.mockReturnValue(mockQuery);
    mockQuery.where.mockReturnValue(mockQuery);
    mockQuery.limit.mockReturnValue(mockQuery);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ==========================================
  // CHECK-IN TESTS
  // ==========================================
  describe("handleCheckInService", () => {
    test("should successfully check in when no prior check-in exists", async () => {
      const userId = "user123";
      
      // Mock attendance doesn't exist
      mockDoc.get.mockResolvedValue({ exists: false });
      
      // Mock shift query
      mockQuery.get.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({
              shiftId: "shift001",
              shiftName: "Morning Shift",
            }),
          },
        ],
      });

      mockDoc.set.mockResolvedValue();

      const result = await handleCheckInService(userId);

      expect(result.success).toBe(true);
      expect(result.data.docId).toBe("user123_2025-01-15");
      expect(mockDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          docId: "user123_2025-01-15",
          userId: "user123",
          date: "2025-01-15",
          shiftId: "shift001",
          shiftName: "Morning Shift",
          checkInAt: expect.any(String),
          checkOutAt: null,
          workSeconds: 0,
        })
      );
    });

    test("should fail check-in if already checked in today", async () => {
      const userId = "user123";

      // Mock attendance already exists
      mockDoc.get.mockResolvedValue({ exists: true });

      const result = await handleCheckInService(userId);

      expect(result.success).toBe(false);
      expect(result.message).toContain("check-in");
      expect(mockDoc.set).not.toHaveBeenCalled();
    });

    test("should check in without shift if no shift assigned", async () => {
      const userId = "user123";

      mockDoc.get.mockResolvedValue({ exists: false });
      
      // Mock no shift found
      mockQuery.get.mockResolvedValue({ empty: true });
      mockDoc.set.mockResolvedValue();

      const result = await handleCheckInService(userId);

      expect(result.success).toBe(true);
      expect(mockDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          shiftId: null,
          shiftName: null,
        })
      );
    });
  });

  // ==========================================
  // CHECK-OUT TESTS
  // ==========================================
  describe("handleCheckOutService", () => {
    test("should successfully check out after check-in", async () => {
      const userId = "user123";
      const checkInTime = "2025-01-15T08:00:00.000Z";

      // Mock attendance exists without checkout
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          docId: "user123_2025-01-15",
          userId: "user123",
          date: "2025-01-15",
          checkInAt: checkInTime,
          checkOutAt: null,
          workSeconds: 0,
        }),
      });

      mockDoc.update.mockResolvedValue();

      const result = await handleCheckOutService(userId);

      expect(result.success).toBe(true);
      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          checkOutAt: expect.any(String),
          workSeconds: expect.any(Number),
          updatedAt: expect.any(String),
        })
      );

      // Verify work seconds calculation (10:30 - 08:00 = 2.5 hours = 9000 seconds)
      const updateCall = mockDoc.update.mock.calls[0][0];
      expect(updateCall.workSeconds).toBe(9000);
    });

    test("should fail check-out if not checked in yet", async () => {
      const userId = "user123";

      mockDoc.get.mockResolvedValue({ exists: false });

      const result = await handleCheckOutService(userId);

      expect(result.success).toBe(false);
      expect(result.message).toContain("chưa check-in");
      expect(mockDoc.update).not.toHaveBeenCalled();
    });

    test("should fail check-out if already checked out", async () => {
      const userId = "user123";

      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          checkInAt: "2025-01-15T08:00:00.000Z",
          checkOutAt: "2025-01-15T17:00:00.000Z",
        }),
      });

      const result = await handleCheckOutService(userId);

      expect(result.success).toBe(false);
      expect(result.message).toContain("check-out");
      expect(mockDoc.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // HISTORY TESTS
  // ==========================================
  describe("fetchHistoryService", () => {
    test("should fetch and format attendance history", async () => {
      const userId = "user123";

      mockRef.get.mockResolvedValue({
        docs: [
          {
            data: () => ({
              date: "2025-01-15",
              checkInAt: "2025-01-15T08:00:00.000Z",
              checkOutAt: "2025-01-15T17:00:00.000Z",
              workSeconds: 32400, // 9 hours
              note: "Regular day",
            }),
          },
          {
            data: () => ({
              date: "2025-01-14",
              checkInAt: "2025-01-14T08:30:00.000Z",
              checkOutAt: "2025-01-14T16:30:00.000Z",
              workSeconds: 28800, // 8 hours
              note: "",
            }),
          },
        ],
      });

      const result = await fetchHistoryService(userId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: "2025-01-14",
        checkIn: expect.any(String),
        checkOut: expect.any(String),
        workMinutes: 480,
        note: "",
      });
      expect(result[1]).toEqual({
        date: "2025-01-15",
        checkIn: expect.any(String),
        checkOut: expect.any(String),
        workMinutes: 540,
        note: "Regular day",
      });
    });

    test("should return empty array if no history", async () => {
      const userId = "user123";

      mockRef.get.mockResolvedValue({ docs: [] });

      const result = await fetchHistoryService(userId);

      expect(result).toEqual([]);
    });
  });

  // ==========================================
  // SUMMARY TESTS
  // ==========================================
  describe("fetchSummaryService", () => {
    test("should calculate correct summary stats", async () => {
      const userId = "user123";

      // Mock shift data - 20 days with shifts in January
      const shiftDocs = Array.from({ length: 20 }, (_, i) => ({
        data: () => ({ date: `2025-01-${String(i + 1).padStart(2, "0")}` }),
      }));

      // Mock attendance data - attended 18 days
      const attendanceDocs = Array.from({ length: 18 }, (_, i) => ({
        data: () => ({ date: `2025-01-${String(i + 1).padStart(2, "0")}` }),
      }));

      // First call for shifts
      mockRef.get.mockResolvedValueOnce({ docs: shiftDocs });
      // Second call for attendance
      mockRef.get.mockResolvedValueOnce({ docs: attendanceDocs });

      const result = await fetchSummaryService(userId);

      expect(result.daysWorked).toBe(18);
      expect(result.daysOff).toBe(2); // 20 shifts - 18 attended
    });

    test("should return zero if no data", async () => {
      const userId = "user123";

      mockRef.get.mockResolvedValue({ docs: [] });

      const result = await fetchSummaryService(userId);

      expect(result.daysWorked).toBe(0);
      expect(result.daysOff).toBe(0);
    });
  });

  // ==========================================
  // ADMIN TESTS
  // ==========================================
  describe("Admin Functions", () => {
    test("adminFetchAllAttendanceService should fetch all records", async () => {
      const mockDocs = [
        { data: () => ({ docId: "doc1", date: "2025-01-15" }) },
        { data: () => ({ docId: "doc2", date: "2025-01-14" }) },
      ];

      mockRef.get.mockResolvedValue({ docs: mockDocs });

      const result = await adminFetchAllAttendanceService();

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe("2025-01-14");
      expect(result[1].date).toBe("2025-01-15");
    });

    test("adminFetchOneAttendanceService should fetch single record", async () => {
      const docId = "user123_2025-01-15";

      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          docId,
          userId: "user123",
          date: "2025-01-15",
        }),
      });

      const result = await adminFetchOneAttendanceService(docId);

      expect(result).toEqual({
        docId,
        userId: "user123",
        date: "2025-01-15",
      });
    });

    test("adminFetchOneAttendanceService should return null if not found", async () => {
      const docId = "nonexistent";

      mockDoc.get.mockResolvedValue({ exists: false });

      const result = await adminFetchOneAttendanceService(docId);

      expect(result).toBeNull();
    });

    test("adminUpdateAttendanceService should update record", async () => {
      const docId = "user123_2025-01-15";
      const updates = { note: "Updated by admin" };

      mockDoc.get.mockResolvedValue({ exists: true });
      mockDoc.update.mockResolvedValue();

      const result = await adminUpdateAttendanceService(docId, updates);

      expect(result.success).toBe(true);
      expect(mockDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          note: "Updated by admin",
          updatedAt: expect.any(String),
        })
      );
    });

    test("adminUpdateAttendanceService should fail if record not found", async () => {
      const docId = "nonexistent";

      mockDoc.get.mockResolvedValue({ exists: false });

      const result = await adminUpdateAttendanceService(docId, {});

      expect(result.success).toBe(false);
      expect(mockDoc.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // CALENDAR TESTS
  // ==========================================
  describe("getUserCalendarService", () => {
    test("should build complete calendar with all statuses", async () => {
      const userId = "user123";
      const month = "2025-01";

      // Mock shifts
      mockRef.get.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              userId,
              date: "2025-01-15",
              shiftId: "shift001",
              shiftName: "Morning",
            }),
          },
          {
            data: () => ({
              userId,
              date: "2025-01-16",
              shiftId: "shift002",
              shiftName: "Evening",
            }),
          },
          {
            data: () => ({
              userId,
              date: "2025-01-17",
              shiftId: "shift001",
              shiftName: "Morning",
            }),
          },
        ],
      });

      // Mock attendance
      mockRef.get.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              date: "2025-01-15",
              checkInAt: "2025-01-15T08:00:00.000Z",
              checkOutAt: "2025-01-15T17:00:00.000Z",
            }),
          },
        ],
      });

      // Mock requests
      mockRef.get.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              date: "2025-01-16",
              status: "pending",
            }),
          },
        ],
      });

      // Mock leaves
      mockRef.get.mockResolvedValueOnce({
        docs: [],
      });

      const result = await getUserCalendarService(userId, month);

      // Should have entries for 3 days
      expect(Object.keys(result)).toHaveLength(3);

      // Day with full attendance
      expect(result["2025-01-15"]).toEqual({
        date: "2025-01-15",
        hasShift: true,
        shift: "Morning",
        status: "checked-full",
        icon: "✓",
        checkIn: expect.any(String),
        checkOut: expect.any(String),
      });

      // Day with pending request
      expect(result["2025-01-16"]).toEqual({
        date: "2025-01-16",
        hasShift: true,
        shift: "Evening",
        status: "pending-request",
        icon: "!",
        checkIn: null,
        checkOut: null,
      });

      // Day with shift but no attendance (absent)
      expect(result["2025-01-17"]).toEqual({
        date: "2025-01-17",
        hasShift: true,
        shift: "Morning",
        status: "absent",
        icon: "X",
        checkIn: null,
        checkOut: null,
      });
    });

    test("should mark day as leave-approved", async () => {
      const userId = "user123";
      const month = "2025-01";

      mockRef.get.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              date: "2025-01-20",
              shiftId: "shift001",
            }),
          },
        ],
      });

      mockRef.get.mockResolvedValueOnce({ docs: [] }); // attendance
      mockRef.get.mockResolvedValueOnce({ docs: [] }); // requests

      mockRef.get.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              date: "2025-01-20",
              status: "approved",
            }),
          },
        ],
      });

      const result = await getUserCalendarService(userId, month);

      expect(result["2025-01-20"].status).toBe("leave-approved");
      expect(result["2025-01-20"].icon).toBe("P");
    });
  });
});