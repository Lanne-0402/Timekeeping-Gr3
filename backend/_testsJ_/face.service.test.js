// backend/test/jest/face.service.test.js
import {
  enrollFaceService,
  faceCheckService
} from '../services/face.services.js';
import db from '../config/firebase.js';

// Mock Firebase - UPDATE THIS PATH
jest.mock('../config/firebase.js', () => ({
  __esModule: true,
  default: {
    collection: jest.fn()
  }
}));

// Lưu lại env gốc
const originalEnv = process.env;

describe('Face Service', () => {
  let mockCollection;
  let mockDoc;
  let mockGet;
  let mockSet;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset về default 0.6 trước mỗi test
    process.env = { ...originalEnv, FACE_THRESHOLD: '0.6' };
    
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockGet = jest.fn();
    mockDoc = jest.fn();
    mockCollection = jest.fn();

    db.collection = mockCollection;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('enrollFaceService', () => {
    const userId = 'user123';
    const embedding = new Array(128).fill(0.5);

    it('should successfully enroll face with embedding', async () => {
      mockDoc.mockReturnValue({ set: mockSet });
      mockCollection.mockReturnValue({ doc: mockDoc });

      await enrollFaceService(userId, embedding);

      expect(mockCollection).toHaveBeenCalledWith('faceEmbeddings');
      expect(mockDoc).toHaveBeenCalledWith(userId);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          embedding,
          createdAt: expect.any(String),
          updatedAt: expect.any(String)
        })
      );
    });

    it('should update existing face embedding', async () => {
      const newEmbedding = new Array(128).fill(0.7);
      
      mockDoc.mockReturnValue({ set: mockSet });
      mockCollection.mockReturnValue({ doc: mockDoc });

      await enrollFaceService(userId, newEmbedding);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          embedding: newEmbedding
        })
      );
    });
  });

  describe('faceCheckService', () => {
    const userId = 'user123';
    // Giả lập embedding gốc
    const storedEmbedding = new Array(128).fill(0.5);
    // Embedding test hơi lệch 1 chút
    const testEmbedding = new Array(128).fill(0.51); 
    
    // Tọa độ giả lập (Quy Nhơn)
    const lat = 13.932548;
    const lng = 109.155862;

    const mockCompanySettings = {
      lat: 13.932548,
      lng: 109.155862,
      radius: 100
    };

    beforeEach(() => {
      // Mock faceEmbeddings collection
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ userId, embedding: storedEmbedding })
      });

      // Setup mock cho company settings
      const settingsGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => mockCompanySettings
      });

      mockDoc.mockImplementation((docId) => {
        if (docId === 'default') {
          return { get: settingsGet };
        }
        return { get: mockGet };
      });

      mockCollection.mockImplementation(() => {
        return { doc: mockDoc };
      });
    });

    it('should successfully validate face and GPS when all conditions met', async () => {
      const result = await faceCheckService(userId, testEmbedding, lat, lng);

      expect(result.success).toBe(true);
      // Khoảng cách euclidean của 0.5 vs 0.51 (128 chiều) ~ 0.113
      expect(result.faceDist).toBeLessThan(0.6);
      expect(result.gpsDist).toBeLessThan(100);
    });

    it('should fail when user has not enrolled face', async () => {
      mockGet.mockResolvedValue({ exists: false });
      const result = await faceCheckService(userId, testEmbedding, lat, lng);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/chưa|đăng ký|khuôn mặt/);
    });

    it('should fail when face does not match (distance > threshold)', async () => {
      const differentEmbedding = new Array(128).fill(5.0); // Rất khác biệt
      const result = await faceCheckService(userId, differentEmbedding, lat, lng);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Khuôn mặt|không khớp/);
    });

    it('should respect custom FACE_THRESHOLD from environment', async () => {
      // 1. Set threshold cực thấp (nghiêm ngặt)
      process.env.FACE_THRESHOLD = '0.05'; 
      
      // 2. Tạo embedding sai lệch một chút (như logic cũ: 0.52 vs 0.5)
      // Khoảng cách thực tế: sqrt(128 * (0.02)^2) = 0.226
      // 0.226 > 0.05 => Phải Fail
      const slightlyDifferent = new Array(128).fill(0.52);

      const result = await faceCheckService(userId, slightlyDifferent, lat, lng);

      // 3. Mong đợi thất bại vì 0.226 > 0.05
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Khuôn mặt|không khớp/);
    });
  });

  describe('Helper Functions - Integration', () => {
    it('should calculate euclidean distance correctly', async () => {
      const userId = 'user123';
      const embedding1 = [1, 2, 3];
      const embedding2 = [4, 5, 6];
      // Expected distance: sqrt((4-1)^2 + (5-2)^2 + (6-3)^2) = sqrt(27) ≈ 5.196

      const mockCompanySettings = {
        lat: 13.932548,
        lng: 109.155862,
        radius: 100
      };

      const mockGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ userId, embedding: embedding1 })
      });

      const settingsGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => mockCompanySettings
      });

      mockDoc.mockImplementation((docId) => {
        if (docId === 'default') {
          return { get: settingsGet };
        }
        return { get: mockGet };
      });

      mockCollection.mockReturnValue({ doc: mockDoc });

      const result = await faceCheckService(userId, embedding2, 13.932548, 109.155862);

      // Distance ~5.196 > 0.6 threshold, should fail
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Khuôn mặt|không khớp/);
    });

    it('should calculate GPS distance using Haversine formula', async () => {
      const userId = 'user123';
      const storedEmbedding = new Array(128).fill(0.5);
      const testEmbedding = new Array(128).fill(0.51);

      // Your location vs a far location
      const companyLat = 13.932548;
      const companyLng = 109.155862;
      const farLat = 14.032548; // About 11km away
      const farLng = 109.255862;

      const mockCompanySettings = {
        lat: companyLat,
        lng: companyLng,
        radius: 1000 // 1km radius
      };

      const mockGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ userId, embedding: storedEmbedding })
      });

      const settingsGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => mockCompanySettings
      });

      mockDoc.mockImplementation((docId) => {
        if (docId === 'default') {
          return { get: settingsGet };
        }
        return { get: mockGet };
      });

      mockCollection.mockReturnValue({ doc: mockDoc });

      const result = await faceCheckService(userId, testEmbedding, farLat, farLng);

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/ngoài|khu vực|làm việc/);
      // GPS distance should be more than 1000m
    });
  });
});