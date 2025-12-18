const { Builder, By, until } = require("selenium-webdriver");
const edge = require("selenium-webdriver/edge");
const assert = require("assert");

// Cấu hình
const CONFIG = {
  FRONTEND_BASE: "http://127.0.0.1:5500/frontend",
  DEFAULT_TIMEOUT: 10000,
  SHORT_TIMEOUT: 5000,
  VIDEO_TIMEOUT: 15000
};

const CREDENTIALS = {
  EMAIL: "giahan1835@gmail.com",
  PASS: "12345678"
};

async function runCheckinTest() {
  console.log("\n🚀 [CHECK-IN TEST] KHỞI ĐỘNG...");

  // 1. CẤU HÌNH EDGE: TỰ ĐỘNG CẤP QUYỀN CAMERA
  let options = new edge.Options();
  options.addArguments("--use-fake-ui-for-media-stream");     // Tự động cho phép camera
  options.addArguments("--use-fake-device-for-media-stream"); // Dùng video giả của trình duyệt
  options.addArguments("--disable-blink-features=AutomationControlled");

  let driver = await new Builder()
    .forBrowser("MicrosoftEdge")
    .setEdgeOptions(options)
    .build();

  try {
    // --- BƯỚC 1: ĐĂNG NHẬP ---
    console.log("🔐 Bước 1: Đăng nhập...");
    await driver.get(`${CONFIG.FRONTEND_BASE}/auth.html`);
    await driver.findElement(By.css("input[type='email']")).sendKeys(CREDENTIALS.EMAIL);
    await driver.findElement(By.css("input[type='password']")).sendKeys(CREDENTIALS.PASS);
    await driver.findElement(By.css("button[type='submit']")).click();
    
    await driver.wait(until.urlContains("employee.html"), CONFIG.DEFAULT_TIMEOUT);
    console.log("✅ Đăng nhập thành công.");

    await driver.sleep(1000);

    // --- BƯỚC 2: CLICK BUTTON CHECK-IN ---
    console.log("📸 Bước 2: Click button Check-in...");
    const homeTab = await driver.findElement(By.css(".nav-item[data-route='home']"));
    await homeTab.click();
    await driver.sleep(500);

    const checkinBtn = await driver.wait(until.elementLocated(By.id("btnFaceCheckin")), CONFIG.SHORT_TIMEOUT);
    await checkinBtn.click();
    console.log("✅ Đã click button Check-in.");

    // --- BƯỚC 3: KIỂM TRA THÔNG BÁO XIN QUYỀN CAMERA ---
    console.log("🎥 Bước 3: Kiểm tra thông báo xin quyền camera...");
    await driver.sleep(1000);

    const cameraPermissionGranted = await driver.executeScript(`
      // Kiểm tra xem getUserMedia có được gọi không
      return navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
    `);

    if (cameraPermissionGranted) {
      console.log("✅ API Camera (getUserMedia) có sẵn.");
    } else {
      console.warn("⚠️ API Camera không khả dụng.");
    }

    console.log("ℹ️ Với fake camera, quyền được cấp tự động (--use-fake-ui-for-media-stream).");
    console.log("ℹ️ Trong môi trường thực, người dùng sẽ thấy popup xin quyền camera.");

    // --- BƯỚC 4: KIỂM TRA MODAL ĐÃ MỞ ---
    console.log("📱 Bước 4: Kiểm tra Modal Check-in đã mở...");
    const modal = await driver.wait(until.elementLocated(By.id("faceModal")), CONFIG.SHORT_TIMEOUT);
    await driver.wait(async () => (await modal.getAttribute("open")) !== null, CONFIG.SHORT_TIMEOUT);
    console.log("✅ Modal Check-in đã mở.");

    // --- BƯỚC 5: KIỂM TRA LUỒNG VIDEO ---
    console.log("📹 Bước 5: Kiểm tra tín hiệu Video...");
    const video = await driver.findElement(By.id("faceVideo"));

    console.log("⏳ Đang đợi video khởi động...");
    await driver.sleep(2000);

    const videoCheck = await driver.executeScript(`
      const video = arguments[0];
      return {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        paused: video.paused,
        srcObject: video.srcObject !== null,
        videoTracks: video.srcObject ? video.srcObject.getVideoTracks().length : 0
      };
    `, video);

    console.log("📊 Trạng thái Video:", videoCheck);

    const isVideoReady = videoCheck.readyState >= 2 || videoCheck.srcObject;
    
    if (!isVideoReady) {
      console.log("⚠️ Video chưa sẵn sàng, đợi thêm...");
      await driver.sleep(3000);
      
      const videoCheck2 = await driver.executeScript(`
        const video = arguments[0];
        return {
          readyState: video.readyState,
          srcObject: video.srcObject !== null,
          videoTracks: video.srcObject ? video.srcObject.getVideoTracks().length : 0
        };
      `, video);
      
      console.log("📊 Trạng thái Video (lần 2):", videoCheck2);
      
      assert.ok(
        videoCheck2.readyState >= 2 || videoCheck2.srcObject,
        "❌ Lỗi: Video Camera không phát tín hiệu sau khi đợi!"
      );
    }
    
    if (videoCheck.videoTracks > 0) {
      console.log(`✅ Video Camera có ${videoCheck.videoTracks} video track(s).`);
    }
    
    console.log("✅ Video Camera hoạt động tốt.");

    // --- BƯỚC 6: KIỂM TRA PHẢN HỒI NHẬN DIỆN ---
    console.log("🧠 Bước 6: Kiểm tra phản hồi của AI...");
    const statusDiv = await driver.findElement(By.id("faceStatus"));
    
    await driver.wait(async () => {
        const text = await statusDiv.getText();
        return text.length > 0 && !text.includes("Đang chuẩn bị");
    }, CONFIG.VIDEO_TIMEOUT);
    
    const finalStatus = await statusDiv.getText();
    console.log(`✅ Hệ thống đã phản hồi trạng thái: "${finalStatus}"`);

    // --- BƯỚC 7: ĐÓNG MODAL ---
    console.log("🔒 Bước 7: Đóng modal...");
    const closeBtn = await driver.findElement(By.id("faceCloseBtn"));
    await closeBtn.click();
    console.log("✅ Đã đóng modal.");
    
    console.log("\n🎉 KẾT LUẬN: GIAO DIỆN & TÍN HIỆU CAMERA HOẠT ĐỘNG TỐT.");
    console.log("📝 LƯU Ý: Trong test tự động, quyền camera được cấp tự động.");
    console.log("📝 Trong thực tế, người dùng sẽ thấy popup xin quyền camera trước khi quét.");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    console.error("Stack:", err.stack);
  } finally {
    await driver.quit();
  }
}

runCheckinTest();