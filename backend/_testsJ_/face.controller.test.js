import {
  enrollFace,
  faceCheckIn,
  faceCheckOut
} from '../controllers/face.controllers.js';
import * as faceServices from '../services/face.services.js';
import * as attendanceService from '../services/attendance.service.js';

// Mock services
jest.mock('../services/face.services.js');
jest.mock('../services/attendance.service.js');

describe('Face Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      user: { userId: 'user123' },
      body: {}
    };

    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
  });

  describe('enrollFace', () => {
    it('should successfully enroll face with valid embedding', async () => {
      const embedding = new Array(128).fill(0.5);
      req.body = { embedding };

      faceServices.enrollFaceService.mockResolvedValue();

      await enrollFace(req, res);

      expect(faceServices.enrollFaceService).toHaveBeenCalledWith('user123', embedding);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Đăng ký FaceID thành công'
      });
    });

    it('should fail when embedding is missing', async () => {
      req.body = {};

      await enrollFace(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Thiếu dữ liệu FaceID'
      });
      expect(faceServices.enrollFaceService).not.toHaveBeenCalled();
    });

    it('should fail when embedding is not an array', async () => {
      req.body = { embedding: 'not-an-array' };

      await enrollFace(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Thiếu dữ liệu FaceID'
      });
    });

    it('should handle service errors gracefully', async () => {
      const embedding = new Array(128).fill(0.5);
      req.body = { embedding };

      faceServices.enrollFaceService.mockRejectedValue(new Error('Database error'));

      await enrollFace(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error khi đăng ký FaceID'
      });
    });
  });

  describe('faceCheckIn', () => {
    const embedding = new Array(128).fill(0.5);
    const lat = 10.7769;
    const lng = 106.7009;

    beforeEach(() => {
      req.body = { embedding, lat, lng };
    });

    it('should successfully check in when face and GPS are valid', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: true,
        faceDist: 0.3,
        gpsDist: 50
      });

      attendanceService.handleCheckInService.mockResolvedValue({
        success: true,
        data: { docId: 'user123_2024-03-15' }
      });

      await faceCheckIn(req, res);

      expect(faceServices.faceCheckService).toHaveBeenCalledWith('user123', embedding, lat, lng);
      expect(attendanceService.handleCheckInService).toHaveBeenCalledWith('user123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Check-in FaceID thành công',
        data: {
          docId: 'user123_2024-03-15',
          faceDist: 0.3,
          gpsDist: 50
        }
      });
    });

    it('should fail when face recognition fails', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: false,
        message: 'Khuôn mặt không khớp'
      });

      await faceCheckIn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Khuôn mặt không khớp'
      });
      expect(attendanceService.handleCheckInService).not.toHaveBeenCalled();
    });

    it('should fail when GPS is out of range', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: false,
        message: 'Bạn đang ngoài khu vực làm việc'
      });

      await faceCheckIn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bạn đang ngoài khu vực làm việc'
      });
      expect(attendanceService.handleCheckInService).not.toHaveBeenCalled();
    });

    it('should fail when user has not enrolled face', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: false,
        message: 'Chưa đăng ký khuôn mặt'
      });

      await faceCheckIn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(attendanceService.handleCheckInService).not.toHaveBeenCalled();
    });

    it('should fail when user already checked in today', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: true,
        faceDist: 0.3,
        gpsDist: 50
      });

      attendanceService.handleCheckInService.mockResolvedValue({
        success: false,
        message: 'Bạn đã check-in hôm nay rồi.'
      });

      await faceCheckIn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bạn đã check-in hôm nay rồi.'
      });
    });

    it('should use default error message when faceCheck message is missing', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: false
      });

      await faceCheckIn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'FaceID hoặc vị trí không hợp lệ'
      });
    });

    it('should handle service errors gracefully', async () => {
      faceServices.faceCheckService.mockRejectedValue(new Error('Service error'));

      await faceCheckIn(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error khi check-in'
      });
    });
  });

  describe('faceCheckOut', () => {
    const embedding = new Array(128).fill(0.5);
    const lat = 10.7769;
    const lng = 106.7009;

    beforeEach(() => {
      req.body = { embedding, lat, lng };
    });

    it('should successfully check out when face and GPS are valid', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: true,
        faceDist: 0.3,
        gpsDist: 50
      });

      attendanceService.handleCheckOutService.mockResolvedValue({
        success: true,
        data: { docId: 'user123_2024-03-15' }
      });

      await faceCheckOut(req, res);

      expect(faceServices.faceCheckService).toHaveBeenCalledWith('user123', embedding, lat, lng);
      expect(attendanceService.handleCheckOutService).toHaveBeenCalledWith('user123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Check-out FaceID thành công',
        data: {
          docId: 'user123_2024-03-15',
          faceDist: 0.3,
          gpsDist: 50
        }
      });
    });

    it('should fail when face recognition fails', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: false,
        message: 'Khuôn mặt không khớp'
      });

      await faceCheckOut(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Khuôn mặt không khớp'
      });
      expect(attendanceService.handleCheckOutService).not.toHaveBeenCalled();
    });

    it('should fail when GPS is out of range', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: false,
        message: 'Bạn đang ngoài khu vực làm việc'
      });

      await faceCheckOut(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(attendanceService.handleCheckOutService).not.toHaveBeenCalled();
    });

    it('should fail when user has not checked in yet', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: true,
        faceDist: 0.3,
        gpsDist: 50
      });

      attendanceService.handleCheckOutService.mockResolvedValue({
        success: false,
        message: 'Bạn chưa check-in hôm nay.'
      });

      await faceCheckOut(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bạn chưa check-in hôm nay.'
      });
    });

    it('should fail when user already checked out', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: true,
        faceDist: 0.3,
        gpsDist: 50
      });

      attendanceService.handleCheckOutService.mockResolvedValue({
        success: false,
        message: 'Bạn đã check-out rồi.'
      });

      await faceCheckOut(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should use default error message when faceCheck message is missing', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: false
      });

      await faceCheckOut(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'FaceID hoặc vị trí không hợp lệ'
      });
    });

    it('should handle service errors gracefully', async () => {
      faceServices.faceCheckService.mockRejectedValue(new Error('Service error'));

      await faceCheckOut(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error khi check-out'
      });
    });

    it('should include faceDist and gpsDist in successful response', async () => {
      faceServices.faceCheckService.mockResolvedValue({
        success: true,
        faceDist: 0.25,
        gpsDist: 75
      });

      attendanceService.handleCheckOutService.mockResolvedValue({
        success: true,
        data: { docId: 'user123_2024-03-15' }
      });

      await faceCheckOut(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            faceDist: 0.25,
            gpsDist: 75
          })
        })
      );
    });
  });
});