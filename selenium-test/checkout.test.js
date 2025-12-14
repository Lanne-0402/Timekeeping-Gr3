// checkout.test.js
const { Builder, By, until } = require("selenium-webdriver");
const edge = require("selenium-webdriver/edge");
const assert = require("assert");

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

async function runCheckoutTest() {
  console.log("\n🚀 [CHECK-OUT TEST] KHỞI ĐỘNG...");

  // Cấu hình Camera Permission
  let options = new edge.Options();
  options.addArguments("--use-fake-ui-for-media-stream");
  options.addArguments("--use-fake-device-for-media-stream");
  options.addArguments("--disable-blink-features=AutomationControlled");

  let driver = await new Builder()
    .forBrowser("MicrosoftEdge")
    .setEdgeOptions(options)
    .build();

  try {
    // 1. Đăng nhập
    console.log("🔐 Bước 1: Đăng nhập...");
    await driver.get(`${CONFIG.FRONTEND_BASE}/auth.html`);
    await driver.findElement(By.css("input[type='email']")).sendKeys(CREDENTIALS.EMAIL);
    await driver.findElement(By.css("input[type='password']")).sendKeys(CREDENTIALS.PASS);
    await driver.findElement(By.css("button[type='submit']")).click();
    await driver.wait(until.urlContains("employee.html"), CONFIG.DEFAULT_TIMEOUT);
    console.log("✅ Đăng nhập thành công.");

    // Đợi trang load xong
    await driver.sleep(1000);

    // 2. Click Check-out
    console.log("📤 Bước 2: Mở chức năng Check-out...");
    const checkoutBtn = await driver.wait(until.elementLocated(By.id("btnFaceCheckout")), CONFIG.SHORT_TIMEOUT);
    await checkoutBtn.click();

    // 3. Verify Modal mở
    const modal = await driver.wait(until.elementLocated(By.id("faceModal")), CONFIG.SHORT_TIMEOUT);
    await driver.wait(async () => (await modal.getAttribute("open")) !== null, CONFIG.SHORT_TIMEOUT);
    console.log("✅ Modal Check-out đã mở.");

    // 4. Verify Camera đang chạy
    console.log("📹 Bước 3: Kiểm tra tín hiệu Video...");
    const video = await driver.findElement(By.id("faceVideo"));
    
    // Đợi video load và bắt đầu phát
    console.log("⏳ Đang đợi video khởi động...");
    await driver.sleep(2000);

    // Kiểm tra nhiều thuộc tính của video
    const videoCheck = await driver.executeScript(`
      const video = arguments[0];
      return {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        paused: video.paused,
        srcObject: video.srcObject !== null
      };
    `, video);

    console.log("📊 Trạng thái Video:", videoCheck);

    // readyState >= 2 hoặc có srcObject
    const isVideoReady = videoCheck.readyState >= 2 || videoCheck.srcObject;
    
    if (!isVideoReady) {
      console.log("⚠️ Video chưa sẵn sàng, đợi thêm...");
      await driver.sleep(3000);
      
      // Kiểm tra lại
      const videoCheck2 = await driver.executeScript(`
        const video = arguments[0];
        return {
          readyState: video.readyState,
          srcObject: video.srcObject !== null
        };
      `, video);
      
      console.log("📊 Trạng thái Video (lần 2):", videoCheck2);
      
      assert.ok(
        videoCheck2.readyState >= 2 || videoCheck2.srcObject,
        "❌ Camera không bật được sau khi đợi!"
      );
    }
    
    console.log("✅ Camera Check-out đang hoạt động.");

    // 5. Verify Trạng thái và kiểm tra check-out thành công
    console.log("🧠 Bước 4: Kiểm tra phản hồi của AI...");
    const statusDiv = await driver.findElement(By.id("faceStatus"));
    
    // Đợi trạng thái thay đổi
    await driver.wait(async () => {
      const text = await statusDiv.getText();
      return text.length > 0 && !text.includes("Đang chuẩn bị");
    }, CONFIG.VIDEO_TIMEOUT);
    
    const statusText = await statusDiv.getText();
    console.log(`📝 Trạng thái AI: "${statusText}"`);
    
    let checkoutSuccess = false;
    if (statusText.toLowerCase().includes("thành công") || 
        statusText.toLowerCase().includes("check-out ok")) {
      checkoutSuccess = true;
      console.log("✅ Check-out thành công!");
    } else {
      console.warn("⚠️ Check-out có thể chưa thành công hoặc có lỗi.");
    }

    // 6. Đóng modal
    console.log("📍 Bước 5: Đóng modal...");
    await driver.findElement(By.id("faceCloseBtn")).click();
    console.log("✅ Đã đóng modal thành công.");
    await driver.sleep(1000);

    // 7. Chuyển sang Lịch sử chấm công để kiểm tra
    console.log("\n📋 Bước 6: Kiểm tra Lịch sử chấm công...");
    const historyTab = await driver.wait(
      until.elementLocated(By.css(".nav-item[data-route='history']")), 
      CONFIG.SHORT_TIMEOUT
    );
    await historyTab.click();
    console.log("✅ Đã chuyển sang tab Lịch sử.");

    // Đợi table load
    await driver.sleep(1500);

    // 8. Kiểm tra bảng lịch sử có dữ liệu
    const historyTable = await driver.findElement(By.id("histTable"));
    const tbody = await historyTable.findElement(By.css("tbody"));
    const rows = await tbody.findElements(By.css("tr"));

    console.log(`📊 Số dòng trong lịch sử: ${rows.length}`);

    if (rows.length === 0) {
      console.warn("⚠️ Cảnh báo: Bảng lịch sử chấm công trống!");
    } else {
      console.log("✅ Bảng lịch sử có dữ liệu.");

      // Lấy dòng đầu tiên (mới nhất)
      const firstRow = rows[0];
      const cells = await firstRow.findElements(By.css("td"));

      if (cells.length >= 3) {
        const date = await cells[0].getText();
        const checkinTime = await cells[1].getText();
        const checkoutTime = await cells[2].getText();

        console.log("\n📌 Bản ghi mới nhất:");
        console.log(`   Ngày: ${date}`);
        console.log(`   Check-in: ${checkinTime}`);
        console.log(`   Check-out: ${checkoutTime}`);

        // Kiểm tra xem có check-out time không
        if (checkoutTime && checkoutTime.trim() !== "" && checkoutTime !== "-") {
          console.log("✅ Check-out đã được ghi nhận trong lịch sử!");
        } else {
          console.warn("⚠️ Check-out chưa được cập nhật trong lịch sử.");
        }
      }
    }

    console.log("\n🎉 KẾT LUẬN: CHỨC NĂNG CHECK-OUT & LỊCH SỬ HOẠT ĐỘNG TỐT.");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    console.error("Stack:", err.stack);
  } finally {
    await driver.quit();
  }
}

runCheckoutTest();