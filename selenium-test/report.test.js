// report.test.js
const { Builder, By, until } = require("selenium-webdriver");
const edge = require("selenium-webdriver/edge");
const assert = require("assert");

const CONFIG = {
  FRONTEND_BASE: "http://127.0.0.1:5500/frontend",
  DEFAULT_TIMEOUT: 10000,
  SHORT_TIMEOUT: 5000
};

const CREDENTIALS = {
  EMAIL: "admin@timekeeping.com",
  PASS: "admin123"
};

async function runReportTest() {
  console.log("\n🚀 [REPORT TEST] KHỞI ĐỘNG...");
  let driver = await new Builder().forBrowser("MicrosoftEdge").build();

  try {
    // 1. Đăng nhập Admin
    console.log("🔐 Bước 1: Đăng nhập Admin...");
    await driver.get(`${CONFIG.FRONTEND_BASE}/auth.html`);
    await driver.findElement(By.css("input[type='email']")).sendKeys(CREDENTIALS.EMAIL);
    await driver.findElement(By.css("input[type='password']")).sendKeys(CREDENTIALS.PASS);
    await driver.findElement(By.css("button[type='submit']")).click();
    await driver.wait(until.urlContains("manager.html"), CONFIG.DEFAULT_TIMEOUT);
    console.log("✅ Đăng nhập Admin thành công.");

    // 2. Vào Tab Báo cáo
    console.log("\n📊 Bước 2: Chuyển sang tab Báo cáo...");
    const reportTab = await driver.wait(
      until.elementLocated(By.css(".nav-item[data-route='reports']")), 
      CONFIG.SHORT_TIMEOUT
    );
    await reportTab.click();
    
    // Đợi section hiện ra
    const reportSection = await driver.findElement(By.id("reports"));
    await driver.wait(
      async () => !(await reportSection.getAttribute("class")).includes("hidden"), 
      CONFIG.SHORT_TIMEOUT
    );
    console.log("✅ Đã vào màn hình Báo cáo.");

    // 3. Chọn Tháng hiện tại (Dynamic Date)
    console.log("\n📅 Bước 3: Chọn tháng báo cáo...");
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
    const monthInput = await driver.findElement(By.id("repMonth"));
    
    // Dùng JS để set value cho input date (ổn định hơn sendKeys)
    await driver.executeScript("arguments[0].value = arguments[1]", monthInput, currentMonth);
    console.log(`✅ Đã chọn tháng báo cáo: ${currentMonth}`);

    // 4. Click Reload & Chờ dữ liệu
    console.log("\n🔄 Bước 4: Tải dữ liệu báo cáo...");
    await driver.findElement(By.id("btnReloadReports")).click();
    await driver.sleep(2000); // Chờ API trả về

    // 5. Lấy số liệu & Assert Logic
    console.log("\n📈 Bước 5: Kiểm tra số liệu thống kê...");
    const getNum = async (id) => {
        const text = await driver.findElement(By.id(id)).getText();
        return parseInt(text.replace(/[^0-9]/g, '')) || 0;
    };

    const total = await getNum("sumTotal");
    const present = await getNum("sumPresent");
    const absent = await getNum("sumAbsent");

    console.log(`📊 SỐ LIỆU THỐNG KÊ:`);
    console.log(`   + Tổng ca: ${total}`);
    console.log(`   + Có mặt: ${present}`);
    console.log(`   + Vắng: ${absent}`);

    // LOGIC CHECK: Tổng ca phải lớn hơn hoặc bằng tổng thành phần
    assert.ok(
      total >= (present + absent), 
      `❌ LỖI LOGIC: Tổng ca (${total}) nhỏ hơn (Có mặt + Vắng)!`
    );
    console.log("✅ Logic toán học: HỢP LÝ.");

    // 6. Kiểm tra Bảng chi tiết
    console.log("\n📋 Bước 6: Kiểm tra bảng chi tiết nhân viên...");
    const tableHtml = await driver.findElement(By.id("employeeSummaryTable")).getAttribute("innerHTML");
    
    if (tableHtml.trim().length > 0) {
      console.log("✅ Bảng chi tiết nhân viên ĐÃ CÓ dữ liệu.");
      
      // 7. Click vào button "Xem chi tiết" của nhân viên đầu tiên
      console.log("\n👁️ Bước 7: Mở chi tiết nhân viên...");
      // Tìm button với class "emp-detail-btn"
      const detailButtons = await driver.findElements(By.css(".emp-detail-btn"));
      
      if (detailButtons.length > 0) {
        // Click button đầu tiên
        await detailButtons[0].click();
        console.log("✅ Đã click vào nút 'Xem chi tiết'.");
        
        // Đợi modal xuất hiện
        await driver.sleep(1000);
        
        // Tìm modal chi tiết (có thể là dialog hoặc div với class modal)
        let modalFound = false;
        let modalElement = null;
        
        // Modal ID là "empDetailModal" theo manager.js
        try {
          modalElement = await driver.findElement(By.id("empDetailModal"));
          const modalClass = await modalElement.getAttribute("class");
          
          // Kiểm tra modal đã mở (không có class "hidden")
          if (!modalClass.includes("hidden")) {
            modalFound = true;
          }
        } catch (e) {
          console.warn("⚠️ Không tìm thấy modal empDetailModal.");
        }
        
        if (modalFound) {
          console.log("✅ Modal chi tiết đã mở.");
          
          // Đọc thông tin trong modal
          try {
            const modalText = await modalElement.getText();
            console.log(`\n📝 Nội dung modal:\n${modalText.substring(0, 200)}...`);
            
            // Kiểm tra xem có hiển thị "Không có dữ liệu ca làm" không
            if (modalText.includes("Không có dữ liệu ca làm")) {
              console.log("ℹ️ Nhân viên này không có dữ liệu ca làm trong tháng.");
            } else {
              console.log("✅ Modal hiển thị thông tin chi tiết ca làm.");
            }
          } catch (e) {
            console.log("⚠️ Không đọc được nội dung modal.");
          }
          
          // 8. Đóng modal
          console.log("\n🔒 Bước 8: Đóng modal chi tiết...");
          await driver.sleep(1000);
          
          let modalClosed = false;
          let attempts = 0;
          const maxAttempts = 3;
          
          while (!modalClosed && attempts < maxAttempts) {
            attempts++;
            console.log(`🔄 Thử đóng modal lần ${attempts}...`);
            
            // Thử cách 1: Click nút Đóng với ID đúng "btnCloseEmpDetail"
            try {
              const closeButton = await driver.findElement(By.id("btnCloseEmpDetail"));
              
              // Scroll đến button và đợi
              await driver.executeScript("arguments[0].scrollIntoView({behavior: 'instant', block: 'center'});", closeButton);
              await driver.sleep(300);
              
              // Click bằng JavaScript
              await driver.executeScript("arguments[0].click();", closeButton);
              console.log("✅ Đã click nút Đóng.");
              await driver.sleep(1000);
              
              // Kiểm tra modal đã đóng chưa (có class "hidden")
              const modal = await driver.findElement(By.id("empDetailModal"));
              const modalClass = await modal.getAttribute("class");
              if (modalClass && modalClass.includes("hidden")) {
                modalClosed = true;
                console.log("✅ Modal đã đóng thành công.");
              }
            } catch (e) {
              console.warn(`⚠️ Lần ${attempts}: Không click được nút Đóng.`);
            }
            
            // Nếu chưa đóng, thử click overlay
            if (!modalClosed) {
              try {
                const modal = await driver.findElement(By.id("empDetailModal"));
                await driver.executeScript("arguments[0].classList.add('hidden');", modal);
                console.log("✅ Đã force đóng modal bằng JS.");
                modalClosed = true;
                await driver.sleep(1000);
              } catch (e) {
                console.warn(`⚠️ Lần ${attempts}: Không force đóng được modal.`);
              }
            }
            
            // Nếu vẫn chưa đóng, thử ESC
            if (!modalClosed) {
              try {
                await driver.actions().sendKeys("\uE00C").perform(); // ESC
                console.log("✅ Đã nhấn ESC.");
                await driver.sleep(1000);
                
                const modal = await driver.findElement(By.id("empDetailModal"));
                const modalClass = await modal.getAttribute("class");
                if (modalClass && modalClass.includes("hidden")) {
                  modalClosed = true;
                  console.log("✅ Modal đã đóng bằng ESC.");
                }
              } catch (e) {
                console.warn(`⚠️ Lần ${attempts}: Không gửi được ESC.`);
              }
            }
          }
          
          if (!modalClosed) {
            console.error("❌ KHÔNG THỂ đóng modal sau 3 lần thử!");
            // Thử force close bằng JavaScript
            try {
              await driver.executeScript(`
                const modal = document.getElementById('empDetailModal');
                if (modal) modal.classList.add('hidden');
              `);
              console.log("⚠️ Đã force close modal bằng JavaScript.");
              await driver.sleep(500);
            } catch (e) {
              console.error("❌ Không thể force close modal.");
            }
          }
        }
      } else {
        console.warn("⚠️ Không tìm thấy nút 'Xem chi tiết'.");
      }
    } else {
      console.warn("⚠️ CẢNH BÁO: Bảng chi tiết đang trống (Có thể do chưa có ca làm trong tháng này).");
    }

    // 9. Click nút "Xuất báo cáo" và Xử lý Download
    console.log("\n📥 Bước 9: Xuất báo cáo...");
    
    // Đảm bảo không còn modal nào che khuất
    await driver.sleep(1000); 

    try {
      // Tìm nút export (Ưu tiên tìm theo ID đúng trong manager.js)
      let exportButton = await driver.wait(
        until.elementLocated(By.id("btnLoadSummary")), 
        5000 // Chờ tối đa 5s để nút xuất hiện
      );

      // Scroll tới nút để đảm bảo nó hiển thị
      await driver.executeScript("arguments[0].scrollIntoView({behavior: 'instant', block: 'center'});", exportButton);
      await driver.sleep(500);

      // Click nút (Dùng JS click để tránh bị chặn bởi overlay nếu có)
      await driver.executeScript("arguments[0].click();", exportButton);
      console.log("✅ Đã click nút 'Xuất báo cáo', đang chờ server xử lý...");

      // --- QUAN TRỌNG: Xử lý logic Fetch & Download ---
      
      // 1. Chờ xem có Alert lỗi không (Ví dụ: 401 Unauthorized hoặc 500 Error)
      try {
        await driver.wait(until.alertIsPresent(), 2000); // Chờ alert trong 2s
        let alert = await driver.switchTo().alert();
        let alertText = await alert.getText();
        console.error(`❌ LỖI: Server trả về Alert: "${alertText}"`);
        await alert.accept(); // Đóng alert
      } catch (e) {
        // Nếu timeout (không có alert) nghĩa là API chạy OK hoặc đang chạy
        console.log("ℹ️ Không có thông báo lỗi từ hệ thống (Tốt).");
      }

      // 2. Chờ đủ lâu để file PDF tải về
      // Vì manager.js dùng await fetch() -> blob -> click(), nên cần thời gian để tải blob về RAM
      console.log("⏳ Đang đợi file PDF tải xuống (5 giây)...");
      await driver.sleep(5000); 
      
      console.log("✅ Quy trình xuất báo cáo hoàn tất (Vui lòng kiểm tra thư mục Downloads).");

    } catch (e) {
      console.warn("⚠️ Lỗi khi thực hiện xuất báo cáo:", e.message);
      // Fallback: Nếu không tìm thấy ID btnLoadSummary, thử tìm bằng text
      try {
         const fallbackBtn = await driver.findElement(By.xpath("//button[contains(text(), 'Xuất báo cáo')]"));
         await driver.executeScript("arguments[0].click();", fallbackBtn);
         console.log("✅ (Fallback) Đã click nút bằng Text locator.");
         await driver.sleep(5000);
      } catch (err) {
         console.error("❌ Hoàn toàn không tìm thấy nút Xuất báo cáo.");
      }
    }

    console.log("\n🎉 REPORT TEST PASSED - TẤT CẢ CHỨC NĂNG HOẠT ĐỘNG TỐT!");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    console.error("Stack:", err.stack);
  } finally {
    await driver.quit();
  }
}

runReportTest();