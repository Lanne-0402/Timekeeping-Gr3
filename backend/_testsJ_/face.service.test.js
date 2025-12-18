import db from '../config/firebase.js';

// Mock Firebase
jest.mock('../config/firebase.js', () => ({
  __esModule: true,
  default: {
    collection: jest.fn()
  }
}));

// Lưu env gốc
const originalEnv = process.env;

describe('Face Service Logic', () => {
  let mockCollection;
  let mockDoc;
  let mockGet;
  let mockSet;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Modules: Quan trọng nhất! Xóa cache để file service được load lại từ đầu
    jest.resetModules(); 
    
    // Reset Env về mặc định
    process.env = { ...originalEnv, FACE_THRESHOLD: '0.6' };

    // Setup Mock Firebase như cũ
    mockSet = jest.fn().mockResolvedValue(undefined);
    mockGet = jest.fn();
    mockDoc = jest.fn();
    mockCollection = jest.fn();
    
    // Vì ta resetModules, ta cần gán lại mock cho db mỗi lần
    // Lưu ý: Do jest.resetModules(), 'db' import ở trên có thể bị mất liên kết
    // nên ta sẽ import lại db bên trong test hoặc dùng require
    
    // Cách an toàn nhất là mock lại hành vi bên trong beforeEach
    // Nhưng vì ta đã mock ở top-level, Jest factory vẫn hoạt động.
    // Chỉ cần đảm bảo db.collection trỏ đúng mock.
    const dbModule = require('../config/firebase.js').default;
    dbModule.collection = mockCollection;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // Helper để import service một cách động (Dynamic)
  // Mỗi khi gọi hàm này, nó sẽ load file service với giá trị process.env hiện tại
  const loadService = async () => {
    return import('../services/face.services.js');
  };

  describe('enrollFaceService', () => {
    const userId = 'user123';
    const embedding = new Array(128).fill(0.5);

    it('should successfully enroll face', async () => {
      // 1. Load service
      const { enrollFaceService } = await loadService();

      mockDoc.mockReturnValue({ set: mockSet });
      mockCollection.mockReturnValue({ doc: mockDoc });

      await enrollFaceService(userId, embedding);

      expect(mockCollection).toHaveBeenCalledWith('faceEmbeddings');
      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe('faceCheckService', () => {
    const userId = 'user123';
    const storedEmbedding = new Array(128).fill(0.5);
    const lat = 13.932548;
    const lng = 109.155862;
    const mockSettings = { lat, lng, radius: 100 };

    beforeEach(() => {
      // Setup mock data chung
      const faceGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ userId, embedding: storedEmbedding })
      });
      const settingsGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => mockSettings
      });

      mockDoc.mockImplementation((docId) => {
        if (docId === 'default') return { get: settingsGet };
        return { get: faceGet };
      });
      mockCollection.mockReturnValue({ doc: mockDoc });
    });

    it('Should RESPECT custom FACE_THRESHOLD (Strict mode)', async () => {
      // 1. SET ENV TRƯỚC
      process.env.FACE_THRESHOLD = '0.05'; 
      
      // 2. LOAD FILE SAU (Lúc này dòng const FACE_THRESHOLD ở backend mới chạy lại và ăn giá trị 0.05)
      const { faceCheckService } = await loadService();

      const testEmbedding = new Array(128).fill(0.52); // Distance ~0.22

      const result = await faceCheckService(userId, testEmbedding, lat, lng);

      // 3. Mong đợi Fail (vì 0.22 > 0.05)
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/không khớp/i);
    });

    it('Should PASS if custom threshold is loose', async () => {
      // 1. SET ENV
      process.env.FACE_THRESHOLD = '10.0'; 
      
      // 2. LOAD FILE
      const { faceCheckService } = await loadService();

      const testEmbedding = new Array(128).fill(0.9); // Lệch rất nhiều

      const result = await faceCheckService(userId, testEmbedding, lat, lng);

      // 3. Mong đợi Pass
      expect(result.success).toBe(true);
    });

    it('Should use DEFAULT threshold (0.6) if not set', async () => {
      // Không set env gì cả -> Mặc định 0.6
      const { faceCheckService } = await loadService();
      
      // Distance ~0.11 < 0.6 -> Pass
      const testEmbedding = new Array(128).fill(0.51); 

      const result = await faceCheckService(userId, testEmbedding, lat, lng);

      expect(result.success).toBe(true);
    });
  });

  describe('Helper Functions - Integration', () => {
    
    it('should calculate euclidean distance correctly', async () => {

      const { faceCheckService } = await loadService();

      const userId = 'user123';
      const embedding1 = [1, 2, 3];
      const embedding2 = [4, 5, 6]; // Khác nhau -> Distance cao

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

      // faceCheckService đã được định nghĩa
      const result = await faceCheckService(userId, embedding2, 13.932548, 109.155862);

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Khuôn mặt|không khớp/);
    });

    it('should calculate GPS distance using Haversine formula', async () => {

      const { faceCheckService } = await loadService();

      const userId = 'user123';
      const storedEmbedding = new Array(128).fill(0.5);
      const testEmbedding = new Array(128).fill(0.51); // Embedding khớp

      // Location setup: User đang ở rất xa công ty
      const companyLat = 13.932548;
      const companyLng = 109.155862;
      const farLat = 14.032548; // Cách khoảng 11km
      const farLng = 109.255862;

      const mockCompanySettings = {
        lat: companyLat,
        lng: companyLng,
        radius: 1000 // Bán kính 1km
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
      // Kỳ vọng lỗi do khoảng cách xa
      expect(result.message).toMatch(/ngoài|khu vực|làm việc/);
    });
  });
});